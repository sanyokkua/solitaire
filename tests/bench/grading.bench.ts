// @vitest-environment node
/**
 * Informational calibration of grading v1, the solver-checked survival score (design D6, task 7.5).
 *
 * This is NOT a gate. It never asserts, is outside `test:unit`, `validate`, the git hooks and CI, and runs with
 * `rtk npm run bench`. For each of Draw 1, Draw 3 and Vegas it:
 * - collects the first `SAMPLE_SIZE` proven-winnable seeds among seeds 1 to `SEED_LIMIT`, searched at the mode's deal
 *   budget (`src/features/deal/budgets.ts`);
 * - scores each with every variant of the grading parameters below, and prints the score histogram, the thresholds that
 *   split the sample most evenly with the smallest grade share they reach, and the mean and worst cost of one
 *   `gradeDeal`.
 * Task 7.5 picks the final values from this output and pins them in `tests/fixtures/gradingGolden.ts`.
 *
 * `GRADING_CALIBRATION=fixture` prints instead, for each mode, the sample as `[seed, score]` pairs scored with the pinned
 * parameters, to paste into that fixture.
 */
import { test } from 'vitest';
import { GRADES, dealFromSeed } from '../../src/domain/deal';
import type { Grade, Mode } from '../../src/domain/types';
import { DRAW3_WINNABLE_BUDGET, VEGAS_WINNABLE_BUDGET, WINNABLE_BUDGET } from '../../src/features/deal/budgets';
import { GRADING_V1, gradeDeal, type GradingParams } from '../../src/solver/grading';
import { search } from '../../src/solver/search';

type GradedMode = Exclude<Mode, 'daily'>;

const SAMPLE_SIZE = 60;
const SEED_LIMIT = 4000;
const BENCH_TIMEOUT_MS = 3_600_000;

const VARIANTS: readonly { readonly name: string; readonly params: GradingParams }[] = [
    { name: 'v1 as pinned', params: GRADING_V1 },
    {
        name: 'finer checkpoints (every 6, up to 12)',
        params: { ...GRADING_V1, checkpointEvery: 6, maxCheckpoints: 12 },
    },
    {
        name: 'sharper player (take 0.8, unforced 0.02)',
        params: { ...GRADING_V1, takeProbability: 0.8, unforcedDrawProbability: 0.02 },
    },
    {
        name: 'looser player (take 0.4, unforced 0.1)',
        params: { ...GRADING_V1, takeProbability: 0.4, unforcedDrawProbability: 0.1 },
    },
];

const RUNS: readonly { readonly mode: GradedMode; readonly budget: number }[] = [
    { mode: 'draw1', budget: WINNABLE_BUDGET },
    { mode: 'draw3', budget: DRAW3_WINNABLE_BUDGET },
    { mode: 'vegas', budget: VEGAS_WINNABLE_BUDGET },
];

/** The first `SAMPLE_SIZE` seeds of 1..`SEED_LIMIT` whose deal in `mode` the search proves winnable. */
function provenSeeds(mode: GradedMode, budget: number): number[] {
    const seeds: number[] = [];
    for (let seed = 1; seed <= SEED_LIMIT && seeds.length < SAMPLE_SIZE; seed++) {
        if (search(dealFromSeed(seed, mode), budget).verdict === 'win') seeds.push(seed);
    }
    return seeds;
}

function shares(scores: readonly number[], easyMin: number, hardMax: number): Record<Grade, number> {
    const share = (test: (score: number) => boolean): number => scores.filter(test).length / scores.length;
    return {
        easy: share((score) => score >= easyMin),
        medium: share((score) => score > hardMax && score < easyMin),
        hard: share((score) => score <= hardMax),
    };
}

/** The thresholds with the largest smallest share; ties go to the higher Easy bar, then the higher Hard bar. */
function bestThresholds(scores: readonly number[], top: number) {
    let best = { easyMin: top, hardMax: 0, floor: -1, shares: shares(scores, top, 0) };
    for (let hardMax = 0; hardMax < top - 1; hardMax++) {
        for (let easyMin = hardMax + 2; easyMin <= top; easyMin++) {
            const split = shares(scores, easyMin, hardMax);
            const floor = Math.min(...GRADES.map((grade) => split[grade]));
            if (floor >= best.floor) best = { easyMin, hardMax, floor, shares: split };
        }
    }
    return best;
}

const percent = (value: number): string => `${(value * 100).toFixed(0)}%`;

function formatShares(split: Record<Grade, number>): string {
    return GRADES.map((grade) => `${grade} ${percent(split[grade])}`).join(', ');
}

/** Ten equal bins of 0..top, counted. */
function histogram(scores: readonly number[], top: number): string {
    const bins = Array.from({ length: 10 }, () => 0);
    for (const score of scores) {
        const bin = Math.min(9, Math.floor((score / (top + 1)) * 10));
        bins[bin] = (bins[bin] ?? 0) + 1;
    }
    return bins.join(' ');
}

for (const { mode, budget } of RUNS) {
    test(
        `grading v1 calibration in ${mode} (informational)`,
        () => {
            const seeds = provenSeeds(mode, budget);
            if (process.env.GRADING_CALIBRATION === 'fixture') {
                const pairs = seeds.map(
                    (seed) => `[${String(seed)}, ${String(gradeDeal(dealFromSeed(seed, mode)).score)}]`,
                );
                process.stdout.write(`\nFIXTURE ${mode}: [${pairs.join(', ')}]\n`);
                return;
            }
            const lines = [
                `grading v1, ${mode}: ${String(seeds.length)} proven seeds of 1..${String(SEED_LIMIT)} at ${String(budget)} nodes (informational, not a gate)`,
            ];
            for (const { name, params } of VARIANTS) {
                const top = params.playouts * params.maxCheckpoints;
                const costs: number[] = [];
                const scores = seeds.map((seed) => {
                    const started = performance.now();
                    const { score } = gradeDeal(dealFromSeed(seed, mode), params);
                    costs.push(performance.now() - started);
                    return score;
                });
                const best = bestThresholds(scores, top);
                const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
                const worst = Math.max(...costs);
                const { easyMin, hardMax } = params.thresholds[mode];
                lines.push(
                    `  ${name}: scores 0..${String(top)} in ten bins ${histogram(scores, top)}`,
                    `    pinned thresholds (Easy >= ${String(easyMin)}, Hard <= ${String(hardMax)}): ${formatShares(shares(scores, easyMin, hardMax))}`,
                    `    best thresholds Easy >= ${String(best.easyMin)}, Hard <= ${String(best.hardMax)}: ${formatShares(best.shares)}, floor ${percent(best.floor)}`,
                    `    cost of one gradeDeal: mean ${mean.toFixed(0)} ms, worst ${worst.toFixed(0)} ms`,
                );
            }
            process.stdout.write(`\n${lines.join('\n')}\n\n`);
        },
        BENCH_TIMEOUT_MS,
    );
}
