// covers: KS-INP-04, KS-INP-05, KS-INP-06, KS-INP-07

import { act } from '@testing-library/react';
import { dealingProgressed, setRoute, sheetOpened } from '../../src/app/appSlice';
import { play, undo } from '../../src/features/game/gameThunks';
import { firePointer } from '../support/pointer';
import {
    FIVE_SPADES,
    POSITION,
    QUEEN_HEARTS,
    SEVEN_CLUBS,
    SEVEN_SPADES,
    SIX_DIAMONDS,
    SIX_HEARTS,
    SIZE,
    mount,
    moveTo,
    press,
    release,
    settle,
    installBoardHarness,
    type Mounted,
} from '../support/boardHarness';

const harness = installBoardHarness();

const tableauOfStore = (m: Mounted) => m.store.getState().game.current?.tableau;
const dragProps = (el: HTMLElement) => ['--dx', '--dy', '--k'].map((name) => el.style.getPropertyValue(name));

describe('dragging a card', () => {
    it('drops on the legal column it overlaps and plays the move', async () => {
        const m = mount();
        press(m, SIX_DIAMONDS);
        moveTo(m, m.column(0));
        expect(m.cardEl(SIX_DIAMONDS).classList.contains('is-dragging')).toBe(true);
        expect(m.store.getState().interaction.selection).toEqual({ from: { pile: 'tableau', col: 2 }, index: 0 });
        release(m, m.column(0));
        await settle();

        expect(tableauOfStore(m)?.[0]?.map((card) => card.id)).toEqual([SEVEN_CLUBS, SIX_DIAMONDS]);
        expect(tableauOfStore(m)?.[2]).toEqual([]);
        expect(m.store.getState().game.current?.moves).toBe(1);
    });

    it('marks only the dragged card and writes its offset and stacking key while it moves', () => {
        const m = mount();
        const start = press(m, SIX_DIAMONDS);
        firePointer(m.board, 'pointermove', { clientX: start.clientX + 30, clientY: start.clientY + 20 });

        expect(dragProps(m.cardEl(SIX_DIAMONDS))).toEqual(['30px', '20px', '0']);
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(1);
        expect(m.cardEl(SEVEN_CLUBS).style.getPropertyValue('--dx')).toBe('');
    });

    it('drags a whole run with an ordered stacking key on each card', async () => {
        const m = mount();
        const start = press(m, SIX_HEARTS);
        firePointer(m.board, 'pointermove', { clientX: start.clientX + 40, clientY: start.clientY + 12 });

        expect(dragProps(m.cardEl(SIX_HEARTS))).toEqual(['40px', '12px', '0']);
        expect(dragProps(m.cardEl(FIVE_SPADES))).toEqual(['40px', '12px', '1']);
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(2);

        release(m, m.column(0));
        await settle();
        expect(tableauOfStore(m)?.[0]?.map((card) => card.id)).toEqual([SEVEN_CLUBS, SIX_HEARTS, FIVE_SPADES]);
    });

    it('drops on the left hand column when it overlaps more', async () => {
        const m = mount();
        const gap = m.column(1).x - m.column(0).x;
        press(m, SIX_DIAMONDS);
        release(m, { x: m.column(0).x + 0.3 * gap, y: m.column(0).y });
        await settle();
        expect(tableauOfStore(m)?.[0]).toHaveLength(2);
        expect(tableauOfStore(m)?.[1]).toHaveLength(1);
    });

    it('drops on the right hand column when it overlaps more', async () => {
        const m = mount();
        const gap = m.column(1).x - m.column(0).x;
        press(m, SIX_DIAMONDS);
        release(m, { x: m.column(0).x + 0.7 * gap, y: m.column(0).y });
        await settle();
        expect(tableauOfStore(m)?.[1]).toHaveLength(2);
        expect(tableauOfStore(m)?.[0]).toHaveLength(1);
    });

    it('takes an exact tie in overlap for the lower-numbered legal column', async () => {
        const m = mount();
        const gap = m.column(1).x - m.column(0).x;
        press(m, SIX_DIAMONDS);
        release(m, { x: m.column(0).x + gap / 2, y: m.column(0).y });
        await settle();
        expect(tableauOfStore(m)?.[0]).toHaveLength(2);
        expect(tableauOfStore(m)?.[1]).toHaveLength(1);
    });

    it('works, with one drag, in StrictMode', async () => {
        const m = mount(POSITION, { strict: true });
        press(m, SIX_DIAMONDS);
        expect(harness.capture.setPointerCapture).toHaveBeenCalledOnce();
        release(m, m.column(0));
        await settle();
        expect(tableauOfStore(m)?.[0]).toHaveLength(2);
        expect(m.store.getState().game.current?.moves).toBe(1);
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
    });

    it('changes nothing and clears the drag when released over an illegal target', async () => {
        const m = mount();
        const before = m.store.getState().game.current;
        press(m, SIX_DIAMONDS);
        release(m, m.column(6));
        await settle();

        expect(m.store.getState().game.current).toBe(before);
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
        expect(dragProps(m.cardEl(SIX_DIAMONDS))).toEqual(['', '', '']);
        expect(m.store.getState().interaction.selection).toBeNull();
    });

    it('changes nothing when released over no pile at all', async () => {
        const m = mount();
        const before = m.store.getState().game.current;
        press(m, SIX_DIAMONDS);
        release(m, { x: SIZE.width + 200, y: SIZE.height + 200 });
        await settle();
        expect(m.store.getState().game.current).toBe(before);
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
    });

    it('captures the pointer on the press and releases it on the release', () => {
        const m = mount();
        press(m, SIX_DIAMONDS, { pointerId: 7 });
        expect(harness.capture.setPointerCapture).toHaveBeenCalledExactlyOnceWith(7);
        firePointer(m.board, 'pointerup', { pointerId: 7 });
        expect(harness.capture.releasePointerCapture).toHaveBeenCalledWith(7);
    });

    it('keeps working when the browser refuses pointer capture', async () => {
        harness.throwOnCapture();
        const m = mount();
        expect(() => {
            press(m, SIX_DIAMONDS);
            release(m, m.column(0));
        }).not.toThrow();
        await settle();
        expect(tableauOfStore(m)?.[0]).toHaveLength(2);
    });
});

describe('what is not a drag', () => {
    it('does not drag below the mouse threshold and treats the release as a tap', async () => {
        const m = mount();
        const start = press(m, SIX_DIAMONDS);
        firePointer(m.board, 'pointermove', { clientX: start.clientX + 4, clientY: start.clientY });
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
        firePointer(m.board, 'pointerup', { clientX: start.clientX + 4, clientY: start.clientY });
        await settle();
        // The tap is a smart tap: the six goes to the first black seven that takes it.
        expect(tableauOfStore(m)?.[0]).toHaveLength(2);
        expect(m.store.getState().interaction.selection).toBeNull();
    });

    it('needs more travel for touch than for a mouse', () => {
        const m = mount();
        const start = press(m, SIX_DIAMONDS, { pointerType: 'touch' });
        firePointer(m.board, 'pointermove', {
            clientX: start.clientX + 8,
            clientY: start.clientY,
            pointerType: 'touch',
        });
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
        firePointer(m.board, 'pointermove', {
            clientX: start.clientX + 10,
            clientY: start.clientY,
            pointerType: 'touch',
        });
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(1);
    });

    it('ignores a secondary mouse button', () => {
        const m = mount();
        const start = press(m, SIX_DIAMONDS, { button: 2 });
        firePointer(m.board, 'pointermove', { clientX: start.clientX + 30, clientY: start.clientY });
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
        expect(harness.capture.setPointerCapture).not.toHaveBeenCalled();
    });

    it('does not pick up a face-down card', () => {
        const m = mount();
        const start = press(m, QUEEN_HEARTS);
        firePointer(m.board, 'pointermove', { clientX: start.clientX + 30, clientY: start.clientY });
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
        expect(m.store.getState().interaction.selection).toBeNull();
    });

    it('does not pick up from an empty pile', () => {
        const m = mount();
        const area = m.areas.get('tableau:6');
        if (!area) throw new Error('no area');
        const point = { clientX: area.x + 10, clientY: area.y + 10 };
        firePointer(m.board, 'pointerdown', point);
        firePointer(m.board, 'pointermove', { clientX: point.clientX + 30, clientY: point.clientY });
        firePointer(m.board, 'pointerup', { clientX: point.clientX + 30, clientY: point.clientY });
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
    });

    it('ignores a second pointer while one is pressed', () => {
        const m = mount();
        const start = press(m, SIX_DIAMONDS, { pointerId: 1 });
        firePointer(m.cardEl(SEVEN_CLUBS), 'pointerdown', { clientX: 5, clientY: 5, pointerId: 2 });
        firePointer(m.board, 'pointermove', { clientX: start.clientX + 30, clientY: start.clientY, pointerId: 2 });
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
        firePointer(m.board, 'pointermove', { clientX: start.clientX + 30, clientY: start.clientY, pointerId: 1 });
        expect(dragProps(m.cardEl(SIX_DIAMONDS))[0]).toBe('30px');
        expect(harness.capture.setPointerCapture).toHaveBeenCalledExactlyOnceWith(1);
    });

    it('swallows the browser context menu on the board', () => {
        const m = mount();
        expect(firePointer(m.cardEl(SIX_DIAMONDS), 'contextmenu')).toBe(false);
    });
});

describe('the click after a press', () => {
    function clickSpy(m: Mounted) {
        const spy = vi.fn();
        m.container.addEventListener('click', spy);
        return spy;
    }

    it('is swallowed after a drag', () => {
        const m = mount();
        const spy = clickSpy(m);
        press(m, SIX_DIAMONDS);
        release(m, m.column(6));
        act(() => {
            m.cardEl(SIX_DIAMONDS).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });
        expect(spy).not.toHaveBeenCalled();
    });

    it('is left alone after a plain tap', () => {
        const m = mount();
        const spy = clickSpy(m);
        press(m, SIX_DIAMONDS);
        release(m, m.origin(SIX_DIAMONDS));
        act(() => {
            m.cardEl(SIX_DIAMONDS).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

describe('cancelling a drag', () => {
    function dragging(m: Mounted) {
        press(m, SIX_DIAMONDS);
        moveTo(m, m.column(0));
        expect(m.cardEl(SIX_DIAMONDS).classList.contains('is-dragging')).toBe(true);
    }

    function expectRestored(m: Mounted) {
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
        expect(dragProps(m.cardEl(SIX_DIAMONDS))).toEqual(['', '', '']);
        expect(m.store.getState().interaction.selection).toBeNull();
        expect(m.store.getState().game.current?.moves).toBe(0);
    }

    it('cancels on Escape, and a later release plays nothing', async () => {
        const m = mount();
        dragging(m);
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        act(() => {
            document.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
        expectRestored(m);
        firePointer(m.board, 'pointerup', { clientX: 0, clientY: 0 });
        await settle();
        expectRestored(m);
    });

    it('leaves Escape alone while nothing is being dragged', () => {
        const m = mount();
        press(m, SIX_DIAMONDS);
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        act(() => {
            document.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(false);
    });

    it('cancels on pointercancel', () => {
        const m = mount();
        dragging(m);
        firePointer(m.board, 'pointercancel');
        expectRestored(m);
    });

    it('cancels when the browser takes the pointer capture away', () => {
        const m = mount();
        dragging(m);
        firePointer(m.board, 'lostpointercapture');
        expectRestored(m);
    });

    // covers: KS-GEN-08
    it('cancels when the board is resized', async () => {
        const m = mount();
        dragging(m);
        m.observer.trigger({ width: 700, height: 760 });
        expectRestored(m);
        firePointer(m.board, 'pointerup', { clientX: 0, clientY: 0 });
        await settle();
        expectRestored(m);
    });

    it('cancels when a sheet opens', () => {
        const m = mount();
        dragging(m);
        act(() => {
            m.store.dispatch(sheetOpened('paused'));
        });
        expectRestored(m);
    });

    const SIX_TO_LEFT = {
        type: 'move',
        from: { pile: 'tableau', col: 2 },
        index: 0,
        to: { pile: 'tableau', col: 0 },
    } as const;

    it('cancels when another command changes the position mid-drag, and the release plays nothing', async () => {
        const m = mount();
        press(m, SIX_HEARTS);
        moveTo(m, m.column(1));
        expect(m.cardEl(SIX_HEARTS).classList.contains('is-dragging')).toBe(true);
        await act(async () => {
            await m.store.dispatch(play(SIX_TO_LEFT));
        });
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
        expect(dragProps(m.cardEl(SIX_HEARTS))).toEqual(['', '', '']);
        expect(m.store.getState().interaction.selection).toBeNull();

        firePointer(m.board, 'pointerup', { clientX: m.column(1).x, clientY: m.column(1).y });
        await settle();
        expect(m.store.getState().game.current?.moves).toBe(1);
        expect(tableauOfStore(m)?.[1]).toHaveLength(1);
    });

    it('cancels when the position is undone mid-drag', async () => {
        const m = mount();
        await act(async () => {
            await m.store.dispatch(play(SIX_TO_LEFT));
        });
        press(m, SEVEN_SPADES);
        moveTo(m, m.column(6));
        expect(m.cardEl(SEVEN_SPADES).classList.contains('is-dragging')).toBe(true);
        act(() => {
            m.store.dispatch(undo());
        });
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
        expect(dragProps(m.cardEl(SEVEN_SPADES))).toEqual(['', '', '']);
        expect(m.store.getState().interaction.selection).toBeNull();
    });

    it('clears the selection and detaches when the board unmounts mid-drag', async () => {
        const m = mount();
        press(m, SIX_DIAMONDS);
        moveTo(m, m.column(0));
        expect(m.store.getState().interaction.selection).not.toBeNull();
        m.unmount();
        expect(m.store.getState().interaction.selection).toBeNull();
        expect(() => {
            firePointer(m.board, 'pointermove', { clientX: 300, clientY: 300 });
            firePointer(m.board, 'pointerup', { clientX: 300, clientY: 300 });
        }).not.toThrow();
        await settle();
        expect(m.store.getState().game.current?.moves).toBe(0);
        const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
        document.dispatchEvent(escape);
        expect(escape.defaultPrevented).toBe(false);
    });

    it('cancels when a deal begins', () => {
        const m = mount();
        dragging(m);
        act(() => {
            m.store.dispatch(dealingProgressed({ overlay: false, attempt: 1 }));
        });
        expectRestored(m);
    });
});

// covers: KS-INP-09
describe('a closed input gate', () => {
    function expectIgnored(m: Mounted) {
        const before = m.store.getState().game.current;
        const start = press(m, SIX_DIAMONDS);
        firePointer(m.board, 'pointermove', { clientX: start.clientX + 30, clientY: start.clientY });
        expect(m.board.querySelectorAll('.is-dragging')).toHaveLength(0);
        expect(m.store.getState().interaction.selection).toBeNull();
        expect(harness.capture.setPointerCapture).not.toHaveBeenCalled();
        firePointer(m.board, 'pointerup', { clientX: start.clientX + 30, clientY: start.clientY });
        expect(m.store.getState().game.current).toBe(before);
    }

    it('ignores the pointer while a deal is prepared', () => {
        const m = mount();
        act(() => {
            m.store.dispatch(dealingProgressed({ overlay: true, attempt: 2 }));
        });
        expectIgnored(m);
    });

    it('ignores the pointer while a sheet is open', () => {
        const m = mount();
        act(() => {
            m.store.dispatch(sheetOpened('settings'));
        });
        expectIgnored(m);
    });

    it('ignores the pointer once the game is won', () => {
        expectIgnored(mount({ ...POSITION, status: 'won' }));
    });

    it('ignores the pointer away from the Game route', () => {
        const m = mount();
        act(() => {
            m.store.dispatch(setRoute('home'));
        });
        expectIgnored(m);
    });
});
