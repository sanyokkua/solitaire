import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { dealFromSeed } from '../../../src/domain/deal';
import { applyCommand } from '../../../src/domain/engine';
import { mulberry32 } from '../../../src/domain/prng';
import type { Command, GameState, Mode } from '../../../src/domain/types';
import {
    fmix32,
    GRADES,
    GRADING_V1,
    gradeDeal,
    gradeOf,
    survival,
    playout,
    playoutSeed,
    type GradingParams,
    type Judge,
} from '../../../src/solver/grading';
import { exchangeHidden, faceDown, faceUp, frozenState, tableauOf, vegasAtLimit } from '../../fixtures/states';

const HEARTS = 0;
const CLUBS = 2;
const SPADES = 3;
const c = cardId;

/** A generator that returns `values` in order and counts how many were drawn; it throws when they run out. */
function scripted(...values: number[]): { rng: () => number; used: () => number } {
    let used = 0;
    return {
        rng: () => {
            const value = values[used++];
            if (value === undefined) throw new Error('the scripted generator ran out of values');
            return value;
        },
        used: () => used,
    };
}

/** One command, then stop: the first choice of a playout. */
const ONE_STEP: GradingParams = { ...GRADING_V1, stepCap: 1 };

/** Three candidates in order: A♣ home (priority 1), then 5♥ onto 6♠, then 5♥ onto 6♣ (priority 3). */
function threeCandidates(partial: Partial<GameState> = {}): GameState {
    return vegasAtLimit({
        tableau: tableauOf(faceUp(c(SPADES, 6)), faceUp(c(CLUBS, 6)), faceUp(c(CLUBS, 1))),
        waste: [c(HEARTS, 5)],
        ...partial,
    });
}

const HOME_CLUBS: Command = {
    type: 'move',
    from: { pile: 'tableau', col: 2 },
    index: 0,
    to: { pile: 'foundation', suit: CLUBS },
};
const WASTE_TO = (col: 0 | 1): Command => ({
    type: 'move',
    from: { pile: 'waste' },
    index: 0,
    to: { pile: 'tableau', col },
});

describe('playoutSeed', () => {
    it('matches pinned vectors of fmix32((seed + (index + 1) * 0x9E3779B9) mod 2^32)', () => {
        expect(playoutSeed(0, 0)).toBe(2462723854);
        expect(playoutSeed(1, 0)).toBe(2527132011);
        expect(playoutSeed(1, 1)).toBe(314344336);
        expect(playoutSeed(1, 15)).toBe(422674387);
        expect(playoutSeed(49, 3)).toBe(3060642537);
        expect(playoutSeed(4294967295, 7)).toBe(1650816001);
    });

    it('is the MurmurHash3 finalizer of the mixed seed', () => {
        expect(fmix32(1)).toBe(1364076727);
        expect(fmix32(0xdeadbeef)).toBe(233162409);
    });
});

describe('gradeOf', () => {
    it.each(['draw1', 'draw3', 'vegas', 'daily'] as const)('reads a score through the %s row', (mode) => {
        const { easyMin, hardMax } = GRADING_V1.thresholds[mode === 'daily' ? 'draw1' : mode];
        const top = GRADING_V1.playouts * GRADING_V1.maxCheckpoints;
        const grades = [top, easyMin, easyMin - 1, hardMax + 1, hardMax, 0].map((score) => gradeOf(score, mode));
        expect(grades).toEqual(['easy', 'easy', 'medium', 'medium', 'hard', 'hard']);
    });

    it('lists the grades easiest first', () => {
        expect(GRADES).toEqual(['easy', 'medium', 'hard']);
    });
});

describe('playout: the walk over the candidates', () => {
    it('takes the first candidate when its roll is below the take probability', () => {
        const { rng, used } = scripted(0.1);
        expect(playout(threeCandidates(), rng, ONE_STEP).commands).toEqual([HOME_CLUBS]);
        expect(used()).toBe(1);
    });

    it('moves on when the roll is not below it, and takes the next candidate when its roll is', () => {
        const { rng, used } = scripted(0.9, 0.1);
        expect(playout(threeCandidates(), rng, ONE_STEP).commands).toEqual([WASTE_TO(0)]);
        expect(used()).toBe(2);
    });

    it('moves on from a roll equal to the take probability', () => {
        const { rng } = scripted(GRADING_V1.takeProbability, 0.1);
        expect(playout(threeCandidates(), rng, ONE_STEP).commands).toEqual([WASTE_TO(0)]);
    });

    it('takes the last candidate it reaches without drawing a value for it', () => {
        const { rng, used } = scripted(0.9, 0.9);
        expect(playout(threeCandidates(), rng, ONE_STEP).commands).toEqual([WASTE_TO(1)]);
        expect(used()).toBe(2);
    });

    it('takes a lone candidate with no roll at all', () => {
        const lone = vegasAtLimit({ tableau: tableauOf(faceUp(c(SPADES, 6))), waste: [c(HEARTS, 5)] });
        const { rng, used } = scripted();
        expect(playout(lone, rng, ONE_STEP).commands).toEqual([WASTE_TO(0)]);
        expect(used()).toBe(0);
    });
});

describe('playout: draws', () => {
    const withStock = threeCandidates({
        mode: 'draw1',
        scoring: 'standard',
        draw: 1,
        passes: 1,
        stock: [c(SPADES, 9)],
    });

    it('draws instead when its roll is below the unforced-draw probability', () => {
        const { rng, used } = scripted(0.01);
        expect(playout(withStock, rng, ONE_STEP).commands).toEqual([{ type: 'draw' }]);
        expect(used()).toBe(1);
    });

    it('walks the candidates when the unforced roll is not below it', () => {
        const { rng, used } = scripted(0.5, 0.1);
        expect(playout(withStock, rng, ONE_STEP).commands).toEqual([HOME_CLUBS]);
        expect(used()).toBe(2);
    });

    it('draws instead when only a recycle is possible and its roll is below the unforced-draw probability', () => {
        const recyclable = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 6))), waste: [c(HEARTS, 5)] });
        const { rng, used } = scripted(0.01);
        expect(playout(recyclable, rng, ONE_STEP).commands).toEqual([{ type: 'draw' }]);
        expect(used()).toBe(1);
    });

    it('makes no unforced draw when neither a draw nor a recycle is possible', () => {
        const { rng, used } = scripted(0.9, 0.9);
        expect(playout(threeCandidates(), rng, ONE_STEP).commands).toEqual([WASTE_TO(1)]);
        expect(used()).toBe(2);
    });

    it('draws when it has nothing to play, with no roll', () => {
        const idle = frozenState({ stock: [c(HEARTS, 9), c(SPADES, 9)] });
        const { rng, used } = scripted();
        expect(playout(idle, rng, ONE_STEP).commands).toEqual([{ type: 'draw' }]);
        expect(used()).toBe(0);
    });

    it('recycles when the stock is empty, nothing can be played and the pass limit allows', () => {
        const idle = frozenState({ waste: [c(HEARTS, 9)] });
        expect(playout(idle, scripted().rng, ONE_STEP).commands).toEqual([{ type: 'draw' }]);
    });
});

describe('playout: when it stops', () => {
    it('stops at once with no move, no draw and no recycle left (the Vegas pass limit)', () => {
        const atLimit = vegasAtLimit({ waste: [c(HEARTS, 9)] });
        expect(playout(atLimit, scripted().rng)).toEqual({ won: false, commands: [] });
    });

    it('stops at a stall: a full cycle of the talon that played nothing', () => {
        const idle = frozenState({ stock: [c(HEARTS, 9), c(SPADES, 9), c(CLUBS, 9)] });
        const result = playout(idle, scripted().rng);
        // Three draws, then the recycle that restores the starting arrangement.
        expect(result.commands).toHaveLength(4);
        expect(result.won).toBe(false);
    });

    it('counts arrangements afresh after a board move, so a talon that returns to its first arrangement is no stall', () => {
        // Arrangement A (one card in the stock) -> draw -> B -> the tableau move -> draw back to A: seen since the move.
        const buried = c(CLUBS, 9);
        const state = frozenState({
            tableau: tableauOf(faceUp(c(SPADES, 6)), [...faceDown(buried), ...faceUp(c(HEARTS, 5))]),
            stock: [c(HEARTS, 9)],
        });
        const { rng, used } = scripted(0.01, 0.9);
        const { commands } = playout(state, rng);
        expect(commands.map((command) => command.type)).toEqual(['draw', 'move', 'draw', 'draw']);
        expect(used()).toBe(2);
    });

    it('ends within the step cap', () => {
        const deal = dealFromSeed(3, 'draw1');
        expect(playout(deal, mulberry32(1), { ...GRADING_V1, stepCap: 5 }).commands.length).toBeLessThanOrEqual(5);
        for (const mode of ['draw1', 'draw3', 'vegas'] as const) {
            const result = playout(dealFromSeed(11, mode), mulberry32(playoutSeed(11, 0)));
            expect(result.commands.length).toBeLessThanOrEqual(GRADING_V1.stepCap);
        }
    });

    it('applies every command by the game rules, none refused', () => {
        for (const mode of ['draw1', 'draw3', 'vegas'] as const) {
            let state = dealFromSeed(19, mode);
            for (const command of playout(state, mulberry32(playoutSeed(19, 2))).commands) {
                const result = applyCommand(state, command);
                expect(result.events.some((event) => event.type === 'rejected')).toBe(false);
                state = result.state;
            }
        }
    });
});

describe('playout: sees only face-up cards', () => {
    /** What a player sees: face-up cards, where face-down cards sit, the waste top, the stock size and the rest. */
    function view(state: GameState): unknown {
        return {
            tableau: state.tableau.map((cards) => cards.map((card) => (card.up ? card.id : 'down'))),
            wasteTop: state.waste.at(-1),
            wasteSize: state.waste.length,
            stockSize: state.stock.length,
            foundations: state.foundations,
            passes: state.passes,
        };
    }

    it('makes the same choices on positions that look the same', () => {
        let sameSteps = 0;
        let separated = 0;
        for (const mode of ['draw1', 'draw3', 'vegas'] as const) {
            for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
                const first = dealFromSeed(seed, mode);
                const second = exchangeHidden(first, seed + 1000);
                const one = playout(first, mulberry32(playoutSeed(seed, 0))).commands;
                const two = playout(second, mulberry32(playoutSeed(seed, 0))).commands;
                let a = first;
                let b = second;
                for (let i = 0; i < Math.max(one.length, two.length); i++) {
                    if (JSON.stringify(view(a)) !== JSON.stringify(view(b))) {
                        separated++;
                        break;
                    }
                    expect(two[i]).toEqual(one[i]);
                    sameSteps++;
                    const command = one[i];
                    if (command === undefined) break;
                    a = applyCommand(a, command).state;
                    b = applyCommand(b, command).state;
                }
            }
        }
        // The check is not vacuous: many steps were compared, and the exchange did separate the positions.
        expect(sameSteps).toBeGreaterThan(20);
        expect(separated).toBeGreaterThan(0);
    });
});

/** Small, fast parameters: a checkpoint after every command, three of them at most. */
const QUICK: GradingParams = { ...GRADING_V1, checkpointEvery: 1, maxCheckpoints: 3 };

/** A judge that proves the first `provable` positions it is asked about, then proves nothing; it records what it saw. */
function judgeFor(provable: number): { judge: Judge; budgets: number[] } {
    const budgets: number[] = [];
    return {
        budgets,
        judge: (_state, budget) => {
            budgets.push(budget);
            return budgets.length <= provable ? 'win' : 'unknown';
        },
    };
}

describe('survival', () => {
    const deal = dealFromSeed(19, 'draw1');

    it('counts the checkpoints the solver proves, and stops asking at the first it cannot', () => {
        for (const provable of [0, 1, 2]) {
            const { judge, budgets } = judgeFor(provable);
            expect(survival(deal, 0, QUICK, judge)).toBe(provable);
            expect(budgets).toHaveLength(provable + 1);
        }
    });

    it('asks the solver at the checkpoint budget, after every checkpointEvery-th command', () => {
        const params = { ...QUICK, checkpointEvery: 4, checkpointBudget: 1234 };
        const positions: number[] = [];
        const budgets: number[] = [];
        survival(deal, 0, params, (state, budget) => {
            budgets.push(budget);
            positions.push(state.moves);
            return 'win';
        });
        expect(budgets).toEqual([1234, 1234, 1234]);
        expect(positions).toEqual([4, 8, 12]);
    });

    it('stops at the most checkpoints, which is the top score of a playout', () => {
        const { judge, budgets } = judgeFor(Number.POSITIVE_INFINITY);
        expect(survival(deal, 0, QUICK, judge)).toBe(QUICK.maxCheckpoints);
        expect(budgets).toHaveLength(QUICK.maxCheckpoints);
    });

    it('gives a playout that wins every checkpoint it had left', () => {
        const winningIndex = Array.from({ length: 16 }, (_, index) => index).find(
            (index) => playout(deal, mulberry32(playoutSeed(deal.seed, index))).won,
        );
        expect(winningIndex).toBeDefined();
        if (winningIndex === undefined) return;
        const params = { ...GRADING_V1, checkpointEvery: 10, maxCheckpoints: 50 };
        expect(survival(deal, winningIndex, params, () => 'win')).toBe(50);
    });

    it('asks nothing of a playout that ends before its first checkpoint, and scores it 0', () => {
        const idle = frozenState({ stock: [c(HEARTS, 9), c(SPADES, 9), c(CLUBS, 9)] });
        const { judge, budgets } = judgeFor(Number.POSITIVE_INFINITY);
        expect(survival(idle, 0, { ...GRADING_V1, checkpointEvery: 10 }, judge)).toBe(0);
        expect(budgets).toEqual([]);
    });

    it('plays the playout of its own index', () => {
        // Position of the first checkpoint differs between playouts, so reusing one seed would show.
        const firsts = new Set<string>();
        for (let index = 0; index < 8; index++) {
            survival(deal, index, { ...QUICK, checkpointEvery: 40, maxCheckpoints: 1 }, (state) => {
                firsts.add(JSON.stringify(state.tableau) + JSON.stringify(state.waste));
                return 'win';
            });
        }
        expect(firsts.size).toBeGreaterThan(1);
    });
});

describe('gradeDeal', () => {
    const MODES: readonly Mode[] = ['draw1', 'draw3', 'vegas'];

    it('sums the survival of every playout and reads it through the table', () => {
        for (const mode of MODES) {
            const deal = dealFromSeed(8, mode);
            const { judge } = judgeFor(Number.POSITIVE_INFINITY);
            const { score, grade } = gradeDeal(deal, QUICK, judge);
            const expected = Array.from({ length: QUICK.playouts }, (_, index) =>
                survival(deal, index, QUICK, judge),
            ).reduce((sum, value) => sum + value, 0);
            expect(score).toBe(expected);
            expect(grade).toBe(gradeOf(score, mode, QUICK));
        }
    });

    it('gives the same score and grade every time, with the real solver', () => {
        for (const mode of MODES) {
            const deal = dealFromSeed(8, mode);
            const first = gradeDeal(deal);
            expect(first).toEqual(gradeDeal(deal));
            expect(first.score).toBeGreaterThanOrEqual(0);
            expect(first.score).toBeLessThanOrEqual(GRADING_V1.playouts * GRADING_V1.maxCheckpoints);
        }
    });

    it('grades a Daily deal like the Draw 1 deal of the same seed', () => {
        for (const seed of [19, 49]) {
            const daily = gradeDeal(dealFromSeed(seed, 'daily'));
            expect(daily).toEqual(gradeDeal(dealFromSeed(seed, 'draw1')));
        }
    });

    it('plays exactly the playouts its parameters name', () => {
        const deal = dealFromSeed(19, 'draw1');
        expect(gradeDeal(deal, { ...GRADING_V1, playouts: 0 })).toEqual({ score: 0, grade: 'hard' });
    });
});
