import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RESERVED_LAYERS = ['i18n', 'pwa'];

describe('reserved layer directories carry no behaviour', () => {
    it.each(RESERVED_LAYERS)('src/%s contains only README.md', (layer) => {
        const entries = readdirSync(resolve(import.meta.dirname, '../../../src', layer));

        expect(entries).toEqual(['README.md']);
    });
});
