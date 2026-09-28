import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(import.meta.dirname, '../../../scripts/validate-lifecycle-storage.mjs');
const LIFECYCLE_TEST = 'appLifecycle.x.test.tsx';

const tempDirs: string[] = [];

/** A scratch repository root holding `files`, each keyed by its path under `tests/component`. */
function scratchRepo(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'lifecycle-guard-'));
    tempDirs.push(dir);
    mkdirSync(join(dir, 'tests/component'), { recursive: true });
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, 'tests/component', name), content);
    return dir;
}

function runGuard(cwd: string) {
    const result = spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf-8' });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

afterEach(() => {
    tempDirs.splice(0).forEach((dir) => {
        rmSync(dir, { recursive: true, force: true });
    });
});

describe('validate-lifecycle-storage guard', () => {
    it('passes a lifecycle test that injects its storage gateway', () => {
        const dir = scratchRepo({
            [LIFECYCLE_TEST]:
                'const gateway = createStorageGateway(memoryStorage());\nstartApp(root, { extra: { gateway } });\n',
        });

        const { status, output } = runGuard(dir);

        expect(status).toBe(0);
        expect(output).toContain(LIFECYCLE_TEST);
    });

    it.each([
        ['ambient localStorage', 'window.localStorage.setItem("k", "v");'],
        ['ambient sessionStorage', 'window.sessionStorage.clear();'],
        ['Storage.prototype', 'vi.spyOn(Storage.prototype, "setItem");'],
        ['a bare createStorageGateway()', 'const gateway = createStorageGateway();'],
        ['startApp without an injected gateway', 'startApp(root, { extra: { dealService } });'],
    ])('fails a lifecycle test that uses %s, naming the file and the violation', (violation, source) => {
        const dir = scratchRepo({ [LIFECYCLE_TEST]: source });

        const { status, output } = runGuard(dir);

        expect(status).not.toBe(0);
        expect(output).toContain(LIFECYCLE_TEST);
        expect(output).toContain(violation);
    });

    it('checks every lifecycle test, not only the first', () => {
        const dir = scratchRepo({
            'appLifecycle.a.test.tsx': 'createStorageGateway(memoryStorage());',
            'appLifecycle.b.test.tsx': 'localStorage.clear();',
            'unrelated.test.tsx': 'localStorage.clear();',
        });

        const { status, output } = runGuard(dir);

        expect(status).not.toBe(0);
        expect(output).toContain('appLifecycle.b.test.tsx');
        expect(output).not.toContain('unrelated.test.tsx');
    });

    it('fails when there is no lifecycle test to check', () => {
        const dir = scratchRepo({ 'unrelated.test.tsx': 'export {};' });

        const { status, output } = runGuard(dir);

        expect(status).not.toBe(0);
        expect(output).toMatch(/no .*appLifecycle/i);
    });

    it('passes on this repository', () => {
        const { status } = runGuard(resolve(import.meta.dirname, '../../..'));

        expect(status).toBe(0);
    });
});
