export type Suit = 0 | 1 | 2 | 3;
export type CardId = number;
export type Mode = 'draw1' | 'draw3' | 'vegas' | 'daily';
export type ScoringMode = 'standard' | 'vegas';
export type TableauCol = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PileRef =
    | { readonly pile: 'stock' }
    | { readonly pile: 'waste' }
    | { readonly pile: 'foundation'; readonly suit: Suit }
    | { readonly pile: 'tableau'; readonly col: TableauCol };

export interface TableauCard {
    readonly id: CardId;
    readonly up: boolean;
}

export type Column = readonly TableauCard[];
export type Pile = readonly CardId[];

export type Tableau = readonly [Column, Column, Column, Column, Column, Column, Column];
export type Foundations = readonly [Pile, Pile, Pile, Pile];

export interface GameState {
    readonly seed: number;
    readonly mode: Mode;
    readonly draw: 1 | 3;
    readonly scoring: ScoringMode;
    readonly verdict: 'win' | 'random';
    readonly attempts: number;
    /** Seven columns; index 0 is the bottom of a column. */
    readonly tableau: Tableau;
    /** The last card is the top of both stock and waste. */
    readonly stock: Pile;
    readonly waste: Pile;
    /** Indexed by suit. */
    readonly foundations: Foundations;
    /** Stored move score; the displayed score also applies the time penalty and win bonus. */
    readonly score: number;
    readonly moves: number;
    /** Ordinal of the pass in progress; a fresh deal starts at 1. */
    readonly passes: number;
    readonly elapsedMs: number;
    readonly started: boolean;
    readonly status: 'playing' | 'won';
}

export type Command =
    | { readonly type: 'draw' }
    | { readonly type: 'move'; readonly from: PileRef; readonly index: number; readonly to: PileRef }
    | { readonly type: 'autoFoundation'; readonly from: PileRef };

export type RejectReason = 'game-over' | 'not-movable' | 'illegal-target' | 'pass-limit' | 'nothing-to-draw';

export type GameEvent =
    | { readonly type: 'moved'; readonly cards: readonly CardId[]; readonly from: PileRef; readonly to: PileRef }
    | { readonly type: 'flipped'; readonly card: CardId }
    | { readonly type: 'drew'; readonly count: number }
    | { readonly type: 'recycled'; readonly pass: number }
    | { readonly type: 'won' }
    | { readonly type: 'rejected'; readonly reason: RejectReason };
