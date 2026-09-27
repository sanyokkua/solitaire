import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useAppSelector } from '../../app/hooks';
import { selectEpoch, selectReducedMotion } from '../../app/selectors';
import type { CardId, GameState } from '../../domain/types';
import { playCascade, type CascadePlayback } from './cascade';
import { cascadeFrames } from './cascadeFrames';
import type { Point } from './layout';
import type { BoardSize } from './metrics';

interface CascadeInput {
    /** The `div.board` the cards fly on; `null` until the first size arrives. */
    readonly boardRef: RefObject<HTMLDivElement | null>;
    /** The board and its cards are rendered. */
    readonly ready: boolean;
    /** Each card's top left position on the board (empty while there is no layout). */
    readonly starts: ReadonlyMap<CardId, Point>;
    /** The board size (`null` until known). */
    readonly size: BoardSize | null;
    /** The card size in px (`null` until known). */
    readonly card: { readonly cw: number; readonly ch: number } | null;
}

/** What the last effect run saw, so the next run can tell a win from a change of game. */
interface Seen {
    readonly epoch: number;
    readonly status: GameState['status'] | null;
}

/**
 * The win cascade: plays once when the game of the same epoch turns from playing to won, unless motion is reduced
 * (the win is announced either way) or the board is not rendered. A new epoch (a new deal, a cleared game, a
 * restored game that is already won) never starts one and cancels one that runs; so does leaving. The effect is keyed
 * on `[epoch, status]` only and reads everything else from a ref refreshed each render, so a resize or a motion
 * change mid-cascade neither cancels nor restarts it. It dispatches nothing and keeps no store state: the win already
 * closes the input gate.
 */
export function useCascade(input: CascadeInput): void {
    const epoch = useAppSelector(selectEpoch);
    // Not `selectCurrentGame`: that returns the whole game, which is replaced on every clock tick.
    const status = useAppSelector((state) => state.game.current?.status ?? null);
    const reducedMotion = useAppSelector(selectReducedMotion);
    const latest = useRef({ ...input, reducedMotion });
    const seen = useRef<Seen | null>(null);
    const playback = useRef<CascadePlayback | null>(null);

    // Declared before the cascade effect so it reads the values of this very commit.
    useLayoutEffect(() => {
        latest.current = { ...input, reducedMotion };
    });

    useLayoutEffect(() => {
        const previous = seen.current;
        seen.current = { epoch, status };
        if (previous === null) return;
        if (previous.epoch !== epoch) {
            playback.current?.cancel();
            playback.current = null;
            return;
        }
        const { boardRef, ready, starts, size, card, reducedMotion: reduced } = latest.current;
        const boardEl = boardRef.current;
        if (previous.status === 'won' || status !== 'won' || !ready || reduced || boardEl === null) return;
        if (size === null || card === null) return;
        // The paths are a visual effect only, so they draw from `Math.random`; the pure frames take any source.
        playback.current = playCascade(boardEl, cascadeFrames(starts, size, card, Math.random));
    }, [epoch, status]);

    useEffect(
        () => () => {
            playback.current?.cancel();
            playback.current = null;
        },
        [],
    );
}
