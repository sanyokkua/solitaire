import { useAppDispatch } from '../app/hooks';
import { todayKey } from '../features/stats/statsThunks';

/** The UTC day key from the injected clock (D8), read fresh on every render via the dispatched `todayKey()` thunk. */
export function useToday(): string {
    const dispatch = useAppDispatch();
    return dispatch(todayKey());
}
