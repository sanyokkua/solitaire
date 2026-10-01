# Keyboard and controls

How to play by pointer, tap and keyboard. Source of truth: `src/ui/board/keyboardController.ts#keyToAction`,
`src/ui/board/useGameShortcuts.ts#useGameShortcuts`, `src/ui/board/useBoardKeyboard.ts#useBoardKeyboard`,
`src/ui/board/pointerController.ts#step` and `src/ui/board/useBoardActions.ts#useBoardActions`. The in-app version is the
Controls table in the How to play sheet (`src/ui/sheets/HelpSheet.tsx`). How these pieces fit together:
[UI architecture](../architecture/ui.md).

Every move can be made by tap, drag or keyboard. All three end in the same game commands.

## Shortcuts

Shortcuts are active on the Game screen. Ctrl and Command (Cmd) are treated alike. Alt combinations and typing in a
text field (`INPUT`, `TEXTAREA`, `SELECT`, editable content) never trigger a shortcut. Shifted letters (for example
Shift+H) are ignored.

| Key                                | Action                                          | Condition                                                                                                                                                                                                             |
| ---------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ctrl/Cmd + Z                       | Undo                                            | Input gate open (see below).                                                                                                                                                                                          |
| Ctrl/Cmd + Y, Ctrl/Cmd + Shift + Z | Redo                                            | Input gate open.                                                                                                                                                                                                      |
| H                                  | Show a hint                                     | Input gate open.                                                                                                                                                                                                      |
| A                                  | Finish (play every remaining card home)         | Input gate open; does nothing when Finish is not available.                                                                                                                                                           |
| N                                  | New deal                                        | No sheet open and the game controls idle (no safe-card chain, Finish or deal in progress). Ignores the input gate, so it works during the win cascade. Same as the HUD New deal control: may open the New deal sheet. |
| P                                  | Pause (opens the Paused sheet); P again resumes | Pause: no sheet open, controls idle, game not won. With the Paused sheet open, P resumes. With any other sheet open, P does nothing.                                                                                  |
| Space (nothing focused)            | Draw from the stock                             | Input gate open and focus on the page itself (not on a control).                                                                                                                                                      |
| Esc                                | Clear the selection; or close the open sheet    | With a sheet open, Esc closes it (never the Win sheet). Otherwise clears a selection if there is one, input gate open. During a drag, Esc cancels the drag instead.                                                   |

Notes:

- Letters (H, A, N, P, Z, Y) are layout-independent. A Latin letter is taken as typed (so AZERTY and Dvorak follow their
  labels). If the layout types a letter of another alphabet, such as Ukrainian `р`, the physical key (`KeyH`) decides.
- A held key acts once: auto-repeat of a shortcut is prevented and dropped. Arrow keys and Tab keep repeating.
- The **input gate** (`src/features/interaction/selectors.ts#selectInputEnabled`) is open only on the Game route with
  no deal being prepared, no sheet open, a game in play (not won), and no safe-card chain or Finish running. While a
  sheet is open, only Esc acts among the board shortcuts, plus N and P as described above.
- The Toolbar has Undo, Redo, Hint and Finish buttons, and the HUD has New deal and a Time button that pauses. Those are
  native buttons: Tab to them, Enter or Space to activate.

## Keyboard on the board

The board has one tab stop (roving focus). Focus rests on a card or on an empty pile slot.

| Key                        | Action                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab / Shift+Tab            | Next / previous pile. An empty waste is skipped; an empty foundation or column is a stop. Past either end, Tab leaves the board to the next control. |
| Left / Right               | Same as Shift+Tab / Tab (previous / next pile).                                                                                                      |
| Up / Down                  | Within a column, move between face-up cards. Clamped at the topmost face-up card and the last card; never lands on a face-down card.                 |
| Enter or Space             | Act as a tap on the focused card or pile (draws when the stock is focused).                                                                          |
| Shift+Enter or Shift+Space | Pick up the focused card and the run on it (or clear the selection if that card is already the selection). Works in either tap mode.                 |
| Esc                        | Clear the selection.                                                                                                                                 |

Details:

- Tab order is stock, waste, four foundations, then columns 1 to 7. With the "Stock on the right" preference it is the
  foundations, waste, stock, then the columns (`keyboardController.ts#pileOrder`).
- Landing on another pile focuses that pile's remembered card if it is still there and can be picked up, otherwise its
  top card (or the stock / empty slot).
- Arrow keys are always taken on the board, so the page never scrolls. Keys with Ctrl, Cmd or Alt are left to the global
  shortcuts.
- Enter and Space on a card behave exactly like a tap in the current tap mode, except a keyboard press is never a
  double tap.
- A new game resets focus to the stock.

## Tap and click

Behaviour depends on the **Tap a card to...** setting (`tapMode` preference in Settings; default `smart`).

| Situation                                 | Smart move (`smart`)                                                                                                                                                                                                                                                                                                                                                                           | Select and place (`select`)                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tap the stock (or a card in it)           | Draw.                                                                                                                                                                                                                                                                                                                                                                                          | Draw.                                                                                                      |
| Tap a movable card, nothing selected      | Send it (and the run on it) to its best legal spot (`src/domain/smartTap.ts#bestTarget`: its foundation, else the first non-empty column that accepts it, scanning right of its own column and wrapping, else an empty column for a King that is not already at a column base). If nothing accepts it: a refusal is announced and the cards shake (the shake is skipped under reduced motion). | Pick it up: select the card and its run; legal targets are highlighted when "Highlight legal moves" is on. |
| Tap a legal target with a card selected   | Places the selection (a selection made with Shift+Enter or Shift+Space behaves this way too).                                                                                                                                                                                                                                                                                                  | Places the selection.                                                                                      |
| Tap another movable card with a selection | Places if that card's pile is a legal target, otherwise selects the new card.                                                                                                                                                                                                                                                                                                                  | Same.                                                                                                      |
| Tap the selected card, or empty space     | Clears the selection.                                                                                                                                                                                                                                                                                                                                                                          | Same.                                                                                                      |
| Double-tap a card                         | The second tap is ignored (the first tap already acted).                                                                                                                                                                                                                                                                                                                                       | Sends a lone card that fits to its foundation.                                                             |

A double tap is two taps on the same card less than 320 ms apart (`DOUBLE_TAP_MS`). Taps do nothing while the input
gate is closed.

## Drag

Works with mouse, touch and pen, in either tap mode.

- Only a movable card outside the stock can be dragged; anything else only taps.
- The drag starts when the pointer moves strictly more than **5 px** from the press point for a mouse
  (`MOUSE_DRAG_THRESHOLD`) or more than **9 px** for touch and pen (`TOUCH_DRAG_THRESHOLD`).
- Only the primary mouse button starts a press. Events from other pointers are ignored while one is pressed.
- On release, the run goes to the legal target with the largest overlap with the dragged run. If no legal target
  overlaps, the run glides back.
- A drag is cancelled by Esc, `pointercancel`, a lost pointer capture, a resize, or the input gate closing. The click a
  browser sends after a drag is swallowed.

## Other controls

- Time button in the HUD: pause. Deal code button: copies the code (or selects its text when the Clipboard API is
  unavailable or refuses the write).
- Hint: highlights the cards and the target (or the stock); the same text is announced and shown in the hint line.
- Screen readers: moves, refusals and hints are spoken by one polite live region. See [UI architecture](../architecture/ui.md#announcer-and-notices).

## Cross-check with other docs

The top-level `README.md` says only that the game can be played by tap, drag or keyboard; it has no shortcut table. The
Controls table in the How to play sheet (`help.controls.*` in `src/i18n/locales/en.ts`) lists Tap/Click, Drag,
Double-click, Space, Undo/Redo, H, A, N, P and Esc; it omits board keyboard navigation and Shift+Enter or Shift+Space,
which this page documents from source. The sheet also holds the rule cards, the scoring summary and the winnable-deal
grades.
