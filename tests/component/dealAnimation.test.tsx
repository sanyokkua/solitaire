import { act, render } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { systemMotionChanged } from '../../src/app/appSlice';
import { dealFromSeed } from '../../src/domain/deal';
import type { CardId } from '../../src/domain/types';
import { installed } from '../../src/features/game/gameSlice';
import { Board } from '../../src/ui/board/Board';
import { DealtEpochContext, createDealtEpochStore } from '../../src/ui/board/DealtEpochContext';
import { gameOf, playedGame } from '../fixtures/games';
import { FakeResizeObserver } from '../support/fakeResizeObserver';
import { testStore } from '../support/testStore';

/** The step between two cards' delays, the glide start of the last card and the whole deal, in ms. */
const STEP_MS = 28;
const FLIP_LEAD_MS = 200;
const DEAL_TOTAL_MS = 28 * STEP_MS + 600;

/** The tableau cards of a fresh deal, row by row and left to right: the order the deal travels in. */
function dealOrder(seed: number): CardId[] {
    const { tableau } = dealFromSeed(seed, 'draw1');
    const order: CardId[] = [];
    for (let row = 0; row < 7; row++) {
        for (let col = row; col < 7; col++) {
            const card = tableau[col]?.[row];
            if (card) order.push(card.id);
        }
    }
    return order;
}

const cardEl = (root: HTMLElement, id: number): HTMLElement => {
    const el = root.querySelector<HTMLElement>(`[data-card-id='${String(id)}']`);
    if (!el) throw new Error(`card ${String(id)} is not rendered`);
    return el;
};
const boardEl = (root: HTMLElement): HTMLElement => {
    const el = root.querySelector<HTMLElement>('.board');
    if (!el) throw new Error('no board');
    return el;
};
const delayOf = (el: HTMLElement, name: '--d' | '--fd') => el.style.getPropertyValue(name);
const delayed = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLElement>('[data-card-id]')).filter(
        (el) => delayOf(el, '--d') !== '' || delayOf(el, '--fd') !== '',
    );

interface MountOptions {
    readonly game?: ReturnType<typeof gameOf>;
    readonly reduced?: boolean;
    readonly strict?: boolean;
    readonly provider?: boolean;
}

function mount({
    game = gameOf(dealFromSeed(1, 'draw1')),
    reduced = false,
    strict = false,
    provider = true,
}: MountOptions = {}) {
    const store = testStore({ preloadedState: { game } });
    if (reduced) store.dispatch(systemMotionChanged(true));
    const dealt = createDealtEpochStore();
    const tree = (shown: boolean): ReactNode => {
        const board = shown ? <Board /> : null;
        const inner = provider ? <DealtEpochContext.Provider value={dealt}>{board}</DealtEpochContext.Provider> : board;
        const wrapped = <Provider store={store}>{inner}</Provider>;
        return strict ? <StrictMode>{wrapped}</StrictMode> : wrapped;
    };
    const view = render(tree(true));
    const observer = FakeResizeObserver.instances.at(-1);
    if (!observer) throw new Error('no ResizeObserver was created');
    observer.trigger({ width: 900, height: 800 });
    return {
        store,
        dealt,
        container: view.container,
        hide: () => {
            view.rerender(tree(false));
        },
        show: () => {
            view.rerender(tree(true));
            const next = FakeResizeObserver.instances.at(-1);
            if (!next) throw new Error('no ResizeObserver was created');
            next.trigger({ width: 900, height: 800 });
        },
    };
}

const advance = (ms: number) => {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
};

const originalRect = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');

beforeEach(() => {
    FakeResizeObserver.instances.length = 0;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (originalRect) Object.defineProperty(Element.prototype, 'getBoundingClientRect', originalRect);
});

describe('Deal animation', () => {
    it('Fresh deal animates: parked at the reflow, staggered in deal order, cleared after 1384 ms', () => {
        const parkedAtReflow: (string | null)[] = [];
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            configurable: true,
            writable: true,
            value(this: Element) {
                if (this.classList.contains('board')) parkedAtReflow.push(this.getAttribute('data-dealing'));
                return new DOMRect();
            },
        });

        const { container, dealt, store } = mount();

        expect(parkedAtReflow).toContain('park');
        expect(boardEl(container)).not.toHaveAttribute('data-dealing');
        dealOrder(1).forEach((id, k) => {
            const el = cardEl(container, id);
            expect(delayOf(el, '--d')).toBe(`${String(k * STEP_MS)}ms`);
            expect(delayOf(el, '--fd')).toBe(`${String(k * STEP_MS + FLIP_LEAD_MS)}ms`);
        });
        expect(delayed(container)).toHaveLength(28);
        expect(dealt.get()).toBe(store.getState().game.epoch);
        // Only the deal's delays are written: React still owns the positions.
        expect(cardEl(container, dealOrder(1)[0] ?? 0).style.getPropertyValue('--x')).toMatch(/px$/);

        advance(DEAL_TOTAL_MS - 1);
        expect(delayed(container)).toHaveLength(28);
        advance(1);
        expect(delayed(container)).toHaveLength(0);
        expect(dealt.get()).toBe(store.getState().game.epoch);
    });

    it('places the stock anchor on the board for the parked cards', () => {
        const { container } = mount();
        const board = boardEl(container);

        expect(board.style.getPropertyValue('--stock-x')).toMatch(/^-?[\d.]+px$/);
        expect(board.style.getPropertyValue('--stock-y')).toMatch(/^-?[\d.]+px$/);
    });

    it('Restored game does not replay', () => {
        const { container, dealt } = mount({ game: playedGame() });

        expect(delayed(container)).toHaveLength(0);
        expect(boardEl(container)).not.toHaveAttribute('data-dealing');
        expect(dealt.get()).toBeNull();
    });

    it('Returning to an unstarted deal: only the new deal animates', () => {
        const { container, hide, show, store } = mount();
        advance(DEAL_TOTAL_MS);
        expect(delayed(container)).toHaveLength(0);

        hide();
        show();
        expect(delayed(container)).toHaveLength(0);

        act(() => {
            store.dispatch(installed({ state: dealFromSeed(2, 'draw1'), dailyKey: null }));
        });
        expect(delayed(container)).toHaveLength(28);
        dealOrder(2).forEach((id, k) => {
            expect(delayOf(cardEl(container, id), '--d')).toBe(`${String(k * STEP_MS)}ms`);
        });
    });

    it('Interrupted deal restarts cleanly', () => {
        const { container, hide, show, dealt, store } = mount();
        advance(400);
        hide();
        expect(dealt.get()).toBeNull();

        show();
        expect(delayed(container)).toHaveLength(28);
        expect(boardEl(container)).not.toHaveAttribute('data-dealing');
        expect(dealt.get()).toBe(store.getState().game.epoch);

        advance(DEAL_TOTAL_MS);
        expect(delayed(container)).toHaveLength(0);
    });

    it('still animates under StrictMode', () => {
        const { container, dealt, store } = mount({ strict: true });

        expect(delayed(container)).toHaveLength(28);
        expect(boardEl(container)).not.toHaveAttribute('data-dealing');
        expect(dealt.get()).toBe(store.getState().game.epoch);
        advance(DEAL_TOTAL_MS);
        expect(delayed(container)).toHaveLength(0);
    });

    it('Deal without motion: the epoch is claimed and switching motion on never replays', () => {
        const { container, dealt, store } = mount({ reduced: true });

        expect(delayed(container)).toHaveLength(0);
        expect(boardEl(container)).not.toHaveAttribute('data-dealing');
        expect(dealt.get()).toBe(store.getState().game.epoch);

        act(() => {
            store.dispatch(systemMotionChanged(false));
        });
        expect(delayed(container)).toHaveLength(0);
        expect(boardEl(container)).not.toHaveAttribute('data-dealing');
    });

    it('a newer deal mid-animation restarts cleanly', () => {
        const { container, store } = mount();
        advance(500);

        act(() => {
            store.dispatch(installed({ state: dealFromSeed(2, 'draw1'), dailyKey: null }));
        });

        expect(delayed(container)).toHaveLength(28);
        expect(boardEl(container)).not.toHaveAttribute('data-dealing');
        dealOrder(2).forEach((id, k) => {
            expect(delayOf(cardEl(container, id), '--d')).toBe(`${String(k * STEP_MS)}ms`);
        });
        // The old deal's timer is gone: the new deal keeps its delays until its own 1384 ms.
        advance(DEAL_TOTAL_MS - 500 - 1);
        expect(delayed(container)).toHaveLength(28);
        advance(500 + 1);
        expect(delayed(container)).toHaveLength(0);
    });

    it('a resize after the deal has finished does not replay it', () => {
        const { container } = mount();
        advance(DEAL_TOTAL_MS);
        const observer = FakeResizeObserver.instances.at(-1);

        observer?.trigger({ width: 700, height: 700 });

        expect(delayed(container)).toHaveLength(0);
    });

    it('a deal due at the first size still animates: the release leaves no data-resizing behind', () => {
        const { container } = mount();

        expect(boardEl(container)).not.toHaveAttribute('data-resizing');
        expect(boardEl(container)).not.toHaveAttribute('data-dealing');
        expect(delayOf(cardEl(container, dealOrder(1)[1] ?? 0), '--d')).toBe(`${String(STEP_MS)}ms`);
        expect(delayed(container)).toHaveLength(28);
    });

    it('without a provider the board plays no deal', () => {
        const { container } = mount({ provider: false });

        expect(delayed(container)).toHaveLength(0);
        expect(boardEl(container)).not.toHaveAttribute('data-dealing');
    });
});
