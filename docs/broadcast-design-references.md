# Broadcast Design References — Final-4, WWCD, Post-Game Standings & Team Slot Identification

## 1. Research Scope

Before designing the layouts for **Persistent Team Slot Identification**, **Final-4 Top Bar**, **WWCD Victory Screen**, and **Post-Game Detailed Standings**, we researched the four starting broadcast references alongside official PUBG Esports (`PGS`, `PGC`, `PMGC`, `PMSL`, `PMCC`) production HUD patterns.

---

## 2. Starting Reference Analysis

### Reference 1 — PUBG Esports Official Broadcast & WWCD Coverage (`pubgesports.com/en/news/7400`)

- **Context:** Official PUBG Esports tournament coverage (PGS / PGC broadcast HUD package).
- **Layout & Hierarchy:**
  - During standard gameplay, a compact right-hand or left-hand vertical tower displays 16 teams with sharp rectangular rows, high-contrast solid/semi-opaque dark backgrounds, and minimal wasted padding.
  - When a match reaches **Top 4 (Final 4)**, the tall 16-row tower is dismissed because 12 of the 16 rows are dead space; the HUD transitions to **4 horizontal squad modules across the top of the 1920×1080 frame**, giving casters immediate visibility into the final 4 surviving squads, their remaining alive bars (`4` segments), current match eliminations, and total points.
  - Upon match completion (**WWCD**), a full-width/center-stage **WINNER WINNER CHICKEN DINNER** ceremonial banner announces the winning squad with their emblem, team name, and match eliminations before cutting to the post-match breakdown.
- **Avoided Anti-Patterns:** Official PGS/PGC overlays never use rounded consumer-app cards (`border-radius: 16px`), pastel badges, or drop-shadow-heavy floating glass boxes that wash out over bright desert/snow maps.

### Reference 2 — KRAFTON Esports Broadcast Production (`blog.krafton.com/5652/` — PGI.S Broadcast Experience)

- **Context:** KRAFTON's retrospective on PGI.S (PUBG Global Invitational.S) broadcast presentation and fan-centric esports storytelling.
- **Layout & Hierarchy:**
  - Emphasizes **storyline clarity for viewers and casters**: viewers must immediately understand both _who is winning the current fight/match_ (match kills, alive count, current placement) and _how that affects the tournament_ (total points / rank).
  - Post-match graphics separate the **featured match winner (#1 WWCD hero column)** from the **structured 16–25 team standings table**, allowing the broadcast to celebrate the match winner while letting viewers scan every team's placement, eliminations, and points in a clean 2-column or split-panel layout.

### Reference 3 — Xtallet Broadcast Overlay System (`xtallet.com/broadcasting`)

- **Context:** Specialized PUBG Mobile / BGMI esports broadcast production platform providing OBS/vMix browser source overlays.
- **Layout & Hierarchy:**
  - **Persistent Team Slot / Roster Number (`Slot #` / `T#`):** In PUBG Mobile and PCOB custom lobbies, observers jump between teams using their fixed lobby slot number (`1–25`), while the leaderboard re-sorts dynamically by rank (`#1–#25`). Xtallet and PMGC/PMSL HUDs solve this by displaying a compact, muted **Slot Tag** or **Team Number badge** next to the team logo/name while keeping the primary left column strictly for **Live Rank (`#1`)**.
  - **Modular Browser Source Architecture:** Separates live in-game HUD (`Live Standings` + automatic `Top 4` bar) from full-screen/lower-third ceremonial graphics (`WWCD` and `Post-Match Standings`) so OBS operators can either run an all-in-one automatic scene or switch dedicated OBS scenes.

### Reference 4 — Fluid Studio — PUBG Squad Battle (`fluidstudio.co.uk/work/pubg-squad-battle`)

- **Context:** Brand identity and broadcast graphic package design for PUBG Squad Battle by Fluid Studio.
- **Layout & Hierarchy:**
  - Demonstrates how **key visual motifs** (custom metallic gold/bronze textures, angled chamfers, stencil display typography, and disciplined hairline borders) translate from a static key visual poster into clean, flat 2D broadcast lower-thirds, match headers, and full-screen standings boards.
  - Uses **restrained textural framing**: background atmosphere and key-art media sit behind a darkened, subtly blurred/tinted scrim layer, while the foreground typography and data tables remain 100% crisp, high-contrast, and geometric.

---

## 3. Additional PUBG / PMGC / PMSL Broadcast References Analyzed

### Reference 5 — PMGC / PMSL / PMCC Official In-Game Top-4 Bar & Live Tower

- **Top-4 Horizontal Bar Geometry:**
  - Positioned along the top safe area (`top: 24px–32px`, centered horizontally across `1200px–1560px` width).
  - 4 equal-width horizontal cards (`~320px–360px` each, `12px–16px` gap) in a single row (`grid-template-columns: repeat(4, minmax(0, 1fr))`).
  - Each card has a structured 2-tier internal layout:
    - **Primary tier:** Live Rank badge (`#1`–`#4`), Team Logo (`36px–40px`), Team Name (bold uppercase, truncated cleanly), and subtle Team Slot badge (`T05`).
    - **Secondary metric strip:** 4-bar Alive Player indicator (prominent width so viewers can count 4v4 / 4v3 / 2v1 situations at a glance), Match Eliminations (`ELIMS`), and Total Points (`PTS`).
- **Why this works on a 1920×1080 broadcast canvas:**
  - Leaves the entire center, bottom, and sides of the 16:9 frame unobstructed for the final-circle firefight!

### Reference 6 — PUBG Esports Official Post-Match Results Board ("Match Result / Standings")

- **Split-Screen / Asymmetric 2-Zone Composition (`1920×1080`):**
  - **Top Championship Header (`72px–84px` height):** Event / Stage emblem or title, `MATCH N RESULTS`, Map Name (`ERANGEL`), and architectural bronze/gold rule with diamond (`◇`) nodes.
  - **Left Hero Column (~30%–34% width, `~520px`):** Dedicated **#1 WINNER WINNER CHICKEN DINNER** spotlight card featuring large Winner Team Logo (`112px–128px`), Team Name, canonical Team Slot (`SLOT #05`), Match Eliminations, Placement Points, and Total Match Points in oversized championship gold numerals.
  - **Right Standings Table (~66%–70% width, `~1180px`):** Structured, zero-scroll tabular breakdown of all participating teams (`#2` through `#16`/`#25`, or `#1` through `#25`). When `> 12` teams are present, the right zone automatically arranges into a **balanced 2-column split table** (e.g., Ranks `#1–#12` in Column A, Ranks `#13–#25` in Column B) so all 16–25 teams fit comfortably inside the `1920×1080` frame with zero vertical scrolling and legible `14px–15px` rows.

---

## 4. Concrete Design Decisions Adopted from Research

| Feature                                  | Adopted Broadcast Pattern                                                                                                                                                                                                                                                                      | Anti-Patterns Strictly Rejected                                                                                                                                                                          |
| :--------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Persistent Team Slot (`teamNo`)**   | Compact, muted gunmetal/bronze slot tag (`T01`–`T25`) placed adjacent to the Team Name/Logo; primary left column remains Live Rank (`1`–`25`).                                                                                                                                                 | Never merge Rank and Team Slot into a confusing `1/5` string; never let `teamNo` outshine Live Rank `#1`.                                                                                                |
| **2. Automatic Final-4 Layout**          | Top-centered 4-column horizontal squad bar (`top: 28px`, `max-width: 1480px`) with prominent 4-segment alive bars, live rank, logo, name, slot tag, match elims, and total pts. Smoothly crossfades (`350ms cubic-bezier(0.22, 1, 0.36, 1)`) when `standingTeamCount === 4`.                   | Never stack 4 large boxes vertically over the center crosshair; never trigger Final-4 during warmup (`phase === 'idle'`) or before at least 5 teams have entered the match / 1 team has been eliminated. |
| **3. WWCD Victory Screen**               | Center-stage ceremonial broadcast takeover with architectural bronze/gold frame, `WINNER WINNER CHICKEN DINNER` display banner, `MATCH N • MAP`, large Winner Logo, Team Name + `T##` slot, `#1 PLACEMENT`, `MATCH ELIMS`, `MATCH PTS`, and surviving roster names (when available from PCOB). | Never invent fake MVP/damage/survival-time stats; never use cheesy confetti GIFs or generic SaaS modal dialogs.                                                                                          |
| **4. Post-Game Standings Screen**        | Full `1920×1080` asymmetric broadcast board: Top Header + Left `#1 WWCD Hero Spotlight` + Right `Structured Standings Table` (auto 2-column split for 13–25 teams so all rows fit on one 1080p screen without scrolling), backed by persisted `ClosedMapResult`.                               | Never read volatile live state that disappears when the next lobby opens; never confuse single-match points (`killPoints + placementPoints`) with accumulated series points.                             |
| **5. Custom Post-Game Background Media** | Dedicated 3-layer stack: `Layer 1` (Optional Image/Video with CSS `opacity: 0–100%` and `filter: blur(0–24px)` clipped inside an `overflow: hidden` container) → `Layer 2` (PMCC warm espresso gradient vignette scrim for contrast) → `Layer 3` (100% sharp foreground standings UI).         | Never apply CSS `filter: blur()` to the parent container holding text/logos; never force an opaque background when background media is disabled (preserve OBS transparency).                             |
