/**
 * Requirement traceability (design D17). Builds `docs/reference/traceability.md`: every KS id that a requirement of the
 * main OpenSpec specs cites, with the requirements that cite it, the tests that declare it and the manual checks that
 * cover it.
 *
 * - A requirement is a `### Requirement:` block of `openspec/specs/<domain>/<capability>/spec.md`; the ids it cites are
 *   every `KS-XXX-nn` in the block, and a range such as `KS-INP-04…08` stands for each id in it.
 * - A test declares the ids it proves with a comment line `// covers: KS-XXX-nn, KS-YYY-nn` (top of a file or a
 *   `describe`). Files under `tests/fixtures/` are not tests and are not scanned.
 * - A manual check is a row of the table in `docs/reference/manual-checks.md`; its ids are in the second column.
 * - The delta specs of active changes (`openspec/changes/<name>/specs/**`, not the archive) only widen the set of ids a
 *   test may declare. They never change the matrix, so a new proposal never makes it stale.
 *
 * Every step is a pure function of a project root, so the same inputs always give the same matrix. The CLI writes the
 * matrix, prints what it found and exits non-zero when a test or a manual check declares an unknown id.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';

export const MATRIX_PATH = 'docs/reference/traceability.md';
export const MANUAL_CHECKS_PATH = 'docs/reference/manual-checks.md';

const ID = /KS-[A-Z0-9]+-\d+/g;
const RANGE = /(KS-[A-Z0-9]+-)(\d+)…(\d+)/g;
const COVERS = /^[ \t]*\/\/[ \t]*covers:(.*)$/gm;
const TEST_FILE = /\.(?:[cm]?[jt]sx?)$/;

const posix = (path) => path.split('\\').join('/');

const walk = (dir, keep) =>
    existsSync(dir)
        ? readdirSync(dir, { recursive: true, withFileTypes: true })
              .filter((entry) => entry.isFile())
              .map((entry) => posix(join(entry.parentPath, entry.name)))
              .filter(keep)
              .sort()
        : [];

/** The prefix and number of an id, so `KS-INP-10` sorts after `KS-INP-9` and `KS-A11Y` before `KS-DEAL`. */
function compareIds(a, b) {
    const [, prefixA = '', numberA = '0'] = /^(KS-[A-Z0-9]+)-(\d+)$/.exec(a) ?? [];
    const [, prefixB = '', numberB = '0'] = /^(KS-[A-Z0-9]+)-(\d+)$/.exec(b) ?? [];
    return prefixA.localeCompare(prefixB) || Number(numberA) - Number(numberB);
}

/** Every KS id in `text`, ranges (`KS-INP-04…08`) expanded, without duplicates and in id order. */
export function extractIds(text) {
    const ids = new Set(text.match(ID) ?? []);
    for (const [, prefix, from = '0', to = '0'] of text.matchAll(RANGE)) {
        for (let n = Number(from); n <= Number(to); n++) {
            ids.add(`${prefix}${String(n).padStart(from.length, '0')}`);
        }
    }
    return [...ids].sort(compareIds);
}

/** The `### Requirement:` blocks of one spec: `{ name, ids }` for each. */
export function parseRequirements(spec) {
    return spec
        .split(/^(?=#{1,3} )/m)
        .filter((block) => block.startsWith('### Requirement:'))
        .map((block) => ({
            name: (block.split('\n')[0] ?? '').replace('### Requirement:', '').trim(),
            ids: extractIds(block),
        }));
}

/** The requirements of every main spec, each with its capability (`domain/capability`), in a fixed order. */
export function collectRequirements(root) {
    const specs = join(root, 'openspec/specs');
    return walk(specs, (path) => path.endsWith('/spec.md')).flatMap((path) => {
        const capability = posix(relative(specs, path)).replace(/\/spec\.md$/, '');
        return parseRequirements(readFileSync(path, 'utf-8')).map((requirement) => ({ capability, ...requirement }));
    });
}

/** The ids cited by the delta specs of active changes (the archive is not active). */
export function collectDeltaIds(root) {
    const changes = join(root, 'openspec/changes');
    const ids = new Set();
    for (const path of walk(changes, (file) => /\/specs\/.+\.md$/.test(file) && !file.includes('/archive/'))) {
        for (const id of extractIds(readFileSync(path, 'utf-8'))) ids.add(id);
    }
    return ids;
}

/** The ids each test file declares: `[{ file, ids }]` for every file under `tests/` with a `// covers:` comment. */
export function collectTestCoverage(root) {
    const tests = join(root, 'tests');
    const files = walk(tests, (path) => TEST_FILE.test(path) && !posix(relative(tests, path)).startsWith('fixtures/'));
    const declared = [];
    for (const path of files) {
        const ids = new Set();
        for (const [, list = ''] of readFileSync(path, 'utf-8').matchAll(COVERS)) {
            for (const id of extractIds(list)) ids.add(id);
        }
        if (ids.size > 0) declared.push({ file: posix(relative(root, path)), ids: [...ids].sort(compareIds) });
    }
    return declared;
}

/** The rows of the manual-checks table: `{ name, ids }`. Rows without a KS id in the second column are not checks. */
export function parseManualChecks(text) {
    const checks = [];
    for (const line of text.split('\n')) {
        if (!line.trim().startsWith('|')) continue;
        const [name = '', ids = ''] = line
            .trim()
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((cell) => cell.trim());
        const found = extractIds(ids);
        if (found.length > 0) checks.push({ name, ids: found });
    }
    return checks;
}

const readManualChecks = (root) => {
    const path = join(root, MANUAL_CHECKS_PATH);
    return existsSync(path) ? parseManualChecks(readFileSync(path, 'utf-8')) : [];
};

const push = (map, key, value) => map.set(key, [...(map.get(key) ?? []), value]);

/**
 * Everything the matrix and the guard need: the main-spec ids with their requirements, the tests and manual checks that
 * cover them, the ids declared but unknown, the ids nothing covers and the delta-only ids still without coverage.
 */
export function analyze(root) {
    const requirements = collectRequirements(root);
    const deltaIds = collectDeltaIds(root);
    const testFiles = collectTestCoverage(root);
    const manualChecks = readManualChecks(root);

    const citedBy = new Map();
    for (const { capability, name, ids } of requirements) {
        for (const id of ids) push(citedBy, id, { capability, name });
    }
    const tests = new Map();
    for (const { file, ids } of testFiles) for (const id of ids) push(tests, id, file);
    const manual = new Map();
    for (const { name, ids } of manualChecks) for (const id of ids) push(manual, id, name);

    const ids = [...citedBy.keys()].sort(compareIds);
    const known = new Set([...ids, ...deltaIds]);
    const unknown = [
        ...testFiles.flatMap(({ file, ids: declared }) => declared.map((id) => ({ source: file, id }))),
        ...manualChecks.flatMap(({ name, ids: declared }) =>
            declared.map((id) => ({ source: `manual check "${name}"`, id })),
        ),
    ].filter(({ id }) => !known.has(id));
    const covered = (id) => tests.has(id) || manual.has(id);

    return {
        ids,
        citedBy,
        tests,
        manual,
        unknown,
        uncovered: ids.filter((id) => !covered(id)).map((id) => ({ id, requirements: citedBy.get(id) ?? [] })),
        deltaOnlyUncovered: [...deltaIds].filter((id) => !citedBy.has(id) && !covered(id)).sort(compareIds),
    };
}

/** One message per main-spec id that no test and no manual check covers, naming the id and the requirements citing it. */
export function uncoveredProblems({ uncovered }) {
    return uncovered.map(
        ({ id, requirements }) =>
            `${id} is covered by no test and no manual check; cited by ${requirements.map(({ capability, name }) => `"${name}" (${capability})`).join(', ')}`,
    );
}

const bullets = (items, empty) => (items.length === 0 ? [`- ${empty}`] : items.map((item) => `- ${item}`));

/** The matrix as Markdown, before formatting. */
export function renderMatrix({ ids, citedBy, tests, manual, uncovered }) {
    const lines = [
        '# Requirement traceability',
        '',
        'Generated by `npm run trace` (`scripts/trace-requirements.mjs`); do not edit by hand. Each KS id lists the requirements of',
        'the main OpenSpec specs that cite it, the tests that declare it with a `// covers:` comment and the manual checks',
        'recorded in [`manual-checks.md`](manual-checks.md).',
        '',
        `${String(ids.length)} ids; ${String(ids.length - uncovered.length)} covered by a test or a manual check.`,
        '',
        '## Ids without a test or a manual check',
        '',
        ...bullets(
            uncovered.map(({ id }) => id),
            'none',
        ),
    ];
    for (const id of ids) {
        lines.push(
            '',
            `## ${id}`,
            '',
            'Requirements:',
            '',
            ...bullets(
                (citedBy.get(id) ?? []).map(({ capability, name }) => `\`${capability}\`: ${name}`),
                'none',
            ),
            '',
            'Tests:',
            '',
            ...bullets(
                (tests.get(id) ?? []).map((file) => `\`${file}\``),
                'none',
            ),
            '',
            'Manual checks:',
            '',
            ...bullets(manual.get(id) ?? [], 'none'),
        );
    }
    return `${lines.join('\n')}\n`;
}

/** Formats with the project's Prettier configuration (found from this script, not from `root`), so `format:check` never changes it. */
export async function formatMatrix(markdown) {
    const config = (await resolveConfig(fileURLToPath(new URL(`../${MATRIX_PATH}`, import.meta.url)))) ?? {};
    return format(markdown, { ...config, parser: 'markdown' });
}

/** The matrix a fresh generation gives for `root`. */
export async function generateMatrix(root) {
    return formatMatrix(renderMatrix(analyze(root)));
}

/** Writes the matrix under `root` and returns the analysis it came from. */
export async function writeMatrix(root) {
    const analysis = analyze(root);
    writeFileSync(join(root, MATRIX_PATH), await formatMatrix(renderMatrix(analysis)));
    return analysis;
}

const log = (line) => process.stdout.write(`${line}\n`);
const fail = (line) => process.stderr.write(`${line}\n`);

async function main() {
    const root = process.argv[2] ?? process.cwd();
    const result = await writeMatrix(root);
    log(
        `traceability: ${String(result.ids.length)} ids, ${String(result.uncovered.length)} without a test or a manual check`,
    );
    for (const { id, requirements } of result.uncovered) {
        log(`  uncovered ${id}: ${requirements.map(({ name }) => name).join('; ')}`);
    }
    if (result.deltaOnlyUncovered.length > 0) {
        log(`  new in active changes, not covered yet: ${result.deltaOnlyUncovered.join(', ')}`);
    }
    for (const { source, id } of result.unknown) fail(`  unknown id ${id} in ${source}`);
    process.exit(result.unknown.length > 0 ? 1 : 0);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
