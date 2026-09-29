# Storage format

All persistent data is one JSON string in browser `localStorage` under the key `solitaire.local-state`, version 2.
Source: `src/features/persistence/recordCodec.ts` (record, preferences, stats) and
`src/features/persistence/sessionCodec.ts` (session). The codec is pure; storage is reached only through
`src/features/persistence/storageGateway.ts#createStorageGateway`. See
[state-and-persistence.md](../architecture/state-and-persistence.md) for how it is read and written.

## Keys

| Key                                | Constant                                              | Purpose                                             |
| ---------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `solitaire.local-state`            | `src/features/persistence/recordCodec.ts#STORAGE_KEY` | the record                                          |
| `solitaire.local-state.unreadable` | `src/features/persistence/recordCodec.ts#BACKUP_KEY`  | verbatim copy of a record that could not be decoded |

## Record

`src/features/persistence/recordCodec.ts#encodeRecord` builds every object field by field in a fixed order, so equal
state always gives the identical string.

Top-level key order: `version`, `preferences`, `stats`, then `session` only while a game is resumable.

```json
{ "version": 2, "preferences": {}, "stats": {}, "session": {} }
```

### `preferences`

Exactly these thirteen keys, in this order (`PREFERENCE_KEYS`). Defaults are from
`src/features/preferences/preferencesSlice.ts#defaultPreferences`.

| Key            | Allowed values                                                       | Default                                                                                 |
| -------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `theme`        | `light`, `dark`, `system`                                            | `system`                                                                                |
| `nightCards`   | boolean                                                              | `false`                                                                                 |
| `fourColor`    | boolean                                                              | `false`                                                                                 |
| `cardBack`     | `harbour`, `navy`, `sky`, `coral`                                    | `harbour`                                                                               |
| `tapMode`      | `smart`, `select`                                                    | `smart`                                                                                 |
| `highlight`    | boolean                                                              | `true`                                                                                  |
| `autoSafe`     | boolean                                                              | `false`                                                                                 |
| `stockRight`   | boolean                                                              | `false`                                                                                 |
| `animations`   | boolean                                                              | `true`                                                                                  |
| `locale`       | a supported locale (`en`, `uk`; from `src/i18n/catalog.ts#CATALOGS`) | first language from `navigator.languages` that is supported (primary subtag), else `en` |
| `winnableOnly` | boolean                                                              | `true`                                                                                  |
| `selectedMode` | `draw1`, `draw3`, `vegas`, `daily`                                   | `draw1`                                                                                 |
| `difficulty`   | `any`, `easy`, `medium`, `hard`                                      | `any`                                                                                   |

### Versions and the upgrade

| Version | Written by                         | Difference                                                                                                        |
| ------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1       | the first release                  | twelve preference keys (no `difficulty`); seventeen game keys (no `grade`)                                        |
| 2       | the current app (`RECORD_VERSION`) | thirteen preference keys (`difficulty` last); eighteen game keys (`grade` right after `attempts`); same step keys |

The decoder reads both. A readable version 1 record is upgraded in memory and without loss: every value is kept and
`difficulty` is set to `any` (`recordCodec.ts#upgradeV1`), and the stored game is checked against the version 1 game
keys on the raw record and then given `grade: null` (`sessionCodec.ts#upgradeV1`; `decodeSession` takes the record
version), before the validity check that requires a grade. A version 1 game never recorded a grade, so it gets none;
its steps read the game's grade like every other step. Because it decodes, the loader treats it as a valid
record: there is no backup copy and no notice. The record stays version 1 in storage until the next save, which
writes it as version 2; a version 1 record is never written again. Each version is checked against its own exact key
set, so a version 1 record with a `difficulty` key or a game with a `grade` key, and a version 2 record without
`difficulty` or whose game has no `grade`, are all `invalid`.

### `stats`

Exactly `modes` and `daily`.

- `modes` has exactly the four keys `draw1`, `draw3`, `vegas`, `daily`, each with exactly, in order: `played`,
  `won`, `streak`, `bestStreak` (non-negative integers), `bestTimeMs` (finite number >= 0 or `null`), `bestScore`
  (finite number or `null`). Validation also requires `streak <= bestStreak`; `won <= played` is deliberately not
  checked.
- `daily` has exactly `completed` and `bestStreak`. `completed` is an array of at most 400 real UTC dates
  `YYYY-MM-DD`, strictly ascending; `bestStreak` is a non-negative integer.

### `session`

Present only when a game is started and still playing (`src/features/persistence/sessionCodec.ts#encodeSession`);
a won or unstarted game is not stored.

Exactly the keys `current`, `history`, `future`, `dailyKey`, `counted`.

| Key        | Content                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `current`  | the full `GameState` (all 18 fields, see `src/domain/types.ts#GameState`), started and `playing` |
| `history`  | undo steps, oldest first; at most the newest 200                                                 |
| `future`   | redo steps; at most the nearest 200 (the next redo is the last element)                          |
| `dailyKey` | `YYYY-MM-DD` or `null`; non-null only for a `daily` game                                         |
| `counted`  | boolean: the game is already in the statistics                                                   |

A step is compact: only `tableau`, `stock`, `waste`, `foundations`, `score`, `moves`, `passes`, `elapsedMs`,
`undos`, `started`. The constant fields (`seed`, `mode`, `draw`, `scoring`, `verdict`, `attempts`, `grade`) are
copied from `current` on decode, and `status` is always `playing`, so every step belongs to the same deal by
construction; a step that carries a `grade` key of its own is `invalid`. `grade` is `easy`, `medium`, `hard` or `null`,
and only a `win` game may have one. Each
decoded step must pass `src/domain/validate.ts#isValidGameState` (52 distinct cards, consistent piles).

Runtime-only values (`busy`, `epoch`, the clock anchor, interaction state, notices) are never stored.

## Decode outcomes

`src/features/persistence/recordCodec.ts#decodeRecord` is total and never throws. The record is accepted whole or not
at all; a valid part of a bad record is never salvaged.

| Outcome     | Condition                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ok          | valid version 1 or version 2 record (version 1 is upgraded); `session` decoded or `null`                                                |
| `empty`     | the key is absent (`null` input)                                                                                                        |
| `malformed` | the text is not JSON                                                                                                                    |
| `future`    | `version` is a number greater than 2; never interpreted                                                                                 |
| `invalid`   | anything else that is not exactly a valid version 1 or 2 record: wrong version, unknown or missing keys, bad values, an invalid session |

Unknown keys anywhere in the record, preferences, stats, session or a card fail validation.

What the app does with each outcome (from `src/features/persistence/persistenceLoader.ts#loadInitialState`):

- `empty`: defaults, no notice.
- a readable record of version 1 or 2: its values, no notice, no backup (a version 1 record is upgraded first).
- `malformed`, `invalid`, `future`: defaults and the raw string is copied to `solitaire.local-state.unreadable`
  first. If that key was empty or already holds the identical string, notice `storage-read` and saving continues
  (the next save overwrites the main key). If it holds different data or cannot be read or written, saving is
  switched off (read-only) with notice `storage-read-only`, so nothing readable is overwritten.
- Storage cannot be read at all: defaults, read-only, `storage-read-only`.

"Reset all local data" removes both keys (`src/features/persistence/resetThunks.ts#resetAllLocalData`).

## Limits

| Limit                      | Value                        | Source                                                                                                   |
| -------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| stored undo steps          | 200 newest                   | `src/features/persistence/sessionCodec.ts#MAX_STORED_STEPS`                                              |
| stored redo steps          | 200 nearest                  | same                                                                                                     |
| completed Daily dates kept | 400                          | `src/features/stats/statsSlice.ts#MAX_DAILY_COMPLETED`, also enforced by the decoder in `recordCodec.ts` |
| save debounce              | 250 ms after the last change | `src/features/persistence/persistenceWriter.ts` (`DEBOUNCE_MS`)                                          |
| clock-only save interval   | at most every 5 s            | same (`CLOCK_INTERVAL_MS`)                                                                               |
| record version             | 2 (`RECORD_VERSION`)         | `src/features/persistence/recordCodec.ts`                                                                |

The browser's own `localStorage` quota is not checked; a failed write raises the `storage-write` notice.
