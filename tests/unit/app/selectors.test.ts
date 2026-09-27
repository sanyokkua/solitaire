import { appReducer, systemMotionChanged } from '../../../src/app/appSlice';
import {
    selectBusy,
    selectCurrentGame,
    selectDealing,
    selectEpoch,
    selectReducedMotion,
} from '../../../src/app/selectors';
import { dealFromSeed } from '../../../src/domain/deal';
import { gameReducer, installed, busySet } from '../../../src/features/game/gameSlice';
import { defaultPreferences } from '../../../src/features/preferences/preferencesSlice';

function stateWith(animations: boolean, systemReducedMotion: boolean) {
    return {
        app: appReducer(undefined, systemMotionChanged(systemReducedMotion)),
        preferences: { ...defaultPreferences('en'), animations },
    };
}

describe('selectReducedMotion', () => {
    it('is reduced when Animations is on but the device asks for reduced motion', () => {
        expect(selectReducedMotion(stateWith(true, true))).toBe(true);
    });

    it('is reduced when Animations is off and the device does not ask', () => {
        expect(selectReducedMotion(stateWith(false, false))).toBe(true);
    });

    it('is reduced when both signals ask for it', () => {
        expect(selectReducedMotion(stateWith(false, true))).toBe(true);
    });

    it('is not reduced when Animations is on and the device does not ask', () => {
        expect(selectReducedMotion(stateWith(true, false))).toBe(false);
    });
});

describe('the named app and game selectors', () => {
    const empty = gameReducer(undefined, { type: 'init' });
    const state = dealFromSeed(7, 'draw1');
    const playing = gameReducer(empty, installed({ state, dailyKey: null }));

    it('selectDealing reads the deal in flight', () => {
        const app = appReducer(undefined, { type: 'init' });
        expect(selectDealing({ app })).toBeNull();
        const dealing = { overlay: true, attempt: 2 };
        expect(selectDealing({ app: { ...app, dealing } })).toBe(dealing);
    });

    it('selectCurrentGame reads the game in play, or null', () => {
        expect(selectCurrentGame({ game: empty })).toBeNull();
        expect(selectCurrentGame({ game: playing })).toBe(state);
    });

    it('selectEpoch reads the game epoch, which installing a game advances', () => {
        expect(selectEpoch({ game: empty })).toBe(0);
        expect(selectEpoch({ game: playing })).toBe(1);
    });

    it('selectBusy reads the busy flag', () => {
        expect(selectBusy({ game: playing })).toBe(false);
        expect(selectBusy({ game: gameReducer(playing, busySet(true)) })).toBe(true);
    });
});
