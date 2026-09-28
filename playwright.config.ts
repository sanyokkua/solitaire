import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Bundled Firefox fails to launch on macOS 26+ (confirmed macOS 27 beta, build 26A428): it
// resolves its app-data directory to the TCC-protected real ~/Library/Application Support/Firefox.
// Redirecting CoreFoundation's resolved home directory works around it (upstream:
// microsoft/playwright#42768); no effect on Linux CI.
if (process.platform === 'darwin' && !process.env.CFFIXED_USER_HOME) {
    process.env.CFFIXED_USER_HOME = mkdtempSync(join(tmpdir(), 'playwright-firefox-home-'));
}

/** The device-fit specs (the device matrix, and the same matrix with padded text) run once, in their own Chromium project; no other project collects them. */
const DEVICE_FIT_SPECS = ['**/deviceFit.spec.ts', '**/pseudoLocale.spec.ts'];

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.ts',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
    use: {
        baseURL: 'http://127.0.0.1:5173/solitaire/',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        // No spec sees caching or an update prompt unless it opts in with `serviceWorkers: 'allow'` (D12).
        serviceWorkers: 'block',
    },
    webServer: {
        command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5173',
        url: 'http://127.0.0.1:5173/solitaire/',
        reuseExistingServer: !process.env.CI,
    },
    projects: [
        { name: 'chromium', testIgnore: DEVICE_FIT_SPECS, use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', testIgnore: DEVICE_FIT_SPECS, use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', testIgnore: DEVICE_FIT_SPECS, use: { ...devices['Desktop Safari'] } },
        {
            name: 'iphone-17-pro',
            testIgnore: DEVICE_FIT_SPECS,
            use: { ...devices['iPhone 17 Pro'], viewport: { width: 402, height: 874 } },
        },
        {
            name: 'iphone-14-pro-max',
            testIgnore: DEVICE_FIT_SPECS,
            use: { ...devices['iPhone 14 Pro Max'], viewport: { width: 430, height: 932 } },
        },
        {
            name: 'galaxy-s25',
            testIgnore: DEVICE_FIT_SPECS,
            use: { ...devices['Galaxy S24'], viewport: { width: 360, height: 780 } },
        },
        // Every case sets its own viewport and pointer; only Chromium runs it.
        { name: 'device-fit', testMatch: DEVICE_FIT_SPECS, use: { ...devices['Desktop Chrome'] } },
    ],
});
