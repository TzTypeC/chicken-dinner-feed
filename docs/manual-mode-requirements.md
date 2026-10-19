# Manual Mode — Requirements Specification

- **Status:** Draft — awaiting Phase 5 review and approval before implementation.
- **References:** [`docs/repository-audit.md`](repository-audit.md), [`docs/data-availability-matrix.md`](data-availability-matrix.md), [`docs/manual-mode-architecture.md`](manual-mode-architecture.md), [`docs/manual-mode-decisions.md`](manual-mode-decisions.md).

---

## 1. Project Objectives

1. Extend `chicken-dinner-feed` so operators can switch at runtime between:
   - **Automatic / PCOB Mode** (the existing pipeline driven by `PcobSource` or `MockSource` per `INGEST_SOURCE`), and
   - **Manual Mode** (an operator-driven live match state where team alive counts, eliminations, participation, and optional placement overrides are entered directly in the Admin UI).
2. Preserve 100 % of existing PCOB Mode functionality, overlay rendering, scoring rules, multi-map series history, Stream Deck `/feedback` integration, and backup import/export.
3. Ensure Manual Mode operates with zero dependency on the PCOB HTTP server (`127.0.0.1:10086`), so a tournament broadcast can run even when the PCOB client is unavailable, un-whitelisted, or crashed.

---

## 2. Functional Requirements

### 2.1 Mode Selection & Toggle (`REQ-MODE-*`)

- **`REQ-MODE-01` (Visible Mode Selector):** The Admin UI sticky header (`AdminPage.tsx`) SHALL provide a prominent, always-visible mode selector switching between **PCOB API Mode** (or **Mock Mode** when `INGEST_SOURCE=mock`) and **Manual Mode**.
- **`REQ-MODE-02` (Active Mode Indicator):** The Admin UI header status indicator SHALL clearly display when **Manual Mode** is active (distinct badge/color and label) vs. when **PCOB Mode** is active (`Connected` / `Connecting` / `Stale` / `Disconnected`).
- **`REQ-MODE-03` (Runtime Mode Switching):** Switching modes SHALL take effect immediately at runtime via a backend API endpoint without restarting the Node.js process or reloading open OBS browser sources.
- **`REQ-MODE-04` (Initial / Default Mode):** On a fresh installation, the application SHALL start in the configured `INGEST_SOURCE` mode (`pcob` by default). Once the operator selects a mode, that selection SHALL persist across page reloads and backend restarts (unless overridden by user decision D-01).
- **`REQ-MODE-05` (Confirmation on Switch):** Switching modes SHALL NOT destroy either mode's state. Because neither mode's state is lost on switch, a blocking confirmation dialog is optional (or shown only if the operator prefers a guard when an overlay is currently `ON AIR` — see Decision D-07).

### 2.2 Data-Source Isolation (`REQ-ISO-*`)

- **`REQ-ISO-01` (No Cross-Mode Overwrites):** While Manual Mode is active, incoming or late-resolving PCOB/Mock updates SHALL NOT overwrite or mutate the active manual match state or trigger WebSocket broadcasts.
- **`REQ-ISO-02` (PCOB Polling Lifecycle):** When switching to Manual Mode, the active automatic ingest source (`PcobSource` or `MockSource`) SHALL be stopped (`stop()`), and any in-flight poll completion after `stop()` SHALL be ignored. When switching back to PCOB/Mock Mode, the automatic source SHALL be started (`start()`) and immediately resume feeding `MatchStore`.
- **`REQ-ISO-03` (Independent State Preservation):** Switching from Manual Mode to PCOB Mode and back to Manual Mode SHALL restore the operator's manual match state intact.
- **`REQ-ISO-04` (No Stale False-Alarm in Manual Mode):** The 10-second silence timer (`MatchStore.markStaleIfSilent`) SHALL NOT mark the feed as `stale` while Manual Mode is active.

### 2.3 Manual Team & Match Input (`REQ-INPUT-*`)

- **`REQ-INPUT-01` (Shared Team Roster):** Manual Mode SHALL use the existing configured Team Roster (`ConfigStore.teams`: `teamNo` 1–25, `name`, `logoUrl`). Editing team names or logos on the **Teams** tab or importing `TeamLogoAndColor.ini` SHALL immediately reflect in Manual Mode.
- **`REQ-INPUT-02` (Live Manual Control Panel):** The Admin UI SHALL provide a dedicated manual live-scoring control view allowing the operator to view and edit all roster teams in a single compact table alongside or aware of the live standings.
- **`REQ-INPUT-03` (Alive Player Count Control):** For each team, the operator SHALL be able to set `aliveCount` (`0` to `4`) with a single click (direct buttons `0`, `1`, `2`, `3`, `4` and/or `-` / `+` steppers, plus a quick `Eliminate` action).
- **`REQ-INPUT-04` (Eliminations Counter):** For each team, the operator SHALL be able to increment/decrement `eliminations` (`-1`, `+1`, `+2`, `+4`) or type an exact non-negative integer (`0..99`).
- **`REQ-INPUT-05` (Team Participation Toggle):** For each roster team, the operator SHALL be able to toggle whether the team is participating in the current match (`present: boolean`, default `true`). Non-participating teams render with `hasAppeared = false` (dimmed to 25 % opacity and sorted last).
- **`REQ-INPUT-06` (Automatic Reversible Elimination Order & Optional Placement Override):**
  - When a team's `aliveCount` transitions from `> 0` to `0`, it SHALL automatically be recorded in the manual match's elimination order and receive the corresponding placement (`N`, `N-1`, …).
  - If the operator changes a team's `aliveCount` from `0` back to `> 0` (correcting an operator mistake), its automatic elimination placement SHALL be cleared immediately so the team returns to "still alive" (`placement: null`).
  - The operator SHALL also be able to set an explicit `placementOverride` (`1..25` or `Auto`) per team when manual placement correction is needed.
- **`REQ-INPUT-07` (New / Reset Manual Match):** The operator SHALL be able to reset the current manual match (with a confirmation dialog) to start a fresh map: all teams reset to `aliveCount = 4`, `eliminations = 0`, `placementOverride = null`, elimination history cleared, and a fresh `matchId` generated.
- **`REQ-INPUT-08` (Seed from Last PCOB State — Optional Action):** The operator MAY optionally initialize/copy the current PCOB match's kill counts and alive counts into Manual Mode when taking over mid-match after a PCOB failure (see Decision D-04).

### 2.4 Overlay & Series Compatibility (`REQ-COMPAT-*`)

- **`REQ-COMPAT-01` (Honest Alive Bars):** In Manual Mode, `AlivePlayerBars` SHALL display `aliveCount` full-height bars in `--player-alive` color and `4 - aliveCount` drained bars in `--player-dead` color. No fake partial health percentages SHALL be fabricated.
- **`REQ-COMPAT-02` (Automatic Points & Rank Calculation):** Kill points, placement points (including guaranteed-minimum points for surviving teams), series points, and leaderboard rank (`#`) SHALL be computed by the existing `computeStandings()` function using the active `ScoringRuleset` and `SeriesStore` totals.
- **`REQ-COMPAT-03` (Series Control Integration):** While in Manual Mode, clicking **Close current map now** on the Series Control tab (or in the Manual Control view) SHALL bank the manual match's results into `SeriesStore` (`series.json`) using the exact same survivor-resolution and duplicate-close guards as PCOB Mode.

---

## 3. Data Validation Rules

| Target              | Constraint                                                                  | Error / Fallback Behavior                                                                                |
| ------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `mode`              | `'pcob' \| 'mock' \| 'manual'` (or active mode toggle `'auto' \| 'manual'`) | Zod 400 validation error on invalid mode                                                                 |
| `teamNo`            | Integer `1..25`                                                             | Must exist in the request / roster; unknown `teamNo` ignored or rejected with HTTP 400                   |
| `aliveCount`        | Integer `0..4`                                                              | UI buttons restrict to `0..4`; API validates `z.number().int().min(0).max(4)`                            |
| `eliminations`      | Integer `0..999`                                                            | UI clamps `< 0` to `0`; API validates `z.number().int().min(0).max(999)`                                 |
| `present`           | `boolean`                                                                   | Defaults to `true`                                                                                       |
| `placementOverride` | `z.number().int().min(1).max(25).nullable()`                                | Duplicate non-null overrides across two teams in the same request rejected with a clear operator message |

---

## 4. Persistence Requirements

- **`REQ-PERSIST-01` (Backend JSON Persistence):** Because broadcast overlays run in separate browser sources (OBS/vMix) that read state exclusively from the backend over WebSocket, manual match state and active mode selection SHALL be persisted on the backend in `backend/data/` using `JsonDocument` (`atomic temp-file + fsync + rename`), surviving browser refreshes and backend restarts.
- **`REQ-PERSIST-02` (Schema Validation on Load):** Stored manual state SHALL be validated with a shared Zod schema on startup, falling back or migrating cleanly if absent.

---

## 5. Non-Functional Requirements

- **Latency:** A manual button press (`+1` elim, `0` alive) SHALL update the backend projection and broadcast a WebSocket snapshot within `< 100 ms` (subject only to `LiveHub`'s 50 ms coalescing window).
- **Operator Ergonomics:** Updating a team's kills or alive count during a firefight SHALL require **at most 1 click** (no modal dialog or separate "Save" button required for live counter increments).
- **Zero Unnecessary Dependencies:** Built entirely with existing workspace packages (`zod`, `fastify`, `react`, `zustand`, `lucide-react`, `tailwind`).

---

## 6. Acceptance Criteria

1. Operator can toggle between PCOB (or Mock) Mode and Manual Mode from the Admin UI header.
2. When Manual Mode is active, PCOB polling stops and `Disconnected` / `Stale` PCOB states do not appear.
3. Operator can adjust any roster team's alive count (`0–4`), eliminations (`≥ 0`), and participation (`present`), and see the Leaderboard Overlay (and Admin Preview) animate immediately.
4. Setting a team's alive count to `0` marks the team eliminated (dimmed row) and assigns its placement automatically; setting it back to `1–4` un-eliminates the team.
5. Operator can close a manual match into the multi-map Series History and reset the manual match for the next map.
6. Switching to PCOB Mode and back to Manual Mode preserves the manual match state.
7. Refreshing the Admin UI or restarting the backend preserves the active mode and manual match state.
8. All existing unit/integration tests and new Manual Mode tests pass, along with `typecheck`, `lint`, `format:check`, and `build`.

---

## 7. Open Questions Requiring User Input

See [`docs/manual-mode-decisions.md`](manual-mode-decisions.md) and the Phase 5 Review Summary for the concise list of product/workflow questions before implementation begins.
