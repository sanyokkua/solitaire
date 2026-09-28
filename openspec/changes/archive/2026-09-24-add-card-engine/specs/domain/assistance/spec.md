# Spec Delta

## Purpose

The decisions behind the game's help: which move to suggest, which cards are safe to send home
automatically, how to finish a game, when no productive move remains, and where a tapped card goes.

## ADDED Requirements

### Requirement: Safe foundation moves

A card SHALL be safe exactly when its foundation is ready for it (it is the next rank of its suit)
and either its rank is 2 or lower, or its rank is at most one above the smaller of the two
opposite-colour foundations' heights. The system SHALL return the first safe card among the sources
in the canonical source order (see move-rules "Canonical scan order") as a system-initiated send, or
report none. Cards already on a foundation are never candidates. Input-agnostic: system-initiated.
Deterministic: the same position always yields the same next safe move. *(KS-AST-04)*

#### Scenario: Low ranks are always safe

- **WHEN** an Ace or a Two whose foundation is ready is tested
- **THEN** it is safe

#### Scenario: Higher ranks depend on the opposite colours

- **WHEN** a red Five is tested while the two black foundations hold four and five cards, and again
  while one of them holds three
- **THEN** it is safe in the first case and not in the second

#### Scenario: No safe move is reported as none

- **WHEN** no card in the position is safe
- **THEN** the system reports that there is no safe move rather than proposing one

### Requirement: Hint priority

For a game that is not won, the system SHALL suggest the first applicable move by priority:

1. a tableau top or the waste top onto its foundation;
2. a whole face-up run that would reveal a face-down card, onto a **non-empty** column;
3. the waste top onto a tableau column (empty columns included);
4. a partial run onto a tableau column (empty columns included) that would expose a card its
   foundation is ready for;
5. a King run into an empty column that would reveal a face-down card.

Failing these, it SHALL suggest a draw while the stock holds cards, or a recycle when the stock is
empty and recycling is permitted; failing that, it SHALL report that no move remains. A won game SHALL
receive no suggestion. Ties within a priority SHALL resolve by the canonical scan order (see
move-rules "Canonical scan order"): the first source, then its first accepting destination. A
suggestion SHALL identify the command, the cards it moves and the priority that produced it.
Input-agnostic: how a hint is requested belongs to a later phase. Deterministic: the same position
always yields the same suggestion. *(KS-AST-02)*

#### Scenario: Higher priorities win

- **WHEN** a position offers moves at several priorities at once
- **THEN** the suggestion is the one from the highest applicable priority

#### Scenario: Each priority is suggested in its own right

- **WHEN** a position offers a move at exactly one of the five move priorities
- **THEN** that move is suggested

#### Scenario: A King run only moves to an empty column when it reveals something

- **WHEN** a King run in a tableau column could move to an empty column but moving it would reveal
  nothing
- **THEN** that move is not suggested

#### Scenario: A whole run reaching only an empty column falls to the King priority

- **WHEN** a position offers a whole run whose only accepting destination is an empty column and
  whose move would reveal a face-down card
- **THEN** it is not suggested at priority two, and it is suggested at priority five

#### Scenario: A King on the waste may be sent to an empty column

- **WHEN** the waste top is a King, an empty column is available, no non-empty column accepts it
  and no higher priority applies
- **THEN** moving it into the empty column is suggested at priority three

#### Scenario: Falling back to the stock

- **WHEN** no move at any of the five priorities exists
- **THEN** drawing is suggested while the stock holds cards, and turning the waste back over is
  suggested when the stock is exhausted and recycling is permitted

#### Scenario: Nothing left to suggest

- **WHEN** no move and no stock action remains
- **THEN** the system reports that no move remains

### Requirement: Dead-end detection

A won position SHALL never be a dead end. Any other position SHALL be a dead end exactly when:

1. no move at any of the five hint priorities exists; **and**
2. either no stock or waste card could be played anywhere, or the stock is empty and recycling is
   not permitted.

A card "could be played" when, in the position as it stands, some foundation or tableau column would
accept it as a single card. Input-agnostic: a predicate; the notice belongs to a later phase.
Deterministic: the same position always yields the same verdict. *(KS-AST-06)*

#### Scenario: A won game is not a dead end

- **WHEN** a won position is tested
- **THEN** it is not a dead end, even though no move and no stock or waste card remains

#### Scenario: A productive move prevents a dead end

- **WHEN** any move at one of the five priorities exists
- **THEN** the position is not a dead end

#### Scenario: A reachable stock card prevents a dead end

- **WHEN** no move exists but a card in the stock or waste could be played somewhere
- **THEN** the position is not a dead end

#### Scenario: A move only an empty column accepts is still a move

- **WHEN** a position with an exhausted stock and recycling refused has a King on the waste top and
  an empty column, and nothing else can be played
- **THEN** the position is not a dead end

#### Scenario: The pass limit can create a dead end

- **WHEN** a position with no productive move has an exhausted stock and a non-empty waste holding a
  card that could be played, under rules that permit recycling and again under rules that do not
- **THEN** it is a dead end only under the rules that do not permit recycling

### Requirement: Smart tap target

For a grabbed group, the system SHALL choose the first of:

1. its foundation, when the group is a single card that fits there and did not come from a
   foundation;
2. the first **non-empty** tableau column that accepts it, scanning from the column right of the
   source column and wrapping around, never the source column; a group from the waste or a
   foundation scans from column 0;
3. the first empty column counting from column 0, when the group's lowest card is a King that is
   not already at the base of its column;

and otherwise SHALL report no target. The relative scan of step 2 deliberately replaces the
canonical destination order; step 3 does not use it. Input-agnostic: the shared resolution behind the smart-move tap, the double-activation
shortcut and the keyboard equivalent, each implemented and tested in a later phase. Deterministic:
the same position and grab always yield the same target. *(KS-INP-01, KS-INP-03)*

#### Scenario: A single card prefers its foundation

- **WHEN** a single card that fits its foundation is grabbed from the waste or a tableau column
- **THEN** the foundation is chosen

#### Scenario: A card already home does not return to its foundation

- **WHEN** a card is grabbed from a foundation
- **THEN** the foundation is not chosen and the tableau rules decide instead

#### Scenario: A group never targets a foundation

- **WHEN** a group of more than one card is grabbed
- **THEN** no foundation is chosen

#### Scenario: Scanning wraps around from the source

- **WHEN** the only accepting non-empty column lies to the left of the source column
- **THEN** the scan wraps around and chooses it, and the source column is never chosen

#### Scenario: A group from the waste scans from the first column

- **WHEN** the waste top is grabbed and two columns would accept it
- **THEN** the lower-numbered column is chosen

#### Scenario: A King fills an empty column last

- **WHEN** a King that is not already at the base of its column is grabbed and no non-empty column
  accepts it
- **THEN** the first empty column is chosen; a King already at the base of its column is not moved
  to an empty column

#### Scenario: An empty column is chosen from column 0

- **WHEN** a King that is not at the base of its column in column 5 is grabbed, no non-empty column
  accepts it, and columns 2 and 6 are empty
- **THEN** column 2 is chosen

#### Scenario: No target is reported as none

- **WHEN** nothing accepts the grabbed group
- **THEN** the system reports that there is no target

### Requirement: Finish plan

For a position that is not won and has every tableau card face up, the system SHALL build a finish
plan by repeating, from that position:

1. if any tableau top or the waste top is ready for its foundation, send the lowest-ranked such card
   (ties by canonical source order — see move-rules "Canonical scan order") with a system-initiated
   send;
2. otherwise, if the stock holds cards, apply an ordinary draw;
3. otherwise, apply an ordinary recycle.

Every step SHALL go through the engine, so draws and recycles are scored, counted as moves and
pass-limited exactly as the player's, and foundation sends are uncounted. The plan SHALL consist of
the settled won position, its events and the ordered command sequence. The system SHALL report no
plan when a step is refused, or when the exhausted stock would have to be recycled a second time
with no card sent since the first recycle — the stock then holds every remaining card, so the pass
between the two recycles has shown every waste top that any later pass could show. Finishing SHALL be
available exactly when a plan exists. Input-agnostic: system-driven; its control belongs to a later
phase. Deterministic: the same position always yields the same plan. *(KS-AST-05)*

#### Scenario: Finishing needs every card face up

- **WHEN** a position with any face-down tableau card is tested, and again when every tableau card
  is face up, cards remain and the stock can be cycled far enough to reach them
- **THEN** finishing is unavailable in the first case and available in the second

#### Scenario: A finished game is won

- **WHEN** a finish plan is produced and its settled position is examined
- **THEN** the status is won and every foundation holds 13 cards

#### Scenario: The plan's moves are legal on their own

- **WHEN** the plan's sequence of moves is replayed from the original position
- **THEN** every move is accepted and the same won position is reached

#### Scenario: A finish that must recycle is scored like any other play

- **WHEN** a plan for a Standard three-card game reaches a buried card by recycling
- **THEN** the settled position carries the recycle penalty the same recycle would have cost the
  player, and its pass count has advanced

#### Scenario: A finish counts its draws but not its foundation sends

- **WHEN** a plan that draws and recycles before sending its cards home is settled
- **THEN** the move count has grown by the number of draws and recycles alone, and not by the cards
  sent to the foundations

#### Scenario: A plan starting part-way through a pass is not abandoned early

- **WHEN** every tableau card is face up, the stock is part-way through a pass, no card left in the
  stock can be played, and the next playable card lies below the top of the waste, so it can be
  reached only by recycling
- **THEN** the plan draws out the stock, recycles, reaches and plays that card, and reaches a won
  position

#### Scenario: A finish that cannot be completed is not offered

- **WHEN** every tableau card is face up in a game at its pass limit whose remaining cards can only
  be reached by another recycle
- **THEN** no plan is reported and finishing is unavailable
