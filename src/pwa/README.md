# PWA layer

Progressive-web-app lifecycle. Lands in Phase 8 — PWA, offline & delivery hardening.

- `registerPwa.ts` — service-worker registration
- `installGateway.ts` — install-prompt capture and exposure
- `pwaGateway.ts` — update lifecycle (waiting/activated states)

This layer wraps browser PWA APIs and is consumed by `App.tsx`. It holds no game logic.
