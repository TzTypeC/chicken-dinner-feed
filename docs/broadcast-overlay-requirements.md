# Broadcast Overlay Requirements Specification

## 1. Overview & Compatibility Guarantees

This specification defines the broadcast overlay enhancements for `chicken-dinner-feed`:

1. **Team Elimination Notification Overlay** (independent browser-source URL with toggleable elimination count and master ON/OFF switch).
2. **Match Information Overlay** (independent browser-source URL showing current match number and toggleable map name, plus master ON/OFF switch).
3. **Team Logo Visibility Toggle** (`showLogos: boolean`) in the Overlays configuration tab.
4. **Live Preview & OBS URL Controls** in the Admin Overlays tab, including a **Test Elimination Alert** trigger and layer toggles.

### Non-Negotiable Compatibility Rules

- **Existing Leaderboard URLs Preserved:** Existing `/overlay/:instanceId` URLs (e.g., `/overlay/default`) continue to render the Leaderboard Overlay without any breaking changes to query parameters, WebSocket protocol, or OBS browser-source dimensions.
- **Data-Source Agnostic:** All overlays consume the unified `/api/live` WebSocket protocol (`LiveSnapshot`, `OverlayInstance`, `SeriesDocument`) and operate identically in **PCOB API Mode** and **Manual Mode**.
- **1920×1080 Broadcast Canvas Scaling:** All overlays use `document.documentElement.dataset.surface = 'overlay'` (transparent background) and the `u(designPixels)` (`--overlay-unit`) CSS variable scaling system established in ADR-0011.

---

## 2. Feature 1 — Team Elimination Notification Overlay

### 2.1 Addressing & Route Structure

- **Global Route:** `/overlay/elimination` (uses `default` overlay instance appearance, or `?instance=:instanceId` query parameter).
- **Instance-Scoped Route:** `/overlay/:instanceId/elimination` (inherits the specified `:instanceId` overlay instance's colors, typography, and `[ON/OFF]` toggles).

### 2.2 Visual Design, Toggles & Broadcast Positioning

- **Screen Anchor:** Top-center of the 1920×1080 broadcast frame (`top: u(48)`, horizontally centered via `left: 50%; transform: translateX(-50%)`).
- **Configurable `[ON / OFF]` Toggles on `OverlayAppearance`:**
  - **`showEliminationAlerts` (`boolean`, default `true`):** Master switch to enable or hide the Elimination Notification Overlay.
  - **`showEliminationAlertElims` (`boolean`, default `true`):** Toggle button to show or hide the eliminated team's match elimination count (`N ELIMS`) inside the notification banner.
  - **`showLogos` (`boolean`, default `true`):** Shows or hides the team logo box inside the notification banner (collapsing its space cleanly when `false`).
- **Banner Anatomy (Design Pixels at 1920×1080):**
  - **Left Accent & Placement Badge:** High-contrast crimson/amber elimination accent strip paired with the team's final placement rank (e.g., `#12`) in bold tabular display numerals.
  - **Team Logo Slot (when `showLogos === true`):** `u(48) × u(48)` crisp container; omitted with zero empty gap when `showLogos === false`.
  - **Identity & Status Column:**
    - Primary line: **Team Name** (uppercase bold display font, `text-overflow: ellipsis`, `white-space: nowrap`).
    - Secondary micro-label: **`TEAM ELIMINATED`** tracking-wide status badge.
  - **Right Stat Pill (when `showEliminationAlertElims === true`):** Match eliminations secured before wipe (e.g., `4 ELIMS` in `tabular-nums`); omitted cleanly when `showEliminationAlertElims === false`.
- **Idle State:** When no notification is active (or `showEliminationAlerts === false`), the overlay renders an empty transparent container (`pointer-events: none`, zero visible pixels).

### 2.3 Animation & Motion Lifecycle

1. **Enter (`280 ms`):** Crisp slide-down + fade-in from `translateY(calc(-1 * u(16)))` with `cubic-bezier(0.22, 1, 0.36, 1)`.
2. **Hold (`3800 ms`):** Static hold with zero looping distractions.
3. **Exit (`240 ms`):** Smooth upward fade-out (`opacity: 0; transform: translateY(calc(-1 * u(8)))`), followed by a `180 ms` gap before the next queued notification enters.

### 2.4 Elimination Detection, Queueing & Deduplication Logic

- **Rule 1 — Initial Snapshot / Reconnect Suppression:** When the overlay first mounts, refreshes, or reconnects to `/api/live` for the current `matchId`, all teams that are _already_ `isEliminated: true` are recorded in the baseline set **without** enqueueing notifications.
- **Rule 2 — Match Reset / New Match (`matchId` change):** When `snapshot.match.matchId` changes, the baseline set resets to the new match's initial state and any stale queued banners from the old match are cleared.
- **Rule 3 — Warmup Guard:** No elimination notifications fire while `snapshot.match.inWarmup === true`.
- **Rule 4 — Simultaneous Eliminations (FIFO Queue):** If multiple teams are eliminated in the same tick, they are sorted by placement descending (e.g., `#14` then `#13`) and displayed sequentially.
- **Rule 5 — Manual Mode Undo Handling:** If an operator marks a team `OUT` (`aliveCount: 0`) and restores `aliveCount > 0`, the team is removed from the seen set and any unshown queued notification for that team is cancelled.

---

## 3. Feature 2 — Match Information Overlay

### 3.1 Addressing & Route Structure

- **Global Route:** `/overlay/match-info` (uses `default` overlay instance appearance, or `?instance=:instanceId`).
- **Instance-Scoped Route:** `/overlay/:instanceId/match-info` (inherits `:instanceId` appearance and toggles).

### 3.2 Visual Design, Toggles & Broadcast Positioning

- **Screen Anchor:** Top-left (`top: u(42); left: u(48)` in 1920×1080 space).
- **Configurable `[ON / OFF]` Toggles on `OverlayAppearance`:**
  - **`showMatchInfo` (`boolean`, default `true`):** Master switch to show or hide the Match Information Overlay.
  - **`showMatchInfoMapName` (`boolean`, default `true`):** Toggle to show or hide the map name segment (`MATCH 3 · ERANGEL` vs. `MATCH 3`).
- **Content & Hierarchy:**
  - **Primary Segment:** `MATCH N` (using `series.activeMatchNumber ?? (series.maps.length + 1)`, rendered in bold uppercase display typography with `tabular-nums`).
  - **Secondary Segment (when `showMatchInfoMapName === true` and `activeMapName` is non-empty):** Crisp divider + uppercase **Map Name** (`ERANGEL`, `MIRAMAR`, `SANHOK`, `VIKENDI`, `RONDO`, etc.).

---

## 4. Feature 3 — Overlay Controls & Team Logo Visibility Toggle

### 4.1 Schema & State Persistence (`OverlayAppearance`)

Extend `overlayAppearanceSchema` in `shared/src/config/overlay-instance.ts` (and `feedbackDocumentSchema` in `shared/src/protocol/feedback.ts`):

```ts
showLogos: z.boolean().default(true),
showEliminationAlerts: z.boolean().default(true),
showEliminationAlertElims: z.boolean().default(true),
showMatchInfo: z.boolean().default(true),
showMatchInfoMapName: z.boolean().default(true),
```

All fields default to `true`, guaranteeing 100% backward compatibility with existing `overlay-instances.json` files on disk.

### 4.2 Layout Adaptation When `showLogos === false`

- **Leaderboard Overlay (`LeaderboardOverlay.tsx` & `TeamRow.tsx`):**
  - Switches `gridTemplateColumns` from 6 columns (`rank logo name alive pts elims`) to 5 columns (`rank name alive pts elims`) and omits the logo cell completely so no empty box or extra spacing remains.
- **Elimination Notification Overlay:**
  - Omits the logo container cleanly so the team name aligns directly next to the placement badge.
