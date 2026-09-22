# Solver layer

The bounded-DFS Klondike solver. Lands in Phase 3 — Solver & deal service.

- `solver.ts` — bounded DFS, returns `{ verdict, nodes, line? }`
- `solver.worker.ts` — Web Worker entry point: `solve`, `findWinnable`, `hint`

This layer imports nothing from React, Redux, the DOM or storage (it may depend on `src/domain`).
It is pure and runs inside a Web Worker, off the main thread.
