import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
    return readFileSync(resolve(import.meta.dirname, '../../../', relativePath), 'utf-8');
}

const viteConfig = readRepoFile('vite.config.ts');
const vitestConfig = readRepoFile('vitest.config.ts');
const playwrightConfig = readRepoFile('playwright.config.ts');
const ciWorkflow = readRepoFile('.github/workflows/ci.yml');
const pagesWorkflow = readRepoFile('.github/workflows/pages.yml');
const indexHtml = readRepoFile('index.html');

const PINNED_ACTION_VERSION = /^v\d+\.\d+\.\d+$/;

function extractActionRefs(workflowText: string): string[] {
    return [...workflowText.matchAll(/uses:\s*[\w.-]+\/[\w.-]+@([^\s]+)/g)].map((match) => match[1] ?? '');
}

describe('base path agreement across configurations', () => {
    it.each([
        ['vite.config.ts', viteConfig],
        ['vitest.config.ts', vitestConfig],
        ['playwright.config.ts', playwrightConfig],
    ])('%s carries the /solitaire/ base path', (_name, text) => {
        expect(text).toContain('/solitaire/');
    });
});

describe('ci.yml', () => {
    it('grants only read access to repository contents', () => {
        expect(ciWorkflow).toContain('contents: read');
    });

    it('triggers on push and pull_request', () => {
        expect(ciWorkflow).toMatch(/\bpush:/);
        expect(ciWorkflow).toMatch(/\bpull_request:/);
    });

    it.each([
        'uses: actions/checkout@',
        'uses: actions/setup-node@',
        'node-version: 22.22.2',
        'run: npm ci',
        'run: npm run validate',
        'run: npx playwright install --with-deps chromium firefox webkit',
        'run: npm run e2e',
        'uses: actions/upload-artifact@',
        'if: failure()',
    ])('contains the required step %s', (step) => {
        expect(ciWorkflow).toContain(step);
    });
});

describe('pages.yml', () => {
    const deployIndex = pagesWorkflow.indexOf('\n    deploy:');
    const buildSlice = pagesWorkflow.slice(0, deployIndex);
    const deploySlice = pagesWorkflow.slice(deployIndex);

    it('has a deploy job to isolate permissions against', () => {
        expect(deployIndex).toBeGreaterThan(0);
    });

    it('triggers on a push to master and on manual dispatch', () => {
        expect(pagesWorkflow).toContain('branches: [master]');
        expect(pagesWorkflow).toContain('workflow_dispatch:');
    });

    it('serializes concurrent deployments under the pages group', () => {
        expect(pagesWorkflow).toMatch(/concurrency:\s*\n\s*group:\s*pages/);
    });

    it('grants only read access to repository contents at the top level', () => {
        expect(buildSlice).toContain('contents: read');
    });

    it('guards the build job to the master ref', () => {
        expect(buildSlice).toContain("if: github.ref == 'refs/heads/master'");
    });

    it.each([
        'uses: actions/checkout@',
        'uses: actions/setup-node@',
        'node-version: 22.22.2',
        'run: npm ci',
        'run: npm run validate',
        'run: npm run build',
        'uses: actions/upload-pages-artifact@',
        'path: dist',
    ])('build job contains the required step %s', (step) => {
        expect(buildSlice).toContain(step);
    });

    it('deploy job depends on build and uses actions/deploy-pages', () => {
        expect(deploySlice).toContain('needs: build');
        expect(deploySlice).toContain('uses: actions/deploy-pages@');
    });

    it('grants pages-write and id-token-write only to the deploy job', () => {
        expect(deploySlice).toContain('pages: write');
        expect(deploySlice).toContain('id-token: write');
        expect(buildSlice).not.toContain('pages: write');
        expect(buildSlice).not.toContain('id-token: write');
    });
});

describe('index.html', () => {
    it('references no third-party runtime host', () => {
        expect(indexHtml).not.toMatch(/https?:\/\//);
    });
});

describe('pinned action versions', () => {
    const refs = [...extractActionRefs(ciWorkflow), ...extractActionRefs(pagesWorkflow)];

    it('finds at least one action reference to check', () => {
        expect(refs.length).toBeGreaterThan(0);
    });

    it.each(refs)('is pinned to an exact vX.Y.Z tag: %s', (ref) => {
        expect(ref).toMatch(PINNED_ACTION_VERSION);
    });
});
