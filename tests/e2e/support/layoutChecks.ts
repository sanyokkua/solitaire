import type { Page } from '@playwright/test';

/** Slack for sub-pixel rounding when comparing boxes, in px. */
const TOLERANCE = 0.5;

/** What one horizontal check reports: the selector and how far its box sticks out of the viewport, in px. */
export interface Overflow {
    readonly selector: string;
    readonly text: string;
    readonly left: number;
    readonly right: number;
}

/**
 * Every shown element matching one of `selectors` whose box leaves the viewport sideways, or whose own content is
 * wider than its box where `clip` lists it as unable to truncate (text that must wrap, not cut). Read in one task so
 * nothing moves between measurements. An empty result is a pass.
 */
export async function horizontalOverflows(
    page: Page,
    selectors: readonly string[],
    clip: readonly string[] = [],
): Promise<Overflow[]> {
    return page.evaluate(
        ({ selectors: list, clip: clipping, tolerance }) => {
            const found: { selector: string; text: string; left: number; right: number }[] = [];
            const width = window.innerWidth;
            for (const selector of list) {
                for (const element of document.querySelectorAll(selector)) {
                    if (element.getClientRects().length === 0) continue;
                    const box = element.getBoundingClientRect();
                    const left = Math.max(0, -box.left);
                    const right = Math.max(0, box.right - width);
                    const wider = clipping.includes(selector)
                        ? Math.max(0, element.scrollWidth - element.clientWidth)
                        : 0;
                    if (left > tolerance || right > tolerance || wider > 1) {
                        found.push({
                            selector,
                            text: element.textContent.trim().slice(0, 40),
                            left: left + wider,
                            right,
                        });
                    }
                }
            }
            return found;
        },
        { selectors, clip, tolerance: TOLERANCE },
    );
}

/** Whether the page scrolls sideways: the root element is wider than the viewport. */
export async function pageOverflowsSideways(page: Page): Promise<boolean> {
    return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

/** Waits until every finite animation has ended (a looping one never does), so a sliding sheet is measured where it settles. */
export async function settled(page: Page): Promise<void> {
    await page.evaluate(() =>
        Promise.all(
            document
                .getAnimations()
                .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
                .map((animation) => animation.finished.catch(() => undefined)),
        ),
    );
}
