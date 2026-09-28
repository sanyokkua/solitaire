# Spec Delta

## ADDED Requirements

### Requirement: A deal records its provenance

A dealt position SHALL carry its provenance:
- the verdict: `win` when the deal was proven winnable, otherwise `random`;
- the attempts: how many candidate seeds were tried to choose it;
- the grade: Easy, Medium or Hard when a proven deal was graded, otherwise none.

A deal dealt with no provenance given, such as a deal from a deal code or a deal at random, SHALL
record the verdict `random`, one attempt and no grade. A grade SHALL be recorded only with the verdict
`win`. A `win` deal records no grade when it was not graded, such as a game kept from before grading
existed.

Provenance SHALL never change the layout: the same seed and mode deal the same cards whatever
provenance is recorded. A deal code carries no provenance, so a deal played from its code has none.

Input-agnostic: triggered by starting a game, not by a card interaction.

Deterministic: the same seed, mode and provenance always yield an identical position.

*(KS-DEAL-06, KS-DEAL-11 (new), KS-DEAL-02)*

#### Scenario: Provenance is recorded

- **WHEN** a seed is dealt with the verdict `win`, 3 attempts and the grade Medium
- **THEN** the position records the verdict `win`, 3 attempts and the grade Medium

#### Scenario: A deal with no provenance given

- **WHEN** a seed is dealt with no provenance given
- **THEN** the position records the verdict `random`, one attempt and no grade

#### Scenario: Provenance never changes the layout

- **WHEN** the same seed and mode are dealt once with no provenance and once as a graded `win` deal
- **THEN** the tableau, stock, waste and foundations are identical, and so are the deal codes
