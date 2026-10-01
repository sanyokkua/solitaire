// covers: KS-SET-03

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync(resolve(import.meta.dirname, '../../../src/ui/styles/tokens.css'), 'utf-8');

const MIN_RATIO = 4.5;
// Non-text state marks (legal targets, focus, hint, selection) against the table.
const MIN_MARK_RATIO = 3;

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

describe.each(THEMES)('sheet and control text pairs, %s theme (D13)', (_name, block) => {
    it('on-surface-muted on surface-1 is at least 4.5:1', () => {
        expect(
            contrast(hexOf(block, '--color-on-surface-muted'), hexOf(block, '--color-surface-1')),
        ).toBeGreaterThanOrEqual(MIN_RATIO);
    });

    it('on-primary-container on primary-container is at least 4.5:1', () => {
        expect(
            contrast(hexOf(block, '--color-on-primary-container'), hexOf(block, '--color-primary-container')),
        ).toBeGreaterThanOrEqual(MIN_RATIO);
    });

    it('on-tertiary on tertiary is at least 4.5:1', () => {
        expect(contrast(hexOf(block, '--color-on-tertiary'), hexOf(block, '--color-tertiary'))).toBeGreaterThanOrEqual(
            MIN_RATIO,
        );
    });
});

describe.each(THEMES)('Home hero text pairs, %s theme', (_name, block) => {
    it('the wordmark and pitch (text) on the hero table is at least 4.5:1', () => {
        expect(contrast(hexOf(block, '--color-text'), hexOf(block, '--color-table'))).toBeGreaterThanOrEqual(MIN_RATIO);
    });

    it('the badge text (on-surface-muted) on the surface is at least 4.5:1', () => {
        expect(
            contrast(hexOf(block, '--color-on-surface-muted'), hexOf(block, '--color-surface')),
        ).toBeGreaterThanOrEqual(MIN_RATIO);
    });
});

describe.each(THEMES)('state marks on the table, %s theme', (_name, block) => {
    it.each(['--color-legal', '--color-focus', '--color-hint-line', '--color-primary'])(
        '%s is at least 3:1',
        (token) => {
            expect(contrast(hexOf(block, token), hexOf(block, '--color-table'))).toBeGreaterThanOrEqual(MIN_MARK_RATIO);
        },
    );
});

describe.each(PALETTES)('Home mode tile text on the card face, %s palette', (_name, block) => {
    it('--color-card-ink (name, rules line and best time) is at least 4.5:1', () => {
        expect(contrast(hexOf(block, '--color-card-ink'), hexOf(block, '--color-card-face'))).toBeGreaterThanOrEqual(
            MIN_RATIO,
        );
    });
});

describe.each(THEMES)('Home Winnable card text, %s theme', (_name, block) => {
    it('the caption (on-surface-muted) and title (text) on the surface are at least 4.5:1', () => {
        expect(
            contrast(hexOf(block, '--color-on-surface-muted'), hexOf(block, '--color-surface')),
        ).toBeGreaterThanOrEqual(MIN_RATIO);
        expect(contrast(hexOf(block, '--color-text'), hexOf(block, '--color-surface'))).toBeGreaterThanOrEqual(
            MIN_RATIO,
        );
    });
});

describe.each(THEMES)('Home section label, %s theme', (_name, block) => {
    it('on-surface-muted on the page background is at least 4.5:1', () => {
        expect(contrast(hexOf(block, '--color-on-surface-muted'), hexOf(block, '--color-bg'))).toBeGreaterThanOrEqual(
            MIN_RATIO,
        );
    });
});

/** The `rgb(r g b / a%)` value of a token composited over `--color-bg`, as `#rrggbb`. */
function overBg(block: string, token: string): string {
    const match = new RegExp(`${token}\\s*:\\s*rgb\\((\\d+) (\\d+) (\\d+) / (\\d+)%\\)`).exec(block);
    if (!match) return hexOf(block, token);
    const bg = hexOf(block, '--color-bg');
    const alpha = Number(match[4]) / 100;
    const mixed = [1, 2, 3].map((i, at) => {
        const under = parseInt(bg.slice(1 + at * 2, 3 + at * 2), 16);
        return Math.round(Number(match[i]) * alpha + under * (1 - alpha));
    });
    return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

describe.each(THEMES)('Game chip text pairs, %s theme', (_name, block) => {
    it('the mode chip (on-primary-container on primary-container) is at least 4.5:1', () => {
        expect(
            contrast(hexOf(block, '--color-on-primary-container'), hexOf(block, '--color-primary-container')),
        ).toBeGreaterThanOrEqual(MIN_RATIO);
    });

    it('the winnable deal chip (on-success-container on success-container over the top bar) is at least 4.5:1', () => {
        expect(
            contrast(hexOf(block, '--color-on-success-container'), overBg(block, '--color-success-container')),
        ).toBeGreaterThanOrEqual(MIN_RATIO);
    });

    it('the random deal chip (text on surface-variant) is at least 4.5:1', () => {
        expect(contrast(hexOf(block, '--color-text'), hexOf(block, '--color-surface-variant'))).toBeGreaterThanOrEqual(
            MIN_RATIO,
        );
    });
});
