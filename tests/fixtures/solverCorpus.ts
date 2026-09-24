/**
 * Pinned verdicts of the reference Draw 1 solver for seeds 1 to 200 at a budget of 5,000 nodes.
 *
 * Character i is the verdict for seed i + 1: `w` win, `l` loss, `u` unknown. Each seed is dealt with
 * `dealFromSeed(seed, 'draw1')` and searched at 5,000 nodes.
 *
 * Recipe (design D2): a throwaway Node script, never committed, copying verbatim from
 * docs/spec/mockup/klondike-mockup.html `suitOf`/`rankOf`/`isRed`, `mulberry32`, `shuffle` and `dealFrom`
 * (:630-662) and `solveDraw1` (:667-758), then `solveDraw1(dealFrom(shuffle(mulberry32(seed))), 5000)` for
 * seeds 1-200. Recorded on Node 24, run twice with identical verdicts and node counts.
 *
 * Totals: 142 w / 1 l / 57 u. The only loss is seed 91. Fastest wins: seed 19 = 26 nodes, seed 109 = 27,
 * seeds 155 and 156 = 30. The string comes from the reference, never from the implementation under test; a
 * change to any verdict must be made on purpose by regenerating it with the recipe.
 *
 * Also here, shared by the solver line, hint and service tests: `MIDGAME_POSITIONS`, positions reached part-way
 * along a corpus win line (each pinned with a budget at which a fresh solve of it is still a win), and the helpers
 * `replayLine` and `midgameState`.
 */
import { dealFromSeed } from '../../src/domain/deal';
import { applyCommand } from '../../src/domain/engine';
import type { Command, GameEvent, GameState } from '../../src/domain/types';
import { solve } from '../../src/solver/solver';

export const SOLVER_CORPUS =
    'wwuwwuuwwwwuwwwuwwwwuuuwuwwwwuwwwwwuwwuwwwuuwuuwwuwwwuwwwwuwwwwwuwuwwuwwuuwwwwwuwwwwwwwwwwlwwuuwuwuwwwwwwwuwwwuuwuwwuwwwwwwwuuwuwwwwwuwwwwwuwwuwwwwuwwuwuuwwwwuwwwwuwuwwuwuwuwwuwwwwuwwwwuuwwuwwwwwwuuww';

export type CorpusVerdict = 'win' | 'loss' | 'unknown';

const CHAR_OF: Readonly<Record<CorpusVerdict, string>> = { win: 'w', loss: 'l', unknown: 'u' };

/** The seeds (1-based) whose pinned verdict is `verdict`, ascending. */
export function corpusSeeds(verdict: CorpusVerdict): number[] {
    const char = CHAR_OF[verdict];
    return Array.from(SOLVER_CORPUS).flatMap((c, i) => (c === char ? [i + 1] : []));
}

/** A position `k` commands into the win line of the Draw 1 deal of `seed`; a fresh solve of it at `budget` wins. */
export interface MidgamePosition {
    readonly seed: number;
    readonly k: number;
    readonly budget: number;
}

/**
 * Chosen by replaying corpus win lines and keeping positions a fresh solve still wins at the recorded budget. The
 * first command of that fresh line is noted per entry: seed 19 and seed 2 start with a draw (stock non-empty), seed 4
 * with a move; seed 45 needs the larger budget (its fresh solve takes 3,533 nodes).
 */
export const MIDGAME_POSITIONS: readonly MidgamePosition[] = [
    { seed: 19, k: 41, budget: 3000 },
    { seed: 4, k: 49, budget: 3000 },
    { seed: 2, k: 91, budget: 3000 },
    { seed: 45, k: 108, budget: 5000 },
];

/** Plays `line` through `applyCommand` from `state`, collecting every event, refusals included so callers can assert there are none. */
export function replayLine(
    state: GameState,
    line: readonly Command[],
): { readonly state: GameState; readonly events: readonly GameEvent[]; readonly commands: readonly Command[] } {
    let current = state;
    const events: GameEvent[] = [];
    for (const command of line) {
        const result = applyCommand(current, command);
        events.push(...result.events);
        current = result.state;
    }
    return { state: current, events, commands: line };
}

/** The position of `entry`: its seed's deal after the first `k` commands of the solver's line at 5,000 nodes. */
export function midgameState(entry: MidgamePosition): GameState {
    const deal = dealFromSeed(entry.seed, 'draw1');
    const { line } = solve(deal, 5000);
    if (line === undefined) {
        throw new Error(`seed ${String(entry.seed)} has no winning line at 5,000 nodes`);
    }
    return replayLine(deal, line.slice(0, entry.k)).state;
}
