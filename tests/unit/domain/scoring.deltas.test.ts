import { describe, expect, it } from 'vitest';
import { applyDelta, commandDelta, eventDelta, startingScore } from '../../../src/domain/scoring';
import type { GameEvent, PileRef } from '../../../src/domain/types';

const WASTE: PileRef = { pile: 'waste' };
const FOUNDATION: PileRef = { pile: 'foundation', suit: 0 };
const TABLEAU: PileRef = { pile: 'tableau', col: 3 };

function moved(from: PileRef, to: PileRef, count = 1): GameEvent {
    return { type: 'moved', cards: Array.from({ length: count }, (_, i) => i), from, to };
}

function recycled(pass: number): GameEvent {
    return { type: 'recycled', pass };
}

const FLIPPED: GameEvent = { type: 'flipped', card: 7 };

describe('startingScore', () => {
    it('starts a standard game at zero', () => {
        expect(startingScore('standard')).toBe(0);
    });

    it('starts a vegas game with the 52-dollar buy-in already deducted', () => {
        expect(startingScore('vegas')).toBe(-52);
    });
});

describe('eventDelta', () => {
    it.each<[string, GameEvent, number]>([
        ['waste to tableau', moved(WASTE, TABLEAU), 5],
        ['waste to foundation', moved(WASTE, FOUNDATION), 10],
        ['tableau to foundation', moved(TABLEAU, FOUNDATION), 10],
        ['a card turned face up', FLIPPED, 5],
        ['foundation to tableau', moved(FOUNDATION, TABLEAU), -15],
        ['tableau to tableau', moved(TABLEAU, { pile: 'tableau', col: 5 }, 3), 0],
        ['a draw', { type: 'drew', count: 3 }, 0],
        ['a refusal', { type: 'rejected', reason: 'illegal-target' }, 0],
        ['a win', { type: 'won' }, 0],
    ])('scores %s under standard rules', (_name, event, expected) => {
        expect(eventDelta(event, 'standard', 1)).toBe(expected);
        expect(eventDelta(event, 'standard', 3)).toBe(expected);
    });

    it.each([2, 3, 4, 10])('deducts 100 for the recycle beginning pass %i in a standard draw-1 game', (pass) => {
        expect(eventDelta(recycled(pass), 'standard', 1)).toBe(-100);
    });

    it.each<[number, number]>([
        [2, 0],
        [3, 0],
        [4, -20],
        [5, -20],
    ])('deducts the standard draw-3 recycle beginning pass %i by %i', (pass, expected) => {
        expect(eventDelta(recycled(pass), 'standard', 3)).toBe(expected);
    });

    it('gains 5 for each card placed on a foundation under vegas rules', () => {
        expect(eventDelta(moved(WASTE, FOUNDATION), 'vegas', 1)).toBe(5);
        expect(eventDelta(moved(TABLEAU, FOUNDATION), 'vegas', 3)).toBe(5);
        expect(eventDelta(moved(TABLEAU, FOUNDATION, 2), 'vegas', 1)).toBe(10);
    });

    it('loses 5 for each card taken off a foundation under vegas rules', () => {
        expect(eventDelta(moved(FOUNDATION, TABLEAU), 'vegas', 1)).toBe(-5);
        expect(eventDelta(moved(FOUNDATION, TABLEAU, 2), 'vegas', 3)).toBe(-10);
    });

    it.each<[string, GameEvent]>([
        ['a card turned face up', FLIPPED],
        ['tableau to tableau', moved(TABLEAU, { pile: 'tableau', col: 5 })],
        ['waste to tableau', moved(WASTE, TABLEAU)],
        ['a recycle', recycled(4)],
        ['a draw', { type: 'drew', count: 1 }],
        ['a refusal', { type: 'rejected', reason: 'not-movable' }],
        ['a win', { type: 'won' }],
    ])('leaves the vegas bankroll unchanged by %s', (_name, event) => {
        expect(eventDelta(event, 'vegas', 1)).toBe(0);
        expect(eventDelta(event, 'vegas', 3)).toBe(0);
    });
});

describe('commandDelta', () => {
    it('sums a foundation move that reveals a card to 15 under standard rules', () => {
        expect(commandDelta([moved(TABLEAU, FOUNDATION), FLIPPED], 'standard', 1)).toBe(15);
    });

    it('is zero for a command that produced no events', () => {
        expect(commandDelta([], 'standard', 1)).toBe(0);
        expect(commandDelta([], 'vegas', 3)).toBe(0);
    });

    it('scores only the foundation part of the same events under vegas rules', () => {
        expect(commandDelta([moved(TABLEAU, FOUNDATION), FLIPPED], 'vegas', 1)).toBe(5);
    });
});

describe('applyDelta', () => {
    it('floors a standard score at zero', () => {
        expect(applyDelta(30, -100, 'standard')).toBe(0);
    });

    it('adds a positive standard delta', () => {
        expect(applyDelta(30, 5, 'standard')).toBe(35);
    });

    it('never floors a vegas bankroll', () => {
        expect(applyDelta(-52, -5, 'vegas')).toBe(-57);
    });

    it('adds a positive delta to a negative vegas bankroll', () => {
        expect(applyDelta(-52, 5, 'vegas')).toBe(-47);
    });
});
