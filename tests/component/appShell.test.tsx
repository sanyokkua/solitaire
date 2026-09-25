import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { dealingEnded, dealingProgressed } from '../../src/app/appSlice';
import { createAppStore, type AppStoreOptions } from '../../src/app/store';
import { dealFromSeed } from '../../src/domain/deal';
import type { GameState } from '../../src/domain/types';
import { gameReducer, initialGameState, installed, selectDisplayedScore } from '../../src/features/game/gameSlice';
import { play } from '../../src/features/game/gameThunks';
import { preferenceSet } from '../../src/features/preferences/preferencesSlice';
import { WINNING_LINE, parseLine } from '../fixtures/deals';
import { fakeDealService } from '../fixtures/dealService';
import { playedGame } from '../fixtures/games';

// Drag is not asserted here: the shell has no draggable object at this point in the
// build — card dragging is introduced with the board in a later phase.

const GLOBAL_CSS = readFileSync(resolve(import.meta.dirname, '../../src/ui/styles/global.css'), 'utf-8');

function renderApp(preloadedState: AppStoreOptions['preloadedState'] = {}) {
    const dealService = fakeDealService();
    const store = createAppStore({ preloadedState, deps: { dealService } });
    render(
        <Provider store={store}>
            <App />
        </Provider>,
    );
    return { store, dealService };
}

/** A game slice holding `state`, installed the way a deal delivers it. */
function gameOf(state: GameState) {
    return gameReducer(initialGameState, installed({ state, dailyKey: null }));
}

const dealCards = () => screen.getByRole('button', { name: /deal cards/i });
const backToHome = () => screen.getByRole('button', { name: /back to home/i });
const continueGameButton = () => screen.getByRole('button', { name: 'Continue game' });
const queryContinue = () => screen.queryByRole('button', { name: /continue game/i });

describe('application shell navigation', () => {
    it('renders the Home screen on first mount and not the Game screen', () => {
        renderApp();

        expect(dealCards()).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /back to home/i })).not.toBeInTheDocument();
    });

    it('starts a game in the selected mode and shows Game when the start control is activated by pointer', async () => {
        const user = userEvent.setup();
        const { store, dealService } = renderApp();

        await user.click(dealCards());

        expect(backToHome()).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /deal cards/i })).not.toBeInTheDocument();
        expect(store.getState().app.route).toBe('game');
        expect(dealService.requests.map(({ request }) => request)).toEqual([{ mode: 'draw1', winnableOnly: true }]);
    });

    it('starts a game in the selected mode and shows Game when the start control is activated by keyboard', async () => {
        const user = userEvent.setup();
        const { dealService } = renderApp();

        await user.tab();
        expect(dealCards()).toHaveFocus();

        await user.keyboard('{Enter}');

        expect(backToHome()).toBeInTheDocument();
        expect(dealService.requests).toHaveLength(1);
        expect(dealService.requests[0]?.request.mode).toBe('draw1');
    });

    it('starts the game with Space too', async () => {
        const user = userEvent.setup();
        const { dealService } = renderApp();

        dealCards().focus();
        await user.keyboard(' ');

        expect(backToHome()).toBeInTheDocument();
        expect(dealService.requests).toHaveLength(1);
    });

    it('deals in the mode chosen in the preferences and honours the winnable-only preference', async () => {
        const user = userEvent.setup();
        const { store, dealService } = renderApp();
        act(() => {
            store.dispatch(preferenceSet({ key: 'selectedMode', value: 'vegas' }));
            store.dispatch(preferenceSet({ key: 'winnableOnly', value: false }));
        });

        await user.click(dealCards());

        expect(dealService.requests.map(({ request }) => request)).toEqual([{ mode: 'vegas', winnableOnly: false }]);
    });

    it('returns to Home when the back control is activated by pointer', async () => {
        const user = userEvent.setup();
        renderApp();
        await user.click(dealCards());

        await user.click(backToHome());

        expect(dealCards()).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /back to home/i })).not.toBeInTheDocument();
    });

    it('returns to Home when the back control is activated by keyboard', async () => {
        const user = userEvent.setup();
        renderApp();
        await user.click(dealCards());

        backToHome().focus();
        await user.keyboard('{Enter}');

        expect(dealCards()).toBeInTheDocument();
    });

    it.each([['pointer'], ['keyboard']])('keeps a started game resumable after Back by %s', async (input) => {
        const user = userEvent.setup();
        const { store, dealService } = renderApp();
        await user.click(dealCards());
        await act(async () => {
            dealService.resolve(0, dealFromSeed(WINNING_LINE.seed, 'draw1'));
            await Promise.resolve();
        });
        expect(store.getState().game.current?.seed).toBe(WINNING_LINE.seed);
        const [command] = parseLine(WINNING_LINE.line);
        if (command === undefined) throw new Error('expected a command');
        await act(async () => {
            await store.dispatch(play(command));
        });
        const before = store.getState().game;

        if (input === 'pointer') {
            await user.click(backToHome());
        } else {
            backToHome().focus();
            await user.keyboard('{Enter}');
        }

        expect(continueGameButton()).toBeInTheDocument();
        expect(store.getState().game).toBe(before);
    });

    it('gives the navigation controls an accessible name', async () => {
        const user = userEvent.setup();
        renderApp(playedGameState());

        expect(dealCards()).toHaveAccessibleName();
        expect(continueGameButton()).toHaveAccessibleName('Continue game');

        await user.click(dealCards());

        expect(backToHome()).toHaveAccessibleName();
    });
});

function playedGameState(): AppStoreOptions['preloadedState'] {
    return { game: playedGame() };
}

describe('Continue game', () => {
    it('is hidden when there is no game', () => {
        renderApp();

        expect(queryContinue()).toBeNull();
    });

    it('is hidden for an unstarted game', () => {
        renderApp({ game: gameOf(dealFromSeed(1, 'draw1')) });

        expect(queryContinue()).toBeNull();
    });

    it('is hidden for a won game', () => {
        renderApp({ game: gameOf({ ...dealFromSeed(1, 'draw1'), started: true, status: 'won' }) });

        expect(queryContinue()).toBeNull();
    });

    it('is shown for a started, unwon game', () => {
        renderApp(playedGameState());

        expect(continueGameButton()).toBeInTheDocument();
        expect(dealCards()).toBeInTheDocument();
    });

    it('resumes the game unchanged by pointer', async () => {
        const user = userEvent.setup();
        const { store, dealService } = renderApp(playedGameState());
        const before = structuredClone(store.getState().game.current);

        await user.click(continueGameButton());

        expect(backToHome()).toBeInTheDocument();
        expect(store.getState().app.route).toBe('game');
        expect(store.getState().game.current).toEqual(before);
        expect(dealService.requests).toEqual([]);
    });

    it.each([['{Enter}'], [' ']])('resumes the game unchanged by keyboard (%j)', async (key) => {
        const user = userEvent.setup();
        const { store } = renderApp(playedGameState());
        const before = structuredClone(store.getState().game.current);

        continueGameButton().focus();
        await user.keyboard(key);

        expect(backToHome()).toBeInTheDocument();
        expect(store.getState().game.current).toEqual(before);
    });

    it('receives keyboard focus and the global stylesheet draws a focus outline on buttons', async () => {
        const user = userEvent.setup();
        renderApp(playedGameState());

        await user.tab();
        await user.tab();

        expect(continueGameButton()).toHaveFocus();
        expect(GLOBAL_CSS).toMatch(/button:focus-visible[^{]*\{[^}]*outline:\s*3px solid/);
    });
});

describe('Game status', () => {
    it('shows the mode, moves and displayed score of the game in play', async () => {
        const user = userEvent.setup();
        const played = playedGame();
        if (played.current === null) throw new Error('expected a game');
        // Undo charges make the displayed score differ from the stored one.
        const charged = gameOf({ ...played.current, undos: 3 });
        const { store } = renderApp({ game: { ...charged, counted: true } });
        const { current } = store.getState().game;
        if (current === null) throw new Error('expected a game');
        const displayed = selectDisplayedScore(store.getState());
        expect(displayed).not.toBe(current.score);

        await user.click(continueGameButton());

        expect(screen.getByText(/mode/i)).toHaveTextContent(
            `Mode: ${current.mode} · Moves: ${String(current.moves)} · Score: ${String(displayed)}`,
        );
    });

    it('shows no status line without a game', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.click(dealCards());

        expect(screen.queryByText(/moves/i)).toBeNull();
    });

    it('announces a dealing status while a deal is in flight and removes it afterwards', async () => {
        const user = userEvent.setup();
        const { store } = renderApp();
        await user.click(dealCards());
        expect(screen.getByRole('status')).toBeEmptyDOMElement();

        act(() => {
            store.dispatch(dealingProgressed({ overlay: true, attempt: 2 }));
        });
        expect(screen.getByRole('status')).toHaveTextContent(/dealing/i);

        act(() => {
            store.dispatch(dealingEnded());
        });
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });
});
