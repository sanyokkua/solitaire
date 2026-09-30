import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { played, statsReducer, won, type StatsState } from '../../../src/features/stats/statsSlice';
import type { Preferences } from '../../../src/features/preferences/preferencesSlice';
import { HomeScreen } from '../../../src/ui/screens/HomeScreen';
import { renderWithStore } from '../../support/renderWithStore';
import { testStore } from '../../support/testStore';

const MODE_NAMES = ['Draw 1', 'Draw 3', 'Vegas', 'Daily deal'] as const;

function renderHome(preferences: Partial<Preferences> = {}, today = new Date('2026-05-07T12:00:00Z')) {
    const store = testStore({ preloadedState: { preferences }, deps: { today: () => today } });
    return renderWithStore(<HomeScreen />, { store });
}

const winnable = () => screen.getByRole('switch', { name: 'Winnable deals only' });

describe('Home mode tiles', () => {
    it('shows a labelled "Game mode" radio group of four named tiles under "Choose a game"', () => {
        renderHome();

        expect(screen.getByText('Choose a game')).toBeVisible();
        const group = screen.getByRole('radiogroup', { name: 'Game mode' });
        expect(group).toBeInTheDocument();
        expect(
            within(group)
                .getAllByRole('radio')
                .map((radio) => radio.getAttribute('aria-checked')),
        ).toEqual(['true', 'false', 'false', 'false']);
        for (const name of MODE_NAMES) {
            expect(screen.getByRole('radio', { name })).toBeInTheDocument();
        }
    });

    it('checks the remembered mode, marks it selected and keeps only it in the Tab order', () => {
        renderHome({ selectedMode: 'vegas' });

        const vegas = screen.getByRole('radio', { name: 'Vegas' });
        expect(vegas).toHaveAttribute('aria-checked', 'true');
        expect(vegas).toHaveClass('is-selected');
        expect(vegas).toHaveAttribute('tabindex', '0');
        expect(screen.getByRole('radio', { name: 'Draw 1' })).toHaveAttribute('tabindex', '-1');
        expect(screen.getByRole('radio', { name: 'Draw 1' })).not.toHaveClass('is-selected');
    });

    it('selects by click, writes the preference and does not start a game', async () => {
        const user = userEvent.setup();
        const { store } = renderHome();

        await user.click(screen.getByRole('radio', { name: 'Vegas' }));

        expect(store.getState().preferences.selectedMode).toBe('vegas');
        expect(screen.getByRole('radio', { name: 'Vegas' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'Draw 1' })).toHaveAttribute('aria-checked', 'false');
        expect(store.getState().app.route).toBe('home');
        expect(store.getState().game.current).toBeNull();
    });

    it('moves and selects with the arrow keys, wrapping at both ends', async () => {
        const user = userEvent.setup();
        const { store } = renderHome();
        screen.getByRole('radio', { name: 'Draw 1' }).focus();

        await user.keyboard('{ArrowRight}');
        expect(store.getState().preferences.selectedMode).toBe('draw3');
        expect(screen.getByRole('radio', { name: 'Draw 3' })).toHaveFocus();

        await user.keyboard('{ArrowLeft}{ArrowLeft}');
        expect(store.getState().preferences.selectedMode).toBe('daily');
        expect(screen.getByRole('radio', { name: 'Daily deal' })).toHaveFocus();

        await user.keyboard('{ArrowDown}');
        expect(store.getState().preferences.selectedMode).toBe('draw1');
    });

    it('remembers the selection across a remount from the stored preference', async () => {
        const user = userEvent.setup();
        const first = renderHome();
        await user.click(screen.getByRole('radio', { name: 'Draw 3' }));
        const remembered = first.store.getState().preferences;
        first.unmount();

        renderHome({ selectedMode: remembered.selectedMode });

        expect(screen.getByRole('radio', { name: 'Draw 3' })).toHaveAttribute('aria-checked', 'true');
    });

    it('shows "No record yet" for a mode never won and the best time or bank otherwise', () => {
        let stats: StatsState = statsReducer(undefined, { type: '@@init' });
        stats = statsReducer(stats, played('draw3'));
        stats = statsReducer(stats, won({ mode: 'draw1', elapsedMs: 254_000, score: 480 }));
        stats = statsReducer(stats, won({ mode: 'vegas', elapsedMs: 90_000, score: -7 }));
        const store = testStore({ preloadedState: { stats } });
        renderWithStore(<HomeScreen />, { store });

        expect(screen.getByRole('radio', { name: 'Draw 1' })).toHaveAccessibleDescription(/Best 4:14/);
        expect(screen.getByRole('radio', { name: 'Draw 3' })).toHaveAccessibleDescription(/No record yet/);
        expect(screen.getByRole('radio', { name: 'Vegas' })).toHaveAccessibleDescription(/Best -\$7/);
        expect(screen.getByRole('radio', { name: 'Daily deal' })).toHaveAccessibleDescription(/No record yet/);
    });

    it('shows the rules line of each mode', () => {
        renderHome();

        expect(screen.getByRole('radio', { name: 'Draw 1' })).toHaveAccessibleDescription(/Standard · 1 card/);
        expect(screen.getByRole('radio', { name: 'Draw 3' })).toHaveAccessibleDescription(/Standard · 3 cards/);
        expect(screen.getByRole('radio', { name: 'Vegas' })).toHaveAccessibleDescription(/-\$52 · 3 passes/);
    });

    it("shows today's UTC day and date on the Daily tile from the injected clock", () => {
        renderHome({}, new Date('2026-05-07T12:00:00Z'));

        const daily = screen.getByRole('radio', { name: 'Daily deal' });
        expect(daily).toHaveTextContent('7');
        expect(daily).toHaveAccessibleDescription(/Thu, May 7/);
    });

    it('uses the UTC date at 04:30 UTC, not a local one', () => {
        renderHome({}, new Date('2026-05-07T04:30:00Z'));

        const daily = screen.getByRole('radio', { name: 'Daily deal' });
        expect(daily).toHaveTextContent('7');
        expect(daily).toHaveAccessibleDescription(/May 7/);
    });

    it('writes the Daily date in Ukrainian words in the Ukrainian locale', () => {
        renderHome({ locale: 'uk' }, new Date('2026-05-07T12:00:00Z'));

        expect(screen.getByRole('radiogroup', { name: 'Режим гри' })).toBeInTheDocument();
        expect(screen.getByText('Оберіть гру')).toBeVisible();
        const daily = screen.getByRole('radio', { name: 'Щоденна роздача' });
        expect(daily).toHaveTextContent('7');
        expect(daily).toHaveAccessibleDescription(/7 трав/);
        expect(screen.getByRole('radio', { name: 'Одна карта' })).toHaveAccessibleDescription(/Рекорду ще немає/);
    });
});

describe('Home Winnable deals only switch', () => {
    it('is a switch, on by default for Draw 1, and its caption is linked to it', () => {
        renderHome();

        const toggle = winnable();
        expect(toggle).toBeEnabled();
        expect(toggle).toHaveAttribute('aria-checked', 'true');
        expect(toggle).toHaveAccessibleDescription(/solver checks every deal before it is shown/);
    });

    it('toggles by click and by keyboard, and writes the preference', async () => {
        const user = userEvent.setup();
        const { store } = renderHome();

        await user.click(winnable());
        expect(store.getState().preferences.winnableOnly).toBe(false);
        expect(winnable()).toHaveAttribute('aria-checked', 'false');

        winnable().focus();
        await user.keyboard(' ');
        expect(store.getState().preferences.winnableOnly).toBe(true);
    });

    it('is remembered for Draw 1', () => {
        renderHome({ winnableOnly: false });

        expect(winnable()).toHaveAttribute('aria-checked', 'false');
    });

    it.each(['draw3', 'vegas'] as const)('is enabled and shows the stored choice for %s', async (mode) => {
        const user = userEvent.setup();
        const { store } = renderHome({ selectedMode: mode, winnableOnly: true });

        expect(winnable()).toBeEnabled();
        expect(winnable()).toHaveAttribute('aria-checked', 'true');
        expect(winnable()).toHaveAccessibleDescription(/solver checks every deal before it is shown/);

        await user.click(winnable());

        expect(store.getState().preferences.winnableOnly).toBe(false);
        expect(winnable()).toHaveAttribute('aria-checked', 'false');
    });

    it('is disabled and on for Daily even when the stored choice is off, keeping the stored value', async () => {
        const user = userEvent.setup();
        const { store } = renderHome({ selectedMode: 'daily', winnableOnly: false });

        expect(winnable()).toBeDisabled();
        expect(winnable()).toHaveAttribute('aria-checked', 'true');
        expect(winnable()).toHaveAccessibleDescription(/Daily deals are always checked/);

        await user.click(winnable());

        expect(store.getState().preferences.winnableOnly).toBe(false);
    });

    it('follows the selected tile', async () => {
        const user = userEvent.setup();
        renderHome();

        await user.click(screen.getByRole('radio', { name: 'Vegas' }));
        expect(winnable()).toBeEnabled();

        await user.click(screen.getByRole('radio', { name: 'Daily deal' }));
        expect(winnable()).toBeDisabled();

        await user.click(screen.getByRole('radio', { name: 'Draw 1' }));
        expect(winnable()).toBeEnabled();
        expect(winnable()).toHaveAttribute('aria-checked', 'true');
    });

    it('is named and explained in Ukrainian', () => {
        renderHome({ locale: 'uk', selectedMode: 'daily' });

        const toggle = screen.getByRole('switch', { name: 'Лише виграшні роздачі' });
        expect(toggle).toHaveAccessibleDescription(/Щоденні роздачі перевіряються завжди/);
    });
});
