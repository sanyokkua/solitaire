# PWA layer

Progressive-web-app lifecycle behind two small gateways. It holds no game logic and imports nothing from `app`,
`features` or `ui`; the application reaches it only through injected gateways.

- `registerPwa.ts` — registers the service worker and returns the update gateway. The only importer of
  `virtual:pwa-register`, and only `main.tsx` imports it.
- `pwaGateway.ts` — `createPwaGateway(register)` returns `{ onUpdateReady(cb), applyUpdate() }`; `applyUpdate` calls
  `updateSW(true)`, which activates the waiting worker and reloads.
- `deferredGateway.ts` — `createDeferredPwaGateway(win, doc, register)` returns an update gateway at once and calls
  `register` only after `load` (immediately when the document is already `complete`).
- `installGateway.ts` — `createInstallGateway(win)` captures `beforeinstallprompt` (calling `preventDefault`), clears
  it on `appinstalled`, and exposes `onAvailabilityChange(cb)` and `prompt()` (`accepted`, `dismissed` or
  `unavailable`).

The boundaries are enforced by `tests/unit/repo/layerBoundaries.test.ts`.
