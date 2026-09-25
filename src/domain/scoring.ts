import type { GameEvent, GameState, PileRef, ScoringMode } from './types';

/** Points gained or lost per card crossing a foundation boundary under Vegas rules. */
const VEGAS_FOUNDATION_POINTS = 5;

/** Deduction for every recycle in a Standard draw-1 game. */
const DRAW1_RECYCLE_PENALTY = -100;

/** Deduction for a Standard draw-3 recycle beginning the fourth or a later pass; the first three passes are free. */
const DRAW3_RECYCLE_PENALTY = -20;
const DRAW3_FIRST_PENALISED_PASS = 4;

/** Standard time penalty: 2 points for every full 10 seconds of counted play. */
const TIME_PENALTY_POINTS = 2;
const TIME_PENALTY_INTERVAL_SECONDS = 10;

/** Standard win bonus: 700,000 divided by whole seconds, awarded only when the game took more than 30 seconds. */
const WIN_BONUS_NUMERATOR = 700_000;
const WIN_BONUS_MIN_SECONDS_EXCLUSIVE = 30;

/** Standard cost of one undo; Vegas undo is free. */
const STANDARD_UNDO_COST = 2;

const MS_PER_SECOND = 1000;

/** Standard scoring starts at zero; Vegas starts with the 52-dollar buy-in already deducted. */
export function startingScore(scoring: ScoringMode): number {
    return scoring === 'vegas' ? -52 : 0;
}

/** Standard points for one card-group move, keyed on the piles it leaves and enters. */
function standardMoveDelta(from: PileRef, to: PileRef): number {
    if (from.pile === 'waste' && to.pile === 'foundation') return 10;
    if (from.pile === 'tableau' && to.pile === 'foundation') return 10;
    if (from.pile === 'waste' && to.pile === 'tableau') return 5;
    if (from.pile === 'foundation' && to.pile === 'tableau') return -15;
    return 0;
}

/** Vegas points for one card-group move: only cards crossing a foundation boundary count. */
function vegasMoveDelta(from: PileRef, to: PileRef, cardCount: number): number {
    if (to.pile === 'foundation') return VEGAS_FOUNDATION_POINTS * cardCount;
    if (from.pile === 'foundation') return -VEGAS_FOUNDATION_POINTS * cardCount;
    return 0;
}

/** Standard penalty for a recycle that begins the given pass. */
function standardRecycleDelta(pass: number, draw: 1 | 3): number {
    if (draw === 1) return DRAW1_RECYCLE_PENALTY;
    return pass >= DRAW3_FIRST_PENALISED_PASS ? DRAW3_RECYCLE_PENALTY : 0;
}

/** Score change contributed by a single event under the given scoring mode and draw count. */
export function eventDelta(event: GameEvent, scoring: ScoringMode, draw: 1 | 3): number {
    switch (event.type) {
        case 'moved':
            return scoring === 'vegas'
                ? vegasMoveDelta(event.from, event.to, event.cards.length)
                : standardMoveDelta(event.from, event.to);
        case 'flipped':
            return scoring === 'vegas' ? 0 : 5;
        case 'recycled':
            return scoring === 'vegas' ? 0 : standardRecycleDelta(event.pass, draw);
        case 'drew':
        case 'won':
        case 'rejected':
            return 0;
    }
}

/** Total score change for all events produced by one command. */
export function commandDelta(events: readonly GameEvent[], scoring: ScoringMode, draw: 1 | 3): number {
    return events.reduce((sum, event) => sum + eventDelta(event, scoring, draw), 0);
}

/** Applies a command's delta to the stored score: Standard floors at zero, Vegas never floors. */
export function applyDelta(stored: number, delta: number, scoring: ScoringMode): number {
    return scoring === 'vegas' ? stored + delta : Math.max(0, stored + delta);
}

/** Whole seconds in an elapsed time; the fraction is discarded. */
function wholeSeconds(elapsedMs: number): number {
    return Math.floor(elapsedMs / MS_PER_SECOND);
}

/** Standard time penalty totalled from elapsed play time; Vegas has none. */
export function timePenalty(elapsedMs: number, scoring: ScoringMode): number {
    if (scoring === 'vegas') return 0;
    return TIME_PENALTY_POINTS * Math.floor(wholeSeconds(elapsedMs) / TIME_PENALTY_INTERVAL_SECONDS);
}

/** Standard win bonus for a game finished in the given time; 0 at 30 whole seconds or fewer, and under Vegas. */
export function winBonus(elapsedMs: number, scoring: ScoringMode): number {
    if (scoring === 'vegas') return 0;
    const seconds = wholeSeconds(elapsedMs);
    return seconds > WIN_BONUS_MIN_SECONDS_EXCLUSIVE ? Math.floor(WIN_BONUS_NUMERATOR / seconds) : 0;
}

/** Points charged for one undo: 2 under Standard, nothing under Vegas. */
export function undoCost(scoring: ScoringMode): number {
    return scoring === 'vegas' ? 0 : STANDARD_UNDO_COST;
}

/**
 * Score to show: Standard subtracts the time penalty and `undos × undoCost` (floored at 0), adds the win bonus
 * once won; Vegas as stored (no undo cost, no floor).
 */
export function displayedScore(state: GameState): number {
    if (state.scoring === 'vegas') return state.score;
    const charges = timePenalty(state.elapsedMs, state.scoring) + state.undos * undoCost(state.scoring);
    const base = Math.max(0, state.score - charges);
    return state.status === 'won' ? base + winBonus(state.elapsedMs, state.scoring) : base;
}
