// covers: KS-GEN-03, KS-SET-03
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { applyCommand } from '../../src/domain/engine';
import { dealFromSeed } from '../../src/domain/deal';
import type { GameState } from '../../src/domain/types';
import { played, statsReducer, won } from '../../src/features/stats/statsSlice';
import { WINNING_LINE, parseLine } from '../fixtures/deals';
import { makeState } from '../fixtures/states';
import { continueToGame } from './support/cards';
import { seedRecord } from './support/seed';

/**
 * The committed reference screenshots of the production build: Home and the Game screen, light and dark, on a desktop
 * and a phone. They are the look-and-feel reference the README shows (a change that alters the look regenerates them and
 * is reviewed against them by eye). The spec is opt-in: it runs only with `CAPTURE_SCREENSHOTS=1`, so ordinary runs and
 * CI never rewrite the set. Run `rtk npm run screenshots`.
 */
const OUTPUT_DIR = 'docs/assets/screenshots';
const OPT_IN = process.env.CAPTURE_SCREENSHOTS === '1';
/** Commands of the recorded winning line played before the shot: a table in mid-game, the same one every time. */
const PLAYED_COMMANDS = 30;

const DESKTOP = { width: 1280, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;

/** A winnable Draw 1 game part-way through the recorded winning line: the same fixed position in every screenshot. */
function midGame(): GameState {
    let state = dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode, { verdict: 'win', attempts: 1, grade: 'medium' });
    for (const command of parseLine(WINNING_LINE.line).slice(0, PLAYED_COMMANDS)) {
        state = applyCommand(state, command).state;
    }
    return { ...state, started: true };
}

/** A few finished games, so the record strip on Home has something to show. */
function someRecord() {
    let stats = statsReducer(undefined, { type: '@@INIT' });
    for (const elapsedMs of [214_000, 305_000, 262_000]) {
        stats = statsReducer(stats, played('draw1'));
        stats = statsReducer(stats, won({ mode: 'draw1', elapsedMs, score: 640 }));
    }
    stats = statsReducer(stats, played('draw1'));
    stats = statsReducer(stats, played('draw3'));
    return stats;
}

/** Waits for the fonts and, on the Game screen, for the board to have its size, so a shot never catches a half-laid table. */
async function settled(page: Page, options: { board: boolean }): Promise<void> {
    if (options.board) await expect(page.locator('.board')).not.toHaveAttribute('data-resizing', /.*/);
    await page.evaluate(() => document.fonts.ready);
    // The theme colours ease in over 250 ms.
    await page.waitForTimeout(400);
}

const VARIANTS = [
    { theme: 'light', device: 'desktop', size: DESKTOP, phone: false },
    { theme: 'dark', device: 'desktop', size: DESKTOP, phone: false },
    { theme: 'light', device: 'phone', size: PHONE, phone: true },
    { theme: 'dark', device: 'phone', size: PHONE, phone: true },
] as const;

for (const variant of VARIANTS) {
    test.describe(`${variant.theme} ${variant.device}`, () => {
        test.use({
            viewport: variant.size,
            hasTouch: variant.phone,
            isMobile: variant.phone,
            deviceScaleFactor: variant.phone ? 2 : 1,
        });

        test(`Home in the ${variant.theme} theme on a ${variant.device}`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only');
            test.skip(!OPT_IN, 'Set CAPTURE_SCREENSHOTS=1 to regenerate the committed reference screenshots');
            mkdirSync(OUTPUT_DIR, { recursive: true });
            await seedRecord(page, {
                current: makeState(),
                preferences: { theme: variant.theme },
                stats: someRecord(),
            });
            await page.goto('/');
            await expect(page.getByRole('button', { name: 'Deal cards' })).toBeVisible();
            await settled(page, { board: false });

            await page.screenshot({
                path: `${OUTPUT_DIR}/home-${variant.theme}-${variant.device}.jpg`,
                type: 'jpeg',
                quality: 80,
            });
        });

        test(`Game in the ${variant.theme} theme on a ${variant.device}`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only');
            test.skip(!OPT_IN, 'Set CAPTURE_SCREENSHOTS=1 to regenerate the committed reference screenshots');
            mkdirSync(OUTPUT_DIR, { recursive: true });
            await seedRecord(page, { current: midGame(), preferences: { theme: variant.theme, autoSafe: false } });
            await continueToGame(page);
            await settled(page, { board: true });

            await page.screenshot({
                path: `${OUTPUT_DIR}/game-${variant.theme}-${variant.device}.jpg`,
                type: 'jpeg',
                quality: 80,
            });
        });
    });
}
