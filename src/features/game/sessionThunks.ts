import { dealingEnded, dealingProgressed, setRoute } from '../../app/appSlice';
import type { AppThunk } from '../../app/appThunk';
import { dealFromSeed } from '../../domain/deal';
import type { GameState, Mode } from '../../domain/types';
import type { DealService } from '../deal/dealService';
import { streakBroken } from '../stats/statsSlice';
import { installed, selectResumable } from './gameSlice';

/**
 * Breaks the streak of the game about to be replaced when the player is walking away from it: it has had an accepted
 * command and is not won. An unstarted game costs nothing to abandon and a won game already settled its streak, so
 * neither changes a statistic. The streak that breaks is the replaced game's own mode, whatever mode comes next.
 */
export function breakStreakOf(outgoing: GameState | null): AppThunk {
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
