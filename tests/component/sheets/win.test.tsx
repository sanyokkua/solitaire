import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App';
import { setRoute, sheetOpened, systemMotionChanged } from '../../../src/app/appSlice';
import type { AppStore } from '../../../src/app/store';
import { cardId } from '../../../src/domain/cards';
import { dealFromSeed } from '../../../src/domain/deal';
import type { GameState, Mode } from '../../../src/domain/types';
import { cleared, installed } from '../../../src/features/game/gameSlice';
import { play } from '../../../src/features/game/gameThunks';
import { restart } from '../../../src/features/game/sessionThunks';
import { goHome } from '../../../src/features/game/navigationThunks';
import { winRecorded, type WinSummary } from '../../../src/features/interaction/interactionSlice';
import { preferenceSet } from '../../../src/features/preferences/preferencesSlice';
import type { StatsState } from '../../../src/features/stats/statsSlice';
import { WINNING_LINE, parseLine } from '../../fixtures/deals';
import { gameOf } from '../../fixtures/games';
import { faceUp, foundationsOf, makeState, tableauOf } from '../../fixtures/states';
import { installBoardHarness, SIZE } from '../../support/boardHarness';
import { FakeResizeObserver } from '../../support/fakeResizeObserver';
import { renderWithStore } from '../../support/renderWithStore';
import { testStore } from '../../support/testStore';
import { stubElementAnimate, type AnimateStub } from '../../support/waapi';

installBoardHarness();

let waapi: AnimateStub;
beforeEach(() => {
    waapi = stubElementAnimate();
});
afterEach(() => {
    waapi.restore();
    vi.useRealTimers();
});

const KING_OF_SPADES = cardId(3, 13);

/** A game one move from winning: every foundation full but the spades, whose king is alone in column 0. */
function nearlyWon(overrides: Partial<GameState> = {}): GameState {
    return makeState({
        started: true,
        tableau: tableauOf(faceUp(KING_OF_SPADES)),
        foundations: foundationsOf(13, 13, 13, 12),
        ...overrides,
    });
}

const WINNING_MOVE = {
    type: 'move',
    from: { pile: 'tableau', col: 0 },
    index: 0,
    to: { pile: 'foundation', suit: 3 },
} as const;

/** `emptyModeStats` inlined, so this file needs no import of the private helper. */
function emptyModeStats() {
    return { played: 0, won: 0, streak: 0, bestStreak: 0, bestTimeMs: null, bestScore: null };
}

function statsWithBest(mode: Mode, bestTimeMs: number | null): StatsState {
    return {
        modes: {
            draw1: emptyModeStats(),
            draw3: emptyModeStats(),
            vegas: emptyModeStats(),
            daily: emptyModeStats(),
            [mode]: { ...emptyModeStats(), bestTimeMs },
        },
        daily: { completed: [], bestStreak: 0 },
    };
}

/** Mounts the whole app on the Game route with `state` in play, its board measured. */
function mountApp(state: GameState, stats?: StatsState) {
    const store: AppStore = testStore({ preloadedState: { game: gameOf(state), ...(stats ? { stats } : {}) } });
    store.dispatch(setRoute('game'));
    const view = renderWithStore(<App />, { store });
    FakeResizeObserver.instances.at(-1)?.trigger(SIZE);
    return { store, view };
}

const win = (store: AppStore) => act(() => store.dispatch(play(WINNING_MOVE)).then(() => undefined));

const advance = (ms: number) => {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
};

describe('useWinSheet: opening timing', () => {
    it('opens 2,400 ms after the win, not before', async () => {
        vi.useFakeTimers();
        const { store } = mountApp(nearlyWon());

        await win(store);
        expect(store.getState().app.sheet).toBeNull();

        advance(2399);
        expect(store.getState().app.sheet).toBeNull();

        advance(1);
        expect(store.getState().app.sheet).toBe('win');
    });

    // covers: KS-SET-04
    it('opens at once with reduced motion', async () => {
        vi.useFakeTimers();
        const { store } = mountApp(nearlyWon());
        act(() => {
            store.dispatch(systemMotionChanged(true));
        });

        await win(store);

        expect(store.getState().app.sheet).toBe('win');
    });

    it('does not open when a new deal replaces the game before the delay ends', async () => {
        vi.useFakeTimers();
        const { store } = mountApp(nearlyWon());
        await win(store);

        act(() => {
            store.dispatch(installed({ state: nearlyWon(), dailyKey: null }));
        });
        advance(2400);

        expect(store.getState().app.sheet).not.toBe('win');
    });

    it('does not open after Back to Home', async () => {
        vi.useFakeTimers();
        const { store } = mountApp(nearlyWon());
        await win(store);

        act(() => {
            store.dispatch(goHome());
        });
        advance(2400);

        expect(store.getState().app.sheet).not.toBe('win');
        expect(store.getState().app.route).toBe('home');
    });

    it('does not open after the game is cleared', async () => {
        vi.useFakeTimers();
        const { store } = mountApp(nearlyWon());
        await win(store);

        act(() => {
            store.dispatch(cleared());
        });
        advance(2400);

        expect(store.getState().app.sheet).not.toBe('win');
    });

    // covers: KS-GEN-02
    it('replaces a sheet opened during the cascade (Settings) once its delay ends', async () => {
        vi.useFakeTimers();
        const { store } = mountApp(nearlyWon());
        await win(store);

        act(() => {
            store.dispatch(sheetOpened('settings'));
        });
        expect(store.getState().app.sheet).toBe('settings');

        advance(2400);
        expect(store.getState().app.sheet).toBe('win');
    });
});

/** A won game with `winRecorded` and the sheet already open, skipping `useWinSheet`'s own timing. */
function mountWon(summary: WinSummary, stats?: StatsState) {
    const { store, view } = mountApp({ ...nearlyWon({ mode: summary.mode }), status: 'won' }, stats);
    act(() => {
        store.dispatch(winRecorded(summary));
        store.dispatch(sheetOpened('win'));
    });
    return { store, view };
}

const STANDARD_SUMMARY: WinSummary = {
    mode: 'draw1',
    score: 235,
    elapsedMs: 120_000,
    moves: 42,
    timeBonus: 5833,
    newBestTime: true,
    grade: null,
};

const VEGAS_SUMMARY: WinSummary = {
    mode: 'vegas',
    score: 84,
    elapsedMs: 200_000,
    moves: 30,
    timeBonus: 0,
    newBestTime: false,
    grade: null,
};

describe('WinSheet content', () => {
    it('shows the title, the tiles and the Standard bonus line', () => {
        mountWon(STANDARD_SUMMARY);
        const dialog = within(screen.getByRole('dialog'));

        expect(screen.getByRole('heading', { name: 'You win!' })).toBeInTheDocument();
        expect(dialog.getByText('All 52 cards are home, plus a 5833-point time bonus.')).toBeInTheDocument();
        expect(dialog.getByText('235')).toBeInTheDocument();
        expect(dialog.getByText('Score')).toBeInTheDocument();
        expect(dialog.getByText('2:00')).toBeInTheDocument();
        expect(dialog.getByText('042')).toBeInTheDocument();
    });

    it('shows the Bank in the Score tile and no bonus line for Vegas', () => {
        mountWon(VEGAS_SUMMARY);
        const dialog = within(screen.getByRole('dialog'));

        expect(dialog.getByText('$84')).toBeInTheDocument();
        expect(dialog.getByText('Bank')).toBeInTheDocument();
        expect(dialog.getByText('All 52 cards are home.')).toBeInTheDocument();
        expect(dialog.queryByText(/time bonus/)).not.toBeInTheDocument();
    });

    it('shows the "New best time" badge only on a new best', () => {
        mountWon(STANDARD_SUMMARY);
        expect(screen.getByText('New best time')).toBeInTheDocument();
    });

    it('shows no badge when it is not a new best', () => {
        mountWon(VEGAS_SUMMARY);
        expect(screen.queryByText('New best time')).not.toBeInTheDocument();
    });

    it('has no close button', () => {
        mountWon(STANDARD_SUMMARY);
        expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    });

    it('lands initial focus on Deal again', () => {
        mountWon(STANDARD_SUMMARY);
        expect(screen.getByRole('button', { name: 'Deal again' })).toHaveFocus();
    });

    it('Menu shows Home and closes the sheet', () => {
        const { store } = mountWon(STANDARD_SUMMARY);

        fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

        expect(store.getState().app.route).toBe('home');
        expect(store.getState().app.sheet).toBeNull();
    });

    it('Deal again closes the sheet and starts dealing the same mode again', () => {
        const { store } = mountWon(STANDARD_SUMMARY);

        fireEvent.click(screen.getByRole('button', { name: 'Deal again' }));

        expect(store.getState().app.sheet).toBeNull();
        expect(store.getState().app.route).toBe('game');
    });

    it('Escape does nothing: the sheet stays open (useGameShortcuts and the sheet both ignore it)', () => {
        const { store } = mountWon(STANDARD_SUMMARY);

        fireEvent.keyDown(document.body, { key: 'Escape' });

        expect(store.getState().app.sheet).toBe('win');
        expect(screen.getByRole('heading', { name: 'You win!' })).toBeInTheDocument();
    });

    it('the backdrop (scrim) does nothing: the sheet stays open', () => {
        const { store } = mountWon(STANDARD_SUMMARY);

        fireEvent.click(screen.getByRole('dialog').parentElement ?? document.body);

        expect(store.getState().app.sheet).toBe('win');
    });
});

// covers: KS-DEAL-11
describe('WinSheet grade and title', () => {
    it('shows "Hard deal" for a hard grade', () => {
        mountWon({ ...STANDARD_SUMMARY, mode: 'draw3', grade: 'hard' });

        expect(within(screen.getByRole('dialog')).getByText('Hard deal')).toBeInTheDocument();
    });

    it('shows nothing about a grade for an ungraded game', () => {
        mountWon(STANDARD_SUMMARY);

        expect(within(screen.getByRole('dialog')).queryByText(/ deal$/)).not.toBeInTheDocument();
    });

    it('shows the grade of a restarted graded game that is then won', async () => {
        vi.useFakeTimers();
        const { store } = mountApp(
            dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode, { verdict: 'win', attempts: 1, grade: 'easy' }),
        );
        act(() => {
            store.dispatch(restart());
        });
        for (const command of parseLine(WINNING_LINE.line)) {
            await act(() => store.dispatch(play(command)).then(() => undefined));
        }
        advance(2400);

        expect(store.getState().game.current?.status).toBe('won');
        expect(within(screen.getByRole('dialog')).getByText('Easy deal')).toBeInTheDocument();
    });

    it('shows the grade in Ukrainian', () => {
        const { store } = mountWon({ ...STANDARD_SUMMARY, grade: 'medium' });
        act(() => {
            store.dispatch(preferenceSet({ key: 'locale', value: 'uk' }));
        });

        expect(within(screen.getByRole('dialog')).getByText('Середня роздача')).toBeInTheDocument();
    });

    it('sets the Win title in the pixel typeface, and no other sheet title', () => {
        const { store } = mountWon(STANDARD_SUMMARY);
        expect(screen.getByRole('heading', { name: 'You win!' })).toHaveClass('modal-sheet__title--pixel');

        act(() => {
            store.dispatch(sheetOpened('help'));
        });
        expect(screen.getByRole('heading', { name: 'How to play' })).not.toHaveClass('modal-sheet__title--pixel');
        act(() => {
            store.dispatch(sheetOpened('settings'));
        });
        expect(screen.getByRole('heading', { name: 'Settings' })).not.toHaveClass('modal-sheet__title--pixel');
    });
});

describe('the board component suites against dom.ts', () => {
    it('replaced query stays behaviour-neutral: a fixture win still starts the cascade', async () => {
        const stats = statsWithBest('draw1', 190_000);
        const { store } = mountApp(nearlyWon(), stats);

        await win(store);

        expect(waapi.calls.length).toBe(52);
        expect(store.getState().interaction.win?.newBestTime).toBe(true);
    });
});
