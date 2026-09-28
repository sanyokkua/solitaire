import type { Mode } from './types';

/** A decoded deal code: the seed and mode that reproduce the deal. */
export interface DealCode {
    readonly seed: number;
    readonly mode: Mode;
}

const MAX_SEED = 0xffffffff;
const SEED_LENGTH = 7;

const MODE_LETTERS: Readonly<Record<Mode, string>> = { draw1: '1', draw3: '3', vegas: 'V', daily: 'D' };

const LETTER_MODES: Readonly<Record<string, Mode>> = {
    '1': 'draw1',
    '3': 'draw3',
    V: 'vegas',
    D: 'daily',
};

const CODE_PATTERN = /^([13vd])-([0-9a-z]{7})$/i;

/** Encodes a deal as `<mode letter>-<seed in upper-case base 36, padded to seven characters>`. */
export function encodeDealCode(seed: number, mode: Mode): string {
    if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
        throw new RangeError(`seed ${String(seed)} is not an integer in [0, ${String(MAX_SEED)}]`);
    }
    return `${MODE_LETTERS[mode]}-${seed.toString(36).toUpperCase().padStart(SEED_LENGTH, '0')}`;
}

/** Decodes a deal code, ignoring case and surrounding whitespace. Never throws; returns null when invalid. */
export function decodeDealCode(code: string): DealCode | null {
    const match = CODE_PATTERN.exec(code.trim());
    const letter = match?.[1];
    const digits = match?.[2];
    if (letter === undefined || digits === undefined) return null;
    const mode = LETTER_MODES[letter.toUpperCase()];
    const seed = parseInt(digits, 36);
    if (mode === undefined || seed > MAX_SEED) return null;
    return { seed, mode };
}
