import { act, fireEvent } from '@testing-library/react';
import { setRoute, systemMotionChanged } from '../../src/app/appSlice';
import { cardId } from '../../src/domain/cards';
import { dealFromSeed } from '../../src/domain/deal';
import type { GameState } from '../../src/domain/types';
import { cleared, installed } from '../../src/features/game/gameSlice';
import { play } from '../../src/features/game/gameThunks';
import { Board } from '../../src/ui/board/Board';
import { DealtEpochContext, createDealtEpochStore } from '../../src/ui/board/DealtEpochContext';
import { Announcer } from '../../src/ui/components/Announcer';
import { gameOf } from '../fixtures/games';
import { faceUp, foundationsOf, makeState, tableauOf } from '../fixtures/states';
import { installBoardHarness, SIZE } from '../support/boardHarness';
import { FakeResizeObserver } from '../support/fakeResizeObserver';
import { firePointer } from '../support/pointer';
import { renderWithStore } from '../support/renderWithStore';
import { testStore } from '../support/testStore';
import { stubElementAnimate, type AnimateStub } from '../support/waapi';

installBoardHarness();

let waapi: AnimateStub;
beforeEach(() => {
    waapi = stubElementAnimate();
});
afterEach(() => {
    waapi.restore();
});

const KING_OF_HEARTS = cardId(0, 13);
const KING_OF_SPADES = cardId(3, 13);
const ACE_OF_SPADES = cardId(3, 1);
/** The last stagger: 51 cards after the first, 70 ms apart. */
const LAST_DELAY_MS = 51 * 70;

/** Every foundation full but the spades, whose king is alone in column 0: one move wins. */
function nearlyWon(): GameState {
    return makeState({
        started: true,
        tableau: tableauOf(faceUp(KING_OF_SPADES)),
        foundations: foundationsOf(13, 13, 13, 12),
    });
}

const WINNING_MOVE = {
    type: 'move',
    from: { pile: 'tableau', col: 0 },
    index: 0,
    to: { pile: 'foundation', suit: 3 },
} as const;

interface MountOptions {
    readonly game?: GameState;
    readonly strict?: boolean;
    readonly reduced?: boolean;
    /** Provides the deal store, so a new deal animates. */
    readonly deals?: boolean;
}

function mount({ game = nearlyWon(), strict = false, reduced = false, deals = false }: MountOptions = {}) {
    const store = testStore({ preloadedState: { game: gameOf(game) } });
    store.dispatch(setRoute('game'));
    if (reduced) store.dispatch(systemMotionChanged(true));
    const tree = (
        <>
            <Announcer />
            {deals ? (
                <DealtEpochContext.Provider value={createDealtEpochStore()}>
                    <Board />
                </DealtEpochContext.Provider>
            ) : (
                <Board />
            )}
        </>
    );
    const view = renderWithStore(tree, { store, strict });
    const observer = FakeResizeObserver.instances.at(-1);
    if (!observer) throw new Error('no ResizeObserver was created');
    observer.trigger(SIZE);
    const board = view.container.querySelector<HTMLElement>('.board');
    if (!board) throw new Error('the board is not rendered');
    const cardEl = (id: number): HTMLElement => {
        const el = board.querySelector<HTMLElement>(`[data-card-id='${String(id)}']`);
        if (!el) throw new Error(`card ${String(id)} is not rendered`);
        return el;
    };
    const win = () => act(() => store.dispatch(play(WINNING_MOVE)).then(() => undefined));
    return { store, observer, board, cardEl, win, view };
}

const running = () => waapi.calls.filter((call) => !call.cancelled);
const zIndexes = (board: HTMLElement) =>
    Array.from(board.querySelectorAll<HTMLElement>('[data-card-id]')).map((el) => el.style.zIndex);

describe('the win cascade', () => {
    it('starts 52 animations when the game is won, the first on the king of hearts and the last on the ace of spades', async () => {
        const { win } = mount();
        expect(waapi.calls).toHaveLength(0);

        await win();

        expect(waapi.calls).toHaveLength(52);
        const [first, last] = [waapi.calls[0], waapi.calls[51]];
        expect(first?.el).toHaveAttribute('data-card-id', String(KING_OF_HEARTS));
        expect(first?.options.delay).toBe(0);
        expect(last?.el).toHaveAttribute('data-card-id', String(ACE_OF_SPADES));
        expect(last?.options.delay).toBe(LAST_DELAY_MS);
        for (const call of waapi.calls) {
            expect(call.options.fill).toBe('forwards');
            expect(call.keyframes.length).toBeGreaterThan(0);
            for (const frame of call.keyframes) {
                expect(Object.keys(frame)).toEqual(['transform']);
            }
        }
    });

    it('lifts each flying card above the others, later cards higher', async () => {
        const { win, cardEl } = mount();
        await win();

        expect(Number(cardEl(KING_OF_HEARTS).style.zIndex)).toBeGreaterThanOrEqual(2000);
        expect(Number(cardEl(ACE_OF_SPADES).style.zIndex)).toBe(2051);
    });

    // covers: KS-INP-09
    it('ignores a card press and Enter on the board while it runs', async () => {
        const { store, board, cardEl, win } = mount();
        await win();
        const before = store.getState();

        firePointer(cardEl(KING_OF_HEARTS), 'pointerdown', { clientX: 20, clientY: 20 });
        firePointer(board, 'pointermove', { clientX: 300, clientY: 300 });
        firePointer(board, 'pointerup', { clientX: 300, clientY: 300 });
        fireEvent.keyDown(cardEl(KING_OF_HEARTS), { key: 'Enter' });

        expect(store.getState()).toBe(before);
        expect(running()).toHaveLength(52);
    });

    it('is cancelled by a new deal, which gives the cards their own stacking back', async () => {
        const { store, board, win } = mount();
        const resting = zIndexes(board);
        await win();

        act(() => {
            store.dispatch(installed({ state: dealFromSeed(7, 'draw1'), dailyKey: null }));
        });

        expect(waapi.calls).toHaveLength(52);
        expect(running()).toHaveLength(0);
        expect(zIndexes(board).every((z) => Number(z) < 2000)).toBe(true);
        expect(zIndexes(board)).not.toEqual(resting);
    });

    it('is cancelled before the next deal parks the cards at the stock, so the deal starts from the stock', async () => {
        const { store, win } = mount({ deals: true });
        await win();
        const cancelledAtPark: number[] = [];
        const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
            if (this.getAttribute('data-dealing') === 'park')
                cancelledAtPark.push(waapi.calls.filter((c) => c.cancelled).length);
            return new DOMRect();
        });

        act(() => {
            store.dispatch(installed({ state: dealFromSeed(7, 'draw1'), dailyKey: null }));
        });
        rect.mockRestore();

        expect(cancelledAtPark).toEqual([52]);
    });

    it('is cancelled when the game is cleared, and the cards it lifted are restored', async () => {
        const { store, cardEl, win } = mount();
        const king = cardEl(KING_OF_HEARTS);
        const resting = king.style.zIndex;
        await win();
        expect(king.style.zIndex).toBe('2000');

        act(() => {
            store.dispatch(cleared());
        });

        expect(running()).toHaveLength(0);
        expect(king.style.zIndex).toBe(resting);
    });

    it('is cancelled when the board unmounts', async () => {
        const { view, win } = mount();
        await win();

        view.unmount();

        expect(running()).toHaveLength(0);
    });

    it('keeps running through a resize: nothing is cancelled and nothing starts again', async () => {
        const { observer, win } = mount();
        await win();

        observer.trigger({ width: SIZE.width - 120, height: SIZE.height - 90 });

        expect(waapi.calls).toHaveLength(52);
        expect(running()).toHaveLength(52);
    });

    it('plays once under StrictMode', async () => {
        const { win } = mount({ strict: true });

        await win();

        expect(waapi.calls).toHaveLength(52);
        expect(running()).toHaveLength(52);
    });

    it('does not play for a game that is already won when the board mounts', () => {
        mount({ game: { ...nearlyWon(), status: 'won' } });

        expect(waapi.calls).toHaveLength(0);
    });

    it('does not play for a won game mounted under StrictMode', () => {
        mount({ game: { ...nearlyWon(), status: 'won' }, strict: true });

        expect(waapi.calls).toHaveLength(0);
    });

    // covers: KS-SET-04
    it('does not animate with motion off, and the win is announced', async () => {
        const { win } = mount({ reduced: true });

        await win();

        expect(waapi.calls).toHaveLength(0);
        expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain('You win');
    });
});
