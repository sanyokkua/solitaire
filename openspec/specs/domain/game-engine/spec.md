# game-engine Specification

## Purpose

The single entry point through which a game changes: it validates a command, applies it, reports
events and folds in the move score.

## Requirements

### Requirement: Commands are the only way a game changes

A game SHALL change only by applying one of exactly three commands: draw from the stock; move a group
from one pile to another; and a system-initiated send of a tableau column's or the waste's top card
to its foundation. A system-initiated send SHALL be accepted only where the same move by the player
would be, and SHALL be refused from any other pile. Applying a command SHALL return the resulting
position and an ordered list of events, SHALL NOT modify the position given, and SHALL NOT throw.
Input-agnostic: tap, drag and keyboard compose the same commands. Deterministic: the same position
and command always yield the same result and events. *(KS-MOVE-01)*

#### Scenario: Applying a command leaves the original position untouched

- **WHEN** any command is applied to a position
- **THEN** the position that was given is unchanged in every field, whether the command was
  accepted or refused

#### Scenario: A system-initiated send is refused from any other pile

- **WHEN** a system-initiated send names the stock or a foundation as its source
- **THEN** the command is refused and the position is the one that was supplied

#### Scenario: Events describe what happened

- **WHEN** a command is accepted
- **THEN** the returned events name the cards that moved, the piles they moved between, any card
  turned face up, the number of cards drawn, or the pass a recycle began, as applicable

### Requirement: Rejected commands change nothing

A command the rules do not permit SHALL be refused with exactly one rejection event carrying one of
exactly five reasons: the game is already won; the named cards cannot be picked up; the destination
will not accept them; the pass limit forbids a recycle; there is nothing to draw or recycle. A
refused command SHALL return the very position supplied (same reference), so a refusal is
distinguishable from an accepted command without comparing fields. Once a game is won, every command
SHALL be refused. Input-agnostic: applies to every command. Deterministic: the same refused command
always yields the same reason. *(KS-MOVE-01, KS-MOVE-05, KS-INP-09)*

#### Scenario: An illegal placement is refused

- **WHEN** a group is moved to a pile that the rules do not permit
- **THEN** the command is refused with a reason, and the position is the one that was supplied

#### Scenario: Refusal is distinguishable from a no-op

- **WHEN** a command is refused
- **THEN** the caller can tell from the returned value that nothing was applied, without comparing
  fields

#### Scenario: A won game accepts nothing further

- **WHEN** any command is applied to a won game
- **THEN** it is refused with the reason that the game is over

#### Scenario: Reasons come from a fixed set

- **WHEN** each kind of refusal occurs
- **THEN** the reason reported is one of the defined reasons and is not a sentence intended for
  direct display

### Requirement: A move turns over an exposed card and detects the win

When an accepted move or system-initiated send leaves a tableau column whose new top card is face
down, that card SHALL be turned face up in the same command and reported as its own turn event. When
an accepted command places the 52nd card on the foundations, the status SHALL become won and a win
event SHALL be reported. Events of one command SHALL be ordered: move event, then turn event (if
any), then win event (if any); a draw reports one draw event and a recycle one recycle event.
Input-agnostic: applies to every accepted command. Deterministic: the same position and command
always yield the same events in the same order. *(KS-MOVE-02, KS-MOVE-07)*

#### Scenario: The exposed card turns over with the move

- **WHEN** a move leaves a face-down card at the top of its column
- **THEN** that card is face up in the resulting position and a turn event accompanies the move
  event

#### Scenario: The final card wins the game

- **WHEN** the last card is placed on a foundation
- **THEN** the resulting position's status is won and a win event is reported

#### Scenario: A system-initiated send turns over and wins like a move

- **WHEN** a system-initiated send leaves a face-down card at the top of its column, and again when
  a system-initiated send places the last card on a foundation
- **THEN** the exposed card is turned face up with its own turn event in the first case, and the
  status is won with a win event in the second

#### Scenario: Events are reported in a fixed order

- **WHEN** a move exposes a face-down card, and again when a move places the last card
- **THEN** the events are the move event followed by the turn event in the first case, and the move
  event followed by the win event in the second

### Requirement: Drawing and recycling the stock

When the stock holds cards, a draw SHALL move the mode's draw count — or all remaining cards if fewer
— onto the waste one at a time from the top of the stock, so the last card moved is the waste top,
and SHALL report the number moved. When the stock is empty and the waste is not, a draw SHALL recycle
when "Stock passes and recycling" permits it: the waste becomes the stock in reverse order (the most
recently drawn card becomes the last to be drawn again), the pass count increases by one, and the
pass begun is reported. A recycle the pass limit forbids SHALL be refused with the pass-limit reason.
A draw with both piles empty SHALL be refused with the nothing-to-draw reason. Input-agnostic: every
input path issues the same draw command. Deterministic: the same position always yields the same
draw or recycle. *(KS-MOVE-03, KS-MOVE-04, KS-MOVE-05)*

#### Scenario: A draw turns the mode's count

- **WHEN** the stock is activated in a one-card mode and in a three-card mode
- **THEN** one card and three cards respectively are turned onto the waste, and the count is
  reported

#### Scenario: A short stock turns what remains

- **WHEN** the stock holds fewer cards than the mode's draw count
- **THEN** every remaining card is turned and the reported count is the number actually turned

#### Scenario: A recycle reverses the waste and begins a pass

- **WHEN** an exhausted stock is activated with a non-empty waste and the pass limit allows
- **THEN** the waste becomes the stock in reverse order, the pass count increases by one, and the
  pass that was begun is reported

#### Scenario: A recycle beyond the limit is refused

- **WHEN** a Vegas game on its third pass activates its exhausted stock
- **THEN** the command is refused with the pass-limit reason and the position is unchanged

#### Scenario: An empty stock and waste is refused

- **WHEN** the stock and the waste are both empty and the stock is activated
- **THEN** the command is refused

### Requirement: Move count, start flag and clock are engine-owned or engine-untouched

The move count SHALL increase by one for each accepted player move and each accepted draw or recycle,
and SHALL NOT change for a system-initiated send. The game SHALL be marked started on its first
accepted command. No command SHALL change the elapsed time, the undo charges, seed, mode, draw count,
scoring rules or deal provenance. Input-agnostic: applies to every command. Deterministic: the same
command sequence always yields the same move count. *(KS-SCO-05, KS-STA-01, KS-SCO-03)*

#### Scenario: System-initiated foundation moves are not counted

- **WHEN** a card is sent to a foundation on the system's own initiative
- **THEN** the move count is unchanged

#### Scenario: The first accepted command starts the game

- **WHEN** the first command of a fresh deal is accepted
- **THEN** the game is marked started, and a command refused before it leaves the game unstarted

#### Scenario: The engine never moves the clock

- **WHEN** any sequence of commands is applied
- **THEN** the elapsed time, undo charges, seed, mode, draw count, scoring rules and deal provenance
  are unchanged throughout

### Requirement: A complete game can be played through commands alone

A dealt position SHALL be playable to a won status entirely through applied commands. Input-agnostic:
commands only. Deterministic: replaying the same recorded command sequence against the same deal
always reaches the same won position. *(KS-MOVE-07, KS-DEAL-01)*

#### Scenario: A recorded line wins its deal

- **WHEN** a recorded sequence of commands is replayed against the deal it was recorded for
- **THEN** no command is refused, the final status is won, every foundation holds 13 cards, and the
  final move count, score and pass count match the recorded values

### Requirement: A game state can be checked for validity

The system SHALL provide a check that accepts a game state only if all of these hold:
- the 52 card identifiers each appear exactly once across stock, waste, foundations and tableau;
- each foundation holds cards of its own suit in ascending rank order starting from the ace;
- no face-down card lies above a face-up card in any column;
- mode, draw count and scoring rules agree with each other as the mode defines;
- the seed is an unsigned 32-bit integer, the verdict and status are known values, and the move
  count, pass count, attempt count, elapsed time and undo charges are finite non-negative integers,
  with the pass count at least 1;
- the status is won exactly when all 52 cards are on the foundations.

The check SHALL never throw, whatever value it is given.

Input-agnostic: a predicate over stored data. Deterministic: the same value always gets the same
answer.

*(KS-PER-03)*

#### Scenario: Every dealt and played position is valid

- **WHEN** fixture deals in every mode and every position of the fixture winning line are checked
- **THEN** each is accepted

#### Scenario: A duplicated card is rejected

- **WHEN** a position lists the same card in the stock and in a column
- **THEN** it is rejected

#### Scenario: A buried face-up card is rejected

- **WHEN** a column holds a face-down card on top of a face-up card
- **THEN** it is rejected

#### Scenario: Arbitrary values are rejected without throwing

- **WHEN** `null`, a number, an array or an object missing its piles is checked
- **THEN** each is rejected and nothing is thrown
