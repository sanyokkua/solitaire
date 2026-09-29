// covers: KS-DEAL-10, KS-DEAL-12, KS-PERF-02
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { median, percentile } from './support/stats';
import { holdDealPool, playerWorker, poolProven, tagWorkers } from './support/workers';

const ITERATIONS = 10;
const CARDS = 52;
/** The warm-pool target of KS-PERF-02: a deal taken from the pool appears within this many milliseconds. */
const WARM_TARGET_MS = 100;
const POOL_TIMEOUT_MS = 120_000;
const MODES = [
    { mode: 'draw1', label: 'Draw 1' },
    { mode: 'draw3', label: 'Draw 3' },
    { mode: 'vegas', label: 'Vegas' },
] as const;

type ModeCase = (typeof MODES)[number];

/** What the init script keeps on `window`: the long-task observer and every entry it has delivered so far. */
interface LongTaskProbe {
    observer: PerformanceObserver;
    durations: number[];
}

type ProbeWindow = Window & { __longTasks?: LongTaskProbe };

/** Installs the long-task observer before any page script runs. */
async function observeLongTasks(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const probe: LongTaskProbe = {
            durations: [],
            observer: new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) probe.durations.push(entry.duration);
            }),
        };
        probe.observer.observe({ type: 'longtask', buffered: true });
        (window as ProbeWindow).__longTasks = probe;
    });
}

type DealWindow = Window &
    typeof globalThis & {
        __startDealTimer?: () => Promise<number>;
        __dealTime?: Promise<number> | undefined;
    };

/**
 * Defines, before any page script runs, `window.__startDealTimer()`: it clicks "Deal cards" and resolves with the
 * milliseconds until all 52 cards are on the board. When `atPoolRequest` is set it also arranges for that to happen in
 * the very task that posts the pool's first fill request, so the deal starts while a pre-verification is in flight; the
 * result is then `window.__dealTime`.
 */
async function installDealTimer(page: Page, options: { atPoolRequest: boolean }): Promise<void> {
    await page.addInitScript(
        ({ cardCount, atPoolRequest }) => {
            const w = window as DealWindow;
            w.__startDealTimer = () =>
                new Promise<number>((resolve, reject) => {
                    const button = [...document.querySelectorAll('button')].find(
                        (candidate) => candidate.textContent.trim() === 'Deal cards',
                    );
                    if (!button) {
                        reject(new Error('no "Deal cards" button'));
                        return;
                    }
                    const start = performance.now();
                    const cardsPresent = () => document.querySelectorAll('[data-card-id]').length >= cardCount;
                    const watcher = new MutationObserver(() => {
                        if (cardsPresent()) {
                            watcher.disconnect();
                            resolve(performance.now() - start);
                        }
                    });
                    watcher.observe(document, { childList: true, subtree: true });
                    button.click();
                    if (cardsPresent()) {
                        watcher.disconnect();
                        resolve(performance.now() - start);
                    }
                });
            if (atPoolRequest) {
                (window as unknown as { __afterPoolRequest?: () => void }).__afterPoolRequest = () => {
                    w.__dealTime = w.__startDealTimer?.();
                };
            }
        },
        { cardCount: CARDS, atPoolRequest: options.atPoolRequest },
    );
}

/** Clicks "Deal cards" and resolves with the milliseconds until all 52 cards are on the board. */
function clickDealAndTime(page: Page): Promise<number> {
    return page.evaluate(() => {
        const start = (window as DealWindow).__startDealTimer;
        if (start === undefined) throw new Error('the deal timer is not installed');
        return start();
    });
}

/** The time of the deal `installDealTimer` started at the pool's first fill request, once it has started. */
async function dealAtPoolRequestTime(page: Page): Promise<number> {
    await page.waitForFunction(() => (window as DealWindow).__dealTime !== undefined, undefined, {
        timeout: POOL_TIMEOUT_MS,
    });
    return page.evaluate(() => {
        const time = (window as DealWindow).__dealTime;
        if (time === undefined) throw new Error('no deal was started');
        return time;
    });
}

/** The longest long task the page has seen so far, 0 when there was none. */
function longestLongTask(page: Page): Promise<number> {
    return page.evaluate(() => {
        const probe = (window as ProbeWindow).__longTasks;
        if (!probe) return 0;
        for (const entry of probe.observer.takeRecords()) probe.durations.push(entry.duration);
        return Math.max(0, ...probe.durations);
    });
}

interface Session {
    readonly page: Page;
    close(): Promise<void>;
}

/** A fresh page (its own context, so its own solver workers) with the long-task observer and worker tags installed. */
async function freshPage(
    browser: Browser,
    baseURL: string,
    options: { holdPool: boolean; atPoolRequest: boolean },
): Promise<Session> {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await observeLongTasks(page);
    await installDealTimer(page, { atPoolRequest: options.atPoolRequest });
    // A player search that must be measured is a cold one: with the pool held it never starts, so it cannot serve the deal.
    if (options.holdPool) await holdDealPool(page);
    await tagWorkers(page);
    await page.goto('/');
    // An armed deal starts by itself, and Home with its button is gone by then.
    if (!options.atPoolRequest) await page.getByRole('button', { name: 'Deal cards' }).waitFor();
    return { page, close: () => context.close() };
}

/** Chooses the mode tile and, when given, the Difficulty option on Home. */
async function choose(page: Page, label: string, difficulty?: string): Promise<void> {
    if (label !== 'Draw 1') await page.getByRole('radio', { name: label, exact: true }).click();
    if (difficulty !== undefined) {
        await page.getByRole('radiogroup', { name: 'Difficulty' }).getByRole('radio', { name: difficulty }).click();
    }
}

interface Figures {
    readonly times: number[];
    readonly longest: number;
    /** How many of the deals were served by the pool, with no player search. */
    readonly fromPool: number;
    readonly workerUrl: string;
}

/** Records the median, 95th percentile and maximum of `times`, the longest long task and how the deals were served. */
function report(
    testInfo: TestInfo,
    path: string,
    note: string,
    { times, longest, fromPool, workerUrl }: Figures,
): void {
    const ms = (value: number) => `${value.toFixed(0)} ms`;
    const basis = `${String(times.length)} deals, ${note}`;
    const figures: [string, string][] = [
        ['median', ms(median(times))],
        ['p95', ms(percentile(times, 0.95))],
        ['max', ms(Math.max(...times))],
        ['longest long task', `${ms(longest)} on the main thread across all deals`],
        ['served from the pool', `${String(fromPool)} of ${String(times.length)}`],
        ['solver worker', workerUrl],
    ];
    for (const [type, value] of figures)
        testInfo.annotations.push({ type: `deal latency ${type} (${path})`, description: `${value} (${basis})` });
    console.log(`Deal latency (${path}, ${basis}): ${figures.map(([type, value]) => `${type} ${value}`).join(', ')}`);
}

async function measure(
    browser: Browser,
    baseURL: string,
    options: {
        readonly mode: ModeCase;
        readonly difficulty?: string;
        readonly holdPool: boolean;
        /** Starts the deal in the task that posts the pool's first fill request, so that fill is in flight. */
        readonly atPoolRequest?: boolean;
        /** Runs after the page loaded and the choice was made, before the deal is timed. */
        readonly before?: (page: Page) => Promise<void>;
    },
): Promise<Figures> {
    const times: number[] = [];
    let longest = 0;
    let fromPool = 0;
    let workerUrl = '';
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        const atPoolRequest = options.atPoolRequest === true;
        const session = await freshPage(browser, baseURL, { holdPool: options.holdPool, atPoolRequest });
        try {
            await choose(session.page, options.mode.label, options.difficulty);
            await options.before?.(session.page);
            times.push(
                atPoolRequest ? await dealAtPoolRequestTime(session.page) : await clickDealAndTime(session.page),
            );
            longest = Math.max(longest, await longestLongTask(session.page));
            const target = options.difficulty?.toLowerCase() ?? 'any';
            const player = await playerWorker(session.page, options.mode.mode, target).catch(() => undefined);
            if (player === undefined) fromPool += 1;
            else workerUrl = player.url;
            const solver = player ?? (await poolProven(session.page, options.mode.mode)) > 0;
            expect(solver, 'a background solver ran').toBeTruthy();
            if (player !== undefined) expect(player.url).toContain('worker');
        } finally {
            await session.close();
        }
    }
    return { times, longest, fromPool, workerUrl };
}

test.describe.configure({ mode: 'serial' });

test.describe('Latency report', () => {
    for (const mode of MODES) {
        test(`${mode.label} on demand, cold worker`, async ({ browser, baseURL }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'Latency is reported from desktop Chromium only (D16)');
            test.setTimeout(600_000);
            if (!baseURL) throw new Error('the Playwright config sets no baseURL');

            const figures = await measure(browser, baseURL, { mode, holdPool: true });

            report(
                testInfo,
                `${mode.label}, on-demand, cold-worker`,
                `Winnable ${mode.label}, fresh page each`,
                figures,
            );
        });
    }

    for (const mode of MODES) {
        test(`${mode.label} from a warm pool`, async ({ browser, baseURL }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'Latency is reported from desktop Chromium only (D16)');
            test.setTimeout(600_000);
            if (!baseURL) throw new Error('the Playwright config sets no baseURL');

            const figures = await measure(browser, baseURL, {
                mode,
                holdPool: false,
                // The pool is warm when its own worker has delivered a proven deal, never after a fixed wait.
                before: async (page) => {
                    await expect
                        .poll(() => poolProven(page, mode.mode), { timeout: POOL_TIMEOUT_MS, intervals: [20] })
                        .toBeGreaterThan(0);
                },
            });

            const within = figures.times.filter((time) => time <= WARM_TARGET_MS).length;
            testInfo.annotations.push({
                type: `deal latency target (${mode.label}, warm-pool)`,
                description: `${String(within)} of ${String(figures.times.length)} deals within ${String(WARM_TARGET_MS)} ms (KS-PERF-02 warm-pool target; reported, not gated)`,
            });
            report(testInfo, `${mode.label}, warm-pool`, `Winnable ${mode.label}, pool proven a deal`, figures);
        });
    }

    test('Draw 1 on demand with difficulty Hard, for information', async ({ browser, baseURL }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'Latency is reported from desktop Chromium only (D16)');
        test.setTimeout(600_000);
        if (!baseURL) throw new Error('the Playwright config sets no baseURL');

        const figures = await measure(browser, baseURL, { mode: MODES[0], difficulty: 'Hard', holdPool: true });

        report(
            testInfo,
            'Draw 1, Hard, on-demand, cold-worker',
            'Winnable Draw 1, difficulty Hard, fresh page each',
            figures,
        );
    });

    test('Draw 1 on demand while a pre-verification is in flight, for information', async ({
        browser,
        baseURL,
    }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'Latency is reported from desktop Chromium only (D16)');
        test.setTimeout(600_000);
        if (!baseURL) throw new Error('the Playwright config sets no baseURL');

        const figures = await measure(browser, baseURL, {
            mode: MODES[0],
            holdPool: false,
            // The deal starts in the very task that posts the pool's first fill request, so the fill is in flight.
            atPoolRequest: true,
        });

        report(testInfo, 'Draw 1, on-demand, pre-verification in flight', 'Winnable Draw 1, the pool filling', figures);
    });
});
