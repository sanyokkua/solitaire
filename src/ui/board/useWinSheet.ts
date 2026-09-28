import { useEffect, useLayoutEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectReducedMotion } from '../../app/selectors';
import type { GameState } from '../../domain/types';
import { selectEpoch } from '../../features/game/gameSlice';
import { openSheet } from '../../features/game/navigationThunks';

/** The mockup's timing: the Win sheet follows the cascade by this long. */
const WIN_SHEET_DELAY_MS = 2400;

/** What the last effect run saw, so the next run can tell a win from a change of game (mirrors `useCascade`). */
interface Seen {
    readonly epoch: number;
    readonly status: GameState['status'] | null;
}

/**
 * Opens the Win sheet after the cascade (D4, WC "The Win sheet follows the cascade"): reads `selectEpoch` and the
 * game `status` directly, the same anti-re-run technique as `useCascade`, so a clock tick never re-triggers it. When
 * the current epoch turns from playing to won it dispatches `openSheet('win')` 2,400 ms later, or at once with
 * reduced motion. The pending timer is cancelled, with no dispatch, on an epoch change (a new deal or a cleared game,
 * both of which bump the epoch) or on unmount (leaving the Game screen, which unmounts `Board`) — together the only
 * ways the delay needs to be cut short. If another sheet (for example Settings) is still open when the timer fires,
 * `sheetOpened('win')` replaces it, since `app.sheet` holds one id. No new Redux state: a pure timer effect, mounted
 * beside `useCascade` in `Board`.
 */
export function useWinSheet(): void {
    const dispatch = useAppDispatch();
    const epoch = useAppSelector(selectEpoch);
    // Not `selectCurrentGame`: that returns the whole game, which is replaced on every clock tick.
    const status = useAppSelector((state) => state.game.current?.status ?? null);
    const reducedMotion = useAppSelector(selectReducedMotion);
    const latestReducedMotion = useRef(reducedMotion);
    const seen = useRef<Seen | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Declared before the effect below so it reads the value of this very commit, without retriggering that effect.
    useLayoutEffect(() => {
        latestReducedMotion.current = reducedMotion;
    });

    useLayoutEffect(() => {
        const previous = seen.current;
        seen.current = { epoch, status };
        if (timer.current !== null) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        if (previous?.epoch !== epoch) return;
        if (previous.status === 'won' || status !== 'won') return;
        if (latestReducedMotion.current) {
            dispatch(openSheet('win'));
            return;
        }
        timer.current = setTimeout(() => {
            timer.current = null;
            dispatch(openSheet('win'));
        }, WIN_SHEET_DELAY_MS);
    }, [epoch, status, dispatch]);

    useEffect(
        () => () => {
            if (timer.current !== null) clearTimeout(timer.current);
        },
        [],
    );
}
