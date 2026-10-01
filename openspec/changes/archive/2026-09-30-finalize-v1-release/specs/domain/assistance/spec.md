# Spec Delta

## MODIFIED Requirements

### Requirement: Dead-end detection

A won position SHALL never be a dead end. Any other position SHALL be a dead end exactly when:

1. no move at any of the five hint priorities exists; **and**
2. no stock or waste card that drawing can reach (see move-rules "Talon cards reachable by drawing")
   could be played anywhere.

A card "could be played" when, in the position as it stands, some foundation or tableau column would
accept it as a single card. Only reachable cards count:
- in Draw 3, a card that the three-card grouping never brings to the waste top cannot help;
- in Vegas, neither can a card that only a recycle beyond the pass limit would reach.

In Draw 1 and Daily every stock and waste card is reachable, so their dead ends are the same as before
reachability was considered.

Input-agnostic: a predicate; the dead-end notice itself belongs to ui/notices.

Deterministic: the same position always yields the same verdict.

*(KS-AST-06)*

#### Scenario: A won game is not a dead end

- **WHEN** a won position is tested
- **THEN** it is not a dead end, even though no move and no stock or waste card remains

#### Scenario: A productive move prevents a dead end

- **WHEN** any move at one of the five priorities exists
- **THEN** the position is not a dead end

#### Scenario: A reachable stock card prevents a dead end

- **WHEN** no move exists but a stock or waste card that drawing can reach could be played somewhere
- **THEN** the position is not a dead end

#### Scenario: Draw 1 reaches every card

- **WHEN** a Draw 1 position with no productive move holds a card that could be played anywhere in its
  stock or waste
- **THEN** the position is not a dead end

#### Scenario: A move only an empty column accepts is still a move

- **WHEN** a position with an exhausted stock and recycling refused has a King on the waste top and
  an empty column, and nothing else can be played
- **THEN** the position is not a dead end

#### Scenario: A card the three-card grouping never reaches cannot help

- **WHEN** a Draw 3 position with no productive move has an empty waste and a stock of three cards
  whose only playable card is the stock's top card, which each draw turns first and covers with the
  other two
- **THEN** it is a dead end, although the stock holds a card that could be played

#### Scenario: The pass limit can create a dead end

- **WHEN** a Vegas position with no productive move has an exhausted stock and a waste in which one
  more recycle would bring a playable card to the waste top, tested on its second pass and again on
  its third
- **THEN** it is not a dead end on the second pass and is a dead end on the third

### Requirement: One advice for a position

The domain SHALL offer one advice function for a position that returns exactly one of: a dead end,
a productive move hint (with its source cards, target and priority), a draw, or a recycle. It SHALL
return the dead end exactly when dead-end detection reports one, so a position is never both a
dead end and given a draw or recycle hint. Otherwise it SHALL return the hint that "Hint priority"
gives: the advice adds the dead-end check in front of the hint, and changes neither the hint's
priority order nor the dead-end rule. It SHALL be pure and deterministic: the same position gives the
same advice. A won position has no advice.

Input-agnostic: a query over a position; the hint is requested through the Hint toolbar button or
the H shortcut.

*(KS-AST-02, KS-AST-06)*

#### Scenario: Dead end wins over draw
- **WHEN** the stock holds cards but none that drawing can reach can be played anywhere, and no
  tableau move is productive
- **THEN** the advice is a dead end, not a draw

#### Scenario: Dead end wins over a Draw 3 draw
- **WHEN** a Draw 3 stock holds a playable card that the three-card grouping never brings to the waste
  top, and nothing else can be played
- **THEN** the advice is a dead end, although the hint alone would suggest a draw

#### Scenario: Productive move
- **WHEN** a card can go to its foundation
- **THEN** the advice is that move with priority 1

#### Scenario: Draw is useful
- **WHEN** no tableau move exists but a card that drawing can reach can be played
- **THEN** the advice is to draw

#### Scenario: Determinism
- **WHEN** the advice of the same position is computed twice
- **THEN** the results are equal

## ADDED Requirements

### Requirement: Hint candidates in priority order

For a game that is not won, the system SHALL list every productive move: every move at one of the
five hint priorities (see "Hint priority"). The list SHALL be ordered:
1. by priority, highest first;
2. within one priority, by source in the canonical source order (see move-rules "Canonical scan
   order");
3. for one source, by destination in the canonical destination order.

Each move SHALL be listed once, at the highest priority that produces it. Draws and recycles are not
candidates. The first candidate SHALL always be the move that "Hint priority" suggests. With no
candidate, the hint falls back to the stock as "Hint priority" states. A won game SHALL have no
candidates.

The list SHALL depend only on what the player can see: the face-up tableau cards, which places hold
face-down cards (not which cards they are), the waste top and the foundation heights. Exchanging
face-down tableau cards and stock cards among themselves, with every pile size and every face-up card
unchanged, SHALL NOT change the list.

Input-agnostic: a query over a position; grading's playouts choose from it.

Deterministic: the same position always yields the same candidates in the same order.

*(KS-AST-02, KS-DEAL-11 (new))*

#### Scenario: The first candidate is the hint

- **WHEN** the candidates of any position that is not won and has a productive move are listed
- **THEN** the first candidate is the move the hint suggests, with the same priority

#### Scenario: Every productive move is listed in order

- **WHEN** a position offers a column top its foundation is ready for, two columns that accept the
  waste top, and a whole run that would reveal a face-down card onto a non-empty column
- **THEN** the list holds the foundation move first, then the revealing run, then the waste top onto
  the lower-numbered column, then onto the higher-numbered one

#### Scenario: Hidden cards do not change the list

- **WHEN** two positions differ only by exchanging face-down tableau cards and stock cards among
  themselves
- **THEN** their candidate lists are equal

#### Scenario: No candidates without a productive move

- **WHEN** a position has no move at any of the five priorities, or is won
- **THEN** the list is empty
