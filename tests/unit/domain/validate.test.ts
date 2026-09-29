import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { dealFromSeed } from '../../../src/domain/deal';
import { applyCommand } from '../../../src/domain/engine';
import type { GameState } from '../../../src/domain/types';
import { isValidGameState } from '../../../src/domain/validate';
import { DEAL_FIXTURES, WINNING_LINE, parseLine } from '../../fixtures/deals';
import { deepFreeze, foundationsOf, makeState } from '../../fixtures/states';

/** Returns `value`, or throws if it is undefined — keeps test bodies free of non-null assertions. */
function defined<T>(value: T | undefined, message: string): T {
    if (value === undefined) throw new Error(message);
    return value;
}

describe('isValidGameState', () => {
    // A valid, fully-dealt state, and a valid, fully-won state — the two bases every rejection test mutates.
    const base = dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode);
    const won = makeState({ foundations: foundationsOf(13, 13, 13, 13), status: 'won' });

    describe('accepts every fixture deal and every position of the winning line', () => {
        it.each(DEAL_FIXTURES)('$name', ({ seed, mode }) => {
            expect(isValidGameState(dealFromSeed(seed, mode))).toBe(true);
        });

        it('accepts the winning line deal at every step, including the final won position', () => {
            const { seed, mode, line } = WINNING_LINE;
            let state = deepFreeze(dealFromSeed(seed, mode));
            expect(isValidGameState(state)).toBe(true);
            for (const command of parseLine(line)) {
                state = applyCommand(state, command).state;
                expect(isValidGameState(state)).toBe(true);
            }
            expect(state.status).toBe('won');
        });

        it('accepts a state whose foundations alone make up a won game', () => {
            expect(isValidGameState(won)).toBe(true);
        });
    });

    describe('rejects one broken field at a time', () => {
        it('accepts the valid base state as a sanity check', () => {
            expect(isValidGameState(base)).toBe(true);
        });

        it('rejects a duplicated card', () => {
            const duplicate = defined(base.tableau[0][0], 'column 0 has no card at row 0').id;
            const mutated: GameState = { ...base, stock: [duplicate, ...base.stock.slice(1)] };
            expect(isValidGameState(mutated)).toBe(false);
        });

        it('rejects a missing card', () => {
            const mutated: GameState = { ...base, stock: base.stock.slice(1) };
            expect(isValidGameState(mutated)).toBe(false);
        });

        it('rejects a sparse stock', () => {
            const stock: unknown[] = [...base.stock];
            // eslint-disable-next-line @typescript-eslint/no-array-delete -- a hole is the point of this test
            delete stock[1];
            expect(isValidGameState({ ...base, stock })).toBe(false);
        });

        it('rejects a tableau with a missing column', () => {
            const tableau: unknown[] = [...base.tableau];
            // eslint-disable-next-line @typescript-eslint/no-array-delete -- a hole is the point of this test
            delete tableau[6];
            expect(isValidGameState({ ...base, tableau })).toBe(false);
        });

        it('rejects an off-suit foundation card', () => {
            const foundations: GameState['foundations'] = [
                [cardId(1, 1), ...won.foundations[0].slice(1)],
                [cardId(0, 1), ...won.foundations[1].slice(1)],
                won.foundations[2],
                won.foundations[3],
            ];
            expect(isValidGameState({ ...won, foundations })).toBe(false);
        });

        it('rejects a foundation that does not start at the ace', () => {
            const ace = defined(won.foundations[0][0], 'foundation 0 has no ace');
            const foundations: GameState['foundations'] = [
                [...won.foundations[0].slice(1), ace],
                won.foundations[1],
                won.foundations[2],
                won.foundations[3],
            ];
            expect(isValidGameState({ ...won, foundations })).toBe(false);
        });

        it('rejects a face-down card above a face-up card', () => {
            // Deal column 1 has exactly two cards: row 0 face-down, row 1 (the top) face-up.
            const col = base.tableau[1];
            const bottom = defined(col[0], 'column 1 has no card at row 0');
            const top = defined(col[1], 'column 1 has no card at row 1');
            const mutated: GameState = {
                ...base,
                tableau: base.tableau.map((c, i) =>
                    i === 1
                        ? [
                              { id: bottom.id, up: true },
                              { id: top.id, up: false },
                          ]
                        : c,
                ) as unknown as GameState['tableau'],
            };
            expect(isValidGameState(mutated)).toBe(false);
        });

        it('rejects a mode/draw/scoring mismatch', () => {
            expect(isValidGameState({ ...base, draw: 3 })).toBe(false);
            expect(isValidGameState({ ...base, scoring: 'vegas' })).toBe(false);
        });

        it('rejects passes: 0', () => {
            expect(isValidGameState({ ...base, passes: 0 })).toBe(false);
        });

        it.each([-1, 1.5, 2 ** 32])('rejects a seed of %s', (seed) => {
            expect(isValidGameState({ ...base, seed })).toBe(false);
        });

        it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects an elapsedMs of %s', (elapsedMs) => {
            expect(isValidGameState({ ...base, elapsedMs })).toBe(false);
        });

        it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects an undos count of %s', (undos) => {
            expect(isValidGameState({ ...base, undos })).toBe(false);
        });

        it('rejects a Vegas game past its pass limit and accepts it at the limit', () => {
            const vegas = dealFromSeed(WINNING_LINE.seed, 'vegas');
            expect(isValidGameState({ ...vegas, passes: 3 })).toBe(true);
            expect(isValidGameState({ ...vegas, passes: 4 })).toBe(false);
        });

        it.each(['draw1', 'draw3', 'daily'] as const)('accepts %s at pass 50, as no pass limit applies', (mode) => {
            expect(isValidGameState({ ...dealFromSeed(WINNING_LINE.seed, mode), passes: 50 })).toBe(true);
        });

        describe('the grade', () => {
            const won = { verdict: 'win', attempts: 1 } as const;

            it('accepts no grade for a proven-winnable deal and for a random one', () => {
                expect(isValidGameState({ ...base, ...won, grade: null })).toBe(true);
                expect(isValidGameState({ ...base, verdict: 'random', grade: null })).toBe(true);
            });

            it.each(['easy', 'medium', 'hard'] as const)('accepts a %s grade on a proven-winnable deal', (grade) => {
                expect(isValidGameState({ ...base, ...won, grade })).toBe(true);
            });

            it('accepts a graded proven-winnable deal at every fixture', () => {
                for (const { seed, mode } of DEAL_FIXTURES) {
                    expect(isValidGameState(dealFromSeed(seed, mode, { verdict: 'win', grade: 'medium' }))).toBe(true);
                }
            });

            it('rejects a grade with the verdict random', () => {
                expect(isValidGameState({ ...base, verdict: 'random', grade: 'medium' })).toBe(false);
            });

            it.each(['', 'expert', 'Medium', 1, undefined, true, {}])('rejects the unknown grade %j', (grade) => {
                expect(isValidGameState({ ...base, ...won, grade })).toBe(false);
            });

            it('rejects a state with no grade key', () => {
                const withoutGrade: Record<string, unknown> = { ...base };
                delete withoutGrade.grade;
                expect(isValidGameState(withoutGrade)).toBe(false);
            });
        });

        it('rejects an unknown status', () => {
            expect(isValidGameState({ ...base, status: 'paused' })).toBe(false);
        });

        it('rejects status won with cards still off the foundations', () => {
            expect(isValidGameState({ ...base, status: 'won' })).toBe(false);
        });
    });

    describe('rejects arbitrary values without throwing', () => {
        it.each([null, 42, [], {}])('rejects %s', (value) => {
            expect(() => isValidGameState(value)).not.toThrow();
            expect(isValidGameState(value)).toBe(false);
        });

        it('rejects an object missing tableau', () => {
            const rest: Record<string, unknown> = { ...base };
            delete rest.tableau;
            expect(isValidGameState(rest)).toBe(false);
        });

        it('never throws for a value whose property access throws', () => {
            const hostile: unknown = {
                get tableau(): never {
                    throw new Error('boom');
                },
            };
            expect(() => isValidGameState(hostile)).not.toThrow();
            expect(isValidGameState(hostile)).toBe(false);
        });
    });
});
