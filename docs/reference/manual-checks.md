# Manual checks

Checks that no automated test can make on the machines the tests run on: a real phone, a real installation, the browser's
own audit. Each row names the KS ids it covers, so the [traceability matrix](traceability.md) counts it as coverage for
those ids. `npm run trace` reads the table below; the second column must hold the ids, comma-separated.

## Checks

| Check                         | KS ids                          | Procedure                                                                                                                                                                                                                                                                                   | Target                                                                                                             | Result                                                                                                                       |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Drag smoothness               | KS-PERF-01                      | On a mid-range phone with the production build, drag a run of cards across the board and let the card animations play; record the frame rate with the browser's remote-debugging Performance panel. `tests/e2e/dragPerf.spec.ts` gives a throttled desktop reference.                       | 60 fps while dragging and animating; reported, not gated                                                           | Pending: needs a mid-range phone.                                                                                            |
| Deal latency                  | KS-PERF-02                      | On a mid-range phone with the production build, deal a Winnable game in Draw 1, Draw 3 and Vegas from Home and time the dealing overlay from the tap to the board; then wait until the pool is warm and deal again in each mode. `tests/e2e/dealLatency.spec.ts` gives a desktop reference. | On demand: for information (300 ms median and 1.5 s p95 for Draw 1); from a warm pool: within 100 ms in every mode | Pending: needs a mid-range phone.                                                                                            |
| Lighthouse and installability | KS-PERF-03, KS-PWA-02           | `npm run build && npm run preview`, then Lighthouse with the mobile preset on `http://localhost:4173/solitaire/` in a clean profile; install the app from Chrome and from Edge.                                                                                                             | Performance score at least 90; installable                                                                         | 2026-09-28, Lighthouse 13.4.1 CLI, median of 3: performance 94 (FCP 2.3 s, LCP 2.6 s). Installed by hand in Chrome and Edge. |
| Real-device fit               | KS-GEN-03, KS-GEN-05, KS-GEN-10 | On each real device, open the app in the browser and installed, in portrait and landscape; record `innerWidth`×`innerHeight`, whether every control and card clears the safe areas, and compare the sizes with the [device matrix](device-matrix.md).                                       | Sizes match the device matrix; nothing scrolls, clips or hides under a safe area                                   | Pending: needs the real devices.                                                                                             |
| iOS scroll suppression        | KS-INP-10                       | On an iPhone, in Safari and installed, drag a card by touch, and drag from the empty parts of the board.                                                                                                                                                                                    | The page neither scrolls nor zooms; no text selection, callout or context menu opens                               | Pending: needs an iPhone.                                                                                                    |

## How a check is recorded

- **Check.** A short name.
- **KS ids.** Every id the check covers. An id that no requirement cites fails the traceability test.
- **Procedure.** What to do and on what, so that someone else repeats it.
- **Target.** What counts as a pass, and whether it is reported only ("informational").
- **Result.** The latest dated result with the device and the browser, or a dated waiver with its reason. A check with no
  result is not yet done.

Keep a cell on one line and never put a `|` in it.
