import { describe, expect, it } from 'vitest';
import type { Hint, MoveHint } from '../../../src/domain/hint';
import type { SolverHint } from '../../../src/solver/hint';

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const solverHintIsDerivedFromHint: Equal<SolverHint, Omit<MoveHint, 'priority'> | Exclude<Hint, MoveHint>> = true;

describe('SolverHint type', () => {
    it('is the domain Hint without the heuristic priority', () => {
        expect(solverHintIsDerivedFromHint).toBe(true);
    });

    it('accepts draw and recycle hints', () => {
        const draw: SolverHint = { kind: 'draw' };
        const recycle: SolverHint = { kind: 'recycle' };
        expect([draw.kind, recycle.kind]).toEqual(['draw', 'recycle']);
    });

    it('accepts every domain Hint', () => {
        const fromDomain = (hint: Hint): SolverHint => hint;
        expect(fromDomain({ kind: 'draw' })).toEqual({ kind: 'draw' });
    });
});
