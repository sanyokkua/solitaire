// covers: KS-I18N-01, KS-I18N-03

import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { noticeRaised, setRoute, sheetOpened, type NoticeId, type SheetId } from '../../src/app/appSlice';
import { winRecorded } from '../../src/features/interaction/interactionSlice';
import type * as CatalogModule from '../../src/i18n/catalog';
import { playedGame } from '../fixtures/games';
import { installBoardHarness, SIZE } from '../support/boardHarness';
import { FakeResizeObserver } from '../support/fakeResizeObserver';
import { restoreMatchMedia, stubMatchMedia } from '../support/matchMedia';
import { isPseudoOrNeutral, PSEUDO_LOCALE } from '../support/pseudoLocale';
import { renderWithStore } from '../support/renderWithStore';
import { testStore } from '../support/testStore';

// Registers the pseudo catalog next to the real ones, the way a third language would be (KS-I18N-03).
vi.mock('../../src/i18n/catalog', async (importOriginal) => {
    const actual = await importOriginal<typeof CatalogModule>();
    const { buildPseudoCatalog, PSEUDO_LOCALE: code } = await import('../support/pseudoLocale');
    const CATALOGS = { ...actual.CATALOGS, [code]: { name: 'Pseudo', catalog: buildPseudoCatalog() } };
    return { ...actual, CATALOGS, SUPPORTED_LOCALES: Object.keys(CATALOGS) };
});

installBoardHarness();

beforeEach(() => {
    stubMatchMedia([]);
});
afterEach(() => {
    restoreMatchMedia();
});

/**
 * Text that is the same in every language: the product name, language names (each shown in its own language,
 * KS-I18N-03), card rank letters, the printed names of keys, and the decorative rule glyphs of the Help sheet.
 */
const NEUTRAL = [
    'Solitaire',
    'English',
    'Українська',
    'Pseudo',
    ...['A', 'K', 'Q', 'J'],
    ...['H', 'N', 'P', 'Esc', 'Ctrl+Z', 'Ctrl+Y'],
    ...['A→K', 'R/B'],
];

/** A date formatted by `Intl` for the Daily tile (locale data, not catalog text), e.g. "Mon, Sep 28". */
const FORMATTED_DATE = /^\p{L}{3}, \p{L}{3} \d{1,2}$/u;

const isAcceptable = (text: string): boolean => isPseudoOrNeutral(text, NEUTRAL) || FORMATTED_DATE.test(text.trim());

/** Attributes that assistive technology or the browser reads as text. */
const TEXT_ATTRIBUTES = ['aria-label', 'aria-description', 'aria-valuetext', 'title', 'alt', 'placeholder'];

/** Every visible or accessible piece of text under `root` that is neither pseudo text nor language-neutral. */
function untranslated(root: HTMLElement): string[] {
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (node instanceof Element) {
            if (['SCRIPT', 'STYLE'].includes(node.tagName)) continue;
            for (const attribute of TEXT_ATTRIBUTES) {
                const value = node.getAttribute(attribute);
                if (value !== null && !isAcceptable(value)) {
                    found.push(`${node.tagName.toLowerCase()}[${attribute}]=${JSON.stringify(value)}`);
                }
            }
        } else if (node.parentElement && !['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) {
            const text = node.textContent ?? '';
            if (!isAcceptable(text)) found.push(`text ${JSON.stringify(text)}`);
        }
    }
    return found;
}

type Setup = (store: ReturnType<typeof testStore>) => void;

/** One entry per sheet, keyed by the real `SheetId` union: a new sheet does not compile until it is listed here. */
const SHEET_SETUPS: Record<SheetId, Setup> = {
    settings: () => undefined,
    help: () => undefined,
    stats: () => undefined,
    newDeal: () => undefined,
    paused: () => undefined,
    win: (store) => {
        store.dispatch(
            winRecorded({
                mode: 'draw1',
                grade: 'medium',
                score: 235,
                elapsedMs: 120_000,
                moves: 42,
                timeBonus: 5833,
                newBestTime: true,
            }),
        );
    },
    dealCode: () => undefined,
    about: () => undefined,
};

const NOTICES: readonly NoticeId[] = [
    'storage-read',
    'storage-read-only',
    'storage-write',
    'dead-end',
    'no-redeals',
    'code-copied',
    'update-ready',
];

function mount(route: 'home' | 'game', prepare: Setup = () => undefined) {
    const store = testStore({
        preloadedState: {
            game: playedGame(),
            // The pseudo code is registered only by the mock above, so it is not in the `Locale` union.
            preferences: { locale: PSEUDO_LOCALE as 'en' },
        },
    });
    store.dispatch(setRoute(route));
    act(() => {
        prepare(store);
    });
    const view = renderWithStore(<App />, { store });
    act(() => {
        FakeResizeObserver.instances.at(-1)?.trigger(SIZE);
    });
    return view;
}

describe('with the pseudo-localised catalog every player-facing text comes from a catalog', () => {
    it('Home', () => {
        const { container } = mount('home');

        expect(untranslated(container)).toEqual([]);
    });

    it('Game with every notice raised', () => {
        const { container } = mount('game', (store) => {
            for (const id of NOTICES) store.dispatch(noticeRaised(id));
        });

        expect(container.querySelector('.screen--game')).not.toBeNull();
        expect(untranslated(container)).toEqual([]);
    });

    it.each(Object.keys(SHEET_SETUPS) as SheetId[])('the %s sheet, over the Game screen', (sheet) => {
        const { container, store } = mount('game', (s) => {
            SHEET_SETUPS[sheet](s);
            s.dispatch(sheetOpened(sheet));
        });

        expect(store.getState().app.sheet).toBe(sheet);
        expect(container.querySelector('[role="dialog"]')).not.toBeNull();
        expect(untranslated(document.body)).toEqual([]);
    });

    it('Home behind the Settings sheet', () => {
        mount('home', (store) => store.dispatch(sheetOpened('settings')));

        expect(untranslated(document.body)).toEqual([]);
    });
});
