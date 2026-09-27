import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import type { BoardSize } from './metrics';

/**
 * Lays every size out with transitions off for one frame, so cards jump instead of gliding (D8). The first size
 * counts, so nothing glides from the table's corner. The flag is `data-resizing` on the board element; nothing
 * happens while that element is not mounted. Call it before `useDealAnimation`: `playDeal`'s release removes the
 * flag again, so a deal due at the first size still glides.
 */
export function useResizeSettle(boardRef: RefObject<HTMLDivElement | null>, size: BoardSize | null): void {
    useLayoutEffect(() => {
        const boardEl = boardRef.current;
        if (boardEl === null) return undefined;
        boardEl.setAttribute('data-resizing', 'true');
        const frame = requestAnimationFrame(() => {
            boardEl.removeAttribute('data-resizing');
        });
        return () => {
            cancelAnimationFrame(frame);
        };
    }, [boardRef, size]);
}
