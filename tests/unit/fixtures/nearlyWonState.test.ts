import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../src/domain/engine';
import { WINNING_LINE, nearlyWonState, parseLine } from '../../fixtures/deals';

describe('nearlyWonState', () => {
    it('is a started game in progress that the last command of the winning line wins', () => {
        const state = nearlyWonState();
        const last = parseLine(WINNING_LINE.line).at(-1);
        if (last === undefined) throw new Error('the winning line is empty');

        expect(state.started).toBe(true);
        expect(state.status).toBe('playing');
        expect(state.moves).toBe(WINNING_LINE.moves - 1);

        const result = applyCommand(state, last);

        expect(result.events.find((event) => event.type === 'rejected')).toBeUndefined();
        expect(result.state.status).toBe('won');
        expect(result.state.moves).toBe(WINNING_LINE.moves);
    });
});
