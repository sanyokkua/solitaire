import { describe, expect, it } from 'vitest';
import { hint } from '../../../src/domain/assist';
import { dealFromSeed } from '../../../src/domain/deal';
import { applyCommand } from '../../../src/domain/engine';
import type { Command, GameState } from '../../../src/domain/types';
import { WINNING_LINE, parseLine } from '../../fixtures/deals';
import { deepFreeze } from '../../fixtures/states';

const { seed, mode } = WINNING_LINE;

/** The greedy policy of design D13: do whatever the hint says; a recycle hint is just another draw. */
function hintCommand(state: GameState): Command | undefined {
    const next = hint(state);
    if (next === undefined) return undefined;
    return next.kind === 'move' ? next.command : { type: 'draw' };
}

/** Identifies a position by everything a move can change, so a repeated position means the policy is cycling. */
function positionKey(state: GameState): string {
    return JSON.stringify([state.tableau, state.stock, state.waste, state.foundations]);
}

describe('a complete game played through commands alone', () => {
    it('replays the recorded line on its deal without a refusal and ends won', () => {
        const commands = parseLine(WINNING_LINE.line);
        expect(commands).toHaveLength(WINNING_LINE.moves); // every token is a counted move

        let state = deepFreeze(dealFromSeed(seed, mode));
        commands.forEach((command, step) => {
            const result = applyCommand(state, command);
            const refused = result.events.find((event) => event.type === 'rejected');
            expect(refused, `step ${String(step)} of the recorded line was refused`).toBeUndefined();
            state = result.state;
        });

        expect(state.status).toBe('won');
        expect(state.foundations.map((foundation) => foundation.length)).toEqual([13, 13, 13, 13]);
        expect(state.moves).toBe(WINNING_LINE.moves);
        expect(state.score).toBe(WINNING_LINE.score);
        expect(state.passes).toBe(WINNING_LINE.passes);
    });

    it('never changes the clock, seed, mode, rules or provenance at any step of the line', () => {
        const owned = (state: GameState) => {
            const { elapsedMs, seed, mode, draw, scoring, verdict, attempts } = state;
            return { elapsedMs, seed, mode, draw, scoring, verdict, attempts };
        };
        // A non-default clock and provenance, so resetting them to their defaults would be caught.
        let state = deepFreeze({ ...dealFromSeed(seed, mode, { verdict: 'win', attempts: 3 }), elapsedMs: 12_345 });
        const expected = owned(state);
        for (const [step, command] of parseLine(WINNING_LINE.line).entries()) {
            state = applyCommand(state, command).state;
            expect(owned(state), `step ${String(step)}`).toEqual(expected);
        }
        expect(state.status).toBe('won');
    });

    it('replays the recorded line deterministically', () => {
        const play = () =>
            parseLine(WINNING_LINE.line).reduce(
                (state, command) => applyCommand(state, command).state,
                deepFreeze(dealFromSeed(seed, mode)),
            );
        expect(play()).toEqual(play());
    });

    it('is won by driving the same deal with the hint heuristic as a greedy policy', () => {
        let state = deepFreeze(dealFromSeed(seed, mode));
        const seen = new Set<string>([positionKey(state)]);
        const stepCap = 2000;
        for (let step = 0; ; step++) {
            if (step >= stepCap) expect.fail(`seed ${String(seed)}: hint policy exceeded ${String(stepCap)} steps`);
            const command = hintCommand(state);
            if (command === undefined) {
                expect.fail(`seed ${String(seed)}: hint ran out of advice at step ${String(step)}`);
            }
            const result = applyCommand(state, command);
            if (result.events.some((event) => event.type === 'rejected')) {
                expect.fail(`seed ${String(seed)}: hint advice was refused at step ${String(step)}`);
            }
            state = result.state;
            if (state.status === 'won') break;
            const key = positionKey(state);
            if (seen.has(key)) {
                expect.fail(`seed ${String(seed)}: hint policy repeated a position at step ${String(step)}`);
            }
            seen.add(key);
        }
        expect(state.status).toBe('won');
        expect(state.foundations.map((foundation) => foundation.length)).toEqual([13, 13, 13, 13]);
    });

    it('parses every token form and rejects malformed ones', () => {
        expect(parseLine('d fW f3 W:5>F2 6:2>0 F1:12>4')).toEqual([
            { type: 'draw' },
            { type: 'autoFoundation', from: { pile: 'waste' } },
            { type: 'autoFoundation', from: { pile: 'tableau', col: 3 } },
            { type: 'move', from: { pile: 'waste' }, index: 5, to: { pile: 'foundation', suit: 2 } },
            { type: 'move', from: { pile: 'tableau', col: 6 }, index: 2, to: { pile: 'tableau', col: 0 } },
            { type: 'move', from: { pile: 'foundation', suit: 1 }, index: 12, to: { pile: 'tableau', col: 4 } },
        ]);
        for (const bad of ['f7', 'x', 'X:0>1', '0:1>W', '0:1>', '7:0>1', 'F4:0>1']) {
            expect(() => parseLine(bad), bad).toThrow('malformed token');
        }
    });
});
