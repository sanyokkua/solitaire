import { describe, expect, it } from 'vitest';
import { isSafe, nextSafeMove } from '../../../src/domain/assist';
import { cardId } from '../../../src/domain/cards';
import type { CardId, Foundations, GameState } from '../../../src/domain/types';
import { deepFreeze, faceDown, faceUp, foundationsOf, makeState } from '../../fixtures/states';

const HEARTS = 0;
const DIAMONDS = 1;
const CLUBS = 2;
const SPADES = 3;

const stateWith = (foundations: Foundations): GameState => deepFreeze(makeState({ foundations }));

describe('isSafe', () => {
    it('treats a ready Ace as safe', () => {
        expect(isSafe(stateWith(foundationsOf(0, 0, 0, 0)), cardId(HEARTS, 1))).toBe(true);
        expect(isSafe(stateWith(foundationsOf(0, 0, 0, 0)), cardId(SPADES, 1))).toBe(true);
    });

    it('treats a ready Two as safe even when every other foundation is empty', () => {
        const state = stateWith(foundationsOf(0, 0, 0, 1));
        expect(isSafe(state, cardId(SPADES, 2))).toBe(true);
        expect(isSafe(stateWith(foundationsOf(1, 0, 0, 0)), cardId(HEARTS, 2))).toBe(true);
    });

    it('rejects a Three while the opposite-colour foundations are low', () => {
        // 3♥ is ready (hearts hold 2) but the black foundations are empty.
        expect(isSafe(stateWith(foundationsOf(2, 0, 0, 0)), cardId(HEARTS, 3))).toBe(false);
        // Both black foundations must reach 2; one is not enough.
        expect(isSafe(stateWith(foundationsOf(2, 0, 2, 1)), cardId(HEARTS, 3))).toBe(false);
        expect(isSafe(stateWith(foundationsOf(2, 0, 2, 2)), cardId(HEARTS, 3))).toBe(true);
    });

    it('accepts a red Five when both black foundations hold at least four', () => {
        expect(isSafe(stateWith(foundationsOf(4, 0, 4, 4)), cardId(HEARTS, 5))).toBe(true);
        expect(isSafe(stateWith(foundationsOf(4, 0, 6, 4)), cardId(HEARTS, 5))).toBe(true);
    });

    it('rejects a red Five when either black foundation holds only three', () => {
        expect(isSafe(stateWith(foundationsOf(4, 0, 3, 4)), cardId(HEARTS, 5))).toBe(false);
        expect(isSafe(stateWith(foundationsOf(4, 0, 4, 3)), cardId(HEARTS, 5))).toBe(false);
        expect(isSafe(stateWith(foundationsOf(4, 0, 3, 3)), cardId(HEARTS, 5))).toBe(false);
    });

    it('ignores the height of the same-colour foundation', () => {
        // Diamonds is empty yet 5♥ is safe: only the black foundations matter.
        expect(isSafe(stateWith(foundationsOf(4, 0, 4, 4)), cardId(HEARTS, 5))).toBe(true);
        // A full diamonds foundation does not rescue 5♥ while clubs holds only three.
        expect(isSafe(stateWith(foundationsOf(4, 13, 3, 4)), cardId(HEARTS, 5))).toBe(false);
    });

    it('needs both opposite-colour foundations to be nearly complete for a King', () => {
        expect(isSafe(stateWith(foundationsOf(12, 0, 12, 12)), cardId(HEARTS, 13))).toBe(true);
        expect(isSafe(stateWith(foundationsOf(12, 0, 12, 11)), cardId(HEARTS, 13))).toBe(false);
    });

    it('judges a black card against the red foundations', () => {
        expect(isSafe(stateWith(foundationsOf(4, 4, 4, 0)), cardId(SPADES, 1))).toBe(true);
        expect(isSafe(stateWith(foundationsOf(4, 4, 4, 4)), cardId(SPADES, 5))).toBe(true);
        expect(isSafe(stateWith(foundationsOf(3, 4, 0, 4)), cardId(CLUBS, 1))).toBe(true);
        expect(isSafe(stateWith(foundationsOf(3, 4, 4, 4)), cardId(CLUBS, 5))).toBe(false);
        expect(isSafe(stateWith(foundationsOf(4, 3, 4, 4)), cardId(CLUBS, 5))).toBe(false);
        expect(isSafe(stateWith(foundationsOf(4, 4, 4, 4)), cardId(CLUBS, 5))).toBe(true);
    });

    it('never treats a card whose foundation is not ready as safe', () => {
        // A Two is only exempt from the opposite-colour test, not from readiness: 2♥ needs the Ace first.
        expect(isSafe(stateWith(foundationsOf(0, 0, 0, 0)), cardId(HEARTS, 2))).toBe(false);
        // 3♥ with an empty hearts foundation.
        expect(isSafe(stateWith(foundationsOf(0, 13, 13, 13)), cardId(HEARTS, 3))).toBe(false);
        // An Ace whose foundation already holds it.
        expect(isSafe(stateWith(foundationsOf(1, 0, 0, 0)), cardId(HEARTS, 1))).toBe(false);
        // A rank already placed.
        expect(isSafe(stateWith(foundationsOf(5, 13, 13, 13)), cardId(HEARTS, 2))).toBe(false);
        // A rank skipping ahead of the foundation.
        expect(isSafe(stateWith(foundationsOf(1, 0, 0, 0)), cardId(HEARTS, 4))).toBe(false);
    });
});

describe('nextSafeMove', () => {
    it('proposes an autoFoundation send of the first safe tableau top', () => {
        const state = deepFreeze(makeState({ tableau: [[], faceUp(cardId(CLUBS, 1)), [], [], [], [], []] }));
        expect(nextSafeMove(state)).toEqual({ type: 'autoFoundation', from: { pile: 'tableau', col: 1 } });
    });

    it('prefers the earlier column when several are safe', () => {
        const state = deepFreeze(
            makeState({
                tableau: [
                    faceUp(cardId(HEARTS, 9)),
                    [],
                    faceUp(cardId(SPADES, 1)),
                    [],
                    faceUp(cardId(HEARTS, 1)),
                    [],
                    [],
                ],
            }),
        );
        expect(nextSafeMove(state)).toEqual({ type: 'autoFoundation', from: { pile: 'tableau', col: 2 } });
    });

    it('scans every column before the waste', () => {
        const state = deepFreeze(
            makeState({
                tableau: [[], [], [], [], [], [], faceUp(cardId(DIAMONDS, 1))],
                waste: [cardId(HEARTS, 1)],
            }),
        );
        expect(nextSafeMove(state)).toEqual({ type: 'autoFoundation', from: { pile: 'tableau', col: 6 } });
    });

    it('falls back to the waste top when only it is safe', () => {
        const state = deepFreeze(
            makeState({
                tableau: [faceUp(cardId(HEARTS, 9)), [], [], [], [], [], []],
                waste: [cardId(SPADES, 9), cardId(SPADES, 1)],
            }),
        );
        expect(nextSafeMove(state)).toEqual({ type: 'autoFoundation', from: { pile: 'waste' } });
    });

    it('ignores a safe card buried under another card', () => {
        const state = deepFreeze(
            makeState({
                tableau: [faceUp(cardId(HEARTS, 1), cardId(SPADES, 9)), [], [], [], [], [], []],
                waste: [cardId(CLUBS, 1), cardId(SPADES, 9)],
            }),
        );
        expect(nextSafeMove(state)).toBeUndefined();
    });

    it('ignores a safe-looking card that is face down', () => {
        const state = deepFreeze(makeState({ tableau: [faceDown(cardId(HEARTS, 1)), [], [], [], [], [], []] }));
        expect(nextSafeMove(state)).toBeUndefined();
    });

    it('returns undefined when nothing is safe', () => {
        expect(nextSafeMove(deepFreeze(makeState()))).toBeUndefined();
        const state = deepFreeze(
            makeState({
                tableau: [faceUp(cardId(HEARTS, 3)), [], [], [], [], [], []],
                waste: [cardId(SPADES, 4)],
                foundations: foundationsOf(2, 0, 0, 0),
            }),
        );
        expect(nextSafeMove(state)).toBeUndefined();
    });

    it('never proposes a foundation card', () => {
        // Foundation tops are not sources, and a card already home is never ready for its own foundation.
        const state = deepFreeze(makeState({ foundations: foundationsOf(1, 1, 1, 1) }));
        expect(nextSafeMove(state)).toBeUndefined();
    });

    it('does not mutate its input', () => {
        const tableau: GameState['tableau'] = [faceUp(cardId(HEARTS, 1)), [], [], [], [], [], []];
        const waste: CardId[] = [cardId(SPADES, 1)];
        const state = deepFreeze(makeState({ tableau, waste }));
        expect(nextSafeMove(state)).toEqual({ type: 'autoFoundation', from: { pile: 'tableau', col: 0 } });
        expect(state.waste).toEqual([cardId(SPADES, 1)]);
    });
});
