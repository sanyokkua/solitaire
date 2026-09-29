import { expect, test, type Page } from '@playwright/test';
import { applyCommand } from '../../src/domain/engine';
import type { GameState } from '../../src/domain/types';
import { freshDrawOneState, SIX_OF_DIAMONDS, twoTargetsPosition } from '../fixtures/boardPositions';
import { cardOf, continueToGame } from './support/cards';
import { expectClockCarriedOn, MOVES_VALUE, placement, placementOf, readGame } from './support/game';
import { settleAnimations } from './support/play';
import { readStoredSession, seedRecord } from './support/seed';

/** Stored steps kept on each side (KS-PER-01): the newest undo steps and the nearest redo steps. */
const STORED_STEPS = 200;
/** Draws and recycles played: each one is a counted, undoable move. */
const COMMANDS = 410;
/** Steps undone again, so 205 undo steps and 205 redo steps sit in memory, each more than the 200 stored. */
const UNDONE = 205;
/** How many draws a batch of key presses plays before the move counter is checked. */
const BATCH = 50;

const padMoves = (moves: number) => String(moves).padStart(3, '0');

/** The position after `draws` draws (and recycles) from `start`, computed by the pure engine. */
function afterDraws(start: GameState, draws: number): GameState {
    let state = start;
    for (let i = 0; i < draws; i += 1) state = applyCommand(state, { type: 'draw' }).state;
    return state;
}

/** The stored session's step counts, read from the record the app itself wrote. */
async function storedSteps(page: Page): Promise<{ history: number; future: number }> {
    const { history, future } = await readStoredSession(page);
    return { history: history.length, future: future.length };
}

/** Clicks the enabled toolbar button until it is disabled and returns how many clicks it took (bounded). */
async function clickUntilDisabled(page: Page, name: 'Undo' | 'Redo'): Promise<number> {
    const button = page.getByRole('button', { name, exact: true });
    let clicks = 0;
    while (clicks <= 2 * COMMANDS && (await button.isEnabled())) {
        await button.click();
        clicks += 1;
    }
    return clicks;
}

// covers: KS-AST-07, KS-PER-01
test.describe('The undo storm', () => {
    // Reduced motion keeps every draw instant; hundreds of key presses and clicks still need room.
    test.use({ reducedMotion: 'reduce' });
    test.setTimeout(180_000);

    test('a reload keeps the newest 200 undo steps and the nearest 200 redo steps, and both sides still work', async ({
        page,
    }) => {
        const start = freshDrawOneState();
        await seedRecord(page, { current: start, preferences: { autoSafe: false } });
        await continueToGame(page);
        await expect(page.locator(MOVES_VALUE)).toHaveText(padMoves(start.moves));
        // Nothing may hold focus, so Space draws.
        await page.evaluate(() => {
            (document.activeElement as HTMLElement | null)?.blur();
        });

        // Draws and recycles by Space, then undos by Ctrl or Command with Z; the counter is checked after each batch.
        let played = 0;
        while (played < COMMANDS) {
            const batch = Math.min(BATCH, COMMANDS - played);
            for (let i = 0; i < batch; i += 1) await page.keyboard.press('Space');
            played += batch;
            await expect(page.locator(MOVES_VALUE)).toHaveText(padMoves(start.moves + played));
        }
        // 410 draws from a 24-card stock go through many recycles, so recycles are part of the storm.
        for (let i = 0; i < UNDONE; i += 1) await page.keyboard.press('ControlOrMeta+z');
        const inPlay = start.moves + COMMANDS - UNDONE;
        await expect(page.locator(MOVES_VALUE)).toHaveText(padMoves(inPlay));
        await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
        await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();

        // The position after 205 of the 410 draws: what the board shows before and after the reload.
        const expectedInPlay = placementOf(afterDraws(start, COMMANDS - UNDONE));
        expect(await placement(page)).toEqual(expectedInPlay);
        const before = await readGame(page);

        await page.reload();
        await continueToGame(page);

        const after = await readGame(page);
        expect(await placement(page)).toEqual(expectedInPlay);
        expect(after.moves).toBe(padMoves(inPlay));
        expectClockCarriedOn(before, after);
        expect(await storedSteps(page)).toEqual({ history: STORED_STEPS, future: STORED_STEPS });

        // Undo has exactly the 200 newest steps: it stops at the position 200 steps before the one in play.
        expect(await clickUntilDisabled(page, 'Undo')).toBe(STORED_STEPS);
        const oldest = start.moves + COMMANDS - UNDONE - STORED_STEPS;
        await expect(page.locator(MOVES_VALUE)).toHaveText(padMoves(oldest));
        expect(await placement(page)).toEqual(placementOf(afterDraws(start, COMMANDS - UNDONE - STORED_STEPS)));

        // Redo has the 200 undone steps plus the 200 nearest of the stored ones: 400 in all. The 5 farthest of the
        // 205 undone steps (moves 407 to 411) did not survive, so redo ends at move 206 + 200 = 406, not 411.
        expect(await clickUntilDisabled(page, 'Redo')).toBe(2 * STORED_STEPS);
        const newest = inPlay + STORED_STEPS;
        expect(newest).toBe(start.moves + COMMANDS - (UNDONE - STORED_STEPS));
        await expect(page.locator(MOVES_VALUE)).toHaveText(padMoves(newest));
        expect(await placement(page)).toEqual(placementOf(afterDraws(start, COMMANDS - (UNDONE - STORED_STEPS))));
        await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
    });
});

test.describe('A rapid double tap', () => {
    // covers: KS-INP-01
    test('applies at most one move', async ({ page }, testInfo) => {
        await seedRecord(page, {
            // The 6♦ has two legal homes, so a second move would visibly carry it from one seven to the other.
            current: twoTargetsPosition(),
            preferences: { tapMode: 'smart', autoSafe: false },
        });
        await continueToGame(page);
        await expect(page.locator(MOVES_VALUE)).toHaveText('000');

        const card = cardOf(page, SIX_OF_DIAMONDS);
        // Record which card is under each pointer release (the board captures the pointer, so the event target is not the
        // card): a second tap that hit an empty slot after the card glided away would otherwise pass without ever
        // testing the double tap.
        await page.evaluate(() => {
            const releases: (string | null | undefined)[] = [];
            (window as unknown as { releasedOn: typeof releases }).releasedOn = releases;
            document.addEventListener(
                'pointerup',
                (event) => {
                    const hit = document.elementFromPoint(event.clientX, event.clientY);
                    releases.push(hit?.closest('[data-card-id]')?.getAttribute('data-card-id'));
                },
                true,
            );
        });
        if (testInfo.project.use.hasTouch === true) {
            // Two taps at the same spot in a row: `card.tap()` would wait for the moved card and tap it where it landed.
            const box = await card.boundingBox();
            if (box === null) throw new Error('the card has no box');
            const spot = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
            await page.touchscreen.tap(spot.x, spot.y);
            await page.touchscreen.tap(spot.x, spot.y);
        } else {
            await card.dblclick();
        }
        const released = await page.evaluate(() => (window as unknown as { releasedOn: unknown[] }).releasedOn);
        // Both taps hit the six itself, so the second one really came inside the double-tap window.
        expect(released).toEqual([String(SIX_OF_DIAMONDS), String(SIX_OF_DIAMONDS)]);

        await expect(page.locator(MOVES_VALUE)).toHaveText('001');
        await expect(card).toHaveAttribute('data-pile', /^tableau:[12]$/);
        const pile = await card.getAttribute('data-pile');
        // A second move would land later than the first: let the animations run out, then look again.
        await settleAnimations(page);
        await expect(page.locator(MOVES_VALUE)).toHaveText('001');
        await expect(card).toHaveAttribute('data-pile', pile ?? '');
    });
});
