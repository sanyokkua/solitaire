import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import { dealingEnded, dealingProgressed, setRoute } from '../../app/appSlice';
import { selectReducedMotion } from '../../app/selectors';
import type { RootState } from '../../app/store';
import type { ThunkExtra } from '../../app/thunkExtra';
import { finishPlan, nextSafeMove } from '../../domain/assist';
import { dealFromSeed } from '../../domain/deal';
import { applyCommand } from '../../domain/engine';
import { displayedScore } from '../../domain/scoring';
import type { Command, GameState, Mode } from '../../domain/types';
import type { DealService } from '../deal/dealService';
import { dailyCompleted, played, streakBroken, won } from '../stats/statsSlice';
import { selectClockEligible } from './clock';
import {
    accrued,
    busySet,
    committed,
    countedSet,
    installed,
    redone,
    replaced,
    selectCanFinish,
    selectCanRedo,
    selectCanUndo,
    selectResumable,
    undone,
} from './gameSlice';

/** A thunk over the app store; the store types are imported type-only so this module and the store never form a cycle at runtime. */
export type AppThunk<Result = void> = ThunkAction<Result, RootState, ThunkExtra, UnknownAction>;

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

/**
 * The one path every command takes, player-issued or system-issued (D8). One clock reading settles play time before the
 * command is applied, so the time penalty, the win bonus and any recorded best time all use the same final time. A
 * command the engine refuses changes nothing but that settlement. An accepted one is recorded as a new undo step
 * (`entry: 'new'`) or inside the current one (`'same'`), the clock is settled again at the same reading (so the first
 * accepted command sets the anchor and play time counts from it), the game is counted as played on its first accepted
 * command, and the transition from playing to won records the win and, for a Daily deal with a day key, the completed
 * day. Returns whether the command was accepted.
 */
export function commitCommand(cmd: Command, options: CommitOptions): AppThunk<boolean> {
    return (dispatch, getState, { now }) => {
        const atMs = now();
        dispatch(settleClock(atMs));

        const before = getState().game.current;
        if (before === null) return false;
        const { state: next } = applyCommand(before, cmd);
        if (next === before) return false;

        dispatch(options.entry === 'new' ? committed(next) : replaced(next));
        dispatch(settleClock(atMs));

        if (!getState().game.counted && next.started) {
            dispatch(played(next.mode));
            dispatch(countedSet(true));
        }
        if (before.status !== 'won' && next.status === 'won') {
            // The settled time is already in `next`: the engine ran on the state the first settlement produced.
            dispatch(won({ mode: next.mode, elapsedMs: next.elapsedMs, score: displayedScore(next) }));
            const { dailyKey } = getState().game;
            if (next.mode === 'daily' && dailyKey !== null) dispatch(dailyCompleted(dailyKey));
        }
        return true;
    };
}

/** How long a safe-card send waits after the one before it, unless motion is reduced. */
const SAFE_CARD_SPACING_MS = 160;

/** How long each step of a finish waits after the one before it, unless motion is reduced. */
const FINISH_SPACING_MS = 75;

/**
 * Sends safe cards to the foundations one at a time, each as a system-initiated command inside the undo step already
 * in progress (D11). Every send goes through `commitCommand`, so the clock, the played count and a win are handled
 * exactly as for a player move. Before each send it waits `delay` (0 ms under reduced motion) and then stops if the
 * game was replaced or cleared (the epoch moved), the setting was switched off, or the game is gone or won. `busy`
 * covers the whole sequence and is cleared at the end only if the epoch is unchanged: installing or clearing a game
 * already reset it, and a newer game's own sequence must not be clobbered. Does nothing, and never sets `busy`, when
 * the setting is off or no safe card is exposed.
 */
function chainSafeCards(): AppThunk<Promise<void>> {
    return async (dispatch, getState, { delay }) => {
        const start = getState();
        if (!start.preferences.autoSafe || start.game.current === null || start.game.current.status === 'won') return;
        if (nextSafeMove(start.game.current) === undefined) return;

        const { epoch } = start.game;
        dispatch(busySet(true));
        try {
            for (;;) {
                const { current } = getState().game;
                const send = current === null ? undefined : nextSafeMove(current);
                if (send === undefined) return;

                await delay(selectReducedMotion(getState()) ? 0 : SAFE_CARD_SPACING_MS);

                const now = getState();
                if (now.game.epoch !== epoch || !now.preferences.autoSafe) return;
                if (now.game.current === null || now.game.current.status === 'won') return;
                if (!dispatch(commitCommand(send, { entry: 'same' }))) return;
            }
        } finally {
            if (getState().game.epoch === epoch) dispatch(busySet(false));
        }
    };
}

/**
 * Plays one player command as a new undo step, then, while "Auto-move safe cards" is on, sends the safe cards it
 * leaves exposed to the foundations one at a time, 160 ms apart (0 ms under reduced motion), inside that same undo step
 * (see `chainSafeCards`). The returned promise settles when the chain has ended; it rejects if a step throws, with
 * `busy` cleared. Ignored, with no change at all, while a chain or finish is running, when there is no game, or when
 * the game is won. Only `play` starts a chain: undo, redo and switching the setting on never do.
 */
export function play(cmd: Command): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const { busy, current } = getState().game;
        if (busy || current === null || current.status === 'won') return;
        if (!dispatch(commitCommand(cmd, { entry: 'new' }))) return;
        await dispatch(chainSafeCards());
    };
}

/**
 * Plays every remaining card home (D11). Takes the commands of `finishPlan` for the current position and applies them
 * one at a time, the first as a new undo step and the rest inside it, each through `commitCommand`, so every draw and
 * recycle is scored, counted and pass-limited by the engine as it happens, and the win is recorded once. Before each
 * step it waits `delay` (0 ms under reduced motion) and then stops if the game was replaced or cleared (the epoch
 * moved) or is gone or won; it also stops after any step the engine refuses. `busy` covers the whole sequence and is cleared at the
 * end only if the epoch is unchanged, as in `chainSafeCards`. The returned promise settles when the sequence has ended;
 * it rejects if a step throws, with `busy` cleared. Ignored, with no change at all and no `busy`, unless
 * `selectCanFinish` holds: not busy, not won, and a plan exists. Finishing never starts a safe-card chain.
 */
export function finish(): AppThunk<Promise<void>> {
    return async (dispatch, getState, { delay }) => {
        const start = getState();
        if (!selectCanFinish(start) || start.game.current === null) return;
        const plan = finishPlan(start.game.current);
        if (plan === undefined) return;

        const { epoch } = start.game;
        dispatch(busySet(true));
        try {
            for (const [index, cmd] of plan.commands.entries()) {
                await delay(selectReducedMotion(getState()) ? 0 : FINISH_SPACING_MS);

                const { game } = getState();
                if (game.epoch !== epoch || game.current === null || game.current.status === 'won') return;
                if (!dispatch(commitCommand(cmd, { entry: index === 0 ? 'new' : 'same' }))) return;
            }
        } finally {
            if (getState().game.epoch === epoch) dispatch(busySet(false));
        }
    };
}

/** Undoes one step, after settling the clock so the time already played is carried over. Does nothing when undo is unavailable. */
export function undo(): AppThunk {
    return (dispatch, getState, { now }) => {
        if (!selectCanUndo(getState())) return;
        dispatch(settleClock(now()));
        dispatch(undone());
    };
}

/** Redoes one step, after settling the clock so the time already played is carried over. Does nothing when redo is unavailable. */
export function redo(): AppThunk {
    return (dispatch, getState, { now }) => {
        if (!selectCanRedo(getState())) return;
        dispatch(settleClock(now()));
        dispatch(redone());
    };
}

/**
 * Breaks the streak of the game about to be replaced when the player is walking away from it: it has had an accepted
 * command and is not won. An unstarted game costs nothing to abandon and a won game already settled its streak, so
 * neither changes a statistic. The streak that breaks is the replaced game's own mode, whatever mode comes next.
 */
function breakStreakOf(outgoing: GameState | null): AppThunk {
    return (dispatch) => {
        if (outgoing?.started === true && outgoing.status !== 'won') dispatch(streakBroken(outgoing.mode));
    };
}

/** The latest start id taken per deal service, so a start knows whether a newer one has taken over (one map, many stores). */
const latestStart = new WeakMap<DealService, number>();

/**
 * Deals a new game of `mode` and installs it (D9). Winnable deals only is read from the preferences when the start
 * begins and travels in the request, so changing the setting while a deal is pending changes nothing about it. While
 * the deal service works, its progress is published for the dealing overlay. The result is discarded, changing
 * nothing, when the service reports the request `cancelled` (a newer start replaced it), when the game epoch moved
 * while dealing (progress reported after the epoch moved is dropped too) (a restart, a reset or any other install got there first), or when a newer start was requested (a
 * deal that had already resolved before the newer request arrived must not install over it). Otherwise the replaced game's streak is
 * broken if it was started and unwon, and the deal is installed with the day key of a Daily deal, or `null`. The
 * dealing progress is cleared at the end only if this is still the latest start on this deal service, so a superseded
 * start never wipes the progress of the one that replaced it. A rejection (no entropy source) propagates after that
 * cleanup, leaving the current game as it was.
 */
export function startGame({ mode }: { readonly mode: Mode }): AppThunk<Promise<void>> {
    return async (dispatch, getState, { dealService }) => {
        const { winnableOnly } = getState().preferences;
        const { epoch } = getState().game;
        const startId = (latestStart.get(dealService) ?? 0) + 1;
        latestStart.set(dealService, startId);
        try {
            const outcome = await dealService.deal({ mode, winnableOnly }, (progress) => {
                // A late report after the game was replaced or cleared (reset-all) must not bring the overlay back.
                if (getState().game.epoch === epoch) dispatch(dealingProgressed(progress));
            });
            if (
                outcome.status === 'cancelled' ||
                getState().game.epoch !== epoch ||
                latestStart.get(dealService) !== startId
            ) {
                return;
            }

            dispatch(breakStreakOf(getState().game.current));
            dispatch(installed({ state: outcome.state, dailyKey: outcome.dayKey ?? null }));
        } finally {
            if (latestStart.get(dealService) === startId) dispatch(dealingEnded());
        }
    };
}

/**
 * Replays the current deal from the start (D10): the same seed, mode, verdict and attempts, so the layout is identical,
 * with no moves, time, undo charges or history. It is dealt on the spot, not by the deal service, and reads no
 * preference, so changed settings never alter a game already in play; the day key of a Daily deal is kept. The
 * replaced game's streak is broken if it was started and unwon. Allowed while a safe-card chain or finish is running:
 * installing bumps the epoch, which stops that sequence. Does nothing without a game.
 */
export function restart(): AppThunk {
    return (dispatch, getState) => {
        const { current, dailyKey } = getState().game;
        if (current === null) return;

        const state = dealFromSeed(current.seed, current.mode, {
            verdict: current.verdict,
            attempts: current.attempts,
        });
        dispatch(breakStreakOf(current));
        dispatch(installed({ state, dailyKey }));
    };
}

/**
 * Shows the Game screen for the game in play (D9). Only a resumable game (started and not over) is continued; otherwise
 * nothing happens. It touches nothing but the route, so continuing never replaces the game or breaks a streak.
 */
export function continueGame(): AppThunk {
    return (dispatch, getState) => {
        if (selectResumable(getState())) dispatch(setRoute('game'));
    };
}
