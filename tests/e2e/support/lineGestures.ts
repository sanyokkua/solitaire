import type { Command } from '../../../src/domain/types';
import { pileKey } from '../../../src/ui/board/landing';
import { pileOrder } from '../../../src/ui/board/keyboardController';

/** A pile as the board names it in `data-pile`: `stock`, `waste`, `foundation:<suit>` or `tableau:<col>`. */
export type PileKey = string;

/** What one command of a recorded line asks the player to do, independent of how it is performed. */
export type GesturePlan =
    | { readonly kind: 'draw' }
    | { readonly kind: 'move'; readonly from: PileKey; readonly index: number; readonly to: PileKey };

/** Tab and arrow order of the piles on the default (stacked) board, as `data-pile` values. */
export const PILE_ORDER: readonly PileKey[] = pileOrder(false).map(pileKey);

/** Translates a line command into a gesture plan. A draw and a recycle are both a stock draw. */
export function planCommand(command: Command): GesturePlan {
    switch (command.type) {
        case 'draw':
            return { kind: 'draw' };
        case 'move':
            return { kind: 'move', from: pileKey(command.from), index: command.index, to: pileKey(command.to) };
        case 'autoFoundation':
            throw new Error('the recorded line has no autoFoundation command, so no gesture is defined for it');
    }
}

/** The arrow that moves focus from pile `current` towards pile `target`, or `null` when already there. */
export function horizontalKey(current: PileKey, target: PileKey): 'ArrowLeft' | 'ArrowRight' | null {
    const from = PILE_ORDER.indexOf(current);
    const to = PILE_ORDER.indexOf(target);
    if (from < 0 || to < 0) throw new Error(`unknown pile: ${from < 0 ? current : target}`);
    if (from === to) return null;
    return to > from ? 'ArrowRight' : 'ArrowLeft';
}

/** The arrow that steps focus within a column from card `currentIndex` to `targetIndex`, or `null` at the target. */
export function verticalKey(currentIndex: number, targetIndex: number): 'ArrowUp' | 'ArrowDown' | null {
    if (currentIndex === targetIndex) return null;
    return targetIndex > currentIndex ? 'ArrowDown' : 'ArrowUp';
}
