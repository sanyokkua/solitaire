// covers: KS-SCO-07

import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/App';
import { dealingProgressed, setRoute, sheetOpened } from '../../../src/app/appSlice';
import { encodeDealCode } from '../../../src/domain/dealCode';
import { dealFromSeed } from '../../../src/domain/deal';
import type { GameState } from '../../../src/domain/types';
import { accrued, busySet } from '../../../src/features/game/gameSlice';
import { selectAnnouncement } from '../../../src/features/interaction/selectors';
import { oneMovePosition, SIX_OF_DIAMONDS } from '../../fixtures/boardPositions';
import { gameOf } from '../../fixtures/games';
import { installBoardHarness, SIZE } from '../../support/boardHarness';
import { restoreClipboard, stubClipboard } from '../../support/clipboard';
import { FakeResizeObserver } from '../../support/fakeResizeObserver';
import { renderWithStore } from '../../support/renderWithStore';
import { testStore } from '../../support/testStore';

installBoardHarness();

afterEach(() => {
    restoreClipboard();
});

/** A started, unwon Draw 1 game reading 2:14 (134 000 ms), or `overrides` applied on top of it. */
function gameAt2m14(overrides: Partial<GameState> = {}): GameState {
    return { ...dealFromSeed(1, 'draw1'), started: true, elapsedMs: 134_000, ...overrides };
}

/** Mounts the whole app on the Game route with `state` in play, its board measured. */
function mountApp(state: GameState = gameAt2m14()) {
    const store = testStore({ preloadedState: { game: gameOf(state) } });
    store.dispatch(setRoute('game'));
    const view = renderWithStore(<App />, { store });
    FakeResizeObserver.instances.at(-1)?.trigger(SIZE);
    return { store, container: view.container };
}

/** Presses a key on `target` (the page by default) and tells whether the default action was prevented. */
function press(key: string, init: KeyboardEventInit = {}, target: Element = document.body): boolean {
    return !fireEvent.keyDown(target, { key, ...init });
}

const timeButton = () => screen.getByRole('button', { name: /^Pause, time 2:14$/ });
const resumeButton = () => screen.getByRole('button', { name: 'Resume' });

describe('Opening the Paused sheet', () => {
    it('Time by click pauses', async () => {
        const user = userEvent.setup();
        const { store } = mountApp();

        await user.click(timeButton());

        expect(store.getState().app.sheet).toBe('paused');
    });

    it('Time by Enter pauses', async () => {
        const user = userEvent.setup();
        const { store } = mountApp();
        timeButton().focus();

        await user.keyboard('{Enter}');

        expect(store.getState().app.sheet).toBe('paused');
    });

    it('P pauses, and P again resumes', () => {
        const { store } = mountApp();

        expect(press('p')).toBe(true);
        expect(store.getState().app.sheet).toBe('paused');

        expect(press('p')).toBe(true);
        expect(store.getState().app.sheet).toBeNull();
    });

    it('P with another sheet (Settings) open does nothing', () => {
        const { store } = mountApp();
        act(() => {
            store.dispatch(sheetOpened('settings'));
        });

        expect(press('p')).toBe(false);

        expect(store.getState().app.sheet).toBe('settings');
    });

    it('P on a won game does not pause', () => {
        const { store } = mountApp(gameAt2m14({ status: 'won' }));

        expect(press('p')).toBe(false);

        expect(store.getState().app.sheet).toBeNull();
    });

    it('Time is disabled, keeping its accessible name, on a won game', () => {
        mountApp(gameAt2m14({ status: 'won' }));

        expect(timeButton()).toBeDisabled();
    });

    it('Time is disabled, keeping its accessible name, while a safe-card chain or Finish is running', () => {
        const { store } = mountApp();
        act(() => {
            store.dispatch(busySet(true));
        });

        expect(timeButton()).toBeDisabled();
    });

    it('Time is disabled, keeping its accessible name, while a deal is being prepared', () => {
        const { store } = mountApp();
        act(() => {
            store.dispatch(dealingProgressed({ overlay: true, attempt: 1 }));
        });

        expect(timeButton()).toBeDisabled();
    });

    it('P and Time do nothing while a safe-card chain or Finish is running', () => {
        const { store } = mountApp();
        act(() => {
            store.dispatch(busySet(true));
        });

        expect(press('p')).toBe(false);

        expect(store.getState().app.sheet).toBeNull();
    });

    it('P and Time do nothing while a deal is being prepared', () => {
        const { store } = mountApp();
        act(() => {
            store.dispatch(dealingProgressed({ overlay: true, attempt: 1 }));
        });

        expect(press('p')).toBe(false);

        expect(store.getState().app.sheet).toBeNull();
    });

    it('the physical P key on a Ukrainian layout still pauses and resumes', () => {
        const { store } = mountApp();

        expect(press('з', { code: 'KeyP' })).toBe(true);
        expect(store.getState().app.sheet).toBe('paused');

        expect(press('з', { code: 'KeyP' })).toBe(true);
        expect(store.getState().app.sheet).toBeNull();
    });
});

describe('While the Paused sheet is open', () => {
    it('shows the frozen time, hides the board, and keeps the time frozen across ticks', () => {
        const { store } = mountApp();

        press('p');

        const dialog = within(screen.getByRole('dialog'));
        expect(dialog.getByText('2:14')).toBeInTheDocument();
        expect(store.getState().app.sheet).toBe('paused');

        // Simulate a tick the way the real clock ticker would: ineligible while a sheet is open, so nothing accrues.
        act(() => {
            store.dispatch(accrued({ atMs: 999_000, eligible: false }));
        });

        expect(store.getState().game.current?.elapsedMs).toBe(134_000);
        expect(dialog.getByText('2:14')).toBeInTheDocument();
    });

    it('hides every card and removes the board from the accessibility tree', () => {
        const { container } = mountApp(oneMovePosition());

        press('p');

        const panel = container.querySelector<HTMLElement>('.board-panel');
        expect(panel).not.toBeNull();
        expect(panel).not.toBeVisible();
        const card = container.querySelector<HTMLElement>(`[data-card-id='${String(SIX_OF_DIAMONDS)}']`);
        expect(card).not.toBeVisible();
        expect(screen.queryByRole('button', { name: /6 of Diamonds/ })).not.toBeInTheDocument();
    });

    it('lands initial focus on Resume when the sheet opens (I5)', () => {
        mountApp();

        press('p');

        expect(resumeButton()).toHaveFocus();
    });

    it('Resume resumes and shows the board again', () => {
        const { store, container } = mountApp();
        press('p');

        fireEvent.click(resumeButton());

        expect(store.getState().app.sheet).toBeNull();
        expect(container.querySelector('.board-panel')).toBeVisible();
    });

    it('Escape resumes', () => {
        const { store } = mountApp();
        press('p');

        expect(press('Escape')).toBe(true);

        expect(store.getState().app.sheet).toBeNull();
    });

    it('the backdrop (scrim) resumes', () => {
        const { store } = mountApp();
        press('p');

        fireEvent.click(screen.getByRole('dialog').parentElement ?? document.body);

        expect(store.getState().app.sheet).toBeNull();
    });

    it('P pressed with nothing focused: closing by Resume returns focus to the Game screen heading', () => {
        const { store } = mountApp();
        (document.activeElement as HTMLElement | null)?.blur();
        expect(document.activeElement).toBe(document.body);

        press('p');
        expect(resumeButton()).toHaveFocus();

        fireEvent.click(resumeButton());

        expect(store.getState().app.sheet).toBeNull();
        expect(screen.getByRole('heading', { name: 'Klondike' })).toHaveFocus();
    });

    it('P pressed while a card is focused: closing by Resume returns focus to that same card', () => {
        const { container } = mountApp({ ...oneMovePosition(), elapsedMs: 134_000 });
        const card = container.querySelector<HTMLElement>(`[data-card-id='${String(SIX_OF_DIAMONDS)}']`);
        if (card === null) throw new Error('no card rendered');
        card.focus();
        expect(card).toHaveFocus();

        press('p', {}, card);
        expect(resumeButton()).toHaveFocus();

        fireEvent.click(resumeButton());

        expect(card).toHaveFocus();
    });

    it('shows the current deal code, and activating its copy control copies it, raises code-copied and announces it', async () => {
        const user = userEvent.setup();
        const clipboard = stubClipboard();
        const state = gameAt2m14();
        const code = encodeDealCode(state.seed, state.mode);
        const { store } = mountApp(state);
        press('p');

        await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: `Deal ${code}` }));

        expect(clipboard.copied).toEqual([code]);
        expect(store.getState().app.notices.map(({ id }) => id)).toEqual(['code-copied']);
        expect(selectAnnouncement(store.getState()).items.map(({ item }) => item.type)).toEqual(['codeCopied']);
    });
});
