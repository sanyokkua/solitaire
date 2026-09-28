# Proposal

## Why

Phase 1 delivered a buildable, deployable application shell with no game; `src/domain/` holds only a
`README.md`. Every later phase consumes the rules engine: the Phase 3 solver searches its states and
commands, the Phase 4 `game` slice snapshots its `GameState`, and Phases 5–7 render those snapshots
and dispatch those commands. This change implements Phase 2 of `docs/spec/phased-design.md` §7: the
complete Klondike rules as a pure, deterministic, seeded module with no React, Redux, DOM, storage or
worker dependency.

## What Changes

- **Card model and randomness:** `CardId 0..51` (`suit = id/13|0`, `rank = id%13+1`), suit/rank/colour
  helpers, locale-independent label keys, the foundation display order; `mulberry32` as the only
  source of randomness in game logic; the Fisher–Yates (Durstenfeld) shuffle; `cryptoSeed(source?)`
  with an injected entropy source.
- **Deals and deal codes:** the *R§2.1* row-by-row deal from a seed and mode; deal codes
  `<mode letter>-<seed as 7 base-36 characters>` (`1-K7Q29XD`), case- and whitespace-insensitive,
  with decode returning `null` instead of throwing.
- **Move rules:** movable groups, legal drop targets, the canonical scan order, pass limits,
  recycle permission and win detection per *R§2.2*.
- **Engine:** `applyCommand(state, cmd) → { state, events }` — pure, never throws, returns the input
  state by reference when a command is refused, and folds in the move score.
- **Scoring:** Standard and Vegas deltas per *R§5.1–5.2*, the time penalty, the undo cost, the win
  bonus and the displayed score.
- **Assistance (decision functions only):** hint heuristic (*R§6.1*), safe foundation moves (*R§6.2*),
  finish plan (*R§6.3*), dead-end detection (*R§6.4*), smart-tap target (*R§6.5*). Finish issues
  ordinary commands — its recycles are charged and pass-limited — and is available exactly when a
  plan reaches a won position.
- **Guards and coverage:** a static purity test plus an ESLint `no-restricted-imports` override on
  `src/domain/**`; coverage measured across every source file.
- **Specification-pack alignment (task 7.2):**
  - `research.md` §5.1: the Draw 3 recycle charge of −20 applies from the 3rd recycle onward (after
    three free passes).
  - `research.md` §6.3, `specification.md` §4.3 and *KS-AST-05*: Finish is available when a plan
    completes under the ordinary rules; its recycles are charged and pass-limited.
  - `research.md` §5.2: this product has no one-card Vegas mode, so that pass limit is not
    implemented.
  - `research.md` §2.4: ♥ ♣ ♦ ♠ is the foundation *display* order, distinct from the suit encoding.
  - `specification.md` §5: `GameState.score` is the move score; the displayed score is derived.
  - `phased-design.md` §3.2 shapes (tuples, `readonly`, typed rejection reason, `passes` from 1);
    §4 Finish and Timer rows; §7 Phase 2 coverage gate is the project-wide 80% floor.

**Not in this change:** the solver, worker, winnable-deal selection and Daily seed (Phase 3); undo
history, the `game` slice, the clock, statistics and persistence (Phase 4); layout and animation
(Phase 5); pointer, drag and keyboard controllers and hint/notice display (Phase 6).
`GameState.verdict` and `GameState.attempts` are defined and defaulted here; Phase 3 populates them.

## Capabilities

### New Capabilities

- `domain/card-model`: card identity encoding, labels, foundation display order, seeded generator,
  fresh-seed source and shuffle.
- `domain/deal-generation`: seed and mode to a dealt `GameState`, and the deal code.
- `domain/move-rules`: movable groups, legal drops, canonical scan order, stock passes and win.
- `domain/scoring`: Standard and Vegas deltas, time penalty, undo cost, win bonus, displayed score.
- `domain/game-engine`: `applyCommand`, its events, rejection contract and counters.
- `domain/assistance`: hint, safe moves, finish plan, dead-end detection and smart-tap target.

### Modified Capabilities

- `app/application-shell`: "Layers reserved for later phases carry no behaviour" — the domain layer
  is removed from the reserved list and gets its own isolation requirement; solver, features, i18n
  and pwa stay reserved.
- `tooling/repository-foundation`: "Test suites separated by execution layer" — coverage covers every
  source file, so an untested module counts against the thresholds.

## Impact

- **`src/domain`:** nine modules (`types`, `cards`, `prng`, `dealCode`, `deal`, `rules`, `scoring`,
  `engine`, `assist`) and a rewritten `README.md`; no barrel file.
- **`src/solver`, `src/features`, `src/app`, `src/i18n`, `src/pwa`, `src/ui`:** untouched; the engine
  is not wired into the store, any screen or any worker.
- **`tests/`:** new `unit/domain/` suites and `fixtures/` (`deals.ts`, `states.ts`);
  `unit/repo/domainPurity.test.ts` added, `unit/repo/reservedLayers.test.ts` narrowed.
- **Configuration:** `vitest.config.ts` (coverage include), `eslint.config.js` (domain import
  override). `package.json`, `validate` and both workflows are unchanged.
- **Docs:** `docs/spec/specification.md`, `research.md`, `phased-design.md` as listed above;
  `AGENTS.md`.
- **Constitution:** principle 1 gains one exception — `prng.ts`'s `cryptoSeed` reads the `crypto`
  global through an injected, defaulted parameter. Principle 2 is unaffected: every deal is
  `mulberry32(seed)`, and `cryptoSeed` only chooses the seed, called by Phase 3's deal service.
