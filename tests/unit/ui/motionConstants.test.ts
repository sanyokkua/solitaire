import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEAL_STEP_MS } from '../../../src/ui/board/animations';
import { CARD_RADIUS_FACTOR } from '../../../src/ui/board/constants';

const tokensCss = readFileSync(resolve(import.meta.dirname, '../../../src/ui/styles/tokens.css'), 'utf-8');

function tokenValue(name: string): string {
    const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokensCss);
    if (!match?.[1]) {
        throw new Error(`tokens.css has no --${name} token`);
    }
    return match[1].trim();
}

describe('TypeScript constants that mirror a token', () => {
    it('DEAL_STEP_MS equals --motion-deal-step', () => {
        expect(`${String(DEAL_STEP_MS)}ms`).toBe(tokenValue('motion-deal-step'));
    });

    it('CARD_RADIUS_FACTOR equals --card-radius-factor', () => {
        expect(String(CARD_RADIUS_FACTOR)).toBe(tokenValue('card-radius-factor'));
    });
});
