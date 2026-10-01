import type { Page } from '@playwright/test';
import type { GameState } from '../../../src/domain/types';
import { STORAGE_KEY, encodeRecord } from '../../../src/features/persistence/recordCodec';
import { defaultPreferences, type Preferences } from '../../../src/features/preferences/preferencesSlice';
import { statsReducer, type StatsState } from '../../../src/features/stats/statsSlice';

/** What a browser spec seeds: the position in play, the undo steps behind it and any preference overrides. */
export interface SeedInput {
    readonly current: GameState;
    readonly history?: readonly GameState[];
    readonly preferences?: Partial<Preferences>;
    /** Replaces the default (empty) statistics. */
    readonly stats?: StatsState;
}

/**
 * Installs a valid versioned `solitaire.local-state` record before the first page load, so the shipped app resumes the
 * given game through its own loader (D13); it carries no test hook. The record is written only while the key is absent,
 * so a reload resumes whatever the app itself stored, and a stale seed can never mask a resume bug. Call it before
 * `page.goto`, then click "Continue game".
 */
export async function seedRecord(page: Page, input: SeedInput): Promise<void> {
    const record = encodeRecord({
        preferences: { ...defaultPreferences('en'), ...input.preferences },
        stats: input.stats ?? statsReducer(undefined, { type: '@@INIT' }),
        game: { current: input.current, history: input.history ?? [], future: [], dailyKey: null, counted: false },
    });
    await page.addInitScript(
        ({ key, value }) => {
            try {
                if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value);
            } catch {
                // Storage is unavailable: the spec then fails on its own assertions rather than here.
            }
        },
        { key: STORAGE_KEY, value: record },
    );
}

/**
 * Installs `value` verbatim under `key` (the record key by default) before the first page load, only while the key is
 * absent, so a reload sees whatever the app itself stored. It lets a spec start from unreadable data.
 */
export async function seedRaw(page: Page, value: string, key: string = STORAGE_KEY): Promise<void> {
    await page.addInitScript(
        ({ storageKey, raw }) => {
            try {
                if (window.localStorage.getItem(storageKey) === null) window.localStorage.setItem(storageKey, raw);
            } catch {
                // Storage is unavailable: the spec then fails on its own assertions rather than here.
            }
        },
        { storageKey: key, raw: value },
    );
}

/**
 * Makes every storage write throw `QuotaExceededError` from the first script of each page load on. Register it after
 * `seedRecord`: init scripts run in order, so the seed still gets written before writes start failing.
 */
export async function failSaves(page: Page): Promise<void> {
    await page.addInitScript(() => {
        Storage.prototype.setItem = () => {
            throw new DOMException('full', 'QuotaExceededError');
        };
    });
}

/** The stored session, as far as a spec reads it: the move count in play and the undo and redo steps behind it. */
export interface StoredSession {
    readonly current: { readonly moves: number };
    readonly history: readonly unknown[];
    readonly future: readonly unknown[];
}

/** The `session` the app itself wrote to the record, read back from the browser's storage. */
export async function readStoredSession(page: Page): Promise<StoredSession> {
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    return (JSON.parse(stored ?? 'null') as { session: StoredSession }).session;
}
