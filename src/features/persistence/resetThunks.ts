import { dealingEnded, noticeDismissed, setRoute, sheetClosed } from '../../app/appSlice';
import { cleared, countedSet } from '../game/gameSlice';
import type { AppThunk } from '../game/gameThunks';
import { preferencesReset } from '../preferences/preferencesSlice';
import { resolveLocale } from '../preferences/locale';
import { statsReset } from '../stats/statsSlice';
import { persistenceReset } from './persistenceSlice';
import type { PersistenceWriter } from './persistenceWriter';
import { BACKUP_KEY, STORAGE_KEY } from './recordCodec';

/**
 * Clears every statistic: each mode's counts, streaks and bests, and the Daily record (D8). The game in play and the
 * settings are untouched; `counted` is cleared so the current game, if it has started, counts as played again when it
 * next moves. Nothing is written directly; the writer saves the change like any other.
 */
export function resetStatistics(): AppThunk {
    return (dispatch) => {
        dispatch(statsReset());
        dispatch(countedSet(false));
    };
}

/**
 * Restores the app to a first visit (D3, D13): the settings become the defaults with the language chosen from
 * `languages` (as at a first start), the statistics are cleared, the game is dropped (which bumps the epoch, so a
 * running safe-card chain, finish or deal is discarded when it resumes), the route goes Home with no sheet open, the persistence state
 * leaves read-only and forgets its error, and the storage notices are dismissed.
 *
 * Only after all of that does the writer's pending save get cancelled, so neither an older save nor one those
 * dispatches scheduled can write anything back. Then both storage keys, the record and the unreadable-data backup, are
 * removed. A key that cannot be removed does not stop the reset; the in-memory state is already the defaults. Nothing is
 * written until the player next changes something.
 */
export function resetAllLocalData(writer: Pick<PersistenceWriter, 'cancel'>, languages: readonly string[]): AppThunk {
    return (dispatch, _getState, { gateway }) => {
        dispatch(cleared());
        dispatch(dealingEnded());
        dispatch(preferencesReset(resolveLocale(languages)));
        dispatch(statsReset());
        dispatch(setRoute('home'));
        dispatch(sheetClosed());
        dispatch(persistenceReset());
        dispatch(noticeDismissed('storage-read'));
        dispatch(noticeDismissed('storage-read-only'));
        dispatch(noticeDismissed('storage-write'));

        writer.cancel();

        gateway.remove(STORAGE_KEY);
        gateway.remove(BACKUP_KEY);
    };
}
