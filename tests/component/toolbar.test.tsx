import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setRoute, sheetClosed, sheetOpened } from '../../src/app/appSlice';
import { dealFromSeed } from '../../src/domain/deal';
import { selectCanFinish, busySet } from '../../src/features/game/gameSlice';
import { undo } from '../../src/features/game/gameThunks';
import { Toolbar } from '../../src/ui/components/Toolbar';
import { allFaceUp, WINNING_LINE } from '../fixtures/deals';
import { fakeDealService } from '../fixtures/dealService';
import { gameOf, playedGame } from '../fixtures/games';
import { faceDown, faceUp, makeState, tableauOf } from '../fixtures/states';
import { renderWithStore } from '../support/renderWithStore';
import { testStore } from '../support/testStore';

/** A position with a face-down card, so no finish plan exists. */
const buried = () => makeState({ tableau: tableauOf([...faceDown(9), ...faceUp(10)]), stock: [11], started: true });

function renderToolbar(game = playedGame(), locale?: 'en' | 'uk') {
    const dealService = fakeDealService();
    const store = testStore({
        preloadedState: { game, ...(locale === undefined ? {} : { preferences: { locale } }) },
        deps: { dealService },
    });
    store.dispatch(setRoute('game'));
    renderWithStore(<Toolbar />, { store });
    return { store, dealService };
}

const undoButton = () => screen.getByRole('button', { name: 'Undo' });
const redoButton = () => screen.getByRole('button', { name: 'Redo' });
const hintButton = () => screen.getByRole('button', { name: 'Hint' });
const finishButton = () => screen.getByRole('button', { name: 'Finish' });

describe('Toolbar', () => {
    it('is a navigation landmark named "Game actions" with Undo, Redo, Hint and Finish, in that order', () => {
        renderToolbar();

        const nav = screen.getByRole('navigation', { name: 'Game actions' });
        const buttons = [...nav.querySelectorAll('button')];
        expect(buttons.map((button) => button.textContent.trim())).toEqual(['Undo', 'Redo', 'Hint', 'Finish']);
        for (const button of buttons) {
            expect(button).toHaveAttribute('type', 'button');
            expect(button).toHaveClass('tool');
        }
    });

    it('hides the decorative icons from assistive technology', () => {
        renderToolbar();

        for (const button of [undoButton(), redoButton(), hintButton(), finishButton()]) {
            const icon = button.querySelector('svg');
            expect(icon).not.toBeNull();
            expect(icon).toHaveAttribute('aria-hidden', 'true');
        }
    });

    it('undoes the last move by pointer, showing the earlier position and enabling Redo', async () => {
        const user = userEvent.setup();
        const { store } = renderToolbar();
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
        const { store } = renderToolbar();
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
        const store = testStore();
        store.dispatch(setRoute('game'));
        renderWithStore(<Toolbar />, { store });

        expect(undoButton()).toBeDisabled();
        expect(redoButton()).toBeDisabled();
        expect(hintButton()).toBeDisabled();
        expect(finishButton()).toBeDisabled();
    });

    it('disables Undo while a finish sequence is running, and restores it after', () => {
        const { store } = renderToolbar();
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
        const { store } = renderToolbar();
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

    describe('Hint', () => {
        it('requests a hint by pointer', async () => {
            const user = userEvent.setup();
            const { dealService } = renderToolbar();
            expect(hintButton()).toBeEnabled();

            await user.click(hintButton());

            expect(dealService.hintRequests).toHaveLength(1);
        });

        it.each([
            ['Enter', '{Enter}'],
            ['Space', ' '],
        ])('requests a hint by keyboard (%s)', async (_name, key) => {
            const user = userEvent.setup();
            const { dealService } = renderToolbar();

            hintButton().focus();
            await user.keyboard(key);

            expect(dealService.hintRequests).toHaveLength(1);
        });

        it('is enabled on a fresh deal, whose Undo and Redo are not', () => {
            renderToolbar(gameOf(dealFromSeed(WINNING_LINE.seed, 'draw1')));

            expect(hintButton()).toBeEnabled();
            expect(undoButton()).toBeDisabled();
        });

        it('is disabled while a finish sequence is running, and restored after', () => {
            const { store } = renderToolbar();

            act(() => {
                store.dispatch(busySet(true));
            });
            expect(hintButton()).toBeDisabled();

            act(() => {
                store.dispatch(busySet(false));
            });
            expect(hintButton()).toBeEnabled();
        });

        it('is disabled while a sheet is open, and off the Game route', () => {
            const { store } = renderToolbar();

            act(() => {
                store.dispatch(sheetOpened('settings'));
            });
            expect(hintButton()).toBeDisabled();

            act(() => {
                store.dispatch(sheetClosed());
                store.dispatch(setRoute('home'));
            });
            expect(hintButton()).toBeDisabled();
        });
    });

    describe('Finish', () => {
        it('is enabled and highlighted only when the session offers Finish', () => {
            const { store } = renderToolbar(gameOf(allFaceUp()));

            expect(selectCanFinish(store.getState())).toBe(true);
            expect(finishButton()).toBeEnabled();
            expect(finishButton()).toHaveClass('tool', 'is-ready');
            expect(hintButton()).not.toHaveClass('is-ready');
        });

        it('is disabled and not highlighted while a face-down card remains', () => {
            const { store } = renderToolbar(gameOf(buried()));

            expect(selectCanFinish(store.getState())).toBe(false);
            expect(finishButton()).toBeDisabled();
            expect(finishButton()).not.toHaveClass('is-ready');
        });

        it('plays every remaining card home when activated by pointer', async () => {
            const user = userEvent.setup();
            const { store } = renderToolbar(gameOf(allFaceUp()));

            await user.click(finishButton());

            await waitFor(() => {
                expect(store.getState().game.current?.status).toBe('won');
            });
        });

        it('runs when Enter is pressed on it, focused', async () => {
            const user = userEvent.setup();
            const { store } = renderToolbar(gameOf(allFaceUp()));

            finishButton().focus();
            await user.keyboard('{Enter}');

            await waitFor(() => {
                expect(store.getState().game.current?.status).toBe('won');
            });
        });

        it('is disabled and not highlighted while a sequence runs, and restored after', () => {
            const { store } = renderToolbar(gameOf(allFaceUp()));

            act(() => {
                store.dispatch(busySet(true));
            });
            expect(finishButton()).toBeDisabled();
            expect(finishButton()).not.toHaveClass('is-ready');

            act(() => {
                store.dispatch(busySet(false));
            });
            expect(finishButton()).toBeEnabled();
        });

        it('is disabled while a sheet is open, and off the Game route', () => {
            const { store } = renderToolbar(gameOf(allFaceUp()));

            act(() => {
                store.dispatch(sheetOpened('settings'));
            });
            expect(finishButton()).toBeDisabled();

            act(() => {
                store.dispatch(sheetClosed());
                store.dispatch(setRoute('home'));
            });
            expect(finishButton()).toBeDisabled();
        });
    });

    it('is a navigation landmark named "Дії гри" with translated button text, in Ukrainian', () => {
        renderToolbar(playedGame(), 'uk');

        const nav = screen.getByRole('navigation', { name: 'Дії гри' });
        const buttons = [...nav.querySelectorAll('button')];
        expect(buttons.map((button) => button.textContent.trim())).toEqual([
            'Скасувати',
            'Повторити',
            'Підказка',
            'Завершити',
        ]);
    });
});
