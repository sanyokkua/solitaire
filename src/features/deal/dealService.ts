/**
 * The deal service (D9): turns a requested mode into a dealt game, and a position into a hint. Draw 1 with "Winnable
 * deals only" and Daily are chosen by the solver on its worker, with progress reports for the dealing overlay; every
 * other request is dealt at once on the input thread. A newer deal cancels every pending request, and a failed worker
 * never leaves a deal undelivered. A hint asks the solver only where it applies and falls back to the domain heuristic.
 * Reaches the solver only through `./solverClient` and type-only imports.
 */
import { hint as heuristicHint } from '../../domain/assist';
import { dealFromSeed } from '../../domain/deal';
import { cryptoSeed, type SeedSource } from '../../domain/prng';
import { isWon, passLimit } from '../../domain/rules';
import type { GameState, Mode } from '../../domain/types';
import type { SolverHint } from '../../solver/hint';
import { DAILY_V1, dailySeeds, utcDayKey } from './daily';
import { createSolverClient, type WorkerLike } from './solverClient';

/** Nodes searched per candidate when a Draw 1 deal must be winnable. */
export const WINNABLE_BUDGET = 5_000;
/** Candidate seeds tried for a winnable Draw 1 deal. */
export const MAX_ATTEMPTS = 40;
/** Nodes searched for a solver hint. */
export const HINT_BUDGET = 3_000;

const DEFAULT_OVERLAY_DELAY_MS = 160;
const DEFAULT_HINT_TIMEOUT_MS = 150;

/** What a deal request asks for: the mode, and whether Draw 1 must be proven winnable ("Winnable deals only"). */
export interface DealRequest {
    readonly mode: Mode;
    readonly winnableOnly: boolean;
}

/** A delivered game, or `cancelled` when a newer deal or `dispose()` replaced the request (nothing is delivered). */
export type DealOutcome =
    | {
          readonly status: 'dealt';
          readonly state: GameState;
          /** The UTC `YYYY-MM-DD` key a Daily deal was selected for; absent for every other mode. */
          readonly dayKey?: string;
      }
    | { readonly status: 'cancelled' };

/**
 * How a hint request ended: a suggestion and who produced it, `none` for a won position or one nothing can move in,
 * or `cancelled` when a newer hint, a deal or `dispose()` replaced the request.
 */
export type HintOutcome =
    | { readonly status: 'hint'; readonly source: 'solver' | 'heuristic'; readonly hint: SolverHint }
    | { readonly status: 'none' }
    | { readonly status: 'cancelled' };

/** Progress of a verified deal: the attempt now being tried (from 1) and whether the overlay should show. */
export interface DealProgress {
    readonly overlay: boolean;
    readonly attempt: number;
}

export interface DealServiceOptions {
    /** Starts the solver worker; defaults to the real module worker. Tests supply stubs. */
    readonly createWorker?: () => WorkerLike;
    /** The clock the Daily deal reads its UTC date from. */
    readonly now?: () => Date;
    /** The entropy source of fresh seeds; defaults to the global `crypto`. */
    readonly seedSource?: SeedSource;
    /** How long a verified deal is pending before progress reports ask for the overlay. */
    readonly overlayDelayMs?: number;
    /** How long a solver hint may take before the heuristic answers; defaults to 150 ms. */
    readonly hintTimeoutMs?: number;
}

export interface DealService {
    /**
     * Cancels every pending request, then deals `request`. Draw 1 with `winnableOnly` tries {@link MAX_ATTEMPTS} fresh
     * seeds on the worker; Daily (whatever `winnableOnly` says) tries the day's v1 candidates on the worker; anything
     * else deals one fresh seed on the calling thread. `onProgress` is called only for the two worker cases, while the
     * request is pending. If the worker fails, the fallback game is dealt from the first seed as `random`, 1 attempt.
     * A Daily deal, worker-verified or the worker-failure fallback, also reports the UTC day key (`dayKey`) its
     * candidate seeds came from; every other mode omits `dayKey`. Settles `cancelled` when a newer `deal()` or
     * `dispose()` replaced it. Rejects only when no entropy source exists.
     */
    readonly deal: (request: DealRequest, onProgress?: (progress: DealProgress) => void) => Promise<DealOutcome>;
    /**
     * The hint for `state`. A won position has none. A Draw 1 position with no pass limit (Draw 1, Daily) asks the
     * solver at {@link HINT_BUDGET} nodes; its suggestion wins if it arrives within `hintTimeoutMs`, and the domain
     * heuristic answers when it offers none, is late, fails, or a deal is pending. Draw 3 and Vegas use the heuristic
     * only. Settles `cancelled` when a newer `hint()`, any `deal()` or `dispose()` replaced it; a hint never cancels a
     * deal. Never rejects.
     */
    readonly hint: (state: GameState) => Promise<HintOutcome>;
    /** Cancels every pending request, stops the overlay timer and terminates the worker. Safe to call again. */
    readonly dispose: () => void;
}

/** What a worker-run deal searches: the ordered candidate seeds and the node budget for each. */
interface SearchPlan {
    readonly seeds: readonly number[];
    readonly budget: number;
    /** The UTC day key the seeds were derived from, for a Daily plan; absent for a winnable-Draw-1 plan. */
    readonly dayKey?: string;
}

/** Creates a deal service with one lazily started solver worker; see {@link DealService}. */
export function createDealService(options: DealServiceOptions = {}): DealService {
    const {
        createWorker,
        seedSource,
        now = () => new Date(),
        overlayDelayMs = DEFAULT_OVERLAY_DELAY_MS,
        hintTimeoutMs = DEFAULT_HINT_TIMEOUT_MS,
    } = options;
    const client = createSolverClient(createWorker);
    /** Counts deal requests; a request whose number is no longer current has been superseded or disposed. */
    let generation = 0;
    /** Counts hint requests likewise, so a newer hint also replaces an older one the client never saw. */
    let hintGeneration = 0;

    function searchPlan({ mode, winnableOnly }: DealRequest): SearchPlan | undefined {
        if (mode === 'daily') {
            const dayKey = utcDayKey(now());
            return { seeds: dailySeeds(dayKey), budget: DAILY_V1.budget, dayKey };
        }
        if (mode === 'draw1' && winnableOnly) {
            return {
                seeds: Array.from({ length: MAX_ATTEMPTS }, () => cryptoSeed(seedSource)),
                budget: WINNABLE_BUDGET,
            };
        }
        return undefined;
    }

    async function search(
        plan: SearchPlan,
        mode: Mode,
        mine: number,
        onProgress: ((progress: DealProgress) => void) | undefined,
    ): Promise<DealOutcome> {
        let attempt = 1;
        let overlay = false;
        const report = (): void => {
            if (mine === generation) {
                onProgress?.({ overlay, attempt });
            }
        };
        // One timer per request (the mockup's single 160 ms timer): it never fires for a deal delivered sooner.
        const timer = setTimeout(() => {
            overlay = true;
            report();
        }, overlayDelayMs);
        const outcome = await client
            .findWinnable(plan.seeds, plan.budget, (started) => {
                attempt = started;
                report();
            })
            .finally(() => {
                clearTimeout(timer);
            });
        if (outcome.status === 'cancelled' || mine !== generation) {
            return { status: 'cancelled' };
        }
        const day = plan.dayKey === undefined ? {} : { dayKey: plan.dayKey };
        if (outcome.status === 'ok') {
            const { seed, verdict, attempts } = outcome.result;
            return { status: 'dealt', state: dealFromSeed(seed, mode, { verdict, attempts }), ...day };
        }
        // The worker failed or could not start: deal the first candidate, unverified, so the player is never left waiting.
        const [first = 0] = plan.seeds;
        return { status: 'dealt', state: dealFromSeed(first, mode), ...day };
    }

    async function deal(request: DealRequest, onProgress?: (progress: DealProgress) => void): Promise<DealOutcome> {
        const mine = ++generation;
        // Every deal cancels first, so one dealt on this thread still settles a pending verified deal or hint. A hint
        // the client has already answered but the service has not yet delivered is replaced too.
        hintGeneration++;
        client.cancel();
        const plan = searchPlan(request);
        if (plan === undefined) {
            const state = dealFromSeed(cryptoSeed(seedSource), request.mode);
            return { status: 'dealt', state };
        }
        return await search(plan, request.mode, mine, onProgress);
    }

    function heuristicOutcome(state: GameState): HintOutcome {
        const suggestion = heuristicHint(state);
        return suggestion === undefined
            ? { status: 'none' }
            : { status: 'hint', source: 'heuristic', hint: suggestion };
    }

    async function hint(state: GameState): Promise<HintOutcome> {
        const mine = ++hintGeneration;
        if (isWon(state)) {
            client.cancelHints();
            return { status: 'none' };
        }
        // The solver supports only Draw 1 without a pass limit; it repeats its own check here because this layer may
        // not import solver code (D9).
        if (state.draw !== 1 || Number.isFinite(passLimit(state.mode))) {
            // Nothing asks the solver, so nothing else would replace an older solver hint: settle it now.
            client.cancelHints();
            return heuristicOutcome(state);
        }
        const outcome = await client.hint(state, HINT_BUDGET, hintTimeoutMs);
        if (outcome.status === 'cancelled' || mine !== hintGeneration) {
            return { status: 'cancelled' };
        }
        if (outcome.status === 'ok' && outcome.hint !== undefined) {
            return { status: 'hint', source: 'solver', hint: outcome.hint };
        }
        // No suggestion, a timeout, a busy worker (a deal is pending) or a failed one: the heuristic still answers.
        return heuristicOutcome(state);
    }

    function dispose(): void {
        generation++;
        hintGeneration++;
        client.dispose();
    }

    return { deal, hint, dispose };
}
