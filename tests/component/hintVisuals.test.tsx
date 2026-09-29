// covers: KS-AST-02

import { act } from '@testing-library/react';
import { setRoute } from '../../src/app/appSlice';
import { cardId } from '../../src/domain/cards';
import type { Command, GameState } from '../../src/domain/types';
import type { HintOutcome } from '../../src/features/deal/dealService';
import { announced, hintCleared, hintSet } from '../../src/features/interaction/interactionSlice';
import { requestHint } from '../../src/features/interaction/interactionThunks';
import { selectHint } from '../../src/features/interaction/selectors';
import { Announcer } from '../../src/ui/components/Announcer';
import { GameScreen } from '../../src/ui/screens/GameScreen';
import { RAILS_QUERY } from '../../src/ui/screens/profiles';
import { fakeDealService } from '../fixtures/dealService';
import { oneMovePosition, SEVEN_OF_CLUBS, SIX_OF_DIAMONDS } from '../fixtures/boardPositions';
import { gameOf } from '../fixtures/games';
import { faceUp, makeState, tableauOf } from '../fixtures/states';
import { installBoardHarness, mount, POSITION, press, SIX_DIAMONDS, SIZE } from '../support/boardHarness';
import { FakeResizeObserver } from '../support/fakeResizeObserver';
import { restoreMatchMedia, stubMatchMedia } from '../support/matchMedia';
import { firePointer } from '../support/pointer';
import { renderWithStore } from '../support/renderWithStore';
import { testStore } from '../support/testStore';

installBoardHarness();

afterEach(() => {
    restoreMatchMedia();
    delete document.documentElement.dataset.motion;
});

const ACE_HEARTS = cardId(0, 1);

/** The one move of `oneMovePosition`: the six of diamonds onto the seven of clubs in column 0. */
const SIX_ONTO_SEVEN = { id: 1, kind: 'move', cards: [SIX_OF_DIAMONDS], target: { pile: 'tableau', col: 0 } } as const;
const TO_COLUMN_0: Command = {
    type: 'move',
    from: { pile: 'tableau', col: 1 },
    index: 0,
    to: { pile: 'tableau', col: 0 },
};
const SOLVER_OUTCOME: HintOutcome = {
    status: 'hint',
    source: 'solver',
    hint: { kind: 'move', command: TO_COLUMN_0, cards: [SIX_OF_DIAMONDS] },
};
const HINT_TEXT = 'Hint: move the Six of Diamonds onto column 1';
const TAP_TEXT = 'Tap a card to send it to its best spot · drag to place it yourself';

const hinted = (root: ParentNode) =>
    [...root.querySelectorAll<HTMLElement>('.card.is-hint')].map((el) => Number(el.dataset.cardId));
const hintGhosts = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>('.ghost.is-hint')];
const only = (els: HTMLElement[]): HTMLElement => {
    const [first] = els;
    if (first === undefined) throw new Error('no element');
    return first;
};
const stock = (root: ParentNode) => root.querySelector<HTMLElement>("[data-pile='stock']:not(.card)");
const px = ({ x, y }: { x: number; y: number }) => ({ x: `${String(x)}px`, y: `${String(y)}px` });
const position = (el: HTMLElement) => ({ x: el.style.getPropertyValue('--x'), y: el.style.getPropertyValue('--y') });

describe('hint visuals on the board', () => {
    it('marks every source card of a move and shows one amber ghost on the target column', () => {
        const m = mount(POSITION);
        act(() => {
            m.store.dispatch(
                hintSet({
                    id: 1,
                    kind: 'move',
                    cards: [SIX_DIAMONDS],
                    target: { pile: 'tableau', col: 0 },
                }),
            );
        });

        expect(hinted(m.board)).toEqual([SIX_DIAMONDS]);
        const ghosts = hintGhosts(m.board);
        expect(ghosts).toHaveLength(1);
        expect(position(only(ghosts))).toEqual(px(m.column(0)));
        expect(ghosts[0]?.getAttribute('aria-hidden')).toBe('true');
    });

    it('marks each card of a run', () => {
        const m = mount(POSITION);
        const run = m.store.getState().game.current?.tableau[3]?.map((card) => card.id) ?? [];
        expect(run).toHaveLength(2);
        act(() => {
            m.store.dispatch(hintSet({ id: 1, kind: 'move', cards: run, target: { pile: 'tableau', col: 1 } }));
        });

        expect(hinted(m.board)).toEqual([...run].sort((a, b) => a - b));
        expect(hintGhosts(m.board)).toHaveLength(1);
    });

    it('shows the ghost of a foundation target on its slot', () => {
        const state: GameState = makeState({
            tableau: tableauOf(faceUp(ACE_HEARTS)),
            stock: [cardId(0, 12)],
            started: true,
        });
        const m = mount(state);
        act(() => {
            m.store.dispatch(
                hintSet({ id: 1, kind: 'move', cards: [ACE_HEARTS], target: { pile: 'foundation', suit: 0 } }),
            );
        });

        const area = m.areas.get('foundation:0');
        if (!area) throw new Error('no area');
        const ghosts = hintGhosts(m.board);
        expect(ghosts).toHaveLength(1);
        expect(position(only(ghosts))).toEqual(px(area));
        expect(hinted(m.board)).toEqual([ACE_HEARTS]);
    });

    it.each(['draw', 'recycle'] as const)('pulses the stock for a %s hint and marks no card', (kind) => {
        const m = mount(POSITION);
        expect(stock(m.board)?.classList.contains('is-hint')).toBe(false);
        act(() => {
            m.store.dispatch(hintSet({ id: 1, kind, cards: [], target: 'stock' }));
        });

        expect(stock(m.board)?.classList.contains('is-hint')).toBe(true);
        expect(hinted(m.board)).toEqual([]);
        expect(hintGhosts(m.board)).toEqual([]);
    });

    it('does not mark the stock for a move', () => {
        const m = mount(POSITION);
        act(() => {
            m.store.dispatch(hintSet({ ...SIX_ONTO_SEVEN, cards: [SIX_DIAMONDS] }));
        });
        expect(stock(m.board)?.classList.contains('is-hint')).toBe(false);
    });

    it('clears every mark when the hint is cleared', () => {
        const m = mount(POSITION);
        act(() => {
            m.store.dispatch(
                hintSet({ id: 1, kind: 'move', cards: [SIX_DIAMONDS], target: { pile: 'tableau', col: 0 } }),
            );
        });
        act(() => {
            m.store.dispatch(hintCleared());
        });

        expect(hinted(m.board)).toEqual([]);
        expect(hintGhosts(m.board)).toEqual([]);
    });

    it('still marks the cards, the target and the stock with motion off: the steady outline is the same class', () => {
        document.documentElement.dataset.motion = 'off';
        const m = mount(POSITION);
        act(() => {
            m.store.dispatch(
                hintSet({ id: 1, kind: 'move', cards: [SIX_DIAMONDS], target: { pile: 'tableau', col: 0 } }),
            );
        });
        expect(hinted(m.board)).toEqual([SIX_DIAMONDS]);
        expect(hintGhosts(m.board)).toHaveLength(1);

        act(() => {
            m.store.dispatch(hintSet({ id: 2, kind: 'draw', cards: [], target: 'stock' }));
        });
        expect(stock(m.board)?.classList.contains('is-hint')).toBe(true);
    });

    it('shows the hint ghost with Highlight legal moves off, while legal ghosts stay hidden', () => {
        const m = mount(POSITION, { preferences: { highlight: false } });
        act(() => {
            m.store.dispatch(
                hintSet({ id: 1, kind: 'move', cards: [SIX_DIAMONDS], target: { pile: 'tableau', col: 0 } }),
            );
        });

        expect(m.board.querySelectorAll('.ghost')).toHaveLength(1);
        expect(hintGhosts(m.board)).toHaveLength(1);
    });

    it('leaves the hint ghost out of the drag hot toggle, which marks only the legal ghost under the card', () => {
        const m = mount(POSITION);
        const start = press(m, SIX_DIAMONDS);
        firePointer(m.board, 'pointermove', { clientX: start.clientX + 40, clientY: start.clientY });
        act(() => {
            m.store.dispatch(
                hintSet({ id: 1, kind: 'move', cards: [SIX_DIAMONDS], target: { pile: 'tableau', col: 0 } }),
            );
        });
        const over = m.column(0);
        firePointer(m.board, 'pointermove', { clientX: over.x + 10, clientY: over.y + 10 });

        const hot = [...m.board.querySelectorAll<HTMLElement>('.ghost.is-hot')];
        expect(hot.map((el) => el.dataset.ghost)).toEqual(['tableau:0']);
        const [hint] = hintGhosts(m.board);
        expect(hint?.classList.contains('is-hot')).toBe(false);
        expect(hint?.dataset.ghost).toBeUndefined();
    });

    it('never lights the hint ghost while the card is over empty felt, where no drop target wins', () => {
        const m = mount(POSITION);
        const start = press(m, SIX_DIAMONDS);
        firePointer(m.board, 'pointermove', { clientX: start.clientX + 40, clientY: start.clientY });
        act(() => {
            m.store.dispatch(
                hintSet({ id: 1, kind: 'move', cards: [SIX_DIAMONDS], target: { pile: 'tableau', col: 0 } }),
            );
        });
        firePointer(m.board, 'pointermove', { clientX: m.column(6).x + 10, clientY: m.column(6).y + 10 });

        expect(m.board.querySelectorAll('.ghost.is-hot')).toHaveLength(0);
        expect(only(hintGhosts(m.board)).classList.contains('is-hot')).toBe(false);
    });

    it('clears the hint on a pointer press on the board', () => {
        const m = mount(POSITION);
        act(() => {
            m.store.dispatch(
                hintSet({ id: 1, kind: 'move', cards: [SIX_DIAMONDS], target: { pile: 'tableau', col: 0 } }),
            );
        });
        expect(selectHint(m.store.getState())).not.toBeNull();

        press(m, SIX_DIAMONDS);

        expect(selectHint(m.store.getState())).toBeNull();
        expect(hinted(m.board)).toEqual([]);
    });
});

/** A `GameScreen` on `oneMovePosition` whose `delay` waits until the test elapses it. */
function mountGame(matching: readonly string[] = [], preferences = {}) {
    stubMatchMedia(matching);
    const dealService = fakeDealService();
    const timers: (() => void)[] = [];
    const store = testStore({
        preloadedState: { game: gameOf(oneMovePosition()), preferences },
        deps: {
            dealService,
            delay: () =>
                new Promise<void>((resolve) => {
                    timers.push(resolve);
                }),
        },
    });
    store.dispatch(setRoute('game'));
    // Announcer is mounted by App, outside GameScreen (task 3.5); mount it alongside here so the announcer assertions
    // below still see the same store.
    const view = renderWithStore(
        <>
            <GameScreen />
            <Announcer />
        </>,
        { store },
    );
    FakeResizeObserver.instances.at(-1)?.trigger(SIZE);
    const line = () => view.container.querySelector<HTMLElement>('.game-hint');
    return {
        store,
        dealService,
        container: view.container,
        line,
        elapse: () => {
            for (const resolve of timers) resolve();
        },
    };
}

const announcer = (root: ParentNode) => root.querySelector<HTMLElement>('[aria-live="polite"]');

describe('hint line and the hint request', () => {
    it('shows the tap-mode text without a hint', () => {
        const { line } = mountGame();
        expect(line()).toHaveTextContent(TAP_TEXT);
    });

    it('shows the hint text and returns to the tap-mode text when the hint is cleared', () => {
        const { store, line } = mountGame();
        act(() => {
            store.dispatch(hintSet(SIX_ONTO_SEVEN));
        });
        expect(line()).toHaveTextContent(HINT_TEXT);
        expect(line()).toHaveAttribute('aria-hidden', 'true');

        act(() => {
            store.dispatch(hintCleared(1));
        });
        expect(line()).toHaveTextContent(TAP_TEXT);
    });

    it.each([
        ['draw', 'Hint: draw from the stock'],
        ['recycle', 'Hint: turn the waste back over'],
    ] as const)('reads a %s hint', (kind, text) => {
        const { store, line } = mountGame();
        act(() => {
            store.dispatch(hintSet({ id: 1, kind, cards: [], target: 'stock' }));
        });
        expect(line()).toHaveTextContent(text);
    });

    it('shows a requested hint on the cards, the ghost, the line and the announcer, then returns to the tap-mode text on expiry', async () => {
        const { store, dealService, container, line, elapse } = mountGame();
        dealService.hintOutcome = SOLVER_OUTCOME;

        let done: Promise<void> = Promise.resolve();
        await act(async () => {
            done = store.dispatch(requestHint());
            await Promise.resolve();
            await Promise.resolve();
        });

        await vi.waitFor(() => {
            expect(line()).toHaveTextContent(HINT_TEXT);
        });
        expect(hinted(container)).toEqual([SIX_OF_DIAMONDS]);
        expect(hintGhosts(container)).toHaveLength(1);
        expect(announcer(container)).toHaveTextContent(HINT_TEXT);

        await act(async () => {
            elapse();
            await done;
        });

        expect(line()).toHaveTextContent(TAP_TEXT);
        expect(hinted(container)).toEqual([]);
        expect(hintGhosts(container)).toEqual([]);
    });

    it('still highlights and announces in the side-rails profile, where the line is not displayed', () => {
        const { store, container } = mountGame([RAILS_QUERY]);
        act(() => {
            store.dispatch(hintSet(SIX_ONTO_SEVEN));
            store.dispatch(
                announced([
                    { type: 'hinted', kind: 'move', cards: [SIX_OF_DIAMONDS], target: { pile: 'tableau', col: 0 } },
                ]),
            );
        });

        expect(hinted(container)).toEqual([SIX_OF_DIAMONDS]);
        expect(hintGhosts(container)).toHaveLength(1);
        expect(announcer(container)).toHaveTextContent(HINT_TEXT);
    });

    it('leaves the target card alone: only the moving card pulses', () => {
        const { store, container } = mountGame();
        act(() => {
            store.dispatch(hintSet(SIX_ONTO_SEVEN));
        });
        expect(hinted(container)).not.toContain(SEVEN_OF_CLUBS);
    });
});
