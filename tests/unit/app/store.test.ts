import { createAppStore } from '../../../src/app/store';
import { selectRoute, setRoute } from '../../../src/app/appSlice';

describe('application store', () => {
    it('starts at the home route', () => {
        const store = createAppStore();

        expect(selectRoute(store.getState())).toBe('home');
    });

    it('transitions to the game route on setRoute', () => {
        const store = createAppStore();

        store.dispatch(setRoute('game'));

        expect(store.getState().app.route).toBe('game');
    });

    it('reads the route from real store state via the selector', () => {
        const store = createAppStore();

        store.dispatch(setRoute('game'));

        expect(selectRoute(store.getState())).toBe('game');
    });

    it('creates isolated stores whose state does not leak between instances', () => {
        const first = createAppStore();
        const second = createAppStore();

        first.dispatch(setRoute('game'));

        expect(selectRoute(first.getState())).toBe('game');
        expect(selectRoute(second.getState())).toBe('home');
    });
});
