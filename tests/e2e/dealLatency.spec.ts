import { test, type Page } from '@playwright/test';
import { median, percentile } from './support/stats';
import { holdDealPool, playerWorker, tagWorkers } from './support/workers';

const ITERATIONS = 10;
const CARDS = 52;

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

/** Clicks "Deal cards" and resolves with the milliseconds until all 52 cards are on the board. */
function clickDealAndTime(page: Page): Promise<number> {
    return page.evaluate(
        (cardCount) =>
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
            }),
        CARDS,
    );
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

test('Latency report', async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Latency is reported from desktop Chromium only (D16)');
    test.setTimeout(120_000);

    if (!baseURL) throw new Error('the Playwright config sets no baseURL');
    const latencies: number[] = [];
    let longest = 0;
    let workerUrl = '';

    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        const context = await browser.newContext({ baseURL });
        const page = await context.newPage();
        try {
            await observeLongTasks(page);
            // Every measured deal is a cold player search: the pool never starts, so it cannot serve the deal.
            await holdDealPool(page);
            await tagWorkers(page);
            await page.goto('/');
            await page.getByRole('button', { name: 'Deal cards' }).waitFor();
            latencies.push(await clickDealAndTime(page));
            const worker = await playerWorker(page, 'draw1');
            if (!worker.url.includes('worker')) throw new Error(`unexpected worker url ${worker.url}`);
            workerUrl = worker.url;
            longest = Math.max(longest, await longestLongTask(page));
        } finally {
            await context.close();
        }
    }

    const figures = {
        median: median(latencies),
        p95: percentile(latencies, 0.95),
        max: Math.max(...latencies),
    };
    const note = (type: string, description: string) => {
        testInfo.annotations.push({ type, description });
    };
    const ms = (value: number) => `${value.toFixed(0)} ms`;
    const basis = `Winnable Draw 1, ${String(ITERATIONS)} cold-worker deals`;
    note(
        'deal latency median (cold-worker)',
        `${ms(figures.median)} (${basis}; KS-PERF-02 target 300 ms on a mid-range phone)`,
    );
    note(
        'deal latency p95 (cold-worker)',
        `${ms(figures.p95)} (${basis}; KS-PERF-02 target 1.5 s on a mid-range phone)`,
    );
    note('deal latency max (cold-worker)', `${ms(figures.max)} (${basis})`);
    note('longest long task (cold-worker)', `${ms(longest)} on the main thread across all ${String(ITERATIONS)} deals`);
    note('solver worker (cold-worker)', workerUrl);

    console.log(
        `Deal latency (cold-worker, Winnable Draw 1, n=${String(ITERATIONS)}): median ${ms(figures.median)}, ` +
            `p95 ${ms(figures.p95)}, max ${ms(figures.max)}, longest long task ${ms(longest)}, worker ${workerUrl}`,
    );
});
