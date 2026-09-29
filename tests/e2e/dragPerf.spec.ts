// covers: KS-PERF-01
import { expect, test, type Page } from '@playwright/test';
import { worstColumnState } from '../fixtures/boardPositions';
import { KING_OF_SPADES, cardOf, type Point } from './support/cards';
import { settleAnimations } from './support/play';
import { seedRecord } from './support/seed';
import { median, percentile } from './support/stats';

/** A phone viewport with touch, the CPU slowed to a quarter, and the columns the king run is dragged through. */
const PHONE = { width: 402, height: 874 } as const;
const CPU_SLOWDOWN = 4;
const RUN_PATH = [0, 1, 2, 3, 4, 5];
const DRAG_STEPS = 24;
/** A frame at 60 fps lasts 16.7 ms; a frame past 1.5 of them (25 ms) has dropped one. */
const FRAME_MS = 16.7;
const DROPPED_MS = 25;
/** Where a card is pressed and met: its visible top strip (see `CARD_STRIP` in `support/play.ts`). */
const STRIP: Point = { x: 12, y: 3 };

type FrameWindow = Window & { __frames?: number[]; __framing?: boolean };

/** Starts recording the time of every animation frame. */
async function startFrames(page: Page): Promise<void> {
    await page.evaluate(() => {
        const frames: number[] = [];
        (window as FrameWindow).__frames = frames;
        (window as FrameWindow).__framing = true;
        const tick = (time: number) => {
            frames.push(time);
            if ((window as FrameWindow).__framing) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

/** Stops recording and returns the milliseconds between successive frames. */
async function stopFrames(page: Page): Promise<number[]> {
    const times = await page.evaluate(() => {
        (window as FrameWindow).__framing = false;
        return (window as FrameWindow).__frames ?? [];
    });
    return times.slice(1).map((time, i) => Math.round((time - (times[i] ?? time)) * 10) / 10);
}

async function topOf(page: Page, selector: string): Promise<Point> {
    const box = await page.locator(selector).boundingBox();
    if (box === null) throw new Error(`${selector} has no box`);
    return { x: box.x + STRIP.x, y: box.y + STRIP.y };
}

test('Drag performance trace', async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'CPU throttling and tracing go through Chromium DevTools');
    test.setTimeout(120_000);
    if (!baseURL) throw new Error('the Playwright config sets no baseURL');

    const context = await browser.newContext({
        baseURL,
        viewport: PHONE,
        hasTouch: true,
        isMobile: true,
        serviceWorkers: 'block',
    });
    const page = await context.newPage();
    try {
        // The worst-case column: a 13-card king-to-ace run that empty columns take one after the other.
        await seedRecord(page, { current: worstColumnState(), preferences: { autoSafe: false } });
        await page.goto('/');
        await page.getByRole('button', { name: 'Continue game' }).click();
        await expect(page.locator('[data-card-id]')).toHaveCount(52);

        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
        await browser.startTracing(page, { categories: ['devtools.timeline'] });
        await startFrames(page);

        for (const column of RUN_PATH) {
            const box = await cardOf(page, KING_OF_SPADES).boundingBox();
            if (box === null) throw new Error('the king has no box');
            const start = { x: box.x + STRIP.x, y: box.y + STRIP.y };
            const end = await topOf(page, `.slot[data-pile="tableau:${String(column)}"]`);
            const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', at?: Point) => {
                await cdp.send('Input.dispatchTouchEvent', {
                    type,
                    touchPoints: at === undefined ? [] : [{ x: at.x, y: at.y, id: 1 }],
                });
            };
            await touch('touchStart', start);
            for (let step = 1; step <= DRAG_STEPS; step += 1) {
                const fraction = step / DRAG_STEPS;
                await touch('touchMove', {
                    x: start.x + (end.x - start.x) * fraction,
                    y: start.y + (end.y - start.y) * fraction,
                });
            }
            await touch('touchEnd');
            await expect(cardOf(page, KING_OF_SPADES)).toHaveAttribute('data-pile', `tableau:${String(column)}`);
            await settleAnimations(page);
        }

        const deltas = await stopFrames(page);
        const trace = await browser.stopTracing();
        await testInfo.attach('drag-trace.json', { body: trace, contentType: 'application/json' });

        // Reported, never asserted: the frame times of a development machine under a 4× slowdown are not a phone's.
        const ms = (value: number) => `${value.toFixed(1)} ms`;
        const basis = `${String(deltas.length)} frames over ${String(RUN_PATH.length)} drags of a 13-card run, ${String(CPU_SLOWDOWN)}× CPU slowdown`;
        const figures: [string, string][] = [
            ['drag frame time median', ms(median(deltas))],
            ['drag frame time p95', ms(percentile(deltas, 0.95))],
            [
                'drag frames over 16.7 ms',
                `${String(deltas.filter((delta) => delta > FRAME_MS).length)} of ${String(deltas.length)}`,
            ],
            [
                'drag frames over 25 ms',
                `${String(deltas.filter((delta) => delta > DROPPED_MS).length)} of ${String(deltas.length)}`,
            ],
        ];
        for (const [type, value] of figures) testInfo.annotations.push({ type, description: `${value} (${basis})` });
        console.log(`Drag performance (${basis}): ${figures.map(([type, value]) => `${type} ${value}`).join(', ')}`);
        expect(deltas.length).toBeGreaterThan(0);
        expect(trace.length).toBeGreaterThan(0);
    } finally {
        await context.close();
    }
});
