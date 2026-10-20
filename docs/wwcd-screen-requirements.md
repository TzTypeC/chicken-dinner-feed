# WWCD (Winner Winner Chicken Dinner) Victory Screen — Audit & Requirements Specification

## 1. Repository Audit: How a Match Winner Is Determined

### 1.1 Live Match Winner Detection (`MatchStore` & `computeStandings`)

- In `backend/src/state/match-store.ts`:
  - `teams` are computed on every tick by `computeStandings()`.
  - Each team has `hasAppeared: boolean`, `isEliminated: boolean`, `aliveCount: number` (`0..4`), `players: PlayerState[]`, `eliminations: number`, `killPoints: number`, `placementPoints: number`, and `totalPoints: number`.
  - When a match is active (`match.phase !== 'idle'`) and all other participating teams have been eliminated (`standingTeamCount === 1` and `eliminatedTeams.length >= 1`), **exactly one surviving team** has `team.hasAppeared && !team.isEliminated`.
- What if the map has already been closed (`SeriesStore.shouldAutoCloseNow()` or manual `POST /api/series/close-map`) while the match is still on screen?
  - In `SeriesStore`, `shouldAutoCloseNow()` triggers after `2` consecutive stability ticks (~1 second) where `standingTeamCount <= 1`.
  - Even after `SeriesStore` records the `ClosedMapResult`, `MatchStore` continues projecting the live/final match (`standingTeamCount === 1`), AND the newly closed map's `placement === 1` team is persisted in `series.closedMaps.at(-1)`.
- **Edge Case — Simultaneous Final Trade (`standingTeamCount === 0`):**
  - If the last two players trade kills simultaneously (or in Manual Mode the operator sets all teams to `OUT` and assigns Placement `#1` to a team), `standingTeamCount` may be `0`, while the winner is the team with `placement === 1` in the closed map or highest `eliminatedSeq` / `placementOverride === 1`.
  - Therefore, our **Confirmed Winner Selector** resolves the winning team reliably via:
    1. If `match.phase !== 'idle'` and `standingTeams.length === 1` and `eliminatedTeams.length >= 1` → the single `standingTeams[0]` squad.
    2. Else if `match.phase !== 'idle'` and `standingTeams.length === 0` and `eliminatedTeams.length >= 2` → the team with `rank === 1` / last eliminated (`placementPoints` for #1) if the map was closed for `match.matchId`.
    3. On the dedicated `/overlay/wwcd` route (when no live match is currently at 1 team remaining), it can optionally fall back to the most recent `ClosedMapResult` winner (`placement === 1`) so OBS scenes switching to `/overlay/wwcd` immediately after map close still display the winner seamlessly!

### 1.2 Verified Data Availability for the WWCD Screen

| Data Element                        | Available in PCOB Mode?                       | Available in Manual Mode?                                         | Source Field                                             | Fallback / Handling                                                                                                                                                                                                                              |
| :---------------------------------- | :-------------------------------------------- | :---------------------------------------------------------------- | :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Winner Team Name**                | Yes                                           | Yes                                                               | `team.name`                                              | Roster name or `Team ${teamNo}`                                                                                                                                                                                                                  |
| **Winner Team Slot (`teamNo`)**     | Yes                                           | Yes                                                               | `team.teamNo` (`1..25`)                                  | Formatted as `SLOT T05` / `T05`                                                                                                                                                                                                                  |
| **Winner Team Logo**                | Yes                                           | Yes                                                               | `team.logoUrl`                                           | Respects `appearance.showLogos`; renders PMCC championship crest placeholder if `logoUrl === null`                                                                                                                                               |
| **Match Number**                    | Yes                                           | Yes                                                               | `snapshot.matchInfo.matchNumber`                         | `MATCH N`                                                                                                                                                                                                                                        |
| **Map Name**                        | Yes                                           | Yes                                                               | `snapshot.matchInfo.mapName`                             | `ERANGEL` (uppercase)                                                                                                                                                                                                                            |
| **Placement (`#1`)**                | Yes                                           | Yes                                                               | Confirmed winner (`#1`)                                  | Displayed as `#1 VICTORY`                                                                                                                                                                                                                        |
| **Match Eliminations**              | Yes                                           | Yes                                                               | `team.eliminations`                                      | Exact eliminations in this match                                                                                                                                                                                                                 |
| **Match Placement Points**          | Yes                                           | Yes                                                               | `team.placementPoints` (or `scoring.placementPoints[0]`) | Points awarded for `#1` placement                                                                                                                                                                                                                |
| **Total Match Points**              | Yes                                           | Yes                                                               | `team.killPoints + scoring.placementPoints[0]`           | Single-match points earned (`ELIM PTS + PLACE PTS`)                                                                                                                                                                                              |
| **Total Series Points**             | Yes                                           | Yes                                                               | `team.totalPoints` (with #1 placement points applied)    | Cumulative tournament points                                                                                                                                                                                                                     |
| **Surviving / Roster Players**      | **Yes** (`player.name`, `kills`, `liveState`) | **Count only** (`aliveCount` `1..4`; synthetic names `Slot 1..4`) | `team.players` + `snapshot.ingest.source`                | In PCOB Mode: render the 4 squad player cards with real player names, alive/eliminated state, and individual kills. In Manual Mode: render the 4-segment visual `AlivePlayerBars` + `SURVIVORS: X / 4` (never show synthetic `"Slot 1"` names!). |
| **Damage / Knocks / Survival Time** | **No**                                        | **No**                                                            | Not provided by PCOB `/gettotalplayerlist`               | **Omitted** (strictly no fabricated stats).                                                                                                                                                                                                      |

---

## 2. Routing & Trigger Architecture

### 2.1 Dual-Mode Delivery (Automatic In-Game Transition + Dedicated OBS Route)

To support both single-source OBS workflows and multi-scene OBS production switchers:

1. **Automatic Transition on Main Leaderboard Overlay (`/overlay/:instanceId`):**
   - Controlled by `appearance.showWwcdOverlay: boolean` (default `true`).
   - When the confirmed single-winner condition is reached (`match.phase !== 'idle'`, `standingTeamCount === 1`, `eliminatedCount >= 1`), the main overlay automatically transitions from the Final-4 / Leaderboard layout into the **WWCD Victory Screen**.
   - When the operator resets the match or a new match enters warmup (`match.phase === 'idle'` or `standingTeamCount > 1`), the WWCD screen automatically dismisses and returns to the normal leaderboard.
2. **Dedicated Standalone WWCD Overlay Routes (`/overlay/wwcd` and `/overlay/:instanceId/wwcd`):**
   - Allows broadcast directors who keep their leaderboard and ceremony graphics on separate OBS Browser Sources to switch scenes directly to `/overlay/wwcd`.
   - On `/overlay/wwcd`, the WWCD screen displays whenever a confirmed live winner exists OR falls back to the latest closed map's `#1` winner (`lastClosedMap`), and can also be triggered anytime from the Admin Preview (`Test WWCD` / `Preview WWCD`).

---

## 3. Visual Composition & Motion Specification (`1920×1080`)

### 3.1 PMCC 2026 Art-Directed Layout

Positioned at the center-stage of the `1920×1080` broadcast canvas (`width: 1160px`, centered horizontally and vertically at `top: 50%; left: 50%; transform: translate(-50%, -50%)`), leaving outer margins transparent so live camera or observer drone shots remain visible behind the ceremony frame:

1. **Top Architectural Crest & Match Context Ribbon:**
   - Crisp `1px` burnished bronze (`#816036`) hairline rules extending left and right with 45° gold diamond (`◇`) nodes.
   - Center pill in warm espresso (`#26180F`) showing **`MATCH {N}  •  {MAP_NAME}`** in tracked champagne gold (`#E7D8AD`).
2. **Hero Title Banner (`WINNER WINNER CHICKEN DINNER`):**
   - Oversized, condensed uppercase broadcast typography (`48px`, `font-weight: 900`, `letter-spacing: 0.08em`) in PMCC Parchment Ivory (`#F9EDD9`) with a warm metallic gold top-bar rule (`linear-gradient(90deg, transparent, #EEB058, transparent)`) and subtle espresso drop shadow.
3. **Central Winner Spotlight Card (`#160F0A` / `94%` opacity with `#816036` double hairline border):**
   - **Left Emblem Zone:**
     - Vertical PMCC Collegiate Gold Banner accent (`#EEB058 → #816036`) with `#1` Championship Rank emblem.
     - Large Team Logo (`120px × 120px` inside a chamfered bronze-bordered frame; hidden cleanly if `showLogos === false`).
   - **Center Identity Zone:**
     - Persistent Team Slot Tag (`SLOT T05` in `#E7D8AD` on `#3D362B` gunmetal pill, when `showTeamNumbers === true`).
     - Winner Team Name (`44px` uppercase bold `#F9EDD9`).
     - Squad Status Strip:
       - In **PCOB Mode**: 4 horizontal player tags showing each squad member's real `player.name`, status indicator (Alive gold/emerald dot vs. Eliminated gunmetal dot), and individual match kills (`{kills} ELIMS`).
       - In **Manual Mode**: Prominent 4-segment `AlivePlayerBars` + `SURVIVING SQUAD: {aliveCount}/4 ALIVE`.
   - **Right Stat Callout Columns (Tabular Numeric Grid):**
     - **PLACEMENT:** `#1` (in `#EEB058` championship gold)
     - **MATCH ELIMS:** `{eliminations}` (in `#F9EDD9`)
     - **MATCH PTS:** `+{matchPoints}` (placement pts + kill pts for this match)
     - **SERIES PTS:** `{totalSeriesPoints}` (accumulated tournament total)

### 3.2 Entry & Exit Animation

- **Entry (`600ms cubic-bezier(0.16, 1, 0.3, 1)`):**
  - Stage 1 (`0–180ms`): Architectural horizontal bronze hairlines expand outward from center (`scaleX(0) → scaleX(1)`).
  - Stage 2 (`120–420ms`): `WINNER WINNER CHICKEN DINNER` banner and central Winner Spotlight card scale and rise into place (`translateY(18px) scale(0.97) → translateY(0) scale(1)`, `opacity: 0 → 1`).
  - Stage 3 (`260–560ms`): Stat callout columns and squad player strip stagger in (`60ms` step).
- **Exit (`260ms ease-in`):** Clean fade and subtle scale-down (`opacity: 0, scale(0.985)`).
