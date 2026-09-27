import { act, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/app/store';
import { accrued } from '../../src/features/game/gameSlice';
import type { Announcement } from '../../src/features/interaction/announcements';
import { announced } from '../../src/features/interaction/interactionSlice';
import { Announcer } from '../../src/ui/components/Announcer';
import { cardId } from '../../src/domain/cards';
import { fakeDealService } from '../fixtures/dealService';
import { playedGame } from '../fixtures/games';

function setup() {
    const store = createAppStore({ preloadedState: { game: playedGame() }, deps: { dealService: fakeDealService() } });
    const view = render(
        <Provider store={store}>
            <Announcer />
        </Provider>,
    );
    return { store, view };
}

function say(store: ReturnType<typeof setup>['store'], ...items: Announcement[]) {
    act(() => {
        store.dispatch(announced(items));
    });
}

const region = () => screen.getByRole('status');
const visible = () => region().textContent.replaceAll('​', '');

const DRAW: Announcement = { type: 'drew', count: 3 };

describe('Announcer', () => {
    it('is one visually hidden polite live region, empty at first', () => {
        setup();
        expect(region()).toHaveAttribute('aria-live', 'polite');
        expect(region()).toHaveClass('sr-only');
        expect(region()).toBeEmptyDOMElement();
    });

    it('A move: reads "<Card> moved to <pile>"', () => {
        const { store } = setup();
        say(store, { type: 'moved', cards: [cardId(2, 7)], from: { pile: 'waste' }, to: { pile: 'tableau', col: 3 } });
        expect(visible()).toBe('Seven of Clubs moved to column 4');
    });

    it('reads every item of a batch, in order, joined with a space', () => {
        const { store } = setup();
        say(store, { type: 'sentHome', count: 4 }, { type: 'won' });
        expect(visible()).toBe('Moved 4 cards to the foundations You win');
    });

    it('speaks the same text twice: one text node whose data alternates while the visible words do not', () => {
        const { store } = setup();
        say(store, DRAW);
        const [node] = region().childNodes;
        const first = node?.nodeValue;
        say(store, DRAW);
        const second = region().firstChild?.nodeValue;
        say(store, DRAW);
        const third = region().firstChild?.nodeValue;

        expect(region().childNodes).toHaveLength(1);
        expect(node?.nodeType).toBe(Node.TEXT_NODE);
        expect(region().firstChild).toBe(node);
        expect(first).not.toBe(second);
        expect(second).not.toBe(third);
        expect(third).toBe(first);
        expect(visible()).toBe('Drew 3 cards');
        expect(region()).toHaveAttribute('aria-atomic', 'true');
    });

    it('Unrelated render: a clock tick leaves the text as it was', () => {
        const { store } = setup();
        say(store, DRAW);
        const before = region().textContent;

        act(() => {
            store.dispatch(accrued({ atMs: 1000, eligible: true }));
            store.dispatch(accrued({ atMs: 1250, eligible: true }));
        });

        expect(region().textContent).toBe(before);
    });

    it('does not replay the log when it mounts again', () => {
        const { store, view } = setup();
        say(store, DRAW);
        view.unmount();

        render(
            <Provider store={store}>
                <Announcer />
            </Provider>,
        );
        expect(region()).toBeEmptyDOMElement();

        say(store, { type: 'undone' });
        expect(visible()).toBe('Undid the last move');
    });
});
