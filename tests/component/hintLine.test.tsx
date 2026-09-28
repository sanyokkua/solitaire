import { act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { hintCleared, hintSet } from '../../src/features/interaction/interactionSlice';
import { HintLine } from '../../src/ui/components/HintLine';
import { restoreMatchMedia, stubMatchMedia } from '../support/matchMedia';
import { renderWithStore } from '../support/renderWithStore';

const SMART = 'Tap a card to send it to its best spot · drag to place it yourself';
const SELECT = 'Tap a card to pick it up, tap a spot to place it · drag works too';

afterEach(() => {
    restoreMatchMedia();
});

function renderLine(preferences: { tapMode?: 'smart' | 'select'; locale?: 'en' | 'uk' } = {}) {
    const view = renderWithStore(<HintLine />, { preloadedState: { preferences } });
    const line = view.container.querySelector<HTMLElement>('.game-hint');
    if (line === null) throw new Error('no hint line');
    return { ...view, line };
}

describe('HintLine', () => {
    it('reads the smart-move text and stays decorative', () => {
        stubMatchMedia([]);
        const { line } = renderLine({ tapMode: 'smart' });
        expect(line).toHaveTextContent(SMART);
        expect(line).toHaveAttribute('aria-hidden', 'true');
    });

    it('reads the select-and-place text', () => {
        stubMatchMedia([]);
        expect(renderLine({ tapMode: 'select' }).line).toHaveTextContent(SELECT);
    });

    it('reads the Ukrainian text', () => {
        stubMatchMedia([]);
        const { line } = renderLine({ locale: 'uk', tapMode: 'smart' });
        expect(line).not.toHaveTextContent(SMART);
        expect(line.querySelector('.hint-text')?.textContent).toMatch(/[а-яіїєґ]/i);
    });

    it('shows the Space, Ctrl+Z and H key chips only with a fine pointer', () => {
        stubMatchMedia(['(pointer: fine)']);
        const fine = renderLine();
        expect([...fine.line.querySelectorAll('.hint-keys kbd')].map((k) => k.textContent)).toEqual([
            'Space',
            'Ctrl+Z',
            'H',
        ]);
        fine.unmount();

        stubMatchMedia(['(pointer: coarse)']);
        expect(renderLine().line.querySelector('.hint-keys')).toBeNull();
    });

    it('localises the Space key chip', () => {
        stubMatchMedia(['(pointer: fine)']);
        const { line } = renderLine({ locale: 'uk' });
        expect(line.querySelector('.hint-keys kbd')?.textContent).toBe('Пробіл');
    });

    it('shows a hint in place of the text and the tap-mode text again after it clears', () => {
        stubMatchMedia(['(pointer: fine)']);
        const { store, line } = renderLine();
        act(() => {
            store.dispatch(hintSet({ id: 1, kind: 'draw', cards: [], target: 'stock' }));
        });
        expect(line).toHaveTextContent('Hint: draw from the stock');
        expect(line).not.toHaveTextContent(SMART);
        expect(line.querySelector('.hint-keys')).toBeNull();

        act(() => {
            store.dispatch(hintCleared());
        });
        expect(line).toHaveTextContent(SMART);
    });
});
