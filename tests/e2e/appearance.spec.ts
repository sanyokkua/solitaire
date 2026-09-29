import { expect, test, type Page } from '@playwright/test';
import { drawThreeFanState } from '../fixtures/boardPositions';
import type { Preferences } from '../../src/features/preferences/preferencesSlice';
import { expectClockCarriedOn, readGame } from './support/game';
import { seedRecord } from './support/seed';

/** A `#rrggbb` token value as the browser reports a computed colour. */
function rgb(hex: string): string {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgb(${String(value >> 16)}, ${String((value >> 8) & 0xff)}, ${String(value & 0xff)})`;
}

/** Suit indices as `data-suit` carries them. */
const HEARTS = '0';
const DIAMONDS = '1';
const CLUBS = '2';
const SPADES = '3';

/** Seeds the Draw 3 fan (every suit face up, face-down cards in the stock) with `preferences`, and opens the game. */
async function openSeeded(page: Page, preferences: Partial<Preferences>): Promise<void> {
    await seedRecord(page, { current: drawThreeFanState(), preferences });
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue game' }).click();
    await expect(page.locator('[data-card-id]')).toHaveCount(52);
}

const body = (page: Page) => page.locator('body');
const table = (page: Page) => page.locator('.board-panel');
const faceOf = (page: Page, suit: string) => page.locator(`.card.is-up[data-suit='${suit}'] .card-face`).first();
const backOf = (page: Page) => page.locator('.card:not(.is-up) .card-back').first();

test.describe('Theme', () => {
    // covers: KS-SET-03
    test.describe('Dark theme regardless of the device', () => {
        test.use({ colorScheme: 'light' });

        test('renders the dark palette although the device prefers light', async ({ page }) => {
            await openSeeded(page, { theme: 'dark' });

            await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
            await expect(body(page)).toHaveCSS('background-color', rgb('#0b2545'));
            await expect(table(page)).toHaveCSS('background-color', rgb('#102c52'));
            await expect(faceOf(page, SPADES)).toHaveCSS('background-color', rgb('#d2dde5'));
        });
    });

    // covers: KS-SET-01, KS-SET-02
    test.describe('System follows the device live', () => {
        test.use({ colorScheme: 'light' });

        test('switches to the dark palette without a reload and keeps the game', async ({ page }) => {
            await openSeeded(page, { theme: 'system' });
            await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
            await expect(body(page)).toHaveCSS('background-color', rgb('#e8f0f5'));
            const before = await readGame(page);

            await page.emulateMedia({ colorScheme: 'dark' });

            await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
            // Read straight after the attribute flips, so the wait for the 250 ms body transition cannot stretch the second.
            const after = await readGame(page);
            await expect(body(page)).toHaveCSS('background-color', rgb('#0b2545'));
            expect(after.moves).toBe(before.moves);
            expect(after.cards).toEqual(before.cards);
            expectClockCarriedOn(before, after);
        });
    });
});

// covers: KS-SET-03
test.describe('Night cards', () => {
    test('change the cards and nothing else with the light theme', async ({ page }) => {
        await openSeeded(page, { theme: 'light', nightCards: true });

        await expect(body(page)).toHaveCSS('background-color', rgb('#e8f0f5'));
        await expect(table(page)).toHaveCSS('background-color', rgb('#d4e4ee'));
        await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
        await expect(page.locator('.stat-display').first()).toHaveCSS('background-color', rgb('#0b2545'));
        await expect(faceOf(page, SPADES)).toHaveCSS('background-color', rgb('#1c3d68'));
        await expect(faceOf(page, SPADES)).toHaveCSS('border-top-color', rgb('#36608f'));
        await expect(faceOf(page, SPADES)).toHaveCSS('color', rgb('#dce8ef'));
    });

    test('override the pale backs', async ({ page }) => {
        await openSeeded(page, { nightCards: true, cardBack: 'sky' });

        await expect(backOf(page)).toHaveCSS('background-color', rgb('#8da9c4'));
    });

    test('keep a dark navy variant of the Deep navy back with a light rim', async ({ page }) => {
        await openSeeded(page, { nightCards: true, cardBack: 'navy' });

        await expect(backOf(page)).toHaveCSS('background-color', rgb('#0b2545'));
        await expect(backOf(page)).toHaveCSS('box-shadow', new RegExp(rgb('#8da9c4').replaceAll(/[().]/g, '\\$&')));
    });
});

test.describe('Deck colours and backs', () => {
    // covers: KS-A11Y-05
    test('Four colours: diamonds blue and clubs green, hearts red and spades black', async ({ page }) => {
        await openSeeded(page, { theme: 'light', fourColor: true });

        await expect(faceOf(page, DIAMONDS)).toHaveCSS('color', rgb('#287da2'));
        await expect(faceOf(page, CLUBS)).toHaveCSS('color', rgb('#348170'));
        await expect(faceOf(page, HEARTS)).toHaveCSS('color', rgb('#d1404c'));
        await expect(faceOf(page, SPADES)).toHaveCSS('color', rgb('#1d3557'));
    });

    test('Card back choice: Coral', async ({ page }) => {
        await openSeeded(page, { theme: 'light', nightCards: false, cardBack: 'coral' });

        await expect(backOf(page)).toHaveCSS('background-color', rgb('#d9555f'));
    });
});
