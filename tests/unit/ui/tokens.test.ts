import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const TOKENS_CSS_PATH = resolve(import.meta.dirname, '../../../src/ui/styles/tokens.css');
const tokensCss = readFileSync(TOKENS_CSS_PATH, 'utf-8');

const GLOBAL_CSS_PATH = resolve(import.meta.dirname, '../../../src/ui/styles/global.css');
const globalCss = readFileSync(GLOBAL_CSS_PATH, 'utf-8');

const FONTS_README_PATH = resolve(import.meta.dirname, '../../../src/assets/fonts/README.md');
const fontsReadme = readFileSync(FONTS_README_PATH, 'utf-8');

const SELECTOR_BLOCKS = {
    light: /:root\s*\{([^}]*)\}/,
    dark: /:root\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/,
    nightCards: /:root\[data-night-cards=['"]true['"]\]\s*\{([^}]*)\}/,
} as const;

function getBlock(name: keyof typeof SELECTOR_BLOCKS): string {
    const match = SELECTOR_BLOCKS[name].exec(tokensCss);
    if (!match?.[1]) {
        throw new Error(`tokens.css has no "${name}" selector block`);
    }
    return match[1];
}

const blocks = {
    light: getBlock('light'),
    dark: getBlock('dark'),
    nightCards: getBlock('nightCards'),
};

// One entry per colour role named in specification.md §8.1 / the "Every role is defined in every
// palette" scenario of specs/app/application-shell/spec.md.
const COLOUR_ROLE_TOKENS = [
    '--color-bg',
    '--color-surface',
    '--color-surface-raised',
    '--color-table',
    '--color-text',
    '--color-text-muted',
    '--color-primary',
    '--color-accent',
    '--color-accent-strong',
    '--color-lcd-panel',
    '--color-lcd-score',
    '--color-lcd-moves',
    '--color-lcd-time',
    '--color-hint',
    '--color-card-face',
    '--color-card-edge',
    '--color-suit-red',
    '--color-suit-black',
    '--color-suit-four-diamond',
    '--color-suit-four-club',
    '--color-night-card-face',
    '--color-night-card-edge',
    '--color-night-card-ink',
    '--color-night-card-ink-red',
    '--color-night-card-backs',
    '--color-card-back-1',
    '--color-card-back-2',
    '--color-card-back-3',
    '--color-card-back-4',
    '--color-card-back-checker',
];

describe('tokens.css', () => {
    it.each(COLOUR_ROLE_TOKENS)('defines %s in the light palette', (token) => {
        expect(blocks.light).toContain(`${token}:`);
    });

    it.each(COLOUR_ROLE_TOKENS)('defines %s in the dark palette', (token) => {
        expect(blocks.dark).toContain(`${token}:`);
    });

    it.each(COLOUR_ROLE_TOKENS)('defines %s in the night-card palette', (token) => {
        expect(blocks.nightCards).toContain(`${token}:`);
    });

    it('defines the --font-ui and --font-pixel tokens', () => {
        expect(tokensCss).toContain('--font-ui:');
        expect(tokensCss).toContain('--font-pixel:');
    });

    it('references every @font-face src relative to the bundled asset directory', () => {
        const fontFaceBlocks = tokensCss.match(/@font-face\s*\{[^}]*\}/g) ?? [];
        expect(fontFaceBlocks.length).toBeGreaterThan(0);

        for (const fontFace of fontFaceBlocks) {
            const srcMatches = [...fontFace.matchAll(/url\(['"]([^'"]+)['"]\)/g)];
            expect(srcMatches.length).toBeGreaterThan(0);
            for (const [, url] of srcMatches) {
                expect(url).not.toMatch(/^https?:\/\//);
                expect(url).toMatch(/^\.\.\/\.\.\/assets\/fonts\//);
            }
        }
    });

    it('contains no third-party runtime host reference', () => {
        expect(tokensCss).not.toMatch(/https?:\/\//);
    });
});

describe('global.css', () => {
    it('references colour only through semantic tokens, not hard-coded literals', () => {
        const withoutAllowedKeywords = globalCss.replace(/\b(transparent|currentColor|none)\b/g, '');

        expect(withoutAllowedKeywords).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(withoutAllowedKeywords).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    });
});

describe('bundled font licences', () => {
    it.each(['Inter-Variable.woff2', 'PressStart2P-Regular.ttf'])(
        'documents a licence for %s in src/assets/fonts/README.md',
        (fontFile) => {
            const lineWithFile = fontsReadme.split('\n').find((line) => line.includes(fontFile));

            expect(lineWithFile).toBeDefined();
            expect(lineWithFile).toMatch(/licen[cs]ed/i);
        },
    );
});
