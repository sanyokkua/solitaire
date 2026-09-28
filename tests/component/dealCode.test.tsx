import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { encodeDealCode } from '../../src/domain/dealCode';
import { selectAnnouncement } from '../../src/features/interaction/selectors';
import { DealCode } from '../../src/ui/components/DealCode';
import { playedGame } from '../fixtures/games';
import { restoreClipboard, stubClipboard, stubMissingClipboard, stubRejectingClipboard } from '../support/clipboard';
import { renderWithStore } from '../support/renderWithStore';
import { testStore } from '../support/testStore';

const CODE = encodeDealCode(49, 'draw1');
const LABEL = `Deal ${CODE}`;

afterEach(() => {
    restoreClipboard();
});

describe('DealCode', () => {
    it("shows the current game's deal code", () => {
        renderWithStore(<DealCode />, { preloadedState: { game: playedGame() } });

        expect(screen.getByRole('button', { name: LABEL })).toBeInTheDocument();
    });

    it('renders nothing without a game in play', () => {
        renderWithStore(<DealCode />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('copies the code, raises code-copied and announces it on click', async () => {
        const user = userEvent.setup();
        const clipboard = stubClipboard();
        const store = testStore({ preloadedState: { game: playedGame() } });
        renderWithStore(<DealCode />, { store });

        await user.click(screen.getByRole('button', { name: LABEL }));

        expect(clipboard.copied).toEqual([CODE]);
        expect(store.getState().app.notices.map(({ id }) => id)).toEqual(['code-copied']);
        expect(selectAnnouncement(store.getState()).items.map(({ item }) => item.type)).toEqual(['codeCopied']);
    });

    it.each([
        ['Enter', '{Enter}'],
        ['Space', ' '],
    ])('copies the code and confirms it by keyboard (%s)', async (_name, key) => {
        const user = userEvent.setup();
        const clipboard = stubClipboard();
        const store = testStore({ preloadedState: { game: playedGame() } });
        renderWithStore(<DealCode />, { store });

        screen.getByRole('button', { name: LABEL }).focus();
        await user.keyboard(key);

        expect(clipboard.copied).toEqual([CODE]);
        expect(store.getState().app.notices.map(({ id }) => id)).toEqual(['code-copied']);
    });

    it('selects the code text and raises nothing when the clipboard rejects the write', async () => {
        const user = userEvent.setup();
        stubRejectingClipboard();
        const store = testStore({ preloadedState: { game: playedGame() } });
        renderWithStore(<DealCode />, { store });

        await user.click(screen.getByRole('button', { name: LABEL }));
        await waitFor(() => {
            expect(window.getSelection()?.toString()).toBe(LABEL);
        });

        expect(store.getState().app.notices).toEqual([]);
        expect(selectAnnouncement(store.getState()).items).toEqual([]);
    });

    it('selects the code text at once when the Clipboard API is unavailable', async () => {
        const user = userEvent.setup();
        stubMissingClipboard();
        const store = testStore({ preloadedState: { game: playedGame() } });
        renderWithStore(<DealCode />, { store });

        await user.click(screen.getByRole('button', { name: LABEL }));

        expect(window.getSelection()?.toString()).toBe(LABEL);
        expect(store.getState().app.notices).toEqual([]);
        expect(selectAnnouncement(store.getState()).items).toEqual([]);
    });
});
