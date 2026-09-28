import { describe, expect, it } from 'vitest';
import { boardStyle, positionStyle, px } from '../../../../src/ui/board/style';

describe('px', () => {
    it('formats a number as a pixel length', () => {
        expect(px(0)).toBe('0px');
        expect(px(12)).toBe('12px');
        expect(px(12.5)).toBe('12.5px');
    });
});

describe('boardStyle', () => {
    it('carries every custom property by name and value', () => {
        const style = boardStyle({ '--stock-x': '10px', '--stock-y': '20px' });
        expect(style).toEqual({ '--stock-x': '10px', '--stock-y': '20px' });
    });

    it('merges standard properties alongside the custom ones', () => {
        const style = boardStyle({ '--cw': '80px' }, { zIndex: 3 });
        expect(style).toEqual({ zIndex: 3, '--cw': '80px' });
    });
});

describe('positionStyle', () => {
    it('sets --x and --y as pixel lengths', () => {
        expect(positionStyle(10, 20)).toEqual({ '--x': '10px', '--y': '20px' });
    });

    it('merges standard properties alongside the position', () => {
        expect(positionStyle(1, 2, { zIndex: 5 })).toEqual({ zIndex: 5, '--x': '1px', '--y': '2px' });
    });
});
