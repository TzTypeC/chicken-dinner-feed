# Project Checkpoint — Manual Mode Implementation

- **Last Updated:** 2026-10-19
- **Current Phase:** Phase 9 — Final Verification & Summary (`COMPLETED`)
- **Last Completed Checkpoint:** Phase 7 & Phase 8 — Full Implementation and Test Verification (`COMPLETED`)

---

## 1. Approved Requirements & Decisions

All decisions in [`docs/manual-mode-decisions.md`](manual-mode-decisions.md) have been approved and implemented:

- **`D-01` (Persistence):** Backend JSON persistence at `backend/data/manual-match.json` via `JsonDocument`.
- **`D-02` (Granularity):** Team-level manual inputs (`present`, `aliveCount` 0–4, `eliminations`, optional `placementOverride`).
- **`D-03` (Overlay `ALIVE` & Eliminated Visuals):** Keep 4-bar `AlivePlayerBars` indicator; alive slots colored `--player-alive`, dead/eliminated slots and knocked-out/eliminated teams colored gray (`--player-dead` / `--overlay-text-muted`) with dimmed/grayed row indication.
- **`D-04` (Mode Isolation):** Separate `autoMatchStore` and `manualMatchStore` coordinated via `createDelegatingMatchStore`; stop PCOB polling in Manual Mode; provide "Copy from PCOB" failover button.
- **`D-05` (Legend):** Hide `KNOCKED` from the overlay footer legend when in Manual Mode (`source === 'manual'`), leaving `ALIVE` and gray `ELIM`.
- **`D-06` (Map Closing):** Disable automatic map close (`shouldAutoCloseNow`) in Manual Mode; close maps into series only when the operator clicks **Close current map now**.
- **`D-07` (Initial Mode):** Default to `auto` on fresh install; persist active mode in `manual-match.json`.
- **`D-08` (Admin UI Layout):** Dedicated **`Manual control`** tab in Admin navigation bar + always-visible Mode Toggle (`PCOB API` / `Manual`) in sticky header.
- **`D-09` (Protocol Version):** Bumped `PROTOCOL_VERSION` from `6` to `7` (`@cdf/shared`).

---

## 2. Files Changed

### Documentation (`docs/`)

- `docs/repository-audit.md` (created)
- `docs/data-availability-matrix.md` (created)
- `docs/manual-mode-requirements.md` (created)
- `docs/manual-mode-architecture.md` (created)
- `docs/manual-mode-decisions.md` (created)
- `docs/implementation-plan.md` (created)
- `docs/checkpoint.md` (created)
- `docs/progress.md` (created)

### Shared Package (`@cdf/shared`)

- `shared/src/domain/ingest.ts` (added `'manual'` to `ingestSourceKindSchema`)
- `shared/src/domain/manual.ts` (created manual schemas, types, and factories)
- `shared/src/versions.ts` (bumped `PROTOCOL_VERSION` to `7`)
- `shared/src/index.ts` (exported manual schemas and helpers)

### Backend Package (`@cdf/backend`)

- `backend/src/ingest/index.ts` (narrowed automatic ingest factory type to `Exclude<IngestSourceKind, 'manual'>`)
- `backend/src/state/match-store.ts` (authoritative manual snapshot handling, disabled stale timeout in manual mode, added `createDelegatingMatchStore`)
- `backend/src/state/manual-store.ts` (created `ManualStore` and `resolveManualPlacements`)
- `backend/src/state/manual-store.test.ts` (created unit tests for `ManualStore` and `MatchStore` in manual mode)
- `backend/src/routes/health.ts` (updated `ingestSource` schema to `ingestSourceKindSchema` with active source reporting)
- `backend/src/routes/manual.ts` (created `/api/manual`, `/api/manual/mode`, `/api/manual/teams/:teamNo`, `/api/manual/teams`, `/api/manual/reset`)
- `backend/src/routes/manual.test.ts` (created route & mode-switching integration tests)
- `backend/src/app.ts` (wired `ManualStore`, `autoMatchStore`, `manualMatchStore`, `manualRoutes`, and mode-switching lifecycle)

### Frontend Package (`@cdf/frontend`)

- `frontend/src/lib/api.ts` (added `getManualState`, `setOperatingMode`, `patchManualTeam`, `updateManualTeams`, `resetManualMatch`)
- `frontend/src/features/admin/ManualControl.tsx` (created live manual team control tab)
- `frontend/src/pages/AdminPage.tsx` (added sticky header Mode Toggle, Manual status indicator, protocol mismatch banner, and `Manual control` tab)
- `frontend/src/pages/OverlayPage.tsx` (passed `source={snapshot.ingest.source}` to `LeaderboardOverlay`)
- `frontend/src/components/overlay/LeaderboardOverlay.tsx` (hidden `KNOCKED` legend item when `source === 'manual'`)
- `frontend/src/components/overlay/AlivePlayerBars.tsx` (enhanced gray dead-slot track visibility)
- `frontend/src/components/overlay/TeamRow.tsx` (applied muted gray text color when `team.isEliminated` is true)

---

## 3. Tests Completed

- All 21 backend test files (270 tests) pass, including `backend/src/state/manual-store.test.ts` (7 tests) and `backend/src/routes/manual.test.ts` (8 tests).
- TypeScript `npm run typecheck`, ESLint `npm run lint`, Prettier `npm run format:check`, and `npm run build` pass across all workspaces.

## 4. Known Issues & Outstanding Questions

- None. All requirements (`REQ-MODE-*`, `REQ-ISO-*`, `REQ-INPUT-*`, `REQ-COMPAT-*`) and decisions (`D-01`–`D-09`) are implemented and verified.

## 5. Exact Next Action

- Complete. Ready for tournament broadcast operation.

