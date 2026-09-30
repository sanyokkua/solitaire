import { cardId, DECK_SIZE, TABLEAU_COLS, type Rank } from '../../src/domain/cards';
import { dealFromSeed, modeConfig } from '../../src/domain/deal';
import type { CardId, Column, GameState, Suit, TableauCard } from '../../src/domain/types';
import { faceUp, foundationsOf, makeState, tableauOf } from './states';

/** Index of the column that holds the worst case. */
const WORST_COLUMN = 6;
/** Face-down cards under the run. */
const FACE_DOWN_COUNT = 6;
/** Highest rank of the run. */
const RUN_TOP = 13;
const HEARTS: Suit = 0;
const DIAMONDS: Suit = 1;
const CLUBS: Suit = 2;
const SPADES: Suit = 3;

/** Every card id not in `used`, in id order: the cards a fixture leaves in the stock or under its own piles. */
function restOfDeck(used: readonly CardId[]): CardId[] {
    const taken = new Set<CardId>(used);
    return Array.from({ length: DECK_SIZE }, (_, id) => id).filter((id) => !taken.has(id));
}

/** The K to A run with alternating colours: K of spades, Q of hearts, J of spades, and so on down to the ace of spades. */
function worstRun(): TableauCard[] {
    return Array.from({ length: RUN_TOP }, (_, i): TableauCard => {
        const rank = (RUN_TOP - i) as Rank;
        return { id: cardId(i % 2 === 0 ? SPADES : HEARTS, rank), up: true };
    });
}

/**
 * The worst-case position for the layout: column 7 holds 6 face-down cards under a 13-card face-up run from king to
 * ace, alternating in colour. The other 33 cards are in the stock, so all 52 cards appear once. The game is started
 * and playing in Draw 1, which keeps it encodable.
 */
export function worstColumnState(): GameState {
    const run = worstRun();
    const rest = restOfDeck(run.map((card) => card.id));
    const faceDown = rest.slice(0, FACE_DOWN_COUNT).map((id): TableauCard => ({ id, up: false }));
    const emptyColumns = Array.from({ length: WORST_COLUMN }, (): Column => []);
    return makeState({
        started: true,
        status: 'playing',
        tableau: tableauOf(...emptyColumns, [...faceDown, ...run]),
        stock: rest.slice(FACE_DOWN_COUNT),
    });
}

/**
 * A started, playing Draw 3 game whose waste holds four face-up cards, one per suit (ace of hearts, diamonds, clubs
 * and spades, the last on top), so the fan shows every suit ink. The other 48 cards are in the stock. The score,
 * move count and elapsed time are distinctive, so a browser spec can tell that the clock carries on.
 */
export function drawThreeFanState(): GameState {
    const waste = [cardId(0, 1), cardId(1, 1), cardId(2, 1), cardId(3, 1)];
    return makeState({
        mode: 'draw3',
        draw: 3,
        started: true,
        status: 'playing',
        waste,
        stock: restOfDeck(waste),
        score: 40,
        moves: 4,
        elapsedMs: 65_000,
    });
}

/**
 * A started, playing Draw 1 game with one undoable move: the position before it has column 2 holding a face-down
 * card under the ace of hearts; the move sends the ace to the hearts foundation and turns the card over. The other
 * cards are in the stock. `history` holds the earlier position, so undo has a step to restore.
 */
export function undoMovePosition(): { readonly current: GameState; readonly history: readonly GameState[] } {
    const buried = cardId(3, 13);
    const ace = cardId(0, 1);
    const stock = restOfDeck([buried, ace]);
    const before = makeState({
        started: true,
        status: 'playing',
        tableau: tableauOf(
            [],
            [],
            [
                { id: buried, up: false },
                { id: ace, up: true },
            ],
        ),
        stock,
    });
    const current = makeState({
        started: true,
        status: 'playing',
        tableau: tableauOf([], [], faceUp(buried)),
        foundations: foundationsOf(1, 0, 0, 0),
        stock,
        score: 15,
        moves: 1,
    });
    return { current, history: [before] };
}

/** The 7 of clubs, face up alone in column 0 of `oneMovePosition`. */
export const SEVEN_OF_CLUBS = cardId(CLUBS, 7);
/** The 6 of diamonds, face up alone in column 1 of `oneMovePosition`: the card the drag specs pick up. */
export const SIX_OF_DIAMONDS = cardId(DIAMONDS, 6);

/**
 * A small started, playing Draw 1 game with exactly one legal move between piles: the 6 of diamonds (alone in column
 * 1) onto the 7 of clubs (alone in column 0). No ace is exposed, so nothing goes to a foundation, and the empty columns
 * 2 to 6 take only kings, none of which is exposed. The other 50 cards are in the stock, so all 52 cards appear once.
 */
export function oneMovePosition(): GameState {
    const rest = restOfDeck([SEVEN_OF_CLUBS, SIX_OF_DIAMONDS]);
    return makeState({
        started: true,
        status: 'playing',
        tableau: tableauOf(faceUp(SEVEN_OF_CLUBS), faceUp(SIX_OF_DIAMONDS)),
        stock: rest,
    });
}

/** The 7 of spades, face up alone in column 2 of `twoTargetsPosition`: the second black 7 the 6 of diamonds fits on. */
export const SEVEN_OF_SPADES = cardId(SPADES, 7);

/**
 * A small started, playing Draw 1 game where one card has two legal places: the 6 of diamonds is face up alone in
 * column 0, the 7 of clubs alone in column 1 and the 7 of spades alone in column 2. Smart move mode sends the 6 to
 * column 1 (the first column right of its own that accepts it); column 2 is legal too, so only a picked-up card
 * placed by hand lands there. No ace or king is exposed. The other 49 cards are in the stock, so all 52 cards
 * appear once.
 */
export function twoTargetsPosition(): GameState {
    const rest = restOfDeck([SIX_OF_DIAMONDS, SEVEN_OF_CLUBS, SEVEN_OF_SPADES]);
    return makeState({
        started: true,
        status: 'playing',
        tableau: tableauOf(faceUp(SIX_OF_DIAMONDS), faceUp(SEVEN_OF_CLUBS), faceUp(SEVEN_OF_SPADES)),
        stock: rest,
    });
}

/** The ace of hearts, face up alone in column 0 of `aceHomePosition`. */
export const ACE_HOME_CARD = cardId(HEARTS, 1);
/** The 9 of clubs, face up alone in column 1 of `aceHomePosition`: a card no move touches. */
const NINE_OF_CLUBS = cardId(CLUBS, 9);

/**
 * A small started, playing Draw 1 game with an exposed ace: the ace of hearts is face up alone in column 0, so it can
 * go home to the hearts foundation, and the 9 of clubs is face up alone in column 1. The other 50 cards are in the
 * stock, so all 52 cards appear once.
 */
export function aceHomePosition(): GameState {
    const rest = restOfDeck([ACE_HOME_CARD, NINE_OF_CLUBS]);
    return makeState({
        started: true,
        status: 'playing',
        tableau: tableauOf(faceUp(ACE_HOME_CARD), faceUp(NINE_OF_CLUBS)),
        stock: rest,
    });
}

/**
 * A started, playing game in `mode` whose stock is empty and whose waste holds three face-up kings, with the other 49
 * cards face up in the tableau, seven a column in id order. Nothing is on a foundation, so all 52 cards appear once.
 * A recycle puts the three kings back in the stock and one draw of three returns them, so a browser spec can walk the
 * passes with two activations of the stock each. Draw and scoring follow the mode, as the deal service sets them.
 */
function talonOnlyState(mode: 'draw3' | 'vegas', extra: Partial<GameState>): GameState {
    const waste = [cardId(HEARTS, 13), cardId(DIAMONDS, 13), cardId(CLUBS, 13)];
    const rest = restOfDeck(waste);
    const columns = TABLEAU_COLS.map((col) => faceUp(...rest.slice(col * 7, col * 7 + 7)));
    const { draw, scoring } = modeConfig(mode);
    return makeState({
        mode,
        draw,
        scoring,
        started: true,
        status: 'playing',
        tableau: tableauOf(...columns),
        waste,
        ...extra,
    });
}

/**
 * A started, playing Vegas game (Draw 3, Vegas scoring) with an empty stock and a three-card waste, having used
 * `passes` of its three passes; the Bank is the 52-dollar buy-in and no time counts against it. At `passes` 2 the next
 * recycle begins the last pass, and once that pass's waste is drawn the stock refuses a fourth.
 */
export function vegasTalonState({ passes }: { readonly passes: number }): GameState {
    return talonOnlyState('vegas', { passes, score: -52 });
}

/**
 * A started, playing Standard Draw 3 game with an empty stock and a three-card waste, on pass `passes`, holding the
 * stored `score` with `elapsedMs` on the clock. Passes 2 and 3 are free; the recycle that begins pass 4 costs 20.
 */
export function draw3TalonState({
    passes,
    score,
    elapsedMs,
}: {
    readonly passes: number;
    readonly score: number;
    readonly elapsedMs: number;
}): GameState {
    return talonOnlyState('draw3', { passes, score, elapsedMs });
}

/** The seed of the fresh deals below; any 32-bit seed works, this one only fixes the picture. */
const FRESH_DEAL_SEED = 42;

/**
 * A started, playing Draw 1 game a moment after the first draw, as on a typical game screen: a seeded deal with
 * the top stock card turned onto the waste, one move counted and one second on the clock. The other cards stay where
 * the deal put them, so all 52 cards appear once.
 */
export function freshDrawOneState(): GameState {
    const deal = dealFromSeed(FRESH_DEAL_SEED, 'draw1');
    const drawn = deal.stock.at(-1);
    if (drawn === undefined) throw new RangeError('a fresh deal has a stock');
    return { ...deal, stock: deal.stock.slice(0, -1), waste: [drawn], started: true, moves: 1, elapsedMs: 1_000 };
}

/**
 * A started, playing Draw 3 game a moment after two draws, as on a typical Draw 3 screen: a seeded deal with the
 * top six stock cards turned onto the waste in draws of three, so the waste shows a fan of three cards on top of
 * three more. Two moves are counted and one second is on the clock.
 */
export function freshDrawThreeState(): GameState {
    const deal = dealFromSeed(FRESH_DEAL_SEED, 'draw3');
    const drawn = deal.stock.slice(-6).reverse();
    return {
        ...deal,
        stock: deal.stock.slice(0, -6),
        waste: drawn,
        started: true,
        moves: 2,
        elapsedMs: 1_000,
    };
}
