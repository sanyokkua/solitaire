import { expect, test } from '@playwright/test';

/** Whether the document overflows the window in either direction. */
const scrolls = () =>
    ({
        horizontal: document.documentElement.scrollWidth > window.innerWidth,
        vertical: document.documentElement.scrollHeight > window.innerHeight,
    }) as const;

test('loads Home, fits the viewport, and navigates to Game and back', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Solitaire' })).toBeVisible();

    expect(await page.evaluate(scrolls)).toEqual({ horizontal: false, vertical: false });

    await page.getByRole('button', { name: 'Deal cards' }).click();
    // The Game heading is visually hidden (it names the screen for assistive technology), so it is attached, not visible.
    await expect(page.getByRole('heading', { name: 'Klondike' })).toBeAttached();
    await expect(page.locator('.board-panel')).toBeVisible();
    await expect(page.locator('.stat-display--timer')).toBeVisible();
    await expect(page.locator('[data-card-id]').first()).toBeAttached();

    expect(await page.evaluate(scrolls)).toEqual({ horizontal: false, vertical: false });

    await page.getByRole('button', { name: 'Back to Home' }).click();
    await expect(page.getByRole('heading', { name: 'Solitaire' })).toBeVisible();
});

test('the production page exposes no store or hook on window', async ({ page }) => {
    await page.goto('/');

    const extras = await page.evaluate(() => {
        const frame = document.createElement('iframe');
        document.body.append(frame);
        const pristine = new Set(Object.keys(frame.contentWindow ?? {}));
        frame.remove();
        return Object.keys(window).filter((key) => !pristine.has(key) && !key.startsWith('__pw'));
    });

    expect(extras).toEqual([]);
});
