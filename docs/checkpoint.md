# Project Checkpoint

- **Last Updated:** 2026-10-22
- **Current Task:** Part 8 — Configurable Leaderboard Team Names, Extended Marquee Mode, Series Team Ordering & Additional Match Points
- **Current Phase:** Implementation & Quality Gate Verification Complete (`COMPLETED`)
- **Last Completed Checkpoint:** WS-8.1 through WS-8.8 implemented and verified. 461/461 tests pass (backend 322 / 26 files, frontend 139 / 12 files), 0 typecheck errors, 0 lint diagnostics, Prettier clean, build OK (pre-existing Vite chunk-size warning only). Browser-verified at 1920×1080 against an isolated data copy. See [`docs/part8-audit-and-proposal.md`](part8-audit-and-proposal.md) §15.

---

## 1. Completed Milestones

### Part 1 — Manual Mode (`D-01` – `D-09`, Completed)

- All Manual Mode requirements and decisions in [`docs/manual-mode-decisions.md`](manual-mode-decisions.md) are implemented and verified.

### Part 2 — Responsive Admin Redesign & Broadcast Overlays (`D-UI-01` – `D-UI-06`, Completed)

- All Responsive Admin and Elimination / Match Info / Logo Toggle requirements in [`docs/ui-implementation-decisions.md`](ui-implementation-decisions.md) are implemented and verified.

### Part 3 — Final-4, WWCD, Post-Game Standings & PMCC 2026 Identity (`D-PMCC-01` – `D-PMCC-07`, Completed)

- Persistent team slots (`T01`–`T25`), horizontal Final-4 top bar with grayed-out card retention at 3/2 alive teams, WWCD victory screen, post-game detailed standings table (`#1`–`#25`), custom background media uploader/storage, PMCC 2026 theme tokens, and Admin preview modes are implemented and verified.

### Part 4 — Separate Final-4 & WWCD Overlay Routing & Visibility Fix (Completed)

- Independent overlay routing (`/overlay/final4`, `/overlay/:id/final4`, `/overlay/wwcd`, `/overlay/:id/wwcd`, `/overlay/match-info`, `/overlay/:id/match-info`, and `/overlay/:id` / `/main`).
- Strict component isolation: `/main` exclusively renders the vertical tower and never embeds Final-4 or WWCD.
- Global visibility coordination across broadcast States A, B, C, and D with zero overlap.
- Centered 1920×1080 canvas architecture using flex wrapper without Framer Motion `transform` collision.
- Admin panel integration with copyable OBS Browser Source URLs for all 6 overlay routes and visual coordination callouts.
- All 343 tests passed across backend and frontend, 0 TypeScript errors, 0 ESLint errors, clean Prettier formatting, clean production build.

### Part 5 — Per-Instance Overlay Architecture, Independent ON AIR Controls, Match/Series Statistics & Dual WWCD (Completed)

- Multi-type per-instance architecture across all 8 overlay types, persistent ON AIR controls in `overlay-instances.json`, `autoWwcdVariant` selection (`D-PMCC-08`), single-match postgame with historical match selection and deliberate unavailable state (`D-PMCC-09`), cumulative tournament series standings (`postgame-series`) with official PUBG Esports tie-breakers, and PMCC 2026 adapted Fullscreen WWCD (`wwcd-fullscreen`).
- Full quality gates: **354/354 tests passed**, 0 TypeScript errors, 0 ESLint errors/warnings, clean build.

### Part 6 — WWCD Display Modes, Fullscreen Layout Refinement, Elimination Notification Positioning & Team Management UX (Completed)

- **Feature A (WWCD Display Modes: Card, Fullscreen, Dual):** Extended `autoWwcdVariantSchema` to `['standard', 'fullscreen', 'dual']`. Dual mode coordinates simultaneous automatic activation of Card (`wwcd`) and Fullscreen (`wwcd-fullscreen`) presentations during match-end victory celebrations while strictly respecting individual instance `onAir` settings without silent overrides.
- **Feature B (Fullscreen WWCD Layout Refinement):** Resolved Framer Motion transform collision by wrapping emblem badge and typography in a full-width flex container (`left: 0, right: 0, display: flex, flexDirection: column, alignItems: center`), compensated for trailing CSS letter-spacing on `WINNER WINNER` with negative right margin `marginRight: -ub(7)`, and compensated for `char5.png` 110px transparent padding asymmetry with optical offset `transform: translateX(-2.5%)`.
- **Feature C (Elimination Notification Dynamic Positioning):** Added `finalFourActive?: boolean` prop to `EliminationOverlay.tsx`, anchoring alert banner at `top: u(42)` by default and dynamically shifting down to `top: u(164)` ($19\text{px}$ clearance below Final-4 cards, compliant with EBU R95 5% safe area) whenever 4, 3, or 2 squads remain alive.
- **Feature D (Bulk Team Creation):** Created `BulkTeamDialog.tsx` modal and `bulk-teams.ts` parser accepting `[Slot] [Team Name]`, `[Slot], [Team Name]`, and auto-assigned `[Team Name]` formats, with live tabular validation preview, slot collision checking, and 25-team capacity enforcement.
- **Feature E (Permanent `teamNo` Renumbering & DND):** Implemented `applyRippleShift` algorithm as default drag-and-drop behavior (downward move shifts `[D, S - 1]` down by `+1`, upward move shifts `[S + 1, D]` up by `-1`, vacant destination moves directly), added Direct Swap slot selector dropdown and Up/Down stepper buttons per row, added live match warning banner if edited during active matches, and implemented two-stage atomic logo file renaming in `LogoStore` (`reassignLogos`).
- **Feature F (Selective & Bulk Team Deletion):** Implemented row checkboxes, table header master checkbox with indeterminate state, Selection Action Bar (`Delete Selected (X)`), and Delete All Teams button. Enforced post-deletion sparse slots retention (remaining teams preserve their original slot numbers without automatic shifting, protecting PCOB room mapping), disk logo cleanup, and destructive confirmation dialogs.
- **Historical Match Protection:** Enhanced `ClosedMapTeamResult` with `name` and `logoUrl` snapshots created at map close. Past match results in `series.json` never mutate or break when teams are subsequently renumbered or deleted.
- **Full Quality Gates:** **374/374 unit and integration tests passed** across 30 test files, 0 TypeScript errors, 0 ESLint/Oxlint warnings or errors, 100% Prettier compliance, clean production build.

### Part 7 — Application Backup & Restore, Excel Integration, Default Team Roster & Postgame Ranking Correction (Completed)

- **Feature A (Backup & Restore Format v2 & Rollback Protection):** Extended `backupManifestSchema` to format version 2 with SHA-256 entry checksums, artifact metadata, and `manual-match.json` inclusion. Implemented Zip Slip / path traversal protection (`CVE-2018-1002204`). Created automated server-side pre-restore safety snapshots (`.pre-restore-snapshot.zip` with rotation to `.prev.zip`) that validate self-recovery in-memory prior to applying destructive writes, with automated rollback on failure. Backward-compatible with v1 backups.
- **Feature B (Exact Excel Integration):** Integrated `exceljs` for 100% fidelity round-trip against the official `assets/PMCC 2026 OFLINE SCORING SHEETS.xlsx` tournament workbook. Preserves worksheet `10. Offline Scoring Sheets`, freeze panes (`A6`), 14 merged cell ranges, 28 hidden rows (32..59 ruleset legend), and hidden Round 5 columns (`P`, `U`, `Z`, dynamically unhidden when $\ge 5$ matches exist). Populates literal team names into `K6:K30` (eliminating fragile external file links), preserves downstream calculation formulas (`INDEX`, `MATCH`, `RANK`, `COUNTIF`, placing points `IF` ladders, sums), and populates cached formula evaluation results. Built 2-stage Excel importer with 3 operator-selectable modes (`roster`, `matches`, `full`) and cell-coordinate validation.
- **Feature C (Default Team Roster & Length Expansion):** Expanded `TEAM_NAME_MAX_LENGTH` from 24 to 32 characters in `@cdf/shared`, safely accommodating official tournament teams such as Team 20 (`Lanang nak chicken main pubg` = 28 chars) without truncation. Defined `DEFAULT_PMCC_2026_ROSTER` and added a non-destructive "Reset to PMCC 2026" button in `TeamRosterEditor.tsx` with confirmation modal and backend API `POST /api/config/teams/seed-pmcc`.
- **Feature D (Postgame Match vs Series Ranking Alignment):** Enforced architectural separation between single-match result ranking (`totalMatchPoints` descending $\to$ elims $\to$ placement $\to$ slot) and cumulative tournament series standings (`totalPoints` $\to$ WWCD $\to$ place pts $\to$ elim pts $\to$ latest placement $\to$ slot). Updated admin `SeriesControl.tsx` finished maps view with clear `PLACE` and `MATCH PTS` columns and match points ordering. Added regression fixture proving ranking inversion (Team B wins match with 25 pts while Team C leads tournament series with 100 pts).
- **Feature E (Admin UX Enhancements & Excel Import Crash Fix):** Rebuilt `ImportExport.tsx` with dedicated cards for Backup & Restore (`.zip`) and PMCC 2026 Excel Scoring Sheets (`.xlsx`), scope selectors (`Full Sync`, `Roster Only`, `Matches Only`), and safety snapshot callouts. Resolved React Error #31 by properly normalizing structured `{ location, message }` validation errors into accessible location badges and messages, and fixed ExcelJS formula object extraction for slots (`I6+1`) and team names.
- **Full Quality Gates:** **398/398 unit and integration tests passed** across 33 test files, 0 TypeScript errors, 0 ESLint/Oxlint warnings or errors, 100% Prettier compliance, clean production build.

### Part 8 — Configurable Team Names, Extended Marquee, Series Ordering & Additional Points (Completed)

- **Feature A (team-name limit):** `teamNameMaxChars` (6–32, default 14), counted in graphemes; `...` counts toward the limit. One uniform font size derived from the limit (10–15 px; 10.67 px for production `main`). Inner columns rebalanced (ALIVE 50, ELIMS 44, gaps 4) inside the unchanged 340 px frame and right edge.
- **Feature B (extended mode):** `teamNameExtendedMode` + `teamNameMaxExtension` (0–480, default 200). The panel widens left only as far as needed; a name that still does not fit scrolls (WAAPI seamless loop, 40 px/s, 1.5 s hold). Left-anchored panels are clamped on-canvas through the positioned wrapper. Switching off reverts immediately.
- **Feature C (ordering):** Current standings / Team order switch (`cdf.admin.series.teamOrder`) for the standings table, both map dialogs and the finished-map cards. Dialog order is frozen while open; corrections show the map's snapshot name; one shared `compareMatchResults`.
- **Feature D (Additional Points):** independent per-team, per-map input (−100…+100, optional reason, `adjustedAt`), applied exactly once in `totalPoints`. Signed totals end to end. `PROTOCOL_VERSION` 11. Conditional ADJ columns on postgame screens. Excel stays official-only, with export and import warnings. ADR-0018.
- **Compatibility:** no persisted-data migration. Stale clients cannot wipe new settings or adjustments; the v10 → v11 mismatch flow was verified live.

---

## 2. Review Gate Status (Part 8)

- [x] **Phase 1:** Repository Audit & Baseline Quality Gates — **COMPLETED**
- [x] **Phase 2:** Online Research & Design References — **COMPLETED**
- [x] **Phases 3–6:** Feature A–D investigation & design — **COMPLETED** (see proposal §5–§9)
- [x] **Phase 7:** Clarification & Approval Gate — **COMPLETED** (12/12 answered, approved 2026-10-22)
- [x] **Phase 8:** Implementation (`WS-8.1` – `WS-8.8`) — **COMPLETED**
- [x] **Phase 9:** Testing & Acceptance — **COMPLETED** (unit/integration + browser verification, proposal §15.5)
- [x] **Phase 10:** Final Delivery Report — **COMPLETED** (proposal §15)

---

## 3. Exact Next Action

Deploy per proposal §15.4. After restarting the server, refresh every OBS browser source and reload any open admin tab (protocol v11). Then follow the operator verification steps in the Part 8 delivery report. No open Part 8 work remains.
