# Manual Mode — Architectural & Product Decisions Log

This document records the architectural and product decisions for Manual Mode, including the options evaluated, source-code evidence, and user approvals from the Phase 5 Review Gate (2026-10-19).

---

## Decision Summary Table

| ID       | Topic                                                                  | Chosen Solution                                                                                                                                                      | Status       |
| -------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **D-01** | Where mode & manual match state live and persist                       | Backend `JsonDocument` (`backend/data/manual-match.json`)                                                                                                            | **Approved** |
| **D-02** | Granularity of manual input (Team-level vs. Player-level)              | **Team-level only** (`aliveCount` 0–4, `eliminations`, `present`, optional `placementOverride`)                                                                      | **Approved** |
| **D-03** | Representation of the `ALIVE` column & eliminated teams in Manual Mode | 4-bar `AlivePlayerBars`: alive slots full `--player-alive`; dead/eliminated slots & knocked-out teams colored gray (`--player-dead`) with dimmed eliminated team row | **Approved** |
| **D-04** | Switching modes & state preservation                                   | Separate `autoMatchStore` and `manualMatchStore`; stop PCOB polling in Manual Mode; include "Copy from PCOB" failover seeding                                        | **Approved** |
| **D-05** | Overlay `ALIVE / KNOCKED / ELIM` legend in Manual Mode                 | Hide `KNOCKED` in the legend when in Manual Mode (show `ALIVE` and gray `ELIM` indicator)                                                                            | **Approved** |
| **D-06** | Auto-close map (`standingTeamCount <= 1`) in Manual Mode               | **Disable auto-close in Manual Mode**; close maps into series only when operator clicks "Close current map now"                                                      | **Approved** |
| **D-07** | Default mode on startup & mode switch behavior                         | Default to `auto` (`INGEST_SOURCE`) on fresh install; persist active mode in `manual-match.json`; instant non-destructive switch                                     | **Approved** |
| **D-08** | Admin UI placement of Manual Mode controls                             | Dedicated **`Manual control`** tab in Admin navigation bar + always-visible Mode Toggle in sticky header                                                             | **Approved** |
| **D-09** | Backup Export/Import (`backup/export.ts`)                              | Keep backup ZIP scoped to tournament configuration and series history (`series.json`); live manual match state stays local runtime state in `manual-match.json`      | **Approved** |

---

## Detailed Decision Records

### `D-01`: Persistence Strategy for Manual Mode and Active Mode Selection

- **Question:** Should manual match data and the active mode (`auto` vs `manual`) be stored in browser `localStorage`, in-memory on the backend, or persisted to disk in `backend/data/` via `JsonDocument`?
- **Options:**
  1. Browser `localStorage` only (cannot reach OBS browser sources).
  2. Backend in-memory only (lost on backend restart).
  3. **Backend `JsonDocument` (`backend/data/manual-match.json`).**
- **Evidence:** [`ADR-0004`](adr/0004-json-file-persistence.md), [`ADR-0007`](adr/0007-websocket-state-fanout.md), [`backend/src/persistence/json-document.ts`](../backend/src/persistence/json-document.ts).
- **Chosen Solution:** **Option 3 (`backend/data/manual-match.json`).**
- **Reasoning & Consequences:** Uses the existing atomic, schema-validated `JsonDocument` persistence mechanism. Both the active mode and all manual match inputs survive browser refreshes and backend restarts, and immediately fan out to all OBS browser sources over `/ws/live`.
- **Approval Status:** Approved (2026-10-19).

---

### `D-02`: Team-Level vs. Player-Level Manual Input

- **Question:** Should Manual Mode require entering individual players or operate at the team level?
- **Options:**
  1. **Team-level input:** `aliveCount` (`0..4`), `eliminations` (`0..999`), `present` (`boolean`), and optional `placementOverride` (`1..25` or `Auto`).
  2. Player-level input (64–100 individual players).
- **Evidence:** [`TeamRow.tsx`](../frontend/src/components/overlay/TeamRow.tsx) and [`LeaderboardOverlay.tsx`](../frontend/src/components/overlay/LeaderboardOverlay.tsx) only display team-level rows (`#`, logo, `name`, 4 alive bars, `PTS`, `ELIMS`).
- **Chosen Solution:** **Option 1 (Team-level input).**
- **Reasoning & Consequences:** Operators can update team eliminations and alive counts in a single click during live combat, while the backend synthesizes the 4 internal `IngestPlayer` slots required by `MatchStore`.
- **Approval Status:** Approved (2026-10-19).

---

### `D-03`: `AlivePlayerBars` & Eliminated Team Visuals in Manual Mode

- **Question:** How should the `ALIVE` column and eliminated/knocked-out teams render in Manual Mode?
- **Options:**
  1. **4-bar `AlivePlayerBars` with alive bars in `--player-alive` and eliminated/dead slots (and eliminated teams) colored gray (`--player-dead`).**
  2. Numeric text count (`3/4`).
  3. Hide the `ALIVE` column.
- **Evidence:** [`AlivePlayerBars.tsx#L27-L80`](../frontend/src/components/overlay/AlivePlayerBars.tsx#L27-L80), [`TeamRow.tsx#L45`](../frontend/src/components/overlay/TeamRow.tsx#L45).
- **Chosen Solution:** **Option 1** — keep the 4-bar `AlivePlayerBars` indicator: slots `1..aliveCount` are full height in `--player-alive`, while dead/eliminated slots (`aliveCount+1..4`) and knocked-out/eliminated teams (`aliveCount === 0`, `isEliminated === true`) are colored gray (`var(--player-dead)` / muted row styling) to clearly indicate the players/team are already out.
- **Reasoning & Consequences:** Preserves the broadcast look from `specs/example.png` without fabricating partial HP percentages, and makes eliminated players/teams immediately recognizable as grayed out.
- **Approval Status:** Approved (2026-10-19).

---

### `D-04`: Mode-Switching Isolation, PCOB Polling Lifecycle, and Mid-Match Failover

- **Question:** What should happen to PCOB polling and each mode's data when switching between PCOB Mode and Manual Mode?
- **Chosen Solution:**
  - Keep separate `autoMatchStore` and `manualMatchStore` instances on the backend.
  - Stop `PcobSource`/`MockSource` when switching to Manual Mode (`ingestSource.stop()`), and ignore any late in-flight poll response.
  - Restart `PcobSource`/`MockSource` when switching back to PCOB Mode (`ingestSource.start()`).
  - Preserve each mode's state independently across switches, and provide a **"Copy from PCOB"** button in Manual Mode for 1-click mid-match failover.
- **Evidence:** [`PcobSource.ts#L68-L82`](../backend/src/ingest/pcob/pcob-source.ts#L68-L82), [`app.ts#L269-L313`](../backend/src/app.ts#L269-L313).
- **Approval Status:** Approved (2026-10-19).

---

### `D-05`: Overlay Legend (`ALIVE / KNOCKED / ELIM`) in Manual Mode

- **Question:** Should the overlay footer legend hide `KNOCKED` when Manual Mode is active?
- **Chosen Solution:** **Hide `KNOCKED` in the legend when `source === 'manual'`** so the legend displays `ALIVE` (`--player-alive`) and `ELIM` (`--player-dead` gray), matching the two states used in Manual Mode.
- **Evidence:** [`LeaderboardOverlay.tsx#L7-L11, L96-L122`](../frontend/src/components/overlay/LeaderboardOverlay.tsx#L7-L11).
- **Approval Status:** Approved (2026-10-19).

---

### `D-06`: Automatic Map Closing (`shouldAutoCloseNow`) in Manual Mode

- **Question:** Should maps auto-close into `series.json` when `standingTeamCount <= 1` in Manual Mode, or require explicit operator action?
- **Chosen Solution:** **Disable automatic map close in Manual Mode**; maps close into `series.json` only when the operator clicks **Close current map now**.
- **Evidence:** [`app.ts#L291-L298`](../backend/src/app.ts#L291-L298), [`series-store.ts#L254-L272`](../backend/src/state/series-store.ts#L254-L272).
- **Reasoning & Consequences:** Prevents accidental map closing while an operator is stepping through team wipes and entering final kill counts.
- **Approval Status:** Approved (2026-10-19).

---

### `D-07`: Default Mode on Startup & Mode Switch Behavior

- **Question:** What is the initial mode on a fresh install, and does it persist across restarts?
- **Chosen Solution:** Default to `auto` (`pcob` or `mock` per `INGEST_SOURCE`) when `manual-match.json` is first created; persist the selected mode across browser reloads and backend restarts.
- **Approval Status:** Approved (2026-10-19).

---

### `D-08`: Admin UI Placement of Manual Mode Controls

- **Question:** Where should the Manual Mode controls be placed in the Admin UI?
- **Chosen Solution:** **Dedicated `Manual control` tab** in the Admin navigation bar + **always-visible Mode Toggle (`PCOB API` / `Manual`)** in the sticky header (`AdminPage.tsx`).
- **Approval Status:** Approved (2026-10-19).
