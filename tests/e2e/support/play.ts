import { expect, type Locator, type Page } from '@playwright/test';
import { dealFromSeed } from '../../../src/domain/deal';
import type { Command } from '../../../src/domain/types';
import type { Preferences } from '../../../src/features/preferences/preferencesSlice';
import { WINNING_LINE, parseLine } from '../../fixtures/deals';
import { MOVES_VALUE } from './game';
import { seedRecord } from './seed';
import { horizontalKey, planCommand, verticalKey, type GesturePlan, type PileKey } from './lineGestures';

export type Strategy = 'tap' | 'drag' | 'keyboard';

export interface PlayOptions {
    /** The commands to play; defaults to the recorded winning line. */
    readonly commands?: readonly Command[];
    /** How many moves the game already counts, so the HUD check stays right when a line is resumed. */
    readonly movesBefore?: number;
}

interface Position {
    readonly x: number;
    readonly y: number;
}

type MovePlan = Extract<GesturePlan, { kind: 'move' }>;

/** A card's visible top strip inside its own box: where a source is pressed and a target is met. */
const CARD_STRIP: Position = { x: 12, y: 3 };
/** Two taps on one card closer than this are a double tap (320 ms in the app, plus margin). */
const DOUBLE_TAP_GUARD_MS = 350;
const MAX_KEY_PRESSES = 16;

/**
 * Seeds the recorded winning deal as a game in progress (Select and place, Smart move off, so a line command never
 * diverges); call it before `page.goto`, then `continueToGame`.
 */
export async function seedWinningGame(page: Page, preferences: Partial<Preferences> = {}): Promise<void> {
    await seedRecord(page, {
        current: { ...dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode), started: true },
        preferences: { tapMode: 'select', autoSafe: false, ...preferences },
    });
}

/**
 * Plays commands on the open game through one input path. After each command the HUD move count must have advanced by
 * one and every animation must have settled, so a diverging game fails on the command that broke it.
 */
export async function playLine(page: Page, strategy: Strategy, options: PlayOptions = {}): Promise<void> {
    const commands = options.commands ?? parseLine(WINNING_LINE.line);
    const movesBefore = options.movesBefore ?? 0;
    const tapState = { lastKey: '', lastAt: 0 };
    if (strategy === 'keyboard') await stockSlot(page).focus();

    for (const [i, command] of commands.entries()) {
        const plan = planCommand(command);
        if (strategy === 'tap') await tapPlan(page, plan, tapState);
        else if (strategy === 'drag') await dragPlan(page, plan);
        else await keyboardPlan(page, plan);
        await expect(page.locator(MOVES_VALUE), `after command ${String(i + 1)}`).toHaveText(
            String(movesBefore + i + 1).padStart(3, '0'),
        );
        await settleAnimations(page);
    }
}

/** Waits until no card animation is running; the input gate ignores taps before. */
export async function settleAnimations(page: Page): Promise<void> {
    await page.waitForFunction(() =>
        document.getAnimations().every((animation) => animation.playState !== 'running' && !animation.pending),
    );
}

/** The pile's stock slot; a draw or recycle is a click here whatever covers it (the stock cards hit the stock too). */
export function stockSlot(page: Page): Locator {
    return page.locator('.slot[data-pile="stock"]');
}

/** The highest card index in a pile, or `null` when it holds no card. */
async function topIndex(page: Page, pile: PileKey): Promise<number | null> {
    return page.evaluate((key) => {
        const indexes = [...document.querySelectorAll<HTMLElement>(`.card[data-pile="${key}"]`)].map((card) =>
            Number(card.dataset.index),
        );
        return indexes.length === 0 ? null : Math.max(...indexes);
    }, pile);
}

function sourceCard(page: Page, plan: MovePlan): Locator {
    return page.locator(`.card[data-pile="${plan.from}"][data-index="${String(plan.index)}"]`);
}

/**
 * Where a card lands: the pile's top card (highest `data-index`, the empty slot if there is none). A column's top card
 * is met at its strip and a foundation's at its centre for a tap; a drag meets both at the strip.
 */
async function targetOf(
    page: Page,
    pile: PileKey,
    forDrag: boolean,
): Promise<{ locator: Locator; position: Position | undefined }> {
    const top = await topIndex(page, pile);
    const position = forDrag || pile.startsWith('tableau:') ? CARD_STRIP : undefined;
    if (top === null) return { locator: page.locator(`.slot[data-pile="${pile}"]`), position };
    return { locator: page.locator(`.card[data-pile="${pile}"][data-index="${String(top)}"]`), position };
}

async function pointOf(locator: Locator, position: Position): Promise<Position> {
    const box = await locator.boundingBox();
    if (box === null) throw new Error('the element to point at is not visible');
    return { x: box.x + position.x, y: box.y + position.y };
}

async function tapPlan(page: Page, plan: GesturePlan, tapState: { lastKey: string; lastAt: number }): Promise<void> {
    if (plan.kind === 'draw') {
        await stockSlot(page).click({ force: true });
        return;
    }
    await tap(sourceCard(page, plan), CARD_STRIP, tapState);
    const target = await targetOf(page, plan.to, false);
    await tap(target.locator, target.position, tapState);
}

/** A tap that waits out the double-tap window when it repeats the previous tap's card. */
async function tap(
    locator: Locator,
    position: Position | undefined,
    tapState: { lastKey: string; lastAt: number },
): Promise<void> {
    const key = await locator.getAttribute('data-card-id');
    if (key !== null && key === tapState.lastKey) {
        const wait = DOUBLE_TAP_GUARD_MS - (Date.now() - tapState.lastAt);
        if (wait > 0) await locator.page().waitForTimeout(wait);
    }
    await locator.click(position === undefined ? {} : { position });
    tapState.lastKey = key ?? '';
    tapState.lastAt = Date.now();
}

async function dragPlan(page: Page, plan: GesturePlan): Promise<void> {
    if (plan.kind === 'draw') {
        await stockSlot(page).click({ force: true });
        return;
    }
    const from = await pointOf(sourceCard(page, plan), CARD_STRIP);
    const target = await targetOf(page, plan.to, true);
    const to = await pointOf(target.locator, target.position ?? CARD_STRIP);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
}

interface Focused {
    readonly pile: PileKey;
    readonly index: number | null;
}

/** The last pile/card `readFocus` found focused on each page, kept only to name it in a thrown error. */
const lastFocusByPage = new WeakMap<Page, Focused>();

function describeFocused(focused: Focused): string {
    return focused.index === null ? focused.pile : `${focused.pile} index ${String(focused.index)}`;
}

/**
 * The pile and card index of the focused card or slot. `playLine`'s one explicit focus of the stock slot, at the
 * start of a keyboard-strategy run, is the only place focus legitimately starts outside the board; every call here
 * after that expects focus to already rest on the board (a command's own Enter always leaves it there — see
 * `useBoardKeyboard`'s focus-restore effect), so finding it elsewhere throws instead of silently refocusing the
 * stock, naming the last pile/card focus was known to rest on.
 */
async function readFocus(page: Page): Promise<Focused> {
    const focused = await page.evaluate(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || active.dataset.pile === undefined) return null;
        const index = active.dataset.index;
        return { pile: active.dataset.pile, index: index === undefined ? null : Number(index) };
    });
    if (focused === null) {
        const last = lastFocusByPage.get(page);
        throw new Error(
            last === undefined
                ? 'keyboard focus is not on the board and no prior board focus was recorded for this page'
                : `keyboard focus is not on the board; it was last on ${describeFocused(last)}`,
        );
    }
    lastFocusByPage.set(page, focused);
    return focused;
}

/** Arrows focus to `pile`, reading the real focus after each press. */
export async function focusPile(page: Page, pile: PileKey): Promise<void> {
    for (let presses = 0; presses <= MAX_KEY_PRESSES; presses++) {
        const key = horizontalKey((await readFocus(page)).pile, pile);
        if (key === null) return;
        await page.keyboard.press(key);
    }
    throw new Error(`could not arrow to ${pile} within ${String(MAX_KEY_PRESSES)} key presses`);
}

/** Arrows to the card at `index` in the focused column; other piles rest on the card the move needs. */
export async function focusIndex(page: Page, pile: PileKey, index: number): Promise<void> {
    if (!pile.startsWith('tableau:')) return;
    for (let presses = 0; presses <= MAX_KEY_PRESSES; presses++) {
        const focused = await readFocus(page);
        const key = focused.index === null ? null : verticalKey(focused.index, index);
        if (focused.pile === pile && key === null && focused.index === index) return;
        await page.keyboard.press(key ?? 'ArrowDown');
    }
    throw new Error(
        `could not arrow to card ${String(index)} of ${pile} within ${String(MAX_KEY_PRESSES)} key presses`,
    );
}

async function keyboardPlan(page: Page, plan: GesturePlan): Promise<void> {
    if (plan.kind === 'draw') {
        await focusPile(page, 'stock');
        await page.keyboard.press('Enter');
        return;
    }
    await focusPile(page, plan.from);
    await focusIndex(page, plan.from, plan.index);
    await page.keyboard.press('Enter');
    await focusPile(page, plan.to);
    await page.keyboard.press('Enter');
}
