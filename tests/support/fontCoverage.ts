/**
 * The code points a WOFF2 font maps to a glyph, read from its `cmap` table without any dependency. A WOFF2 file is a
 * small header, a table directory and one Brotli stream holding every table; `cmap` is stored untransformed, so it can
 * be sliced out of the decompressed stream once the table lengths before it are summed. Formats 4 and 12 are read.
 */
import { brotliDecompressSync } from 'node:zlib';

const KNOWN_TAGS = [
    'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
    'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
    'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
    'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
    'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
]; // prettier-ignore

function readBase128(bytes: Buffer, at: number): { value: number; next: number } {
    let value = 0;
    for (let i = 0; i < 5; i += 1) {
        const byte = bytes[at + i];
        if (byte === undefined) throw new Error('truncated UIntBase128');
        value = value * 128 + (byte & 0x7f);
        if ((byte & 0x80) === 0) return { value, next: at + i + 1 };
    }
    throw new Error('UIntBase128 longer than five bytes');
}

function readCmap(cmap: Buffer): Set<number> {
    const points = new Set<number>();
    const subtables = cmap.readUInt16BE(2);
    for (let i = 0; i < subtables; i += 1) {
        const at = cmap.readUInt32BE(4 + i * 8 + 4);
        const format = cmap.readUInt16BE(at);
        if (format === 4) {
            const segments = cmap.readUInt16BE(at + 6) / 2;
            const ends = at + 14;
            const starts = ends + segments * 2 + 2;
            const deltas = starts + segments * 2;
            const offsets = deltas + segments * 2;
            for (let s = 0; s < segments; s += 1) {
                const end = cmap.readUInt16BE(ends + s * 2);
                const start = cmap.readUInt16BE(starts + s * 2);
                for (let code = start; code <= end && code !== 0xffff; code += 1) {
                    if (cmap.readUInt16BE(offsets + s * 2) === 0) {
                        if (((code + cmap.readUInt16BE(deltas + s * 2)) & 0xffff) !== 0) points.add(code);
                        continue;
                    }
                    const glyphAt = offsets + s * 2 + cmap.readUInt16BE(offsets + s * 2) + (code - start) * 2;
                    if (cmap.readUInt16BE(glyphAt) !== 0) points.add(code);
                }
            }
        } else if (format === 12) {
            const groups = cmap.readUInt32BE(at + 12);
            for (let g = 0; g < groups; g += 1) {
                const base = at + 16 + g * 12;
                const first = cmap.readUInt32BE(base);
                const last = cmap.readUInt32BE(base + 4);
                for (let code = first; code <= last; code += 1) points.add(code);
            }
        }
    }
    return points;
}

/** Every code point the WOFF2 `font` maps to a glyph (format 4 and 12 subtables of its `cmap`). */
export function woff2CodePoints(font: Buffer): Set<number> {
    if (font.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
    const tableCount = font.readUInt16BE(12);
    const compressedSize = font.readUInt32BE(20);
    let at = 48;
    let offset = 0;
    let cmapAt = -1;
    let cmapLength = 0;
    for (let i = 0; i < tableCount; i += 1) {
        const flags = font[at];
        if (flags === undefined) throw new Error('truncated table directory');
        at += 1;
        const tagIndex = flags & 0x3f;
        let tag: string;
        if (tagIndex === 63) {
            tag = font.toString('latin1', at, at + 4);
            at += 4;
        } else {
            tag = KNOWN_TAGS[tagIndex] ?? '';
        }
        const original = readBase128(font, at);
        at = original.next;
        const transformVersion = flags >> 6;
        // glyf and loca are transformed by version 0; every other table is transformed by any version but 0.
        const transformed = tag === 'glyf' || tag === 'loca' ? transformVersion === 0 : transformVersion !== 0;
        let length = original.value;
        if (transformed) {
            const transformedLength = readBase128(font, at);
            at = transformedLength.next;
            length = transformedLength.value;
        }
        if (tag === 'cmap') {
            if (transformed) throw new Error('cmap is unexpectedly transformed');
            cmapAt = offset;
            cmapLength = length;
        }
        offset += length;
    }
    if (cmapAt < 0) throw new Error('no cmap table');
    const tables = brotliDecompressSync(font.subarray(at, at + compressedSize));
    return readCmap(tables.subarray(cmapAt, cmapAt + cmapLength));
}
