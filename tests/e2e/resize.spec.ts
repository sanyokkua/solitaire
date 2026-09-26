import { expect, test, type Page } from '@playwright/test';
import { drawThreeFanState } from '../fixtures/boardPositions';
import { continueToGame, near } from './support/cards';
import { readGame } from './support/game';
import { seedRecord } from './support/seed';

interface Sample {
    readonly cards: readonly {
        readonly id: string | null;
        readonly x: number;
        readonly y: number;
        readonly targetX: number;
        readonly targetY: number;
    }[];
    readonly scrollHeight: number;
    readonly scrollWidth: number;
    readonly innerHeight: number;
    readonly innerWidth: number;
}

/** The position, independent of where it is drawn: every card's name (which says face up or down) and every pile's name. */
async function places(page: Page) {
    const names = (selector: string) =>
        page.locator(selector).evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')));
    return { cards: await names('[data-card-id]'), piles: await names('.slot') };
}

test.describe('Re-layout on viewport change', () => {
    test.use({ viewport: { width: 402, height: 874 } });

    test('Rotation keeps the game', async ({ page }) => {
        await seedRecord(page, { current: drawThreeFanState() });
        await continueToGame(page);
        const before = await readGame(page);
        const placesBefore = await places(page);

        // Sampled in the first frame after the board panel's size changes (the observer's initial report of the
        // unchanged size is skipped): where each card is drawn, and where its inline --x / --y say it belongs.
        // The observer is installed (awaited) before the viewport changes; the sample is collected afterwards.
        await page.evaluate(() => {
            const sampling = new Promise<Sample>((resolve, reject) => {
                const panel = document.querySelector('.board-panel');
                if (!panel) {
                    reject(new Error('no board panel'));
                    return;
                }
                const startWidth = panel.getBoundingClientRect().width;
                new ResizeObserver(() => {
                    if (panel.getBoundingClientRect().width === startWidth) return;
                    requestAnimationFrame(() => {
                        const board = document.querySelector('.board');
                        const origin = board?.getBoundingClientRect();
                        const root = document.documentElement;
                        resolve({
                            cards: [...document.querySelectorAll<HTMLElement>('[data-card-id]')].map((card) => {
                                const box = card.getBoundingClientRect();
                                return {
                                    id: card.getAttribute('data-card-id'),
                                    x: box.x,
                                    y: box.y,
                                    targetX: (origin?.x ?? 0) + Number.parseFloat(card.style.getPropertyValue('--x')),
                                    targetY: (origin?.y ?? 0) + Number.parseFloat(card.style.getPropertyValue('--y')),
                                };
                            }),
                            scrollHeight: root.scrollHeight,
                            scrollWidth: root.scrollWidth,
                            innerHeight: window.innerHeight,
                            innerWidth: window.innerWidth,
                        });
                    });
                }).observe(panel);
            });
            (window as unknown as { sampling: Promise<Sample> }).sampling = sampling;
        });

        await page.setViewportSize({ width: 874, height: 402 });
        const frame = await page.evaluate(() => (window as unknown as { sampling: Promise<Sample> }).sampling);
        const after = await readGame(page);

        expect(frame.cards).toHaveLength(52);
        for (const card of frame.cards) {
            expect(near(card, { x: card.targetX, y: card.targetY }), `card ${String(card.id)} is at its place`).toBe(
                true,
            );
        }
        expect(frame.scrollHeight).toBeLessThanOrEqual(frame.innerHeight);
        expect(frame.scrollWidth).toBeLessThanOrEqual(frame.innerWidth);
        expect(after.cards.map(([id]) => id)).toEqual(before.cards.map(([id]) => id));
        expect(after.cards).not.toEqual(before.cards);
        expect(await places(page)).toEqual(placesBefore);
        expect(after.moves).toBe(before.moves);
        expect(after.seconds).toBeGreaterThanOrEqual(before.seconds);
        expect(after.seconds - before.seconds).toBeLessThanOrEqual(1);
        // One time-penalty step (2 points per 10 seconds) is the most the score can lose in that second.
        expect(before.score - after.score).toBeGreaterThanOrEqual(0);
        expect(before.score - after.score).toBeLessThanOrEqual(2);
    });
});
