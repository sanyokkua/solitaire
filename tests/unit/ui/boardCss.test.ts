import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cardsCss = readFileSync(resolve(import.meta.dirname, '../../../src/ui/styles/cards.css'), 'utf-8');

/** The declaration body of the first rule whose selector list matches `selector`. */
function ruleBody(selector: RegExp): string {
    const rules = cardsCss.matchAll(/([^{}]+)\{([^}]*)\}/g);
    for (const [, selectors, body] of rules) {
        if (selectors && body !== undefined && selector.test(selectors)) {
            return body;
        }
    }
    throw new Error(`cards.css has no rule matching ${String(selector)}`);
}

describe('cards.css', () => {
    it('casts no shadow on a buried card', () => {
        expect(ruleBody(/\.is-buried/)).toMatch(/box-shadow:\s*none/);
    });

    it('sizes the card back checker in px, so it stays the same at every card size', () => {
        const size = /background-size:\s*([^;]+);/.exec(ruleBody(/\.card-back/))?.[1];

        expect(size).toBeDefined();
        expect(size).toMatch(/^\s*\d+px(\s+\d+px)?\s*$/);
    });
});
