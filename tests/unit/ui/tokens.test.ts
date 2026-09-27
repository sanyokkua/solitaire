import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const STYLES_DIR = resolve(import.meta.dirname, '../../../src/ui/styles');
const TOKENS_CSS_PATH = resolve(STYLES_DIR, 'tokens.css');
const tokensCss = readFileSync(TOKENS_CSS_PATH, 'utf-8');

const FONTS_README_PATH = resolve(import.meta.dirname, '../../../src/assets/fonts/README.md');
const fontsReadme = readFileSync(FONTS_README_PATH, 'utf-8');

const SELECTOR_BLOCKS = {
    light: /:root\s*\{([^}]*)\}/,
    dark: /:root\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/,
    nightCards: /:root\[data-night-cards=['"]true['"]\]\s*\{([^}]*)\}/,
    nightNavy: /:root\[data-night-cards=['"]true['"]\]\[data-back=['"]navy['"]\]\s*\{([^}]*)\}/,
    fourColor: /:root\[data-four-color=['"]true['"]\]\s*\{([^}]*)\}/,
    backNavy: /:root\[data-back=['"]navy['"]\]\s*\{([^}]*)\}/,
    backSky: /:root\[data-back=['"]sky['"]\]\s*\{([^}]*)\}/,
    backCoral: /:root\[data-back=['"]coral['"]\]\s*\{([^}]*)\}/,
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
    nightNavy: getBlock('nightNavy'),
    fourColor: getBlock('fourColor'),
    backNavy: getBlock('backNavy'),
    backSky: getBlock('backSky'),
    backCoral: getBlock('backCoral'),
};

/** The custom-property names declared in a block, as a sorted list. */
function declaredTokens(block: string): string[] {
    return [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].flatMap((match) => (match[1] ? [match[1]] : [])).sort();
}

/** Value of one custom property in a block, or undefined when the block does not declare it. */
function valueOf(block: string, token: string): string | undefined {
    const match = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(block);
    return match?.[1]?.trim();
}

const BACK_TONES = [
    '--color-back-harbour-a',
    '--color-back-harbour-b',
    '--color-back-navy-a',
    '--color-back-navy-b',
    '--color-back-sky-a',
    '--color-back-sky-b',
    '--color-back-coral-a',
    '--color-back-coral-b',
];

// The design D3 rows whose "Defined in" lists light, dark and night: the card roles.
const CARD_TOKENS = [
    '--color-card-face',
    '--color-card-edge',
    '--shadow-card',
    '--color-suit-red',
    '--color-suit-black',
    '--color-suit-four-diamond',
    '--color-suit-four-club',
    ...BACK_TONES,
    '--color-back-rim',
];

// The design D3 rows whose "Defined in" lists light and dark only: the page roles.
const PAGE_TOKENS = [
    '--color-bg',
    '--color-surface',
    '--color-surface-raised',
    '--color-table',
    '--color-table-dot',
    '--color-slot-line',
    '--color-slot-ink',
    '--color-text',
    '--color-text-muted',
    '--color-primary',
    '--color-accent',
    '--color-accent-strong',
    '--color-outline-soft',
    '--color-hover',
    '--color-lcd-panel',
    '--color-lcd-outline',
    '--color-lcd-score',
    '--color-lcd-moves',
    '--color-lcd-time',
    '--color-lcd-label',
    '--color-hint',
    '--color-legal',
    '--color-focus',
    '--color-hint-line',
    '--shadow-sm',
];

const LIGHT_DARK_TOKENS = [...PAGE_TOKENS, ...CARD_TOKENS];
const NIGHT_TOKENS = [...CARD_TOKENS];

// Defined on :root (design D3 rows "Defined in: :root").
const ROOT_ONLY_TOKENS = [
    '--font-ui',
    '--font-pixel',
    '--shadow-lcd-inset',
    '--ink-hearts',
    '--ink-spades',
    '--ink-diamonds',
    '--ink-clubs',
    '--back-a',
    '--back-b',
    '--radius-sm',
    '--radius-md',
    '--radius-lg',
    '--card-radius-factor',
    '--motion-glide',
    '--motion-flip',
    '--motion-flip-delay',
    '--motion-deal-step',
    '--motion-ease',
    '--drag-z-base',
];

const REMOVED_TOKENS = [
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
    it.each(LIGHT_DARK_TOKENS)('defines %s in the light palette', (token) => {
        expect(blocks.light).toContain(`${token}:`);
    });

    it.each(LIGHT_DARK_TOKENS)('defines %s in the dark palette', (token) => {
        expect(blocks.dark).toContain(`${token}:`);
    });

    it.each(ROOT_ONLY_TOKENS)('defines %s on :root', (token) => {
        expect(blocks.light).toContain(`${token}:`);
    });

    it('defines exactly the card roles in the night-card palette, and nothing else', () => {
        expect(declaredTokens(blocks.nightCards)).toEqual([...NIGHT_TOKENS].sort());
    });

    it('sets no color-scheme in the night-card palette', () => {
        expect(blocks.nightCards).not.toMatch(/color-scheme/);
    });

    it('declares the night-card block after the dark block so it wins at equal specificity', () => {
        const darkAt = tokensCss.search(SELECTOR_BLOCKS.dark);
        const nightAt = tokensCss.search(SELECTOR_BLOCKS.nightCards);
        expect(darkAt).toBeGreaterThan(-1);
        expect(nightAt).toBeGreaterThan(darkAt);
    });

    it('uses the navy back in the night palette with a light rim', () => {
        expect(declaredTokens(blocks.nightNavy)).toEqual(['--color-back-rim']);
        expect(valueOf(blocks.nightNavy, '--color-back-rim')?.toLowerCase()).toBe('#8da9c4');
    });

    it('maps only diamonds and clubs to the four-colour inks', () => {
        expect(declaredTokens(blocks.fourColor)).toEqual(['--ink-clubs', '--ink-diamonds']);
        expect(valueOf(blocks.fourColor, '--ink-diamonds')).toBe('var(--color-suit-four-diamond)');
        expect(valueOf(blocks.fourColor, '--ink-clubs')).toBe('var(--color-suit-four-club)');
    });

    it.each([
        ['backNavy', 'navy'],
        ['backSky', 'sky'],
        ['backCoral', 'coral'],
    ] as const)('selects the %s back tones through the applied back tokens', (name, back) => {
        expect(valueOf(blocks[name], '--back-a')).toBe(`var(--color-back-${back}-a)`);
        expect(valueOf(blocks[name], '--back-b')).toBe(`var(--color-back-${back}-b)`);
    });

    it('applies the Harbour back and the red/black inks by default', () => {
        expect(valueOf(blocks.light, '--back-a')).toBe('var(--color-back-harbour-a)');
        expect(valueOf(blocks.light, '--back-b')).toBe('var(--color-back-harbour-b)');
        expect(valueOf(blocks.light, '--ink-hearts')).toBe('var(--color-suit-red)');
        expect(valueOf(blocks.light, '--ink-diamonds')).toBe('var(--color-suit-red)');
        expect(valueOf(blocks.light, '--ink-spades')).toBe('var(--color-suit-black)');
        expect(valueOf(blocks.light, '--ink-clubs')).toBe('var(--color-suit-black)');
    });

    it.each(REMOVED_TOKENS)('no longer contains %s', (token) => {
        expect(tokensCss).not.toContain(token);
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

// A CSS named colour used as a value, not as part of a token name or another identifier.
const NAMED_COLOUR =
    /(?<![-\w.#])(black|white|gr[ae]y|red|green|blue|yellow|orange|purple|pink|brown|silver|gold|navy|teal|maroon|olive|lime|aqua|cyan|fuchsia|magenta)(?![-\w])/;

describe('stylesheets other than tokens.css', () => {
    const otherStylesheets = readdirSync(STYLES_DIR).filter((file) => file.endsWith('.css') && file !== 'tokens.css');

    it('includes global.css', () => {
        expect(otherStylesheets).toContain('global.css');
    });

    it.each(otherStylesheets)('%s references colour only through semantic tokens, not literals', (file) => {
        const css = readFileSync(resolve(STYLES_DIR, file), 'utf-8');
        const withoutAllowedKeywords = css
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\b(transparent|currentColor|none)\b/g, '');

        expect(withoutAllowedKeywords).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(withoutAllowedKeywords).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
        expect(withoutAllowedKeywords).not.toMatch(NAMED_COLOUR);
    });
});

describe('the single no-motion switch', () => {
    const stylesheets = readdirSync(STYLES_DIR).filter((file) => file.endsWith('.css'));

    it.each(stylesheets)('%s does not use prefers-reduced-motion', (file) => {
        expect(readFileSync(resolve(STYLES_DIR, file), 'utf-8')).not.toContain('prefers-reduced-motion');
    });

    it("turns the body transition off under :root[data-motion='off'] in global.css", () => {
        const globalCss = readFileSync(resolve(STYLES_DIR, 'global.css'), 'utf-8');
        const rule = /:root\[data-motion=['"]off['"]\]\s+body\s*\{([^}]*)\}/.exec(globalCss);

        expect(rule?.[1]).toMatch(/transition:\s*none/);
    });
});

/** Splits `value` on the commas that are not inside parentheses, so `var(--fd, var(--x))` stays whole. */
function splitTopLevel(value: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < value.length; index += 1) {
        const char = value.charAt(index);
        if (char === '(') depth += 1;
        else if (char === ')') depth -= 1;
        else if (char === ',' && depth === 0) {
            parts.push(value.slice(start, index));
            start = index + 1;
        }
    }
    parts.push(value.slice(start));
    return parts.map((part) => part.trim());
}

describe('card and board transitions', () => {
    const readStyles = (file: string) => readFileSync(resolve(STYLES_DIR, file), 'utf-8');

    it.each(['cards.css', 'board.css'])('%s animates only transform and opacity', (file) => {
        const declarations = [...readStyles(file).matchAll(/(?<![-\w])transition(-property)?\s*:\s*([^;]+);/g)];

        for (const [, isProperty, value = ''] of declarations) {
            const layers = isProperty
                ? splitTopLevel(value)
                : splitTopLevel(value).map((layer) => layer.split(/\s+/)[0]);
            for (const property of layers) {
                expect(['transform', 'opacity', 'none']).toContain(property);
            }
        }
    });

    it("turns the card and inner transitions off under :root[data-motion='off'] in cards.css", () => {
        const rule =
            /:root\[data-motion=['"]off['"]\]\s+\.card\s*,\s*:root\[data-motion=['"]off['"]\]\s+\.card-inner\s*\{([^}]*)\}/.exec(
                readStyles('cards.css'),
            );

        expect(rule?.[1]).toMatch(/transition:\s*none/);
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
