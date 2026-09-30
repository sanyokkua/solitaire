/**
 * The deal service (D9): turns a requested mode into a dealt game, and a position into a hint. With "Winnable deals
 * only" on, Draw 1, Draw 3 and Vegas deals come from the graded-spare pool when it holds one of the requested grade, at
 * once, and are otherwise chosen by the solver on the player's worker, like every Daily deal; a searched deal reports
 * progress for the dealing overlay, and every deal records the grade it was dealt. With the switch off a deal is one
 * fresh seed dealt at once on the input thread. A newer deal cancels every pending player request but never the
 * pool's own worker, and a failed worker never leaves a deal undelivered. Every search sends the verdicts the in-memory
 * cache holds for its seeds and records the ones it establishes (D8). A hint asks the solver in every mode, on the
 * player's worker only, and falls back to the domain heuristic. Reaches the solver only through `./solverClient` and
 * type-only imports.
 */
import { hint as heuristicHint } from '../../domain/hint';
import { dealFromSeed } from '../../domain/deal';
import { cryptoSeed, type SeedSource } from '../../domain/prng';
import { isWon } from '../../domain/rules';
import type { GameState, Mode } from '../../domain/types';
import type { GradeTarget } from '../../solver/grading';
import type { SolverHint } from '../../solver/hint';
import { GRADE_LIMIT, HINT_BUDGET, MAX_ATTEMPTS, winnableBudget } from './budgets';
import { DAILY_V1, dailySeeds, utcDayKey } from './daily';
import { createDealPool, type PoolChoice } from './dealPool';
import { createSolverClient, type WorkerLike } from './solverClient';
import { createVerdictCache } from './verdictCache';

export type { PoolChoice } from './dealPool';

const DEFAULT_OVERLAY_DELAY_MS = 160;
const DEFAULT_HINT_TIMEOUT_MS = 150;

/**
 * What a deal request asks for: the mode, whether the deal must be proven winnable ("Winnable deals only"), and the
 * grade wanted of a proven deal (`any` takes the first). `target` is ignored when the switch is off, and a Daily deal
 * always searches for `any` whatever it says.
 */
export interface DealRequest {
    readonly mode: Mode;
    readonly winnableOnly: boolean;
    readonly target: GradeTarget;
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
    /** Starts a solver worker, the player's and the pool's alike; defaults to the real module worker. Tests supply stubs. */
    readonly createWorker?: () => WorkerLike;
    /** The clock the Daily deal reads its UTC date from. */
    readonly now?: () => Date;
    /** The entropy source of fresh seeds, the player's and the pool's; defaults to the global `crypto`. */
    readonly seedSource?: SeedSource;
    /** How long a verified deal is pending before progress reports ask for the overlay. */
    readonly overlayDelayMs?: number;
    /** How long a solver hint may take before the heuristic answers; defaults to 150 ms. */
    readonly hintTimeoutMs?: number;
}

export interface DealService {
    /**
     * Cancels every pending request (never the pool's fill), then deals `request`. Draw 1, Draw 3 and Vegas with
     * `winnableOnly` are served from the pool at once when it holds a deal of `request.target`'s grade (the oldest of
     * any grade for `any`), with the verdict `win` and the grade and attempts recorded when it was found (1 for a
     * spare), and no progress. Otherwise they try {@link MAX_ATTEMPTS} fresh seeds on the worker at the mode's budget,
     * looking for `request.target`, the game records the grade of the deal the search selected (the closest one when
     * the target is not found; `null` for a `random` fallback), and the other graded deals it met are pooled. Daily
     * (whatever `winnableOnly` says) never uses the pool: it tries the day's v1 candidates on the worker, always for the
     * target `any`, and records its grade too. Every search sends the cache's verdicts for its seeds and records those
     * it establishes, and the pool starts no fill while it is pending. With `winnableOnly` off, one fresh seed is
     * dealt on the calling thread, `random`, 1 attempt, ungraded. `onProgress` is called only for a search, while the
     * request is pending. If the worker fails, the fallback game is dealt from the first seed as `random`, 1 attempt,
     * ungraded, in every mode.
     * A Daily deal, worker-verified or the worker-failure fallback, also reports the UTC day key (`dayKey`) its
     * candidate seeds came from; every other mode omits `dayKey`. Settles `cancelled` when a newer `deal()` or
     * `dispose()` replaced it. Rejects only when no entropy source exists.
     */
    readonly deal: (request: DealRequest, onProgress?: (progress: DealProgress) => void) => Promise<DealOutcome>;
    /**
     * The hint for `state`. A won position has none. Any other position, in every mode, asks the solver at
     * {@link HINT_BUDGET} nodes; its suggestion wins if it arrives within `hintTimeoutMs`, and the domain heuristic
     * answers when it offers none, is late, fails, or a deal is pending. Settles `cancelled` when a newer `hint()`,
     * any `deal()` or `dispose()` replaced it; a hint never cancels a deal. Never rejects.
     */
    readonly hint: (state: GameState) => Promise<HintOutcome>;
    /**
     * Sets the choice the pool fills for and resumes filling (D8): Draw 1, Draw 3 or Vegas with `winnableOnly` on
     * pre-verifies deals on the pool's own worker, one at a time; Daily or the switch off fills nothing. Deals already
     * pooled are kept. Does nothing once disposed.
     */
    readonly prefetch: (choice: PoolChoice) => void;
    /** Starts no new fill until the next `prefetch`; the fill in flight is not cancelled. */
    readonly pause: () => void;
    /**
     * Cancels every pending request, stops the overlay timer and terminates both workers, the player's and the pool's.
     * Safe to call again.
     */
    readonly dispose: () => void;
}

/** What a worker-run deal searches: the ordered candidate seeds, the node budget for each and the grade wanted. */
interface SearchPlan {
    readonly seeds: readonly number[];
    readonly budget: number;
    readonly target: GradeTarget;
    /** The UTC day key the seeds were derived from, for a Daily plan; absent for a winnable-Draw-1 plan. */
    readonly dayKey?: string;
}

/**
 * Creates a deal service with two lazily started solver workers, the player's and the pool's, an empty pool and an
 * empty verdict cache; see {@link DealService}.
 */
export function createDealService(options: DealServiceOptions = {}): DealService {
    const {
        createWorker,
        seedSource,
        now = () => new Date(),
        overlayDelayMs = DEFAULT_OVERLAY_DELAY_MS,
        hintTimeoutMs = DEFAULT_HINT_TIMEOUT_MS,
    } = options;
    const client = createSolverClient(createWorker);
    // The pool owns its client, and so its worker: a player's deal or hint never cancels it (D8).
    const pool = createDealPool({ client: createSolverClient(createWorker), seedSource });
    const cache = createVerdictCache();
    /** Counts deal requests; a request whose number is no longer current has been superseded or disposed. */
    let generation = 0;
    /** Counts hint requests likewise, so a newer hint also replaces an older one the client never saw. */
    let hintGeneration = 0;

    function searchPlan({ mode, winnableOnly, target }: DealRequest): SearchPlan | undefined {
        if (mode === 'daily') {
            const dayKey = utcDayKey(now());
            return { seeds: dailySeeds(dayKey), budget: DAILY_V1.budget, target: 'any', dayKey };
        }
        if (winnableOnly) {
            return {
                seeds: Array.from({ length: MAX_ATTEMPTS }, () => cryptoSeed(seedSource)),
                budget: winnableBudget(mode),
                target,
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
        // One timer per request (a single 160 ms timer): it never fires for a deal delivered sooner.
        const timer = setTimeout(() => {
            overlay = true;
            report();
        }, overlayDelayMs);
        const outcome = await client
            .findWinnable(plan.seeds, plan.budget, mode, {
                selection: { target: plan.target, gradeLimit: GRADE_LIMIT },
                known: cache.known(mode, plan.budget, plan.seeds),
                onProgress: (started) => {
                    attempt = started;
                    report();
                },
                onOutcome: (searched) => {
                    cache.record(mode, plan.budget, searched);
                },
            })
            .finally(() => {
                clearTimeout(timer);
            });
        // The deals the search proved on the way are pooled even when a newer deal replaced it.
        if (outcome.status === 'ok' && mode !== 'daily') {
            pool.deposit(mode, outcome.result.spares);
        }
        // Only the current request ends the pause: a superseded one must not end the pause of the newer search.
        if (mine === generation) {
            pool.setBusy(false);
        }
        if (outcome.status === 'cancelled' || mine !== generation) {
            return { status: 'cancelled' };
        }
        const day = plan.dayKey === undefined ? {} : { dayKey: plan.dayKey };
        if (outcome.status === 'ok') {
            const { seed, verdict, attempts, grade } = outcome.result;
            return {
                status: 'dealt',
                state: dealFromSeed(seed, mode, { verdict, attempts, grade: grade ?? null }),
                ...day,
            };
        }
        // The worker failed or could not start: deal the first candidate, unverified and ungraded, so the player is
        // never left waiting.
        const [first = 0] = plan.seeds;
        return { status: 'dealt', state: dealFromSeed(first, mode), ...day };
    }

    async function deal(request: DealRequest, onProgress?: (progress: DealProgress) => void): Promise<DealOutcome> {
        const mine = ++generation;
        // Every deal cancels first, so one dealt on this thread still settles a pending verified deal or hint. A hint
        // the client has already answered but the service has not yet delivered is replaced too.
        hintGeneration++;
        client.cancel();
        const { mode, winnableOnly, target } = request;
        // The pool rests while this request may search, and fills again once it settles; set before `take`, which may
        // start a refill.
        pool.setBusy(mode === 'daily' || winnableOnly);
        if (mode !== 'daily' && winnableOnly) {
            const pooled = pool.take(mode, target);
            if (pooled !== undefined) {
                pool.setBusy(false);
                const { seed, attempts, grade } = pooled;
                return { status: 'dealt', state: dealFromSeed(seed, mode, { verdict: 'win', attempts, grade }) };
            }
        }
        const plan = searchPlan(request);
        if (plan === undefined) {
            const state = dealFromSeed(cryptoSeed(seedSource), mode);
            return { status: 'dealt', state };
        }
        return await search(plan, mode, mine, onProgress);
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

    function prefetch(choice: PoolChoice): void {
        pool.setChoice(choice);
        pool.resume();
    }

    function dispose(): void {
        generation++;
        hintGeneration++;
        client.dispose();
        pool.dispose();
    }

    return { deal, hint, prefetch, pause: pool.pause, dispose };
}
