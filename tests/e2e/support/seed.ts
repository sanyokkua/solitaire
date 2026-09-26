import type { Page } from '@playwright/test';
import type { GameState } from '../../../src/domain/types';
import { STORAGE_KEY, encodeRecord } from '../../../src/features/persistence/recordCodec';
import { defaultPreferences, type Preferences } from '../../../src/features/preferences/preferencesSlice';
import { statsReducer } from '../../../src/features/stats/statsSlice';

/** What a browser spec seeds: the position in play, the undo steps behind it and any preference overrides. */
export interface SeedInput {
    readonly current: GameState;
    readonly history?: readonly GameState[];
    readonly preferences?: Partial<Preferences>;
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
        stats: statsReducer(undefined, { type: '@@INIT' }),
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
