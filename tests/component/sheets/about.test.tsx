import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AboutSheet } from '../../../src/ui/sheets/AboutSheet';
import { renderWithStore } from '../../support/renderWithStore';
import { testStore } from '../../support/testStore';

describe('AboutSheet', () => {
    it('shows the app name', () => {
        renderWithStore(<AboutSheet />, { store: testStore() });

        expect(screen.getByText('Solitaire')).toBeInTheDocument();
    });

    it('falls back to the dev version label under Vitest, since __APP_VERSION__ is not defined here', () => {
        expect(typeof __APP_VERSION__).not.toBe('string');

        renderWithStore(<AboutSheet />, { store: testStore() });

        expect(screen.getByText('Version dev')).toBeInTheDocument();
    });

    it('shows the build stamp', () => {
        renderWithStore(<AboutSheet />, { store: testStore() });

        expect(screen.getByText(/App build:/)).toBeInTheDocument();
    });

    it('links to the source repository with an accessible name describing the destination', () => {
        renderWithStore(<AboutSheet />, { store: testStore() });

        const link = screen.getByRole('link', { name: 'View source on GitHub' });
        expect(link).toHaveAttribute('href', 'https://github.com/sanyokkua/solitaire');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('links to the licence with an accessible name describing the destination', () => {
        renderWithStore(<AboutSheet />, { store: testStore() });

        const link = screen.getByRole('link', { name: 'View the MIT licence' });
        expect(link).toHaveAttribute('href', 'https://github.com/sanyokkua/solitaire/blob/master/LICENSE');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('shows a privacy line stating no data leaves the device', () => {
        renderWithStore(<AboutSheet />, { store: testStore() });

        expect(screen.getByText(/No data leaves this device/)).toBeInTheDocument();
    });

    it('lands initial focus on the actions row Close button when the sheet opens (I5)', () => {
        renderWithStore(<AboutSheet />, { store: testStore() });

        // Two controls share the "Close" name (the header's icon close and this sheet's own explicit Close action);
        // focus lands on the explicit one, in `.modal-sheet__actions`.
        const actions = document.querySelector('.modal-sheet__actions');
        expect(actions).not.toBeNull();
        expect(within(actions as HTMLElement).getByRole('button', { name: 'Close' })).toHaveFocus();
    });
});
