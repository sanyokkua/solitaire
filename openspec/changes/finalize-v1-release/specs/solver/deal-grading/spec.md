# Spec Delta

## Purpose

Grading a proven-winnable deal as Easy, Medium or Hard by how long seeded playouts of a human-like player
who sees only face-up cards keep it provably winnable ("grading v1"), and choosing the requested grade, or the
closest one found, from a list of candidate deals.

## ADDED Requirements

### Requirement: Seeded playouts that see only face-up cards

To grade a deal, the system SHALL play it *M* times from its dealt position as a simulated player, with
*M* and every other number below taken from the grading v1 parameters (see "Grading v1 turns playout
survival into a grade"). Each playout SHALL follow these rules.

- **What it sees.** It SHALL decide only from what a player can see: the face-up tableau cards, which
  places hold face-down cards (not which cards they are), the waste top, the foundation heights,
  whether the stock holds cards, and the pass in progress. Exchanging face-down tableau cards and stock
  cards among themselves, with every pile size and every face-up card unchanged, SHALL NOT change any
  choice it makes before one of the exchanged cards is turned face up or becomes the waste top.
- **What it plays.** At each step it SHALL list the productive moves in hint priority order (see
  assistance "Hint candidates in priority order") and choose, in this order:
  1. when at least one candidate exists and a draw or a recycle is also possible, it SHALL draw (or
     recycle) instead, with the unforced-draw probability;
  2. otherwise, when at least one candidate exists, it SHALL walk the list from the first candidate,
     taking each with the take probability and moving on to the next one otherwise; the last candidate
     is taken whenever the walk reaches it;
  3. with no candidate, it SHALL draw while the stock holds cards, and recycle when the stock is empty
     and the pass limit allows.

  Every command SHALL be applied by the game rules, exactly as a player's would be. Every random choice
  draws exactly one value from the playout's generator.
- **When it stops.** It SHALL stop at the first of:
  - a win;
  - a position with no move, no draw and no recycle left;
  - a stall: the stock and waste return to an arrangement they already had since the last board move,
    so a full cycle through the talon played nothing;
  - the step cap: the number of commands a playout may apply;
  - a checkpoint the solver cannot prove (see "Grading v1 turns playout survival into a grade").
- **Randomness.** Every random choice SHALL come from the seeded generator (see card-model
  "Deterministic pseudo-random sequence"), seeded with the playout seed of the grading v1 parameters,
  which depends on the deal's seed and the playout's index alone. Nothing else SHALL be random.

Input-agnostic: no interaction; winnable selection calls grading.

Deterministic: the same deal and playout index always play the same commands.

*(KS-DEAL-11 (new))*

#### Scenario: Repeated grading agrees

- **WHEN** the same deal is graded twice
- **THEN** each playout plays the same commands both times, and the score and grade are equal

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
- **THEN** it stops, and asks the solver about no further position

#### Scenario: The Vegas pass limit ends the playout

- **WHEN** a Vegas playout reaches an empty stock on its third pass with no productive move
- **THEN** it stops without trying a recycle

### Requirement: Grading v1 turns playout survival into a grade

The system SHALL grade a deal only when its search verdict is `win`. A deal dealt as `random` SHALL
have no grade.

A playout's *survival* is the number of its checkpoints that the solver proves still winnable. A checkpoint is the
position after every *C*-th command of the playout. At each checkpoint the system SHALL ask the solver that fits the
deal's mode (see solver/deal-selection "Winnable selection by reject sampling") with the checkpoint budget. It SHALL
stop asking at the first checkpoint that is not a proven `win`, `loss` and `unknown` alike. A playout SHALL count at
most *K* checkpoints, and a playout that wins, or reaches *K*, has survived every checkpoint it had left.

Grading v1 uses these parameters:

| Parameter | Grading v1 value |
| --- | --- |
| Playouts per deal, *M* | 8 |
| Take probability | 0.6 |
| Unforced-draw probability | 0.05 |
| Step cap | 1,000 commands per playout |
| Checkpoint spacing, *C* | 10 commands |
| Checkpoints counted, *K* | 10 |
| Checkpoint budget | 3,000 nodes |
| Playout seed for playout *i* (from 0) of a deal with seed *s* | `fmix32((s + (i + 1) × 0x9E3779B9) mod 2³²)`, where `fmix32` is the MurmurHash3 32-bit finalizer |

The deal's *score* is the survival of its *M* playouts added together, from 0 to *M* × *K*. The grade SHALL be read
from the score through the grading v1 table for the deal's mode:

| Mode | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Draw 1 | score ≥ 62 | 44 ≤ score ≤ 61 | score ≤ 43 |
| Draw 3 | score ≥ 30 | 13 ≤ score ≤ 29 | score ≤ 12 |
| Vegas | score ≥ 8 | 1 ≤ score ≤ 7 | score = 0 |

A Daily deal is dealt and played exactly like a Draw 1 deal, so it SHALL be graded with the Draw 1
row.

The table SHALL give every grade at least 15% of the proven-winnable deals of a pinned calibration
sample in each mode. A pinned set of golden deals per mode, each with its score and grade, SHALL pin grading v1.

Grading v1 is the parameters, the playout rules and the table taken together. Changing any of them
SHALL be a new grading version, made on purpose by updating the pinned grades.

Input-agnostic: no interaction.

Deterministic: the same deal always gets the same score and grade.

*(KS-DEAL-11 (new))*

#### Scenario: A score maps to a grade through the table

- **WHEN** scores at and around the two thresholds of a mode's grading v1 row are read through it
- **THEN** the grades are Easy at and above the Easy bound, Hard at and below the Hard bound, and Medium between

#### Scenario: Survival stops at the first unproven checkpoint

- **WHEN** the solver proves the first two checkpoints of a playout and not the third
- **THEN** the playout's survival is 2 and the solver is asked about no later checkpoint of it

#### Scenario: A winning playout survives every checkpoint it had left

- **WHEN** a playout wins after the solver proved every checkpoint it reached
- **THEN** its survival is *K*

#### Scenario: A playout that ends before its first checkpoint scores nothing

- **WHEN** a playout stops before its first checkpoint
- **THEN** its survival is 0 and the solver is asked nothing

#### Scenario: Pinned grades do not drift

- **WHEN** each pinned golden deal of each mode is graded
- **THEN** it gets its pinned score and grade

#### Scenario: Every grade is common enough

- **WHEN** the scores of each mode's calibration sample are read through the pinned table
- **THEN** each of Easy, Medium and Hard holds at least 15% of them

#### Scenario: A Daily deal grades like its Draw 1 twin

- **WHEN** a Daily deal and the Draw 1 deal of the same seed are graded
- **THEN** they get the same score and grade

#### Scenario: A random deal has no grade

- **WHEN** selection falls back to a deal with the verdict `random`
- **THEN** that deal is not graded and reports no grade

### Requirement: A requested grade, or the closest one found

Given an ordered list of candidate seeds, a mode, a target grade (Any, Easy, Medium or Hard) and a grade limit,
winnable selection (see deal-selection "Winnable selection by reject sampling") SHALL grade each proven candidate
it reaches, at most as many as the grade limit, and choose:

| Case | Selected deal | Verdict and grade | Attempts |
| --- | --- | --- | --- |
| Target Any, a candidate proven | the first proven candidate | `win`, its grade | its position in the list |
| Target Easy, Medium or Hard, a proven candidate of that grade | the first proven candidate of that grade | `win`, the target grade | its position in the list |
| Target Easy, Medium or Hard, no proven candidate of that grade among those graded | the graded candidate whose grade is closest to the target | `win`, its own grade | the number of candidates tried |
| No candidate proven | the last seed | `random`, no grade | the length of the list |

Grades are ordered Easy < Medium < Hard, and the distance between two grades is the number of steps
between them. When two graded candidates are equally close, the earlier one SHALL be selected. The
reported grade SHALL always be the selected deal's own grade, never the target. Selection SHALL stop trying
candidates once it has graded as many proven ones as the grade limit, so the work of one request is bounded
without a clock. The grade limit is a count, so the same request always selects the same deal.

Every graded candidate that is not selected SHALL be reported as a spare, with its seed and grade, in the
order tried; a `random` result has none.

With the target Any, the selected seed, verdict and attempts SHALL be exactly those that selection
chooses without grading, so grading never changes which deal Any selects.

Input-agnostic: no interaction.

Deterministic: the same seeds, mode, budget, target and grade limit always select the same seed with the same
verdict, attempts, grade and spares.

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
  number of candidates tried, and the Easy candidate is a spare

#### Scenario: A tie goes to the earlier candidate

- **WHEN** selection with the target Medium is given a list whose only proven candidates are Hard at
  position 1 and Easy at position 3
- **THEN** the Hard candidate at position 1 is selected, with attempts equal to the number of candidates
  tried

#### Scenario: The grade limit bounds the grading

- **WHEN** selection with the target Hard and a grade limit of 2 is given a list whose proven candidates are
  Easy at position 1, Easy at position 2 and Hard at position 3
- **THEN** the candidate at position 3 is never tried, and the Easy candidate at position 1 is selected with
  attempts 2 and the other as its spare

#### Scenario: The graded candidates that are not selected are spares

- **WHEN** selection with the target Hard selects the Hard candidate at position 5 after grading an Easy
  candidate at position 2
- **THEN** the result lists the Easy candidate, with its seed and grade, as a spare

#### Scenario: Nothing proven falls back to a random deal

- **WHEN** no candidate in the list is proven winnable, whatever the target
- **THEN** the last seed is selected with verdict `random`, no grade and attempts equal to the list
  length
