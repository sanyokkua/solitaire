// covers: KS-I18N-01

import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { preferenceSet } from '../../src/features/preferences/preferencesSlice';
import { GameScreen } from '../../src/ui/screens/GameScreen';
import { playedGame } from '../fixtures/games';
import { restoreMatchMedia, stubMatchMedia } from '../support/matchMedia';
import { renderWithStore } from '../support/renderWithStore';

describe('switching language while the Game screen is shown', () => {
    it('updates visible text in place, without remounting the board or changing the game', () => {
        stubMatchMedia([]);
        const { store, container } = renderWithStore(<GameScreen />, { preloadedState: { game: playedGame() } });
        const before = store.getState().game.current;
        const board = container.querySelector('.board-panel');
        const score = screen.getByText('Score').closest('.stat-display')?.querySelector('.stat-display__value');
        const moves = screen.getByText('Moves').closest('.stat-display')?.querySelector('.stat-display__value');
        const time = screen.getByText('Time').closest('.stat-display')?.querySelector('.stat-display__value');
        const scoreText = score?.textContent;
        const movesText = moves?.textContent;
        const timeText = time?.textContent;

        act(() => {
            store.dispatch(preferenceSet({ key: 'locale', value: 'uk' }));
        });

        expect(screen.getByRole('button', { name: 'На головну' })).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Дії в грі' })).toBeInTheDocument();
        expect(container.querySelector('.board-panel')).toBe(board);
        expect(
            screen.getByText('Рахунок').closest('.stat-display')?.querySelector('.stat-display__value'),
        ).toHaveTextContent(scoreText ?? '');
        expect(
            screen.getByText('Ходи').closest('.stat-display')?.querySelector('.stat-display__value'),
        ).toHaveTextContent(movesText ?? '');
        expect(
            screen.getByText('Час').closest('.stat-display')?.querySelector('.stat-display__value'),
        ).toHaveTextContent(timeText ?? '');
        const after = store.getState().game.current;
        expect(after?.tableau).toEqual(before?.tableau);
        expect(after?.score).toBe(before?.score);
        expect(after?.moves).toBe(before?.moves);
        expect(after?.elapsedMs).toBe(before?.elapsedMs);
        expect(after?.undos).toBe(before?.undos);
    });

    afterEach(() => {
        restoreMatchMedia();
    });
});
