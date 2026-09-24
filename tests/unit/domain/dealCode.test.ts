import { describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../../src/domain/deal';
import { decodeDealCode, encodeDealCode } from '../../../src/domain/dealCode';
import { mulberry32 } from '../../../src/domain/prng';
import type { Mode } from '../../../src/domain/types';
import { DEAL_FIXTURES, GOLDEN_DEAL, deckOrderOf } from '../../fixtures/deals';

const MAX_SEED = 0xffffffff;
const MODE_LETTERS: readonly (readonly [Mode, string])[] = [
    ['draw1', '1'],
    ['draw3', '3'],
    ['vegas', 'V'],
    ['daily', 'D'],
];
const MODES = MODE_LETTERS.map(([mode]) => mode);

function spreadSeeds(count: number): number[] {
    const rng = mulberry32(20240607);
    const seeds = [0, 1, 35, 36, 46655, 46656, 0x7fffffff, 0x80000000, MAX_SEED - 1, MAX_SEED];
    for (let i = 0; i < count; i++) {
        seeds.push(Math.floor(rng() * (MAX_SEED + 1)));
    }
    return seeds;
}

describe('encodeDealCode', () => {
    it.each(MODE_LETTERS)('starts a %s code with its letter %s', (mode, letter) => {
        expect(encodeDealCode(1, mode).startsWith(`${letter}-`)).toBe(true);
    });

    it('writes the letter, a separator and seven upper-case base-36 characters', () => {
        for (const seed of spreadSeeds(50)) {
            for (const mode of MODES) {
                expect(encodeDealCode(seed, mode)).toMatch(/^[13VD]-[0-9A-Z]{7}$/);
            }
        }
    });

    it('left-pads small seeds with zeros', () => {
        expect(encodeDealCode(0, 'draw1')).toBe('1-0000000');
        expect(encodeDealCode(35, 'draw3')).toBe('3-000000Z');
    });

    it('keeps the largest 32-bit seed at exactly seven characters', () => {
        expect(encodeDealCode(MAX_SEED, 'vegas')).toBe('V-1Z141Z3');
    });

    it.each([-1, 2 ** 32, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('throws a RangeError for seed %s', (seed) => {
        expect(() => encodeDealCode(seed, 'draw1')).toThrow(RangeError);
    });
});

describe('decodeDealCode', () => {
    it('round-trips several hundred seeds across the 32-bit range in every mode', () => {
        const seeds = spreadSeeds(250);
        expect(seeds.length).toBeGreaterThan(250);
        for (const seed of seeds) {
            for (const mode of MODES) {
                expect(decodeDealCode(encodeDealCode(seed, mode))).toEqual({ seed, mode });
            }
        }
    });

    it('ignores letter case', () => {
        const expected = { seed: 1234567890, mode: 'vegas' };
        const code = encodeDealCode(expected.seed, 'vegas');
        expect(decodeDealCode(code.toLowerCase())).toEqual(expected);
        expect(decodeDealCode(code.toUpperCase())).toEqual(expected);
        expect(decodeDealCode(`v-${code.slice(2).toLowerCase()}`)).toEqual(expected);
        expect(decodeDealCode(`V-${code.slice(2, 5).toLowerCase()}${code.slice(5)}`)).toEqual(expected);
    });

    it.each(MODE_LETTERS)('accepts a lower-case letter for %s', (mode, letter) => {
        expect(decodeDealCode(`${letter.toLowerCase()}-0000001`)).toEqual({ seed: 1, mode });
    });

    it('ignores surrounding whitespace', () => {
        const expected = { seed: 20240607, mode: 'draw3' };
        const code = encodeDealCode(expected.seed, 'draw3');
        expect(decodeDealCode(`  ${code}  `)).toEqual(expected);
        expect(decodeDealCode(`\n\t ${code.toLowerCase()} \t\n`)).toEqual(expected);
    });

    describe.each([
        ['an unknown mode letter', 'X-0000001'],
        ['a digit that is not a mode letter', '2-0000001'],
        ['a seed section of six characters', '1-000001'],
        ['a seed section of eight characters', '1-00000001'],
        ['a character outside base 36', '1-000000!'],
        ['a non-ASCII character', '1-000000é'],
        ['a long s that upper-cases to ASCII', '1-000000\u017F'],
        ['a Kelvin sign that lower-cases to ASCII', '1-000000\u212A'],
        ['a missing separator', '10000001'],
        ['a wrong separator', '1_0000001'],
        ['an extra separator', '1--0000001'],
        ['a second separator inside the seed', '1-000-001'],
        ['empty input', ''],
        ['whitespace-only input', ' \t\n '],
        ['a seed of 2^32', '1-1Z141Z4'],
        ['the largest seven-character seed', '1-ZZZZZZZ'],
    ])('reports %s as invalid', (_label, code) => {
        it('returns null without throwing', () => {
            expect(() => decodeDealCode(code)).not.toThrow();
            expect(decodeDealCode(code)).toBeNull();
        });
    });
});

describe.each(DEAL_FIXTURES)('$name', ({ seed, mode, code }) => {
    it('encodes to its known code', () => {
        expect(encodeDealCode(seed, mode)).toBe(code);
    });

    it('decodes its code back to the seed and mode', () => {
        expect(decodeDealCode(code)).toEqual({ seed, mode });
    });

    it('reproduces the deal from the code alone', () => {
        const decoded = decodeDealCode(code);
        expect(decoded).not.toBeNull();
        if (decoded === null) return;
        expect(dealFromSeed(decoded.seed, decoded.mode)).toEqual(dealFromSeed(seed, mode));
    });
});

describe('a code and the golden deal', () => {
    it('deals the golden shuffled order from the code alone', () => {
        const decoded = decodeDealCode(encodeDealCode(GOLDEN_DEAL.seed, GOLDEN_DEAL.mode));
        expect(decoded).toEqual({ seed: GOLDEN_DEAL.seed, mode: GOLDEN_DEAL.mode });
        if (decoded === null) return;
        expect(deckOrderOf(dealFromSeed(decoded.seed, decoded.mode))).toEqual(GOLDEN_DEAL.permutation);
    });
});
