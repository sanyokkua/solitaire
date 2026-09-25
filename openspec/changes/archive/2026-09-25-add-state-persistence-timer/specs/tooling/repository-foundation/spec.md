# Spec Delta

## MODIFIED Requirements

### Requirement: Single aggregate validation gate

The repository SHALL expose one command that runs the full local gate in order: format check, lint,
type check, the lifecycle-storage guard, unit and component tests, then build. The lifecycle-storage
guard SHALL fail when the application lifecycle test uses ambient browser storage instead of an
injected storage gateway. The gate SHALL stop at the first failing step and exit non-zero. *(new)*

#### Scenario: Whole gate passes

- **WHEN** the validate command runs on a clean checkout
- **THEN** every step runs in order and the command exits zero

#### Scenario: Gate stops at the first failure

- **WHEN** linting fails
- **THEN** the validate command exits non-zero and does not run type checking, the lifecycle-storage
  guard, tests or the build

#### Scenario: The lifecycle test must inject storage

- **WHEN** the application lifecycle test refers to ambient `localStorage`
- **THEN** the lifecycle-storage guard exits non-zero and names the violation
