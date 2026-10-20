# Implementation Plan

## Part 1 — Manual Mode Implementation (Completed)

- **Phase:** Completed
- **Approved Requirements:** [`docs/manual-mode-requirements.md`](manual-mode-requirements.md)
- **Approved Decisions:** [`docs/manual-mode-decisions.md`](manual-mode-decisions.md) (`D-01` through `D-09`)

| Task ID       | Objective                                                                                                           | Status      |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | ----------- |
| **`TASK-01`** | Shared Contracts & Schemas (`@cdf/shared`) — `'manual'` ingest source, `manual.ts` schemas, `PROTOCOL_VERSION = 7`. | `COMPLETED` |
| **`TASK-02`** | `ManualStore` & Reversible Placement / Adapter Mapping (`@cdf/backend`).                                            | `COMPLETED` |
| **`TASK-03`** | Mode-Switching Coordinator & Backend Routes (`@cdf/backend`).                                                       | `COMPLETED` |
| **`TASK-04`** | Overlay Visual Adaptation for Manual Mode (`@cdf/frontend`).                                                        | `COMPLETED` |
| **`TASK-05`** | Admin UI Mode Toggle & Manual Control Tab (`@cdf/frontend`).                                                        | `COMPLETED` |
| **`TASK-06`** | Comprehensive Test Suite, Documentation Updates & Final Verification.                                               | `COMPLETED` |

---

## Part 2 — Responsive Admin Redesign & Broadcast Overlay Enhancements (Completed)

- **Phase:** Completed
- **Approved Specifications:**
  - [`docs/ui-responsive-audit.md`](ui-responsive-audit.md)
  - [`docs/broadcast-overlay-requirements.md`](broadcast-overlay-requirements.md)
  - [`docs/match-configuration-design.md`](match-configuration-design.md)
  - [`docs/ui-design-references.md`](ui-design-references.md)
  - [`docs/ui-implementation-decisions.md`](ui-implementation-decisions.md) (`D-UI-01` through `D-UI-06`)

| Workstream ID | Objective & Scope | Status |
| :--- | :--- | :--- |
| **`WS-1`** | Shared Schemas & Backend Match/Map Configuration (`@cdf/shared`, `@cdf/backend`, `PROTOCOL_VERSION = 8`) | `COMPLETED` |
| **`WS-2`** | Broadcast Overlays: Logo Visibility Toggle, Elimination Notification Overlay & Match Info Overlay (`@cdf/frontend`) | `COMPLETED` |
| **`WS-3`** | Admin Overlay Controls, Match/Map Configuration Bar & Multi-Overlay Live Preview (`@cdf/frontend`) | `COMPLETED` |
| **`WS-4`** | Admin Panel Responsive Redesign & Multi-Viewport Verification (`@cdf/frontend`) | `COMPLETED` |

---

## Part 3 — Final-4 Leaderboard, WWCD Celebration, Post-Game Standings & PMCC 2026 Visual Identity (Active)

- **Phase:** Phase 1 & Phase 2 Completed (Audit, Visual Reference Analysis & Specification); **Awaiting User Review Gate Approval Before Phase 3 Implementation**
- **Specifications & Decisions:**
  - [`docs/pmcc-visual-identity-analysis.md`](pmcc-visual-identity-analysis.md)
  - [`docs/broadcast-design-references.md`](broadcast-design-references.md)
  - [`docs/final-four-leaderboard-audit.md`](final-four-leaderboard-audit.md)
  - [`docs/wwcd-screen-requirements.md`](wwcd-screen-requirements.md)
  - [`docs/postgame-standings-requirements.md`](postgame-standings-requirements.md)
  - [`docs/broadcast-ui-decisions.md`](broadcast-ui-decisions.md) (`D-PMCC-01` through `D-PMCC-07`)

### Proposed Phase 3 Workstream Breakdown (Pending Approval)

| Workstream ID | Objective & Scope | Dependencies | Expected Files Modified / Created | Acceptance Criteria | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`WS-3.1`** | **Shared Contracts, PMCC 2026 Default Tokens & Backend Background Media / Series Snapshot (`@cdf/shared`, `@cdf/backend`)**<br>• Bump `PROTOCOL_VERSION` (`8` → `9`).<br>• Update `overlayAppearanceSchema` & `defaultOverlayAppearance` with PMCC 2026 defaults (`backgroundColor: '#160F0A'`, `textColor: '#F9EDD9'`, `accentColor: '#E5A93C'`), `showTeamNumbers` (`.default(true)`), `showFinalFourLayout` (`.default(true)`), `showWwcdOverlay` (`.default(true)`), and `postGameBackground` (`mode`, `mediaUrl`, `opacity`, `blur`).<br>• Add `lastClosedMap: closedMapResultSchema.nullable().default(null)` to `LiveSnapshot` in `shared/src/protocol/live.ts` and wire `LiveHub` in `backend/src/app.ts` to include `series.getState().closedMaps.at(-1) ?? null` on every broadcast.<br>• Implement `BackgroundMediaStore` (`backend/src/persistence/background-store.ts`) + `backend/src/routes/backgrounds.ts` (`POST / DELETE /api/overlays/:id/background` + `/backgrounds/:file` static route) + include `backgrounds/` in `backend/src/backup/export.ts` & `import.ts`. | None | `shared/src/versions.ts`, `shared/src/config/overlay-instance.ts`, `shared/src/protocol/live.ts`, `shared/src/protocol/feedback.ts`, `shared/src/index.ts`, `backend/src/persistence/background-store.ts`, `backend/src/routes/backgrounds.ts`, `backend/src/backup/export.ts`, `backend/src/backup/import.ts`, `backend/src/ws/live-hub.ts`, `backend/src/app.ts`, backend unit tests | • Existing `overlay-instances.json` and `series.json` files migrate seamlessly with Zod defaults.<br>• Background image/video upload validates magic bytes (`PNG`, `JPG`, `WebP`, `MP4`, `WebM`) and updates `overlay-instances.json` atomically.<br>• `LiveSnapshot` includes `lastClosedMap` and updates immediately when a map is closed, edited, added, or deleted. | `npm test -w @cdf/shared`, `npm test -w @cdf/backend`, `npm run typecheck` | `PLANNED (AWAITING GATE)` |
| **`WS-3.2`** | **PMCC 2026 Theme System, Persistent Team Slot Badge (`T##`), Automatic Final-4 Layout & WWCD Victory Screen (`@cdf/frontend`)**<br>• Apply PMCC 2026 CSS variables & visual tokens in `frontend/src/styles/globals.css` and `OverlayPage.tsx`.<br>• Add persistent `T01`–`T25` slot badge to `TeamRow.tsx` (`showTeamNumbers`).<br>• Create `FinalFourOverlay.tsx` (top-center 4-column survivor cards with rank, logo, `T##`, name, 4-segment `AlivePlayerBars`, match elims, total pts) and integrate automatic state transitions in `LeaderboardOverlay.tsx` / `OverlayPage.tsx`.<br>• Create `WwcdOverlay.tsx` (center-stage PMCC championship banner, winner logo, `T##`, team name, PCOB player cards vs. Manual alive bars, `#1` placement, match elims, match pts, series pts) + register `/overlay/wwcd` & `/overlay/$instanceId/wwcd`.<br>• Update `MatchInfoOverlay.tsx` and `EliminationOverlay.tsx` with PMCC bronze/gold/crimson framing and diamond (`◇`) nodes. | `WS-3.1` | `frontend/src/styles/globals.css`, `frontend/src/components/overlay/TeamRow.tsx`, `frontend/src/components/overlay/LeaderboardOverlay.tsx`, `frontend/src/components/overlay/FinalFourOverlay.tsx`, `frontend/src/components/overlay/WwcdOverlay.tsx`, `frontend/src/components/overlay/MatchInfoOverlay.tsx`, `frontend/src/components/overlay/EliminationOverlay.tsx`, `frontend/src/pages/OverlayPage.tsx`, `frontend/src/pages/OverlayRoute.tsx`, `frontend/src/router.tsx` | • `T01`–`T25` badge stays fixed per team while live `#1`–`#25` rank re-sorts.<br>• Final-4 bar activates automatically when 4 teams remain alive (`phase !== 'idle'`, `eliminatedCount >= 1`) and reverts cleanly when `standingTeamCount !== 4`.<br>• WWCD victory screen activates on single confirmed winner and on `/overlay/wwcd`. | Frontend unit tests (`vitest`) + `npm run typecheck` | `PLANNED (AWAITING GATE)` |
| **`WS-3.3`** | **Post-Game Detailed Standings Screen (`/overlay/postgame`) & Isolated Custom Background Layer (`@cdf/frontend`)**<br>• Create `PostGameOverlay.tsx` with 3-layer stack: Isolated Background Media Layer (`image` / `video`, `opacity: 0–100%`, `blur: 0–24px` with scale edge-compensation) → Espresso Contrast Scrim → Crisp Foreground Broadcast UI.<br>• Render Left `#1 WWCD Winner Spotlight` + Right `Structured Standings Table` (`#`, `Logo`, `T##`, `Team`, `PLACE`, `ELIMS`, `PLACE PTS`, `ELIM PTS`, `MATCH PTS`) with automatic 2-column split for `> 12` teams.<br>• Register `/overlay/postgame` and `/overlay/$instanceId/postgame` routes in `router.tsx` / `OverlayRoute.tsx`. | `WS-3.1`, `WS-3.2` | `frontend/src/components/overlay/PostGameOverlay.tsx`, `frontend/src/pages/OverlayPage.tsx`, `frontend/src/pages/OverlayRoute.tsx`, `frontend/src/router.tsx`, `frontend/src/components/overlay/overlays.test.tsx` | • Reads persisted `lastClosedMap` (with live fallback when unclosed) and updates in real time on map close/edit.<br>• Zero vertical scrolling for up to 25 teams on `1920×1080`.<br>• Blur/opacity affect strictly the background layer; transparent canvas when background is disabled. | Frontend unit tests (`vitest`) + `npm run typecheck` | `PLANNED (AWAITING GATE)` |
| **`WS-3.4`** | **Admin Controls: Appearance Toggles, PMCC Preset, Background Media Uploader & Multi-State Preview (`@cdf/frontend`)**<br>• Add `uploadOverlayBackground` and `deleteOverlayBackground` to `frontend/src/lib/api.ts`.<br>• Update `AppearanceEditor.tsx` with **"Apply PMCC 2026 Theme"** button, toggles for `showTeamNumbers`, `showFinalFourLayout`, `showWwcdOverlay`, and the **Post-Game Background Media** editor (`Disabled` / `Image` / `Video`, file upload/clear, `Opacity 0–100%` slider, `Blur 0–24px` slider).<br>• Update `OverlayPreview.tsx` & `AdminPage.tsx` with preview mode tabs/toggles (`Tower`, `Final-4`, `WWCD`, `Post-Game`) and copyable OBS URLs for `/overlay/:id/wwcd` and `/overlay/:id/postgame`.<br>• Run full test suite, build, lint, format check, and update docs. | `WS-3.2`, `WS-3.3` | `frontend/src/lib/api.ts`, `frontend/src/features/admin/AppearanceEditor.tsx`, `frontend/src/features/admin/OverlayPreview.tsx`, `frontend/src/pages/AdminPage.tsx`, `docs/checkpoint.md`, `docs/progress.md` | • Operators can upload/remove post-game background image or video and adjust opacity/blur live.<br>• Admin preview can simulate `Tower`, `Final-4`, `WWCD`, and `Post-Game` states on demand.<br>• All tests, lint, format, and build pass with `0` errors. | Full test suite + build + format & lint verification | `PLANNED (AWAITING GATE)` |
