import { expect, test, type Page } from '@playwright/test';
import { draw3TalonState, vegasTalonState } from '../fixtures/boardPositions';
import { continueToGame } from './support/cards';
import { MOVES_VALUE, SCORE_VALUE, TIMER_VALUE } from './support/game';
import { focusPile, settleAnimations, stockSlot } from './support/play';
import { seedRecord } from './support/seed';

/** How the stock is activated: a click on its slot (the stock cards cover it, so the click is forced) or Enter on it. */
type Activate = (page: Page) => Promise<void>;

const NO_REDEALS = 'No redeals left';
/** The transient notice; the same words are also in the screen-reader announcer, so the notices host scopes the match. */
const noRedealsNotice = (page: Page) => page.locator('.notices .notice').filter({ hasText: NO_REDEALS });

const tap: Activate = async (page) => {
    await stockSlot(page).click({ force: true });
};

const keyboard: Activate = async (page) => {
    // The first press starts from the stock slot itself; a command's own Enter leaves focus on the board.
    if (!(await page.evaluate(() => document.activeElement?.hasAttribute('data-pile') ?? false))) {
        await stockSlot(page).focus();
    }
    await focusPile(page, 'stock');
    await page.keyboard.press('Enter');
};

/**
 * The score text, move text and whole seconds of the HUD as one synchronous reading, so a clock tick cannot split them.
 * `readGame` cannot stand in: it reads each value in its own round trip and parses the score as a number, while the
 * Vegas Bank is text such as '-$52'.
 */
async function hud(page: Page) {
    return page.evaluate(
        ({ score, moves, timer }) => {
            const text = (selector: string) => document.querySelector(selector)?.textContent ?? '';
            const [minutes = 0, seconds = 0] = text(timer).split(':').map(Number);
            return { score: text(score), moves: text(moves), seconds: minutes * 60 + seconds };
        },
        { score: SCORE_VALUE, moves: MOVES_VALUE, timer: TIMER_VALUE },
    );
}

/** The card ids in the waste, bottom to top. */
async function wasteIds(page: Page): Promise<string[]> {
    return page.locator('[data-card-id][data-pile="waste"]').evaluateAll((cards) =>
        cards
            .map((card) => ({
                id: card.getAttribute('data-card-id') ?? '',
                index: Number(card.getAttribute('data-index')),
            }))
            .sort((a, b) => a.index - b.index)
            .map((card) => card.id),
    );
}

/** Activates the stock and waits until the move counter shows the command was applied. */
async function activateCounted(page: Page, activate: Activate, movesAfter: number): Promise<void> {
    await activate(page);
    await expect(page.locator(MOVES_VALUE)).toHaveText(String(movesAfter).padStart(3, '0'));
    await settleAnimations(page);
}

test.describe('The Vegas pass limit', () => {
    for (const [name, activate] of [
        ['tap', tap],
        ['keyboard', keyboard],
    ] as const) {
        test(`the stock refuses a fourth pass by ${name} and raises the no-redeals notice`, async ({ page }) => {
            await seedRecord(page, {
                current: vegasTalonState({ passes: 2 }),
                preferences: { autoSafe: false },
            });
            await continueToGame(page);
            const initialWaste = await wasteIds(page);
            expect(initialWaste).toHaveLength(3);
            await expect(stockSlot(page)).not.toHaveClass(/is-spent/);

            // The recycle begins the third and last pass; the draw takes its cards back to the waste.
            await activateCounted(page, activate, 1);
            await expect(page.locator('[data-card-id][data-pile="waste"]')).toHaveCount(0);
            await activateCounted(page, activate, 2);
            await expect(stockSlot(page)).toHaveClass(/is-spent/);
            const before = await hud(page);
            const wasteBefore = await wasteIds(page);
            expect(before.score).toBe('-$52');
            expect(wasteBefore).toEqual(initialWaste);

            for (const attempt of [1, 2]) {
                await activate(page);
                await expect(noRedealsNotice(page), `refusal ${String(attempt)}`).toHaveCount(1);
                await expect(stockSlot(page)).toHaveClass(/is-spent/);
                const after = await hud(page);
                expect(after.score).toBe(before.score);
                expect(after.moves).toBe(before.moves);
                expect(await wasteIds(page)).toEqual(wasteBefore);
                await expect(page.locator('[data-card-id][data-pile="stock"]')).toHaveCount(0);
            }
        });
    }
});

// KS-SCO-01: a Standard Draw 3 recycle costs nothing when it begins pass 2 or 3 and 20 points from pass 4 on.
test.describe('The Draw 3 recycle penalty', () => {
    for (const [name, activate] of [
        ['tap', tap],
        ['keyboard', keyboard],
    ] as const) {
        test(`the recycle beginning the fourth pass costs 20 points and the earlier ones nothing, by ${name}`, async ({
            page,
        }) => {
            await seedRecord(page, {
                current: draw3TalonState({ passes: 1, score: 100, elapsedMs: 0 }),
                preferences: { autoSafe: false },
            });
            await continueToGame(page);

            let moves = 0;
            /** Activates the stock, then returns the score points lost beyond the time penalty that ran meanwhile. */
            const cost = async (): Promise<number> => {
                const before = await hud(page);
                moves += 1;
                await activateCounted(page, activate, moves);
                const after = await hud(page);
                const timeSteps = Math.floor(after.seconds / 10) - Math.floor(before.seconds / 10);
                return Number(before.score) - Number(after.score) - 2 * timeSteps;
            };

            // The stock starts empty over a full waste: the first activation is the recycle beginning pass 2.
            expect(await cost(), 'recycle beginning pass 2').toBe(0);
            expect(await cost(), 'draw in pass 2').toBe(0);
            expect(await cost(), 'recycle beginning pass 3').toBe(0);
            expect(await cost(), 'draw in pass 3').toBe(0);
            expect(await cost(), 'recycle beginning pass 4').toBe(20);
        });
    }
});
