/** The widest a card grows, in px. */
export const MAX_CARD_WIDTH = 104;
/** The narrowest a card shrinks to, in px. */
export const MIN_CARD_WIDTH = 30;
/** Card height as a multiple of card width. */
export const CARD_ASPECT = 1.4;
/** Card heights the stacked geometry needs per column height: the top row plus the tableau, as a card-height ratio. */
export const STACKED_ROWS = 3.1;
/** Card heights the wide geometry needs per column height: the tableau alone, as a card-height ratio. */
export const WIDE_ROWS = 2.5;
/** Tableau step of a face-down card, as a fraction of the card height. */
export const FACE_DOWN_STEP = 0.11;
/** Tableau step of a face-up card with a fine pointer, as a fraction of the card height. */
export const FACE_UP_STEP = 0.27;
/** Tableau step of a face-up card with a coarse pointer, as a fraction of the card height. */
export const FACE_UP_STEP_COARSE = 0.3;
/** The smallest tableau step a squeezed face-down card keeps, as a fraction of the card height. */
export const MIN_FACE_DOWN_STEP = 0.04;
/** The face-up strip a finger needs, in px; a stacked strip below it lets the wide table win. */
export const STRIP_MIN_COARSE = 14;
/** The face-up strip a mouse needs, in px. */
export const STRIP_MIN_FINE = 9;
/** Cards narrower than this many px are compact. */
export const COMPACT_BELOW = 70;
/** Boards narrower than this many px use the small padding and gap minimums. */
export const SMALL_BOARD = 520;
/** Padding minimum on a small board, in px. */
export const PAD_MIN_SMALL = 4;
/** Padding minimum on a larger board, in px. */
export const PAD_MIN = 8;
/** Padding maximum, in px. */
export const PAD_MAX = 18;
/** Padding as a fraction of the board width. */
export const PAD_FACTOR = 0.022;
/** Column gap minimum on a small board, in px. */
export const GAP_MIN_SMALL = 3;
/** Column gap minimum on a larger board, in px. */
export const GAP_MIN = 4;
/** Column gap maximum, in px. */
export const GAP_MAX = 14;
/** Column gap as a fraction of the board width. */
export const GAP_FACTOR = 0.016;
/** The row gap between the top row and the tableau, as a multiple of the column gap. */
export const ROW_GAP_FACTOR = 1.4;
/** The row gap minimum, in px. */
export const ROW_GAP_MIN = 10;

/** Face-down cards in the worst-case column. */
const WORST_FACE_DOWN = 6;
/** Face-up steps in the worst-case column (13 face-up cards have 12 steps between them). */
const WORST_FACE_UP_STEPS = 12;
/** Columns of the stacked geometry. */
const STACKED_COLUMNS = 7;
/** Columns of the wide geometry: the tableau plus a side column on each side. */
const WIDE_COLUMNS = 9;

/** A board's inner size in px. */
export interface BoardSize {
    readonly width: number;
    readonly height: number;
}

/** The measured table: sizes, spacing and the chosen geometry for one board size and pointer type. */
export interface Metrics {
    /** Board width in px. */
    width: number;
    /** Board height in px. */
    height: number;
    /** Padding around the table in px. */
    pad: number;
    /** Gap between columns in px. */
    gap: number;
    /** Card width in px. */
    cw: number;
    /** Card height in px. */
    ch: number;
    /** Left edge of the first column in px, which centres the pile grid. */
    ox: number;
    /** Whether the wide table (stock and waste and foundations in side columns) is chosen. */
    wide: boolean;
    /** Whether cards are narrower than 70 px. */
    compact: boolean;
    /** Top edge of the top row in px. */
    top: number;
    /** Top edge of the tableau in px. */
    tabY: number;
    /** Bottom edge of the usable board in px. */
    bottom: number;
    /** Whether the primary pointer is coarse (touch). */
    coarse: boolean;
}

/** The row gap between the top row and the tableau, in px. */
export function rowGap(gap: number): number {
    return Math.max(gap * ROW_GAP_FACTOR, ROW_GAP_MIN);
}

/**
 * The face-up strip left for a worst-case column of 6 face-down and 13 face-up cards whose tableau starts at `tabTop`.
 * Face-down steps shrink first, down to their minimum, and only then face-up steps.
 */
export function worstStrip(cw: number, tabTop: number, height: number, pad: number, coarse: boolean): number {
    const ch = cw * CARD_ASPECT;
    const available = Math.max(0, height - pad - tabTop - ch);
    let down = ch * FACE_DOWN_STEP;
    let up = ch * (coarse ? FACE_UP_STEP_COARSE : FACE_UP_STEP);
    if (WORST_FACE_DOWN * down + WORST_FACE_UP_STEPS * up > available) {
        down = Math.max(ch * MIN_FACE_DOWN_STEP, (available - WORST_FACE_UP_STEPS * up) / WORST_FACE_DOWN);
        if (WORST_FACE_DOWN * down + WORST_FACE_UP_STEPS * up > available) {
            up = Math.max(0, (available - WORST_FACE_DOWN * down) / WORST_FACE_UP_STEPS);
        }
    }
    return up;
}

/** The card width that fits `columns` columns and `rows` card heights in the inner size, clamped to the card bounds. */
function cardWidth(inner: BoardSize, gap: number, columns: number, rows: number): number {
    return Math.max(
        MIN_CARD_WIDTH,
        Math.min((inner.width - gap * (columns - 1)) / columns, MAX_CARD_WIDTH, inner.height / (CARD_ASPECT * rows)),
    );
}

/**
 * The column gap that lets `columns` columns of `cw` px fit the inner width: `gap` itself unless the card floor made
 * the cards too wide for it, in which case the gap shrinks just enough, but never below 0.
 */
function fittedGap(inner: BoardSize, gap: number, cw: number, columns: number): number {
    if (cw > MIN_CARD_WIDTH) {
        return gap;
    }
    return Math.min(gap, Math.max(0, (inner.width - columns * cw) / (columns - 1)));
}

/**
 * Measures the table for a board size: padding, gap, card size, and whether the stacked or the wide table is used.
 * The wide table is chosen exactly when the stacked worst-case strip is below the pointer's minimum and the wide
 * strip is thicker. Wide/stacked choice and card width use the unclamped gap; only when the 30 px card floor binds
 * does the returned `gap` shrink so the columns fit the board.
 */
export function measure(size: BoardSize, options: { readonly coarse: boolean }): Metrics {
    const { width, height } = size;
    const { coarse } = options;
    const small = width < SMALL_BOARD;
    const pad = Math.max(small ? PAD_MIN_SMALL : PAD_MIN, Math.min(PAD_MAX, width * PAD_FACTOR));
    const gap = Math.max(small ? GAP_MIN_SMALL : GAP_MIN, Math.min(GAP_MAX, width * GAP_FACTOR));
    const inner = { width: width - pad * 2, height: height - pad * 2 };
    const row = rowGap(gap);
    const stackedCw = cardWidth(inner, gap, STACKED_COLUMNS, STACKED_ROWS);
    const wideCw = cardWidth(inner, gap, WIDE_COLUMNS, WIDE_ROWS);
    const stackedStrip = worstStrip(stackedCw, pad + stackedCw * CARD_ASPECT + row, height, pad, coarse);
    const wideStrip = worstStrip(wideCw, pad, height, pad, coarse);
    const wide = stackedStrip < (coarse ? STRIP_MIN_COARSE : STRIP_MIN_FINE) && wideStrip > stackedStrip;
    const columns = wide ? WIDE_COLUMNS : STACKED_COLUMNS;
    const cw = wide ? wideCw : stackedCw;
    const ch = cw * CARD_ASPECT;
    const columnGap = fittedGap(inner, gap, cw, columns);
    return {
        width,
        height,
        pad,
        gap: columnGap,
        cw,
        ch,
        ox: pad + (inner.width - (cw * columns + columnGap * (columns - 1))) / 2,
        wide,
        compact: cw < COMPACT_BELOW,
        top: pad,
        tabY: wide ? pad : pad + ch + row,
        bottom: height - pad,
        coarse,
    };
}
