import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { sheetOpened } from '../../src/app/appSlice';
import { selectionCleared } from '../../src/features/interaction/interactionSlice';
import { useGameShortcuts } from '../../src/ui/board/useGameShortcuts';
import { ModalSheet, type ModalSheetProps } from '../../src/ui/sheets/ModalSheet';
import { playedGame } from '../fixtures/games';
import { renderWithStore } from '../support/renderWithStore';

type HarnessOverrides = Partial<Omit<ModalSheetProps, 'children' | 'initialFocusRef'>>;

interface HarnessProps extends HarnessOverrides {
    /** Starts closed, behind an "Open sheet" button, so a test can control what has focus when the sheet opens. */
    readonly openOnClick?: boolean;
}

/**
 * An App-shaped harness (D2): a `.app-screen` that goes `inert` while the sheet is open, notices and an announcer
 * stand-in outside it, and `ModalSheet` itself (with a two-control test body).
 */
function Harness({ onDismiss = vi.fn(), returnFocusFallback = vi.fn(), openOnClick = false, ...rest }: HarnessProps) {
    const [open, setOpen] = useState(!openOnClick);
    const [openerGone, setOpenerGone] = useState(false);
    const initialFocusRef = useRef<HTMLButtonElement>(null);

    return (
        <>
            {openOnClick && !openerGone && (
                <button
                    type="button"
                    onClick={() => {
                        setOpen(true);
                    }}
                >
                    Open sheet
                </button>
            )}
            {openOnClick && (
                <button
                    type="button"
                    onClick={() => {
                        setOpenerGone(true);
                    }}
                >
                    Remove opener
                </button>
            )}
            <div data-testid="screen" inert={open}>
                <h1 tabIndex={-1}>Screen heading</h1>
                <button type="button">Screen button</button>
            </div>
            <div role="status">Notices stand-in</div>
            {open && (
                <ModalSheet
                    heading="Test sheet"
                    initialFocusRef={initialFocusRef}
                    onDismiss={() => {
                        setOpen(false);
                        onDismiss();
                    }}
                    returnFocusFallback={returnFocusFallback}
                    {...rest}
                >
                    <button ref={initialFocusRef} type="button">
                        First
                    </button>
                    <button type="button">Second</button>
                </ModalSheet>
            )}
        </>
    );
}

const dialog = () => screen.getByRole('dialog');
const first = () => screen.getByRole('button', { name: 'First' });
const second = () => screen.getByRole('button', { name: 'Second' });
const closeButton = () => screen.queryByRole('button', { name: 'Close' });
const screenBox = () => screen.getByTestId('screen');

describe('ModalSheet', () => {
    it('is a modal dialog named from its heading', () => {
        renderWithStore(<Harness />);

        expect(dialog()).toHaveAttribute('aria-modal', 'true');
        expect(dialog()).toHaveAccessibleName('Test sheet');
    });

    it('moves focus to the initial-focus control on open', () => {
        renderWithStore(<Harness />);

        expect(first()).toHaveFocus();
    });

    it('traps Tab and Shift+Tab within the panel', async () => {
        const user = userEvent.setup();
        renderWithStore(<Harness />);

        await user.tab();
        expect(second()).toHaveFocus();
        await user.tab();
        expect(closeButton()).toHaveFocus();
        await user.tab();
        expect(first()).toHaveFocus();

        await user.tab({ shift: true });
        expect(closeButton()).toHaveFocus();
    });

    it('returns focus to the opener on close', async () => {
        const user = userEvent.setup();
        renderWithStore(<Harness openOnClick={true} />);

        const openSheet = screen.getByRole('button', { name: 'Open sheet' });
        await user.click(openSheet);
        await user.click(screen.getByRole('button', { name: 'Close' }));

        expect(openSheet).toHaveFocus();
    });

    it('returns focus to the fallback when the opener is disconnected at close', async () => {
        const user = userEvent.setup();
        const returnFocusFallback = vi.fn(() => {
            screen.getByRole('heading', { name: 'Screen heading' }).focus();
        });
        renderWithStore(<Harness openOnClick={true} returnFocusFallback={returnFocusFallback} />);

        await user.click(screen.getByRole('button', { name: 'Open sheet' }));
        await user.click(screen.getByRole('button', { name: 'Remove opener' }));
        await user.click(screen.getByRole('button', { name: 'Close' }));

        expect(returnFocusFallback).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('heading', { name: 'Screen heading' })).toHaveFocus();
    });

    it('dismisses on Escape', async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        renderWithStore(<Harness onDismiss={onDismiss} />);

        await user.keyboard('{Escape}');
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('dismisses on a scrim click but not a click inside the panel', async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        renderWithStore(<Harness onDismiss={onDismiss} />);

        await user.click(first());
        expect(onDismiss).not.toHaveBeenCalled();

        await user.click(screen.getByTestId('modal-backdrop'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('ignores Escape and the scrim, and has no close button, when dismissable is false', async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        renderWithStore(<Harness onDismiss={onDismiss} dismissable={false} />);

        expect(closeButton()).not.toBeInTheDocument();

        await user.keyboard('{Escape}');
        await user.click(screen.getByTestId('modal-backdrop'));
        expect(onDismiss).not.toHaveBeenCalled();
    });

    it('closes on the close button', async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        renderWithStore(<Harness onDismiss={onDismiss} />);

        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('is a wide panel when wide is set', () => {
        renderWithStore(<Harness wide={true} />);

        expect(dialog()).toHaveClass('modal-sheet--wide');
    });

    it('makes the screen behind it inert, leaving notices reachable', () => {
        renderWithStore(<Harness />);

        expect(screenBox()).toHaveAttribute('inert');
        expect(screen.getByRole('status')).not.toHaveAttribute('inert');
    });

    it('leaves a board selection untouched: Escape closes only the sheet, never a selection', async () => {
        const user = userEvent.setup();

        function GameHarness() {
            useGameShortcuts();
            return <Harness />;
        }

        const { store } = renderWithStore(<GameHarness />, { preloadedState: { game: playedGame() } });
        act(() => {
            store.dispatch(sheetOpened('settings'));
        });
        const dispatch = vi.spyOn(store, 'dispatch');

        await user.keyboard('{Escape}');

        expect(dispatch).not.toHaveBeenCalledWith(selectionCleared());
    });

    it('leaves a global game shortcut (H) inert while open', async () => {
        const user = userEvent.setup();

        function GameHarness() {
            useGameShortcuts();
            return <Harness />;
        }

        const { store } = renderWithStore(<GameHarness />, { preloadedState: { game: playedGame() } });
        act(() => {
            store.dispatch(sheetOpened('settings'));
        });

        await user.keyboard('h');

        expect(store.getState().interaction.pendingHint).toBeNull();
    });
});
