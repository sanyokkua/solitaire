# Spec Delta

## Purpose

The bounded search that decides whether a Draw 1 position can be won and, when it can, produces a
winning line of ordinary player commands. Winnable deals and solver hints are built on it.

## ADDED Requirements

### Requirement: Bounded Draw 1 search verdict

For a position that draws one card with no limit on passes, the system SHALL search for a win within
a node budget and report:
- one of three verdicts;
- the number of positions it expanded.

The verdicts SHALL mean:
- `win`: a winning line was found;
- `loss`: the search ran out of moves to try without finding a win;
- `unknown`: the budget ran out before either.

Note: `loss` is not proof that a deal cannot be won, because the search tries only a deliberately
limited set of moves. Later phases that surface a verdict must not present it as such.

The budget SHALL count distinct positions that are not won and that the search expands.
Positions the search has already visited SHALL NOT be expanded again. Two positions SHALL count as
the same when they have:
- the same foundation heights;
- the same columns, ignoring column order;
- the same stock and waste cards, ignoring their order.

Cards that are safe to send (see assistance "Safe foundation moves") SHALL be sent to their
foundations before the search branches, from the tableau tops and from anywhere in the stock and
waste. The search SHALL consider face-down cards, so it knows cards the player cannot see.

The search SHALL NOT modify the position it is given.

Input-agnostic: no interaction; the search is called by other system parts.

Deterministic: the same position and budget always give the same verdict, node count and line.

*(KS-DEAL-03)*

#### Scenario: A winnable deal is reported as a win

- **WHEN** a Draw 1 deal that the search can win within the budget is searched
- **THEN** the verdict is `win` and the reported node count is no more than the budget

#### Scenario: Running out of budget is reported as unknown

- **WHEN** a Draw 1 deal is searched with a budget too small to reach a win or exhaust the search
- **THEN** the verdict is `unknown`

#### Scenario: The searched position is left untouched

- **WHEN** a deeply frozen position is searched
- **THEN** the search completes without error and the position is unchanged

#### Scenario: Repeated searches agree

- **WHEN** the same position is searched twice with the same budget
- **THEN** both searches report the same verdict, node count and line

### Requirement: Search results match the reference solver

At a budget of 5,000 nodes, the search SHALL give the same verdict as the reference solver in
`docs/spec/mockup/klondike-mockup.html` for every Draw 1 deal of seeds 1 to 200, with each deal
produced by the seeded row-by-row deal. The totals are 142 wins, 1 loss and 57 unknown. A change to
any of these verdicts SHALL be made on purpose, by updating the pinned per-seed record. The
reference record SHALL come from running the reference solver, never from the new implementation.

Input-agnostic: no interaction.

Deterministic: every seed maps to exactly one pinned verdict.

*(KS-DEAL-03, KS-DEAL-01)*

#### Scenario: The corpus reproduces seed by seed

- **WHEN** the Draw 1 deals of seeds 1 to 200 are each searched at 5,000 nodes
- **THEN** each verdict equals the pinned reference verdict for that seed, giving 142 wins, 1 loss
  and 57 unknown

### Requirement: The winning line replays as player commands

When the verdict is `win`, the result SHALL include a winning line. The line SHALL contain only
draws and player moves, never system-issued foundation sends. The same SHALL hold for foundation
sends the search made as safe moves: they appear in the line as player moves to the foundation.

A move that takes a card from the stock or waste SHALL be preceded by the draws needed to make that
card the waste top. Those draws SHALL include turning the waste back over when the stock is empty.

Replaying the line in order from the searched position SHALL have every command accepted by the
game engine, and SHALL end in a won position. The same SHALL hold for a line found from any
mid-game Draw 1 position. A fresh search from such a position starts with no visited positions, so
it is not guaranteed to win within the budget that won the original deal; mid-game positions used
as evidence are pinned with that precondition checked.

Input-agnostic: no interaction; the line is data for hints and tests.

Deterministic: the same position and budget always give the same line.

*(KS-AST-03, KS-MOVE-07)*

#### Scenario: Every corpus win replays to a won game

- **WHEN** the line of each corpus deal whose verdict is `win` is replayed command by command from
  its deal
- **THEN** no command is refused and the final position is won with every foundation at 13

#### Scenario: A card buried in the waste is reached by turning the waste over

- **WHEN** the line plays a card lying below the waste top while the stock is empty
- **THEN** the line turns the waste back over and draws until that card is the waste top, before
  the move that plays it

#### Scenario: The line never issues system commands

- **WHEN** any winning line is inspected
- **THEN** it contains only draws and player moves

#### Scenario: A line from a mid-game position

- **WHEN** a pinned position, reached part-way through a replayed winning line and recorded as
  searchable to `win` within the budget, is searched
- **THEN** its verdict is `win`, and its own line replays from that position to a won game

### Requirement: Unsupported and finished positions

A position that draws three cards, or whose mode limits the number of passes, SHALL get the verdict
`unknown` with no nodes expanded and no line: treating the stock and waste as an unordered set is
not valid there. A position that is already won SHALL get the verdict `win` with no nodes expanded
and an empty line.

Input-agnostic: no interaction.

Deterministic: the verdict depends only on the position.

*(new)*

#### Scenario: A Draw 3 position is not searched

- **WHEN** a Draw 3 or Vegas position is searched
- **THEN** the verdict is `unknown`, no node is expanded and no line is returned

#### Scenario: A won position needs no search

- **WHEN** a won position is searched
- **THEN** the verdict is `win`, no node is expanded and the line is empty
