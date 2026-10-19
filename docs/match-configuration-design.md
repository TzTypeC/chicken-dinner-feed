# Match Number & Map Configuration Design

## 1. Current Codebase State (Verified Facts)

Inspection of `@cdf/shared`, `@cdf/backend`, and `@cdf/frontend` reveals how match numbers and maps are currently handled:

1. **`ClosedMapResult` Schema (`shared/src/domain/series.ts`, lines 31–40):**
   ```ts
   export const closedMapResultSchema = z.object({
     mapNumber: z.number().int().min(1),
     closedAt: z.string(),
     sourceMatchId: z.string().nullable(),
     mapName: z.string().nullable(),
     teams: z.array(mapTeamResultSchema).max(MAX_TEAMS),
   });
   ```
   - `mapName` already exists in the schema!
   - Furthermore, `SeriesControl.tsx` (line 336) already renders `{map.mapName ? ` — ${map.mapName}` : ''}` in the map history list.
   - However, in `backend/src/state/series-store.ts` (lines 171 and 292), `mapName` is hardcoded to `null` (`mapName: null`) because the PCOB `/gettotalplayerlist` API payload does not expose the current map name.
2. **Active Match Number Calculation:**
   - Currently, the active match number displayed in the Admin header (`MAP {series.maps.length + 1}` in `AdminPage.tsx` line 183) and in `SeriesControl.tsx` (`const currentMapNumber = series.maps.length + 1`) is derived strictly as `series.maps.length + 1`.
   - Operators cannot currently override the active match number (for example, if a tournament starts broadcast mid-series on Match 4 without entering all prior maps individually, or if a rematch/showmatch requires a specific match number) or set the active map name (`Erangel`, `Miramar`, `Sanhok`, etc.).

---

## 2. Proposed Data Model & Persistence

To support both the **Match Information Overlay** and accurate series history without breaking existing `series.json` files:

### 2.1 Extending `SeriesDocument` (`shared/src/domain/series.ts`)

We add optional/defaulted active match metadata fields to `seriesDocumentSchema`:

```ts
export const activeMatchInfoSchema = z.object({
  /**
   * Explicit match number override. When null, defaults to `series.maps.length + 1`.
   * When a closed map is persisted, if matchNumberOverride was set, it can either
   * advance automatically (`+ 1`) or revert to `series.maps.length + 1`.
   */
  matchNumberOverride: z.number().int().min(1).max(99).nullable().default(null),
  /**
   * Current map name for the active match (e.g., "Erangel", "Miramar", "Sanhok", "Rondo").
   */
  currentMapName: z.string().trim().max(64).default('Erangel'),
});
```

Or directly on `seriesDocumentSchema`:

- `activeMatchNumber: z.number().int().min(1).max(99).nullable().default(null)` (when `null`, effective active match number is `series.maps.length + 1`).
- `activeMapName: z.string().trim().max(64).default('Erangel')`.

**Why `SeriesDocument` (`series.json`) is the ideal home:**

1. `SeriesDocument` is **already** included in every `LiveSnapshot` (`snapshot.series`) and broadcast via `{ type: 'series', series }` over `/api/live` WebSocket!
2. Zero new files on disk are required, and existing `series.json` files load seamlessly via Zod `.default(...)`.
3. When `SeriesStore.persistClosedMap()` or `SeriesStore.insertManualMap()` closes a map, `SeriesStore` can automatically stamp `mapName: series.activeMapName || null` onto the `ClosedMapResult` (unless overridden in the dialog), fulfilling the previously unused `ClosedMapResult.mapName` field!

---

## 3. Supported Maps & Flexible Input

### 3.1 Built-in PUBG / Battle Royale Map Presets

Operators can select with 1 click/tap from standard competitive PUBG / PUBG Mobile maps:

- `Erangel`
- `Miramar`
- `Sanhok`
- `Vikendi`
- `Rondo`
- `Taego`
- `Deston`
- `Livik`
- `Karakin`

### 3.2 Custom Map Name Support

- Alongside the preset selector/pills, a custom text input (`maxLength={64}`) allows entering any custom map name, mode label, or event stage (e.g., `Erangel (Remake)`, `Showmatch`, `Finals Map 1`).

---

## 4. Admin Workflow & Live Broadcast Safety

### 4.1 Where Controls Appear

To minimize tab-switching during a live tournament:

1. **Quick Match Info Bar in `Manual control` and `Series control` tabs (or top bar):**
   - Displays current live **Match Number** (`Match #`) and **Map** (`Erangel`).
   - Provides a **Draft → Apply to Live** workflow:
     - Operator selects/edits the draft Match Number (`1–99`, or `Auto (maps + 1)`) and Map (`Erangel`, `Miramar`, `Sanhok`, `Vikendi`, `Rondo`, etc., or custom text).
     - Clicking **Apply match info** commits `PUT /api/series/match-info` (or `POST /api/series/match-info`), immediately updating `SeriesStore`, persisting to `series.json`, and broadcasting `{ type: 'series', series }` to all connected overlays (`/overlay/match-info`, `/overlay/:instanceId`, and Admin headers).
   - Includes a quick **Next Match (`+1`)** button that increments the match number and lets the operator pick the next map in the rotation in two clicks.

### 4.2 Auto-Increment & Reset Behavior

- When a match is closed and committed into `series.maps` (`persistClosedMap` or `insertManualMap`):
  - If `activeMatchNumber` is in `Auto` mode (`null`), the effective match number automatically advances from `N` to `N + 1` because `series.maps.length` increased by 1.
  - If `activeMatchNumber` was manually overridden to `M`, closing a map increments `activeMatchNumber` to `M + 1` so the broadcast automatically advances to the next match number.
- When `Reset series` is executed (`POST /api/series/reset`), `activeMatchNumber` resets to `null` (effective Match `1`).
