import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { appReducer } from '../../../src/app/appSlice';
import type { RootState } from '../../../src/app/store';
import { dealFromSeed } from '../../../src/domain/deal';
import type { StatsState } from '../../../src/features/stats/statsSlice';
import { HomeScreen } from '../../../src/ui/screens/HomeScreen';
import { fakeDealService } from '../../fixtures/dealService';
import { gameOf, playedGame } from '../../fixtures/games';
import { renderWithStore, type RenderWithStoreOptions } from '../../support/renderWithStore';
import { blockAfter, rulesFor, stripComments } from '../../support/css';

const HOME_CSS = stripComments(readFileSync(resolve(import.meta.dirname, '../../../src/ui/styles/home.css'), 'utf-8'));

type Modes = StatsState['modes'];
const mode = (played: number, won: number, streak: number, bestStreak: number) => ({
    played,
    won,
    streak,
    bestStreak,
    bestTimeMs: null,
    bestScore: null,
});

function statsOf(modes: Partial<Modes>): RootState['stats'] {
    const empty = mode(0, 0, 0, 0);
    return {
        modes: { draw1: empty, draw3: empty, vegas: empty, daily: empty, ...modes },
        daily: { completed: [], bestStreak: 0 },
    };
}

function renderHome(options: RenderWithStoreOptions = {}) {
    const dealService = fakeDealService();
    const view = renderWithStore(<HomeScreen />, { deps: { dealService }, ...options });
    return { ...view, dealService };
}

const strip = () => screen.getByLabelText('Your record');
const cells = () =>
    within(strip())
        .getAllByText(/./)
        .map((node) => node.textContent);

describe('Home actions', () => {
    it('Deal cards starts a game in the selected mode and shows the Game screen', async () => {
        const user = userEvent.setup();
        const { store, dealService } = renderHome({ preloadedState: { preferences: { selectedMode: 'vegas' } } });

        await user.click(screen.getByRole('button', { name: 'Deal cards' }));

        expect(store.getState().app.route).toBe('game');
        expect(dealService.requests.map(({ request }) => request.mode)).toEqual(['vegas']);
    });

    // covers: KS-PER-02
    it('shows Continue game only for a resumable game and resumes it unchanged', async () => {
        const user = userEvent.setup();
        const first = renderHome();
        expect(screen.queryByRole('button', { name: 'Continue game' })).toBeNull();
        first.unmount();

        const { store, dealService } = renderHome({ preloadedState: { game: playedGame() } });
        const before = structuredClone(store.getState().game.current);
        await user.click(screen.getByRole('button', { name: 'Continue game' }));

        expect(store.getState().app.route).toBe('game');
        expect(store.getState().game.current).toEqual(before);
        expect(dealService.requests).toEqual([]);
    });

    it('hides Continue game for an unstarted game', () => {
        renderHome({ preloadedState: { game: gameOf(dealFromSeed(1, 'draw1')) } });

        expect(screen.queryByRole('button', { name: 'Continue game' })).toBeNull();
    });

    it.each([
        ['How to play', 'help'],
        ['Statistics', 'stats'],
        ['Settings', 'settings'],
        ['Play a deal code', 'dealCode'],
        ['About', 'about'],
    ] as const)('%s opens the %s sheet', async (name, sheet) => {
        const user = userEvent.setup();
        const { store } = renderHome();

        // The top bar also has a Settings button; the link is the one outside it.
        const [button] = screen
            .getAllByRole('button', { name })
            .filter((candidate) => candidate.closest('.topbar') === null);
        if (!button) throw new Error(`no ${name} button`);
        await user.click(button);

        expect(store.getState().app.sheet).toBe(sheet);
    });

    it('names its actions and links in Ukrainian', () => {
        renderHome({ preloadedState: { game: playedGame(), preferences: { locale: 'uk' } } });

        expect(screen.getByRole('button', { name: 'Роздати карти' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Продовжити гру' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Як грати' })).toBeInTheDocument();
        for (const name of ['Статистика', 'Грати за кодом', 'Про гру']) {
            expect(screen.getByRole('button', { name })).toBeInTheDocument();
        }
        expect(screen.getByLabelText('Ваші результати')).toBeInTheDocument();
    });

    it('offers no Install app link while the browser does not offer installation', () => {
        renderHome();

        expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
    });

    // covers: KS-PWA-02
    it('shows Install app when installable and prompts by Enter, then hides it', async () => {
        const user = userEvent.setup();
        const promptInstall = vi.fn(() => Promise.resolve('accepted' as const));
        const { store } = renderHome({
            preloadedState: { app: { ...appReducer(undefined, { type: '@@init' }), installable: true } },
            deps: { pwa: { applyUpdate: () => Promise.resolve(), promptInstall } },
        });

        screen.getByRole('button', { name: 'Install app' }).focus();
        await user.keyboard('{Enter}');

        expect(promptInstall).toHaveBeenCalledOnce();
        expect(store.getState().app.installable).toBe(false);
        expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
    });

    it('names Install app in Ukrainian', () => {
        renderHome({
            preloadedState: {
                app: { ...appReducer(undefined, { type: '@@init' }), installable: true },
                preferences: { locale: 'uk' },
            },
        });

        expect(screen.getByRole('button', { name: 'Встановити застосунок' })).toBeInTheDocument();
    });

    // covers: KS-A11Y-04
    it('makes every action at least 2.75rem square on a coarse pointer', () => {
        const coarse = blockAfter(HOME_CSS, '@media (pointer: coarse)');

        for (const selector of ['.cta-row .action-button', '.footlinks button']) {
            const body = rulesFor(coarse, selector).join(' ');
            expect(body).toMatch(/min-width:\s*2\.75rem/);
            expect(body).toMatch(/min-height:\s*2\.75rem/);
        }
    });

    // covers: KS-GEN-09, KS-GEN-10
    it('pins the action row to the bottom, above the safe area, on phones and short screens', () => {
        const block = blockAfter(HOME_CSS, '@media (max-width: 720px), (max-height: 800px)');
        const row = rulesFor(block, '.cta-row').join(' ');

        expect(row).toMatch(/position:\s*sticky/);
        expect(row).toMatch(/bottom:\s*0/);
        expect(row).toMatch(/env\(safe-area-inset-bottom/);
        expect(row).toMatch(/linear-gradient/);
    });
});

describe('Home record strip', () => {
    it('reads 000, 000, -- and 0 with no games played', () => {
        renderHome();

        expect(cells()).toEqual(['Played', '000', 'Won', '000', 'Win rate', '--', 'Streak', '0']);
    });

    it('zero-pads totals, rounds the win rate and shows the largest streaks as current/best', () => {
        renderHome({
            preloadedState: {
                stats: statsOf({ draw1: mode(4, 1, 1, 1), draw3: mode(3, 2, 3, 5) }),
            },
        });

        expect(cells()).toEqual(['Played', '007', 'Won', '003', 'Win rate', '43%', 'Streak', '3/5']);
    });

    it('is a labelled group of four named cells', () => {
        renderHome();

        expect(strip()).toHaveClass('stat-strip');
        expect(strip().children).toHaveLength(4);
    });
});
