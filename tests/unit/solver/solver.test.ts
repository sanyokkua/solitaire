import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { dealFromSeed } from '../../../src/domain/deal';
import { solve, type SolveVerdict } from '../../../src/solver/solver';
import { corpusSeeds, replayLine, SOLVER_CORPUS } from '../../fixtures/solverCorpus';
import { deepFreeze, faceDown, faceUp, foundationsOf, makeState, tableauOf } from '../../fixtures/states';

const BUDGET = 5000;
/** A seed the reference wins in only 26 nodes, the fastest of the corpus. */
const FASTEST_WIN_SEED = 19;
const FASTEST_WIN_NODES = 26;

const VERDICT_OF: Readonly<Record<string, SolveVerdict>> = { w: 'win', l: 'loss', u: 'unknown' };

function pinnedVerdict(seed: number): SolveVerdict {
    const verdict = VERDICT_OF[SOLVER_CORPUS.charAt(seed - 1)];
    if (verdict === undefined) {
        throw new Error(`no pinned verdict for seed ${String(seed)}`);
    }
    return verdict;
}

describe('pinned reference corpus (seeds 1-200 at 5,000 nodes)', () => {
    it('records 142 wins, 1 loss and 57 unknown, the only loss being seed 91', () => {
        expect(SOLVER_CORPUS).toHaveLength(200);
        expect(corpusSeeds('win')).toHaveLength(142);
        expect(corpusSeeds('loss')).toEqual([91]);
        expect(corpusSeeds('unknown')).toHaveLength(57);
    });

    it.each([
        [1, 50],
        [51, 100],
        [101, 150],
        [151, 200],
    ])(
        'seeds %i to %i reproduce their pinned verdicts',
        (first, last) => {
            for (let seed = first; seed <= last; seed++) {
                const result = solve(dealFromSeed(seed, 'draw1'), BUDGET);
                expect(result.verdict, `verdict of seed ${String(seed)}`).toBe(pinnedVerdict(seed));
                if (result.verdict === 'win') {
                    expect(result.nodes, `nodes of seed ${String(seed)}`).toBeLessThanOrEqual(BUDGET);
                    const replay = replayLine(dealFromSeed(seed, 'draw1'), result.line ?? []);
                    const rejected = replay.events.filter((event) => event.type === 'rejected');
                    expect(rejected, `rejected commands of seed ${String(seed)}`).toEqual([]);
                    expect(replay.state.status, `status after the line of seed ${String(seed)}`).toBe('won');
                    expect(replay.state.foundations.map((pile) => pile.length)).toEqual([13, 13, 13, 13]);
                    expect(
                        replay.commands.filter((command) => command.type === 'autoFoundation'),
                        `autoFoundation commands of seed ${String(seed)}`,
                    ).toEqual([]);
                } else if (result.verdict === 'unknown') {
                    expect(result.nodes, `nodes of seed ${String(seed)}`).toBe(BUDGET + 1);
                }
            }
        },
        30_000,
    );
});

describe('node budget', () => {
    const deal = dealFromSeed(FASTEST_WIN_SEED, 'draw1');

    it('wins at a budget equal to the nodes it needs', () => {
        expect(solve(deal, FASTEST_WIN_NODES)).toMatchObject({ verdict: 'win', nodes: FASTEST_WIN_NODES });
    });

    it('reports unknown with budget + 1 nodes when one node short', () => {
        expect(solve(deal, FASTEST_WIN_NODES - 1)).toEqual({ verdict: 'unknown', nodes: FASTEST_WIN_NODES });
    });
});

describe('positions the search does not handle', () => {
    it.each(['draw3', 'vegas'] as const)('refuses a %s deal without searching', (mode) => {
        const result = solve(dealFromSeed(FASTEST_WIN_SEED, mode), BUDGET);
        expect(result).toEqual({ verdict: 'unknown', nodes: 0 });
        expect(result).not.toHaveProperty('line');
    });

    it('refuses a position whose mode limits the passes even when it draws one card', () => {
        const result = solve(makeState({ mode: 'vegas', draw: 1 }), BUDGET);
        expect(result).toEqual({ verdict: 'unknown', nodes: 0 });
        expect(result).not.toHaveProperty('line');
    });

    it('reports an already won position as a win with no nodes and an empty line', () => {
        const won = makeState({ foundations: foundationsOf(13, 13, 13, 13), status: 'won' });
        expect(solve(won, BUDGET)).toEqual({ verdict: 'win', nodes: 0, line: [] });
    });

    it('searches a daily deal exactly like the draw1 deal of the same seed', () => {
        for (const seed of [FASTEST_WIN_SEED, 91, 3]) {
            expect(solve(dealFromSeed(seed, 'daily'), BUDGET)).toEqual(solve(dealFromSeed(seed, 'draw1'), BUDGET));
        }
    });
});

describe('mid-game positions', () => {
    // Hearts and diamonds are empty, so the black 3 is not a safe send; the waste holds a card and a pass is used up.
    const midGame = () =>
        makeState({
            tableau: tableauOf(faceUp(cardId(2, 3)), faceDown(cardId(0, 5)).concat(faceUp(cardId(1, 4)))),
            waste: [cardId(0, 13)],
            foundations: foundationsOf(0, 0, 2, 0),
            passes: 3,
        });

    it('is searched rather than refused, and is exhausted without a win', () => {
        const result = solve(midGame(), BUDGET);
        expect(result.nodes).toBeGreaterThan(0);
        expect(result.verdict).toBe('loss');
        expect(result).not.toHaveProperty('line');
    });
});

describe('purity', () => {
    it('neither throws on nor changes a deeply frozen position', () => {
        const state = deepFreeze(dealFromSeed(FASTEST_WIN_SEED, 'draw1'));
        const before = structuredClone(state);
        expect(() => solve(state, BUDGET)).not.toThrow();
        expect(state).toEqual(before);
    });

    it('gives the same result when the same position is solved twice', () => {
        for (const seed of [FASTEST_WIN_SEED, 91, 3]) {
            const state = dealFromSeed(seed, 'draw1');
            expect(solve(state, BUDGET)).toEqual(solve(state, BUDGET));
        }
    });
});
