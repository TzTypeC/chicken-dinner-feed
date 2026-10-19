# UI & Broadcast Overlay Design References

## 1. Purpose

This document synthesizes the external design references inspected during Phase 2 and maps their concrete principles to the `chicken-dinner-feed` Admin Panel and Broadcast Overlays.

---

## 2. Admin Panel & Responsive Table References

### 2.1 W3C WAI — Tables Tutorial & Tips and Tricks

- **Sources Inspected:**
  - `https://www.w3.org/WAI/tutorials/tables/`
  - `https://www.w3.org/WAI/tutorials/tables/tips/`
- **Key Principles Extracted:**
  1. **Keep Tables Simple & Split by Sub-Topic:** Complex tables with too many mixed responsibilities are harder to interpret and operate, especially on narrow viewports or zoomed views.
  2. **Responsive Format Adaptation:** On small screens or zoomed views, responsive tables often change format (e.g., from wide multi-column tables to structured cards or compact grouped rows) while preserving the structural relationship between headers/labels and controls.
  3. **Alignment Rules:** Left-align text labels (team names) and right-align (or tabular-center) numeric data (`tabular-nums`) with matching column header alignment so operators can scan columns without losing row correlation.
  4. **Never Clip Overflowing Tables with `overflow: hidden`:** If a tabular view remains wider than the viewport on intermediate screens, wrap it in a scrollable container (`overflow-x: auto`) and anchor the row header (`<th scope="row">`) so the user never loses row context.
- **Application to `chicken-dinner-feed`:**
  - In `ManualControl.tsx`, preserve semantic `<table>` with `<th scope="col">` and sticky team identity on `>= 768 px`, and provide a dedicated **Mobile Operator Card Layout** on `< 768 px` where every control (`Alive`, `Elims`, `Placement`) is explicitly labeled and grouped under its team header without requiring horizontal scrolling.
  - In `AdminPage.tsx`, remove the fixed 3-column inline grid on `< 1024 px` so form controls in `AppearanceEditor.tsx` never get clipped.

---

## 3. Broadcast Overlay & Esports HUD References

### 3.1 LHM.gg — Esports Broadcast Overlay & CS2/LoL HUD Design Principles

- **Sources Inspected:**
  - `https://lhm.gg/blog/what-makes-a-good-lol-broadcast-overlay`
  - LHM CS2 HUD & Broadcast Overlay Design Guidelines
- **Key Principles Extracted:**
  1. **Match-Reading System First, Branded Frame Second:** Viewers must identify team identity, match/series context, and survival/elimination state in fractions of a second without waiting for a caster explanation.
  2. **The Overlay Should Become Quieter When the Game Becomes Louder:**
     - Keep the central gameplay area clear.
     - Animation must **communicate a state change, not delay it**—avoid constant looping animations, pulsing borders, or long flourishes. Movement should direct attention to a meaningful update (such as a team elimination) and then stop.
  3. **Distinguish Different Kinds of Numbers:** Match number, placement rank (`#12`), and elimination count (`4 ELIMS`) must use distinct labels, typography weights, or badge framing so a viewer never confuses placement with eliminations.
  4. **Design for the Smallest Realistic Viewing Condition:** Test readability assuming 1080p stream compression and mobile phone viewing. Names need intentional `text-overflow: ellipsis` truncation rules rather than shrinking fonts to unreadable sizes.

### 3.2 Genesis Motion Design — VALORANT Champions Tour (VCT) Pacific Case Study

- **Source Inspected:**
  - `https://genesismotiondesign.com/case-studies/valorant-champions-tour-pacific/`
- **Key Principles Extracted:**
  1. **Multi-Scale Modular Component Kit:** Broadcast graphics must read clearly across three scales simultaneously: large venue displays, 1920×1080 Twitch/YouTube streams, and mobile screens. Reusing a shared kit of structural tokens (dark slate/navy backplates, gold/crimson accent bars, consistent border radii, and display typography) makes separate overlays (`Leaderboard`, `Elimination Banner`, `Match Info Bug`) feel like a single cohesive broadcast package.
  2. **Game-Derived Motion Rhythm:** Transitions should be crisp, architectural, and purposeful (e.g., a fast `280ms` cubic-bezier snap-in followed by a stable hold and clean `240ms` exit) with zero dropped frames at 60fps.

### 3.3 Battle Royale / PUBG Esports Broadcast Conventions & Blackwire Visual System

- **Sources Inspected:**
  - PUBG Global Championship (PMGC / PGC) & Esports Tournament Visual Systems
- **Key Principles Extracted:**
  1. **Top-Center "Team Eliminated" Alert Banner:**
     - In Battle Royale broadcasts, squad eliminations are high-impact pacing milestones. The standard broadcast placement is **top-center**, dropping in smoothly for `3.5–4.5 seconds` with a high-contrast danger/gold accent bar, final placement rank (`#12`), team logo (when enabled), uppercase team name, `ELIMINATED` status label, and total match eliminations.
  2. **Top-Left Match & Map Information Bug:**
     - While the live standings tower occupies the right edge (`top-right`) and elimination alerts occupy `top-center`, the **Match Number & Map Name** (`MATCH 3 · ERANGEL`) sits cleanly in the `top-left` (or above the leaderboard), using a compact two-tone pill/bar that anchors the broadcast context without obscuring gameplay.
