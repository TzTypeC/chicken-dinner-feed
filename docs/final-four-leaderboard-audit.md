# Audit & Design Specification — Persistent Team Slot Identification & Automatic Final-4 Leaderboard

## 1. Repository Audit Findings

### 1.1 How `teamNo` vs. `rank` Is Currently Modeled and Rendered

- **Shared Domain (`shared/src/domain/team.ts` & `shared/src/config/team-roster.ts`):**
  - Every `TeamRosterEntry` and every computed `Team` object in `LiveSnapshot.match.teams` already carries two distinct integer fields:
    - `team.teamNo` (`1..25`): The **canonical, immutable tournament slot / PCOB `teamId`**, assigned in the `Teams` tab (or `.ini` import) and preserved across the entire tournament.
    - `team.rank` (`1..N`): The **live standings rank** computed dynamically on every tick by `computeStandings()` (`backend/src/scoring/standings.ts`).
- **Current Leaderboard Rendering (`frontend/src/components/overlay/LeaderboardOverlay.tsx` & `TeamRow.tsx`):**
  - `LeaderboardOverlay.tsx` currently defines a 6-column CSS grid (or 5-column when `showLogos === false`):
    - `#` (`team.rank`) | `Logo` | `TEAM` (`team.name`) | `ALIVE` (`AlivePlayerBars`) | `ELIMS` (`team.eliminations`) | `PTS` (`team.totalPoints`).
  - **Gap Identified:** `TeamRow.tsx` never renders `team.teamNo`! As teams change rank during a match, casters and observers looking at the broadcast overlay cannot tell which original lobby slot (`Team 1`..`Team 25`) a squad belongs to.

### 1.2 How Alive Team Count (`standingTeamCount`) Is Currently Computed

- **Backend Match Projection (`backend/src/state/match-store.ts`, lines 187–311):**
  - During warmup (`this.inWarmup === true`), `match.phase` is `'idle'`, and every team's `isEliminated` is forced to `false`.
  - Once the match is live (`match.phase === 'live'` or `'ended'`), a team that has entered the lobby has `team.hasAppeared = true` (derived from `this.seenTeams.has(r.teamNo)`).
  - `team.isEliminated` is `true` when `team.hasAppeared && aliveCount === 0`.
  - `match.standingTeamCount` is computed at line 292 as:
    ```ts
    const standingTeamCount = teams.filter((team) => team.hasAppeared && !team.isEliminated).length;
    ```
  - This works identically in both **PCOB API Mode** (`PcobMapper` emits players with `liveState` `0..3` vs `5`) and **Manual Mode** (`ManualStore.toIngestUpdate()` emits `aliveCount` alive slots and `4 - aliveCount` dead slots for every active team).

### 1.3 Crucial Edge Cases Identified in Audit

1. **Lobby Loading / Early Match False-Positive Guard:**
   - In PCOB mode, as players load into the match server one squad at a time, `seenTeams.size` climbs from `0 → 1 → 2 → 3 → 4 → ... → 16`. If the match transitions out of warmup when only 4 squads have appeared and 0 squads have been eliminated, `standingTeamCount` is `4` even though it is the start of the match, or in a 4-team test lobby before anyone dies.
   - **Solution:** Automatic Final-4 activation requires:
     1. `appearance.showFinalFourLayout !== false` (enabled by default),
     2. `match.phase !== 'idle'` (not in warmup),
     3. `match.standingTeamCount === 4`, AND
     4. Either at least one team has been eliminated (`match.teams.some((t) => t.hasAppeared && t.isEliminated)`) OR the operator explicitly activates **Preview Final-4** in the Admin preview.
2. **Manual Mode Correction / Re-Entry (`standingTeamCount !== 4`):**
   - In Manual Mode, if an operator accidentally sets a 5th team to `OUT` (causing `standingTeamCount === 4`) and then immediately restores that team's alive count to `1..4` (`standingTeamCount === 5`), the Final-4 layout must immediately transition back to the standard vertical leaderboard.
   - Conversely, when the 4th-place team is eliminated (`standingTeamCount === 3 → 2 → 1`), the Final-4 layout transitions out (either returning to the normal leaderboard for `3` and `2` teams alive, or—if the operator prefers keeping the top bar through `4..2`—Wait: the requirement states: _"When the number of alive teams changes away from 4: If a team count correction occurs in Manual Mode (e.g., alive teams goes back to 5), smoothly return to the normal leaderboard. When the match ends or reaches 1 remaining team, transition according to the WWCD logic below."_ What about when `standingTeamCount` is `3` or `2` during the final circle? We will document both options clearly and ask/confirm in the review gate, while supporting clean state machine transitions!).

---

## 2. Feature 1 Specification — Persistent Team Slot Identification (`teamNo`)

### 2.1 Visual Presentation & Formatting

- **Canonical Format:** `T` + 2-digit zero-padded slot number (`T01`, `T05`, `T16`, `T25`), or compact `#05` / `05`. Using **`T01`–`T25`** (e.g. `T05`) immediately distinguishes **T**eam Slot (`T05`) from Live Placement/Rank (`#1` / `1`) so viewers never confuse `05` with 5th place or 5 kills.
- **Placement on Standard Live Leaderboard (`TeamRow.tsx`):**
  - Inside the `TEAM` cell (`[Logo] [Slot Badge] [Team Name]`):
  - Left column (`#`) continues to show **Live Rank (`1..25`)** in bold championship gold/ivory (`13px`).
  - Inside the team identity column, immediately before the Team Name, render a compact, fixed-width architectural badge (`26px` wide, `16px` tall) in PMCC muted gunmetal/bronze (`background: rgba(61, 54, 43, 0.75)`, `border: 1px solid rgba(129, 96, 54, 0.55)`, `color: #E7D8AD`, `font-size: 9.5px`, `font-weight: 700`, `font-variant-numeric: tabular-nums`, `letter-spacing: 0.04em`).
  - **Why inline badge inside the Team column rather than a 7th table column:** The vertical leaderboard is `376px` wide to avoid covering gameplay. Adding a separate 7th column would steal horizontal width from `Team Name`, whereas a compact `26px` `T05` pill inside the Team cell preserves full readability and aligns every team name on a clean vertical axis.
- **Placement on Final-4 Horizontal Cards (`FinalFourOverlay.tsx`):**
  - Displayed in the card's top identity header right next to the Team Name (`T05`), clearly separated from the large `#1`–`#4` Live Rank badge on the left edge of the card.
- **Toggleability (`showTeamNumbers: boolean`):**
  - Added to `OverlayAppearance` (`showTeamNumbers: z.boolean().default(true)`) so operators can toggle persistent team slot badges `ON`/`OFF` per overlay instance in the Admin Appearance Editor.

---

## 3. Feature 2 Specification — Automatic Final-4 Leaderboard Layout

### 3.1 Trigger Condition & State Machine

Let `standingTeams = match.teams.filter((t) => t.hasAppeared && !t.isEliminated)`.
Let `eliminatedCount = match.teams.filter((t) => t.hasAppeared && t.isEliminated).length`.

The Live Leaderboard route (`/overlay/:instanceId`) evaluates display mode in priority order:

1. **`WWCD` Mode:** Active when `appearance.showWwcdOverlay !== false` and the single-winner WWCD trigger condition is met (`match.phase !== 'idle' && standingTeams.length === 1 && eliminatedCount >= 1`).
2. **`FINAL_FOUR` Mode:** Active when `appearance.showFinalFourLayout !== false`, `match.phase !== 'idle'`, `standingTeams.length >= 2 && standingTeams.length <= 4`, and `eliminatedCount >= 1` (or when `forceFinalFourPreview` is active in Admin Preview).
   - **4-Card Cohort Retention for 3 and 2 Alive Teams (Approved User Requirement `A1`):**
     - Always renders **4 horizontal cards** in the top bar: the currently surviving teams (`2..4` teams) PLUS the most recently eliminated 4th-place / 3rd-place team(s) needed to complete the 4-squad cohort (`finalFourCohort` of 4 teams).
     - When a Final-4 squad is eliminated (`3` or `2` teams remaining alive), **its card stays in the 4-column top bar** and transitions to a **grayed-out eliminated visual state** (muted gunmetal `#3D362B` surface, dimmed logo/text, all 4 player bars gray, and an `OUT #4` / `OUT #3` status tag).
     - Only reverts to the vertical `STANDARD_TOWER` leaderboard if `standingTeams.length >= 5` (e.g., an operator in Manual Mode restores a 5th team to alive, or a new match starts).
3. **`STANDARD_TOWER` Mode:** Default vertical leaderboard tower (`top-left` or `top-right`) when `standingTeams.length >= 5`, during warmup (`match.phase === 'idle'`), or when `showFinalFourLayout === false`.

### 3.2 Final-4 Top Bar Geometry & Card Anatomy (`1920×1080` Canvas)

- **Container Position:**
  - Anchored at **Top-Center** of the `1920×1080` canvas: `top: 28px`, centered horizontally (`left: 50%; transform: translateX(-50%)`), total width `1440px` (`4` cards × `348px` + `3` gaps × `16px`).
  - Includes a compact top championship micro-header bar (`FINAL 4 SURVIVING SQUADS • MATCH N — MAP`) framed with PMCC bronze hairlines and `◇` diamond nodes.
- **Per-Squad Card Layout (`348px × 86px`, 4 equal columns):**
  - **Left Rank Pillar (`44px` wide):** Vertical gold/bronze gradient banner displaying the squad's current live rank (`#1`, `#2`, `#3`, `#4`).
  - **Upper Identity Row (`46px` height):**
    - Team Logo (`32px × 32px` crisp container, omitted cleanly if `showLogos === false`).
    - Team Slot Badge (`T05`, if `showTeamNumbers === true`).
    - Team Name (`15px` bold uppercase `#F9EDD9`, single-line ellipsis).
  - **Lower Tactical Strip (`38px` height, `background: rgba(22, 15, 10, 0.95)`, top border `1px solid rgba(129, 96, 54, 0.4)`):**
    - **Left:** Prominent **4-Segment Alive Player Bars** (`4 × 18px × 8px` horizontal tactical pills — emerald/ivory for alive, amber for knocked in PCOB mode, dark gunmetal `#3D362B` for dead) + numeric `ALIVE 4/4` label.
    - **Right Metrics:**
      - `ELIMS`: Current match eliminations (`team.eliminations`) in `#F9EDD9`.
      - `PTS`: Total points (`team.totalPoints`) in PMCC Championship Gold (`#EEB058`).

### 3.3 Choreographed Transition Animations

- **Standard Tower → Final-4 Top Bar:**
  - Vertical tower slides slightly outward (`translateX(±24px)`) and fades to `opacity: 0` over `280ms cubic-bezier(0.4, 0, 0.2, 1)`.
  - Final-4 Top Bar descends from `translateY(-20px), opacity: 0` into `translateY(0), opacity: 1` over `360ms cubic-bezier(0.22, 1, 0.36, 1)` with a `45ms` stagger across the 4 survivor cards.
- **Final-4 Top Bar → Standard Tower (or WWCD):**
  - Reverses cleanly without layout jump or DOM flicker; both layouts remain mounted inside the scaled `1920×1080` stage with pointer-events disabled when hidden.
