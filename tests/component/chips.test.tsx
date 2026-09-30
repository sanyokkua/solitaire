import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../src/domain/deal';
import type { Grade, Mode } from '../../src/domain/types';
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

function game(
    mode: Mode,
    options: { verdict?: 'win' | 'random'; attempts?: number; grade?: Grade | null; dailyKey?: string | null } = {},
) {
    const { verdict = 'random', attempts = 1, grade = null, dailyKey = null } = options;
    return gameReducer(
        initialGameState,
        installed({ state: dealFromSeed(7, mode, { verdict, attempts, grade }), dailyKey }),
    );
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
        ['draw1', 'uk', 'Одна карта · Стандарт'],
        ['draw3', 'uk', 'Три карти · Стандарт'],
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

// covers: KS-DEAL-06, KS-DEAL-11
describe('DealChip', () => {
    it.each([
        [{ verdict: 'win', attempts: 1, grade: 'medium' }, 'en', 'Winnable · Medium'],
        [{ verdict: 'win', attempts: 3, grade: 'medium' }, 'en', 'Winnable · Medium'],
        [{ verdict: 'win', attempts: 1, grade: 'easy' }, 'en', 'Winnable · Easy'],
        [{ verdict: 'win', attempts: 1, grade: 'hard' }, 'en', 'Winnable · Hard'],
        [{ verdict: 'win', attempts: 1, grade: null }, 'en', 'Winnable'],
        [{ verdict: 'win', attempts: 4, grade: null }, 'en', 'Winnable'],
        [{ verdict: 'random', attempts: 1, grade: null }, 'en', 'Random deal'],
        [{ verdict: 'win', attempts: 3, grade: 'easy' }, 'uk', 'Виграшна · Легка'],
        [{ verdict: 'win', attempts: 1, grade: 'medium' }, 'uk', 'Виграшна · Середня'],
        [{ verdict: 'win', attempts: 1, grade: 'hard' }, 'uk', 'Виграшна · Складна'],
        [{ verdict: 'win', attempts: 1, grade: null }, 'uk', 'Виграшна'],
        [{ verdict: 'random', attempts: 1, grade: null }, 'uk', 'Випадкова роздача'],
    ] as const)('%j in %s reads %s, with no shuffle count in the text or the name', (meta, locale, text) => {
        renderChips(game('draw1', meta), locale);

        const chip = document.querySelector('.deal-chip');
        expect(within(chip as HTMLElement).getByText(text, { selector: '.deal-chip__text' })).toBeInTheDocument();
        expect(chip?.querySelector('.deal-chip__text')?.textContent).toBe(text);
        expect(chip?.getAttribute('title')?.startsWith(text)).toBe(true);
        expect(chip).toHaveAccessibleName(text);
        expect(chip?.querySelector('.deal-chip__text')?.textContent).not.toMatch(/shuffle|перетасув/i);
    });

    it('offers no note for a first-try deal: the title is the chip text alone', () => {
        renderChips(game('draw1', { verdict: 'win', attempts: 1, grade: 'medium' }));

        const chip = document.querySelector('.deal-chip');
        expect(chip).toHaveAttribute('title', 'Winnable · Medium');
        expect(chip).not.toHaveAttribute('aria-describedby');
        // With the name taken from the text, the browser reads the title as a description; it repeats the name only.
        expect(chip).not.toHaveAccessibleDescription(/found after|shuffle/);
        expect(chip?.querySelector('[hidden]')).toBeNull();
    });

    it('offers no note for a random deal', () => {
        renderChips(game('draw1', { verdict: 'random', attempts: 5 }));

        const chip = document.querySelector('.deal-chip');
        expect(chip).toHaveAttribute('title', 'Random deal');
        expect(chip).not.toHaveAttribute('aria-describedby');
        expect(chip).not.toHaveAccessibleDescription(/found after|shuffle/);
    });

    it.each([
        [{ attempts: 3, grade: 'medium' }, 'en', 'Winnable · Medium', 'found after 3 shuffles'],
        [{ attempts: 2, grade: null }, 'en', 'Winnable', 'found after 2 shuffles'],
        [{ attempts: 3, grade: 'medium' }, 'uk', 'Виграшна · Середня', 'знайдено після 3 перетасувань'],
        [{ attempts: 2, grade: 'easy' }, 'uk', 'Виграшна · Легка', 'знайдено після 2 перетасувань'],
        [{ attempts: 5, grade: 'hard' }, 'uk', 'Виграшна · Складна', 'знайдено після 5 перетасувань'],
        [{ attempts: 21, grade: null }, 'uk', 'Виграшна', 'знайдено після 21 перетасування'],
    ] as const)(
        '%j in %s carries the note as its description and after the text in the title',
        (meta, locale, text, note) => {
            renderChips(game('draw1', { verdict: 'win', ...meta }), locale);

            const chip = document.querySelector('.deal-chip');
            expect(chip).toHaveAccessibleDescription(note);
            expect(chip).toHaveAccessibleName(text);
            expect(chip).toHaveAttribute('title', `${text} — ${note}`);
            expect(chip?.querySelector('.deal-chip__text')?.textContent).toBe(text);
        },
    );

    it('keeps the note out of the visible text and the reading order', () => {
        renderChips(game('draw1', { verdict: 'win', attempts: 3, grade: 'medium' }));

        const chip = document.querySelector('.deal-chip');
        const note = chip?.querySelector('[hidden]');
        expect(note).toHaveTextContent('found after 3 shuffles');
        expect(note).not.toHaveClass('deal-chip__text');
        expect(chip).toHaveAccessibleDescription('found after 3 shuffles');
    });

    it('marks a random deal and hides its icon from assistive technology', () => {
        renderChips(game('draw3'));

        const chip = document.querySelector('.deal-chip');
        expect(chip).toHaveClass('is-random');
        expect(chip?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });

    it('keeps the full text in the DOM for the icon-only width, which CSS hides visually', () => {
        renderChips(game('draw1', { verdict: 'win', attempts: 1, grade: 'medium' }));

        expect(screen.getByText('Winnable · Medium')).toBeInTheDocument();
        expect(document.querySelector('.deal-chip')).toHaveAccessibleName('Winnable · Medium');
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
            { preloadedState: { game: game('draw1', { verdict: 'win', attempts: 3, grade: 'medium' }) } },
        );
    }

    it('fills the chip slot and shows the theme toggle then Settings after it in the stacked profile', () => {
        stubMatchMedia([]);
        const { container } = renderGame();

        const bar = container.querySelector<HTMLElement>('.game-topbar');
        if (bar === null) throw new Error('expected the top bar');
        const slot = bar.querySelector('.game-chips');
        expect(slot).not.toHaveAttribute('aria-hidden');
        expect(slot).toHaveTextContent('Draw 1 · StandardWinnable · Medium');
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
