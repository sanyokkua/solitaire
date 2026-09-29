// covers: KS-SET-06
import { describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { GameState } from '../../../../src/domain/types';
import { installed } from '../../../../src/features/game/gameSlice';
import { play } from '../../../../src/features/game/gameThunks';
import { restart } from '../../../../src/features/game/sessionThunks';
import {
    defaultPreferences,
    preferenceSet,
    type PreferenceChange,
} from '../../../../src/features/preferences/preferencesSlice';
import { fakeDealService } from '../../../fixtures/dealService';
import { testStore } from '../../../support/testStore';

const PROVENANCE = { verdict: 'win', attempts: 3, grade: 'medium' } as const;

/** A store holding a Draw 1 game that has had an accepted command, and still is in play. */
function playing() {
    const store = testStore({ deps: { now: () => 1000, dealService: fakeDealService() } });
    const game: GameState = { ...dealFromSeed(11, 'draw1', PROVENANCE), started: true };
    store.dispatch(installed({ state: game, dailyKey: null }));
    return { store, game };
}

/** One change to every setting, each away from its default. */
const CHANGES: readonly PreferenceChange[] = [
    { key: 'theme', value: 'dark' },
    { key: 'nightCards', value: true },
    { key: 'fourColor', value: true },
    { key: 'cardBack', value: 'coral' },
    { key: 'tapMode', value: 'select' },
    { key: 'highlight', value: false },
    { key: 'autoSafe', value: true },
    { key: 'stockRight', value: true },
    { key: 'animations', value: false },
    { key: 'locale', value: 'uk' },
    { key: 'winnableOnly', value: false },
    { key: 'selectedMode', value: 'vegas' },
    { key: 'difficulty', value: 'hard' },
];

describe('changing a setting while a game is in play', () => {
    it('is a change to a value every setting really has', () => {
        const defaults = defaultPreferences('en');
        for (const change of CHANGES) expect(defaults[change.key], change.key).not.toEqual(change.value);
        expect(CHANGES.map(({ key }) => key).sort()).toEqual(Object.keys(defaults).sort());
    });

    it.each(CHANGES)('leaves the game as it was when $key changes', (change) => {
        const { store, game } = playing();

        store.dispatch(preferenceSet(change));

        expect(store.getState().game.current).toBe(game);
    });

    it('keeps the mode, draw count and scoring rules: a Draw 1 game still draws one card under Standard scoring', async () => {
        const { store } = playing();

        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'vegas' }));
        await store.dispatch(play({ type: 'draw' }));

        const game = store.getState().game.current;
        expect(game?.mode).toBe('draw1');
        expect(game?.draw).toBe(1);
        expect(game?.scoring).toBe('standard');
        expect(game?.waste).toHaveLength(1);
        expect(game?.moves).toBe(1);
    });

    it('restarts the original deal, seed, mode and provenance, whatever the selected mode and Winnable switch say', () => {
        const { store, game } = playing();

        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'daily' }));
        store.dispatch(preferenceSet({ key: 'winnableOnly', value: false }));
        store.dispatch(restart());

        const restarted = store.getState().game.current;
        expect(restarted).toEqual({ ...dealFromSeed(game.seed, game.mode, PROVENANCE), started: false });
    });
});
