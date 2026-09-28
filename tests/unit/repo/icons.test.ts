import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { generateIcons } from '../../../scripts/generate-icons.mjs';

const PUBLIC_DIR = resolve(import.meta.dirname, '../../../public');
const generated = generateIcons();

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

    it('keeps the maskable mark inside the 80 % safe zone', () => {
        // Decode is unnecessary: the mark is centred, so every non-background pixel of the
        // maskable icon must sit inside the middle 80 % of both axes.
        const bytes = generated.get('icons/icon-maskable-512.png') as Buffer;
        const size = 512;
        const raw = inflateRaw(bytes);
        const margin = size * 0.1;
        for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
                const offset = y * (1 + size * 3) + 1 + x * 3;
                const isBackground = raw[offset] === 0x0b && raw[offset + 1] === 0x25 && raw[offset + 2] === 0x45;
                if (!isBackground) {
                    expect(x).toBeGreaterThanOrEqual(margin);
                    expect(x).toBeLessThan(size - margin);
                    expect(y).toBeGreaterThanOrEqual(margin);
                    expect(y).toBeLessThan(size - margin);
                }
            }
        }
    });
});

function inflateRaw(png: Buffer): Buffer {
    const idatStart = png.indexOf('IDAT', 0, 'ascii');
    const length = png.readUInt32BE(idatStart - 4);
    return inflateSync(png.subarray(idatStart + 4, idatStart + 4 + length));
}
