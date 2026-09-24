import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { forbiddenGlobals, importSpecifiers, readmeModules, stripComments, usesCrypto } from './purityScanner';

const SOLVER_DIR = resolve(import.meta.dirname, '../../../src/solver');
const WORKER_FILE = 'solver.worker.ts';
/** A sibling solver module (`./name`) or a domain module (`../domain/name`); nothing else. */
const ALLOWED_SPECIFIER = /^(?:\.\/[A-Za-z]+|\.\.\/domain\/[A-Za-z]+)(?:\.js)?$/;

function offendingSpecifiers(source: string): string[] {
    return importSpecifiers(source).filter((specifier) => !ALLOWED_SPECIFIER.test(specifier));
}

/** Whether the code names `self`, the worker global scope, which only the worker entry point may touch. */
function referencesSelf(source: string): boolean {
    return /\bself\b/.test(stripComments(source));
}

const solverFiles = readdirSync(SOLVER_DIR).filter((entry) => /\.[cm]?tsx?$/.test(entry));

describe('solver purity scanner', () => {
    it('accepts sibling solver modules and domain modules', () => {
        expect(offendingSpecifiers(`import { line } from './line';`)).toEqual([]);
        expect(offendingSpecifiers(`import { solve } from './solver.js';`)).toEqual([]);
        expect(offendingSpecifiers(`import { applyCommand } from '../domain/engine';`)).toEqual([]);
        expect(offendingSpecifiers(`import type { GameState } from '../domain/types.js';`)).toEqual([]);
    });

    it('flags imports of any other layer, package or nested path', () => {
        expect(offendingSpecifiers(`import { x } from '../features/x';`)).toEqual(['../features/x']);
        expect(offendingSpecifiers(`import { x } from '../app/store';`)).toEqual(['../app/store']);
        expect(offendingSpecifiers(`import type { X } from 'react';`)).toEqual(['react']);
        expect(offendingSpecifiers(`import { x } from '../domain/sub/x';`)).toEqual(['../domain/sub/x']);
        expect(offendingSpecifiers(`import { x } from './sub/x';`)).toEqual(['./sub/x']);
        expect(offendingSpecifiers(`import { x } from '../domain';`)).toEqual(['../domain']);
        expect(offendingSpecifiers(`const m = await import('node:fs');`)).toEqual(['node:fs']);
    });

    it('ignores specifiers that only appear in comments', () => {
        expect(offendingSpecifiers(`// import { x } from '../app/store';\n/* import 'react'; */`)).toEqual([]);
    });

    it.each([
        'document',
        'window',
        'navigator',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'caches',
        'fetch',
        'XMLHttpRequest',
        'WebSocket',
        'EventSource',
    ])('flags %s', (identifier) => {
        expect(forbiddenGlobals(`const x = ${identifier};`)).toEqual([identifier]);
    });

    it('flags Math.random and crypto', () => {
        expect(forbiddenGlobals(`const r = Math.random();`)).toEqual(['Math.random']);
        expect(usesCrypto(`crypto.getRandomValues(new Uint8Array(1));`)).toBe(true);
        expect(usesCrypto(`globalThis.crypto`)).toBe(true);
        expect(usesCrypto(`const cryptography = 1; // crypto`)).toBe(false);
    });

    it('flags self as a whole word outside comments', () => {
        expect(referencesSelf(`self.postMessage(1);`)).toBe(true);
        expect(referencesSelf(`addEventListener; const s = self;`)).toBe(true);
        expect(referencesSelf(`const itself = 1; const selfish = 2;`)).toBe(false);
        expect(referencesSelf(`// self is the worker scope\n/* self */`)).toBe(false);
    });
});

describe('src/solver purity (D10)', () => {
    it('contains exactly the modules listed in src/solver/README.md plus the README', () => {
        const listed = readmeModules(
            readFileSync(resolve(SOLVER_DIR, 'README.md'), 'utf8'),
            /^- `([A-Za-z]+(?:\.worker)?\.ts)`/gm,
        );
        expect(readdirSync(SOLVER_DIR).sort()).toEqual([...listed, 'README.md'].sort());
    });

    // One block per solver module, so a new module is guarded as soon as it is added.
    describe.each(solverFiles)('%s', (file) => {
        const source = readFileSync(resolve(SOLVER_DIR, file), 'utf8');

        it('imports only sibling solver modules and domain modules', () => {
            expect(offendingSpecifiers(source)).toEqual([]);
        });

        it('uses no DOM, storage, network, crypto or unseeded randomness', () => {
            expect(forbiddenGlobals(source)).toEqual([]);
            expect(usesCrypto(source)).toBe(false);
        });

        it.skipIf(file === WORKER_FILE)('does not reference self (only the worker entry point may)', () => {
            expect(referencesSelf(source)).toBe(false);
        });
    });
});
