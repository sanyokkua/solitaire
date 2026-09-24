import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { applyCommand } from '../../../src/domain/engine';
import type {
    CardId,
    Column,
    Command,
    Foundations,
    GameState,
    Pile,
    PileRef,
    RejectReason,
    Suit,
    Tableau,
    TableauCol,
} from '../../../src/domain/types';
import { deepFreeze, faceDown, faceUp, makeState } from '../../fixtures/states';

const HEARTS = 0;
const DIAMONDS = 1;
const CLUBS = 2;
const SPADES = 3;

const tableauRef = (col: TableauCol): PileRef => ({ pile: 'tableau', col });
const foundationRef = (suit: Suit): PileRef => ({ pile: 'foundation', suit });
const WASTE: PileRef = { pile: 'waste' };
const STOCK: PileRef = { pile: 'stock' };

const move = (from: PileRef, index: number, to: PileRef): Command => ({ type: 'move', from, index, to });
const auto = (from: PileRef): Command => ({ type: 'autoFoundation', from });
const DRAW: Command = { type: 'draw' };

/** A tableau with the given columns first (bottom column first) and the rest empty. */
function tab(...cols: Column[]): Tableau {
    const [a = [], b = [], c = [], d = [], e = [], f = [], g = []] = cols;
    return [a, b, c, d, e, f, g];
}

function found(a: Pile = [], b: Pile = [], c: Pile = [], d: Pile = []): Foundations {
    return [a, b, c, d];
}

/** Ace up to `top` (inclusive) of a suit. */
const suitRun = (suit: Suit, top: number): Pile => Array.from({ length: top }, (_, i) => suit * 13 + i);

/** Three complete suits and spades built up to the queen; the king of spades is the winning card. */
const NEARLY_WON_FOUNDATIONS: Foundations = found(
    suitRun(HEARTS, 13),
    suitRun(DIAMONDS, 13),
    suitRun(CLUBS, 13),
    suitRun(SPADES, 12),
);
const KING_OF_SPADES = cardId(SPADES, 13);

const nearlyWon = (partial: Partial<GameState> = {}): GameState =>
    deepFreeze(makeState({ foundations: NEARLY_WON_FOUNDATIONS, ...partial }));

const wonState = (): GameState =>
    deepFreeze(
        makeState({
            status: 'won',
            foundations: found(suitRun(HEARTS, 13), suitRun(DIAMONDS, 13), suitRun(CLUBS, 13), suitRun(SPADES, 13)),
        }),
    );

interface Rejection {
    readonly name: string;
    readonly state: GameState;
    readonly command: Command;
    readonly reason: RejectReason;
}

const SIX_OF_HEARTS = cardId(HEARTS, 6);
const SEVEN_OF_SPADES = cardId(SPADES, 7);
const EIGHT_OF_DIAMONDS = cardId(DIAMONDS, 8);
const ACE_OF_HEARTS = cardId(HEARTS, 1);

const wasteTwo: readonly CardId[] = [ACE_OF_HEARTS, SIX_OF_HEARTS];

const REJECTIONS: readonly Rejection[] = [
    ...(['draw', 'move', 'autoFoundation'] as const).map((kind): Rejection => ({
        name: `${kind} after the win`,
        state: wonState(),
        command: kind === 'draw' ? DRAW : kind === 'move' ? move(tableauRef(0), 0, tableauRef(1)) : auto(tableauRef(0)),
        reason: 'game-over',
    })),
    {
        name: 'a face-down card',
        state: deepFreeze(makeState({ tableau: tab([...faceDown(cardId(CLUBS, 2)), ...faceUp(SIX_OF_HEARTS)]) })),
        command: move(tableauRef(0), 0, tableauRef(1)),
        reason: 'not-movable',
    },
    {
        name: 'a non-run',
        state: deepFreeze(
            makeState({ tableau: tab(faceUp(SEVEN_OF_SPADES, cardId(DIAMONDS, 2)), faceUp(EIGHT_OF_DIAMONDS)) }),
        ),
        command: move(tableauRef(0), 0, tableauRef(1)),
        reason: 'not-movable',
    },
    {
        name: 'an index past the column',
        state: deepFreeze(makeState({ tableau: tab(faceUp(SIX_OF_HEARTS), faceUp(cardId(SPADES, 7))) })),
        command: move(tableauRef(0), 99, tableauRef(1)),
        reason: 'not-movable',
    },
    {
        name: 'a negative index',
        state: deepFreeze(makeState({ tableau: tab(faceUp(SIX_OF_HEARTS), faceUp(cardId(SPADES, 7))) })),
        command: move(tableauRef(0), -1, tableauRef(1)),
        reason: 'not-movable',
    },
    {
        name: 'the stock as a source',
        state: deepFreeze(makeState({ stock: [ACE_OF_HEARTS] })),
        command: move(STOCK, 0, foundationRef(HEARTS)),
        reason: 'not-movable',
    },
    {
        name: 'a non-top waste card',
        state: deepFreeze(makeState({ waste: wasteTwo })),
        command: move(WASTE, 0, foundationRef(HEARTS)),
        reason: 'not-movable',
    },
    {
        name: 'a non-top foundation card',
        state: deepFreeze(makeState({ foundations: found([ACE_OF_HEARTS, cardId(HEARTS, 2)]) })),
        command: move(foundationRef(HEARTS), 0, tableauRef(0)),
        reason: 'not-movable',
    },
    {
        name: 'autoFoundation from the stock',
        state: deepFreeze(makeState({ stock: [ACE_OF_HEARTS] })),
        command: auto(STOCK),
        reason: 'not-movable',
    },
    {
        name: 'autoFoundation from a foundation',
        state: deepFreeze(makeState({ foundations: found([ACE_OF_HEARTS]) })),
        command: auto(foundationRef(HEARTS)),
        reason: 'not-movable',
    },
    {
        name: 'autoFoundation from an empty column',
        state: deepFreeze(makeState()),
        command: auto(tableauRef(1)),
        reason: 'not-movable',
    },
    {
        name: 'autoFoundation from an empty waste',
        state: deepFreeze(makeState()),
        command: auto(WASTE),
        reason: 'not-movable',
    },
    {
        name: 'autoFoundation from a column whose top card is face down',
        state: deepFreeze(makeState({ tableau: tab(faceDown(ACE_OF_HEARTS)) })),
        command: auto(tableauRef(0)),
        reason: 'not-movable',
    },
    {
        name: 'a drop that does not fit',
        state: deepFreeze(makeState({ tableau: tab(faceUp(SIX_OF_HEARTS), faceUp(EIGHT_OF_DIAMONDS)) })),
        command: move(tableauRef(0), 0, tableauRef(1)),
        reason: 'illegal-target',
    },
    {
        name: 'a drop on the source column',
        state: deepFreeze(makeState({ tableau: tab(faceUp(SIX_OF_HEARTS)) })),
        command: move(tableauRef(0), 0, tableauRef(0)),
        reason: 'illegal-target',
    },
    {
        name: 'a foundation-to-foundation move',
        state: deepFreeze(makeState({ foundations: found([ACE_OF_HEARTS]) })),
        command: move(foundationRef(HEARTS), 0, foundationRef(DIAMONDS)),
        reason: 'illegal-target',
    },
    {
        name: 'a drop on the stock',
        state: deepFreeze(makeState({ waste: [ACE_OF_HEARTS] })),
        command: move(WASTE, 0, STOCK),
        reason: 'illegal-target',
    },
    {
        name: 'a drop on the waste',
        state: deepFreeze(makeState({ tableau: tab(faceUp(SIX_OF_HEARTS)) })),
        command: move(tableauRef(0), 0, WASTE),
        reason: 'illegal-target',
    },
    {
        name: 'a drop on the source waste',
        state: deepFreeze(makeState({ waste: [ACE_OF_HEARTS] })),
        command: move(WASTE, 0, WASTE),
        reason: 'illegal-target',
    },
    {
        name: 'a drop on the source foundation',
        state: deepFreeze(makeState({ foundations: found([ACE_OF_HEARTS]) })),
        command: move(foundationRef(HEARTS), 0, foundationRef(HEARTS)),
        reason: 'illegal-target',
    },
    {
        name: 'a Vegas recycle on pass 3',
        state: deepFreeze(
            makeState({ mode: 'vegas', scoring: 'vegas', draw: 3, passes: 3, stock: [], waste: [ACE_OF_HEARTS] }),
        ),
        command: DRAW,
        reason: 'pass-limit',
    },
    {
        name: 'a draw with the stock and the waste both empty',
        state: deepFreeze(makeState()),
        command: DRAW,
        reason: 'nothing-to-draw',
    },
    {
        name: 'autoFoundation with no fitting foundation',
        state: deepFreeze(makeState({ tableau: tab(faceUp(cardId(HEARTS, 5))) })),
        command: auto(tableauRef(0)),
        reason: 'illegal-target',
    },
];

/** Every rejection reason; the literal must name each member of the union and nothing else. */
const ALL_REASONS: Readonly<Record<RejectReason, true>> = {
    'game-over': true,
    'not-movable': true,
    'illegal-target': true,
    'pass-limit': true,
    'nothing-to-draw': true,
};

describe('refusals', () => {
    it.each(REJECTIONS.map((row) => [row.name, row] as const))(
        '%s is refused with the same state and one rejected event',
        (_name, row) => {
            const result = applyCommand(row.state, row.command);
            expect(result.state).toBe(row.state);
            expect(result.events).toEqual([{ type: 'rejected', reason: row.reason }]);
        },
    );

    it('produces every rejection reason and no other value', () => {
        const produced = new Set(
            REJECTIONS.map((row) => {
                const event = applyCommand(row.state, row.command).events[0];
                return event?.type === 'rejected' ? event.reason : undefined;
            }),
        );
        expect(produced).toEqual(new Set(Object.keys(ALL_REASONS)));
    });

    it('leaves started false after a refusal', () => {
        const state = deepFreeze(makeState({ tableau: tab(faceUp(SIX_OF_HEARTS), faceUp(EIGHT_OF_DIAMONDS)) }));
        const result = applyCommand(state, move(tableauRef(0), 0, tableauRef(1)));
        expect(result.state).toBe(state);
        expect(result.state.started).toBe(false);
    });
});

describe('move', () => {
    it('moves a run, emitting moved with the cards and both piles, and counts one move', () => {
        const state = deepFreeze(
            makeState({
                moves: 7,
                tableau: tab(
                    faceUp(SEVEN_OF_SPADES, SIX_OF_HEARTS),
                    faceUp(EIGHT_OF_DIAMONDS),
                    faceUp(cardId(CLUBS, 13)),
                ),
            }),
        );
        const result = applyCommand(state, move(tableauRef(0), 0, tableauRef(1)));

        expect(result.events).toEqual([
            { type: 'moved', cards: [SEVEN_OF_SPADES, SIX_OF_HEARTS], from: tableauRef(0), to: tableauRef(1) },
        ]);
        expect(result.state.moves).toBe(8);
        expect(result.state.tableau[0]).toEqual([]);
        expect(result.state.tableau[1]).toEqual(faceUp(EIGHT_OF_DIAMONDS, SEVEN_OF_SPADES, SIX_OF_HEARTS));
        expect(result.state.score).toBe(0);
    });

    it('leaves untouched columns and piles reference-identical', () => {
        const state = deepFreeze(
            makeState({
                tableau: tab(
                    faceUp(SEVEN_OF_SPADES, SIX_OF_HEARTS),
                    faceUp(EIGHT_OF_DIAMONDS),
                    faceUp(cardId(CLUBS, 13)),
                ),
                stock: [cardId(CLUBS, 1)],
                waste: [cardId(CLUBS, 2)],
            }),
        );
        const { state: next } = applyCommand(state, move(tableauRef(0), 0, tableauRef(1)));

        expect(next.tableau[2]).toBe(state.tableau[2]);
        expect(next.tableau[3]).toBe(state.tableau[3]);
        expect(next.foundations).toBe(state.foundations);
        expect(next.stock).toBe(state.stock);
        expect(next.waste).toBe(state.waste);
    });

    it('turns up the card a move exposes, emitting exactly [moved, flipped] and scoring +5 under Standard', () => {
        const state = deepFreeze(
            makeState({
                tableau: tab([...faceDown(cardId(CLUBS, 2)), ...faceUp(SIX_OF_HEARTS)], faceUp(SEVEN_OF_SPADES)),
            }),
        );
        const result = applyCommand(state, move(tableauRef(0), 1, tableauRef(1)));

        expect(result.events).toEqual([
            { type: 'moved', cards: [SIX_OF_HEARTS], from: tableauRef(0), to: tableauRef(1) },
            { type: 'flipped', card: cardId(CLUBS, 2) },
        ]);
        expect(result.state.tableau[0]).toEqual([{ id: cardId(CLUBS, 2), up: true }]);
        expect(result.state.score).toBe(5);
    });

    it('emits exactly [moved, won] for the last card and does not add the win bonus', () => {
        const state = nearlyWon({ tableau: tab(faceUp(KING_OF_SPADES)), elapsedMs: 60_000 });
        const result = applyCommand(state, move(tableauRef(0), 0, foundationRef(SPADES)));

        expect(result.events).toEqual([
            { type: 'moved', cards: [KING_OF_SPADES], from: tableauRef(0), to: foundationRef(SPADES) },
            { type: 'won' },
        ]);
        expect(result.state.status).toBe('won');
        expect(result.state.score).toBe(10);
    });

    it('does not subtract the time penalty from the stored score', () => {
        const state = deepFreeze(
            makeState({
                score: 30,
                elapsedMs: 60_000,
                waste: [SEVEN_OF_SPADES],
                tableau: tab(faceUp(EIGHT_OF_DIAMONDS)),
            }),
        );
        const result = applyCommand(state, move(WASTE, 0, tableauRef(0)));
        expect(result.state.score).toBe(35);
    });

    it('moves from the waste top and from a foundation top', () => {
        const fromWaste = deepFreeze(makeState({ waste: [SEVEN_OF_SPADES], tableau: tab(faceUp(EIGHT_OF_DIAMONDS)) }));
        const wasteResult = applyCommand(fromWaste, move(WASTE, 0, tableauRef(0)));
        expect(wasteResult.state.waste).toEqual([]);
        expect(wasteResult.state.tableau[0]).toEqual(faceUp(EIGHT_OF_DIAMONDS, SEVEN_OF_SPADES));
        expect(wasteResult.state.score).toBe(5);

        const fromFoundation = deepFreeze(
            makeState({ foundations: found(suitRun(HEARTS, 6)), tableau: tab(faceUp(SEVEN_OF_SPADES)) }),
        );
        const foundationResult = applyCommand(fromFoundation, move(foundationRef(HEARTS), 5, tableauRef(0)));
        expect(foundationResult.state.foundations[HEARTS]).toEqual(suitRun(HEARTS, 5));
        expect(foundationResult.state.tableau[0]).toEqual(faceUp(SEVEN_OF_SPADES, SIX_OF_HEARTS));
    });
});

describe('autoFoundation', () => {
    it('sends a tableau top to its foundation, emitting [moved, flipped] when it exposes a card, without counting', () => {
        const state = deepFreeze(
            makeState({ tableau: tab([...faceDown(cardId(CLUBS, 5)), ...faceUp(ACE_OF_HEARTS)]) }),
        );
        const result = applyCommand(state, auto(tableauRef(0)));

        expect(result.events).toEqual([
            { type: 'moved', cards: [ACE_OF_HEARTS], from: tableauRef(0), to: foundationRef(HEARTS) },
            { type: 'flipped', card: cardId(CLUBS, 5) },
        ]);
        expect(result.state.moves).toBe(0);
        expect(result.state.started).toBe(true);
        expect(result.state.foundations[HEARTS]).toEqual([ACE_OF_HEARTS]);
        expect(result.state.tableau[0]).toEqual(faceUp(cardId(CLUBS, 5)));
        expect(result.state.score).toBe(15);
    });

    it('emits [moved, won] when the tableau top is the last card', () => {
        const state = nearlyWon({ tableau: tab(faceUp(KING_OF_SPADES)) });
        const result = applyCommand(state, auto(tableauRef(0)));

        expect(result.events).toEqual([
            { type: 'moved', cards: [KING_OF_SPADES], from: tableauRef(0), to: foundationRef(SPADES) },
            { type: 'won' },
        ]);
        expect(result.state.status).toBe('won');
        expect(result.state.moves).toBe(0);
    });

    it('emits [moved, won] when the waste top is the last card', () => {
        const state = nearlyWon({ waste: [KING_OF_SPADES] });
        const result = applyCommand(state, auto(WASTE));

        expect(result.events).toEqual([
            { type: 'moved', cards: [KING_OF_SPADES], from: WASTE, to: foundationRef(SPADES) },
            { type: 'won' },
        ]);
        expect(result.state.status).toBe('won');
    });

    it('is accepted from the waste', () => {
        const state = deepFreeze(makeState({ waste: [ACE_OF_HEARTS] }));
        const result = applyCommand(state, auto(WASTE));

        expect(result.state.waste).toEqual([]);
        expect(result.state.foundations[HEARTS]).toEqual([ACE_OF_HEARTS]);
        expect(result.state.score).toBe(10);
        expect(result.state.moves).toBe(0);
    });

    it('never increments moves', () => {
        const state = deepFreeze(
            makeState({ moves: 7, waste: [ACE_OF_HEARTS], tableau: tab(faceUp(cardId(DIAMONDS, 1))) }),
        );
        const first = applyCommand(state, auto(WASTE));
        const second = applyCommand(deepFreeze(first.state), auto(tableauRef(0)));

        expect(first.state.moves).toBe(7);
        expect(second.state.moves).toBe(7);
    });
});

describe('fields the engine does not own', () => {
    const owned = (over: Partial<GameState>): GameState =>
        deepFreeze(
            makeState({
                seed: 42,
                mode: 'vegas',
                draw: 3,
                scoring: 'vegas',
                verdict: 'win',
                attempts: 7,
                elapsedMs: 12_345,
                ...over,
            }),
        );
    const untouched = (s: GameState) => ({
        seed: s.seed,
        mode: s.mode,
        draw: s.draw,
        scoring: s.scoring,
        verdict: s.verdict,
        attempts: s.attempts,
        elapsedMs: s.elapsedMs,
    });

    const cases: readonly (readonly [string, GameState, Command])[] = [
        [
            'an accepted move',
            owned({ tableau: tab(faceUp(SEVEN_OF_SPADES, SIX_OF_HEARTS), faceUp(EIGHT_OF_DIAMONDS)) }),
            move(tableauRef(0), 0, tableauRef(1)),
        ],
        ['an autoFoundation', owned({ waste: [ACE_OF_HEARTS] }), auto(WASTE)],
        ['a draw', owned({ stock: [cardId(CLUBS, 1), cardId(CLUBS, 2)] }), DRAW],
        ['a recycle', owned({ waste: [cardId(CLUBS, 1), cardId(CLUBS, 2)], passes: 1 }), DRAW],
        [
            'a refused command',
            owned({ tableau: tab(faceUp(SIX_OF_HEARTS), faceUp(EIGHT_OF_DIAMONDS)) }),
            move(tableauRef(0), 0, tableauRef(1)),
        ],
        [
            'the winning move',
            owned({ foundations: NEARLY_WON_FOUNDATIONS, tableau: tab(faceUp(KING_OF_SPADES)) }),
            move(tableauRef(0), 0, foundationRef(SPADES)),
        ],
    ];

    it.each(cases)('survive %s', (_name, state, command) => {
        const { state: next } = applyCommand(state, command);
        expect(untouched(next)).toEqual(untouched(state));
    });
});

describe('started', () => {
    it('becomes true on the first accepted command', () => {
        const state = deepFreeze(makeState({ tableau: tab(faceUp(SEVEN_OF_SPADES), faceUp(EIGHT_OF_DIAMONDS)) }));
        expect(state.started).toBe(false);
        expect(applyCommand(state, move(tableauRef(0), 0, tableauRef(1))).state.started).toBe(true);
    });
});

describe('scoring wiring', () => {
    it('clamps a Standard foundation-to-tableau move at zero', () => {
        const state = deepFreeze(
            makeState({ foundations: found(suitRun(HEARTS, 6)), tableau: tab(faceUp(SEVEN_OF_SPADES)), score: 10 }),
        );
        const result = applyCommand(state, move(foundationRef(HEARTS), 5, tableauRef(0)));
        expect(result.state.score).toBe(0);
    });

    it('scores a Vegas foundation move without a floor', () => {
        const state = deepFreeze(
            makeState({ scoring: 'vegas', mode: 'vegas', score: -52, tableau: tab(faceUp(ACE_OF_HEARTS)) }),
        );
        const result = applyCommand(state, move(tableauRef(0), 0, foundationRef(HEARTS)));
        expect(result.state.score).toBe(-47);
    });

    it('takes 5 off the Vegas bankroll for a card leaving a foundation', () => {
        const state = deepFreeze(
            makeState({
                scoring: 'vegas',
                mode: 'vegas',
                score: -47,
                foundations: found(suitRun(HEARTS, 6)),
                tableau: tab(faceUp(SEVEN_OF_SPADES)),
            }),
        );
        const result = applyCommand(state, move(foundationRef(HEARTS), 5, tableauRef(0)));
        expect(result.state.score).toBe(-52);
    });
});
