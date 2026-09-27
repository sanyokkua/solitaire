# Design

## Context

A design document is warranted: the change crosses `src/domain` ↔ `src/features` ↔ `src/app` ↔
`src/ui`, adds a state slice, adds a second family of pure modules under a purity guard, and
reworks two thunks that other code depends on. There is **no storage change**: the interaction
state is runtime-only, so the versioned `solitaire.local-state` record, its codec and the migration
story are untouched (see Migration Plan).

Current state that shapes the approach (verified against the code):

- **Rules are ready, input is not.** `src/domain` already has `groupAt`, `legalTargets`, `canDrop`,
  `bestTarget` (R§6.5), `hint` (R§6.1), `isDeadEnd` (R§6.4), `isSafe`, `nextSafeMove`,
  `finishPlan`. The UI has no pointer or key handler at all (`Board`, `CardView`, `PileSlot`).
- **Thunks hide results.** `commitCommand` (`gameThunks.ts:56`) drops the engine's events and
  returns a boolean; `play()` returns `Promise<void>`. A refusal, "No redeals left" and every
  announcement need those events. The win is detected only inside `commitCommand`.
- **Two copies of one sequence.** `chainSafeCards` and `finish` repeat guard, epoch capture, `busy`,
  delay loop, re-check and `finally`.
- **`selectFinishable` is keyed on `game.current`**, which the 250 ms clock tick replaces, so
  `finishPlan` is re-simulated about four times a second once every tableau card is face up.
- **`hint()` and `isDeadEnd()` disagree**: `hint` returns draw or recycle whenever the stock or a
  recycle exists, even when nothing in the talon can be played and `isDeadEnd` is true.
- **`assist.ts`** (265 lines) mixes safe moves, hints, dead end, smart tap and the finish plan;
  `TABLEAU_COLS` and `SUITS` are declared in `assist.ts`, `Board.tsx` and `solver.ts`.
- **Hint plumbing exists**: `DealService.hint(state)` returns `HintOutcome` (solver for Draw 1 and
  Daily within 3,000 nodes and 150 ms, else the heuristic); `HintOutcome` is declared twice with
  different shapes (`dealService.ts:47`, `solverClient.ts:22`). No thunk calls it and nothing stores its result.
- **`app.dealing`** is read only for the "Dealing…" status; nothing gates input on it. `SheetId`
  has `'win'` and `'paused'`, but nothing opens a sheet yet. `NoticeId` has only storage notices.
- **Board DOM**: 52 flat `div.card` siblings in card-id order (`role="img"`, no tabindex, no pile
  data), slot `div`s (`role="group"`), a stock badge; positions are `--x/--y` custom properties on
  the element and `transform: translate(var(--x), var(--y))` with a glide transition; the waste has
  no slot. `layout.ts` exposes cards, slots, badge and deal order — no landing rectangles, and the
  waste anchor is private.
- **Reduced motion**: `selectReducedMotion` is the single signal; CSS uses `:root[data-motion='off']`
  and stylesheets are forbidden to use `prefers-reduced-motion` (tokens test).
- **Purity guard**: `tests/unit/repo/boardPurity.test.ts` reads the bullet list of `src/ui/README.md`
  (`` `board/name.ts` ``) and requires each module to be in the ESLint override.
- **Toolbar** has two buttons; `toolbar.test.tsx` L32 asserts exactly that.
  `.game-hint` is an empty `aria-hidden` paragraph that is `display: none` in the side-rails profile
  and in short portrait screens.
- **Playwright** runs the production build in seven projects; specs run in all six device projects
  unless they skip themselves, and a repository test enforces the Chromium-only skip pattern. The
  store is not exposed; `seedRecord` seeds a real v1 record, and `WINNING_LINE` (seed 49, Draw 1,
  117 commands) with `parseLine` gives a full deterministic game.
- **Mockup** (visual authority): selection ring L223; ghosts L240–244 and L964–974; drag L201–205 and
  L1338–1373; shake L225/L229; hint L228 and L1097–1161; toast L304–305; cascade L1212–1231.

## Goals / Non-Goals

**Goals:**
- Every move reachable by tap, drag and keyboard, each proven by a test (constitution 5).
- Drag logic in a small pure state machine with browser-free tests; a swappable DOM binder
  (phased-design guardrail).
- No React re-render per pointer frame; no god component.
- Assistance features visible as in the mockup, each with a no-motion path.
- The listed groundwork items done in dependency order before the features that build on them.

**Non-Goals:**
- The Win sheet, chips, tap-mode hint-line text, New deal and Pause sheets, and the N and P keys.
- Localisation; text is English through descriptors and one formatter.
- Persisting selection, hints or announcements.
- A test hook or store exposure in the production bundle.

## Decisions

### D1 — Interaction state is its own runtime-only slice

A new slice in `src/features/interaction` holds `selection: { from: PileRef; index: number } | null`,
`hint: HintView | null` (source card ids, target `PileRef | 'stock'`, a description descriptor and an
id), `pendingHint: { epoch: number; key: string } | null` (the hint request in flight),
`announcement: { seq: number; items: { n: number; item: Announcement }[] }` (an append-only log, trimmed to
the latest 20) and `deadEndSeen: string[]` (position
keys). It is not part of `game`, so nothing in it can reach persistence, and the writer's snapshot
(which lists its fields explicitly) is unaffected. Extra reducers reset it: `selection`, `hint` and `pendingHint` on
`committed`, `replaced`, `undone`, `redone`, `installed`, `cleared`; `deadEndSeen` on `installed` and
`cleared`. Dependency direction: `interaction` imports `game` (actions, selectors through structural
root types like `GameRoot`), never the reverse for state; `gameThunks` may dispatch `interaction`
actions and thunks, and `interactionThunks` never imports `gameThunks`, so there is no cycle. *Supersedes phased-design §3.3, which puts `selection` and `hint` on `game`; the doc is
updated.* Alternative rejected: fields on `game` — it would widen a slice that persistence and the
clock already depend on.

A reducer cannot see the game, so selecting is a thunk, `selectCard(from, index)`, in
`interactionThunks.ts`: it reads `game.current`, requires `groupAt(state, from, index)` to return a
group, and only then dispatches `selectionSet` (otherwise it clears any selection). Pointer press,
drag start and the keyboard's pick-up all call it, so every path yields the same selection. Selection
is data, not a group, so it never goes stale: selectors derive the group and its legal targets
(`legalTargets`) from the current position and return `undefined` when it no longer applies.

### D2 — One input gate

`selectInputEnabled` combines route = game, `app.dealing === null`, no sheet, a game that is
started-or-fresh and not won, and `!game.busy`. There is no separate cascade term: the win cascade
runs only on a won game, the gate is closed for the whole time a game is won, and Undo and Redo are
already unavailable after a win (`canUndo`/`canRedo` check `status !== 'won'`), so the board is frozen
until the next `installed`/`cleared`. Pointer binder, keyboard binder and the Hint/Finish tools read
it; thunks stay guarded on their own (`play` already ignores `busy` and won). Named selectors replace
inline reads (`selectDealing`, `selectBusy`, `selectEpoch`).

### D3 — Pure controllers, DOM binders

Pure and guarded (listed in `src/ui/README.md`, in the ESLint override, covered by `boardPurity`):

- **`board/pointerController.ts`** — a state machine
  `idle → pressed → dragging → (dropped | cancelled) → idle`. Input events are plain data:
  `down{id, kind: 'mouse'|'touch'|'pen', button, x, y, t, hit}`, `move{x, y}`, `up{x, y, t, hit}`,
  `cancel`, `escape`, `resize`, `gateClosed`. `hit` is resolved by the binder:
  `card{id, from, index, movable}` | `slot{ref}` | `stock` | `column{col}` | `none`. Output is a
  list of effects: `tap{hit, double}`, `dragStart{group}`, `dragMove{dx, dy}`, `drop{dx, dy}`,
  `cancel`. Thresholds: 5 px mouse, 9 px touch/pen, compared as a distance from the press point;
  a tap is a double-tap when the previous tap was on the same card id less than 320 ms earlier
(strictly, as in the mockup; exactly 320 ms is two taps), measured with the event timestamps. A drag
  that ended sets a `suppressClick` flag for the release; pointer types other than the first
  pointer are ignored (multi-touch). Mouse presses other than the primary button are ignored.
- **`board/keyboardController.ts`** — `pileOrder(stockRight)`, `moveFocus(current, key, shift,
  piles, stockRight)` returning the next focus target or `undefined` at the ends (so the binder
  lets Tab leave the board), and `keyToAction(eventLike, ctx)` mapping to `undo | redo | hint |
finish | draw | escape | newDeal | pause | activate | pickUp` (`pickUp` is Shift+Enter or Shift+Space). Ctrl and ⌘ are treated alike. Nothing here
  reads the DOM.
- **`board/locate.ts`** — `cardIndex(state)`: card id → `{from, index, faceUp, movable}` (it takes the game position, not only
  `BoardPiles`, because `isMovable`/`groupAt` need a `GameState`); the
  binder and the tests use it instead of parsing the DOM.
- **`board/landing.ts`** — `landingAreas(layout, metrics, piles)` → a map from a pile key to a
  rectangle, and `pickLargestOverlap(rect, candidates)`. Rules (the mockup's `dropTarget`, L1351–1365,
  stated once): foundation, stock and waste = their slot (waste: its anchor); column = the card
  width, from the tableau top (`tabY`) to `next + 1.2 × card height`, where `next` is the y where the
  next card would land on that column (an empty column: its slot's top). The waste anchor is exported
  from `layout.ts` (it exists as a private `anchorsOf` result).

- **`board/cascadeFrames.ts`** — the pure cascade paths (D10).

Not pure, not listed: `useBoardActions.ts` (the one `activate(hit)` function that maps a resolved hit
to a command, selection or shake; pointer and keyboard both call it), `useBoardPointer.ts` (pointer listeners on the board, pointer capture,
element-from-target hit, drag style writes, glide-back release), `useBoardKeyboard.ts`, `useGameShortcuts.ts`, `Ghosts.tsx`,
`cascade.ts` (the WAAPI runner) and `useCascade.ts`. Time and DOM stay in these; the state machines take timestamps as data, so unit tests
need neither a clock nor a browser. *Fallback:* if a browser misbehaves with pointer capture, only
`useBoardPointer.ts` is swapped (dnd-kit is the fallback); the controller, state and rendering are
unchanged.

### D4 — Drag rendering with no React state per frame

One delegated set of listeners (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`,
`lostpointercapture`, `click` in capture phase, `contextmenu`) on `div.board`; no per-card handlers.
The binder captures the pointer on press of a movable card. On `dragStart` it marks the dragged
cards with a class `is-dragging` and sets `--k` (their index in the run); on `dragMove` it writes
only `--dx` and `--dy` on those elements. CSS does the rest:

```css
.card.is-dragging { transition: none; z-index: calc(var(--drag-z-base) + var(--k)) !important;
  transform: translate(calc(var(--x) + var(--dx, 0px)), calc(var(--y) + var(--dy, 0px))); }
```

`!important` beats the React-owned inline `z-index`; `--x/--y` stay React-owned, so React never
conflicts with a drag write. On release the binder removes the class and properties: a legal drop
dispatches `play(move)` (the cards then glide to their new place through the normal transition), an
illegal drop leaves the position unchanged and the removed offset glides back. A drag start calls
`selectCard`, so `Ghosts` render once for the legal targets; the hot ghost is one `classList`
toggle per change of the overlap winner. The board sets `touch-action: none`, `user-select: none`,
`-webkit-user-select: none`, `-webkit-touch-callout: none` and swallows `contextmenu` (KS-INP-10).
The `[size]` layout effect (in `Board`, or in `useResizeSettle` after task 2.3) calls `controller.resize()`, which cancels a drag
(phased-design: moved from Phase 5). Under `data-motion='off'`, `is-dragging` and the release have no
transition either way.

### D5 — Visuals from the mockup; tokens; no-motion

CSS is ported by role, not by copy: `.ghost` (dashed 2.5 px, 10% fill, opacity .8; `is-hot` solid,
22% fill), `.card.is-selected` outline 3 px (drawn outside the card edge, see the colours below), `.card.is-hint` pulse (`hint-pulse` 900 ms × 2),
`.ghost.is-hint` (amber, `ghost-pulse`), `.slot.is-hint`, `.card.is-shake` (`shake` 320 ms on the
`translate` property so it composes with `transform`).

Colours: the mockup's light values fail the 3:1 rule this change sets (`#3a9bbf` on the light table
`#d4e4ee` is 2.4:1, `#5bc0eb` 1.6:1, the existing `--color-hint` `#f2b25c` 1.4:1), and the dark card face
`#d2dde5` is too light for the dark marks, so state marks are drawn at or outside the card edge
(`outline` with an offset, not a fill on the face) and measured against the table only. New tokens in
the light and dark blocks (not the night-card block), measured against `--color-table`: `--color-legal`
light `#1f6f96` (4.3:1) / dark `#5bc0eb` (6.8:1); `--color-focus` light `#1d5f85` (5.3:1) / dark
`#f2c078` (8.4:1); `--color-hint-line` light `#8a5a00` (4.6:1) / dark `#f2c078` (8.4:1); the selection
ring reuses `--color-primary` (3.5 / 6.8:1). `--color-hint` stays for fills. The drag lift shadow
reuses `--shadow-card` (the mockup's `rgb()` literal is forbidden by the colour-literal guard).
`tokens.test.ts` extends `LIGHT_DARK_TOKENS`; `contrast.test.ts` gets a 3:1 constant for the state
marks (text stays 4.5:1). Every `animation` gets a `:root[data-motion='off']` override: pulses become a
steady amber outline for the same 2 s, the shake is `none`, and the shake's information goes to the
announcer instead. Ghost z-order: ghost 250 (below `TABLEAU_Z` 300, so it never ties with the last
card and shows in the strip below it, as the mockup does), hot 1500, drag 1600+.

### D6 — Roles, focus and the announcer

- **Roles.** `CardView` gets `role="button"`, `tabIndex`, `aria-pressed` when the card is movable
  (`cardIndex(...).movable`); other cards keep `role="img"`. Stock and empty-column/foundation slots
  become `role="button"` with their pile name. Elements carry `data-pile` and `data-index` so the
  binder can resolve a hit from `event.target.closest(...)` without geometry; the empty part of a
  column resolves through `landingAreas`.
- **Pick-up.** `activate` follows the tap setting; `pickUp` (Shift+Enter, Shift+Space) always selects
  through `selectCard`, and on the already selected card it, not `activate`, dispatches
  `selectionCleared`; while a selection exists Enter and Space follow the Select-and-place
  rules in either setting, so a keyboard player can choose any legal target in Smart move mode.
- **Focus model.** One tab stop per pile: the pile's remembered focus card, else its top movable
  card, else the pile slot (an empty waste has neither and is skipped by `pileOrder`). The DOM order of the cards is card-id order, so browser Tab order is
  wrong; the binder therefore keeps exactly one `tabindex=0` element on the board at a time (the
  current focus target) and handles Tab / Shift+Tab itself with `moveFocus`; at the first and last
  pile it returns `undefined`, the binder does not `preventDefault`, and the browser leaves the
  board (with the roving tab stop the natural next control is the toolbar). Arrows move within and
  between piles, honouring `stockRight` mirroring. After a move, focus follows the moved card if it
  is still movable, else the destination pile's stop. Focus never rests on a face-down card. The
  ring is `.board .card:focus-visible::after`, a frame 5 to 8px outside the card edge (the selection
  ring already uses the face's `outline` and reaches 4px, and a selected card is normally the focused
  one, so the two must not share it), and `.board .slot:focus-visible` as an outline, both with
  `--color-focus`. A new game epoch resets the focus position to the stock and forgets the remembered
  cards, since card ids are reused across deals.
- **Announcer.** Thunks emit typed `Announcement` descriptors (`moved{cards, from, to}`,
`drew{count}`, `recycled`, `undone`, `redone`, `hinted{...}`, `refused{reason}`, `dead-end`,
`sentHome{count}` (one summary when a safe-card chain or Finish ends), `won`). `announced(items)` appends to the slice's log (each item gets a running number `n`) and bumps
  `seq`; a thunk that produces several items (a move and its dead end; a sequence's `sentHome` and
  `won`) dispatches them in one call, and later batches never overwrite earlier ones. `src/ui/announce.ts`
  formats them in English (reusing `cardName` and `pileName`); `Announcer.tsx` renders, on each `seq` change, the items it has not yet
  spoken (joined into one text) in a visually hidden `role="status"` (`aria-live="polite"`) region and
  appends a zero-width alternating character when the text repeats so identical consecutive messages
  are spoken. The text is derived from the log, not from the position, so clock ticks do not touch it. Phase 7 replaces only the
  formatter. `src/i18n` stays empty (reserved-layer guard).

### D7 — Hint

`requestHint` (thunk): gate check; `advise(state)`; a dead end raises the dead-end notice and
announces it, and no hint is set. Otherwise it captures `{epoch, positionKey}`, awaits
`dealService.hint(state)`, and drops the answer on `cancelled`/`none`, or if the epoch or key
changed; otherwise it maps the hint (`SolverHint` or `Hint`, one type after D13) to a `HintView`, sets
it, announces it and clears it after 2,200 ms through the injected `delay` (with a token so a newer
hint is not cleared by an older timer). Any pointer press, undo, redo, commit and setting change
clears it early. Vegas and Draw 3 never ask the solver (already true in the deal service). While the
answer is pending the buttons stay usable; a request whose `{epoch, positionKey}` equals
`pendingHint` returns without asking again (the in-flight request is recorded in the slice, not in a
module variable, so parallel stores stay independent).

### D8 — Dead end and notices

`checkDeadEnd` runs at the end of `play` (after the safe chain) and `finish`, not after undo or redo,
on the settled position: `isDeadEnd(state)` and `positionKey(state)` not in `deadEndSeen` → add the key
and raise the `dead-end` notice with a `deadEnd` announcement (spoken by the announcer only). `positionKey` is a new pure domain function over
the piles only; the solver's canonical key stays private to the solver layer (features may not
value-import solver code). `NoticeId` gains `'dead-end'` and `'no-redeals'`. `Notices.tsx` renders every
raised notice from an English table; transient ids auto-dismiss after 3,200 ms (a `useEffect` timer in
the component, since it is presentation), storage ids show a Dismiss button. `AppState` becomes
`readonly` (D13). The host is `position: fixed` with safe-area insets and has no live region for the dead-end and
`no-redeals` messages (the announcer speaks them, from the `deadEnd` and `refused` descriptors), so
they are not spoken twice; each storage notice is its own `role="status"`. The host
uses the existing `sheet-in` motion only when motion is on.

### D9 — Finish and the toolbar

The toolbar grows to four tools (Undo, Redo, Hint, Finish). Finish's enabled state is
`selectCanFinish` and its highlight class is `is-ready` (mockup). Icons come from one shared `Icon`
component (D13). `finish()` is unchanged in behaviour: it charges, counts and pass-limits draws and
recycles like the player's (the mockup makes them free; the specification wins). The gate is closed
while it runs because it is `busy`.

### D10 — Win cascade

The win is detected in `commitCommand` (unchanged) and announced as `won`. A UI hook, `useCascade`
(used by `Board`), keyed on the game status, starts the runner `cascade.ts` when the game becomes won
unless motion is reduced, and cancels it when a new game is installed or the game is cleared; it
holds the running animations in a ref and needs no store state, because the gate is closed for the
whole time a game is won (D2). `cascadeFrames(starts, size, cardSize, rng)` in `src/ui/board/cascadeFrames.ts`
is a pure function (listed and guarded) that returns per-card keyframes from each card's start (a
board-space point from the layout, which depends only on the board size) — gravity 0.5, bounce factor
0.72, up to 180 frames, initial `vx = (rng()×3 + 2.5) × ±1`, `vy = −(rng()×5 + 1)`, stop once beyond
the sides, ordering K→A × ♥ ♣ ♦ ♠ — and the runner `cascade.ts` plays them as WAAPI animations with a
70 ms stagger and `fill: 'forwards'`, on `transform` and `opacity` only. A fixed rng gives fixed
frames (unit-tested). With reduced motion there is no cascade. The Win sheet arrives in Phase 7, at
which point the sheet opens over the running cascade (mockup 2,400 ms); this change leaves only the
`won` announcement as the hook.

### D11 — Tap semantics as commands

The binder maps controller effects to typed commands through domain helpers; it never applies rules:

| Effect | Smart mode | Select mode |
| --- | --- | --- |
| tap movable card | `bestTarget` → `play(move)`; none → shake + `refused` | with a selection: place if the tapped card's pile is a legal target (placing wins), else re-select; without one: select; tapping the selected card clears it |
| tap slot or column area | place a selection if any; else nothing | same |
| double tap (second tap within 320 ms on the same card) | ignored: the first tap already sent a fitting single card home (`bestTarget` prefers a foundation) or moved it elsewhere | fits → foundation `move` (counted); otherwise handled as two ordinary taps |
| tap stock | `play(draw)`; empty stock → `play(draw)` recycles; refused → `no-redeals` | same |
| drag | same in both modes | same |

`bestTarget` may return a foundation, so a double tap of a single card that fits uses the same
helper restricted to a foundation result. In Smart mode every second tap of a double-tap is ignored, so it can neither repeat nor
undo the first tap's move (a foundation top tapped first is smart-moved by KS-INP-01, `bestTarget` may
offer a column, and the second tap must not move it back). A refusal reason `pass-limit` raises `no-redeals`. Select
mode's waste card is not a drop target (mockup). Foundation tops can be picked up (engine
`groupAt`). The stock cannot be dragged.

### D12 — End-to-end without a test hook

The archived D13 stays: no store on `window`. The fixture deal is `{ ...dealFromSeed(49, 'draw1'),
started: true }` (`WINNING_LINE.seed`; `dealFromSeed` is `src/domain/deal.ts` and returns
`started: false`, so the spread is required for "Continue game" to appear), seeded through
`seedRecord` with preferences `tapMode: 'select'` and `autoSafe: false` (the default is Smart move) so
the line does not diverge. Verified: with `applyCommand` the 117-command line wins; it has 52
foundation moves, 31 tableau moves (5 multi-card runs, longest 7 cards), 34 stock actions (one
recycle) and no move from a foundation. The pure translation of a line command to a gesture plan
lives in `tests/e2e/support/lineGestures.ts` (no Playwright import, so Vitest can test it under
`tests/unit/`); `tests/e2e/support/play.ts` executes the plan through `parseLine(WINNING_LINE.line)`
with three strategies:
- **tap** — Select and place (tap the source card, then the target), because smart tap chooses its
  own target and would diverge from the line; the draw is a tap on the stock. A separate short
  scenario covers smart tap and double-tap on a small seeded position;
- **drag** — mouse down on the source card, move to the target's landing area centre, release;
- **keyboard** — focus the source pile with arrows, move to the card index, Enter, move to the target
  pile, Enter; the stock is drawn by arrowing to it and pressing Enter (Space draws only when nothing on
  the board is focused, and after a move focus follows the moved card). A separate short scenario in Smart move mode uses Shift+Enter to pick a
  card up and Enter on a chosen column.
The win is asserted through the live region ("You win") and the HUD. The three-way win runs in
Chromium only (guard pattern: the skip line from `playwrightProjects.test.ts`, and each new spec is
appended to `CHROMIUM_ONLY_SPECS` there); each of the three specs sets a raised per-test timeout
(`test.setTimeout`), since the default 30 s is short for 117 commands with 0.24 s glides.

Touch drag: Playwright's `page.touchscreen` only taps and CDP touch events exist only in Chromium, so
`galaxy-s25` (Chromium) drags with CDP `Input.dispatchTouchEvent` and asserts the move and `scrollY`;
the WebKit iPhone projects (`iphone-17-pro`, `iphone-14-pro-max`) assert the board's computed
`touch-action: none` and that a pointer-event drag applies the move. That a real iOS scroll is
suppressed is the manual checkpoint (5.4), not an automated claim. Projects are three desktop
(`chromium`, `firefox`, `webkit`), three device (`iphone-17-pro`, `iphone-14-pro-max`, `galaxy-s25`)
and `device-fit`. The no-hook check is an e2e assertion against the production build (`page.evaluate`
over `window`), not a unit test over `dist` (`test:unit` runs before `build` in `validate`).
Visual parity adds mockup screens 08 (select with ghost), 09 (hint) and 12 (cascade) to the existing
by-eye screenshot spec. The manual real-phone checkpoint (iPhone, Galaxy) does not block later tasks;
the user runs it and confirms the outcome directly (11.2), rather than it being recorded in a
permanent checklist file.

### D13 — Groundwork refactors (behaviour-preserving)

Enabling and quality work that lands before the features that build on it. It adds no requirement of
its own: its acceptance is that the existing suites stay green and each item's own named test passes.
Where a check is structural (one definition of a constant or a test double) the compiler and ESLint
enforce it through the single import; no source-scan test is added for it.


- **`assist.ts` split** by concern into `safeMoves.ts` (`isSafe`, `nextSafeMove`), `hint.ts`
  (`hint`), `smartTap.ts` (`bestTarget`), `finish.ts` (`finishPlan`), `deadEnd.ts`
  (`isDeadEnd`, plus `advise`, which cannot live in `hint.ts` because `deadEnd.ts` imports it) and `position.ts` (`positionKey`); `cards.ts` exports `TABLEAU_COLS` and `SUITS`,
  used by these, `Board.tsx` (`TABLEAU_COLS`) and the solver (`SUITS`; it has no `TABLEAU_COLS`). Public function signatures are unchanged; callers'
  imports move. `domain/README.md` is updated. The solver's inlined R§6.2 and `fitsOnto` stay (hot
  path, documented).
- **`advise(state)`** (in `deadEnd.ts`) returns `Advice | undefined` with `Advice = { kind: 'dead-end' } | Hint`: it
  evaluates `isDeadEnd` first, then `hint`; `undefined` only for a won position. `hint()` keeps its R§6.1 list.
- **Two `HintOutcome` declarations, one name each**: the two shapes differ (`dealService.ts`'s is
  `hint | none | cancelled`; `solverClient.ts`'s is `ok | cancelled | timeout | busy | failed`) and
  `dealService.ts` already imports `solverClient.ts`, so one shared type is impossible. `dealService.ts`
  keeps `HintOutcome`; `solverClient.ts`'s is renamed `SolverHintOutcome`. `SolverHint` becomes
  `Omit<MoveHint,'priority'> | Exclude<Hint, MoveHint>` derived from `Hint`.
- **`selectFinishable`** keyed on what `finishPlan` depends on (the pile arrays by reference, plus `draw`,
  `passes`, `mode` and `status`, so a Vegas pass change is not missed) through a `createSelector` with
  `lruMemoize` and a custom `equalityCheck` in `src/features/game/gameSlice.ts` (`gameSlice` uses the
  structural `GameRoot` to avoid importing the store), with a test that a clock accrual does not recompute the
  plan (`vi.mock` of the new `finish.ts` with `importActual`, counting `finishPlan` calls).
- **`gameSlice`** duplicate branches in `accrued` and the `{...game, current}` narrowing are
  simplified; `AppState` becomes `readonly`; the garbled comment in `gameThunks.ts` is fixed.
- **UI**: `Board.tsx` gives its resize-flag and deal effects to `useResizeSettle` and
  `useDealAnimation` before the pointer and keyboard hooks arrive, keeping it a composition of hooks
  and children; shared `Icon` replaces three copies of the stroke SVG attributes; `RANK_WORDS` is
  `Record<Rank, string>` keyed by the numeric `Rank` and read with `rankOf(id)` (today it is keyed by the
  rank label with a `?? rank` fallback); `BADGE_Z` and `TEXT_PRESENTATION` move to a shared constants module;
  a unit test compares the `animations.ts` constants that mirror a token (`DEAL_STEP_MS` ↔
  `--motion-deal-step`, the card-radius factor ↔ `--card-radius-factor`) with `tokens.css`; `FLIP_LEAD_MS`
  and `SETTLE_MS` have no token and are not compared. `Board.tsx`'s third effect (`dealOrderRef`) moves
  with `useDealAnimation`.
- **Tests**: `tests/support/fakeResizeObserver.ts` and `tests/support/matchMedia.ts` replace the
  copies: the resize observer in `board.test.tsx`, `dealAnimation.test.tsx` and `useBoardSize.test.tsx`;
  `matchMedia` in `board.test.tsx`, `gameFrame.test.tsx`, `useMediaQuery.test.tsx` and
  `appLifecycle.wiring.test.tsx` (where the semantics allow). The pointer-capture and WAAPI stubs that
  jsdom lacks (`setPointerCapture`, `Element.animate`) are added to `tests/support/` by the tasks that
  need them (5.2, 9.2), not assumed here.

### D14 — Commit outcome and the sequence runner

`commitCommand` returns `CommitResult = { accepted: boolean; events: readonly GameEvent[] }` and
dispatches the announcement for a player command's events; `play` returns the same result of the
player's command (after the chain). A private `runSequence({ guard, next, spacing, entry })` in
`gameThunks.ts` owns guard, epoch capture, `busy`, delay, re-check and `finally`, and dispatches one
`sentHome{count}` announcement when the sequence ends (the steps commit without their own
announcement); `chainSafeCards` and `finish` become thin descriptions of "what is the next command"
and "which entry kind". Its two behaviours that were unverified — a game replaced mid-sequence
leaves the new game's `busy` alone, and a throwing step clears `busy` and rejects to the caller — are
unit-tested for both sequences. The cascade does not use it (it is UI, not commands). Existing
behaviour and tests stay; the reports are additive.

## Risks / Trade-offs

- **Pointer behaviour differs across browsers** (WebKit pointer capture, Firefox touch emulation).
  Mitigated by the small controller, e2e in the desktop and device projects (touch-drag automation
  only in Chromium, D12), and the drag-first order with a real-phone checkpoint.
- **Roving focus with a flat DOM.** Tab is handled by the binder because DOM order is card-id order;
  a missing `preventDefault` or an off-by-one at the ends would trap or skip focus. Unit tests on
  `moveFocus` and a component test cover the ends.
- **`!important` z-index for dragged cards** is deliberate and commented; the alternative (writing
  React-owned z-index) would fight React.
- **Solver hints arrive late.** The 150 ms timeout falls back to the heuristic; stale results are
  dropped by epoch and position key.
- **The e2e specs are long** (117 commands each). Each is a Chromium-only spec with a raised timeout;
  unit and component tests cover most input logic.
- **Rapid double-click on the waste in Smart mode** smart-taps the next waste card too (a different card
  id, so not a "double"); accepted, undo is one step per move.
- **Announcement volume.** Decided now, not left to chance: a chain or Finish announces once, when it
  ends (`sentHome{count}`), so a Finish never floods the polite region.
- **Scope in one change.** Large, but each task is single-layer and independently testable; the
  groundwork tasks come first so later tasks do not reopen the same files.

## Migration Plan

No storage migration. `solitaire.local-state` v1, its codec, defensive decode, the backup key and the
writer's field list are unchanged. `selection`, `hint`, `pendingHint`, `announcement` and `deadEndSeen` are runtime-only and live in a slice the writer does not read, so a stored game reloads
with all of them empty; nothing unreadable is dropped and nothing new is written. Rollback is
reverting the change; no stored data depends on it.

Ordering for apply: groundwork (D13, D14) → state (D1, D2, D7, D8) → pure modules (D3) → drag first
(D4) with the real-phone checkpoint → tap paths and visuals (D5, D11) → keyboard (D6) → assistance UI
and win (D9, D10) → end-to-end (D12) → docs and review.

## Open Questions

None that affect implementation. Decided: focused-card names stay exactly as *KS-A11Y-01* words them
and moves are announced with piles (revisit after the Phase 9 accessibility scan); real-device drag
behaviour is a recorded manual checkpoint (D12), not a CI claim.
