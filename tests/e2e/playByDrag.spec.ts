import { expect, test } from '@playwright/test';
import { continueToGame } from './support/cards';
import { playLine, seedWinningGame } from './support/play';

const ANNOUNCER = '[aria-live="polite"].sr-only';
const MOVES_VALUE = '.stat-display--moves .stat-display__value';

test.describe('Playing by dragging', () => {
    test('the whole recorded line, played by dragging cards and clicking the stock, wins the game', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'the 117-command line is played once, in Desktop Chrome');
        test.setTimeout(180_000);
        await seedWinningGame(page);
        await continueToGame(page);

        await playLine(page, 'drag');

        await expect(page.locator(ANNOUNCER)).toContainText('You win');
        await expect(page.locator(MOVES_VALUE)).toHaveText('117');
        await expect(page.getByRole('heading', { name: 'You win!' })).toBeVisible({ timeout: 4000 });
    });
});
