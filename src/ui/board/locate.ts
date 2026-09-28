import { isMovable } from '../../domain/rules';
import type { CardId, GameState, PileRef, Suit, TableauCol } from '../../domain/types';

/** Where a card sits in a game position and whether the player can pick it up. */
export interface CardLocation {
    /** The pile the card is in. */
    readonly from: PileRef;
    /** The card's position within that pile, lowest card first. */
    readonly index: number;
    /** Whether the card shows its face: always for waste and foundation cards, `up` for tableau cards. */
    readonly faceUp: boolean;
    /** Whether grabbing the card is a legal start of a move (`isMovable` in the domain rules). */
    readonly movable: boolean;
}

/**
 * Maps every card id in the position to its pile, index in that pile, face and movability. The stock is face down and
 * never movable; every other pile defers to `isMovable`, so the rules live only in the domain.
 */
export function cardIndex(state: GameState): ReadonlyMap<CardId, CardLocation> {
    const located = new Map<CardId, CardLocation>();
    const add = (id: CardId, from: PileRef, index: number, faceUp: boolean): void => {
        located.set(id, { from, index, faceUp, movable: isMovable(state, from, index) });
    };

    state.stock.forEach((id, index) => {
        add(id, { pile: 'stock' }, index, false);
    });
    state.waste.forEach((id, index) => {
        add(id, { pile: 'waste' }, index, true);
    });
    state.foundations.forEach((cards, suit) => {
        cards.forEach((id, index) => {
            add(id, { pile: 'foundation', suit: suit as Suit }, index, true);
        });
    });
    state.tableau.forEach((cards, col) => {
        cards.forEach((card, index) => {
            add(card.id, { pile: 'tableau', col: col as TableauCol }, index, card.up);
        });
    });
    return located;
}
