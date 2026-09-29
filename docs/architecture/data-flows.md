# Data flows

Diagrams of the main runtime paths. Names in the diagrams are the modules described in
[state-and-persistence.md](state-and-persistence.md) and [domain-and-solver.md](domain-and-solver.md).

## Move: tap or drag to saved game

Tap, drag and keyboard all end in the same thunk. The board hooks (`src/ui/board/useBoardActions.ts`,
`src/ui/board/useBoardPointer.ts`, `src/ui/board/useGameShortcuts.ts`) dispatch
`src/features/game/gameThunks.ts#play` with a `Command`; a smart tap first asks
`src/domain/smartTap.ts#bestTarget` for the destination, and a drop uses the legal target with the largest overlap.
The UI never applies rules itself.

```mermaid
sequenceDiagram
    participant UI as Board hooks
    participant Play as play
    participant Commit as commitCommand
    participant Engine as applyCommand
    participant Store as Redux store
    participant Writer as Persistence writer
    participant LS as localStorage

    UI->>Play: dispatch play(command)
    Note over Play: ignored when busy, no game, or won
    Play->>Commit: commitCommand(command, new)
    Commit->>Store: accrued (settle clock)
    Commit->>Engine: applyCommand(current, command)
    alt refused (same state reference)
        Engine-->>Commit: same state, rejected event
        Commit-->>Play: accepted false
        Play->>Store: announced (refusal reason)
    else accepted
        Engine-->>Commit: next state, events
        Commit->>Store: committed(next)
        Commit->>Store: played, countedSet on first move
        Commit->>Store: won, winRecorded, dailyCompleted on win
        Commit-->>Play: accepted true, events
        Play->>Store: announced(events)
        opt autoSafe on
            Play->>Play: chain safe sends via commitCommand(same), 160 ms apart
        end
        Play->>Store: checkDeadEnd
    end
    Store-->>Writer: subscribe callback
    Writer->>Writer: schedule save 250 ms after last change
    Writer->>LS: setItem solitaire.local-state
```

Notes:

- A refusal changes nothing but the clock settlement. A `pass-limit` refusal also raises the `no-redeals` notice.
- The `interaction` slice clears the selection and hint on `committed`, `replaced`, `undone`, `redone`, `installed`
  and `cleared`.
- Time-only changes are saved at most every 5 s; see the writer notes in
  [state-and-persistence.md](state-and-persistence.md#persistence).

## New deal

`src/features/game/sessionThunks.ts#startGame` reads `winnableOnly`, asks the deal service, and installs the result.
Only Draw 1 with the switch on, and Daily, use the worker; other requests are dealt at once on the calling thread.

```mermaid
sequenceDiagram
    participant UI as Home or Game
    participant Nav as dealNewGame / requestNewDeal
    participant Start as startGame
    participant Svc as Deal service
    participant Client as Solver client
    participant W as Solver worker
    participant Store as Redux store

    UI->>Nav: choose mode
    Nav->>Store: close sheet, route game
    Nav->>Start: startGame(mode)
    Start->>Svc: deal(mode, winnableOnly, onProgress)
    Svc->>Client: cancel pending, findWinnable(seeds, budget, mode)
    Client->>W: findWinnable request
    loop each candidate seed
        W-->>Client: progress(attempt)
        Client-->>Svc: attempt
        Svc-->>Start: onProgress(overlay, attempt)
        Start->>Store: dealingProgressed
        Note over W: solve(deal, budget) until first win
    end
    W-->>Client: findWinnable reply (seed, verdict, attempts)
    Client-->>Svc: ok
    Svc-->>Start: dealt(dealFromSeed(seed, mode, verdict, attempts))
    alt not cancelled, epoch and start id unchanged
        Start->>Store: streakBroken for replaced started game
        Start->>Store: installed(state, dayKey)
    else superseded
        Start-->>Start: change nothing
    end
    Start->>Store: dealingEnded (latest start only)
```

Notes:

- `overlay` in the progress report becomes true after 160 ms, which is when the dealing overlay shows.
- A new `deal` cancels the pending one and terminates a busy worker; the older start delivers nothing.
- If the worker fails, the first candidate seed is dealt unverified (`random`, 1 attempt).
- Draw 3, Vegas and Draw 1 with the switch off skip the worker: one `cryptoSeed`, `dealFromSeed`, `installed`.
- `restart` and `playDealCode` also install directly with `dealFromSeed`, without the service.

## Hint

`src/features/interaction/interactionThunks.ts#requestHint`. A hint costs no score or move and never changes the game.

```mermaid
flowchart TD
    A["requestHint"] --> B{"game present, not won, not busy"}
    B -- "no" --> Z["return"]
    B -- "yes" --> C["advise(current)"]
    C --> D{"dead end"}
    D -- "yes" --> E["notice dead-end and announce deadEnd"]
    D -- "no" --> F{"same epoch and position already pending"}
    F -- "yes" --> Z
    F -- "no" --> G["pendingHintSet, dealService.hint"]
    G --> H{"draw 1 and no pass limit"}
    H -- "yes" --> I["solver hint, 3000 nodes, 150 ms"]
    H -- "no" --> J["heuristic hint"]
    I --> K{"answer in time"}
    K -- "yes" --> L["hint from solver"]
    K -- "no or none" --> J
    J --> L2["hint from heuristic"]
    L --> M{"game and position unchanged"}
    L2 --> M
    M -- "no" --> Z
    M -- "yes" --> N["hintSet, announce hinted"]
    N --> O["wait 2200 ms, hintCleared"]
```

A pending deal makes the solver client answer `busy`, so the heuristic answers.

## Startup and restore

`src/main.tsx` calls `src/app/lifecycle.tsx#startApp`.

```mermaid
sequenceDiagram
    participant Main as main.tsx
    participant Start as startApp
    participant Load as loadInitialState
    participant GW as Storage gateway
    participant Store as Redux store
    participant Ctl as Theme and locale controllers
    participant R as React

    Main->>Start: startApp(root, pwa gateways)
    Start->>Load: loadInitialState(gateway, languages)
    Load->>GW: read solitaire.local-state
    alt no record
        Load-->>Start: default preferences, no notice
    else valid record
        Load-->>Start: preferences, stats, game session
    else malformed, invalid or future
        Load->>GW: copy raw string to backup key if free or identical
        Load-->>Start: defaults, storage-read or storage-read-only
    else storage unreadable
        Load-->>Start: defaults, read-only
    end
    Start->>Store: createAppStore(preloadedState)
    Start->>Store: visibility, reduced motion, notices
    Start->>Ctl: apply theme, lang, title
    Start->>Start: start clock ticker and writer, connect save port
    Start->>Start: attach visibilitychange, pagehide, media query listeners
    Start->>R: render App
```

A restored game arrives with `route` still `home`; the Continue action (`continueGame`) shows the Game screen only
when the game is started and still playing. The clock does not run until the Game screen is shown.

## PWA update and install

`src/main.tsx` builds two gateways and passes them to `startApp`.

- Update: `src/pwa/deferredGateway.ts#createDeferredPwaGateway` exists immediately but calls
  `src/pwa/registerPwa.ts#registerPwa` only after `load` (or at once if the document is complete), so registration
  never delays the first render. `src/pwa/pwaGateway.ts#createPwaGateway` wraps vite-plugin-pwa's `registerSW`
  (`registerType: 'prompt'`): `onNeedRefresh` notifies listeners, and `applyUpdate` calls `updateSW(true)`, which
  activates the waiting worker and reloads the page.
- Install: `src/pwa/installGateway.ts#createInstallGateway` listens from the start for `beforeinstallprompt` (kept
  and default-prevented) and `appinstalled`, and reports availability.

```mermaid
sequenceDiagram
    participant SW as Service worker
    participant PG as PWA gateway
    participant Life as startApp
    participant Store as Redux store
    participant UI as Notices
    participant Thunk as applyUpdate
    participant Saver as Save port and writer

    SW-->>PG: new worker waiting (onNeedRefresh)
    PG-->>Life: onUpdateReady callback
    Life->>Store: noticeRaised update-ready
    Note over Store: ignored if the player already chose Later
    Store-->>UI: show update-ready notice
    alt player chooses Update
        UI->>Thunk: dispatch applyUpdate
        Thunk->>Saver: flushQuietly (errors ignored)
        Thunk->>PG: applyUpdate
        PG->>SW: activate waiting worker, reload page
    else player chooses Later
        UI->>Store: updateDeferred (notice removed for the session)
    end
```

The update-ready text warns that the current game will not be kept when persistence is read-only or the last save
failed at the moment the notice appeared (`src/ui/components/Notices.tsx`). Update applies in every case.

Install: the gateway reports availability, `startApp` dispatches `installableChanged`, the Home Install link shows,
and `src/app/pwaThunks.ts#installApp` prompts and then sets `installable` to false whatever the choice.

Without gateways (tests, dev) `ThunkExtra.pwa` is `inertPwaPort`: no update notice and no install offer.

## Related

- [Domain, solver and deal service](domain-and-solver.md)
- [State and persistence](state-and-persistence.md)
