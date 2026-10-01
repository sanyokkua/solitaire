import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { dealFromSeed } from '../../../src/domain/deal';
import type { Command, GameState, Mode } from '../../../src/domain/types';
import { solveOrdered } from '../../../src/solver/ordered';
import { replayLine } from '../../fixtures/solverCorpus';
import { deepFreeze, foundationsOf, makeState } from '../../fixtures/states';
import { endgameFromSeed, layout } from '../../support/endgames';
import { emptyingRun, foundationToColumn, partialRun } from '../../support/moveKinds';

const BUDGET = 5000;

/** The line replays to a won game with every command accepted, and holds only draws and player moves. */
function expectWinningLine(state: GameState, line: readonly Command[]): void {
    const replay = replayLine(state, line);
    expect(replay.events.filter((event) => event.type === 'rejected')).toEqual([]);
    expect(replay.state.status).toBe('won');
    expect(replay.state.foundations.map((pile) => pile.length)).toEqual([13, 13, 13, 13]);
    expect(replay.commands.every((command) => command.type === 'draw' || command.type === 'move')).toBe(true);
}

/** Whether some command of the line satisfies `kind`, judged on the position it is played from. */
function lineUses(
    state: GameState,
    line: readonly Command[],
    kind: (command: Command, before: GameState) => boolean,
): boolean {
    let current = state;
    for (const command of line) {
        if (kind(command, current)) {
            return true;
        }
        current = replayLine(current, [command]).state;
    }
    return false;
}

describe('solveOrdered on positions it cannot or need not search', () => {
    it('gives a win with no nodes and an empty line for a won position', () => {
        const won = makeState({
            mode: 'draw3',
            draw: 3,
            foundations: foundationsOf(13, 13, 13, 13),
            status: 'won',
        });
        expect(solveOrdered(won, BUDGET)).toEqual({ verdict: 'win', nodes: 0, line: [] });
        const vegasWon = { ...won, mode: 'vegas' as const, scoring: 'vegas' as const };
        expect(solveOrdered(vegasWon, BUDGET)).toEqual({ verdict: 'win', nodes: 0, line: [] });
    });

    it('gives unknown with no nodes and no line for a Draw 1 or Daily position', () => {
        for (const mode of ['draw1', 'daily'] as const) {
            const result = solveOrdered(dealFromSeed(19, mode), BUDGET);
            expect(result).toEqual({ verdict: 'unknown', nodes: 0 });
            expect('line' in result).toBe(false);
        }
    });

    it('gives unknown with no nodes and no line for a position that lists a card twice', () => {
        const state = dealFromSeed(1, 'draw3');
        const duplicated: GameState = { ...state, stock: [...state.stock.slice(0, -1), ...state.stock.slice(0, 1)] };
        const result = solveOrdered(duplicated, BUDGET);
        expect(result).toEqual({ verdict: 'unknown', nodes: 0 });
        expect('line' in result).toBe(false);
    });

    it('gives unknown with no nodes for a Vegas position past its pass limit', () => {
        const past: GameState = { ...dealFromSeed(1, 'vegas'), passes: 4 };
        expect(solveOrdered(past, BUDGET)).toEqual({ verdict: 'unknown', nodes: 0 });
    });
});

describe('solveOrdered budget, purity and determinism', () => {
    it.each(['draw3', 'vegas'] as const)('reports budget + 1 nodes and unknown when %s runs out of budget', (mode) => {
        // Seed 2 is not proven in either mode within a handful of nodes.
        const result = solveOrdered(dealFromSeed(2, mode), 3);
        expect(result).toEqual({ verdict: 'unknown', nodes: 4 });
    });

    it.each(['draw3', 'vegas'] as const)('gives identical verdicts, node counts and lines for two %s runs', (mode) => {
        for (const seed of [1, 2, 3]) {
            const state = dealFromSeed(seed, mode);
            expect(solveOrdered(state, 2000)).toEqual(solveOrdered(state, 2000));
        }
    });

    it.each(['draw3', 'vegas'] as const)('never mutates a deeply frozen %s position', (mode) => {
        for (const seed of [1, 2, 3]) {
            const state = deepFreeze(dealFromSeed(seed, mode));
            const before = JSON.stringify(state);
            expect(() => solveOrdered(state, BUDGET)).not.toThrow();
            expect(JSON.stringify(state)).toBe(before);
        }
    });
});

describe('solveOrdered wins replay as player commands', () => {
    it.each(['draw3', 'vegas'] as const satisfies readonly Mode[])(
        'every win for seeds 1 to 50 in %s replays to a won game',
        (mode) => {
            let wins = 0;
            for (let seed = 1; seed <= 50; seed++) {
                const state = dealFromSeed(seed, mode);
                const result = solveOrdered(state, BUDGET);
                if (result.verdict !== 'win') {
                    continue;
                }
                wins++;
                expect(result.nodes, `nodes of seed ${String(seed)}`).toBeLessThanOrEqual(BUDGET);
                expectWinningLine(state, result.line ?? []);
                if (mode === 'vegas') {
                    const recycles = replayLine(state, result.line ?? []).events.filter(
                        (event) => event.type === 'recycled',
                    );
                    expect(recycles.length).toBeLessThanOrEqual(2);
                }
            }
            expect(wins).toBeGreaterThan(0);
        },
        60_000,
    );

    it('replays a line found part-way through a game', () => {
        for (const mode of ['draw3', 'vegas'] as const) {
            const start = dealFromSeed(1, mode);
            const first = solveOrdered(start, BUDGET);
            if (first.verdict !== 'win') {
                continue;
            }
            const midway = replayLine(start, (first.line ?? []).slice(0, 20)).state;
            const second = solveOrdered(midway, BUDGET);
            expect(second.verdict).toBe('win');
            expectWinningLine(midway, second.line ?? []);
        }
    });
});

/**
 * Seven single hearts, 7 to King, fill every column. None can move: no column top is a black card to take a red one,
 * no column is empty for a King or a card taken back off a foundation, and none is next for its foundation until the
 * talon cards below the 7 are home. So the talon alone decides these positions.
 */
const DEAD_COLUMNS = ['7h', '8h', '9h', 'Th', 'Jh', 'Qh', 'Kh'] as const;

describe('solveOrdered verdicts decided by the talon', () => {
    it('proves a loss when the three-card grouping never brings the needed card to the waste top', () => {
        // A draw turns [5, 4, 6] over as one group, so the waste top is always the 5 of hearts, which is not next for
        // its foundation. The 4, the card that is, sits in the middle of the group in every pass.
        const state = layout({ mode: 'draw3', columns: DEAD_COLUMNS, stock: '5h 4h 6h' });
        expect(solveOrdered(state, BUDGET)).toEqual({ verdict: 'loss', nodes: 1 });
    });

    it('wins the same cards when the grouping puts the needed card on top', () => {
        const state = layout({ mode: 'draw3', columns: DEAD_COLUMNS, stock: '4h 5h 6h' });
        const result = solveOrdered(state, BUDGET);
        expect(result.verdict).toBe('win');
        expect(result.line?.[0]).toEqual({ type: 'draw' });
        expectWinningLine(state, result.line ?? []);
    });

    it('lets the passes left decide a Vegas position that needs one recycle', () => {
        // The waste top, the 6, cannot be played; one recycle turns the 3 up, and the rest follows.
        const on = (passes: number): GameState =>
            layout({ mode: 'vegas', columns: DEAD_COLUMNS, waste: '5h 4h 3h 6h', passes });
        for (const passes of [1, 2]) {
            const result = solveOrdered(on(passes), BUDGET);
            expect(result.verdict, `passes ${String(passes)}`).toBe('win');
            expect(result.line?.[0]).toEqual({ type: 'draw' });
            expectWinningLine(on(passes), result.line ?? []);
        }
        expect(solveOrdered(on(3), BUDGET)).toEqual({ verdict: 'loss', nodes: 1 });
    });
});

describe('solveOrdered wins that use each kind of board move', () => {
    it('moves part of a run to free the card under it', () => {
        // J of hearts, wanted next by its foundation, lies under 10 of spades in the run Q-J-10; 9 of spades, wanted
        // by 10 of spades, waits face down under Q of hearts, which waits for J of hearts. Only moving the 10 alone
        // (a partial run) breaks the circle.
        const state = layout({
            mode: 'draw3',
            columns: ['Qs Jh Ts', '_9s Qh', 'Jd'],
            stock: 'Ks Kh Kd Qd',
            waste: 'Js',
        });
        const result = solveOrdered(state, BUDGET);
        expect(result.verdict).toBe('win');
        expectWinningLine(state, result.line ?? []);
        expect(lineUses(state, result.line ?? [], partialRun)).toBe(true);
    });

    it('takes a King back off a finished foundation to hold a Queen', () => {
        // Q of spades sits on J of spades in the waste, and no column offers a red King; the King of hearts, already
        // on its foundation, is brought to the empty column for it (seeded endgame; see tests/support/endgames.ts).
        const state = endgameFromSeed(133, 'draw3', 7);
        const result = solveOrdered(state, BUDGET);
        expect(result.verdict).toBe('win');
        expectWinningLine(state, result.line ?? []);
        expect(lineUses(state, result.line ?? [], foundationToColumn)).toBe(true);
    });

    it('moves a whole run off a column with nothing face down', () => {
        const state = endgameFromSeed(43, 'draw3', 11);
        const result = solveOrdered(state, BUDGET);
        expect(result.verdict).toBe('win');
        expectWinningLine(state, result.line ?? []);
        expect(lineUses(state, result.line ?? [], emptyingRun)).toBe(true);
    });
});

describe('solveOrdered safe sends leave the talon alone', () => {
    // Waste Q K J 8 (8 on top) over stock T K 9: sending the safe 8 of clubs off the waste would regroup the talon
    // so that the King of spades never reaches the waste top, and that King is needed to rebuild a Jack for the 10.
    it.each([
        ['draw3', 1],
        ['vegas', 1],
        ['vegas', 2],
    ] as const)('still wins the position where sending the waste top loses it (%s, pass %i)', (mode, passes) => {
        const state = endgameFromSeed(60013, mode, 8, passes);
        expect(state.waste.at(-1)).toBe(cardId(2, 8));
        const result = solveOrdered(state, 200_000);
        expect(result.verdict).toBe('win');
        expectWinningLine(state, result.line ?? []);
    });
});
