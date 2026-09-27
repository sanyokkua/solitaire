// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { devices } from '@playwright/test';
import config from '../../../playwright.config';

const DEVICE_FIT_SPEC = '**/deviceFit.spec.ts';
/** Specs that run in the `chromium` project only; tasks that add one append it here. */
const CHROMIUM_ONLY_SPECS: string[] = [
    'tests/e2e/visualParity.spec.ts',
    'tests/e2e/dealLatency.spec.ts',
    'tests/e2e/playByTap.spec.ts',
    'tests/e2e/playByDrag.spec.ts',
    'tests/e2e/playByKeyboard.spec.ts',
];

/** Whether a spec's source skips itself outside the `chromium` project. */
function hasChromiumGuard(source: string): boolean {
    return source.includes("test.skip(testInfo.project.name !== 'chromium'");
}

describe('Playwright projects', () => {
    const projects = config.projects ?? [];

    it('runs the device-fit matrix in one dedicated Desktop Chrome project', () => {
        const deviceFit = projects.find((project) => project.name === 'device-fit');

        expect(deviceFit?.testMatch).toBe(DEVICE_FIT_SPEC);
        expect(deviceFit?.use?.userAgent).toBe(devices['Desktop Chrome'].userAgent);
        expect(deviceFit?.use?.defaultBrowserType).toBe('chromium');
    });

    it('keeps every other project away from the device-fit spec', () => {
        const others = projects.filter((project) => project.name !== 'device-fit');

        expect(others).toHaveLength(6);
        for (const project of others) {
            expect(project.testIgnore, project.name).toBe(DEVICE_FIT_SPEC);
        }
    });

    it('recognises a Chromium-only guard', () => {
        expect(hasChromiumGuard("test.skip(testInfo.project.name !== 'chromium', 'reason');")).toBe(true);
        expect(hasChromiumGuard("test('runs everywhere', () => {});")).toBe(false);
    });

    it.each(CHROMIUM_ONLY_SPECS)('%s skips itself outside the chromium project', (spec) => {
        expect(hasChromiumGuard(readFileSync(spec, 'utf8'))).toBe(true);
    });
});
