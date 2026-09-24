# Klondike Solitaire — Research & Game Knowledge Base

> **Role of this file.** The source of truth for *how the game works*: rules, terminology, deals, winnability, scoring, assistance features, UX conventions and the measured facts from the mockup. `specification.md` says **what the app must do**, `phased-design.md` says **how and in which order to build it**. When a rule here and a requirement there disagree, fix one of them. Don't silently pick one.
>
> Built from: the original report *Building a Solitaire (Klondike) Single-Page Application — A Complete Technical Research Report* (kept alongside this pack), a scoring check against Wikipedia and SolitaireCat (Sep 2026), and measurements taken while building `mockup/klondike-mockup.html`.

---

## 1. Terminology

| Term                        | Meaning                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Card**                    | One of 52. Suit ♥ ♦ ♣ ♠ (hearts and diamonds are red, clubs and spades black); rank A(1) … K(13).                    |
| **Tableau**                 | The 7 columns in the lower area. Cards are built **down in alternating colours**.                                    |
| **Face-down / face-up**     | Hidden cards in a tableau column vs. revealed cards. Only face-up cards can be moved.                                |
| **Run**                     | A sequence of face-up cards in one column that is correctly built down in alternating colours. It moves as one unit. |
| **Stock**                   | The face-down pile (24 cards after the deal) that the player draws from.                                             |
| **Waste**                   | The face-up pile that drawn cards land on. Only its top card is playable.                                            |
| **Foundation**              | Four piles, one per suit, built **up** from Ace to King.                                                             |
| **Draw 1 / Draw 3**         | How many cards a stock tap turns over. In Draw 3 only the top (third) card is playable.                              |
| **Pass / Redeal / Recycle** | Turning the whole waste back into the stock once the stock is empty. A *pass* is one trip through the stock.         |
| **Deal**                    | The initial arrangement of the 52 cards (a permutation).                                                             |
| **Winnable deal**           | A deal for which at least one winning move sequence exists when all cards are known ("thoughtful" solitaire).        |
| **Safe move**               | A move to a foundation that can never hurt the player's chances (see §6.2).                                          |
| **Auto-finish**             | Automatically playing every remaining card to the foundations once the game is effectively solved.                   |
| **Cascade**                 | The celebratory win animation of cards bouncing off the foundations.                                                 |

---

## 2. Rules

### 2.1 Setup
1. Shuffle the 52-card deck.
2. Deal 28 cards into 7 tableau columns, **row by row**: row *r* (0…6) puts one card on each column *c* ≥ *r*. Column *c* ends with *c + 1* cards. The **last card of each column is face-up**, the rest face-down.
3. The remaining 24 cards form the face-down **stock**. Waste and foundations start empty.

Deal order matters for reproducibility. With the deck array `d[0..51]`, the tableau receives `d[0..27]` in the row-by-row order above, and the stock is `d[28..51]` with the **last element on top** (drawn first).

### 2.2 Legal moves

| From → To                   | Rule                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Stock → Waste               | Draw 1 turns 1 card; Draw 3 turns up to 3 (fewer if fewer remain). Always legal while the stock has cards.                     |
| Waste (empty stock) → Stock | Recycle: reverse the waste back into the stock. Legal unless the scoring mode's pass limit has been reached (§5.2).            |
| Waste top → Tableau         | The card must be one rank lower and the opposite colour of the column's top card; **only a King** may go into an empty column. |
| Waste top → Foundation      | The card must be the next rank of its suit (an Ace starts an empty foundation).                                                |
| Tableau run → Tableau       | The run's **first** card follows the tableau rule above. Any face-up run may move, including a partial run.                    |
| Tableau top → Foundation    | A single card that is the next rank of its suit.                                                                               |
| Foundation top → Tableau    | Allowed (follows the tableau rule). Usually costs points (§5).                                                                 |
| Foundation → Foundation     | Not allowed (each suit has a fixed foundation).                                                                                |

After a move from a tableau column, **if its new top card is face-down, it flips face-up** automatically. In Windows scoring this is worth +5.

### 2.3 End of game
- **Win:** all 52 cards are on the foundations.
- **Dead end:** there is no productive move and cycling the stock can't make one (§6.4). Classic Klondike has no formal "loss"; the app reports the dead end and offers Undo or a new deal.

### 2.4 Variants chosen for this project
- **Foundations are suit-fixed slots**, displayed in the order ♥ ♣ ♦ ♠ so colours alternate. That display order is distinct from the suit encoding ♥ ♦ ♣ ♠ (0–3), which fixes card identifiers and foundation slot indices. A card's foundation is known, which makes tap-to-foundation unambiguous.
- **Draw 1 = unlimited passes** (standard scoring charges −100 per recycle). **Draw 3 = unlimited passes** (−20 per recycle from the 3rd recycle onward, i.e. after three free passes). **Vegas** caps passes (§5.2).
- Partial-run moves and foundation-to-tableau moves are allowed.

---

## 3. Shuffling, seeding and deal identity

### 3.1 Shuffle
Use **Fisher–Yates (Durstenfeld)**: for `i` from 51 down to 1, pick `j ∈ [0, i]` uniformly and swap `a[i]`, `a[j]`. It's unbiased (all 52! orders are equally likely) and O(n).

**Classic bug:** picking `j ∈ [0, i−1]` turns it into Sattolo's algorithm, which only produces single-cycle permutations. Unit-test this.

There's no known way to "shuffle for solvability". Winnability is checked **after** shuffling, by a solver (§4).

### 3.2 Randomness sources
- **Random deals:** seed from `crypto.getRandomValues(new Uint32Array(1))`, not `Math.random()`.
- **Reproducible deals:** use a small seeded PRNG. The mockup uses **mulberry32** (32-bit state, fast, good enough for card games; not cryptographic).

Using the PRNG with a random 32-bit seed for *every* deal makes every deal reproducible from its seed. That enables Restart, Replay and deal codes (§3.3). **This is the recommended approach.**

### 3.3 Deal codes (recommended)
The deal is fully determined by the **seed actually dealt** plus the **mode**. The solver only *chooses* which seed to deal, so replaying a code never needs the solver and never changes when the solver changes. Show it as `<mode>-<seed in base 36>`, for example `1-K7Q29XD` (mode `1`, `3`, `V` or `D`). This lets the player restart, replay and share a deal, and lets tests load fixed deals.

The mockup doesn't expose codes yet. It does use seeded deals internally for the Daily deal.

### 3.4 Daily deal
- One deal per calendar day, the same for everyone. The seed is derived from the date.
- The mockup uses the device's **local** date (`yyyymmdd`) and, for winnable-only mode, tries seeds `date·131 + attempt·7919` until the solver proves one winnable.
- Two consequences:
  1. Players in different time zones can be on different deals around midnight.
  2. The result depends on the "winnable only" setting and the solver version.
- **Recommendation:** roll over at **00:00 UTC**, *always* use winnable selection for the Daily deal whatever the setting, and version the selection algorithm. Optionally ship a precomputed table of verified daily seeds so solver changes never alter past dailies.

---

## 4. Winnability and the solver

### 4.1 Facts
- **81.945% ± 0.084%** of Draw 1 deals are winnable when all cards are known (Blake & Gent, *The Winnability of Klondike Solitaire and Many Other Patience Games*, JAIR vol. 85, 2026; arXiv:1906.12314). Earlier bounds were 82%–91.44% (Bjarnason, Fern & Tadepalli, ICGA Journal 2007). Yan & Diaconis (2005) called the open question "one of the embarrassments of applied probability".
- **Human win rates are far lower:** about 33% for Draw 1 and about 11% for Draw 3 (Solitaired). playsolitaire.io reports 37.0% over 138,759 Draw 1 starts. **Never present 82% as a player win rate.**
- About **1 deal in 5 is unwinnable**, so without a "winnable only" mode, roughly 18% of games frustrate players through no fault of their own.
- **FreeCell for comparison:** only 102,075 of 8,589,934,591 deals are impossible with 4 free cells (Pringle & Fish, 2018), and exactly one (#11982) of Microsoft's original 32,000.

### 4.2 Solver behaviour: fast median, heavy tail
- Solvitaire's Klondike median is about **0.02 s / ~3,000 nodes**, but the 99th percentile is about 906 s, with worst cases up to the 1-hour cap (HPC hardware).
- Bjarnason et al. solved over 80% of deals in under 4 s (2007 hardware) and cap their solver at 8 s.
- **Consequence:** always bound the browser solver (node and/or time budget) and treat **"unknown"** as a real result, separate from win and loss.

### 4.3 How real products get winnable deals
1. **Reject sampling:** shuffle → bounded solve → keep or reshuffle (Solitaired, Logify). Simplest.
2. **Background pool:** a Web Worker pre-generates verified deals so New game is instant (`wmcmurray/klondike-solitaire`).
3. **Pre-verified seed library or daily table** (playsolitaire.io daily; trysolitaire.com also shows a live winnability indicator).

### 4.4 The mockup's solver (a good baseline to port)
A **bounded depth-first search** over "thoughtful" Draw 1 states:
- **Talon as a set.** With Draw 1 and unlimited passes, every stock or waste card is eventually reachable, so stock + waste is treated as an unordered set. This removes stock-cycling from the search. **It isn't valid for Draw 3 or pass-limited Vegas.**
- **State:** each column as `(faceDownCount, cards[])`, the talon set, and 4 foundation heights.
- **Canonical key for the visited set:** foundation heights + **sorted** column strings (column order is symmetric) + sorted talon.
- **Safe moves before branching:** repeatedly move to a foundation any card with rank ≤ 2, or rank ≤ (lowest opposite-colour foundation + 1). Those moves never need undoing.
- **Move ordering (best first):**
  1. tableau → foundation
  2. talon → foundation
  3. a whole run that uncovers a face-down card
  4. talon → tableau
  5. a partial run whose uncovered card can go to a foundation
  6. a King run into an empty column (first empty column only)
  7. a whole run from a column with nothing hidden (to empty the column)
  8. foundation → tableau
- **Pruning:** skip moving a King that is already the base of a column; only use the first empty column.
- **Result:** `win` (a path was found), `loss` (search exhausted), `unknown` (node budget hit). It should also **return the winning move list**. The mockup doesn't yet; it's needed for hints and end-to-end tests.

### 4.5 Measured in the mockup (Node 22, 200 seeded deals, mulberry32 seeds 1–200)

| Node budget | Proven win | Proven loss | Unknown | Mean time per attempt | Median time, winning deals | 90th percentile, winning deals |
| ----------- | ---------- | ----------- | ------- | --------------------- | -------------------------- | ------------------------------ |
| 5,000       | 71%        | 0.5%        | 28.5%   | 55 ms                 | 1 ms                       | 20 ms                          |
| 15,000      | 76.5%      | 0.5%        | 23%     | 146 ms                | 1 ms                       | 108 ms                         |
| 60,000      | 81.5%      | 0.5%        | 18%     | 491 ms                | —                          | max 2.7 s                      |

- At 60,000 nodes the proven-win rate (81.5%) matches the literature's 82%. Most "unknown" deals are really unwinnable; they are just expensive to *prove*.
- With a 5,000 budget, a verified deal takes about 1.4 attempts, roughly 80 ms in total on a desktop.
- **Selection bias:** a small budget throws away hard-but-winnable deals, so "winnable only" skews slightly easier. To reduce this, use a larger budget in a Web Worker, a background pool, or pre-verified seeds.

### 4.6 Draw 3 winnability
The talon-as-a-set simplification doesn't hold, because the order of the stock and waste matters. A Draw 3 solver has to model the ordered stock, waste and pass counter; it's more expensive and needs a larger budget or a pre-verified pool. Other solvers: `Two9A/solitaire-js` (DFS, 1-byte cards, SHA-256 visited set, 50,000-move cap), `ruchira088/solitaire` (two-tier WIN/LOSS/unknown), `sigoden/klondike` (Rust→WASM A\*), `ShootMe/Klondike-Solver` (C++ IDA\*, 5M-state budget; it got 6 benchmark instances wrong, so **validate any adopted solver against known deals**).

---

## 5. Scoring

### 5.1 Standard (Microsoft Windows)

| Event                    | Points                                                    |
| ------------------------ | --------------------------------------------------------- |
| Waste → Tableau          | +5                                                        |
| Waste → Foundation       | +10                                                       |
| Tableau → Foundation     | +10                                                       |
| Turn over a tableau card | +5                                                        |
| Foundation → Tableau     | −15                                                       |
| Recycle waste, Draw 1    | −100 each time                                            |
| Recycle waste, Draw 3    | −20 each time from the 3rd recycle onward                 |
| Time                     | −2 every 10 s                                             |
| Time bonus on win        | `700,000 ÷ seconds`, only if the game took more than 30 s |

- The score never drops below 0.
- Draw 3 gets three free passes: four successive recycles score 0, 0, −20, −20.
- Theoretical maximum with the bonus is **24,078** (SolitaireCat). The original report's "~745" refers to move points without the bonus.
- **Undo:** not part of the original table. The mockup charges −2 per undo on top of restoring the previous score. **Decision for this project:** keep −2 per undo in Standard.
- Scoring quirk: waste → tableau → foundation earns 15 points, versus 10 for going straight to the foundation.

### 5.2 Vegas
- Start at **−$52** (a $1-per-card buy-in); **+$5 per card** played to a foundation, −$5 when a card leaves one. Break-even at 11 cards.
- **Pass limits:** Vegas draws three cards and allows 3 passes (2 recycles). This product has no one-card Vegas mode.
- **Cumulative** option: the bankroll carries across games (future).
- Many implementations restrict or disable Undo in Vegas. **Decision for this project:** Undo is allowed and simply restores the previous bankroll, with no extra fee. A "strict Vegas" toggle that disables Undo is a future option.

### 5.3 Other conventions
Timed and moves-based leaderboards (fewer moves or less time wins) and "no scoring" relaxed modes exist. Microsoft Solitaire Collection adds daily challenges, XP and themes.

---

## 6. Assistance features

### 6.1 Hints (heuristic priority used in the mockup)
1. Any tableau-top or waste-top card that can go to its foundation.
2. A whole face-up run whose move **reveals a face-down card**.
3. Waste top → tableau.
4. A partial run whose move frees a card that can then go to a foundation.
5. A King run into an empty column, but only if that reveals something.
6. Otherwise: "draw from stock" or "turn the waste over".
7. Otherwise: no moves; suggest Undo or New deal.

Heuristic hints can lead into dead ends. A better hint takes the first move of the solver's winning line from the current position, falling back to the heuristic when the solver returns unknown.

### 6.2 Safe auto-move rule
A card may go to its foundation automatically without ever hurting the player if its rank is **≤ 2**, or its rank is **≤ min(the two opposite-colour foundation heights) + 1**. Nothing could ever need it as a tableau parent, because both opposite-colour cards one rank below are already home.

### 6.3 Auto-finish
Safe to offer once **every tableau card is face-up**; the game is then trivially won. Auto-finish repeatedly plays the lowest-rank foundation-ready card, drawing and recycling the stock as needed. It is offered when such a plan completes under the ordinary rules; its draws and recycles are charged and pass-limited like the player's. Products also offer it earlier, when the solver proves a trivial win.

### 6.4 Dead-end detection (mockup approximation)
Report a dead end if **both** are true:
1. No productive tableau or waste move exists (as in §6.1, steps 1–5).
2. No stock or waste card could go anywhere, or the stock is empty and a recycle isn't allowed.

This check is approximate: it misses loops, and in Draw 3 it ignores that only every third card is reachable. A solver-backed check ("no winning line from here") is more precise but can be expensive.

### 6.5 Smart tap target choice (mockup)
1. If the grabbed unit is a single card and it fits its foundation, send it there (not when the card is already on a foundation).
2. Otherwise, pick the first **non-empty** tableau column it fits, scanning to the right of the source and wrapping around.
3. Otherwise, a King (not already a column base) goes to the first empty column, counting from column 0.
4. Otherwise, reject with a small shake.

---

## 7. Statistics conventions
Per mode: games played, games won, win rate, best time, best score (Vegas: best bankroll), current and best win streak.

- A game counts as **played** when the player makes the first move.
- Abandoning a started game (New deal or Home → new game) **breaks the streak**.
- The Daily deal additionally tracks completed days and the daily streak (future).

---

## 8. UX conventions from established products
- **Reference points:** Microsoft Solitaire Collection (35 million monthly players and more than 100 million hands a day, per Microsoft via The Verge, 22 May 2020) and MobilityWare-style mobile apps.
- **Standard features:** tap or drag to move; Draw 1/Draw 3; daily challenge; undo; auto-complete; customisable card backs and backgrounds; portrait and landscape; left- or right-hand layout; Standard or Vegas scoring; saved game.
- **Several ways to move cards:**
  - Drag-and-drop as the direct method.
  - **Tap-to-move** and **double-tap/double-click → foundation** as faster, accessible alternatives. Always keep a non-drag path.
  - Hit-test drops by the **card, not the fingertip**; the mockup uses the largest overlap between the dragged card and each candidate pile.
  - Use a **movement threshold** so small wobbles count as taps (mockup: 5 px mouse, 9 px touch; the report cites about 24 px slop and dnd-kit's touch delay of 500 ms / 5 px or mouse distance of 8 px).
  - Suppress the click event that follows a drag.
- **Desktop:** hover feedback, double-click, keyboard shortcuts (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z, plus draw, new game and hint keys).
- **Mobile:** large tappable cards, enough exposed height on overlapped cards, toolbar within thumb reach, option to put the stock on the right-hand side.
- **Feedback:** highlight legal targets while dragging; snap into place on a valid drop; animate back on an invalid drop; hint pulse; optional legal-move highlighting.
- **Animation:** deal, flip, move, drag pick-up and win cascade. Animate only `transform` and `opacity`. Honour `prefers-reduced-motion`.

---

## 9. Accessibility facts
- **WCAG 2.2 SC 2.5.8 Target Size (Minimum, AA):** at least 24×24 CSS px, or 24 px spacing. **SC 2.5.5 (AAA):** 44×44. Apple HIG: 44×44 pt. Material: 48×48 dp. **Target: 44×48 px effective touch area on phones.**
- Overlapped tableau cards are the hard case. At 390 px width the mockup's card is about 47 px wide and a face-up overlap strip is about 17 px tall. Mitigations:
  1. Tap-to-move on the whole column area.
  2. A larger overlap when the column is short.
  3. Selecting a card by keyboard or tapping the column.
- **Suits must be distinguishable without colour:** shapes are distinct, and there's an optional four-colour deck.
- **Screen reader labels** such as "King of Hearts" and "Face-down card", with **live announcements** of moves ("Seven of Clubs moved to column 4").
- **Keyboard:** Tab to piles and cards, Arrow keys between piles, Enter/Space to pick up or place, Escape to cancel.
- Honour `prefers-reduced-motion`; keep contrast at or above 4.5:1 for text.

---

## 10. Layout geometry (from the mockup; works phone to desktop)
- **Card aspect ratio:** height = 1.4 × width (real cards are 2.5 × 3.5 in).
- **Board:** 7 equal columns with gap `g` = clamp(4 px, 1.6% of width, 14 px); padding clamp(8 px, 2.2% of width, 18 px).
- **Card width** = `min((innerWidth − 6g) / 7, 104 px, innerHeight / (1.4 × 3.1))`, and at least 30 px.
- **Top row:** stock, waste, an empty slot, then 4 foundations. When "stock on the right" is on, it's mirrored: foundations on the left, waste fans to the left.
- **Tableau** starts below the top row, separated by `max(1.4g, 10 px)`.
- **Vertical offsets:** 0.11 × card height for face-down cards and 0.27 × card height for face-up cards (0.30 on touch screens, so the finger strip is thicker). If a column would run past the bottom, **squeeze the face-down cards first**, down to a 0.04 × card-height sliver, since they're never tapped. Only then squeeze the face-up strips.
- **Small boards** (under 520 px wide): padding 4 px and column gap 3 px, so every pixel goes to the cards.
- **Draw 3 waste** fans the top 3 cards horizontally by 0.24 × card width.
- **Positioning:** every card is **absolutely positioned** with `transform: translate(x, y)`, one element per card that lives for the whole game. Moving a card is just a new transform, so CSS transitions give free move animations and undo "rewinds" visually.
- **Depth:** a stock or foundation of 24 stacked cards compounds drop shadows into a dark halo. **Only the top card of a pile casts a shadow.**

---

## 11. Reference implementations
- **`paultranvan/solitaire`** (AGPL-3.0) is the strongest reference: React 18 + TypeScript + Vite 7, dnd-kit, Motion (`layoutId`) animation, Zustand + immer, `idb-keyval` resume, Web Audio sound effects, a **Web Worker bounded solver**, Capacitor 8, English/French, Vitest, and a dependency-free `game/` module.
- **Other React/TypeScript examples:**
  - `trisDeveloper/solitaire` (Next.js; uses react-beautiful-dnd, which is **deprecated**)
  - `devatrox/Solitaire` (SVG cards, no touch)
  - `pl12133/react-solitaire` (Redux, undo/redo, tap-to-auto-move)
  - `gcedo/react-solitaire`
  - a Spider Solitaire built with React + TypeScript + Vite + Tailwind
- **Minesweeper analogues**, such as `alanrsoares/ts-mines` and the author's own `sanyokkua/minesweeper`, share the same skeleton: pure TypeScript logic, React UI, Vite, a PWA and static hosting.
- **Main differences from Minesweeper:**
  1. Solitaire's core interaction is dragging *stacks*.
  2. It needs a solver for winnable deals.
  3. It needs much more animation (deal, flip, cascade).

---

## 12. Lessons learned while building the mockup
*(Items are cited as R§12.n.)*

1. **Pure engine first.** The solver and rules were written and benchmarked as plain functions before any UI; this caught the budget and latency trade-off early (§4.5).
2. **One DOM element per card**, positioned by transform, is simple and animates for free. Re-render by recomputing positions from state; never re-create card elements.
3. **Don't give the deal animation a transition from `(0,0)`.** Park all cards on the stock with transitions off, force a reflow, then enable transitions with a per-card stagger delay. Ignore resize events that don't actually change the board size, or a resize during the deal kills the animation.
4. **`display:flex` overrides the `hidden` attribute.** Always add `[hidden]{display:none!important}`.
5. **Stacking contexts:** the cascade used card z-indexes of 2000+ and flew *over* the win dialog. Give the board container `isolation: isolate`.
6. **Compounded shadows** on deep piles (§10).
7. **Only show the "shuffling…" overlay** if verification takes longer than about 160 ms; most deals are verified in a few milliseconds.
8. **Undo by snapshots** (serialised state before each move) is trivial and cheap: about 1 KB per snapshot, capped at 400.
9. **Themes:** in dark mode, near-white cards glare. Dim the card faces (#D2DDE5) by default and offer a "night cards" variant (navy faces, light ink, pale card backs).

---

## 13. Target screens (device matrix)

### 13.1 Viewports
CSS viewport = the size the web page sees. **Browser height** is lower than the screen because of the browser's own bars; the figures below subtract about 188 px (iOS Safari, portrait), 52 px (iOS, landscape), 130 px (Android Chrome, portrait) and 80 px (Android, landscape). These are approximations for testing. **Installed app** height is the full screen (the app still respects safe areas such as the notch and the home indicator).

| Device                                                          | Screen px        | CSS viewport (portrait)                                      | Source / status                                                                             |
| --------------------------------------------------------------- | ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| iPhone 14 Pro                                                   | 1179×2556        | 393×852, DPR 3                                               | Published tables                                                                            |
| iPhone 14 Pro Max                                               | 1290×2796        | 430×932, DPR 3                                               | Published tables                                                                            |
| iPhone 17 Pro                                                   | 1206×2622        | 402×874, DPR 3                                               | Published tables                                                                            |
| iPhone 17 Pro Max                                               | 1320×2868        | 440×956, DPR 3                                               | Published tables                                                                            |
| Galaxy S25                                                      | 1080×2340        | 360×780, DPR 3                                               | Published tables                                                                            |
| Galaxy S25+ / S25 Ultra                                         | 1440×3120 (QHD+) | **384×832** at the default FHD+ setting; **412×891** at QHD+ | Tables disagree because Samsung's screen-resolution setting changes the viewport; test both |
| iPhone Duo, outer (5.4")                                        | 1398×2034        | ≈ 466×678 (estimated, DPR 3)                                 | Announced by Apple in Sep 2026 (pixel sizes via MacRumors); available 23 Oct 2026           |
| iPhone Duo, inner (7.6", opens landscape, same aspect as outer) | 2670×1878        | ≈ 890×626 landscape (estimated)                              | As above                                                                                    |
| Galaxy Z Fold 8, cover (5.5", 10:16)                            | 1248×1972        | ≈ 416×657 (estimated, DPR 3)                                 | Released 7 Aug 2026                                                                         |
| Galaxy Z Fold 8, main (7.6", 4:3)                               | 2448×1848        | ≈ 816×616 landscape (estimated)                              | As above                                                                                    |
| Galaxy Z Fold 8 Ultra, cover (6.5", 21:9)                       | 1080×2520        | ≈ 360×840 (estimated)                                        | As above                                                                                    |
| Galaxy Z Fold 8 Ultra, main (8.0", 10:9)                        | 2504×2256        | ≈ 835×752 (estimated)                                        | As above                                                                                    |

*Estimated* viewports assume a device pixel ratio of 3. Check them on a real device (`window.innerWidth/innerHeight`) and update this table.

### 13.2 What the mockup proved (automated fit check)
All 13 screens were checked in portrait and landscape, in the browser and as an installed app: 52 configurations. Each loaded the Home screen, then a Game with a **worst-case column** (6 face-down + a 13-card K→A run). Results with the final layout rules:
- **0 failures:**
  - the Game screen never scrolls;
  - no card goes outside the table;
  - "Deal cards" is visible on Home without scrolling;
  - the toolbar is always on screen.
- **Card width:** 43–53 px on phones in portrait; 55–71 px on phones in landscape (wide table); 54–89 px on foldable inner screens; 37–56 px on foldable cover screens.
- **Finger strip on the worst-case column:**
  - 18–22 px on phones in portrait; 14–19 px on foldable cover screens (14 px on the shortest, the iPhone Duo outer screen in the browser at 490 px tall);
  - 18–30 px on foldable inner screens;
  - 16–22 px on iPhones in landscape.
  - Only the shortest Android browser landscape views (280–332 px tall) drop to 11–14 px, a physical limit at that height.
  - Normal columns (7 or fewer face-up cards) get much thicker strips than these.

### 13.3 Layout profiles that made it fit
1. **Stacked** (portrait phones, foldables, desktop): top bar, HUD, table, toolbar; stock and foundations in the table's top row.
2. **Side rails** (landscape with height ≤ 720 px): the top bar and hint line disappear; HUD becomes a vertical left rail (back, settings, score, moves, new deal, time), the toolbar a vertical right rail, and the table takes the middle.
3. **Wide table** (chosen per board): stock and waste in a left column, the four foundations stacked in a right column (they may overlap slightly), and the tableau using the full height. It's chosen when it gives the worst-case column a thicker face-up strip and the stacked layout would drop below 14 px (touch) or 9 px (mouse). In practice it switches on for landscape phones and the shortest portrait views, never on desktops.
4. **Home on phones:** a compact hero, shorter mode tiles, and a sticky bottom bar holding **Deal cards / Continue / How to play**, so the main action is always visible.

## 14. Caveats
- Winnability figures assume "thoughtful" play with all cards known; they aren't achievable human win rates.
- Solver timings in the literature come from HPC or server hardware; only the *shape* (fast median, heavy tail) carries over to browsers.
- Several commercial "win rate" figures are vendor estimates. The rigorous numbers are Blake & Gent for Klondike and Pringle & Fish for FreeCell.
- Microsoft's player numbers (2020) come from Microsoft and aren't independently audited.
- Free hosting terms change (GitHub Pages forbids commercial use; Cloudflare Pages is being folded into Workers). Re-check before relying on them.

## Sources
- Blake & Gent, *The Winnability of Klondike Solitaire and Many Other Patience Games*, JAIR 85 (2026); arXiv:1906.12314
- Bjarnason, Fern & Tadepalli, *Searching Solitaire in Real Time*, ICGA Journal (2007)
- [Klondike (solitaire) — Wikipedia](https://en.wikipedia.org/wiki/Klondike_(solitaire)) (Windows scoring table, time bonus)
- [How does Solitaire scoring work? — SolitaireCat](https://www.solitairecat.com/articles/rules/solitaire-scoring/) (Draw 3 recycle −20 after the 3rd pass, maximum 24,078)
- WCAG 2.2 Understanding SC 2.5.8 / 2.5.5; Apple Human Interface Guidelines; Material Design touch targets
- The Verge (Tom Warren, 22 May 2020): Microsoft Solitaire player figures
- Repositories: paultranvan/solitaire, Two9A/solitaire-js, ruchira088/solitaire, wmcmurray/klondike-solitaire, sigoden/klondike, ShootMe/Klondike-Solver, sanyokkua/minesweeper
- Original report: `Building a Solitaire (Klondike) Single-Page Application. A Complete Technical Research Report.md`
