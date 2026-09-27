import { dealFromSeed } from '../../../../src/domain/deal';
import type { CardId } from '../../../../src/domain/types';
import { cardIndex, type CardLocation } from '../../../../src/ui/board/locate';
import { sameLocations } from '../../../../src/ui/board/selectors';

const CARD: CardLocation = { from: { pile: 'tableau', col: 2 }, index: 1, faceUp: true, movable: true };
const mapOf = (location: CardLocation): ReadonlyMap<CardId, CardLocation> => new Map([[0, location]]);

describe('sameLocations', () => {
    it('is true for the same map, for two nulls and for equal maps built separately', () => {
        const deal = dealFromSeed(1, 'draw1');
        const map = cardIndex(deal);

        expect(sameLocations(map, map)).toBe(true);
        expect(sameLocations(null, null)).toBe(true);
        expect(sameLocations(cardIndex(deal), cardIndex(deal))).toBe(true);
    });

    it('is false when one side is null or the sizes differ', () => {
        expect(sameLocations(mapOf(CARD), null)).toBe(false);
        expect(sameLocations(null, mapOf(CARD))).toBe(false);
        expect(sameLocations(mapOf(CARD), new Map())).toBe(false);
    });

    it('is false when a card has a different pile key, index or movability', () => {
        expect(sameLocations(mapOf(CARD), mapOf({ ...CARD, from: { pile: 'tableau', col: 3 } }))).toBe(false);
        expect(sameLocations(mapOf(CARD), mapOf({ ...CARD, from: { pile: 'foundation', suit: 2 } }))).toBe(false);
        expect(sameLocations(mapOf(CARD), mapOf({ ...CARD, index: 2 }))).toBe(false);
        expect(sameLocations(mapOf(CARD), mapOf({ ...CARD, movable: false }))).toBe(false);
    });

    it('is false when the maps hold different card ids', () => {
        expect(sameLocations(mapOf(CARD), new Map([[1, CARD]]))).toBe(false);
    });

    it('ignores the face, which the layout supplies', () => {
        expect(sameLocations(mapOf(CARD), mapOf({ ...CARD, faceUp: false }))).toBe(true);
    });
});
