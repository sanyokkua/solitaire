import { expect, test } from '@playwright/test';
import { STORAGE_KEY } from '../../src/features/persistence/recordCodec';
import { worstColumnState } from '../fixtures/boardPositions';
import { seedRecord } from './support/seed';

/** Sub-pixel slack when comparing boxes, in px. */
const TOLERANCE = 0.5;

/** The viewports of HO "Home actions" and "Home fits every size": phones, a landscape phone, laptops, and both extremes. */
const VIEWPORTS = [
    { width: 874, height: 350 },
    { width: 390, height: 844 },
    { width: 1280, height: 720 },
    { width: 360, height: 780 },
    { width: 320, height: 480 },
    { width: 2560, height: 1440 },
] as const;

for (const { width, height } of VIEWPORTS) {
    test.describe(`Home at ${String(width)}x${String(height)}`, () => {
        test('keeps Deal cards and Continue game inside the viewport without scrolling', async ({ page }) => {
            await seedRecord(page, { current: worstColumnState() });
            await page.setViewportSize({ width, height });
            await page.goto('/');
            await expect(page.getByRole('button', { name: 'Continue game' })).toBeVisible();

            const measured = await page.evaluate(() => {
                const box = (name: string) => {
                    const button = [...document.querySelectorAll('.cta-row button')].find(
                        (candidate) => candidate.textContent === name,
                    );
                    if (!button) throw new Error(`no ${name} button`);
                    const { top, bottom, left, right } = button.getBoundingClientRect();
                    return { top, bottom, left, right };
                };
                return {
                    scrollY: window.scrollY,
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight,
                    horizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
                    deal: box('Deal cards'),
                    resume: box('Continue game'),
                };
            });

            expect(measured.scrollY).toBe(0);
            expect(measured.horizontalScroll).toBe(false);
            for (const button of [measured.deal, measured.resume]) {
                expect(button.top).toBeGreaterThanOrEqual(-TOLERANCE);
                expect(button.left).toBeGreaterThanOrEqual(-TOLERANCE);
                expect(button.right).toBeLessThanOrEqual(measured.innerWidth + TOLERANCE);
                expect(button.bottom).toBeLessThanOrEqual(measured.innerHeight + TOLERANCE);
            }
        });
    });
}

test('stacks the hero, copy above the card fan, at 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const copy = await page.locator('.home-hero__copy').boundingBox();
    const art = await page.locator('.home-hero__art').boundingBox();

    if (!copy || !art) throw new Error('the hero has no copy or art');
    expect(art.y).toBeGreaterThanOrEqual(copy.y + copy.height - TOLERANCE);
});

test('keeps the footer links and the build stamp reachable below the record strip', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByLabel('Your record')).toBeAttached();
    for (const name of ['Statistics', 'Settings', 'Play a deal code', 'About']) {
        await expect(page.getByRole('navigation', { name: 'More' }).getByRole('button', { name })).toBeAttached();
    }
    await expect(page.getByLabel(/^App build:/)).toHaveAccessibleName(
        /^App build: (Build \d+|Development build) · \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/,
    );
});

test('chooses Hard in Draw 3 by keyboard, then deals', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'keyboard input is exercised once, in Desktop Chrome');
    await page.goto('/');
    const tile = page.getByRole('radio', { name: 'Draw 3' });
    await tile.click();
    await tile.focus();

    // Tab leaves the tile for the switch, then lands on the Difficulty group at its checked option.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('switch', { name: 'Winnable deals only' })).toBeFocused();
    await page.keyboard.press('Tab');
    const group = page.getByRole('radiogroup', { name: 'Difficulty' });
    await expect(group.getByRole('radio', { name: 'Any' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { name: 'Hard' })).toBeFocused();
    await expect(group.getByRole('radio', { name: 'Hard' })).toHaveAttribute('aria-checked', 'true');
    await expect(group.getByRole('radio', { name: 'Any' })).toHaveAttribute('aria-checked', 'false');

    await page.getByRole('button', { name: 'Deal cards' }).click();
    await expect(page.locator('.board')).toBeVisible();
    await expect(page.locator('[data-card-id]').first()).toBeAttached();

    await expect
        .poll(() =>
            page.evaluate((key) => {
                const stored = JSON.parse(window.localStorage.getItem(key) ?? 'null') as {
                    preferences?: { difficulty?: string; selectedMode?: string };
                } | null;
                return `${stored?.preferences?.selectedMode ?? ''}:${stored?.preferences?.difficulty ?? ''}`;
            }, STORAGE_KEY),
        )
        .toBe('draw3:hard');
});
