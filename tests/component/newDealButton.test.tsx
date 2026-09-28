import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dealingProgressed } from '../../src/app/appSlice';
import { busySet } from '../../src/features/game/gameSlice';
import { NewDealButton } from '../../src/ui/components/NewDealButton';
import { playedGame } from '../fixtures/games';
import { renderWithStore } from '../support/renderWithStore';
import { testStore } from '../support/testStore';

describe('NewDealButton', () => {
    it('is named "New deal" and enabled for a started, idle game', () => {
        renderWithStore(<NewDealButton />, { preloadedState: { game: playedGame() } });

        const button = screen.getByRole('button', { name: 'New deal' });
        expect(button).toBeEnabled();
    });

    it('dispatches requestNewDeal on activation: a started, unwon game opens the New deal options sheet', async () => {
        const user = userEvent.setup();
        const store = testStore({ preloadedState: { game: playedGame() } });
        renderWithStore(<NewDealButton />, { store });

        await user.click(screen.getByRole('button', { name: 'New deal' }));

        expect(store.getState().app.sheet).toBe('newDeal');
    });

    it('is disabled, keeping its accessible name, while a safe-card chain or Finish is running', () => {
        const store = testStore({ preloadedState: { game: playedGame() } });
        store.dispatch(busySet(true));
        renderWithStore(<NewDealButton />, { store });

        const button = screen.getByRole('button', { name: 'New deal' });
        expect(button).toBeDisabled();
    });

    it('is disabled, keeping its accessible name, while a deal is being prepared', () => {
        const store = testStore({ preloadedState: { game: playedGame() } });
        store.dispatch(dealingProgressed({ overlay: true, attempt: 1 }));
        renderWithStore(<NewDealButton />, { store });

        const button = screen.getByRole('button', { name: 'New deal' });
        expect(button).toBeDisabled();
    });
});
