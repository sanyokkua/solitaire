import { afterEach, describe, expect, it, vi } from 'vitest';
import { cryptoSeed, mulberry32 } from '../../../src/domain/prng';

function take(rng: () => number, count: number): number[] {
    return Array.from({ length: count }, () => rng());
}

describe('mulberry32', () => {
    it('matches the reference vector for seed 12345', () => {
        // Seed 12345; values produced by the mockup's mulberry32 (docs/spec/mockup/klondike-mockup.html, D18).
        expect(take(mulberry32(12345), 8)).toEqual([
            0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203, 0.5094283693470061,
            0.34747186047025025, 0.07375754183158278, 0.7663964673411101,
        ]);
    });

    it('matches the reference vector for seed 1', () => {
        // Seed 1; values produced by the mockup's mulberry32 (D18).
        expect(take(mulberry32(1), 3)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
    });

    it('produces the same sequence for the same seed', () => {
        expect(take(mulberry32(987654321), 100)).toEqual(take(mulberry32(987654321), 100));
    });

    it('produces different sequences for different seeds', () => {
        expect(take(mulberry32(1), 8)).not.toEqual(take(mulberry32(2), 8));
    });

    it('keeps every value in [0, 1)', () => {
        const rng = mulberry32(2024);
        for (let i = 0; i < 10_000; i++) {
            const value = rng();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it.each([-1, 1.5, 2 ** 32 + 5, -(2 ** 32) - 7])('normalises seed %s like its unsigned 32-bit residue', (seed) => {
        expect(take(mulberry32(seed), 8)).toEqual(take(mulberry32(seed >>> 0), 8));
    });
});

describe('cryptoSeed', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reads one 32-bit value from the injected source', () => {
        let received: Uint32Array | undefined;
        const seed = cryptoSeed({
            getRandomValues: (array) => {
                received = array;
                array[0] = 0xdeadbeef;
                return array;
            },
        });
        expect(seed).toBe(0xdeadbeef);
        expect(received).toBeInstanceOf(Uint32Array);
        expect(received).toHaveLength(1);
    });

    it('defaults to the global crypto and returns an unsigned 32-bit integer', () => {
        const seed = cryptoSeed();
        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThan(2 ** 32);
    });

    it('throws when no entropy source is available', () => {
        vi.stubGlobal('crypto', undefined);
        expect(() => cryptoSeed()).toThrow();
    });
});
