// covers: KS-SET-01

import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRoute } from '../../../src/app/appSlice';
import { createThemeController } from '../../../src/app/themeController';
import { STORAGE_KEY, BACKUP_KEY } from '../../../src/features/persistence/recordCodec';
import { createStorageGateway } from '../../../src/features/persistence/storageGateway';
import { played } from '../../../src/features/stats/statsSlice';
import type * as CatalogModule from '../../../src/i18n/catalog';
import { SettingsSheet } from '../../../src/ui/sheets/SettingsSheet';
import { restoreMatchMedia, stubMatchMedia } from '../../support/matchMedia';
import { memoryStorage } from '../../fixtures/storage';
import { renderWithStore } from '../../support/renderWithStore';
import { testStore } from '../../support/testStore';

describe('SettingsSheet: Appearance and Play', () => {
    beforeEach(() => {
        stubMatchMedia([]);
    });

    afterEach(() => {
        restoreMatchMedia();
    });

    it('shows the Appearance and Play group headings', () => {
        renderWithStore(<SettingsSheet />);

        expect(screen.getByText('Appearance')).toBeInTheDocument();
        expect(screen.getByText('Play')).toBeInTheDocument();
    });

    it('lands initial focus on the Theme control (its first option) when the sheet opens (I5)', () => {
        renderWithStore(<SettingsSheet />);

        expect(screen.getByRole('radio', { name: 'Light' })).toHaveFocus();
    });

    it('renders every switch with the switch role, a name, and its checked state, and toggles its preference at once', async () => {
        const user = userEvent.setup();
        const { store } = renderWithStore(<SettingsSheet />);

        const highlight = screen.getByRole('switch', { name: 'Highlight legal moves' });
        expect(highlight).toHaveAttribute('aria-checked', 'true');
        expect(store.getState().preferences.highlight).toBe(true);

        await user.click(highlight);

        expect(highlight).toHaveAttribute('aria-checked', 'false');
        expect(store.getState().preferences.highlight).toBe(false);

        const fourColor = screen.getByRole('switch', { name: 'Four-colour deck' });
        expect(fourColor).toHaveAttribute('aria-checked', 'false');

        await user.click(fourColor);

        expect(fourColor).toHaveAttribute('aria-checked', 'true');
        expect(store.getState().preferences.fourColor).toBe(true);
    });

    it('toggles every other switch (Night cards, Auto-move safe cards, Stock on the right, Animations)', async () => {
        const user = userEvent.setup();
        const { store } = renderWithStore(<SettingsSheet />);

        for (const [name, key] of [
            ['Night cards', 'nightCards'],
            ['Auto-move safe cards', 'autoSafe'],
            ['Stock on the right', 'stockRight'],
            ['Animations', 'animations'],
        ] as const) {
            const before = store.getState().preferences[key];
            await user.click(screen.getByRole('switch', { name }));
            expect(store.getState().preferences[key]).toBe(!before);
        }
    });

    it('exposes the Theme control as a named radiogroup, moves and selects with arrow keys, and updates the preference', async () => {
        const user = userEvent.setup();
        const { store } = renderWithStore(<SettingsSheet />);

        const group = screen.getByRole('radiogroup', { name: 'Theme' });
        expect(group).toBeInTheDocument();
        expect(store.getState().preferences.theme).toBe('system');
        expect(within(group).getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');

        screen.getByRole('radio', { name: 'Light' }).focus();
        await user.keyboard('{ArrowRight}');

        expect(store.getState().preferences.theme).toBe('dark');
        expect(screen.getByRole('radio', { name: 'Dark' })).toHaveFocus();
        expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');

        await user.keyboard('{ArrowRight}');
        expect(store.getState().preferences.theme).toBe('system');

        await user.keyboard('{ArrowLeft}');
        expect(store.getState().preferences.theme).toBe('dark');
    });

    it('exposes Tap a card to… as a named radiogroup and selects by click', async () => {
        const user = userEvent.setup();
        const { store } = renderWithStore(<SettingsSheet />);

        expect(screen.getByRole('radiogroup', { name: 'Tap a card to…' })).toBeInTheDocument();
        expect(store.getState().preferences.tapMode).toBe('smart');

        await user.click(screen.getByRole('radio', { name: 'Select & place' }));

        expect(store.getState().preferences.tapMode).toBe('select');
        expect(screen.getByRole('radio', { name: 'Select & place' })).toHaveAttribute('aria-checked', 'true');
    });

    it('exposes Card back as a named radiogroup of colour-named swatches, moves and selects with arrow keys', async () => {
        const user = userEvent.setup();
        const { store } = renderWithStore(<SettingsSheet />);

        const group = screen.getByRole('radiogroup', { name: 'Card back' });
        expect(within(group).getByRole('radio', { name: 'Harbour blue' })).toHaveAttribute('aria-checked', 'true');
        expect(store.getState().preferences.cardBack).toBe('harbour');

        screen.getByRole('radio', { name: 'Harbour blue' }).focus();
        await user.keyboard('{ArrowRight}');

        expect(store.getState().preferences.cardBack).toBe('navy');
        expect(screen.getByRole('radio', { name: 'Deep navy' })).toHaveFocus();

        await user.click(screen.getByRole('radio', { name: 'Coral' }));
        expect(store.getState().preferences.cardBack).toBe('coral');
    });

    it('applies a Theme change to <html data-theme> through the running theme controller (wiring)', async () => {
        const user = userEvent.setup();
        const store = testStore();
        const root = document.createElement('html');
        const controller = createThemeController(store, root, (query) => window.matchMedia(query));
        renderWithStore(<SettingsSheet />, { store });

        await user.click(screen.getByRole('radio', { name: 'Dark' }));

        expect(root.getAttribute('data-theme')).toBe('dark');

        act(() => {
            controller.dispose();
        });
    });
});

// covers: KS-I18N-01
describe('SettingsSheet: Language', () => {
    beforeEach(() => {
        stubMatchMedia([]);
    });

    afterEach(() => {
        restoreMatchMedia();
    });

    it('shows the Language group heading and one option per registered language, labelled by its own name', () => {
        renderWithStore(<SettingsSheet />);

        expect(screen.getAllByText('Language').length).toBeGreaterThan(0);
        const group = screen.getByRole('radiogroup', { name: 'Language' });
        expect(within(group).getByRole('radio', { name: 'English' })).toBeInTheDocument();
        expect(within(group).getByRole('radio', { name: 'Українська' })).toBeInTheDocument();
    });

    it('choosing Українська re-renders the open sheet heading and rows at once, and stays open', async () => {
        const user = userEvent.setup();
        const { store } = renderWithStore(<SettingsSheet />);

        await user.click(screen.getByRole('radio', { name: 'Українська' }));

        expect(store.getState().preferences.locale).toBe('uk');
        expect(screen.getByRole('dialog', { name: 'Налаштування' })).toBeInTheDocument();
        expect(screen.getByText('Вигляд')).toBeInTheDocument();
        expect(screen.getByText('Тема')).toBeInTheDocument();
    });
});

// covers: KS-I18N-03
describe('SettingsSheet: Language registry (mocked catalog)', () => {
    beforeEach(() => {
        stubMatchMedia([]);
    });

    afterEach(() => {
        restoreMatchMedia();
        vi.doUnmock('../../../src/i18n/catalog');
        vi.resetModules();
    });

    it('lists a third registered language by its own name, with no component change', async () => {
        vi.doMock('../../../src/i18n/catalog', async () => {
            const actual = await vi.importActual<typeof CatalogModule>('../../../src/i18n/catalog');
            const CATALOGS = {
                ...actual.CATALOGS,
                fr: { name: 'Français', catalog: actual.CATALOGS.en.catalog },
            };
            return {
                ...actual,
                CATALOGS,
                SUPPORTED_LOCALES: Object.keys(CATALOGS),
            };
        });
        vi.resetModules();

        const { SettingsSheet: MockedSettingsSheet } = await import('../../../src/ui/sheets/SettingsSheet');
        renderWithStore(<MockedSettingsSheet />);

        const group = screen.getByRole('radiogroup', { name: 'Language' });
        expect(within(group).getByRole('radio', { name: 'Français' })).toBeInTheDocument();
    });
});

// covers: KS-PER-05, KS-STA-05
describe('SettingsSheet: Data', () => {
    beforeEach(() => {
        stubMatchMedia([]);
    });

    afterEach(() => {
        restoreMatchMedia();
    });

    it('asks first: Reset statistics shows Confirm/Cancel and clears nothing until Confirm', async () => {
        const user = userEvent.setup();
        const { store } = renderWithStore(<SettingsSheet />);
        store.dispatch(played('draw1'));

        await user.click(screen.getByRole('button', { name: 'Reset statistics' }));

        expect(screen.getByRole('button', { name: 'Confirm Reset statistics' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel Reset statistics' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reset statistics' })).not.toBeInTheDocument();
        expect(store.getState().stats.modes.draw1.played).toBe(1);
    });

    it('Cancel keeps the data and returns focus to the Reset statistics control (I5)', async () => {
        const user = userEvent.setup();
        renderWithStore(<SettingsSheet />);

        await user.click(screen.getByRole('button', { name: 'Reset statistics' }));
        await user.click(screen.getByRole('button', { name: 'Cancel Reset statistics' }));

        const trigger = screen.getByRole('button', { name: 'Reset statistics' });
        expect(trigger).toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('Confirm clears the statistics and returns focus to the Reset statistics control (I5)', async () => {
        const user = userEvent.setup();
        const { store } = renderWithStore(<SettingsSheet />);
        store.dispatch(played('draw1'));
        expect(store.getState().stats.modes.draw1.played).toBe(1);

        await user.click(screen.getByRole('button', { name: 'Reset statistics' }));
        await user.click(screen.getByRole('button', { name: 'Confirm Reset statistics' }));

        expect(store.getState().stats.modes.draw1.played).toBe(0);
        const trigger = screen.getByRole('button', { name: 'Reset statistics' });
        expect(trigger).toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('Reset all local data, once confirmed, shows Home with defaults from the browser language and removes the storage record and backup through the injected gateway', async () => {
        const user = userEvent.setup();
        const storage = memoryStorage();
        const gateway = createStorageGateway(storage);
        storage.setItem(STORAGE_KEY, 'stored');
        storage.setItem(BACKUP_KEY, 'an unreadable record');
        const store = testStore({ deps: { gateway, languages: () => ['uk-UA'] } });
        renderWithStore(<SettingsSheet />, { store });

        await user.click(screen.getByRole('button', { name: 'Reset all local data' }));
        await user.click(screen.getByRole('button', { name: 'Confirm Reset all local data' }));

        expect(store.getState().app.route).toBe('home');
        expect(store.getState().preferences.locale).toBe('uk');
        expect(storage.getItem(STORAGE_KEY)).toBeNull();
        expect(storage.getItem(BACKUP_KEY)).toBeNull();
    });

    it('Cancel on Reset all local data changes nothing and returns focus to the control', async () => {
        const user = userEvent.setup();
        const { store } = renderWithStore(<SettingsSheet />);
        store.dispatch(setRoute('game'));

        await user.click(screen.getByRole('button', { name: 'Reset all local data' }));
        await user.click(screen.getByRole('button', { name: 'Cancel Reset all local data' }));

        expect(store.getState().app.route).toBe('game');
        const trigger = screen.getByRole('button', { name: 'Reset all local data' });
        expect(trigger).toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});
