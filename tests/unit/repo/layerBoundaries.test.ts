import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importSpecifiers } from './purityScanner';

const SRC_DIR = resolve(import.meta.dirname, '../../../src');
const I18N_DIR = resolve(SRC_DIR, 'i18n');

/** A relative specifier that resolves outside `src/i18n` into `app`, `features` or `ui`. */
const OTHER_LAYER_SPECIFIER = /^(?:\.\.\/)+(app|features|ui)(?:\/|$)/;
/** The one file allowed to import React and react-redux (D1: the only React-aware i18n file). */
const REACT_ALLOWED_FILE = 'useTranslate.ts';
const REACT_SPECIFIERS = new Set(['react', 'react-redux']);

function i18nFiles(dir: string, prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
        if (entry.isDirectory()) return i18nFiles(resolve(dir, entry.name), relativePath);
        return /\.tsx?$/.test(entry.name) ? [relativePath] : [];
    });
}

const PWA_DIR = resolve(SRC_DIR, 'pwa');
/** A relative specifier that resolves outside `src/pwa` into `app`, `features` or `ui`. */
const PWA_FORBIDDEN_SPECIFIER = /^(?:\.\.\/)+(app|features|ui)(?:\/|$)/;
const PWA_SPECIFIER = /(?:^|\/)pwa\/[^/]+$/;
const REGISTER_PWA_SPECIFIER = /(?:^|\/)registerPwa$/;

function sourceFiles(dir: string, prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
        if (entry.isDirectory()) return sourceFiles(resolve(dir, entry.name), relativePath);
        return /\.tsx?$/.test(entry.name) ? [relativePath] : [];
    });
}

function specifiersOf(file: string): string[] {
    return importSpecifiers(readFileSync(resolve(SRC_DIR, file), 'utf8'));
}

describe('src/pwa layer boundary', () => {
    const pwaFiles = sourceFiles(PWA_DIR).map((file) => `pwa/${file}`);
    const allFiles = sourceFiles(SRC_DIR);

    it('contains the three gateway modules', () => {
        expect([...pwaFiles].sort()).toEqual([
            'pwa/deferredGateway.ts',
            'pwa/installGateway.ts',
            'pwa/pwaGateway.ts',
            'pwa/registerPwa.ts',
        ]);
    });

    it('imports nothing from src/app, src/features or src/ui', () => {
        for (const file of pwaFiles) {
            expect(specifiersOf(file).filter((s) => PWA_FORBIDDEN_SPECIFIER.test(s))).toEqual([]);
        }
    });

    it('is not imported by any file in src/features or src/ui', () => {
        const offenders = allFiles
            .filter((file) => file.startsWith('features/') || file.startsWith('ui/'))
            .filter((file) => specifiersOf(file).some((s) => PWA_SPECIFIER.test(s)));
        expect(offenders).toEqual([]);
    });

    it('lets only pwa/registerPwa.ts import virtual:pwa-register', () => {
        const importers = allFiles.filter((file) => specifiersOf(file).includes('virtual:pwa-register'));
        expect(importers).toEqual(['pwa/registerPwa.ts']);
    });

    it('lets only main.tsx import registerPwa', () => {
        const importers = allFiles.filter((file) => specifiersOf(file).some((s) => REGISTER_PWA_SPECIFIER.test(s)));
        expect(importers.filter((file) => file !== 'main.tsx')).toEqual([]);
    });
});

describe('src/i18n layer boundary', () => {
    const files = i18nFiles(I18N_DIR);

    it('contains at least one TypeScript module', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    describe.each(files)('%s', (file) => {
        const source = readFileSync(resolve(I18N_DIR, file), 'utf8');
        const specifiers = importSpecifiers(source);

        it('imports nothing from src/app, src/features or src/ui', () => {
            expect(specifiers.filter((specifier) => OTHER_LAYER_SPECIFIER.test(specifier))).toEqual([]);
        });

        it('imports react or react-redux only from useTranslate.ts', () => {
            const reactImports = specifiers.filter((specifier) => REACT_SPECIFIERS.has(specifier));
            if (file === REACT_ALLOWED_FILE) return;
            expect(reactImports).toEqual([]);
        });
    });
});
