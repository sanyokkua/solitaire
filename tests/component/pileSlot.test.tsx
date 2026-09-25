import { render, screen } from '@testing-library/react';
import { cardId } from '../../src/domain/cards';
import { canRecycle } from '../../src/domain/rules';
import { PileSlot, type SlotPile } from '../../src/ui/board/PileSlot';
import { StockBadge } from '../../src/ui/board/StockBadge';
import { makeState, vegasAtLimit } from '../fixtures/states';

const VS15 = '︎';
const STOCK: SlotPile = { pile: 'stock' };
const SPADES_FOUNDATION: SlotPile = { pile: 'foundation', suit: 3 };
const HEARTS_FOUNDATION: SlotPile = { pile: 'foundation', suit: 0 };
const SEVEN_OF_CLUBS = cardId(2, 7);

function renderSlot(pile: SlotPile, count: number, spent = false) {
    render(<PileSlot pile={pile} count={count} x={10} y={20} spent={spent} />);
}

describe('PileSlot', () => {
    it('shows a faint "A" and the suit symbol on an empty foundation', () => {
        renderSlot(SPADES_FOUNDATION, 0);

        const slot = screen.getByRole('group', { name: 'Spades foundation, empty' });
        expect(slot).toHaveClass('slot', 'slot--found');
        expect(slot).toHaveTextContent(`A♠${VS15}`);
        expect(slot.querySelector('.r')).toHaveTextContent('A');
    });

    it('shows a faint "K" on an empty column', () => {
        renderSlot({ pile: 'tableau', col: 2 }, 0);

        const slot = screen.getByRole('group', { name: 'Column 3, empty' });
        expect(slot).toHaveClass('slot', 'slot--tab');
        expect(slot).toHaveTextContent('K');
    });

    it('positions the slot with the --x and --y custom properties and hides its children', () => {
        renderSlot(STOCK, 3);

        const slot = screen.getByRole('group', { name: 'Stock, 3 cards' });
        expect(slot.style.getPropertyValue('--x')).toBe('10px');
        expect(slot.style.getPropertyValue('--y')).toBe('20px');
        expect(slot).toHaveClass('slot--stock');
        for (const child of Array.from(slot.children)) {
            expect(child).toHaveAttribute('aria-hidden', 'true');
        }
    });

    it('names each slot by its pile and card count', () => {
        renderSlot(STOCK, 18);
        renderSlot({ pile: 'tableau', col: 3 }, 1);
        renderSlot(HEARTS_FOUNDATION, 2);

        expect(screen.getByRole('group', { name: 'Stock, 18 cards' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Column 4, 1 card' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Hearts foundation, 2 cards' })).toBeInTheDocument();
    });

    it('dims a spent Vegas stock and shows no badge', () => {
        const state = vegasAtLimit({ stock: [], waste: [SEVEN_OF_CLUBS] });
        const spent = !canRecycle(state);
        renderSlot(STOCK, state.stock.length, spent);
        render(<StockBadge count={state.stock.length} x={5} y={6} />);

        const slot = screen.getByRole('group', { name: 'Stock, empty' });
        expect(spent).toBe(true);
        expect(slot).toHaveClass('is-spent');
        expect(slot.querySelector('svg')).not.toBeNull();
        expect(document.querySelector('.stock-count')).toBeNull();
    });

    it('shows the recycle mark at full strength on a recyclable Draw 1 stock', () => {
        const state = makeState({ draw: 1, stock: [], waste: [SEVEN_OF_CLUBS] });
        const spent = !canRecycle(state);
        renderSlot(STOCK, state.stock.length, spent);

        const slot = screen.getByRole('group', { name: 'Stock, empty' });
        expect(spent).toBe(false);
        expect(slot).not.toHaveClass('is-spent');
        expect(slot.querySelector('svg')).not.toBeNull();
    });
});

describe('StockBadge', () => {
    it('shows the number of cards left in the stock, hidden from assistive technology', () => {
        render(<StockBadge count={18} x={30} y={40} />);

        const badge = screen.getByText('18');
        expect(badge).toHaveClass('stock-count');
        expect(badge).toHaveAttribute('aria-hidden', 'true');
        expect(badge.style.getPropertyValue('--x')).toBe('30px');
        expect(badge.style.getPropertyValue('--y')).toBe('40px');
        expect(badge.style.zIndex).toBe('400');
    });

    it('renders nothing while the stock is empty', () => {
        const { container } = render(<StockBadge count={0} x={30} y={40} />);

        expect(container).toBeEmptyDOMElement();
    });
});
