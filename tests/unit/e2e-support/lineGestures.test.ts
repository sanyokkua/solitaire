import { describe, expect, it } from 'vitest';
import { SUITS } from '../../../src/domain/cards';
import { WINNING_LINE, parseLine } from '../../fixtures/deals';
import { PILE_ORDER, horizontalKey, planCommand, verticalKey } from '../../e2e/support/lineGestures';

const commands = parseLine(WINNING_LINE.line);

describe('planCommand', () => {
    it('plans a waste move to a column', () => {
        const command = parseLine('W:7>4')[0];
        expect(command && planCommand(command)).toEqual({ kind: 'move', from: 'waste', index: 7, to: 'tableau:4' });
    });

    it('plans a seven-card run from the bottom of a column', () => {
        const command = parseLine('2:0>5')[0];
        expect(command && planCommand(command)).toEqual({
            kind: 'move',
            from: 'tableau:2',
            index: 0,
            to: 'tableau:5',
        });
    });

    it('plans a foundation target by suit', () => {
        const command = parseLine('4:1>F3')[0];
        expect(command && planCommand(command)).toEqual({
            kind: 'move',
            from: 'tableau:4',
            index: 1,
            to: 'foundation:3',
        });
    });

    it('plans a draw, and a recycle is the same draw plan', () => {
        expect(planCommand({ type: 'draw' })).toEqual({ kind: 'draw' });
        const draws = commands.filter((command) => command.type === 'draw').map((command) => planCommand(command));
        expect(draws).toHaveLength(34);
        expect(new Set(draws.map((plan) => plan.kind))).toEqual(new Set(['draw']));
    });

    it('refuses an autoFoundation command with a clear message', () => {
        const command = parseLine('f3')[0];
        expect(command).toBeDefined();
        expect(() => {
            if (command) planCommand(command);
        }).toThrow(/autoFoundation/);
    });

    it('plans every command of the winning line', () => {
        expect(commands.map((command) => planCommand(command))).toHaveLength(WINNING_LINE.moves);
    });
});

describe('PILE_ORDER', () => {
    it('lists stock, waste, the foundations in display order, then the columns', () => {
        expect(PILE_ORDER).toEqual([
            'stock',
            'waste',
            `foundation:${String(SUITS[0])}`,
            `foundation:${String(SUITS[2])}`,
            `foundation:${String(SUITS[1])}`,
            `foundation:${String(SUITS[3])}`,
            'tableau:0',
            'tableau:1',
            'tableau:2',
            'tableau:3',
            'tableau:4',
            'tableau:5',
            'tableau:6',
        ]);
    });
});

describe('horizontalKey', () => {
    it('presses ArrowRight towards a later pile and ArrowLeft towards an earlier one', () => {
        expect(horizontalKey('stock', 'tableau:2')).toBe('ArrowRight');
        expect(horizontalKey('tableau:6', 'foundation:2')).toBe('ArrowLeft');
        expect(horizontalKey('foundation:0', 'foundation:2')).toBe('ArrowRight');
        expect(horizontalKey('foundation:1', 'foundation:2')).toBe('ArrowLeft');
    });

    it('is null at the target', () => {
        expect(horizontalKey('waste', 'waste')).toBeNull();
    });
});

describe('verticalKey', () => {
    it('presses ArrowDown towards a higher index and ArrowUp towards a lower one', () => {
        expect(verticalKey(0, 3)).toBe('ArrowDown');
        expect(verticalKey(5, 1)).toBe('ArrowUp');
    });

    it('is null at the target', () => {
        expect(verticalKey(2, 2)).toBeNull();
    });
});
