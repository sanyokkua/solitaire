# Spec Delta

## ADDED Requirements

### Requirement: A Daily deal reports its date

A delivered Daily deal SHALL report the UTC date key (`YYYY-MM-DD`) it was selected for, which is
the date its candidate seeds were derived from, including when the background thread fails and the
first candidate is dealt. Deals in other modes SHALL report no date.

Input-agnostic: how the Daily deal is requested belongs to a later phase.

Deterministic: the reported date is the one the Daily v1 seeds were computed from.

*(KS-STA-04, KS-DEAL-07)*

#### Scenario: The Daily deal carries its date

- **WHEN** the Daily deal is requested at 12:00 UTC on 2026-09-24
- **THEN** it is delivered with the date key `2026-09-24`

#### Scenario: The fallback Daily deal carries its date

- **WHEN** the background thread fails while the Daily deal for 2026-09-24 is being selected
- **THEN** the first candidate is dealt with the date key `2026-09-24`

#### Scenario: Other modes carry no date

- **WHEN** a Draw 3 deal is delivered
- **THEN** it reports no date
