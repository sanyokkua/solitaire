import { suitOf, TABLEAU_COLS } from './cards';
import { canDrop, column, groupAt } from './rules';
import type { GameState, PileRef, TableauCol } from './types';

/** Column order of a smart tap's non-empty search: right of a tableau source, wrapping, skipping it; else 0→6. */
function relativeScan(from: PileRef): readonly TableauCol[] {
    if (from.pile !== 'tableau') return TABLEAU_COLS;
    const source = from.col;
    return [...TABLEAU_COLS.slice(source + 1), ...TABLEAU_COLS.slice(0, source)];
}

/**
 * The single destination a smart tap (or its keyboard and double-activation equivalents) sends the group at `index`
 * of `from` to, or `undefined` when nothing accepts it. The choice is, in order: the group's foundation (a single
 * card not already on a foundation), the first non-empty column that accepts it, then the first empty column for a
 * King that is not already at its column base. The non-empty search deliberately replaces the canonical destination
 * order: it scans from the column right of the source, wrapping around, or from column 0 for a waste or foundation
 * source. The empty-column search always counts from column 0.
 */
export function bestTarget(state: GameState, from: PileRef, index: number): PileRef | undefined {
    const group = groupAt(state, from, index);
    const lowest = group?.[0];
    if (group === undefined || lowest === undefined) return undefined;
    if (from.pile !== 'foundation') {
        const foundation: PileRef = { pile: 'foundation', suit: suitOf(lowest) };
        if (canDrop(state, group, foundation)) return foundation;
    }
    const occupied = relativeScan(from).find(
        (col) => column(state, col).length > 0 && canDrop(state, group, { pile: 'tableau', col }),
    );
    if (occupied !== undefined) return { pile: 'tableau', col: occupied };
    if (from.pile === 'tableau' && index === 0) return undefined; // already at the base of its column
    // An empty column accepts only a King, so `canDrop` doubles as the King test.
    const empty = TABLEAU_COLS.find(
        (col) => column(state, col).length === 0 && canDrop(state, group, { pile: 'tableau', col }),
    );
    return empty === undefined ? undefined : { pile: 'tableau', col: empty };
}
