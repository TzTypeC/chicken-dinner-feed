# Design Proposal & Implementation Plan — Per-Instance Overlay Architecture, Independent ON AIR Controls, Match/Series Statistics & Dual WWCD

**Document Version:** 1.0.0  
**Date:** 2026-10-20  
**Status:** `PENDING_USER_APPROVAL`  
**Target Codebase:** [`T:\codebook\guthib\chicken-dinner-feed`](file:///T:/codebook/guthib/chicken-dinner-feed)  
**Reference Fork:** [`T:\codebook\guthib\pmcc2026\chicken-dinner-feed`](file:///T:/codebook/guthib/pmcc2026/chicken-dinner-feed)

---

## 1. Current-State Findings & Problem Statement

### 1.1 Verified Strengths of Current Codebase

- **Robust Scoring & Ingestion:** PCOB telemetry ingestion and Manual mode fallback (`ManualStore`) operate seamlessly with stable sorting, tie-breaking, and placement derivation (`standings.ts`).
- **Authoritative Match Persistence:** `SeriesStore` persists immutable `ClosedMapResult` entries in `series.json`, preventing data loss across server restarts.
- **Strict Visual Token Hierarchy:** Complete PMCC 2026 color system (Obsidian `#160F0A`, Mahogany `#26180F`, Gold `#E5A93C`, Champagne `#E7D8AD`, Ivory `#F9EDD9`, Bronze `#816036`, Crimson `#A83820`, Gunmetal `#3D362B`) and resolution scaling (`ub()`) are established.
- **Passing Test Suite:** Baseline test suite passes with **343/343 tests passing**, 0 TypeScript errors, 0 linter warnings, and a successful production build.

### 1.2 Core Architectural Deficiencies to Resolve

1. **Single-Type Schema Constraint:** `overlayInstanceSchema.type` is hard-coded to `z.literal('leaderboard')`. The system cannot configure an instance whose intrinsic type is WWCD, Postgame, Final-4, Match Info, or Elimination.
2. **Volatile In-Memory ON AIR Control:** `OverlayControlStore` stores visibility in an in-memory `Map<string, OverlayVisibility>`. Server restarts or crashes wipe operator ON AIR / HIDE states.
3. **Inconsistent Route Gating:** Routes such as `/overlay/elimination` and `/overlay/postgame` ignore `overlay.visible`, rendering on OBS even if the operator toggled HIDE in the panel.
4. **Single Postgame Screen Conflation:** The single `/overlay/postgame` route attempts to mix single-match results with cumulative series numbers. No dedicated tournament cumulative standings overlay exists.
5. **No Fullscreen WWCD in Main Codebase:** Only a 1140px centered card exists. The 1920×1080 stage celebration developed in the local fork (`koalaruu`) has not yet been integrated.

---

## 2. Proposed Overlay & Instance Architecture

### 2.1 Multi-Type Overlay Registry

We define a formal union of 8 distinct overlay types:

```typescript
export const overlayTypeSchema = z.enum([
  'leaderboard', // Standard vertical live tower
  'final4', // Horizontal 4-squad top bar
  'match-info', // Match number & map info pill
  'elimination', // Transient team elimination banner
  'wwcd', // Standard centered victory card (1140px)
  'wwcd-fullscreen', // Fullscreen 1920×1080 cinematic stage celebration
  'postgame-match', // Single completed match results & winner spotlight
  'postgame-series', // Cumulative tournament standings across Match 1..N
]);
export type OverlayType = z.infer<typeof overlayTypeSchema>;
```

### 2.2 Independent Instance Model

Each overlay instance is an autonomous entity with its own persistent identity, configuration, and operator controls:

```typescript
export const overlayInstanceSchema = z.object({
  id: overlayInstanceIdSchema, // Stable slug (e.g. "main-tower", "wwcd-full", "series-board")
  name: z.string().min(1).max(60), // Human-readable operator label
  type: overlayTypeSchema, // Intrinsic overlay type
  enabled: z.boolean().default(true), // Master enable switch
  onAir: z.boolean().default(true), // PERSISTENT ON AIR / HIDE state
  appearance: overlayAppearanceSchema, // Scoped styling, layout, typography, palette
  animation: overlayAnimationSchema, // Scoped entrance, exit, timing, easing
});
export type OverlayInstance = z.infer<typeof overlayInstanceSchema>;
```

### 2.3 Architectural Guarantees

- **Configuration Isolation:** Editing the colors or animations of instance `A` (e.g. `main-tower`) has zero effect on instance `B` (e.g. `secondary-tower` or `wwcd-full`).
- **Visibility Isolation:** Toggling ON AIR for `wwcd-fullscreen` does not toggle `wwcd` (Standard) or any other instance.
- **Persistence Across Restarts:** Both `appearance` and `onAir` state persist to `overlay-instances.json`. On server reboot, all browser sources resume their exact pre-restart broadcast state.
- **Component Reuse Without Code Duplication:** Overlays share foundational primitives (`TeamRow`, `AlivePlayerBars`, `overlay-scale`, `appearanceToCssVariables`, `formatTeamSlot`) while rendering instance-scoped presentation.

---

## 3. Complete Route Inventory & URL Directory

### 3.1 Universal Instance-Direct Route

- **`/overlay/:instanceId`**  
  _Behavior:_ Resolves the instance by its unique `id` and automatically renders the appropriate component based on its configured `type`. This is the canonical URL format for OBS/vMix operators.

### 3.2 Explicit Type-Scoped Routes

For multi-instance workflows and explicit scene organization, typed endpoints resolve directly to the named instance:

- **`/overlay/:instanceId/main`** &rarr; Leaderboard Tower
- **`/overlay/:instanceId/final4`** (alias: `/overlay/:instanceId/final-four`) &rarr; Final-4 Top Bar
- **`/overlay/:instanceId/match-info`** &rarr; Match Information Pill
- **`/overlay/:instanceId/elimination`** &rarr; Team Elimination Alert Banner
- **`/overlay/:instanceId/wwcd`** &rarr; Standard WWCD Victory Overlay
- **`/overlay/:instanceId/wwcd-fullscreen`** &rarr; Fullscreen WWCD Celebration
- **`/overlay/:instanceId/postgame-match`** (alias: `/overlay/:instanceId/postgame`) &rarr; Single-Match Postgame Results
- **`/overlay/:instanceId/postgame-series`** &rarr; Cumulative Series Tournament Standings

### 3.3 Backward-Compatible Shortcuts & Aliases

Existing production URLs and OBS scenes continue to work without modification by routing to the designated default instance for each type:

| Legacy / Shortcut URL                                              | Target Overlay Type | Resolved Default Instance |
| ------------------------------------------------------------------ | ------------------- | ------------------------- |
| `/main`                                                            | `leaderboard`       | `main`                    |
| `/final4`, `/final-four`, `/overlay/final4`, `/overlay/final-four` | `final4`            | `default-final4`          |
| `/match-info`, `/overlay/match-info`                               | `match-info`        | `default-match-info`      |
| `/elimination`, `/overlay/elimination`                             | `elimination`       | `default-elimination`     |
| `/wwcd`, `/overlay/wwcd`                                           | `wwcd`              | `default-wwcd`            |
| `/wwcd-fullscreen`, `/overlay/wwcd-fullscreen`                     | `wwcd-fullscreen`   | `default-wwcd-fullscreen` |
| `/postgame`, `/overlay/postgame`, `/postgame-match`                | `postgame-match`    | `default-postgame-match`  |
| `/postgame-series`, `/overlay/postgame-series`                     | `postgame-series`   | `default-postgame-series` |

---

## 4. Configuration & Persistence Schema

### 4.1 Schema Version Bump

- Bumps `CONFIG_SCHEMA_VERSION = 5` and `PROTOCOL_VERSION = 10`.

### 4.2 Factory Default Instances (`DEFAULT_OVERLAY_INSTANCES`)

A clean install or migrated setup automatically provisions dedicated default instances for all 8 overlay types:

```typescript
export const DEFAULT_OVERLAY_INSTANCES: OverlayInstancesDocument = {
  schemaVersion: 5,
  instances: [
    {
      id: 'main',
      name: 'Main Leaderboard (Tower)',
      type: 'leaderboard',
      enabled: true,
      onAir: true,
      appearance: { ...DEFAULT_OVERLAY_APPEARANCE, anchor: 'left' },
      animation: DEFAULT_OVERLAY_ANIMATION,
    },
    {
      id: 'default-final4',
      name: 'Final-4 Top Bar',
      type: 'final4',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
      animation: { ...DEFAULT_OVERLAY_ANIMATION, type: 'slide', direction: 'top' },
    },
    {
      id: 'default-match-info',
      name: 'Match Info Pill',
      type: 'match-info',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
      animation: { ...DEFAULT_OVERLAY_ANIMATION, type: 'fade' },
    },
    {
      id: 'default-elimination',
      name: 'Elimination Alerts',
      type: 'elimination',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
      animation: { ...DEFAULT_OVERLAY_ANIMATION, type: 'slide', direction: 'top' },
    },
    {
      id: 'default-wwcd',
      name: 'Standard WWCD Card',
      type: 'wwcd',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
      animation: { ...DEFAULT_OVERLAY_ANIMATION, type: 'zoom-fade' },
    },
    {
      id: 'default-wwcd-fullscreen',
      name: 'Fullscreen WWCD Celebration',
      type: 'wwcd-fullscreen',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
      animation: { ...DEFAULT_OVERLAY_ANIMATION, type: 'fade', durationMs: 600 },
    },
    {
      id: 'default-postgame-match',
      name: 'Postgame Match Results',
      type: 'postgame-match',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
      animation: { ...DEFAULT_OVERLAY_ANIMATION, type: 'fade' },
    },
    {
      id: 'default-postgame-series',
      name: 'Postgame Series Standings',
      type: 'postgame-series',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
      animation: { ...DEFAULT_OVERLAY_ANIMATION, type: 'fade' },
    },
  ],
};
```

### 4.3 Persistence Implementation

- When an operator changes ON AIR / HIDE via the admin panel or Companion HTTP API (`/api/overlays/:instanceId/show` or `/hide`), the `OverlayControlStore` updates its state and triggers `ConfigStore.saveInstances()`.
- State is serialized atomically to `backend/data/overlay-instances.json`.
- The live WebSocket broadcast emits the updated `overlay` message to all connected clients immediately.

---

## 5. ON AIR / HIDE Behavior & Match-State Interaction

### 5.1 The Universal Visibility Equation

Every overlay surface renders if and only if:

$$\text{renderVisible} = \text{instance.enabled} \land \text{instance.onAir} \land \text{stateAllowsRendering} \land \text{configurationAllowsRendering}$$

### 5.2 Deterministic State Matrix

| Overlay Type          | `instance.onAir === false` (HIDE)                        | `instance.onAir === true` & State Condition                                                                               |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **`leaderboard`**     | Completely hidden (DOM unmounted via `AnimatePresence`). | Visible during active gameplay when `aliveSquads > 4` (or when Final-4 transition is OFF). Hides during Final-4 and WWCD. |
| **`final4`**          | Completely hidden.                                       | Visible when `2 <= aliveSquads <= 4` and `eliminatedCount >= 1` (phase &ne; `'idle'`). Hides when victory confirmed.      |
| **`match-info`**      | Completely hidden.                                       | Visible when `appearance.showMatchInfo` is ON and active mode is `tower`.                                                 |
| **`elimination`**     | Completely hidden (queue suppressed).                    | Renders animated banner when a squad elimination occurs during active match.                                              |
| **`wwcd`**            | Completely hidden.                                       | Visible when `aliveSquads === 1` and victory is confirmed (or finished match/closed map present).                         |
| **`wwcd-fullscreen`** | Completely hidden.                                       | Visible when `aliveSquads === 1` and victory is confirmed (or finished match/closed map present).                         |
| **`postgame-match`**  | Completely hidden.                                       | Visible when closed map or finished match exists (intended for post-match OBS scene).                                     |
| **`postgame-series`** | Completely hidden.                                       | Visible when closed maps exist across tournament (intended for series wrap-up scene).                                     |

### 5.3 Coexistence of Dual WWCD Variants

- If an operator leaves both `wwcd` (Standard) and `wwcd-fullscreen` ON AIR, they can be placed in separate OBS scenes (e.g. In-Game scene uses Standard, Celebration scene uses Fullscreen).
- If both are added to the _same_ scene, an appearance setting `autoTransitionVariant: 'standard' | 'fullscreen'` dictates which variant activates on automatic match victory.

---

## 6. Postgame Variant A — Single-Match Statistics (`postgame-match`)

### 6.1 Purpose & Data Integrity

Displays the official results of **one completed match only**.

- Authoritative source: `LiveSnapshot.lastClosedMap` (with finished live match fallback).
- Strictly displays **single-match points**: $\text{Total Match Points} = \text{Placement Points} + \text{Kill Points}$.
- Does **not** display cumulative tournament totals as match totals.
- Displays an intentional, polished empty state if no match has concluded.

### 6.2 Layout Architecture (1920×1080)

- **Top Header:** Event title, `MATCH N RESULTS • MAP NAME`, PMCC architectural gold border, diamond (`◇`) nodes.
- **Left Hero Spotlight (460px):**
  - `#1 WINNER WINNER CHICKEN DINNER`
  - Large Winner Team Logo
  - Fixed Slot Identifier (`SLOT T01–T25`)
  - Team Name
  - `#1 PLACEMENT`
  - Match Eliminations (`ELIMS`)
  - Placement Points (`PLACE PTS`)
  - Elimination Points (`ELIM PTS`)
  - Match Total Points (`MATCH TOTAL PTS` in oversized championship gold)
- **Right Standings Table (~1200px):**
  - Displays all participating teams (`#1` through `#25`) ordered by `totalMatchPoints` descending.
  - Columns: `RANK`, `SLOT` (`T01..T25`), `LOGO`, `TEAM NAME`, `PLACE`, `ELIMS`, `PLACE PTS`, `ELIM PTS`, `MATCH PTS`.
  - Automatically splits into **2 balanced side-by-side columns** when `teams > 12` (zero vertical scrolling on 1080p).
- **Background Media Layer:** Scoped to this instance (`disabled`, `image`, `video`, `opacity: 0–100%`, `blur: 0–24px`).

---

## 7. Postgame Variant B — Cumulative Series Statistics (`postgame-series`)

### 7.1 Purpose & Data Integrity

Displays overall tournament standings accumulated across **Match 1 through Match N**.

- Authoritative source: Authoritative aggregation derived from `series.json` (`closedMaps` array).
- Aggregation guarantees:
  - Each closed map is processed exactly once.
  - Re-derived fresh on every request; no stale caches.
  - Cumulative Placement Points: $\sum \text{placementPoints}$.
  - Cumulative Elimination Points: $\sum \text{killPoints}$.
  - Cumulative Total Points: $\sum \text{totalPoints}$.
  - WWCD Count: Count of closed maps where team finished with $\text{placement} = 1$.
- Tie-breaking rules follow official PUBG Esports standards:
  1. Total Cumulative Points
  2. Total WWCD Count
  3. Total Placement Points
  4. Total Elimination Points
  5. Placement in most recent match

### 7.2 Layout Architecture (1920×1080)

- **Top Header:** `TOURNAMENT OVERALL STANDINGS • MATCHES 1–N • CUMULATIVE LEADERBOARD`.
- **Tournament Leader Spotlight:** Prominent gold badge highlighting current #1 series squad.
- **Full Series Standings Table:**
  - Displays all tournament squads (`#1` through `#25`).
  - Columns: `RANK`, `SLOT` (`T01..T25`), `LOGO`, `TEAM NAME`, `MATCHES PLAYED (M)`, `WWCD (🍗 / count)`, `PLACE PTS`, `ELIM PTS`, `TOTAL PTS`.
  - Balanced 2-column layout (Ranks 1–8 / 9–16 or 1–12 / 13–25) to guarantee full legibility with zero scrolling.
- **Background Media Layer:** Independent background media configuration.

---

## 8. Dual WWCD Implementation — Standard & Fullscreen

### 8.1 Variant A — Standard WWCD Overlay (`wwcd`)

- Retains existing high-performing component [`WwcdOverlay.tsx`](file:///T:/codebook/guthib/chicken-dinner-feed/frontend/src/components/overlay/WwcdOverlay.tsx).
- 1140px centered card with PMCC 2026 mahogany/gold palette and diamond nodes.
- Intended for seamless overlay on live game feed.
- Dynamic roster support: Real player cards in PCOB mode; 4-bar survivor indicator in Manual mode.

### 8.2 Variant B — Fullscreen WWCD Celebration (`wwcd-fullscreen`)

- Reuses and elevates the local fork implementation from `T:\codebook\guthib\pmcc2026\chicken-dinner-feed`.
- Created as `frontend/src/components/overlay/FullscreenWwcdOverlay.tsx`.
- Composition:
  1. **Stage Atmosphere:** 3D stage depth, golden volumetric radial lighting, and optional stage background.
  2. **Squad Lineup:** 5 PUBG character cutouts (`char1.png`–`char5.png`) standing on the stage floor with staggered entrance motion.
  3. **Ceremonial Centerpiece:** Pulsing golden frying pan emblem (`animate-pulse-glow`) and 3D metallic typography ("WINNER WINNER CHICKEN DINNER").
  4. **Signature Marquee Ticker:** Continuous scrolling ribbon (`animate-wwcd-marquee`) with PMCC diamond dividers.
  5. **4-Column Esports Stats Panel:**
     - Box 1: Team Logo, Slot `T##`, Team Name, Round Winner label.
     - Box 2: Match Placement `#1 / N TEAMS`, Survived Till Last.
     - Box 3: Total Squad Frags (`ELIMS`).
     - Box 4: Total Match Points (`X RANK + Y ELIMS`).
- Adaptations applied to fork code:
  - Replaced hard-coded PMCC 2024 labels with dynamic tournament match info.
  - Applied PMCC 2026 design tokens and `ub()` broadcast resolution scaling.
  - Integrated `selectWwcdWinner()` and `LiveSnapshot.lastClosedMap`.
  - Added OBS transparency support (stage background can be toggled off for clean OBS compositing).

---

## 9. Reuse of Local Fullscreen WWCD Implementation

| Artifact from `pmcc2026` Fork        | Strategy                                                     | Integration Target                                          |
| ------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `characters/char1.png` – `char5.png` | Copy assets into main repository                             | `frontend/public/images/wwcd/characters/`                   |
| `chicken-dinner-badge.png`           | Copy golden pan asset                                        | `frontend/public/images/wwcd/chicken-dinner-badge.png`      |
| `postgame-bg.png`                    | Copy 3D stage background                                     | `frontend/public/images/wwcd/postgame-bg.png`               |
| `WwcdOverlay.tsx` (419 lines)        | Adapt layout, animations, marquee, and 4-column cards        | `frontend/src/components/overlay/FullscreenWwcdOverlay.tsx` |
| `RecapOverlay.tsx` (879 lines)       | Extract cumulative round matrix and series tie-breaker rules | `frontend/src/components/overlay/PostGameSeriesOverlay.tsx` |

---

## 10. Appearance & Animation Configuration per Overlay

In the Overlays panel, selecting an instance displays common controls plus **type-specific controls**:

1. **Common Controls (All Types):**
   - Instance Name & Instance ID
   - ON AIR / HIDE Button with live visual feedback
   - Colors: Background, Header, Alternating Row, Accent, Text, Muted Text
   - Typography: Font selection (Inter Bold, Rajdhani, Barlow Condensed, Arial, custom uploaded fonts)
   - Animation: Type (Fade, Wipe, Slide, Zoom-Fade), Direction, Duration (100–5000 ms), Easing, Cross-fade
2. **Type-Specific Controls:**
   - **`leaderboard`:** Anchor (Left/Right), Offset X/Y, Scale (40%–250%), MaxTeams (1–25), ShowLogos, ShowTeamNumbers, ShowLegend, Automatic Final-4 transition switch, Automatic WWCD switch.
   - **`final4`:** Top offset, Scale, ShowLogos, ShowTeamNumbers.
   - **`match-info`:** Top/Left offsets, Scale, ShowMapName.
   - **`elimination`:** Banner position (Top/Bottom), Alert duration, ShowElimCount.
   - **`wwcd` (Standard):** Card scale, ShowLogos, ShowTeamNumbers.
   - **`wwcd-fullscreen`:** ShowCharacters, ShowMarqueeTicker, StageBackground (Enabled/Disabled).
   - **`postgame-match`:** Background Media (Mode, Upload/Delete, Opacity, Blur), ShowLogos, ShowTeamNumbers.
   - **`postgame-series`:** Background Media (Mode, Upload/Delete, Opacity, Blur), ShowLogos, ShowTeamNumbers, ShowWwcdColumn.

---

## 11. Overlays Panel UI/UX Redesign

```
+---------------------------------------------------------------------------------------------------+
|  [PCOB API / MANUAL]  ● Connected  |  [Overlays]  [Manual]  [Teams]  [Scoring]  [Series]          |
+---------------------------------------------------------------------------------------------------+
| INSTANCES LIST (Grouped by Overlay Type)                  | INSTANCE EDITOR (Selected: wwcd-full) |
|                                                           |                                       |
|  ▼ In-Game HUD                                            | [ wwcd-full              ] [Delete]   |
|    ● Main Leaderboard Tower (main)           [ON AIR]     | [Save Changes]  ● ON AIR [Turn OFF]   |
|    ● Final-4 Top Bar (default-final4)        [ON AIR]     |                                       |
|    ● Match Info Pill (default-match-info)    [ON AIR]     | OBS URL (1920x1080):                  |
|    ● Elimination Alert (default-elim)        [ON AIR]     | [ http://localhost:3000/overlay/wwcd-full ] [Copy]
|                                                           |                                       |
|  ▼ Winner Celebrations                                    | LIVE PREVIEW                          |
|    ● Standard WWCD Card (default-wwcd)       [ON AIR]     | +-----------------------------------+ |
|  ► ● Fullscreen WWCD (wwcd-full)             [ON AIR]     | |  ★ WINNER WINNER CHICKEN DINNER ★ | |
|                                                           | |   [CHARACTERS]    [PAN BADGE]     | |
|  ▼ Post-Game Standings                                    | |   [4-COLUMN STATS PANEL]          | |
|    ● Single-Match Results (default-postgame) [ON AIR]     | +-----------------------------------+ |
|    ● Series Standings (default-series)       [ON AIR]     |                                       |
|                                                           | APPEARANCE & ANIMATION CONTROLS       |
|  [+ Create New Instance]                                  | - Fullscreen stage settings           |
|                                                           | - PMCC 2026 Colors & Fonts            |
+---------------------------------------------------------------------------------------------------+
```

- Instances are organized into clear collapsible broadcast groups: **In-Game HUD**, **Winner Celebrations**, **Post-Game Standings**, and **Custom Instances**.
- Every row features a prominent **[ON AIR] / [HIDE]** toggle with live color indicator (Green = ON AIR, Zinc = HIDE).
- Copyable OBS browser source URLs are front and center.
- Clear separation between Preview and broadcast state.

---

## 12. Migration & Backward-Compatibility Strategy

1. **Defensive Migration (`migrations.ts`):**
   - v4 &rarr; v5 migration detects existing `overlay-instances.json`.
   - Preserves existing `main` instance configuration, assigning `type: 'leaderboard'`, `onAir: true`, `enabled: true`.
   - Iterates through the 7 new overlay types. If an instance of that type is missing, appends the default instance for that type.
   - Operators lose no custom colors, offsets, or fonts.
2. **Backward-Compatible Route Handlers:**
   - `/overlay/:instanceId` handles any instance ID.
   - Pre-existing routes (`/final4`, `/wwcd`, `/match-info`, `/postgame`, `/elimination`) map transparently to their corresponding default instances.

---

## 13. Comprehensive Test Plan

### 13.1 Automated Tests

1. **Instance Isolation Tests:**
   - Verify changing colors of instance `A` leaves instance `B` completely unaffected.
   - Verify setting instance `A` to HIDE does not change instance `B`'s ON AIR state.
   - Verify instance deletion or reset leaves all other instances intact.
2. **ON AIR & Persistence Tests:**
   - Verify ON AIR state survives backend reload and server restart.
   - Verify Companion endpoints (`GET/POST /api/overlays/:id/show`, `/hide`, `/toggle`) toggle persisted state and broadcast WebSocket message.
3. **Single-Match Postgame Tests:**
   - Verify results derive solely from `lastClosedMap`.
   - Assert single-match points $\neq$ cumulative series points.
   - Verify 1-column vs 2-column layout split at $>12$ teams.
4. **Cumulative Series Standings Tests:**
   - Multi-match fixtures (Matches 1, 2, 3).
   - Verify points, WWCD count, placement points, and eliminations aggregate accurately.
   - Verify tie-breaking logic.
5. **Dual WWCD Tests:**
   - Standard WWCD renders 1140px card with winner stats.
   - Fullscreen WWCD renders 1920×1080 stage with characters, marquee, and 4-column cards.
   - Verify both handle PCOB real players and Manual mode cleanly.

### 13.2 Visual & Viewport Verification

- Verify all endpoints at 1920×1080, 1600×900, and 1280×720.
- Verify admin panel responsiveness across mobile (320px–480px), tablet (768px–1024px), and desktop (1440px+).
- Verify OBS transparency (alpha channel clean with zero opaque black frames when background is disabled).

---

## 14. Risks, Assumptions & Unresolved Questions

### 14.1 Assumptions

1. Operators run standard 1920×1080 OBS/vMix browser sources.
2. The character cutout art from the `pmcc2026` fork is authorized for use within this PMCC 2026 tournament package.
3. The authoritative tournament points model adheres to official PUBG Mobile 10-point scoring (1st: 10, 2nd: 6, 3rd: 5, 4th: 4, 5th: 3, 6th: 2, 7th: 1, 8th: 1, 9th–16th: 0, 1 pt per kill).

### 14.2 Questions for Review Gate

1. **Default Auto-Transition WWCD Variant:** When a match naturally ends with 1 surviving squad, should the automatic in-game victory transition default to the **Standard WWCD Card** (recommended for in-game scenes) or the **Fullscreen WWCD Celebration**? (Note: Both will be independently available on dedicated OBS URLs).
2. **Postgame Initial Match View:** For `postgame-match`, should the overlay always default to displaying the most recently closed map (`lastClosedMap`), or would you like an admin dropdown option to pin a specific past match number (e.g. "Match 2")?

---

## 15. Relevant Research Links & Concrete Contributions

1. **[Xtallet Broadcast Overlay System](https://xtallet.com/broadcasting):** Contributed the decoupled browser-source architecture, separating in-game HUD layers from full-screen ceremonial graphics and enforcing persistent slot tags (`T01–T25`) alongside live rank (`#1`).
2. **[OBS Studio Sources Guide](https://obsproject.com/kb/sources-guide):** Grounded the 1920×1080 fixed-canvas rendering convention, transparent OBS compositing, and layer isolation rules.
3. **[Fluid Studio PUBG Squad Battle](https://fluidstudio.co.uk/work/pubg-squad-battle):** Contributed the 3-layer background framing philosophy (ambient media &rarr; dark contrast scrim &rarr; 100% crisp foreground geometry), geometric border chamfers, and diamond (`◇`) separators.
4. **[PROPUBG / KRAFTON Esports Production](https://pubgesports.com/):** Contributed the split-screen asymmetric post-match composition and the zero-scroll 2-column balanced standings table for 16–25 squads.
