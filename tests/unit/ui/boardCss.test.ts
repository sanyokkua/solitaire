import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ruleBody, stripComments } from '../../support/css';

const STYLES_DIR = resolve(import.meta.dirname, '../../../src/ui/styles');
const cardsCss = readFileSync(resolve(STYLES_DIR, 'cards.css'), 'utf-8');
const boardCss = readFileSync(resolve(STYLES_DIR, 'board.css'), 'utf-8');

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

describe('the card corner mark in cards.css', () => {
    /** The font-size factor of `--cw` a rule sets. */
    const factor = (selector: RegExp): number =>
        Number(/font-size:\s*calc\(var\(--cw\)\s*\*\s*([\d.]+)\)/.exec(ruleBody(cardsCss, selector))?.[1]);

    it('keeps the rank at least 20% larger than the first release (0.15 of the card width)', () => {
        expect(factor(/\.corner \.r\s*$/)).toBeGreaterThanOrEqual(0.15 * 1.2);
    });

    it('keeps the suit glyph at least 20% larger than the first release (0.19 of the card width)', () => {
        expect(factor(/\.corner \.s\s*$/)).toBeGreaterThanOrEqual(0.19 * 1.2);
    });
});

describe('the drag styles in cards.css', () => {
    const dragging = ruleBody(cardsCss, /\.card\.is-dragging\s*$/);

    it('turns the glide off while a card is dragged', () => {
        expect(dragging).toMatch(/transition:\s*none/);
    });

    it('lifts a dragged card above the resting cards with an !important z-index that keeps the run in order', () => {
        expect(dragging).toMatch(/z-index:\s*calc\(var\(--drag-z-base\)\s*\+\s*var\(--k,\s*0\)\)\s*!important/);
    });

    it('offsets the resting position by --dx and --dy', () => {
        expect(dragging).toMatch(
            /transform:\s*translate\(calc\(var\(--x\)\s*\+\s*var\(--dx,\s*0px\)\),\s*calc\(var\(--y\)\s*\+\s*var\(--dy,\s*0px\)\)\)/,
        );
    });
});

describe('board.css', () => {
    // covers: KS-INP-10
    it('keeps the table from scrolling, zooming, selecting text or showing the touch callout', () => {
        const board = ruleBody(boardCss, /\.board\s*$/);

        expect(board).toMatch(/touch-action:\s*none/);
        expect(board).toMatch(/(?<!-webkit-)user-select:\s*none/);
        expect(board).toMatch(/-webkit-user-select:\s*none/);
        expect(board).toMatch(/-webkit-touch-callout:\s*none/);
    });

    it('isolates the board panel, so table content stays inside its own stacking context', () => {
        expect(ruleBody(boardCss, /\.board-panel\b/)).toMatch(/isolation:\s*isolate/);
    });
});

describe('the assistance styles', () => {
    const sheets = [
        ['board.css', stripComments(boardCss)],
        ['cards.css', stripComments(cardsCss)],
    ] as const;

    /** The selector lists of every rule whose body declares `animation: <not none>`. */
    function animatedSelectors(css: string): string[] {
        const out: string[] = [];
        for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            if (selectors && body && /(?<![-\w])animation:\s*(?!none\b)\S/.test(body)) {
                out.push(...selectors.split(',').map((selector) => selector.trim()));
            }
        }
        return out;
    }

    /** The selectors listed in `:root[data-motion='off'] ...` rules whose body says `animation: none`. */
    function neutralisedSelectors(css: string): string[] {
        const out: string[] = [];
        for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            if (selectors && body && /(?<![-\w])animation:\s*none/.test(body)) {
                for (const selector of selectors.split(',')) {
                    const match = /^:root\[data-motion=['"]off['"]\]\s+(.+)$/.exec(selector.trim());
                    if (match?.[1]) out.push(match[1]);
                }
            }
        }
        return out;
    }

    // covers: KS-SET-04
    it.each(sheets)('%s neutralises every animation under :root[data-motion=off]', (_file, css) => {
        const neutralised = neutralisedSelectors(css);
        for (const selector of animatedSelectors(css)) {
            expect(neutralised).toContain(selector);
        }
    });

    it('animates the hint, the ghost hint, the slot hint and the shake', () => {
        const animated = sheets.flatMap(([, css]) => animatedSelectors(css));

        expect(animated).toEqual(
            expect.arrayContaining(['.card.is-hint .card-face', '.card.is-shake', '.ghost.is-hint', '.slot.is-hint']),
        );
    });

    it.each(sheets)('%s has no colour literal', (_file, css) => {
        expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    });

    it('draws the selection ring in the primary colour, outside the card edge', () => {
        const body = ruleBody(cardsCss, /\.card\.is-selected \.card-face\s*$/);

        expect(body).toMatch(/outline:\s*3px solid var\(--color-primary\)/);
        expect(body).toMatch(/outline-offset:\s*1px/);
        expect(body).not.toMatch(/background/);
    });

    it('draws the hint ring in the hint-line colour', () => {
        expect(ruleBody(cardsCss, /\.card\.is-hint \.card-face\s*$/)).toMatch(
            /outline:\s*3px solid var\(--color-hint-line\)/,
        );
    });

    it('lifts a dragged card with --shadow-card, after the buried rule so it wins', () => {
        const body = ruleBody(cardsCss, /\.card\.is-dragging \.card-face\s*$/);

        expect(body).toMatch(/box-shadow:\s*var\(--shadow-card\),\s*var\(--shadow-card\)/);
        expect(cardsCss.indexOf('.card.is-dragging .card-face')).toBeGreaterThan(
            cardsCss.indexOf('.card.is-buried .card-side'),
        );
    });

    it('shakes on the translate property, so it composes with the transform', () => {
        const keyframes = /@keyframes shake\s*\{([\s\S]*?\n\})/.exec(cardsCss)?.[1] ?? '';

        expect(keyframes).toMatch(/translate:/);
        expect(keyframes).not.toMatch(/(?<![-\w])transform:/);
    });

    it('keeps the ghost below the last tableau card and the hot ghost above the resting cards', () => {
        const ghost = ruleBody(boardCss, /\.ghost\s*$/);
        const hot = ruleBody(boardCss, /\.ghost\.is-hot\s*$/);

        expect(ghost).toMatch(/pointer-events:\s*none/);
        expect(ghost).toMatch(/z-index:\s*250\b/);
        expect(hot).toMatch(/z-index:\s*1500\b/);
    });

    // covers: KS-A11Y-03
    it('draws the focus ring of a card as a pseudo-element, so the selection outline on the face stays free', () => {
        expect(ruleBody(cardsCss, /\.board \.card:focus-visible\s*$/)).toMatch(/outline:\s*none/);
        const ring = ruleBody(cardsCss, /\.board \.card:focus-visible::after\s*$/);

        expect(ring).toMatch(/content:\s*''/);
        expect(ring).toMatch(/border:\s*3px solid var\(--color-focus\)/);
        expect(ring).toMatch(/inset:\s*-8px/);
        expect(ring).toMatch(/border-radius:\s*calc\(var\(--cr\)\s*\+\s*7px\)/);
        expect(ring).toMatch(/pointer-events:\s*none/);
    });

    // covers: KS-A11Y-03
    it('draws the focus ring of a slot as an outline in the focus colour', () => {
        const body = ruleBody(boardCss, /\.board \.slot:focus-visible\s*$/);

        expect(body).toMatch(/outline:\s*3px solid var\(--color-focus\)/);
        expect(body).toMatch(/outline-offset:\s*3px/);
    });

    it('never puts the focus ring on the card face, which carries the selection outline', () => {
        expect(cardsCss).not.toMatch(/:focus-visible[^{]*\.card-(face|side)/);
    });
});
