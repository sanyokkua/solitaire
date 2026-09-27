import { act, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createAppStore, type AppStoreOptions } from '../../src/app/store';
import { dealFromSeed } from '../../src/domain/deal';
import { accrued } from '../../src/features/game/gameSlice';
import { undo } from '../../src/features/game/gameThunks';
import { defaultPreferences } from '../../src/features/preferences/preferencesSlice';
import type * as LayoutModule from '../../src/ui/board/layout';
import { Board } from '../../src/ui/board/Board';
import { positions } from '../../src/ui/board/layout';
import { measure, type BoardSize } from '../../src/ui/board/metrics';
import { cardIndex } from '../../src/ui/board/locate';
import { pileKey } from '../../src/ui/board/landing';
import { selectBoardPiles, selectCardLocations } from '../../src/ui/board/selectors';
import { fakeDealService } from '../fixtures/dealService';
import { gameOf, playedGame } from '../fixtures/games';
import { faceUp, makeState, tableauOf } from '../fixtures/states';
import { FakeResizeObserver } from '../support/fakeResizeObserver';
import { restoreMatchMedia, stubMatchMedia } from '../support/matchMedia';

vi.mock('../../src/ui/board/layout', async (importOriginal) => {
    const actual = await importOriginal<typeof LayoutModule>();
    return { ...actual, positions: vi.fn(actual.positions) };
});

/** A stacked table with room for a full deal at a fine or a coarse pointer alike. */
const STACKED: BoardSize = { width: 900, height: 800 };

beforeEach(() => {
    FakeResizeObserver.instances.length = 0;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.mocked(positions).mockClear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    restoreMatchMedia();
});

function renderBoard(preloadedState: AppStoreOptions['preloadedState'] = {}, size: BoardSize | null = STACKED) {
    const store = createAppStore({ preloadedState, deps: { dealService: fakeDealService() } });
    const view = render(
        <Provider store={store}>
            <Board />
        </Provider>,
    );
    const observer = FakeResizeObserver.instances.at(-1);
    if (!observer) throw new Error('no ResizeObserver was created');
    if (size !== null) observer.trigger(size);
    return { store, observer, ...view };
}

const cardNodes = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('[data-card-id]'));
const boardOf = (root: HTMLElement) => {
    const board = root.querySelector<HTMLElement>('.board');
    if (!board) throw new Error('the board is not rendered');
    return board;
};
const styleOf = (el: HTMLElement) => el.getAttribute('style');

/** Replaces the frame clock with a queue the test flushes by hand, one frame at a time. */
function stubFrames() {
    const queue = new Map<number, FrameRequestCallback>();
    let next = 0;
    vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn((callback: FrameRequestCallback) => {
            next += 1;
            queue.set(next, callback);
            return next;
        }),
    );
    vi.stubGlobal(
        'cancelAnimationFrame',
        vi.fn((handle: number) => {
            queue.delete(handle);
        }),
    );
    return {
        pending: () => queue.size,
        flush: () => {
            const callbacks = [...queue.values()];
            queue.clear();
            act(() => {
                for (const callback of callbacks) callback(0);
            });
        },
    };
}

describe('Board', () => {
    it('renders nothing but the empty panel before the first size', () => {
        const { container } = renderBoard({ game: gameOf(dealFromSeed(1, 'draw1')) }, null);

        expect(container.querySelector('.board-panel')).toBeEmptyDOMElement();
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(cardNodes(container)).toHaveLength(0);
    });

    it('renders the slots but no card while there is no game', () => {
        const { container } = renderBoard();

        expect(screen.getAllByRole('button')).toHaveLength(12);
        expect(cardNodes(container)).toHaveLength(0);
        expect(container.querySelector('.stock-count')).toBeNull();
        expect(screen.getByRole('button', { name: 'Stock, empty' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Column 1, empty' })).toBeInTheDocument();
    });

    it('identifies each of the 52 cards by a unique data-card-id in card-id order', () => {
        const { container } = renderBoard({ game: gameOf(dealFromSeed(1, 'draw1')) });

        const ids = cardNodes(container).map((node) => node.dataset.cardId);

        expect(ids).toEqual(Array.from({ length: 52 }, (_, id) => String(id)));
    });

    it('keeps the same 52 nodes, in the same order, across a position change', () => {
        const { container, store } = renderBoard({ game: playedGame() });
        const before = cardNodes(container);
        const stylesBefore = before.map(styleOf);
        expect(before).toHaveLength(52);
        const piles = selectBoardPiles(store.getState());

        act(() => {
            store.dispatch(undo());
        });

        expect(selectBoardPiles(store.getState())).not.toBe(piles);
        const after = cardNodes(container);
        expect(after).toHaveLength(52);
        after.forEach((node, i) => {
            expect(node).toBe(before[i]);
        });
        expect(after.map(styleOf)).not.toEqual(stylesBefore);
    });

    it('tags every card with its pile and index from the deal, and every slot with its pile', () => {
        const deal = dealFromSeed(1, 'draw1');
        const { container } = renderBoard({ game: gameOf(deal) });
        const expected = cardIndex(deal);

        for (const node of cardNodes(container)) {
            const location = expected.get(Number(node.dataset.cardId));
            expect(node.dataset.pile).toBe(location && pileKey(location.from));
            expect(node.dataset.index).toBe(String(location?.index));
        }
        const slots = Array.from(container.querySelectorAll<HTMLElement>('.slot')).map((slot) => slot.dataset.pile);
        expect(slots).toContain('stock');
        expect(slots).toContain('foundation:0');
        expect(slots).toContain('tableau:6');
    });

    it('keeps the card locations, and so every pile and index attribute, on a clock tick', () => {
        const { container, store } = renderBoard({ game: playedGame() });
        const locations = selectCardLocations(store.getState());
        const attributes = () => cardNodes(container).map((node) => [node.dataset.pile, node.dataset.index]);
        const before = attributes();
        expect(locations).not.toBeNull();

        act(() => {
            store.dispatch(accrued({ atMs: 1500, eligible: true }));
        });

        expect(selectCardLocations(store.getState())).toBe(locations);
        expect(attributes()).toEqual(before);
    });

    it('gives the cards new locations when a card changes place', () => {
        const { container, store } = renderBoard({ game: playedGame() });
        const locations = selectCardLocations(store.getState());
        const before = cardNodes(container).map((node) => [node.dataset.pile, node.dataset.index]);

        act(() => {
            store.dispatch(undo());
        });

        expect(selectCardLocations(store.getState())).not.toBe(locations);
        expect(cardNodes(container).map((node) => [node.dataset.pile, node.dataset.index])).not.toEqual(before);
    });

    it('names the slots and shows the stock count of a fresh deal', () => {
        const { container } = renderBoard({ game: gameOf(dealFromSeed(1, 'draw1')) });

        expect(screen.getByRole('button', { name: 'Stock, 24 cards' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Column 1, 1 card' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Column 7, 7 cards' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Hearts foundation, empty' })).toBeInTheDocument();
        expect(container.querySelector('.stock-count')).toHaveTextContent('24');
    });

    it('steps face-up tableau cards further apart under a coarse pointer', () => {
        const state = makeState({ tableau: tableauOf(faceUp(0, 1, 2)) });
        const step = (coarse: boolean): number => {
            stubMatchMedia(coarse ? ['(pointer: coarse)'] : []);
            const { container, unmount } = renderBoard({ game: gameOf(state) });
            const y = (id: number) => {
                const node = cardNodes(container)[id];
                return parseFloat(node?.style.getPropertyValue('--y') ?? 'NaN');
            };
            const result = y(1) - y(0);
            unmount();
            return result;
        };

        expect(measure(STACKED, { coarse: false }).wide).toBe(false);
        expect(measure(STACKED, { coarse: true }).wide).toBe(false);
        const fine = step(false);
        const coarse = step(true);

        expect(fine).toBeGreaterThan(0);
        expect(coarse).toBeGreaterThan(fine);
    });

    it('does not lay the table out again, or restyle a card, on a clock tick', () => {
        const { container, store } = renderBoard({ game: playedGame() });
        const before = store.getState().game.current;
        const stylesBefore = cardNodes(container).map(styleOf);
        const piles = selectBoardPiles(store.getState());
        expect(positions).toHaveBeenCalled();
        vi.mocked(positions).mockClear();

        act(() => {
            store.dispatch(accrued({ atMs: 1500, eligible: true }));
        });

        const after = store.getState().game.current;
        expect(after).not.toBe(before);
        expect(after?.elapsedMs).toBeGreaterThan(before?.elapsedMs ?? 0);
        expect(selectBoardPiles(store.getState())).toBe(piles);
        expect(positions).not.toHaveBeenCalled();
        expect(cardNodes(container).map(styleOf)).toEqual(stylesBefore);
    });

    it('sets --cw, --ch and --cr on the board from the measured metrics', () => {
        const { container } = renderBoard({ game: gameOf(dealFromSeed(1, 'draw1')) });
        const { cw, ch } = measure(STACKED, { coarse: false });
        const board = boardOf(container);

        expect(board.style.getPropertyValue('--cw')).toBe(`${String(cw)}px`);
        expect(board.style.getPropertyValue('--ch')).toBe(`${String(ch)}px`);
        expect(board.style.getPropertyValue('--cr')).toBe(`${String(cw * 0.09)}px`);
        expect(board).toHaveAttribute('data-wide', 'false');
    });

    it('keeps the corner radius at 5 px on a small card and marks the wide table', () => {
        const small: BoardSize = { width: 340, height: 600 };
        const wide: BoardSize = { width: 1400, height: 420 };
        expect(measure(wide, { coarse: false }).wide).toBe(true);

        const narrow = renderBoard({}, small);
        expect(boardOf(narrow.container).style.getPropertyValue('--cr')).toBe('5px');
        narrow.unmount();

        const { container } = renderBoard({}, wide);
        expect(boardOf(container)).toHaveAttribute('data-wide', 'true');
    });
    it('dims the stock slot when an empty stock cannot be recycled', () => {
        const spent = makeState({ mode: 'vegas', scoring: 'vegas', draw: 3, passes: 3, waste: [0] });
        const recyclable = makeState({ waste: [0] });

        const first = renderBoard({ game: gameOf(spent) });
        expect(screen.getByRole('button', { name: 'Stock, empty' })).toHaveClass('is-spent');
        first.unmount();

        renderBoard({ game: gameOf(recyclable) });
        expect(screen.getByRole('button', { name: 'Stock, empty' })).not.toHaveClass('is-spent');
    });

    it('moves the stock slot to the right when the mirror preference is on', () => {
        const game = gameOf(dealFromSeed(1, 'draw1'));
        const stockX = () => parseFloat(screen.getByRole('button', { name: /^Stock/ }).style.getPropertyValue('--x'));

        const left = renderBoard({ game });
        const leftX = stockX();
        left.unmount();

        renderBoard({ game, preferences: { ...defaultPreferences('en'), stockRight: true } });

        expect(stockX()).toBeGreaterThan(leftX);
    });

    describe('Re-layout on viewport change', () => {
        it('applies the first size like a resize: transitions are off for one frame', () => {
            const frames = stubFrames();
            const { container } = renderBoard({ game: playedGame() });

            expect(boardOf(container)).toHaveAttribute('data-resizing', 'true');
            expect(frames.pending()).toBe(1);

            frames.flush();

            expect(boardOf(container)).not.toHaveAttribute('data-resizing');
        });

        it('places the cards again in the same render as a size change, with transitions off for one frame', () => {
            const frames = stubFrames();
            const { container, observer } = renderBoard({ game: playedGame() });
            frames.flush();
            const before = cardNodes(container).map(styleOf);

            observer.trigger({ width: 700, height: 800 });

            expect(boardOf(container)).toHaveAttribute('data-resizing', 'true');
            expect(cardNodes(container).map(styleOf)).not.toEqual(before);

            frames.flush();

            expect(boardOf(container)).not.toHaveAttribute('data-resizing');
        });

        it('ignores a change under 1 px', () => {
            const frames = stubFrames();
            const { container, observer } = renderBoard({ game: playedGame() });
            frames.flush();

            observer.trigger({ width: STACKED.width + 0.4, height: STACKED.height - 0.4 });

            expect(boardOf(container)).not.toHaveAttribute('data-resizing');
            expect(frames.pending()).toBe(0);
        });

        it('cancels the pending frame when the size changes again before it', () => {
            const frames = stubFrames();
            const { container, observer } = renderBoard({ game: playedGame() });

            observer.trigger({ width: 700, height: 800 });

            expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
            expect(frames.pending()).toBe(1);
            frames.flush();
            expect(boardOf(container)).not.toHaveAttribute('data-resizing');
        });
    });
});
