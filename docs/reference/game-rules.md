# Game rules as implemented

This page states what the code does today, with the reasoning behind the choices that could have gone another way. It
is the reference for the rules, the modes, the scoring and the undo and Vegas decisions. Where this page and the code
differ, the code is right. How a deal is proven winnable, graded and served is in [winnability.md](winnability.md); the
engine and solver internals are in [domain-and-solver.md](../architecture/domain-and-solver.md).

## Terms

| Term                  | Meaning                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| Tableau               | The 7 columns. Cards are built down in alternating colours.                                         |
| Run                   | A face-up sequence in one column, built down in alternating colours; it moves as one unit.          |
| Stock and waste       | The face-down draw pile and the face-up pile drawn cards land on. Only the waste top is playable.   |
| Talon                 | The stock and waste together.                                                                       |
| Foundation            | Four piles, one per suit, built up from Ace to King.                                                |
| Pass                  | One trip through the stock. Turning the waste back into the stock (a recycle) begins the next pass. |
| Winnable deal         | A deal with at least one winning sequence of moves when every card is known.                        |
| Dead end              | No productive move remains and drawing cannot bring one up. Klondike has no formal loss.            |
| Deal, seed, deal code | The initial arrangement; the 32-bit number it comes from; that number and the mode written as text. |

## Layout and deal

- 52 cards: 7 tableau columns, 4 foundations (one per suit), a stock and a waste. A card is an integer `0..51`; suits
  are encoded 0 hearts, 1 diamonds, 2 clubs, 3 spades, and hearts and diamonds are red (`src/domain/cards.ts`).
- The shuffled deck `d[0..51]` is dealt row by row: row `r` (0 to 6) puts one card on every column `c >= r`, so column
  `c` (0 to 6) starts with `c + 1` cards and only its last card is face up. The tableau takes `d[0..27]`. The other 24
  cards, `d[28..51]`, are the stock, and the last of them is on top and is drawn first. The waste and the foundations
  start empty. Source: `src/domain/deal.ts#dealFromSeed`.
- Foundations are suit-fixed slots, so a card's foundation is always known and a tap to the foundation is unambiguous.
  They are shown left to right as hearts, clubs, diamonds, spades, so colours alternate
  (`src/domain/cards.ts#FOUNDATION_DISPLAY_ORDER`); that order is a display choice and is separate from the suit
  encoding above.

### Shuffle, seed and deal code

- The shuffle is Fisher–Yates (Durstenfeld): `i` from 51 down to 1, `j` uniform in `[0, i]`, swap. That is unbiased and
  linear. Choosing `j` in `[0, i - 1]` instead is Sattolo's algorithm, which reaches only single-cycle orders; a
  chi-square test over all 24 orders of four items (`tests/unit/domain/shuffle.test.ts`) catches that bug. No shuffle is
  known that produces only winnable deals; winnability is proven after the shuffle ([winnability.md](winnability.md)).
- Every deal comes from a 32-bit seed through the seeded generator mulberry32 (`src/domain/prng.ts`); no game logic uses
  `Math.random`. A fresh seed for a random deal comes from `crypto.getRandomValues` (`cryptoSeed`), which throws when
  there is no entropy source and never falls back. Seeding every deal makes every deal reproducible, which is what
  Restart and deal codes need.
- A deal is fully determined by the seed and the mode. Its deal code is `<mode letter>-<7 base-36 characters>`, for
  example `1-K7Q29XD`; letters `1`, `3`, `V`, `D` (`src/domain/dealCode.ts`). The solver only chooses which seed to
  deal, so replaying a code never needs the solver and never changes when the solver changes. The code does not record
  whether the deal was proven winnable.

## Moves

Source: `src/domain/rules.ts`, `src/domain/engine.ts`.

- A tableau column accepts a card one rank lower and of the opposite colour; an empty column accepts only a King.
- A group is a face-up run of descending, alternating-colour cards; it moves as a unit. From the waste or a
  foundation only the top card can be picked up. The stock cannot be picked up.
- A foundation accepts one card at a time: the next rank of its suit, starting with the Ace. A card can be moved back
  from a foundation to a column.
- Moving a group off a column turns up the newly exposed face-down card.
- Draw takes 1 or 3 cards from the stock to the waste (fewer if the stock has fewer). With an empty stock it recycles
  the waste back into the stock if the pass limit allows, and is refused otherwise ("Draw and recycle" below).
- A game is won when all four foundations hold 13 cards.
- A refused command changes nothing and reports a reason: `game-over`, `not-movable`, `illegal-target`, `pass-limit` or
  `nothing-to-draw`. There is no foundation-to-foundation move (each suit has its own foundation), and cards leave the
  stock only by drawing. The moves, in a table:

| From to                      | Rule                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Stock to waste               | Draw 1 turns one card, Draw 3 up to three; always legal while the stock has cards.     |
| Waste (empty stock) to stock | Recycle, legal unless the mode's pass limit is reached.                                |
| Waste top to tableau         | One rank lower and the opposite colour of the column's top; only a King goes to empty. |
| Waste top to foundation      | The next rank of its suit; an Ace starts an empty foundation.                          |
| Tableau run to tableau       | The run's first card follows the tableau rule; any face-up run may move, partial too.  |
| Tableau top to foundation    | One card, the next rank of its suit.                                                   |
| Foundation top to tableau    | Allowed under the tableau rule; it costs points under Standard scoring.                |

### Draw and recycle

Source: `src/domain/talon.ts#stepTalon`, `src/domain/engine.ts#applyDraw`.

- The stock top is the last element of the stock array. A draw of `n` cards takes the top `min(n, stock size)` and lays
  them on the waste one after another, so the last card laid, the deepest of the group, is the waste top. Draw 3 shows up
  to three waste cards fanned, and only the top one is playable.
- A recycle reverses the waste into the stock and empties the waste, so the first card drawn after it is the one drawn
  first in the pass before. With no cards taken from the talon in between, the stock is exactly as the pass began. A
  card played from the waste during a pass shifts every card behind it up one place, which changes which cards reach the
  waste top in Draw 3 on the next pass.
- `GameState.passes` counts the pass in progress and starts at 1; every recycle adds one. A recycle is legal while the
  stock is empty, the waste is not, and `passes` is below the mode's limit (`src/domain/rules.ts#canRecycle`). The limit
  is 3 for Vegas, so Vegas allows two recycles, and unlimited otherwise. A refused recycle on an empty talon is
  `nothing-to-draw`; over the limit it is `pass-limit`, which the UI reports as "No redeals left".
- Because Draw 1 with unlimited passes reaches every talon card, drawing alone can always bring any of them up; in Draw 3
  and Vegas it cannot, which is why the dead-end check and the Draw 3 solver model the talon in order.

## Modes

Source: `src/domain/deal.ts#modeConfig`, `src/domain/rules.ts#passLimit`.

| Mode   | Draw | Scoring  | Passes through the stock | Deal selection                                              |
| ------ | ---- | -------- | ------------------------ | ----------------------------------------------------------- |
| Draw 1 | 1    | Standard | unlimited                | random, or proven winnable when "Winnable deals only" is on |
| Draw 3 | 3    | Standard | unlimited                | random, or proven winnable when "Winnable deals only" is on |
| Vegas  | 3    | Vegas    | 3                        | random, or proven winnable when "Winnable deals only" is on |
| Daily  | 1    | Standard | unlimited                | one deal per UTC day, solver-selected                       |

The Vegas bank is per game; there is no cumulative bankroll. Vegas always draws three cards; there is no one-card
Vegas. Draw 1 and Draw 3 have unlimited passes and pay for them through Standard scoring (below); Vegas is the only
mode that caps passes.

### Winnable deals only

A preference (`winnableOnly`, default on), shared by Draw 1, Draw 3 and Vegas. The deal service tries up to 48 fresh
seeds, searching each within its budget, and uses the first proven win. If none is proven, the last seed is dealt as
`random`. The Home switch is live in those three modes and disabled, showing on, in Daily
(`src/ui/screens/home/WinnableToggle.tsx`). Beside it, the Difficulty control (Any, Easy, Medium, Hard; the
`difficulty` preference) asks for a grade of winnable deal; it is enabled only while the switch is on outside Daily. See
[domain-and-solver.md](../architecture/domain-and-solver.md#deal-service).

### Daily

- One deal per UTC calendar day, so every time zone shares it and players never see different deals around midnight.
  Draw 1 rules and Standard scoring. It is always searched, whatever the "Winnable deals only" switch says, so a Daily
  deal is always proven winnable when the search finds one.
- Selected from 40 candidate seeds derived from the date, each searched with a 20,000-node budget; the first proven
  win is used, else the last candidate. Candidate `k` (1 to 40) uses the seed `(YYYYMMDD * 131 + k * 7919) >>> 0`. The
  formula, the budget, the attempt cap and the search are pinned as "Daily v1" (`src/features/deal/daily.ts#DAILY_V1`):
  changing any of them would change every past and future Daily, so it would be a new version. The Daily search and
  its 40 candidates stay as they were in the first release, while player deals try 48 candidates
  ([winnability.md](winnability.md#selection)).
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

How the table works:

- Sending a card home earns 10 and taking it back costs 15, so moving a card off a foundation is always a net loss.
  Turning up a hidden card earns 5.
- Recycling is the price of unlimited passes. Draw 1 costs 100 for every recycle. Draw 3 gives three free passes and then
  charges 20 per recycle. `GameState.passes` starts at 1 and every recycle adds one, so the recycles that begin passes 2
  and 3 are free and the one that begins pass 4 is the first to cost 20.
- The time penalty is derived from the counted play time (`2 * floor(whole seconds / 10)`) and is never deducted from the
  stored score as time passes.
- The win bonus rewards speed: `floor(700000 / whole seconds)`, and none at 30 seconds or less.
- A card that goes waste to tableau to foundation earns 5 + 10 = 15, against 10 straight to the foundation. That is a
  quirk of the scoring table and is kept.
- The move points of one game are at most 745 (an upper bound from the table): 28 tableau cards home at 10, 24 stock
  cards through the tableau at 15, and 21 turned-over cards at 5. The win bonus comes on top.

### Vegas

| Event                                                      | Points |
| ---------------------------------------------------------- | ------ |
| Start                                                      | -52    |
| Each card moved to a foundation                            | +5     |
| Each card moved off a foundation                           | -5     |
| Everything else (turning cards, recycles, time, undo, win) | 0      |

The score is shown as money and is not floored. The third pass is the last; a recycle beyond it is refused with a
"No redeals left" notice.

Vegas models a stake of one dollar per card: the 52-dollar buy-in is paid at the start and every card that reaches a
foundation pays back 5. Break-even needs 11 cards home (10 cards leave the player 2 dollars down, 11 leave it 3 up).
Only the card count on the foundations matters, so turning cards, recycles, time and the win itself score nothing.
Moving a card off a foundation returns its 5 dollars to the bank, which is a cost. Vegas draws three cards and allows
three passes.

## Microsoft Windows Solitaire parity

The rules and the Standard and Vegas scores follow the classic Windows Klondike as it is documented publicly (the
scoring table on [Wikipedia](<https://en.wikipedia.org/wiki/Klondike_(solitaire)>), the Draw 3 recycle rule on
[SolitaireCat](https://www.solitairecat.com/articles/rules/solitaire-scoring/), and the Windows-identical
scoring of [Play-Solitaire.com](https://www.play-solitaire.com/questions-and-answers)).
The scoring numbers are taken from those descriptions and implemented as `src/domain/scoring.ts`; the parity claim rests
on them, not on a comparison with Microsoft's software.

What matches:

- the Standard point table, the Draw 1 and Draw 3 recycle penalties, the time penalty, the 700,000 win bonus after 30
  seconds and the floor at 0;
- Vegas: a 52-dollar buy-in, 5 dollars per card home, three cards per draw and three passes;
- the rules of play: build down in alternating colours, Kings only in empty columns, partial runs, cards back from a
  foundation, a stock recycled by reversing the waste.

What this project decides differently, each on purpose:

| Topic         | Decision                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Undo          | Returns to the exact earlier position, score included, and Standard adds a 2-point charge that stays charged. See "Undo and redo". |
| Vegas undo    | Allowed and free: the bank returns to what it was. A "strict Vegas" without undo is not offered.                                   |
| Vegas bank    | Per game, with no cumulative bankroll across games.                                                                                |
| Draw 3 passes | Unlimited, priced by the recycle penalty, as Standard scoring does.                                                                |
| Foundations   | Suit-fixed slots shown in the order hearts, clubs, diamonds, spades, so a tap to the foundation has one target.                    |
| Time          | Counted only while the Game screen is shown, no sheet is open and the page is visible; see "Time".                                 |
| Deals         | Random or proven winnable, and a Daily deal. A plain shuffle is unwinnable about one time in five (see winnability.md).            |

## Undo and redo

Source: `src/features/game/history.ts`, `src/domain/scoring.ts#undoCost`.

- Undo returns to the position before the last undo step. A move and the safe-card sends it triggered count as one step,
  so a single undo takes back the whole chain. There is no limit in memory; a saved game keeps the newest 200 undo steps
  and nearest 200 redo steps ([storage-format.md](storage-format.md#limits)), so a reload after more than 200 moves can
  undo only that far.
- A restored position brings back its own piles, score, move count and pass count. Time and the started flag are never
  rewound.
- A new move clears the redo steps. Undo and redo do nothing once the game is won.
- Standard: each undo adds a 2-point charge that redo does not refund. Some classic implementations reverse the undone
  move's points exactly and charge nothing more, and Microsoft Solitaire Collection documents no fixed fee. This project
  decided on that exact reversal plus the 2-point charge per undo.
- Vegas: undo is free, and the bank simply returns to what it was. Many implementations restrict or disable undo in Vegas;
  this project allows it. A "strict Vegas" that disables undo is not offered.

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
- **Finish**: available when every tableau card is face up and a plan exists that completes under the ordinary rules; plays
  the remaining cards home through ordinary commands, so draws and recycles are scored and pass-limited as usual, with
  no exemption from the recycle penalty or the Vegas pass limit. The plan repeatedly sends the lowest-ranked card that is
  ready for its foundation (a column top or the waste top), and otherwise draws; it is not offered when a whole pass
  through the stock sends nothing (`src/domain/finish.ts#finishPlan`).

## Statistics

Per mode: played, won, streak, best streak, best time, best score. A game counts as played on its first accepted
command. Replacing a started, unwon game (new deal, restart, deal code) breaks that mode's streak; replacing an
unstarted or won game does not (`src/features/game/sessionThunks.ts#breakStreakOf`).

## Restart and deal codes

Restart replays the same deal (same seed, mode, verdict, attempts and grade) with no progress carried over. Entering a deal
code deals that seed and mode as `random`, 1 attempt, no grade; a Daily code replays that seed but is not recorded as a
completed Daily date (`dailyKey` is `null`). Source: `src/features/game/sessionThunks.ts#playDealCode`.
