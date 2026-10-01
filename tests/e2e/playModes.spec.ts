import { expect, test } from '@playwright/test';
import { encodeDealCode } from '../../src/domain/dealCode';
import { DAILY_LINE, DRAW3_LINE, VEGAS_LINE, parseLine } from '../fixtures/deals';
import { makeState } from '../fixtures/states';
import { continueToGame } from './support/cards';
import { LINE_PREFERENCES, expectWon, playLine, seedWinningGame, skipOutsideFullGameProjects } from './support/play';
import { seedRecord } from './support/seed';

const DEAL_TIMEOUT = 60_000;
const GAME_TIMEOUT = 300_000;

test.describe('Playing every mode to a win', () => {
    // covers: KS-INP-08, KS-MOVE-07
    test('a Draw 3 game is won by the keyboard alone', async ({ page }, testInfo) => {
        skipOutsideFullGameProjects(testInfo);
        test.setTimeout(GAME_TIMEOUT);
        await seedWinningGame(page, {}, DRAW3_LINE);
        await continueToGame(page);

        await playLine(page, 'keyboard', { commands: parseLine(DRAW3_LINE.line) });

        await expectWon(page, DRAW3_LINE);
    });

    // covers: KS-INP-04, KS-INP-06, KS-MOVE-07, KS-SCO-02
    test('a Vegas game is won by dragging, and the bank ends where the line says', async ({ page }, testInfo) => {
        skipOutsideFullGameProjects(testInfo);
        test.setTimeout(GAME_TIMEOUT);
        await seedWinningGame(page, {}, VEGAS_LINE);
        await continueToGame(page);

        await playLine(page, 'drag', { commands: parseLine(VEGAS_LINE.line) });

        await expectWon(page, VEGAS_LINE);
    });

    // covers: KS-DEAL-07, KS-MOVE-07
    test('the Daily deal, dealt from Home on its UTC date, is won by taps', async ({ page }, testInfo) => {
        skipOutsideFullGameProjects(testInfo);
        test.setTimeout(GAME_TIMEOUT);
        // Only the browser's Date moves: timers and the real worker run normally, so the worker selects the pinned seed.
        await page.clock.setFixedTime(new Date(`${DAILY_LINE.day}T12:00:00Z`));
        await seedRecord(page, { current: makeState(), preferences: LINE_PREFERENCES });
        await page.goto('/');

        await page.getByRole('radio', { name: 'Daily deal' }).click();
        await page.getByRole('button', { name: 'Deal cards' }).click();
        await expect(page.locator('.deal-code')).toHaveText(`Deal ${encodeDealCode(DAILY_LINE.seed, 'daily')}`, {
            timeout: DEAL_TIMEOUT,
        });
        await expect(page.locator('[data-card-id]')).toHaveCount(52, { timeout: DEAL_TIMEOUT });

        await playLine(page, 'tap', { commands: parseLine(DAILY_LINE.line) });

        await expectWon(page, DAILY_LINE);
    });
});
