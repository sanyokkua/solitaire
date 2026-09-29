# Manual checks

Checks that no automated test can make on the machines the tests run on: a real phone, a real installation, the browser's
own audit. Each row names the KS ids it covers, so the [traceability matrix](traceability.md) counts it as coverage for
those ids. `npm run trace` reads the table below; the second column must hold the ids, comma-separated.

## Checks

| Check | KS ids | Procedure | Target | Result |
| ----- | ------ | --------- | ------ | ------ |

## How a check is recorded

- **Check.** A short name.
- **KS ids.** Every id the check covers. An id that no requirement cites fails the traceability test.
- **Procedure.** What to do and on what, so that someone else repeats it.
- **Target.** What counts as a pass, and whether it is reported only ("informational").
- **Result.** The latest dated result with the device and the browser, or a dated waiver with its reason. A check with no
  result is not yet done.

Keep a cell on one line and never put a `|` in it.
