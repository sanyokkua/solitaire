import { act, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/app/store';
import { dealFromSeed } from '../../src/domain/deal';
import type { GameState } from '../../src/domain/types';
import { accrued, selectDisplayedScore } from '../../src/features/game/gameSlice';
import { WINNING_LINE } from '../fixtures/deals';
import { fakeDealService } from '../fixtures/dealService';
import { gameOf } from '../fixtures/games';
import { Hud } from '../../src/ui/components/Hud';

function renderHud(state?: GameState) {
    const store = createAppStore({
        preloadedState: state === undefined ? {} : { game: gameOf(state) },
        deps: { dealService: fakeDealService() },
    });
    const view = render(
        <Provider store={store}>
            <Hud />
        </Provider>,
    );
    return { store, ...view };
}

const stat = (label: string) => {
    const labelEl = screen.getByText(label);
    const display = labelEl.closest('.stat-display');
    if (!(display instanceof HTMLElement)) throw new Error(`no stat display for ${label}`);
    return display;
};

describe('Hud', () => {
    it('shows Score, Moves and Time labels with padded values for a Standard game', () => {
        renderHud({ ...dealFromSeed(WINNING_LINE.seed, 'draw1'), score: 5, moves: 7 });

        expect(within(stat('Score')).getByText('005')).toHaveClass('stat-display__value');
        expect(within(stat('Moves')).getByText('007')).toHaveClass('stat-display__value');
        expect(within(stat('Time')).getByText('0:00')).toHaveClass('stat-display__value');
        expect(screen.queryByText('Bank')).not.toBeInTheDocument();
    });

    it('shows Bank with a whole-dollar value in Vegas', () => {
        renderHud({ ...dealFromSeed(WINNING_LINE.seed, 'vegas'), score: -52 });

        expect(within(stat('Bank')).getByText('-$52')).toHaveClass('stat-display__value');
        expect(screen.getByText('Bank').closest('[aria-hidden="true"]')).toBeNull();
        expect(screen.queryByText('Score')).not.toBeInTheDocument();
    });

    it('shows the displayed score, with the time and undo penalties, rather than the stored score', () => {
        // Standard costs 2 points per full 10 s and 2 per undo, so the stored 100 is shown as 100 - 12 - 4 = 84.
        const state = { ...dealFromSeed(WINNING_LINE.seed, 'draw1'), score: 100, undos: 2, elapsedMs: 60_000 };
        const { store } = renderHud(state);

        expect(selectDisplayedScore(store.getState())).toBe(84);
        expect(within(stat('Score')).getByText('084')).toBeInTheDocument();
        expect(screen.queryByText('100')).not.toBeInTheDocument();
    });

    it('groups Score or Bank with Moves, then Time, using the stat display classes', () => {
        const { container } = renderHud(dealFromSeed(WINNING_LINE.seed, 'draw1'));

        const group = container.querySelector('.hud-group');
        expect(group).not.toBeNull();
        expect(group?.querySelector('.stat-display--score')).not.toBeNull();
        expect(group?.querySelector('.stat-display--moves')).not.toBeNull();
        expect(group?.querySelector('.stat-display--timer')).toBeNull();
        expect(container.querySelector(':scope > .stat-display--timer')).not.toBeNull();
        expect(container.children).toHaveLength(2);
    });

    it('exposes each label to assistive technology', () => {
        renderHud(dealFromSeed(WINNING_LINE.seed, 'draw1'));

        for (const label of ['Score', 'Moves', 'Time']) {
            expect(screen.getByText(label).closest('[aria-hidden="true"]')).toBeNull();
        }
    });

    it('updates the time as the clock advances', () => {
        const { store } = renderHud(dealFromSeed(WINNING_LINE.seed, 'draw1'));
        expect(within(stat('Time')).getByText('0:00')).toBeInTheDocument();

        act(() => {
            // The first accrual only sets the anchor; each later step adds at most one second.
            for (const atMs of [0, 1000, 2000, 3000]) store.dispatch(accrued({ atMs, eligible: true }));
        });

        expect(within(stat('Time')).getByText('0:03')).toBeInTheDocument();
    });

    it('shows the elapsed play time in whole seconds, with hours from one hour', () => {
        renderHud({ ...dealFromSeed(WINNING_LINE.seed, 'draw1'), elapsedMs: 3_725_900 });

        expect(within(stat('Time')).getByText('1:02:05')).toBeInTheDocument();
    });

    it('renders nothing without a game', () => {
        const { container } = renderHud();

        expect(container).toBeEmptyDOMElement();
    });
});
