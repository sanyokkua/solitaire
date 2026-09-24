/**
 * Source scanners shared by the layer-purity guards (`domainPurity.test.ts`, `solverPurity.test.ts`). This is a helper,
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

/** The DOM, storage and network facilities a pure layer may not reference, matched as whole identifiers. */
export const FORBIDDEN_IDENTIFIERS =
    /\b(?:document|window|navigator|localStorage|sessionStorage|indexedDB|caches|fetch|XMLHttpRequest|WebSocket|EventSource)\b/g;

export function forbiddenGlobals(source: string): string[] {
    const code = stripComments(source);
    const found: string[] = code.match(FORBIDDEN_IDENTIFIERS) ?? [];
    if (/\bMath\s*\.\s*random\b/.test(code)) found.push('Math.random');
    return found;
}

export function usesCrypto(source: string): boolean {
    return /\bcrypto\b/.test(stripComments(source));
}

/** File names captured by `pattern` (group 1) from the bullets of a layer README. */
export function readmeModules(readme: string, pattern: RegExp): string[] {
    return [...readme.matchAll(pattern)].map((match) => match[1] ?? '');
}
