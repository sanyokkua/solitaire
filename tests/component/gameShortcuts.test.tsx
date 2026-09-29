// covers: KS-INP-08

import { act, fireEvent } from '@testing-library/react';
import { dealingProgressed, setRoute, sheetOpened } from '../../src/app/appSlice';
import { dealFromSeed } from '../../src/domain/deal';
import type { GameState } from '../../src/domain/types';
import { busySet, selectCanFinish } from '../../src/features/game/gameSlice';
import { play } from '../../src/features/game/gameThunks';
import { selectionSet } from '../../src/features/interaction/interactionSlice';
import { GameScreen } from '../../src/ui/screens/GameScreen';
import { allFaceUp } from '../fixtures/deals';
import { fakeDealService } from '../fixtures/dealService';
import { oneMovePosition, SIX_OF_DIAMONDS } from '../fixtures/boardPositions';
import { gameOf } from '../fixtures/games';
import { faceDown, faceUp, makeState, tableauOf } from '../fixtures/states';
import { installBoardHarness, SIZE } from '../support/boardHarness';
import { FakeResizeObserver } from '../support/fakeResizeObserver';
import { renderWithStore } from '../support/renderWithStore';
import { testStore } from '../support/testStore';
import { stubElementAnimate, type AnimateStub } from '../support/waapi';

installBoardHarness();

// Finishing wins the game, which starts the win cascade, and jsdom has no Web Animations API.
let waapi: AnimateStub;
beforeEach(() => {
    waapi = stubElementAnimate();
});
afterEach(() => {
    waapi.restore();
});

/** The stock and waste sizes of a position, so a draw is easy to read. */
const piles = (store: ReturnType<typeof mountGame>['store']) => {
    const current = store.getState().game.current;
    return { stock: current?.stock.length, waste: current?.waste.length };
};

function mountGame(state: GameState = oneMovePosition()) {
    const dealService = fakeDealService();
    const store = testStore({ preloadedState: { game: gameOf(state) }, deps: { dealService } });
    store.dispatch(setRoute('game'));
    const view = renderWithStore(<GameScreen />, { store });
    FakeResizeObserver.instances.at(-1)?.trigger(SIZE);
    return { store, dealService, container: view.container };
}

/** Presses a key on `target` (the page by default) and tells whether the default action was prevented. */
function press(key: string, init: KeyboardEventInit = {}, target: Element = document.body): boolean {
    return !fireEvent.keyDown(target, { key, ...init });
}

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe('Space with nothing focused', () => {
    it('draws from the stock', async () => {
        const { store } = mountGame();

        expect(press(' ')).toBe(true);
        await settle();

        expect(piles(store)).toEqual({ stock: 49, waste: 1 });
    });

    it('does not draw when a card is focused: the board handles that key once', async () => {
        const { store, container } = mountGame();
        const card = container.querySelector<HTMLElement>(`[data-card-id='${String(SIX_OF_DIAMONDS)}']`);
        if (card === null) throw new Error('the card is not rendered');
        act(() => {
            card.focus();
        });

        press(' ', {}, card);
        await settle();

        expect(piles(store)).toEqual({ stock: 50, waste: 0 });
        expect(store.getState().game.current?.moves).toBe(1);
    });

    it('does not draw from a focused toolbar button', async () => {
        const { store, container } = mountGame();
        const tool = container.querySelector<HTMLElement>('button.tool');
        if (tool === null) throw new Error('no toolbar button');

        press(' ', {}, tool);
        await settle();

        expect(piles(store)).toEqual({ stock: 50, waste: 0 });
    });
});

describe('Non-Latin layout and held keys', () => {
    it('the physical H key on a Ukrainian layout requests a hint', async () => {
        const { dealService } = mountGame();

        expect(press('р', { code: 'KeyH' })).toBe(true);
        await settle();

        expect(dealService.hintRequests).toHaveLength(1);
    });

    it('a held Space draws once and the repeat is swallowed without scrolling', async () => {
        const { store } = mountGame();

        expect(press(' ')).toBe(true);
        expect(press(' ', { repeat: true })).toBe(true);
        await settle();

        expect(piles(store)).toEqual({ stock: 49, waste: 1 });
    });

    it('a held H requests one hint', async () => {
        const { dealService } = mountGame();

        press('h');
        expect(press('h', { repeat: true })).toBe(true);
        await settle();

        expect(dealService.hintRequests).toHaveLength(1);
    });

    it('a held A finishes once: the repeat is swallowed without scrolling and starts no second Finish', async () => {
        const { store } = mountGame(allFaceUp());

        expect(press('a')).toBe(true);
        expect(press('a', { repeat: true })).toBe(true);
        await settle();

        expect(store.getState().game.current?.status).toBe('won');
    });

    it('a held Ctrl+Z undoes once and does not redo or undo again', async () => {
        const { store } = mountGame();
        await act(() => store.dispatch(play({ type: 'draw' })));
        await act(() => store.dispatch(play({ type: 'draw' })));
        expect(piles(store)).toEqual({ stock: 48, waste: 2 });

        expect(press('z', { ctrlKey: true })).toBe(true);
        expect(press('z', { ctrlKey: true, repeat: true })).toBe(true);

        expect(piles(store)).toEqual({ stock: 49, waste: 1 });
    });
});

describe('Undo and redo', () => {
    it.each([
        ['Ctrl+Z / Ctrl+Shift+Z', { ctrlKey: true }, 'Z', { ctrlKey: true, shiftKey: true }],
        ['Meta+Z / Meta+Shift+Z', { metaKey: true }, 'Z', { metaKey: true, shiftKey: true }],
        ['Ctrl+Z / Ctrl+Y', { ctrlKey: true }, 'y', { ctrlKey: true }],
        ['Meta+Z / Meta+Y', { metaKey: true }, 'y', { metaKey: true }],
    ] as const)('%s undoes and then redoes the last move', async (_name, undoInit, redoKey, redoInit) => {
        const { store } = mountGame();
        await act(() => store.dispatch(play({ type: 'draw' })));
        expect(piles(store)).toEqual({ stock: 49, waste: 1 });

        expect(press('z', undoInit)).toBe(true);
        expect(piles(store)).toEqual({ stock: 50, waste: 0 });

        expect(press(redoKey, redoInit)).toBe(true);
        expect(piles(store)).toEqual({ stock: 49, waste: 1 });
    });

    it('ignores other Ctrl combinations', async () => {
        const { store } = mountGame();
        await act(() => store.dispatch(play({ type: 'draw' })));

        expect(press('x', { ctrlKey: true })).toBe(false);
        expect(press('z', { ctrlKey: true, altKey: true })).toBe(false);

        expect(piles(store)).toEqual({ stock: 49, waste: 1 });
    });
});

describe('Hint', () => {
    it('H requests a hint', async () => {
        const { dealService } = mountGame();

        expect(press('h')).toBe(true);
        await settle();

        expect(dealService.hintRequests).toHaveLength(1);
    });
});

describe('Finish', () => {
    it('A plays the position out when Finish is available', async () => {
        const { store } = mountGame(allFaceUp());
        expect(selectCanFinish(store.getState())).toBe(true);

        expect(press('a')).toBe(true);
        await settle();

        expect(store.getState().game.current?.status).toBe('won');
    });

    it('A does nothing when Finish is not available', async () => {
        const buried = makeState({
            tableau: tableauOf([...faceDown(9), ...faceUp(10)]),
            stock: [11],
            started: true,
        });
        const { store } = mountGame(buried);
        const before = store.getState().game;
        expect(selectCanFinish(store.getState())).toBe(false);

        press('a');
        await settle();

        expect(store.getState().game).toBe(before);
    });
});

describe('Esc', () => {
    it('clears a selection', () => {
        const { store } = mountGame();
        act(() => {
            store.dispatch(selectionSet({ from: { pile: 'tableau', col: 1 }, index: 0 }));
        });

        expect(press('Escape')).toBe(true);

        expect(store.getState().interaction.selection).toBeNull();
    });

    it('does nothing without a selection', () => {
        mountGame();

        expect(press('Escape')).toBe(false);
    });

    it('leaves an Escape another handler already took, such as one that ends a drag', () => {
        const { store } = mountGame();
        act(() => {
            store.dispatch(selectionSet({ from: { pile: 'tableau', col: 1 }, index: 0 }));
        });
        const take = (event: Event): void => {
            event.preventDefault();
        };
        document.addEventListener('keydown', take);

        press('Escape');

        document.removeEventListener('keydown', take);
        expect(store.getState().interaction.selection).not.toBeNull();
    });
});

describe('With a sheet open', () => {
    it('ignores H, Ctrl+Z and Space, and Esc closes the sheet', async () => {
        const { store, dealService } = mountGame();
        await act(() => store.dispatch(play({ type: 'draw' })));
        act(() => {
            store.dispatch(sheetOpened('settings'));
        });

        expect(press('h')).toBe(false);
        expect(press('z', { ctrlKey: true })).toBe(false);
        expect(press(' ')).toBe(false);
        await settle();
        expect(dealService.hintRequests).toHaveLength(0);
        expect(piles(store)).toEqual({ stock: 49, waste: 1 });
        expect(store.getState().app.sheet).toBe('settings');

        expect(press('Escape')).toBe(true);

        expect(store.getState().app.sheet).toBeNull();
    });

    it('leaves the Win sheet open on Escape', () => {
        const { store } = mountGame();
        act(() => {
            store.dispatch(sheetOpened('win'));
        });

        press('Escape');

        expect(store.getState().app.sheet).toBe('win');
    });
});

describe('New deal (N)', () => {
    it('deals a new game at once on an unstarted game', async () => {
        const { store, dealService } = mountGame(dealFromSeed(1, 'draw1'));

        expect(press('n')).toBe(true);
        await settle();

        expect(dealService.requests).toHaveLength(1);
        expect(dealService.requests[0]?.request.mode).toBe('draw1');
        expect(store.getState().app.sheet).toBeNull();
    });

    it('opens the New deal options sheet on a started, unwon game', () => {
        const { store } = mountGame();

        expect(press('n')).toBe(true);

        expect(store.getState().app.sheet).toBe('newDeal');
    });

    it('during the cascade of a won game, before the Win sheet opens, deals a new game at once', async () => {
        const { store, dealService } = mountGame(allFaceUp());
        expect(press('a')).toBe(true);
        await settle();
        expect(store.getState().game.current?.status).toBe('won');
        expect(store.getState().app.sheet).toBeNull();

        expect(press('n')).toBe(true);
        await settle();

        expect(dealService.requests).toHaveLength(1);
        expect(store.getState().app.sheet).toBeNull();
    });

    it('does nothing while a deal is being prepared', () => {
        const { store } = mountGame();
        act(() => {
            store.dispatch(dealingProgressed({ overlay: true, attempt: 1 }));
        });

        expect(press('n')).toBe(false);

        expect(store.getState().app.sheet).toBeNull();
    });

    it('does nothing with a sheet open', () => {
        const { store } = mountGame();
        act(() => {
            store.dispatch(sheetOpened('settings'));
        });

        expect(press('n')).toBe(false);

        expect(store.getState().app.sheet).toBe('settings');
    });

    it('does nothing while a safe-card chain or Finish is running', () => {
        const { store } = mountGame();
        act(() => {
            store.dispatch(busySet(true));
        });

        expect(press('n')).toBe(false);

        expect(store.getState().app.sheet).toBeNull();
    });

    it('a held N is ignored: the repeat is swallowed and opens no second sheet', () => {
        const { store } = mountGame();

        expect(press('n')).toBe(true);
        expect(press('n', { repeat: true })).toBe(true);

        expect(store.getState().app.sheet).toBe('newDeal');
    });

    it('the physical N key on a Ukrainian layout still requests a new deal', () => {
        const { store } = mountGame();

        expect(press('н', { code: 'KeyN' })).toBe(true);

        expect(store.getState().app.sheet).toBe('newDeal');
    });
});

describe('Typing in a text field', () => {
    it('triggers no shortcut', async () => {
        const { store, dealService } = mountGame();
        const input = document.createElement('input');
        document.body.append(input);

        press('h', {}, input);
        press(' ', {}, input);
        press('z', { ctrlKey: true }, input);
        await settle();
        input.remove();

        expect(dealService.hintRequests).toHaveLength(0);
        expect(piles(store)).toEqual({ stock: 50, waste: 0 });
    });
});
