import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const STYLES_DIR = resolve(import.meta.dirname, '../../../src/ui/styles');
const hudCss = readFileSync(resolve(STYLES_DIR, 'hud.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
const globalCss = readFileSync(resolve(STYLES_DIR, 'global.css'), 'utf-8');

/** The declaration body of the rule whose selector list is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        if (selectors?.trim() === selector && body !== undefined) return body;
    }
    throw new Error(`no rule for ${selector}`);
}

describe('hud.css', () => {
    it('is imported by global.css', () => {
        expect(globalCss).toMatch(/@import\s+['"]\.\/hud\.css['"]/);
    });

    it('paints the stat display on the LCD panel with its outline and inset shadow', () => {
        const body = ruleBody(hudCss, '.stat-display');

        expect(body).toMatch(/background:\s*var\(--color-lcd-panel\)/);
        expect(body).toMatch(/border:\s*2px solid var\(--color-lcd-outline\)/);
        expect(body).toMatch(/box-shadow:\s*var\(--shadow-lcd-inset\)/);
    });

    it('colours the label with the LCD label token', () => {
        expect(ruleBody(hudCss, '.stat-display__label')).toMatch(/color:\s*var\(--color-lcd-label\)/);
    });

    it('colours the value with the score token, Moves and Time with their own', () => {
        expect(ruleBody(hudCss, '.stat-display__value')).toMatch(/color:\s*var\(--color-lcd-score\)/);
        expect(ruleBody(hudCss, '.stat-display--moves .stat-display__value')).toMatch(
            /color:\s*var\(--color-lcd-moves\)/,
        );
        expect(ruleBody(hudCss, '.stat-display--timer .stat-display__value')).toMatch(
            /color:\s*var\(--color-lcd-time\)/,
        );
    });

    it('is colour-only: no colour literals, sizing, layout, transitions or motion queries', () => {
        expect(hudCss).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i);
        expect(hudCss).not.toMatch(/\b(?:width|height|padding|margin|display|gap|font-size|transition|animation)\s*:/);
        expect(hudCss).not.toMatch(/prefers-reduced-motion|@media/);
    });
});
