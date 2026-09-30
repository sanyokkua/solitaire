# Changelog

All notable changes to Klondike Solitaire, newest first. The project follows [semantic versioning](https://semver.org/).
The release procedure is in [docs/development/release.md](docs/development/release.md).

## 1.0.0 — 2026-09-30

The first complete release: everything planned for the game is built, checked in a real browser and documented.

### Game

- **Four modes.** Draw 1, Draw 3, Vegas and a Daily deal that is the same for every player on a UTC date.
- **Winnable deals in every mode.** A built-in solver proves a deal winnable before it is shown, in Draw 1, Draw 3 and
  Vegas (Draw 3 and Vegas use a search that follows the order of the drawn cards). A deal that cannot be proven within the
  attempt limit is dealt as a plain random deal and labelled so.
- **Graded deals.** A proven deal is graded Easy, Medium or Hard by how forgiving it is, shown on the deal chip and the Win
  sheet, and the Difficulty control asks for a grade. Selection tries 48 candidate deals per request.
- **Instant deals.** A background pool keeps proven, graded deals ready, so most new games start at once; a slow search shows
  a "Shuffling cards before the game…" screen.
- **Solver hints in every mode.** Hint follows the solver's line where it has one, and falls back to a heuristic.
- **Play by tap, drag or keyboard,** all equal, with undo, redo, hint, finish and pause.
- **Shareable deals.** Every deal is deterministic from a seed and has a deal code.
- **Statistics** per mode, with a Daily streak.

### App

- **Offline and installable** as a PWA; updates apply only when the player chooses, after the game is saved.
- **English and Ukrainian.**
- **Accessible.** Accessible names, live announcements, focus management, 4.5:1 contrast and 44 px touch targets.
- **Appearance.** Light, dark and system themes, a four-colour deck, night cards and four card backs; motion is optional.
  Card ranks and suits are larger for small screens.
- **New app icon** showing a fan of cards. An installed copy keeps the icon it was installed with; uninstall and install it
  again to see the new one.
- **Build identity.** The About sheet and the Home footer show the version, the build number and the UTC build time.
- **Storage record version 2,** with a lossless upgrade of version 1 records.

### Quality

- Full-game wins in every mode through real input, edge cases proven end to end, and a strict requirement-traceability check
  that ties every requirement to the tests or manual checks that prove it.
- Informational drag-performance and deal-latency traces, a device matrix checked on every screen size, and a flake sweep of
  the whole suite.
- Committed reference screenshots of the production build.

### Project

- The original specification pack (the product specification, research notes, phased design and HTML mockup) was retired.
  OpenSpec holds the requirements, and the maintained documentation records the game rules, the winnability facts and the
  architecture.
- Documentation-link and retired-pack guards run with the unit tests.
