# Spec Delta

## MODIFIED Requirements

### Requirement: Night cards change the cards only

While Night cards is on, card faces, card edges, suit inks, card shadows and card backs SHALL use the
night-card palette, and every other surface (page, chrome, table and LCD) SHALL keep the colours of
the current theme. The cards include Home's mode cards, which are drawn as playing cards. Night
cards SHALL apply with either theme.

The night-card palette SHALL look like this:
- card faces are dark navy with a lighter steel-blue edge, and cast a deeper shadow than day cards;
- inks are light: a soft rose red for hearts and diamonds and a pale blue-white for spades and clubs,
  including the corner indices, pips and face-card letters;
- with Four-colour deck on, diamonds are a light sky blue and clubs a light mint green;
- the Harbour blue, Sky and Coral backs all render in one pale steel-blue two-tone checker with a
  dark navy rim;
- the Deep navy back renders in its own darker navy two-tone checker with a light steel-blue rim, so
  it stays visible against the dark night face.

Every night ink SHALL meet a contrast ratio of at least 4.5:1 against the night card face (see
application-shell "Semantic colour tokens for the three palettes"), and face-down cards SHALL stay
clearly distinct from face-up cards.

Input-agnostic: applies a stored preference. Switching Night cards on or off changes colours only and
adds no animation.

*(KS-SET-03, KS-A11Y-05; night-card scope and back overrides (new))*

#### Scenario: Night cards with the light theme

- **WHEN** the theme is Light and Night cards is on
- **THEN** cards render with the dark navy night face, its lighter edge and the light inks, and the
  page, chrome, table and LCD keep their light-palette colours

#### Scenario: Night cards with the dark theme

- **WHEN** the theme is Dark and Night cards is on
- **THEN** cards render with the night face, edge and inks, and the page, chrome, table and LCD keep
  their dark-palette colours

#### Scenario: Night inks stay readable

- **WHEN** Night cards is on, with and without Four-colour deck
- **THEN** every suit ink meets at least 4.5:1 against the night card face

#### Scenario: Night cards override the pale backs

- **WHEN** Night cards is on and the card back is Harbour blue, Sky or Coral
- **THEN** face-down cards render in the pale steel-blue night back with a dark navy rim

#### Scenario: Deep navy keeps a night variant

- **WHEN** Night cards is on and the card back is Deep navy
- **THEN** face-down cards render in the darker navy night variant with a light steel-blue rim
