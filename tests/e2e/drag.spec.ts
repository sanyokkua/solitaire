import { expect, test, type Locator, type Page } from '@playwright/test';
import { oneMovePosition, SEVEN_OF_CLUBS, SIX_OF_DIAMONDS } from '../fixtures/boardPositions';
import { cardOf, cardRect, cardTarget, continueToGame, near, type Point } from './support/cards';
import { seedRecord } from './support/seed';

/** The projects whose browser has CDP touch input (`Input.dispatchTouchEvent`) and the WebKit ones without it. */
const CDP_TOUCH_PROJECT = 'galaxy-s25';
const WEBKIT_TOUCH_PROJECTS = ['iphone-17-pro', 'iphone-14-pro-max'];
const DRAG_STEPS = 12;

/** The middle of the element's box, in page coordinates. */
async function centreOf(target: Locator): Promise<Point> {
    const box = await target.boundingBox();
    if (box === null) throw new Error('the element has no box');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The point `fraction` of the way from `from` to `to`. */
function between(from: Point, to: Point, fraction: number): Point {
    return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
}

/** Waits for the card to settle at the place the layout gave it (its glide has ended). */
async function expectSettledAtTarget(page: Page, id: number): Promise<void> {
    const target = await cardTarget(page, id);
    await expect.poll(async () => near(await cardRect(page, id), target)).toBe(true);
}

/** The card's pile and index as the board draws them. */
async function placeOf(page: Page, id: number) {
    return cardOf(page, id).evaluate((card) => ({ pile: card.getAttribute('data-pile'), index: card.dataset.index }));
}

test.describe('Dragging a card on the table', () => {
    test.beforeEach(async ({ page }) => {
        await seedRecord(page, { current: oneMovePosition(), preferences: { autoSafe: false } });
        await continueToGame(page);
    });

    test('a mouse drag onto a legal column moves the card', async ({ page }) => {
        const start = await centreOf(cardOf(page, SIX_OF_DIAMONDS));
        const end = await centreOf(cardOf(page, SEVEN_OF_CLUBS));
        expect(await placeOf(page, SIX_OF_DIAMONDS)).toEqual({ pile: 'tableau:1', index: '0' });

        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: DRAG_STEPS });
        await page.mouse.up();

        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-pile', 'tableau:0');
        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-index', '1');
        await expectSettledAtTarget(page, SIX_OF_DIAMONDS);
        await expect(cardOf(page, SIX_OF_DIAMONDS)).not.toHaveClass(/is-dragging/);
    });

    test('a mouse drag released over an illegal column glides back to where it started', async ({ page }) => {
        const before = await cardRect(page, SIX_OF_DIAMONDS);
        const start = await centreOf(cardOf(page, SIX_OF_DIAMONDS));
        const emptyColumn = await centreOf(page.locator(".slot[data-pile='tableau:3']"));

        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(emptyColumn.x, emptyColumn.y, { steps: DRAG_STEPS });
        // Mid-drag the card is under the pointer, away from where it started.
        await expect.poll(async () => near(await cardRect(page, SIX_OF_DIAMONDS), before, 20)).toBe(false);
        await page.mouse.up();

        await expect.poll(async () => near(await cardRect(page, SIX_OF_DIAMONDS), before)).toBe(true);
        expect(await placeOf(page, SIX_OF_DIAMONDS)).toEqual({ pile: 'tableau:1', index: '0' });
        await expect(cardOf(page, SIX_OF_DIAMONDS)).not.toHaveClass(/is-dragging/);
    });

    test('a touch drag through CDP moves the card and the page does not scroll', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== CDP_TOUCH_PROJECT, 'CDP touch input exists only in Chromium on Android');
        const cdp = await page.context().newCDPSession(page);
        const start = await centreOf(cardOf(page, SIX_OF_DIAMONDS));
        const end = await centreOf(cardOf(page, SEVEN_OF_CLUBS));
        const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', at?: Point) => {
            await cdp.send('Input.dispatchTouchEvent', {
                type,
                touchPoints: at === undefined ? [] : [{ x: at.x, y: at.y, id: 1 }],
            });
        };

        await touch('touchStart', start);
        for (let step = 1; step <= DRAG_STEPS; step += 1) {
            await touch('touchMove', between(start, end, step / DRAG_STEPS));
        }
        await touch('touchEnd');

        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-pile', 'tableau:0');
        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-index', '1');
        await expectSettledAtTarget(page, SIX_OF_DIAMONDS);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    test('the board takes no browser touch gesture, and a touch pointer drag moves the card', async ({
        page,
    }, testInfo) => {
        test.skip(
            !WEBKIT_TOUCH_PROJECTS.includes(testInfo.project.name),
            'WebKit has no touch input other than taps: a pointer-event drag stands in for it',
        );
        await expect(page.locator('.board')).toHaveCSS('touch-action', 'none');
        const card = cardOf(page, SIX_OF_DIAMONDS);
        const start = await centreOf(card);
        const end = await centreOf(cardOf(page, SEVEN_OF_CLUBS));
        const pointer = (at: Point, buttons: number) => ({
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            buttons,
            clientX: at.x,
            clientY: at.y,
        });

        await card.dispatchEvent('pointerdown', pointer(start, 1));
        for (let step = 1; step <= DRAG_STEPS; step += 1) {
            await card.dispatchEvent('pointermove', pointer(between(start, end, step / DRAG_STEPS), 1));
        }
        await card.dispatchEvent('pointerup', pointer(end, 0));

        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-pile', 'tableau:0');
        await expect(cardOf(page, SIX_OF_DIAMONDS)).toHaveAttribute('data-index', '1');
        await expectSettledAtTarget(page, SIX_OF_DIAMONDS);
    });
});
