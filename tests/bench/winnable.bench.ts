// @vitest-environment node
/**
 * Informational latency benchmark for the winnable-deal search (KS-PERF-02, design D11).
 *
 * This is NOT a gate. It reports the median and 95th percentile of `findWinnable(batch, 5000)` against the KS-PERF-02
 * targets (300 ms median, 1.5 s p95 on a mid-range phone) and never asserts on a timing, so it passes whatever the
 * numbers are. It is outside `test:unit`, `validate`, the git hooks and CI; run it with `rtk npm run bench`. Numbers from
 * a development machine are not phone numbers: the real-device check is the manual one recorded for Phase 9, and the
 * Playwright check against the real worker is Phase 5.
 *
 * One benchmarked iteration is one `findWinnable` call over a batch of 40 seeds, the same call the deal service makes
 * for a Winnable Draw 1 deal. Batches derive from `mulberry32` of fixed bases, so every run measures the same seeds; the
 * iterations cycle through 40 batches, so the samples span the spread of deals (most win on the first attempt, some need
 * several), not a single case. Vitest's bench statistics (tinybench 6)
 * carry the median (`p50`) but no `p95`, so `p95` is computed here from the retained raw samples
 * (`benchmark.retainSamples` in `vitest.config.ts`) by nearest rank, whereas `p50` interpolates; at this sample count the
 * difference is negligible. `suppressExportGetterWarnings` in the config silences Vitest's warning about the domain
 * module's export getters read in the hot loop.
 */
import { test } from 'vitest';
import { mulberry32 } from '../../src/domain/prng';
import { findWinnable } from '../../src/solver/winnable';

const NODE_BUDGET = 5000;
const BATCH_SIZE = 40;
const BATCH_COUNT = 40;
const BASES = Array.from({ length: BATCH_COUNT }, (_, i) => 0x5eed00 + i + 1);
/** At least two passes over the batches, so each batch is measured more than once. */
const MIN_ITERATIONS = BATCH_COUNT * 2;
const TARGET_MEDIAN_MS = 300;
const TARGET_P95_MS = 1500;

function seedBatch(base: number): number[] {
    const rng = mulberry32(base);
    return Array.from({ length: BATCH_SIZE }, () => Math.floor(rng() * 2 ** 32));
}

/** Nearest-rank percentile (`p` in 0..1) of samples already sorted ascending. */
function percentile(sorted: readonly number[], p: number): number {
    const rank = Math.max(1, Math.ceil(p * sorted.length));
    return sorted[rank - 1] ?? Number.NaN;
}

function verdict(value: number, target: number): string {
    return `${value.toFixed(1)} ms (target ${String(target)} ms, ${value <= target ? 'within' : 'over'})`;
}

test('winnable search latency (informational, KS-PERF-02)', async ({ bench }) => {
    const batches = BASES.map(seedBatch);
    let call = 0;

    const result = await bench(`findWinnable(${String(BATCH_SIZE)} seeds, ${String(NODE_BUDGET)} nodes)`, () => {
        findWinnable(batches[call++ % batches.length] ?? [], NODE_BUDGET);
    }).run({ iterations: MIN_ITERATIONS });

    const samples = result.latency.samples;
    if (samples === undefined) {
        throw new Error('bench samples were not retained: set benchmark.retainSamples in vitest.config.ts');
    }

    // Written straight to stdout: Vitest's agent-aware default reporter drops console output of passing tests.
    const lines = [
        `KS-PERF-02 winnable search, ${String(result.latency.samplesCount)} samples over ${String(batches.length)} seed batches (informational, not a gate)`,
        `  median: ${verdict(result.latency.p50, TARGET_MEDIAN_MS)}`,
        `  p95:    ${verdict(percentile(samples, 0.95), TARGET_P95_MS)}`,
    ];
    process.stdout.write(`\n${lines.join('\n')}\n\n`);
});
