import { describe, expect, it } from 'vitest';
import { todayKey } from '../../../../src/features/stats/statsThunks';
import { testStore } from '../../../support/testStore';

describe('todayKey', () => {
    it('returns the UTC day key of the injected clock, not the local one', () => {
        // 04:30 UTC on 20 September is 23:30 on 19 September in UTC−5; the key must still be the UTC day's.
        const instant = new Date('2026-09-20T04:30:00.000Z');
        const store = testStore({ deps: { today: () => instant } });

        expect(store.dispatch(todayKey())).toBe('2026-09-20');
    });
});
