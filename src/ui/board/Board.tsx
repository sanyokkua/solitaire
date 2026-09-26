import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useAppSelector } from '../../app/hooks';
import { DECK_SIZE, FOUNDATION_DISPLAY_ORDER } from '../../domain/cards';
import type { CardId, TableauCol } from '../../domain/types';
import { selectReducedMotion } from '../../app/selectors';
import { selectPreference } from '../../features/preferences/preferencesSlice';
import { useMediaQuery } from '../useMediaQuery';
import { playDeal } from './animations';
import { CardView } from './CardView';
import { positions, type BoardPiles } from './layout';
import { DealtEpochContext } from './DealtEpochContext';
import { measure } from './metrics';
import { PileSlot } from './PileSlot';
import { selectBoardPiles, selectStockSpent } from './selectors';
import { StockBadge } from './StockBadge';
import { useBoardSize } from './useBoardSize';

/** The corner radius never drops below this many px. */
const CARD_RADIUS_MIN_PX = 5;
/** The corner radius as a fraction of the card width. */
const CARD_RADIUS_FACTOR = 0.09;
/** Card ids in id order, so the DOM order never changes; every card gets one persistent element. */
const CARD_IDS: readonly CardId[] = Array.from({ length: DECK_SIZE }, (_, id) => id);
/** The tableau columns, left to right. */
const TABLEAU_COLS: readonly TableauCol[] = [0, 1, 2, 3, 4, 5, 6];
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
    const epoch = useAppSelector((state) => state.game.epoch);
    const started = useAppSelector((state) => state.game.current?.started ?? null);
    const reducedMotion = useAppSelector(selectReducedMotion);
    const dealtEpoch = useContext(DealtEpochContext);
    const boardRef = useRef<HTMLDivElement>(null);
    const dealOrderRef = useRef<readonly CardId[]>([]);
    const shown = piles ?? EMPTY_PILES;
    const metrics = useMemo(() => (size === null ? null : measure(size, { coarse })), [size, coarse]);
    const layout = useMemo(
        () => (metrics === null ? null : positions(shown, metrics, { stockRight })),
        [shown, metrics, stockRight],
    );

    const ready = layout !== null && piles !== null;

    // Every size, the first included, is laid out with transitions off for one frame, so cards jump instead of
    // gliding (D8). Declared before the deal effect: `playDeal`'s release removes the flag again, so a deal due at
    // the first size still glides.
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
    }, [size]);

    // Declared before the deal effect so it reads the deal order of this very commit; `layout` itself is not a
    // dependency of the deal effect, so a resize never replays the deal.
    useLayoutEffect(() => {
        dealOrderRef.current = layout?.dealOrder ?? [];
    });

    // A fresh deal plays once per epoch and only while the game has not started (D5).
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
    }, [epoch, started, ready, reducedMotion, dealtEpoch]);

    return (
        <div className="board-panel" ref={ref}>
            {metrics !== null && layout !== null ? (
                <div
                    className="board"
                    ref={boardRef}
                    data-wide={metrics.wide}
                    style={
                        {
                            '--stock-x': `${String(layout.slots.stock.x)}px`,
                            '--stock-y': `${String(layout.slots.stock.y)}px`,
                            '--cw': `${String(metrics.cw)}px`,
                            '--ch': `${String(metrics.ch)}px`,
                            '--cr': `${String(Math.max(CARD_RADIUS_MIN_PX, metrics.cw * CARD_RADIUS_FACTOR))}px`,
                        } as CSSProperties
                    }
                >
                    <PileSlot
                        pile={{ pile: 'stock' }}
                        count={shown.stock.length}
                        x={layout.slots.stock.x}
                        y={layout.slots.stock.y}
                        spent={spent}
                    />
                    {FOUNDATION_DISPLAY_ORDER.map((suit, slot) => (
                        <PileSlot
                            key={suit}
                            pile={{ pile: 'foundation', suit }}
                            count={shown.foundations[suit].length}
                            x={layout.slots.foundations[slot]?.x ?? 0}
                            y={layout.slots.foundations[slot]?.y ?? 0}
                        />
                    ))}
                    {TABLEAU_COLS.map((col) => (
                        <PileSlot
                            key={col}
                            pile={{ pile: 'tableau', col }}
                            count={shown.tableau[col].length}
                            x={layout.slots.tableau[col]?.x ?? 0}
                            y={layout.slots.tableau[col]?.y ?? 0}
                        />
                    ))}
                    <StockBadge count={shown.stock.length} x={layout.badge.x} y={layout.badge.y} />
                    {piles === null
                        ? null
                        : CARD_IDS.map((id) => {
                              const placement = layout.cards.get(id);
                              return placement === undefined ? null : (
                                  <CardView
                                      key={id}
                                      id={id}
                                      x={placement.x}
                                      y={placement.y}
                                      z={placement.z}
                                      faceUp={placement.faceUp}
                                      buried={placement.buried}
                                      compact={metrics.compact}
                                  />
                              );
                          })}
                </div>
            ) : null}
        </div>
    );
}
