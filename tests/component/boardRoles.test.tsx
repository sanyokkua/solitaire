import { act, screen } from '@testing-library/react';
import { selectCard } from '../../src/features/interaction/interactionThunks';
import { POSITION, QUEEN_HEARTS, SEVEN_CLUBS, installBoardHarness, mount } from '../support/boardHarness';
import { faceUp, makeState, tableauOf } from '../fixtures/states';

installBoardHarness();

/** A seven under a queen it cannot carry: the seven starts no run, so only the queen can be picked up. */
const BROKEN_RUN = makeState({ tableau: tableauOf(faceUp(SEVEN_CLUBS, QUEEN_HEARTS)), started: true });

describe('Board roles for assistive technology', () => {
    it('makes a face-up card that can move a button that is not pressed', () => {
        mount(POSITION);

        const seven = screen.getByRole('button', { name: 'Seven of Clubs' });
        expect(seven).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'Jack of Hearts' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('presses the button of every card in a selected run', () => {
        const m = mount(POSITION);

        act(() => {
            m.store.dispatch(selectCard({ pile: 'tableau', col: 3 }, 0));
        });

        expect(screen.getByRole('button', { name: 'Six of Hearts' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Five of Spades' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Seven of Spades' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('keeps a face-down card an image that cannot take focus', () => {
        const m = mount(POSITION);

        const card = m.cardEl(QUEEN_HEARTS);
        expect(screen.getAllByRole('img', { name: 'Face-down card' })).toContain(card);
        expect(card).not.toHaveAttribute('tabindex');
        expect(card).not.toHaveAttribute('aria-pressed');
        expect(screen.queryByRole('button', { name: 'Face-down card' })).toBeNull();
    });

    it('keeps a face-up card that cannot move an image that cannot take focus', () => {
        const m = mount(BROKEN_RUN);

        const seven = screen.getByRole('img', { name: 'Seven of Clubs' });
        expect(seven).toBe(m.cardEl(SEVEN_CLUBS));
        expect(seven).not.toHaveAttribute('tabindex');
        expect(screen.getByRole('button', { name: 'Queen of Hearts' })).toBeInTheDocument();
    });

    it('makes the stock and every empty pile a button and a filled pile a group', () => {
        mount(POSITION);

        expect(screen.getByRole('button', { name: /^Stock,/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Column 6, empty' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Hearts foundation, empty' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Column 1, 1 card' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Column 5, 2 cards' })).toBeInTheDocument();
    });

    it('gives exactly one element on the board a tab stop of 0', () => {
        const m = mount(POSITION);

        expect(m.board.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
        expect(m.board.querySelector('[tabindex="0"]')).toBe(screen.getByRole('button', { name: /^Stock,/ }));
    });
});
