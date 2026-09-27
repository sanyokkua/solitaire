import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAILS_QUERY } from '../../../src/ui/screens/profiles';
import { RAILS_MAX_HEIGHT } from '../../fixtures/viewports';

const STYLES_DIR = resolve(import.meta.dirname, '../../../src/ui/styles');
// Comments are stripped so a rule's selector never includes the comment above it.
const layoutCss = readFileSync(resolve(STYLES_DIR, 'layout.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
const globalCss = readFileSync(resolve(STYLES_DIR, 'global.css'), 'utf-8');

const INSETS = ['top', 'right', 'bottom', 'left'] as const;

/** The text between the braces that follow `header` in `css`, nested braces included; throws when absent. */
function blockAfter(css: string, header: string): string {
    const start = css.indexOf(header);
    if (start === -1) throw new Error(`layout.css has no "${header}"`);
    const open = css.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
        if (css[i] === '{') depth += 1;
        if (css[i] === '}') depth -= 1;
        if (depth === 0) return css.slice(open + 1, i);
    }
    throw new Error(`layout.css has an unclosed block after "${header}"`);
}

/** The declaration bodies of every rule in `css` whose selector list contains exactly `selector`. */
function rulesFor(css: string, selector: string): string[] {
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selectors, body]) =>
        selectors !== undefined &&
        body !== undefined &&
        selectors
            .split(',')
            .map((s) => s.trim())
            .includes(selector)
            ? [body]
            : [],
    );
}

const railsBlock = blockAfter(layoutCss, `@media ${RAILS_QUERY}`);

function expectsAllInsets(declaration: string): void {
    for (const edge of INSETS) {
        expect(declaration).toContain(`env(safe-area-inset-${edge}`);
    }
}

describe('layout.css', () => {
    it('is imported by global.css', () => {
        expect(globalCss).toMatch(/@import\s+['"]\.\/layout\.css['"]/);
    });

    it('pads the Game frame by all four safe-area insets, in every rule that sets its padding', () => {
        const paddings = rulesFor(layoutCss, '.screen--game').flatMap((body) => {
            const values = [...body.matchAll(/padding[a-z-]*:\s*([^;]+);/g)].map((match) => match[1] ?? '');
            return values;
        });

        expect(paddings.length).toBeGreaterThan(0);
        for (const padding of paddings) expectsAllInsets(padding);
    });

    it('keeps every safe-area inset in the side-rails profile', () => {
        // The frame's padding is shared: the rails rule may restate it but never with fewer edges.
        for (const body of rulesFor(railsBlock, '.screen--game')) {
            const padding = /padding:\s*([^;]+);/.exec(body)?.[1];
            if (padding !== undefined) expectsAllInsets(padding);
            expect(body).not.toMatch(/padding-(?:top|right|bottom|left)\s*:/);
        }
        expect(rulesFor(railsBlock, '.game-body').join(' ')).not.toMatch(/env\(/);
    });

    it('keeps the rails height limit of the viewport fixture in step with RAILS_QUERY', () => {
        expect(RAILS_QUERY).toContain(`max-height: ${String(RAILS_MAX_HEIGHT)}px`);
    });

    it('states the rails condition of the shared RAILS_QUERY constant literally', () => {
        expect(layoutCss).toContain(`@media ${RAILS_QUERY}`);
    });

    it('fills the dynamic viewport height without scrolling', () => {
        const frame = rulesFor(layoutCss, '.screen--game').join(' ');

        expect(frame).toMatch(/height:\s*100dvh/);
        expect(frame).toMatch(/overflow:\s*hidden/);
    });

    it('caps the stacked profile at 64rem', () => {
        expect(rulesFor(layoutCss, '.game-body').join(' ')).toMatch(/width:\s*min\(100%,\s*64rem\)/);
    });

    it('hides the top bar, hint line and footer in the rails, and the footer at 480px wide or narrower', () => {
        const hidden = rulesFor(railsBlock, '.game-topbar').join(' ');
        expect(hidden).toMatch(/display:\s*none/);
        expect(rulesFor(railsBlock, '.game-hint').join(' ')).toMatch(/display:\s*none/);
        expect(rulesFor(railsBlock, '.game-footer').join(' ')).toMatch(/display:\s*none/);
        expect(rulesFor(blockAfter(layoutCss, '@media (max-width: 480px)'), '.game-footer').join(' ')).toMatch(
            /display:\s*none/,
        );
    });

    it('hides the hint line in portrait at 600px tall or less, and Moves at 360px wide or narrower', () => {
        const portrait = blockAfter(layoutCss, '@media (orientation: portrait) and (max-height: 600px)');
        expect(rulesFor(portrait, '.game-hint').join(' ')).toMatch(/display:\s*none/);
        const narrow = blockAfter(layoutCss, '@media (max-width: 360px)');
        expect(rulesFor(narrow, '.stat-display--moves').join(' ')).toMatch(/display:\s*none/);
    });

    it('makes the notice Dismiss button at least 2.75rem square under a coarse pointer', () => {
        const coarse = blockAfter(layoutCss, '@media (pointer: coarse)');
        const dismiss = rulesFor(coarse, '.notice-dismiss').join(' ');
        expect(dismiss).toMatch(/min-width:\s*2\.75rem/);
        expect(dismiss).toMatch(/min-height:\s*2\.75rem/);
    });

    it('makes Back and the tools at least 2.75rem square under a coarse pointer, in both profiles', () => {
        const coarse = blockAfter(layoutCss, '@media (pointer: coarse)');
        const back = rulesFor(coarse, '.game-back').join(' ');
        expect(back).toMatch(/min-width:\s*2\.75rem/);
        expect(back).toMatch(/min-height:\s*2\.75rem/);
        expect(rulesFor(coarse, '.tool').join(' ')).toMatch(/min-width:\s*2\.75rem/);

        // The tool's height floor holds for either pointer: the stacked base rule and the rails rule both keep it.
        for (const rules of [rulesFor(layoutCss.replace(railsBlock, ''), '.tool'), rulesFor(railsBlock, '.tool')]) {
            const heights = rules.flatMap((body) =>
                [...body.matchAll(/min-height:\s*([\d.]+)rem/g)].map((m) => Number(m[1])),
            );
            expect(Math.min(...heights)).toBeGreaterThanOrEqual(2.75);
        }
    });

    it('defines the visually hidden class', () => {
        const body = rulesFor(layoutCss, '.sr-only').join(' ');

        expect(body).toMatch(/position:\s*absolute/);
        expect(body).toMatch(/clip(?:-path)?:/);
    });

    it("turns every transition off under :root[data-motion='off']", () => {
        const off = blockAfter(layoutCss, ":root[data-motion='off'] .tool");

        expect(off).toMatch(/transition:\s*none/);
        expect(layoutCss).toMatch(/:root\[data-motion='off'\]\s+\.game-back/);
        expect(layoutCss).toMatch(/transition:/);
    });

    it('highlights a ready tool from palette tokens only, with no colour literal', () => {
        const ready = rulesFor(layoutCss, '.tool.is-ready').join(' ');

        expect(ready).toMatch(/background:[^;]*var\(--color-primary\)[^;]*var\(--color-surface\)/);
        expect(ready).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
        expect(rulesFor(layoutCss, '.tool.is-ready:hover:not(:disabled)')).toHaveLength(1);
    });

    it('feeds hover feedback from --color-hover', () => {
        expect(layoutCss).toMatch(/\.tool:hover[^{]*\{[^}]*var\(--color-hover\)/);
        expect(layoutCss).toMatch(/\.game-back:hover[^{]*\{[^}]*var\(--color-hover\)/);
    });

    describe('the notices host', () => {
        const host = () => rulesFor(layoutCss, '.notices').join(' ');

        it('is fixed, out of the frame flow, and never intercepts the pointer', () => {
            expect(host()).toMatch(/position:\s*fixed/);
            expect(host()).toMatch(/pointer-events:\s*none/);
            expect(rulesFor(layoutCss, '.notice-dismiss').join(' ')).toMatch(/pointer-events:\s*auto/);
        });

        it('keeps clear of the safe area at the bottom and the side it sits on', () => {
            const all = rulesFor(layoutCss, '.notices').join(' ');
            expect(all).toContain('env(safe-area-inset-bottom');
            expect(all).toContain('env(safe-area-inset-right');
            expect(all).toContain('env(safe-area-inset-left');
        });

        it('centres at the bottom on a narrow screen', () => {
            const narrow = blockAfter(layoutCss, '@media (max-width: 480px)');
            expect(rulesFor(narrow, '.notices').join(' ')).toMatch(/left:/);
        });

        it('slides a notice in with sheet-in, and has no slide under :root[data-motion=off]', () => {
            expect(rulesFor(layoutCss, '.notice').join(' ')).toMatch(/animation:\s*sheet-in\b/);
            expect(layoutCss).toMatch(/@keyframes sheet-in\b/);
            expect(rulesFor(layoutCss, ":root[data-motion='off'] .notice").join(' ')).toMatch(/animation:\s*none/);
        });

        it('uses tokens only, with no colour literal', () => {
            const css = [...rulesFor(layoutCss, '.notices'), ...rulesFor(layoutCss, '.notice')].join(' ');
            expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
            expect(rulesFor(layoutCss, '.notice').join(' ')).toMatch(/var\(--color-surface\)/);
        });
    });
});
