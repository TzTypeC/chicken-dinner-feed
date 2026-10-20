# PMCC 2026 Visual Identity & Broadcast Theme Analysis

## 1. Visual Reference Source

- **Inspected Asset:** [`assets/KV_2026 PMCC ID.png`](../assets/KV_2026%20PMCC%20ID.png)
- **Native Dimensions & Color Format:** `3840 × 2160 px`, 8-bit RGBA PNG (`colorType = 6`)
- **Event Identity:** Official Key Visual for **2026 PUBGM CAMPUS CHALLENGE INDONESIA (`2026 PMCC ID`)** (KRAFTON / Level Infinite / Lightspeed Studios).

---

## 2. Detailed Visual & Compositional Audit of `KV_2026 PMCC ID.png`

### 2.1 Environment & Atmospheric Palette

- **Collegiate Library / Grand Hall Setting:** Unlike typical cyberpunk or neon-cyan esports graphics, the 2026 PMCC ID key visual is set inside a grand, classical collegiate library/hall. Tall dark mahogany/espresso bookshelves line the left and right walls (`#160D06` to `#3B230F`), topped by a coffered dark bronze/umber ceiling (`#9F7736` in lit coffers, `#29170E` in recessed beams).
- **Directional Volumetric Lighting:** Warm golden sunbeams enter diagonally from upper-left tall arched windows (`#D6C098` to `#FAEBCD`), illuminating floating dust motes and casting warm specular highlights across the dark wood floor (`#9E7549` in lit areas, `#1A1008` in deep vignette shadows).

### 2.2 Focal Objects & Material Language

1. **Centerpiece Nib Trophy:** A tall, faceted metallic gold trophy sculpted like a classic fountain-pen nib—uniting academic prestige ("Campus Challenge") with competitive championship gold.
   - Specular edge highlights reach warm ivory/white-gold (`#FFFCF6` / `#FAEBCD`).
   - Mid-body brushed metallic gold sits around `#CD984E` – `#EEB058`.
   - Deep bevel facets transition into burnished bronze (`#B67925` / `#816036`).
   - The base shield plaque is dark espresso bronze with engraved champagne-gold lettering (`#E7D8AD`).
2. **Foreground PUBG Tactical Props:**
   - **Level 3 Spetsnaz Helmet (bottom-right):** Rendered in matte dark warm charcoal/gunmetal (`#3E372E` / `#3D362B`) with warm rim lighting (`#BC9A70`).
   - **Airdrop Supply Crate (mid-right):** Weathered crimson-red crate body (`#91321B` / `#904026`) topped with a muted slate-teal tarp (`#627675` / `#607A6E`).
   - **Stacked Hardcover Books (bottom-left):** Warm leather browns and parchment pages reinforcing the collegiate motif.

### 2.3 Typography & Graphic Framing Motifs

- **Hero Display Typography (`2026 PMCC ID`):**
  - Massive, ultra-bold condensed block/slab-serif headline with subtle distressed stencil/grunge texture in warm parchment ivory (`#F9EDD9` / `#FAEBCD`), set over dark wood shadows for high contrast.
- **Vertical Collegiate Banners:**
  - Two symmetrical vertical hanging banners in warm khaki-gold/burnished brass (`#966734` / `#90552B` in shadow, `#D6C098` in light) flank the trophy behind the headline.
- **Architectural Hairline Vector Borders:**
  - Framing the top (`y ≈ 64 px`) and bottom of the 4K canvas are crisp, `1px`–`2px` geometric hairline rules in antique gold (`#816036` / `#CD984E`) featuring:
    - **45° rotated diamond (`◇`) corner and center nodes**,
    - **Chamfered / angled step-downs**, and
    - **A centered geometric rising-sun / crest emblem** at the bottom border.

---

## 3. Sampled Pixel Data from `assets/KV_2026 PMCC ID.png`

Using direct PNG IDAT decompression and pixel clustering across all `3840 × 2160` pixels:

| Region / Material Cluster         | Sample Coordinates `(x, y)` | Sampled Hex | RGB `(R, G, B)`      | Cluster Average Hex | Role in Artwork                                      |
| :-------------------------------- | :-------------------------- | :---------- | :------------------- | :------------------ | :--------------------------------------------------- |
| **Deepest Espresso Shadow**       | `(2896, 1008)`              | `#080404`   | `rgb(8, 4, 4)`       | `#160D06`           | Deep library alcove shadows & outer vignette         |
| **Mahogany / Dark Umber Wood**    | `(2688, 1392)`              | `#29170E`   | `rgb(41, 23, 14)`    | `#3B230F`           | Bookshelf panels, dark bronze trophy shield          |
| **Burnished Bronze / Frame Rule** | `(1920, 64)`                | `#816036`   | `rgb(129, 96, 54)`   | `#966734`           | Top/bottom geometric hairline border & coffered trim |
| **Trophy Facet Rich Gold**        | `(1920, 760)`               | `#B67925`   | `rgb(182, 121, 37)`  | `#CD984E`           | Fountain-pen nib trophy core metallic gold           |
| **Sunlit Championship Gold**      | `(640, 1456)`               | `#EEB058`   | `rgb(238, 176, 88)`  | `#D9A441`           | Bright gold highlights on trophy bevels & sunbeams   |
| **Engraved Plaque Champagne**     | `(1920, 1460)`              | `#E7D8AD`   | `rgb(231, 216, 173)` | `#D6C098`           | Trophy plaque inscription & warm collegiate banners  |
| **Parchment Ivory Headline**      | `(1100, 650)`               | `#F9EDD9`   | `rgb(249, 237, 217)` | `#FAEBCD`           | Giant `2026 PMCC ID` display typography              |
| **Specular White-Gold**           | `(1935, 950)`               | `#FFFCF6`   | `rgb(255, 252, 246)` | `#FFFCF6`           | Peak specular reflection on trophy tip               |
| **Airdrop Crate Crimson**         | `(2528, 1552)`              | `#904026`   | `rgb(144, 64, 38)`   | `#91321B`           | Supply crate red body (danger / elimination cue)     |
| **Airdrop Tarp Slate-Teal**       | `(2336, 1456)`              | `#607A6E`   | `rgb(96, 122, 110)`  | `#627675`           | Supply crate tarp (secondary cool tactical accent)   |
| **Spetsnaz Helmet Gunmetal**      | `(3360, 1488)`              | `#3D362B`   | `rgb(61, 54, 43)`    | `#3E372E`           | Level 3 helmet matte warm charcoal                   |

---

## 4. Proposed PMCC 2026 Broadcast & Admin Color Token System

### 4.1 Why the Current Palette Must Be Replaced

- **Current Broadcast Overlay Default (`shared/src/config/overlay-instance.ts`):**
  - Currently defaults to generic cool slate (`backgroundColor: '#0F172A'`, `textColor: '#F8FAFC'`) and bright yellow-orange (`accentColor: '#F59E0B'`), with hardcoded Tailwind `slate-800/950` and `amber-400` classes scattered across `EliminationOverlay.tsx`, `MatchInfoOverlay.tsx`, and `LeaderboardOverlay.tsx`.
- **Current Admin UI (`frontend/src/styles/globals.css`):**
  - Uses neutral zinc monochrome with a generic blue primary button (`--primary: oklch(0.62 0.19 255)`).
- Neither reflects the **warm espresso-obsidian, burnished bronze, championship nib-gold, and parchment ivory** visual identity of `2026 PMCC ID`.

### 4.2 Broadcast Overlay Default Tokens (`defaultOverlayAppearance`)

To guarantee WCAG AA/AAA broadcast legibility over chaotic live PUBG gameplay (bright snow on Vikendi, desert sand on Miramar, foliage on Erangel/Sanhok) while capturing the exact `2026 PMCC ID` aesthetic:

| Token / Setting                              | Previous Value            | Proposed PMCC 2026 Default             | Derived From                                   | Contrast & Broadcast Rationale                                                                                                                                          |
| :------------------------------------------- | :------------------------ | :------------------------------------- | :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`backgroundColor`** (Primary HUD Surface)  | `#0F172A` (Cool Slate)    | **`#160F0A`** (Deep Espresso Obsidian) | `darkest` (`#160D06`) + `darkWood` (`#29170E`) | Warm dark obsidian-umber surface (`92%` default opacity). Provides `14.8:1` contrast against `#F9EDD9` text and `8.6:1` against `#E5A93C` gold.                         |
| **`textColor`** (Primary Broadcast Text)     | `#F8FAFC` (Cool White)    | **`#F9EDD9`** (Parchment Ivory)        | `headlineIvory` (`#F9EDD9`)                    | Sampled directly from the `2026 PMCC ID` display title; eliminates harsh blue-white glare while remaining razor-sharp at 1080p.                                         |
| **`accentColor`** (Championship Gold Accent) | `#F59E0B` (Generic Amber) | **`#E5A93C`** (PMCC Nib-Trophy Gold)   | `richGold` (`#CD984E` – `#EEB058`)             | Balanced between the mid-gold (`#CD984E`) and sunlit highlight (`#EEB058`) of the centerpiece trophy so it reads brightly on dark espresso surfaces (`8.6:1` contrast). |

### 4.3 Extended Broadcast Semantic CSS Variables (Injected onto Overlay Root)

In addition to the 3 user-customizable appearance pickers (`backgroundColor`, `textColor`, `accentColor`), we will expose derived PMCC broadcast design tokens on the overlay root so all 5 overlays (`Leaderboard`, `Final-4`, `WWCD`, `Post-Game Standings`, `Elimination Alert`, `Match Info`) share a cohesive art-directed material system:

| CSS Variable            | Hex / Value | Sampled Source                                        | Intended Broadcast Usage                                                      |
| :---------------------- | :---------- | :---------------------------------------------------- | :---------------------------------------------------------------------------- |
| `--pmcc-bg-obsidian`    | `#160F0A`   | Library deep shadow                                   | Base panel fill, table rows, card bodies                                      |
| `--pmcc-bg-mahogany`    | `#26180F`   | `darkWood` (`#29170E`)                                | Elevated header bar, featured #1 row tint, alternate row surface              |
| `--pmcc-bg-gunmetal`    | `#3D362B`   | `helmetGunmetal` (`#3D362B`)                          | Muted Team Slot badge (`T05`), dead/eliminated bar fill, subtle dividers      |
| `--pmcc-border-bronze`  | `#816036`   | `topBorder` (`#816036`)                               | Architectural `1px` hairline borders, diamond (`◇`) corner nodes, table rules |
| `--pmcc-gold-bright`    | `#EEB058`   | `richGold` highlight                                  | WWCD headline accent, #1 rank badge highlight, active top border rule         |
| `--pmcc-gold-champagne` | `#E7D8AD`   | `trophyBronzePlaque`                                  | Secondary labels (`MATCH`, `MAP`, `ELIMS`, `PTS`), column headers, slot tags  |
| `--pmcc-ivory`          | `#F9EDD9`   | `headlineIvory`                                       | Primary team names, live numeric scores, survivor names                       |
| `--pmcc-crimson`        | `#A83820`   | `crateCrimson` (`#91321B` boosted for HUD visibility) | Elimination alert badge (`TEAM ELIMINATED`), knocked player indicator         |
| `--pmcc-teal`           | `#607A6E`   | `crateTeal` (`#607A6E`)                               | Optional secondary tactical badge / PCOB status indicator                     |

### 4.4 Admin Panel Theme Alignment (`frontend/src/styles/globals.css`)

- Replace the cold blue primary accent (`oklch(0.62 0.19 255)`) in `globals.css` with **PMCC Championship Gold** (`#E5A93C` / `oklch(0.77 0.14 78)`) and warm dark espresso-charcoal surfaces (`#14100C` background, `#1E1712` card, `#2B2119` muted/border, `#F9EDD9` foreground) so the Admin control room matches the tournament broadcast identity without sacrificing operator readability or status-pill semantics (emerald = connected/alive, crimson = error/eliminated, amber = stale).

---

## 5. Signature PMCC 2026 Graphic Motifs Selected for Broadcast UI

To ensure the overlays feel art-directed rather than generic:

1. **Architectural Hairline Rules with Diamond (`◇`) Nodes:**
   - Directly inspired by the top and bottom framing lines of `KV_2026 PMCC ID.png`, major overlay headers (`WWCD`, `Post-Game Standings`, `Match Info`, `Final-4` cards, and `Live Leaderboard` header) will use crisp `1px` burnished-bronze (`#816036`) borders accented with subtle 45° gold diamond (`◇`) terminal nodes—never heavy cartoon frames or neon glows.
2. **Vertical Collegiate Banner Accent Bar:**
   - Inspired by the hanging vertical banners flanking the PMCC trophy, featured winner cards (`WWCD` and `Post-Game #1 Winner Panel`) and the `#1` leaderboard row use a structured vertical gold-to-bronze accent bar (`linear-gradient(180deg, #EEB058 0%, #816036 100%)`).
3. **High-Contrast Tabular Broadcast Typography:**
   - Bold, uppercase, tightly tracked display headers paired with `tabular-nums` numeric alignment in warm parchment ivory (`#F9EDD9`) and champagne (`#E7D8AD`) labels.
