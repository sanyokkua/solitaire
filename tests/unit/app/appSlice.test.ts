import {
    appReducer,
    dealingEnded,
    dealingProgressed,
    noticeDismissed,
    noticeRaised,
    setRoute,
    sheetClosed,
    sheetOpened,
    systemMotionChanged,
    visibilityChanged,
    type AppState,
} from '../../../src/app/appSlice';

const initial: AppState = appReducer(undefined, { type: 'init' });

describe('app slice', () => {
    it('starts with the documented defaults', () => {
        expect(initial).toEqual({
            route: 'home',
            sheet: null,
            notices: [],
            documentVisible: true,
            systemReducedMotion: false,
            dealing: null,
        });
    });

    it('sets the route', () => {
        expect(appReducer(initial, setRoute('game')).route).toBe('game');
    });

    it('opens a sheet and closes it back to null', () => {
        const open = appReducer(initial, sheetOpened('settings'));

        expect(open.sheet).toBe('settings');
        expect(appReducer(open, sheetOpened('help')).sheet).toBe('help');
        expect(appReducer(open, sheetClosed()).sheet).toBeNull();
    });

    it('raises a notice once, however often it is raised', () => {
        const once = appReducer(initial, noticeRaised('storage-read'));
        const twice = appReducer(once, noticeRaised('storage-read'));

        expect(once.notices).toEqual([{ id: 'storage-read' }]);
        expect(twice.notices).toEqual([{ id: 'storage-read' }]);
    });

    it('keeps distinct notices side by side', () => {
        const state = [noticeRaised('storage-read'), noticeRaised('storage-write')].reduce(appReducer, initial);

        expect(state.notices).toEqual([{ id: 'storage-read' }, { id: 'storage-write' }]);
    });

    it('dismisses only the named notice', () => {
        const raised = [
            noticeRaised('storage-read'),
            noticeRaised('storage-read-only'),
            noticeRaised('storage-write'),
        ].reduce(appReducer, initial);

        const dismissed = appReducer(raised, noticeDismissed('storage-read-only'));

        expect(dismissed.notices).toEqual([{ id: 'storage-read' }, { id: 'storage-write' }]);
    });

    it('ignores dismissing a notice that is not raised', () => {
        const raised = appReducer(initial, noticeRaised('storage-read'));

        const dismissed = appReducer(raised, noticeDismissed('storage-write'));

        expect(dismissed.notices).toEqual([{ id: 'storage-read' }]);
        expect(dismissed).toBe(raised);
    });

    it('tracks document visibility', () => {
        const hidden = appReducer(initial, visibilityChanged(false));

        expect(hidden.documentVisible).toBe(false);
        expect(appReducer(hidden, visibilityChanged(true)).documentVisible).toBe(true);
    });

    it('tracks the system reduced-motion request', () => {
        const reduced = appReducer(initial, systemMotionChanged(true));

        expect(reduced.systemReducedMotion).toBe(true);
        expect(appReducer(reduced, systemMotionChanged(false)).systemReducedMotion).toBe(false);
    });

    it('records dealing progress and clears it when the deal ends', () => {
        const dealing = appReducer(initial, dealingProgressed({ overlay: true, attempt: 3 }));

        expect(dealing.dealing).toEqual({ overlay: true, attempt: 3 });
        expect(appReducer(dealing, dealingProgressed({ overlay: false, attempt: 4 })).dealing).toEqual({
            overlay: false,
            attempt: 4,
        });
        expect(appReducer(dealing, dealingEnded()).dealing).toBeNull();
    });
});
