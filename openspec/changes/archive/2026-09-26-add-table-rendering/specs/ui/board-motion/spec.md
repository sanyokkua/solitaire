# Spec Delta

## Purpose

Defines how the table animates between positions — glides, flips and the staggered deal — how it
re-lays out when the viewport changes, and the single no-motion path that replaces every animation.

## ADDED Requirements

### Requirement: Cards glide and flip between positions

When the position changes, every card whose place changed SHALL glide to its new place in about
240 ms, and every card that turned face up or face down SHALL flip with a 3D turn of about 300 ms.
Only a card's transform and opacity SHALL be animated. A position change SHALL never wait for an
animation to finish before the new position is in effect, and a new position arriving mid-animation
SHALL retarget the glide from wherever the card is.

No-motion path: while motion is reduced, the new position SHALL appear at once, with no glide and no
flip turn.

Input-agnostic: animation follows any change of position (in Phase 5 from Undo, Redo, restart or a
new deal; board input arrives in Phase 6).

*(KS-PERF-01, spec §8.3)*

#### Scenario: Undo glides the card back

- **WHEN** motion is on and the player activates Undo after a move to the foundation
- **THEN** the card glides from the foundation back to its column within about 240 ms

#### Scenario: Flip on reveal

- **WHEN** motion is on and a redo reveals a face-down card
- **THEN** that card turns face up with a 3D flip

#### Scenario: No motion

- **WHEN** motion is reduced and the player activates Undo
- **THEN** every card is at its new place in the next rendered frame with no transition

### Requirement: The deal animates from the stock

When a fresh deal is shown — a new game or a restart that has not yet received a command — every card
SHALL start at the stock and the 28 tableau cards SHALL travel to their columns one by one in deal
order, 28 ms apart, each column's last card flipping face up 200 ms after its glide begins, so the
whole deal takes about 1.3 s. While a card waits at the stock it SHALL show its back. The deal SHALL
play once per fresh deal: once it has finished playing it SHALL not replay when the player leaves the
Game screen and returns, and it SHALL never play for a game restored from storage. A deal that is
interrupted before it finishes (the table is removed, or a newer deal arrives) SHALL restart from the
stock the next time that deal is shown, and a newer deal SHALL replace an older one.

No-motion path: while motion is reduced, the fresh deal SHALL appear at once in its dealt position,
and that deal SHALL count as played, so switching motion back on never replays it.

Input-agnostic: the deal follows starting or restarting a game, whichever control started it.

*(Spec §4.1, §8.3, R§12.3; KS-SET-04 no-motion path; deal animation and replay rules (new))*

#### Scenario: Fresh deal animates

- **WHEN** motion is on and a new game is dealt
- **THEN** the tableau cards leave the stock in deal order at 28 ms intervals and the whole deal
  settles within about 1.3 s

#### Scenario: Restored game does not replay

- **WHEN** the app reopens with a stored game and the player continues it
- **THEN** the cards appear at their positions without a deal animation

#### Scenario: Returning to an unstarted deal

- **WHEN** the player leaves a freshly dealt, unplayed game for Home and immediately deals again
- **THEN** only the new deal animates, and the previous deal is not replayed

#### Scenario: Interrupted deal restarts cleanly

- **WHEN** motion is on and the table is removed and shown again before a fresh deal has finished
  playing
- **THEN** the deal plays again from the stock, and no card stays parked at the stock

#### Scenario: Deal without motion

- **WHEN** motion is reduced and a new game is dealt
- **THEN** the dealt position appears at once, and turning motion on and returning to that game does
  not play the deal

### Requirement: Re-layout on viewport change within one frame

When the board's size changes — rotation, folding, unfolding, window resize or browser bars showing
or hiding — the table SHALL re-lay out to the new size in the same rendered frame, with transitions
suppressed for that frame so cards jump rather than glide, and SHALL keep the game position, score
and time. A size change smaller than 1 px SHALL be ignored. The table SHALL place no card before its
size is first known, and the first known size SHALL be applied like a size change, so cards never
animate from the table's corner. Cancelling a drag in progress is added with dragging in Phase 6.

Input-agnostic: triggered by the viewport, not by input. There is no animation to replace: the
re-layout is already instant.

*(KS-GEN-08; drag cancel deferred to Phase 6)*

#### Scenario: Rotation keeps the game

- **WHEN** the viewport rotates from portrait to landscape mid-game
- **THEN** in the first frame after the size change every card is at its place for the new size, and
  the moves are unchanged, and the score and time carry on from their earlier values without being
  reset

#### Scenario: First layout does not glide

- **WHEN** the Game screen first shows a game
- **THEN** no card moves from the table's corner: each card appears at its place, or, for a fresh
  deal with motion on, starts at the stock

#### Scenario: Sub-pixel change ignored

- **WHEN** the board size changes by less than 1 px
- **THEN** no re-layout occurs
