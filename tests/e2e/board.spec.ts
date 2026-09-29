import { expect, test, type Page } from '@playwright/test';
import { worstColumnState } from '../fixtures/boardPositions';
import { seedRecord } from './support/seed';

/** The cards' names and boxes, keyed by card id. */
async function snapshotCards(page: Page) {
    return page.locator('[data-card-id]').evaluateAll((cards) =>
        cards.map((card) => {
            const box = card.getBoundingClientRect();
            return {
                id: card.getAttribute('data-card-id'),
                name: card.getAttribute('aria-label'),
                x: Math.round(box.x),
                y: Math.round(box.y),
            };
        }),
    );
}

async function continueToGame(page: Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue game' }).click();
    await expect(page.locator('[data-card-id]')).toHaveCount(52);
}

test.describe('A seeded game on the board', () => {
    test.beforeEach(async ({ page }) => {
        await seedRecord(page, { current: worstColumnState() });
    });

    // covers: KS-A11Y-01
    test('renders 52 named cards and a named stock', async ({ page }) => {
        await continueToGame(page);

        await expect(page.getByRole('button', { name: 'King of Spades' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Stock, 33 cards' })).toBeVisible();
    });

    test('keeps the table content inside its panel', async ({ page }) => {
        await continueToGame(page);

        await expect(page.locator('.board-panel')).toHaveCSS('isolation', 'isolate');
    });

    // covers: KS-PER-02
    test('survives a reload unchanged', async ({ page }) => {
        await continueToGame(page);
        const before = await snapshotCards(page);

        await page.reload();
        await page.getByRole('button', { name: 'Continue game' }).click();
        await expect(page.locator('[data-card-id]')).toHaveCount(52);

        expect(await snapshotCards(page)).toEqual(before);
    });
});
