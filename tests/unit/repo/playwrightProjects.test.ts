// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { devices } from '@playwright/test';
import config from '../../../playwright.config';
import { FULL_GAME_PROJECTS } from '../../e2e/support/projects';

const DEVICE_FIT_SPECS = ['**/deviceFit.spec.ts', '**/pseudoLocale.spec.ts'];
/** Specs that run in the `chromium` project only; tasks that add one append it here. */
const CHROMIUM_ONLY_SPECS: string[] = [
    'tests/e2e/visualParity.spec.ts',
    'tests/e2e/dealLatency.spec.ts',
    'tests/e2e/pwa.spec.ts',
    'tests/e2e/dragPerf.spec.ts',
    'tests/e2e/screenshots.spec.ts',
    'tests/e2e/a11y.spec.ts',
];

/** Specs that play a whole winning line; each skips itself outside `FULL_GAME_PROJECTS`. */
const FULL_GAME_SPECS: string[] = [
    'tests/e2e/playByTap.spec.ts',
    'tests/e2e/playByDrag.spec.ts',
    'tests/e2e/playByKeyboard.spec.ts',
    'tests/e2e/playModes.spec.ts',
];

/** Whether a spec's source skips itself outside the `chromium` project. */
function hasChromiumGuard(source: string): boolean {
    return source.includes("test.skip(testInfo.project.name !== 'chromium'");
}

describe('Playwright projects', () => {
    const projects = config.projects ?? [];

    it('runs both device-fit specs in one dedicated Desktop Chrome project', () => {
        const deviceFit = projects.find((project) => project.name === 'device-fit');

        expect(deviceFit?.testMatch).toEqual(DEVICE_FIT_SPECS);
        expect(deviceFit?.use?.userAgent).toBe(devices['Desktop Chrome'].userAgent);
        expect(deviceFit?.use?.defaultBrowserType).toBe('chromium');
    });

    it('keeps every other project away from both device-fit specs', () => {
        const others = projects.filter((project) => project.name !== 'device-fit');

        expect(others).toHaveLength(6);
        for (const project of others) {
            expect(project.testIgnore, project.name).toEqual(DEVICE_FIT_SPECS);
        }
    });

    it('blocks service workers by default', () => {
        expect(config.use?.serviceWorkers).toBe('block');
    });

    it('recognises a Chromium-only guard', () => {
        expect(hasChromiumGuard("test.skip(testInfo.project.name !== 'chromium', 'reason');")).toBe(true);
        expect(hasChromiumGuard("test('runs everywhere', () => {});")).toBe(false);
    });

    it.each(CHROMIUM_ONLY_SPECS)('%s skips itself outside the chromium project', (spec) => {
        expect(hasChromiumGuard(readFileSync(spec, 'utf8'))).toBe(true);
    });

    it('plays whole games in the three desktop engines and one touch phone, all of them projects', () => {
        expect(FULL_GAME_PROJECTS).toEqual(['chromium', 'firefox', 'webkit', 'iphone-17-pro']);
        const names = projects.map((project) => project.name);
        for (const name of FULL_GAME_PROJECTS) expect(names).toContain(name);
    });

    it.each(FULL_GAME_SPECS)('%s carries the whole-game guard and no Chromium-only guard', (spec) => {
        const source = readFileSync(spec, 'utf8');
        const games = source.match(/skipOutsideFullGameProjects\(testInfo\)/g) ?? [];
        expect(games.length).toBeGreaterThan(0);
        expect(hasChromiumGuard(source)).toBe(false);
    });
});

describe('Playwright CI profile (E2E_PROFILE=ci)', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    async function ciConfig(): Promise<typeof config> {
        vi.stubEnv('E2E_PROFILE', 'ci');
        vi.resetModules();
        return (await import('../../../playwright.config')).default;
    }

    it('is off by default: every project, no keyboard filter', () => {
        expect(config.projects?.map((project) => project.name)).toHaveLength(7);
        expect(config.grepInvert).toBeUndefined();
    });

    it('keeps the three desktop engines, and none of the phone or device-fit projects', async () => {
        const ci = await ciConfig();
        expect(ci.projects?.map((project) => project.name)).toEqual(['chromium', 'firefox', 'webkit']);
    });

    it('retries once, stops early, and skips the keyboard titles', async () => {
        const ci = await ciConfig();
        expect(ci.retries).toBe(1);
        expect(ci.maxFailures).toBeGreaterThan(0);
        expect(ci.grepInvert).toEqual(/keyboard/i);
    });

    it('gives slow runners room: 90 s per test, 15 s per expectation, two workers', async () => {
        const ci = await ciConfig();
        expect(ci.timeout).toBe(90_000);
        expect(ci.expect?.timeout).toBe(15_000);
        expect(ci.workers).toBe(2);
    });

    it.each(['playByTap', 'playByDrag', 'playModes', 'history'])(
        'skips the long spec %s in webkit only',
        async (spec) => {
            const ci = await ciConfig();
            const ignored = (name: string) => ci.projects?.find((project) => project.name === name)?.testIgnore;
            expect(ignored('webkit')).toContain(`**/${spec}.spec.ts`);
            expect(ignored('chromium')).not.toContain(`**/${spec}.spec.ts`);
            expect(ignored('firefox')).not.toContain(`**/${spec}.spec.ts`);
        },
    );

    it.each(['dealLatency', 'dragPerf', 'visualParity'])('ignores the informational spec %s', async (spec) => {
        const ci = await ciConfig();
        for (const project of ci.projects ?? []) {
            expect(project.testIgnore, project.name).toContain(`**/${spec}.spec.ts`);
        }
    });
});
