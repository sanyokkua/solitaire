import { expect, test, type Page } from '@playwright/test';
import { BASELINES, DEVICE_CONFIGS, boardSizeFor, type Baseline, type DeviceConfig } from '../fixtures/viewports';
import { worstColumnState } from '../fixtures/boardPositions';
import { seedRecord } from './support/seed';

/** Smallest gap between the tops of two neighbouring face-up cards of the worst column on an installed phone, in px. */
const MIN_STRIP = 14;
/** Slack for sub-pixel rounding when comparing boxes, in px. */
const TOLERANCE = 0.5;

/** A box in viewport coordinates. */
interface Box {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** Everything the assertions need, measured in one task so nothing moves between reads. */
interface Measurements {
    readonly innerWidth: number;
    readonly innerHeight: number;
    readonly scrollWidth: number;
    readonly scrollHeight: number;
    readonly panel: Box;
    readonly panelContent: { readonly width: number; readonly height: number };
    readonly cards: readonly (Box & { readonly id: string })[];
    /** The controls that must be inside the viewport; a hidden one is left out. */
    readonly controls: readonly (Box & { readonly name: string })[];
    /** Whether the Moves value is shown (it is hidden on narrow phones). */
    readonly movesShown: boolean;
    /** Tops of the face-up cards of column 7 that are listed in `stripIds`, in ascending order. */
    readonly stripTops: readonly number[];
}

/** Opens the seeded worst-case game and waits for all 52 cards and a settled board. */
async function openWorstColumn(page: Page): Promise<void> {
    await seedRecord(page, { current: worstColumnState() });
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue game' }).click();
    await expect(page.locator('[data-card-id]')).toHaveCount(52);
    await expect(page.locator('.board')).not.toHaveAttribute('data-resizing', /.*/);
}

/** Reads the page's geometry in one task. */
async function measure(page: Page, stripIds: readonly number[]): Promise<Measurements> {
    return page.evaluate((ids) => {
        const boxOf = (element: Element) => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
        };
        const shown = (element: Element | null): element is Element =>
            element !== null &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== 'hidden';
        const required = (selector: string): Element => {
            const element = document.querySelector(selector);
            if (!element) throw new Error(`no ${selector} on the Game screen`);
            return element;
        };
        const panel = required('.board-panel');
        const style = getComputedStyle(panel);
        const pixels = (value: string) => Number.parseFloat(value);
        const controlSelectors: [string, string][] = [
            ['Back to Home', '.game-back'],
            ['Score', '.stat-display--score'],
            ['Timer', '.stat-display--timer'],
            ['Game actions', 'nav[aria-label="Game actions"]'],
        ];
        const moves = document.querySelector('.stat-display--moves');
        const controls = controlSelectors.map(([name, selector]) => ({ name, ...boxOf(required(selector)) }));
        if (shown(moves)) controls.push({ name: 'Moves', ...boxOf(moves) });
        return {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            scrollHeight: document.documentElement.scrollHeight,
            panel: boxOf(panel),
            panelContent: {
                width:
                    panel.getBoundingClientRect().width -
                    pixels(style.paddingLeft) -
                    pixels(style.paddingRight) -
                    pixels(style.borderLeftWidth) -
                    pixels(style.borderRightWidth),
                height:
                    panel.getBoundingClientRect().height -
                    pixels(style.paddingTop) -
                    pixels(style.paddingBottom) -
                    pixels(style.borderTopWidth) -
                    pixels(style.borderBottomWidth),
            },
            cards: [...document.querySelectorAll('[data-card-id]')].map((card) => ({
                id: card.getAttribute('data-card-id') ?? '',
                ...boxOf(card),
            })),
            controls,
            movesShown: shown(moves),
            stripTops: ids
                .map((id) => document.querySelector(`[data-card-id='${String(id)}']`))
                .filter((card): card is Element => card !== null)
                .map((card) => card.getBoundingClientRect().y)
                .sort((a, b) => a - b),
        };
    }, stripIds);
}

/** The ids of the face-up cards of column 7 of the worst-case position. */
function faceUpIdsOfWorstColumn(): number[] {
    return worstColumnState()
        .tableau[6].filter((card) => card.up)
        .map((card) => card.id);
}

/** Whether `inner` lies inside `outer`, give or take the tolerance. */
function isInside(inner: Box, outer: Box): boolean {
    return (
        inner.x >= outer.x - TOLERANCE &&
        inner.y >= outer.y - TOLERANCE &&
        inner.x + inner.width <= outer.x + outer.width + TOLERANCE &&
        inner.y + inner.height <= outer.y + outer.height + TOLERANCE
    );
}

const cases: readonly (DeviceConfig | Baseline)[] = [...DEVICE_CONFIGS, ...BASELINES];

for (const config of cases) {
    const { label, width, height } = config;
    const coarse = config.pointer === 'coarse';
    const installed = 'mode' in config && config.mode === 'installed';

    test.describe(label, () => {
        test.use({ viewport: { width, height }, hasTouch: coarse, isMobile: coarse });

        test('fits without scrolling and keeps every card and control inside', async ({ page }, testInfo) => {
            await openWorstColumn(page);
            if (coarse) {
                const matches = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
                expect(matches, `${label}: pointer is coarse`).toBe(true);
            }

            const m = await measure(page, faceUpIdsOfWorstColumn());
            const viewport: Box = { x: 0, y: 0, width: m.innerWidth, height: m.innerHeight };

            expect(m.scrollHeight, `${label}: scrollHeight vs innerHeight`).toBeLessThanOrEqual(m.innerHeight);
            expect(m.scrollWidth, `${label}: scrollWidth vs innerWidth`).toBeLessThanOrEqual(m.innerWidth);

            expect(m.cards, `${label}: card count`).toHaveLength(52);
            for (const card of m.cards) {
                expect(isInside(card, m.panel), `${label}: card ${card.id} inside the panel`).toBe(true);
            }

            const names = m.controls.map((control) => control.name);
            expect(names, `${label}: shown controls`).toEqual(
                expect.arrayContaining(['Back to Home', 'Score', 'Timer', 'Game actions']),
            );
            expect(names.includes('Moves'), `${label}: Moves shown iff visible`).toBe(m.movesShown);
            for (const control of m.controls) {
                expect(isInside(control, viewport), `${label}: ${control.name} inside the viewport`).toBe(true);
            }

            const expected = boardSizeFor(config);
            expect(m.panelContent.width, `${label}: panel content width`).toBeGreaterThanOrEqual(expected.width - 1);
            expect(m.panelContent.height, `${label}: panel content height`).toBeGreaterThanOrEqual(expected.height - 1);

            if (installed) {
                expect(m.stripTops, `${label}: face-up cards of column 7`).toHaveLength(13);
                for (let i = 1; i < m.stripTops.length; i += 1) {
                    const gap = (m.stripTops[i] ?? 0) - (m.stripTops[i - 1] ?? 0);
                    expect(gap, `${label}: strip ${String(i)} of column 7`).toBeGreaterThanOrEqual(MIN_STRIP);
                }
            }

            await testInfo.attach(label, { body: await page.screenshot(), contentType: 'image/png' });
        });
    });
}
