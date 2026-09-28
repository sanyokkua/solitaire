import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command } from '../../../src/domain/types';
import { solverHint } from '../../../src/solver/hint';
import { solve } from '../../../src/solver/solver';
import { makeState } from '../../fixtures/states';

vi.mock('../../../src/solver/solver', () => ({ solve: vi.fn() }));

/** Makes the mocked `solve` report a win whose line is exactly `line`. */
function stubLine(line: readonly Command[]): void {
    vi.mocked(solve).mockReturnValue({ verdict: 'win', nodes: 1, line });
}

describe('solverHint defensive errors', () => {
    beforeEach(() => {
        vi.mocked(solve).mockReset();
    });

    it('throws when the first move has no movable group at its source', () => {
        stubLine([{ type: 'move', from: { pile: 'tableau', col: 0 }, index: 0, to: { pile: 'foundation', suit: 0 } }]);
        expect(() => solverHint(makeState(), 1)).toThrow(
            'solver line starts with a move whose source holds no movable group',
        );
    });

    it('throws when the first command is an autoFoundation', () => {
        stubLine([{ type: 'autoFoundation', from: { pile: 'waste' } }]);
        expect(() => solverHint(makeState(), 1)).toThrow(
            'solver line starts with an unexpected autoFoundation command',
        );
    });
});
