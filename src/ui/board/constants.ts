/** Forces the text (monochrome) presentation of a suit glyph, so it is never drawn as a colour emoji. */
export const TEXT_PRESENTATION = '\uFE0E';

/** Stacking order of the stock count badge, above every card. */
export const BADGE_Z = 400;

/** The card corner radius as a fraction of the card width; mirrors `--card-radius-factor`. */
export const CARD_RADIUS_FACTOR = 0.09;

/** How long a refused card keeps `is-shake`, in ms: a little over the 320 ms CSS shake, so the class outlives it. */
export const SHAKE_CLEAR_MS = 340;
