import { existsSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { freshDrawOneState, freshDrawThreeState, worstColumnState } from '../fixtures/boardPositions';
import type { GameState } from '../../src/domain/types';
import type { Preferences } from '../../src/features/preferences/preferencesSlice';
import { continueToGame } from './support/cards';
import { seedRecord } from './support/seed';

const OUTPUT_DIR = 'test-results/visual-parity';

/** One mockup screen: its file name (also the mockup's), its CSS size and the seeded state and preferences. */
interface Shot {
    readonly file: string;
    readonly width: number;
    readonly height: number;
    readonly touch: boolean;
    readonly state: () => GameState;
    readonly preferences: Partial<Preferences>;
}

/** The nine screens of D15: the size is half the mockup's pixel size, and the screenshot is taken at 2x like it. */
const SHOTS: readonly Shot[] = [
    {
        file: '03-game-light-desktop.png',
        width: 1180,
        height: 820,
        touch: false,
        state: freshDrawOneState,
        preferences: { theme: 'light' },
    },
    {
        file: '04-game-dark-desktop.png',
        width: 1180,
        height: 820,
        touch: false,
        state: freshDrawOneState,
        preferences: { theme: 'dark' },
    },
    {
        file: '05-game-dark-night-cards.png',
        width: 1180,
        height: 820,
        touch: false,
        state: freshDrawOneState,
        preferences: { theme: 'dark', nightCards: true },
    },
    {
        file: '06-game-light-phone.png',
        width: 390,
        height: 844,
        touch: true,
        state: freshDrawOneState,
        preferences: { theme: 'light' },
    },
    {
        file: '07-game-draw3-waste-fan.png',
        width: 1180,
        height: 820,
        touch: false,
        state: freshDrawThreeState,
        preferences: { theme: 'light' },
    },
    {
        file: '14-phone-landscape-wide-table.png',
        width: 852,
        height: 341,
        touch: true,
        state: worstColumnState,
        preferences: { theme: 'light' },
    },
    {
        file: '15-foldable-inner-side-rails.png',
        width: 890,
        height: 574,
        touch: true,
        state: worstColumnState,
        preferences: { theme: 'light' },
    },
    {
        file: '16-foldable-cover-portrait.png',
        width: 416,
        height: 527,
        touch: true,
        state: worstColumnState,
        preferences: { theme: 'light' },
    },
    {
        file: '17-galaxy-s25-portrait-browser.png',
        width: 360,
        height: 650,
        touch: true,
        state: freshDrawOneState,
        preferences: { theme: 'light' },
    },
];

for (const shot of SHOTS) {
    test.describe(shot.file, () => {
        test.use({
            viewport: { width: shot.width, height: shot.height },
            hasTouch: shot.touch,
            isMobile: shot.touch,
            deviceScaleFactor: 2,
        });

        test('is written for a side-by-side look with the mockup', async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only (D15)');
            await seedRecord(page, { current: shot.state(), preferences: shot.preferences });
            await continueToGame(page);
            await expect(page.locator('.board')).not.toHaveAttribute('data-resizing', /.*/);
            await page.evaluate(() => document.fonts.ready);
            const path = `${OUTPUT_DIR}/${shot.file}`;

            await page.screenshot({ path });

            expect(existsSync(path)).toBe(true);
            expect(statSync(path).size).toBeGreaterThan(0);
        });
    });
}
