import { expect, test } from '@playwright/test';

test('loads Home, fits the viewport, and navigates to Game and back', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Solitaire' })).toBeVisible();

    const noScroll = await page.evaluate(() => ({
        widthOk: document.documentElement.scrollWidth <= window.innerWidth,
        heightOk: document.documentElement.scrollHeight <= window.innerHeight,
    }));
    expect(noScroll.widthOk).toBe(true);
    expect(noScroll.heightOk).toBe(true);

    await page.getByRole('button', { name: 'Deal cards' }).click();
    await expect(page.getByRole('heading', { name: 'Klondike' })).toBeVisible();

    await page.getByRole('button', { name: 'Back to Home' }).click();
    await expect(page.getByRole('heading', { name: 'Solitaire' })).toBeVisible();
});
