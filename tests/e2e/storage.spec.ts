import { expect, test } from '@playwright/test';
import { oneMovePosition, SIX_OF_DIAMONDS } from '../fixtures/boardPositions';
import { BACKUP_KEY, STORAGE_KEY } from '../../src/features/persistence/recordCodec';
import { V1_RECORD } from '../fixtures/storage';
import { cardOf, continueToGame } from './support/cards';
import { MOVES_VALUE } from './support/game';
import { stockSlot } from './support/play';
import { failSaves, readStoredSession, seedRaw, seedRecord } from './support/seed';

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

        // Statistics are the defaults too: nothing played in any of the four modes, no records, no Daily streak.
        await page.getByRole('button', { name: 'Statistics' }).click();
        const stats = page.getByRole('dialog', { name: 'Statistics' });
        await expect(stats).toBeVisible();
        const rows = {
            Played: '0',
            Won: '0',
            'Win rate': '—',
            'Best time': '—',
            'Best score': '—',
            'Best streak': '—',
        };
        for (const [label, value] of Object.entries(rows)) {
            const cells = stats
                .getByRole('row')
                .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) });
            await expect(cells.getByRole('cell'), label).toHaveText([value, value, value, value]);
        }
        await expect(stats).toContainText('Daily streak: 0 (best 0)');
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
        await stockSlot(page).click({ force: true });
        await expect(page.locator(MOVES_VALUE)).toHaveText('001');
    });
});

test.describe('A version 1 record', () => {
    test('is upgraded: the game resumes, no notice appears and the next save is version 2', async ({ page }) => {
        await seedRaw(page, V1_RECORD);
        await page.goto('/');

        await expect(page.locator('.notice--storage')).toHaveCount(0);
        expect(await page.evaluate((key) => window.localStorage.getItem(key), BACKUP_KEY)).toBeNull();
        const version = () =>
            page.evaluate(
                (key) => (JSON.parse(window.localStorage.getItem(key) ?? 'null') as { version: number }).version,
                STORAGE_KEY,
            );
        expect(await version()).toBe(1);

        // The pinned record stores Ukrainian as the language, so the screen showing it is the preferences carried over.
        await page.getByRole('button', { name: 'Продовжити гру' }).click();
        await expect(page.locator('[data-card-id]')).toHaveCount(52);
        await expect(page.locator(MOVES_VALUE)).toHaveText('003');

        // A move saves the record again, now in the current format, and the game in it is the one that was resumed.
        await stockSlot(page).click({ force: true });
        await expect(page.locator(MOVES_VALUE)).toHaveText('004');
        await expect.poll(version).toBe(2);
        expect((await readStoredSession(page)).current.moves).toBe(4);
        await expect(page.locator('.notice--storage')).toHaveCount(0);
        expect(await page.evaluate((key) => window.localStorage.getItem(key), BACKUP_KEY)).toBeNull();
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
        await stockSlot(page).click({ force: true });
        await expect(page.locator(MOVES_VALUE)).toHaveText('002');
        expect((await readStoredSession(page)).current.moves).toBe(0);
    });
});
