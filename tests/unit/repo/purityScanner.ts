/**
 * Source scanners shared by the layer-purity guards (`domainPurity.test.ts`, `solverPurity.test.ts`,
 * `boardPurity.test.ts`, `storageBoundary.test.ts`). This is a helper,
 * not a test file: Vitest only collects `*.test.ts`.
 */

/**
 * Removes comments. String and template literals are matched first and kept, so a `//` or `/*` inside one (such as a
 * URL) is never mistaken for the start of a comment. Known limit: a regex literal containing `//` would hide the rest
 * of its line; no guarded module has one.
 */
export function stripComments(source: string): string {
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
export function importSpecifiers(source: string): string[] {
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

export interface ImportStatement {
    specifier: string;
    /** True for `import type …` and `export type … from`. A `type` modifier inside braces does not count. */
    typeOnly: boolean;
}

/**
 * Every import and export-from statement (multi-line included), side-effect imports, dynamic `import()` and `require`
 * calls, each with whether the whole statement is type-only. `import { a, type B }` is a value import: it survives
 * compilation.
 */
export function importStatements(source: string): ImportStatement[] {
    const code = stripComments(source);
    const statements: ImportStatement[] = [];
    for (const match of code.matchAll(
        /\b(?:import|export)\b(\s+type\b(?!\s+from\b))?[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    )) {
        statements.push({ specifier: match[2] ?? '', typeOnly: match[1] !== undefined });
    }
    for (const match of code.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) {
        statements.push({ specifier: match[1] ?? '', typeOnly: false });
    }
    for (const match of code.matchAll(/\b(?:import|require)\s*\(([^)]*)\)/g)) {
        statements.push({ specifier: unquote(match[1] ?? ''), typeOnly: false });
    }
    return statements;
}

/** The DOM, storage and network facilities a pure layer may not reference, matched as whole identifiers. */
export const FORBIDDEN_IDENTIFIERS =
    /\b(?:document|window|navigator|localStorage|sessionStorage|indexedDB|caches|fetch|XMLHttpRequest|WebSocket|EventSource)\b/g;

export function forbiddenGlobals(source: string): string[] {
    const code = stripComments(source);
    const found: string[] = code.match(FORBIDDEN_IDENTIFIERS) ?? [];
    if (/\bMath\s*\.\s*random\b/.test(code)) found.push('Math.random');
    return found;
}

/** Whole-identifier `localStorage` and `sessionStorage` references in code (comments excluded). */
export function storageReferences(source: string): string[] {
    return stripComments(source).match(/\b(?:localStorage|sessionStorage)\b/g) ?? [];
}

export function usesCrypto(source: string): boolean {
    return /\bcrypto\b/.test(stripComments(source));
}

/** File names captured by `pattern` (group 1) from the bullets of a layer README. */
export function readmeModules(readme: string, pattern: RegExp): string[] {
    return [...readme.matchAll(pattern)].map((match) => match[1] ?? '');
}
