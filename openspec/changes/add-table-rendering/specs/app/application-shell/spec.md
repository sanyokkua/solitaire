# Spec Delta

## MODIFIED Requirements

### Requirement: Semantic colour tokens for the three palettes

The application SHALL express every colour through semantic tokens rather than literal values at the
point of use, and SHALL define a complete set of those tokens for the light palette, the dark palette
and the night-card palette of the product specification §8.1. The light and dark palettes SHALL each
define every colour role; the night-card palette SHALL define the card roles only (card face, card
edge, card shadow, suit inks including the four-colour inks, and the card-back tones and rim), so
that night cards change the cards and never the page, chrome or table. The dark palette SHALL be selectable
independently of the operating system so it can be tested. Text colours SHALL meet a contrast ratio
of at least 4.5:1 against their surfaces, including the LCD digits and labels against the LCD
panel, and every suit ink — red, black, four-colour blue and
four-colour green — SHALL meet at least 4.5:1 against the card face of each palette it is used on;
a repository test SHALL fail when any such pair falls below that ratio. *(KS-SET-03, KS-A11Y-05)*

#### Scenario: Every role is defined in every palette

- **WHEN** the token definitions are inspected
- **THEN** each colour role named in specification §8.1 — page background, surface, table and its
  dot texture, slot line and slot ink, text, muted text, primary action, accent, soft outline, hover,
  chrome shadow, LCD panel, outline, digits and labels, hint, card face, card edge, card shadow, red
  and black suit ink, four-colour suits, and the two tones of each card back with the back rim — has
  a value in the light palette and the dark palette, and each card role has a value in the
  night-card palette

#### Scenario: Night-card palette leaves the page alone

- **WHEN** the night-card token definitions are inspected
- **THEN** they define no page, surface, table, text, primary, accent, LCD or hint role

#### Scenario: Dark palette applies without a system change

- **WHEN** the document is switched to the dark theme
- **THEN** the rendered colours come from the dark palette

#### Scenario: Suit inks meet the contrast floor

- **WHEN** the contrast of every suit ink against the card face of the light, dark and night-card
  palettes is computed
- **THEN** every pair is at least 4.5:1

#### Scenario: Text meets the contrast floor

- **WHEN** the contrast of the text and muted text against the surface, and of the LCD digits and
  labels against the LCD panel, is computed for the light and dark palettes
- **THEN** every pair is at least 4.5:1

#### Scenario: Components do not hard-code colour

- **WHEN** any stylesheet other than the token definitions is inspected
- **THEN** it references colour only through semantic tokens
