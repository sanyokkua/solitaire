import { dealingEnded, setRoute, sheetClosed, sheetOpened, type SheetId } from '../../app/appSlice';
import type { AppThunk } from '../../app/appThunk';
import { decodeDealCode } from '../../domain/dealCode';
import { dealFromSeed } from '../../domain/deal';
import type { Mode } from '../../domain/types';
import { installed } from './gameSlice';
import { breakStreakOf, restart, startGame } from './sessionThunks';

/**
 * Deals a new game of `mode` and shows the Game screen (D3): closes any open sheet, including Win — Deal again is one
 * of the two controls allowed to dismiss it — then shows Game and starts the deal.
 */
export function dealNewGame(mode: Mode): AppThunk<Promise<void>> {
    return async (dispatch) => {
        dispatch(sheetClosed());
        dispatch(setRoute('game'));
        await dispatch(startGame({ mode }));
    };
}

/**
 * Requests a new deal (D3, GS "A new deal asks first during a game in progress"): offers the New deal options for a
 * started, unwon game; otherwise deals the current game's mode at once, or the selected mode when there is no game.
 * Does nothing while a safe-card chain or finish is running, or while a deal is already being prepared (B1, B2).
 */
export function requestNewDeal(): AppThunk<Promise<void> | void> {
    return (dispatch, getState) => {
        const state = getState();
        if (state.game.busy || state.app.dealing !== null) return;

        const { current } = state.game;
        if (current !== null && current.started && current.status !== 'won') {
            dispatch(sheetOpened('newDeal'));
            return;
        }
        return dispatch(dealNewGame(current?.mode ?? state.preferences.selectedMode));
    };
}

/** Restarts the current deal (New deal options' Restart this deal): closes the sheet, then replays the same seed. */
export function restartDeal(): AppThunk {
    return (dispatch) => {
        dispatch(sheetClosed());
        dispatch(restart());
    };
}

/** Shows Home, keeping the current game resumable: closes any open sheet, including Win. */
export function goHome(): AppThunk {
    return (dispatch) => {
        dispatch(sheetClosed());
        dispatch(setRoute('home'));
    };
}

/** Opens a sheet. The UI never dispatches `sheetOpened` directly (an ESLint rule enforces this). */
export function openSheet(id: SheetId): AppThunk {
    return (dispatch) => {
        dispatch(sheetOpened(id));
    };
}

/**
 * Closes the open sheet, except Win: only Menu (`goHome`) and Deal again (`dealNewGame`) dismiss it, so Escape and the
 * backdrop can never close it (D3).
 */
export function closeSheet(): AppThunk {
    return (dispatch, getState) => {
        if (getState().app.sheet === 'win') return;
        dispatch(sheetClosed());
    };
}

/**
 * Pauses the game (D3, D6): only on the Game route, with a game that is not won, and not while a safe-card chain or
 * finish is running or a deal is being prepared (B1, B2). Opens the Paused sheet; the clock stops through the
 * existing eligibility check.
 */
export function pause(): AppThunk {
    return (dispatch, getState) => {
        const state = getState();
        if (state.app.route !== 'game') return;
        if (state.game.busy || state.app.dealing !== null) return;

        const { current } = state.game;
        if (current === null || current.status === 'won') return;
        dispatch(sheetOpened('paused'));
    };
}

/** Resumes from Paused: closes the sheet. */
export function resume(): AppThunk {
    return (dispatch) => {
        dispatch(closeSheet());
    };
}

/**
 * Plays a deal code (D5, GS "Dealing from a deal code"): trims whitespace and ignores case. An invalid code changes
 * nothing and reports `{ ok: false }`. A valid one breaks the replaced game's streak (as any deal replacement does),
 * installs `dealFromSeed(seed, mode)` marked `random` with one attempt and no Daily date, shows Game, and reports
 * `{ ok: true }`. Installing bumps the game epoch, so any in-flight `startGame` discards its own result through its
 * existing guard when it resolves; `dealingEnded()` here reopens the input gate at once instead of waiting for that
 * stale start's own cleanup to run.
 */
export function playDealCode(code: string): AppThunk<{ readonly ok: boolean }> {
    return (dispatch, getState) => {
        const decoded = decodeDealCode(code);
        if (decoded === null) return { ok: false };

        dispatch(breakStreakOf(getState().game.current));
        const state = dealFromSeed(decoded.seed, decoded.mode, { verdict: 'random', attempts: 1 });
        dispatch(installed({ state, dailyKey: null }));
        dispatch(dealingEnded());
        dispatch(setRoute('game'));
        return { ok: true };
    };
}
