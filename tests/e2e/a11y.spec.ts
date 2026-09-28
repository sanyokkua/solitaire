import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { drawThreeFanState } from '../fixtures/boardPositions';
import { WINNING_LINE, nearlyWonState, parseLine } from '../fixtures/deals';
import type { Preferences } from '../../src/features/preferences/preferencesSlice';
import { continueToGame } from './support/cards';
import { playLine } from './support/play';
import { seedRecord } from './support/seed';

const THEMES = ['light', 'dark'] as const;
const BLOCKING = new Set(['serious', 'critical']);
/** Moderate rules that are enforced too. */
const ENFORCED_MODERATE = new Set(['landmark-one-main']);

/** Fails with each blocking finding's rule id, impact and the selectors it hit, so a failure names what to fix. */
async function expectNoBlockingViolations(page: Page): Promise<void> {
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations
        .filter((violation) => BLOCKING.has(violation.impact ?? '') || ENFORCED_MODERATE.has(violation.id))
        .map(
            (violation) =>
                `${violation.id} (${violation.impact ?? '?'}): ${violation.nodes
                    .map((node) => node.target.join(' '))
                    .join(' | ')}`,
        );
    expect(blocking, blocking.join('\n')).toEqual([]);
}

/** Sheets opened from Home, by the name of the control that opens them and the heading they show. */
const HOME_SHEETS = [
    ['settings', 'Settings', 'Settings'],
    ['help', 'How to play', 'How to play'],
    ['stats', 'Statistics', 'Statistics'],
    ['dealCode', 'Play a deal code', 'Play a deal code'],
    ['about', 'About', 'About'],
] as const;

for (const theme of THEMES) {
    test.describe(`Accessibility scan, ${theme} theme`, () => {
        test.beforeEach(async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'The scan runs once, in desktop Chromium');
            await page.emulateMedia({ reducedMotion: 'reduce' });
        });

        const open = async (page: Page, current = drawThreeFanState(), preferences: Partial<Preferences> = {}) => {
            await seedRecord(page, { current, preferences: { theme, ...preferences } });
            await page.goto('/');
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        };

        test('Home', async ({ page }) => {
            await open(page);
            await expect(page.getByRole('button', { name: 'Deal cards' })).toBeVisible();
            await expectNoBlockingViolations(page);
        });

        test('Game', async ({ page }) => {
            await open(page);
            await continueToGame(page);
            await expectNoBlockingViolations(page);
        });

        for (const [id, control, heading] of HOME_SHEETS) {
            test(`the ${id} sheet`, async ({ page }) => {
                await open(page);
                await page.locator('.home-body').getByRole('button', { name: control, exact: true }).click();
                await expect(page.getByRole('dialog').getByRole('heading', { name: heading })).toBeVisible();
                await expectNoBlockingViolations(page);
            });
        }

        test('the newDeal sheet', async ({ page }) => {
            await open(page);
            await continueToGame(page);
            await page.getByRole('button', { name: 'New deal' }).click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await expectNoBlockingViolations(page);
        });

        test('the paused sheet', async ({ page }) => {
            await open(page);
            await continueToGame(page);
            await page.getByRole('button', { name: /^Pause, time/ }).click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await expectNoBlockingViolations(page);
        });

        test('the win sheet', async ({ page }) => {
            await open(page, nearlyWonState(), { tapMode: 'select', autoSafe: false });
            await continueToGame(page);
            const commands = parseLine(WINNING_LINE.line);
            await playLine(page, 'tap', { commands: commands.slice(-1), movesBefore: WINNING_LINE.moves - 1 });
            await expect(page.getByRole('heading', { name: 'You win!' })).toBeVisible({ timeout: 4000 });
            await expectNoBlockingViolations(page);
        });
    });
}
