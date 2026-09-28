/**
 * The `DealService` contract: cases every implementation of the interface must pass, registered once and run against
 * the real service (on a stub worker) and against `fakeDealService`, so the fake is guarded while the service grows
 * (design D15). Each implementation supplies a {@link DealHarness}, which builds a service and settles what that
 * service leaves pending: a stub worker's `reply()` for the real service, `resolve()` and `resolveHint()` for the fake.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dealFromSeed } from '../../../../src/domain/deal';
import { hint as heuristicHint } from '../../../../src/domain/hint';
import type { GameState, Mode } from '../../../../src/domain/types';
import type {
    DealOutcome,
    DealProgress,
    DealRequest,
    DealService,
    HintOutcome,
} from '../../../../src/features/deal/dealService';
import type { SolverHint } from '../../../../src/solver/hint';
import { foundationsOf, makeState } from '../../../fixtures/states';

/** The seed every settled deal is dealt from. */
export const DEAL_SEED = 1;
/** The UTC day a harness's service treats as today. */
export const DAY_KEY = '2026-09-24';
/** The suggestion a settled solver hint carries. */
export const SOLVER_HINT: SolverHint = { kind: 'draw' };

/** Where a settled hint comes from: the solver's suggestion, or the domain heuristic taking over. */
export type HintSource = 'solver' | 'heuristic';

/** Adapts one `DealService` implementation to the contract. */
export interface DealHarness {
    readonly service: DealService;
    /**
     * Settles deal call `index` as dealt from {@link DEAL_SEED}, carrying {@link DAY_KEY} for a Daily request. The
     * index counts the deals that are pending until the harness settles them (Daily and winnable Draw 1 on the real
     * service, every deal on the fake), in call order. A deal the implementation answers by itself is left alone.
     */
    readonly settleDeal: (index: number, request: DealRequest) => void;
    /** Reports that pending deal `index` has started attempt `attempt`, with the overlay still off. */
    readonly progress: (index: number, attempt: number) => void;
    /** Settles pending hint `index` for `state` with the outcome {@link expectedHintOutcome} names. */
    readonly settleHint: (index: number, source: HintSource, state: GameState) => void;
    /** Releases what the harness holds; the service may already be disposed. */
    readonly dispose: () => void;
}

/** What differs between implementations. */
export interface ContractOptions {
    /** Whether a newer hint, any deal and `dispose()` settle a pending hint as `cancelled`. */
    readonly cancelsHints: boolean;
}

/** The state a deal of `mode` settled by {@link DealHarness.settleDeal} delivers. */
export function settledState(mode: Mode): GameState {
    return dealFromSeed(DEAL_SEED, mode, { verdict: 'win', attempts: 1 });
}

/** The outcome a hint settled by {@link DealHarness.settleHint} delivers for `state`. */
export function expectedHintOutcome(source: HintSource, state: GameState): HintOutcome {
    if (source === 'solver') {
        return { status: 'hint', source, hint: SOLVER_HINT };
    }
    const hint = heuristicHint(state);
    if (hint === undefined) {
        throw new Error('the position has no heuristic hint');
    }
    return { status: 'hint', source, hint };
}

const WINNABLE_DRAW_ONE: DealRequest = { mode: 'draw1', winnableOnly: true };
const DAILY: DealRequest = { mode: 'daily', winnableOnly: true };
const WON = makeState({ foundations: foundationsOf(13, 13, 13, 13), status: 'won' });

/** A Draw 1 position, one a service can ask the solver about. */
function draw1Position(): GameState {
    return dealFromSeed(DEAL_SEED, 'draw1');
}

/** Registers the contract cases under `name`; `makeHarness` builds a fresh harness for every case. */
export function dealServiceContract(name: string, makeHarness: () => DealHarness, options: ContractOptions): void {
    describe(`${name} satisfies the DealService contract`, () => {
        let harness: DealHarness;
        beforeEach(() => {
            harness = makeHarness();
        });
        afterEach(() => {
            harness.dispose();
        });

        describe('deal', () => {
            it.each<DealRequest>([
                { mode: 'draw1', winnableOnly: true },
                { mode: 'draw1', winnableOnly: false },
                { mode: 'draw3', winnableOnly: false },
                { mode: 'draw3', winnableOnly: true },
                { mode: 'vegas', winnableOnly: false },
                { mode: 'vegas', winnableOnly: true },
                { mode: 'daily', winnableOnly: false },
                { mode: 'daily', winnableOnly: true },
            ])('deals $mode (winnableOnly: $winnableOnly), with a dayKey only for daily', async (request) => {
                const outcome = harness.service.deal(request);
                harness.settleDeal(0, request);

                const dealt = await outcome;

                expect(dealt.status).toBe('dealt');
                if (dealt.status !== 'dealt') return;
                expect(dealt.state.mode).toBe(request.mode);
                if (request.mode === 'daily') {
                    expect(dealt.dayKey).toBe(DAY_KEY);
                } else {
                    expect(dealt).not.toHaveProperty('dayKey');
                }
            });

            it.each<DealRequest>([WINNABLE_DRAW_ONE, DAILY])(
                'delivers the game the settled request produced for $mode',
                async (request) => {
                    const outcome = harness.service.deal(request);
                    harness.settleDeal(0, request);

                    expect(await outcome).toEqual({
                        status: 'dealt',
                        state: settledState(request.mode),
                        ...(request.mode === 'daily' ? { dayKey: DAY_KEY } : {}),
                    });
                },
            );

            it('cancels an older pending deal when a newer one arrives, and delivers only the newer', async () => {
                const first = harness.service.deal(WINNABLE_DRAW_ONE);
                const second = harness.service.deal(WINNABLE_DRAW_ONE);
                harness.settleDeal(1, WINNABLE_DRAW_ONE);

                expect(await first).toEqual({ status: 'cancelled' });
                expect(await second).toEqual({ status: 'dealt', state: settledState('draw1') });
            });

            it('cancels the first two of three deals in a row', async () => {
                const first = harness.service.deal(WINNABLE_DRAW_ONE);
                const second = harness.service.deal(WINNABLE_DRAW_ONE);
                const third = harness.service.deal(WINNABLE_DRAW_ONE);
                harness.settleDeal(2, WINNABLE_DRAW_ONE);

                expect(await first).toEqual({ status: 'cancelled' });
                expect(await second).toEqual({ status: 'cancelled' });
                expect(await third).toEqual({ status: 'dealt', state: settledState('draw1') });
            });

            it('cancels a pending deal on dispose', async () => {
                const pending = harness.service.deal(WINNABLE_DRAW_ONE);

                harness.service.dispose();

                expect(await pending).toEqual({ status: 'cancelled' });
            });

            it('reports progress to the callback of the request that asked for it', async () => {
                const onProgress = vi.fn<(progress: DealProgress) => void>();
                const outcome: Promise<DealOutcome> = harness.service.deal(WINNABLE_DRAW_ONE, onProgress);

                harness.progress(0, 2);
                harness.progress(0, 3);
                harness.settleDeal(0, WINNABLE_DRAW_ONE);
                await outcome;

                expect(onProgress.mock.calls).toEqual([
                    [{ overlay: false, attempt: 2 }],
                    [{ overlay: false, attempt: 3 }],
                ]);
            });
        });

        describe('hint', () => {
            it.each<HintSource>(['solver', 'heuristic'])(
                'answers a pending hint with the %s outcome once it is settled',
                async (source) => {
                    const state = draw1Position();
                    const outcome = harness.service.hint(state);

                    harness.settleHint(0, source, state);

                    expect(await outcome).toEqual(expectedHintOutcome(source, state));
                },
            );

            it('answers a won position with none', async () => {
                expect(await harness.service.hint(WON)).toEqual({ status: 'none' });
            });

            it('does not cancel a pending deal', async () => {
                const deal = harness.service.deal(WINNABLE_DRAW_ONE);

                void harness.service.hint(draw1Position());
                harness.settleDeal(0, WINNABLE_DRAW_ONE);

                expect(await deal).toEqual({ status: 'dealt', state: settledState('draw1') });
            });

            if (options.cancelsHints) {
                it('cancels an older pending hint when a newer hint arrives, and answers only the newer', async () => {
                    const state = draw1Position();
                    const older = harness.service.hint(state);
                    const newer = harness.service.hint(state);

                    harness.settleHint(1, 'solver', state);

                    expect(await older).toEqual({ status: 'cancelled' });
                    expect(await newer).toEqual(expectedHintOutcome('solver', state));
                });

                it('cancels a pending hint when a deal follows it', async () => {
                    const hint = harness.service.hint(draw1Position());

                    const request: DealRequest = { mode: 'draw3', winnableOnly: false };
                    const deal = harness.service.deal(request);
                    harness.settleDeal(0, request);

                    expect((await deal).status).toBe('dealt');
                    expect(await hint).toEqual({ status: 'cancelled' });
                });

                it('cancels a pending hint on dispose', async () => {
                    const hint = harness.service.hint(draw1Position());

                    harness.service.dispose();

                    expect(await hint).toEqual({ status: 'cancelled' });
                });
            }
        });
    });
}
