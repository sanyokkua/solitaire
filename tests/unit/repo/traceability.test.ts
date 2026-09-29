// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    MATRIX_PATH,
    analyze,
    extractIds,
    formatMatrix,
    generateMatrix,
    parseManualChecks,
    renderMatrix,
} from '../../../scripts/trace-requirements.mjs';

/**
 * Report mode: ids that no test and no manual check covers are listed in the matrix but do not fail the guard. Task
 * 11.8 sets this to `true` once every main-spec id is covered.
 */
const STRICT = false as boolean;

const REPO = resolve(import.meta.dirname, '../../..');
const SCRIPT = join(REPO, 'scripts/trace-requirements.mjs');
const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A scratch project root holding the given files (path relative to the root to content). */
function project(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'trace-'));
    tempDirs.push(root);
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

/** A spec with one requirement per `[name, footnote]` pair. */
function spec(...requirements: [string, string][]): string {
    const blocks = requirements.map(
        ([name, footnote]) =>
            `### Requirement: ${name}\n\nThe system SHALL do it.\n\n*(${footnote})*\n\n#### Scenario: It works\n\n- **WHEN** it runs\n- **THEN** it works\n`,
    );
    return `# a/b Specification\n\n## Requirements\n\n${blocks.join('\n')}`;
}

const MAIN = 'openspec/specs/dom/cap/spec.md';
const DELTA = 'openspec/changes/next/specs/dom/cap/spec.md';
const MANUAL = 'docs/reference/manual-checks.md';
const BASE = {
    [MAIN]: spec(['Alpha', 'KS-AAA-01, KS-AAA-02'], ['Beta', 'KS-BBB-01…03']),
    'tests/unit/alpha.test.ts': '// covers: KS-AAA-01, KS-BBB-01…02\nexport {};\n',
};

describe('the real repository', () => {
    it('has a committed matrix that equals a fresh generation', async () => {
        const committed = readFileSync(join(REPO, MATRIX_PATH), 'utf-8');

        expect(committed, 'the matrix is out of date: run `rtk npm run trace` and commit it').toBe(
            await generateMatrix(REPO),
        );
    });

    it('has no test or manual check that declares an unknown id', () => {
        expect(analyze(REPO).unknown).toEqual([]);
    });

    it('lists the uncovered ids, and fails on them only in strict mode', () => {
        const { uncovered } = analyze(REPO);

        expect((STRICT ? uncovered : []).map(({ id }) => id)).toEqual([]);
    });
});

describe('the traceability matrix', () => {
    it('lists each id with its requirements, tests and manual checks, and a second run changes nothing', async () => {
        const root = project({
            ...BASE,
            [MANUAL]: '| Check | KS ids |\n| --- | --- |\n| Real phone | KS-AAA-02 |\n',
        });

        const matrix = await generateMatrix(root);

        expect(matrix).toContain('## KS-AAA-01');
        expect(matrix).toContain('`dom/cap`: Alpha');
        expect(matrix).toContain('`tests/unit/alpha.test.ts`');
        expect(matrix).toContain('- Real phone');
        expect(await generateMatrix(root)).toBe(matrix);
    });

    it('is in id order whatever order the specs and tests are read in', async () => {
        const matrix = await generateMatrix(project(BASE));

        const order = ['KS-AAA-01', 'KS-AAA-02', 'KS-BBB-01', 'KS-BBB-02', 'KS-BBB-03'].map((id) =>
            matrix.indexOf(`## ${id}`),
        );
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(order.every((position) => position >= 0)).toBe(true);
    });

    it('is left unchanged by Prettier', async () => {
        const matrix = await generateMatrix(project(BASE));

        expect(await formatMatrix(matrix)).toBe(matrix);
        expect(await formatMatrix(renderMatrix(analyze(project(BASE))))).toBe(matrix);
    });

    it('is stale when a test adds a coverage comment and the matrix is not regenerated', async () => {
        const root = project(BASE);
        const committed = await generateMatrix(root);

        writeFileSync(join(root, 'tests/unit/alpha.test.ts'), '// covers: KS-AAA-01, KS-AAA-02\nexport {};\n');

        expect(await generateMatrix(root)).not.toBe(committed);
    });

    it('reads a range as every id in it', () => {
        expect(extractIds('KS-INP-04…08, KS-INP-10 and KS-PWA-01…03')).toEqual([
            'KS-INP-04',
            'KS-INP-05',
            'KS-INP-06',
            'KS-INP-07',
            'KS-INP-08',
            'KS-INP-10',
            'KS-PWA-01',
            'KS-PWA-02',
            'KS-PWA-03',
        ]);
    });

    it('does not read fixtures or a data property as a coverage declaration', () => {
        const root = project({
            ...BASE,
            'tests/fixtures/data.ts': '// covers: KS-ZZZ-99\nexport {};\n',
            'tests/unit/data.test.ts': "export const row = { covers: ['KS-ZZZ-98'] };\n",
        });

        expect(analyze(root).unknown).toEqual([]);
    });
});

describe('the traceability checks', () => {
    it('names the test file and the id when a test declares an id no requirement cites', () => {
        const root = project({ ...BASE, 'tests/unit/wrong.test.ts': '// covers: KS-QQQ-09\nexport {};\n' });

        expect(analyze(root).unknown).toEqual([{ source: 'tests/unit/wrong.test.ts', id: 'KS-QQQ-09' }]);
    });

    it('names the manual check when it declares an unknown id', () => {
        const root = project({ ...BASE, [MANUAL]: '| Check | KS ids |\n| --- | --- |\n| Lighthouse | KS-QQQ-08 |\n' });

        expect(analyze(root).unknown).toEqual([{ source: 'manual check "Lighthouse"', id: 'KS-QQQ-08' }]);
    });

    it('lists an id that a main-spec requirement cites and nothing covers, with the requirement', () => {
        const { uncovered } = analyze(project(BASE));

        expect(uncovered.map(({ id }) => id)).toEqual(['KS-AAA-02', 'KS-BBB-03']);
        expect(uncovered[0]?.requirements).toEqual([{ capability: 'dom/cap', name: 'Alpha' }]);
    });

    it('counts a manual check as coverage and lists it for the id', async () => {
        const root = project({
            ...BASE,
            [MANUAL]: '| Check | KS ids |\n| --- | --- |\n| Real phone | KS-AAA-02, KS-BBB-03 |\n',
        });

        expect(analyze(root).uncovered).toEqual([]);
        expect(await generateMatrix(root)).toContain('- Real phone');
    });

    it('accepts a delta-only id a test cites and leaves the matrix unchanged', async () => {
        const before = await generateMatrix(project(BASE));
        const proposed = project({
            ...BASE,
            [DELTA]: spec(['Gamma', 'KS-NEW-01']),
            'tests/unit/gamma.test.ts': '// covers: KS-NEW-01\nexport {};\n',
        });

        const after = analyze(proposed);

        expect(after.unknown).toEqual([]);
        expect(after.deltaOnlyUncovered).toEqual([]);
        expect(await generateMatrix(proposed)).toBe(before);
    });

    it('names a delta-only id that no test or manual check declares, without failing', () => {
        const root = project({ ...BASE, [DELTA]: spec(['Gamma', 'KS-NEW-01, KS-NEW-02']) });
        writeFileSync(join(root, 'tests/unit/gamma.test.ts'), '// covers: KS-NEW-02\nexport {};\n');

        const result = analyze(root);

        expect(result.deltaOnlyUncovered).toEqual(['KS-NEW-01']);
        expect(result.unknown).toEqual([]);
    });

    it('does not read the archive as an active change', () => {
        const root = project({
            ...BASE,
            'openspec/changes/archive/old/specs/dom/cap/spec.md': spec(['Old', 'KS-OLD-01']),
        });

        expect(analyze(root).deltaOnlyUncovered).toEqual([]);
    });

    it('reads the manual-check ids from the second column only', () => {
        const checks = parseManualChecks(
            '| Check | KS ids | Result |\n| --- | --- | --- |\n| Phone | KS-AAA-01 | see KS-AAA-02 |\n',
        );

        expect(checks).toEqual([{ name: 'Phone', ids: ['KS-AAA-01'] }]);
    });
});

describe('the trace command', () => {
    it('writes the matrix and reports an unknown id with a non-zero exit', () => {
        const root = project({ ...BASE, 'tests/unit/wrong.test.ts': '// covers: KS-QQQ-09\nexport {};\n' });
        mkdirSync(join(root, 'docs/reference'), { recursive: true });

        const run = spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' });

        expect(run.status).toBe(1);
        expect(run.stderr).toContain('unknown id KS-QQQ-09 in tests/unit/wrong.test.ts');
        expect(readFileSync(join(root, MATRIX_PATH), 'utf-8')).toContain('## KS-AAA-01');
    });
});
