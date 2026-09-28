import { noticeRaised } from '../../app/appSlice';
import type { AppThunk } from '../../app/appThunk';
import { selectReducedMotion } from '../../app/selectors';
import type { RootState } from '../../app/store';
import { finishPlan } from '../../domain/finish';
import { nextSafeMove } from '../../domain/safeMoves';
import { applyCommand } from '../../domain/engine';
import { displayedScore, winBonus } from '../../domain/scoring';
import type { Command, GameEvent } from '../../domain/types';
import { announcementsOf } from '../interaction/announcements';
import { announced, winRecorded } from '../interaction/interactionSlice';
import { checkDeadEnd } from '../interaction/interactionThunks';
import { dailyCompleted, played, selectModeStats, won } from '../stats/statsSlice';
import { selectClockEligible } from './clock';
import {
    accrued,
    busySet,
    committed,
    countedSet,
    redone,
    replaced,
    selectCanFinish,
    selectCanRedo,
    selectCanUndo,
    undone,
} from './gameSlice';

/**
 * Settles play time at the injected-clock reading `atMs` (D12): the store's own eligibility decides whether the time
 * since the last measurement counts, or whether the anchor is just cleared.
 */
function settleClock(atMs: number): AppThunk {
    return (dispatch, getState) => {
        dispatch(accrued({ atMs, eligible: selectClockEligible(getState()) }));
    };
}

/** How a command joins the undo history: `'new'` starts a step, `'same'` updates the step already in progress. */
export interface CommitOptions {
    readonly entry: 'new' | 'same';
}

/** What a command did: whether the engine accepted it, and the events it produced (a refusal reports its `rejected` event). */
export interface CommitResult {
    readonly accepted: boolean;
    readonly events: readonly GameEvent[];
}

/** The outcome of a command that never reached the engine: no game, or a play that was ignored. */
const IGNORED: CommitResult = { accepted: false, events: [] };

/**
 * The one path every command takes, player-issued or system-issued (D8). One clock reading settles play time before the
 * command is applied, so the time penalty, the win bonus and any recorded best time all use the same final time. A
 * command the engine refuses changes nothing but that settlement. An accepted one is recorded as a new undo step
 * (`entry: 'new'`) or inside the current one (`'same'`), the clock is settled again at the same reading (so the first
 * accepted command sets the anchor and play time counts from it), the game is counted as played on its first accepted
 * command, and the transition from playing to won records the win and, for a Daily deal with a day key, the completed
 * day. Returns the `CommitResult`: `accepted` and the engine's events, including the `rejected` event of a refusal; with
 * no game it is `{ accepted: false, events: [] }`.
 */
export function commitCommand(cmd: Command, options: CommitOptions): AppThunk<CommitResult> {
    return (dispatch, getState, { now }) => {
        const atMs = now();
        dispatch(settleClock(atMs));

        const before = getState().game.current;
        if (before === null) return IGNORED;
        const { state: next, events } = applyCommand(before, cmd);
        if (next === before) return { accepted: false, events };

        dispatch(options.entry === 'new' ? committed(next) : replaced(next));
        dispatch(settleClock(atMs));

        if (!getState().game.counted && next.started) {
            dispatch(played(next.mode));
            dispatch(countedSet(true));
        }
        if (before.status !== 'won' && next.status === 'won') {
            // The settled time is already in `next`: the engine ran on the state the first settlement produced.
            const score = displayedScore(next);
            // Read before `won` overwrites the mode's best time, so "new best" reflects what it was before this win.
            const previousBestMs = selectModeStats(getState(), next.mode).bestTimeMs;
            dispatch(won({ mode: next.mode, elapsedMs: next.elapsedMs, score }));
            dispatch(
                winRecorded({
                    mode: next.mode,
                    score,
                    elapsedMs: next.elapsedMs,
                    moves: next.moves,
                    timeBonus: winBonus(next.elapsedMs, next.scoring),
                    newBestTime: previousBestMs === null || next.elapsedMs < previousBestMs,
                }),
            );
            const { dailyKey } = getState().game;
            if (next.mode === 'daily' && dailyKey !== null) dispatch(dailyCompleted(dailyKey));
        }
        return { accepted: true, events };
    };
}

/** How long a safe-card send waits after the one before it, unless motion is reduced. */
const SAFE_CARD_SPACING_MS = 160;

/** How long each step of a finish waits after the one before it, unless motion is reduced. */
const FINISH_SPACING_MS = 75;

/** What one timed sequence is made of; `runSequence` supplies everything else. */
interface SequenceSteps {
    /** Whether the sequence starts at all, from the state when it is dispatched; when false nothing happens, `busy` included. */
    readonly guard: (state: RootState) => boolean;
    /** The command for step number `step` (from 0), read from the live state before that step's delay, or `undefined` to end. */
    readonly next: (state: RootState, step: number) => Command | undefined;
    /** How long each step waits after the one before it, unless motion is reduced. */
    readonly spacingMs: number;
    /** How step number `step` joins the undo history. */
    readonly entry: (step: number) => CommitOptions['entry'];
    /** An extra check after each delay, when the sequence depends on more than the game (a setting still on). */
    readonly stillValid?: (state: RootState) => boolean;
}

/**
 * Runs a timed sequence of system-issued commands, one per step, each through `commitCommand` so the clock, the played
 * count and a win are handled exactly as for a player move. Does nothing, and never sets `busy`, when `guard` fails.
 * Otherwise `busy` covers the whole sequence. Before each step it takes the command from `next` (ending when there is
 * none), waits `delay` (0 ms under reduced motion), and then stops if the game was replaced or cleared (the epoch
 * moved), the game is gone or won, or `stillValid` no longer holds; it also stops after any step the engine refuses.
 * `busy` is cleared at the end only if the epoch is unchanged: installing or clearing a game already reset it, and a
 * newer game's own sequence must not be clobbered. The steps announce nothing themselves: when the sequence ends,
 * normally or by stopping early, in the same game, it dispatches one `announced` batch, `sentHome{count}` (the
 * accepted steps that moved a card to a foundation, when there were any) followed by `won` (when a step won), so a
 * long sequence never floods the polite region. The returned promise settles when the sequence has ended; it rejects
 * if a step throws, with `busy` cleared and nothing announced.
 */
function runSequence({ guard, next, spacingMs, entry, stillValid }: SequenceSteps): AppThunk<Promise<void>> {
    return async (dispatch, getState, { delay }) => {
        const start = getState();
        if (!guard(start)) return;

        const { epoch } = start.game;
        let sentHome = 0;
        let didWin = false;
        dispatch(busySet(true));
        try {
            for (let step = 0; ; step += 1) {
                const cmd = next(getState(), step);
                if (cmd === undefined) break;

                await delay(selectReducedMotion(getState()) ? 0 : spacingMs);

                const state = getState();
                if (state.game.epoch !== epoch || state.game.current === null || state.game.current.status === 'won') {
                    break;
                }
                if (stillValid !== undefined && !stillValid(state)) break;

                const { accepted, events } = dispatch(commitCommand(cmd, { entry: entry(step) }));
                if (!accepted) break;
                if (events.some((event) => event.type === 'moved' && event.to.pile === 'foundation')) sentHome += 1;
                if (events.some((event) => event.type === 'won')) didWin = true;
            }
        } finally {
            if (getState().game.epoch === epoch) dispatch(busySet(false));
        }

        // Only reached when the sequence ended without throwing; a replaced game's summary belongs to a game that is gone.
        if (getState().game.epoch !== epoch) return;
        dispatch(
            announced([
                ...(sentHome > 0 ? [{ type: 'sentHome' as const, count: sentHome }] : []),
                ...(didWin ? [{ type: 'won' as const }] : []),
            ]),
        );
    };
}

/**
 * Sends safe cards to the foundations one at a time, each as a system-initiated command inside the undo step already
 * in progress (D11), through `runSequence`. Each send is the `nextSafeMove` of the position as it is when the step
 * begins, and the sequence also stops when the setting was switched off. Does nothing, and never sets `busy`, when the
 * setting is off or no safe card is exposed.
 */
function chainSafeCards(): AppThunk<Promise<void>> {
    return runSequence({
        guard: ({ preferences, game }) =>
            preferences.autoSafe &&
            game.current !== null &&
            game.current.status !== 'won' &&
            nextSafeMove(game.current) !== undefined,
        next: ({ game }) => (game.current === null ? undefined : nextSafeMove(game.current)),
        spacingMs: SAFE_CARD_SPACING_MS,
        entry: () => 'same',
        stillValid: ({ preferences }) => preferences.autoSafe,
    });
}

/**
 * Plays one player command as a new undo step, then, while "Auto-move safe cards" is on, sends the safe cards it
 * leaves exposed to the foundations one at a time, 160 ms apart (0 ms under reduced motion), inside that same undo step
 * (see `chainSafeCards`). The returned promise resolves, once the chain has ended, with the `CommitResult` of the
 * player's own command (not of the chain's sends), so a caller can announce the events or show why it was refused; it
 * rejects if a step throws, with `busy` cleared. A refused command returns its result and starts no chain. Ignored,
 * with no change at all and `{ accepted: false, events: [] }`, while a chain or finish is running, when there is no
 * game, or when the game is won. What it announces: the player's own events right after the command, before any chain
 * (a refusal announces its reason; an ignored play announces nothing), then the chain's one `sentHome` summary when it
 * ends. A refusal for the pass limit also raises the `no-redeals` notice. Once an accepted command and its chain have
 * ended in the same game (the epoch did not move), the settled position is checked for a dead end (`checkDeadEnd`),
 * which reports each position once. Only `play` starts a chain: undo, redo and switching the setting on never do.
 */
export function play(cmd: Command): AppThunk<Promise<CommitResult>> {
    return async (dispatch, getState) => {
        const { busy, current, epoch } = getState().game;
        if (busy || current === null || current.status === 'won') return IGNORED;
        const result = dispatch(commitCommand(cmd, { entry: 'new' }));
        dispatch(announced(announcementsOf(result.events)));
        if (result.events.some((event) => event.type === 'rejected' && event.reason === 'pass-limit')) {
            dispatch(noticeRaised('no-redeals'));
        }
        if (result.accepted) {
            await dispatch(chainSafeCards());
            if (getState().game.epoch === epoch) dispatch(checkDeadEnd());
        }
        return result;
    };
}

/**
 * Plays every remaining card home (D11) through `runSequence`. Takes the commands of `finishPlan` for the current
 * position and applies them one at a time, the first as a new undo step and the rest inside it, so every draw and
 * recycle is scored, counted and pass-limited by the engine as it happens, and the win is recorded once. Ignored, with
 * no change at all and no `busy`, unless `selectCanFinish` holds: not busy, not won, and a plan exists. Finishing never
 * starts a safe-card chain. It announces once, when it ends: `sentHome{count}` and, if it won, `won`; then, if the
 * game is still the same one, the settled position is checked for a dead end (`checkDeadEnd`).
 */
export function finish(): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const start = getState();
        const plan = selectCanFinish(start) && start.game.current !== null ? finishPlan(start.game.current) : undefined;
        if (plan === undefined) return;

        await dispatch(
            runSequence({
                guard: () => true,
                next: (_state, step) => plan.commands[step],
                spacingMs: FINISH_SPACING_MS,
                entry: (step) => (step === 0 ? 'new' : 'same'),
            }),
        );
        if (getState().game.epoch === start.game.epoch) dispatch(checkDeadEnd());
    };
}

/** Undoes one step, after settling the clock so the time already played is carried over, and announces `undone`. Does nothing, and announces nothing, when undo is unavailable. */
export function undo(): AppThunk {
    return (dispatch, getState, { now }) => {
        if (!selectCanUndo(getState())) return;
        dispatch(settleClock(now()));
        dispatch(undone());
        dispatch(announced([{ type: 'undone' }]));
    };
}

/** Redoes one step, after settling the clock so the time already played is carried over, and announces `redone`. Does nothing, and announces nothing, when redo is unavailable. */
export function redo(): AppThunk {
    return (dispatch, getState, { now }) => {
        if (!selectCanRedo(getState())) return;
        dispatch(settleClock(now()));
        dispatch(redone());
        dispatch(announced([{ type: 'redone' }]));
    };
}
