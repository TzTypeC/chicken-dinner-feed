# Part 6 — WWCD Display Modes, Fullscreen Layout Refinement, Elimination Notification Positioning & Team Management UX

**Audit, Diagnostic Findings, and Revised Implementation Proposal**  
**Project:** Chicken Dinner Feed (`chicken-dinner-feed`)  
**Date:** 2026-10-21  
**Status:** `AWAITING_USER_APPROVAL` (Phase 3 Review Gate — Revised with Features E & F Requirements)

---

## 1. Executive Summary & Repository Audit

Following the completion of Part 5 and the user requirements revision for Part 6, a comprehensive re-audit of the repository was performed across `@cdf/shared`, `@cdf/backend`, and `@cdf/frontend`:

1. **Test Baseline:**
   - All 28 test files and 354 tests pass across backend and frontend (`backend`: 23 files, 284 tests; `frontend`: 5 files, 70 tests).
   - TypeScript typecheck (`tsc -b --noEmit`) passes with 0 errors across all 3 workspaces.
   - Oxlint passes with 0 warnings and 0 errors across 56 frontend files.
   - Prettier format check passes with 100% compliance.
   - Production builds (`npm run build`) succeed with exit code 0.

2. **Audit of `teamNo` Across the System:**
   - **`team-roster.json` (`ConfigStore.teams`):** The roster stores an array of `TeamRosterEntry` (`teamNo` 1–25, `name` 1–24 chars, `logoUrl` string nullable). The backend endpoint `PUT /config/teams` validates that all `teamNo` values are unique and bounded within 1–25.
   - **`LogoStore` (`backend/src/persistence/logo-store.ts`):** Logos are saved on disk as `data/logos/team-${teamNo}.${ext}` (e.g. `team-1.png`, `team-3.webp`). If a team's `teamNo` is changed permanently, its logo file on disk must be renamed to match its new `teamNo`, and `logoUrl` updated with a cache-busting timestamp (`?v=timestamp`). If a team is deleted, its logo file must be removed via `LogoStore.remove(teamNo)`.
   - **Live Ingest & PCOB Mapping (`backend/src/ingest/pcob/payload.ts` & `standings.ts`):** In PUBG Mobile tournament broadcasts, `teamNo` represents the **in-game custom room slot** (1–25) where players sit. `MatchStore` and `computeStandings()` join live player telemetry (`player.teamId`) to the roster using `entry.teamNo === player.teamNo`. Changing a team's `teamNo` re-maps which room slot that team name/logo is attached to on air.
   - **Manual Mode (`backend/src/state/manual-store.ts`):** `ManualStore` reconciles its state with the roster via `reconcileTeamsWithRoster()`, indexing entries by `teamNo`.
   - **Series Store & Historical Match Records (`backend/src/state/series-store.ts` & `series.json`):** `ClosedMapResult.teams` stores `ClosedMapTeamResult` (`teamNo`, `placement`, `eliminations`, `killPoints`, `placementPoints`, `totalPoints`). To prevent future team renumbering or team deletions from mutating or breaking past completed matches, historical closed maps should snapshot `name` and `logoUrl` at the moment of map close.

---

## 2. Visual Diagnosis & Root Cause Analysis

### Problem A: Fullscreen WWCD Title and Logo Alignment

1. **Framer Motion Transform Conflict:**
   In [`FullscreenWwcdOverlay.tsx`](file:///T:/codebook/guthib/chicken-dinner-feed/frontend/src/components/overlay/FullscreenWwcdOverlay.tsx) lines 384–390, the floating emblem and typography container has:
   ```tsx
   initial={{ scale: 0.86, opacity: 0, y: -18 }}
   animate={{ scale: 1, opacity: 1, y: 0 }}
   style={{
     position: 'absolute',
     top: showFullscreenCharacters ? ub(8) : '24%',
     left: '50%',
     transform: 'translateX(-50%)',
     zIndex: 20,
   }}
   ```
   In Framer Motion / Motion, specifying `animate={{ scale: 1, y: 0 }}` while using an inline CSS `transform: 'translateX(-50%)'` causes Motion's internal transform pipeline to clobber or collide with the horizontal offset, shifting the container off the geometric center during resting and animation states (identical to the Final-4 centering bug diagnosed in Part 4).
2. **CSS Letter-Spacing Trailing Offset:**
   `WINNER WINNER` uses `letterSpacing: ub(7)`. Standard CSS `letter-spacing` appends space to the right of _every_ character including the last letter `R`. With `text-align: center`, this uncompensated trailing space shifts the perceived visual center of the text $\approx 3.5\text{px}$ to the left.
3. **Character 5 (Center Leader) Asset Asymmetry:**
   Pixel analysis of `frontend/public/images/characters/char5.png` ($1250 \times 2750\text{px}$) revealed non-zero bounding box bounds: `left_pad = 123px`, `right_pad = 13px`. The center character's visible body is shifted 110px (~8.8%) to the right of the PNG image frame. Consequently, placing the title mathematically at canvas center while `char5.png` is placed with equal image margins makes the title appear visually offset relative to the character's head and body.
4. **Emblem Badge (`chicken-dinner-badge.png`):**
   Pixel bounds of `chicken-dinner-badge.png` are $513 \times 411\text{px}$ with content at $(1, 1, 513, 411)$ (0px horizontal padding). Wrapping the emblem and title in a full-width flex container (`left: 0, right: 0, display: flex, flexDirection: 'column', alignItems: 'center'`) eliminates transform collisions completely and centers the group.

### Problem B: Elimination Notification and Final-4 Overlap

1. **Vertical Footprint of Final-4 Top Bar:**
   - Container `top: ub(24)` ($24\text{px}$ on 1080p canvas).
   - Micro-header: $18\text{px}$ + $6\text{px}$ margin = $24\text{px}$.
   - Card container: $3\text{px}$ hairline + $50\text{px}$ identity row + $40\text{px}$ tactical row = $93\text{px}$.
   - Total vertical span: $Y = 24\text{px}$ to $Y \approx 141\text{px}$ (plus shadow ~145px).
2. **Elimination Notification Position:**
   - Currently hardcoded at `position: fixed; top: u(42); left: 50%; transform: translateX(-50%)`.
   - Vertical span of alert: $Y = 42\text{px}$ to $Y \approx 110\text{px}$.
   - **Conflict:** When 4, 3, or 2 squads remain alive and Final-4 is active, the elimination notification lands squarely across the center of the Final-4 showdown cards, occluding live squad ranks, team logos, and player alive bars.
3. **Broadcast-Safe Solution (EBU R95 & ITU-R BT.1848):**
   - EBU R95 1080p graphics safe margin begins at $Y = 54\text{px}$.
   - When Final-4 is active, moving the elimination alert to `top: ub(164)` places it $19\text{px}$ below the bottom edge of the Final-4 cards ($Y = 164\text{px}$ to $Y \approx 232\text{px}$).
   - This leaves the entire gameplay center ($Y = 240\text{px}$ to $Y = 900\text{px}$) clear, ensures zero collision with Final-4, and complies with broadcast safe margins.
   - When Final-4 is inactive ($> 4$ survivors or feature disabled), the notification rests at its standard top position `top: ub(42)`.

---

## 3. Detailed Feature Proposals

### Feature A — WWCD Display Modes: Card, Fullscreen, and Dual

1. **Configuration Schema:**
   - Extend `autoWwcdVariantSchema` in [`shared/src/config/overlay-instance.ts`](file:///T:/codebook/guthib/chicken-dinner-feed/shared/src/config/overlay-instance.ts):
     ```ts
     export const autoWwcdVariantSchema = z.enum(['standard', 'fullscreen', 'dual']);
     export type AutoWwcdVariant = z.infer<typeof autoWwcdVariantSchema>;
     ```
   - In UI / Admin, display as:
     - **Card Mode** (`'standard'`): Only Standard WWCD (`wwcd` instance) activates automatically on match end.
     - **Fullscreen Mode** (`'fullscreen'`): Only Fullscreen WWCD (`wwcd-fullscreen` instance) activates automatically.
     - **Dual Mode** (`'dual'`): Both Standard Card and Fullscreen WWCD activate automatically during the confirmed WWCD event.
2. **Dual Mode Coordination & Visibility Rules:**
   - Both presentations evaluate the exact same authoritative `selectWwcdWinner()` state from `LiveSnapshot.match`. Winner detection runs once in the backend/store.
   - **Zero False Multiplicity:** A standard card instance only renders if its type is `wwcd`; a fullscreen instance only renders if its type is `wwcd-fullscreen`.
   - **Respect Operator ON AIR:** In Dual mode, each instance's individual `onAir` setting is strictly honored:
     - If both `default-wwcd` and `default-wwcd-fullscreen` are ON AIR, both browser sources render their victory screens.
     - If the operator has toggled one to HIDE (`onAir: false`), only the ON AIR presentation appears. The system never silently forces a hidden instance ON AIR.
   - **Latching Safeguard:** The existing `resolveActiveAutoWwcdVariant` latching mechanism prevents preference edits during an active WWCD from replaying animations.
   - **Admin UI Guidance:** When Dual is selected, a descriptive callout appears: _"Dual mode coordinates both presentations during a WWCD event. Both instances must be set to ON AIR."_

### Feature B — Fullscreen WWCD Alignment Refinement

1. **Eliminate Motion Transform Collision:**
   Wrap the floating grand pan emblem and typography in a full-canvas flex wrapper:
   ```tsx
   <div
     style={{
       position: 'absolute',
       top: showFullscreenCharacters ? ub(8) : '22%',
       left: 0,
       right: 0,
       display: 'flex',
       flexDirection: 'column',
       alignItems: 'center',
       pointerEvents: 'none',
       zIndex: 20,
     }}
   >
     <motion.div
       initial={{ scale: 0.86, opacity: 0, y: -18 }}
       animate={{ scale: 1, opacity: 1, y: 0 }}
       transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
       className="flex flex-col items-center text-center"
     >
       ...
     </motion.div>
   </div>
   ```
2. **Typography Optical Centering:**
   Compensate for trailing `letter-spacing` by applying a negative right margin equal to the letter spacing on `WINNER WINNER` (`marginRight: `-${ub(7)}``) and `CHICKEN DINNER` (`marginRight: `-${ub(3)}``).
3. **Character Lineup Optical Balance:**
   Apply an optical compensation to the center character container (`char5.png` shifted slightly left by $2.5\%$ to balance the $110\text{px}$ transparent padding in the asset), perfectly aligning the leader character's helmet and centerline with the pan emblem and typography above.
4. **Resolution Scalability:**
   Use the established `ub()` responsive scaling utility to ensure identical visual proportions across $1920 \times 1080$, $1600 \times 900$, and $1280 \times 720$.

### Feature C — Elimination Notification Positioning at Four Survivors

1. **State-Dependent Vertical Positioning:**
   - In [`EliminationOverlay.tsx`](file:///T:/codebook/guthib/chicken-dinner-feed/frontend/src/components/overlay/EliminationOverlay.tsx), accept an optional prop:
     ```ts
     export interface EliminationOverlayProps {
       alert: EliminationAlertItem | null;
       appearance: OverlayAppearance;
       finalFourActive?: boolean;
     }
     ```
   - Calculate vertical anchor: `finalFourActive ? ub(164) : ub(42)`.
2. **Live Coordination in `OverlayPage.tsx`:**
   `OverlayPage` resolves `activeLayoutMode = resolveLeaderboardLayoutMode(snapshot.match, appearance)`.
   When `activeLayoutMode === 'final-four'`, pass `finalFourActive={true}` to `<EliminationOverlay />`.

### Feature D — Bulk Team Creation

1. **User Experience & Modal Workflow:**
   - In [`TeamRosterEditor.tsx`](file:///T:/codebook/guthib/chicken-dinner-feed/frontend/src/features/admin/TeamRosterEditor.tsx), add a primary action button: **Bulk Add Teams**.
   - Opens a modal dialog with a multiline text area, format guidance, and live parsing preview.
2. **Flexible Input Formats Supported:**
   - `[Slot] [Team Name]` (e.g., `1 Alpha Squad` or `T01 Alpha Squad`)
   - `[Slot], [Team Name]` (CSV format: `1, Alpha Squad`)
   - `[Team Name]` (Team name only: auto-assigns the lowest available unused `teamNo` between 1 and 25).
3. **Validation & Preview:**
   - Handles empty lines, trims whitespace, enforces $1 \le \text{teamNo} \le 25$ and name $\le 24$ chars.
   - Detects duplicate `teamNo` within the batch and conflicts with existing teams.
   - Detects roster overflow (maximum 25 teams total).
   - Shows live preview distinguishing valid rows from invalid rows with explicit error messages.
4. **Atomic Commitment:**
   - Commits all valid teams atomically into `document.teams` in one state update, saving via `PUT /config/teams`.

---

### REVISED Feature E — Drag-and-Drop Permanent Team Number Renumbering (`teamNo`)

The objective is to **permanently update the actual `teamNo` of teams** when an operator moves them to a new slot position.

#### 1. Renumbering Rules & Slot Conflict Resolution

When an operator moves a team from Source Slot $S$ to Destination Slot $D$:

- **Rule 1: Ripple Shift (Sequential Insertion — Default Drag Behavior):**
  - **Moving Downward ($S > D$, e.g., Slot 12 dragged to Slot 3):**
    - The dragged team permanently takes Slot $D$ (`teamNo = 3`).
    - All teams currently occupying slots in the range $[D, S - 1]$ (i.e. slots 3 through 11) shift down by $+1$:
      - Former Slot 3 becomes Slot 4
      - Former Slot 4 becomes Slot 5
      - ...
      - Former Slot 11 becomes Slot 12
    - Teams outside the $[D, S]$ range (Slots 1–2 and 13–25) remain completely untouched.
  - **Moving Upward ($S < D$, e.g., Slot 3 dragged to Slot 12):**
    - The dragged team permanently takes Slot $D$ (`teamNo = 12`).
    - All teams currently occupying slots in the range $[S + 1, D]$ (i.e. slots 4 through 12) shift up by $-1$:
      - Former Slot 4 becomes Slot 3
      - Former Slot 5 becomes Slot 4
      - ...
      - Former Slot 12 becomes Slot 11
    - Teams outside the $[S, D]$ range (Slots 1–2 and 13–25) remain completely untouched.
  - **Guarantee:** No two teams ever share the same `teamNo`, and all numbers remain strictly within $1 \dots 25$.

- **Rule 2: Direct Slot Swap (Optional Explicit Mode / Slot Target Dropdown):**
  - For operators who need to exchange two specific teams that joined the wrong lobby slots without shifting any intermediate teams:
  - Team at Slot $S$ takes Slot $D$, and Team at Slot $D$ takes Slot $S$. Intermediate slots remain unchanged.
  - Provided via an explicit **"Swap Slot"** action in each row or a toggle switch: **Reorder Mode: [Ripple Shift | Slot Swap]**.

- **Rule 3: Moving to a Vacant / Empty Slot:**
  - If Slot $D$ is currently vacant/empty (e.g. dragging Team 12 to vacant Slot 3 when no team occupies Slot 3):
  - Team 12 simply updates its `teamNo` to 3. No other teams shift.

#### 2. Backend Logo File Synchronization (`LogoStore`)

Because logo files on disk are named `team-${teamNo}.${ext}`:

- When `PUT /config/teams` is saved, the backend detects if any team's `teamNo` has changed.
- For each moved team $A \to B$:
  - `LogoStore` renames the file `data/logos/team-${A}.${ext}` to `data/logos/team-${B}.${ext}`.
  - If swapping $A \leftrightarrow B$, a temporary filename (`team-${A}.tmp`) is used to prevent collisions.
  - `team.logoUrl` is updated to `/api/logos/team-${B}.${ext}?v=${Date.now()}` so browser caches refresh immediately.

#### 3. Historical Data Integrity (`series.json` & Telemetry Protection)

- **Snapshotting Closed Maps:** Enhance `ClosedMapTeamResult` to snapshot `name` and `logoUrl` at the moment a map is closed:
  ```ts
  export const closedMapTeamResultSchema = z.object({
    teamNo: z.number().int().min(1).max(25),
    name: z.string().optional(),
    logoUrl: z.string().nullable().optional(),
    placement: z.number().int().min(1),
    eliminations: z.number().int().min(0),
    killPoints: z.number().int().min(0),
    placementPoints: z.number().int().min(0),
    totalPoints: z.number().int().min(0),
  });
  ```
  This ensures that when a past match is viewed in Postgame Match (`PostGameOverlay.tsx`), it reads the exact team identity recorded at the time of that match, even if the team's slot is subsequently renumbered for future matches.
- **Live Match Telemetry Protection:** If `teamNo` is changed during an active live match (`match.phase !== 'idle'`), the admin UI shows an explicit warning:
  _"Warning: Changing team numbers during an active match will immediately remap live PCOB telemetry to the new slots."_

#### 4. Accessible Reordering Controls (WCAG 2.5.7)

In addition to HTML5 drag handles (`GripVertical`), each team row includes:

- An explicit **Slot Number Selector Dropdown** (`Change to Slot...` with 1–25 options).
- Up (`▲`) and Down (`▼`) stepper buttons to shift a team up or down by one slot.

---

### NEW Feature F — Selective and Bulk Team Deletion

#### 1. User Experience & Actions

In the Teams tab ([`TeamRosterEditor.tsx`](file:///T:/codebook/guthib/chicken-dinner-feed/frontend/src/features/admin/TeamRosterEditor.tsx)):

- **Checkbox per Row:** Every team row has a select checkbox `[ ]`.
- **Master Checkbox:** Table header has a `Select All / Deselect All` checkbox (with indeterminate state when partially selected).
- **Selection Action Bar:** When $\ge 1$ teams are checked, an action bar appears showing:
  - Selected count: `3 of 16 teams selected`.
  - **[Delete Selected (3)]** (red button).
  - **[Clear Selection]** button.
- **[Delete All Teams] Button:** A dedicated destructive button placed in the actions toolbar.

#### 2. Confirmation Dialogs with Clear Impact Descriptions

1. **Delete Selected Confirmation Dialog:**
   - Displays: _"Are you sure you want to delete X team(s)?"_
   - Lists the slots and names: e.g., `Slot 3 (C1)`, `Slot 7 (KNZ)`.
   - Explains consequences clearly:
     - _"These teams will be removed from the active roster."_
     - _"Associated logo files for these slots will be permanently removed from disk."_
     - _"Historical match results in past completed matches remain preserved."_
2. **Delete All Teams Confirmation Dialog:**
   - Displays high-visibility destructive warning: _"Are you sure you want to delete ALL teams?"_
   - Explains:
     - _"All teams will be removed from the active roster."_
     - _"All uploaded team logos will be deleted."_
     - _"Active overlays will display no teams until new teams are added or imported from an INI file."_
     - Requires typing `DELETE ALL` or clicking an explicit confirmation button.

#### 3. Post-Deletion Slot Policy (Preserve Remaining Slot Numbers)

- **Policy:** **Remaining teams PRESERVE their existing `teamNo` (Sparse Slots).**
  - Example: If Teams in Slot 3, 5, and 8 are deleted from a 16-team roster:
  - Slots 1, 2, 4, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16 **remain completely unchanged**.
  - Slots 3, 5, and 8 become vacant.
- **Why Automatic Renumbering is Strictly Avoided:**
  - In esports broadcasts, room slots correspond to physical game lobby seats. Automatically shifting Team 9 to Slot 6 would cause that team to display the wrong telemetry and desynchronize with the tournament lobby!
  - Operators can later assign new teams into vacant slots using "Add a team" or "Bulk Add Teams".

#### 4. Backend Persistence & Atomic Cleanup

- Deletion is committed through `PUT /config/teams` with the updated array.
- For each deleted team:
  - Backend automatically removes the file `data/logos/team-${teamNo}.*` via `LogoStore.remove(teamNo)`.
- If the network request fails, the frontend catches the error, displays an error toast (`Could not delete teams`), and rolls back the local state without showing a false success.

---

## 4. Workstream Breakdown

- **`WS-6.1` — Schema, Protocol & Backend Persistence:**
  - Update `autoWwcdVariantSchema` to `z.enum(['standard', 'fullscreen', 'dual'])`.
  - Update `PUT /config/auto-wwcd` in `config.ts`.
  - Enhance `ClosedMapTeamResult` with optional `name` and `logoUrl` snapshots.
  - Implement `LogoStore` logo renaming/swapping for `teamNo` changes and deletion cleanup.
- **`WS-6.2` — Fullscreen WWCD Layout Refinement:**
  - Refactor title/logo container in `FullscreenWwcdOverlay.tsx` to full-width flexbox centering.
  - Compensate for trailing letter-spacing and `char5.png` image bounding box asymmetry.
  - Test at 1920×1080, 1600×900, and 1280×720.
- **`WS-6.3` — Elimination Notification Dynamic Positioning:**
  - Add `finalFourActive` prop to `EliminationOverlay.tsx` (`top: finalFourActive ? ub(164) : ub(42)`).
  - Connect `activeLayoutMode === 'final-four'` in `OverlayPage.tsx`.
- **`WS-6.4` — Dual WWCD Mode & Visibility Coordination:**
  - Coordinate simultaneous activation of `wwcd` and `wwcd-fullscreen` when `effectiveAutoWwcdVariant === 'dual'`.
  - Enforce individual instance `onAir` controls.
  - Update Admin Auto WWCD selector with Dual mode and guidance callout.
- **`WS-6.5` — Bulk Team Creation:**
  - Implement `BulkTeamDialog.tsx` modal with parser, validation, duplicate slot checking, and live preview table.
  - Atomic commitment into `document.teams`.
- **`WS-6.6` — Permanent Team Number Renumbering & Drag-and-Drop (Fitur E):**
  - Implement drag-and-drop renumbering with Ripple Shift algorithm and slot conflict prevention.
  - Add accessible Slot Number Selector Dropdown and Up/Down buttons on each row.
  - Integrate backend logo file renaming on slot changes.
- **`WS-6.7` — Selective & Bulk Team Deletion (Fitur F):**
  - Implement row checkboxes, Select All / Deselect All, and Selection Action Bar.
  - Implement Delete Selected and Delete All Teams confirmation dialogs with clear consequences.
  - Implement sparse slot retention (preserving remaining numbers) and disk logo cleanup.
- **`WS-6.8` — Quality Gates, Automated Tests & Verification:**
  - Comprehensive unit tests covering Dual WWCD, elimination positioning, bulk creation, slot renumbering, and selective/all team deletion.
  - Execute full quality checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.

---

## 5. Review Gate Status & Key Confirmation Questions

**Phase 3 Review Gate:** The revised design proposal is complete.  
No implementation code will be written until you explicitly approve this plan.

### Konfirmasi Keputusan Desain:

1. **Aturan Perpindahan Slot Saat Drag-and-Drop (Fitur E):**
   - **Rekomendasi:** Gunakan **Ripple Shift (Sisip & Geser)** sebagai perilaku bawaan saat drag-and-drop (contoh: menyeret slot 12 ke slot 3 akan menempatkan tim di slot 3 dan menggeser slot 3–11 turun 1 slot menjadi slot 4–12).
   - Selain itu, sediakan **Dropdown Pilihan Slot Langsung** pada baris tim untuk opsi tukar slot langsung (_Direct Swap_).
   - _Apakah aturan penomoran ini disetujui?_

2. **Perilaku Slot Setelah Tim Dihapus (Fitur F):**
   - **Rekomendasi:** **Tetapkan nomor slot tim yang tersisa (Sparse Slots)**. Contoh: jika tim pada slot 3 dihapus, slot 3 menjadi kosong, sedangkan tim pada slot 4–16 tetap mempertahankan nomornya masing-masing. Ini mencegah tim yang tersisa tiba-tiba bergeser nomor dan salah memetakan data telemetri custom room PCOB.
   - _Apakah kebijakan penetapan nomor slot yang tersisa ini disetujui?_

3. **Integritas Data Riwayat Pertandingan (`series.json`):**
   - **Rekomendasi:** Simpan snapshot `name` dan `logoUrl` pada setiap map yang ditutup (`ClosedMapResult`), sehingga perubahan nomor slot atau penghapusan tim di masa depan tidak pernah mengubah atau merusak tampilan nama/logo pada pertandingan lampau di Postgame.
   - _Apakah snapshotting data historis ini disetujui?_
