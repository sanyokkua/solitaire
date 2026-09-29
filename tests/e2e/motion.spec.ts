import { expect, test } from '@playwright/test';
import { undoMovePosition } from '../fixtures/boardPositions';
import {
    ACE_OF_HEARTS,
    KING_OF_SPADES,
    cardOf,
    cardRect,
    cardTarget,
    clickThenReadRect,
    continueToGame,
    near,
} from './support/cards';
import { seedRecord } from './support/seed';

test.describe('Motion on', () => {
    test.beforeEach(async ({ page }) => {
        await seedRecord(page, undoMovePosition());
        await continueToGame(page);
    });

    test('Undo glides the card back', async ({ page }) => {
        const start = await cardRect(page, ACE_OF_HEARTS);

        const midGlide = await clickThenReadRect(page, 'Undo', ACE_OF_HEARTS);
        const target = await cardTarget(page, ACE_OF_HEARTS);

        expect(near(midGlide, target, 2)).toBe(false);
        expect(near(midGlide, start)).toBe(true);
        await expect.poll(async () => near(await cardRect(page, ACE_OF_HEARTS), target)).toBe(true);
        await expect(cardOf(page, ACE_OF_HEARTS)).toHaveCSS('transition-duration', '0.24s');
    });

    test('Flip on reveal', async ({ page }) => {
        const inner = cardOf(page, KING_OF_SPADES).locator('.card-inner');
        const transform = () => inner.evaluate((element) => getComputedStyle(element).transform);
        const settled = async () => {
            await expect.poll(() => inner.evaluate((element) => element.getAnimations().length)).toBe(0);
            return transform();
        };

        await clickThenReadRect(page, 'Undo', KING_OF_SPADES);
        await expect(cardOf(page, KING_OF_SPADES)).not.toHaveClass(/is-up/);
        const faceDown = await settled();

        const justAfterRedo = await inner.evaluate((element) => {
            const redo = [...document.querySelectorAll<HTMLButtonElement>('button.tool')].find(
                (button) => button.textContent.trim() === 'Redo',
            );
            if (!redo) throw new Error('no Redo button');
            redo.click();
            return getComputedStyle(element).transform;
        });
        const faceUp = await settled();

        await expect(inner).toHaveCSS('transition-duration', '0.3s');
        await expect(inner).toHaveCSS('transition-delay', '0.06s');
        expect(justAfterRedo).toBe(faceDown);
        expect(faceUp).not.toBe(faceDown);
        expect(justAfterRedo).not.toBe(faceUp);
    });
});

test.describe('Deal from Home', () => {
    test('Fresh deal animates: the 28th card leaves the stock and ends at its column', async ({ page }) => {
        await page.goto('/');

        // The card that starts last in the deal (k = 27, so `--d` is 756 ms): read it the frame it gets its delay.
        const sighting = page.evaluate(
            () =>
                new Promise<{ card: { x: number; y: number }; stock: { x: number; y: number } }>((resolve, reject) => {
                    const deadline = performance.now() + 30_000;
                    const tick = () => {
                        const card = [...document.querySelectorAll<HTMLElement>('[data-card-id]')].find(
                            (candidate) => candidate.style.getPropertyValue('--d') === '756ms',
                        );
                        const slot = document.querySelector('.slot--stock');
                        if (card && slot) {
                            const cardBox = card.getBoundingClientRect();
                            const slotBox = slot.getBoundingClientRect();
                            card.setAttribute('data-last-dealt', '');
                            resolve({ card: { x: cardBox.x, y: cardBox.y }, stock: { x: slotBox.x, y: slotBox.y } });
                        } else if (performance.now() > deadline) {
                            reject(new Error('the deal never started'));
                        } else {
                            requestAnimationFrame(tick);
                        }
                    };
                    tick();
                }),
        );
        await page.getByRole('button', { name: 'Deal cards' }).click();

        const { card, stock } = await sighting;
        expect(near(card, stock)).toBe(true);

        const last = page.locator('[data-last-dealt]');
        await expect.poll(() => last.evaluate((el) => el.style.getPropertyValue('--d')), { timeout: 10_000 }).toBe('');
        const id = Number(await last.getAttribute('data-card-id'));
        const target = await cardTarget(page, id);
        await expect.poll(async () => near(await cardRect(page, id), target)).toBe(true);
    });
});

// covers: KS-SET-04
test.describe('Motion reduced', () => {
    test.use({ reducedMotion: 'reduce' });

    test('No motion: the card is at its new place in the next frame', async ({ page }) => {
        await seedRecord(page, undoMovePosition());
        await continueToGame(page);
        await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');

        const target = await page.evaluate(
            ({ id }) =>
                new Promise<{ x: number; y: number; targetX: number; targetY: number }>((resolve) => {
                    const button = [...document.querySelectorAll<HTMLButtonElement>('button.tool')].find(
                        (candidate) => candidate.textContent.trim() === 'Undo',
                    );
                    const card = document.querySelector<HTMLElement>(`[data-card-id='${String(id)}']`);
                    if (!button || !card?.parentElement) throw new Error('no Undo button or card');
                    button.click();
                    requestAnimationFrame(() => {
                        const box = card.getBoundingClientRect();
                        const origin = card.parentElement?.getBoundingClientRect();
                        resolve({
                            x: box.x,
                            y: box.y,
                            targetX: (origin?.x ?? 0) + Number.parseFloat(card.style.getPropertyValue('--x')),
                            targetY: (origin?.y ?? 0) + Number.parseFloat(card.style.getPropertyValue('--y')),
                        });
                    });
                }),
            { id: ACE_OF_HEARTS },
        );

        expect(near({ x: target.x, y: target.y }, { x: target.targetX, y: target.targetY })).toBe(true);
    });
});
