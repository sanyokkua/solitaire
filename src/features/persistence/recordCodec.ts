import { MODES } from '../../domain/deal';
import { MAX_DAILY_COMPLETED, type ModeStats, type StatsState } from '../stats/statsSlice';
import { SUPPORTED_LOCALES } from '../preferences/locale';
import type { CardBack, Difficulty, Preferences, TapMode, Theme } from '../preferences/preferencesSlice';
import { hasExactKeys, isDayKey, isRecord } from './guards';
import {
    decodeSession,
    encodeSession,
    type RecordVersion,
    type SessionInput,
    type StoredSession,
} from './sessionCodec';

/**
 * The device record `solitaire.local-state`, version 2 (D5, D10 and D13): one JSON object holding the preferences, the
 * statistics and, only while a game is resumable, that game. Pure: no storage, no clock, no randomness. The decoder
 * accepts a record whole or not at all; it never salvages a valid part of a bad record (D3). A readable version 1
 * record is upgraded in memory, losslessly, and is written as version 2 by the next save.
 */

export const STORAGE_KEY = 'solitaire.local-state';
/** Where an unreadable record is copied before anything is written over it (D3). */
export const BACKUP_KEY = 'solitaire.local-state.unreadable';
export const RECORD_VERSION = 2;

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

const RECORD_KEYS = ['version', 'preferences', 'stats'] as const;
/** The twelve preferences a version 1 record holds. */
const PREFERENCE_KEYS_V1 = [
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
/** The thirteen preferences of a version 2 record: those of version 1, then the difficulty. */
const PREFERENCE_KEYS = [...PREFERENCE_KEYS_V1, 'difficulty'] as const;
const STATS_KEYS = ['modes', 'daily'] as const;
const MODE_STATS_KEYS = ['played', 'won', 'streak', 'bestStreak', 'bestTimeMs', 'bestScore'] as const;
const DAILY_KEYS = ['completed', 'bestStreak'] as const;

const THEMES: readonly Theme[] = ['light', 'dark', 'system'];
const CARD_BACKS: readonly CardBack[] = ['harbour', 'navy', 'sky', 'coral'];
const TAP_MODES: readonly TapMode[] = ['smart', 'select'];
const DIFFICULTIES: readonly Difficulty[] = ['any', 'easy', 'medium', 'hard'];

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
        difficulty: p.difficulty,
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

/** The preferences of a version 1 record: everything but the difficulty. */
type PreferencesV1 = Omit<Preferences, 'difficulty'>;

/** Reads the twelve version 1 preferences field by field; `null` when any value is not valid. */
function readPreferencesV1(value: Record<string, unknown>): PreferencesV1 | null {
    const { theme, nightCards, fourColor, cardBack, tapMode, highlight, autoSafe } = value;
    const { stockRight, animations, locale, winnableOnly, selectedMode } = value;
    if (
        !isOneOf(THEMES, theme) ||
        typeof nightCards !== 'boolean' ||
        typeof fourColor !== 'boolean' ||
        !isOneOf(CARD_BACKS, cardBack) ||
        !isOneOf(TAP_MODES, tapMode) ||
        typeof highlight !== 'boolean' ||
        typeof autoSafe !== 'boolean' ||
        typeof stockRight !== 'boolean' ||
        typeof animations !== 'boolean' ||
        !isOneOf(SUPPORTED_LOCALES, locale) ||
        typeof winnableOnly !== 'boolean' ||
        !isOneOf(MODES, selectedMode)
    ) {
        return null;
    }
    return {
        theme,
        nightCards,
        fourColor,
        cardBack,
        tapMode,
        highlight,
        autoSafe,
        stockRight,
        animations,
        locale,
        winnableOnly,
        selectedMode,
    };
}

/** Version 1 to the current preferences: the difficulty did not exist, so it is the default, `any`. Total. */
const upgradeV1 = (preferences: PreferencesV1): Preferences => ({ ...preferences, difficulty: 'any' });

/** The preferences of a record of `version`: exactly that version's keys, every value valid; otherwise `null`. */
function readPreferences(value: unknown, version: RecordVersion): Preferences | null {
    if (!isRecord(value) || !hasExactKeys(value, version === 1 ? PREFERENCE_KEYS_V1 : PREFERENCE_KEYS)) return null;
    const v1 = readPreferencesV1(value);
    if (v1 === null) return null;
    if (version === 1) return upgradeV1(v1);
    const { difficulty } = value;
    return isOneOf(DIFFICULTIES, difficulty) ? { ...v1, difficulty } : null;
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
    if ((version !== 1 && version !== 2) || !hasExactKeys(parsed, RECORD_KEYS, ['session'])) {
        return { ok: false, reason: 'invalid' };
    }
    const preferences = readPreferences(parsed.preferences, version);
    const { stats } = parsed;
    if (preferences === null || !isStats(stats)) return { ok: false, reason: 'invalid' };
    if (!Object.hasOwn(parsed, 'session')) return { ok: true, record: { preferences, stats, session: null } };
    const session = decodeSession(parsed.session, version);
    return session === null ? { ok: false, reason: 'invalid' } : { ok: true, record: { preferences, stats, session } };
}

/**
 * Reads a stored string. `null` (no key) is `empty`; text that is not JSON is `malformed`; a record of a newer format
 * is `future` and is never interpreted; anything else that is not exactly a valid version 1 or version 2 record is
 * `invalid`. A version 1 record decodes to the same value a version 2 record would hold with the default difficulty
 * and no grade on its game. Total: this function never throws.
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
