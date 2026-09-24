import type { GameState } from '../domain/types';
import { solverHint, type SolverHint } from './hint';
import { findWinnable } from './winnable';

/** What the worker is asked to do; each request carries everything it needs and an `id` its replies echo (D6). */
export type SolverRequest =
    | { readonly id: number; readonly type: 'findWinnable'; readonly seeds: readonly number[]; readonly budget: number }
    | { readonly id: number; readonly type: 'hint'; readonly state: GameState; readonly budget: number };

/** What the worker posts back: `progress` as each attempt starts (D4), then one final reply per request (D6). */
export type SolverResponse =
    | { readonly id: number; readonly type: 'progress'; readonly attempt: number }
    | {
          readonly id: number;
          readonly type: 'findWinnable';
          readonly seed: number;
          readonly verdict: 'win' | 'random';
          readonly attempts: number;
      }
    | { readonly id: number; readonly type: 'hint'; readonly hint: SolverHint | undefined };

/**
 * Runs one request and posts its messages through `post`, in order: a `findWinnable` request posts `progress` as each
 * attempt starts and then its reply; a `hint` request posts its single reply, whose `hint` key is always present
 * (`undefined` when the solver offers none). Every message carries the request's `id`. Keeps no state between calls,
 * so the same request always posts the same messages, and touches no worker global: the worker entry supplies `post`.
 * Propagates what `findWinnable` and `solverHint` throw (an empty `seeds`, for one).
 */
export function handleRequest(request: SolverRequest, post: (response: SolverResponse) => void): void {
    const { id } = request;
    switch (request.type) {
        case 'findWinnable': {
            const { seed, verdict, attempts } = findWinnable(request.seeds, request.budget, (attempt) => {
                post({ id, type: 'progress', attempt });
            });
            post({ id, type: 'findWinnable', seed, verdict, attempts });
            return;
        }
        case 'hint':
            post({ id, type: 'hint', hint: solverHint(request.state, request.budget) });
            return;
    }
}
