import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../../../src/app/store';
import { defaultThunkExtra } from '../../../src/app/thunkExtra';
import { createDealService } from '../../../src/features/deal/dealService';
import { fakeDealService, type FakeDealService } from '../../fixtures/dealService';
import { makeState } from '../../fixtures/states';

vi.mock('../../../src/features/deal/dealService', () => ({ createDealService: vi.fn() }));

const REQUEST = { mode: 'draw1', winnableOnly: false } as const;

describe('defaultThunkExtra', () => {
    let real: FakeDealService;

    beforeEach(() => {
        real = fakeDealService();
        vi.mocked(createDealService).mockReset().mockReturnValue(real);
    });

    it('does not create the real deal service until it is used', () => {
        const extra = defaultThunkExtra();

        expect(createDealService).not.toHaveBeenCalled();

        void extra.dealService.deal(REQUEST);

        expect(createDealService).toHaveBeenCalledTimes(1);
        expect(real.requests).toHaveLength(1);
    });

    it('creates the real deal service for a hint too, and only once', async () => {
        const extra = defaultThunkExtra();

        await extra.dealService.hint(makeState());
        void extra.dealService.deal(REQUEST);

        expect(createDealService).toHaveBeenCalledTimes(1);
    });

    it('never creates the real deal service when it is disposed before use', () => {
        const extra = defaultThunkExtra();

        extra.dealService.dispose();
        extra.dealService.dispose();

        expect(createDealService).not.toHaveBeenCalled();
        expect(real.disposed).toBe(false);
    });

    it('disposes the real deal service that was created, then creates a new one on next use', () => {
        const extra = defaultThunkExtra();
        void extra.dealService.deal(REQUEST);

        extra.dealService.dispose();

        expect(real.disposed).toBe(true);

        void extra.dealService.deal(REQUEST);

        expect(createDealService).toHaveBeenCalledTimes(2);
    });

    it('supplies the real clock, timer and date', async () => {
        const extra = defaultThunkExtra();

        expect(typeof extra.now()).toBe('number');
        expect(extra.today()).toBeInstanceOf(Date);
        await expect(extra.delay(0)).resolves.toBeUndefined();
    });

    it('supplies an unconnected save port and the browser languages', () => {
        const extra = defaultThunkExtra();

        expect(() => {
            extra.saver.flush();
            extra.saver.flushQuietly();
            extra.saver.cancel();
        }).not.toThrow();
        expect(extra.languages()).toBe(navigator.languages);
    });
});

describe('the default deal service clock (D8)', () => {
    let real: FakeDealService;

    beforeEach(() => {
        real = fakeDealService();
        vi.mocked(createDealService).mockReset().mockReturnValue(real);
    });

    it('defaultThunkExtra feeds its own today into its lazy deal service', () => {
        const extra = defaultThunkExtra();

        void extra.dealService.deal(REQUEST);

        expect(createDealService).toHaveBeenCalledWith({ now: extra.today });
    });

    it('createAppStore feeds the default deal service an injected today, read at call time, not when the store was built', () => {
        let current = new Date(Date.UTC(2026, 8, 20));
        const store = createAppStore({ deps: { today: () => current } });
        const extra = store.dispatch((_dispatch, _getState, injected) => injected);

        void extra.dealService.deal(REQUEST);

        const passedNow = vi.mocked(createDealService).mock.calls.at(-1)?.[0]?.now;
        expect(passedNow).toBeTypeOf('function');
        expect(passedNow?.()).toEqual(current);

        // Changing what `today` resolves to after the store and the lazy service were built still reaches it.
        current = new Date(Date.UTC(2026, 8, 21));
        expect(passedNow?.()).toEqual(current);
    });

    it('createAppStore uses an injected deal service exactly as given, bypassing the default entirely', () => {
        const dealService = fakeDealService();
        const store = createAppStore({ deps: { dealService, today: () => new Date() } });
        const extra = store.dispatch((_dispatch, _getState, injected) => injected);

        expect(extra.dealService).toBe(dealService);

        void extra.dealService.deal(REQUEST);

        expect(createDealService).not.toHaveBeenCalled();
    });
});
