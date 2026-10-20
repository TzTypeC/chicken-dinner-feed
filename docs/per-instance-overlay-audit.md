# Repository Audit & Technical Investigation — Per-Instance Overlay Architecture

**Document Version:** 1.0.0  
**Date:** 2026-10-20  
**Scope:** Architecture Audit (Phase 1), Local Fullscreen WWCD Investigation (Phase 2), and Broadcast Design Research (Phase 3).  
**Repository Working Directory:** [`T:\codebook\guthib\chicken-dinner-feed`](file:///T:/codebook/guthib/chicken-dinner-feed)  
**Investigation Target Directory:** [`T:\codebook\guthib\pmcc2026\chicken-dinner-feed`](file:///T:/codebook/guthib/pmcc2026/chicken-dinner-feed)

---

## 1. Executive Summary

This document establishes the verified baseline of the PUBG tournament broadcast overlay application across `@cdf/shared`, `@cdf/backend`, and `@cdf/frontend`. It details the findings from an exhaustive code audit of the current repository, an inspection of the local fullscreen WWCD fork in `T:\codebook\guthib\pmcc2026\chicken-dinner-feed`, and online research into professional broadcast overlay systems.

### Automated Test & Build Baseline (Recorded 2026-10-20)

- **Unit & Integration Tests:** `npm test` — **28 test files passed, 343 tests passed** (23 backend test files / 283 tests; 5 frontend test files / 60 tests).
- **TypeScript Typecheck:** `npm run typecheck` — **0 errors** across all 3 workspaces (`@cdf/shared`, `@cdf/backend`, `@cdf/frontend`).
- **Linter:** `npm run lint` — **0 warnings, 0 errors** (53 files checked by oxlint).
- **Format:** `npm run format:check` — Clean (Prettier code style matched).
- **Production Build:** `npm run build` — Successful exit code `0`.

---

## 2. Phase 1 — Current Repository Architecture Audit

### 2.1 Overlay Inventory & Configuration Matrix

| Overlay Surface              | Current Route                                                                                  | Instance Model                                           | Visibility Control                                                             | Data Source                                                           | Appearance Settings Supported                                                                                           | Animation Settings Supported                                                       | Persistence Location                                                     | Existing Tests                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Main Leaderboard (Tower)** | `/overlay/:instanceId`, `/overlay/:instanceId/main`, `/main`                                   | Shared `OverlayInstance` (typed `'leaderboard'`)         | `overlayStates[id].visible` (in-memory) + `activeLayoutMode === 'tower'`       | Live `snapshot.match`                                                 | Anchor (L/R), Offset X/Y, Scale, Fonts, 9-Color Palette, MaxTeams, ShowLogos, ShowTeamNos, ShowLegend                   | Fade, Wipe, Slide, Zoom-Fade; Direction; Easing; Duration; Cross-fade; Row stagger | `overlay-instances.json` (appearance only; visibility not persisted)     | `overlays.test.tsx` (Tower layout, scale, rows)                   |
| **Final-4 Leaderboard**      | `/overlay/:instanceId/final4`, `/overlay/final4`, `/final4`, `/overlay/:instanceId/final-four` | Inherits `instanceId` from route or defaults to `'main'` | `overlayStates[id].visible` + `2 <= standingTeams <= 4`                        | Live `snapshot.match` (captures locked 4-team cohort at 4 alive)      | Inherits main instance colors, scale, fonts, team numbers, logos                                                        | Framer Motion layout transitions & card fade                                       | Inherits main instance appearance; visibility not persisted              | `overlays.test.tsx` (Final-4 cohort retention, alive/elim states) |
| **Match Information**        | `/overlay/:instanceId/match-info`, `/overlay/match-info`, `/match-info`                        | Inherits `instanceId` or defaults to `'main'`            | `overlayStates[id].visible` + `showMatchInfo` + `activeLayoutMode === 'tower'` | `snapshot.matchInfo` (activeMatchNumber, activeMapName)               | Colors, scale, fonts, `showMatchInfoMapName`                                                                            | Inherits main animation settings                                                   | Inherits main instance appearance; `series.json` stores matchInfo        | `overlays.test.tsx`, `series-store.test.ts`                       |
| **Elimination Notification** | `/overlay/:instanceId/elimination`, `/overlay/elimination`, `/elimination`                     | Inherits `instanceId` or defaults to `'main'`            | **UNCONTROLLED** — Renders unconditionally if `showEliminationAlerts` is true! | Event-driven via `useEliminationQueue` from live match eliminations   | Colors, scale, fonts, `showEliminationAlertElims`                                                                       | Framer Motion slide-in / slide-out alert queue                                     | Inherits main instance appearance                                        | `useEliminationQueue.test.ts`, `overlays.test.tsx`                |
| **Standard WWCD Screen**     | `/overlay/:instanceId/wwcd`, `/overlay/wwcd`, `/wwcd`                                          | Inherits `instanceId` or defaults to `'main'`            | `overlayStates[id].visible` + `standingTeams === 1`                            | `selectWwcdWinner` (`lastClosedMap` with live finished fallback)      | 1140px centered card, colors, scale, fonts, team numbers, logos                                                         | Framer Motion scale/y-entrance (0.48s cubic-bezier)                                | Inherits main instance appearance                                        | `overlays.test.tsx` (winner detection, PCOB vs Manual cards)      |
| **Postgame Standings**       | `/overlay/:instanceId/postgame`, `/overlay/postgame`, `/postgame`                              | Inherits `instanceId` or defaults to `'main'`            | **UNCONTROLLED** — Renders unconditionally on route load!                      | `selectPostGameResults` (`lastClosedMap` with live finished fallback) | 1920×1080 asymmetric board, colors, fonts, logos, team numbers, 3-layer `postGameBackground` (mode, URL, opacity, blur) | Header/table entrance animations                                                   | Inherits main instance appearance; background media in `BackgroundStore` | `overlays.test.tsx`, `background-store.test.ts`                   |

### 2.2 Key Architectural Findings & Deficiencies

1. **Overlay Type Rigidity (`shared/src/config/overlay-instance.ts`):**
   - The type schema is strictly constrained: `type: z.literal('leaderboard')`.
   - The system has no concept of an instance of type `'wwcd'`, `'wwcd-fullscreen'`, `'final4'`, `'postgame-match'`, `'postgame-series'`, `'match-info'`, or `'elimination'`.
   - Every entry in `overlay-instances.json` is a "leaderboard" instance.
2. **Volatile In-Memory Visibility (`backend/src/state/overlay-control-store.ts`):**
   - `OverlayControlStore` maintains `private readonly states = new Map<string, OverlayVisibility>()`.
   - It explicitly notes: _"In memory only. Visibility is a moment-to-moment broadcast decision..."_
   - Consequently, server restarts or app reloads wipe operator ON AIR / HIDE states.
   - Requirement §3.3 explicitly demands: _"Changing an instance's status must persist across reloads and server restarts. Every instance's current status must be visible in the panel."_
3. **Inconsistent Route Gating:**
   - On `/overlay/:instanceId/elimination` and `/overlay/:instanceId/postgame`, `OverlayPage.tsx` currently ignores `overlay.visible`. The graphic renders whenever the route is loaded in OBS, even if the operator set that instance to HIDE in the admin panel!
4. **Single Postgame Screen Conflation:**
   - Only a single `/overlay/postgame` route exists.
   - Its header displays "POST-GAME MATCH STANDINGS - SINGLE-MATCH BREAKDOWN", but its right-hand table includes both `MATCH PTS` and `SERIES PTS`.
   - There is no dedicated cumulative series standings overlay displaying overall series rank, matches played, total WWCD count, total placement points, total kill points, and series points across Match 1 through Match N.
5. **No Fullscreen WWCD Variant in Active Codebase:**
   - Current `/overlay/wwcd` renders a 1140px centered modal card.
   - There is no 1920×1080 fullscreen winner reveal sequence with character staging, marquee ribbon, or cinematic celebration.

---

## 3. Phase 2 — Local Fullscreen WWCD Fork Investigation

### 3.1 Source Identification in `T:\codebook\guthib\pmcc2026\chicken-dinner-feed`

Inspection of `T:\codebook\guthib\pmcc2026\chicken-dinner-feed` reveals commit `88b6ad3` (`feat(overlay): add 4K PNG export, tournament recap, and WWCD celebration overlay`) by `koalaruu`:

- Source file: [`T:\codebook\guthib\pmcc2026\chicken-dinner-feed\frontend\src\components\overlay\WwcdOverlay.tsx`](file:///T:/codebook/guthib/pmcc2026/chicken-dinner-feed/frontend/src/components/overlay/WwcdOverlay.tsx) (419 lines).
- Supporting file: [`T:\codebook\guthib\pmcc2026\chicken-dinner-feed\frontend\src\components\overlay\RecapOverlay.tsx`](file:///T:/codebook/guthib/pmcc2026/chicken-dinner-feed/frontend/src/components/overlay/RecapOverlay.tsx) (879 lines).
- Assets in `T:\codebook\guthib\pmcc2026\chicken-dinner-feed\frontend\public\images\`:
  - `characters/char1.png` (852 KB, Hooded operative)
  - `characters/char2.png` (673 KB, Suit rifleman)
  - `characters/char3.png` (565 KB, Female sniper with cap & Kar98)
  - `characters/char4.png` (713 KB, Female commando)
  - `characters/char5.png` (595 KB, Central PUBG operative with Level 3 Helmet & AKM)
  - `chicken-dinner-badge.png` (25 KB, Golden pan WWCD emblem)
  - `postgame-bg.png` (10.5 MB, 3D stage background)
  - `winner-screen-ref.png` (692 KB, Reference broadcast layout)

### 3.2 Evaluation of Reusability vs Adaptations Needed

| Dimension                     | Local Fork Implementation                                                                                                                                                                                                         | Evaluation & Required Adaptation for Main Codebase                                                                                                                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual Composition**        | 1920×1080 fullscreen stage, 5-character squad lineup standing on stage floor, golden volumetric lighting, pulsing pan badge (`animate-pulse-glow`), scrolling marquee ribbon (`animate-wwcd-marquee`), and 4 esports stats boxes. | **HIGHLY REUSABLE.** The visual layout, character depth layering, marquee ticker, and 4-column esports bracket card layout are broadcast-grade and directly address Requirement §6.2.                                                                                                                          |
| **Theme & Palette**           | Hard-coded PMCC 2024 labels ("PMCC INDONESIA 2024", "PENS ESPORTS BROADCAST") with ad-hoc Tailwind colors (`#ffd24c`, `#f5c553`, `#18110a`, `#2bb0b8`).                                                                           | **MUST BE ADAPTED.** Replace hard-coded strings with dynamic tournament/match data; harmonize with PMCC 2026 design tokens (Obsidian `#160F0A`, Mahogany `#26180F`, Gold `#E5A93C`, Champagne `#E7D8AD`, Ivory `#F9EDD9`, Bronze `#816036`, Crimson `#A83820`, Gunmetal `#3D362B`) and instance CSS variables. |
| **Canvas Scaling**            | Uses browser viewport units (`w-screen h-screen`, `md:text-6xl`, fixed `h-[530px]`).                                                                                                                                              | **MUST BE ADAPTED.** Migrate to the project's standardized `ub()` scale functions (`overlay-scale.ts`) to ensure exact 1920×1080 pixel-perfect rendering regardless of OBS canvas scaling or preview containers.                                                                                               |
| **Data Contract & Fallbacks** | Reads volatile live state (`match.teams.find(t => t.rank === 1)`) with hard-coded fallback to demo team `BIGETRON RA`. Bypasses `ClosedMapResult`.                                                                                | **MUST BE ADAPTED.** Integrate with `selectWwcdWinner()` and `LiveSnapshot.lastClosedMap`. Gracefully handle both PCOB mode (real player names/kills) and Manual mode (survivor bars without fake player slots). Support persistent slot badges (`T01–T25`).                                                   |
| **Animation Stability**       | Marquee runs on infinite CSS keyframe. Framer Motion entrance has fixed delays.                                                                                                                                                   | **ENHANCE.** Ensure entrance sequence is controlled via `AnimatePresence` and does not restart or stutter on WebSocket snapshot updates.                                                                                                                                                                       |
| **OBS Transparency**          | Sets `bg-black` unconditionally.                                                                                                                                                                                                  | **ADAPT.** Allow background to be toggleable or composited over transparent canvas if an OBS operator uses their own video background source.                                                                                                                                                                  |
| **License & Attribution**     | Fork is derived from the same base repository under MIT / internal license.                                                                                                                                                       | **PERMITTED.** Code and assets can be incorporated cleanly into the main repository with proper documentation.                                                                                                                                                                                                 |

---

## 4. Phase 3 — Broadcast Design & Technical Research

### 4.1 References Grounding

1. **Xtallet Broadcast Architecture (`xtallet.com/broadcasting`):**
   - _Key takeaway:_ In professional mobile esports production, browser sources are organized as decoupled, independently controlled endpoints. The live in-game HUD (tower + top 4 bar) runs on one layer, while post-match and ceremonial screens (WWCD and Series Standings) run on separate layers or scenes. Each browser source has its own independent visibility state, preventing accidental double-renders.
2. **OBS Studio Sources Guide (`obsproject.com/kb/sources-guide` & `kb/browser-source`):**
   - _Key takeaway:_ Browser sources render at explicit canvas dimensions (1920×1080 at 60 fps). Transparent background (`background-color: transparent`) is mandatory for in-game HUD compositing. For full-screen graphics (post-game and fullscreen victory), background opacity and blur must be isolated to background media layers (`z-0`) so text and team logos remain razor-sharp.
3. **Fluid Studio — PUBG Squad Battle (`fluidstudio.co.uk/work/pubg-squad-battle`):**
   - _Key takeaway:_ Translates esports key visuals into flat, geometric broadcast graphics using architectural framing rules, diamond node separators (`◇`), metallic accent strips, and high-contrast typography. Heavy floating drop-shadows and pastel gradients are strictly avoided.
4. **PROPUBG & KRAFTON Esports Results Layouts:**
   - _Key takeaway:_ Post-game presentations require an asymmetric two-zone layout on a 16:9 frame. The left third features the winning squad spotlight; the right two-thirds provides a zero-scroll table. For tournaments with 16–25 squads, the table automatically splits into two balanced columns (`#1–#8` / `#9–#16` or `#1–#13` / `#14–#25`) with `14px–15px` row heights and tabular numerals.

---

## 5. Potential Breaking Changes & Migration Requirements

1. **Overlay Instance Configuration Schema (`overlay-instances.json`):**
   - Existing schema version is `4`. `instances` array contains objects with `type: 'leaderboard'`.
   - Moving to a multi-instance, multi-type model requires expanding `overlayInstanceSchema.type` from `z.literal('leaderboard')` to `z.enum([...])`.
   - Existing `main` instance must seamlessly migrate to `type: 'leaderboard'` with `onAir: true` and `enabled: true`.
   - New default instances (`final4`, `wwcd`, `wwcd-fullscreen`, `postgame-match`, `postgame-series`, `match-info`, `elimination`) must be seeded if not present so operators have ready-to-use endpoints out of the box.
2. **Visibility Persistence:**
   - Moving ON AIR / HIDE from volatile memory to persistent storage means `OverlayControlStore` or `ConfigStore` must write visibility changes to disk (e.g. `overlay-instances.json` or dedicated `overlay-control.json`), ensuring states survive restarts.
3. **URL Compatibility:**
   - Existing URLs `/overlay/final4`, `/overlay/wwcd`, `/overlay/match-info`, `/overlay/elimination`, `/overlay/postgame`, and shortcuts `/main`, `/final4`, `/wwcd`, etc., must continue to function by routing to the appropriate default instance.

---

## 6. Audit Summary

The repository provides solid, tested foundations:

- Reliable PCOB ingestion and fallback Manual Mode.
- Authoritative match persistence in `series.json` (`ClosedMapResult`).
- Real-time WebSocket fanout in `LiveHub`.
- Robust mathematical typography and broadcast scaling via `overlay-scale.ts`.

The primary gaps are:

1. Instances are currently hard-coded to a single type (`leaderboard`).
2. ON AIR / HIDE is in-memory only and unpersisted.
3. Postgame has no distinction between single-match breakdown and cumulative series standings.
4. Fullscreen WWCD exists only in the local fork and must be adapted and integrated.
5. Overlay routes do not uniformly respect instance ON AIR gating.
