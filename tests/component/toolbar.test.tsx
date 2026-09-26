import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/app/store';
import { dealFromSeed } from '../../src/domain/deal';
import { busySet } from '../../src/features/game/gameSlice';
import { undo } from '../../src/features/game/gameThunks';
import { Toolbar } from '../../src/ui/components/Toolbar';
import { WINNING_LINE } from '../fixtures/deals';
import { fakeDealService } from '../fixtures/dealService';
import { gameOf, playedGame } from '../fixtures/games';

function renderToolbar(game = playedGame()) {
    const store = createAppStore({ preloadedState: { game }, deps: { dealService: fakeDealService() } });
    render(
        <Provider store={store}>
            <Toolbar />
        </Provider>,
    );
    return store;
}

const undoButton = () => screen.getByRole('button', { name: 'Undo' });
const redoButton = () => screen.getByRole('button', { name: 'Redo' });

describe('Toolbar', () => {
    it('is a navigation landmark named "Game actions" with only Undo and Redo', () => {
        renderToolbar();

        const nav = screen.getByRole('navigation', { name: 'Game actions' });
        expect(nav.querySelectorAll('button')).toHaveLength(2);
        expect(undoButton()).toHaveAttribute('type', 'button');
        expect(redoButton()).toHaveAttribute('type', 'button');
        expect(undoButton()).toHaveClass('tool');
        expect(redoButton()).toHaveClass('tool');
    });

    it('hides the decorative icons from assistive technology', () => {
        renderToolbar();

        for (const button of [undoButton(), redoButton()]) {
            const icon = button.querySelector('svg');
            expect(icon).not.toBeNull();
            expect(icon).toHaveAttribute('aria-hidden', 'true');
        }
    });

    it('undoes the last move by pointer, showing the earlier position and enabling Redo', async () => {
        const user = userEvent.setup();
        const store = renderToolbar();
        const before = dealFromSeed(WINNING_LINE.seed, 'draw1');
        expect(redoButton()).toBeDisabled();
        expect(undoButton()).toBeEnabled();

        await user.click(undoButton());

        const current = store.getState().game.current;
        expect(current?.tableau).toEqual(before.tableau);
        expect(current?.stock).toEqual(before.stock);
        expect(current?.waste).toEqual(before.waste);
        expect(current?.foundations).toEqual(before.foundations);
        expect(redoButton()).toBeEnabled();
        expect(undoButton()).toBeDisabled();
    });

    it.each([
        ['Enter', '{Enter}'],
        ['Space', ' '],
    ])('redoes the undone move by keyboard (%s)', async (_name, key) => {
        const user = userEvent.setup();
        const store = renderToolbar();
        const played = store.getState().game.current;
        act(() => {
            store.dispatch(undo());
        });
        expect(redoButton()).toBeEnabled();

        redoButton().focus();
        await user.keyboard(key);

        expect(store.getState().game.current?.tableau).toEqual(played?.tableau);
        expect(store.getState().game.current?.moves).toBe(played?.moves);
        expect(redoButton()).toBeDisabled();
        expect(undoButton()).toBeEnabled();
    });

    it('disables both controls on a fresh deal', () => {
        renderToolbar(gameOf(dealFromSeed(WINNING_LINE.seed, 'draw1')));

        expect(undoButton()).toBeDisabled();
        expect(redoButton()).toBeDisabled();
    });

    it('disables both controls without a game', () => {
        const store = createAppStore({ deps: { dealService: fakeDealService() } });
        render(
            <Provider store={store}>
                <Toolbar />
            </Provider>,
        );

        expect(undoButton()).toBeDisabled();
        expect(redoButton()).toBeDisabled();
    });

    it('disables Undo while a finish sequence is running, and restores it after', () => {
        const store = renderToolbar();
        expect(undoButton()).toBeEnabled();

        act(() => {
            store.dispatch(busySet(true));
        });
        expect(undoButton()).toBeDisabled();

        act(() => {
            store.dispatch(busySet(false));
        });
        expect(undoButton()).toBeEnabled();
    });

    it('disables Redo while a finish sequence is running, and restores it after', () => {
        const store = renderToolbar();
        act(() => {
            store.dispatch(undo());
        });
        expect(redoButton()).toBeEnabled();

        act(() => {
            store.dispatch(busySet(true));
        });
        expect(redoButton()).toBeDisabled();

        act(() => {
            store.dispatch(busySet(false));
        });
        expect(redoButton()).toBeEnabled();
    });
});
