import { expect, test, type Page } from '@playwright/test';
import { applyCommand } from '../../src/domain/engine';
import { finishPlan } from '../../src/domain/finish';
import { displayedScore } from '../../src/domain/scoring';
import type { GameState } from '../../src/domain/types';
import { undoMovePosition } from '../fixtures/boardPositions';
import { allFaceUp } from '../fixtures/deals';
import { cardOf, continueToGame, KING_OF_SPADES, type Point } from './support/cards';
import { expectClockCarriedOn, placement, placementOf, readGame } from './support/game';
import { readStoredSession, seedRecord } from './support/seed';

const DRAG_STEPS = 12;
const FOUNDATION_CARDS = "[data-card-id][data-pile^='foundation']";

/** The move count of the session the app has stored. */
async function storedMoves(page: Page): Promise<number> {
    return (await readStoredSession(page)).current.moves;
}

/** The middle of the element's box, in page coordinates. */
async function centreOf(page: Page, selector: string): Promise<Point> {
    const box = await page.locator(selector).boundingBox();
    if (box === null) throw new Error(`${selector} has no box`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('Reloading in the middle of play', () => {
    test('a reload with the mouse held mid-drag resumes the last committed position', async ({ page }) => {
        const { current, history } = undoMovePosition();
        await seedRecord(page, { current, history, preferences: { autoSafe: false } });
        await continueToGame(page);
        await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
        const before = { ...(await readGame(page)), placed: await placement(page) };
        expect(before.moves).toBe('001');
        const storedBefore = await storedMoves(page);

        // Pick up the king of spades (alone in column 3) and carry it over the empty first column.
        const start = await centreOf(page, `[data-card-id='${String(KING_OF_SPADES)}']`);
        const emptyColumn = await centreOf(page, ".slot[data-pile='tableau:0']");
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(emptyColumn.x, emptyColumn.y, { steps: DRAG_STEPS });
        await expect(cardOf(page, KING_OF_SPADES)).toHaveClass(/is-dragging/);

        // The button is still held when the page goes away.
        await page.reload();
        await page.mouse.up();
        await continueToGame(page);

        const after = { ...(await readGame(page)), placed: await placement(page) };
        expect(after.placed).toEqual(before.placed);
        expect(after.moves).toBe(before.moves);
        expectClockCarriedOn(before, after);
        await expect(page.locator('.is-dragging')).toHaveCount(0);
        await expect(page.locator('.is-selected')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
        expect(await storedMoves(page)).toBe(storedBefore);
    });

    test('a reload in the middle of Finish resumes a position the game reached, and Finish still wins', async ({
        page,
    }) => {
        const start = allFaceUp();
        const plan = finishPlan(start);
        if (plan === undefined) throw new Error('the seeded position has no finish plan');
        // Every position Finish passes through, the seeded one first.
        const reached: GameState[] = [start];
        for (const command of plan.commands) {
            reached.push(applyCommand(reached[reached.length - 1] ?? start, command).state);
        }

        await seedRecord(page, { current: start, preferences: { autoSafe: false, tapMode: 'select' } });
        await continueToGame(page);
        const homeBefore = await page.locator(FOUNDATION_CARDS).count();

        await page.getByRole('button', { name: 'Finish' }).click();
        // Motion is on: a step lands every 75 ms, so a card reaches a foundation while many steps are still to come.
        await expect
            .poll(async () => page.locator(FOUNDATION_CARDS).count(), { intervals: [10] })
            .toBeGreaterThan(homeBefore);
        await page.reload();
        await continueToGame(page);

        const resumed = await placement(page);
        expect(Object.keys(resumed)).toHaveLength(52);
        const matches = reached.filter((position) => {
            const expected = placementOf(position);
            return Object.keys(expected).every((id) => expected[id] === resumed[id]);
        });
        expect(matches).toHaveLength(1);
        const position = matches[0] ?? start;
        expect(position).not.toBe(start);
        expect(position).not.toBe(reached[reached.length - 1]);

        // The HUD shows that position's move count and its score less the time penalty of the clock so far.
        const shown = await readGame(page);
        expect(Number(shown.moves)).toBe(position.moves);
        expect(shown.score).toBeLessThanOrEqual(displayedScore({ ...position, elapsedMs: 0 }));
        expect(shown.score).toBeGreaterThanOrEqual(
            displayedScore({ ...position, elapsedMs: (shown.seconds + 2) * 1000 }),
        );

        // Finish does not resume by itself: it can be started again and wins.
        await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled();
        await page.getByRole('button', { name: 'Finish' }).click();
        await expect(page.getByRole('heading', { name: 'You win!' })).toBeVisible({ timeout: 15_000 });
    });
});
