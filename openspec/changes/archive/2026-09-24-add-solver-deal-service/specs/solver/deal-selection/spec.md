# Spec Delta

## Purpose

Choosing a winnable deal from a list of candidate seeds, deriving a hint from a winning line, and
the background-thread message interface both are reached through.

## ADDED Requirements

### Requirement: Winnable selection by reject sampling

Given an ordered list of candidate seeds and a node budget, the system SHALL:
- deal each seed in Draw 1, in order;
- search each deal with that budget;
- select the first deal whose verdict is `win`.

The result SHALL report the selected seed, the verdict `win`, and the number of attempts. The
attempts are that seed's position in the list, counting from 1.

When no candidate is proven winnable, the system SHALL select the last seed, report the verdict
`random`, and report the length of the list as the attempts. Both `loss` and `unknown` count as
failed attempts. Each attempt SHALL be reported, in order, as it starts, with its number counting
from 1; no attempt is reported that is not then tried. An empty seed list is a programming error
and SHALL be refused rather than answered.

Input-agnostic: no interaction.

Deterministic: the same seed list and budget always select the same seed with the same verdict and
attempts.

*(KS-DEAL-03, KS-DEAL-05)*

#### Scenario: The first candidate is winnable

- **WHEN** the first seed in the list deals a deal proven winnable
- **THEN** that seed is selected with verdict `win` and one attempt

#### Scenario: Failed candidates are skipped

- **WHEN** the list starts with seeds whose deals are not proven winnable, followed by one that is
- **THEN** the winnable seed is selected with verdict `win`, the attempts equal its position in the
  list, and attempts 1 up to that position are reported, in order, each before it is tried

#### Scenario: An empty seed list is refused

- **WHEN** selection is asked for with no candidate seeds
- **THEN** it is refused with an error instead of selecting a seed

#### Scenario: No candidate is proven winnable

- **WHEN** no seed in the list deals a deal proven winnable
- **THEN** the last seed is selected with verdict `random` and attempts equal to the list length

### Requirement: Solver hint from the winning line

For a position that is not won, draws one card and has no pass limit, the system SHALL suggest the
first command of the winning line when the search proves the position winnable within the hint
budget. The suggestion SHALL take one of three forms:
- a move, identifying its source, its destination and the cards it moves;
- a draw, when the first command is a draw and the stock holds cards;
- a recycle, when the first command is a draw and the stock is empty.

Otherwise the system SHALL offer no solver suggestion. That covers a verdict of `loss` or
`unknown`, an unsupported position and a won position. The heuristic hint (see assistance "Hint
priority") then applies.

Input-agnostic: how a hint is requested belongs to a later phase.

Deterministic: the same position and budget always give the same suggestion.

*(KS-AST-03)*

#### Scenario: A proven position suggests the line's first move

- **WHEN** a hint is asked for a position the search proves winnable, and the line starts with a
  move
- **THEN** the suggestion is that move, with its source, destination and the cards it moves

#### Scenario: An empty stock turns a draw into a recycle

- **WHEN** the line's first command is a draw while the stock is empty
- **THEN** the suggestion is a recycle, not a draw

#### Scenario: No proof, no solver suggestion

- **WHEN** a hint is asked for a position whose search reports `loss` or `unknown`, for a Draw 3 or
  Vegas position, or for a won position
- **THEN** no solver suggestion is offered

### Requirement: Background-thread message interface

Winnable selection and the solver hint SHALL be reachable through a message interface run on a
background thread, never on the thread that handles input.

Every request SHALL carry an identifier, and every reply SHALL echo it. A selection request SHALL
produce one progress message as each attempt starts, carrying that attempt's number, before its
final reply.

The background thread SHALL keep no game state between requests. Each request carries everything
it needs: the seeds and budget, or the position and budget.

Input-agnostic: no interaction.

Deterministic: the same request always produces the same progress messages and reply.

*(KS-DEAL-04, KS-DEAL-10)*

#### Scenario: A selection request round-trips

- **WHEN** a selection request with an identifier is posted to the background thread
- **THEN** one progress message per attempt tried arrives in order, the last carrying the reported
  attempts, followed by a reply with the same identifier and the selected seed, verdict and attempts

#### Scenario: A hint request round-trips

- **WHEN** a hint request with an identifier is posted to the background thread
- **THEN** a reply with the same identifier arrives, carrying the solver suggestion or its absence

#### Scenario: Requests are independent

- **WHEN** the same request is posted twice, with other requests between them
- **THEN** both replies are identical apart from the identifier
