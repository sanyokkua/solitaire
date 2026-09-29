import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { startDistServer } from './support/distServer';
import { readGame } from './support/game';
import { holdDealPool, playerWorker, tagWorkers } from './support/workers';

test.use({ serviceWorkers: 'allow' });

const MOVES_VALUE = '.stat-display--moves .stat-display__value';

const CHROMIUM_ONLY = 'service workers are exercised once, in Desktop Chrome';

/** Every URL the page requests, recorded from the moment it is called. */
function recordRequests(page: Page): string[] {
    const urls: string[] = [];
    page.on('request', (request) => urls.push(request.url()));
    return urls;
}

/** Visits Home online and resolves once the service worker is active, so the precache is complete. */
async function visitOnline(page: Page): Promise<void> {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Solitaire' })).toBeVisible();
    await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        if (!registration.active) throw new Error('no active service worker');
    });
}

/** Opens a page on `context` while offline and returns it with its request log. */
async function openOffline(context: BrowserContext): Promise<{ page: Page; requests: string[] }> {
    await context.setOffline(true);
    const page = await context.newPage();
    const requests = recordRequests(page);
    await page.goto('./');
    return { page, requests };
}

function expectSameOrigin(requests: readonly string[], baseURL: string | undefined): void {
    expect(requests.length).toBeGreaterThan(0);
    const origin = new URL(baseURL ?? '').origin;
    for (const url of requests) {
        expect(new URL(url).origin, url).toBe(origin);
    }
}

/** The deal glide gates input until it settles. */
async function settleAnimations(page: Page): Promise<void> {
    await page.waitForFunction(() =>
        document.getAnimations().every((animation) => animation.playState !== 'running' && !animation.pending),
    );
}

async function dealAndDraw(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Deal cards' }).click();
    await expect(page.locator('[data-card-id]')).toHaveCount(52, { timeout: 30_000 });
    await settleAnimations(page);
    await page.locator('.slot[data-pile="stock"]').click({ force: true });
    await expect(page.locator(MOVES_VALUE)).toHaveText('001');
}

test.describe('Offline', () => {
    test('offline cold start: Home, a Winnable Draw 1 deal, a move and Settings all work', async ({
        context,
        baseURL,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', CHROMIUM_ONLY);
        const online = await context.newPage();
        await visitOnline(online);
        await online.close();

        // The deal must be the player's own search, not one served from the pool, so the pool is held.
        await holdDealPool(context);
        await tagWorkers(context);
        const { page, requests } = await openOffline(context);

        await expect(page.getByRole('heading', { name: 'Solitaire' })).toBeVisible();
        const fontsLoaded = await page.evaluate(async () => {
            await document.fonts.ready;
            return ['Inter', 'Press Start 2P'].map((family) =>
                [...document.fonts].some(
                    (face) => face.family.replaceAll('"', '') === family && face.status === 'loaded',
                ),
            );
        });
        expect(fontsLoaded).toEqual([true, true]);

        await expect(page.getByRole('radio', { name: /Draw 1/ })).toBeChecked();
        await expect(page.getByRole('switch', { name: /Winnable/ })).toBeChecked();
        await dealAndDraw(page);
        const worker = await playerWorker(page, 'draw1');
        expect(worker.url).toContain('worker');
        expect(worker.answered, 'the solver worker loaded offline and answered').toBe(true);

        await page.getByRole('button', { name: 'Settings' }).click();
        await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();

        expectSameOrigin(requests, baseURL);
    });

    test('offline, a reload on Game and Continue from Home restore the game', async ({
        context,
        baseURL,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', CHROMIUM_ONLY);
        const online = await context.newPage();
        await visitOnline(online);
        await online.close();

        const { page, requests } = await openOffline(context);
        await dealAndDraw(page);
        // The writer is debounced; a hidden page flushes it, as leaving the tab would.
        await page.evaluate(() => {
            window.dispatchEvent(new Event('pagehide'));
        });

        // The route is not persisted: a cold start opens Home, with the saved game one Continue away.
        await page.reload();
        await page.getByRole('button', { name: 'Continue game' }).click();
        await expect(page.locator('[data-card-id]')).toHaveCount(52);
        await expect(page.locator(MOVES_VALUE)).toHaveText('001');

        expectSameOrigin(requests, baseURL);
    });
});

test('update after saving: Later hides the notice for the session, Update reloads with the game restored', async ({
    page,
}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', CHROMIUM_ONLY);
    // context.route never sees a worker's update check, so this test serves the built app from its own origin.
    const server = await startDistServer();
    try {
        await page.goto(server.url);
        await expect(page.getByRole('heading', { name: 'Solitaire' })).toBeVisible();
        await page.evaluate(async () => {
            await navigator.serviceWorker.ready;
        });
        // A new version only waits behind a page the worker controls; the first visit is not controlled.
        await page.reload();
        await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

        await page.getByRole('button', { name: 'Deal cards' }).click();
        await expect(page.locator('[data-card-id]')).toHaveCount(52, { timeout: 30_000 });
        await settleAnimations(page);
        for (const moves of ['001', '002', '003']) {
            await page.locator('.slot[data-pile="stock"]').click({ force: true });
            await expect(page.locator(MOVES_VALUE)).toHaveText(moves);
            await settleAnimations(page);
        }
        await expect.poll(async () => (await readGame(page)).seconds, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

        const checkForUpdate = async () => {
            server.changeWorker();
            await page.evaluate(async () => {
                const registration = await navigator.serviceWorker.ready;
                await registration.update();
            });
        };
        const notice = page.getByText('A new version is ready.');

        await checkForUpdate();
        await expect(notice).toBeVisible();
        await page.getByRole('button', { name: 'Later' }).click();
        await expect(notice).toBeHidden();

        // Later lasts for the session: a changed worker found again does not bring the notice back.
        await checkForUpdate();
        await expect
            .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).waiting !== null))
            .toBe(true);
        await page.waitForTimeout(500);
        await expect(notice).toBeHidden();

        // A fresh page load is a new session; the changed worker is still waiting and is offered again.
        await page.reload();
        await expect(notice).toBeVisible();
        await page.getByRole('button', { name: 'Continue game' }).click();
        await expect(page.locator('[data-card-id]')).toHaveCount(52);
        const before = await readGame(page);
        await page.getByRole('button', { name: 'Update', exact: true }).click();

        // The update reloads onto Home; the saved game is one Continue away.
        await page.getByRole('button', { name: 'Continue game' }).click();
        await expect(page.locator('[data-card-id]')).toHaveCount(52);
        const after = await readGame(page);
        expect(after.moves).toBe('003');
        expect(after.seconds).toBeGreaterThanOrEqual(before.seconds);
    } finally {
        await server.close();
    }
});
