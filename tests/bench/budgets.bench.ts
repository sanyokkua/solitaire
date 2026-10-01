// @vitest-environment node
/**
 * Informational sweep of the deal search budget in every mode (task 7.3 of the release change).
 *
 * This is NOT a gate: it never asserts and runs only with `rtk npm run bench`. For Draw 1, Draw 3 and Vegas it searches
 * seeds 1 to `SEEDS` at several budgets and prints, per budget, the verdict counts and the mean and 95th-percentile
 * time of one search, so the deal budgets in `src/features/deal/budgets.ts` can be set to prove as many deals winnable
 * as the loading time allows.
 */
import { test } from 'vitest';
import { dealFromSeed } from '../../src/domain/deal';
import type { Mode } from '../../src/domain/types';
import { search } from '../../src/solver/search';

const SEEDS = 100;
const BENCH_TIMEOUT_MS = 3_600_000;

const SWEEPS: readonly { readonly mode: Exclude<Mode, 'daily'>; readonly budgets: readonly number[] }[] = [
    { mode: 'draw1', budgets: [5_000, 20_000, 50_000] },
    { mode: 'draw3', budgets: [20_000, 50_000, 100_000] },
    { mode: 'vegas', budgets: [20_000, 50_000, 100_000] },
];

for (const { mode, budgets } of SWEEPS) {
    test(
        `deal search budgets in ${mode} (informational)`,
        () => {
            const lines = [`deal search budgets, ${mode}, seeds 1..${String(SEEDS)} (informational, not a gate)`];
            for (const budget of budgets) {
                const counts = { win: 0, loss: 0, unknown: 0 };
                const times: number[] = [];
                for (let seed = 1; seed <= SEEDS; seed++) {
                    const started = performance.now();
                    counts[search(dealFromSeed(seed, mode), budget).verdict]++;
                    times.push(performance.now() - started);
                }
                times.sort((a, b) => a - b);
                const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
                const p95 = times[Math.ceil(0.95 * times.length) - 1] ?? Number.NaN;
                lines.push(
                    `  ${String(budget)} nodes: ${String(counts.win)} win, ${String(counts.loss)} loss, ${String(counts.unknown)} unknown; mean ${mean.toFixed(0)} ms, p95 ${p95.toFixed(0)} ms per search`,
                );
            }
            process.stdout.write(`\n${lines.join('\n')}\n\n`);
        },
        BENCH_TIMEOUT_MS,
    );
}
