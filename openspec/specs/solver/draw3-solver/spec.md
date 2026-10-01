# solver/draw3-solver Specification

## Purpose

The bounded search that decides whether a Draw 3 or Vegas position can be won, modelling the ordered
stock and waste, and, when it can, produces a winning line of ordinary player commands with its draws
spelled out. Winnable Draw 3 and Vegas deals and their solver hints are built on it.

## Requirements

### Requirement: Bounded ordered-talon search verdict

For a position that draws three cards — Draw 3, with no limit on passes, or Vegas, with its limit of
three passes — the system SHALL search for a win within a node budget and report:
- one of three verdicts;
- the number of positions it expanded.

The search SHALL model the talon exactly as the game rules play it:
- the stock and the waste are ordered piles;
- a draw turns up to three cards, so only the last card each draw turns becomes the waste top;
- a recycle turns the waste back into the stock in its original drawing order;
- in Vegas, the passes left are part of the position, and no recycle beyond the pass limit is tried.

The verdicts SHALL mean:
- `win`: a winning line was found;
- `loss`: every position reachable from the given one was expanded without finding a win;
- `unknown`: the budget ran out before either.

`loss` SHALL be a proof that the position cannot be won under the game rules. The search SHALL NOT
leave out any move, and SHALL NOT take any step without branching (such as sending a card to its
foundation), that could discard every winning line. This differs from the Draw 1 search, whose `loss`
only means its limited set of moves ran out.

The budget SHALL count distinct positions that are not won and that the search expands. When the
budget stops the search, the reported count SHALL be one more than the budget; otherwise it SHALL be
no more than the budget. Positions the search has already visited SHALL NOT be expanded again. Two
positions SHALL count as the same only when they have:
- the same foundation heights;
- the same columns, ignoring column order;
- talons from which drawing alone reaches exactly the same stock and waste arrangements, with the
  same passes left in Vegas.

The search SHALL consider face-down cards and the stock order, so it knows cards the player cannot
see. The search SHALL NOT modify the position it is given.

Input-agnostic: no interaction; the search is called by other system parts.

Deterministic: the same position and budget always give the same verdict, node count and line.

*(KS-DEAL-03, KS-AST-03)*

#### Scenario: A winnable Draw 3 deal is reported as a win

- **WHEN** a Draw 3 deal that the search can win within the budget is searched
- **THEN** the verdict is `win` and the reported node count is no more than the budget

#### Scenario: Running out of budget is reported as unknown

- **WHEN** a Draw 3 or Vegas deal is searched with a budget too small to reach a win or exhaust the
  search
- **THEN** the verdict is `unknown` and the reported node count is one more than the budget

#### Scenario: The three-card grouping decides the verdict

- **WHEN** a Draw 3 position whose only playable card lies in the talon at a place the three-card
  grouping never brings to the waste top, and where nothing else can be played, is searched with an
  ample budget
- **THEN** the verdict is `loss`

#### Scenario: The passes left decide the verdict

- **WHEN** the same Vegas layout, whose only win needs one more recycle, is searched on its second
  pass and again on its third
- **THEN** the verdict is `win` on the second pass and `loss` on the third

#### Scenario: The searched position is left untouched

- **WHEN** a deeply frozen Draw 3 or Vegas position is searched
- **THEN** the search completes without error and the position is unchanged

#### Scenario: Repeated searches agree

- **WHEN** the same position is searched twice with the same budget
- **THEN** both searches report the same verdict, node count and line

### Requirement: Winning lines replay as player commands, draws included

When the verdict is `win`, the result SHALL include a winning line. The line SHALL contain only draws
and player moves, never system-initiated foundation sends. A card the search sent to its foundation
without branching SHALL appear in the line as a player move to the foundation.

Every draw the line needs SHALL appear in it as its own command. A draw on an empty stock is a
recycle. A move that takes a card from the waste SHALL be preceded by the draws, recycles included,
that make that card the waste top.

Replaying the line in order from the searched position SHALL have every command accepted by the game
engine, and SHALL end in a won position. The same SHALL hold for a line found from any mid-game Draw 3
or Vegas position.

Input-agnostic: no interaction; the line is data for hints and tests.

Deterministic: the same position and budget always give the same line.

*(KS-AST-03, KS-MOVE-03, KS-MOVE-04, KS-MOVE-05, KS-MOVE-07)*

#### Scenario: Every pinned win replays to a won game

- **WHEN** the line of each pinned Draw 3 and Vegas deal whose verdict is `win` is replayed command by
  command from its deal
- **THEN** no command is refused and the final position is won with every foundation at 13

#### Scenario: A deeper talon card is reached by drawing

- **WHEN** the line plays a card that is not the waste top after the command before it
- **THEN** the line first draws, recycling when the stock is empty, until that card is the waste top

#### Scenario: A Vegas line keeps to the pass limit

- **WHEN** the line of a Vegas deal whose verdict is `win` is replayed
- **THEN** it recycles at most twice and no command is refused with the pass-limit reason

#### Scenario: The line never issues system commands

- **WHEN** any winning line is inspected
- **THEN** it contains only draws and player moves

### Requirement: Verdicts agree with exhaustive search on small positions

For every position of a pinned set of Draw 3 and Vegas endgames, each with at most 14 cards off the
foundations, the search SHALL be given a budget large enough that it reports no `unknown` there, and
SHALL then report:
- `win` exactly when an exhaustive search over the game rules finds a win;
- `loss` exactly when that exhaustive search finds none.

The exhaustive search SHALL try every command the game rules accept from each position: every draw
and recycle, and every legal move, foundation-to-column moves included. It SHALL skip only positions it
has already seen, and SHALL prune nothing else. Two positions count as the same only when their piles
are identical and, in Vegas, their passes left are equal too, because the passes left can decide the
outcome.

The pinned set SHALL include:
- positions that can be won and positions that cannot;
- positions in which the order of the talon decides the outcome;
- Vegas positions in which the passes left decide the outcome.

Input-agnostic: test evidence; no interaction.

Deterministic: the pinned set and every verdict in it are the same on every run.

*(KS-DEAL-03)*

#### Scenario: Every pinned endgame agrees

- **WHEN** each pinned endgame is searched with the agreed budget and by the exhaustive search
- **THEN** no verdict is `unknown`, and the verdict is `win` for exactly the endgames the exhaustive
  search wins

#### Scenario: The pinned set covers the talon order and the pass limit

- **WHEN** the pinned set is inspected
- **THEN** it holds winnable and unwinnable endgames, at least one endgame decided by the talon
  order, and at least one Vegas endgame decided by the passes left

### Requirement: Won, invalid and Draw 1 positions

The search SHALL report, with no node expanded:
- `unknown` and no line for a position that fails the game-state validity check (see game-engine "A
  game state can be checked for validity");
- `unknown` and no line for a position that draws one card (Draw 1 or Daily): it belongs to the Draw 1
  search (see solver/draw1-solver), which is unchanged;
- `win` and an empty line for a valid Draw 3 or Vegas position that is already won.

Input-agnostic: no interaction.

Deterministic: the verdict depends only on the position.

*(KS-DEAL-03, KS-AST-03)*

#### Scenario: A won position needs no search

- **WHEN** a won Draw 3 or Vegas position is searched
- **THEN** the verdict is `win`, no node is expanded and the line is empty

#### Scenario: A one-card position is not searched

- **WHEN** a Draw 1 or Daily position is searched
- **THEN** the verdict is `unknown`, no node is expanded and no line is returned

#### Scenario: An invalid position is not searched

- **WHEN** a position that lists one card twice, or a Vegas position past its pass limit, is searched
- **THEN** the verdict is `unknown`, no node is expanded and no line is returned
