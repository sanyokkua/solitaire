# Spec Delta

## MODIFIED Requirements

### Requirement: Deterministic pseudo-random sequence

All randomness in game logic SHALL come from the mulberry32 generator, seeded with a 32-bit value; the
platform's unseeded random source SHALL NOT be used anywhere in game logic. A supplied seed SHALL be
reduced to an unsigned 32-bit integer before use. Every value SHALL lie in [0, 1). The sequence SHALL
match the standard mulberry32 algorithm value for value, as pinned by reference vectors: seed 1
starts 0.6270739405881613, 0.002735721180215478, 0.5274470399599522.
Input-agnostic: no interaction. Deterministic: the same seed always yields the same sequence.
*(KS-DEAL-02)*

#### Scenario: Same seed yields the same sequence

- **WHEN** two generators are created from the same seed and each is advanced the same number of
  times
- **THEN** the two sequences of values are identical

#### Scenario: The sequence matches the reference vectors

- **WHEN** a generator is created from seed 1 and advanced three times
- **THEN** it yields 0.6270739405881613, 0.002735721180215478 and 0.5274470399599522, in that order

#### Scenario: Values stay in range

- **WHEN** a generator is advanced many times
- **THEN** every value produced is at least zero and less than one

#### Scenario: No unseeded randomness in game logic

- **WHEN** the domain layer's sources are inspected
- **THEN** none of them calls the platform's unseeded random number source

### Requirement: Unbiased shuffle

The system SHALL shuffle with the Fisher–Yates (Durstenfeld) algorithm: walking from the last
position down to the second, swapping each with a position drawn from 0 up to and including the
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
