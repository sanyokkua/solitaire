// @vitest-environment node
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../', import.meta.url).pathname;

const eslint = new ESLint({ cwd: ROOT });

async function ruleIds(source: string, filePath: string): Promise<(string | null)[]> {
    const [result] = await eslint.lintText(source, { filePath: `${ROOT}${filePath}` });
    if (!result) {
        throw new Error(`ESLint returned no result for ${filePath}`);
    }
    const fatal = result.messages.find((message) => message.fatal);
    if (fatal) {
        // A parse failure would make either assertion vacuous, so it must fail loudly instead.
        throw new Error(`ESLint could not parse ${filePath}: ${fatal.message}`);
    }
    return result.messages.map((message) => message.ruleId);
}

// The first type-aware lint in a process is slow, and slower still while the whole suite runs in parallel.
const LINT_TIMEOUT_MS = 30_000;

describe('eslint import restrictions (D3)', { timeout: LINT_TIMEOUT_MS }, () => {
    it('a pure board module still carries its purity restriction, reaching outside its allowed imports', async () => {
        const source = `import { setRoute } from '../../app/appSlice';\nexport const x = setRoute;\n`;

        expect(await ruleIds(source, 'src/ui/board/layout.ts')).toContain('no-restricted-imports');
    });

    it('a UI component importing setRoute, sheetOpened or sheetClosed from appSlice fails lint', async () => {
        const setRouteImport = `import { setRoute } from '../../app/appSlice';\nexport const x = setRoute;\n`;
        const sheetOpenedImport = `import { sheetOpened } from '../../app/appSlice';\nexport const x = sheetOpened;\n`;
        const sheetClosedImport = `import { sheetClosed } from '../../app/appSlice';\nexport const x = sheetClosed;\n`;

        expect(await ruleIds(setRouteImport, 'src/ui/screens/GameScreen.tsx')).toContain(
            '@typescript-eslint/no-restricted-imports',
        );
        expect(await ruleIds(sheetOpenedImport, 'src/ui/screens/GameScreen.tsx')).toContain(
            '@typescript-eslint/no-restricted-imports',
        );
        expect(await ruleIds(sheetClosedImport, 'src/ui/screens/GameScreen.tsx')).toContain(
            '@typescript-eslint/no-restricted-imports',
        );
    });

    it('a UI component importing another appSlice export is unaffected by the route/sheet ban', async () => {
        const source = `import { noticeDismissed } from '../../app/appSlice';\nexport const x = noticeDismissed;\n`;

        expect(await ruleIds(source, 'src/ui/screens/GameScreen.tsx')).not.toContain(
            '@typescript-eslint/no-restricted-imports',
        );
    });
});
