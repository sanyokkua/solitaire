import { describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../../src/domain/deal';
import { applyCommand } from '../../../src/domain/engine';
import { DRAW3_LINE, DAILY_LINE, VEGAS_LINE, WINNING_LINE, parseLine, type WinningLine } from '../../fixtures/deals';
import { DAILY_GOLDEN } from '../../fixtures/dailyGolden';
import { deepFreeze } from '../../fixtures/states';

const LINES: readonly (readonly [string, WinningLine])[] = [
    ['Draw 1', WINNING_LINE],
    ['Draw 3', DRAW3_LINE],
    ['Vegas', VEGAS_LINE],
    ['Daily', DAILY_LINE],
];

describe('the pinned winning lines', () => {
    it.each(LINES)('%s replays on its deal without a refusal and ends won', (_name, fixture) => {
        const commands = parseLine(fixture.line);
        expect(commands).toHaveLength(fixture.moves); // every token is a counted move, draws included

        let state = deepFreeze(dealFromSeed(fixture.seed, fixture.mode));
        commands.forEach((command, step) => {
            const result = applyCommand(state, command);
            const refused = result.events.find((event) => event.type === 'rejected');
            expect(refused, `step ${String(step)} was refused`).toBeUndefined();
            state = result.state;
        });

        expect(state.status).toBe('won');
        expect(state.foundations.map((foundation) => foundation.length)).toEqual([13, 13, 13, 13]);
        expect(state.moves).toBe(fixture.moves);
        expect(state.score).toBe(fixture.score);
        expect(state.passes).toBe(fixture.passes);
    });

    it.each(LINES)('%s never takes a card back from a foundation', (_name, fixture) => {
        const back = parseLine(fixture.line).filter(
            (command) => command.type === 'move' && command.from.pile === 'foundation',
        );
        expect(back).toEqual([]);
    });

    it('are recorded in the mode they are played in', () => {
        expect(DRAW3_LINE.mode).toBe('draw3');
        expect(VEGAS_LINE.mode).toBe('vegas');
        expect(DAILY_LINE.mode).toBe('daily');
    });

    it('ends the Vegas line on the bank that five per card from the starting bank gives', () => {
        expect(VEGAS_LINE.score).toBe(-52 + 52 * 5);
        expect(VEGAS_LINE.passes).toBeLessThanOrEqual(3);
    });

    it('takes the Daily line from a golden date whose first candidate is the winning seed', () => {
        const golden = DAILY_GOLDEN.find((entry) => entry.day === DAILY_LINE.day);
        expect(golden?.seed).toBe(DAILY_LINE.seed);
        expect(golden?.attempts).toBe(1);
    });
});
