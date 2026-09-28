import { useMemo, useRef } from 'react';
import { useAppSelector } from '../../app/hooks';
import { DECK_SIZE, FOUNDATION_DISPLAY_ORDER, TABLEAU_COLS } from '../../domain/cards';
import type { CardId } from '../../domain/types';
import { selectHint, selectSelectedGroup } from '../../features/interaction/selectors';
import { selectPreference } from '../../features/preferences/preferencesSlice';
import { DealingOverlay } from '../components/DealingOverlay';
import { useMediaQuery } from '../useMediaQuery';
import { CardView } from './CardView';
import { CARD_RADIUS_FACTOR } from './constants';
import { Ghosts } from './Ghosts';
import { positions, type BoardPiles, type Point } from './layout';
import { measure } from './metrics';
import { PileSlot } from './PileSlot';
import { pileKey } from './landing';
import { selectBoardPiles, selectCardLocations, selectStockSpent } from './selectors';
import { StockBadge } from './StockBadge';
import { boardStyle, px } from './style';
import { useBoardSize } from './useBoardSize';
import { useDealAnimation } from './useDealAnimation';
import { useBoardActions } from './useBoardActions';
import { tabIndexOf, useBoardKeyboard } from './useBoardKeyboard';
import { useBoardPointer } from './useBoardPointer';
import { useCascade } from './useCascade';
import { useResizeSettle } from './useResizeSettle';
import { useWinSheet } from './useWinSheet';

/** The corner radius never drops below this many px. */
const CARD_RADIUS_MIN_PX = 5;
/** Card ids in id order, so the DOM order never changes; every card gets one persistent element. */
const CARD_IDS: readonly CardId[] = Array.from({ length: DECK_SIZE }, (_, id) => id);
/** The deal order of no layout. */
const NO_DEAL_ORDER: readonly CardId[] = [];
/** The piles of no game, so the slots still render. */
const EMPTY_PILES: BoardPiles = {
    tableau: [[], [], [], [], [], [], []],
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    draw: 1,
};

/**
 * The table: a panel measured by `useBoardSize` holding the pile slots, the stock badge and, while a game is in
 * play, one persistent `CardView` per card in card-id order, so a move only changes a card's inline position. Nothing
 * renders inside the panel until its first size arrives.
 */
export function Board() {
    const { ref, size } = useBoardSize();
    const coarse = useMediaQuery('(pointer: coarse)');
    const stockRight = useAppSelector((state) => selectPreference(state, 'stockRight'));
    const piles = useAppSelector(selectBoardPiles);
    const spent = useAppSelector(selectStockSpent);
    const locations = useAppSelector(selectCardLocations);
    const selectedGroup = useAppSelector(selectSelectedGroup);
    const selectedIds = useMemo(() => new Set(selectedGroup ?? []), [selectedGroup]);
    const hint = useAppSelector(selectHint);
    const hintedIds = useMemo(() => new Set(hint?.kind === 'move' ? hint.cards : []), [hint]);
    const stockHinted = hint !== null && hint.kind !== 'move';
    const boardRef = useRef<HTMLDivElement>(null);
    const shown = piles ?? EMPTY_PILES;
    const metrics = useMemo(() => (size === null ? null : measure(size, { coarse })), [size, coarse]);
    const layout = useMemo(
        () => (metrics === null ? null : positions(shown, metrics, { stockRight })),
        [shown, metrics, stockRight],
    );

    const ready = layout !== null && piles !== null;
    const starts = useMemo(() => {
        const points = new Map<CardId, Point>();
        layout?.cards.forEach(({ x, y }, id) => points.set(id, { x, y }));
        return points;
    }, [layout]);

    // Order matters: `useDealAnimation`'s release removes the resize flag, so a deal due at the first size still glides,
    // and a new deal must find the cascade already cancelled, or its park would not take hold and it would not start
    // from the stock.
    useResizeSettle(boardRef, size);
    useCascade({
        boardRef,
        ready,
        starts,
        size,
        card: metrics === null ? null : { cw: metrics.cw, ch: metrics.ch },
    });
    useWinSheet();
    useDealAnimation({ boardRef, ready, dealOrder: layout?.dealOrder ?? NO_DEAL_ORDER });
    const { activate, pickUp } = useBoardActions(boardRef);
    useBoardPointer({ boardRef, layout, metrics, piles, activate });
    const { target, handlers } = useBoardKeyboard({ boardRef, piles, stockRight, activate, pickUp });

    return (
        <div className="board-panel" ref={ref}>
            {metrics !== null && layout !== null ? (
                <div
                    className="board"
                    ref={boardRef}
                    data-wide={metrics.wide}
                    {...handlers}
                    style={boardStyle({
                        '--stock-x': px(layout.slots.stock.x),
                        '--stock-y': px(layout.slots.stock.y),
                        '--cw': px(metrics.cw),
                        '--ch': px(metrics.ch),
                        '--cr': px(Math.max(CARD_RADIUS_MIN_PX, metrics.cw * CARD_RADIUS_FACTOR)),
                    })}
                >
                    <PileSlot
                        pile={{ pile: 'stock' }}
                        count={shown.stock.length}
                        x={layout.slots.stock.x}
                        y={layout.slots.stock.y}
                        spent={spent}
                        hinted={stockHinted}
                        tabIndex={tabIndexOf(target, { pile: 'stock' }, null)}
                    />
                    {FOUNDATION_DISPLAY_ORDER.map((suit, slot) => (
                        <PileSlot
                            key={suit}
                            pile={{ pile: 'foundation', suit }}
                            count={shown.foundations[suit].length}
                            x={layout.slots.foundations[slot]?.x ?? 0}
                            y={layout.slots.foundations[slot]?.y ?? 0}
                            tabIndex={tabIndexOf(target, { pile: 'foundation', suit }, null)}
                        />
                    ))}
                    {TABLEAU_COLS.map((col) => (
                        <PileSlot
                            key={col}
                            pile={{ pile: 'tableau', col }}
                            count={shown.tableau[col].length}
                            x={layout.slots.tableau[col]?.x ?? 0}
                            y={layout.slots.tableau[col]?.y ?? 0}
                            tabIndex={tabIndexOf(target, { pile: 'tableau', col }, null)}
                        />
                    ))}
                    <StockBadge count={shown.stock.length} x={layout.badge.x} y={layout.badge.y} />
                    {piles === null
                        ? null
                        : CARD_IDS.map((id) => {
                              const placement = layout.cards.get(id);
                              const location = locations?.get(id);
                              return placement === undefined || location === undefined ? null : (
                                  <CardView
                                      key={id}
                                      id={id}
                                      x={placement.x}
                                      y={placement.y}
                                      z={placement.z}
                                      pile={pileKey(location.from)}
                                      index={location.index}
                                      faceUp={placement.faceUp}
                                      buried={placement.buried}
                                      compact={metrics.compact}
                                      selected={selectedIds.has(id)}
                                      hinted={hintedIds.has(id)}
                                      movable={location.movable}
                                      tabIndex={tabIndexOf(target, location.from, location.index)}
                                  />
                              );
                          })}
                    {piles === null ? null : <Ghosts layout={layout} metrics={metrics} piles={piles} />}
                </div>
            ) : null}
            <DealingOverlay />
        </div>
    );
}
