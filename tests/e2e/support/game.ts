import type { Page } from '@playwright/test';

/** The stats and cards a change of appearance or viewport must leave alone, plus the clock and score it lets carry on. */
export async function readGame(page: Page) {
    const text = (kind: string) => page.locator(`.stat-display--${kind} .stat-display__value`).textContent();
    const [minutes = 0, seconds = 0] = ((await text('timer')) ?? '').split(':').map(Number);
    return {
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
