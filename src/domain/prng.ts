/** Minimal entropy source; satisfied by the Web Crypto `crypto` object. */
export interface SeedSource {
    getRandomValues(array: Uint32Array<ArrayBuffer>): Uint32Array<ArrayBuffer>;
}

/**
 * Seeded 32-bit generator (mulberry32). Returns values in [0, 1). `a |= 0` reduces any number to its
 * unsigned-32-bit residue, so negative, fractional and oversized seeds behave like `seed >>> 0`.
 */
export function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Draws a fresh unsigned 32-bit seed from the injected source (default: the global `crypto`). */
export function cryptoSeed(source?: SeedSource): number {
    const entropy = source ?? (globalThis as { crypto?: SeedSource }).crypto;
    if (!entropy) throw new Error('No cryptographic entropy source is available');
    const buffer = new Uint32Array(1);
    entropy.getRandomValues(buffer);
    return buffer[0] ?? 0;
}
