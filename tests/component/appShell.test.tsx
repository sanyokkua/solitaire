// covers: KS-GEN-02, KS-GEN-04

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { dealingEnded, dealingProgressed } from '../../src/app/appSlice';
import { dealFromSeed } from '../../src/domain/deal';
import { selectDisplayedScore } from '../../src/features/game/gameSlice';
import { play } from '../../src/features/game/gameThunks';
import { preferenceSet } from '../../src/features/preferences/preferencesSlice';
import { formatMoves, formatScore } from '../../src/ui/format';
import { WINNING_LINE, parseLine } from '../fixtures/deals';
import { fakeDealService } from '../fixtures/dealService';
import { gameOf, playedGame } from '../fixtures/games';
import { renderWithStore, type RenderWithStoreOptions } from '../support/renderWithStore';

// Drag is not asserted here: the shell has no draggable object at this point in the
// build — card dragging is introduced with the board in a later phase.

const GLOBAL_CSS = readFileSync(resolve(import.meta.dirname, '../../src/ui/styles/global.css'), 'utf-8');

function renderApp(preloadedState: RenderWithStoreOptions['preloadedState'] = {}) {
    const dealService = fakeDealService();
    const { store } = renderWithStore(<App />, { preloadedState, deps: { dealService } });
    return { store, dealService };
}

/**
 * The Home top bar's theme toggle and Settings button, the selected mode tile, the Winnable switch and the Difficulty
 * group's checked option come first.
 */
async function tabPastTopbar(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    for (let stop = 0; stop < 5; stop += 1) {
        await user.tab();
    }
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

    it('exposes exactly one main landmark on Home and on Game', async () => {
        const user = userEvent.setup();
        renderApp();

        expect(screen.getAllByRole('main')).toHaveLength(1);

        await user.click(dealCards());

        expect(screen.getAllByRole('main')).toHaveLength(1);
    });

    it('starts a game in the selected mode and shows Game when the start control is activated by pointer', async () => {
        const user = userEvent.setup();
        const { store, dealService } = renderApp();

        await user.click(dealCards());

        expect(backToHome()).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /deal cards/i })).not.toBeInTheDocument();
        expect(store.getState().app.route).toBe('game');
        expect(dealService.requests.map(({ request }) => request)).toEqual([
            { mode: 'draw1', winnableOnly: true, target: 'any' },
        ]);
    });

    it('starts a game in the selected mode and shows Game when the start control is activated by keyboard', async () => {
        const user = userEvent.setup();
        const { dealService } = renderApp();

        await tabPastTopbar(user);
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

        expect(dealService.requests.map(({ request }) => request)).toEqual([
            { mode: 'vegas', winnableOnly: false, target: 'any' },
        ]);
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

function playedGameState(): RenderWithStoreOptions['preloadedState'] {
    return { game: playedGame() };
}

// covers: KS-PER-02
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

    // covers: KS-A11Y-03
    it('receives keyboard focus and the global stylesheet draws a focus outline on buttons', async () => {
        const user = userEvent.setup();
        renderApp(playedGameState());

        await tabPastTopbar(user);
        await user.tab();
        await user.tab();

        expect(continueGameButton()).toHaveFocus();
        expect(GLOBAL_CSS).toMatch(/button:focus-visible[^{]*\{[^}]*outline:\s*3px solid/);
    });
});

describe('Game frame', () => {
    it('names the screen with a level-one heading "Klondike"', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.click(dealCards());

        expect(screen.getByRole('heading', { level: 1, name: 'Klondike' })).toBeInTheDocument();
    });

    // covers: KS-GEN-11
    it('holds the build stamp in the frame footer on Game and once on Home, never twice', async () => {
        const user = userEvent.setup();
        renderApp();
        expect(screen.getAllByLabelText(/^App build:/)).toHaveLength(1);

        await user.click(dealCards());

        const stamps = screen.getAllByLabelText(/^App build:/);
        expect(stamps).toHaveLength(1);
        expect(stamps[0]?.closest('.game-footer')).not.toBeNull();
    });

    it('shows the mode-appropriate HUD values of the game in play, with the displayed score', async () => {
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

        const value = (label: string) => screen.getByText(label).nextElementSibling;
        expect(value('Score')).toHaveTextContent(formatScore(displayed));
        expect(value('Moves')).toHaveTextContent(formatMoves(current.moves));
        expect(value('Time')).toBeInTheDocument();
    });

    it('shows no HUD values without a game', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.click(dealCards());

        expect(screen.queryByText(/moves/i)).toBeNull();
        expect(screen.queryByText('Score')).toBeNull();
    });

    it('announces a dealing status while a deal is in flight and removes it afterwards', async () => {
        const user = userEvent.setup();
        const { store } = renderApp();
        await user.click(dealCards());
        // The Dealing status and the announcer are the Game screen's two polite regions; only the first is dealing's.
        const dealingStatus = () => screen.getAllByRole('status')[0];
        expect(screen.getAllByRole('status')).toHaveLength(2);
        expect(dealingStatus()).toBeEmptyDOMElement();

        act(() => {
            store.dispatch(dealingProgressed({ overlay: true, attempt: 2 }));
        });
        expect(screen.getAllByRole('status')).toHaveLength(2);
        expect(dealingStatus()).toHaveTextContent('Dealing…');

        act(() => {
            store.dispatch(dealingEnded());
        });
        expect(dealingStatus()).toBeEmptyDOMElement();
    });
});
