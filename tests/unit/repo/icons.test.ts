import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { generateIcons } from '../../../scripts/generate-icons.mjs';

const PUBLIC_DIR = resolve(import.meta.dirname, '../../../public');
const generated = generateIcons();
const BACKGROUND = '#0b2545';
const CARD_FACE = '#fbfdfb';

function pngSize(bytes: Buffer): [number, number] {
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('generated icons', () => {
    it.each([...generated.keys()])('the committed %s equals a fresh render', (path) => {
        const committed = readFileSync(resolve(PUBLIC_DIR, path));
        const fresh = generated.get(path);

        expect(committed.equals(Buffer.from(fresh ?? ''))).toBe(true);
    });

    it.each([
        ['icons/apple-touch-icon.png', 180],
        ['icons/icon-192.png', 192],
        ['icons/icon-512.png', 512],
        ['icons/icon-maskable-512.png', 512],
    ])('%s is a %i px square PNG', (path, size) => {
        const bytes = generated.get(path) as Buffer;

        expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
        expect(pngSize(bytes)).toEqual([size, size]);
    });

    it('keeps the maskable mark inside the W3C safe zone: a centred circle of 80 % of the icon', () => {
        const size = 512;
        const radius = size * 0.4;
        const centre = size / 2;
        const { pixels } = decodePng(generated.get('icons/icon-maskable-512.png') as Buffer);
        let markPixels = 0;
        for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
                if (colourAt(pixels, size, x, y) === BACKGROUND) continue;
                markPixels += 1;
                // The farthest corner of the pixel square must still be inside the circle.
                const dx = Math.max(Math.abs(x - centre), Math.abs(x + 1 - centre));
                const dy = Math.max(Math.abs(y - centre), Math.abs(y + 1 - centre));
                if (Math.hypot(dx, dy) > radius) {
                    expect.fail(`pixel (${String(x)}, ${String(y)}) is outside the safe-zone circle`);
                }
            }
        }
        expect(markPixels).toBeGreaterThan(0);
    });

    it.each([
        ['icons/apple-touch-icon.png', 180],
        ['icons/icon-192.png', 192],
        ['icons/icon-512.png', 512],
        ['icons/icon-maskable-512.png', 512],
    ])('%s contains a light card-face region, not only background', (path, size) => {
        const { pixels } = decodePng(generated.get(path) as Buffer);
        let face = 0;
        for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
                if (colourAt(pixels, size, x, y) === CARD_FACE) face += 1;
            }
        }

        expect(face).toBeGreaterThan(size * size * 0.05);
    });

    it('favicon.svg draws the card face and the mark on the same grid', () => {
        const svg = generated.get('favicon.svg') as string;

        expect(svg).toContain('viewBox="0 0 24 24"');
        expect(svg).toContain('shape-rendering="crispEdges"');
        expect(svg).toContain(`fill="${CARD_FACE}"`);
    });
});

function colourAt(pixels: Buffer, size: number, x: number, y: number): string {
    const offset = y * (1 + size * 3) + 1 + x * 3;
    return `#${pixels.subarray(offset, offset + 3).toString('hex')}`;
}

function decodePng(png: Buffer): { pixels: Buffer } {
    const idatStart = png.indexOf('IDAT', 0, 'ascii');
    const length = png.readUInt32BE(idatStart - 4);
    return { pixels: inflateSync(png.subarray(idatStart + 4, idatStart + 4 + length)) };
}
