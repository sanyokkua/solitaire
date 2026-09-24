import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DOMAIN_DIR = resolve(import.meta.dirname, '../../../src/domain');
const SIBLING_SPECIFIER = /^\.\/[A-Za-z]+(\.js)?$/;

/**
 * Removes comments. String and template literals are matched first and kept, so a `//` or `/*` inside one (such as a
 * URL) is never mistaken for the start of a comment. Known limit: a regex literal containing `//` would hide the rest
 * of its line; no domain module has one.
 */
function stripComments(source: string): string {
    return source.replace(
        /('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/.*$/gm,
        (_match, literal: string | undefined) => literal ?? '',
    );
}

function unquote(expression: string): string {
    const match = /^\s*(['"`])(.*)\1\s*$/.exec(expression);
    return match?.[2] ?? expression.trim();
}

/** Specifiers of static, export-from, side-effect and dynamic imports, plus require calls. */
function importSpecifiers(source: string): string[] {
    const code = stripComments(source);
    const specifiers: string[] = [];
    for (const match of code.matchAll(/\b(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g)) {
        specifiers.push(match[1] ?? '');
    }
    for (const match of code.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) {
        specifiers.push(match[1] ?? '');
    }
    for (const match of code.matchAll(/\b(?:import|require)\s*\(([^)]*)\)/g)) {
        specifiers.push(unquote(match[1] ?? ''));
    }
    return specifiers;
}

function offendingSpecifiers(source: string): string[] {
    return importSpecifiers(source).filter((specifier) => !SIBLING_SPECIFIER.test(specifier));
}

/** The DOM, storage and network facilities the domain may not reference, matched as whole identifiers. */
const FORBIDDEN_IDENTIFIERS =
    /\b(?:document|window|navigator|localStorage|sessionStorage|indexedDB|caches|fetch|XMLHttpRequest|WebSocket|EventSource)\b/g;

function forbiddenGlobals(source: string): string[] {
    const code = stripComments(source);
    const found: string[] = code.match(FORBIDDEN_IDENTIFIERS) ?? [];
    if (/\bMath\s*\.\s*random\b/.test(code)) found.push('Math.random');
    return found;
}

function usesCrypto(source: string): boolean {
    return /\bcrypto\b/.test(stripComments(source));
}

/** Module file names listed as backticked `name.ts` entries at the start of a bullet in the domain README. */
function readmeModules(readme: string): string[] {
    return [...readme.matchAll(/^- `([A-Za-z]+\.ts)`/gm)].map((match) => match[1] ?? '');
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
        const listed = readmeModules(readFileSync(resolve(DOMAIN_DIR, 'README.md'), 'utf8'));
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
