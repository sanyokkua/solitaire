import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dealingProgressed } from '../../src/app/appSlice';
import type { DealProgress } from '../../src/features/deal/dealService';
import { GameScreen } from '../../src/ui/screens/GameScreen';
import { playedGame } from '../fixtures/games';
import { SIZE } from '../support/boardHarness';
import { FakeResizeObserver } from '../support/fakeResizeObserver';
import { restoreMatchMedia, stubMatchMedia } from '../support/matchMedia';
import { renderWithStore } from '../support/renderWithStore';

function renderGame(dealing: DealProgress | null, locale: 'en' | 'uk' = 'en') {
    stubMatchMedia([]);
    const view = renderWithStore(<GameScreen />, { preloadedState: { game: playedGame(), preferences: { locale } } });
    if (dealing !== null) {
        act(() => {
            view.store.dispatch(dealingProgressed(dealing));
        });
    }
    return view;
}

beforeEach(() => {
    FakeResizeObserver.instances.length = 0;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
    vi.unstubAllGlobals();
    restoreMatchMedia();
});

describe('DealingOverlay', () => {
    it('is not there when nothing is dealing', () => {
        const { container } = renderGame(null);

        expect(container.querySelector('.deal-overlay')).toBeNull();
    });

    it('is not there while the deal is still under the 160 ms delay', () => {
        const { container } = renderGame({ overlay: false, attempt: 1 });

        expect(container.querySelector('.deal-overlay')).toBeNull();
        expect(screen.getByRole('status')).toHaveTextContent('Dealing…');
    });

    it('shows the text and the attempt counter once the overlay is asked for', () => {
        const { container } = renderGame({ overlay: true, attempt: 3 });

        const box = container.querySelector('.deal-overlay .deal-overlay__box');
        expect(box).toHaveTextContent('Shuffling a winnable deal…');
        expect(box).toHaveTextContent('deal #3');
    });

    it('speaks Ukrainian', () => {
        const { container } = renderGame({ overlay: true, attempt: 2 }, 'uk');

        const box = container.querySelector('.deal-overlay__box');
        expect(box).toHaveTextContent('Тасуємо виграшну роздачу…');
        expect(box).toHaveTextContent('роздача №2');
    });

    it('keeps one polite status that still announces dealing while the overlay shows', () => {
        const { container } = renderGame({ overlay: true, attempt: 1 });

        expect(screen.getByRole('status')).toHaveTextContent('Dealing…');
        expect(container.querySelectorAll('[role="status"], [aria-live]')).toHaveLength(1);
        expect(container.querySelector('.deal-overlay')?.closest('[role="status"]')).toBeNull();
    });

    it('leaves the previous table rendered underneath, inside the board panel', () => {
        const { container } = renderGame({ overlay: true, attempt: 1 });
        FakeResizeObserver.instances.at(-1)?.trigger(SIZE);

        const panel = container.querySelector('.board-panel');
        expect(panel?.querySelectorAll('.card')).toHaveLength(52);
        expect(panel?.querySelector('.board')).not.toBeNull();
        expect(panel?.querySelector('.deal-overlay')).not.toBeNull();
    });

    it('hides the decorative spinner from assistive technology', () => {
        const { container } = renderGame({ overlay: true, attempt: 1 });

        expect(container.querySelector('.deal-overlay .spinner')).toHaveAttribute('aria-hidden', 'true');
    });
});
