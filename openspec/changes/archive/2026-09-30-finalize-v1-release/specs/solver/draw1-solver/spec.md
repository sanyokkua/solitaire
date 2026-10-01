# Spec Delta

## MODIFIED Requirements

### Requirement: Search results match the reference solver

At a budget of 5,000 nodes, the search SHALL give the same verdict as the reference solver for every
Draw 1 deal of seeds 1 to 200, with each deal produced by the seeded row-by-row deal. The reference
solver is the Draw 1 solver of the original interface prototype, kept in the repository history at
git revision `d72187f` (`git show d72187f:docs/spec/mockup/klondike-mockup.html`). The totals are 142
wins, 1 loss and 57 unknown. A change to any of these verdicts SHALL be made on purpose, by updating
the pinned per-seed record. The reference record SHALL come from running the reference solver, never
from the new implementation.

Input-agnostic: no interaction.

Deterministic: every seed maps to exactly one pinned verdict.

*(KS-DEAL-03, KS-DEAL-01)*

#### Scenario: The corpus reproduces seed by seed

- **WHEN** the Draw 1 deals of seeds 1 to 200 are each searched at 5,000 nodes
- **THEN** each verdict equals the pinned reference verdict for that seed, giving 142 wins, 1 loss
  and 57 unknown
