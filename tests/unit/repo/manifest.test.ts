import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PUBLIC_DIR = resolve(import.meta.dirname, '../../../public');
const BASE = '/solitaire/';

interface ManifestIcon {
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
}

const manifest = JSON.parse(readFileSync(resolve(PUBLIC_DIR, 'manifest.webmanifest'), 'utf-8')) as {
    name: string;
    start_url: string;
    scope: string;
    display: string;
    background_color: string;
    theme_color: string;
    icons: ManifestIcon[];
};

describe('manifest.webmanifest', () => {
    it('starts and scopes at the /solitaire/ base, in standalone display', () => {
        expect(manifest.start_url).toBe(BASE);
        expect(manifest.scope).toBe(BASE);
        expect(manifest.display).toBe('standalone');
        expect(manifest.name).toBe('Solitaire');
    });

    it('takes theme and background colours from the palette', () => {
        expect(manifest.theme_color).toBe('#0b2545');
        expect(manifest.background_color).toBe('#0b2545');
    });

    it('lists 192, 512 and a maskable 512 icon, all under the base and present on disk', () => {
        const bySize = manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose ?? 'any'}`);

        expect(bySize).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
        for (const icon of manifest.icons) {
            expect(icon.src.startsWith(BASE)).toBe(true);
            expect(existsSync(resolve(PUBLIC_DIR, icon.src.slice(BASE.length)))).toBe(true);
        }
    });
});
