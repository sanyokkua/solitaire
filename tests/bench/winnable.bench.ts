// @vitest-environment node
// covers: KS-PERF-02
/**
 * Informational benchmark of the winnable-deal selection in every mode (KS-PERF-02, design D11).
 *
 * This is NOT a gate. It never asserts on a timing, so it passes whatever the numbers are, and it is outside
 * `test:unit`, `validate`, the git hooks and CI; run it with `rtk npm run bench`. Numbers from a development machine
 * are not phone numbers: the real-device check is the manual one, and the Playwright check against the real worker is
 * `tests/e2e/dealLatency.spec.ts`.
 *
 * For each of Draw 1, Draw 3 and Vegas it reports, at the deal service's budget for the mode (`src/features/deal/
 * budgets.ts`):
 * - the verdict distribution of the search over a fixed set of seeds (identical on every run);
 * - the median and 95th percentile of one cold selection, `findWinnable` over a batch of `MAX_ATTEMPTS` seeds, the
 *   call the deal service makes for a winnable deal, with the selected deal graded (grading v1 is solver-checked, so it
 *   costs seconds on a phone). Every mode is informational: the dealing overlay covers a cold deal and the pool serves
 *   a warm one. Draw 1 is also run asking for the Hard grade, which grades up to `GRADE_LIMIT` proven candidates.
 *
 * Batches derive from `mulberry32` of fixed bases, so every run measures the same seeds; the iterations cycle through
 * the batches, so the samples span the spread of deals (most win on the first attempts, some need several). Vitest's
 * bench statistics (tinybench 6) carry the median (`p50`) but no `p95`, so `p95` is computed here from the retained raw
 * samples (`benchmark.retainSamples` in `vitest.config.ts`) by nearest rank, whereas `p50` interpolates; at these sample
 * counts the difference is negligible. `suppressExportGetterWarnings` in the config silences Vitest's warning about the
 * domain module's export getters read in the hot loop.
 */
import { test } from 'vitest';
import { dealFromSeed } from '../../src/domain/deal';
import { mulberry32 } from '../../src/domain/prng';
import type { Mode } from '../../src/domain/types';
import {
    DRAW3_WINNABLE_BUDGET,
    GRADE_LIMIT,
    MAX_ATTEMPTS,
    VEGAS_WINNABLE_BUDGET,
    WINNABLE_BUDGET,
} from '../../src/features/deal/budgets';
import type { Grade } from '../../src/domain/types';
import { search } from '../../src/solver/search';
import { findWinnable } from '../../src/solver/winnable';

const BATCH_COUNT = 40;
const BASES = Array.from({ length: BATCH_COUNT }, (_, i) => 0x5eed00 + i + 1);
/** Seeds whose verdicts are counted, per mode. */
const VERDICT_SEEDS = 100;
/** The slow modes need minutes for one pass over the batches, far past the default 60 s. */
const BENCH_TIMEOUT_MS = 900_000;
const TARGET_MEDIAN_MS = 300;
const TARGET_P95_MS = 1500;

interface ModeRun {
    readonly mode: Extract<Mode, 'draw1' | 'draw3' | 'vegas'>;
    readonly budget: number;
    /** Iterations of the selection benchmark: two passes over the batches for Draw 1, one for the slower modes. */
    readonly iterations: number;
    readonly targets: boolean;
    /** The grade asked for; `any` when absent. */
    readonly target?: Grade;
}

const RUNS: readonly ModeRun[] = [
    { mode: 'draw1', budget: WINNABLE_BUDGET, iterations: BATCH_COUNT * 2, targets: false },
    { mode: 'draw1', budget: WINNABLE_BUDGET, iterations: BATCH_COUNT, targets: false, target: 'hard' },
    { mode: 'draw3', budget: DRAW3_WINNABLE_BUDGET, iterations: BATCH_COUNT, targets: false },
    { mode: 'vegas', budget: VEGAS_WINNABLE_BUDGET, iterations: BATCH_COUNT, targets: false },
];

function seedBatch(base: number): number[] {
    const rng = mulberry32(base);
    return Array.from({ length: MAX_ATTEMPTS }, () => Math.floor(rng() * 2 ** 32));
}

/** Nearest-rank percentile (`p` in 0..1) of samples already sorted ascending. */
function percentile(sorted: readonly number[], p: number): number {
    const rank = Math.max(1, Math.ceil(p * sorted.length));
    return sorted[rank - 1] ?? Number.NaN;
}

function timing(value: number, target: number | undefined): string {
    const base = `${value.toFixed(1)} ms`;
    return target === undefined
        ? base
        : `${base} (target ${String(target)} ms, ${value <= target ? 'within' : 'over'})`;
}

function verdicts(mode: ModeRun['mode'], budget: number): string {
    const seeds = BASES.slice(0, 3).flatMap(seedBatch).slice(0, VERDICT_SEEDS);
    const counts = { win: 0, loss: 0, unknown: 0 };
    for (const seed of seeds) {
        counts[search(dealFromSeed(seed, mode), budget).verdict]++;
    }
    return `${String(counts.win)} win, ${String(counts.loss)} loss, ${String(counts.unknown)} unknown of ${String(seeds.length)}`;
}

for (const { mode, budget, iterations, targets, target } of RUNS) {
    test(
        `winnable search in ${mode}, target ${target ?? 'any'} (informational)`,
        async ({ bench }) => {
            const batches = BASES.map(seedBatch);
            let call = 0;

            const result = await bench(
                `findWinnable(${String(MAX_ATTEMPTS)} seeds, ${mode}, ${String(budget)} nodes)`,
                () => {
                    findWinnable(batches[call++ % batches.length] ?? [], budget, mode, {
                        selection: { target: target ?? 'any', gradeLimit: GRADE_LIMIT },
                    });
                },
            ).run({ iterations });

            const samples = result.latency.samples;
            if (samples === undefined) {
                throw new Error('bench samples were not retained: set benchmark.retainSamples in vitest.config.ts');
            }

            // Written straight to stdout: Vitest's agent-aware default reporter drops console output of passing tests.
            const lines = [
                `winnable search, ${mode}, target ${target ?? 'any'}, ${String(budget)} nodes, ${String(result.latency.samplesCount)} selections over ${String(batches.length)} seed batches (informational, not a gate)`,
                `  verdicts: ${verdicts(mode, budget)}`,
                `  median:   ${timing(result.latency.p50, targets ? TARGET_MEDIAN_MS : undefined)}`,
                `  p95:      ${timing(percentile(samples, 0.95), targets ? TARGET_P95_MS : undefined)}`,
            ];
            process.stdout.write(`\n${lines.join('\n')}\n\n`);
        },
        BENCH_TIMEOUT_MS,
    );
}
