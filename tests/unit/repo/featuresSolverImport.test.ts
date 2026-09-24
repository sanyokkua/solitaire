// @vitest-environment node
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../', import.meta.url).pathname;
const RULE = '@typescript-eslint/no-restricted-imports';
const FILES = ['src/features/deal/x.ts', 'src/features/deal/x.tsx'];

// The repo's own eslint.config.js decides the outcome, so a loosened override or a glob that misses a file
// extension fails here. The snippets are linted as virtual files (`lintText` with a `filePath`). The type-aware
// projectService cannot resolve a file that does not exist on disk, so the only override applied on top of the repo
// config lists those two virtual paths in `allowDefaultProject`; no throwaway files are written to the tree.
const eslint = new ESLint({
    cwd: ROOT,
    overrideConfig: [
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: { parserOptions: { projectService: { allowDefaultProject: FILES } } },
        },
    ],
});

async function ruleIds(source: string, filePath: string): Promise<(string | null)[]> {
    const [result] = await eslint.lintText(source, { filePath: `${ROOT}${filePath}` });
    if (!result) {
        throw new Error(`ESLint returned no result for ${filePath}`);
    }
    const fatal = result.messages.find((message) => message.fatal);
    if (fatal) {
        // A parse failure would make the "passes" case vacuous, so it must fail loudly instead.
        throw new Error(`ESLint could not parse ${filePath}: ${fatal.message}`);
    }
    return result.messages.map((message) => message.ruleId);
}

const VALUE_IMPORT = `import { solverHint } from '../../solver/hint';\nexport const run = solverHint;\n`;
const TYPE_IMPORT = `import type { SolverHint } from '../../solver/hint';\nexport type Alias = SolverHint;\n`;

describe('src/features solver import rule (KS-DEAL-10)', () => {
    it.each(FILES)('a value import of the search fails lint in %s', async (file) => {
        expect(await ruleIds(VALUE_IMPORT, file)).toContain(RULE);
    });

    it.each(FILES)('a type-only import passes lint in %s', async (file) => {
        expect(await ruleIds(TYPE_IMPORT, file)).not.toContain(RULE);
    });
});
