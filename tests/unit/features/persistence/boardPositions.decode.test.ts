import { describe, expect, it } from 'vitest';
import { decodeRecord, encodeRecord } from '../../../../src/features/persistence/recordCodec';
import { defaultPreferences } from '../../../../src/features/preferences/preferencesSlice';
import { statsReducer } from '../../../../src/features/stats/statsSlice';
import { suitOf } from '../../../../src/domain/cards';
import type { GameState } from '../../../../src/domain/types';
import {
    drawThreeFanState,
    freshDrawOneState,
    freshDrawThreeState,
    undoMovePosition,
    worstColumnState,
} from '../../../fixtures/boardPositions';

/** Encodes the fixture as the record a browser spec would seed, then decodes it the way the app does on load. */
function roundTrip(current: GameState, history: readonly GameState[] = []) {
    const raw = encodeRecord({
        preferences: defaultPreferences('en'),
        stats: statsReducer(undefined, { type: '@@INIT' }),
        game: { current, history, future: [], dailyKey: null, counted: false },
    });
    return decodeRecord(raw);
}

describe('board position fixtures decode as a stored record', () => {
    it.each([
        ['the worst column', () => ({ current: worstColumnState(), history: [] as GameState[] })],
        ['the Draw 3 fan', () => ({ current: drawThreeFanState(), history: [] as GameState[] })],
        ['the fresh Draw 1 game', () => ({ current: freshDrawOneState(), history: [] as GameState[] })],
        ['the fresh Draw 3 game', () => ({ current: freshDrawThreeState(), history: [] as GameState[] })],
        ['the one-undo-move game', undoMovePosition],
    ])('%s survives encode and decode unchanged', (_name, build) => {
        const { current, history } = build();

        const decoded = roundTrip(current, history);

        expect(decoded.ok).toBe(true);
        if (!decoded.ok) return;
        expect(decoded.record.session?.current).toEqual(current);
        expect(decoded.record.session?.history).toEqual(history);
    });

    it('keeps the Draw 3 fan face up with all four suits in the waste', () => {
        const { waste, draw } = drawThreeFanState();

        expect(draw).toBe(3);
        expect(waste.length).toBeGreaterThanOrEqual(3);
        expect(new Set(waste.map((id) => suitOf(id))).size).toBe(4);
    });

    it('starts the fresh games playing, with every card once and the waste face up', () => {
        for (const state of [freshDrawOneState(), freshDrawThreeState()]) {
            const ids = [
                ...state.stock,
                ...state.waste,
                ...state.foundations.flat(),
                ...state.tableau.flat().map((card) => card.id),
            ];

            expect(state.started).toBe(true);
            expect(state.status).toBe('playing');
            expect(new Set(ids).size).toBe(52);
            expect(ids).toHaveLength(52);
        }
        expect(freshDrawOneState().waste).toHaveLength(1);
        expect(freshDrawThreeState().waste).toHaveLength(6);
    });

    it('has a history step that differs from the current position', () => {
        const { current, history } = undoMovePosition();

        expect(history).toHaveLength(1);
        expect(history[0]?.moves).toBe(0);
        expect(current.moves).toBe(1);
        expect(current.foundations[0]).toHaveLength(1);
    });
});
