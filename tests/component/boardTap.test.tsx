import { act } from '@testing-library/react';
import { cardId } from '../../src/domain/cards';
import type { CardId, GameState } from '../../src/domain/types';
import { busySet } from '../../src/features/game/gameSlice';
import { selectCard } from '../../src/features/interaction/interactionThunks';
import { firePointer } from '../support/pointer';
import { faceDown, faceUp, foundationsOf, makeState, tableauOf, vegasAtLimit } from '../fixtures/states';
import {
    FIVE_SPADES,
    METRICS,
    QUEEN_HEARTS,
    SIZE,
    SEVEN_CLUBS,
    SEVEN_SPADES,
    SIX_DIAMONDS,
    SIX_HEARTS,
    installBoardHarness,
    mount,
    press,
    settle,
    type Mounted,
} from '../support/boardHarness';

installBoardHarness();

afterEach(() => {
    vi.useRealTimers();
});

const ACE_HEARTS = cardId(0, 1);
const NINE_CLUBS = cardId(2, 9);
const EIGHT_HEARTS = cardId(0, 8);
const KING_SPADES = cardId(3, 13);

/** An ace that fits its foundation. */
const ACE: GameState = makeState({ tableau: tableauOf(faceUp(ACE_HEARTS)), stock: [cardId(0, 13)], started: true });

/** A nine of clubs under an eight of hearts alone in column 0: nothing accepts either. */
const STUCK: GameState = makeState({
    tableau: tableauOf(faceUp(NINE_CLUBS, EIGHT_HEARTS)),
    stock: [cardId(0, 13)],
    started: true,
});

let clock = 1000;

/** A tap: press and release on the card without moving. By default it starts long after the previous one ended. */
function tap(m: Mounted, id: CardId, { after = 1000, hold = 50 } = {}) {
    const el = m.cardEl(id);
    const down = clock + after;
    clock = down + hold;
    firePointer(el, 'pointerdown', { clientX: 100, clientY: 100, timeStamp: down });
    firePointer(el, 'pointerup', { clientX: 100, clientY: 100, timeStamp: clock });
}

const column = (m: Mounted, col: number) => m.store.getState().game.current?.tableau[col]?.map((card) => card.id);
const shaking = (m: Mounted) =>
    [...m.board.querySelectorAll('.is-shake')].map((el) => Number(el.getAttribute('data-card-id')));
const refusals = (m: Mounted) =>
    m.store
        .getState()
        .interaction.announcement.items.filter(({ item }) => item.type === 'refused')
        .map(({ item }) => item);

describe('a smart tap', () => {
    it('sends an ace to its foundation', async () => {
        const m = mount(ACE);
        tap(m, ACE_HEARTS);
        await settle();

        expect(m.store.getState().game.current?.foundations[0]).toEqual([ACE_HEARTS]);
        expect(column(m, 0)).toEqual([]);
    });

    it('moves a run to the first column that accepts it', async () => {
        const m = mount();
        tap(m, SIX_HEARTS);
        await settle();

        expect(column(m, 0)).toEqual([SEVEN_CLUBS, SIX_HEARTS, FIVE_SPADES]);
        expect(column(m, 3)).toEqual([]);
    });

    it('moves a single card the same way', async () => {
        const m = mount();
        tap(m, SIX_DIAMONDS);
        await settle();

        expect(column(m, 0)).toEqual([SEVEN_CLUBS, SIX_DIAMONDS]);
        expect(column(m, 1)).toEqual([SEVEN_SPADES]);
    });

    it('shakes a card that has no place, announces the refusal and leaves the position alone', () => {
        const m = mount(STUCK);
        const before = m.store.getState().game.current;
        tap(m, EIGHT_HEARTS);

        expect(shaking(m)).toEqual([EIGHT_HEARTS]);
        expect(refusals(m)).toEqual([{ type: 'refused', reason: 'illegal-target' }]);
        expect(m.store.getState().game.current).toBe(before);
    });

    it('shakes every card of a run and drops the class after 340 ms', () => {
        const m = mount(STUCK);
        vi.useFakeTimers();
        tap(m, NINE_CLUBS);
        expect(shaking(m).sort()).toEqual([NINE_CLUBS, EIGHT_HEARTS].sort());

        act(() => {
            vi.advanceTimersByTime(339);
        });
        expect(shaking(m)).toHaveLength(2);
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(shaking(m)).toEqual([]);
    });

    it('restarts the shake when a card is refused again while it still shakes', () => {
        const m = mount(STUCK);
        vi.useFakeTimers();
        tap(m, EIGHT_HEARTS);
        act(() => {
            vi.advanceTimersByTime(200);
        });
        tap(m, EIGHT_HEARTS);
        act(() => {
            vi.advanceTimersByTime(200);
        });
        expect(shaking(m)).toEqual([EIGHT_HEARTS]);
        act(() => {
            vi.advanceTimersByTime(140);
        });
        expect(shaking(m)).toEqual([]);
        expect(refusals(m)).toHaveLength(2);
    });

    it('announces the refusal without a shake when animations are off', () => {
        const m = mount(STUCK, { preferences: { animations: false } });
        tap(m, EIGHT_HEARTS);

        expect(shaking(m)).toEqual([]);
        expect(refusals(m)).toHaveLength(1);
    });

    it('drops a pending shake class when the board unmounts', () => {
        const m = mount(STUCK);
        vi.useFakeTimers();
        tap(m, EIGHT_HEARTS);
        const el = m.cardEl(EIGHT_HEARTS);
        m.unmount();
        expect(el.classList.contains('is-shake')).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does nothing on a face-down card', async () => {
        const state = makeState({
            tableau: tableauOf([...faceDown(NINE_CLUBS), ...faceUp(KING_SPADES)]),
            stock: [cardId(0, 13)],
            started: true,
            foundations: foundationsOf(0, 0, 0, 0),
        });
        const m = mount(state);
        const before = m.store.getState().game.current;
        tap(m, NINE_CLUBS);
        await settle();

        expect(m.store.getState().game.current).toBe(before);
        expect(shaking(m)).toEqual([]);
        expect(refusals(m)).toEqual([]);
    });

    it('is ignored while the input gate is closed', async () => {
        const m = mount(ACE);
        act(() => {
            m.store.dispatch(busySet(true));
        });
        tap(m, ACE_HEARTS);
        await settle();

        expect(column(m, 0)).toEqual([ACE_HEARTS]);
    });

    it('is ignored once the game is won', async () => {
        const m = mount({ ...ACE, status: 'won' });
        tap(m, ACE_HEARTS);
        await settle();

        expect(column(m, 0)).toEqual([ACE_HEARTS]);
    });

    it('ignores a double tap, so a card that just moved is not sent on again', async () => {
        const m = mount();
        tap(m, SIX_DIAMONDS);
        await settle();
        expect(column(m, 0)).toEqual([SEVEN_CLUBS, SIX_DIAMONDS]);

        // Now it could go back onto the other black seven; the second tap of a double tap must not do that.
        tap(m, SIX_DIAMONDS, { after: 100 });
        await settle();

        expect(column(m, 0)).toEqual([SEVEN_CLUBS, SIX_DIAMONDS]);
    });
});

const selection = (m: Mounted) => m.store.getState().interaction.selection;
const moves = (m: Mounted) => m.store.getState().game.current?.moves;
const SELECT = { preferences: { tapMode: 'select' } } as const;

/** A tap on an empty spot of the board at (`x`, `y`) in board coordinates. */
function tapAt(m: Mounted, at: { x: number; y: number }) {
    const point = { clientX: at.x, clientY: at.y };
    firePointer(m.board, 'pointerdown', { ...point, timeStamp: (clock += 1000) });
    firePointer(m.board, 'pointerup', { ...point, timeStamp: (clock += 50) });
}

describe('select and place', () => {
    it('selects a movable card, then places it on a legal column', async () => {
        const m = mount(undefined, SELECT);
        tap(m, SIX_DIAMONDS);
        expect(selection(m)).toEqual({ from: { pile: 'tableau', col: 2 }, index: 0 });
        expect(column(m, 0)).toEqual([SEVEN_CLUBS]);

        tap(m, SEVEN_CLUBS);
        await settle();

        expect(column(m, 0)).toEqual([SEVEN_CLUBS, SIX_DIAMONDS]);
        expect(column(m, 2)).toEqual([]);
        expect(selection(m)).toBeNull();
    });

    it('places on a tap on the top card of a legal column instead of selecting that card', async () => {
        const m = mount(undefined, SELECT);
        tap(m, SIX_HEARTS);
        tap(m, SEVEN_SPADES);
        await settle();

        expect(column(m, 1)).toEqual([SEVEN_SPADES, SIX_HEARTS, FIVE_SPADES]);
        expect(selection(m)).toBeNull();
    });

    it('places on a tap on a face-down card of a legal column', async () => {
        const state = makeState({
            tableau: tableauOf([...faceDown(NINE_CLUBS), ...faceUp(SEVEN_CLUBS)], faceUp(SIX_DIAMONDS)),
            stock: [cardId(0, 13)],
            started: true,
        });
        const m = mount(state, SELECT);
        tap(m, SIX_DIAMONDS);
        tap(m, NINE_CLUBS);
        await settle();

        expect(column(m, 0)).toEqual([NINE_CLUBS, SEVEN_CLUBS, SIX_DIAMONDS]);
        expect(selection(m)).toBeNull();
    });

    it('places on a tap below the last card of a legal column', async () => {
        const m = mount(undefined, SELECT);
        tap(m, SIX_DIAMONDS);
        const next = m.column(1);
        tapAt(m, { x: next.x + 10, y: next.y + METRICS.ch / 2 });
        await settle();

        expect(column(m, 1)).toEqual([SEVEN_SPADES, SIX_DIAMONDS]);
        expect(selection(m)).toBeNull();
    });

    it('places on a foundation slot', async () => {
        const m = mount(ACE, SELECT);
        tap(m, ACE_HEARTS);
        const slot = m.areas.get('foundation:0');
        if (slot === undefined) throw new Error('no foundation area');
        tapAt(m, { x: slot.x + 10, y: slot.y + 10 });
        await settle();

        expect(m.store.getState().game.current?.foundations[0]).toEqual([ACE_HEARTS]);
        expect(selection(m)).toBeNull();
    });

    it('changes the selection to another movable card that is not a legal target', () => {
        const m = mount(undefined, SELECT);
        tap(m, SIX_DIAMONDS);
        tap(m, SIX_HEARTS);

        expect(selection(m)).toEqual({ from: { pile: 'tableau', col: 3 }, index: 0 });
    });

    it('clears the selection on a tap on the selected card', () => {
        const m = mount(undefined, SELECT);
        tap(m, SIX_DIAMONDS);
        tap(m, SIX_DIAMONDS);

        expect(selection(m)).toBeNull();
    });

    it('clears the selection on a tap on an illegal card', () => {
        const m = mount(undefined, SELECT);
        tap(m, SIX_DIAMONDS);
        tap(m, QUEEN_HEARTS);

        expect(selection(m)).toBeNull();
    });

    it('clears the selection on a tap on empty space', () => {
        const m = mount(undefined, SELECT);
        tap(m, SIX_DIAMONDS);
        expect(selection(m)).not.toBeNull();
        tapAt(m, { x: SIZE.width - 1, y: SIZE.height - 1 });

        expect(selection(m)).toBeNull();
    });

    it('does nothing on a tap on empty space, or on a face-down card, with nothing selected', () => {
        const m = mount(undefined, SELECT);
        const before = m.store.getState().interaction;
        tapAt(m, { x: SIZE.width - 1, y: SIZE.height - 1 });
        tap(m, QUEEN_HEARTS);

        expect(m.store.getState().interaction).toBe(before);
    });

    it('never places on the waste', async () => {
        const state = makeState({
            tableau: tableauOf(faceUp(SEVEN_CLUBS), faceUp(SIX_DIAMONDS)),
            waste: [cardId(2, 2)],
            stock: [cardId(0, 13)],
            started: true,
        });
        const m = mount(state, SELECT);
        tap(m, SIX_DIAMONDS);
        tap(m, cardId(2, 2));
        await settle();

        expect(m.store.getState().game.current?.waste).toEqual([cardId(2, 2)]);
        expect(selection(m)).toEqual({ from: { pile: 'waste' }, index: 0 });
    });

    it('still places a picked-up card in smart mode', async () => {
        const m = mount();
        act(() => {
            m.store.dispatch(selectCard({ pile: 'tableau', col: 2 }, 0));
        });
        tap(m, SEVEN_SPADES);
        await settle();

        expect(column(m, 1)).toEqual([SEVEN_SPADES, SIX_DIAMONDS]);
        expect(selection(m)).toBeNull();
    });
});

describe('a double tap', () => {
    it('sends a lone card that fits home in select mode as one counted move', async () => {
        const m = mount(ACE, SELECT);
        const before = moves(m) ?? 0;
        tap(m, ACE_HEARTS);
        tap(m, ACE_HEARTS, { after: 50 });
        await settle();

        expect(m.store.getState().game.current?.foundations[0]).toEqual([ACE_HEARTS]);
        expect(moves(m)).toBe(before + 1);
        expect(selection(m)).toBeNull();
    });

    it('treats a card that does not fit as two ordinary taps in select mode', async () => {
        const m = mount(STUCK, SELECT);
        const before = m.store.getState().game.current;
        tap(m, EIGHT_HEARTS);
        expect(selection(m)).not.toBeNull();
        tap(m, EIGHT_HEARTS, { after: 50 });
        await settle();

        expect(selection(m)).toBeNull();
        expect(m.store.getState().game.current).toBe(before);
    });

    it('does not send a run home, although its lowest card fits', async () => {
        const THREE_HEARTS = cardId(0, 3);
        const TWO_SPADES = cardId(3, 2);
        const state = makeState({
            tableau: tableauOf(faceUp(THREE_HEARTS, TWO_SPADES)),
            foundations: foundationsOf(2, 0, 0, 0),
            stock: [cardId(0, 13)],
            started: true,
        });
        const m = mount(state, SELECT);
        const before = m.store.getState().game.current;
        tap(m, THREE_HEARTS);
        expect(selection(m)).not.toBeNull();
        tap(m, THREE_HEARTS, { after: 50 });
        await settle();

        expect(selection(m)).toBeNull();
        expect(m.store.getState().game.current).toBe(before);
        expect(moves(m)).toBe(before?.moves);
    });

    it('is two ordinary taps on a foundation top card in select mode', async () => {
        const state = makeState({
            tableau: tableauOf(faceUp(SEVEN_CLUBS)),
            foundations: foundationsOf(1, 0, 0, 0),
            stock: [cardId(0, 13)],
            started: true,
        });
        const m = mount(state, SELECT);
        const before = m.store.getState().game.current;
        tap(m, ACE_HEARTS);
        expect(selection(m)).toEqual({ from: { pile: 'foundation', suit: 0 }, index: 0 });
        tap(m, ACE_HEARTS, { after: 50 });
        await settle();

        expect(selection(m)).toBeNull();
        expect(m.store.getState().game.current).toBe(before);
    });

    it('sends a fitting waste card home in select mode as one counted move', async () => {
        const state = makeState({
            tableau: tableauOf(faceUp(SEVEN_CLUBS)),
            waste: [ACE_HEARTS],
            stock: [cardId(0, 13)],
            started: true,
        });
        const m = mount(state, SELECT);
        const before = moves(m) ?? 0;
        tap(m, ACE_HEARTS);
        tap(m, ACE_HEARTS, { after: 50 });
        await settle();

        const current = m.store.getState().game.current;
        expect(current?.foundations[0]).toEqual([ACE_HEARTS]);
        expect(current?.waste).toEqual([]);
        expect(moves(m)).toBe(before + 1);
        expect(selection(m)).toBeNull();
    });

    it('is ignored in smart mode even with a card picked up', async () => {
        const state = makeState({
            tableau: tableauOf(faceUp(ACE_HEARTS), faceUp(SIX_DIAMONDS)),
            stock: [cardId(0, 13)],
            started: true,
        });
        const m = mount(state);
        act(() => {
            m.store.dispatch(selectCard({ pile: 'tableau', col: 1 }, 0));
        });
        tap(m, ACE_HEARTS);
        expect(selection(m)).toEqual({ from: { pile: 'tableau', col: 0 }, index: 0 });
        tap(m, ACE_HEARTS, { after: 50 });
        await settle();

        expect(column(m, 0)).toEqual([ACE_HEARTS]);
        expect(m.store.getState().game.current?.foundations[0]).toEqual([]);
    });

    it('is a double tap 319 ms after the first release', async () => {
        const m = mount(ACE, SELECT);
        tap(m, ACE_HEARTS);
        tap(m, ACE_HEARTS, { after: 269 });
        await settle();

        expect(m.store.getState().game.current?.foundations[0]).toEqual([ACE_HEARTS]);
    });

    it('is two ordinary taps exactly 320 ms after the first release', async () => {
        const m = mount(ACE, SELECT);
        tap(m, ACE_HEARTS);
        tap(m, ACE_HEARTS, { after: 270 });
        await settle();

        expect(column(m, 0)).toEqual([ACE_HEARTS]);
        expect(selection(m)).toBeNull();
    });

    it('is ignored in smart mode, so a foundation card moved to a column is not sent back', async () => {
        const state = makeState({
            tableau: tableauOf(faceUp(SEVEN_CLUBS)),
            foundations: foundationsOf(6, 0, 0, 0),
            stock: [cardId(0, 13)],
            started: true,
        });
        const m = mount(state);
        tap(m, SIX_HEARTS);
        await settle();
        expect(column(m, 0)).toEqual([SEVEN_CLUBS, SIX_HEARTS]);

        tap(m, SIX_HEARTS, { after: 50 });
        await settle();

        expect(column(m, 0)).toEqual([SEVEN_CLUBS, SIX_HEARTS]);
        expect(m.store.getState().game.current?.foundations[0]).toHaveLength(5);
    });
});

describe('the input gate inside activate', () => {
    it('drops a tap released after the gate closed', async () => {
        const m = mount(ACE, SELECT);
        const from = press(m, ACE_HEARTS, { timeStamp: 100 });
        // Inside one act, so the board's gate-closed feed (a layout effect) has not run yet when the release arrives.
        act(() => {
            m.store.dispatch(busySet(true));
            firePointer(m.board, 'pointerup', { ...from, timeStamp: 150 });
        });
        await settle();

        expect(column(m, 0)).toEqual([ACE_HEARTS]);
        expect(selection(m)).toBeNull();
    });
});

const K_HEARTS = cardId(0, 13);
const K_DIAMONDS = cardId(1, 13);
const K_CLUBS = cardId(2, 13);
const K_SPADES = cardId(3, 13);
const TWO_CLUBS = cardId(2, 2);
const STOCK_OF_FOUR = [K_HEARTS, K_DIAMONDS, K_CLUBS, K_SPADES];
const waste = (m: Mounted) => m.store.getState().game.current?.waste;
const stock = (m: Mounted) => m.store.getState().game.current?.stock;
const notices = (m: Mounted) => m.store.getState().app.notices.map(({ id }) => id);
const announcements = (m: Mounted) => m.store.getState().interaction.announcement.items.map(({ item }) => item);

/** A tap on the stock slot's landing area. */
function tapStockSlot(m: Mounted) {
    const area = m.areas.get('stock');
    if (area === undefined) throw new Error('no stock area');
    tapAt(m, { x: area.x + 10, y: area.y + 10 });
}

describe.each([
    ['smart', {}],
    ['select', SELECT],
] as const)('tapping the stock in %s mode', (_name, options) => {
    it('draws one card in Draw 1 from a tap on a stock card', async () => {
        const m = mount(makeState({ stock: STOCK_OF_FOUR, started: true }), options);
        tap(m, K_SPADES);
        await settle();

        expect(waste(m)).toHaveLength(1);
        expect(stock(m)).toHaveLength(3);
    });

    it('draws one card in Draw 1 from a tap on the stock slot', async () => {
        const m = mount(makeState({ stock: [K_HEARTS], started: true }), options);
        tapStockSlot(m);
        await settle();

        expect(waste(m)).toEqual([K_HEARTS]);
        expect(stock(m)).toEqual([]);
    });

    it('draws three cards in Draw 3 from a tap on a stock card', async () => {
        const m = mount(makeState({ draw: 3, mode: 'draw3', stock: STOCK_OF_FOUR, started: true }), options);
        tap(m, K_SPADES);
        await settle();

        expect(waste(m)).toHaveLength(3);
        expect(stock(m)).toHaveLength(1);
    });

    it('draws three cards in Draw 3 from a tap on the stock slot', async () => {
        const m = mount(
            makeState({ draw: 3, mode: 'draw3', stock: STOCK_OF_FOUR.slice(0, 3), started: true }),
            options,
        );
        tapStockSlot(m);
        await settle();

        expect(waste(m)).toHaveLength(3);
        expect(stock(m)).toEqual([]);
    });

    it('turns the waste over into an empty stock and announces the recycle', async () => {
        const m = mount(makeState({ waste: [TWO_CLUBS, K_HEARTS], started: true }), options);
        tapStockSlot(m);
        await settle();

        expect(stock(m)).toHaveLength(2);
        expect(waste(m)).toEqual([]);
        expect(announcements(m)).toContainEqual({ type: 'recycled' });
        expect(notices(m)).toEqual([]);
    });

    it('refuses a recycle at the Vegas pass limit, raising the notice and leaving the position alone', async () => {
        const m = mount(vegasAtLimit({ waste: [TWO_CLUBS, K_HEARTS], started: true }), options);
        const before = m.store.getState().game.current;
        tapStockSlot(m);
        await settle();

        expect(m.store.getState().game.current).toBe(before);
        expect(notices(m)).toEqual(['no-redeals']);
        expect(refusals(m)).toEqual([{ type: 'refused', reason: 'pass-limit' }]);
    });
});

describe('the stock and a selection', () => {
    const withSelection = (state: GameState) => {
        const m = mount(state, SELECT);
        tap(m, SIX_DIAMONDS);
        expect(selection(m)).not.toBeNull();
        return m;
    };
    const table = { tableau: tableauOf(faceUp(SEVEN_CLUBS), faceUp(SIX_DIAMONDS)), started: true } as const;

    it('is left alone by a refused draw', async () => {
        const m = withSelection(vegasAtLimit({ ...table, waste: [TWO_CLUBS] }));
        tapStockSlot(m);
        await settle();

        expect(notices(m)).toEqual(['no-redeals']);
        expect(selection(m)).toEqual({ from: { pile: 'tableau', col: 1 }, index: 0 });
    });

    it('is cleared by an accepted draw', async () => {
        const m = withSelection(makeState({ ...table, stock: [K_HEARTS] }));
        tapStockSlot(m);
        await settle();

        expect(waste(m)).toEqual([K_HEARTS]);
        expect(selection(m)).toBeNull();
    });
});
