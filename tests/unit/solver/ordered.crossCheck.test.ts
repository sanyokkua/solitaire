import { describe, expect, it } from 'vitest';
import { DECK_SIZE } from '../../../src/domain/cards';
import type { GameState } from '../../../src/domain/types';
import { solveOrdered } from '../../../src/solver/ordered';
import { ENDGAMES, type Cover } from '../../fixtures/endgames';
import { bruteForceWins } from '../../support/bruteForce';
import { emptyingRun, foundationToColumn } from '../../support/moveKinds';

/** More than any pinned endgame needs: the search must never report `unknown` here. */
const BUDGET = 200_000;

const offFoundations = (state: GameState): number =>
    DECK_SIZE - state.foundations.reduce((sum, pile) => sum + pile.length, 0);

const named = (cover: Cover): typeof ENDGAMES => ENDGAMES.filter((endgame) => endgame.covers.includes(cover));

describe('solveOrdered against the exhaustive search on pinned endgames', () => {
    it.each(ENDGAMES.map((endgame) => [endgame.name, endgame] as const))('%s', (_name, endgame) => {
        expect(offFoundations(endgame.state)).toBeLessThanOrEqual(14);
        const result = solveOrdered(endgame.state, BUDGET);
        expect(result.verdict).not.toBe('unknown');
        expect(result.verdict).toBe(endgame.wins ? 'win' : 'loss');
        expect(bruteForceWins(endgame.state)).toBe(endgame.wins);
    });
});

describe('the pinned endgame set', () => {
    it('holds winnable and unwinnable endgames in Draw 3 and in Vegas', () => {
        for (const mode of ['draw3', 'vegas'] as const) {
            const inMode = ENDGAMES.filter((endgame) => endgame.state.mode === mode);
            expect(inMode.some((endgame) => endgame.wins)).toBe(true);
            expect(inMode.some((endgame) => !endgame.wins)).toBe(true);
        }
    });

    it('holds a talon-order pair: the same cards, won or lost by how the draws group them', () => {
        const pair = named('talon-order');
        expect(pair.map((endgame) => endgame.wins).sort()).toEqual([false, true]);
        const cards = (state: GameState): number[] => [...state.stock].sort((a, b) => a - b);
        expect(cards(pair[0]?.state ?? ({} as GameState))).toEqual(cards(pair[1]?.state ?? ({} as GameState)));
    });

    it('holds a Vegas layout decided by the passes left', () => {
        const layouts = named('pass-limit').map((endgame) => endgame.state);
        expect(new Set(layouts.map((state) => state.waste.join())).size).toBe(1);
        const wonWith = layouts.filter((state) => bruteForceWins(state)).map((state) => state.passes);
        const lostWith = layouts.filter((state) => !bruteForceWins(state)).map((state) => state.passes);
        expect(Math.min(...lostWith)).toBeGreaterThan(Math.max(...wonWith));
        expect(lostWith).toContain(3);
    });

    it('holds endgames with cards in both the stock and the waste', () => {
        for (const endgame of named('part-way-pass')) {
            expect(endgame.state.stock.length, endgame.name).toBeGreaterThan(0);
            expect(endgame.state.waste.length, endgame.name).toBeGreaterThan(0);
        }
    });

    it('holds an endgame with no win unless a whole run leaves a column with nothing face down', () => {
        for (const endgame of named('column-emptying-run')) {
            expect(bruteForceWins(endgame.state, (command, before) => !emptyingRun(command, before))).toBe(false);
        }
    });

    it('holds an endgame with no win unless a card comes back off a foundation', () => {
        for (const endgame of named('foundation-to-column')) {
            expect(bruteForceWins(endgame.state, (command) => !foundationToColumn(command))).toBe(false);
        }
    });

    it.each(['loose-safe-rule', 'waste-send', 'column-emptying-run', 'foundation-to-column'] as const)(
        'names at least one endgame for %s',
        (cover) => {
            expect(named(cover).length).toBeGreaterThan(0);
        },
    );
});
