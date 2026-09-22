# Klondike Solitaire — Spec Pack

Context pack for building **Klondike Solitaire**, a calm, retro-styled, offline-capable single-page web app (React + TypeScript + Vite, GitHub Pages). Written to be copied into the new repository as `docs/spec/` and used as anchor context for GitHub Speckit (or OpenSpec) planning.

| File                                                                                                  | What it is                                                                                                                                                                                                        | Use it for                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [`mockup/klondike-mockup.html`](mockup/klondike-mockup.html)                                          | Playable single-file mockup (vanilla JS). Open it in a browser.                                                                                                                                                   | The visual and behavioural reference: look, layout, motion, interactions. **Reference only**; don't port its code structure. |
| [`mockup/screens/`](mockup/screens)                                                                   | 17 screenshots of the mockup: desktop and phone, light and dark, night cards, Draw 3 fan, legal targets, hint, sheets, win, plus landscape wide table, foldable side rails, foldable cover and Galaxy S25 (14–17) | Visual acceptance in Phases 5 and 7.                                                                                         |
| [`research.md`](research.md)                                                                          | Game knowledge base: rules, deal and seeding, winnability and solver, scoring, assistance logic, UX and accessibility facts, layout geometry, measurements, lessons learned                                       | **Source of truth for game logic** (cited as *R§n*).                                                                         |
| [`specification.md`](specification.md)                                                                | Product specification: modes, screens, sheets, behaviour, settings, look and feel, **EARS requirements `KS-*`**, acceptance scenarios                                                                             | **What** to build and how it must behave.                                                                                    |
| [`phased-design.md`](phased-design.md)                                                                | Stack, architecture, data model, algorithms, testing, CI/CD and **Phases 1–11 with Speckit seed prompts**                                                                                                         | **How** and in which order to build it.                                                                                      |

## Authority order
1. `specification.md` for behaviour, then `research.md` for rules and numbers. If they conflict, fix the documents; don't pick one silently.
2. `phased-design.md` for technical decisions (they may be revised by a phase's OpenSpec change, but record the change here).
3. The mockup for visuals only.

## How this spec pack is used
1. **Phase 0 (done):** the repo was created, this folder was copied to `docs/spec/`, and §2 of `phased-design.md` was folded into `AGENTS.md` as the constitution. OpenSpec — not Speckit — is installed and drives phase-by-phase implementation.
2. For each phase N, open an OpenSpec change scoped to that phase's capability (`openspec-propose` / `/opsx:propose`), with "Context: docs/spec/specification.md, docs/spec/research.md, docs/spec/phased-design.md (Phase N)". Then apply it (`/opsx:apply`) and archive it (`/opsx:archive`) per `AGENTS.md`'s "Sub-agent driven workflow".
3. Trace tests to requirement IDs (`KS-…`), so that Phase 9 can produce the traceability matrix.

## Decisions already made (summary)
- **Stack:** as in Minesweeper (https://github.com/sanyokkua/minesweeper) — Vite 8, React 19, TypeScript strict, Redux Toolkit, localStorage (a versioned record), vite-plugin-pwa, Vitest + RTL, Playwright, GitHub Pages under `/solitaire/` (repository `solitaire`).
- **Implementation choices:**
  - Hand-rolled Pointer Events drag and CSS-transform animations (no dnd-kit or Motion).
  - A bounded DFS solver in a Web Worker.
  - Seeded deals with shareable deal codes.
  - A UTC-based Daily deal.
- **Modes:** Draw 1 (winnable-only), Draw 3, Vegas and Daily.
- **Languages:** English and Ukrainian first; the catalog is built so more languages can be added later.
- **Screens:** fits every phone and foldable in the device matrix (`specification.md` §8.5) without scrolling, with a side-rail layout for landscape and a wide-table layout for very short screens.
