import type { CardId, GameEvent, PileRef, RejectReason } from '../../domain/types';

/**
 * What happened at the table, as data (D6): the log the screen-reader announcer reads. A descriptor carries no text;
 * `src/ui/announce.ts` words it, so the language is a matter for that formatter alone.
 */
export type Announcement =
    | { readonly type: 'moved'; readonly cards: readonly CardId[]; readonly from: PileRef; readonly to: PileRef }
    | { readonly type: 'drew'; readonly count: number }
    | { readonly type: 'recycled' }
    | { readonly type: 'undone' }
    | { readonly type: 'redone' }
    | {
          readonly type: 'hinted';
          readonly kind: 'move' | 'draw' | 'recycle';
          readonly cards: readonly CardId[];
          readonly target: PileRef | 'stock';
      }
    | { readonly type: 'refused'; readonly reason: RejectReason }
    | { readonly type: 'deadEnd' }
    | { readonly type: 'sentHome'; readonly count: number }
    | { readonly type: 'won' }
    | { readonly type: 'codeCopied' };

/**
 * The announcements for what the engine reported, in event order. A flip is the consequence of a move and is never
 * announced on its own; a refusal announces its reason.
 */
export function announcementsOf(events: readonly GameEvent[]): Announcement[] {
    return events.flatMap((event): Announcement[] => {
        switch (event.type) {
            case 'moved':
                return [{ type: 'moved', cards: event.cards, from: event.from, to: event.to }];
            case 'drew':
                return [{ type: 'drew', count: event.count }];
            case 'recycled':
                return [{ type: 'recycled' }];
            case 'rejected':
                return [{ type: 'refused', reason: event.reason }];
            case 'won':
                return [{ type: 'won' }];
            case 'flipped':
                return [];
        }
    });
}
