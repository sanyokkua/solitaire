// covers: KS-INP-08

import { expect, test } from '@playwright/test';
import {
    ACE_HOME_CARD,
    aceHomePosition,
    oneMovePosition,
    SEVEN_OF_SPADES,
    SIX_OF_DIAMONDS,
    twoTargetsPosition,
} from '../fixtures/boardPositions';
import { WINNING_LINE } from '../fixtures/deals';
import { cardOf, continueToGame } from './support/cards';
import { expectWon, focusPile, playLine, seedWinningGame, skipOutsideFullGameProjects } from './support/play';
import { seedRecord } from './support/seed';

const MOVES_VALUE = '.stat-display--moves .stat-display__value';

test.describe('Playing by keyboard', () => {
    // covers: KS-MOVE-07
    test('the whole recorded line, played by arrow keys and Enter, wins the game', async ({ page }, testInfo) => {
        skipOutsideFullGameProjects(testInfo);
        test.setTimeout(180_000);
        await seedWinningGame(page);
        await continueToGame(page);

        await playLine(page, 'keyboard');

        await expectWon(page, WINNING_LINE);
    });

    test('Space with nothing focused draws from the stock', async ({ page }) => {
        await seedWinningGame(page);
        await continueToGame(page);
        await page.evaluate(() => {
            (document.activeElement as HTMLElement | null)?.blur();
        });

        await page.keyboard.press('Space');

        await expect(page.locator(MOVES_VALUE)).toHaveText('001');
    });

    test('undo, redo, hint, pick-up and Escape work from the keyboard', async ({ page }) => {
        await seedRecord(page, { current: oneMovePosition(), preferences: { tapMode: 'select', autoSafe: false } });
        await continueToGame(page);
        const six = cardOf(page, SIX_OF_DIAMONDS);

        await page.locator('.slot[data-pile="stock"]').focus();
        await focusPile(page, 'tableau:1');
        await page.keyboard.press('Enter');
        await focusPile(page, 'tableau:0');
        await page.keyboard.press('Enter');
        await expect(six).toHaveAttribute('data-pile', 'tableau:0');
        await expect(page.locator(MOVES_VALUE)).toHaveText('001');

        await page.keyboard.press('Control+z');
        await expect(six).toHaveAttribute('data-pile', 'tableau:1');
        await expect(page.locator(MOVES_VALUE)).toHaveText('000');

        await page.keyboard.press('Control+y');
        await expect(six).toHaveAttribute('data-pile', 'tableau:0');
        await expect(page.locator(MOVES_VALUE)).toHaveText('001');

        await page.keyboard.press('Control+z');
        await expect(six).toHaveAttribute('data-pile', 'tableau:1');

        await page.keyboard.press('h');
        // The 6 onto the 7 reveals nothing, so the hint is the draw, and the stock slot is what it marks.
        await expect(page.locator('.game-hint')).toContainText('draw from the stock');
        await expect(page.locator('.slot[data-pile="stock"].is-hint')).toBeVisible();

        await six.focus();
        await page.keyboard.press('Shift+Enter');
        await expect(six).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.press('Escape');
        await expect(six).toHaveAttribute('aria-pressed', 'false');
    });

    // covers: KS-AST-02
    test('H hints a productive move and marks its card', async ({ page }) => {
        await seedRecord(page, { current: aceHomePosition(), preferences: { tapMode: 'select', autoSafe: false } });
        await continueToGame(page);

        await page.keyboard.press('h');

        await expect(page.locator('.game-hint')).toContainText('Ace of Hearts');
        await expect(cardOf(page, ACE_HOME_CARD)).toHaveClass(/is-hint/);
    });

    test('a picked-up card is placed on the column the arrows chose, not the one Smart move prefers', async ({
        page,
    }) => {
        await seedRecord(page, { current: twoTargetsPosition(), preferences: { autoSafe: false } });
        await continueToGame(page);
        const six = cardOf(page, SIX_OF_DIAMONDS);

        await six.focus();
        await page.keyboard.press('Shift+Enter');
        await expect(six).toHaveAttribute('aria-pressed', 'true');
        await focusPile(page, 'tableau:2');
        await page.keyboard.press('Enter');

        await expect(six).toHaveAttribute('data-pile', 'tableau:2');
        await expect(six).toHaveAttribute('data-index', '1');
        await expect(cardOf(page, SEVEN_OF_SPADES)).toHaveAttribute('data-pile', 'tableau:2');
    });
});
