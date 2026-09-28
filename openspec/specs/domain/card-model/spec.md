# card-model Specification

## Purpose

The card identity encoding every other part of the game is expressed in, together with the seeded
pseudo-random sequence and the unbiased shuffle every deal is built from.

## Requirements

### Requirement: Card identity encoding

Every card SHALL be identified by an integer from 0 to 51. The suit SHALL be the integer quotient of
the identifier and 13 (0 hearts, 1 diamonds, 2 clubs, 3 spades; suits 0 and 1 red) and the rank SHALL
be the remainder plus one. Decomposing an identifier into suit and rank and recombining them SHALL
yield the original identifier for all 52 cards. A validity check SHALL accept exactly the integers
0–51. Input-agnostic: a data representation, not an interaction. Deterministic: an identifier always
yields the same suit, rank and colour. *(KS-DEAL-01)*

#### Scenario: Suit and rank round-trip

- **WHEN** each of the 52 identifiers is decomposed into its suit and rank and recombined
- **THEN** the result equals the original identifier in every case

#### Scenario: Colour follows the encoding

- **WHEN** a card's colour is read
- **THEN** identifiers 0 through 25 are red and identifiers 26 through 51 are black

#### Scenario: Invalid identifiers are rejected

- **WHEN** a value that is negative, 52 or greater, fractional, not a number, or not of numeric
  type is checked for validity
- **THEN** it is reported as not a card identifier

### Requirement: Card labels are locale-independent keys

The card model SHALL expose, per card, a rank label (A, 2–10, J, Q, K), a suit key and a suit symbol,
and SHALL NOT expose translated prose; accessible names are composed from these values in the
internationalisation layer. Input-agnostic: data only. Deterministic: a card always yields the same
labels. *(KS-A11Y-01)*

#### Scenario: Rank and suit expose stable values

- **WHEN** a card's labels are read
- **THEN** the rank label is one of A, 2 through 10, J, Q or K, the suit key is a fixed identifier
  for that suit, and neither varies with the player's selected language

#### Scenario: No translated text in the card model

- **WHEN** the card model's exported values are inspected
- **THEN** none of them is a translated sentence or word intended for direct display

### Requirement: Foundation display order is distinct from the suit encoding

The card model SHALL expose the left-to-right order in which the four foundation slots are presented.
That order SHALL be a permutation of the four suits in which adjacent entries differ in colour, and
SHALL be independent of the suit encoding. Input-agnostic: data only. Deterministic: a constant.
*(new)*

#### Scenario: Display order alternates colours

- **WHEN** the foundation display order is read
- **THEN** it contains each of the four suits exactly once and no two adjacent entries share a
  colour

### Requirement: Deterministic pseudo-random sequence

All randomness in game logic SHALL come from the mulberry32 generator of *R§3.2*, seeded with a
32-bit value; the platform's unseeded random source SHALL NOT be used anywhere in game logic. A
supplied seed SHALL be reduced to an unsigned 32-bit integer before use. Every value SHALL lie in
[0, 1). The sequence SHALL match the reference implementation of *R§3.2* value for value.
Input-agnostic: no interaction. Deterministic: the same seed always yields the same sequence.
*(KS-DEAL-02)*

#### Scenario: Same seed yields the same sequence

- **WHEN** two generators are created from the same seed and each is advanced the same number of
  times
- **THEN** the two sequences of values are identical

#### Scenario: Values stay in range

- **WHEN** a generator is advanced many times
- **THEN** every value produced is at least zero and less than one

#### Scenario: No unseeded randomness in game logic

- **WHEN** the domain layer's sources are inspected
- **THEN** none of them calls the platform's unseeded random number source

### Requirement: Fresh seeds come from an injected entropy source

The system SHALL provide a function returning a fresh 32-bit seed from a cryptographic entropy
source. The source SHALL be a parameter defaulting to the platform's, and SHALL be used through one
operation only: filling a supplied unsigned-32-bit buffer with random values. When no source is
available the function SHALL throw; it SHALL NOT fall back to an unseeded source. Game logic SHALL
NOT call this function. Input-agnostic: no interaction. Deterministic: with a given source, the seed
is the value that source produces. *(KS-DEAL-02)*

#### Scenario: Seed comes from the supplied source

- **WHEN** a fresh seed is requested with an entropy source supplied
- **THEN** the seed is the value that source produced

#### Scenario: Missing entropy source fails loudly

- **WHEN** a fresh seed is requested and no entropy source is available
- **THEN** the request fails with an error rather than returning an unseeded value

### Requirement: Unbiased shuffle

The system SHALL shuffle with the Fisher–Yates (Durstenfeld) algorithm of *R§3.1*: walking from the
last position down to the second, swapping each with a position drawn from 0 up to and including the
current one, using the seeded generator. It SHALL return a new collection and leave its input
unchanged. Input-agnostic: no interaction. Deterministic: the same input and seed always yield the
same ordering. *(KS-DEAL-01)*

#### Scenario: All orderings are reachable

- **WHEN** a four-element collection is shuffled many thousands of times across many seeds
- **THEN** every one of the 24 possible orderings occurs, and their observed frequencies are
  consistent with a uniform distribution

#### Scenario: Shuffling does not modify its input

- **WHEN** a collection is shuffled
- **THEN** the original collection retains its original order and the result is a separate
  collection

#### Scenario: Shuffling is reproducible

- **WHEN** the same collection is shuffled twice with generators created from the same seed
- **THEN** the two results are identical
