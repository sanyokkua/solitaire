import { describe, expect, it } from 'vitest';
import { orderedDeck, shuffle } from '../../../src/domain/deal';
import { mulberry32 } from '../../../src/domain/prng';

describe('shuffle', () => {
    it('is unbiased over the 24 permutations of four items (chi-square, 23 df, p = 0.001)', () => {
        const trials = 60_000;
        const counts = new Map<string, number>();
        for (let i = 0; i < trials; i++) {
            const key = shuffle([0, 1, 2, 3], mulberry32(i + 1)).join(',');
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        expect(counts.size).toBe(24);
        const expected = trials / 24;
        let chiSquare = 0;
        for (const observed of counts.values()) {
            chiSquare += (observed - expected) ** 2 / expected;
        }
        expect(chiSquare).toBeLessThan(49.728);
    });

    it('does not mutate its input and returns a new array', () => {
        const input = [10, 20, 30, 40, 50];
        const snapshot = [...input];
        const result = shuffle(input, mulberry32(7));
        expect(input).toEqual(snapshot);
        expect(result).not.toBe(input);
        expect([...result].sort((a, b) => a - b)).toEqual(snapshot);
    });

    it('shuffles a frozen array', () => {
        const input = Object.freeze([1, 2, 3, 4, 5, 6]);
        const result = shuffle(input, mulberry32(3));
        expect([...result].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('is deterministic for the same seed and varies across seeds', () => {
        const deck = orderedDeck();
        expect(shuffle(deck, mulberry32(42))).toEqual(shuffle(deck, mulberry32(42)));
        expect(shuffle(deck, mulberry32(42))).not.toEqual(shuffle(deck, mulberry32(43)));
    });

    it('returns copies of empty and single-element arrays unchanged', () => {
        const empty: number[] = [];
        const single = [9];
        expect(shuffle(empty, mulberry32(1))).toEqual([]);
        expect(shuffle(empty, mulberry32(1))).not.toBe(empty);
        expect(shuffle(single, mulberry32(1))).toEqual([9]);
        expect(shuffle(single, mulberry32(1))).not.toBe(single);
    });
});

describe('orderedDeck', () => {
    it('lists card ids 0 through 51', () => {
        expect(orderedDeck()).toEqual(Array.from({ length: 52 }, (_, id) => id));
    });

    it('returns a fresh array on each call', () => {
        const first = orderedDeck();
        first[0] = 99;
        expect(orderedDeck()[0]).toBe(0);
        expect(orderedDeck()).not.toBe(orderedDeck());
    });
});
