import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    checkLocalReferences,
    checkManifest,
    checkNoThirdPartyLoads,
    checkServiceWorker,
    validateArtifact,
} from '../../../scripts/validate-artifact.mjs';

const SCRIPT = resolve(import.meta.dirname, '../../../scripts/validate-artifact.mjs');
const FIXTURES = resolve(import.meta.dirname, '../../fixtures/dist');
const tempDirs: string[] = [];

/** The good tree with a broken fixture's files laid over it (a broken fixture holds only the files that differ). */
function broken(name: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'artifact-'));
    tempDirs.push(dir);
    cpSync(join(FIXTURES, 'good'), dir, { recursive: true });
    cpSync(join(FIXTURES, name), dir, { recursive: true });
    return dir;
}

const good = join(FIXTURES, 'good');
const CHECKS = [checkLocalReferences, checkManifest, checkServiceWorker, checkNoThirdPartyLoads];

afterEach(() => {
    tempDirs.splice(0).forEach((dir) => {
        rmSync(dir, { recursive: true, force: true });
    });
});

describe('validate-artifact', () => {
    it('passes every check on the good tree, which holds an XML namespace string, an error-docs URL and an anchor', () => {
        for (const check of CHECKS) expect(check(good)).toEqual([]);
        expect(validateArtifact(good)).toEqual([]);
    });

    it('fails a local reference outside /solitaire/', () => {
        expect(checkLocalReferences(broken('outside-base'))).toEqual([
            expect.stringContaining('"/assets/index-a1.js"'),
        ]);
    });

    it('fails a manifest scope other than /solitaire/', () => {
        expect(checkManifest(broken('bad-scope'))).toEqual([expect.stringContaining('scope')]);
    });

    it('fails a manifest icon that does not exist', () => {
        expect(checkManifest(broken('missing-icon'))).toEqual([expect.stringContaining('icon-missing.png')]);
    });

    it('fails a solver worker chunk missing from the precache', () => {
        expect(checkServiceWorker(broken('worker-not-precached'))).toEqual([
            expect.stringContaining('solver.worker-a1.js'),
        ]);
    });

    it.each([
        ['html-third-party', 'index.html'],
        ['css-third-party', 'index-a1.css'],
        ['worker-third-party', 'index-a1.js'],
    ])('fails a third-party load (%s)', (fixture, file) => {
        const problems = checkNoThirdPartyLoads(broken(fixture));
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain(file);
        expect(problems[0]).toContain('cdn.example.com');
    });

    it('exits zero on the good tree and non-zero, naming the problem, on a broken one', () => {
        const ok = spawnSync(process.execPath, [SCRIPT, good], { encoding: 'utf-8' });
        expect(ok.status).toBe(0);
        const bad = spawnSync(process.execPath, [SCRIPT, broken('bad-scope')], { encoding: 'utf-8' });
        expect(bad.status).toBe(1);
        expect(bad.stderr).toContain('scope');
    });
});
