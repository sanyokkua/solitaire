import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { forbiddenGlobals, importSpecifiers, readmeModules, usesCrypto } from './purityScanner';

const DOMAIN_DIR = resolve(import.meta.dirname, '../../../src/domain');
const SIBLING_SPECIFIER = /^\.\/[A-Za-z]+(\.js)?$/;

function offendingSpecifiers(source: string): string[] {
    return importSpecifiers(source).filter((specifier) => !SIBLING_SPECIFIER.test(specifier));
}

const domainFiles = readdirSync(DOMAIN_DIR).filter((entry) => /\.[cm]?tsx?$/.test(entry));

describe('domain purity scanner', () => {
    it('flags imports that leave the domain directory', () => {
        expect(offendingSpecifiers(`import { x } from '../app/store';`)).toEqual(['../app/store']);
        expect(offendingSpecifiers(`import type { X } from 'react';`)).toEqual(['react']);
        expect(offendingSpecifiers(`export * from '../solver/worker';`)).toEqual(['../solver/worker']);
        expect(offendingSpecifiers(`import '../polyfill';`)).toEqual(['../polyfill']);
        expect(offendingSpecifiers(`const m = await import('node:fs');`)).toEqual(['node:fs']);
        expect(offendingSpecifiers(`const m = await import(name);`)).toEqual(['name']);
        expect(offendingSpecifiers(`import {\n    a,\n    b,\n} from './sub/deep';`)).toEqual(['./sub/deep']);
    });

    it('accepts sibling-module imports', () => {
        expect(offendingSpecifiers(`import type { CardId } from './types';`)).toEqual([]);
        expect(offendingSpecifiers(`import { cardId } from './cards.js';`)).toEqual([]);
        expect(offendingSpecifiers(`export { mulberry32 } from './prng';`)).toEqual([]);
    });

    it('ignores specifiers that only appear in comments', () => {
        expect(offendingSpecifiers(`// import { x } from '../app/store';\n/* import 'react'; */`)).toEqual([]);
    });

    it('flags browser globals, storage, fetch and Math.random', () => {
        expect(forbiddenGlobals(`document.title = 'x';`)).toEqual(['document']);
        expect(forbiddenGlobals(`const w = window.innerWidth;`)).toEqual(['window']);
        expect(forbiddenGlobals(`localStorage.getItem('k');`)).toEqual(['localStorage']);
        expect(forbiddenGlobals(`sessionStorage.clear();`)).toEqual(['sessionStorage']);
        expect(forbiddenGlobals(`await fetch('/x');`)).toEqual(['fetch']);
        expect(forbiddenGlobals(`const r = Math.random();`)).toEqual(['Math.random']);
    });

    it.each(['navigator', 'indexedDB', 'caches', 'XMLHttpRequest', 'WebSocket', 'EventSource'])(
        'flags %s',
        (identifier) => {
            expect(forbiddenGlobals(`const x = ${identifier};`)).toEqual([identifier]);
        },
    );

    it('does not mistake a // or /* inside a string for a comment', () => {
        expect(forbiddenGlobals(`const u = 'https://x'; fetch(u);`)).toEqual(['fetch']);
        expect(forbiddenGlobals(`const s = "// not a comment"; window.x = 1;`)).toEqual(['window']);
        expect(forbiddenGlobals('const t = `/*`; document.title = t; // */')).toEqual(['document']);
        expect(offendingSpecifiers(`const u = 'http://x'; import('../app/store');`)).toEqual(['../app/store']);
    });

    it('matches whole words only and ignores comments', () => {
        expect(forbiddenGlobals(`const documented = windowed + prefetch;`)).toEqual([]);
        expect(forbiddenGlobals(`// the document is a window\n/* fetch */`)).toEqual([]);
    });

    it('flags crypto usage', () => {
        expect(usesCrypto(`crypto.getRandomValues(buffer);`)).toBe(true);
        expect(usesCrypto(`globalThis.crypto`)).toBe(true);
        expect(usesCrypto(`const cryptography = 1; // crypto`)).toBe(false);
    });
});

describe('src/domain purity (D10)', () => {
    it('contains at least one TypeScript module', () => {
        expect(domainFiles.length).toBeGreaterThan(0);
    });

    it('contains exactly the modules listed in src/domain/README.md plus the README', () => {
        const listed = readmeModules(readFileSync(resolve(DOMAIN_DIR, 'README.md'), 'utf8'), /^- `([A-Za-z]+\.ts)`/gm);
        expect(listed.length).toBeGreaterThan(0);
        expect(readdirSync(DOMAIN_DIR).sort()).toEqual([...listed, 'README.md'].sort());
    });

    describe.each(domainFiles)('%s', (file) => {
        const source = readFileSync(resolve(DOMAIN_DIR, file), 'utf8');

        it('imports only sibling modules', () => {
            expect(offendingSpecifiers(source)).toEqual([]);
        });

        it('uses no DOM, storage, network or unseeded randomness', () => {
            expect(forbiddenGlobals(source)).toEqual([]);
        });
    });

    it('references crypto in exactly one module, prng.ts', () => {
        const users = domainFiles.filter((file) => usesCrypto(readFileSync(resolve(DOMAIN_DIR, file), 'utf8')));
        expect(users).toEqual(['prng.ts']);
    });
});
