import { describe, expect, it } from 'vitest';
import { finishPlan } from '../../../src/domain/assist';
import { cardId } from '../../../src/domain/cards';
import { applyCommand } from '../../../src/domain/engine';
import type { Command, GameEvent, GameState } from '../../../src/domain/types';
import { faceDown, faceUp, foundationsOf, frozenState, tableauOf, vegasAtLimit } from '../../fixtures/states';

const HEARTS = 0;
const DIAMONDS = 1;
const CLUBS = 2;
const SPADES = 3;

const c = cardId;
const DRAW: Command = { type: 'draw' };
const fromCol = (col: 0 | 1 | 2 | 3 | 4 | 5 | 6): Command => ({
    type: 'autoFoundation',
    from: { pile: 'tableau', col },
});
const fromWaste: Command = { type: 'autoFoundation', from: { pile: 'waste' } };

/** Applies `commands` one by one through the engine, insisting that none is refused. */
function replay(original: GameState, commands: readonly Command[]): { state: GameState; events: GameEvent[] } {
    let state = original;
    const events: GameEvent[] = [];
    for (const command of commands) {
        const result = applyCommand(state, command);
        expect(result.events.some((event) => event.type === 'rejected')).toBe(false);
        state = result.state;
        events.push(...result.events);
    }
    return { state, events };
}

/** The plan of `state`, which the test insists exists. */
function planOf(state: GameState) {
    const plan = finishPlan(state);
    expect(plan).toBeDefined();
    if (plan === undefined) throw new Error('expected a finish plan');
    return plan;
}

/** Foundations complete except for the Kings, so a column of Kings is a simple all-ready position. */
const KINGS_MISSING = foundationsOf(12, 12, 12, 12);

/** Hearts and diamonds and clubs each stop at the Jack; the Queens and Kings are all that remain (3 suits, 6 cards). */
const QUEENS_AND_KINGS_MISSING = foundationsOf(11, 11, 11, 13);

/** A Draw 3 talon (stock bottom first) that needs two recycles: the Queen and King of each of three suits. */
const DRAW3_STOCK = [c(HEARTS, 12), c(DIAMONDS, 13), c(CLUBS, 12), c(HEARTS, 13), c(CLUBS, 13), c(DIAMONDS, 12)];

const draw3Position = (partial: Partial<GameState> = {}) =>
    frozenState({
        mode: 'draw3',
        draw: 3,
        foundations: QUEENS_AND_KINGS_MISSING,
        stock: DRAW3_STOCK,
        score: 200,
        ...partial,
    });

describe('finishPlan availability', () => {
    it('is unavailable while any tableau card is face down, and available once it is turned up', () => {
        const foundations = foundationsOf(12, 13, 13, 12);
        const stock = [c(SPADES, 13)];
        const down = frozenState({ foundations, stock, tableau: tableauOf([...faceDown(c(HEARTS, 13))]) });
        const up = frozenState({ foundations, stock, tableau: tableauOf(faceUp(c(HEARTS, 13))) });
        expect(finishPlan(down)).toBeUndefined();
        expect(finishPlan(up)).toBeDefined();
    });

    it('is unavailable when a face-down card sits under face-up ones', () => {
        const state = frozenState({
            foundations: foundationsOf(12, 13, 13, 13),
            tableau: tableauOf([...faceDown(c(SPADES, 7)), ...faceUp(c(HEARTS, 13))]),
        });
        expect(finishPlan(state)).toBeUndefined();
    });

    it('is unavailable once the game is won', () => {
        expect(finishPlan(frozenState({ foundations: foundationsOf(13, 13, 13, 13), status: 'won' }))).toBeUndefined();
    });

    it('is unavailable when nothing can be sent and the talon is empty', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(HEARTS, 2))) });
        expect(finishPlan(state)).toBeUndefined();
    });
});

describe('finishPlan result', () => {
    it('settles on a won position with every foundation at 13', () => {
        const state = frozenState({
            foundations: KINGS_MISSING,
            tableau: tableauOf(faceUp(c(HEARTS, 13)), faceUp(c(DIAMONDS, 13))),
            stock: [c(CLUBS, 13)],
            waste: [c(SPADES, 13)],
        });
        const plan = planOf(state);
        expect(plan.state.status).toBe('won');
        expect(plan.state.foundations.map((foundation) => foundation.length)).toEqual([13, 13, 13, 13]);
        expect(plan.events.at(-1)).toEqual({ type: 'won' });
    });

    it('is replayable from the original position, accepted at every step, to the same state and events', () => {
        const state = frozenState({
            foundations: KINGS_MISSING,
            tableau: tableauOf(faceUp(c(HEARTS, 13))),
            stock: [c(SPADES, 13), c(CLUBS, 13), c(DIAMONDS, 13)],
        });
        const plan = planOf(state);
        const replayed = replay(state, plan.commands);
        expect(replayed.state).toEqual(plan.state);
        expect(replayed.events).toEqual(plan.events);
    });

    it('sends the hearts King from the column first, then draws and sends each stock card', () => {
        const state = frozenState({
            foundations: KINGS_MISSING,
            tableau: tableauOf(faceUp(c(HEARTS, 13))),
            stock: [c(SPADES, 13), c(CLUBS, 13), c(DIAMONDS, 13)],
        });
        expect(planOf(state).commands).toEqual([fromCol(0), DRAW, fromWaste, DRAW, fromWaste, DRAW, fromWaste]);
    });

    it('sends the lowest-ranked ready card first', () => {
        // Column 1 hides a King under the ready Queen; the Queen (rank 12) goes before every ready King (rank 13).
        const state = frozenState({
            foundations: foundationsOf(12, 11, 12, 12),
            tableau: tableauOf(faceUp(c(HEARTS, 13)), faceUp(c(DIAMONDS, 13), c(DIAMONDS, 12)), faceUp(c(CLUBS, 13))),
            waste: [c(SPADES, 13)],
        });
        expect(planOf(state).commands).toEqual([fromCol(1), fromCol(0), fromCol(1), fromCol(2), fromWaste]);
    });

    it('breaks rank ties by canonical source order: columns 0 to 6, then the waste', () => {
        const state = frozenState({
            foundations: KINGS_MISSING,
            tableau: tableauOf([], faceUp(c(CLUBS, 13)), [], [], faceUp(c(DIAMONDS, 13)), [], faceUp(c(HEARTS, 13))),
            waste: [c(SPADES, 13)],
        });
        expect(planOf(state).commands).toEqual([fromCol(1), fromCol(4), fromCol(6), fromWaste]);
    });

    it('does not count foundation sends as moves', () => {
        const state = frozenState({
            foundations: KINGS_MISSING,
            moves: 5,
            tableau: tableauOf(faceUp(c(HEARTS, 13)), faceUp(c(DIAMONDS, 13)), faceUp(c(CLUBS, 13))),
            waste: [c(SPADES, 13)],
        });
        const plan = planOf(state);
        expect(plan.commands).toHaveLength(4);
        expect(plan.state.moves).toBe(5);
    });

    it('never mutates its deep-frozen input', () => {
        const state = draw3Position();
        const snapshot = JSON.stringify(state);
        planOf(state);
        expect(JSON.stringify(state)).toBe(snapshot);
    });

    it('is deterministic', () => {
        const state = draw3Position();
        expect(finishPlan(state)).toEqual(finishPlan(state));
    });
});

describe('finishPlan through the talon', () => {
    it('counts the draws and recycles it applies as moves, and nothing else', () => {
        const plan = planOf(draw3Position({ moves: 10 }));
        // D D S R D S D R D S S S D S: six draws and two recycles are moves; the six sends are not.
        expect(plan.commands).toHaveLength(14);
        expect(plan.state.moves).toBe(18);
    });

    it('carries the ordinary Standard Draw 3 recycle charge and the advanced pass count', () => {
        // Recycles begin passes 4 and 5, each -20; six waste-to-foundation sends add 60 to the starting 200.
        const plan = planOf(draw3Position({ passes: 3 }));
        expect(plan.state.passes).toBe(5);
        expect(plan.state.score).toBe(200 + 60 - 2 * 20);
    });

    it('charges nothing for recycles that begin the second and third pass', () => {
        const plan = planOf(draw3Position({ passes: 1 }));
        expect(plan.state.passes).toBe(3);
        expect(plan.state.score).toBe(200 + 60);
    });

    it('replays to the same state and events when the plan recycles', () => {
        const state = draw3Position({ passes: 3 });
        const plan = planOf(state);
        const replayed = replay(state, plan.commands);
        expect(replayed.state).toEqual(plan.state);
        expect(replayed.events).toEqual(plan.events);
        expect(replayed.events.filter((event) => event.type === 'recycled')).toEqual([
            { type: 'recycled', pass: 4 },
            { type: 'recycled', pass: 5 },
        ]);
    });

    it('recycles from part-way through a pass to reach a card below the waste top, and wins', () => {
        // The stock holds only the King of diamonds and the waste top is the King of hearts: neither can be played.
        // The Queens lie deeper in the waste, so the plan draws out the stock, recycles, and then reaches them.
        const state = frozenState({
            foundations: foundationsOf(11, 11, 13, 13),
            stock: [c(DIAMONDS, 13)],
            waste: [c(HEARTS, 12), c(DIAMONDS, 12), c(HEARTS, 13)],
            score: 200,
        });
        const plan = planOf(state);
        expect(plan.commands).toEqual([DRAW, DRAW, DRAW, fromWaste, DRAW, fromWaste, DRAW, fromWaste, DRAW, fromWaste]);
        expect(plan.state.status).toBe('won');
        expect(plan.state.passes).toBe(2);
        expect(plan.state.moves).toBe(6);
        expect(plan.state.score).toBe(200 - 100 + 4 * 10);
    });

    it('recycles from part-way through a Draw 3 pass whose seven-card talon does not divide into threes', () => {
        // Turning over as many cards as the talon holds ends the plan one draw before the Jack of hearts appears
        // after the recycle; only the recycle count shows that pass is still unfinished.
        const state = frozenState({
            draw: 3,
            foundations: foundationsOf(10, 13, 9, 13),
            stock: [c(HEARTS, 13), c(HEARTS, 11), c(CLUBS, 11), c(CLUBS, 10), c(HEARTS, 12)],
            waste: [c(CLUBS, 13), c(CLUBS, 12)],
        });
        const plan = planOf(state);
        expect(plan.state.status).toBe('won');
        expect(plan.state.foundations.every((foundation) => foundation.length === 13)).toBe(true);
        expect(replay(state, plan.commands).state).toEqual(plan.state);
    });

    it('has no plan when the stock cycles without any card being playable, and terminates', () => {
        // Each Ace is buried under a card its foundation cannot take, and the talon is no help.
        const tableau = tableauOf(faceUp(c(SPADES, 1), c(HEARTS, 2)), faceUp(c(HEARTS, 1), c(SPADES, 2)));
        expect(finishPlan(frozenState({ tableau, stock: [c(CLUBS, 3)] }))).toBeUndefined();
        expect(
            finishPlan(frozenState({ tableau, stock: [c(CLUBS, 3), c(CLUBS, 4)], waste: [c(CLUBS, 5)] })),
        ).toBeUndefined();
        expect(
            finishPlan(
                draw3Position({ foundations: foundationsOf(11, 13, 13, 13), stock: [c(HEARTS, 13), c(HEARTS, 12)] }),
            ),
        ).toBeUndefined();
    });

    it('has no plan for a Vegas game at its pass limit that needs another recycle', () => {
        const waste = [c(DIAMONDS, 12), c(DIAMONDS, 13)];
        const foundations = foundationsOf(13, 11, 13, 13);
        expect(finishPlan(vegasAtLimit({ draw: 1, foundations, waste }))).toBeUndefined();
        // One pass earlier the same position can still be finished.
        expect(finishPlan(vegasAtLimit({ draw: 1, foundations, waste, passes: 2 }))?.state.status).toBe('won');
    });

    it('draws out a Vegas stock at the pass limit when no recycle is needed', () => {
        const plan = planOf(
            vegasAtLimit({ draw: 1, foundations: foundationsOf(13, 12, 13, 13), stock: [c(DIAMONDS, 13)] }),
        );
        expect(plan.commands).toEqual([DRAW, fromWaste]);
    });
});
