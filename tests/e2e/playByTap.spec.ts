// covers: KS-INP-01, KS-INP-02, KS-INP-03

import { expect, test } from '@playwright/test';
import { ACE_HOME_CARD, aceHomePosition, oneMovePosition, SIX_OF_DIAMONDS } from '../fixtures/boardPositions';
import { WINNING_LINE } from '../fixtures/deals';
import { cardOf, continueToGame } from './support/cards';
import { expectWon, playLine, seedWinningGame, skipOutsideFullGameProjects } from './support/play';
import { seedRecord } from './support/seed';

test.describe('Playing by tapping', () => {
    // covers: KS-MOVE-07
    test('the whole recorded line, played by select-and-place and stock taps, wins the game', async ({
        page,
    }, testInfo) => {
        skipOutsideFullGameProjects(testInfo);
        test.setTimeout(180_000);
        await seedWinningGame(page);
        await continueToGame(page);

        await playLine(page, 'tap');

        await expectWon(page, WINNING_LINE);
    });

    test('a tap on a card moves it to its one legal place in Smart move mode', async ({ page }) => {
        await seedRecord(page, { current: oneMovePosition(), preferences: { autoSafe: false } });
        await continueToGame(page);

        await cardOf(page, SIX_OF_DIAMONDS).click();

        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-pile', 'tableau:0');
        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-index', '1');
    });

    test('a double tap sends an exposed ace home in Select and place mode', async ({ page }) => {
        await seedRecord(page, { current: aceHomePosition(), preferences: { tapMode: 'select', autoSafe: false } });
        await continueToGame(page);

        await cardOf(page, ACE_HOME_CARD).dblclick({ position: { x: 12, y: 3 } });

        await expect(cardOf(page, ACE_HOME_CARD)).toHaveAttribute('data-pile', 'foundation:0');
    });
});
