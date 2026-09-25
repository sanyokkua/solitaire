import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
