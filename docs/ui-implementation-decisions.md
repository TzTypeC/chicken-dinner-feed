# UI/UX & Broadcast Overlay Implementation Decisions

## 1. Verified Facts vs. Approved Architectural Decisions

### 1.1 Verified Facts (From Repository Source Code)

- **Routing (`frontend/src/router.tsx`):** Uses `@tanstack/react-router`. Currently defines `/`, `/admin`, and `/overlay/$instanceId`.
- **Overlay Surface (`frontend/src/pages/OverlayPage.tsx` & `frontend/src/styles/globals.css`):** Setting `document.documentElement.dataset.surface = 'overlay'` makes `html, body, #root` transparent (`background: transparent !important`) and overflow-hidden for OBS Browser Sources.
- **Resolution-Independent Overlay Scaling (`frontend/src/lib/overlay-scale.ts`):** `useOverlayScale()` sets `--overlay-unit` on `:root` (`min(vw / 1920, vh / 1080)`), and `u(px)` returns `calc(px * var(--overlay-unit))`.
- **Appearance Persistence (`shared/src/config/overlay-instance.ts`):** `overlayAppearanceSchema` is validated by Zod and persisted in `overlay-instances.json` via `ConfigStore`. Changes via `PUT /api/overlays/:id` broadcast `{ type: 'overlay', instance }` over `/api/live`.
- **Series Persistence (`shared/src/domain/series.ts`):** `seriesDocumentSchema` is persisted in `series.json` via `SeriesStore`. `closedMapResultSchema` already includes `mapName: z.string().nullable()`.
- **Elimination State (`shared/src/domain/match.ts`):** `teamSchema` includes `teamNo`, `name`, `logoUrl`, `hasAppeared`, `isEliminated`, `standingPlayerCount`, `eliminations`, `placement`, and `totalPoints`. Both PCOB Mode (`match-store.ts`) and Manual Mode (`manual-store.ts`) populate these exact fields on `LiveSnapshot.match.teams`.

---

## 2. User-Approved Decisions Log (`D-UI-01` – `D-UI-06`)

### `D-UI-01` — Overlay Routes & Theme Inheritance

- **Approved Choice:** Support both global default routes and per-instance routes (plus `?instance=<id>` query parameter):
  - **Leaderboard Overlay (unchanged):** `/overlay/:instanceId`
  - **Team Elimination Notification Overlay:** `/overlay/elimination` (uses `default` instance) **and** `/overlay/:instanceId/elimination` (inherits `:instanceId` colors, fonts, and toggles).
  - **Match Information Overlay:** `/overlay/match-info` (uses `default` instance) **and** `/overlay/:instanceId/match-info` (inherits `:instanceId` colors, fonts, and toggles).

### `D-UI-02` — Team Elimination Notification Content & Toggleable Elimination Count

- **Approved Choice:**
  - Top-center alert banner displaying **Placement (`#N`)**, **Team Logo** (when `showLogos: true`), **Team Name**, **`TEAM ELIMINATED` status badge**, and **Match Eliminations count (`N ELIMS`)**.
  - **Toggleable Elimination Count (`showEliminationAlertElims: boolean`, default `true`):** Add an explicit `[ON / OFF]` toggle button in the Admin Overlays configuration so the operator can turn the elimination count badge on the Elimination Notification banner ON or OFF at any time.
  - **Master Elimination Alert Toggle (`showEliminationAlerts: boolean`, default `true`):** Add an `[ON / OFF]` toggle to enable or mute elimination alert popups on the overlay without removing the OBS Browser Source.
  - **Detection & Deduplication:** Client-side state-transition queue (`useEliminationQueue`) seeded from the initial `LiveSnapshot` of each `matchId` (zero false triggers on initial page load, refresh, or WebSocket reconnect; FIFO queue for simultaneous eliminations; automatic cancellation/reset if an operator undoes `aliveCount === 0` in Manual Mode or resets the match).

### `D-UI-03` — Match Number & Map Configuration Workflow

- **Approved Choice:**
  - Provide a **Match & Map Configuration** bar in both the **`Series control`** and **`Manual control`** tabs (with a toggleable compact view so it can be collapsed/expanded as needed).
  - Uses a safe **Draft → "Apply to Live"** workflow (`PUT /api/series/match-info`) so mid-typing edits never flicker live on broadcast.
  - Includes 1-click competitive PUBG map presets (`Erangel`, `Miramar`, `Sanhok`, `Vikendi`, `Rondo`, `Taego`, `Deston`, `Livik`, `Karakin`) plus custom map text input (`maxLength: 64`).
  - Automatically stamps `activeMapName` onto `ClosedMapResult.mapName` when a map closes into series history.
  - Includes `[ON / OFF]` toggles for the **Match Information Overlay** (`showMatchInfo: boolean`, default `true`) and **Show Map Name on Match Info Overlay** (`showMatchInfoMapName: boolean`, default `true`).

### `D-UI-04` — Team Logo Visibility Toggle (`showLogos`)

- **Approved Choice:**
  - Add `showLogos: z.boolean().default(true)` to `overlayAppearanceSchema` (`shared/src/config/overlay-instance.ts`) and `feedbackDocumentSchema` (`shared/src/protocol/feedback.ts`).
  - Add a **Show team logos `[ON / OFF]`** toggle button in `AppearanceEditor.tsx`.
  - When `showLogos === false`, `LeaderboardOverlay.tsx` and `TeamRow.tsx` collapse from a 6-column grid to a 5-column grid (`rank`, `teamName`, `alive`, `pts`, `elims`) and omit the logo cell completely so no empty space remains. Also hides the logo slot in the Elimination Notification Overlay.

### `D-UI-05` — Responsive Admin Panel Redesign

- **Approved Choice:**
  - **`AdminPage.tsx`:** Replace the fixed inline 3-column grid on the Overlays tab with a responsive layout (`1 column` on `< 768 px`, `2 columns` on `768–1023 px`, `3 columns` with collapsible sidebar on `>= 1024 px`). Make the 7-tab `<nav>` horizontally scrollable (`overflow-x-auto whitespace-nowrap`) with touch-sized (`>= 42px`) buttons and compact mobile header padding.
  - **`ManualControl.tsx`:** Provide both the 8-column desktop table (with sticky `Team` column) and a responsive **Mobile Operator Card view** (defaulting to Cards on `< 768 px` and Table on `>= 768 px`, with an explicit **`View: Auto / Cards / Table`** toggle button so the operator can switch views on any screen).
  - **`AppearanceEditor.tsx`, `ScoringEditor.tsx`, `TeamRosterEditor.tsx`, `SeriesControl.tsx`, `MapResultDialog.tsx`:** Convert fixed multi-column grids to responsive breakpoint grids so `320 px` viewports have zero horizontal overflow or clipped inputs.

### `D-UI-06` — Optional Enhancements (All Included & Toggleable ON/OFF)

Per user direction (_"try implement all of it but it can be turned on and off"_):

1. **Master Visibility & Detail Toggles (`[ON / OFF]`):**
   - `Show team logos` (`showLogos`: `ON` / `OFF`)
   - `Elimination alert overlay` (`showEliminationAlerts`: `ON` / `OFF`)
   - `Elimination alert kill count` (`showEliminationAlertElims`: `ON` / `OFF`)
   - `Match info overlay` (`showMatchInfo`: `ON` / `OFF`)
   - `Match info map name` (`showMatchInfoMapName`: `ON` / `OFF`)
2. **"Test Elimination Alert" Button & Multi-Overlay Live Preview Toggle:**
   - In `OverlayPreview.tsx`, operators can toggle preview layers (`Leaderboard`, `Match Info`, `Elimination Alert`) ON/OFF and click **Test Elimination Alert** to trigger a preview popup without altering match state.
3. **Live Status Filter Pills & View Mode Toggle in `ManualControl.tsx`:**
   - Filter pills (`All`, `In Lobby`, `Still Alive`, `Eliminated`) and Layout mode toggle (`Auto`, `Cards`, `Table`) can be switched on/off at any time.
4. **Copyable OBS Browser Source URL Directory:**
   - Collapsible/toggleable URL directory in the Overlays tab providing 1-click copy for Leaderboard, Elimination Alert, and Match Info URLs.
