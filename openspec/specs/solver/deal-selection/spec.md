# solver/deal-selection Specification

## Purpose

Choosing a winnable deal from a list of candidate seeds, deriving a hint from a winning line, and
the background-thread message interface both are reached through.

## Requirements

### Requirement: Winnable selection by reject sampling

Given an ordered list of candidate seeds, a mode (Draw 1, Draw 3, Vegas or Daily), a node budget, a target
grade (Any, Easy, Medium or Hard), a grade limit and optionally the verdicts already known for some of the seeds,
the system SHALL:
- deal each seed in the requested mode, in order;
- search each deal with that budget, using the search that fits the mode:
  - Draw 1 and Daily, which draw one card with no pass limit: the Draw 1 search (see
    solver/draw1-solver);
  - Draw 3 and Vegas: the ordered-talon search (see solver/draw3-solver);
- grade each deal whose verdict is `win`, and select a deal as deal-grading "A requested grade, or the
  closest one found" states. With the target Any, that is the first deal whose verdict is `win`;
- skip the search and the grading of a seed whose verdict is known, and take that verdict, and the grade of a
  known `win`, as they are.

The result SHALL report the selected seed, the verdict `win`, the number of attempts, the selected
deal's grade and the spares (the other graded candidates). With the target Any, or when a deal of the target
grade is found, the attempts are that seed's position in the list, counting from 1. When no graded deal has
the target grade, the closest graded deal is reported with its own grade and the number of candidates tried as
the attempts.

When no candidate is proven winnable, the system SHALL select the last seed, report the verdict
`random`, report no grade, and report the length of the list as the attempts. Both `loss` and
`unknown` count as failed attempts. Each attempt SHALL be reported, in order, as it starts, with its
number counting from 1; no attempt is reported that is not then tried. An empty seed list is a
programming error and SHALL be refused rather than answered.

Each seed that was really searched (not a known one) SHALL be reported, in order, with its verdict and, for a
`win`, its grade, once it is settled.

Input-agnostic: no interaction.

Deterministic: the same seed list, mode, budget, target grade and grade limit always select the same seed
with the same verdict, attempts, grade and spares. Known verdicts save work and never change the result.

*(KS-DEAL-03, KS-DEAL-05, KS-DEAL-11 (new))*

#### Scenario: The first candidate is winnable

- **WHEN** selection with the target Any is given a list whose first seed deals a deal proven
  winnable
- **THEN** that seed is selected with verdict `win`, one attempt and that deal's grade

#### Scenario: Failed candidates are skipped

- **WHEN** the list starts with seeds whose deals are not proven winnable, followed by one that is, and
  the target is Any
- **THEN** the winnable seed is selected with verdict `win`, the attempts equal its position in the
  list, and attempts 1 up to that position are reported, in order, each before it is tried

#### Scenario: Each mode is dealt and searched in its own rules

- **WHEN** the same seed list is selected from in Draw 1, Draw 3 and Vegas
- **THEN** each candidate is dealt in the requested mode, a Draw 1 candidate is searched by the Draw 1
  search, and a Draw 3 or Vegas candidate by the ordered-talon search

#### Scenario: Any keeps the selections pinned before grading

- **WHEN** the Draw 1 selections pinned before grading existed, the Daily golden dates among them, are
  run again with the target Any
- **THEN** each selects its pinned seed with its pinned verdict and attempts

#### Scenario: Known verdicts are trusted and save the work

- **WHEN** selection is given the verdicts, and the grades of the wins, that an earlier run of the same list
  reported
- **THEN** it selects exactly what that run selected, reports no seed as searched, and grades nothing

#### Scenario: A known verdict that is not a win still counts as an attempt

- **WHEN** the first seed's verdict is known to be `unknown` and the second is winnable
- **THEN** the second is selected with attempts 2, and attempts 1 and 2 are reported

#### Scenario: Each searched seed is reported

- **WHEN** selection searches a `loss`, an `unknown` and a `win` in turn
- **THEN** three outcomes are reported, in that order, the last with its grade

#### Scenario: An empty seed list is refused

- **WHEN** selection is asked for with no candidate seeds
- **THEN** it is refused with an error instead of selecting a seed

#### Scenario: No candidate is proven winnable

- **WHEN** no seed in the list deals a deal proven winnable
- **THEN** the last seed is selected with verdict `random`, no grade and attempts equal to the list
  length

### Requirement: Solver hint from the winning line

For a position that is not won, in any mode, the system SHALL suggest the first command of the
winning line when the search that fits the position proves it winnable within the hint budget:
- a position that draws one card with no pass limit (Draw 1 and Daily): the Draw 1 search;
- a position that draws three cards (Draw 3 and Vegas): the ordered-talon search.

The suggestion SHALL take one of three forms:
- a move, identifying its source, its destination and the cards it moves;
- a draw, when the first command is a draw and the stock holds cards;
- a recycle, when the first command is a draw and the stock is empty.

Otherwise the system SHALL offer no solver suggestion. That covers a verdict of `loss` or `unknown`
and a won position. The heuristic hint (see assistance "Hint priority") then applies.

Input-agnostic: how a hint is requested belongs to the interaction layer.

Deterministic: the same position and budget always give the same suggestion.

*(KS-AST-03)*

#### Scenario: A proven position suggests the line's first move

- **WHEN** a hint is asked for a Draw 1, Draw 3 or Vegas position the fitting search proves winnable,
  and the line starts with a move
- **THEN** the suggestion is that move, with its source, destination and the cards it moves

#### Scenario: A Draw 3 line that starts by drawing suggests a draw

- **WHEN** a hint is asked for a Draw 3 position the ordered-talon search proves winnable, and the
  line starts with a draw while the stock holds cards
- **THEN** the suggestion is a draw

#### Scenario: An empty stock turns a draw into a recycle

- **WHEN** the line's first command is a draw while the stock is empty
- **THEN** the suggestion is a recycle, not a draw

#### Scenario: No proof, no solver suggestion

- **WHEN** a hint is asked for a position whose search reports `loss` or `unknown`, in any mode, or for
  a won position
- **THEN** no solver suggestion is offered

### Requirement: Background-thread message interface

Winnable selection and the solver hint SHALL be reachable through a message interface run on a
background thread, never on the thread that handles input.

Every request SHALL carry an identifier, and every reply SHALL echo it.
- A selection request SHALL carry the seeds, the mode, the budget, the target grade and the grade limit,
  and MAY carry known verdicts. It SHALL produce one progress message as each attempt starts, carrying that
  attempt's number, and one outcome message for each seed it really searched, before its final reply. The final
  reply SHALL carry the selected seed, verdict, attempts, grade and spares, with no grade for `random`.
- A hint request SHALL carry the position and the budget. The position's own mode selects the search.

The background thread SHALL keep no game state between requests. Each request carries everything it
needs.

More than one background thread SHALL be able to run this interface at once: one serving the player's
deals and hints, and a second, low-priority one that verifies deals ahead of time. The threads SHALL
share no state, and the same request SHALL get the same reply from either.

Input-agnostic: no interaction.

Deterministic: the same request always produces the same progress messages and reply.

*(KS-DEAL-04, KS-DEAL-10, KS-DEAL-12 (new))*

#### Scenario: A selection request round-trips

- **WHEN** a selection request with an identifier, a mode, a target grade and a grade limit is posted to the
  background thread
- **THEN** one progress message per attempt tried arrives in order, each followed by the outcome of the seed it
  searched, then a reply with the same identifier and the selected seed, verdict, attempts, grade and spares

#### Scenario: A hint request round-trips

- **WHEN** a hint request with an identifier is posted to the background thread, for a position in
  any mode
- **THEN** a reply with the same identifier arrives, carrying the solver suggestion or its absence

#### Scenario: Requests are independent

- **WHEN** the same request is posted twice, with other requests between them
- **THEN** both replies are identical apart from the identifier

#### Scenario: Two threads answer alike

- **WHEN** the same request is posted to two background threads running the interface
- **THEN** both produce the same progress messages and the same reply, apart from the identifier
