# Spec Delta

## MODIFIED Requirements

### Requirement: Layers reserved for later phases carry no behaviour

The internationalisation layer and the progressive-web-app layer SHALL exist as documented
locations only. They SHALL contain no executable code, no placeholder module and no stub export
until the phase that implements them.

The pure domain layer, the solver layer and the features layer are not reserved:
- the domain layer is governed by "The pure domain layer is isolated from the rest of the
  application";
- the solver layer by "The solver layer is isolated from the rest of the application";
- the features layer by "The features layer never loads solver code on the input thread".

*(new)*

#### Scenario: Reserved layer contains no code

- **WHEN** a layer reserved for a later phase is inspected
- **THEN** it contains only documentation stating what belongs there and which phase fills it

#### Scenario: The domain layer is not reserved

- **WHEN** the pure domain layer is inspected
- **THEN** it contains implemented modules, and it is not treated as a reserved layer

#### Scenario: The solver and features layers are not reserved

- **WHEN** the solver layer or the features layer is inspected
- **THEN** it is not treated as a reserved layer, so it may contain implemented modules

## ADDED Requirements

### Requirement: The solver layer is isolated from the rest of the application

The solver layer SHALL import only its own modules and modules of the pure domain layer.

It SHALL NOT reference any of these:
- the user interface framework;
- the state-management library;
- the document or the window;
- any storage mechanism;
- any network facility;
- the platform's unseeded random number source;
- the cryptographic entropy source.

Only the background-thread entry module SHALL reference the worker's global scope.

The layer SHALL contain exactly the modules its `README.md` lists. These constraints SHALL be
enforced by automated checks that fail the repository's gate on violation.

*(new)*

#### Scenario: A dependency outside the solver and domain layers fails the check

- **WHEN** a solver module is given an import that reaches outside the solver and domain layers
- **THEN** the repository's checks fail

#### Scenario: A platform dependency fails the check

- **WHEN** a solver module references any of these:
  - the document or the window;
  - a storage mechanism or a network facility;
  - the unseeded random number source or the cryptographic entropy source;
- **THEN** the repository's checks fail

#### Scenario: The worker scope is confined to the entry module

- **WHEN** a solver module other than the background-thread entry references the worker's global
  scope
- **THEN** the repository's checks fail

#### Scenario: The layer holds exactly its documented modules

- **WHEN** the solver layer's contents are compared against its documentation
- **THEN** every documented module is present and no undocumented module exists

### Requirement: The features layer never loads solver code on the input thread

Features-layer modules SHALL NOT import solver modules as values. They MAY:
- import types from solver modules, since type-only imports are erased at build time;
- reference the background-thread entry, but only as a worker URL.

This keeps the search off the input thread and out of the main bundle. Linting SHALL enforce it.

*(new, KS-DEAL-10)*

#### Scenario: A value import of the search fails lint

- **WHEN** a features module imports the search or selection function from the solver layer as a
  value
- **THEN** linting fails

#### Scenario: A type-only import passes

- **WHEN** a features module imports only types from the solver layer
- **THEN** linting passes
