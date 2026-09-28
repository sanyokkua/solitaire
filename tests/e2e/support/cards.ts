import { expect, type Locator, type Page } from '@playwright/test';
import { cardId } from '../../../src/domain/cards';

/** The seeded one-undo position: the ace of hearts moved to the foundation and the king of spades under it turned up. */
export const ACE_OF_HEARTS = cardId(0, 1);
export const KING_OF_SPADES = cardId(3, 13);

export interface Point {
    readonly x: number;
    readonly y: number;
}

/** The card element with the given id. */
export function cardOf(page: Page, id: number): Locator {
    return page.locator(`[data-card-id='${String(id)}']`);
}

/** Opens the game seeded by `seedRecord` and waits for all 52 cards. */
export async function continueToGame(page: Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue game' }).click();
    await expect(page.locator('[data-card-id]')).toHaveCount(52);
}

/** Where the card must end up: the board's origin plus the card's inline `--x` / `--y` (D4). */
export async function cardTarget(page: Page, id: number): Promise<Point> {
    return page.evaluate((cardIdValue) => {
        const card = document.querySelector<HTMLElement>(`[data-card-id='${String(cardIdValue)}']`);
        const board = card?.parentElement;
        if (!card || !board) throw new Error(`card ${String(cardIdValue)} is not on the board`);
        const origin = board.getBoundingClientRect();
        return {
            x: origin.x + Number.parseFloat(card.style.getPropertyValue('--x')),
            y: origin.y + Number.parseFloat(card.style.getPropertyValue('--y')),
        };
    }, id);
}

/** Where the card is drawn right now, mid-transition included. */
export async function cardRect(page: Page, id: number): Promise<Point> {
    const box = await cardOf(page, id).evaluate((card) => card.getBoundingClientRect());
    return { x: box.x, y: box.y };
}

/** Whether two points are within `tolerance` px of each other on both axes. */
export function near(a: Point, b: Point, tolerance = 1): boolean {
    return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

/** Clicks the toolbar button named `name` inside the page and reads the card's rect in the same task. */
export async function clickThenReadRect(page: Page, name: 'Undo' | 'Redo', id: number): Promise<Point> {
    return page.evaluate(
        ({ label, cardIdValue }) => {
            const button = [...document.querySelectorAll<HTMLButtonElement>('button.tool')].find(
                (candidate) => candidate.textContent.trim() === label,
            );
            const card = document.querySelector(`[data-card-id='${String(cardIdValue)}']`);
            if (!button || !card) throw new Error(`no ${label} button or card ${String(cardIdValue)}`);
            button.click();
            const box = card.getBoundingClientRect();
            return { x: box.x, y: box.y };
        },
        { label: name, cardIdValue: id },
    );
}
