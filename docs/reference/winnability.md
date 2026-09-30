# Winnability

Why some Klondike deals cannot be won, how the app proves that a deal can, and how it chooses, grades and serves those
deals. The rules themselves are in [game-rules.md](game-rules.md); the algorithms are in
[domain-and-solver.md](../architecture/domain-and-solver.md); the code lives in [`src/solver`](../../src/solver/README.md)
and [`src/features/deal`](../../src/features/README.md).

## What "winnable" means

A deal is winnable when at least one sequence of legal moves wins it, with every card known, including the face-down
cards. That is "thoughtful" solitaire: a real player sees only the face-up cards and cannot always find the line. The
solver sees everything, so "winnable" is an upper bound on what a person can achieve, not a promise that a person will
win it.

## Facts from the literature

- **Draw 1:** 81.945% ± 0.084% of deals are winnable when all cards are known (Blake and Gent, _The Winnability of
  Klondike Solitaire and Many Other Patience Games_, Journal of Artificial Intelligence Research 85, 2026;
  [arXiv:1906.12314](https://arxiv.org/abs/1906.12314)). Earlier bounds were between 82% and 91.44% (Bjarnason, Fern and
  Tadepalli, _Searching Solitaire in Real Time_, ICGA Journal, 2007). Yan and Diaconis (2005) called the question "one of
  the embarrassments of applied probability".
- **About one deal in five cannot be won.** Without a "winnable only" mode, roughly 18% of games frustrate players
  through no fault of their own.
- **Human win rates are far lower:** about 33% for Draw 1 and about 11% for Draw 3 (figures published by Solitaired), and
  37.0% over 138,759 Draw 1 starts (playsolitaire.io). These are vendor figures, not rigorous studies. The 82% figure
  must never be presented as a player win rate.
- **No solvable shuffle is known.** There is no way to shuffle for solvability. Winnability is checked after the shuffle,
  by a solver.
- **For comparison, FreeCell:** only 102,075 of 8,589,934,591 deals are impossible with four free cells (Pringle and
  Fish, 2018), and exactly one (number 11982) of Microsoft's original 32,000.
- **Draw 3:** the published winnability rate above is for Draw 1. This project measures its own Draw 3 and Vegas
  search at fixed budgets and records the results in the [benchmark section of the test guide](../../tests/README.md#benchmark).

The figures assume thoughtful play with every card known. Solver timings in the papers come from HPC or server hardware;
only their shape carries over to a browser.

## Solver behaviour: a fast median and a heavy tail

- Solvitaire's Klondike median is about 0.02 s, roughly 3,000 nodes, but its 99th percentile is about 906 s, with worst
  cases up to a one-hour cap (HPC hardware).
- Bjarnason et al. solved over 80% of deals in under 4 s (2007 hardware) and capped their solver at 8 s.
- **Consequence:** the solver in the browser is always bounded by a node budget (not a time bound, which would not be
  deterministic), and "unknown" is a real result, separate from "win" and "loss". Most "unknown" deals are really
  unwinnable; they are just expensive to prove.
- Published solvers can be wrong: one C++ IDA\* solver (ShootMe/Klondike-Solver) got six benchmark instances wrong. Any
  solver adopted here has to be validated against known deals, which is why this project checks its solvers against a
  reference and against an exhaustive search ([domain-and-solver.md](../architecture/domain-and-solver.md#how-the-searches-are-checked)).

### What the Draw 1 search proves at each budget

The pinned Draw 1 search ([domain-and-solver.md](../architecture/domain-and-solver.md#the-draw-1-reference-solver))
gives these verdicts on the 200 seeds 1 to 200:

| Node budget | Proven win | Proven loss | Unknown |
| ----------- | ---------- | ----------- | ------- |
| 5,000       | 71% (142)  | 0.5% (1)    | 28.5%   |
| 15,000      | 76.5%      | 0.5%        | 23%     |
| 60,000      | 81.5%      | 0.5%        | 18%     |

At 60,000 nodes the proven-win rate matches the literature's 82%. The 5,000-node row is pinned by the solver corpus test.
A larger budget buys a few more proven deals per hundred seeds while the time per proven deal grows much faster, so the
player budgets stay small and the search is retried on a fresh seed instead.

### Selection bias

A small budget throws away hard-but-winnable deals, so "winnable only" skews slightly easier than the whole set of
winnable deals. Ways to reduce that are a larger budget, running the search on a background worker, a pool of deals
verified ahead of time, or pre-verified seeds. This app searches on a worker, keeps a background pool (below), and lets the
player ask for a harder grade with the Difficulty control.

## How the deal service picks a deal

For a player, the Home screen has a "Winnable deals only" switch and a Difficulty control. What they do, by mode:

| Mode                  | Switch on                                                      | Switch off               |
| --------------------- | -------------------------------------------------------------- | ------------------------ |
| Draw 1, Draw 3, Vegas | A proven-winnable deal, of the requested grade if one is found | One fresh seed, `random` |
| Daily                 | Always searched, whatever the switch says (Draw 1 rules)       | The same                 |

### Selection

Selection is reject sampling: shuffle, search within a bounded budget, keep or try another seed.

- **Candidates.** A player request tries up to **48** fresh seeds (`MAX_ATTEMPTS`), one after another. That is 20% more
  than the 40 the first release tried, so a request finds a proven deal, and one of the requested grade, more often. The
  first proven win with the requested grade is dealt.
- **Budget per candidate.** Draw 1: 5,000 nodes. Draw 3 and Vegas: 20,000 nodes of the ordered-talon search. Values
  are in `src/features/deal/budgets.ts`.
- **Which search.** A candidate that draws one card with no pass limit (Draw 1, Daily) is searched by the Draw 1 solver;
  Draw 3 and Vegas by the ordered-talon solver.
- **Requested grade.** With Difficulty set to Any the first proven candidate is dealt. With Easy, Medium or Hard, each
  proven candidate is graded and the first one of the requested grade is dealt. If the search meets eight proven candidates
  of other grades first (`GRADE_LIMIT`) or the seeds run out, the proven candidate whose grade is closest is dealt (Easy is
  next to Medium, Medium is next to Hard; the earlier candidate wins a tie), labelled with its own grade, never with the
  one requested. Bounding the work by a count of graded deals rather than by a clock means the same request always
  selects the same deal.
- **Nothing proven.** If no candidate is proven, the last seed is dealt as `random` and marked "Random deal".
- **The result.** A dealt game records its seed, mode, verdict (`win` or `random`), the number of attempts and its grade
  (`easy`, `medium`, `hard` or none). The chip shows "Winnable · Easy" (or Medium or Hard), with "found after N shuffles"
  when more than one attempt was needed, or "Random deal".
- **Restart and deal codes.** Restart replays the same deal with the same verdict, attempts and grade. A deal code
  carries only the seed and the mode, so a code deals a `random` game with no grade, even if the same seed was once
  proven winnable.
- **Latency.** A cold search runs on the solver worker, so input is never blocked. If it takes longer than 160 ms the
  dealing overlay ("Shuffling cards before the game…") shows an attempt counter. A cold deal can take seconds, more for
  Vegas, because a deal that is really winnable is worth waiting for; the pool below serves a warm deal at once. Timings
  are reported, not gated (see the benchmark section of the [test guide](../../tests/README.md#benchmark)).
- **Failure.** If the worker fails or cannot start, the first candidate seed is dealt as `random`, one attempt.

### Daily

The Daily deal is selected from 40 candidate seeds derived from the UTC date, each searched with 20,000 nodes by the Draw 1
search, and the first proven win is used. It ignores the "Winnable deals only" switch and the Difficulty control, is
graded after selection like a Draw 1 deal, and its selection (the "Daily v1" parameters) is frozen so that no past or
future Daily changes. Details: [game-rules.md](game-rules.md#daily).

### Grades

A proven-winnable deal is graded Easy, Medium or Hard by how forgiving it is: how long plausible human play keeps it
provably winnable. A deal that only one narrow line wins is Hard; a deal that stays winnable through many plausible
mistakes is Easy. Grading v2 replays the deal eight times with a simulated player that sees only the face-up cards, and asks
the solver every tenth command whether the position can still be won. The count of positions that stay provably winnable
is the score, and per-mode thresholds turn the score into a grade. The thresholds were chosen so that each grade holds at
least 15% of the proven-winnable deals of a calibration sample in every mode (roughly 17 / 33 / 50% Easy / Medium / Hard in
Draw 1, 18 / 42 / 40% in Draw 3 and 23 / 28 / 48% in Vegas). The full description and the thresholds are in
[domain-and-solver.md](../architecture/domain-and-solver.md#grading-v2); changing any of it is a new grading version.

Grading is a statement about how forgiving a deal is for a player who sees face-up cards only; it is not a measure of how
many moves the win needs, and the solver's node count says nothing about it, because that depends on move ordering.

### The deal pool

To make the next deal instant, the deal service keeps a small in-memory pool of proven, graded deals for Draw 1, Draw 3
and Vegas, filled in the background.

- It holds at most 2 deals per grade for each mode, oldest first, and is never stored: a reload starts empty.
- A second, low-priority worker fills it for the mode chosen on Home only, one search at a time, always asking for the
  grade the pool holds fewest of. It keeps the selected deal and the other proven deals it graded along the way (the spares).
  The spares of a player's own live search are pooled too.
- A request with the switch on takes from the pool first: a deal of the requested grade, or the oldest of any grade for Any.
  A grade the pool does not hold is searched live and never served from another grade. A pooled deal appears at once,
  with no overlay.
- A `random` result is never pooled. Daily never uses the pool. Filling waits while a player's deal is being searched
  and while the page is hidden, and a failed background worker only stops the fill.
- A verdict cache (256 entries, least recently used) remembers what the searches learned about a seed, so a restarted
  search or a repeated Daily list is not searched twice. It changes how long a request takes and never which deal it selects.

## Sources

- Blake and Gent, _The Winnability of Klondike Solitaire and Many Other Patience Games_, JAIR 85 (2026),
  [arXiv:1906.12314](https://arxiv.org/abs/1906.12314)
- Bjarnason, Fern and Tadepalli, _Searching Solitaire in Real Time_, ICGA Journal (2007)
- Yan and Diaconis (2005), on the winnability of Klondike, as cited by Blake and Gent
- Pringle and Fish (2018), on FreeCell deals that cannot be won
- Solvitaire (solver benchmarks) and the Solitaired and playsolitaire.io win-rate figures, as reported by their publishers
- [Klondike (solitaire), Wikipedia](<https://en.wikipedia.org/wiki/Klondike_(solitaire)>) and
  [SolitaireCat scoring](https://www.solitairecat.com/articles/rules/solitaire-scoring/), for the scoring the rules page
  cites
- Solver implementations reviewed while designing the search: Two9A/solitaire-js, ruchira088/solitaire, sigoden/klondike,
  ShootMe/Klondike-Solver, and the background-pool approach of wmcmurray/klondike-solitaire
