# Spec Delta

## ADDED Requirements

### Requirement: Talon cards reachable by drawing

For any position, the system SHALL list the stock and waste cards that drawing can bring to the waste
top, with no other move in between: by drawing, and by recycling where the pass limit allows. The
cards SHALL be listed in the order in which they would first become the waste top, each once. The
current waste top SHALL come first, since it needs no draw. Drawing and recycling SHALL follow the game
rules (see game-engine "Drawing and recycling the stock"), so:
- **Draw 1 and Daily:** every stock and waste card is listed, because each becomes the waste top in
  turn and recycling is never limited;
- **Draw 3:** only the current waste top and the card each draw leaves on top are listed: first for
  the draws left in this pass, then for the draws after a recycle, which every later pass repeats
  unchanged;
- **Vegas:** as Draw 3, but only within the passes left. On its third pass, only the current waste top
  and the cards the draws left in the stock leave on top are listed.

With an empty stock and waste, nothing is listed.

Input-agnostic: a query over a position; the dead-end check and the searches use it.

Deterministic: the same position always yields the same cards in the same order.

*(KS-MOVE-03, KS-MOVE-04, KS-MOVE-05)*

#### Scenario: Draw 1 reaches every talon card

- **WHEN** a Draw 1 position with cards in both the stock and the waste is tested
- **THEN** every stock and waste card is listed once: the waste top first, then the stock from its
  top down, then the rest of the waste from its bottom up

#### Scenario: Draw 3 reaches only the cards each draw leaves on top

- **WHEN** a Draw 3 position with an empty waste and a stock of seven cards is tested
- **THEN** only the third, sixth and seventh cards counting from the stock top are listed, in that
  order, because recycling brings back the same groups of three

#### Scenario: Draw 3 part-way through a pass

- **WHEN** a Draw 3 position whose waste holds A below B, and whose stock holds C, D, E and F from its
  top down, is tested
- **THEN** B, E, F and C are listed in that order, and A and D are never listed

#### Scenario: Vegas on its last pass

- **WHEN** the same talon is tested in a Vegas position on its third pass
- **THEN** only B, E and F are listed, because no recycle is allowed

#### Scenario: A refused recycle leaves only the waste top

- **WHEN** a Vegas position on its third pass with an empty stock and a non-empty waste is tested
- **THEN** only the waste top is listed

#### Scenario: Nothing to draw

- **WHEN** a position with an empty stock and an empty waste is tested
- **THEN** no card is listed
