import { describe, expect, it } from 'vitest';
import { dealCodeCopied } from '../../../../src/features/interaction/interactionThunks';
import { selectAnnouncement } from '../../../../src/features/interaction/selectors';
import { testStore } from '../../../support/testStore';

describe('dealCodeCopied', () => {
    it('raises the code-copied notice and announces codeCopied together, in one dispatch', () => {
        const store = testStore();

        store.dispatch(dealCodeCopied());

        expect(store.getState().app.notices.map(({ id }) => id)).toEqual(['code-copied']);
        expect(selectAnnouncement(store.getState()).items.map(({ item }) => item.type)).toEqual(['codeCopied']);
    });

    it('raises the notice only once when dispatched twice, but announces every time', () => {
        const store = testStore();

        store.dispatch(dealCodeCopied());
        store.dispatch(dealCodeCopied());

        expect(store.getState().app.notices.map(({ id }) => id)).toEqual(['code-copied']);
        expect(selectAnnouncement(store.getState()).items.map(({ item }) => item.type)).toEqual([
            'codeCopied',
            'codeCopied',
        ]);
    });
});
