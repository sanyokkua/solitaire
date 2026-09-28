import { useContext, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useAppSelector } from '../../app/hooks';
import { selectReducedMotion } from '../../app/selectors';
import type { CardId } from '../../domain/types';
import { selectEpoch } from '../../features/game/gameSlice';
import { playDeal } from './animations';
import { DealtEpochContext } from './DealtEpochContext';

interface DealAnimationInput {
    /** The `div.board` the deal parks and releases; `null` until the first size arrives. */
    readonly boardRef: RefObject<HTMLDivElement | null>;
    /** The board and its cards are rendered. */
    readonly ready: boolean;
    /** The deal order of this render's layout (`[]` while there is none). */
    readonly dealOrder: readonly CardId[];
}

/**
 * A fresh deal plays once per epoch and only while the game has not started (D5). The effect claims the epoch in the
 * `DealtEpochContext` store straight away, also under reduced motion (nothing plays, and switching motion on later
 * never replays that deal); otherwise it calls `playDeal`. Its cleanup cancels the deal and, if it had not finished,
 * gives the epoch back, so leaving mid-deal, a StrictMode re-mount or a newer deal all replay from the stock.
 * Without a provider nothing plays.
 */
export function useDealAnimation({ boardRef, ready, dealOrder }: DealAnimationInput): void {
    const epoch = useAppSelector(selectEpoch);
    // Not `selectCurrentGame`: that returns the whole game, which is replaced on every clock tick.
    const started = useAppSelector((state) => state.game.current?.started ?? null);
    const reducedMotion = useAppSelector(selectReducedMotion);
    const dealtEpoch = useContext(DealtEpochContext);
    const dealOrderRef = useRef<readonly CardId[]>([]);

    // Declared before the deal effect so it reads the deal order of this very commit; the order is not a dependency
    // of the deal effect, so a resize never replays the deal.
    useLayoutEffect(() => {
        dealOrderRef.current = dealOrder;
    });

    useLayoutEffect(() => {
        const boardEl = boardRef.current;
        if (dealtEpoch === null || !ready || boardEl === null || started !== false || epoch === dealtEpoch.get()) {
            return undefined;
        }
        const previous = dealtEpoch.get();
        dealtEpoch.set(epoch);
        if (reducedMotion) return undefined;
        const playback = playDeal(boardEl, dealOrderRef.current);
        return () => {
            playback.cancel();
            if (!playback.finished()) dealtEpoch.set(previous);
        };
    }, [boardRef, epoch, started, ready, reducedMotion, dealtEpoch]);
}
