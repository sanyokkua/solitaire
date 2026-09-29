import type { GameState, Mode } from '../domain/types';
import { solverHint, type SolverHint } from './hint';
import type { Grade } from './grading';
import { findWinnable, type Outcome, type Selection, type Spare } from './winnable';

/** What the worker is asked to do; each request carries everything it needs and an `id` its replies echo (D6). */
export type SolverRequest =
    | {
          readonly id: number;
          readonly type: 'findWinnable';
          readonly seeds: readonly number[];
          readonly budget: number;
          readonly mode: Mode;
          /** Absent selects any proven deal. */
          readonly selection?: Selection;
          /** Verdicts already established at this budget; those seeds are not searched again. */
          readonly known?: readonly Outcome[];
      }
    | { readonly id: number; readonly type: 'hint'; readonly state: GameState; readonly budget: number };

/** What the worker posts back: `progress` as each attempt starts (D4), then one final reply per request (D6). */
export type SolverResponse =
    | { readonly id: number; readonly type: 'progress'; readonly attempt: number }
    | { readonly id: number; readonly type: 'outcome'; readonly outcome: Outcome }
    | {
          readonly id: number;
          readonly type: 'findWinnable';
          readonly seed: number;
          readonly verdict: 'win' | 'random';
          readonly attempts: number;
          readonly grade: Grade | undefined;
          readonly spares: readonly Spare[];
      }
    | { readonly id: number; readonly type: 'hint'; readonly hint: SolverHint | undefined };

/**
 * Runs one request and posts its messages through `post`, in order: a `findWinnable` request posts `progress` as each
 * attempt starts, an `outcome` for each seed it really searched (not the `known` ones) and then its reply; a `hint` request posts its single reply, whose `hint` key is always present
 * (`undefined` when the solver offers none). Every message carries the request's `id`. Keeps no state between calls,
 * so the same request always posts the same messages, and touches no worker global: the worker entry supplies `post`.
 * Propagates what `findWinnable` and `solverHint` throw (an empty `seeds`, for one).
 */
export function handleRequest(request: SolverRequest, post: (response: SolverResponse) => void): void {
    const { id } = request;
    switch (request.type) {
        case 'findWinnable': {
            const { selection, known } = request;
            const { seed, verdict, attempts, grade, spares } = findWinnable(
                request.seeds,
                request.budget,
                request.mode,
                {
                    selection,
                    known,
                    onAttempt: (attempt) => {
                        post({ id, type: 'progress', attempt });
                    },
                    onOutcome: (outcome) => {
                        post({ id, type: 'outcome', outcome });
                    },
                },
            );
            post({ id, type: 'findWinnable', seed, verdict, attempts, grade, spares });
            return;
        }
        case 'hint':
            post({ id, type: 'hint', hint: solverHint(request.state, request.budget) });
            return;
    }
}
