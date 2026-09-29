import { expect, test, type Page } from '@playwright/test';
import { dealFromSeed } from '../../src/domain/deal';
import { encodeDealCode } from '../../src/domain/dealCode';
import { drawThreeFanState } from '../fixtures/boardPositions';
import { cardTarget, continueToGame, near } from './support/cards';
import { expectClockCarriedOn, placement, placementOf, readGame } from './support/game';
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
        expectClockCarriedOn(before, after);
    });

    test('Resize during the deal', async ({ page }) => {
        const seed = 20_260_929;
        await page.goto('/');
        await page.getByRole('button', { name: 'Play a deal code' }).click();
        await page.getByRole('textbox', { name: 'Deal code' }).fill(encodeDealCode(seed, 'draw1'));

        // From the first frame a card carries its deal delay `--d` (cleared when the deal ends, about 1.4 s later).
        // Waiting for it puts both resizes inside the deal, and `stillDealing` proves it: it is read right after each.
        await page.evaluate(() => {
            const w = window as unknown as { dealSeen: Promise<void>; stillDealing: () => boolean };
            w.stillDealing = () =>
                [...document.querySelectorAll<HTMLElement>('[data-card-id]')].some(
                    (card) => card.style.getPropertyValue('--d') !== '',
                );
            w.dealSeen = new Promise<void>((resolve, reject) => {
                const deadline = performance.now() + 30_000;
                const tick = () => {
                    if (w.stillDealing()) resolve();
                    else if (performance.now() > deadline) reject(new Error('the deal never started'));
                    else requestAnimationFrame(tick);
                };
                tick();
            });
        });
        await page.getByRole('button', { name: 'Play', exact: true }).click();
        await page.evaluate(() => (window as unknown as { dealSeen: Promise<void> }).dealSeen);

        const stillDealing = () =>
            page.evaluate(() => (window as unknown as { stillDealing: () => boolean }).stillDealing());
        await page.setViewportSize({ width: 874, height: 402 });
        expect(await stillDealing(), 'the first resize came while the deal was running').toBe(true);
        await page.setViewportSize({ width: 360, height: 780 });
        expect(await stillDealing(), 'the second resize came while the deal was running').toBe(true);

        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        [...document.querySelectorAll<HTMLElement>('[data-card-id]')].every(
                            (card) => card.style.getPropertyValue('--d') === '' && card.getAnimations().length === 0,
                        ) && !document.querySelector('.board')?.hasAttribute('data-resizing'),
                ),
            )
            .toBe(true);

        await expect(page.locator('[data-card-id]')).toHaveCount(52);
        for (let id = 0; id < 52; id += 1) {
            const drawn = await page.locator(`[data-card-id='${String(id)}']`).evaluate((card) => {
                const box = card.getBoundingClientRect();
                return { x: box.x, y: box.y };
            });
            expect(near(drawn, await cardTarget(page, id)), `card ${String(id)} is at its place`).toBe(true);
        }
        const root = await page.evaluate(() => ({
            scrollHeight: document.documentElement.scrollHeight,
            scrollWidth: document.documentElement.scrollWidth,
            innerHeight: window.innerHeight,
            innerWidth: window.innerWidth,
        }));
        expect(root.scrollHeight).toBeLessThanOrEqual(root.innerHeight);
        expect(root.scrollWidth).toBeLessThanOrEqual(root.innerWidth);
        expect(root.innerWidth).toBe(360);
        await expect(page.locator('.stat-display--moves .stat-display__value')).toHaveText('000');
        expect(await placement(page)).toEqual(
            placementOf(dealFromSeed(seed, 'draw1', { verdict: 'random', attempts: 1 })),
        );
    });
});
