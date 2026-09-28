import { existsSync, statSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { aceHomePosition, freshDrawOneState, freshDrawThreeState, worstColumnState } from '../fixtures/boardPositions';
import { WINNING_LINE, nearlyWonState, parseLine } from '../fixtures/deals';
import type { GameState } from '../../src/domain/types';
import type { Preferences } from '../../src/features/preferences/preferencesSlice';
import { continueToGame } from './support/cards';
import { playLine, seedWinningGame } from './support/play';
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
            await settled(page);
            const path = `${OUTPUT_DIR}/${shot.file}`;

            await page.screenshot({ path });

            expectWritten(path);
        });
    });
}

/** The desktop screens of the interaction states (08, 09 and 12): same size and scale as the table's desktop shots. */
test.describe('interaction states', () => {
    test.use({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });

    test('08-select-mode-legal-targets.png shows the selected card and its legal targets', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only (D15)');
        await seedWinningGame(page, { theme: 'light' });
        await continueToGame(page);
        await settled(page);

        // The first move of the winning line: 3:3>2, so its source card is the one to pick up.
        await page.locator('.card[data-pile="tableau:3"][data-index="3"]').click({ position: { x: 12, y: 3 } });
        await expect(page.locator('.card.is-selected')).toHaveCount(1);
        await expect(page.locator('.ghost[data-ghost]').first()).toBeAttached();
        await settled(page);
        const path = `${OUTPUT_DIR}/08-select-mode-legal-targets.png`;

        await page.screenshot({ path });

        expectWritten(path);
    });

    test('09-hint.png shows the hint line and the hinted cards', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only (D15)');
        // aceHomePosition() has an exposed ace, so the hint is a card move (not a draw, which the stock cards
        // would cover), and both the hinted card's outline and its target ghost show.
        await seedRecord(page, {
            current: aceHomePosition(),
            preferences: { tapMode: 'select', autoSafe: false, theme: 'light' },
        });
        await continueToGame(page);
        await settled(page);

        await page.keyboard.press('h');
        await expect(page.locator('.game-hint')).toHaveText(/\S/);
        await expect(page.locator('.card.is-hint')).toHaveCount(1);
        await expect(page.locator('.ghost.is-hint[data-hint-ghost]')).toHaveCount(1);
        const path = `${OUTPUT_DIR}/09-hint.png`;

        // The hint clears after 2.2 s, so the shot is taken at once.
        await page.screenshot({ path });

        expectWritten(path);
    });

    test('10-settings-sheet.png shows the Settings sheet over Home, opened from the top bar', async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only (D15)');
        // A fresh browser resolves System to light (the headless colour scheme).
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto('/');

        await page.getByRole('banner').getByRole('button', { name: 'Settings' }).click();
        await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const path = `${OUTPUT_DIR}/10-settings-sheet.png`;

        await page.screenshot({ path });

        expectWritten(path);
    });

    test('12-win-cascade.png shows the cards in flight after the last move', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only (D15)');
        const commands = parseLine(WINNING_LINE.line);
        await seedRecord(page, {
            current: nearlyWonState(),
            preferences: { tapMode: 'select', autoSafe: false, theme: 'light' },
        });
        await continueToGame(page);
        await settled(page);

        // playLine waits for every animation to settle, and the cascade is one, so it is left to finish on its own.
        const played = playLine(page, 'tap', { commands: commands.slice(-1), movesBefore: WINNING_LINE.moves - 1 });
        // The cascade is made of Web Animations; the glides before it are CSS transitions.
        await page.waitForFunction(() =>
            document
                .getAnimations()
                .some((animation) => animation.playState === 'running' && !(animation instanceof CSSTransition)),
        );
        await page.waitForTimeout(1200);
        const path = `${OUTPUT_DIR}/12-win-cascade.png`;

        await page.screenshot({ path });
        await played;

        expectWritten(path);
    });

    test('13-win-sheet.png shows the Win sheet over the cascade', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only (D15)');
        const commands = parseLine(WINNING_LINE.line);
        await seedRecord(page, {
            current: nearlyWonState(),
            preferences: { tapMode: 'select', autoSafe: false, theme: 'light' },
        });
        await continueToGame(page);
        await settled(page);

        await playLine(page, 'tap', { commands: commands.slice(-1), movesBefore: WINNING_LINE.moves - 1 });
        await expect(page.getByRole('heading', { name: 'You win!' })).toBeVisible({ timeout: 4000 });
        const path = `${OUTPUT_DIR}/13-win-sheet.png`;

        await page.screenshot({ path });

        expectWritten(path);
    });
});

/** The Home screens and the How to play sheet (01, 02 and 11), which need no seeded game. */
test.describe('home screens', () => {
    test.use({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });

    test('01-home-light-desktop.png shows Home in the light theme', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only (D15)');
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto('/');
        await expect(page.getByRole('button', { name: 'Deal cards' })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const path = `${OUTPUT_DIR}/01-home-light-desktop.png`;

        await page.screenshot({ path });

        expectWritten(path);
    });

    test.describe('on a phone', () => {
        test.use({
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
            colorScheme: 'dark',
        });

        test('02-home-dark-phone.png shows Home in the dark theme', async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only (D15)');
            await page.goto('/');
            await expect(page.getByRole('button', { name: 'Deal cards' })).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(400); // the body's 250 ms colour transition from light to dark
            const path = `${OUTPUT_DIR}/02-home-dark-phone.png`;

            await page.screenshot({ path });

            expectWritten(path);
        });
    });

    test('11-how-to-play-sheet.png shows the How to play sheet opened from Home', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'Screenshots come from desktop Chromium only (D15)');
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto('/');

        await page.getByRole('button', { name: 'How to play' }).click();
        await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const path = `${OUTPUT_DIR}/11-how-to-play-sheet.png`;

        await page.screenshot({ path });

        expectWritten(path);
    });
});

/** Waits for the board to have its size and the fonts to be in, so a shot never catches a half-laid table. */
async function settled(page: Page): Promise<void> {
    await expect(page.locator('.board')).not.toHaveAttribute('data-resizing', /.*/);
    await page.evaluate(() => document.fonts.ready);
}

function expectWritten(path: string): void {
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(0);
}
