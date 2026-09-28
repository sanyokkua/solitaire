import { act } from '@testing-library/react';
import { cardId } from '../../src/domain/cards';
import type { GameState } from '../../src/domain/types';
import { selectionCleared } from '../../src/features/interaction/interactionSlice';
import { selectCard } from '../../src/features/interaction/interactionThunks';
import {
    FIVE_SPADES,
    POSITION,
    SIX_DIAMONDS,
    SIX_HEARTS,
    mount,
    moveTo,
    press,
    installBoardHarness,
    type Mounted,
} from '../support/boardHarness';
import { firePointer } from '../support/pointer';
import { faceDown, faceUp, makeState, tableauOf } from '../fixtures/states';

installBoardHarness();

const ACE_HEARTS = cardId(0, 1);
const KING_SPADES = cardId(3, 13);
const NINE_CLUBS = cardId(2, 9);

/** An ace that fits its foundation, and a king over a face-down card that fits any empty column. */
const ACE_AND_KING: GameState = makeState({
    tableau: tableauOf(faceUp(ACE_HEARTS), [...faceDown(NINE_CLUBS), ...faceUp(KING_SPADES)]),
    stock: [cardId(0, 12)],
    started: true,
});

const select = (m: Mounted, col: 0 | 1 | 2 | 3 | 4 | 5 | 6, index = 0) => {
    act(() => {
        m.store.dispatch(selectCard({ pile: 'tableau', col }, index));
    });
};

const ghosts = (m: Mounted) => [...m.board.querySelectorAll<HTMLElement>('.ghost')];
const ghostKeys = (m: Mounted) => ghosts(m).map((el) => el.dataset.ghost);
const ghostAt = (m: Mounted, key: string): HTMLElement => {
    const el = ghosts(m).find((ghost) => ghost.dataset.ghost === key);
    if (!el) throw new Error(`no ghost for ${key}`);
    return el;
};
const position = (el: HTMLElement) => ({ x: el.style.getPropertyValue('--x'), y: el.style.getPropertyValue('--y') });
const px = ({ x, y }: { x: number; y: number }) => ({ x: `${String(x)}px`, y: `${String(y)}px` });
const hot = (m: Mounted) => ghosts(m).flatMap((el) => (el.classList.contains('is-hot') ? [el.dataset.ghost] : []));
const selectedIds = (m: Mounted) =>
    [...m.board.querySelectorAll<HTMLElement>('.card.is-selected')].map((el) => Number(el.dataset.cardId));

describe('legal-target ghosts', () => {
    it('shows nothing while nothing is selected', () => {
        expect(ghosts(mount())).toHaveLength(0);
    });

    it('shows a ghost on each legal column, at the position the next card would land', () => {
        const m = mount();
        select(m, 2);

        expect(ghostKeys(m)).toEqual(['tableau:0', 'tableau:1']);
        expect(position(ghostAt(m, 'tableau:0'))).toEqual(px(m.column(0)));
        expect(position(ghostAt(m, 'tableau:1'))).toEqual(px(m.column(1)));
        for (const el of ghosts(m)) {
            expect(el.getAttribute('aria-hidden')).toBe('true');
        }
    });

    it('shows a ghost on the foundation slot', () => {
        const m = mount(ACE_AND_KING);
        select(m, 0);

        expect(ghostKeys(m)).toEqual(['foundation:0']);
        const area = m.areas.get('foundation:0');
        if (!area) throw new Error('no area');
        expect(position(ghostAt(m, 'foundation:0'))).toEqual(px(area));
    });

    it('shows a ghost on an empty column at its slot', () => {
        const m = mount(ACE_AND_KING);
        select(m, 1, 1);

        expect(ghostKeys(m)).toContain('tableau:2');
        expect(position(ghostAt(m, 'tableau:2'))).toEqual(px(m.column(2)));
    });

    it('shows none when Highlight legal moves is off', () => {
        const m = mount(POSITION, { preferences: { highlight: false } });
        select(m, 2);
        expect(ghosts(m)).toHaveLength(0);
    });

    it('leaves with the selection', () => {
        const m = mount();
        select(m, 2);
        expect(ghosts(m)).toHaveLength(2);
        act(() => {
            m.store.dispatch(selectionCleared());
        });
        expect(ghosts(m)).toHaveLength(0);
    });

    it('shows none for a card that cannot go anywhere', () => {
        const m = mount();
        select(m, 0);
        expect(ghosts(m)).toHaveLength(0);
    });
});

describe('the hot ghost', () => {
    it('is the one the dragged card overlaps most, and follows the drag', () => {
        const m = mount();
        const gap = m.column(1).x - m.column(0).x;
        press(m, SIX_DIAMONDS);
        // The move that starts the drag renders the ghosts; the next one marks the hot one.
        moveTo(m, { x: m.origin(SIX_DIAMONDS).x + 20, y: m.origin(SIX_DIAMONDS).y });
        moveTo(m, { x: m.column(0).x + 0.3 * gap, y: m.column(0).y });
        expect(ghostKeys(m)).toEqual(['tableau:0', 'tableau:1']);
        expect(hot(m)).toEqual(['tableau:0']);

        moveTo(m, { x: m.column(0).x + 0.7 * gap, y: m.column(0).y });
        expect(hot(m)).toEqual(['tableau:1']);

        moveTo(m, { x: m.column(0).x + 0.3 * gap, y: m.column(0).y });
        expect(hot(m)).toEqual(['tableau:0']);

        moveTo(m, m.column(6));
        expect(hot(m)).toEqual([]);
    });
});

describe('the selection ring', () => {
    it('rings the selected card only', () => {
        const m = mount();
        select(m, 2);
        expect(selectedIds(m)).toEqual([SIX_DIAMONDS]);
    });

    it('rings every card of a selected run and no other', () => {
        const m = mount();
        select(m, 3);
        expect(selectedIds(m).sort()).toEqual([SIX_HEARTS, FIVE_SPADES].sort());
    });

    it('rings the picked-up run during a drag, and drops the ring with the drag', () => {
        const m = mount();
        press(m, SIX_HEARTS);
        moveTo(m, m.column(1));
        expect(selectedIds(m).sort()).toEqual([SIX_HEARTS, FIVE_SPADES].sort());
        // The ring's re-render must not drop the lift the drag put on the same elements.
        expect(m.board.querySelectorAll('.is-dragging.is-selected')).toHaveLength(2);
        firePointer(m.board, 'pointercancel');
        expect(selectedIds(m)).toEqual([]);
    });
});
