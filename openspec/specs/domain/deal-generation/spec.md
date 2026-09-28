# deal-generation Specification

## Purpose

Turning a seed and a game mode into a dealt starting position, and the deal code that reproduces it.

## Requirements

### Requirement: Seeded row-by-row deal

The system SHALL deal by shuffling the ordered 52-card deck with the seeded generator and placing
the shuffled cards row by row: for each row from the first to the seventh, one card on every column
at or after that row's index, so column *n* ends with *n+1* cards. The last card of each column SHALL
be face up and all others face down. The remaining 24 cards SHALL form the stock, with the last card
of the shuffled deck drawn first. The waste and all four foundations SHALL start empty. The position
SHALL record the seed reduced to an unsigned 32-bit integer, so its deal code can always be produced.
Input-agnostic: triggered by starting a game, not by a card interaction. Deterministic: the same seed
and mode always yield an identical position. *(KS-DEAL-01, KS-DEAL-02)*

#### Scenario: Column sizes and face-up cards

- **WHEN** a deal is produced
- **THEN** column *n* holds *n+1* cards, only the last card of each column is face up, and the
  stock holds the remaining 24 cards

#### Scenario: The deck is complete

- **WHEN** a deal is produced
- **THEN** every one of the 52 card identifiers appears exactly once across the tableau and the
  stock, and the waste and all four foundations are empty

#### Scenario: The same seed deals the same position

- **WHEN** the same seed and mode are dealt twice
- **THEN** the two positions are identical in every field

#### Scenario: The recorded seed is its unsigned 32-bit reduction

- **WHEN** a seed outside the unsigned 32-bit range (for example −1) is dealt
- **THEN** the position records the reduced seed (4294967295), is identical to the deal of that
  reduced seed, and its deal code can be produced

#### Scenario: Different seeds deal different positions

- **WHEN** two different seeds are dealt in the same mode
- **THEN** the resulting layouts differ

### Requirement: A mode fixes the draw count and the scoring rules

Each mode SHALL fix the draw count and scoring rules for the life of the game: Draw 1 draws one under
Standard scoring, Draw 3 draws three under Standard, Vegas draws three under Vegas, and Daily draws
one under Standard. A fresh deal SHALL be on pass 1, with no moves, no elapsed time, no undo charges,
not started, not won, and the starting score of its scoring rules. Input-agnostic: no interaction.
Deterministic: a mode always maps to the same draw count and scoring rules. *(KS-SET-06)*

#### Scenario: Each mode maps to its draw count and scoring

- **WHEN** a game is dealt in a given mode
- **THEN** its draw count and scoring rules are those the mode defines

#### Scenario: A fresh deal starts on the first pass

- **WHEN** a game is dealt
- **THEN** it is on its first pass through the stock, has made no moves, has no elapsed time, has no
  undo charges, is not yet started, is not won, and carries the starting score for its scoring rules

### Requirement: Deal code round-trip

A deal code SHALL be the mode letter (`1` Draw 1, `3` Draw 3, `V` Vegas, `D` Daily), a `-` separator
and the seed in upper-case base 36, left-padded to exactly seven characters (for example
`1-K7Q29XD`). Decoding SHALL ignore letter case and surrounding whitespace, and SHALL return an
explicit invalid result — never throw — for an unknown mode letter, a seed section that is not
exactly seven base-36 characters, a missing separator, empty input, or a seed above 2³²−1. Encoding
then decoding SHALL return the original seed and mode for every 32-bit seed and every mode. A code
alone SHALL reproduce its deal, with no solver, network or stored data. Input-agnostic: text
conversion only. Deterministic: the same seed and mode always yield the same code, and vice versa.
*(KS-DEAL-02, KS-DEAL-09)*

#### Scenario: Every seed and mode round-trips

- **WHEN** a seed and mode are encoded and the resulting code is decoded
- **THEN** the decoded seed and mode equal the originals, for seeds across the whole 32-bit range
  and for all four modes

#### Scenario: A code is written in upper case

- **WHEN** a deal is encoded
- **THEN** the code carries the mode's letter, the separator and seven upper-case base-36 characters

#### Scenario: Codes are case- and whitespace-insensitive

- **WHEN** a valid code is decoded in lower case, in upper case, or with leading and trailing
  whitespace
- **THEN** each decodes to the same seed and mode

#### Scenario: Invalid codes are reported, not thrown

- **WHEN** a code with an unrecognised mode letter, a seed section of the wrong length, a character
  outside base 36, a missing separator, no content at all, or a seed above the 32-bit range is
  decoded
- **THEN** the decode reports the code as invalid and no game is started

#### Scenario: A code reproduces its deal

- **WHEN** a code is decoded and the resulting seed and mode are dealt
- **THEN** the position is identical to the one the code was produced from
