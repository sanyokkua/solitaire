import { render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/app/store';
import { GameScreen } from '../../src/ui/screens/GameScreen';
import { RAILS_QUERY } from '../../src/ui/screens/profiles';
import { fakeDealService } from '../fixtures/dealService';
import { playedGame } from '../fixtures/games';

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

/** Makes exactly the queries in `matching` match. */
function matchOnly(matching: readonly string[]): void {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
            matches: matching.includes(query),
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }),
    });
}

function renderGame() {
    const store = createAppStore({ preloadedState: { game: playedGame() }, deps: { dealService: fakeDealService() } });
    return render(
        <Provider store={store}>
            <GameScreen />
        </Provider>,
    );
}

afterEach(() => {
    if (originalMatchMedia !== undefined) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
});

describe('GameScreen chrome profiles', () => {
    it('puts the only Back control in the top bar in the stacked profile', () => {
        matchOnly([]);
        const { container } = renderGame();

        const back = screen.getAllByRole('button', { name: 'Back to Home' });
        expect(back).toHaveLength(1);
        expect(back[0]?.closest('.game-topbar')).not.toBeNull();
        expect(container.querySelector('.game-hud')).not.toContainElement(back[0] ?? null);
    });

    it('puts the only Back control first in the HUD rail, without a top bar, in the rails profile', () => {
        matchOnly([RAILS_QUERY]);
        const { container } = renderGame();

        const back = screen.getAllByRole('button', { name: 'Back to Home' });
        expect(back).toHaveLength(1);
        expect(container.querySelector('.game-topbar')).toBeNull();
        const hud = container.querySelector<HTMLElement>('.game-hud');
        expect(hud?.firstElementChild).toBe(back[0]);
    });

    it('keeps the reserved regions in both profiles, empty', () => {
        for (const matching of [[], [RAILS_QUERY]]) {
            matchOnly(matching);
            const { container, unmount } = renderGame();

            expect(container.querySelector('.game-face')).toBeEmptyDOMElement();
            expect(container.querySelector('.game-face')).toHaveAttribute('aria-hidden', 'true');
            expect(container.querySelector('.game-hint')).toBeEmptyDOMElement();
            expect(container.querySelector('.board-panel')).not.toBeNull();
            expect(within(container).getByRole('navigation', { name: 'Game actions' })).toBeInTheDocument();
            unmount();
        }
    });

    it('lays the frame out as the top bar, then the body, then the footer', () => {
        matchOnly([]);
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
});
