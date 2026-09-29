import { expect, test, type Page } from '@playwright/test';
import { encodeDealCode } from '../../src/domain/dealCode';
import { formatDate } from '../../src/i18n/translate';
import { statsReducer } from '../../src/features/stats/statsSlice';
import { DAILY_GOLDEN } from '../fixtures/dailyGolden';
import { makeState } from '../fixtures/states';
import { seedRecord } from './support/seed';

/** Two golden dates that are consecutive UTC days and both won on the first attempt: the year end and New Year's Day. */
const DAY = '2026-12-31';
const NEXT_DAY = '2027-01-01';
const AFTER_NEXT_DAY = '2027-01-02';
const DAY_BEFORE = '2026-12-30';

const DEAL_TIMEOUT = 60_000;

/** Moves the browser's Date (only the date: timers keep running) to a UTC instant. */
async function setUtc(page: Page, iso: string): Promise<void> {
    await page.clock.setFixedTime(new Date(iso));
}

/** The golden Daily deal code for a UTC date. */
function goldenCode(day: string): string {
    const entry = DAILY_GOLDEN.find((golden) => golden.day === day);
    if (entry?.attempts !== 1) throw new Error(`${day} is not a first-attempt golden date`);
    return encodeDealCode(entry.seed, 'daily');
}

/** Asserts the Daily tile names the UTC date `day`: its corner index and its date line. */
async function expectDailyTile(page: Page, day: string): Promise<void> {
    const tile = page.getByRole('radio', { name: 'Daily deal' });
    const date = new Date(`${day}T00:00:00Z`);
    await expect(tile.locator('.mode-card__corner b')).toHaveText(String(date.getUTCDate()));
    await expect(tile.locator('.mode-card__meta')).toHaveText(
        formatDate('en', date, { weekday: 'short', month: 'short' }),
    );
}

/** Selects Daily, deals it with the real solver and returns the deal code once all 52 cards are on the board. */
async function dealDaily(page: Page): Promise<string> {
    await page.getByRole('radio', { name: 'Daily deal' }).click();
    await page.getByRole('button', { name: 'Deal cards' }).click();
    await expect(page.locator('[data-card-id]')).toHaveCount(52, { timeout: DEAL_TIMEOUT });
    const button = page.locator('.deal-code');
    await expect(button).toHaveText(/^Deal [dD]-[0-9A-Z]{7}$/, { timeout: DEAL_TIMEOUT });
    return ((await button.textContent()) ?? '').replace(/^Deal /, '');
}

/** Opens Statistics from Home and returns its dialog. */
async function openStatistics(page: Page) {
    await page.getByRole('button', { name: 'Statistics' }).click();
    const sheet = page.getByRole('dialog', { name: 'Statistics' });
    await expect(sheet).toBeVisible();
    return sheet;
}

test.describe('Daily rollover at midnight UTC', () => {
    test('the tile and the dealt Daily follow the UTC date across 00:00 and the streak still counts', async ({
        page,
    }) => {
        // The Daily was won on the day before and on DAY: a run of two ending on the last date before the rollover.
        const stats = statsReducer(undefined, { type: '@@INIT' });
        await seedRecord(page, {
            current: makeState(),
            stats: { ...stats, daily: { completed: [DAY_BEFORE, DAY], bestStreak: 2 } },
        });
        await setUtc(page, `${DAY}T23:59:59Z`);
        await page.goto('/');

        await expectDailyTile(page, DAY);
        const before = await dealDaily(page);
        expect(before).toBe(goldenCode(DAY));

        // The clock passes 00:00 UTC while the game is open; nothing watches the date, so Home shows the new day
        // as soon as it is rendered again.
        await setUtc(page, `${NEXT_DAY}T00:00:01Z`);
        await page.getByRole('button', { name: 'Back to Home' }).click();
        await expect(page.getByRole('heading', { name: 'Solitaire' })).toBeVisible();
        await expectDailyTile(page, NEXT_DAY);

        const after = await dealDaily(page);
        expect(after).not.toBe(before);
        expect(after).toBe(goldenCode(NEXT_DAY));

        // Just after 00:00 UTC on the day after the last completed date, the run ending yesterday still counts.
        await page.getByRole('button', { name: 'Back to Home' }).click();
        await expect(page.getByRole('heading', { name: 'Solitaire' })).toBeVisible();
        const sheet = await openStatistics(page);
        await expect(sheet).toContainText('Daily streak: 2 (best 2)');
    });
});

test.describe('The daily streak', () => {
    test('ends when a whole UTC date passes with no Daily completed, and the best streak stays', async ({ page }) => {
        const stats = statsReducer(undefined, { type: '@@INIT' });
        await seedRecord(page, {
            current: makeState(),
            stats: { ...stats, daily: { completed: [DAY_BEFORE, DAY], bestStreak: 2 } },
        });

        // NEXT_DAY passed with no Daily completed, so the run that ended on DAY no longer reaches today.
        await setUtc(page, `${AFTER_NEXT_DAY}T00:00:01Z`);
        await page.goto('/');
        await expectDailyTile(page, AFTER_NEXT_DAY);
        const sheet = await openStatistics(page);
        await expect(sheet).toContainText('Daily streak: 0 (best 2)');
    });
});
