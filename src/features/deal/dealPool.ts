/**
 * The graded-spare pool (D8): proven-winnable, graded deals kept in memory per mode and grade, so a matching deal
 * request is served at once. A filler pre-verifies deals on the pool's own solver client, one request at a time, for
 * the player's current mode only, asking for the grade whose bucket holds fewest deals, with fresh crypto seeds and the
 * same budget, grade limit and selection as a requested deal. It keeps the selected deal and the spares that fit; a
 * `random` result is never pooled. Nothing is stored.
 *
 * A fill starts only when the choice is Draw 1, Draw 3 or Vegas with "Winnable deals only" on, the pool is not paused
 * (hidden page) nor busy (a player deal is pending), no fill is in flight, and some grade of that mode holds fewer than
 * {@link POOL_PER_GRADE} deals. Pausing, a pending player deal or a new choice never cancels the fill in flight, whose
 * results are pooled under the mode it was started for.
 *
 * Termination (an assumption the spec leaves open): a fill that pools nothing, because it ended `random`, every deal
 * it found fell in a full bucket, or the worker failed, ends the filling until the next trigger (`take`, `setChoice`,
 * `resume`, `setBusy(false)`). Otherwise a mode whose Hard deals are rare, or a worker that keeps failing, would keep
 * the background thread busy for ever. A failure drops only the fill in flight; the next fill starts a new worker.
 */
import { GRADES } from '../../domain/deal';
import { cryptoSeed, type SeedSource } from '../../domain/prng';
import type { Grade, Mode } from '../../domain/types';
import type { GradeTarget } from '../../solver/grading';
import type { Spare, WinnableResult } from '../../solver/winnable';
import { GRADE_LIMIT, MAX_ATTEMPTS, winnableBudget } from './budgets';
import type { SolverClient } from './solverClient';

/** The most deals the pool holds for one mode and grade. */
export const POOL_PER_GRADE = 2;

/** The modes the pool serves; Daily never is. */
export type PooledMode = Exclude<Mode, 'daily'>;

/** A pooled deal: its seed, its own grade, and the attempts of the search that found it (1 for a spare). */
export interface PooledDeal {
    readonly seed: number;
    readonly grade: Grade;
    readonly attempts: number;
}

/** What the player has chosen on Home: the mode and the "Winnable deals only" switch. */
export interface PoolChoice {
    readonly mode: Mode;
    readonly winnableOnly: boolean;
}

export interface DealPoolOptions {
    /** The pool's own solver client, never the player's; the pool owns it and disposes it. */
    readonly client: SolverClient;
    /** The entropy source of fresh seeds; defaults to the global `crypto`. */
    readonly seedSource?: SeedSource;
}

export interface DealPool {
    /**
     * Removes and returns the oldest deal of `target`'s grade in `mode`, or the oldest of any grade for `any`;
     * `undefined` when there is none (never a deal of another grade). May start a refill.
     */
    readonly take: (mode: PooledMode, target: GradeTarget) => PooledDeal | undefined;
    /** Keeps each spare of a player's search whose bucket has room, with attempts 1, and drops the rest. */
    readonly deposit: (mode: PooledMode, spares: readonly Spare[]) => void;
    /** Sets the mode to fill; `undefined`, Daily or the switch off fills nothing. Pooled deals are kept. */
    readonly setChoice: (choice: PoolChoice | undefined) => void;
    /** Starts no new fill until `resume()`; the fill in flight continues. */
    readonly pause: () => void;
    readonly resume: () => void;
    /** While a player deal is pending (`true`) no new fill starts; the fill in flight continues. */
    readonly setBusy: (busy: boolean) => void;
    /** Ends the fill in flight, terminates the client's worker and ignores every later call. Safe to call again. */
    readonly dispose: () => void;
}

interface Entry extends PooledDeal {
    /** Insertion order across every bucket, so `any` can take the oldest deal of all grades. */
    readonly order: number;
}

type Buckets = Record<Grade, Entry[]>;

/** Creates an empty pool that fills nothing until a choice is set; see {@link DealPool}. */
export function createDealPool({ client, seedSource }: DealPoolOptions): DealPool {
    const byMode = new Map<PooledMode, Buckets>();
    let nextOrder = 0;
    let choice: PoolChoice | undefined;
    let paused = false;
    let busy = false;
    let filling = false;
    let disposed = false;

    function bucketsOf(mode: PooledMode): Buckets {
        let buckets = byMode.get(mode);
        if (buckets === undefined) {
            buckets = { easy: [], medium: [], hard: [] };
            byMode.set(mode, buckets);
        }
        return buckets;
    }

    /** Pools `deal` when its bucket has room; reports whether it did. */
    function add(mode: PooledMode, deal: PooledDeal): boolean {
        const bucket = bucketsOf(mode)[deal.grade];
        if (bucket.length >= POOL_PER_GRADE) {
            return false;
        }
        bucket.push({ ...deal, order: nextOrder++ });
        return true;
    }

    /** Pools the deals a fill proved; reports whether any was kept. */
    function addResult(mode: PooledMode, { seed, verdict, attempts, grade, spares }: WinnableResult): boolean {
        if (verdict !== 'win' || grade === undefined) {
            return false;
        }
        let kept = add(mode, { seed, grade, attempts });
        for (const found of spares) {
            kept = add(mode, { ...found, attempts: 1 }) || kept;
        }
        return kept;
    }

    function fillableMode(): PooledMode | undefined {
        if (disposed || paused || busy || filling || !choice?.winnableOnly || choice.mode === 'daily') {
            return undefined;
        }
        return choice.mode;
    }

    /** The grade whose bucket holds fewest deals (ties in `GRADES` order), or `undefined` when every one is full. */
    function emptiestGrade(mode: PooledMode): Grade | undefined {
        const buckets = bucketsOf(mode);
        let emptiest: Grade | undefined;
        for (const grade of GRADES) {
            if (buckets[grade].length < (emptiest === undefined ? POOL_PER_GRADE : buckets[emptiest].length)) {
                emptiest = grade;
            }
        }
        return emptiest;
    }

    function fill(): void {
        const mode = fillableMode();
        const target = mode === undefined ? undefined : emptiestGrade(mode);
        if (mode === undefined || target === undefined) {
            return;
        }
        filling = true;
        const seeds = Array.from({ length: MAX_ATTEMPTS }, () => cryptoSeed(seedSource));
        void client
            .findWinnable(seeds, winnableBudget(mode), mode, { selection: { target, gradeLimit: GRADE_LIMIT } })
            .then((outcome) => {
                filling = false;
                if (!disposed && outcome.status === 'ok' && addResult(mode, outcome.result)) {
                    fill();
                }
            });
    }

    function take(mode: PooledMode, target: GradeTarget): PooledDeal | undefined {
        if (disposed) {
            return undefined;
        }
        const buckets = bucketsOf(mode);
        const grades = target === 'any' ? GRADES : [target];
        let oldest: Entry[] | undefined;
        for (const grade of grades) {
            const head = buckets[grade][0];
            if (head !== undefined && (oldest?.[0] === undefined || head.order < oldest[0].order)) {
                oldest = buckets[grade];
            }
        }
        const entry = oldest?.shift();
        fill();
        return entry === undefined ? undefined : { seed: entry.seed, grade: entry.grade, attempts: entry.attempts };
    }

    function deposit(mode: PooledMode, spares: readonly Spare[]): void {
        if (disposed) {
            return;
        }
        for (const found of spares) {
            add(mode, { ...found, attempts: 1 });
        }
    }

    function setChoice(next: PoolChoice | undefined): void {
        choice = next;
        fill();
    }

    function pause(): void {
        paused = true;
    }

    function resume(): void {
        paused = false;
        fill();
    }

    function setBusy(next: boolean): void {
        busy = next;
        fill();
    }

    function dispose(): void {
        if (disposed) {
            return;
        }
        disposed = true;
        byMode.clear();
        client.dispose();
    }

    return { take, deposit, setChoice, pause, resume, setBusy, dispose };
}
