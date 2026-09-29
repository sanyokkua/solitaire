import { expect, type Page } from '@playwright/test';
import type { GameState } from '../../../src/domain/types';

/** The stats and cards a change of appearance or viewport must leave alone, plus the clock and score it lets carry on. */
export async function readGame(page: Page) {
    const text = (kind: string) => page.locator(`.stat-display--${kind} .stat-display__value`).textContent();
    const [minutes = 0, seconds = 0] = ((await text('timer')) ?? '').split(':').map(Number);
    const takenAt = Date.now();
    return {
        takenAt,
        moves: await text('moves'),
        score: Number(await text('score')),
        seconds: minutes * 60 + seconds,
        cards: await page.locator('[data-card-id]').evaluateAll((cards) =>
            cards.map((card) => {
                const box = card.getBoundingClientRect();
                return [card.getAttribute('data-card-id'), Math.round(box.x), Math.round(box.y)];
            }),
        ),
    };
}

type GameReading = Awaited<ReturnType<typeof readGame>>;

/**
 * The clock and score carried on between two readings: the timer never runs backwards and gains at most the whole
 * seconds that really passed between them (plus one for the display's rounding down), and the score loses at most one
 * time-penalty step (2 points per 10 seconds) per ten of those seconds. The bound follows the wall clock because a slow
 * CI browser can take several seconds between two readings.
 */
export function expectClockCarriedOn(before: GameReading, after: GameReading): void {
    const gained = after.seconds - before.seconds;
    // The 500 ms margin covers the few milliseconds between stamping a reading and reading its timer.
    const allowedSeconds = Math.floor((after.takenAt - before.takenAt + 500) / 1000) + 1;
    expect(gained).toBeGreaterThanOrEqual(0);
    expect(gained).toBeLessThanOrEqual(allowedSeconds);
    expect(before.score - after.score).toBeGreaterThanOrEqual(0);
    expect(before.score - after.score).toBeLessThanOrEqual(2 * (Math.floor(allowedSeconds / 10) + 1));
}

/** Every card's pile and index as the board draws them, keyed by card id. */
export async function placement(page: Page): Promise<Record<string, string>> {
    return page
        .locator('[data-card-id]')
        .evaluateAll((cards) =>
            Object.fromEntries(
                cards.map((card) => [
                    card.getAttribute('data-card-id') ?? '',
                    `${card.getAttribute('data-pile') ?? ''}#${card.getAttribute('data-index') ?? ''}`,
                ]),
            ),
        );
}

/** The same placement for an engine position, in the board's own naming of piles. */
export function placementOf(state: GameState): Record<string, string> {
    const placed: Record<string, string> = {};
    const add = (pile: string, ids: readonly number[]) => {
        ids.forEach((id, index) => {
            placed[String(id)] = `${pile}#${String(index)}`;
        });
    };
    add('stock', state.stock);
    add('waste', state.waste);
    state.foundations.forEach((cards, suit) => {
        add(`foundation:${String(suit)}`, cards);
    });
    state.tableau.forEach((cards, col) => {
        add(
            `tableau:${String(col)}`,
            cards.map((card) => card.id),
        );
    });
    return placed;
}
