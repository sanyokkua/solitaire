import { expect, test, type Page } from '@playwright/test';

/** Opens Home at `size` (or the project's own viewport) and deals; resolves once a game is in play and its board is sized. */
async function openGame(page: Page, size?: { readonly width: number; readonly height: number }): Promise<void> {
    if (size !== undefined) await page.setViewportSize(size);
    await page.goto('/');
    await page.getByRole('button', { name: 'Deal cards' }).click();
    await expect(page.locator('.board')).toBeVisible();
    await expect(page.locator('.stat-display--timer')).toBeVisible();
    await expect(page.locator('[data-card-id]').first()).toBeAttached();
}

test.describe('Game frame profiles', () => {
    test('Phone on its side uses rails', async ({ page }) => {
        await openGame(page, { width: 874, height: 350 });

        await expect(page.locator('.game-topbar')).toHaveCount(0);
        await expect(page.locator('.game-hint')).toBeHidden();
        await expect(page.locator('.game-footer')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Back to Home' })).toBeVisible();
        await expect(page.locator('.stat-display--moves')).toBeVisible();
    });

    test('Tall landscape stays stacked', async ({ page }) => {
        await openGame(page, { width: 835, height: 752 });

        await expect(page.locator('.game-topbar')).toBeVisible();
        await expect(page.locator('.game-hint')).toBeVisible();
        await expect(page.locator('.game-footer')).toBeVisible();
    });

    test('Short desktop window uses rails', async ({ page }) => {
        await openGame(page, { width: 1280, height: 720 });

        await expect(page.locator('.game-topbar')).toHaveCount(0);
        await expect(page.locator('.game-hint')).toBeHidden();
        await expect(page.locator('.game-footer')).toBeHidden();
        await expect(page.locator('.board')).toHaveAttribute('data-wide', 'false');
    });

    test('Narrow phone hides Moves', async ({ page }) => {
        await openGame(page, { width: 360, height: 780 });

        await expect(page.locator('.stat-display--moves')).toBeHidden();
        await expect(page.locator('.stat-display--score')).toBeVisible();
        await expect(page.locator('.stat-display--timer')).toBeVisible();
    });

    test('The Game screen never scrolls', async ({ page }) => {
        for (const size of [
            { width: 874, height: 350 },
            { width: 835, height: 752 },
            { width: 360, height: 780 },
            { width: 320, height: 480 },
        ]) {
            await openGame(page, size);

            const overflow = await page.evaluate(() => ({
                horizontal: document.documentElement.scrollWidth > window.innerWidth,
                vertical: document.documentElement.scrollHeight > window.innerHeight,
            }));
            expect(overflow, `${String(size.width)}x${String(size.height)}`).toEqual({
                horizontal: false,
                vertical: false,
            });
        }
    });
});

test.describe('Touch target size', () => {
    /** The Back, Undo and Redo boxes, keyed by name. */
    async function controlBoxes(page: Page) {
        const boxes: Record<string, { width: number; height: number } | null> = {};
        for (const name of ['Back to Home', 'Undo', 'Redo']) {
            boxes[name] = await page.getByRole('button', { name }).boundingBox();
        }
        return boxes;
    }

    async function expectTargets(page: Page, label: string): Promise<void> {
        const boxes = await controlBoxes(page);
        for (const [name, box] of Object.entries(boxes)) {
            expect(box, `${label}: ${name}`).not.toBeNull();
            expect(box?.width, `${label}: ${name} width`).toBeGreaterThanOrEqual(44);
            expect(box?.height, `${label}: ${name} height`).toBeGreaterThanOrEqual(44);
        }
    }

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
        test.skip(!coarse, 'Touch targets are only required where the pointer is coarse.');
    });

    test('Back, Undo and Redo are at least 44x44 in the project viewport', async ({ page }) => {
        await openGame(page);

        await expectTargets(page, 'project viewport');
    });

    test('Back, Undo and Redo are at least 44x44 in the rails at 874x350', async ({ page }) => {
        await openGame(page, { width: 874, height: 350 });

        await expectTargets(page, '874x350');
    });
});
