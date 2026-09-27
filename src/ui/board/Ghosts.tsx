import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useAppSelector } from '../../app/hooks';
import type { PileRef } from '../../domain/types';
import { selectHint, selectLegalTargets } from '../../features/interaction/selectors';
import { selectPreference } from '../../features/preferences/preferencesSlice';
import { landingAreas, nextLanding, pileKey } from './landing';
import type { BoardPiles, Layout, Point } from './layout';
import type { Metrics } from './metrics';

interface GhostsProps {
    readonly layout: Layout;
    readonly metrics: Metrics;
    readonly piles: BoardPiles;
}

/**
 * The ghosts: while a run is selected (picked up by a drag, a tap or the keyboard), a dashed outline the size of a
 * card on each pile it may go to, unless the Highlight legal moves preference is off. A column's ghost sits where the
 * next card would land (its slot when empty), a foundation's on its slot. While a hint to move shows, the same kind
 * of outline in amber marks its target pile, whatever the preference says. They are `aria-hidden` and take no pointer
 * input; the drag hook marks the drop target's legal ghost hot through `classList` by its `data-ghost` key, and
 * only visits ghosts that have one, so the hint ghost, which has none, is never touched.
 */
export function Ghosts({ layout, metrics, piles }: GhostsProps) {
    const targets = useAppSelector(selectLegalTargets);
    const highlight = useAppSelector((state) => selectPreference(state, 'highlight'));
    const hint = useAppSelector(selectHint);
    const areas = useMemo(() => landingAreas(layout, metrics, piles), [layout, metrics, piles]);

    const placeAt = (target: PileRef): Point | undefined =>
        target.pile === 'tableau' ? nextLanding(layout, metrics, piles, target.col) : areas.get(pileKey(target));
    const style = (at: Point) => ({ '--x': `${String(at.x)}px`, '--y': `${String(at.y)}px` }) as CSSProperties;

    const hintTarget = hint?.kind === 'move' && hint.target !== 'stock' ? hint.target : undefined;
    const hintAt = hintTarget === undefined ? undefined : placeAt(hintTarget);

    return (
        <>
            {highlight &&
                targets?.map((target) => {
                    const key = pileKey(target);
                    const at = placeAt(target);
                    return at === undefined ? null : (
                        <div key={key} className="ghost" data-ghost={key} aria-hidden="true" style={style(at)} />
                    );
                })}
            {hintTarget !== undefined && hintAt !== undefined && (
                <div
                    key={`hint-${pileKey(hintTarget)}`}
                    className="ghost is-hint"
                    data-hint-ghost={pileKey(hintTarget)}
                    aria-hidden="true"
                    style={style(hintAt)}
                />
            )}
        </>
    );
}
