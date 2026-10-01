import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HelpSheet } from '../../../src/ui/sheets/HelpSheet';
import { renderWithStore } from '../../support/renderWithStore';
import { testStore } from '../../support/testStore';

describe('HelpSheet', () => {
    it('shows the four rule cards', () => {
        renderWithStore(<HelpSheet />);

        expect(screen.getByText('Fill the four foundations')).toBeInTheDocument();
        expect(screen.getByText('Build down, alternate colours')).toBeInTheDocument();
        expect(screen.getByText('Only Kings fill an empty column')).toBeInTheDocument();
        expect(screen.getByText('Draw 1 or Draw 3')).toBeInTheDocument();
    });

    it('lists a keys table with Tap/Click, Drag, Double-click, Space, Ctrl+Z/Ctrl+Y, H, A, N, P and Esc', () => {
        renderWithStore(<HelpSheet />);

        const table = screen.getByRole('table');
        const kbdTexts = within(table)
            .getAllByText((_, element) => element?.tagName.toLowerCase() === 'kbd')
            .map((element) => element.textContent);

        for (const key of [
            'Tap',
            'Click',
            'Drag',
            'Double-click',
            'Space',
            'Ctrl+Z',
            'Ctrl+Y',
            'H',
            'A',
            'N',
            'P',
            'Esc',
        ]) {
            expect(kbdTexts).toContain(key);
        }
    });

    it('shows a Standard and Vegas scoring summary', () => {
        renderWithStore(<HelpSheet />);

        expect(screen.getByText(/Standard:/)).toBeInTheDocument();
        expect(screen.getByText(/Vegas:/)).toBeInTheDocument();
    });

    // covers: KS-DEAL-11
    describe('Winnable deals passage', () => {
        it.each([
            ['en', 'Winnable deals', /built-in solver/, ['Easy', 'Medium', 'Hard'], /Difficulty on Home/],
            [
                'uk',
                'Виграшні роздачі',
                /вбудований розв’язувач/,
                ['Легка', 'Середня', 'Складна'],
                /«Складність» на головному екрані/,
            ],
        ] as const)('explains the solver and the three grades in %s', (locale, heading, solver, grades, difficulty) => {
            renderWithStore(<HelpSheet />, { preloadedState: { preferences: { locale } } });

            expect(screen.getByText(heading)).toHaveClass('sub-label');
            expect(screen.getByText(solver)).toBeInTheDocument();
            expect(screen.getByText(difficulty)).toBeInTheDocument();
            for (const grade of grades) {
                expect(screen.getByText(grade, { selector: 'strong' })).toBeInTheDocument();
            }
        });

        it('gives each grade its own explanation next to its name', () => {
            renderWithStore(<HelpSheet />);

            const easy = screen.getByText('Easy', { selector: 'strong' });
            const hard = screen.getByText('Hard', { selector: 'strong' });
            expect(easy.closest('.help-grades__row')).toHaveTextContent(/many plausible mistakes/);
            expect(hard.closest('.help-grades__row')).toHaveTextContent(/Only a narrow line wins/);
        });
    });

    it('lands initial focus on Got it when the sheet opens (I5)', () => {
        renderWithStore(<HelpSheet />);

        expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus();
    });

    it('Got it closes the sheet (dispatches closeSheet) and returns focus to the opener', async () => {
        const user = userEvent.setup();
        const opener = document.createElement('button');
        opener.textContent = 'How to play';
        document.body.appendChild(opener);
        opener.focus();

        const store = testStore({
            preloadedState: {
                app: {
                    route: 'game',
                    sheet: 'help',
                    notices: [],
                    documentVisible: true,
                    systemReducedMotion: false,
                    dealing: null,
                    installable: false,
                    updateDeferred: false,
                },
            },
        });
        const { unmount } = renderWithStore(<HelpSheet />, { store });

        await user.click(screen.getByRole('button', { name: 'Got it' }));

        expect(store.getState().app.sheet).toBeNull();

        unmount();
        expect(opener).toHaveFocus();
        opener.remove();
    });
});
