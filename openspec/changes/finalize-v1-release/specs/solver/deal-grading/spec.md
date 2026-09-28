# Spec Delta

## Purpose

Grading a proven-winnable deal as Easy, Medium or Hard by seeded playouts of a human-like player who
sees only face-up cards ("grading v1"), and choosing the requested grade, or the closest one found,
from a list of candidate deals.

## ADDED Requirements

### Requirement: Seeded playouts that see only face-up cards

To grade a deal, the system SHALL play it 16 times from its dealt position as a simulated player, and
count the playouts that end in a win. Each playout SHALL follow these rules.

- **What it sees.** It SHALL decide only from what a player can see: the face-up tableau cards, which
  places hold face-down cards (not which cards they are), the waste top, the foundation heights,
  whether the stock holds cards, and the pass in progress. Exchanging face-down tableau cards and stock
  cards among themselves, with every pile size and every face-up card unchanged, SHALL NOT change any
  choice it makes before one of the exchanged cards is turned face up or becomes the waste top.
- **What it plays.** At each step it SHALL choose among the productive moves, listed in hint priority
  order (see assistance "Hint candidates in priority order"), with a seeded bias toward earlier
  candidates. When there is no productive move, or its seeded choice is to draw, it SHALL draw while
  the stock holds cards, and recycle when the stock is empty and the pass limit allows. Every command
  SHALL be applied by the game rules, exactly as a player's would be.
- **When it stops.** It SHALL stop at the first of:
  - a win;
  - a position with no move, no draw and no recycle left;
  - a full cycle through the talon with no board move (a stall);
  - the grading v1 step cap.

  Only a win counts; every other stop counts as a loss.
- **Randomness.** Every random choice SHALL come from the seeded generator (see card-model
  "Deterministic pseudo-random sequence"), seeded from the deal's seed and the playout's index alone.
  Nothing else SHALL be random.

Input-agnostic: no interaction; winnable selection calls grading.

Deterministic: the same deal and playout index always play the same commands, so the same deal always
gets the same number of wins.

*(KS-DEAL-11 (new))*

#### Scenario: Repeated grading agrees

- **WHEN** the same deal is graded twice
- **THEN** each playout plays the same commands both times, and the win count and grade are equal

#### Scenario: Hidden cards do not steer the player

- **WHEN** two positions with the same seed, which differ only by exchanging face-down tableau cards
  and stock cards among themselves, are played with the same playout index
- **THEN** both playouts choose the same commands up to the step that first turns up an exchanged card
  or makes one the waste top

#### Scenario: The player draws when it has nothing to play

- **WHEN** a playout reaches a position with no productive move while the stock holds cards
- **THEN** its next command is a draw

#### Scenario: A stall ends the playout

- **WHEN** a playout draws through a full cycle of the talon without a board move
- **THEN** it stops and counts as a loss

#### Scenario: The Vegas pass limit ends the playout

- **WHEN** a Vegas playout reaches an empty stock on its third pass with no productive move
- **THEN** it stops without trying a recycle and counts as a loss

### Requirement: Grading v1 turns playout wins into a grade

The system SHALL grade a deal only when its search verdict is `win`. A deal dealt as `random` SHALL
have no grade.

The grade SHALL be read from the number of winning playouts, *w* out of 16, through the grading v1
table for the deal's mode:

| Mode | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Draw 1 | *w* ≥ 10 | 3 ≤ *w* ≤ 9 | *w* ≤ 2 |
| Draw 3 | *w* ≥ 10 | 3 ≤ *w* ≤ 9 | *w* ≤ 2 |
| Vegas | *w* ≥ 10 | 3 ≤ *w* ≤ 9 | *w* ≤ 2 |

A Daily deal is dealt and played exactly like a Draw 1 deal, so it SHALL be graded with the Draw 1
row.

The table SHALL give every grade at least 15% of the proven-winnable deals of a pinned calibration
sample in each mode. A pinned set of golden deals per mode, each with its grade, SHALL pin grading v1.

Grading v1 is the number of playouts, the playout rules, the step cap and the table taken together.
Changing any of them SHALL be a new grading version, made on purpose by updating the pinned grades.

Input-agnostic: no interaction.

Deterministic: the same deal always gets the same grade.

*(KS-DEAL-11 (new))*

#### Scenario: Wins map to a grade through the table

- **WHEN** win counts of 16, 10, 9, 3, 2 and 0 are read through a mode's grading v1 row
- **THEN** the grades are Easy, Easy, Medium, Medium, Hard and Hard

#### Scenario: Pinned grades do not drift

- **WHEN** each pinned golden deal of each mode is graded
- **THEN** it gets its pinned grade

#### Scenario: Every grade is common enough

- **WHEN** the proven-winnable deals of each mode's calibration sample are graded
- **THEN** each of Easy, Medium and Hard holds at least 15% of them

#### Scenario: A Daily deal grades like its Draw 1 twin

- **WHEN** a Daily deal and the Draw 1 deal of the same seed are graded
- **THEN** they get the same grade

#### Scenario: A random deal has no grade

- **WHEN** selection falls back to a deal with the verdict `random`
- **THEN** that deal is not graded and reports no grade

### Requirement: A requested grade, or the closest one found

Given an ordered list of candidate seeds, a mode and a target grade (Any, Easy, Medium or Hard),
winnable selection (see deal-selection "Winnable selection by reject sampling") SHALL choose:

| Case | Selected deal | Verdict and grade | Attempts |
| --- | --- | --- | --- |
| Target Any, a candidate proven | the first proven candidate | `win`, its grade | its position in the list |
| Target Easy, Medium or Hard, a proven candidate of that grade | the first proven candidate of that grade | `win`, the target grade | its position in the list |
| Target Easy, Medium or Hard, no proven candidate of that grade | the proven candidate whose grade is closest to the target | `win`, its own grade | the length of the list |
| No candidate proven | the last seed | `random`, no grade | the length of the list |

Grades are ordered Easy < Medium < Hard, and the distance between two grades is the number of steps
between them. When two proven candidates are equally close, the earlier one SHALL be selected. The
reported grade SHALL always be the selected deal's own grade, never the target.

With the target Any, the selected seed, verdict and attempts SHALL be exactly those that selection
chooses without grading, so grading never changes which deal Any selects.

Input-agnostic: no interaction.

Deterministic: the same seeds, mode, budget and target always select the same seed with the same
verdict, attempts and grade.

*(KS-DEAL-11 (new), KS-DEAL-05, KS-DEAL-03)*

#### Scenario: Any takes the first proven deal

- **WHEN** selection with the target Any is given a list whose first proven candidate is at position 3
- **THEN** that candidate is selected with verdict `win`, 3 attempts and its own grade

#### Scenario: A matching grade is found

- **WHEN** selection with the target Hard is given a list whose proven candidates are Easy at position
  2 and Hard at position 5
- **THEN** the candidate at position 5 is selected with verdict `win`, grade Hard and 5 attempts

#### Scenario: The closest grade is dealt when none matches

- **WHEN** selection with the target Hard is given a list whose only proven candidates are Easy at
  position 2 and Medium at position 4
- **THEN** the Medium candidate is selected with verdict `win`, grade Medium and attempts equal to the
  list length

#### Scenario: A tie goes to the earlier candidate

- **WHEN** selection with the target Medium is given a list whose only proven candidates are Hard at
  position 1 and Easy at position 3
- **THEN** the Hard candidate at position 1 is selected, with attempts equal to the list length

#### Scenario: Nothing proven falls back to a random deal

- **WHEN** no candidate in the list is proven winnable, whatever the target
- **THEN** the last seed is selected with verdict `random`, no grade and attempts equal to the list
  length
