import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rulesFor, stripComments } from '../../support/css';

const STYLES_DIR = resolve(import.meta.dirname, '../../../src/ui/styles');
const globalCss = readFileSync(resolve(STYLES_DIR, 'global.css'), 'utf-8');
const sheetsCss = stripComments(readFileSync(resolve(STYLES_DIR, 'sheets.css'), 'utf-8'));
const controlsCss = stripComments(readFileSync(resolve(STYLES_DIR, 'controls.css'), 'utf-8'));
const homeCss = stripComments(readFileSync(resolve(STYLES_DIR, 'home.css'), 'utf-8'));
const layoutCss = stripComments(readFileSync(resolve(STYLES_DIR, 'layout.css'), 'utf-8'));

const SHEETS = [
    ['controls.css', controlsCss],
    ['sheets.css', sheetsCss],
    ['home.css', homeCss],
] as const;

describe('sheets.css and controls.css', () => {
    it('are imported by global.css', () => {
        expect(globalCss).toMatch(/@import\s+['"]\.\/controls\.css['"]/);
        expect(globalCss).toMatch(/@import\s+['"]\.\/sheets\.css['"]/);
    });

    it('animates the sheet in with the shared sheet-in keyframes, defined once (in layout.css)', () => {
        expect(rulesFor(sheetsCss, '.modal-sheet').join(' ')).toMatch(/animation:\s*sheet-in\b/);
        expect(layoutCss).toMatch(/@keyframes sheet-in\b/);
        expect(sheetsCss).not.toMatch(/@keyframes sheet-in\b/);
    });

    it("turns the sheet-in animation off under :root[data-motion='off']", () => {
        expect(rulesFor(sheetsCss, ":root[data-motion='off'] .modal-sheet").join(' ')).toMatch(/animation:\s*none/);
    });

    it("turns every control transition off under :root[data-motion='off']", () => {
        const off = rulesFor(controlsCss, ":root[data-motion='off'] .switch::after").join(' ');
        expect(off).toMatch(/transition:\s*none/);
    });

    it.each(SHEETS)('%s never queries prefers-reduced-motion', (_file, css) => {
        expect(css).not.toMatch(/prefers-reduced-motion/);
    });
});

describe('home.css', () => {
    it('is imported by global.css', () => {
        expect(globalCss).toMatch(/@import\s+['"]\.\/home\.css['"]/);
    });

    it("floats the fan with fan-float, defined here, and stops it under :root[data-motion='off']", () => {
        expect(rulesFor(homeCss, '.hero-fan').join(' ')).toMatch(/animation:\s*fan-float\b/);
        expect(homeCss).toMatch(/@keyframes fan-float\b/);
        expect(rulesFor(homeCss, ":root[data-motion='off'] .hero-fan").join(' ')).toMatch(/animation:\s*none/);
    });

    it('goes two-column at 640px wide', () => {
        expect(homeCss).toMatch(/@media \(min-width: 640px\)[^{]*\{[^@]*\.home-hero\s*\{/);
    });

    it('grows the top bar buttons to 44px on a coarse pointer', () => {
        const block = homeCss.slice(homeCss.indexOf('@media (pointer: coarse)'));
        expect(block).toMatch(/\.topbar \.icon-action[^{]*\{[^}]*min-width:\s*2\.75rem[^}]*min-height:\s*2\.75rem/);
    });

    it('lays the mode tiles out in two columns, four from 640px wide', () => {
        expect(rulesFor(homeCss, '.mode-row').join(' ')).toMatch(/repeat\(2,/);
        expect(homeCss).toMatch(/@media \(min-width: 640px\)[^{]*\{[^@]*\.mode-row\s*\{[^}]*repeat\(4,/);
    });

    it("stops the mode tile lift under :root[data-motion='off']", () => {
        expect(rulesFor(homeCss, '.mode-card').join(' ')).toMatch(/transition:/);
        expect(rulesFor(homeCss, ":root[data-motion='off'] .mode-card").join(' ')).toMatch(/transition:\s*none/);
    });

    it('marks the selected tile with a ring and a pixel corner mark', () => {
        expect(rulesFor(homeCss, '.mode-card.is-selected').join(' ')).toMatch(/translateY/);
        expect(rulesFor(homeCss, '.mode-card.is-selected::after').join(' ')).toMatch(/content:/);
    });
});

describe('board.css dealing overlay', () => {
    const boardCss = stripComments(readFileSync(resolve(STYLES_DIR, 'board.css'), 'utf-8'));

    it('spins the spinner with spin-card, defined here', () => {
        expect(rulesFor(boardCss, '.spinner').join(' ')).toMatch(/animation:\s*spin-card\b/);
        expect(boardCss).toMatch(/@keyframes spin-card\b/);
    });

    it("stops the spin under :root[data-motion='off'] and leaves the spinner in place", () => {
        const off = rulesFor(boardCss, ":root[data-motion='off'] .spinner").join(' ');
        expect(off).toMatch(/animation:\s*none/);
        expect(off).not.toMatch(/display:\s*none/);
    });

    it('never queries prefers-reduced-motion', () => {
        expect(boardCss).not.toMatch(/prefers-reduced-motion/);
    });
});
