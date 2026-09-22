import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { App } from '../../src/App';
import { createAppStore } from '../../src/app/store';

// Drag is not asserted here: the shell has no draggable object at this point in the
// build — card dragging is introduced with the board in a later phase.

function renderApp() {
    const store = createAppStore();
    return render(
        <Provider store={store}>
            <App />
        </Provider>,
    );
}

describe('application shell navigation', () => {
    it('renders the Home screen on first mount and not the Game screen', () => {
        renderApp();

        expect(screen.getByRole('button', { name: /deal cards/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /back to home/i })).not.toBeInTheDocument();
    });

    it('navigates to Game when the start control is activated by pointer', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.click(screen.getByRole('button', { name: /deal cards/i }));

        expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /deal cards/i })).not.toBeInTheDocument();
    });

    it('navigates to Game when the start control is activated by keyboard', async () => {
        const user = userEvent.setup();
        renderApp();

        await user.tab();
        expect(screen.getByRole('button', { name: /deal cards/i })).toHaveFocus();

        await user.keyboard('{Enter}');

        expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
    });

    it('returns to Home when the back control is activated by pointer', async () => {
        const user = userEvent.setup();
        renderApp();
        await user.click(screen.getByRole('button', { name: /deal cards/i }));

        await user.click(screen.getByRole('button', { name: /back to home/i }));

        expect(screen.getByRole('button', { name: /deal cards/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /back to home/i })).not.toBeInTheDocument();
    });

    it('returns to Home when the back control is activated by keyboard', async () => {
        const user = userEvent.setup();
        renderApp();
        await user.click(screen.getByRole('button', { name: /deal cards/i }));

        screen.getByRole('button', { name: /back to home/i }).focus();
        await user.keyboard('{Enter}');

        expect(screen.getByRole('button', { name: /deal cards/i })).toBeInTheDocument();
    });

    it('gives both navigation controls an accessible name', async () => {
        const user = userEvent.setup();
        renderApp();

        expect(screen.getByRole('button', { name: /deal cards/i })).toHaveAccessibleName();

        await user.click(screen.getByRole('button', { name: /deal cards/i }));

        expect(screen.getByRole('button', { name: /back to home/i })).toHaveAccessibleName();
    });
});
