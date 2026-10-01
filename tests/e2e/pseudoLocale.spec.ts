// covers: KS-GEN-03, KS-I18N-04

import { expect, test, type Page } from '@playwright/test';
import { BASELINES, DEVICE_CONFIGS } from '../fixtures/viewports';
import { worstColumnState } from '../fixtures/boardPositions';
import { horizontalOverflows, pageOverflowsSideways, settled } from './support/layoutChecks';
import { seedRecord } from './support/seed';

/**
 * Longer strings on the device matrix (LO "Longer strings never clip or overlap", RF "Longer strings are checked on
 * the device matrix"): an init script makes every piece of visible text 30 % longer, then Home, the Game screen and
 * two sheets are measured on every device configuration. It runs in the `device-fit` project only.
 */

/** How much longer each visible text becomes, as a fraction of its length. */
const GROWTH = 0.3;

/** Grows every text node with words in it, and keeps doing so as React rewrites the page. Cards and keys are left alone. */
function installPadding(growth: number): void {
    const padded = new WeakMap<Node, string>();
    const skipped = 'script, style, title, kbd, input, textarea, [data-card-id]';

    const pad = (node: Text): void => {
        const text = node.data;
        if (padded.get(node) === text || !/\p{L}{2,}/u.test(text)) return;
        if (node.parentElement?.closest(skipped) !== null) return;
        const extra = Math.max(2, Math.ceil(text.trim().length * growth));
        const filler = Array.from({ length: extra }, (_, i) => (i % 6 === 0 ? ' ' : 'n')).join('');
        const grown = `${text}${filler}`;
        padded.set(node, grown);
        node.nodeValue = grown;
    };

    const walk = (root: Node): void => {
        if (root.nodeType === Node.TEXT_NODE) {
            pad(root as Text);
            return;
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) pad(node as Text);
    };

    new MutationObserver((records) => {
        for (const record of records) {
            if (record.type === 'characterData') pad(record.target as Text);
            for (const added of record.addedNodes) walk(added);
        }
    }).observe(document, { subtree: true, childList: true, characterData: true });
}

/** Boxes on Home that must stay inside the viewport sideways. */
const HOME_BOXES = [
    '.topbar',
    '.home-hero',
    '.mode-card',
    '.toggle-card',
    '.toggle-card .segmented',
    '.segmented button',
    '.cta-row',
    '.cta-row .action-button',
    '.stat-strip',
    '.stat-strip__cell',
    '.footlinks',
];
/** Boxes on the Game screen that must stay inside the viewport sideways: chips, HUD, toolbar and hint line. */
const GAME_BOXES = [
    '.game-topbar',
    '.game-chips',
    '.mode-chip',
    '.deal-chip',
    '.game-hud',
    '.stat-display',
    '.game-face',
    '.game-hint',
    '.toolbar',
    '.toolbar .tool',
    '.game-footer',
];
/** Boxes inside an open sheet. */
const SHEET_BOXES = [
    '.modal-sheet',
    '.setting-row',
    '.help-rule',
    '.help-grades__row',
    '.keys-table',
    '.modal-sheet__actions',
];
/** Elements whose text must wrap inside them rather than be cut. */
const MUST_WRAP = ['.setting-row', '.help-rule', '.help-grades__row', '.modal-sheet'];

/** Opens the sheet behind `open`, waits for it to settle and returns its geometry. */
async function openSheet(page: Page, open: () => Promise<void>) {
    await open();
    await expect(page.locator('.modal-sheet')).toBeVisible();
    await settled(page);
    return page.evaluate(() => {
        const element = document.querySelector('.modal-sheet');
        if (!element) throw new Error('no sheet is open');
        return {
            innerHeight: window.innerHeight,
            height: element.getBoundingClientRect().height,
            overflowY: getComputedStyle(element).overflowY,
            scrolls: element.scrollHeight > element.clientHeight,
        };
    });
}

for (const config of [...DEVICE_CONFIGS, ...BASELINES]) {
    const { label, width, height } = config;
    const coarse = config.pointer === 'coarse';

    test.describe(label, () => {
        test.use({ viewport: { width, height }, hasTouch: coarse, isMobile: coarse });

        test('30 % longer text keeps Home, the Game screen and the sheets inside the screen', async ({ page }) => {
            await page.addInitScript(installPadding, GROWTH);
            await seedRecord(page, {
                current: { ...worstColumnState(), verdict: 'win', attempts: 3, grade: 'medium' },
            });
            await page.goto('/');
            await expect(page.locator('.cta-row .action-button--deal')).toBeVisible();

            // Home: the page does not scroll sideways, every box is inside the viewport, Deal cards stays on screen.
            expect(await pageOverflowsSideways(page), `${label}: Home scrolls sideways`).toBe(false);
            expect(await horizontalOverflows(page, HOME_BOXES), `${label}: Home boxes`).toEqual([]);
            const deal = await page.locator('.cta-row .action-button--deal').boundingBox();
            expect(deal, `${label}: Deal cards is shown`).not.toBeNull();
            expect(deal?.y ?? -1, `${label}: Deal cards top`).toBeGreaterThanOrEqual(0);
            expect((deal?.y ?? 0) + (deal?.height ?? 0), `${label}: Deal cards bottom`).toBeLessThanOrEqual(
                height + 0.5,
            );

            // The sheets over Home: How to play, then Settings.
            const sheets = [
                { name: 'How to play', open: () => page.locator('.cta-row .action-button--outline').click() },
                { name: 'Settings', open: () => page.locator('.topbar .icon-action').last().click() },
            ];
            for (const { name, open } of sheets) {
                const sheet = await openSheet(page, open);
                expect(sheet.height, `${label}: ${name} sheet height`).toBeLessThanOrEqual(
                    sheet.innerHeight * 0.88 + 0.5,
                );
                expect(await pageOverflowsSideways(page), `${label}: ${name} scrolls sideways`).toBe(false);
                expect(await horizontalOverflows(page, SHEET_BOXES, MUST_WRAP), `${label}: ${name} boxes`).toEqual([]);
                if (width === 320 && height === 480) {
                    expect(['auto', 'scroll'], `${label}: ${name} scrolls`).toContain(sheet.overflowY);
                    expect(sheet.scrolls, `${label}: ${name} has more than fits`).toBe(true);
                }
                await page.keyboard.press('Escape');
                await expect(page.locator('.modal-sheet')).toHaveCount(0);
            }

            // The Game screen.
            await page.locator('.cta-row .action-button--tonal').click();
            await expect(page.locator('[data-card-id]')).toHaveCount(52);
            await expect(page.locator('.board')).not.toHaveAttribute('data-resizing', /.*/);
            expect(await pageOverflowsSideways(page), `${label}: Game scrolls sideways`).toBe(false);
            expect(await horizontalOverflows(page, GAME_BOXES), `${label}: Game boxes`).toEqual([]);
            const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
            expect(scrollHeight, `${label}: Game fits the height`).toBeLessThanOrEqual(height);
        });
    });
}
