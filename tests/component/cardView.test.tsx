import { render, screen } from '@testing-library/react';
import { cardId } from '../../src/domain/cards';
import { CardView } from '../../src/ui/board/CardView';

const SEVEN_OF_CLUBS = cardId(2, 7);
const QUEEN_OF_HEARTS = cardId(0, 12);
const QUEEN_OF_SPADES = cardId(3, 12);
const VS15 = '︎';

interface Overrides {
    readonly id?: number;
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
    readonly pile?: string;
    readonly index?: number;
    readonly faceUp?: boolean;
    readonly buried?: boolean;
    readonly compact?: boolean;
    readonly selected?: boolean;
    readonly movable?: boolean;
    readonly tabIndex?: number;
}

function renderCard(overrides: Overrides = {}) {
    const props = {
        id: SEVEN_OF_CLUBS,
        x: 10,
        y: 20,
        z: 3,
        pile: 'tableau:2',
        index: 4,
        faceUp: true,
        buried: false,
        compact: false,
        movable: false,
        ...overrides,
    };
    const view = render(<CardView {...props} />);
    const card = view.container.querySelector<HTMLElement>('.card');
    if (!card) {
        throw new Error('CardView rendered no .card element');
    }
    return { ...view, card };
}

describe('CardView', () => {
    it('renders a number card face with both corners and a centre pip', () => {
        const { card } = renderCard();

        const corners = card.querySelectorAll('.corner');
        expect(corners).toHaveLength(2);
        expect(corners[0]).toHaveTextContent(`7♣${VS15}`);
        expect(corners[1]).toHaveClass('corner--br');
        expect(corners[1]).toHaveTextContent(`7♣${VS15}`);
        expect(card.querySelector('.pip')).toHaveTextContent(`♣${VS15}`);
    });

    it('marks every suit glyph with the text variation selector', () => {
        const { card } = renderCard();

        const glyphs = Array.from(card.querySelectorAll('.s, .pip')).map((el) => el.textContent);
        expect(glyphs.length).toBeGreaterThan(0);
        for (const glyph of glyphs) {
            expect(glyph).toContain(VS15);
        }
    });

    it('renders a court card with a boxed letter and no centre suit', () => {
        const { card } = renderCard({ id: QUEEN_OF_HEARTS });

        const box = card.querySelector('.pip--face b');
        expect(box).toHaveTextContent(/^Q$/);
        expect(card.querySelector('.pip--face')?.textContent).not.toContain('♥');
        expect(card.querySelectorAll('.corner')).toHaveLength(2);
    });

    it('carries the selection ring class only when selected', () => {
        expect(renderCard().card).not.toHaveClass('is-selected');
        expect(renderCard({ selected: true }).card).toHaveClass('is-selected');
    });

    it('omits the bottom-right corner when compact', () => {
        const { card } = renderCard({ compact: true });

        expect(card).toHaveClass('is-compact');
        expect(card.querySelector('.corner--br')).toBeNull();
        expect(card.querySelectorAll('.corner')).toHaveLength(1);
    });

    it('names a face-up card by rank and suit', () => {
        renderCard({ id: QUEEN_OF_SPADES });

        expect(screen.getByRole('img', { name: 'Queen of Spades' })).toBeInTheDocument();
    });

    it('exposes a movable card as a button that is not pressed until selected', () => {
        const { card } = renderCard({ movable: true, tabIndex: -1 });

        expect(screen.getByRole('button', { name: 'Seven of Clubs' })).toBe(card);
        expect(card).toHaveAttribute('aria-pressed', 'false');
        expect(card).toHaveAttribute('tabindex', '-1');
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('marks a selected movable card as pressed and passes its tab stop through', () => {
        const { card } = renderCard({ movable: true, selected: true, tabIndex: 0 });

        expect(card).toHaveAttribute('aria-pressed', 'true');
        expect(card).toHaveAttribute('tabindex', '0');
    });

    it('keeps a non-movable card an image with no tab stop or pressed state', () => {
        const { card } = renderCard({ movable: false, tabIndex: 0 });

        expect(screen.getByRole('img', { name: 'Seven of Clubs' })).toBe(card);
        expect(card).not.toHaveAttribute('tabindex');
        expect(card).not.toHaveAttribute('aria-pressed');
    });

    it('exposes a face-down card only as "Face-down card" and hides the face side', () => {
        const { card } = renderCard({ faceUp: false });

        expect(screen.getByRole('img', { name: 'Face-down card' })).toBe(card);
        expect(card).not.toHaveClass('is-up');
        expect(card.querySelector('.card-face')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.queryByRole('img', { name: /of/ })).toBeNull();
    });

    it('hides the face side from assistive technology when face up too', () => {
        const { card } = renderCard();

        expect(card).toHaveClass('is-up');
        expect(card.querySelector('.card-face')).toHaveAttribute('aria-hidden', 'true');
        expect(card.querySelector('.card-back')).toHaveAttribute('aria-hidden', 'true');
    });

    it('carries the buried class only when buried', () => {
        const buried = renderCard({ buried: true });
        expect(buried.card).toHaveClass('is-buried');
        buried.unmount();

        const open = renderCard({ buried: false });
        expect(open.card).not.toHaveClass('is-buried');
    });

    it('exposes the card id, suit and inline placement', () => {
        const { card } = renderCard({ x: 12.5, y: 40, z: 7 });

        expect(card).toHaveAttribute('data-card-id', String(SEVEN_OF_CLUBS));
        expect(card).toHaveAttribute('data-suit', '2');
        expect(card.style.getPropertyValue('--x')).toBe('12.5px');
        expect(card.style.getPropertyValue('--y')).toBe('40px');
        expect(card.style.zIndex).toBe('7');
    });

    it('exposes the pile key and the index within the pile for the pointer', () => {
        const { card } = renderCard({ pile: 'foundation:3', index: 11 });

        expect(card).toHaveAttribute('data-pile', 'foundation:3');
        expect(card).toHaveAttribute('data-index', '11');
    });
});
