import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { setRoute } from '../../src/app/appSlice';
import { createAppStore } from '../../src/app/store';
import { cardId } from '../../src/domain/cards';
import type { CardId, GameState, TableauCol } from '../../src/domain/types';
import { defaultPreferences, type Preferences } from '../../src/features/preferences/preferencesSlice';
import { Board } from '../../src/ui/board/Board';
import { landingAreas, nextLanding } from '../../src/ui/board/landing';
import { positions } from '../../src/ui/board/layout';
import { measure, type BoardSize } from '../../src/ui/board/metrics';
import { fakeDealService } from '../fixtures/dealService';
import { gameOf } from '../fixtures/games';
import { faceDown, faceUp, makeState, tableauOf } from '../fixtures/states';
import { FakeResizeObserver } from './fakeResizeObserver';
import { firePointer, stubPointerCapture, type PointerCaptureStub, type PointerInit } from './pointer';

export const SIZE: BoardSize = { width: 900, height: 800 };
export const METRICS = measure(SIZE, { coarse: false });

export const SEVEN_CLUBS = cardId(2, 7);
export const SEVEN_SPADES = cardId(3, 7);
export const SIX_DIAMONDS = cardId(1, 6);
export const SIX_HEARTS = cardId(0, 6);
export const FIVE_SPADES = cardId(3, 5);
export const QUEEN_HEARTS = cardId(0, 12);
export const JACK_HEARTS = cardId(0, 11);

/**
 * Columns 0 and 1 each end in a black seven and column 2 holds the red six that fits on either. Column 3 holds a
 * run (six of hearts, five of spades) that also fits on either, column 4 a face-down queen under a jack.
 */
export const POSITION: GameState = makeState({
    tableau: tableauOf(
        faceUp(SEVEN_CLUBS),
        faceUp(SEVEN_SPADES),
        faceUp(SIX_DIAMONDS),
        faceUp(SIX_HEARTS, FIVE_SPADES),
        [...faceDown(QUEEN_HEARTS), ...faceUp(JACK_HEARTS)],
    ),
    stock: [cardId(0, 13)],
    started: true,
});

/** What `installBoardHarness` returns. */
export interface BoardHarness {
    /** The recording pointer-capture stub of the running test. */
    readonly capture: PointerCaptureStub;
    /** Swaps the stub for one whose methods throw, as a browser does for an unknown pointer. */
    throwOnCapture(): void;
}

/**
 * Registers the `beforeEach` / `afterEach` every board test needs: the fake `ResizeObserver` and the pointer-capture
 * stubs (jsdom has neither). Call it once at the top of a test file and read `capture` from the result.
 */
export function installBoardHarness(): BoardHarness {
    let current: PointerCaptureStub | undefined;
    beforeEach(() => {
        FakeResizeObserver.instances.length = 0;
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
        current = stubPointerCapture();
    });
    afterEach(() => {
        current?.restore();
        current = undefined;
        vi.unstubAllGlobals();
    });
    return {
        get capture() {
            if (current === undefined) throw new Error('the board harness is only active inside a test');
            return current;
        },
        throwOnCapture() {
            current?.restore();
            current = stubPointerCapture({ throws: true });
        },
    };
}

export interface MountOptions {
    readonly strict?: boolean;
    /** Preferences to change from the defaults, preloaded into the store. */
    readonly preferences?: Partial<Preferences>;
}

export function mount(state: GameState = POSITION, { strict = false, preferences = {} }: MountOptions = {}) {
    const store = createAppStore({
        preloadedState: { game: gameOf(state), preferences: { ...defaultPreferences('en'), ...preferences } },
        deps: { dealService: fakeDealService() },
    });
    store.dispatch(setRoute('game'));
    const tree = (
        <Provider store={store}>
            <Board />
        </Provider>
    );
    const view = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
    const observer = FakeResizeObserver.instances.at(-1);
    if (!observer) throw new Error('no ResizeObserver was created');
    observer.trigger(SIZE);
    const board = view.container.querySelector<HTMLElement>('.board');
    if (!board) throw new Error('the board is not rendered');
    const layout = positions(state, METRICS, { stockRight: false });
    const areas = landingAreas(layout, METRICS, state);
    const cardEl = (id: CardId): HTMLElement => {
        const el = board.querySelector<HTMLElement>(`[data-card-id='${String(id)}']`);
        if (!el) throw new Error(`card ${String(id)} is not rendered`);
        return el;
    };
    const origin = (id: CardId) => {
        const placement = layout.cards.get(id);
        if (!placement) throw new Error(`card ${String(id)} has no placement`);
        return placement;
    };
    const column = (col: TableauCol) => nextLanding(layout, METRICS, state, col);
    return {
        store,
        observer,
        unmount: view.unmount,
        container: view.container,
        board,
        layout,
        areas,
        cardEl,
        origin,
        column,
    };
}

export type Mounted = ReturnType<typeof mount>;

/** Presses the card's top left corner region and returns the press point. */
export function press(m: Mounted, id: CardId, init: PointerInit = {}) {
    const from = m.origin(id);
    const point = { clientX: from.x + 10, clientY: from.y + 10 };
    firePointer(m.cardEl(id), 'pointerdown', { ...point, ...init });
    return point;
}

/** Moves the pointer so the dragged card ends with its top left corner at (`x`, `y`) on the board. */
export function moveTo(m: Mounted, at: { x: number; y: number }, init: PointerInit = {}) {
    firePointer(m.board, 'pointermove', { clientX: at.x + 10, clientY: at.y + 10, ...init });
}

export const release = (m: Mounted, at: { x: number; y: number }, init: PointerInit = {}) => {
    moveTo(m, at, init);
    firePointer(m.board, 'pointerup', { clientX: at.x + 10, clientY: at.y + 10, ...init });
};

/** Lets a `play` in flight settle. */
export const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
