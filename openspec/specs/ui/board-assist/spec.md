# ui/board-assist Specification

## Purpose

Defines what assistance looks like on the table — legal-target ghosts, the selection ring, shake,
hint pulses and the focus ring — following the mockup, and how each behaves with motion off.

## Requirements

### Requirement: Legal targets are marked
While Highlight legal moves is on and a card or run is selected or dragged, every legal target SHALL
be marked with a dashed ghost: on a foundation, over its slot; on a column, where the next card
would land (the empty slot for an empty column). While dragging, the target with the largest
overlap SHALL be emphasised with a solid outline and a stronger fill. Ghosts SHALL NOT take pointer
input. With the setting off, no ghost SHALL be shown. Ghosts disappear when the selection or drag
ends.

Input-agnostic: the same ghosts appear for tap selection, drag and keyboard selection.

*(KS-AST-01, KS-INP-05)*

#### Scenario: Selected card
- **WHEN** a card is selected with the setting on
- **THEN** each legal target shows a ghost

#### Scenario: Setting off
- **WHEN** Highlight legal moves is off and a card is selected
- **THEN** no ghost is shown

#### Scenario: Hovered target
- **WHEN** a drag overlaps a legal column most
- **THEN** that column's ghost is emphasised

### Requirement: The selection is visible
A selected card and every card on it SHALL show a ring in the primary colour, drawn outside the card edge; a dragged card SHALL
show a lifted shadow. The ring SHALL be visible in every theme.

*(KS-INP-02)*

#### Scenario: Selected run
- **WHEN** a run is selected
- **THEN** every card of the run shows the ring

### Requirement: Hint visuals
A hint SHALL pulse the source cards twice and show an amber ghost on the target pile (or an amber
pulse on the stock when the hint is to draw or recycle) for about 2 seconds, in the hint outline colour. The
hint SHALL show its description in the hint line. It SHALL NOT use colour alone: the ghost is
dashed and the description is text.

No-motion path: without motion the source cards and target show a steady amber outline instead of
a pulse, for the same duration.

*(KS-AST-02, KS-SET-04)*

#### Scenario: Hint on a move
- **WHEN** a hint for a column-to-column move is shown
- **THEN** the source cards pulse and the target column shows an amber ghost

#### Scenario: Hint to draw
- **WHEN** the hint is to draw
- **THEN** the stock pulses

#### Scenario: Motion off
- **WHEN** motion is off and a hint is shown
- **THEN** the outline is steady and disappears after about 2 seconds

### Requirement: A refused move shakes
A refused tap SHALL shake the tapped card and the cards on it horizontally for about 320 ms without
changing their placement. The shake SHALL compose with the card's glide and layout.

No-motion path: no shake; the refusal is announced.

*(KS-INP-01)*

#### Scenario: Shake
- **WHEN** a smart tap finds no target
- **THEN** the cards shake for about 320 ms and end where they began

#### Scenario: Motion off
- **WHEN** motion is off and a smart tap finds no target
- **THEN** nothing moves and the refusal is announced

### Requirement: Colours meet contrast
The ghost, selection ring, hint outline and focus ring colours SHALL come from semantic tokens
defined for the light and the dark palettes. These marks SHALL be drawn at or outside the card edge
(outline, not fill on the card face), so their contrast is measured against the table colour, and
SHALL meet 3:1 there in both palettes; the selection ring uses the primary colour and the others use
`--color-legal`, `--color-hint-line` and `--color-focus`. Any text SHALL meet 4.5:1.

*(KS-SET-03)*

#### Scenario: Token coverage
- **WHEN** the token sets are checked
- **THEN** each new colour role exists in the light and the dark blocks, and each mark colour meets
  3:1 against that palette's table colour
