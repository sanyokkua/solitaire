import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageReferences } from './purityScanner';

const ROOT = resolve(import.meta.dirname, '../../..');
const SRC_DIR = resolve(ROOT, 'src');
/** The one module allowed to name browser storage. */
const GATEWAY_FILE = 'src/features/persistence/storageGateway.ts';

const sourceFiles = readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /\.tsx?$/.test(entry))
    .map((entry) => relative(ROOT, resolve(SRC_DIR, entry)).replaceAll('\\', '/'))
    .sort();

describe('storage reference scanner', () => {
    it('finds whole-identifier localStorage and sessionStorage references in code', () => {
        expect(storageReferences(`const a = localStorage;`)).toEqual(['localStorage']);
        expect(storageReferences(`window.sessionStorage.clear();`)).toEqual(['sessionStorage']);
        expect(storageReferences(`localStorage.getItem('k'); sessionStorage.length;`)).toEqual([
            'localStorage',
            'sessionStorage',
        ]);
    });

    it('ignores mentions that only appear in comments', () => {
        expect(storageReferences(`// uses localStorage\n/* sessionStorage */\nconst a = 1;`)).toEqual([]);
    });

    it('is not fooled by a // inside a string literal before real code', () => {
        expect(storageReferences(`const url = 'http://x'; const s = localStorage;`)).toEqual(['localStorage']);
    });

    it('does not match longer identifiers', () => {
        expect(storageReferences(`const myLocalStorage = 1; const localStorageKey = 2;`)).toEqual([]);
    });
});

describe('browser storage boundary', () => {
    it('scans the source tree', () => {
        expect(sourceFiles).toContain(GATEWAY_FILE);
    });

    it('is touched only by the storage gateway', () => {
        const offenders = sourceFiles
            .filter((file) => file !== GATEWAY_FILE)
            .filter((file) => storageReferences(readFileSync(resolve(ROOT, file), 'utf8')).length > 0);

        expect(offenders).toEqual([]);
    });
});
