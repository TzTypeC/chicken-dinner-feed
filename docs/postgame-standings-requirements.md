# Post-Game Detailed Standings Screen & Custom Background Media — Audit & Requirements Specification

## 1. Repository Audit: Closed Map Results & Series Persistence

### 1.1 How Closed Map Data Is Stored and Calculated

- **Shared Schema (`shared/src/domain/series.ts`):**
  - `SeriesDocument` (`backend/data/series.json`) stores:
    - `seriesStartedAt: number`
    - `activeMatchNumber: number | null`
    - `activeMapName: string` (default `'Erangel'`)
    - `closedMaps: ClosedMapResult[]`
  - Each `ClosedMapResult` contains:
    - `id: string`
    - `mapNumber: number` (`1..N`)
    - `mapName: string` (stamped from `activeMapName` when the map closes)
    - `matchId: string | null` (`null` if added manually via `POST /api/series/maps`)
    - `startedAt: number | null`
    - `endedAt: number | null`
    - `teams: ClosedMapTeamResult[]`
  - Each `ClosedMapTeamResult` contains:
    - `teamNo: number` (`1..25`)
    - `placement: number` (`1..25`)
    - `eliminations: number` (`>= 0`)
    - `killPoints: number` (calculated from `scoring.killPoints` for **this map only**)
    - `placementPoints: number` (calculated from `scoring.placementPoints` for **this map only**)
    - `totalPoints: number` (`killPoints + placementPoints` for **this map only**)
- **Crucial Distinction Between Single-Map Points and Series Points:**
  - In `ClosedMapTeamResult`, `totalPoints` is strictly the **single-map total** (`placementPoints + killPoints`).
  - In `LiveSnapshot.match.teams` (`Team`), `team.totalPoints` is the **accumulated series total** across all closed maps plus the active match!
  - Because `SeriesStore` persists `closedMaps` to `backend/data/series.json` immediately on map close (whether auto-closed after 2 stability ticks in PCOB mode or manually closed via `POST /api/series/close-map` in Manual/PCOB mode), `closedMaps` survives match resets, lobby transitions, and server restarts.

### 1.2 Gap Identified in Real-Time WebSocket Delivery (`LiveSnapshot`)

- Currently, `LiveSnapshot` (`shared/src/protocol/live.ts`) includes `match`, `ingest`, and `matchInfo`, **but does NOT include the latest `ClosedMapResult` or `closedMaps` summary**!
- If an OBS Browser Source is pointed at `/overlay/postgame`, it needs to automatically receive the closed map results over `/ws/live` the instant a map closes, is corrected (`PUT /api/series/maps/:mapId`), is added by hand (`POST /api/series/maps`), or is deleted (`DELETE /api/series/maps/:mapId`) — without requiring someone to manually refresh the OBS Browser Source!
- **Architectural Fix:**
  - Include `lastClosedMap: closedMapResultSchema.nullable().default(null)` (and `seriesMapCount: z.number().int().min(0).default(0)`) directly on `LiveSnapshot` (or broadcast `series` state in `LiveSnapshot`), AND enrich or join each `ClosedMapTeamResult` with the team roster (`name`, `logoUrl`, and cumulative `seriesTotalPoints`) so `/overlay/postgame` updates in real time via the existing WebSocket connection whenever `onSeriesChanged()` fires!

---

## 2. Feature 4 Specification — Post-Game Detailed Standings Screen (`/overlay/postgame`)

### 2.1 Routes & Addressing

- **Default Route:** `/overlay/postgame` (uses `main` / first overlay instance or `?instance=<id>`).
- **Instance-Specific Route:** `/overlay/:instanceId/postgame` (inherits `:instanceId` appearance colors, custom fonts, logo visibility, team-number visibility, and post-game background settings).
- **Optional Map Selector Query Parameter:** `?map=latest` (default) or `?map=<mapNumber>` so operators can also display a specific historical map if needed.

### 2.2 Data Source & Fallback Rules

1. **Primary Source (Persisted `ClosedMapResult`):**
   - Reads the target `ClosedMapResult` (`series.closedMaps.at(-1)` by default), joining each row's `teamNo` against the current team roster (`snapshot.match.teams` / `TeamRosterDocument`) for `name` and `logoUrl`.
   - Also computes each team's cumulative **Series Points** up through that map (`seriesPoints`) so the table can clearly distinguish **Match Points** (`PLACE PTS + ELIM PTS = MATCH PTS`) from optional **Series Total**.
2. **Live Fallback (Before Map Is Formally Closed in Manual Mode):**
   - If an operator switches OBS to `/overlay/postgame` at the end of a match before clicking "Close current map now" (and `closedMaps` is empty or from a previous match while the current match has `standingTeamCount <= 1`), `/overlay/postgame` can optionally display the finished live match projection (`match.teams` sorted by single-match points: `(t.killPoints + t.placementPoints) desc, t.eliminations desc, t.rank asc`), with a subtle status badge in Admin Preview indicating whether it is reading a **Saved Map Result** or **Live Unclosed Match**.
3. **Empty State (No Closed Maps & No Active Match Data):**
   - Renders a clean, broadcast-styled PMCC holding board (`WAITING FOR MATCH RESULTS — MATCH N • MAP`) rather than a blank error screen or dummy data.

### 2.3 Screen Composition on `1920×1080` Canvas

Designed as an asymmetric 2-zone championship broadcast board inside the `1920×1080` safe area (`padding: 44px 56px`, content area `1808px × 992px`):

```
+-----------------------------------------------------------------------------------+
| ◇  2026 PMCC ID  •  MATCH 3 RESULTS — ERANGEL             POST-GAME STANDINGS  ◇  |
+---------------------------+-------------------------------------------------------+
|                           |  RANK / TEAM         PLACE   ELIMS   P.PTS  K.PTS TOT |
|   #1 MATCH WINNER         |  #2  [Logo] T03 NAME   #2      9       6      9    15 |
|   (WWCD SPOTLIGHT CARD)   |  #3  [Logo] T11 NAME   #3      7       5      7    12 |
|                           |  #4  [Logo] T08 NAME   #4      5       4      5     9 |
|   [Large Winner Logo]     |  ...                                                  |
|   SLOT T05                |  (Automatically splits into 2 balanced table columns  |
|   WINNER TEAM NAME        |   when > 12 teams are present so 16–25 teams fit      |
|                           |   at 1080p with ZERO vertical scrolling!)             |
|   PLACEMENT:    #1        |                                                       |
|   ELIMINATIONS: 14        |                                                       |
|   PLACE PTS:    10        |                                                       |
|   ELIM PTS:     14        |                                                       |
|   ----------------        |                                                       |
|   MATCH TOTAL:  24 PTS    |                                                       |
+---------------------------+-------------------------------------------------------+
```

1. **Top Championship Header (`76px` height):**
   - Left: Tournament/Overlay Header Title + `MATCH {mapNumber} RESULTS`.
   - Center/Right: Map Name pill (`ERANGEL`) + `POST-GAME STANDINGS` subtitle, framed by PMCC `1px` bronze hairline rules (`#816036`) and 45° gold diamond (`◇`) corner nodes.
2. **Left Zone — `#1 WWCD Featured Winner Panel` (`480px` width):**
   - Vertical PMCC Collegiate Gold Banner accent along the left edge (`#EEB058 → #816036`).
   - Header tag: `WINNER WINNER CHICKEN DINNER • #1 PLACEMENT`.
   - Large Winner Team Logo (`128px × 128px`, if `showLogos === true`).
   - Persistent Team Slot badge (`SLOT T05`, if `showTeamNumbers === true`) + Full Team Name (`32px` bold uppercase `#F9EDD9`).
   - 2×2 Stat Breakdown Grid + Hero Total Bar:
     - `PLACEMENT`: `#1`
     - `ELIMINATIONS`: `{winner.eliminations}`
     - `PLACEMENT PTS`: `{winner.placementPoints}`
     - `ELIMINATION PTS`: `{winner.killPoints}`
     - **TOTAL MATCH POINTS:** `{winner.totalPoints} PTS` in oversized `#EEB058` championship gold numerals.
3. **Right Zone — Structured Standings Table (`1296px` width):**
   - **Sorting Order:** Sorted by **Single-Match Total Points** (`totalPoints` descending → `placement` ascending → `eliminations` descending), OR sorted by `placement` (`#1..#25`). In PUBG Esports post-match boards, rows are ordered by **Match Rank (Total Match Points descending, with Placement as tiebreaker)** while explicitly displaying each team's `PLACE` (`#1..#25`), `ELIMS`, `PLACE PTS`, `ELIM PTS`, and `MATCH PTS`.
   - **Columns per Row:**
     1. **Rank (`#`)**: `1..25` (match rank by points, with `#1` highlighted in gold)
     2. **Logo**: `26px × 26px` (omitted when `showLogos === false`)
     3. **Slot (`T##`)**: `T01..T25` badge (omitted when `showTeamNumbers === false`)
     4. **Team Name**: Bold uppercase `#F9EDD9` (`text-overflow: ellipsis`)
     5. **`PLACE`**: `#1..#25` match placement
     6. **`ELIMS`**: Match eliminations (`tabular-nums`)
     7. **`PLACE PTS`**: Placement points (`tabular-nums`, muted champagne `#E7D8AD`)
     8. **`ELIM PTS`**: Kill/Elimination points (`tabular-nums`, muted champagne `#E7D8AD`)
     9. **`MATCH PTS`**: **Total Match Points** (`placementPoints + killPoints`, bold `#EEB058` gold)
   - **Zero-Scroll Adaptive Multi-Column Layout:**
     - If `<= 12` teams: Renders a single wide, generous table (`48px` row height).
     - If `13..25` teams (standard 16-team or 20–25 team PUBG lobby): Automatically splits the right zone into **two side-by-side balanced table columns** (e.g. Ranks `1..10` on the left half, Ranks `11..20` on the right half; or Ranks `2..13` and `14..25`), guaranteeing that up to 25 teams fit comfortably inside `1920×1080` with **zero vertical scrolling** and crisp `14px` typography.

---

## 3. Feature 5 Specification — Customizable Post-Game Background Media

### 3.1 Supported Media Types & Backend Persistence (`BackgroundMediaStore`)

Following the exact architectural pattern of `LogoStore` (`backend/src/persistence/logo-store.ts`) and `FontStore` (`backend/src/persistence/font-store.ts`):

- **Storage Directory:** `backend/data/backgrounds/`
- **Served Static Path:** `/backgrounds/<instanceId>.<ext>?v=<timestamp>`
- **Magic-Byte Validation (No Trust in Client `Content-Type`):**
  - **Images (`max 25 MB`):**
    - `PNG` (`89 50 4E 47 0D 0A 1A 0A` → `.png`)
    - `JPEG` (`FF D8 FF` → `.jpg`)
    - `WebP` (`RIFF....WEBP` → `.webp`)
  - **Videos (`max 64 MB`):**
    - `MP4` (`....ftyp` at offset 4 → `.mp4`)
    - `WebM` (`1A 45 DF A3` EBML header → `.webm`)
- **API Endpoints (`backend/src/routes/backgrounds.ts`):**
  - `POST /api/overlays/:instanceId/background` (multipart upload; validates magic bytes, writes atomically via `.tmp` + rename, removes previous file for that instance, updates `instance.appearance.postGameBackground.mediaUrl` and `mediaType`, broadcasts updated overlay config via `LiveHub`).
  - `DELETE /api/overlays/:instanceId/background` (deletes uploaded media file for `:instanceId`, resets `mediaUrl` to `null` and `mode` to `'disabled'`, broadcasts update).
- **Backup Export / Import Integration (`backend/src/backup/export.ts` & `import.ts`):**
  - Include `backgrounds/` directory in backup ZIP exports/imports alongside `logos/` and `fonts/` so tournament packages remain self-contained!

### 3.2 Schema on `OverlayAppearance` (`shared/src/config/overlay-instance.ts`)

```ts
export const postGameBackgroundModeSchema = z.enum(['disabled', 'image', 'video']);

export const postGameBackgroundSchema = z.object({
  mode: postGameBackgroundModeSchema.default('disabled'),
  mediaUrl: z.string().min(1).nullable().default(null),
  /** 0 (fully transparent) to 100 (fully opaque). Default 65%. */
  opacity: z.number().int().min(0).max(100).default(65),
  /** Gaussian blur in pixels (0 to 24). Default 4px. */
  blur: z.number().int().min(0).max(24).default(4),
});
```

### 3.3 Strict 3-Layer Isolation in `PostGameOverlay.tsx`

To guarantee that **blur and opacity affect ONLY the background media layer** and never soften foreground text or leak blur edges outside the `1920×1080` canvas:

```tsx
<div className="relative h-[1080px] w-[1920px] overflow-hidden">
  {/* LAYER 1: Isolated Background Media Layer */}
  {bg.mode !== 'disabled' && bg.mediaUrl && (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {bg.mode === 'video' ? (
        <video
          src={bg.mediaUrl}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
          style={{
            opacity: bg.opacity / 100,
            filter: bg.blur > 0 ? `blur(${bg.blur}px)` : undefined,
            // Slight scale compensation when blurred so blur edges never show transparent fringes
            transform: bg.blur > 0 ? `scale(${1 + bg.blur * 0.008})` : undefined,
          }}
        />
      ) : (
        <img
          src={bg.mediaUrl}
          alt=""
          className="h-full w-full object-cover"
          style={{
            opacity: bg.opacity / 100,
            filter: bg.blur > 0 ? `blur(${bg.blur}px)` : undefined,
            transform: bg.blur > 0 ? `scale(${1 + bg.blur * 0.008})` : undefined,
          }}
        />
      )}
      {/* LAYER 2: Subtle PMCC Espresso Contrast Scrim (proportional to media opacity) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(22, 15, 10, 0.35) 0%, rgba(12, 8, 5, 0.78) 100%)',
          opacity: bg.opacity / 100,
        }}
      />
    </div>
  )}

  {/* LAYER 3: 100% Crisp Foreground Broadcast Standings UI */}
  <div className="relative z-10 flex h-full w-full flex-col ...">
    {/* Header + Left #1 Winner Spotlight + Right Standings Table */}
  </div>
</div>
```

- When `bg.mode === 'disabled'` or `bg.mediaUrl === null` or `bg.opacity === 0`, Layers 1 & 2 do not render, leaving the surrounding `1920×1080` canvas **100% transparent** for OBS scene compositing!
