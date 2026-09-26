import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync(resolve(import.meta.dirname, '../../../src/ui/styles/tokens.css'), 'utf-8');

const MIN_RATIO = 4.5;

function blockOf(selector: RegExp): string {
    const match = selector.exec(tokensCss);
    if (!match?.[1]) {
        throw new Error(`tokens.css has no block matching ${String(selector)}`);
    }
    return match[1];
}

const light = blockOf(/:root\s*\{([^}]*)\}/);
const dark = blockOf(/:root\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/);
const night = blockOf(/:root\[data-night-cards=['"]true['"]\]\s*\{([^}]*)\}/);

/** Hex value of a custom property in a block; throws when it is missing or not `#rrggbb`. */
function hexOf(block: string, token: string): string {
    const match = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(block);
    if (!match?.[1]) {
        throw new Error(`${token} is not a #rrggbb value in the block`);
    }
    return match[1];
}

function channel(hex: string, offset: number): number {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
    return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(foreground: string, background: string): number {
    const a = luminance(foreground);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const INK_TOKENS = ['--color-suit-red', '--color-suit-black', '--color-suit-four-diamond', '--color-suit-four-club'];

// Night cards define their own face and inks, so each pair is read from one block. Light and dark
// define their own face too.
const PALETTES = [
    ['light', light],
    ['dark', dark],
    ['night', night],
] as const;

const THEMES = [
    ['light', light],
    ['dark', dark],
] as const;

describe('contrast helper', () => {
    it('computes the WCAG extremes', () => {
        expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
        expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
    });
});

describe.each(PALETTES)('suit inks on the card face, %s palette', (_name, block) => {
    it.each(INK_TOKENS)('%s is at least 4.5:1', (ink) => {
        expect(contrast(hexOf(block, ink), hexOf(block, '--color-card-face'))).toBeGreaterThanOrEqual(MIN_RATIO);
    });
});

describe.each(THEMES)('text pairs, %s theme', (_name, block) => {
    it.each(['--color-lcd-score', '--color-lcd-moves', '--color-lcd-time', '--color-lcd-label'])(
        '%s on the LCD panel is at least 4.5:1',
        (token) => {
            expect(contrast(hexOf(block, token), hexOf(block, '--color-lcd-panel'))).toBeGreaterThanOrEqual(MIN_RATIO);
        },
    );

    it.each(['--color-text', '--color-text-muted'])('%s on the surface is at least 4.5:1', (token) => {
        expect(contrast(hexOf(block, token), hexOf(block, '--color-surface'))).toBeGreaterThanOrEqual(MIN_RATIO);
    });
});
