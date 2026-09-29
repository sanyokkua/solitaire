# Spec Delta

## ADDED Requirements

### Requirement: Instant deals from a pre-verified pool

Once start-up has finished, while the page is visible and no deal the player asked for is pending,
the service SHALL pre-verify deals for the player's current mode (Draw 1, Draw 3 or Vegas) with
"Winnable deals only" on. Pre-verification SHALL run on a separate, low-priority background thread of
its own, never on the one that serves the player's deals and hints. It SHALL use exactly the seed source,
selection rules, budgets and grading of a requested deal (see "Deals per mode record their
provenance"), so a pooled deal cannot be told apart from one searched on request.

The pool holds proven-winnable, graded deals. It SHALL:
- pre-verify one deal at a time, only for the current mode, asking for the grade of which it holds fewest
  deals; it never fills a mode the player has not selected;
- keep the deal a pre-verification selects and the other graded deals it met on the way (its spares), when
  the pool has room for their grade; the spares of a deal the player asked for are kept the same way;
- never keep a deal that ends `random`, because no candidate was proven winnable: the pool holds only deals
  that are really winnable;
- hold at most 2 deals for each pair of mode and grade, oldest first, and drop a deal that does not fit;
- live in memory only: nothing about it is stored, and a reload starts with an empty pool;
- never be filled or used for the Daily deal, nor while "Winnable deals only" is off;
- pause while the page is hidden or a deal the player asked for is pending: no new pre-verification
  starts while it is paused, and one already under way is not cancelled;
- refill after a pooled deal is used, until each grade of the current mode again holds 2 deals;
- stop filling when a pre-verification pools nothing (it proves none of its candidates winnable, everything it found
  fell in a full grade, or it fails): no further pre-verification starts until the next pooled deal is used, the
  player's choice changes, the page becomes visible again or a pending deal ends.

A deal request whose mode and "Winnable deals only" switch match the pool SHALL be served from it, at
once, when the pool holds a deal of the target grade (the oldest one), or, for the target Any, a deal of
any grade (the oldest one). The deal is delivered with the verdict `win`, the grade and the attempts
recorded when it was found (1 for a spare). No search runs for it, no progress is reported for it and the
dealing overlay never appears. A pooled deal SHALL be delivered at most once. A pooled deal of another grade
SHALL NOT be served for a target grade. A request that the pool cannot serve SHALL be served exactly as
"Deals per mode record their provenance" defines.

Performance:
- a deal served from a warm pool SHALL be delivered within 100 ms of the request, in Draw 1, Draw 3
  and Vegas;
- a deal searched on request has no time target: the dealing overlay stays for as long as the search takes,
  and the time is measured and reported for information only, in every mode.

Input-agnostic: the pool serves whichever control requested the deal and has no control of its own.

Deterministic: a pooled deal is the seeded deal of its seed, carrying the verdict, attempts and grade that
selection reports for it, so its deal code reproduces it without the solver.

*(KS-DEAL-12 (new), KS-PERF-02, KS-DEAL-03, KS-DEAL-11 (new))*

#### Scenario: A matching request is served at once

- **WHEN** the pool holds a proven Draw 3 deal graded Medium, and a Draw 3 deal is requested with "Winnable
  deals only" on and target Medium
- **THEN** that deal is delivered within 100 ms with its verdict `win` and grade, no progress is reported
  and the dealing overlay never appears

#### Scenario: Any takes the oldest deal of any grade

- **WHEN** the pool holds a Hard deal and, after it, an Easy deal for Draw 1, and a Draw 1 deal is requested
  with the target Any
- **THEN** the Hard deal is delivered

#### Scenario: Oldest first, each deal once

- **WHEN** two deals are pooled for the same mode and grade and two matching deals are requested one after
  the other
- **THEN** the first request receives the older pooled deal and the second the newer one, and neither
  is delivered again

#### Scenario: A request the pool cannot serve is searched as usual

- **WHEN** no deal of the requested grade is pooled for the requested mode
- **THEN** the deal is searched on request, with progress and overlay timing as "Dealing progress and
  overlay timing" defines, and no deal of another grade is served from the pool

#### Scenario: The spares of a search are kept

- **WHEN** a search for a Hard deal meets a proven Easy deal and a proven Medium deal before it finds a Hard one,
  and the pool has room for both grades
- **THEN** the Easy and the Medium deal are pooled, and a later request for either is served at once

#### Scenario: A full bucket drops a spare

- **WHEN** 2 Easy deals are pooled for a mode and a search meets another proven Easy deal
- **THEN** it is not pooled

#### Scenario: The pool refills after use

- **WHEN** a pooled deal is used while the page stays visible and no deal is pending
- **THEN** pre-verification for the current mode resumes until each grade holds 2 deals again

#### Scenario: A hidden page pauses pre-verification

- **WHEN** the page is hidden
- **THEN** no new pre-verification starts until the page is visible again

#### Scenario: A pending deal pauses pre-verification without cancelling it

- **WHEN** a pre-verification is under way and the player requests a deal the pool cannot serve
- **THEN** no new pre-verification starts until that deal settles, and the one under way is not
  cancelled

#### Scenario: A reload starts with an empty pool

- **WHEN** deals are pooled and the app is reloaded
- **THEN** the pool is empty and the stored record holds nothing about it

#### Scenario: An unproven pre-verification is not pooled

- **WHEN** a pre-verification for Vegas proves none of its candidates winnable
- **THEN** nothing is pooled from it, and no further pre-verification starts until the next pooled deal is
  used, the player's choice changes, the page becomes visible again or a pending deal ends

#### Scenario: A pre-verification that pools nothing stops the filling until a trigger

- **WHEN** a pre-verification pools nothing, whether it proved none of its candidates winnable, found only deals
  for full grades or failed
- **THEN** no further pre-verification starts, and filling starts again when a pooled deal is used, the player's
  choice changes, the page becomes visible again or a pending deal ends

#### Scenario: No pool for Daily or with the switch off

- **WHEN** the Daily deal is requested, or a Draw 1, Draw 3 or Vegas deal is requested with "Winnable
  deals only" off
- **THEN** the deal is made as its own requirement defines, and no pooled deal is used or filled for
  it; a Daily search pauses pre-verification while it runs and deposits nothing into the pool

### Requirement: A small in-memory verdict cache

The service SHALL remember the verdicts, and the grades of the wins, of the seeds its searches have really
searched, so that a seed is not searched or graded twice at the same budget and mode. It SHALL:
- keep at most 256 entries, keyed by mode, budget and seed, and drop the least recently used first;
- send the entries it holds for a request's seeds to the solver as known verdicts (see solver/deal-selection
  "Winnable selection by reject sampling"), so a search that is cancelled and restarted, and the Daily
  candidate list, do not repeat work;
- never use an entry recorded at another mode or budget;
- live in memory only: nothing about it is stored.

Because search and grading are deterministic, the cache never changes which deal is selected, only how
long the selection takes.

Input-agnostic: no interaction.

Deterministic: a request with the cache selects exactly what it selects without it.

*(KS-DEAL-03, KS-DEAL-05)*

#### Scenario: A repeated Daily request is answered from the cache

- **WHEN** the Daily deal is requested a second time in a session with the same candidate list
- **THEN** no candidate is searched or graded again, and the same deal is delivered

#### Scenario: A restarted search keeps its finished work

- **WHEN** a search is cancelled after some of its seeds were searched, and the same seeds are requested again
- **THEN** the seeds already searched are sent as known verdicts and are not searched again

#### Scenario: The least recently used entry goes first

- **WHEN** the cache holds 256 entries and a new outcome is recorded
- **THEN** the entry used least recently is dropped

#### Scenario: Another mode or budget misses

- **WHEN** a seed's verdict was recorded at one budget or mode and is requested at another
- **THEN** it is not sent as known

### Requirement: The pool follows the player's choice

When the selected mode or the "Winnable deals only" switch changes, the next pre-verification to start
SHALL be for the new mode. Deals already pooled for other modes SHALL be kept until the app is reloaded, and
SHALL serve a matching request if the player returns to that mode. While the new choice is the Daily deal or
has "Winnable deals only" off, no new pre-verification SHALL start.

Input-agnostic: the choice is changed through Home's controls (see `ui/home-screen`); the pool reacts
to the changed settings, whichever input path changed them.

Deterministic: which mode is filled next depends only on the current settings.

*(KS-DEAL-12 (new), KS-DEAL-11 (new))*

#### Scenario: Changing the mode moves the filling

- **WHEN** the pool is filling for Draw 1 and the player selects Vegas
- **THEN** the next pre-verification to start is for Vegas, and the Draw 1 deals already pooled are kept

#### Scenario: Returning to a kept mode

- **WHEN** Draw 1 deals were pooled, the player switched to Vegas, then back to Draw 1, and requests a deal
  of a pooled grade
- **THEN** the deal is served at once from the kept Draw 1 deals

#### Scenario: Daily or the switch off stops the filling

- **WHEN** the selected mode becomes Daily, or "Winnable deals only" is switched off
- **THEN** no new pre-verification starts, and deals already pooled are kept

## MODIFIED Requirements

### Requirement: Deals per mode record their provenance

A deal request SHALL name a mode, whether "Winnable deals only" is on, and a target difficulty: Any,
Easy, Medium or Hard. The target difficulty SHALL be ignored while the switch is off. A Daily deal
request SHALL be served by "Daily deal v1", whatever the switch and the target difficulty say. The
other modes' deals SHALL be made as follows:

| Request | Seeds tried | Search budget | Verdict, attempts and grade |
| --- | --- | --- | --- |
| Draw 1, "Winnable deals only" on | up to 40 fresh seeds | 5,000 nodes each | as selection reports them for the target difficulty |
| Draw 3 or Vegas, "Winnable deals only" on | up to 40 fresh seeds | 20,000 nodes each | as selection reports them for the target difficulty |
| Draw 1, Draw 3 or Vegas, "Winnable deals only" off | one fresh seed | none | `random`, 1 attempt, no grade |

The Draw 3 and Vegas budgets are set by the per-mode deal benchmark; they live in this table, and
changing either is a change to this requirement. A search request grades at most 4 proven candidates, and
carries the verdicts the service's cache holds for its seeds (see "A small in-memory verdict cache"). The
spares of the search are offered to the pool (see "Instant deals from a pre-verified pool").

With the switch on, the verdict, attempts and grade SHALL be those that winnable selection (see
`solver/deal-selection`) reports for the target difficulty, as `solver/deal-grading` "A requested
grade, or the closest one found" defines: a deal proven winnable is dealt with verdict `win` and its
own grade, which is the closest grade found when the target is not; when no candidate is proven
winnable, the last candidate is dealt with verdict `random` and no grade. A deal served from the pool
carries the provenance recorded when it was found (see "Instant deals from a pre-verified
pool").

Fresh seeds SHALL come from the cryptographic entropy source. The dealt position SHALL be the
seeded deal of the chosen seed in the requested mode, carrying that verdict, attempt count and
grade. Its deal code therefore reproduces the same layout without the solver.

Input-agnostic: the request is the same whichever control starts the game (see
`features/game-session`).

Deterministic: with the entropy source fixed and no pooled deal for the request, the same request
(mode, switch and target difficulty) always yields the same position, verdict, attempts and grade.

*(KS-DEAL-03, KS-DEAL-05, KS-DEAL-06, KS-DEAL-02, KS-DEAL-11 (new))*

#### Scenario: A winnable Draw 1 deal

- **WHEN** a Draw 1 deal is requested with "Winnable deals only" on and target Any
- **THEN** the dealt position is the Draw 1 deal of the selected seed, with verdict `win`, the number
  of attempts that selection needed, and its grade

#### Scenario: A winnable Draw 3 or Vegas deal

- **WHEN** a Draw 3 or a Vegas deal is requested with "Winnable deals only" on
- **THEN** candidates are searched with 20,000 nodes each, and a candidate proven winnable is dealt in
  that mode with verdict `win`, its attempts and its grade

#### Scenario: A requested grade that is not found

- **WHEN** a deal is requested with target Hard, and candidates are proven winnable but none of them
  is graded Hard within the attempt limit
- **THEN** the proven candidate whose grade is closest to Hard is dealt with verdict `win` and
  labelled with its own grade, never with the requested one

#### Scenario: Unverified modes deal once

- **WHEN** a Draw 1, Draw 3 or Vegas deal is requested with "Winnable deals only" off, whatever the
  target difficulty
- **THEN** one fresh seed is dealt in that mode with verdict `random`, one attempt and no grade, and
  no search runs

#### Scenario: Exhausted attempts fall back to a random deal

- **WHEN** none of the 40 candidate deals of a Draw 1, Draw 3 or Vegas request is proven winnable
- **THEN** the last candidate is dealt with verdict `random`, 40 attempts and no grade

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

The Daily deal SHALL always be verified this way, whatever the "Winnable deals only" setting, and
the player's target difficulty SHALL never affect it.

The selected deal SHALL then be graded by "grading v1" (see `solver/deal-grading`), and its grade
SHALL be reported with it. Grading SHALL NOT change which candidate is selected, so the seed and
attempt count are exactly those daily v1 selects. Daily deals are never served from the pool.

If no candidate is proven winnable, the last candidate is dealt with verdict `random`, 40 attempts
and no grade. This is not expected ever to happen. The different fallback used when the background
thread fails is defined in "The search never runs on the input thread".

Changing the formula, the budget, the attempt cap or the search SHALL be treated as a new version,
because it would change past and future Daily deals. The reported grade is pinned by grading v1;
changing the grading is a new grading version and never changes a Daily deal's seed or attempts.

Input-agnostic: the Daily deal is requested like any other deal, whichever control starts it.

Deterministic: the same UTC date always yields the same deal code, attempt count and grade.

*(KS-DEAL-07, KS-DEAL-11 (new))*

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
- **THEN** the deal is still selected by the daily v1 search and dealt with verdict `win` and its
  grade

#### Scenario: The target difficulty does not affect the Daily deal

- **WHEN** the Daily deal for the same UTC date is requested once with target Easy and once with
  target Hard
- **THEN** both give the same seed, attempt count and grade

#### Scenario: Pinned Daily deals do not drift

- **WHEN** the Daily deal is computed for each pinned golden date
- **THEN** each gives its pinned seed, attempt count and grade

### Requirement: Dealing progress and overlay timing

While a verified deal is being chosen, the service SHALL report progress, each report carrying:
- the attempt now being tried, starting at 1;
- whether the "Shuffling a winnable deal…" overlay should be visible.

The overlay SHALL become visible only once the request has been pending for 160 ms. It SHALL never
become visible for a deal delivered sooner. A report SHALL never carry an attempt number that is
not then tried. Once the deal is delivered or cancelled, no further progress SHALL be reported.

A deal served from the pool (see "Instant deals from a pre-verified pool") SHALL report no progress
and SHALL never make the overlay visible. Pre-verification for the pool SHALL report no progress.

Input-agnostic: this is data for the dealing overlay (see `ui/game-screen`).

Deterministic: the attempt numbers are those of the selection.

*(KS-DEAL-04, KS-DEAL-12 (new))*

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

#### Scenario: A pooled deal shows no overlay

- **WHEN** a deal is served from the pool
- **THEN** no progress is reported for it and the overlay never becomes visible

#### Scenario: Pre-verification reports no progress

- **WHEN** the pool pre-verifies a deal while the Game screen is shown
- **THEN** no progress is reported and the overlay does not appear

### Requirement: A newer request wins

A new deal request SHALL cancel every pending deal and hint request, whether the new deal is chosen
on the background thread, dealt directly on the input thread or served from the pool. A cancelled
request SHALL settle as cancelled, and its result SHALL never be delivered.

A new deal request SHALL NOT cancel pool pre-verification (see "Instant deals from a pre-verified
pool"). Pre-verification SHALL never delay or cancel a deal or hint the player asked for: those are
served on their own background thread, never queued behind it.

A new hint request SHALL replace only an older pending hint request, which settles as cancelled. A
reply that arrives for a replaced hint SHALL be ignored.

A hint requested while a deal is still pending SHALL be answered by the heuristic straight away,
without delaying the deal.

Input-agnostic: no interaction.

Deterministic: what is delivered depends only on the order in which requests are made.

*(new; KS-DEAL-12 (new))*

#### Scenario: A second deal cancels the first

- **WHEN** a deal is requested and a second deal is requested before the first is delivered
- **THEN** the first settles as cancelled and only the second is delivered

#### Scenario: A deal dealt on the input thread still cancels a pending verified deal

- **WHEN** a verified Draw 1 deal is pending and a Draw 3 deal is requested with "Winnable deals
  only" off
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

#### Scenario: A deal never cancels pre-verification

- **WHEN** a pre-verification is under way and the player requests a deal
- **THEN** the requested deal is delivered as usual and the pre-verification is not cancelled

#### Scenario: A player's hint never waits behind the pool

- **WHEN** a pre-verification is under way and the player requests a hint
- **THEN** the hint is sent at once to the player's background thread and answered within its usual
  150 ms limit, and the pre-verification is not cancelled

### Requirement: The search never runs on the input thread

Winnable selection, grading, pool pre-verification and solver hints SHALL run only on background
threads: requests the player makes on one background thread, and pool pre-verification on a second
one of its own. The thread that handles input SHALL only do cheap work: seeded deals, the heuristic
hint, serving pooled deals, and message handling.

If the player's background thread cannot be started or fails while a deal is pending, the service
SHALL still produce that deal on the input thread:
- for Draw 1, Draw 3 or Vegas, a fresh random deal in that mode, marked `random` with 1 attempt and no
  grade;
- for Daily, the first daily v1 candidate, marked `random` with 1 attempt and no grade.

A hint pending when the player's background thread fails SHALL be answered by the heuristic. The next
request SHALL start a new background thread.

If the pool's background thread cannot be started or fails, only the pool SHALL be affected: the
pre-verification under way is dropped, deals already pooled stay available, no deal or hint the
player asked for is delayed or changed, and no notice is shown. The next time the pool fills, it
SHALL start a new background thread.

Input-agnostic: no interaction.

Deterministic: a fallback deal is the seeded deal of its seed.

*(KS-DEAL-10, KS-DEAL-12 (new))*

#### Scenario: A failed background thread still deals

- **WHEN** the player's background thread reports an error while a Draw 1, Draw 3, Vegas or Daily
  deal is pending
- **THEN** the fallback deal for that mode, marked `random` with 1 attempt and no grade, is delivered
  instead of an error

#### Scenario: The next request after a failure starts a new background thread

- **WHEN** a request is made after the player's background thread failed
- **THEN** it is served by a newly started background thread

#### Scenario: A failed pool thread affects only the pool

- **WHEN** the pool's background thread fails during a pre-verification
- **THEN** that pre-verification is dropped, deals already pooled can still be served, the player's
  deals and hints are served as usual, and a new pool thread starts on the next fill trigger

#### Scenario: The service does not load the search on the input thread

- **WHEN** the deal service's module dependencies are inspected
- **THEN** it references the solver only through type-only imports and the background thread's
  entry point

### Requirement: Hints use the solver with a heuristic fallback

For a position that is not won, in every mode (Draw 1, Draw 3, Vegas and Daily), the hint SHALL be
the solver suggestion found with a 3,000-node budget, provided it arrives within 150 ms. The
heuristic hint (see assistance "Hint priority") SHALL be used instead in any of these cases:
- the solver offers no suggestion;
- the 150 ms pass without an answer;
- the background thread fails.

A hint request SHALL settle as exactly one of:
- a suggestion, saying whether the solver or the heuristic produced it;
- no suggestion, for a won position or when neither the solver nor the heuristic offers one;
- cancelled, when a newer hint or a deal replaced it (see "A newer request wins").

Input-agnostic: the Hint control and the H shortcut issue the same request (see
`features/interaction`); how the hint is shown belongs to the interface.

Deterministic: the same position gives the same solver suggestion, and the heuristic is
deterministic too.

*(KS-AST-03, KS-AST-02)*

#### Scenario: A Draw 1 hint comes from the solver

- **WHEN** a hint is requested for a Draw 1 position the solver proves winnable within the budget
  and in time
- **THEN** the answer is the first command of the winning line and is marked as coming from the
  solver

#### Scenario: Draw 3 and Vegas hints come from the solver

- **WHEN** a hint is requested for a Draw 3 or Vegas position the solver proves winnable within the
  budget and in time
- **THEN** the answer is the first command of the winning line and is marked as coming from the
  solver

#### Scenario: A slow solver falls back to the heuristic

- **WHEN** the solver has not answered 150 ms after a hint request in any mode
- **THEN** the answer is the heuristic hint, marked as heuristic

#### Scenario: Draw 3 and Vegas use the heuristic only

- **WHEN** a hint is requested for a Draw 3 or Vegas position the solver does not prove winnable
  within the budget
- **THEN** the answer is the heuristic hint only, marked as heuristic

#### Scenario: No solver suggestion falls back to the heuristic

- **WHEN** a hint is requested for a Draw 1 position the solver does not prove winnable
- **THEN** the answer is the heuristic hint, marked as heuristic

#### Scenario: A failed background thread falls back to the heuristic

- **WHEN** the background thread fails while a hint is pending
- **THEN** the answer is the heuristic hint, marked as heuristic

#### Scenario: No hint for a won game

- **WHEN** a hint is requested for a won position
- **THEN** the answer is no suggestion

#### Scenario: No move at all

- **WHEN** a hint is requested for a position where neither the solver nor the heuristic offers
  anything
- **THEN** the answer is no suggestion
