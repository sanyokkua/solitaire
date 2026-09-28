import { describe, expect, it } from 'vitest';
import { SUITS, TABLEAU_COLS } from '../../../src/domain/cards';

describe('shared domain constants', () => {
    it('lists the seven tableau columns in order', () => {
        expect(TABLEAU_COLS).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('lists the four suits in order', () => {
        expect(SUITS).toEqual([0, 1, 2, 3]);
    });
});
