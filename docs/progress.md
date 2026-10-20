# Implementation Progress Log — Manual Mode

Chronological record of phases, tasks, files changed, and verification results.

---

## Entry 1 — 2026-10-19 — Phases 1–4: Repository Audit & Documentation

- **Phase:** Phase 1 – Phase 4
- **Task:** Audit repository architecture, trace PCOB data flow, build data-availability matrix, and author initial specification documents.
- **Status:** `COMPLETED`
- **Files Affected:**
  - `docs/repository-audit.md`
  - `docs/data-availability-matrix.md`
  - `docs/manual-mode-requirements.md`
  - `docs/manual-mode-architecture.md`
  - `docs/manual-mode-decisions.md`
- **Changes Made:** Documented full system data flow (`PcobSource` → `PcobMapper` → `MatchStore` → `computeStandings` → `LiveHub` → `OverlayPage` / `AdminPage`), verified field-by-field PCOB vs. Manual feasibility, and designed adapter-boundary manual architecture.
- **Tests Executed:** None (read-only audit phase).
- **Issues Encountered:** None.
- **Next Steps:** Present Phase 5 Review Gate questions to user.

---

## Entry 2 — 2026-10-19 — Phases 5–6: Review Gate & Implementation Planning

- **Phase:** Phase 5 – Phase 6
- **Task:** Resolve product/UX questions (`D-01` through `D-08`) with user and establish implementation plan and checkpoint tracking.
- **Status:** `COMPLETED`
- **Files Affected:**
  - `docs/manual-mode-decisions.md`
  - `docs/implementation-plan.md`
  - `docs/checkpoint.md`
  - `docs/progress.md`
- **Changes Made:** Recorded user approvals (team-level manual inputs, 4-bar alive indicator with gray dead/eliminated bars and grayed-out knocked-out teams, `KNOCKED` hidden in legend during Manual Mode, dedicated `Manual control` tab + sticky header Mode Toggle, explicit map close in Manual Mode). Created ordered task breakdown (`TASK-01` – `TASK-06`).
- **Tests Executed:** None yet.
- **Decisions Requiring Approval:** All resolved.
- **Next Steps:** Begin Phase 7 implementation starting with `TASK-01` (`@cdf/shared` schemas).

---

## Entry 3 — 2026-10-19 — Phase 7: Shared Contracts, Backend ManualStore & Mode Coordinator (`TASK-01`–`TASK-03`)

- **Phase:** Phase 7
- **Task:** `TASK-01`, `TASK-02`, `TASK-03`
- **Status:** `COMPLETED`
- **Files Affected:**
  - `shared/src/domain/ingest.ts`
  - `shared/src/domain/manual.ts`
  - `shared/src/versions.ts`
  - `shared/src/index.ts`
  - `backend/src/ingest/index.ts`
  - `backend/src/state/match-store.ts`
  - `backend/src/state/manual-store.ts`
  - `backend/src/state/manual-store.test.ts`
  - `backend/src/routes/health.ts`
  - `backend/src/routes/manual.ts`
  - `backend/src/routes/manual.test.ts`
  - `backend/src/app.ts`
- **Changes Made:**
  - Added `'manual'` to `ingestSourceKindSchema`, created `manual.ts` domain contracts, and bumped `PROTOCOL_VERSION` to `7`.
  - Implemented `ManualStore` (`backend/data/manual-match.json`) with reversible `eliminatedSeq`, `placementOverride`, `toIngestUpdate()` (all 4 player slots explicitly emitted), and `resetMatch({ seedFromTeams })` failover support.
  - Wired isolated `autoMatchStore` and `manualMatchStore` via `createDelegatingMatchStore`, stopped/started `ingestSource` on mode switch, and registered `/api/manual/*` routes.
- **Tests Executed:** `npm test -w @cdf/backend` — 21 test files, 270 tests passed.
- **Issues Encountered:** None.
- **Next Steps:** Complete `TASK-04` and `TASK-05` (frontend overlay and admin UI).

---

## Entry 4 — 2026-10-19 — Phases 7–9: Frontend Overlay, Admin Manual Control & Final Verification (`TASK-04`–`TASK-06`)

- **Phase:** Phase 7 – Phase 9
- **Task:** `TASK-04`, `TASK-05`, `TASK-06`
- **Status:** `COMPLETED`
- **Files Affected:**
  - `frontend/src/lib/api.ts`
  - `frontend/src/features/admin/ManualControl.tsx`
  - `frontend/src/pages/AdminPage.tsx`
  - `frontend/src/pages/OverlayPage.tsx`
  - `frontend/src/components/overlay/LeaderboardOverlay.tsx`
  - `frontend/src/components/overlay/AlivePlayerBars.tsx`
  - `frontend/src/components/overlay/TeamRow.tsx`
- **Changes Made:**
  - Updated `LeaderboardOverlay.tsx`, `AlivePlayerBars.tsx`, and `TeamRow.tsx` so Manual Mode hides `KNOCKED` from the footer legend and renders dead slots / eliminated teams in gray.
  - Added `ManualControl.tsx` (`Manual control` tab) with 1-click alive buttons (`OUT`, `1`, `2`, `3`, `4`), elimination steppers (`-1`, `+1`, `+2`, `+4`, numeric input), placement override selector, live rank/points preview, "Copy from PCOB", "Close current map now", and "Reset manual match".
  - Added always-visible Mode Toggle (`PCOB API` / `Manual`), Manual status indicator, and protocol-mismatch warning banner in `AdminPage.tsx`.
- **Tests Executed:** Full `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, and `npm run build` passed with exit code `0`.
- **Issues Encountered:** None.
- **Next Steps:** Deliver final verification report to user.

---

## Entry 5 — 2026-10-19 — UI/UX Audit, Design Research, Specifications & Phase 10 Gate

- **Phase:** Phase 1 – Phase 11 (UI/UX & Broadcast Overlays Task)
- **Task:** Complete UI/UX responsiveness audit, external design reference research, specification authoring, Phase 10 user approval gate, and Phase 11 workstream planning (`WS-1`–`WS-4`).
- **Status:** `COMPLETED`
- **Files Affected:**
  - `docs/ui-responsive-audit.md` (created)
  - `docs/broadcast-overlay-requirements.md` (created)
  - `docs/match-configuration-design.md` (created)
  - `docs/ui-design-references.md` (created)
  - `docs/ui-implementation-decisions.md` (created)
  - `docs/implementation-plan.md` (updated with `WS-1`–`WS-4`)
  - `docs/checkpoint.md` (updated)
  - `docs/progress.md` (updated)
- **Changes Made:** Diagnosed root causes of admin responsiveness issues across all 6 viewport bands; designed Elimination Notification Overlay, Match Information Overlay, Match/Map Configuration workflow, and Logo Visibility Toggle; recorded user approvals (`D-UI-01`–`D-UI-06`, including toggleable elimination count and ON/OFF switches for all features).
- **Tests Executed:** None yet (pre-implementation gate).
- **Issues Encountered:** None.
- **Next Steps:** Execute `WS-1` (`@cdf/shared` and `@cdf/backend` schema and store updates).

---

## Entry 6 — 2026-10-20 — Phase 12: Implementation & Verification of `WS-1` through `WS-4`

- **Phase:** Phase 12
- **Task:** Execute `WS-1` (Shared Schemas & Backend Match/Map Config), `WS-2` (Broadcast Overlays), `WS-3` (Admin Match/Map Config, Appearance Toggles, Multi-Layer Preview & OBS URLs), and `WS-4` (Responsive Admin Redesign & Verification).
- **Status:** `COMPLETED`
- **Files Affected:**
  - `shared/src/versions.ts`, `shared/src/config/overlay-instance.ts`, `shared/src/protocol/feedback.ts`, `shared/src/domain/series.ts`, `shared/src/protocol/live.ts`, `shared/src/index.ts`
  - `backend/src/state/series-store.ts`, `backend/src/routes/series.ts`, `backend/src/routes/feedback.ts`, `backend/src/ws/live-hub.ts`, `backend/src/app.ts`
  - `backend/src/state/series-store.test.ts`, `backend/src/routes/series.test.ts`, `backend/src/ws/live-hub.test.ts`
  - `frontend/src/components/overlay/TeamRow.tsx`, `frontend/src/components/overlay/LeaderboardOverlay.tsx`, `frontend/src/components/overlay/EliminationOverlay.tsx`, `frontend/src/components/overlay/MatchInfoOverlay.tsx`, `frontend/src/components/overlay/overlays.test.tsx`
  - `frontend/src/hooks/useEliminationQueue.ts`, `frontend/src/hooks/useEliminationQueue.test.ts`
  - `frontend/src/pages/OverlayPage.tsx`, `frontend/src/pages/OverlayRoute.tsx`, `frontend/src/router.tsx`
  - `frontend/src/lib/api.ts`, `frontend/src/features/admin/MatchConfigBar.tsx`, `frontend/src/features/admin/AppearanceEditor.tsx`, `frontend/src/features/admin/OverlayPreview.tsx`
  - `frontend/src/pages/AdminPage.tsx`, `frontend/src/features/admin/ManualControl.tsx`, `frontend/src/features/admin/SeriesControl.tsx`, `frontend/src/features/admin/ScoringEditor.tsx`, `frontend/src/features/admin/TeamRosterEditor.tsx`, `frontend/src/features/admin/MapResultDialog.tsx`, `frontend/src/features/admin/InstanceToolbar.tsx`, `frontend/src/styles/globals.css`
- **Changes Made:**
  - Bumped `PROTOCOL_VERSION` to `8`; added `showLogos`, `showEliminationAlerts`, `showEliminationAlertElims`, `showMatchInfo`, and `showMatchInfoMapName` to `OverlayAppearance` and `/feedback`; added `activeMatchNumber`, `activeMapName`, `PUBG_MAP_PRESETS`, `PUT /api/series/match-info`, and `LiveSnapshot.matchInfo`.
  - Implemented `EliminationOverlay`, `MatchInfoOverlay`, 5-column logo-free `LeaderboardOverlay` / `TeamRow` mode, `useEliminationQueue` state machine with baseline deduplication, and routes `/overlay/elimination`, `/overlay/:instanceId/elimination`, `/overlay/match-info`, and `/overlay/:instanceId/match-info`.
  - Created `MatchConfigBar.tsx` with Draft → "Apply to Live" workflow in both `Series control` and `Manual control`, added `[ON / OFF]` toggles in `AppearanceEditor.tsx`, added preview layer toggles and `Test Elimination Alert` button in `OverlayPreview.tsx`, and added copyable OBS URLs for all 3 overlays in `AdminPage.tsx`.
  - Redesigned Admin Panel responsiveness (`320px`–`1440px+`): `.cdf-overlays-layout` responsive grid, horizontally scrollable 7-tab `<nav>`, Mobile Operator Cards (`< 768px`) + sticky-column Desktop Table (`>= 768px`) with View Mode toggle and status filter pills in `ManualControl.tsx`, and responsive grids across `AppearanceEditor`, `ScoringEditor`, `TeamRosterEditor`, `SeriesControl`, and `MapResultDialog`.
- **Tests Executed:**
  - `npm test`: **26 test files passed, 317 tests passed** (`21` backend test files / `273` tests; `5` frontend test files / `44` tests).
  - `npm run typecheck`: Passed (`0` errors across `@cdf/shared`, `@cdf/backend`, `@cdf/frontend`).
  - `npm run lint`: Passed (`0` warnings, `0` errors).
  - `npm run build` & `npm run format:check`: Passed.
- **Issues Encountered:** Resolved `MatchState.phase === 'idle'` warmup check in `useEliminationQueue.ts` and `showEliminationAlerts` gating in `EliminationOverlay.tsx` caught by unit tests.
- **Next Steps:** Task complete.

---

## Entry 7 — 2026-10-20 — Part 3 Phases 1–2: PMCC 2026 Visual Audit, Broadcast Reference Research & Feature Specifications

- **Phase:** Part 3 — Phase 1 & Phase 2
- **Task:** Inspect `assets/KV_2026 PMCC ID.png` and sample exact pixel clusters; research PUBG Esports broadcast references; audit repository support for persistent `teamNo`, automatic Final-4 top bar, WWCD victory screen, post-game detailed standings (`ClosedMapResult`), and customizable post-game background media; author all Phase 2 specification documents.
- **Status:** `COMPLETED` (Awaiting User Approval Gate before Phase 3 coding)
- **Files Affected:**
  - `docs/pmcc-visual-identity-analysis.md` (created)
  - `docs/broadcast-design-references.md` (created)
  - `docs/final-four-leaderboard-audit.md` (created)
  - `docs/wwcd-screen-requirements.md` (created)
  - `docs/postgame-standings-requirements.md` (created)
  - `docs/broadcast-ui-decisions.md` (created)
  - `docs/implementation-plan.md` (updated with `WS-3.1`–`WS-3.4`)
  - `docs/checkpoint.md` (updated)
  - `docs/progress.md` (updated)
- **Changes Made:**
  - Decompressed and sampled `assets/KV_2026 PMCC ID.png` (`3840×2160` RGBA), extracting exact hex tokens for Deep Espresso Obsidian (`#160F0A`), Mahogany (`#26180F`), Burnished Bronze (`#816036`), Nib-Trophy Gold (`#E5A93C` / `#EEB058`), Champagne (`#E7D8AD`), Parchment Ivory (`#F9EDD9`), Airdrop Crimson (`#A83820`), Tarp Slate-Teal (`#607A6E`), and Helmet Gunmetal (`#3D362B`).
  - Documented specifications and data flows for Features 1–6 and recorded proposed architectural decisions `D-PMCC-01` through `D-PMCC-07`. No application source code modified during Phase 1–2.
- **Tests Executed:** Read-only pixel sampling script; no source code changes yet.
- **Issues Encountered:** None.
- **Next Steps:** Present Phase 2 Review Gate findings and questions to user and await approval before Phase 3 implementation.

---

## Entry 8 — 2026-10-20 — Part 3 Phases 3–4: Implementation & Verification of `WS-3.1` through `WS-3.4`

- **Phase:** Part 3 — Phase 3 (Implementation) & Phase 4 (Verification)
- **Task:** Execute `WS-3.1`, `WS-3.2`, `WS-3.3`, and `WS-3.4` according to approved decisions `D-PMCC-01` through `D-PMCC-07`.
- **Status:** `COMPLETED`
- **Files Affected:**
  - `shared/src/versions.ts`, `shared/src/config/overlay-instance.ts`, `shared/src/protocol/live.ts`, `shared/src/protocol/feedback.ts`, `shared/src/index.ts`
  - `backend/src/persistence/migrations.ts`, `backend/src/persistence/migrations.test.ts`
  - `backend/src/persistence/background-store.ts`, `backend/src/persistence/background-store.test.ts`
  - `backend/src/routes/backgrounds.ts`, `backend/src/routes/backgrounds.test.ts`, `backend/src/routes/feedback.ts`
  - `backend/src/backup/export.ts`, `backend/src/backup/import.ts`
  - `backend/src/ws/live-hub.ts`, `backend/src/ws/live-hub.test.ts`, `backend/src/app.ts`
  - `frontend/src/styles/globals.css`, `frontend/src/components/overlay/overlay-scale.ts`, `frontend/src/components/overlay/broadcast-state.ts`
  - `frontend/src/components/overlay/TeamRow.tsx`, `frontend/src/components/overlay/LeaderboardOverlay.tsx`, `frontend/src/components/overlay/FinalFourOverlay.tsx`, `frontend/src/components/overlay/WwcdOverlay.tsx`, `frontend/src/components/overlay/PostGameOverlay.tsx`, `frontend/src/components/overlay/MatchInfoOverlay.tsx`, `frontend/src/components/overlay/EliminationOverlay.tsx`, `frontend/src/components/overlay/overlays.test.tsx`
  - `frontend/src/pages/OverlayPage.tsx`, `frontend/src/pages/OverlayRoute.tsx`, `frontend/src/router.tsx`
  - `frontend/src/lib/api.ts`, `frontend/src/features/admin/AppearanceEditor.tsx`, `frontend/src/features/admin/OverlayPreview.tsx`, `frontend/src/pages/AdminPage.tsx`
- **Changes Made:**
  - **`WS-3.1`:** Bumped `PROTOCOL_VERSION = 9` and `CONFIG_SCHEMA_VERSION = 4`; added `PMCC_2026_OVERLAY_COLORS`, `LEGACY_FACTORY_OVERLAY_COLORS`, `postGameBackgroundSchema`, `showTeamNumbers`, `showFinalFourLayout`, and `showWwcdOverlay`; implemented v3→v4 factory palette migration in `migrations.ts`; implemented `BackgroundStore` with magic-byte validation (`PNG`, `JPEG`, `WebP`, `MP4`, `WebM`) and Backup ZIP integration; added `POST / DELETE /api/overlays/:instanceId/background` and `/api/backgrounds/:file` static serving; added `lastClosedMap` to `LiveSnapshot` in `LiveHub`.
  - **`WS-3.2`:** Applied PMCC 2026 visual identity tokens across admin and overlays; added persistent `T01`–`T25` slot badge (`formatTeamSlot`) to `TeamRow`, `FinalFourOverlay`, `WwcdOverlay`, `PostGameOverlay`, and `EliminationOverlay`; implemented `FinalFourOverlay` with 4-card top-center retention and grayed-out knocked/eliminated state at 3 and 2 alive teams (`D-PMCC-02` / `A1`); implemented `WwcdOverlay` with automatic transition at 1 remaining team plus dedicated routes `/overlay/wwcd` & `/overlay/:instanceId/wwcd`, rendering real PCOB player cards vs. Manual Mode survivor bars (`D-PMCC-03` / `A2`).
  - **`WS-3.3`:** Implemented `PostGameOverlay` (`/overlay/postgame` and `/overlay/:instanceId/postgame`) backed by `snapshot.lastClosedMap` (with live finished-match fallback), displaying the `#1 WWCD Winner` spotlight card on the left and all teams (`#1–#25`) in a 1-or-2-column standings table on the right (`D-PMCC-04` / `A3`), plus an isolated `z-0` background `<img>`/`<video>` layer with `opacity` and `blur` (`D-PMCC-05`).
  - **`WS-3.4`:** Added `uploadOverlayBackground` and `deleteOverlayBackground` to `frontend/src/lib/api.ts`; updated `AppearanceEditor.tsx` with switches for `showTeamNumbers`, `showFinalFourLayout`, `showWwcdOverlay`, an **"Apply PMCC 2026 Theme"** button, and the **Post-game standings background** uploader and sliders; added **Preview screen** mode selector (`Auto (Live)`, `Tower`, `Final-4`, `WWCD`, `Post-Game`) to `OverlayPreview.tsx`; added copyable OBS URLs for WWCD and Post-Game overlays in `AdminPage.tsx`.
- **Tests Executed:**
  - `npm test`: **28 test files passed, 334 tests passed** (`23` backend test files / `283` tests; `5` frontend test files / `51` tests).
  - `npm run typecheck`: Passed (`0` errors across `@cdf/shared`, `@cdf/backend`, `@cdf/frontend`).
  - `npm run lint`: Passed (`0` warnings, `0` errors).
  - `npm run format:check` & `npm run build`: Passed (`0` errors).
- **Issues Encountered:** None remaining.
- **Next Steps:** Task complete.

---

## Entry 9 — 2026-10-20 — Part 4: Separate Final-4 & WWCD Overlay Routing & Visibility Fix

- **Phase:** Part 4 (`WS-4.1` → `WS-4.4`)
- **Task:** Separate `/main`, `/final4`, `/wwcd`, `/match-info`, and `/postgame` into dedicated overlay routes, fix Final-4 horizontal off-centering, implement automated visibility coordination across broadcast States A–D, update Admin preview and copyable OBS URLs, and verify with automated unit/regression tests.
- **Status:** `COMPLETED`
- **Files Affected:**
  - `frontend/src/router.tsx`
  - `frontend/src/pages/OverlayRoute.tsx`
  - `frontend/src/pages/OverlayPage.tsx`
  - `frontend/src/components/overlay/FinalFourOverlay.tsx`
  - `frontend/src/components/overlay/WwcdOverlay.tsx`
  - `frontend/src/features/admin/OverlayPreview.tsx`
  - `frontend/src/pages/AdminPage.tsx`
  - `frontend/src/components/overlay/overlays.test.tsx`
  - `docs/implementation-plan.md`
  - `docs/checkpoint.md`
  - `docs/progress.md`
- **Changes Made:**
  - **`WS-4.1` (Route Registration & Isolation):** Added `OverlayFinalFourRoute` and `OverlayInstanceFinalFourRoute` in `OverlayRoute.tsx`; registered `/overlay/final4`, `/overlay/final-four`, `/overlay/$instanceId/final4`, and `/overlay/$instanceId/final-four` alongside root shortcut routes (`/main`, `/final4`, `/wwcd`, `/match-info`, `/postgame`, `/elimination`) in `router.tsx`; updated `OverlaySurfaceMode` to include `'final-four'`. Removed embedded `FinalFourOverlay` and `WwcdOverlay` from `LeaderboardOverlay` rendering in `OverlayPage.tsx`, ensuring `/main` strictly renders the vertical tower.
  - **`WS-4.2` (Centering & Coordinated Visibility):** Fixed Final-4 horizontal alignment by removing inline `transform: translateX(-50%)` (which conflicted with Framer Motion's `animate={{ y: 0 }}`) and wrapping in a viewport-wide flex container (`position: fixed; inset: 0; left: 0; right: 0; display: flex; justify-content: center; pointer-events: none;`) with `width: ub(1448)`. Implemented state coordination in `OverlayPage.tsx` across States A (>4 alive -> tower visible), B & C (4, 3, 2 alive -> Final-4 visible, tower/wwcd/match-info hidden), and D (1 alive confirmed winner -> WWCD takes precedence, tower/final-4/match-info hidden).
  - **`WS-4.3` (Admin Preview & OBS URLs):** Updated `OverlayPreview.tsx` to route iframes directly to dedicated URLs for selected preview modes (`tower`, `final-four`, `wwcd`, `postgame`, or `auto`). Added Final-4 copyable OBS URL card and informational notice in `AdminPage.tsx` explaining how automated visibility enables OBS operators to leave all sources permanently unmuted and active in their scene.
  - **`WS-4.4` (Testing & Verification):** Added unit and regression tests in `overlays.test.tsx` covering States A, B, C, D, warmup suppression, new match reset, feature disable fallback, and viewport flex centering CSS rules.
- **Verification Results:**
  - `npm test`: **28 test files passed, 343 tests passed** (23 backend test files / 283 tests; 5 frontend test files / 60 tests).
  - `npm run typecheck`: Passed with **0 errors** across all workspaces.
  - `npm run lint`: Passed with **0 warnings and 0 errors** across all files.
  - `npm run format:check`: Passed (`All matched files use Prettier code style!`).
  - `npm run build`: Full production build of `@cdf/shared`, `@cdf/backend`, and `@cdf/frontend` succeeded with exit code 0.
- **Issues Encountered & Resolved:**
  - Zustand v5 SSR / Static Markup: During `renderToStaticMarkup`, Zustand external stores return `getInitialState()`, which caused test store updates to be bypassed. Fixed by adding optional prop injection (`snapshot`, `instance`, `overlayState`) to `OverlayPage`, allowing deterministic static markup assertions while preserving live store hydration in the browser.
  - Framer Motion Transform Collision: Replaced inline `transform: translateX(-50%)` with flexbox `justify-content: center` so Motion's vertical entry/exit animations operate cleanly on their own axis without disturbing horizontal canvas centering.
- **Next Steps:** Complete and ready for user review.

---

## Entry 10 — 2026-10-20 — Part 5 Phases 1–4: Repository Audit, Local Fullscreen WWCD Investigation, Broadcast Research & Design Proposal

- **Phase:** Part 5 — Phase 1 (Audit), Phase 2 (Local WWCD Investigation), Phase 3 (Broadcast Research), Phase 4 (Design Proposal Gate)
- **Task:** Perform comprehensive audit of current overlay instance architecture, ON AIR controls, and postgame/WWCD data paths; inspect local fullscreen WWCD fork in `T:\codebook\guthib\pmcc2026\chicken-dinner-feed`; conduct online broadcast research; author `docs/per-instance-overlay-audit.md` and `docs/per-instance-design-proposal.md`; halt at Phase 4 Review Gate for explicit user approval before implementation.
- **Status:** `COMPLETED` (Phase 4 Review Gate — Awaiting User Approval)
- **Files Affected:**
  - `docs/per-instance-overlay-audit.md` (created)
  - `docs/per-instance-design-proposal.md` (created)
  - `docs/checkpoint.md` (updated)
  - `docs/progress.md` (updated)
- **Changes Made:**
  - **Phase 1 (Audit):** Verified automated baseline (**343/343 tests passed**, 0 typecheck errors, 0 lint warnings, clean build). Built full inventory across all overlay surfaces, configuration schemas, routing conventions, and persistence mechanisms. Identified key deficiencies: hard-coded `'leaderboard'` type, volatile in-memory ON AIR control, lack of separate cumulative series overlay, and missing fullscreen WWCD.
  - **Phase 2 (Local WWCD Investigation):** Inspected `T:\codebook\guthib\pmcc2026\chicken-dinner-feed` commit `88b6ad3`. Evaluated `WwcdOverlay.tsx` (419 lines), `RecapOverlay.tsx` (879 lines), and assets (`char1`–`char5.png`, `chicken-dinner-badge.png`, `postgame-bg.png`). Formulated reuse plan adapting the 1920×1080 stage layout, 5-character lineup, marquee ticker, and 4-column esports stats panel to the PMCC 2026 design system, `ub()` resolution scaling, and authoritative `LiveSnapshot` data model.
  - **Phase 3 (Broadcast Research):** Researched Xtallet, OBS Studio Knowledge Base, Fluid Studio PUBG Squad Battle, and KRAFTON/PUBG Esports production HUDs. Extracted concrete design principles for independent browser sources, 3-layer background isolation, and zero-scroll 2-column standings tables.
  - **Phase 4 (Design Proposal):** Authored comprehensive 15-section implementation proposal covering multi-type registry (8 overlay types), universal `/overlay/:instanceId` and type-scoped routes, persistent ON AIR equation, separate `postgame-match` and `postgame-series` implementations, dual WWCD variants, admin panel redesign, migration strategy, and test plan.
- **Tests Executed:**
  - `npm test`: **28 test files passed, 343 tests passed** (baseline recorded).
  - `npm run typecheck`: Passed (`0` errors).
  - `npm run lint`: Passed (`0` warnings, `0` errors).
  - `npm run format:check` & `npm run build`: Passed.
  - No application production source code modified during Phases 1–4.
- **Issues Encountered:** None.
- **Next Steps:** Present Phase 4 Design Proposal, audit findings, and key review questions to user; await explicit approval before commencing Phase 5 coding.

---

## Entry 11 — 2026-10-20 — Part 5 Phase 5: Implementation & Verification of `WS-5.1` through `WS-5.5`

- **Phase:** Part 5 — Phase 5 (`WS-5.1` → `WS-5.5`)
- **Task:** Implement multi-type per-instance overlay architecture (8 overlay types), persistent ON AIR/HIDE controls, selectable automatic WWCD presentation (`D-PMCC-08`), selectable historical match for single-match postgame (`D-PMCC-09`), cumulative tournament series standings (`postgame-series`), and adapted PMCC 2026 Fullscreen WWCD victory screen (`wwcd-fullscreen`).
- **Status:** `COMPLETED`
- **Files Affected:**
  - `shared/src/versions.ts`, `shared/src/config/overlay-instance.ts`, `shared/src/protocol/live.ts`, `shared/src/protocol/feedback.ts`, `shared/src/index.ts`
  - `backend/src/persistence/migrations.ts`, `backend/src/persistence/config-store.ts`, `backend/src/state/overlay-control-store.ts`, `backend/src/routes/config.ts`, `backend/src/routes/feedback.ts`, `backend/src/ws/live-hub.ts`, `backend/src/app.ts`
  - `backend/src/persistence/migrations.test.ts`, `backend/src/routes/feedback.test.ts`, `backend/src/routes/backgrounds.test.ts`
  - `frontend/public/images/characters/char1.png`–`char5.png`, `frontend/public/images/chicken-dinner-badge.png`, `frontend/public/images/postgame-bg.png`
  - `frontend/src/components/overlay/broadcast-state.ts`, `frontend/src/components/overlay/FullscreenWwcdOverlay.tsx`, `frontend/src/components/overlay/PostGameSeriesOverlay.tsx`, `frontend/src/components/overlay/PostGameOverlay.tsx`, `frontend/src/components/overlay/overlays.test.tsx`
  - `frontend/src/stores/live-store.ts`, `frontend/src/pages/OverlayRoute.tsx`, `frontend/src/router.tsx`, `frontend/src/pages/OverlayPage.tsx`
  - `frontend/src/lib/api.ts`, `frontend/src/features/admin/overlay-types.ts`, `frontend/src/features/admin/InstanceToolbar.tsx`, `frontend/src/features/admin/OverlayPreview.tsx`, `frontend/src/features/admin/AppearanceEditor.tsx`, `frontend/src/pages/AdminPage.tsx`
  - `docs/checkpoint.md`, `docs/progress.md`
- **Changes Made:**
  - **`WS-5.1` (Shared Schema & Backend Configuration):**
    - Bumped `PROTOCOL_VERSION = 10` and `CONFIG_SCHEMA_VERSION = 5`.
    - Added `OverlayType` (`leaderboard`, `final4`, `match-info`, `elimination`, `wwcd`, `wwcd-fullscreen`, `postgame-match`, `postgame-series`), `enabled`, `onAir`, and `autoWwcdVariant` to `OverlayInstance` and `overlayInstancesDocumentSchema`.
    - Implemented v4→v5 non-destructive document migration with default instance seeding.
    - Added `setInstanceOnAir` and `saveAutoWwcdVariant` to `ConfigStore`; wired `OverlayControlStore.syncFromInstances` and `onPersist` callback to guarantee persistent ON AIR states across restarts; registered `PUT /config/auto-wwcd`.
  - **`WS-5.2` (Fullscreen WWCD & Postgame Series Components):**
    - Copied and integrated high-resolution character cutouts (`char1`–`char5.png`), chicken dinner badge, and stage background.
    - Implemented `FullscreenWwcdOverlay.tsx` (`wwcd-fullscreen`) with 3D stage background, 5-character squad lineup (`showFullscreenCharacters`), scrolling marquee ribbon (`showFullscreenMarquee`), and 4-column PMCC stats card with slot `T01..T25`.
    - Implemented `PostGameSeriesOverlay.tsx` (`postgame-series`) with official PUBG Esports tie-breakers (Total Pts -> WWCDs -> Place Pts -> Elim Pts -> Latest Match Placement), 1-or-2 column zero-scroll table layout, and isolated background media.
    - Updated `PostGameOverlay.tsx` and `broadcast-state.ts` to implement `D-PMCC-09`: historical match selector (`postGameMatchSelection`), deliberate unavailable empty state (`postgame-unavailable-state`), and strict single-match score isolation (never conflating series totals).
  - **`WS-5.3` (Routes & Visibility Coordination):**
    - Added routes `/overlay/wwcd-fullscreen`, `/overlay/:instanceId/wwcd-fullscreen`, `/overlay/postgame-series`, `/overlay/:instanceId/postgame-series`, and universal `/overlay/:instanceId` (`surfaceMode="auto"`).
    - Enforced independent `onAir` evaluation for all 8 overlay types.
    - Implemented `D-PMCC-08` automatic WWCD mutual exclusion and celebration latching (`resolveActiveAutoWwcdVariant`) so mid-ceremony variant toggles never disrupt an active victory presentation.
  - **`WS-5.4` (Admin Panel & Scoped Controls):**
    - Categorized overlay instance list into 3 distinct functional groups: `Leaderboard & Progression`, `Match Status & Alerts`, and `Ceremony & Post-Game`.
    - Added Type Selector with auto-populated names and default appearances when creating new instances.
    - Added Auto WWCD Presentation selector (`D-PMCC-08`) with live indicator pill and misconfiguration/hide warnings.
    - Added Historical Match selector (`D-PMCC-09`) to Postgame Match instance appearance editor.
    - Extracted `OVERLAY_TYPE_LABELS` to clean module `frontend/src/features/admin/overlay-types.ts` for fast-refresh and oxlint compliance.
  - **`WS-5.5` (Verification & Quality Gates):**
    - Added comprehensive unit and regression tests in `frontend/src/components/overlay/overlays.test.tsx` verifying `D-PMCC-08`, `D-PMCC-09`, `FullscreenWwcdOverlay`, `PostGameSeriesOverlay`, and universal ON AIR / HIDE enforcement.
- **Verification Results:**
  - `npm test`: **All 28 test files passed, 354 tests passed** (23 backend test files / 284 tests; 5 frontend test files / 70 tests).
  - `npm run typecheck`: Passed with **0 errors** across all workspaces.
  - `npm run lint`: Passed with **0 warnings and 0 errors** across 56 files.
  - `npm run format:check`: Passed (`All matched files use Prettier code style!`).
  - `npm run build`: Full production build of `@cdf/shared`, `@cdf/backend`, and `@cdf/frontend` succeeded with exit code 0.
- **Issues Encountered & Resolved:**
  - TypeScript literal fixture in `overlays.test.tsx` required `matchId`, `startedAt`, and `endedAt` to strictly adhere to `ClosedMapResult` type contract. Resolved cleanly.
  - Oxlint export warning on `OVERLAY_TYPE_LABELS` in `InstanceToolbar.tsx` resolved by creating dedicated `overlay-types.ts`.
- **Next Steps:** Complete. Ready for tournament broadcast deployment.

