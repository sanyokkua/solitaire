// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The maintained documentation must not point at files that are not there. Every relative Markdown link, and every
 * repository path cited in inline code (a token that starts with `src/`, `tests/`, `docs/`, `scripts/`, `public/`,
 * `openspec/` or `.github/`, with an optional `#symbol` or `:line`), has to resolve to a file or a directory. Globs,
 * brace lists, placeholders, generated output and external links are not paths and are skipped.
 */
const ROOT = resolve(import.meta.dirname, '../../..');

const PATH_PREFIXES = ['src/', 'tests/', 'docs/', 'scripts/', 'public/', 'openspec/', '.github/'];
const GENERATED = ['dist/', 'coverage/', 'playwright-report/', 'test-results/'];
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i;

/** The maintained documents: the README, the changelog, `docs/`, the module READMEs and the agent instructions. */
const MAINTAINED = [
    /^README\.md$/,
    /^CHANGELOG\.md$/,
    /^AGENTS\.md$/,
    /^docs\/.+\.md$/,
    /^(?:src|tests)\/(?:.+\/)?README\.md$/,
];

export interface BrokenLink {
    readonly file: string;
    readonly line: number;
    readonly target: string;
}

/** Whether a token names something that is not a repository path to check. */
function isNotAPath(token: string): boolean {
    return /[*{}<>…\s|]/.test(token) || GENERATED.some((folder) => token.startsWith(folder));
}

/** The relative link targets and the cited repository paths of one document, with their line numbers. */
function referencesOf(file: string, text: string): { line: number; target: string; resolved: string }[] {
    const found: { line: number; target: string; resolved: string }[] = [];
    let fenced = false;
    text.split('\n').forEach((line, index) => {
        if (line.trimStart().startsWith('```')) {
            fenced = !fenced;
            return;
        }
        if (fenced) return;
        // Inline code is checked as a path; what a link's text or target holds is checked once, as the link.
        const withoutCode = line.replace(/`[^`]*`/g, (span) => ' '.repeat(span.length));
        for (const [, angled = '', bare = ''] of withoutCode.matchAll(
            /\]\((?:<([^>]+)>|([^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\)/g,
        )) {
            const target = angled || bare;
            if (EXTERNAL.test(target)) continue;
            const path = decodeURI((target.split('#')[0] ?? '').split('?')[0] ?? '');
            if (path === '' || isNotAPath(path)) continue;
            // A root-relative link starts at the repository root, any other one at the document's folder.
            const resolved = path.startsWith('/')
                ? posix.normalize(path.slice(1))
                : posix.normalize(posix.join(posix.dirname(file), path));
            found.push({ line: index + 1, target, resolved: resolved.replace(/\/$/, '') });
        }
        for (const [, span = ''] of line.matchAll(/`([^`]+)`/g)) {
            if (!PATH_PREFIXES.some((prefix) => span.startsWith(prefix)) || isNotAPath(span)) continue;
            const path = span.replace(/[#:].*$/, '').replace(/[.,;]+$/, '');
            found.push({ line: index + 1, target: span, resolved: posix.normalize(path).replace(/\/$/, '') });
        }
    });
    return found;
}

/** The links and cited paths of `documents` that `exists` does not find, in document and line order. */
export function findBrokenLinks(
    documents: readonly { file: string; text: string }[],
    exists: (path: string) => boolean,
): BrokenLink[] {
    return documents.flatMap(({ file, text }) =>
        referencesOf(file, text)
            .filter(({ resolved }) => !exists(resolved))
            .map(({ line, target }) => ({ file, line, target })),
    );
}

function maintainedDocuments(): { file: string; text: string }[] {
    const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    })
        .split('\0')
        .filter(
            (file) =>
                file !== '' && MAINTAINED.some((pattern) => pattern.test(file)) && existsSync(resolve(ROOT, file)),
        );
    return listed.map((file) => ({ file, text: readFileSync(resolve(ROOT, file), 'utf8') }));
}

describe('the maintained documentation', () => {
    it('links only to files and folders that exist', () => {
        const broken = findBrokenLinks(maintainedDocuments(), (path) => existsSync(resolve(ROOT, path)));

        expect(broken.map(({ file, line, target }) => `${file}:${String(line)}: ${target}`)).toEqual([]);
    });
});

describe('the link check', () => {
    const present = new Set(['docs/a.md', 'docs/b/c.md', 'src/x/y.ts', 'src/x']);
    const check = (text: string, file = 'docs/a.md') => findBrokenLinks([{ file, text }], (path) => present.has(path));

    it('names the file, line and target of a broken relative link', () => {
        expect(check('one\n[gone](missing.md)\n')).toEqual([{ file: 'docs/a.md', line: 2, target: 'missing.md' }]);
    });

    it('resolves a relative link from the document folder, ignoring its anchor and query', () => {
        expect(check('[c](b/c.md#part) and [up](../docs/a.md) and [q](b/c.md?plain=1)')).toEqual([]);
    });

    it('reads an angle-bracket target, a single-quoted title and a root-relative link', () => {
        expect(check("[a](<b/c.md>) [t](b/c.md 'Title') [r](/docs/a.md)")).toEqual([]);
        expect(check('[a](<b/gone.md>)')).toHaveLength(1);
    });

    it('checks a cited repository path, with or without a symbol or a line', () => {
        expect(check('`src/x/y.ts` `src/x/y.ts#thing` `src/x/y.ts:42` `src/x/`')).toEqual([]);
        expect(check('`src/x/gone.ts#thing`')).toEqual([{ file: 'docs/a.md', line: 1, target: 'src/x/gone.ts#thing' }]);
    });

    it('catches a moved source file cited with a symbol', () => {
        expect(check('see `src/old/moved.ts#helper`')).toHaveLength(1);
    });

    it('skips globs, brace lists, placeholders, generated folders, external links and fenced code', () => {
        const text = [
            '`src/**/*.ts` `tests/{unit,e2e}/` `docs/<name>.md` `dist/index.html` `test-results/x/`',
            '[site](https://example.com/gone) [mail](mailto:a@b.c) [top](#top)',
            '```',
            'src/nowhere.ts',
            '```',
            '`rtk npm run e2e` `not/a/prefix.ts`',
        ].join('\n');

        expect(check(text)).toEqual([]);
    });

    it('does not read a path that only appears in a link text as a second reference', () => {
        expect(check('[`src/x/y.ts`](../src/x/y.ts)')).toEqual([]);
    });
});
