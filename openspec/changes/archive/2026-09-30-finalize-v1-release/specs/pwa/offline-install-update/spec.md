# Spec Delta

## MODIFIED Requirements

### Requirement: The app is installable

The system SHALL publish a web app manifest whose start URL and scope are `/solitaire/`, with
standalone display, the name "Solitaire", theme and background colours from the
palette, and icons at 192 px and 512 px plus a maskable 512 px icon whose mark lies inside the safe
zone (the central circle whose diameter is 80% of the icon's width), and a 180 px touch icon for
home-screen use on iOS. The page SHALL link the manifest and an SVG favicon, and declare theme colours
for the light and dark schemes.

The favicon and every icon (192, 512, maskable 512 and the 180 px touch icon) SHALL show the same card
motif, drawn in a pixel-art style with crisp square pixels to match the app's retro look: two
staggered playing cards on the navy brand background, a card back in the brand's two-tone pixel
checker behind and offset up and to the left, and in front a white ace of spades face showing a pixel
"A" and a spade in the card ink. Each icon SHALL draw the motif centred, at a whole-pixel scale, with
navy padding around it; the maskable icon SHALL keep both cards inside its safe zone.

Input-agnostic: a delivery requirement. No animation.

*(KS-PWA-02; manifest and icon details, and the card icon (new), checked on the built artifact)*

#### Scenario: Manifest

- **WHEN** the built manifest is read
- **THEN** its start URL and scope are `/solitaire/`, its display is standalone, and every listed
  icon exists, including a maskable one

#### Scenario: Card icon everywhere

- **WHEN** the favicon, the 192 px and 512 px icons, the maskable icon and the touch icon of the
  built artifact are viewed at 16, 32, 180 and 512 px
- **THEN** each shows a card back behind an ace of spades face on the navy background, with crisp
  pixel edges and the same design in every file

#### Scenario: Maskable safe zone

- **WHEN** the maskable icon is cropped to the central circle whose diameter is 80% of its width
- **THEN** both cards lie wholly inside that circle
