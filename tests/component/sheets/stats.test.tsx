import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
    dailyCompleted,
    played,
    statsReducer,
    statsReset,
    won,
    type StatsState,
} from '../../../src/features/stats/statsSlice';
import { StatsSheet } from '../../../src/ui/sheets/StatsSheet';
import { renderWithStore } from '../../support/renderWithStore';
import { testStore } from '../../support/testStore';

const initial = (): StatsState => statsReducer(undefined, { type: '@@init' });

/**
 * A stats state with Draw 3 played once and never won, Vegas won once at a negative bank, and a 3-day Daily streak
 * ending 2026-05-03.
 */
function mixedStats(): StatsState {
    let state = initial();
    state = statsReducer(state, played('draw3'));
    state = statsReducer(state, won({ mode: 'vegas', elapsedMs: 90_000, score: -7 }));
    state = statsReducer(state, dailyCompleted('2026-05-01'));
    state = statsReducer(state, dailyCompleted('2026-05-02'));
    state = statsReducer(state, dailyCompleted('2026-05-03'));
    return state;
}

describe('StatsSheet', () => {
    it('shows a column per mode: Draw 1, Draw 3, Vegas, Daily', () => {
        renderWithStore(<StatsSheet />);
        const table = screen.getByRole('table');

        expect(within(table).getByRole('columnheader', { name: 'Draw 1' })).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', { name: 'Draw 3' })).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', { name: 'Vegas' })).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', { name: 'Daily' })).toBeInTheDocument();
    });

    it('shows header cells for every row', () => {
        renderWithStore(<StatsSheet />);
        const table = screen.getByRole('table');

        for (const name of ['Played', 'Won', 'Win rate', 'Best time', 'Best score', 'Best streak']) {
            expect(within(table).getByRole('rowheader', { name })).toBeInTheDocument();
        }
    });

    it('shows "—" for a mode that has been played but never won', () => {
        const store = testStore({ preloadedState: { stats: mixedStats() } });
        renderWithStore(<StatsSheet />, { store });

        const table = screen.getByRole('table');
        const draw3Row = within(table).getByRole('rowheader', { name: 'Best time' }).closest('tr');
        expect(draw3Row).not.toBeNull();
        // Draw 3 is the second data column (Draw 1, Draw 3, Vegas, Daily).
        const cells = within(draw3Row as HTMLElement).getAllByRole('cell');
        expect(cells[1]).toHaveTextContent('—');
    });

    it('shows the win rate as a rounded percent, and "—" for a mode never played', () => {
        let stats = initial();
        for (let i = 0; i < 3; i += 1) {
            stats = statsReducer(stats, played('draw1'));
        }
        stats = statsReducer(stats, won({ mode: 'draw1', elapsedMs: 60_000, score: 100 }));
        const store = testStore({ preloadedState: { stats } });
        renderWithStore(<StatsSheet />, { store });

        const table = screen.getByRole('table');
        const winRateRow = within(table).getByRole('rowheader', { name: 'Win rate' }).closest('tr');
        const cells = within(winRateRow as HTMLElement).getAllByRole('cell');
        // Draw 1, Draw 3, Vegas, Daily: 1 won of 3 played is 33%; the others were never played.
        expect(cells.map((cell) => cell.textContent)).toEqual(['33%', '—', '—', '—']);
    });

    it('shows the Vegas best as money', () => {
        const store = testStore({ preloadedState: { stats: mixedStats() } });
        renderWithStore(<StatsSheet />, { store });

        const table = screen.getByRole('table');
        const bestScoreRow = within(table).getByRole('rowheader', { name: 'Best score' }).closest('tr');
        const cells = within(bestScoreRow as HTMLElement).getAllByRole('cell');
        // Draw 1, Draw 3, Vegas, Daily: Vegas is the third data column.
        expect(cells[2]).toHaveTextContent('-$7');
    });

    it('shows the current and best Daily streak from the injected clock', () => {
        const store = testStore({
            preloadedState: { stats: mixedStats() },
            deps: { today: () => new Date('2026-05-03T12:00:00.000Z') },
        });
        renderWithStore(<StatsSheet />, { store });

        expect(screen.getByText('Daily streak: 3 (best 3)')).toBeInTheDocument();
    });

    it('shows a note that statistics are kept only in this browser', () => {
        renderWithStore(<StatsSheet />);

        expect(screen.getByText('Kept only in this browser.')).toBeInTheDocument();
    });

    it('lands initial focus on the actions row Close button when the sheet opens (I5)', () => {
        renderWithStore(<StatsSheet />);

        // Two controls share the "Close" name (the header's icon close and this sheet's own explicit Close action);
        // focus lands on the explicit one, in `.modal-sheet__actions`.
        const actions = document.querySelector('.modal-sheet__actions');
        expect(actions).not.toBeNull();
        expect(within(actions as HTMLElement).getByRole('button', { name: 'Close' })).toHaveFocus();
    });

    it('Reset needs confirmation: shows Confirm/Cancel and clears nothing until Confirm', async () => {
        const user = userEvent.setup();
        const store = testStore({ preloadedState: { stats: mixedStats() } });
        renderWithStore(<StatsSheet />, { store });

        await user.click(screen.getByRole('button', { name: 'Reset statistics' }));

        expect(screen.getByRole('button', { name: 'Confirm Reset statistics' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel Reset statistics' })).toBeInTheDocument();
        expect(store.getState().stats).toEqual(mixedStats());
    });

    it('Cancel keeps the statistics and returns focus to the Reset control (I5)', async () => {
        const user = userEvent.setup();
        const store = testStore({ preloadedState: { stats: mixedStats() } });
        renderWithStore(<StatsSheet />, { store });

        await user.click(screen.getByRole('button', { name: 'Reset statistics' }));
        await user.click(screen.getByRole('button', { name: 'Cancel Reset statistics' }));

        expect(store.getState().stats).toEqual(mixedStats());
        expect(screen.getByRole('button', { name: 'Reset statistics' })).toHaveFocus();
    });

    it('Confirm clears every statistic and returns focus to the Reset control (I5)', async () => {
        const user = userEvent.setup();
        const store = testStore({ preloadedState: { stats: mixedStats() } });
        renderWithStore(<StatsSheet />, { store });

        await user.click(screen.getByRole('button', { name: 'Reset statistics' }));
        await user.click(screen.getByRole('button', { name: 'Confirm Reset statistics' }));

        expect(store.getState().stats).toEqual(statsReducer(mixedStats(), statsReset()));
        expect(screen.getByRole('button', { name: 'Reset statistics' })).toHaveFocus();
    });
});
