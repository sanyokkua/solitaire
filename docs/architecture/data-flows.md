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

`src/features/game/sessionThunks.ts#startGame` reads `winnableOnly` and the Difficulty (sent as `target`, the grade
wanted), asks the deal service, and installs the result. With the switch on, Draw 1, Draw 3 and Vegas are served at
once from the graded-spare pool when it holds a deal of the target grade, and otherwise use the player's worker, at the
mode's budget; Daily always uses the worker (always for `any`) and never the pool; with the switch off the request is
dealt at once on the calling thread.

```mermaid
sequenceDiagram
    participant UI as Home or Game
    participant Nav as dealNewGame / requestNewDeal
    participant Start as startGame
    participant Svc as Deal service
    participant Client as Solver client
    participant W as Solver worker
    participant Store as Redux store

    participant Pool as Deal pool

    UI->>Nav: choose mode
    Nav->>Store: close sheet, route game
    Nav->>Start: startGame(mode)
    Start->>Svc: deal(mode, winnableOnly, target, onProgress)
    Svc->>Client: cancel pending (the pool's own client is left alone)
    Svc->>Pool: setBusy(true), take(mode, target)
    alt pool hit (switch on, not Daily)
        Pool-->>Svc: seed, grade, attempts
        Svc->>Pool: setBusy(false)
        Svc-->>Start: dealt(dealFromSeed(seed, mode, win, attempts, grade)), no progress
    else pool miss, or Daily
        Svc->>Client: findWinnable(seeds, budget, mode, selection, known from the verdict cache)
        Client->>W: findWinnable request
        loop each candidate seed not already known
            W-->>Client: progress(attempt), outcome(seed verdict)
            Client-->>Svc: attempt, outcome (recorded in the verdict cache)
            Svc-->>Start: onProgress(overlay, attempt)
            Start->>Store: dealingProgressed
            Note over W: solve(deal, budget), grade each win, until the target grade (or GRADE_LIMIT wins)
        end
        W-->>Client: findWinnable reply (seed, verdict, attempts, grade, spares)
        Client-->>Svc: ok
        Svc->>Pool: deposit(spares) (not Daily), setBusy(false) if still current
        Svc-->>Start: dealt(dealFromSeed(seed, mode, verdict, attempts, grade))
    end
    alt not cancelled, epoch and start id unchanged
        Start->>Store: streakBroken for replaced started game
        Start->>Store: installed(state, dayKey)
    else superseded
        Start-->>Start: change nothing
    end
    Start->>Store: dealingEnded (latest start only)
```

Notes:

- `overlay` in the progress report becomes true after 160 ms, which is when the dealing overlay shows. A pooled deal
  reports no progress and starts no overlay timer.
- A new `deal` cancels the pending one and terminates a busy player worker; the older start delivers nothing. It never
  cancels the pool's fill, which runs on a worker of its own.
- The pool starts no fill while a request that may search is pending; a superseded search does not end the pause of the
  newer one. `prefetch(choice)` and `pause()` set what the pool fills and when (the controller that calls them lands
  with task 9.6).
- Every search sends the verdict cache's entries for its seeds as `known`, so a repeated Daily request searches none of
  its candidates again.
- If the worker fails, the first candidate seed is dealt unverified and ungraded (`random`, 1 attempt, no grade), in every mode.
- A requested grade that is not found within `GRADE_LIMIT` proven candidates deals the closest one, labelled with its own grade.
- With the switch off, every mode skips the worker: one `cryptoSeed`, `dealFromSeed`, `installed`; the Difficulty is ignored.
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
    G --> I["solver hint in every mode, 3000 nodes, 150 ms"]
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
