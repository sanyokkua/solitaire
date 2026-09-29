import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../../../src/app/store';
import { assembleThunkExtra, inertPwaPort } from '../../../src/app/thunkExtra';
import { fakeDealService, type FakeDealService } from '../../fixtures/dealService';
import { makeState } from '../../fixtures/states';

const REQUEST = { mode: 'draw1', winnableOnly: false } as const;

describe('assembleThunkExtra', () => {
    let real: FakeDealService;
    let createDealService: ReturnType<typeof vi.fn<(options: { now: () => Date }) => FakeDealService>>;

    beforeEach(() => {
        real = fakeDealService();
        createDealService = vi.fn<(options: { now: () => Date }) => FakeDealService>(() => real);
    });

    it('does not create the real deal service until it is used', () => {
        const extra = assembleThunkExtra({}, createDealService);

        expect(createDealService).not.toHaveBeenCalled();

        void extra.dealService.deal(REQUEST);

        expect(createDealService).toHaveBeenCalledTimes(1);
        expect(real.requests).toHaveLength(1);
    });

    it('creates the real deal service for a hint too, and only once', async () => {
        const extra = assembleThunkExtra({}, createDealService);

        await extra.dealService.hint(makeState());
        void extra.dealService.deal(REQUEST);

        expect(createDealService).toHaveBeenCalledTimes(1);
    });

    it('never creates the real deal service when it is disposed before use', () => {
        const extra = assembleThunkExtra({}, createDealService);

        extra.dealService.dispose();
        extra.dealService.dispose();

        expect(createDealService).not.toHaveBeenCalled();
        expect(real.disposed).toBe(false);
    });

    it('disposes the real deal service that was created, then creates a new one on next use', () => {
        const extra = assembleThunkExtra({}, createDealService);
        void extra.dealService.deal(REQUEST);

        extra.dealService.dispose();

        expect(real.disposed).toBe(true);

        void extra.dealService.deal(REQUEST);

        expect(createDealService).toHaveBeenCalledTimes(2);
    });

    it('supplies the real clock, timer and date', async () => {
        const extra = assembleThunkExtra();

        expect(typeof extra.now()).toBe('number');
        expect(extra.today()).toBeInstanceOf(Date);
        await expect(extra.delay(0)).resolves.toBeUndefined();
    });

    it('supplies an unconnected save port, an inert PWA port and the browser languages', async () => {
        const extra = assembleThunkExtra();

        expect(() => {
            extra.saver.flush();
            extra.saver.flushQuietly();
            extra.saver.cancel();
        }).not.toThrow();
        await expect(extra.pwa.promptInstall()).resolves.toBe('unavailable');
        expect(extra.languages()).toBe(navigator.languages);
    });

    it('lets every override win over its default', async () => {
        const overrides = {
            now: () => 42,
            delay: () => Promise.resolve(),
            today: () => new Date(Date.UTC(2026, 8, 20)),
            languages: () => ['uk-UA'],
            pwa: { ...inertPwaPort(), promptInstall: () => Promise.resolve('accepted' as const) },
            dealService: fakeDealService(),
        };
        const extra = assembleThunkExtra(overrides, createDealService);

        expect(extra.now()).toBe(42);
        expect(extra.today()).toEqual(new Date(Date.UTC(2026, 8, 20)));
        expect(extra.languages()).toEqual(['uk-UA']);
        await expect(extra.pwa.promptInstall()).resolves.toBe('accepted');
        expect(extra.dealService).toBe(overrides.dealService);
        expect(extra.delay).toBe(overrides.delay);
    });
});

describe('the default deal service clock (D8)', () => {
    let real: FakeDealService;
    let createDealService: ReturnType<typeof vi.fn<(options: { now: () => Date }) => FakeDealService>>;

    beforeEach(() => {
        real = fakeDealService();
        createDealService = vi.fn<(options: { now: () => Date }) => FakeDealService>(() => real);
    });

    it('feeds the assembled today into the lazy deal service', () => {
        const extra = assembleThunkExtra({}, createDealService);

        void extra.dealService.deal(REQUEST);

        const passedNow = createDealService.mock.calls[0]?.[0].now;
        expect(passedNow?.()).toEqual(extra.today());
    });

    it('reads an injected today at call time, not when the extra was assembled', () => {
        let current = new Date(Date.UTC(2026, 8, 20));
        const extra = assembleThunkExtra({ today: () => current }, createDealService);

        void extra.dealService.deal(REQUEST);

        const passedNow = createDealService.mock.calls.at(-1)?.[0].now;
        expect(passedNow?.()).toEqual(current);

        current = new Date(Date.UTC(2026, 8, 21));
        expect(passedNow?.()).toEqual(current);
    });

    it('createAppStore uses an injected deal service exactly as given', () => {
        const dealService = fakeDealService();
        const store = createAppStore({ deps: { dealService } });
        const extra = store.dispatch((_dispatch, _getState, injected) => injected);

        expect(extra.dealService).toBe(dealService);
    });
});
