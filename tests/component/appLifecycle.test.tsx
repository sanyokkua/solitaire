import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startApp, type RunningApp } from '../../src/app/lifecycle';
import { dealFromSeed } from '../../src/domain/deal';
import { gameReducer } from '../../src/features/game/gameSlice';
import { play, undo } from '../../src/features/game/gameThunks';
import { STORAGE_KEY, encodeRecord } from '../../src/features/persistence/recordCodec';
import { createStorageGateway } from '../../src/features/persistence/storageGateway';
import { defaultPreferences, preferenceSet } from '../../src/features/preferences/preferencesSlice';
import { statsReducer } from '../../src/features/stats/statsSlice';
import { WINNING_LINE, parseLine } from '../fixtures/deals';
import { fakeDealService, type FakeDealService } from '../fixtures/dealService';
import { memoryStorage, type MemoryStorage } from '../fixtures/storage';

/** The application lifecycle phase gate: a game survives a reload of the page, through the injected gateway alone. */

const MOVES = 10;

interface Started {
    readonly app: RunningApp;
    readonly root: HTMLElement;
    readonly fake: FakeDealService;
}

const started: Started[] = [];

/** Starts the app over the injected gateway on `storage`, with a fake deal service and inert timers. */
function start(storage: MemoryStorage, root: HTMLElement = document.createElement('div')): Started {
    let clock = 0;
    document.body.append(root);
    const fake = fakeDealService();
    let app: RunningApp | undefined;
    act(() => {
        app = startApp(root, {
            extra: {
                gateway: createStorageGateway(storage),
                dealService: fake,
                now: () => (clock += 400),
                delay: () => Promise.resolve(),
            },
            ticker: { setInterval: () => 'ticker-handle', clearInterval: () => undefined },
        });
    });
    if (app === undefined) throw new Error('startApp did not return');
    const result: Started = { app, root, fake };
    started.push(result);
    return result;
}

/** Disposes the app and detaches its root; safe to call twice, so a test may stop an app the cleanup stops again. */
function stop({ app, root }: Started): void {
    act(() => {
        app.dispose();
    });
    root.remove();
}

afterEach(() => {
    started.splice(0).forEach(stop);
    ['data-theme', 'data-night-cards', 'data-four-color', 'data-back', 'data-motion'].forEach((name) => {
        document.documentElement.removeAttribute(name);
    });
    vi.restoreAllMocks();
});

describe('reloading the page', () => {
    it('restores an unfinished game exactly, with its undo and redo history', async () => {
        const user = userEvent.setup();
        const storage = memoryStorage();

        const first = start(storage);
        act(() => {
            first.app.store.dispatch(preferenceSet({ key: 'autoSafe', value: false }));
        });
        await user.click(screen.getByRole('button', { name: /deal cards/i }));
        await act(async () => {
            first.fake.resolve(0, dealFromSeed(WINNING_LINE.seed, 'draw1'));
            await Promise.resolve();
        });
        for (const command of parseLine(WINNING_LINE.line).slice(0, MOVES)) {
            await act(async () => {
                await first.app.store.dispatch(play(command));
            });
        }
        act(() => {
            first.app.store.dispatch(undo());
        });
        const before = first.app.store.getState().game;
        expect(before.current).not.toBeNull();
        expect(before.current?.elapsedMs).toBeGreaterThan(0);
        expect(before.history).toHaveLength(MOVES - 1);
        expect(before.future).toHaveLength(1);

        act(() => {
            window.dispatchEvent(new Event('pagehide'));
        });
        stop(first);

        const second = start(storage);
        expect(second.app.store.getState().app.route).toBe('home');
        await user.click(screen.getByRole('button', { name: 'Continue game' }));

        const after = second.app.store.getState().game;
        expect(second.app.store.getState().app.route).toBe('game');
        expect(after.current).toEqual(before.current);
        expect(after.history).toEqual(before.history);
        expect(after.future).toEqual(before.future);
        expect(after.dailyKey).toEqual(before.dailyKey);
    });
});

describe('starting the page', () => {
    it('applies a stored Dark theme to the document before the first screen renders', async () => {
        const storage = memoryStorage();
        storage.setItem(
            STORAGE_KEY,
            encodeRecord({
                preferences: { ...defaultPreferences('en'), theme: 'dark' },
                stats: statsReducer(undefined, { type: '@@init' }),
                game: gameReducer(undefined, { type: '@@init' }),
            }),
        );
        const html = document.documentElement;
        const renderedWhenThemeWritten: number[] = [];
        const original = html.setAttribute.bind(html);
        const root = document.createElement('div');
        vi.spyOn(html, 'setAttribute').mockImplementation((name, value) => {
            if (name === 'data-theme') renderedWhenThemeWritten.push(root.childElementCount);
            original(name, value);
        });

        start(storage, root);

        expect(html.getAttribute('data-theme')).toBe('dark');
        expect(renderedWhenThemeWritten).toEqual([0]);
        expect(await screen.findByRole('button', { name: /deal cards/i })).toBeInTheDocument();
    });
});
