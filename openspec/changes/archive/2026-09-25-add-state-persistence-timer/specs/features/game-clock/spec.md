# Spec Delta

## Purpose

Measures a game's play time: it starts with the first accepted command, counts only unpaused time on
the Game screen, and is settled before any move is recorded so that time-based scores and records
match what the player saw.

## ADDED Requirements

### Requirement: Play time starts with the first accepted command

Elapsed play time SHALL be zero until the game's first accepted command and SHALL count only from
that command onwards. Time spent looking at an unstarted deal SHALL NOT count.

Input-agnostic: any accepted command starts the time, whatever input produced it.

*(KS-SCO-05)*

#### Scenario: Waiting before the first move does not count

- **WHEN** a deal sits untouched on the Game screen for 20 seconds and a move is then accepted
- **THEN** the elapsed time is zero at the moment of the move

### Requirement: Play time counts only while the game can be played

Elapsed play time SHALL increase only while all of these hold: the Game screen is shown, no sheet is
open, the document is visible, the game is started, and the game is not won. While any condition
fails the time SHALL stop, and the Standard time penalty, which is derived from the time, stops with
it. When play becomes possible again the time SHALL resume from where it stopped, without counting
the interval in between.

Input-agnostic: driven by screen, sheet and page visibility state.

*(KS-SCO-05, KS-SCO-06)*

#### Scenario: Home pauses the clock

- **WHEN** the player returns to Home for 30 seconds and then continues the game
- **THEN** the elapsed time is what it was when they left

#### Scenario: An open sheet pauses the clock

- **WHEN** a sheet is open for 10 seconds during a game
- **THEN** the elapsed time does not change during those 10 seconds

#### Scenario: A hidden document pauses the clock

- **WHEN** the document becomes hidden for a minute and then visible again
- **THEN** the minute is not counted

#### Scenario: A won game stops the clock

- **WHEN** the game is won
- **THEN** the elapsed time no longer changes

### Requirement: The clock is robust to suspension and wall-clock changes

Elapsed play time SHALL be measured with a monotonic time source, so changes to the device's
wall-clock time do not alter it. A single measurement step SHALL add at most one second, so a device
that suspends while the page is still considered visible does not add the suspended time.

Input-agnostic: no interaction.

*(KS-SCO-05)* *(new)*

#### Scenario: A long suspension adds at most one second

- **WHEN** the clock is eligible and the next measurement arrives five minutes after the previous one
- **THEN** the elapsed time grows by one second

### Requirement: The clock is settled before a command is recorded

Before a command's result is recorded, the play time accrued since the last measurement SHALL be
added to the game, so the elapsed time, the time penalty, the win bonus and any best time recorded
for a win all use the same final time.

Input-agnostic: applies to every command, player-issued or system-issued.

*(KS-SCO-04, KS-STA-02)*

#### Scenario: The winning move settles the time

- **WHEN** a game is won 200 ms after the last measurement
- **THEN** the recorded best time, the elapsed time shown and the win bonus all include those 200 ms
