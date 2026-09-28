import { createSelector } from '@reduxjs/toolkit';
import { groupAt, legalTargets } from '../../domain/rules';
import type { CardId, PileRef } from '../../domain/types';
import type { AppState } from '../../app/appSlice';
import type { GameSliceState } from '../game/gameSlice';
import type {
    AnnouncementLog,
    HintView,
    InteractionState,
    PendingHint,
    Selection,
    WinSummary,
} from './interactionSlice';

/** The structural slice of the store the interaction selectors read, so this module needs no store import. */
interface InteractionRoot {
    readonly game: GameSliceState;
    readonly interaction: InteractionState;
}

/** What the input gate reads: the shell (route, sheet, dealing) and the game session. */
interface GateRoot {
    readonly app: AppState;
    readonly game: GameSliceState;
}

/** The picked-up card, or `null` when nothing is picked up. It may no longer apply to the position: see `selectSelectedGroup`. */
export function selectSelection({ interaction }: InteractionRoot): Selection | null {
    return interaction.selection;
}

/** The announcement log: what happened at the table, numbered, for the announcer to speak. */
export function selectAnnouncement({ interaction }: InteractionRoot): AnnouncementLog {
    return interaction.announcement;
}

/** The hint on show, or `null`. */
export function selectHint({ interaction }: InteractionRoot): HintView | null {
    return interaction.hint;
}

/** The hint request in flight, or `null`. */
export function selectPendingHint({ interaction }: InteractionRoot): PendingHint | null {
    return interaction.pendingHint;
}

/** The id the next hint takes: one more than any hint shown so far in this session. */
export function selectNextHintId({ interaction }: InteractionRoot): number {
    return interaction.lastHintId + 1;
}

/** The just-won game's outcome, or `null`. Cleared when a new deal is installed or the game is cleared. */
export function selectWinSummary({ interaction }: InteractionRoot): WinSummary | null {
    return interaction.win;
}

/**
 * The run of cards the selection names in the position in play, or `undefined` when nothing is selected, no game is in
 * play, or the card is no longer a movable one. Recomputed only when the selection or the position changes.
 */
export const selectSelectedGroup = createSelector(
    [selectSelection, ({ game }: InteractionRoot) => game.current],
    (selection, current): readonly CardId[] | undefined =>
        selection === null || current === null ? undefined : groupAt(current, selection.from, selection.index),
);

/** Where the selected run may legally go, or `undefined` when there is no selected run. Stable until the selection or position changes. */
export const selectLegalTargets = createSelector(
    [selectSelection, selectSelectedGroup, ({ game }: InteractionRoot) => game.current],
    (selection, group, current): readonly PileRef[] | undefined =>
        selection === null || group === undefined || current === null
            ? undefined
            : legalTargets(current, group, selection.from),
);

/**
 * The input gate (D2): whether the board accepts input. Closed away from the Game route, while a deal is being
 * prepared, while a sheet is open, when there is no game, once the game is won (which covers the whole win cascade,
 * and Undo and Redo are unavailable after a win too, so the frozen board needs no more state), and while a safe-card
 * chain or Finish is running. Pointer, keyboard and the toolbar's Hint and Finish all read this one selector.
 */
export function selectInputEnabled({ app, game }: GateRoot): boolean {
    return (
        app.route === 'game' &&
        app.dealing === null &&
        app.sheet === null &&
        game.current !== null &&
        game.current.status !== 'won' &&
        !game.busy
    );
}
