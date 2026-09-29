import { expect, test } from '@playwright/test';
import { oneMovePosition, SIX_OF_DIAMONDS } from '../fixtures/boardPositions';
import { BACKUP_KEY, STORAGE_KEY } from '../../src/features/persistence/recordCodec';
import { cardOf, continueToGame } from './support/cards';
import { failSaves, seedRaw, seedRecord } from './support/seed';

const MOVES_VALUE = '.stat-display--moves .stat-display__value';
const STOCK = ".slot[data-pile='stock']";
const CORRUPT = '{not json';

test.describe('Corrupt saved data', () => {
    test('starts with the defaults, keeps the unreadable text as a backup, and a new deal plays', async ({ page }) => {
        await seedRaw(page, CORRUPT);
        await page.goto('/');

        await expect(page.locator('.notice--storage')).toContainText(
            'Saved data could not be read. A fresh start was made and the old data was kept as a backup.',
        );
        expect(await page.evaluate((key) => window.localStorage.getItem(key), BACKUP_KEY)).toBe(CORRUPT);

        // Home shows the defaults: no game to continue, the System theme, night cards off.
        await expect(page.getByRole('button', { name: 'Deal cards' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Continue game' })).toHaveCount(0);
        await page.getByRole('navigation', { name: 'More' }).getByRole('button', { name: 'Settings' }).click();
        await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();
        await expect(page.getByRole('switch', { name: 'Night cards' })).not.toBeChecked();
        await page.keyboard.press('Escape');
        await expect(page.locator('.modal-sheet')).toHaveCount(0);

        // A new game is dealt (the default Draw 1 winnable deal runs the real solver) and played.
        await page.getByRole('button', { name: 'Deal cards' }).click();
        await expect(page.locator('[data-card-id]')).toHaveCount(52, { timeout: 60_000 });
        // The deal glide has ended once no card carries its stagger delay any more.
        await expect
            .poll(() =>
                page
                    .locator('[data-card-id]')
                    .evaluateAll((cards) => cards.some((c) => c.style.getPropertyValue('--d') !== '')),
            )
            .toBe(false);
        await page.locator(STOCK).click({ force: true });
        await expect(page.locator(MOVES_VALUE)).toHaveText('001');
    });
});

test.describe('A failing save', () => {
    test('shows the write notice and keeps the game playable', async ({ page }) => {
        await seedRecord(page, { current: oneMovePosition(), preferences: { autoSafe: false } });
        await failSaves(page);
        await continueToGame(page);

        await cardOf(page, SIX_OF_DIAMONDS).click();

        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-pile', 'tableau:0');
        await expect(page.locator('.notice--storage')).toContainText('Your progress could not be saved.');
        await expect(page.locator(MOVES_VALUE)).toHaveText('001');

        // The next move still applies, and nothing was ever written after the seed.
        await page.locator(STOCK).click({ force: true });
        await expect(page.locator(MOVES_VALUE)).toHaveText('002');
        const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
        expect(
            (JSON.parse(stored ?? 'null') as { session: { current: { moves: number } } }).session.current.moves,
        ).toBe(0);
    });
});
