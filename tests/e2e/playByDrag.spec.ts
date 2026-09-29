import { test } from '@playwright/test';
import { continueToGame } from './support/cards';
import { WINNING_LINE } from '../fixtures/deals';
import { expectWon, playLine, seedWinningGame, skipOutsideFullGameProjects } from './support/play';

test.describe('Playing by dragging', () => {
    test('the whole recorded line, played by dragging cards and clicking the stock, wins the game', async ({
        page,
    }, testInfo) => {
        skipOutsideFullGameProjects(testInfo);
        test.setTimeout(180_000);
        await seedWinningGame(page);
        await continueToGame(page);

        await playLine(page, 'drag');

        await expectWon(page, WINNING_LINE);
    });
});
