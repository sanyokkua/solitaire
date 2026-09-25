import { afterEach, describe, expect, it, vi } from 'vitest';
import { dealFromSeed } from '../../../../src/domain/deal';
import { applyCommand } from '../../../../src/domain/engine';
import type { GameState } from '../../../../src/domain/types';
import { setRoute, visibilityChanged } from '../../../../src/app/appSlice';
import { createAppStore } from '../../../../src/app/store';
import { createClockTicker } from '../../../../src/features/game/clockTicker';
import { installed } from '../../../../src/features/game/gameSlice';
import { makeState } from '../../../fixtures/states';

/** The fresh deal with one accepted draw applied, so the game has started. */
function startedState(): GameState {
    return applyCommand(dealFromSeed(1, 'draw1'), { type: 'draw' }).state;
}

/** A store with `state` installed, a ticker on fake timers, and helpers to advance the fake clock. */
function setup(route: 'home' | 'game' = 'game') {
    const store = createAppStore();
    store.dispatch(installed({ state: startedState(), dailyKey: null }));
    store.dispatch(setRoute(route));

    let nowMs = 5000;
    let callback: (() => void) | null = null;
    let intervalMs: number | null = null;
    const handle = { interval: true };
    const cleared: unknown[] = [];
    const ticker = createClockTicker(store, {
        now: () => nowMs,
        setInterval: (cb, ms) => {
            callback = cb;
            intervalMs = ms;
            return handle;
        },
        clearInterval: (h) => {
            cleared.push(h);
        },
    });

    return {
        store,
        ticker,
        handle,
        cleared,
        intervalMs: () => intervalMs,
        /** Moves the fake clock forward and fires the captured interval callback once. */
        advance: (ms: number) => {
            nowMs += ms;
            callback?.();
        },
        /** Moves the fake clock forward without firing the interval. */
        skip: (ms: number) => {
            nowMs += ms;
        },
        elapsed: () => store.getState().game.current?.elapsedMs,
        anchor: () => store.getState().game.clock.anchorMs,
    };
}

describe('createClockTicker', () => {
    it('ticks every 250 ms and sets the anchor on creation', () => {
        const { intervalMs, anchor } = setup();

        expect(intervalMs()).toBe(250);
        expect(anchor()).toBe(5000);
    });

    it('accrues 10,000 ms over 40 ticks of 250 ms of eligible play', () => {
        const { advance, elapsed } = setup();

        for (let i = 0; i < 40; i++) advance(250);

        expect(elapsed()).toBe(10_000);
    });

    it('accrues nothing while the document is hidden and clears the anchor', () => {
        const { store, advance, elapsed, anchor } = setup();
        advance(250);
        advance(250);

        store.dispatch(visibilityChanged(false));
        const before = elapsed();
        for (let i = 0; i < 8; i++) advance(250);

        expect(elapsed()).toBe(before);
        expect(anchor()).toBeNull();
    });

    it('does not count the gap when play resumes after a long hidden time', () => {
        const { store, advance, skip, elapsed } = setup();
        advance(250);
        advance(250);
        expect(elapsed()).toBe(500);

        store.dispatch(visibilityChanged(false));
        advance(250);
        skip(10 * 60_000);
        store.dispatch(visibilityChanged(true));
        expect(elapsed()).toBe(500);

        advance(250);
        expect(elapsed()).toBe(750);
    });

    it('settles the play since the last tick when play stops between ticks', () => {
        const { store, advance, skip, elapsed } = setup();
        advance(250);
        expect(elapsed()).toBe(250);

        skip(200);
        store.dispatch(visibilityChanged(false));

        expect(elapsed()).toBe(450);
    });

    it('leaves a won game untouched when play stops', () => {
        const { store, skip, elapsed } = setup();
        store.dispatch(
            installed({ state: makeState({ started: true, status: 'won', elapsedMs: 3000 }), dailyKey: null }),
        );

        skip(200);
        store.dispatch(setRoute('home'));

        expect(elapsed()).toBe(3000);
    });

    it('sets the anchor on an eligibility change alone, without the interval firing', () => {
        const { store, anchor, skip } = setup('home');
        expect(anchor()).toBeNull();

        skip(1234);
        store.dispatch(setRoute('game'));

        expect(anchor()).toBe(5000 + 1234);
    });

    it('clears the interval and stops reacting to the store when disposed', () => {
        const { store, ticker, handle, cleared, skip, anchor } = setup('home');

        ticker.dispose();
        expect(cleared).toEqual([handle]);

        skip(500);
        store.dispatch(setRoute('game'));
        expect(anchor()).toBeNull();

        ticker.dispose();
        expect(cleared).toEqual([handle]);
    });

    describe('without injected timers', () => {
        afterEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        /** A store on the game route with a started game, and a controllable `performance.now` reading. */
        function globalSetup() {
            vi.useFakeTimers();
            let nowMs = 1000;
            vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
            const store = createAppStore();
            store.dispatch(installed({ state: startedState(), dailyKey: null }));
            store.dispatch(setRoute('game'));
            return {
                store,
                setNow: (ms: number) => {
                    nowMs = ms;
                },
                elapsed: () => store.getState().game.current?.elapsedMs,
                anchor: () => store.getState().game.clock.anchorMs,
            };
        }

        it('reads performance.now and the global timers at call time', () => {
            const { store, setNow, elapsed, anchor } = globalSetup();

            const ticker = createClockTicker(store);
            expect(anchor()).toBe(1000);

            setNow(1250);
            vi.advanceTimersByTime(250);
            expect(elapsed()).toBe(250);

            setNow(1500);
            vi.advanceTimersByTime(250);
            expect(elapsed()).toBe(500);

            ticker.dispose();
        });

        it('clears the global interval on dispose so no further play accrues', () => {
            const { store, setNow, elapsed } = globalSetup();
            const ticker = createClockTicker(store);
            expect(vi.getTimerCount()).toBe(1);

            setNow(1250);
            vi.advanceTimersByTime(250);
            expect(elapsed()).toBe(250);

            ticker.dispose();
            expect(vi.getTimerCount()).toBe(0);

            setNow(5000);
            vi.advanceTimersByTime(2000);
            expect(elapsed()).toBe(250);
        });

        it('keeps the global timers for any part that is not injected', () => {
            const { store, elapsed } = globalSetup();
            let nowMs = 200;
            const ticker = createClockTicker(store, { now: () => nowMs });

            nowMs = 450;
            vi.advanceTimersByTime(250);

            expect(elapsed()).toBe(250);
            ticker.dispose();
            expect(vi.getTimerCount()).toBe(0);
        });
    });
});
