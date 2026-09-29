// covers: KS-DEAL-09

import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../src/App';
import { setRoute, sheetOpened } from '../../../src/app/appSlice';
import { encodeDealCode } from '../../../src/domain/dealCode';
import { DealCodeSheet } from '../../../src/ui/sheets/DealCodeSheet';
import { playedGame } from '../../fixtures/games';
import { installBoardHarness, SIZE } from '../../support/boardHarness';
import { FakeResizeObserver } from '../../support/fakeResizeObserver';
import { renderWithStore } from '../../support/renderWithStore';
import { testStore } from '../../support/testStore';

installBoardHarness();

const input = () => screen.getByLabelText('Deal code');

describe('DealCodeSheet', () => {
    it('shows a labelled input', () => {
        renderWithStore(<DealCodeSheet />, { store: testStore() });

        expect(input()).toBeInTheDocument();
        expect(input().tagName).toBe('INPUT');
    });

    it('lands initial focus in the input when the sheet opens (I5)', () => {
        renderWithStore(<DealCodeSheet />, { store: testStore() });

        expect(input()).toHaveFocus();
    });

    it('an invalid code shows an inline error through aria-describedby, starts no game, and keeps focus in the input', async () => {
        const user = userEvent.setup();
        const store = testStore();
        renderWithStore(<DealCodeSheet />, { store });

        await user.type(input(), 'hello');
        await user.click(screen.getByRole('button', { name: 'Play' }));

        expect(input()).toHaveAccessibleDescription("That code isn't valid.");
        expect(input()).toHaveAttribute('aria-invalid', 'true');
        expect(input()).toHaveFocus();
        expect(store.getState().game.current).toBeNull();
        expect(store.getState().app.route).toBe('home');
    });

    it('a valid code (lower case, with spaces) starts that deal on the Game screen', async () => {
        const user = userEvent.setup();
        const store = testStore();
        const code = encodeDealCode(5, 'draw1');
        renderWithStore(<DealCodeSheet />, { store });

        await user.type(input(), `  ${code.toLowerCase()}  {enter}`);

        expect(store.getState().app.sheet).toBeNull();
        expect(store.getState().app.route).toBe('game');
        const current = store.getState().game.current;
        expect(current?.seed).toBe(5);
        expect(current?.mode).toBe('draw1');
    });

    describe('typing in the input never triggers a game shortcut', () => {
        function mountAppWithSheetOpenOnGame() {
            const store = testStore({ preloadedState: { game: playedGame() } });
            store.dispatch(setRoute('game'));
            store.dispatch(sheetOpened('dealCode'));
            const view = renderWithStore(<App />, { store });
            FakeResizeObserver.instances.at(-1)?.trigger(SIZE);
            return view;
        }

        it('typing "n" does not open New deal options or deal a fresh game', () => {
            const { store } = mountAppWithSheetOpenOnGame();
            const before = store.getState().game.current;

            fireEvent.keyDown(input(), { key: 'n' });

            expect(store.getState().app.sheet).toBe('dealCode');
            expect(store.getState().game.current).toBe(before);
        });

        it('typing "h" does not request a hint', () => {
            const { store } = mountAppWithSheetOpenOnGame();

            fireEvent.keyDown(input(), { key: 'h' });

            expect(store.getState().app.sheet).toBe('dealCode');
            expect(store.getState().interaction.hint).toBeNull();
        });
    });
});
