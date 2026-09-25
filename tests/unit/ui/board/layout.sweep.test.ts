import { describe, expect, it } from 'vitest';
import { isValidGameState } from '../../../../src/domain/validate';
import { positions } from '../../../../src/ui/board/layout';
import { MAX_CARD_WIDTH, STRIP_MIN_COARSE, measure } from '../../../../src/ui/board/metrics';
import { worstColumnState } from '../../../fixtures/boardPositions';
import {
    BASELINES,
    DEVICE_CONFIGS,
    VIEWPORTS,
    boardSizeFor,
    chromeBudgetFor,
    type Pointer,
    type ScreenSpec,
} from '../../../fixtures/viewports';

/** The tableau column that holds the worst case. */
const WORST_COLUMN = 6;
const POINTERS: readonly Pointer[] = ['coarse', 'fine'];
const MIRRORS: readonly boolean[] = [false, true];
const SCREENS: readonly (ScreenSpec & { readonly label: string })[] = [...DEVICE_CONFIGS, ...BASELINES];
/**
 * Every installed coarse device configuration. The 320x480 coarse baseline is left out: the chrome alone takes at
 * least 227 of its 480 px, so its worst-case strip is physically about 12.6 px, below the 14 px a finger needs.
 */
const INSTALLED_COARSE: readonly (ScreenSpec & { readonly label: string })[] = DEVICE_CONFIGS.filter(
    (config) => config.mode === 'installed',
);

/** The item at `index`, failing the test when there is none. */
function nth<T>(items: readonly T[], index: number): T {
    const item = items[index];
    if (item === undefined) {
        throw new Error(`no item at index ${String(index)}`);
    }
    return item;
}

/** The y of every face-up card of the worst column, top to bottom, under the given screen, pointer and mirror. */
function worstColumnYs(screen: ScreenSpec, pointer: Pointer, stockRight: boolean): number[] {
    const state = worstColumnState();
    const metrics = measure(boardSizeFor(screen, pointer), { coarse: pointer === 'coarse' });
    const layout = positions(state, metrics, { stockRight });
    return nth(state.tableau, WORST_COLUMN)
        .filter((card) => card.up)
        .map((card) => {
            const placement = layout.cards.get(card.id);
            if (placement === undefined) {
                throw new Error(`no placement for card ${String(card.id)}`);
            }
            return placement.y;
        });
}

/** The smallest gap between consecutive face-up cards of the worst column. */
function minStrip(screen: ScreenSpec, pointer: Pointer, stockRight: boolean): number {
    const ys = worstColumnYs(screen, pointer, stockRight);
    return Math.min(...ys.slice(1).map((y, i) => y - nth(ys, i)));
}

/** The cards of the worst-case position that lie outside the board, described for a failure message. */
function cardsOutside(screen: ScreenSpec, pointer: Pointer, stockRight: boolean): string[] {
    const size = boardSizeFor(screen, pointer);
    const metrics = measure(size, { coarse: pointer === 'coarse' });
    const layout = positions(worstColumnState(), metrics, { stockRight });
    const outside: string[] = [];
    for (const [id, card] of layout.cards) {
        const inside =
            card.x >= 0 && card.x + metrics.cw <= size.width && card.y >= 0 && card.y + metrics.ch <= size.height;
        if (!inside) {
            outside.push(
                `card ${String(id)} at ${card.x.toFixed(1)},${card.y.toFixed(1)} on ${String(size.width)}x${String(size.height)}`,
            );
        }
    }
    return outside;
}

describe('device fixture', () => {
    it('yields 13 viewports, 52 configurations and 3 baselines', () => {
        expect(VIEWPORTS).toHaveLength(13);
        expect(DEVICE_CONFIGS).toHaveLength(52);
        expect(BASELINES).toHaveLength(3);
    });

    it('normalises every viewport to portrait and swaps it for landscape', () => {
        for (const viewport of VIEWPORTS) {
            expect(viewport.width).toBeLessThan(viewport.height);
        }
        const inner = DEVICE_CONFIGS.filter((c) => c.name === 'iPhone Duo, inner' && c.mode === 'installed');
        expect(inner.map((c) => `${c.orientation} ${String(c.width)}x${String(c.height)}`).sort()).toEqual([
            'landscape 890x626',
            'portrait 626x890',
        ]);
    });

    it('subtracts the browser bars from the height only in browser mode', () => {
        const height = (name: string, orientation: string, mode: string): number =>
            nth(
                DEVICE_CONFIGS.filter((c) => c.name === name && c.orientation === orientation && c.mode === mode),
                0,
            ).height;
        expect(height('iPhone 14 Pro', 'portrait', 'installed')).toBe(852);
        expect(height('iPhone 14 Pro', 'portrait', 'browser')).toBe(852 - 188);
        expect(height('iPhone 14 Pro', 'landscape', 'browser')).toBe(393 - 52);
        expect(height('Galaxy S25', 'portrait', 'browser')).toBe(780 - 130);
        expect(height('Galaxy S25', 'landscape', 'browser')).toBe(360 - 80);
    });

    it('marks every configuration coarse and the desktop baselines fine', () => {
        expect(DEVICE_CONFIGS.every((c) => c.pointer === 'coarse')).toBe(true);
        expect(BASELINES.map((b) => b.pointer)).toEqual(['coarse', 'fine', 'fine']);
    });
});

describe('board size from the chrome budget', () => {
    it('caps the stacked frame at 1024 px, so 2560x1440 fine has a 1024 px wide frame and 104 px cards', () => {
        const desktop = nth(BASELINES, 2);
        expect(`${String(desktop.width)}x${String(desktop.height)} ${desktop.pointer}`).toBe('2560x1440 fine');
        const budget = chromeBudgetFor(desktop, 'fine');
        const size = boardSizeFor(desktop);
        expect(size.width).toBe(1024 - budget.width);
        expect(size.height).toBe(1440 - budget.height);
        expect(measure(size, { coarse: false }).cw).toBe(MAX_CARD_WIDTH);
    });

    it('gives the side rails no width cap', () => {
        const rails = nth(BASELINES, 1);
        expect(`${String(rails.width)}x${String(rails.height)}`).toBe('1280x720');
        expect(boardSizeFor(rails).width).toBe(1280 - chromeBudgetFor(rails, 'fine').width);
    });

    it('budgets the chosen pointer when a pointer override is given', () => {
        const screen = nth(DEVICE_CONFIGS, 0);
        expect(boardSizeFor(screen, 'fine')).not.toEqual(boardSizeFor(screen, 'coarse'));
    });
});

describe('worstColumnState', () => {
    it('is a valid, started, playing Draw 1 position', () => {
        const state = worstColumnState();
        expect(isValidGameState(state)).toBe(true);
        expect(state).toMatchObject({ started: true, status: 'playing', draw: 1 });
    });

    it('holds 6 face-down cards under a 13-card alternating run in column 7', () => {
        const column = nth(worstColumnState().tableau, WORST_COLUMN);
        expect(column.filter((card) => !card.up)).toHaveLength(6);
        expect(column.filter((card) => card.up)).toHaveLength(13);
        expect(column.slice(0, 6).every((card) => !card.up)).toBe(true);
    });
});

describe('worst-case column on every board size', () => {
    it.each(SCREENS.map((screen) => [screen.label, screen] as const))(
        '%s keeps every card inside the board, for both pointers and both mirror settings',
        (_name, screen) => {
            for (const pointer of POINTERS) {
                for (const stockRight of MIRRORS) {
                    expect(
                        cardsOutside(screen, pointer, stockRight),
                        `${pointer} stockRight=${String(stockRight)}`,
                    ).toEqual([]);
                }
            }
        },
    );

    it.each(INSTALLED_COARSE.map((screen) => [screen.label, screen] as const))(
        '%s keeps a face-up strip of at least 14 px with a coarse pointer',
        (_name, screen) => {
            for (const stockRight of MIRRORS) {
                expect(minStrip(screen, 'coarse', stockRight)).toBeGreaterThanOrEqual(STRIP_MIN_COARSE);
            }
        },
    );
});
