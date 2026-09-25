import { appReducer, systemMotionChanged } from '../../../src/app/appSlice';
import { selectReducedMotion } from '../../../src/app/selectors';
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
