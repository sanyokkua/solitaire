# Spec Delta

## MODIFIED Requirements

### Requirement: Layers reserved for later phases carry no behaviour

The solver layer, the features layer, the internationalisation layer and the progressive-web-app
layer SHALL exist as documented locations only. They SHALL contain no executable code, no
placeholder module and no stub export until the phase that implements them. The pure domain layer
is not a reserved layer; it is governed by "The pure domain layer is isolated from the rest of the
application". *(new)*

#### Scenario: Reserved layer contains no code

- **WHEN** a layer reserved for a later phase is inspected
- **THEN** it contains only documentation stating what belongs there and which phase fills it

#### Scenario: The domain layer is not reserved

- **WHEN** the pure domain layer is inspected
- **THEN** it contains implemented modules, and it is not treated as a reserved layer

## ADDED Requirements

### Requirement: The pure domain layer is isolated from the rest of the application

The pure domain layer SHALL import only its own modules. It SHALL NOT reference the user interface
framework, the state-management library, the document, the window, any storage mechanism, any
network facility, or the platform's unseeded random number source. The only permitted platform
dependency SHALL be the cryptographic entropy source, confined to one module and supplied as a
replaceable parameter. The layer SHALL contain exactly the modules its `README.md` lists. These
constraints SHALL be enforced by automated checks that fail the repository's gate on violation.
*(new)*

#### Scenario: A dependency on another layer fails the check

- **WHEN** a domain module is given an import that reaches outside the domain layer
- **THEN** the repository's checks fail

#### Scenario: A platform dependency fails the check

- **WHEN** a domain module references the document, the window, a storage mechanism, a network
  facility or the unseeded random number source
- **THEN** the repository's checks fail

#### Scenario: The entropy source is confined and injectable

- **WHEN** the domain layer's use of the cryptographic entropy source is inspected
- **THEN** it appears in exactly one module and is reached through a replaceable parameter rather
  than directly at every call site

#### Scenario: The layer holds exactly its documented modules

- **WHEN** the domain layer's contents are compared against its documentation
- **THEN** every documented module is present and no undocumented module exists
