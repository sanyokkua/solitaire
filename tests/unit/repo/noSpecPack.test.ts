// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The retired specification pack (the `spec` folder under `docs/`: the product specification, the research notes, the
 * phased design and the HTML mockup) must not exist, and no tracked file may refer to it. History that names it is
 * exempt: the OpenSpec change folders, a reference pinned to a git revision (`<sha>:<former path>`, which names history,
 * not the working tree) and this file, which has to spell out what it forbids. The bare word "mockup" is not forbidden.
 */
const ROOT = resolve(import.meta.dirname, '../../..');

const FORBIDDEN: readonly RegExp[] = [
    /docs\/spec/,
    /klondike-mockup/,
    /specification\.md/,
    /research\.md/,
    /phased-design/,
    /R§/,
    /spec §/,
    /specification §/,
];

/** A reference pinned to a git revision: a commit id, a colon and the file's former path. */
const REVISION_PINNED = /\b[0-9a-f]{7,40}:\S+/g;

/** Paths exempt from the scan. The main specs stay exempt until their citations are edited (task 14.4). */
const EXEMPT: readonly RegExp[] = [
    /^openspec\/changes\//,
    /^openspec\/specs\//,
    /^tests\/unit\/repo\/noSpecPack\.test\.ts$/,
];

export interface Reference {
    readonly file: string;
    readonly line: number;
    readonly text: string;
}

/** Every forbidden reference in `files`, in file and line order; revision-pinned references are not counted. */
export function findPackReferences(files: readonly { file: string; text: string }[]): Reference[] {
    const found: Reference[] = [];
    for (const { file, text } of files) {
        if (EXEMPT.some((pattern) => pattern.test(file))) continue;
        text.split('\n').forEach((line, index) => {
            const unpinned = line.replace(REVISION_PINNED, '');
            if (FORBIDDEN.some((pattern) => pattern.test(unpinned))) {
                found.push({ file, line: index + 1, text: line.trim().slice(0, 120) });
            }
        });
    }
    return found;
}

/** The tracked and new (not ignored) files that still exist and are text. */
function repositoryFiles(): { file: string; text: string }[] {
    const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    })
        .split('\0')
        .filter((file) => file !== '');
    return listed
        .filter((file) => existsSync(resolve(ROOT, file)))
        .map((file) => ({ file, text: readFileSync(resolve(ROOT, file)).toString('utf8') }))
        .filter(({ text }) => !text.includes('\0'));
}

describe('the retired specification pack', () => {
    it('is gone from the working tree', () => {
        expect(existsSync(resolve(ROOT, 'docs/spec'))).toBe(false);
    });

    it('is not referred to by any tracked or new file', () => {
        const references = findPackReferences(repositoryFiles());

        expect(references.map(({ file, line, text }) => `${file}:${String(line)}: ${text}`)).toEqual([]);
    });
});

describe('the reference scan', () => {
    const scan = (text: string, file = 'src/a.ts') => findPackReferences([{ file, text }]);

    it('names the file and line of a research-notes citation', () => {
        expect(scan('one\n// see R§13.1 for the sizes\n')).toEqual([
            { file: 'src/a.ts', line: 2, text: '// see R§13.1 for the sizes' },
        ]);
    });

    it('names the file and line of a specification section citation', () => {
        expect(scan('// per spec §3.2', 'docs/x.md')).toHaveLength(1);
        expect(scan('// per specification §8', 'docs/x.md')).toHaveLength(1);
    });

    it.each(['docs/spec/README.md', 'klondike-mockup.html', 'the specification.md', 'research.md', 'phased-design'])(
        'refuses a path or name of the pack: %s',
        (text) => {
            expect(scan(text)).toHaveLength(1);
        },
    );

    it('accepts a reference pinned to a git revision', () => {
        expect(scan('`git show d72187f:docs/spec/mockup/klondike-mockup.html`')).toEqual([]);
        expect(scan('see d72187f:docs/spec/research.md')).toEqual([]);
    });

    it('still refuses a line that has both a pinned and an unpinned reference', () => {
        expect(scan('d72187f:docs/spec/research.md and docs/spec/README.md')).toHaveLength(1);
    });

    it('exempts change history and does not forbid the bare word "mockup"', () => {
        expect(scan('docs/spec/research.md R§4', 'openspec/changes/archive/x/tasks.md')).toEqual([]);
        expect(scan('// as drawn in the mockup')).toEqual([]);
    });
});
