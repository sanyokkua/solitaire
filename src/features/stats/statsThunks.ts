import type { AppThunk } from '../../app/appThunk';
import { utcDayKey } from '../deal/daily';

/**
 * The UTC day key ("`YYYY-MM-DD`") of the injected clock (D8): the one place outside a deal request that needs
 * "today" shaped as a Daily day key, e.g. the Statistics sheet's current Daily streak (`selectDailyStreak`).
 */
export function todayKey(): AppThunk<string> {
    return (_dispatch, _getState, { today }) => utcDayKey(today());
}
