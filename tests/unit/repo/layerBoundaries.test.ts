import { readdirSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importSpecifiers, importStatements } from './purityScanner';

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

/** app modules a features file may value-import: the slice (actions, selectors, types) and the selectors over it. */
const APP_VALUE_MODULES = new Set(['app/appSlice', 'app/selectors']);
/** app modules a features file may import as types only: the thunk type and the store's state and dispatch types. */
const APP_TYPE_MODULES = new Set(['app/appThunk', 'app/store']);

/**
 * Imports in a `src/features` file (path relative to `src`, source text) that break the features → app direction:
 * anything from `src/ui`, and anything from `src/app` beyond the slice, `app/selectors`, and the type-only thunk and
 * store types. Pure so that fixture sources can be checked without touching the disk.
 */
function featuresImportViolations(file: string, source: string): string[] {
    const violations: string[] = [];
    for (const { specifier, typeOnly } of importStatements(source)) {
        if (!specifier.startsWith('.')) continue;
        const target = posix.normalize(posix.join(posix.dirname(file), specifier)).replace(/\.tsx?$/, '');
        if (target === 'ui' || target.startsWith('ui/')) {
            violations.push(`${file}: imports the interface layer (${specifier})`);
        } else if (target === 'app' || target.startsWith('app/')) {
            const allowed = APP_VALUE_MODULES.has(target) || (typeOnly && APP_TYPE_MODULES.has(target));
            if (!allowed) violations.push(`${file}: ${typeOnly ? 'type ' : ''}import of ${specifier} is not allowed`);
        }
    }
    return violations;
}

describe('src/features → src/app import direction', () => {
    const featureFiles = sourceFiles(resolve(SRC_DIR, 'features')).map((file) => `features/${file}`);

    it('finds the features modules', () => {
        expect(featureFiles.length).toBeGreaterThan(0);
    });

    it('imports from src/app only the slice, app/selectors and the type-only thunk and store types, and nothing from src/ui', () => {
        const violations = featureFiles.flatMap((file) =>
            featuresImportViolations(file, readFileSync(resolve(SRC_DIR, file), 'utf8')),
        );
        expect(violations).toEqual([]);
    });

    describe('reports', () => {
        it.each([
            ["import { store } from '../../app/store';", 'the store instance as a value'],
            ["import { createAppStore } from '../../app/store';", 'the store factory as a value'],
            ["import { store, type RootState } from '../../app/store';", 'a mixed import from the store'],
            [
                "import { type RootState } from '../../app/store';",
                'an inline-type import (a value import after compilation)',
            ],
            ["import * as store from '../../app/store';", 'a namespace value import of the store'],
            ["import { startApp } from '../../app/lifecycle';", 'the lifecycle'],
            ["import type { StartOptions } from '../../app/lifecycle';", 'a type from the lifecycle'],
            ["import { useAppDispatch } from '../../app/hooks';", 'the typed hooks'],
            ["import { assembleThunkExtra } from '../../app/thunkExtra';", 'the thunk dependencies'],
            ["import { applyTheme } from '../../app/themeController';", 'the theme controller'],
            ["import { AppThunk } from '../../app/appThunk';", 'the thunk type as a value import'],
            ["import { type AppThunk } from '../../app/appThunk';", 'the thunk type through an inline modifier'],
            ["import '../../app/store';", 'a side-effect import of the store'],
            ["const m = await import('../../app/store');", 'a dynamic import of the store'],
            ["export { store } from '../../app/store';", 'a re-export of the store'],
            ["import { Board } from '../../ui/board/Board';", 'an interface-layer module'],
            ["import type { CardProps } from '../../ui/board/Card';", 'an interface-layer type'],
            ["import { x } from '../../ui';", 'the interface layer root'],
            [
                ['import {', '    store,', '    type RootState,', "} from '../../app/store';"].join('\n'),
                'a multi-line mixed import of the store',
            ],
        ])('%s (%s)', (source) => {
            expect(featuresImportViolations('features/game/example.ts', source)).toHaveLength(1);
        });

        it('resolves the specifier from the importing file, so a shallower features file is still checked', () => {
            expect(
                featuresImportViolations('features/example.ts', "import { store } from '../app/store';"),
            ).toHaveLength(1);
        });

        it('ignores an import inside a comment', () => {
            expect(
                featuresImportViolations('features/game/example.ts', "// import { store } from '../../app/store';"),
            ).toEqual([]);
        });
    });

    describe('accepts', () => {
        it.each([
            "import { noticeRaised } from '../../app/appSlice';",
            "import type { AppState } from '../../app/appSlice';",
            "import { selectReducedMotion } from '../../app/selectors';",
            "import type { AppThunk } from '../../app/appThunk';",
            "import type { RootState } from '../../app/store';",
            "import type { RootState, AppDispatch } from '../../app/store';",
            "import { setRoute, sheetClosed, sheetOpened, type SheetId } from '../../app/appSlice';",
            ['import type {', '    AppDispatch,', '    RootState,', "} from '../../app/store';"].join('\n'),
            ['import {', '    dealingEnded,', '    type NoticeId,', "} from '../../app/appSlice';"].join('\n'),
            "import { applyCommand } from '../../domain/rules';",
            "import { dealSlice } from '../deal/dealSlice';",
            "import { useEffect } from 'react';",
        ])('%s', (source) => {
            expect(featuresImportViolations('features/game/example.ts', source)).toEqual([]);
        });
    });
});
