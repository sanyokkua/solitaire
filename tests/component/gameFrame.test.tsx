import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { hintSet } from '../../src/features/interaction/interactionSlice';
import { GameScreen } from '../../src/ui/screens/GameScreen';
import { RAILS_QUERY } from '../../src/ui/screens/profiles';
import { playedGame } from '../fixtures/games';
import { restoreMatchMedia, stubMatchMedia } from '../support/matchMedia';
import { renderWithStore } from '../support/renderWithStore';

function renderGame(locale?: 'en' | 'uk') {
    return renderWithStore(<GameScreen />, {
        preloadedState: { game: playedGame(), ...(locale === undefined ? {} : { preferences: { locale } }) },
    });
}

afterEach(() => {
    restoreMatchMedia();
});

describe('GameScreen chrome profiles', () => {
    it('puts the only Back control in the top bar in the stacked profile', () => {
        stubMatchMedia([]);
        const { container } = renderGame();

        const back = screen.getAllByRole('button', { name: 'Back to Home' });
        expect(back).toHaveLength(1);
        expect(back[0]?.closest('.game-topbar')).not.toBeNull();
        expect(container.querySelector('.game-hud')).not.toContainElement(back[0] ?? null);
    });

    it('puts the only Back control first in the HUD rail, without a top bar, in the rails profile', () => {
        stubMatchMedia([RAILS_QUERY]);
        const { container } = renderGame();

        const back = screen.getAllByRole('button', { name: 'Back to Home' });
        expect(back).toHaveLength(1);
        expect(container.querySelector('.game-topbar')).toBeNull();
        const hud = container.querySelector<HTMLElement>('.game-hud');
        expect(hud?.firstElementChild).toHaveClass('rail-top');
        expect(hud?.firstElementChild?.firstElementChild).toBe(back[0]);
    });

    it('keeps the reserved regions in both profiles, the face holding the New deal button', () => {
        for (const matching of [[], [RAILS_QUERY]]) {
            stubMatchMedia(matching);
            const { container, unmount } = renderGame();

            const face = container.querySelector('.game-face');
            expect(face).not.toBeEmptyDOMElement();
            expect(face).not.toHaveAttribute('aria-hidden');
            expect(within(face as HTMLElement).getByRole('button', { name: 'New deal' })).toBeInTheDocument();
            expect(container.querySelector('.game-hint')).toHaveTextContent(
                'Tap a card to send it to its best spot · drag to place it yourself',
            );
            expect(container.querySelector('.board-panel')).not.toBeNull();
            expect(within(container).getByRole('navigation', { name: 'Game actions' })).toBeInTheDocument();
            unmount();
        }
    });

    it('fills the chip slot with the mode and deal chips in the stacked profile, and has no slot in the rails', () => {
        stubMatchMedia([]);
        const stacked = renderGame();
        const slot = stacked.container.querySelector('.game-chips');
        expect(slot).not.toBeEmptyDOMElement();
        expect(slot).not.toHaveAttribute('aria-hidden');
        expect(slot?.querySelector('.mode-chip')).toHaveTextContent('Draw 1 · Standard');
        expect(slot?.querySelector('.deal-chip')).toHaveTextContent('Random deal');
        stacked.unmount();

        stubMatchMedia([RAILS_QUERY]);
        const rails = renderGame();
        expect(rails.container.querySelector('.game-chips')).toBeNull();
    });

    it('opens the Settings sheet from the top bar and from the rails', async () => {
        for (const matching of [[], [RAILS_QUERY]]) {
            stubMatchMedia(matching);
            const user = userEvent.setup();
            const { store, unmount } = renderGame();

            await user.click(screen.getByRole('button', { name: 'Settings' }));

            expect(store.getState().app.sheet).toBe('settings');
            unmount();
        }
    });

    it('shows the hint text in the hint line while a hint is set, in both profiles', () => {
        for (const matching of [[], [RAILS_QUERY]]) {
            stubMatchMedia(matching);
            const { store, container, unmount } = renderGame();
            act(() => {
                store.dispatch(hintSet({ id: 1, kind: 'draw', cards: [], target: 'stock' }));
            });

            expect(container.querySelector('.game-hint')).toHaveTextContent('Hint: draw from the stock');
            expect(container.querySelector('.game-hint')).toHaveAttribute('aria-hidden', 'true');
            unmount();
        }
    });

    it('lays the frame out as the screen name, the dealing status, the top bar, then the body, then the footer', () => {
        stubMatchMedia([]);
        const { container } = renderGame();

        const root = container.querySelector('.screen--game');
        expect([...(root?.children ?? [])].map((child) => child.className)).toEqual([
            'sr-only',
            'sr-only',
            'game-topbar',
            'game-body',
            'game-footer',
        ]);
    });

    it('shows a translated Back control and toolbar accessible name, in Ukrainian', () => {
        stubMatchMedia([]);
        renderGame('uk');

        expect(screen.getByRole('button', { name: 'На головну' })).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Дії гри' })).toBeInTheDocument();
    });
});
