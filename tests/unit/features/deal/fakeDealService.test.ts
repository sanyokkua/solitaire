import { describe, expect, it } from 'vitest';
import { fakeDealService } from '../../../fixtures/dealService';
import { makeState } from '../../../fixtures/states';

const REQUEST = { mode: 'draw3', winnableOnly: false } as const;

describe('fakeDealService', () => {
    it('records requests and settles them on command', async () => {
        const service = fakeDealService();
        const state = makeState({ seed: 3 });
        const first = service.deal(REQUEST);
        const second = service.deal({ mode: 'daily', winnableOnly: true });
        await expect(first).resolves.toEqual({ status: 'cancelled' });

        service.resolve(1, state, '2026-09-24');

        await expect(second).resolves.toEqual({ status: 'dealt', state, dayKey: '2026-09-24' });
        expect(service.requests.map((recorded) => recorded.request.mode)).toEqual(['draw3', 'daily']);
    });

    it('omits dayKey unless one is given', async () => {
        const service = fakeDealService();
        const outcome = service.deal(REQUEST);

        service.resolve(0, makeState());

        expect(await outcome).not.toHaveProperty('dayKey');
    });

    it('cancels every pending request when a newer deal arrives, like the real service', async () => {
        const service = fakeDealService();
        const first = service.deal(REQUEST);
        const second = service.deal(REQUEST);

        void service.deal(REQUEST);

        await expect(first).resolves.toEqual({ status: 'cancelled' });
        await expect(second).resolves.toEqual({ status: 'cancelled' });
    });

    it('cancels pending requests on dispose and records it', async () => {
        const service = fakeDealService();
        const pending = service.deal(REQUEST);

        service.dispose();

        await expect(pending).resolves.toEqual({ status: 'cancelled' });
        expect(service.disposed).toBe(true);
    });

    it('throws when a request is settled twice or does not exist', () => {
        const service = fakeDealService();
        void service.deal(REQUEST);
        service.resolve(0, makeState());

        expect(() => {
            service.resolve(0, makeState());
        }).toThrow();
        expect(() => {
            service.cancel(0);
        }).toThrow();
        expect(() => {
            service.cancel(5);
        }).toThrow();
    });

    it('reports progress to the request that asked for it', () => {
        const service = fakeDealService();
        const seen: number[] = [];
        void service.deal(REQUEST, (progress) => seen.push(progress.attempt));

        service.progress(0, { overlay: true, attempt: 4 });

        expect(seen).toEqual([4]);
    });

    it('answers a hint with none', async () => {
        await expect(fakeDealService().hint(makeState())).resolves.toEqual({ status: 'none' });
    });
});
