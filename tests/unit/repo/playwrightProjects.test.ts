// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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
