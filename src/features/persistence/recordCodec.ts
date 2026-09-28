import type { Mode } from '../../domain/types';
import type { ModeStats, StatsState } from '../stats/statsSlice';
import { SUPPORTED_LOCALES } from '../preferences/locale';
import type { CardBack, Preferences, TapMode, Theme } from '../preferences/preferencesSlice';
import {
    MAX_STORED_STEPS,
    decodeSession,
    encodeSession,
    hasExactKeys,
    isDayKey,
    isRecord,
    type SessionInput,
    type StoredSession,
} from './sessionCodec';

/**
 * The device record `solitaire.local-state`, version 1 (D5 and D13): one JSON object holding the preferences, the
 * statistics and, only while a game is resumable, that game. Pure: no storage, no clock, no randomness. The decoder
 * accepts a record whole or not at all; it never salvages a valid part of a bad record (D3).
 */

export const STORAGE_KEY = 'solitaire.local-state';
/** Where an unreadable record is copied before anything is written over it (D3). */
export const BACKUP_KEY = 'solitaire.local-state.unreadable';
export const RECORD_VERSION = 1;
export { MAX_STORED_STEPS, type StoredSession };

/** What the writer hands the encoder; structurally a subset of the store's slices, so no store import is needed. */
export interface RecordInput {
    readonly preferences: Preferences;
    readonly stats: StatsState;
    readonly game: SessionInput;
}

/** A decoded record: every part validated, the session rebuilt to full game states, or `null` when there is none. */
export interface DecodedRecord {
    readonly preferences: Preferences;
    readonly stats: StatsState;
    readonly session: StoredSession | null;
}

export type DecodeFailure = 'empty' | 'malformed' | 'invalid' | 'future';

export type DecodeResult =
    { readonly ok: true; readonly record: DecodedRecord } | { readonly ok: false; readonly reason: DecodeFailure };

const MODES: readonly Mode[] = ['draw1', 'draw3', 'vegas', 'daily'];
/** How many completed Daily dates a record keeps (matches the statistics slice). */
const MAX_DAILY_COMPLETED = 400;

const RECORD_KEYS = ['version', 'preferences', 'stats'] as const;
const PREFERENCE_KEYS = [
    'theme',
    'nightCards',
    'fourColor',
    'cardBack',
    'tapMode',
    'highlight',
    'autoSafe',
    'stockRight',
    'animations',
    'locale',
    'winnableOnly',
    'selectedMode',
] as const;
const STATS_KEYS = ['modes', 'daily'] as const;
const MODE_STATS_KEYS = ['played', 'won', 'streak', 'bestStreak', 'bestTimeMs', 'bestScore'] as const;
const DAILY_KEYS = ['completed', 'bestStreak'] as const;

const THEMES: readonly Theme[] = ['light', 'dark', 'system'];
const CARD_BACKS: readonly CardBack[] = ['harbour', 'navy', 'sky', 'coral'];
const TAP_MODES: readonly TapMode[] = ['smart', 'select'];
const BOOLEAN_PREFERENCES = [
    'nightCards',
    'fourColor',
    'highlight',
    'autoSafe',
    'stockRight',
    'animations',
    'winnableOnly',
] as const;

function encodePreferences(p: Preferences): Record<(typeof PREFERENCE_KEYS)[number], unknown> {
    return {
        theme: p.theme,
        nightCards: p.nightCards,
        fourColor: p.fourColor,
        cardBack: p.cardBack,
        tapMode: p.tapMode,
        highlight: p.highlight,
        autoSafe: p.autoSafe,
        stockRight: p.stockRight,
        animations: p.animations,
        locale: p.locale,
        winnableOnly: p.winnableOnly,
        selectedMode: p.selectedMode,
    };
}

function encodeModeStats(m: ModeStats): Record<(typeof MODE_STATS_KEYS)[number], unknown> {
    return {
        played: m.played,
        won: m.won,
        streak: m.streak,
        bestStreak: m.bestStreak,
        bestTimeMs: m.bestTimeMs,
        bestScore: m.bestScore,
    };
}

function encodeStats(s: StatsState): Record<(typeof STATS_KEYS)[number], unknown> {
    return {
        modes: {
            draw1: encodeModeStats(s.modes.draw1),
            draw3: encodeModeStats(s.modes.draw3),
            vegas: encodeModeStats(s.modes.vegas),
            daily: encodeModeStats(s.modes.daily),
        },
        daily: { completed: [...s.daily.completed], bestStreak: s.daily.bestStreak },
    };
}

/**
 * The record as a JSON string. Every object is built field by field in a fixed order, so equal inputs always give the
 * identical string and nothing outside the record is written. `session` is present only for a started, unfinished game.
 */
export function encodeRecord(input: RecordInput): string {
    const session = encodeSession(input.game);
    return JSON.stringify({
        version: RECORD_VERSION,
        preferences: encodePreferences(input.preferences),
        stats: encodeStats(input.stats),
        ...(session === undefined ? {} : { session }),
    });
}

const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isFiniteNonNegative = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
    typeof value === 'string' && (options as readonly string[]).includes(value);

function isPreferences(value: unknown): value is Preferences {
    if (!isRecord(value) || !hasExactKeys(value, PREFERENCE_KEYS)) return false;
    return (
        isOneOf(THEMES, value.theme) &&
        isOneOf(CARD_BACKS, value.cardBack) &&
        isOneOf(TAP_MODES, value.tapMode) &&
        isOneOf(SUPPORTED_LOCALES, value.locale) &&
        isOneOf(MODES, value.selectedMode) &&
        BOOLEAN_PREFERENCES.every((key) => typeof value[key] === 'boolean')
    );
}

/** Also `streak <= bestStreak`; `won <= played` is deliberately not checked (design D13). */
function isModeStats(value: unknown): value is ModeStats {
    if (!isRecord(value) || !hasExactKeys(value, MODE_STATS_KEYS)) return false;
    return (
        isNonNegativeInteger(value.played) &&
        isNonNegativeInteger(value.won) &&
        isNonNegativeInteger(value.streak) &&
        isNonNegativeInteger(value.bestStreak) &&
        value.streak <= value.bestStreak &&
        (value.bestTimeMs === null || isFiniteNonNegative(value.bestTimeMs)) &&
        (value.bestScore === null || isFiniteNumber(value.bestScore))
    );
}

/** At most 400 real dates, strictly ascending (so unique). ISO dates of four-digit years sort as strings. */
function isCompletedList(value: unknown): value is readonly string[] {
    return (
        Array.isArray(value) &&
        value.length <= MAX_DAILY_COMPLETED &&
        value.every((item, i) => isDayKey(item) && (i === 0 || String(value[i - 1]) < item))
    );
}

function isStats(value: unknown): value is StatsState {
    if (!isRecord(value) || !hasExactKeys(value, STATS_KEYS)) return false;
    const { modes, daily } = value;
    if (!isRecord(modes) || !hasExactKeys(modes, MODES) || !MODES.every((mode) => isModeStats(modes[mode]))) {
        return false;
    }
    return (
        isRecord(daily) &&
        hasExactKeys(daily, DAILY_KEYS) &&
        isCompletedList(daily.completed) &&
        isNonNegativeInteger(daily.bestStreak)
    );
}

function decodeParsed(parsed: unknown): DecodeResult {
    if (!isRecord(parsed)) return { ok: false, reason: 'invalid' };
    const { version } = parsed;
    if (typeof version === 'number' && version > RECORD_VERSION) return { ok: false, reason: 'future' };
    if (version !== RECORD_VERSION || !hasExactKeys(parsed, RECORD_KEYS, ['session'])) {
        return { ok: false, reason: 'invalid' };
    }
    const { preferences, stats } = parsed;
    if (!isPreferences(preferences) || !isStats(stats)) return { ok: false, reason: 'invalid' };
    if (!Object.hasOwn(parsed, 'session')) return { ok: true, record: { preferences, stats, session: null } };
    const session = decodeSession(parsed.session);
    return session === null ? { ok: false, reason: 'invalid' } : { ok: true, record: { preferences, stats, session } };
}

/**
 * Reads a stored string. `null` (no key) is `empty`; text that is not JSON is `malformed`; a record of a newer format
 * is `future` and is never interpreted; anything else that is not exactly a valid v1 record is `invalid`. Total: this
 * function never throws.
 */
export function decodeRecord(raw: string | null): DecodeResult {
    if (raw === null) return { ok: false, reason: 'empty' };
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, reason: 'malformed' };
    }
    try {
        return decodeParsed(parsed);
    } catch {
        return { ok: false, reason: 'invalid' };
    }
}
