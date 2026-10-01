import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Preferences } from '../../../src/features/preferences/preferencesSlice';
import { HomeScreen } from '../../../src/ui/screens/HomeScreen';
import { renderWithStore } from '../../support/renderWithStore';
import { testStore } from '../../support/testStore';

function renderHome(preferences: Partial<Preferences> = {}) {
    const store = testStore({ preloadedState: { preferences } });
    return renderWithStore(<HomeScreen />, { store });
}

const winnable = () => screen.getByRole('switch', { name: 'Winnable deals only' });
const difficulty = () => screen.getByRole('radiogroup', { name: 'Difficulty' });
const grade = (name: string) => within(difficulty()).getByRole('radio', { name });
const checkedGrade = () =>
    within(difficulty())
        .getAllByRole('radio')
        .find((radio) => radio.getAttribute('aria-checked') === 'true')?.textContent;

describe('Home Winnable card: the switch in every mode', () => {
    it.each(['draw1', 'draw3', 'vegas'] as const)('is live in %s and shows the stored choice', async (mode) => {
        const user = userEvent.setup();
        const { store } = renderHome({ selectedMode: mode, winnableOnly: true });

        expect(winnable()).toBeEnabled();
        expect(winnable()).toHaveAttribute('aria-checked', 'true');
        expect(winnable()).toHaveAccessibleDescription(/solver checks every deal before it is shown/);
        expect(winnable()).toHaveAccessibleDescription(/Random deal/);

        await user.click(winnable());

        expect(store.getState().preferences.winnableOnly).toBe(false);
        expect(winnable()).toHaveAttribute('aria-checked', 'false');
    });

    it('is on and disabled in Daily, keeping the stored choice, with its own caption', async () => {
        const user = userEvent.setup();
        const { store } = renderHome({ selectedMode: 'daily', winnableOnly: false });

        expect(winnable()).toBeDisabled();
        expect(winnable()).toHaveAttribute('aria-checked', 'true');
        expect(winnable()).toHaveAccessibleDescription(/Daily deals are always checked/);

        await user.click(winnable());

        expect(store.getState().preferences.winnableOnly).toBe(false);
    });

    it('keeps the caption element linked to the switch in every mode', async () => {
        const user = userEvent.setup();
        renderHome();

        for (const name of ['Draw 1', 'Draw 3', 'Vegas', 'Daily deal']) {
            await user.click(screen.getByRole('radio', { name }));
            expect(winnable()).toHaveAttribute('aria-describedby', 'winnable-caption');
            expect(document.getElementById('winnable-caption')).toHaveTextContent(/\S/);
        }
    });
});

// covers: KS-DEAL-11
describe('Home Winnable card: the Difficulty control', () => {
    it('is a group named "Difficulty" of Any, Easy, Medium and Hard, each with its checked state', () => {
        renderHome();

        expect(
            within(difficulty())
                .getAllByRole('radio')
                .map((radio) => radio.textContent),
        ).toEqual(['Any', 'Easy', 'Medium', 'Hard']);
        expect(grade('Any')).toHaveAttribute('aria-checked', 'true');
        for (const name of ['Easy', 'Medium', 'Hard']) expect(grade(name)).toHaveAttribute('aria-checked', 'false');
        expect(difficulty()).not.toHaveAttribute('aria-disabled', 'true');
    });

    it.each(['draw1', 'draw3', 'vegas'] as const)('is enabled in %s with the switch on', (mode) => {
        renderHome({ selectedMode: mode, winnableOnly: true });

        for (const radio of within(difficulty()).getAllByRole('radio')) expect(radio).toBeEnabled();
    });

    it('is chosen by click and the choice is stored', async () => {
        const user = userEvent.setup();
        const { store } = renderHome({ selectedMode: 'draw3' });

        await user.click(grade('Hard'));

        expect(store.getState().preferences.difficulty).toBe('hard');
        expect(grade('Hard')).toHaveAttribute('aria-checked', 'true');
        expect(grade('Any')).toHaveAttribute('aria-checked', 'false');
    });

    it('is chosen by the arrow keys, moving focus, and kept by Space and Enter', async () => {
        const user = userEvent.setup();
        const { store } = renderHome();

        winnable().focus();
        await user.tab();
        expect(grade('Any')).toHaveFocus();
        await user.keyboard('{ArrowRight}');

        expect(store.getState().preferences.difficulty).toBe('easy');
        expect(grade('Easy')).toHaveFocus();

        await user.keyboard(' ');
        expect(store.getState().preferences.difficulty).toBe('easy');
        await user.keyboard('{Enter}');
        expect(checkedGrade()).toBe('Easy');

        await user.keyboard('{ArrowDown}{ArrowRight}');
        expect(store.getState().preferences.difficulty).toBe('hard');

        await user.keyboard('{ArrowRight}');
        expect(store.getState().preferences.difficulty).toBe('any');

        await user.keyboard('{ArrowLeft}');
        expect(store.getState().preferences.difficulty).toBe('hard');
    });

    it('keeps only the checked option in the Tab order', () => {
        renderHome({ difficulty: 'medium' });

        expect(grade('Medium')).toHaveAttribute('tabindex', '0');
        expect(grade('Any')).toHaveAttribute('tabindex', '-1');
    });

    it('is disabled with the switch off, still showing the stored choice, and never writes', async () => {
        const user = userEvent.setup();
        const { store } = renderHome({ selectedMode: 'draw3', winnableOnly: false, difficulty: 'medium' });

        expect(winnable()).toBeEnabled();
        expect(winnable()).toHaveAttribute('aria-checked', 'false');
        expect(difficulty()).toHaveAttribute('aria-disabled', 'true');
        for (const radio of within(difficulty()).getAllByRole('radio')) expect(radio).toBeDisabled();
        expect(checkedGrade()).toBe('Medium');

        await user.click(grade('Hard'));
        grade('Medium').focus();
        await user.keyboard('{ArrowRight}');

        expect(store.getState().preferences.difficulty).toBe('medium');
        expect(checkedGrade()).toBe('Medium');
        expect(store.getState().preferences.winnableOnly).toBe(false);
    });

    it('is disabled in Daily even with the switch stored on, still showing the stored choice', async () => {
        const user = userEvent.setup();
        const { store } = renderHome({ selectedMode: 'daily', winnableOnly: true, difficulty: 'hard' });

        expect(difficulty()).toHaveAttribute('aria-disabled', 'true');
        expect(checkedGrade()).toBe('Hard');

        await user.click(grade('Easy'));

        expect(store.getState().preferences.difficulty).toBe('hard');
    });

    it('is enabled again when the switch is turned back on, without resetting the choice', async () => {
        const user = userEvent.setup();
        const { store } = renderHome({ winnableOnly: true, difficulty: 'hard' });

        await user.click(winnable());
        expect(difficulty()).toHaveAttribute('aria-disabled', 'true');
        expect(checkedGrade()).toBe('Hard');

        await user.click(winnable());
        expect(difficulty()).not.toHaveAttribute('aria-disabled', 'true');
        expect(store.getState().preferences.difficulty).toBe('hard');
    });

    it('keeps Hard through Daily and back to Vegas, where it is enabled', async () => {
        const user = userEvent.setup();
        const { store } = renderHome({ selectedMode: 'draw3', winnableOnly: true });
        await user.click(grade('Hard'));

        await user.click(screen.getByRole('radio', { name: 'Daily deal' }));
        expect(winnable()).toHaveAttribute('aria-checked', 'true');
        expect(difficulty()).toHaveAttribute('aria-disabled', 'true');
        expect(checkedGrade()).toBe('Hard');

        await user.click(screen.getByRole('radio', { name: 'Vegas' }));
        expect(winnable()).toHaveAttribute('aria-checked', 'true');
        expect(winnable()).toBeEnabled();
        expect(checkedGrade()).toBe('Hard');
        expect(grade('Hard')).toBeEnabled();
        expect(store.getState().preferences.difficulty).toBe('hard');
    });
});

describe('Home Winnable card in Ukrainian', () => {
    it('names the group and its options and explains the solver', () => {
        renderHome({ locale: 'uk', selectedMode: 'draw3' });

        expect(screen.getByRole('switch', { name: 'Лише виграшні роздачі' })).toHaveAccessibleDescription(
            /Вбудований розв’язувач/,
        );
        const group = screen.getByRole('radiogroup', { name: 'Складність' });
        expect(
            within(group)
                .getAllByRole('radio')
                .map((radio) => radio.textContent),
        ).toEqual(['Будь-яка', 'Легка', 'Середня', 'Складна']);
        expect(within(group).getByRole('radio', { name: 'Будь-яка' })).toHaveAttribute('aria-checked', 'true');
    });
});
