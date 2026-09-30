import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/App';
import { HomeScreen } from '../../../src/ui/screens/HomeScreen';
import { ThemeToggle } from '../../../src/ui/components/ThemeToggle';
import { restoreMatchMedia, stubMatchMedia } from '../../support/matchMedia';
import { renderWithStore } from '../../support/renderWithStore';

const DARK = '(prefers-color-scheme: dark)';

afterEach(() => {
    restoreMatchMedia();
});

describe('ThemeToggle', () => {
    it('from System showing light, offers dark and writes a concrete dark theme', async () => {
        stubMatchMedia([]);
        const user = userEvent.setup();
        const { store } = renderWithStore(<ThemeToggle />, { preloadedState: { preferences: { theme: 'system' } } });

        await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

        expect(store.getState().preferences.theme).toBe('dark');
        expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
    });

    it('from System showing dark, offers light and writes a concrete light theme', async () => {
        stubMatchMedia([DARK]);
        const user = userEvent.setup();
        const { store } = renderWithStore(<ThemeToggle />, { preloadedState: { preferences: { theme: 'system' } } });

        await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));

        expect(store.getState().preferences.theme).toBe('light');
    });

    it.each([
        ['light', 'Switch to dark theme', 'dark'],
        ['dark', 'Switch to light theme', 'light'],
    ] as const)('from explicit %s it is named "%s" and writes %s', async (theme, name, next) => {
        stubMatchMedia([DARK]); // the device scheme is ignored once a theme is chosen
        const user = userEvent.setup();
        const { store } = renderWithStore(<ThemeToggle />, { preloadedState: { preferences: { theme } } });

        await user.click(screen.getByRole('button', { name }));

        expect(store.getState().preferences.theme).toBe(next);
    });

    it('works from the keyboard and is named in Ukrainian', async () => {
        stubMatchMedia([]);
        const user = userEvent.setup();
        const { store } = renderWithStore(<ThemeToggle />, {
            preloadedState: { preferences: { theme: 'light', locale: 'uk' } },
        });

        const toggle = screen.getByRole('button', { name: 'Увімкнути темну тему' });
        toggle.focus();
        await user.keyboard('{Enter}');

        expect(store.getState().preferences.theme).toBe('dark');
    });
});

describe('Home top bar and hero', () => {
    it('has one level-one heading, the wordmark, named Solitaire', () => {
        stubMatchMedia([]);
        renderWithStore(<HomeScreen />);

        const headings = screen.getAllByRole('heading', { level: 1 });
        expect(headings).toHaveLength(1);
        expect(headings[0]).toHaveTextContent('Solitaire');
        expect(headings[0]).toHaveClass('wordmark');
    });

    it('shows the badge with a live dot hidden from assistive technology', () => {
        stubMatchMedia([]);
        const { container } = renderWithStore(<HomeScreen />);

        const badge = container.querySelector('.badge');
        expect(badge).toHaveTextContent('Klondike · Draw 1 & 3');
        expect(badge?.querySelector('.live-dot')).toHaveAttribute('aria-hidden', 'true');
    });

    it('shows the pitch, a fan of five cards and the dither, the art hidden from assistive technology', () => {
        stubMatchMedia([]);
        const { container } = renderWithStore(<HomeScreen />);

        expect(container.querySelector('.home-hero p')).toHaveTextContent(/\S/);
        const fan = container.querySelector('.hero-fan');
        expect(fan?.querySelectorAll('.card')).toHaveLength(5);
        expect(fan?.closest('[aria-hidden="true"]')).not.toBeNull();
        expect(container.querySelector('.dither')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('keeps the Deal cards button beside the hero', () => {
        stubMatchMedia([]);
        renderWithStore(<HomeScreen />);

        expect(screen.getByRole('button', { name: 'Deal cards' })).toBeInTheDocument();
    });

    it('opens the Settings sheet from the top bar, and Close returns focus to the opener', async () => {
        stubMatchMedia([]);
        const user = userEvent.setup();
        const { store } = renderWithStore(<App />);

        const opener = within(screen.getByRole('banner')).getByRole('button', { name: 'Settings' });
        await user.click(opener);

        expect(store.getState().app.sheet).toBe('settings');
        const dialog = screen.getByRole('dialog', { name: 'Settings' });

        await user.click(within(dialog).getByRole('button', { name: 'Close' }));

        expect(store.getState().app.sheet).toBeNull();
        expect(opener).toHaveFocus();
    });

    it('opens Settings from the keyboard', async () => {
        stubMatchMedia([]);
        const user = userEvent.setup();
        const { store } = renderWithStore(<HomeScreen />);

        within(screen.getByRole('banner')).getByRole('button', { name: 'Settings' }).focus();
        await user.keyboard('{Enter}');

        expect(store.getState().app.sheet).toBe('settings');
    });

    it('names the top bar buttons in Ukrainian', () => {
        stubMatchMedia([]);
        renderWithStore(<HomeScreen />, { preloadedState: { preferences: { locale: 'uk', theme: 'light' } } });

        expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Налаштування' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Увімкнути темну тему' })).toBeInTheDocument();
    });
});
