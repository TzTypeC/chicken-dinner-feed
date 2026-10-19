# Admin Panel Responsiveness Audit & Redesign Specification

## 1. Executive Summary

This document captures the root causes of responsiveness issues across the `chicken-dinner-feed` Admin Panel (`/admin`) and specifies the target responsive behavior across six viewport bands (`320–375 px`, `376–480 px`, `481–767 px`, `768–1023 px`, `1024–1439 px`, and `1440 px+`).

All findings are grounded in direct source inspection of `@cdf/frontend`. No issues are masked via `overflow-x: hidden` on the document or page shell; instead, layout structures adapt cleanly to viewport constraints while preserving keyboard accessibility, touch ergonomics (`>= 40–44 px` interactive targets on touch/narrow viewports), and zero-layout-shift stability during live 1 Hz match polling.

---

## 2. Root-Cause Diagnosis by Component

### 2.1 `AdminPage.tsx` — Overlays Tab Fixed 3-Column Grid

- **Location:** `frontend/src/pages/AdminPage.tsx` (lines 349–369)
- **Current Implementation:**
  ```tsx
  <div
    className="grid gap-6 p-6"
    style={{
      gridTemplateColumns: sidebarOpen
        ? '17rem minmax(0, 1fr) minmax(0, 1fr)'
        : '2.75rem minmax(0, 1fr) minmax(0, 1.6fr)',
    }}
  >
  ```
- **Root Cause:** Inline `style.gridTemplateColumns` overrides any CSS media-query adaptation and forces three side-by-side columns at **all** viewport widths.
  - At `768 px` (tablet) with `sidebarOpen = true`: `272px` (`17rem`) + `48px` (`gap-6` × 2) + `48px` (`p-6` × 2) leaves `400px` split across two `1fr` columns (`200px` each) for `AppearanceEditor` and `OverlayPreview`.
  - At `320–480 px` (mobile): the `17rem` (`272px`) column plus gaps and padding leaves `<= 160px` (or negative space at `320 px`), causing severe horizontal clipping and crushed controls.
- **Target Fix:**
  - Replace the unconditional inline 3-column grid with a responsive CSS grid class (`admin-overlays-grid`):
    - **Mobile & Small Tablet (`< 768 px`):** Single-column vertical stack (`grid-cols-1`) with compact padding (`p-3 sm:p-4`). The instance selector (`InstanceToolbar`) renders as a collapsible drawer/card at the top, followed by `OverlayPreview` (collapsible or sticky-top summary card so operators can immediately see the preview or jump to settings) and `AppearanceEditor`.
    - **Tablet (`768–1023 px`):** Two-column or stacked layout where `InstanceToolbar` spans full width (or compact top bar) and `AppearanceEditor` + `OverlayPreview` sit in a `grid-cols-1 md:grid-cols-2` split.
    - **Desktop (`>= 1024 px`):** Preserves the existing 3-column layout (`17rem minmax(0, 1fr) minmax(0, 1fr)` when expanded, `2.75rem minmax(0, 1fr) minmax(0, 1.6fr)` when collapsed).

---

### 2.2 `AdminPage.tsx` — Sticky Header & 7-Tab Navigation Bar

- **Location:** `frontend/src/pages/AdminPage.tsx` (lines 278–347)
- **Current Implementation:**
  - Top sticky container (`<div ref={chromeRef} className="sticky top-0 z-10">`) contains both the header (`flex flex-wrap items-center justify-between gap-4 border-b px-6 py-3`) and `<nav className="flex gap-1 border-b px-6">`.
  - `<nav>` has 7 tab buttons (`Overlays`, `Manual control`, `Teams`, `Scoring`, `Fonts`, `Series control`, `Import & Export`) with no `overflow-x-auto` and no `whitespace-nowrap`.
- **Root Cause:**
  1. On viewports `< 768 px`, the 7 tab buttons either squeeze into multi-line wrapped labels (`Manual\ncontrol`, `Series\ncontrol`, `Import &\nExport`) or overflow horizontally at `320–375 px`.
  2. The combined sticky header + wrapped nav bar consumes `135–175 px` of vertical height on mobile screens (`568–667 px` tall), leaving too little vertical viewport for live match tables.
- **Target Fix:**
  - Add horizontal scroll capability (`overflow-x-auto no-scrollbar`) with `whitespace-nowrap` and `shrink-0` on tab buttons so the 7 tabs remain on a single clean horizontal strip on narrow viewports with touch-friendly height (`min-h-[42px]`).
  - Tighten header padding on mobile (`px-3 py-2 sm:px-6 sm:py-3`) and group status badges (`Mode`, `Live WS`, `PCOB API`, `MAP N`) cleanly so the sticky chrome stays compact (`~88–104 px` on mobile).

---

### 2.3 `ManualControl.tsx` — 8-Column Table & Small Touch Targets

- **Location:** `frontend/src/features/admin/ManualControl.tsx` (lines 118–425)
- **Current Implementation:**
  - Renders an 8-column `<table>` (`In lobby`, `#`, `Team`, `Alive players`, `Eliminations`, `Map placement`, `Overlay rank`, `Total PTS`) inside `<div className="overflow-x-auto rounded border">`.
  - Action buttons (`Reset match`, `Put all teams in lobby`, `Set all in-lobby alive = 4`, `-`, `+`, `OUT`, `4`, `Clear`) use `px-2 py-1 text-xs` (~26 px height).
- **Root Cause:**
  1. The 8-column table requires `~820 px` minimum width. On `< 768 px` (phones and small tablets), operators must scroll horizontally on every single row to correlate the team name on the left with alive/elimination buttons on the right.
  2. During a fast-paced Battle Royale endgame, `26 px` buttons are error-prone on touch devices or trackpads.
  3. The top action bar and search/sort toolbar crowd narrow screens when `input[type="search"]` (`min-w-[14rem]`) and sort controls sit alongside global action buttons.
- **Target Fix:**
  - **Responsive Dual-Layout (or Adaptive Card/Row Layout below `768 px`):**
    - **Desktop & Tablet Landscape (`>= 768 px`):** Keep the high-density 8-column data table (`<table>`) with sticky `Team` column (`sticky left-0 z-[1]`) so horizontal scrolling on `768–1023 px` never loses team identity.
    - **Mobile & Narrow Tablet (`< 768 px`):** Render a dedicated **Live Operator Card Grid / Compact List** (`md:hidden` / `hidden md:block`, or responsive CSS grid rows) where each team card displays:
      - **Top row:** In-lobby checkbox, `#Slot`, Logo + Team Name (truncated cleanly with `title`), Live Overlay Rank badge (`#1`), and Total PTS (`24 pts`).
      - **Bottom control strip:** Touch-friendly (`min-h-[40px] min-w-[40px]`) controls grouped into **Alive** (`[OUT] [0][1][2][3][4]` or `[-] count [+]`), **Elims** (`[-] count [+]`), and **Placement** (`# input`), visually dimmed when `!present`.
  - **Quick Filter Pill Bar:** Add a quick filter toggle (`All (16)` · `In Lobby` · `Still Alive` · `Eliminated`) next to the search bar so operators on small screens can filter down to only the remaining alive teams during endgame circles.

---

### 2.4 `AppearanceEditor.tsx` — Unconditional 2-Column Grids

- **Location:** `frontend/src/features/admin/AppearanceEditor.tsx` (lines 58, 128, 198, 232, 266, 368)
- **Current Implementation:**
  - Uses `grid grid-cols-2 gap-3` across Canvas/Safe-Area, Layout, Typography, Background/Text Colors, Alive-Bar Colors, and Border/Accent sections.
- **Root Cause:**
  - At `< 480 px` (or inside a narrow column at `1024–1200 px`), two side-by-side `ColorField` inputs (`[swatch] [rgba(24, 24, 27, 0.82)]`) or font selectors get squeezed below `140 px` each, clipping rgba strings and labels.
- **Target Fix:**
  - Use `grid grid-cols-1 sm:grid-cols-2 gap-3` (and container-aware wrapping) so fields stack cleanly into a single full-width column on narrow viewports while remaining 2-column on wider screens.

---

### 2.5 `MapResultDialog.tsx`, `SeriesControl.tsx`, `TeamRosterEditor.tsx`, and `ScoringEditor.tsx`

- **Locations & Root Causes:**
  1. **`MapResultDialog.tsx` (lines 51, 87, 95):**
     - Uses `grid-cols-[1fr_6rem_6rem]` inside a modal (`p-6`). At `320–375 px`, `6rem + 6rem` (`192 px`) plus padding and gaps leaves only `~60–80 px` for the team name column (`#1 Team Name`), truncating team names to 4–5 characters.
     - **Fix:** Use responsive padding (`p-4 sm:p-6`), `max-h-[90vh]`, and `grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] sm:grid-cols-[1fr_6rem_6rem]` so team names remain readable at `320 px`.
  2. **`SeriesControl.tsx` (lines 303, 312):**
     - Uses `grid-cols-[2rem_1fr_5rem_5rem]` for manual-baseline inputs and series standings.
     - **Fix:** Adjust to `grid-cols-[1.75rem_minmax(0,1fr)_4.25rem_4.25rem] sm:grid-cols-[2rem_1fr_5rem_5rem]` and make header action buttons wrap cleanly on `< 480 px`.
  3. **`TeamRosterEditor.tsx` (line 50):**
     - Uses `grid-cols-[2.5rem_4.5rem_1fr_2rem]` where the delete (`×`) button is only `2rem` wide and `py-1`, and at `320 px` the team name input gets narrow.
     - **Fix:** Increase touch target of the delete button (`min-h-[36px] min-w-[36px]`) and allow responsive stacking or compact slot/logo columns on `< 400 px`.
  4. **`ScoringEditor.tsx` (line 45):**
     - Uses `grid-cols-4 sm:grid-cols-8 gap-2` for placement points (`#1`–`#16`). At `320 px`, 4 columns leave `~60 px` per input.
     - **Fix:** Use `grid-cols-2 xs:grid-cols-4 sm:grid-cols-8 gap-2` (or `grid-cols-3 sm:grid-cols-8`) so number inputs have sufficient width and tap area on `320 px` devices.

---

## 3. Target Behavior by Viewport Width Band

| Viewport Band                               | Representative Devices                 | Navigation & Header                                                                                              | Overlays Tab                                                                                                  | Manual Control Tab                                                                                                                                          | Forms & Modals (`Teams`, `Scoring`, `Series`, `MapResultDialog`)                                                   |
| :------------------------------------------ | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **320–375 px** (Narrow Mobile)              | iPhone SE, compact Android             | Compact 2-row sticky header; single-row horizontally scrollable tab strip (`overflow-x-auto whitespace-nowrap`). | Single-column stack: collapsible Instance selector card → collapsible Live Preview → 1-col Appearance Editor. | Mobile Operator Cards (`>= 40px` touch buttons for `OUT`, Alive `-`/`+`, Elims `-`/`+`, Placement input) + Quick Filter pills (`All`, `Alive`, `In Lobby`). | Single-column form grids; `2–3` cols for placement inputs; full-bleed modal (`p-4`) with `4.5rem` numeric columns. |
| **376–480 px** (Larger Mobile)              | iPhone 14/15/16 Pro, Pixel             | Compact sticky header; single-row scrollable tab strip with scroll indicators.                                   | Single-column stack with 16:9 scaled `OverlayPreview` card and 1-col Appearance fields.                       | Mobile Operator Cards with quick Alive `[OUT][1][2][3][4]` pill bar and `-`/`+` steppers.                                                                   | 1-col ColorFields; 4-col placement grid; comfortable touch targets (`>= 40px`).                                    |
| **481–767 px** (Wide Mobile / Small Tablet) | Landscape phones, phablets, 7" tablets | Single-row header + scrollable or full tab bar.                                                                  | Single-column stack with 2-col AppearanceEditor sub-grids (`sm:grid-cols-2`).                                 | Operator Cards (or toggleable compact table) with full search, sort, and status filters.                                                                    | 2-col form grids (`sm:grid-cols-2`); 8-col placement points grid.                                                  |
| **768–1023 px** (Tablet)                    | iPad Mini / Air (portrait & landscape) | Full header bar + single-row tab bar (scrolls smoothly if needed).                                               | Instance toolbar top bar + 2-column split (`AppearanceEditor` left, sticky `OverlayPreview` right).           | Full 8-column table with sticky `Team` column and enlarged `36–40px` stepper buttons.                                                                       | 2-col sections; spacious modals and side-by-side series panels.                                                    |
| **1024–1439 px** (Laptop / Desktop)         | 13"–15" broadcast control laptops      | Full single-row header + 7-tab bar.                                                                              | 3-column layout (`17rem` / `2.75rem` sidebar + `AppearanceEditor` + sticky `OverlayPreview`).                 | Full 8-column table with instant keyboard & mouse controls, no horizontal scroll required.                                                                  | Full multi-column desktop layout (`lg:grid-cols-[20rem_1fr]` in Series control).                                   |
| **1440 px+** (Large Desktop)                | 1080p / 1440p / 4K production monitors | Full header + tab bar with generous breathing room.                                                              | 3-column layout with large live 16:9 preview canvas.                                                          | Full table (`max-w-6xl`) with all columns, quick presets, and zero scrolling.                                                                               | Full desktop layout.                                                                                               |

---

## 4. Layout Stability & Anti-Shift Guarantees

1. **`tabular-nums` on All Live Numeric Readouts:** Every counter, placement, elimination count, and point total in both the Admin Panel and Overlays uses `font-variant-numeric: tabular-nums` so 1 Hz updates never jitter horizontal widths.
2. **Reserved Status Slot Widths:** Header status badges (`Mode`, `Live WS`, `PCOB API`, `MAP N`) and table/card badges reserve minimum widths or flex-shrink rules so state transitions (`OK` ↔ `ERR`, `LIVE` ↔ `OUT`) do not cause surrounding buttons to jump.
3. **Focus & Input Preservation:** `ManualControl.tsx` preserves local draft strings for numeric inputs while an input is focused and commits on blur or `Enter`, ensuring 1 Hz WebSocket snapshots never overwrite an operator's keystrokes mid-edit.
