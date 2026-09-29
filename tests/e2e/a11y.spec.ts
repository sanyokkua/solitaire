import AxeBuilder from '@axe-core/playwright';
import axe from 'axe-core';
import { expect, test, type Page } from '@playwright/test';
import { drawThreeFanState, worstColumnState } from '../fixtures/boardPositions';
import { WINNING_LINE, nearlyWonState, parseLine } from '../fixtures/deals';
import type { Preferences } from '../../src/features/preferences/preferencesSlice';
import { continueToGame } from './support/cards';
import { playLine } from './support/play';
import { seedRecord } from './support/seed';

/** The appearance variants the scan runs over: each theme, and the dark theme with the night-card palette. */
const VARIANTS: readonly { name: string; theme: 'light' | 'dark'; preferences: Partial<Preferences> }[] = [
    { name: 'light theme', theme: 'light', preferences: {} },
    { name: 'dark theme', theme: 'dark', preferences: {} },
    { name: 'dark theme with night cards', theme: 'dark', preferences: { nightCards: true } },
];
const BLOCKING = new Set(['serious', 'critical']);
/** Moderate rules that are enforced too. */
const ENFORCED_MODERATE = new Set(['landmark-one-main']);

/**
 * The axe source with color-contrast told to judge single-character text. By default a failing one-character text (every
 * card rank but 10) is reported as "incomplete" (`shortTextContent`) instead of a violation, so a low-contrast rank ink
 * would pass. `ignoreLength: true` turns those into violations. `AxeBuilder` has no per-check options, so the check's
 * default options are read back from the injected axe and only that one is changed.
 */
const AXE_SOURCE = `${axe.source};axe.configure({checks:[{id:'color-contrast',options:{...axe._audit.checks['color-contrast'].options,ignoreLength:true}}]});`;

/** Fails with each blocking finding's rule id, impact and the selectors it hit, so a failure names what to fix. */
async function expectNoBlockingViolations(page: Page): Promise<void> {
    const { violations } = await new AxeBuilder({ page, axeSource: AXE_SOURCE }).analyze();
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

for (const { name, theme, preferences: variantPreferences } of VARIANTS) {
    const nightCards = variantPreferences.nightCards === true;

    test.describe(`Accessibility scan, ${name}`, () => {
        test.beforeEach(async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'The scan runs once, in desktop Chromium');
            await page.emulateMedia({ reducedMotion: 'reduce' });
        });

        const open = async (page: Page, current = drawThreeFanState(), preferences: Partial<Preferences> = {}) => {
            await seedRecord(page, { current, preferences: { theme, ...variantPreferences, ...preferences } });
            await page.goto('/');
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
            // A scan that silently ran over the day cards would prove nothing about the night palette.
            await expect(page.locator('html')).toHaveAttribute('data-night-cards', String(nightCards));
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

        if (nightCards) {
            // The fan above shows every suit's ace; this K to A run of both inks adds each rank's corner index and suit
            // symbol in a column of overlapping cards. Axe leaves a text it cannot see whole (covered or under another
            // card) as "incomplete", so what is judged is the uncovered corner ink and the top card's pips.
            test('Game, a king-to-ace run of both inks', async ({ page }) => {
                await open(page, worstColumnState());
                await continueToGame(page);
                await expectNoBlockingViolations(page);
            });
        }

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
            await open(
                page,
                { ...nearlyWonState(), verdict: 'win', grade: 'hard' },
                { tapMode: 'select', autoSafe: false },
            );
            await continueToGame(page);
            const commands = parseLine(WINNING_LINE.line);
            await playLine(page, 'tap', { commands: commands.slice(-1), movesBefore: WINNING_LINE.moves - 1 });
            await expect(page.getByRole('heading', { name: 'You win!' })).toBeVisible({ timeout: 4000 });
            await expect(page.getByText('Hard deal')).toBeVisible();
            await expectNoBlockingViolations(page);
        });
    });
}
