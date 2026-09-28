import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../src/domain/deal';
import type { Mode } from '../../src/domain/types';
import { installed, gameReducer, initialGameState } from '../../src/features/game/gameSlice';
import { DealChip } from '../../src/ui/components/DealChip';
import { ModeChip } from '../../src/ui/components/ModeChip';
import { GameScreen } from '../../src/ui/screens/GameScreen';
import { RAILS_QUERY } from '../../src/ui/screens/profiles';
import { SheetHost } from '../../src/ui/sheets/SheetHost';
import { blockAfter, rulesFor, stripComments } from '../support/css';
import { restoreMatchMedia, stubMatchMedia } from '../support/matchMedia';
import { renderWithStore } from '../support/renderWithStore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Locale = 'en' | 'uk';

const layoutCss = stripComments(readFileSync(resolve(import.meta.dirname, '../../src/ui/styles/layout.css'), 'utf-8'));

function game(mode: Mode, options: { verdict?: 'win' | 'random'; attempts?: number; dailyKey?: string | null } = {}) {
    const { verdict = 'random', attempts = 1, dailyKey = null } = options;
    return gameReducer(initialGameState, installed({ state: dealFromSeed(7, mode, { verdict, attempts }), dailyKey }));
}

function renderChips(preloadedGame: ReturnType<typeof game>, locale: Locale = 'en') {
    return renderWithStore(
        <>
            <ModeChip />
            <DealChip />
        </>,
        {
            preloadedState: { game: preloadedGame, preferences: { locale } },
            deps: { today: () => new Date('2026-09-28T12:00:00Z') },
        },
    );
}

afterEach(() => {
    restoreMatchMedia();
});

describe('ModeChip', () => {
    it.each([
        ['draw1', 'en', 'Draw 1 · Standard'],
        ['draw3', 'en', 'Draw 3 · Standard'],
        ['vegas', 'en', 'Vegas'],
        ['draw1', 'uk', 'Роздача 1 · Стандарт'],
        ['draw3', 'uk', 'Роздача 3 · Стандарт'],
        ['vegas', 'uk', 'Вегас'],
    ] as const)('%s reads %s in normal case with the same title', (mode, locale, text) => {
        renderChips(game(mode), locale);

        const chip = screen.getByText(text);
        expect(chip).toHaveTextContent(text);
        expect(chip).toHaveAttribute('title', text);
        expect(chip.textContent).toBe(text);
    });

    it("shows the game's own Daily date, not today's, in en and uk", () => {
        renderChips(game('daily', { dailyKey: '2026-09-19' }));
        expect(screen.getByText('Daily · Sep 19')).toBeInTheDocument();
    });

    it('localises the Daily date in Ukrainian', () => {
        renderChips(game('daily', { dailyKey: '2026-09-19' }), 'uk');
        const chip = document.querySelector('.mode-chip');
        expect(chip?.textContent).toMatch(/^Щоденна роздача · 19 вер/);
    });

    it('shows a plain Daily when the game has no Daily key (D-code)', () => {
        renderChips(game('daily', { dailyKey: null }));
        expect(screen.getByText('Daily')).toBeInTheDocument();
        renderChips(game('daily', { dailyKey: null }), 'uk');
        expect(document.querySelectorAll('.mode-chip')[1]?.textContent).toBe('Щоденна роздача');
    });

    it('styles the mode chip in capitals by CSS alone', () => {
        expect(rulesFor(layoutCss, '.mode-chip').join(' ')).toMatch(/text-transform:\s*uppercase/);
    });
});

describe('DealChip', () => {
    it.each([
        [{ verdict: 'win', attempts: 3 }, 'en', 'Winnable · 3 shuffles'],
        [{ verdict: 'win', attempts: 1 }, 'en', 'Winnable'],
        [{ verdict: 'random', attempts: 1 }, 'en', 'Random deal'],
        [{ verdict: 'win', attempts: 3 }, 'uk', 'Розв’язна · 3 перетасування'],
        [{ verdict: 'win', attempts: 2 }, 'uk', 'Розв’язна · 2 перетасування'],
        [{ verdict: 'win', attempts: 5 }, 'uk', 'Розв’язна · 5 перетасувань'],
        [{ verdict: 'win', attempts: 1 }, 'uk', 'Розв’язна'],
        [{ verdict: 'random', attempts: 1 }, 'uk', 'Випадкова роздача'],
    ] as const)('%j in %s reads %s', (meta, locale, text) => {
        renderChips(game('draw1', meta), locale);

        const chip = document.querySelector('.deal-chip');
        expect(chip).toHaveAttribute('title', text);
        expect(within(chip as HTMLElement).getByText(text)).toHaveClass('deal-chip__text');
        expect(chip).toHaveTextContent(text);
    });

    it('marks a random deal and hides its icon from assistive technology', () => {
        renderChips(game('draw3'));

        const chip = document.querySelector('.deal-chip');
        expect(chip).toHaveClass('is-random');
        expect(chip?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });

    it('keeps the full text in the DOM for the icon-only width, which CSS hides visually', () => {
        renderChips(game('draw1', { verdict: 'win', attempts: 1 }));

        expect(screen.getByText('Winnable')).toBeInTheDocument();
        const narrow = blockAfter(layoutCss, '@media (max-width: 460px)');
        const hidden = rulesFor(narrow, '.deal-chip__text').join(' ');
        expect(hidden).toMatch(/clip-path:\s*inset\(50%\)/);
        expect(hidden).not.toMatch(/display:\s*none/);
    });
});

describe('Game top bar controls', () => {
    function renderGame() {
        return renderWithStore(
            <>
                <GameScreen />
                <SheetHost />
            </>,
            { preloadedState: { game: game('draw1', { verdict: 'win', attempts: 3 }) } },
        );
    }

    it('fills the chip slot and shows the theme toggle then Settings after it in the stacked profile', () => {
        stubMatchMedia([]);
        const { container } = renderGame();

        const bar = container.querySelector<HTMLElement>('.game-topbar');
        if (bar === null) throw new Error('expected the top bar');
        const slot = bar.querySelector('.game-chips');
        expect(slot).not.toHaveAttribute('aria-hidden');
        expect(slot).toHaveTextContent('Draw 1 · StandardWinnable · 3 shuffles');
        const buttons = within(bar).getAllByRole('button');
        expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
            'Back to Home',
            'Switch to dark theme',
            'Settings',
        ]);
        expect(bar.lastElementChild).toBe(buttons[2]);
    });

    it('has no theme toggle in the rails, and Settings sits beside Back at the top of the left rail', () => {
        stubMatchMedia([RAILS_QUERY]);
        const { container } = renderGame();

        expect(screen.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument();
        const top = container.querySelector<HTMLElement>('.game-hud > .rail-top');
        expect(top?.firstElementChild).toBe(screen.getByRole('button', { name: 'Back to Home' }));
        expect(top?.lastElementChild).toBe(screen.getByRole('button', { name: 'Settings' }));
    });

    it('opens Settings from the rails and returns focus to it when the sheet closes (I6, I8)', async () => {
        stubMatchMedia([RAILS_QUERY]);
        const user = userEvent.setup();
        const { store } = renderGame();

        const opener = screen.getByRole('button', { name: 'Settings' });
        await user.click(opener);
        expect(store.getState().app.sheet).toBe('settings');

        await user.click(
            within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', { name: 'Close' }),
        );
        expect(store.getState().app.sheet).toBeNull();
        expect(opener).toHaveFocus();
    });

    it('names Settings in Ukrainian', () => {
        stubMatchMedia([]);
        renderWithStore(<GameScreen />, {
            preloadedState: { game: game('draw1'), preferences: { locale: 'uk' } },
        });
        expect(screen.getByRole('button', { name: 'Налаштування' })).toBeInTheDocument();
    });
});
