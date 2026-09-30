# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Card faces follow the mockup`
- TO: `### Requirement: Card faces`

## MODIFIED Requirements

### Requirement: Card faces

A face-up card SHALL be drawn as a card face with rounded corners (a radius of about 9% of the card
width) and a thin edge, in the face, edge and ink colours of the active card palette (see
`app/appearance`): a near-white face in the light theme, a pale grey-blue face in the dark theme, and
a deep navy face with light inks while Night cards is on. On the face it SHALL show:
- in the top-left corner, its index: the rank in the pixel typeface followed by the suit symbol, on
  one line;
- for an Ace and the number cards 2 to 10, one large suit symbol in the centre, a little below the
  middle, about half the card width tall;
- for Jacks, Queens and Kings instead, the rank letter in the pixel typeface inside a centred box drawn
  with a rounded outline in the card's ink over a faint tint of that ink, and no centre suit;
- while the card is not compact, a copy of the corner index turned by 180° in the bottom-right
  corner; compact cards (narrower than 70 px, see `ui/board-layout`) SHALL omit it.

Suit symbols SHALL render as text, never as colour emoji, so each suit keeps its distinct shape in every
palette. Hearts and diamonds SHALL use the red ink and clubs and spades the black ink, unless the
four-colour deck is on (diamonds blue and clubs green, see `app/appearance`). Every size on the face
SHALL scale with the card width. In every card palette, with or without the four-colour deck, each
suit's ink SHALL meet 4.5:1 contrast against the face.

Input-agnostic: rendering only. No animation.

*(KS-A11Y-05, KS-SET-03; face anatomy and compact threshold (new))*

#### Scenario: Number card face

- **WHEN** the Seven of Clubs is face up on a card that is not compact
- **THEN** it shows "7♣" in the top-left corner, a large ♣ in the centre and a rotated "7♣" in the
  bottom-right corner, in the black ink

#### Scenario: Court card face

- **WHEN** the Queen of Hearts is face up
- **THEN** it shows "Q♥" in the corner and a boxed "Q" in the centre with no centre suit, in the red
  ink

#### Scenario: Compact card

- **WHEN** cards are compact
- **THEN** no card shows the bottom-right corner index

#### Scenario: Ink contrast in every palette

- **WHEN** a card of each suit is face up in the light theme, the dark theme and with Night cards on,
  each with the four-colour deck off and on
- **THEN** every suit's ink measures at least 4.5:1 against that palette's card face
