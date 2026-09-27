import type { CardId } from '../../domain/types';

/** Gap between two cards' glide starts in a deal; mirrors `--motion-deal-step`. */
export const DEAL_STEP_MS = 28;
/** How long after its glide starts the last card of a column flips face up. */
const FLIP_LEAD_MS = 200;
/** Time the last card needs after its own start (glide plus flip) before the deal has settled. */
const SETTLE_MS = 600;
/** Cards travelling in a deal: the 28 tableau cards of a fresh deal. */
const DEALT_CARDS = 28;
/** The whole deal, after which the delays are cleared. */
const DEAL_TOTAL_MS = DEALT_CARDS * DEAL_STEP_MS + SETTLE_MS;

export interface DealPlayback {
    /** Whether the deal ran to its end. */
    finished(): boolean;
    /** Stops the deal and clears everything it wrote; a finished deal stays finished. */
    cancel(): void;
}

/**
 * Deals the table from the stock: parks every card at the stock with transitions off, forces a reflow, writes the
 * per-card delays `--d` and `--fd` on the tableau cards in `dealOrder`, then releases the park so each card glides
 * to its React-owned position. The delays are the only properties written; `--x` / `--y` are never touched.
 */
export function playDeal(boardEl: HTMLElement, dealOrder: readonly CardId[]): DealPlayback {
    const cards = dealOrder.flatMap((id) => {
        const card = boardEl.querySelector<HTMLElement>(`[data-card-id='${String(id)}']`);
        return card === null ? [] : [card];
    });
    let done = false;

    const clearDelays = () => {
        for (const card of cards) {
            card.style.removeProperty('--d');
            card.style.removeProperty('--fd');
        }
    };

    boardEl.setAttribute('data-dealing', 'park');
    // Reading the box forces the parked layout to be computed, so the release below starts a real transition.
    void boardEl.getBoundingClientRect();
    cards.forEach((card, k) => {
        card.style.setProperty('--d', `${String(k * DEAL_STEP_MS)}ms`);
        card.style.setProperty('--fd', `${String(k * DEAL_STEP_MS + FLIP_LEAD_MS)}ms`);
    });
    boardEl.removeAttribute('data-dealing');
    boardEl.removeAttribute('data-resizing');

    const timer = setTimeout(() => {
        clearDelays();
        done = true;
    }, DEAL_TOTAL_MS);

    return {
        finished: () => done,
        cancel: () => {
            clearTimeout(timer);
            clearDelays();
            boardEl.removeAttribute('data-dealing');
        },
    };
}
