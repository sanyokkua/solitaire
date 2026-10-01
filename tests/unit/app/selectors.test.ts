import { appReducer, setRoute, sheetOpened, systemMotionChanged } from '../../../src/app/appSlice';
import { selectDealing, selectReducedMotion, selectRoute, selectSheet } from '../../../src/app/selectors';
import { defaultPreferences } from '../../../src/features/preferences/preferencesSlice';

function stateWith(animations: boolean, systemReducedMotion: boolean) {
    return {
        app: appReducer(undefined, systemMotionChanged(systemReducedMotion)),
        preferences: { ...defaultPreferences('en'), animations },
    };
}

// covers: KS-SET-04
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

describe('the named app selectors', () => {
    it('selectDealing reads the deal in flight', () => {
        const app = appReducer(undefined, { type: 'init' });
        expect(selectDealing({ app })).toBeNull();
        const dealing = { overlay: true, attempt: 2 };
        expect(selectDealing({ app: { ...app, dealing } })).toBe(dealing);
    });

    it('selectRoute reads the current screen', () => {
        const home = appReducer(undefined, { type: 'init' });
        expect(selectRoute({ app: home })).toBe('home');
        expect(selectRoute({ app: appReducer(home, setRoute('game')) })).toBe('game');
    });

    it('selectSheet reads the open sheet, or null', () => {
        const closed = appReducer(undefined, { type: 'init' });
        expect(selectSheet({ app: closed })).toBeNull();
        expect(selectSheet({ app: appReducer(closed, sheetOpened('settings')) })).toBe('settings');
    });
});
