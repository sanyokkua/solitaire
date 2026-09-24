# features/deal-service Specification

## Purpose

The application service that turns a requested mode into a dealt game. It chooses seeds, proves
Draw 1 and Daily deals winnable off the input thread, reports progress for the dealing overlay, and
answers hint requests. It is what the state layer calls to start games and ask for hints.

## Requirements

### Requirement: Deals per mode record their provenance

A deal request SHALL name a mode and whether "Winnable deals only" is on. The deal SHALL be made
as follows:

| Request | Seeds tried | Search budget | Verdict and attempts |
| --- | --- | --- | --- |
| Draw 1, "Winnable deals only" on | up to 40 fresh seeds | 5,000 nodes each | as winnable selection reports them |
| Draw 3, Vegas, or Draw 1 with the switch off | one fresh seed | none | `random`, 1 attempt |

Fresh seeds SHALL come from the cryptographic entropy source. The dealt position SHALL be the
seeded deal of the chosen seed in the requested mode, carrying that verdict and attempt count.
Its deal code therefore reproduces the same layout without the solver.

Input-agnostic: how a new game is requested belongs to a later phase.

Deterministic: with the entropy source fixed, the same request always yields the same position.

*(KS-DEAL-03, KS-DEAL-05, KS-DEAL-06, KS-DEAL-02)*

#### Scenario: A winnable Draw 1 deal

- **WHEN** a Draw 1 deal is requested with "Winnable deals only" on
- **THEN** the dealt position is the Draw 1 deal of the selected seed, with verdict `win` and the
  number of attempts that selection needed

#### Scenario: Unverified modes deal once

- **WHEN** a Draw 3 or Vegas deal is requested, whatever the switch says, or a Draw 1 deal with the
  switch off
- **THEN** one fresh seed is dealt in that mode with verdict `random` and one attempt, and no search
  runs

#### Scenario: Exhausted attempts fall back to a random deal

- **WHEN** none of the 40 candidate Draw 1 deals is proven winnable
- **THEN** the last candidate is dealt with verdict `random` and 40 attempts

#### Scenario: The deal code reproduces the deal

- **WHEN** the dealt position's seed and mode are encoded as a deal code and dealt again
- **THEN** the same layout results, without running the solver

### Requirement: Daily deal v1

The Daily deal SHALL depend only on the current calendar date in UTC, written as `YYYY-MM-DD`,
and SHALL be the same for every player on that date. Its selection is pinned as "daily v1":
- the candidate seed for attempt *k* (from 1 to 40) SHALL be `(D × 131 + k × 7919)` reduced to an
  unsigned 32-bit integer, where *D* is the date read as the integer `YYYYMMDD`;
- each candidate SHALL be searched with a budget of 20,000 nodes;
- the first candidate proven winnable SHALL be dealt in Daily mode.

The Daily deal SHALL always be verified this way, whatever the "Winnable deals only" setting.

If no candidate is proven winnable, the last candidate is dealt with verdict `random` and 40
attempts. This is not expected ever to happen. The different fallback used when the background
thread fails is defined in "The search never runs on the input thread".

Changing the formula, the budget, the attempt cap or the search SHALL be treated as a new version,
because it would change past and future Daily deals.

Input-agnostic: how the Daily deal is requested belongs to a later phase.

Deterministic: the same UTC date always yields the same deal code.

*(KS-DEAL-07)*

#### Scenario: Two time zones on the same UTC day

- **WHEN** the Daily deal is requested at one instant under a UTC+14 time zone and under a UTC−11
  time zone
- **THEN** both produce the same date key and the same deal code

#### Scenario: Different local dates, same UTC day

- **WHEN** the Daily deal is requested at two instants of the same UTC day whose local dates differ
- **THEN** both produce the same deal code

#### Scenario: Rollover happens at 00:00 UTC

- **WHEN** the Daily deal is requested at 23:59:59.999 UTC and again at 00:00:00.000 UTC the next
  day
- **THEN** the two requests use consecutive date keys and their candidate seeds differ

#### Scenario: The setting does not affect the Daily deal

- **WHEN** the Daily deal is requested with "Winnable deals only" off
- **THEN** the deal is still selected by the daily v1 search and dealt with verdict `win`

#### Scenario: Pinned Daily deals do not drift

- **WHEN** the Daily deal is computed for each pinned golden date
- **THEN** each gives its pinned seed and attempt count

### Requirement: Dealing progress and overlay timing

While a verified deal is being chosen, the service SHALL report progress, each report carrying:
- the attempt now being tried, starting at 1;
- whether the "Shuffling a winnable deal…" overlay should be visible.

The overlay SHALL become visible only once the request has been pending for 160 ms. It SHALL never
become visible for a deal delivered sooner. A report SHALL never carry an attempt number that is
not then tried. Once the deal is delivered or cancelled, no further progress SHALL be reported.

Input-agnostic: this is data for a later phase's overlay.

Deterministic: the attempt numbers are those of the selection.

*(KS-DEAL-04)*

#### Scenario: A fast deal shows no overlay

- **WHEN** a verified deal is delivered within 160 ms of the request
- **THEN** no progress report asks for the overlay

#### Scenario: A slow deal shows the overlay with the attempt counter

- **WHEN** a verified deal is still pending 160 ms after the request
- **THEN** a progress report asks for the overlay, and later reports carry the current attempt
  number until the deal is delivered

#### Scenario: No report after the deal settles

- **WHEN** a verified deal is delivered or cancelled
- **THEN** no further progress report arrives for it

### Requirement: A newer request wins

A new deal request SHALL cancel every pending deal and hint request, whether the new deal is chosen
on the background thread or dealt directly on the input thread. A cancelled request SHALL settle as
cancelled, and its result SHALL never be delivered.

A new hint request SHALL replace only an older pending hint request, which settles as cancelled. A
reply that arrives for a replaced hint SHALL be ignored.

A hint requested while a deal is still pending SHALL be answered by the heuristic straight away,
without delaying the deal.

Input-agnostic: no interaction.

Deterministic: what is delivered depends only on the order in which requests are made.

*(new)*

#### Scenario: A second deal cancels the first

- **WHEN** a deal is requested and a second deal is requested before the first is delivered
- **THEN** the first settles as cancelled and only the second is delivered

#### Scenario: A deal dealt on the input thread still cancels a pending verified deal

- **WHEN** a verified Draw 1 deal is pending and a Draw 3 deal is requested
- **THEN** the verified deal settles as cancelled and only the Draw 3 deal is delivered

#### Scenario: A deal cancels a pending hint

- **WHEN** a solver hint is pending and a deal is requested
- **THEN** the hint settles as cancelled and delivers no suggestion

#### Scenario: A newer hint replaces an older one

- **WHEN** two hints are requested one after the other before the first is answered
- **THEN** the first settles as cancelled and only the second hint's answer is delivered

#### Scenario: A hint never cancels a deal

- **WHEN** a hint is requested while a deal is pending
- **THEN** the hint is answered by the heuristic and the deal is still delivered

### Requirement: The search never runs on the input thread

Winnable selection and solver hints SHALL run only on the background thread. The thread that
handles input SHALL only do cheap work: seeded deals, the heuristic hint, and message handling.

If the background thread cannot be started or fails while a deal is pending, the service SHALL
still produce that deal on the input thread:
- for Draw 1, a fresh random deal, marked `random` with 1 attempt;
- for Daily, the first daily v1 candidate, marked `random` with 1 attempt.

A hint pending when the background thread fails SHALL be answered by the heuristic. The next
request SHALL start a new background thread.

Input-agnostic: no interaction.

Deterministic: a fallback deal is the seeded deal of its seed.

*(KS-DEAL-10)*

#### Scenario: A failed background thread still deals

- **WHEN** the background thread reports an error while a Draw 1 or Daily deal is pending
- **THEN** the fallback deal for that mode, marked `random` with 1 attempt, is delivered instead of
  an error

#### Scenario: The next request after a failure starts a new background thread

- **WHEN** a request is made after the background thread failed
- **THEN** it is served by a newly started background thread

#### Scenario: The service does not load the search on the input thread

- **WHEN** the deal service's module dependencies are inspected
- **THEN** it references the solver only through type-only imports and the background thread's
  entry point

### Requirement: Hints use the solver with a heuristic fallback

For a position that is not won, draws one card and has no pass limit (Draw 1 and Daily), the hint
SHALL be the solver suggestion found with a 3,000-node budget, provided it arrives within 150 ms.
The heuristic hint (see assistance "Hint priority") SHALL be used instead in any of these cases:
- the solver offers no suggestion;
- the 150 ms pass without an answer;
- the background thread fails;
- the position is Draw 3 or Vegas, in which case the solver is not asked at all.

A hint request SHALL settle as exactly one of:
- a suggestion, saying whether the solver or the heuristic produced it;
- no suggestion, for a won position or when neither the solver nor the heuristic offers one;
- cancelled, when a newer hint or a deal replaced it (see "A newer request wins").

Input-agnostic: how a hint is requested and shown belongs to a later phase.

Deterministic: the same position gives the same solver suggestion, and the heuristic is
deterministic too.

*(KS-AST-03, KS-AST-02)*

#### Scenario: A Draw 1 hint comes from the solver

- **WHEN** a hint is requested for a Draw 1 position the solver proves winnable within the budget
  and in time
- **THEN** the answer is the first command of the winning line and is marked as coming from the
  solver

#### Scenario: A slow solver falls back to the heuristic

- **WHEN** the solver has not answered 150 ms after a Draw 1 hint request
- **THEN** the answer is the heuristic hint, marked as heuristic

#### Scenario: Draw 3 and Vegas use the heuristic only

- **WHEN** a hint is requested for a Draw 3 or Vegas position
- **THEN** the answer is the heuristic hint and the solver is not asked

#### Scenario: No solver suggestion falls back to the heuristic

- **WHEN** a hint is requested for a Draw 1 position the solver does not prove winnable
- **THEN** the answer is the heuristic hint, marked as heuristic

#### Scenario: A failed background thread falls back to the heuristic

- **WHEN** the background thread fails while a Draw 1 hint is pending
- **THEN** the answer is the heuristic hint, marked as heuristic

#### Scenario: No hint for a won game

- **WHEN** a hint is requested for a won position
- **THEN** the answer is no suggestion

#### Scenario: No move at all

- **WHEN** a hint is requested for a position where neither the solver nor the heuristic offers
  anything
- **THEN** the answer is no suggestion
