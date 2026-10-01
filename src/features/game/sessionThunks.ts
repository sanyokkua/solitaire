import { dealingEnded, dealingProgressed, setRoute } from '../../app/appSlice';
import type { AppThunk } from '../../app/appThunk';
import { dealFromSeed } from '../../domain/deal';
import { decodeDealCode } from '../../domain/dealCode';
import type { GameState, Mode } from '../../domain/types';
import type { DealService } from '../deal/dealService';
import { streakBroken } from '../stats/statsSlice';
import { installed, selectResumable } from './gameSlice';

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
 * Deals a new game of `mode` and installs it (D9). Winnable deals only and the Difficulty (the grade wanted, sent as the
 * request's `target`) are read from the preferences when the start begins and travel in the request, so changing either
 * setting while a deal is pending, or once the game is in play, changes nothing about it. While
 * the deal service works, its progress is published for the dealing overlay. The result is discarded, changing
 * nothing, when the service reports the request `cancelled` (a newer start replaced it), when the game epoch moved
 * while dealing (a restart, a reset or any other install got there first; progress reported after the epoch moved is
 * dropped too), or when a newer start was requested (a deal that had already resolved before the newer request
 * arrived must not install over it). Otherwise the replaced game's streak is
 * broken if it was started and unwon, and the deal is installed with the day key of a Daily deal, or `null`. The
 * dealing progress is cleared at the end only if this is still the latest start on this deal service, so a superseded
 * start never wipes the progress of the one that replaced it. A rejection (no entropy source) propagates after that
 * cleanup, leaving the current game as it was.
 */
export function startGame({ mode }: { readonly mode: Mode }): AppThunk<Promise<void>> {
    return async (dispatch, getState, { dealService }) => {
        const { winnableOnly, difficulty } = getState().preferences;
        const { epoch } = getState().game;
        const startId = (latestStart.get(dealService) ?? 0) + 1;
        latestStart.set(dealService, startId);
        try {
            const outcome = await dealService.deal({ mode, winnableOnly, target: difficulty }, (progress) => {
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
 * Replays the current deal from the start (D10): the same seed, mode, verdict, attempts and grade, so the layout is identical,
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
            grade: current.grade,
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

/**
 * Plays a deal code (D5, GS "Dealing from a deal code"): trims whitespace and ignores case. An invalid code changes
 * nothing and reports `{ ok: false }`. A valid one breaks the replaced game's streak (as any deal replacement does),
 * installs `dealFromSeed(seed, mode)` marked `random` with one attempt, no grade and no Daily date, shows Game, and reports
 * `{ ok: true }`. Installing bumps the game epoch, so any in-flight `startGame` discards its own result through its
 * existing guard when it resolves; `dealingEnded()` here reopens the input gate at once instead of waiting for that
 * stale start's own cleanup to run.
 */
export function playDealCode(code: string): AppThunk<{ readonly ok: boolean }> {
    return (dispatch, getState) => {
        const decoded = decodeDealCode(code);
        if (decoded === null) return { ok: false };

        dispatch(breakStreakOf(getState().game.current));
        const state = dealFromSeed(decoded.seed, decoded.mode, { verdict: 'random', attempts: 1, grade: null });
        dispatch(installed({ state, dailyKey: null }));
        dispatch(dealingEnded());
        dispatch(setRoute('game'));
        return { ok: true };
    };
}
