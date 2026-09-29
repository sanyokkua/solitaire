import { passLimit } from './rules';
import type { CardId, GameState, Pile } from './types';

/** The talon after one draw or recycle; `drew` is the number of cards turned, 0 for a recycle. */
export interface TalonStep {
    readonly stock: Pile;
    readonly waste: Pile;
    readonly drew: number;
    readonly recycled: boolean;
}

/**
 * One turn of the talon: up to `draw` cards from the stock top to the waste, or, with an empty stock, the waste turned
 * over into the stock (`undefined` when both are empty). Knows nothing of the pass limit; the caller decides whether
 * a recycle is allowed. The one place the drawing arithmetic lives.
 */
export function stepTalon(stock: Pile, waste: Pile, draw: number): TalonStep | undefined {
    if (stock.length > 0) {
        const drew = Math.min(draw, stock.length);
        return {
            stock: stock.slice(0, -drew),
            waste: [...waste, ...stock.slice(-drew).reverse()],
            drew,
            recycled: false,
        };
    }
    if (waste.length === 0) return undefined;
    return { stock: [...waste].reverse(), waste: [], drew: 0, recycled: true };
}

/**
 * The stock and waste cards that drawing alone can bring to the waste top, each once, in the order they first get
 * there: the current waste top, then each draw's top card, recycling while the pass limit allows. A recycle restores
 * the stock exactly as the pass began, so the walk ends when a configuration repeats (unlimited modes) or when the
 * recycle is refused (Vegas).
 */
export function reachableTops(state: GameState): readonly CardId[] {
    const tops: CardId[] = [];
    const seen = new Set<string>();
    let { stock, waste, passes } = state;
    let recycled = false;
    for (;;) {
        // Before the first recycle the stock length is not enough to tell configurations apart from later passes.
        const key = `${String(recycled)}:${String(stock.length)}`;
        if (seen.has(key)) break;
        seen.add(key);
        const top = waste.at(-1);
        if (top !== undefined && !tops.includes(top)) tops.push(top);
        const step = stepTalon(stock, waste, state.draw);
        if (step === undefined) break;
        if (step.recycled) {
            if (passes >= passLimit(state.mode)) break;
            passes += 1;
            recycled = true;
        }
        ({ stock, waste } = step);
    }
    return tops;
}
