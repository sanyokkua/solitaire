import { describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../../../src/domain/deal';
import { applyCommand } from '../../../../src/domain/engine';
import { mulberry32 } from '../../../../src/domain/prng';
import type { Command, GameState, Mode } from '../../../../src/domain/types';
import {
    accrued,
    committed,
    gameReducer,
    installed,
    undone,
    type GameSliceState,
} from '../../../../src/features/game/gameSlice';
import { commit, undo, type Session } from '../../../../src/features/game/history';
import { defaultPreferences, type Preferences } from '../../../../src/features/preferences/preferencesSlice';
import {
    BACKUP_KEY,
    MAX_STORED_STEPS,
    RECORD_VERSION,
    STORAGE_KEY,
    decodeRecord,
    encodeRecord,
    type RecordInput,
} from '../../../../src/features/persistence/recordCodec';
import type { StatsState } from '../../../../src/features/stats/statsSlice';
import { WINNING_LINE, parseLine } from '../../../fixtures/deals';

const DRAW: Command = { type: 'draw' };

const emptyModeStats = () => ({ played: 0, won: 0, streak: 0, bestStreak: 0, bestTimeMs: null, bestScore: null });

function defaultStats(): StatsState {
    return {
        modes: { draw1: emptyModeStats(), draw3: emptyModeStats(), vegas: emptyModeStats(), daily: emptyModeStats() },
        daily: { completed: [], bestStreak: 0 },
    };
}

/** Statistics with every field away from its default, so a dropped or reordered field shows in a round trip. */
function busyStats(): StatsState {
    return {
        modes: {
            draw1: { played: 12, won: 5, streak: 2, bestStreak: 3, bestTimeMs: 91_500, bestScore: 745 },
            draw3: { played: 4, won: 0, streak: 0, bestStreak: 0, bestTimeMs: null, bestScore: null },
            vegas: { played: 3, won: 1, streak: 1, bestStreak: 1, bestTimeMs: 120_000, bestScore: -27.5 },
            daily: { played: 2, won: 2, streak: 2, bestStreak: 2, bestTimeMs: 200_000, bestScore: 500 },
        },
        daily: { completed: ['2026-01-30', '2026-01-31', '2026-02-01'], bestStreak: 3 },
    };
}

function busyPreferences(): Preferences {
    return {
        theme: 'dark',
        nightCards: true,
        fourColor: true,
        cardBack: 'coral',
        tapMode: 'select',
        highlight: false,
        autoSafe: true,
        stockRight: true,
        animations: false,
        locale: 'uk',
        winnableOnly: false,
        selectedMode: 'vegas',
    };
}

/** Plays `commands` from `first`, committing each as its own undo step with the clock advancing 1.5 s per step. */
function playSteps(first: GameState, commands: readonly Command[]): Session {
    let session: Session = { current: first, history: [], future: [] };
    for (const [i, command] of commands.entries()) {
        const { state } = applyCommand(session.current, command);
        expect(state).not.toBe(session.current);
        session = commit(session, { ...state, elapsedMs: 1500 * (i + 1) });
    }
    return session;
}

function inputFor(session: Session, extra: Partial<RecordInput['game']> = {}): RecordInput {
    return {
        preferences: busyPreferences(),
        stats: busyStats(),
        game: { ...session, dailyKey: null, counted: true, ...extra },
    };
}

/**
 * A resumable mid-game session: 20 winning-line moves, then 3 undos, so `undos`, `elapsedMs` and `started` all
 * vary. `mode` only changes the deal's mode; Daily plays like Draw 1.
 */
function midGame(mode: Mode = WINNING_LINE.mode): Session {
    const played = playSteps(dealFromSeed(WINNING_LINE.seed, mode), parseLine(WINNING_LINE.line).slice(0, 20));
    return undo(undo(undo(played)));
}

function inPlay(game: GameSliceState): GameState {
    if (game.current === null) throw new Error('expected a game in play');
    return game.current;
}

function decodedSession(raw: string) {
    const result = decodeRecord(raw);
    if (!result.ok || result.record.session === null) throw new Error('expected a decoded session');
    return result.record.session;
}

type Loose = Record<string, unknown>;

/** Parses `raw`, lets `change` edit the parsed record, and serialises it again. */
function edited(raw: string, change: (record: Loose) => void): string {
    const record = JSON.parse(raw) as Loose;
    change(record);
    return JSON.stringify(record);
}

const child = (parent: unknown, ...path: (string | number)[]): Loose => {
    let node = parent;
    for (const key of path) node = (node as Record<string | number, unknown>)[key];
    return node as Loose;
};

const validRaw = (): string => encodeRecord(inputFor(midGame()));

describe('storage constants', () => {
    it('names the record, its backup and its version', () => {
        expect(STORAGE_KEY).toBe('solitaire.local-state');
        expect(BACKUP_KEY).toBe('solitaire.local-state.unreadable');
        expect(RECORD_VERSION).toBe(1);
        expect(MAX_STORED_STEPS).toBe(200);
    });
});

describe('round trip', () => {
    it('restores a mid-game session exactly', () => {
        const session = midGame('daily');
        // The fixture is only meaningful if the fields that cannot be copied from `current` really differ.
        expect(session.current.undos).toBe(3);
        expect(session.history.every((step) => step.undos === 0)).toBe(true);
        expect(new Set(session.history.map((step) => step.elapsedMs)).size).toBeGreaterThan(5);
        expect(session.history[0]?.started).toBe(false);
        expect(session.history[1]?.started).toBe(true);
        expect(session.future).toHaveLength(3);
        expect(session.future.map((step) => step.undos)).toEqual([0, 1, 2]);

        const input = inputFor(session, { dailyKey: '2026-02-01', counted: false });
        const result = decodeRecord(encodeRecord(input));

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.record.preferences).toEqual(input.preferences);
        expect(result.record.stats).toEqual(input.stats);
        expect(result.record.session).toEqual({
            current: session.current,
            history: session.history,
            future: session.future,
            dailyKey: '2026-02-01',
            counted: false,
        });
    });

    it('restores a session built by the real reducers on a fractional clock', () => {
        const commands = parseLine(WINNING_LINE.line).slice(0, 12);
        let game = gameReducer(
            undefined,
            installed({ state: dealFromSeed(WINNING_LINE.seed, 'draw1'), dailyKey: null }),
        );
        let now = 1000.4;
        game = gameReducer(game, accrued({ atMs: now, eligible: true }));
        for (const command of commands) {
            const { state } = applyCommand(inPlay(game), command);
            game = gameReducer(game, committed(state));
            now += 250.7;
            game = gameReducer(game, accrued({ atMs: now, eligible: true }));
        }
        game = gameReducer(gameReducer(game, undone()), undone());
        const session = inPlay(game);
        expect(Number.isInteger(session.elapsedMs)).toBe(true);
        expect(session.elapsedMs).toBeGreaterThan(0);
        expect(game.history.every((step) => Number.isInteger(step.elapsedMs))).toBe(true);
        expect(game.future).toHaveLength(2);

        const result = decodeRecord(encodeRecord({ preferences: busyPreferences(), stats: busyStats(), game }));

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.record.session).toEqual({
            current: game.current,
            history: game.history,
            future: game.future,
            dailyKey: null,
            counted: false,
        });
    });

    it('re-encodes a decoded record to the same string', () => {
        const raw = validRaw();
        const decoded = decodedSession(raw);
        const result = decodeRecord(raw);
        if (!result.ok) throw new Error('expected ok');
        expect(
            encodeRecord({
                preferences: result.record.preferences,
                stats: result.record.stats,
                game: { ...decoded },
            }),
        ).toBe(raw);
    });

    it('keeps 200 history steps and 3 redo steps out of 250 and 3', () => {
        const drawn = playSteps(
            dealFromSeed(7, 'draw1'),
            Array.from({ length: 253 }, () => DRAW),
        );
        const session = undo(undo(undo(drawn)));
        expect(session.history).toHaveLength(250);
        expect(session.future).toHaveLength(3);

        const stored = decodedSession(encodeRecord(inputFor(session)));

        expect(stored.history).toHaveLength(200);
        expect(stored.future).toHaveLength(3);
        expect(stored.history).toEqual(session.history.slice(-200));
        expect(stored.future).toEqual(session.future);
        expect(stored.current).toEqual(session.current);
    });

    it('keeps the nearest 200 redo steps', () => {
        const drawn = playSteps(
            dealFromSeed(7, 'draw1'),
            Array.from({ length: 205 }, () => DRAW),
        );
        let session = drawn;
        for (let i = 0; i < 205; i++) session = undo(session);
        expect(session.future).toHaveLength(205);

        const stored = decodedSession(encodeRecord(inputFor(session)));

        expect(stored.future).toEqual(session.future.slice(-200));
        expect(stored.future.at(-1)).toEqual(session.future.at(-1));
    });
});

describe('what is stored', () => {
    it('omits the session for a won game', () => {
        const session = playSteps(dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode), parseLine(WINNING_LINE.line));
        expect(session.current.status).toBe('won');

        const raw = encodeRecord(inputFor(session));

        expect(Object.keys(JSON.parse(raw) as Loose)).toEqual(['version', 'preferences', 'stats']);
        const result = decodeRecord(raw);
        expect(result.ok && result.record.session).toBeNull();
    });

    it('omits the session for an unstarted game and for no game', () => {
        const fresh: Session = { current: dealFromSeed(3, 'draw3'), history: [], future: [] };
        expect(JSON.parse(encodeRecord(inputFor(fresh))) as Loose).not.toHaveProperty('session');
        const none: RecordInput = {
            preferences: busyPreferences(),
            stats: busyStats(),
            game: { current: null, history: [], future: [], dailyKey: null, counted: false },
        };
        expect(JSON.parse(encodeRecord(none)) as Loose).not.toHaveProperty('session');
    });

    it('is deterministic and writes keys in the documented order', () => {
        const input = inputFor(midGame(), { dailyKey: '2026-02-01' });
        expect(encodeRecord(input)).toBe(encodeRecord(input));

        const record = JSON.parse(encodeRecord(input)) as Loose;
        expect(Object.keys(record)).toEqual(['version', 'preferences', 'stats', 'session']);
        expect(Object.keys(child(record, 'preferences'))).toEqual([
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
        ]);
        expect(Object.keys(child(record, 'stats'))).toEqual(['modes', 'daily']);
        expect(Object.keys(child(record, 'stats', 'modes'))).toEqual(['draw1', 'draw3', 'vegas', 'daily']);
        expect(Object.keys(child(record, 'stats', 'modes', 'draw1'))).toEqual([
            'played',
            'won',
            'streak',
            'bestStreak',
            'bestTimeMs',
            'bestScore',
        ]);
        expect(Object.keys(child(record, 'session'))).toEqual(['current', 'history', 'future', 'dailyKey', 'counted']);
        expect(Object.keys(child(record, 'session', 'history', 0))).toEqual([
            'tableau',
            'stock',
            'waste',
            'foundations',
            'score',
            'moves',
            'passes',
            'elapsedMs',
            'undos',
            'started',
        ]);
    });

    it('encodes the default state with only its known keys', () => {
        const raw = encodeRecord({
            preferences: defaultPreferences('en'),
            stats: defaultStats(),
            game: { current: null, history: [], future: [], dailyKey: null, counted: false },
        });
        expect(JSON.parse(raw)).toEqual({
            version: 1,
            preferences: defaultPreferences('en'),
            stats: defaultStats(),
        });
        expect(Object.keys(JSON.parse(raw) as Loose)).toEqual(['version', 'preferences', 'stats']);
    });

    it('writes only known fields, ignoring stray ones on the input', () => {
        const session = midGame();
        const stray = { ...session.current, extra: 'x' } as GameState;
        const raw = encodeRecord(inputFor({ ...session, current: stray }));
        expect(child(JSON.parse(raw), 'session', 'current')).not.toHaveProperty('extra');
    });
});

describe('outcomes for unreadable text', () => {
    it('reads no stored value as empty', () => {
        expect(decodeRecord(null)).toEqual({ ok: false, reason: 'empty' });
    });

    it('reads text that is not JSON as malformed', () => {
        expect(decodeRecord('{not json')).toEqual({ ok: false, reason: 'malformed' });
        expect(decodeRecord('')).toEqual({ ok: false, reason: 'malformed' });
    });

    it('reads a newer version as future, whatever else it holds', () => {
        expect(decodeRecord(JSON.stringify({ version: 2 }))).toEqual({ ok: false, reason: 'future' });
        expect(decodeRecord(edited(validRaw(), (r) => (r.version = 2)))).toEqual({ ok: false, reason: 'future' });
    });

    it('reads version 0, a missing version and a non-numeric version as invalid', () => {
        expect(decodeRecord(edited(validRaw(), (r) => (r.version = 0)))).toEqual({ ok: false, reason: 'invalid' });
        expect(
            decodeRecord(
                edited(validRaw(), (r) => {
                    delete r.version;
                }),
            ),
        ).toEqual({ ok: false, reason: 'invalid' });
        expect(decodeRecord(edited(validRaw(), (r) => (r.version = '1')))).toEqual({ ok: false, reason: 'invalid' });
    });

    it.each(['42', 'null', '[]', '{}', '"text"', 'true', '[1,2]'])('reads %s as invalid without throwing', (raw) => {
        expect(decodeRecord(raw)).toEqual({ ok: false, reason: 'invalid' });
    });

    it('accepts the encoded default record', () => {
        const raw = encodeRecord({
            preferences: defaultPreferences('uk'),
            stats: defaultStats(),
            game: { current: null, history: [], future: [], dailyKey: null, counted: false },
        });
        expect(decodeRecord(raw)).toEqual({
            ok: true,
            record: { preferences: defaultPreferences('uk'), stats: defaultStats(), session: null },
        });
    });
});

describe('invalid records', () => {
    const invalid = { ok: false, reason: 'invalid' } as const;

    it('rejects an impossible game: a duplicated card in the position in play', () => {
        const raw = edited(validRaw(), (r) => {
            const stock = child(r, 'session', 'current').stock as number[];
            stock[0] = stock.at(1) ?? -1;
        });
        expect(decodeRecord(raw)).toEqual(invalid);
    });

    it.each<[string, (record: Loose) => void]>([
        ['an unknown theme', (r) => (child(r, 'preferences').theme = 'sepia')],
        ['an unknown card back', (r) => (child(r, 'preferences').cardBack = 'gold')],
        ['an unknown tap mode', (r) => (child(r, 'preferences').tapMode = 'double')],
        ['an unsupported locale', (r) => (child(r, 'preferences').locale = 'fr')],
        ['an unknown selected mode', (r) => (child(r, 'preferences').selectedMode = 'spider')],
        ['a non-boolean preference', (r) => (child(r, 'preferences').highlight = 'yes')],
        [
            'a missing preference',
            (r) => {
                delete child(r, 'preferences').animations;
            },
        ],
        ['an unknown preference key', (r) => (child(r, 'preferences').sound = true)],
        ['a negative count', (r) => (child(r, 'stats', 'modes', 'draw1').played = -1)],
        ['a fractional count', (r) => (child(r, 'stats', 'modes', 'draw1').won = 1.5)],
        ['a string count', (r) => (child(r, 'stats', 'modes', 'draw3').streak = '2')],
        ['a negative best time', (r) => (child(r, 'stats', 'modes', 'vegas').bestTimeMs = -1)],
        ['a string best score', (r) => (child(r, 'stats', 'modes', 'vegas').bestScore = '5')],
        ['an undefined best time', (r) => (child(r, 'stats', 'modes', 'vegas').bestTimeMs = undefined)],
        ['an extra key in a mode', (r) => (child(r, 'stats', 'modes', 'draw1').extra = 1)],
        [
            'a missing mode',
            (r) => {
                delete child(r, 'stats', 'modes').vegas;
            },
        ],
        ['an extra mode', (r) => (child(r, 'stats', 'modes').spider = emptyModeStats())],
        ['an extra key in stats', (r) => (child(r, 'stats').extra = 1)],
        ['a negative daily best streak', (r) => (child(r, 'stats', 'daily').bestStreak = -1)],
        ['an impossible date', (r) => (child(r, 'stats', 'daily').completed = ['2026-02-30'])],
        ['a badly formed date', (r) => (child(r, 'stats', 'daily').completed = ['2026-2-3'])],
        ['unsorted dates', (r) => (child(r, 'stats', 'daily').completed = ['2026-02-02', '2026-02-01'])],
        ['duplicate dates', (r) => (child(r, 'stats', 'daily').completed = ['2026-02-01', '2026-02-01'])],
        [
            'more than 400 dates',
            (r) => {
                const start = Date.UTC(2020, 0, 1);
                child(r, 'stats', 'daily').completed = Array.from({ length: 401 }, (_, i) =>
                    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
                );
            },
        ],
        ['an extra record key', (r) => (r.extra = 1)],
        ['a null session', (r) => (r.session = null)],
        ['an extra session key', (r) => (child(r, 'session').extra = 1)],
        [
            'a missing session key',
            (r) => {
                delete child(r, 'session').counted;
            },
        ],
        ['a non-boolean counted', (r) => (child(r, 'session').counted = 1)],
        ['an extra key on the position in play', (r) => (child(r, 'session', 'current').extra = 1)],
        [
            'an extra key on a card of the position in play',
            (r) => (child(r, 'session', 'current', 'tableau', 0, 0).extra = 1),
        ],
        ['an extra key on a card of a step', (r) => (child(r, 'session', 'history', 1, 'tableau', 0, 0).extra = 1)],
        ['an extra key on a card of a redo step', (r) => (child(r, 'session', 'future', 0, 'tableau', 0, 0).extra = 1)],
        ['a Daily date on a game that is not a Daily deal', (r) => (child(r, 'session').dailyKey = '2026-02-01')],
        ['a streak above the best streak', (r) => (child(r, 'stats', 'modes', 'draw1').streak = 4)],
        [
            'a step missing its foundations',
            (r) => {
                delete child(r, 'session', 'history', 1).foundations;
            },
        ],
        [
            'a step with a misspelt foundations key',
            (r) => {
                const step = child(r, 'session', 'history', 1);
                step.foundation = step.foundations;
                delete step.foundations;
            },
        ],
        [
            'a step whose tableau holds bare card ids',
            (r) => (child(r, 'session', 'history', 1).tableau = [[1], [], [], [], [], [], []]),
        ],
        ['a bad dailyKey', (r) => (child(r, 'session').dailyKey = '2026-02-30')],
        ['a non-string dailyKey', (r) => (child(r, 'session').dailyKey = 20260201)],
        [
            'more than 200 undo steps',
            (r) => {
                const steps = child(r, 'session').history as unknown[];
                child(r, 'session').history = Array.from({ length: 201 }, () => steps[0]);
            },
        ],
        [
            'more than 200 redo steps',
            (r) => {
                const steps = child(r, 'session').future as unknown[];
                child(r, 'session').future = Array.from({ length: 201 }, () => steps[0]);
            },
        ],
        [
            'a step that is a full game state carrying its seed',
            (r) => {
                const current = child(r, 'session', 'current');
                (child(r, 'session').history as unknown[])[0] = { ...current };
            },
        ],
        ['a step with an extra key', (r) => (child(r, 'session', 'history', 0).seed = 1)],
        [
            'a step with a missing key',
            (r) => {
                delete child(r, 'session', 'history', 0).undos;
            },
        ],
        ['a step whose piles are not a valid position', (r) => (child(r, 'session', 'history', 1).stock = [])],
        ['a redo step that repeats a card', (r) => (child(r, 'session', 'future', 0).waste = [0, 0])],
        ['a step with a negative move count', (r) => (child(r, 'session', 'history', 1).moves = -1)],
        ['a non-array history', (r) => (child(r, 'session').history = {})],
    ])('rejects %s', (_name, change) => {
        expect(decodeRecord(edited(validRaw(), change))).toEqual(invalid);
    });

    it('rejects a stored won game', () => {
        const won = playSteps(dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode), parseLine(WINNING_LINE.line)).current;
        const raw = edited(validRaw(), (r) => (child(r, 'session').current = JSON.parse(JSON.stringify(won)) as Loose));
        expect(won.status).toBe('won');
        expect(decodeRecord(raw)).toEqual(invalid);
    });

    it('rejects a stored unstarted game', () => {
        const fresh = dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode);
        const raw = edited(
            validRaw(),
            (r) => (child(r, 'session').current = JSON.parse(JSON.stringify(fresh)) as Loose),
        );
        expect(decodeRecord(raw)).toEqual(invalid);
    });

    it('rejects a position in play that is not a valid game', () => {
        const raw = edited(validRaw(), (r) => (child(r, 'session', 'current').status = 'finished'));
        expect(decodeRecord(raw)).toEqual(invalid);
    });

    it('ignores a hidden __proto__ key rather than trusting it', () => {
        const raw = validRaw().replace('{"version":1,', '{"__proto__":{"x":1},"version":1,');
        expect(decodeRecord(raw)).toEqual(invalid);
    });
});

describe('decoding is total', () => {
    it('never throws on 200 seeded random strings, arbitrary or mutated from a valid record', () => {
        const random = mulberry32(20260925);
        const valid = validRaw();
        const noOpening = encodeRecord({
            preferences: defaultPreferences('en'),
            stats: defaultStats(),
            game: { current: null, history: [], future: [], dailyKey: null, counted: false },
        });
        const alphabet = '{}[]",:0123456789.-+eE truefalsnul\\/\u0000 \ud800abcXYZ';
        const pick = (n: number) => Math.floor(random() * n);

        const outcomes = new Set<string>();
        for (let i = 0; i < 200; i++) {
            let raw: string;
            if (i % 2 === 0) {
                raw = Array.from({ length: pick(60) }, () => alphabet.charAt(pick(alphabet.length))).join('');
            } else {
                const base = i % 4 === 1 ? valid : noOpening;
                const chars = Array.from(base);
                for (let m = 0; m <= pick(4); m++) {
                    const at = pick(chars.length);
                    const kind = pick(3);
                    if (kind === 0) chars.splice(at, 1);
                    else if (kind === 1) chars.splice(at, 0, alphabet.charAt(pick(alphabet.length)));
                    else chars[at] = alphabet.charAt(pick(alphabet.length));
                }
                raw = chars.join('');
            }
            const result = decodeRecord(raw);
            outcomes.add(result.ok ? 'ok' : result.reason);
        }

        expect(outcomes.has('malformed')).toBe(true);
        expect(outcomes.has('invalid')).toBe(true);
    });

    it.each<[string, string, 'future' | 'invalid']>([
        ['arrays as sections', '{"version":1,"preferences":[],"stats":[]}', 'invalid'],
        ['an infinite version', '{"version":1e999}', 'future'],
        ['nested arrays', '[[[[[[]]]]]]', 'invalid'],
        ['an empty session and no sections', '{"version":1,"session":{}}', 'invalid'],
        ['a negative infinite version', '{"version":-1e999}', 'invalid'],
        ['a null version', '{"version":null}', 'invalid'],
    ])('decodes %s to a failure without throwing', (_name, raw, reason) => {
        expect(decodeRecord(raw)).toEqual({ ok: false, reason });
    });
});
