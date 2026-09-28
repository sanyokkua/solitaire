import type { CardId } from '../../domain/types';

/**
 * Looks up a card's persistent DOM element inside `root` by its `data-card-id`, or `null` when the card is not
 * rendered (D15): the one card-id lookup `animations.ts`, `cascade.ts`, `useBoardActions.ts` and `useBoardPointer.ts`
 * shared, folded here so it is typed once.
 */
export function cardElement(root: ParentNode, id: CardId): HTMLElement | null {
    return root.querySelector<HTMLElement>(`[data-card-id='${String(id)}']`);
}
