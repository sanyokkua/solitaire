// Draws the card-fan mark (a checkered card back behind a white card face showing a pixel "A" and a spade) on the
// harbour background. ONE rectangle list on a 24 x 24 cell grid feeds both the SVG favicon and the PNG icons.
// Dependency-free: PNGs are encoded with node:zlib. Run `node scripts/generate-icons.mjs` to rewrite public/.
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const GRID = 24;
const BACKGROUND = '#0b2545';
const SKY = '#5bc0eb';
const NAVY = '#1d3f70';
const RIM = '#f1faee';
const FACE = '#fbfdfb';
const INK = '#13315c';

const CARD_WIDTH = 9;
const CARD_HEIGHT = 13;
const BACK_AT = [5, 4];
const FACE_AT = [10, 7];

const LETTER_A = ['.##.', '#..#', '####', '#..#', '#..#'];
const SPADE = ['..#..', '.###.', '#####', '#####', '..#..'];

/** Rectangles for the `#` cells of a bitmap placed at (x, y); each row's runs of `#` become one rectangle. */
function bitmapRects(rows, [x, y], fill) {
    const rects = [];
    rows.forEach((row, rowIndex) => {
        for (const run of row.matchAll(/#+/g)) {
            rects.push({ x: x + run.index, y: y + rowIndex, w: run[0].length, h: 1, fill });
        }
    });
    return rects;
}

/** The card back: a cream rim around a sky/navy checker. */
function cardBackRects([x, y]) {
    const rects = [
        { x, y, w: CARD_WIDTH, h: CARD_HEIGHT, fill: RIM },
        { x: x + 1, y: y + 1, w: CARD_WIDTH - 2, h: CARD_HEIGHT - 2, fill: NAVY },
    ];
    for (let row = 0; row < CARD_HEIGHT - 2; row += 1) {
        for (let column = 0; column < CARD_WIDTH - 2; column += 1) {
            if ((row + column) % 2 === 0) rects.push({ x: x + 1 + column, y: y + 1 + row, w: 1, h: 1, fill: SKY });
        }
    }
    return rects;
}

/** Back to front; the first entry is the background, the rest form the mark. */
const RECTS = [
    { x: 0, y: 0, w: GRID, h: GRID, fill: BACKGROUND },
    ...cardBackRects(BACK_AT),
    { x: FACE_AT[0], y: FACE_AT[1], w: CARD_WIDTH, h: CARD_HEIGHT, fill: FACE },
    ...bitmapRects(LETTER_A, [FACE_AT[0] + 1, FACE_AT[1] + 1], INK),
    ...bitmapRects(SPADE, [FACE_AT[0] + 2, FACE_AT[1] + 7], INK),
];

/** Bounding box of the mark (everything except the background rectangle), in cells. */
const MARK = RECTS.slice(1).reduce(
    (box, { x, y, w, h }) => ({
        left: Math.min(box.left, x),
        top: Math.min(box.top, y),
        right: Math.max(box.right, x + w),
        bottom: Math.max(box.bottom, y + h),
    }),
    { left: GRID, top: GRID, right: 0, bottom: 0 },
);

/** Fill colour of each grid cell, painted from RECTS. */
const CELLS = (() => {
    const cells = Array.from({ length: GRID * GRID }, () => BACKGROUND);
    for (const { x, y, w, h, fill } of RECTS) {
        for (let cy = y; cy < y + h; cy += 1) for (let cx = x; cx < x + w; cx += 1) cells[cy * GRID + cx] = fill;
    }
    return cells;
})();

function rgb(hex) {
    return Buffer.from(hex.slice(1), 'hex');
}

function gridOffset(size, scale) {
    return Math.floor((size - GRID * scale) / 2);
}

/** Whether every corner of the mark's pixel box lies inside the centred circle of 80 % of `size`. */
function fitsSafeZone(size, scale) {
    const offset = gridOffset(size, scale);
    const centre = size / 2;
    const dx = Math.max(Math.abs(offset + MARK.left * scale - centre), Math.abs(offset + MARK.right * scale - centre));
    const dy = Math.max(Math.abs(offset + MARK.top * scale - centre), Math.abs(offset + MARK.bottom * scale - centre));
    return Math.hypot(dx, dy) <= size * 0.4;
}

/** Integer scale of one grid cell: as large as fits, and for a maskable icon as large as fits the safe zone. */
function scaleFor(size, maskable) {
    let scale = Math.floor(size / GRID);
    while (maskable && scale > 1 && !fitsSafeZone(size, scale)) scale -= 1;
    return scale;
}

function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, body, crc]);
}

/**
 * Encodes a square 8-bit RGB PNG of `size` pixels: the grid at an integer scale, centred, with background padding.
 * A `maskable` icon uses the largest scale whose mark stays inside the safe-zone circle.
 */
export function drawIconPng(size, maskable) {
    const scale = scaleFor(size, maskable);
    const offset = gridOffset(size, scale);
    const rowBytes = 1 + size * 3;
    const raw = Buffer.alloc(rowBytes * size);
    const background = rgb(BACKGROUND);
    for (let y = 0; y < size; y += 1) {
        const rowStart = y * rowBytes;
        const cellY = Math.floor((y - offset) / scale);
        for (let x = 0; x < size; x += 1) {
            const cellX = Math.floor((x - offset) / scale);
            const inGrid = cellX >= 0 && cellX < GRID && cellY >= 0 && cellY < GRID;
            raw.set(inGrid ? rgb(CELLS[cellY * GRID + cellX]) : background, rowStart + 1 + x * 3);
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
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges">`,
        ...RECTS.map(({ x, y, w, h, fill }) =>
            x === 0 && y === 0
                ? `<rect width="${w}" height="${h}" fill="${fill}"/>`
                : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`,
        ),
        '</svg>',
        '',
    ].join('\n');
}

/** Every generated file, keyed by its path relative to `public/`. Pure: no file access. */
export function generateIcons() {
    return new Map([
        ['icons/icon-192.png', drawIconPng(192, false)],
        ['icons/icon-512.png', drawIconPng(512, false)],
        ['icons/icon-maskable-512.png', drawIconPng(512, true)],
        ['icons/apple-touch-icon.png', drawIconPng(180, false)],
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
