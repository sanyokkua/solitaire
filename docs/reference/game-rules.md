# Game rules as implemented

This page states what the code does today. Background on Klondike rules and the reasoning behind choices is in
[research.md](../spec/research.md); product requirements are in the specification under `docs/spec/`. Where they
differ, the code is the reference.

## Layout and deal

- 52 cards: 7 tableau columns, 4 foundations (one per suit), a stock and a waste.
- Column `c` (0 to 6) starts with `c + 1` cards, only the top one face up. The other 24 cards are the stock.
  Source: `src/domain/deal.ts#dealFromSeed`.
- A deal is fully determined by a 32-bit seed and a mode (mulberry32 + Fisher–Yates). Its deal code is
  `<mode letter>-<7 base-36 characters>`, for example `1-K7Q29XD`; letters `1`, `3`, `V`, `D`
  (`src/domain/dealCode.ts`).

## Moves

Source: `src/domain/rules.ts`, `src/domain/engine.ts`.

- A tableau column accepts a card one rank lower and of the opposite colour; an empty column accepts only a King.
- A group is a face-up run of descending, alternating-colour cards; it moves as a unit. From the waste or a
  foundation only the top card can be picked up. The stock cannot be picked up.
- A foundation accepts one card at a time: the next rank of its suit, starting with the Ace. A card can be moved back
  from a foundation to a column.
- Moving a group off a column turns up the newly exposed face-down card.
- Draw takes 1 or 3 cards from the stock to the waste (fewer if the stock has fewer). With an empty stock, draw
  recycles the waste back into the stock if the pass limit allows; otherwise the command is refused. A recycle restores
  the stock exactly as the pass began, so in Draw 3 the cards are turned in the same groups of three on every pass
  after the first, and only the last card of each group lies on the waste top (`src/domain/talon.ts#reachableTops`).
- A game is won when all four foundations hold 13 cards.

## Modes

Source: `src/domain/deal.ts#modeConfig`, `src/domain/rules.ts#passLimit`.

| Mode   | Draw | Scoring  | Passes through the stock | Deal selection                                              |
| ------ | ---- | -------- | ------------------------ | ----------------------------------------------------------- |
| Draw 1 | 1    | Standard | unlimited                | random, or proven winnable when "Winnable deals only" is on |
| Draw 3 | 3    | Standard | unlimited                | random, or proven winnable when "Winnable deals only" is on |
| Vegas  | 3    | Vegas    | 3                        | random, or proven winnable when "Winnable deals only" is on |
| Daily  | 1    | Standard | unlimited                | one deal per UTC day, solver-selected                       |

The Vegas bank is per game; there is no cumulative bankroll.

### Winnable deals only

A preference (`winnableOnly`, default on), shared by Draw 1, Draw 3 and Vegas. The deal service tries up to 40 fresh
seeds, searching each within its budget, and uses the first proven win. If none is proven, the last seed is dealt as
`random`. The Home switch is live in those three modes and disabled, showing on, in Daily
(`src/ui/screens/home/WinnableToggle.tsx`). Beside it, the Difficulty control (Any, Easy, Medium, Hard; the
`difficulty` preference) asks for a grade of winnable deal; it is enabled only while the switch is on outside Daily. See
[domain-and-solver.md](../architecture/domain-and-solver.md#deal-service).

### Daily

- One deal per UTC calendar day, so every time zone shares it. Draw 1 rules and Standard scoring.
- Selected from 40 candidate seeds derived from the date, each searched with a 20,000-node budget; the first proven
  win is used, else the last candidate. The parameters are pinned as "Daily v1"
  (`src/features/deal/daily.ts#DAILY_V1`).
- Winning a Daily deal records its date; the statistics keep the completed dates (at most 400) and a best Daily
  streak.

## Scoring

Source: `src/domain/scoring.ts`. The engine stores a move score; time penalty, undo charges and win bonus are applied
when displaying (`displayedScore`).

### Standard (Draw 1, Draw 3, Daily)

| Event                                                 | Points                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Waste to foundation                                   | +10                                                                           |
| Tableau to foundation                                 | +10                                                                           |
| Waste to tableau                                      | +5                                                                            |
| Foundation to tableau                                 | -15                                                                           |
| Turning up a face-down card                           | +5                                                                            |
| Recycle in Draw 1 (and Daily)                         | -100                                                                          |
| Recycle in Draw 3 that begins the 4th or a later pass | -20 (the first three passes are free)                                         |
| Time                                                  | -2 for every full 10 seconds of counted play                                  |
| Each undo                                             | -2, and it stays charged (redo does not refund it)                            |
| Win bonus                                             | `floor(700000 / whole seconds)`, only when the game took more than 30 seconds |

The stored move score cannot go below 0, and the displayed score is floored at 0 before the win bonus is added.

### Vegas

| Event                                                      | Points |
| ---------------------------------------------------------- | ------ |
| Start                                                      | -52    |
| Each card moved to a foundation                            | +5     |
| Each card moved off a foundation                           | -5     |
| Everything else (turning cards, recycles, time, undo, win) | 0      |

The score is shown as money and is not floored. The third pass is the last; a recycle beyond it is refused with a
"No redeals left" notice.

## Undo and redo

- Undo returns to the position before the last move (a move and any safe-card sends it triggered count as one step).
  There is no limit in memory; a saved game keeps the newest 200 undo steps and nearest 200 redo steps
  ([storage-format.md](storage-format.md#limits)).
- A new move clears the redo steps.
- Time is never rewound. Under Standard each undo adds a 2-point charge that redo does not refund; under Vegas undo is
  free.
- Undo and redo do nothing once the game is won.

## Time

Play time counts only while the Game screen is shown, no sheet is open, the page is visible, and the game has
started (first accepted command) and is not won. Source: `src/features/game/clock.ts#selectClockEligible`.

## Assists

- **Tap modes** (`tapMode`): `smart` sends a tapped card to its single best destination
  (`src/domain/smartTap.ts#bestTarget`); `select` picks up then places. A double tap sends a fitting card to its
  foundation. Drag and keyboard reach every move as well.
- **Auto-move safe cards** (`autoSafe`, default off): after a move, cards that cannot be needed on the tableau are
  sent to the foundations one at a time, as part of the same undo step (`src/domain/safeMoves.ts#isSafe`).
- **Hint**: solver's first winning-line move in every mode when it proves a win in time, otherwise the heuristic
  priorities in [domain-and-solver.md](../architecture/domain-and-solver.md#hints-safe-moves-dead-end-finish).
  Hints cost nothing.
- **Dead end**: reported once per position when no productive move remains and no stock or waste card that drawing can
  bring to the waste top could be played. In Draw 3 a card the groups of three never leave on top cannot help, and in
  Vegas neither can a card only a recycle past the pass limit would reach.
- **Finish**: available when every tableau card is face up; plays the remaining cards home through ordinary commands,
  so draws and recycles are scored and pass-limited as usual.

## Statistics

Per mode: played, won, streak, best streak, best time, best score. A game counts as played on its first accepted
command. Replacing a started, unwon game (new deal, restart, deal code) breaks that mode's streak; replacing an
unstarted or won game does not (`src/features/game/sessionThunks.ts#breakStreakOf`).

## Restart and deal codes

Restart replays the same deal (same seed, mode, verdict, attempts and grade) with no progress carried over. Entering a deal
code deals that seed and mode as `random`, 1 attempt, no grade; a Daily code replays that seed but is not recorded as a
completed Daily date (`dailyKey` is `null`). Source: `src/features/game/sessionThunks.ts#playDealCode`.
