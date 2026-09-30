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
const prettierIgnore = readRepoFile('.prettierignore');
const packageJson = JSON.parse(readRepoFile('package.json')) as { scripts: Record<string, string> };
const scriptsDoc = readRepoFile('docs/reference/scripts.md');

const PINNED_ACTION_VERSION = /^v\d+\.\d+\.\d+$/;

function extractActionRefs(workflowText: string): string[] {
    return [...workflowText.matchAll(/uses:\s*[\w.-]+\/[\w.-]+@([^\s]+)/g)].map((match) => match[1] ?? '');
}

/**
 * The script names a Markdown table documents: the first cell of each row, split on `/` (one row may cover
 * `npm run e2e` / `e2e:headed`), with backticks and the `npm run ` prefix removed.
 */
function documentedScripts(markdown: string): ReadonlySet<string> {
    const names = new Set<string>();
    for (const line of markdown.split('\n')) {
        const cell = /^\|([^|]+)\|/.exec(line)?.[1];
        if (cell === undefined) continue;
        for (const part of cell.split('/')) {
            const name = part
                .replaceAll('`', '')
                .trim()
                .replace(/^npm run\s+/, '');
            if (name !== '') names.add(name);
        }
    }
    return names;
}

/** The scripts that no table row of `markdown` documents. */
function undocumentedScripts(scripts: readonly string[], markdown: string): string[] {
    const documented = documentedScripts(markdown);
    return scripts.filter((name) => !documented.has(name));
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

describe('vite.config.ts app version define', () => {
    it('defines __APP_VERSION__ from package.json', () => {
        expect(viteConfig).toContain('__APP_VERSION__: JSON.stringify(packageJson.version)');
    });

    it('reads package.json for the version rather than hardcoding it', () => {
        expect(viteConfig).toMatch(/readFileSync\(.*package\.json.*\)/);
    });
});

describe('vite.config.ts build identity define', () => {
    it('defines __APP_BUILD__ from resolveBuildInfo over the process environment', () => {
        expect(viteConfig).toContain('__APP_BUILD__: JSON.stringify(resolveBuildInfo(process.env, new Date()))');
        expect(viteConfig).not.toContain('__APP_BUILD_TIMESTAMP__');
    });

    it('defines a fixed __APP_BUILD__ for Vitest', () => {
        expect(vitestConfig).toMatch(/__APP_BUILD__: JSON\.stringify\(\{ number: '\d+', time: '[^']+ UTC' \}\)/);
    });

    it.each([
        ['ci.yml', ciWorkflow],
        ['pages.yml', pagesWorkflow],
    ])('%s neither sets BUILD_TIMESTAMP nor reads github.run_started_at', (_name, text) => {
        expect(text).not.toContain('BUILD_TIMESTAMP');
        expect(text).not.toContain('run_started_at');
    });
});

describe('the release version', () => {
    const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
    const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../package.json'), 'utf-8')) as {
        version: string;
    };
    const lock = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../package-lock.json'), 'utf-8')) as {
        version: string;
        packages: Record<string, { version: string }>;
    };

    it('is 1.0.0, valid semver', () => {
        expect(manifest.version).toMatch(SEMVER);
        expect(manifest.version).toBe('1.0.0');
    });

    it('is the version of the lockfile root entry, twice over', () => {
        expect(lock.version).toBe(manifest.version);
        expect(lock.packages['']?.version).toBe(manifest.version);
    });

    it('heads the changelog with the released version', () => {
        const changelog = readFileSync(resolve(import.meta.dirname, '../../../CHANGELOG.md'), 'utf-8');
        expect(/^## (\S+) — \d{4}-\d{2}-\d{2}$/m.exec(changelog)?.[1]).toBe(manifest.version);
    });
});

describe('package.json scripts', () => {
    it('exposes the lifecycle-storage guard', () => {
        expect(packageJson.scripts['validate:lifecycle-storage']).toBe('node scripts/validate-lifecycle-storage.mjs');
    });

    it('exposes the artifact validator', () => {
        expect(packageJson.scripts['validate:artifact']).toBe('node scripts/validate-artifact.mjs');
    });

    it('runs the whole gate in order, with the guard after type checking and artifact validation after the build', () => {
        const steps = [
            'npm run format:check',
            'npm run lint',
            'npm run typecheck',
            'npm run validate:lifecycle-storage',
            'vitest run tests/unit tests/component --coverage',
            'npm run build',
            'npm run validate:artifact',
        ];

        expect(packageJson.scripts.validate).toBe(steps.join(' && '));
    });

    it('measures coverage in the gate, so the thresholds fail it even when every test passes', () => {
        expect(packageJson.scripts.validate).toMatch(/vitest run tests\/unit tests\/component --coverage/);
        expect(packageJson.scripts['test:unit']).toBe('vitest run tests/unit tests/component');
    });

    it('sets the coverage thresholds to 80% for lines, functions, branches and statements', () => {
        expect(vitestConfig).toMatch(
            /thresholds:\s*\{\s*lines:\s*80,\s*functions:\s*80,\s*branches:\s*80,\s*statements:\s*80\s*\}/,
        );
    });
});

describe('docs/reference/scripts.md', () => {
    it('documents every npm script of package.json in a table row', () => {
        expect(undocumentedScripts(Object.keys(packageJson.scripts), scriptsDoc)).toEqual([]);
    });

    it('flags a script that no row names, and accepts several names in one row', () => {
        const table = [
            '| Script | What |',
            '| --- | --- |',
            '| `npm run dev` | dev |',
            '| `npm run e2e` / `e2e:headed` | e2e |',
        ];

        expect(undocumentedScripts(['dev', 'e2e', 'e2e:headed', 'trace'], table.join('\n'))).toEqual(['trace']);
        expect(undocumentedScripts(['dev'], 'text mentioning npm run dev outside any table')).toEqual(['dev']);
    });
});

describe('.prettierignore', () => {
    const entries = prettierIgnore
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'));

    it('leaves the OpenSpec planning tree out of formatting', () => {
        expect(entries).toContain('openspec/');
    });

    it('does not exclude the maintained docs', () => {
        expect(entries).not.toContain('docs/');
        expect(entries).not.toContain('docs');
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

describe('ci.yml visual-parity upload', () => {
    const steps = ciWorkflow.split(/\n\s+- (?=\S)/);
    const uploadStep = steps.find((step) => step.includes('name: visual-parity')) ?? '';

    it('uploads the screenshots on every run, after the e2e step', () => {
        expect(ciWorkflow.indexOf('name: visual-parity')).toBeGreaterThan(ciWorkflow.indexOf('run: npm run e2e'));
        expect(uploadStep).toContain('uses: actions/upload-artifact@v');
        expect(uploadStep).toContain('if: always()');
        expect(uploadStep).toContain('path: test-results/visual-parity/');
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
        'uses: actions/upload-pages-artifact@',
        'path: dist',
    ])('build job contains the required step %s', (step) => {
        expect(buildSlice).toContain(step);
    });

    it('builds once: validate runs the build and no separate build step follows it', () => {
        expect(buildSlice.match(/run: npm run validate\b/g)).toHaveLength(1);
        expect(buildSlice).not.toMatch(/run: npm run build\b/);
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

// covers: KS-PWA-04
describe('index.html', () => {
    it('references no third-party runtime host', () => {
        expect(indexHtml).not.toMatch(/https?:\/\//);
    });

    it.each([
        '<link rel="manifest" href="/solitaire/manifest.webmanifest" />',
        '<link rel="apple-touch-icon" href="/solitaire/icons/apple-touch-icon.png" />',
        '<link rel="icon" type="image/svg+xml" href="/solitaire/favicon.svg" />',
        '<meta name="theme-color" content="#e8f0f5" media="(prefers-color-scheme: light)" />',
        '<meta name="theme-color" content="#0b2545" media="(prefers-color-scheme: dark)" />',
        '<meta name="description"',
    ])('declares %s', (tag) => {
        expect(indexHtml).toContain(tag);
    });
});

// covers: KS-PWA-01, KS-PWA-03
describe('vite.config.ts PWA plugin', () => {
    it.each([
        "registerType: 'prompt'",
        'injectRegister: false',
        'manifest: false',
        "globPatterns: ['**/*.{js,css,html,woff2,ttf,png,svg,webmanifest}']",
        "navigateFallback: 'index.html'",
        'cleanupOutdatedCaches: true',
        'devOptions: { enabled: false }',
    ])('configures %s', (setting) => {
        expect(viteConfig).toContain(setting);
    });

    it('has no runtime caching', () => {
        expect(viteConfig).not.toContain('runtimeCaching');
    });
});

describe('PWA dependencies', () => {
    const pinned = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../package.json'), 'utf-8')) as {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
    };

    it('pins vite-plugin-pwa and workbox-window exactly', () => {
        expect(pinned.devDependencies['vite-plugin-pwa']).toBe('1.3.0');
        expect(pinned.dependencies['workbox-window']).toMatch(/^7\.\d+\.\d+$/);
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
