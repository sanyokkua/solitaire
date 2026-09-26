import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const STYLES_DIR = resolve(import.meta.dirname, '../../../src/ui/styles');
const cardsCss = readFileSync(resolve(STYLES_DIR, 'cards.css'), 'utf-8');
const boardCss = readFileSync(resolve(STYLES_DIR, 'board.css'), 'utf-8');

/** The declaration body of the first rule of `css` whose selector list matches `selector`. */
function ruleBody(css: string, selector: RegExp): string {
    const rules = css.matchAll(/([^{}]+)\{([^}]*)\}/g);
    for (const [, selectors, body] of rules) {
        if (selectors && body !== undefined && selector.test(selectors)) {
            return body;
        }
    }
    throw new Error(`no rule matching ${String(selector)}`);
}

describe('cards.css', () => {
    it('casts no shadow on a buried card', () => {
        expect(ruleBody(cardsCss, /\.is-buried/)).toMatch(/box-shadow:\s*none/);
    });

    it('sizes the card back checker in px, so it stays the same at every card size', () => {
        const size = /background-size:\s*([^;]+);/.exec(ruleBody(cardsCss, /\.card-back/))?.[1];

        expect(size).toBeDefined();
        expect(size).toMatch(/^\s*\d+px(\s+\d+px)?\s*$/);
    });
});

describe('board.css', () => {
    it('isolates the board panel, so table content stays inside its own stacking context', () => {
        expect(ruleBody(boardCss, /\.board-panel\b/)).toMatch(/isolation:\s*isolate/);
    });
});
