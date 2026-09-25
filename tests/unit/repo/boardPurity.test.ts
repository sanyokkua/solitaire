import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { forbiddenGlobals, importSpecifiers, readmeModules, stripComments, usesCrypto } from './purityScanner';

const UI_DIR = resolve(import.meta.dirname, '../../../src/ui');
const ESLINT_CONFIG = resolve(import.meta.dirname, '../../../eslint.config.js');
/** Timers, clocks and DOM entry points the shared scanner does not cover but the layout spec rules out. */
const BOARD_ONLY_IDENTIFIERS =
    /\b(?:setTimeout|setInterval|requestAnimationFrame|Date|performance|matchMedia|ResizeObserver|getComputedStyle|globalThis|self)\b/g;
/** A sibling board module (`./name`) or a domain module (`../../domain/name`); nothing else. */
const ALLOWED_SPECIFIER = /^(?:\.\/[A-Za-z]+|\.\.\/\.\.\/domain\/[A-Za-z]+)(?:\.js)?$/;

function timersAndDomApis(source: string): string[] {
    return stripComments(source).match(BOARD_ONLY_IDENTIFIERS) ?? [];
}

function offendingSpecifiers(source: string): string[] {
    return importSpecifiers(source).filter((specifier) => !ALLOWED_SPECIFIER.test(specifier));
}

const pureModules = readmeModules(readFileSync(resolve(UI_DIR, 'README.md'), 'utf8'), /^- `(board\/[A-Za-z]+\.ts)`/gm);

describe('board purity scanner', () => {
    it('accepts sibling board modules and domain modules', () => {
        expect(offendingSpecifiers(`import { measure } from './metrics';`)).toEqual([]);
        expect(offendingSpecifiers(`import type { Metrics } from './metrics.js';`)).toEqual([]);
        expect(offendingSpecifiers(`import { applyCommand } from '../../domain/engine';`)).toEqual([]);
        expect(offendingSpecifiers(`import type { GameState } from '../../domain/types.js';`)).toEqual([]);
    });

    it('flags imports of any other layer, package or nested path', () => {
        expect(offendingSpecifiers(`import { useState } from 'react';`)).toEqual(['react']);
        expect(offendingSpecifiers(`import { x } from '../../features/x';`)).toEqual(['../../features/x']);
        expect(offendingSpecifiers(`import { x } from '../domain/x';`)).toEqual(['../domain/x']);
        expect(offendingSpecifiers(`import { x } from '../../domain/sub/x';`)).toEqual(['../../domain/sub/x']);
        expect(offendingSpecifiers(`import { x } from './sub/x';`)).toEqual(['./sub/x']);
        expect(offendingSpecifiers(`const m = await import('node:fs');`)).toEqual(['node:fs']);
    });

    it('flags DOM globals, Math.random and crypto', () => {
        expect(forbiddenGlobals(`const w = window.innerWidth;`)).toEqual(['window']);
        expect(forbiddenGlobals(`const el = document.body;`)).toEqual(['document']);
        expect(forbiddenGlobals(`const r = Math.random();`)).toEqual(['Math.random']);
        expect(usesCrypto(`crypto.getRandomValues(new Uint8Array(1));`)).toBe(true);
    });

    it('flags timers, clocks and DOM entry points', () => {
        expect(timersAndDomApis(`setTimeout(fn, 1);`)).toEqual(['setTimeout']);
        expect(timersAndDomApis(`const t = Date.now();`)).toEqual(['Date']);
        expect(timersAndDomApis(`const c = matchMedia('(pointer: coarse)').matches;`)).toEqual(['matchMedia']);
        expect(timersAndDomApis(`new ResizeObserver(cb); getComputedStyle(el); globalThis.x;`)).toEqual([
            'ResizeObserver',
            'getComputedStyle',
            'globalThis',
        ]);
        expect(timersAndDomApis(`// setTimeout, Date and self are only named here\nconst update = 1;`)).toEqual([]);
    });
});

describe('src/ui board purity (D6)', () => {
    it('lists at least one pure board module in src/ui/README.md, and each exists', () => {
        expect(pureModules.length).toBeGreaterThan(0);
        for (const file of pureModules) {
            expect(existsSync(resolve(UI_DIR, file)), `${file} listed in src/ui/README.md`).toBe(true);
        }
    });

    it('names every listed module in the ESLint import override', () => {
        const config = readFileSync(ESLINT_CONFIG, 'utf8');
        for (const file of pureModules) {
            expect(config, `${file} in eslint.config.js`).toContain(`src/ui/${file}`);
        }
    });

    // One block per listed module, so a new pure module is guarded as soon as it is listed.
    describe.each(pureModules)('%s', (file) => {
        const source = readFileSync(resolve(UI_DIR, file), 'utf8');

        it('imports only sibling board modules and domain modules', () => {
            expect(offendingSpecifiers(source)).toEqual([]);
        });

        it('uses no DOM, storage, network, crypto or unseeded randomness', () => {
            expect(forbiddenGlobals(source)).toEqual([]);
            expect(usesCrypto(source)).toBe(false);
        });

        it('uses no timers, clocks or DOM entry points', () => {
            expect(timersAndDomApis(source)).toEqual([]);
        });
    });
});
