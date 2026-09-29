import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setRoute, sheetOpened } from '../../../src/app/appSlice';
import { won } from '../../../src/features/stats/statsSlice';
import { NewDealSheet } from '../../../src/ui/sheets/NewDealSheet';
import { fakeDealService } from '../../fixtures/dealService';
import { playedGame } from '../../fixtures/games';
import { renderWithStore } from '../../support/renderWithStore';
import { testStore } from '../../support/testStore';

/** A store with a started, unwon Draw 1 game (`playedGame`) and its New deal sheet open, and a fake deal service. */
function storeWithGame() {
    const dealService = fakeDealService();
    const store = testStore({ preloadedState: { game: playedGame() }, deps: { dealService } });
    store.dispatch(setRoute('game'));
    store.dispatch(sheetOpened('newDeal'));
    return { store, dealService };
}

describe('NewDealSheet', () => {
    it('shows a line warning that leaving breaks the current streak', () => {
        const { store } = storeWithGame();
        renderWithStore(<NewDealSheet />, { store });

        expect(screen.getByText(/streak/i)).toBeInTheDocument();
    });

    it('lands initial focus on Cancel, never Restart this deal or New deal', () => {
        const { store } = storeWithGame();
        renderWithStore(<NewDealSheet />, { store });

        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    // covers: KS-DEAL-08
    it('Restart this deal re-deals the same code: same seed, score 0, moves 0, time 0 and no undo history', async () => {
        const user = userEvent.setup();
        const { store } = storeWithGame();
        const before = store.getState().game.current;
        if (before === null) throw new Error('expected a game');
        renderWithStore(<NewDealSheet />, { store });

        await user.click(screen.getByRole('button', { name: 'Restart this deal' }));

        const after = store.getState().game.current;
        expect(after?.seed).toBe(before.seed);
        expect(after?.mode).toBe(before.mode);
        expect(after?.moves).toBe(0);
        expect(after?.elapsedMs).toBe(0);
        expect(store.getState().game.history).toHaveLength(0);
        expect(store.getState().app.sheet).toBeNull();
    });

    it('New deal deals a fresh game in the same mode', async () => {
        const user = userEvent.setup();
        const { store, dealService } = storeWithGame();
        const mode = store.getState().game.current?.mode;
        renderWithStore(<NewDealSheet />, { store });

        await user.click(screen.getByRole('button', { name: 'New deal' }));

        expect(dealService.requests).toHaveLength(1);
        expect(dealService.requests[0]?.request.mode).toBe(mode);
        expect(store.getState().app.sheet).toBeNull();
    });

    // covers: KS-STA-03
    it("choosing New deal resets that mode's current streak to 0", async () => {
        const user = userEvent.setup();
        const { store, dealService } = storeWithGame();
        const current = store.getState().game.current;
        if (current === null) throw new Error('expected a game');
        const mode = current.mode;
        store.dispatch(won({ mode, elapsedMs: 1000, score: 100 }));
        expect(store.getState().stats.modes[mode].streak).toBe(1);
        renderWithStore(<NewDealSheet />, { store });

        await user.click(screen.getByRole('button', { name: 'New deal' }));
        dealService.resolve(0, current);
        await Promise.resolve();

        expect(store.getState().stats.modes[mode].streak).toBe(0);
    });

    it('Cancel closes the sheet and leaves the game, time and streak unchanged', async () => {
        const user = userEvent.setup();
        const { store } = storeWithGame();
        const before = store.getState().game;
        const statsBefore = store.getState().stats;
        renderWithStore(<NewDealSheet />, { store });

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(store.getState().game).toBe(before);
        expect(store.getState().stats).toBe(statsBefore);
        expect(store.getState().app.sheet).toBeNull();
    });
});
