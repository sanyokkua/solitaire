import { act, fireEvent } from '@testing-library/react';
import { cardId } from '../../src/domain/cards';
import { installed } from '../../src/features/game/gameSlice';
import { play, undo } from '../../src/features/game/gameThunks';
import { ACE_HOME_CARD, aceHomePosition } from '../fixtures/boardPositions';
import { faceDown, faceUp, makeState, tableauOf } from '../fixtures/states';
import {
    FIVE_SPADES,
    JACK_HEARTS,
    POSITION,
    QUEEN_HEARTS,
    SEVEN_CLUBS,
    SEVEN_SPADES,
    SIX_DIAMONDS,
    SIX_HEARTS,
    installBoardHarness,
    mount,
    settle,
    type Mounted,
} from '../support/boardHarness';

installBoardHarness();

const ACE_HEARTS = cardId(0, 1);
const TWO_HEARTS = cardId(0, 2);
const NINE_DIAMONDS = cardId(1, 9);
const KING_SPADES = cardId(3, 13);

const focusEl = (el: HTMLElement): void => {
    act(() => {
        el.focus();
    });
};

const slotEl = (m: Mounted, key: string): HTMLElement => {
    const el = m.board.querySelector<HTMLElement>(`.slot[data-pile='${key}']`);
    if (el === null) throw new Error(`no slot ${key}`);
    return el;
};

/** Presses a key on the focused element and tells whether the board prevented its default action. */
function key(k: string, init: KeyboardEventInit = {}): boolean {
    const target = document.activeElement;
    if (target === null) throw new Error('nothing has focus');
    return !fireEvent.keyDown(target, { key: k, ...init });
}

/**
 * jsdom, unlike a real browser, never blurs an element whose `tabindex` attribute is removed while it holds focus
 * (a slot loses its tab stop the moment a card lands on it). This patches `removeAttribute` for the span of a test
 * so that case behaves like Chromium does: the browser drops focus to `document.body`, which is what the
 * focus-restore effect must recover from. Returns the function that undoes the patch.
 */
function installTabindexBlurQuirk(): () => void {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called back below via `.call`, with `this` set explicitly
    const original = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function (this: Element, name: string) {
        if (name === 'tabindex' && this === document.activeElement) (this as HTMLElement).blur();
        original.call(this, name);
    };
    return () => {
        Element.prototype.removeAttribute = original;
    };
}

const column = (m: Mounted, col: number) => m.store.getState().game.current?.tableau[col]?.map((card) => card.id);
const selection = (m: Mounted) => m.store.getState().interaction.selection;
const tabStops = (m: Mounted) => [...m.board.querySelectorAll<HTMLElement>('[tabindex="0"]')];

describe('Tab between piles', () => {
    it('moves from the stock to the waste when the waste holds cards', () => {
        const m = mount(makeState({ stock: [cardId(0, 13)], waste: [NINE_DIAMONDS], started: true }));
        focusEl(slotEl(m, 'stock'));

        expect(key('Tab')).toBe(true);

        expect(document.activeElement).toBe(m.cardEl(NINE_DIAMONDS));
    });

    it('skips an empty waste and lands on the first foundation', () => {
        const m = mount();
        focusEl(slotEl(m, 'stock'));

        key('Tab');

        expect(document.activeElement).toBe(slotEl(m, 'foundation:0'));
    });

    it('lands on the top card of a column and walks Shift+Tab back', () => {
        const m = mount();
        focusEl(m.cardEl(SEVEN_CLUBS));

        key('Tab');
        expect(document.activeElement).toBe(m.cardEl(SEVEN_SPADES));
        key('Tab', { shiftKey: true });
        expect(document.activeElement).toBe(m.cardEl(SEVEN_CLUBS));
    });

    it('does not prevent Tab past the last pile or Shift+Tab before the first, so focus leaves the board', () => {
        const m = mount();
        focusEl(slotEl(m, 'tableau:6'));
        expect(key('Tab')).toBe(false);
        expect(document.activeElement).toBe(slotEl(m, 'tableau:6'));

        focusEl(slotEl(m, 'stock'));
        expect(key('Tab', { shiftKey: true })).toBe(false);
        expect(document.activeElement).toBe(slotEl(m, 'stock'));
    });
});

describe('arrow keys', () => {
    it('step between the face-up cards of a column and stop at either end', () => {
        const m = mount();
        focusEl(m.cardEl(FIVE_SPADES));

        expect(key('ArrowUp')).toBe(true);
        expect(document.activeElement).toBe(m.cardEl(SIX_HEARTS));
        expect(key('ArrowUp')).toBe(true);
        expect(document.activeElement).toBe(m.cardEl(SIX_HEARTS));
        key('ArrowDown');
        expect(document.activeElement).toBe(m.cardEl(FIVE_SPADES));
        expect(key('ArrowDown')).toBe(true);
        expect(document.activeElement).toBe(m.cardEl(FIVE_SPADES));
    });

    it('never rest on a face-down card', () => {
        const m = mount();
        focusEl(m.cardEl(JACK_HEARTS));

        key('ArrowUp');

        expect(document.activeElement).toBe(m.cardEl(JACK_HEARTS));
        expect(m.cardEl(QUEEN_HEARTS)).not.toHaveAttribute('tabindex');
    });

    it('Left and Right step between piles', () => {
        const m = mount();
        focusEl(m.cardEl(SEVEN_CLUBS));

        key('ArrowRight');
        expect(document.activeElement).toBe(m.cardEl(SEVEN_SPADES));
        key('ArrowRight');
        expect(document.activeElement).toBe(m.cardEl(SIX_DIAMONDS));
        key('ArrowLeft');
        expect(document.activeElement).toBe(m.cardEl(SEVEN_SPADES));
    });

    it('follow the mirrored pile order when the stock is on the right', () => {
        const m = mount(POSITION, { preferences: { stockRight: true } });
        focusEl(slotEl(m, 'foundation:0'));

        key('ArrowRight');
        expect(document.activeElement).toBe(slotEl(m, 'foundation:2'));

        focusEl(slotEl(m, 'foundation:3'));
        key('ArrowRight');
        expect(document.activeElement).toBe(slotEl(m, 'stock'));
        key('ArrowRight');
        expect(document.activeElement).toBe(m.cardEl(SEVEN_CLUBS));
    });

    it('leave the board on Shift+Tab from the first pile of the mirrored order', () => {
        const m = mount(POSITION, { preferences: { stockRight: true } });
        focusEl(slotEl(m, 'foundation:0'));

        expect(key('Tab', { shiftKey: true })).toBe(false);
        expect(document.activeElement).toBe(slotEl(m, 'foundation:0'));
    });

    it('are prevented even when focus does not move, so the page does not scroll', () => {
        const m = mount();
        focusEl(slotEl(m, 'stock'));

        expect(key('ArrowDown')).toBe(true);
    });
});

describe('the remembered card of a pile', () => {
    it('is the one focus returns to', () => {
        const m = mount();
        focusEl(m.cardEl(FIVE_SPADES));
        key('ArrowUp');
        expect(document.activeElement).toBe(m.cardEl(SIX_HEARTS));

        key('ArrowRight');
        expect(document.activeElement).toBe(m.cardEl(JACK_HEARTS));
        key('ArrowLeft');

        expect(document.activeElement).toBe(m.cardEl(SIX_HEARTS));
    });

    it('is forgotten once it is no longer in that pile', () => {
        const m = mount();
        focusEl(m.cardEl(FIVE_SPADES));
        key('ArrowUp');
        key('ArrowRight');
        act(() => {
            void m.store.dispatch(
                play({ type: 'move', from: { pile: 'tableau', col: 3 }, index: 0, to: { pile: 'tableau', col: 0 } }),
            );
        });

        focusEl(m.cardEl(JACK_HEARTS));
        key('ArrowLeft');

        expect(document.activeElement).toBe(slotEl(m, 'tableau:3'));
    });
});

describe('the single tab stop', () => {
    it('is the stock at first and follows focus, never more than one', () => {
        const m = mount();
        expect(tabStops(m)).toEqual([slotEl(m, 'stock')]);

        focusEl(slotEl(m, 'stock'));
        key('Tab');
        key('Tab');
        expect(tabStops(m)).toEqual([slotEl(m, 'foundation:2')]);

        focusEl(m.cardEl(SIX_HEARTS));
        expect(tabStops(m)).toEqual([m.cardEl(SIX_HEARTS)]);
    });
});

describe('Enter and Space', () => {
    it('smart-move the focused card and focus follows it', async () => {
        const m = mount();
        focusEl(m.cardEl(SIX_DIAMONDS));

        expect(key('Enter')).toBe(true);
        await settle();

        expect(column(m, 0)).toEqual([SEVEN_CLUBS, SIX_DIAMONDS]);
        expect(document.activeElement).toBe(m.cardEl(SIX_DIAMONDS));
        expect(tabStops(m)).toEqual([m.cardEl(SIX_DIAMONDS)]);
    });

    it('act as a tap: Space acts too and is prevented, so the page does not scroll', async () => {
        const m = mount();
        focusEl(m.cardEl(SIX_DIAMONDS));

        expect(key(' ')).toBe(true);
        await settle();

        expect(column(m, 0)).toEqual([SEVEN_CLUBS, SIX_DIAMONDS]);
    });

    it('draw from a focused stock', async () => {
        const m = mount();
        focusEl(slotEl(m, 'stock'));

        key('Enter');
        await settle();

        expect(m.store.getState().game.current?.waste).toEqual([cardId(0, 13)]);
    });

    it('leave shortcuts with Ctrl or the Command key to the global handler', () => {
        const m = mount();
        focusEl(m.cardEl(SIX_DIAMONDS));

        expect(key('z', { ctrlKey: true })).toBe(false);
        expect(key('Enter', { metaKey: true })).toBe(false);
        expect(column(m, 2)).toEqual([SIX_DIAMONDS]);
    });

    it('select a card under Select and place, then place it on the column focused next', async () => {
        const m = mount(POSITION, { preferences: { tapMode: 'select' } });
        focusEl(m.cardEl(SIX_DIAMONDS));

        key('Enter');
        expect(selection(m)).toEqual({ from: { pile: 'tableau', col: 2 }, index: 0 });
        expect(m.cardEl(SIX_DIAMONDS)).toHaveAttribute('aria-pressed', 'true');

        key('ArrowLeft');
        expect(document.activeElement).toBe(m.cardEl(SEVEN_SPADES));
        key('Enter');
        await settle();

        expect(column(m, 1)).toEqual([SEVEN_SPADES, SIX_DIAMONDS]);
        expect(selection(m)).toBeNull();
    });

    it('lands focus on the destination pile after a card is placed on an empty column', async () => {
        const state = makeState({ tableau: tableauOf(faceUp(KING_SPADES)), stock: [cardId(0, 13)], started: true });
        const m = mount(state, { preferences: { tapMode: 'select' } });
        const restore = installTabindexBlurQuirk();
        try {
            focusEl(m.cardEl(KING_SPADES));
            key('Enter');
            key('ArrowRight');
            expect(document.activeElement).toBe(slotEl(m, 'tableau:1'));

            key('Enter');
            await settle();

            expect(column(m, 1)).toEqual([KING_SPADES]);
            expect(document.activeElement).not.toBe(document.body);
            expect(document.activeElement).toBe(m.cardEl(KING_SPADES));
            expect(tabStops(m)).toEqual([m.cardEl(KING_SPADES)]);
        } finally {
            restore();
        }
    });

    it('lands focus on the moved card after it is placed on an empty foundation, even when the browser blurs the now-unfocusable slot to <body>', async () => {
        const state = aceHomePosition();
        const m = mount(state, { preferences: { tapMode: 'select' } });
        const restore = installTabindexBlurQuirk();
        try {
            focusEl(m.cardEl(ACE_HOME_CARD));
            key('Enter');
            expect(selection(m)).toEqual({ from: { pile: 'tableau', col: 0 }, index: 0 });
            focusEl(slotEl(m, 'foundation:0'));

            key('Enter');
            await settle();

            expect(m.store.getState().game.current?.foundations[0]).toEqual([ACE_HOME_CARD]);
            expect(document.activeElement).not.toBe(document.body);
            expect(document.activeElement).toBe(m.cardEl(ACE_HOME_CARD));
            expect(tabStops(m)).toEqual([m.cardEl(ACE_HOME_CARD)]);
        } finally {
            restore();
        }
    });
});

describe('a held key', () => {
    const drawable = () =>
        makeState({ stock: [cardId(0, 13), cardId(0, 12), cardId(0, 11)], started: true, tableau: POSITION.tableau });

    it.each([['Enter'], [' ']])('%j acts once and the repeat is prevented without acting', async (k) => {
        const m = mount(drawable());
        focusEl(slotEl(m, 'stock'));

        expect(key(k)).toBe(true);
        await settle();
        expect(m.store.getState().game.current?.waste).toHaveLength(1);
        expect(key(k, { repeat: true })).toBe(true);
        await settle();

        expect(m.store.getState().game.current?.waste).toHaveLength(1);
        expect(key(k)).toBe(true);
        await settle();
        expect(m.store.getState().game.current?.waste).toHaveLength(2);
    });

    it('Shift+Enter picks up once and the repeat does not put the card back', () => {
        const m = mount();
        focusEl(m.cardEl(SIX_DIAMONDS));

        key('Enter', { shiftKey: true });
        expect(key('Enter', { shiftKey: true, repeat: true })).toBe(true);

        expect(selection(m)).toEqual({ from: { pile: 'tableau', col: 2 }, index: 0 });
    });

    it('ArrowRight keeps moving focus on every repeat', () => {
        const m = mount();
        focusEl(slotEl(m, 'stock'));

        key('ArrowRight', { repeat: true });
        expect(document.activeElement).toBe(slotEl(m, 'foundation:0'));
        key('ArrowRight', { repeat: true });
        expect(document.activeElement).toBe(slotEl(m, 'foundation:2'));
    });
});

describe('Shift+Enter', () => {
    it('picks a card up under Smart move, so a column other than the best one can be chosen', async () => {
        const m = mount();
        focusEl(m.cardEl(SIX_DIAMONDS));

        expect(key('Enter', { shiftKey: true })).toBe(true);
        expect(selection(m)).toEqual({ from: { pile: 'tableau', col: 2 }, index: 0 });
        expect(column(m, 2)).toEqual([SIX_DIAMONDS]);

        key('ArrowLeft');
        expect(document.activeElement).toBe(m.cardEl(SEVEN_SPADES));
        key('Enter');
        await settle();

        expect(column(m, 1)).toEqual([SEVEN_SPADES, SIX_DIAMONDS]);
        expect(column(m, 0)).toEqual([SEVEN_CLUBS]);
    });

    it('with Space picks a card up too', () => {
        const m = mount();
        focusEl(m.cardEl(SIX_DIAMONDS));

        expect(key(' ', { shiftKey: true })).toBe(true);

        expect(selection(m)).not.toBeNull();
    });

    it('clears the selection when pressed on the selected card', () => {
        const m = mount();
        focusEl(m.cardEl(SIX_DIAMONDS));
        key('Enter', { shiftKey: true });
        expect(selection(m)).not.toBeNull();

        key('Enter', { shiftKey: true });

        expect(selection(m)).toBeNull();
        expect(m.cardEl(SIX_DIAMONDS)).toHaveAttribute('aria-pressed', 'false');
    });

    it('does nothing on a face-down card that focus fell back to', async () => {
        const buried = cardId(0, 5);
        const m = mount(
            makeState({
                tableau: tableauOf([...faceDown(buried), ...faceUp(SIX_DIAMONDS)], faceUp(SEVEN_SPADES)),
                stock: [cardId(0, 13)],
                started: true,
            }),
        );
        focusEl(m.cardEl(SIX_DIAMONDS));
        await act(async () => {
            await m.store.dispatch(
                play({ type: 'move', from: { pile: 'tableau', col: 0 }, index: 1, to: { pile: 'tableau', col: 1 } }),
            );
        });
        await settle();
        expect(column(m, 0)).toEqual([buried]);
        focusEl(m.cardEl(buried));

        key('Enter', { shiftKey: true });
        key('Enter');
        await settle();

        expect(selection(m)).toBeNull();
        expect(column(m, 0)).toEqual([buried]);
        expect(column(m, 1)).toEqual([SEVEN_SPADES, SIX_DIAMONDS]);
    });

    it('does nothing on the stock or an empty pile', () => {
        const m = mount();
        focusEl(slotEl(m, 'stock'));
        key('Enter', { shiftKey: true });
        focusEl(slotEl(m, 'tableau:6'));
        key('Enter', { shiftKey: true });

        expect(selection(m)).toBeNull();
        expect(m.store.getState().game.current?.stock).toHaveLength(1);
    });
});

describe('focus after the position changes', () => {
    it('moves to the pile stop when the focused card is covered and can no longer be picked up', async () => {
        const state = makeState({
            tableau: tableauOf(faceUp(ACE_HEARTS), faceUp(TWO_HEARTS)),
            stock: [cardId(0, 13)],
            started: true,
        });
        const m = mount(state);
        focusEl(m.cardEl(ACE_HEARTS));
        key('Enter');
        await settle();
        expect(document.activeElement).toBe(m.cardEl(ACE_HEARTS));

        await act(async () => {
            await m.store.dispatch(
                play({
                    type: 'move',
                    from: { pile: 'tableau', col: 1 },
                    index: 0,
                    to: { pile: 'foundation', suit: 0 },
                }),
            );
        });

        expect(document.activeElement).toBe(m.cardEl(TWO_HEARTS));
        expect(tabStops(m)).toEqual([m.cardEl(TWO_HEARTS)]);
    });

    it('leaves focus alone when it is outside the board', () => {
        const m = mount();
        const outside = document.createElement('button');
        document.body.append(outside);
        outside.focus();

        act(() => {
            void m.store.dispatch(
                play({ type: 'move', from: { pile: 'tableau', col: 2 }, index: 0, to: { pile: 'tableau', col: 0 } }),
            );
        });

        expect(document.activeElement).toBe(outside);
        outside.remove();
    });
});

describe('focus after an undo', () => {
    it('follows the card back to the pile it returns to', async () => {
        const m = mount();
        focusEl(m.cardEl(SIX_DIAMONDS));
        key('Enter');
        await settle();
        expect(m.cardEl(SIX_DIAMONDS)).toHaveAttribute('data-pile', 'tableau:0');

        act(() => {
            m.store.dispatch(undo());
        });

        expect(m.cardEl(SIX_DIAMONDS)).toHaveAttribute('data-pile', 'tableau:2');
        expect(document.activeElement).toBe(m.cardEl(SIX_DIAMONDS));
        expect(tabStops(m)).toEqual([m.cardEl(SIX_DIAMONDS)]);
    });
});

describe('a new game', () => {
    const install = (m: Mounted) => {
        act(() => {
            m.store.dispatch(installed({ state: POSITION, dailyKey: null }));
        });
    };

    it('puts the tab stop back on the stock', () => {
        const m = mount();
        focusEl(m.cardEl(SIX_HEARTS));
        expect(tabStops(m)).toEqual([m.cardEl(SIX_HEARTS)]);

        install(m);

        expect(tabStops(m)).toEqual([slotEl(m, 'stock')]);
    });

    it('does not restore a card remembered in the game before', () => {
        const m = mount();
        focusEl(m.cardEl(FIVE_SPADES));
        key('ArrowUp');
        expect(document.activeElement).toBe(m.cardEl(SIX_HEARTS));
        key('ArrowRight');
        install(m);

        focusEl(m.cardEl(JACK_HEARTS));
        key('ArrowLeft');

        expect(document.activeElement).toBe(m.cardEl(FIVE_SPADES));
    });
});
