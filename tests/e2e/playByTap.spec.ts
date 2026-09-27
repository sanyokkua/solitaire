import { expect, test } from '@playwright/test';
import { ACE_HOME_CARD, aceHomePosition, oneMovePosition, SIX_OF_DIAMONDS } from '../fixtures/boardPositions';
import { cardOf, continueToGame } from './support/cards';
import { playLine, seedWinningGame } from './support/play';
import { seedRecord } from './support/seed';

const ANNOUNCER = '[aria-live="polite"].sr-only';
const MOVES_VALUE = '.stat-display--moves .stat-display__value';

test.describe('Playing by tapping', () => {
    test('the whole recorded line, played by select-and-place and stock taps, wins the game', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'the 117-command line is played once, in Desktop Chrome');
        test.setTimeout(180_000);
        await seedWinningGame(page);
        await continueToGame(page);

        await playLine(page, 'tap');

        await expect(page.locator(ANNOUNCER)).toContainText('You win');
        await expect(page.locator(MOVES_VALUE)).toHaveText('117');
    });

    test('a tap on a card moves it to its one legal place in Smart move mode', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'tap input is exercised once, in Desktop Chrome');
        await seedRecord(page, { current: oneMovePosition(), preferences: { autoSafe: false } });
        await continueToGame(page);

        await cardOf(page, SIX_OF_DIAMONDS).click();

        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-pile', 'tableau:0');
        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-index', '1');
    });

    test('a double tap sends an exposed ace home in Select and place mode', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'tap input is exercised once, in Desktop Chrome');
        await seedRecord(page, { current: aceHomePosition(), preferences: { tapMode: 'select', autoSafe: false } });
        await continueToGame(page);

        await cardOf(page, ACE_HOME_CARD).dblclick({ position: { x: 12, y: 3 } });

        await expect(cardOf(page, ACE_HOME_CARD)).toHaveAttribute('data-pile', 'foundation:0');
    });
});
