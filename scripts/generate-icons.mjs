// Draws the pixel-dot mark (three blocks: on-bg, primary, secondary) on the harbour background.
// Dependency-free: PNGs are encoded with node:zlib. Run `node scripts/generate-icons.mjs` to rewrite public/.
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const BACKGROUND = [0x0b, 0x25, 0x45];
const BLOCKS = [
    [0xee, 0xf4, 0xed],
    [0x5b, 0xc0, 0xeb],
    [0xa8, 0xda, 0xdc],
];
const BLOCK_CELLS = 3;
const GAP_CELLS = 1;
const MARK_WIDTH_CELLS = BLOCKS.length * BLOCK_CELLS + (BLOCKS.length - 1) * GAP_CELLS;

/** Share of the icon width the mark may cover; the maskable icon keeps it well inside the 80 % safe zone. */
const MARK_SHARE = 0.6;
const MASKABLE_MARK_SHARE = 0.48;

function hex(rgb) {
    return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, body, crc]);
}

/** Encodes a square 8-bit RGB PNG of `size` pixels with the mark centred. */
export function drawIconPng(size, markShare) {
    const scale = Math.floor((size * markShare) / MARK_WIDTH_CELLS);
    const markWidth = MARK_WIDTH_CELLS * scale;
    const markHeight = BLOCK_CELLS * scale;
    const left = Math.floor((size - markWidth) / 2);
    const top = Math.floor((size - markHeight) / 2);
    const rowBytes = 1 + size * 3;
    const raw = Buffer.alloc(rowBytes * size);
    for (let y = 0; y < size; y += 1) {
        const rowStart = y * rowBytes;
        for (let x = 0; x < size; x += 1) {
            let colour = BACKGROUND;
            const cellX = Math.floor((x - left) / scale);
            const cellY = Math.floor((y - top) / scale);
            if (x >= left && x < left + markWidth && cellY >= 0 && cellY < BLOCK_CELLS && y >= top) {
                const slot = Math.floor(cellX / (BLOCK_CELLS + GAP_CELLS));
                if (cellX % (BLOCK_CELLS + GAP_CELLS) < BLOCK_CELLS) colour = BLOCKS[slot];
            }
            raw.set(colour, rowStart + 1 + x * 3);
        }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header.set([8, 2, 0, 0, 0], 8);
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function drawFaviconSvg() {
    const side = 23;
    const left = (side - MARK_WIDTH_CELLS) / 2;
    const top = (side - BLOCK_CELLS) / 2;
    const rects = BLOCKS.map((colour, index) => {
        const x = left + index * (BLOCK_CELLS + GAP_CELLS);
        return `<rect x="${x}" y="${top}" width="${BLOCK_CELLS}" height="${BLOCK_CELLS}" fill="${hex(colour)}"/>`;
    });
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges">`,
        `<rect width="${side}" height="${side}" fill="${hex(BACKGROUND)}"/>`,
        ...rects,
        '</svg>',
        '',
    ].join('\n');
}

/** Every generated file, keyed by its path relative to `public/`. Pure: no file access. */
export function generateIcons() {
    return new Map([
        ['icons/icon-192.png', drawIconPng(192, MARK_SHARE)],
        ['icons/icon-512.png', drawIconPng(512, MARK_SHARE)],
        ['icons/icon-maskable-512.png', drawIconPng(512, MASKABLE_MARK_SHARE)],
        ['icons/apple-touch-icon.png', drawIconPng(180, MARK_SHARE)],
        ['favicon.svg', drawFaviconSvg()],
    ]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
    for (const [path, content] of generateIcons()) {
        const target = resolve(publicDir, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
    }
}
