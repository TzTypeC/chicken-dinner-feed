# Part 10 — Audit & Proposal: Extended Name Animation Recovery, Top Kill, Most Improved Team, Live WWCD Prediction

**Author:** Claude Code (Engineering Assistant)
**Date:** 2026-10-23
**Project:** `chicken-dinner-feed`
**Status:** **AUDIT & PROPOSAL — AWAITING USER APPROVAL.** No production code, test, configuration or data has been changed. Implementation starts only after explicit approval of this proposal and answers to §21.

Legend: **[P]** proven by a measurement or command in this audit · **[C]** read from code (file:line) · **[R]** external reference · **[I]** inference / design judgement · **[H]** hypothesis not yet proven.

---

## 1. Repository state

| Item            | Value                                                                                                                                                                                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD   | `main` / `4893dc6 Implement Part 9 broadcast and map reset fixes` [P]                                                                                                                                                                                                                                                            |
| Working tree    | clean at audit start [P] (the Obsidian vault folder is listed in `.gitignore`)                                                                                                                                                                                                                                                   |
| Part 9          | committed in `4893dc6`; `docs/part9-audit-and-proposal.md` §19 is its implementation report                                                                                                                                                                                                                                      |
| Versions        | `PROTOCOL_VERSION = 11` (`shared/src/versions.ts:17`), `CONFIG_SCHEMA_VERSION = 5` (`:25`) [C]                                                                                                                                                                                                                                   |
| Production data | `backend/data/*.json` SHA-256 unchanged vs the Part 9 baseline (custom-fonts `e8cd023a…`, manual-match `d9fa6c05…`, overlay-instances `5267e04a…`, scoring-ruleset `208ee9f3…`, series `41551e8d…`, team-roster `f4287da6…`) [P]. `series.json` holds **0 closed maps**; the manual match is a finished map (one team standing). |

Architecture recap (verified in code): backend computes the live match (`computeStandings`, ranks by points → `teamNo`), keeps closed maps in `SeriesStore`, and pushes one full `LiveSnapshot` over `/ws/live` (revision, ingest state, match, matchInfo, `lastClosedMap`, **all `closedMaps`**) coalesced over 50 ms and only when the change key differs (`live-hub.ts:119, 247-266`). Each browser source receives its **own** instance configuration on a separate `overlay` message (`shared/src/protocol/live.ts:75-98`). Postgame/series results are derived on the frontend from `closedMaps` (`broadcast-state.ts`).

## 2. Obsidian memory read

Vault: `PMCC2026-ObsidianVault/` (the only vault; `.obsidian/` present). Read before the audit: `Home`, `Current Checkpoint`, `Project Rules and Constraints`, `Decision Log` (Parts 1–9), `Known Issues`, `Leaderboard Team Name Display`, `WWCD Identity and Provisional Results`, `Close Map Resets Manual Match`, `Scoring and Series Pipeline`, `Overlay Rendering and Settings`, `Final-4 Showdown and Post-Game Standings`. Progress for this audit is logged in `Sessions/2026-10-23 Part 10 Audit Extended Name Top Kill Most Improved WWCD Prediction.md`.

Constraints carried over from memory and applied here: audit → approval before code; no destructive git; temp data copies only; Prettier only on explicit repo files (the vault is never formatted); no `CONFIG_SCHEMA_VERSION` bump for additive fields (ADR-0015); WWCD is never inferred (ADR-0019); overlays always animate (reduced motion applies to the admin only); overlay geometry in design units (`u()`/`ub()`, ADR-0011).

## 3. Baseline quality gates (HEAD `4893dc6`, run 2026-10-23 21:31–21:35)

| Gate                    | Result                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`              | backend **343/343** (27 files), frontend **178/178** (14 files) [P]                                                                                                             |
| `npm run typecheck`     | 0 errors [P]                                                                                                                                                                    |
| `npm run lint` (oxlint) | no diagnostics [P]                                                                                                                                                              |
| `npm run format:check`  | "All matched files use Prettier code style!" [P] (vault ignored via `.gitignore`)                                                                                               |
| `npm run build`         | OK; known Vite >500 kB chunk warning (pre-existing) [P]                                                                                                                         |
| Browser-level tests     | none in the repo (Vitest + jsdom only). Browser checks in this audit are scripted headless Chromium against a temp server.                                                      |
| Console / network       | `/overlay/main`, `/overlay/final4?preview=1`, `/overlay/postgame-match`, `/overlay/postgame-series`, `/admin`: **0** console errors/warnings, **0** failed or ≥400 requests [P] |
| Known failures          | none                                                                                                                                                                            |

Test environment: built app, `DATA_DIR=%TEMP%\cdf-part10-audit\data PORT=4420 INGEST_SOURCE=mock`, copy of `backend/data`; the copy's manual match was reset so the tower is visible. Viewport 1920×1080, admin 1920×1080 (preview iframe renders at 1920×1080 internally).

---

## 4. Issue A — Extended Name animation is a hard cut

### 4.1 Reproduction [P]

`/overlay/main` (right anchor, `wipe`, max extension 200, 25 teams), sampling every animation frame for 1.5 s around the configuration change; same check inside the admin preview iframe with the real switch + **Save** button.

| Surface              | Change   | Frames that changed | Largest step between two frames             | Transition span |
| -------------------- | -------- | ------------------- | ------------------------------------------- | --------------- |
| Standalone           | OFF → ON | **1** of 89         | **96 px** (panel left, width and every row) | 0 ms            |
| Standalone           | ON → OFF | **1** of 91         | **96 px**                                   | 0 ms            |
| Admin preview (Save) | OFF → ON | **1** of 103        | **96 px**                                   | 0 ms            |
| Admin preview (Save) | ON → OFF | **1** of 107        | **96 px**                                   | 0 ms            |

### 4.2 Root cause [P][C]

1. The panel width is a plain style, `width: u(M.panelWidth + extension)` (`LeaderboardOverlay.tsx:87`). Nothing animates it, before or after Part 9.
2. Before Part 9 the **only** motion on Save was incidental: every row has Motion `layout="position"` (`TeamRow.tsx:55-56`, 0.55 s), so when the panel's left edge jumped, each row was projected back to its old x and slid over. The background snapped while the rows slid — measured in Part 9 as a 93–96 px row `translateX` decaying over ~0.5 s. That tear was the Part 9 complaint ("rough/sliding after Save").
3. Part 9 (`4893dc6`) wrapped the rows in `<motion.div layout layoutRoot>` (`LeaderboardOverlay.tsx:166`, git diff of `4893dc6`), which correctly stops the rows from sliding relative to the panel — and thereby removed the only motion that existed. Result: a 96 px hard cut.

So this is not a timing/easing bug: there has never been a designed width transition. The fix is to add one, not to restore the Part 8 tear.

Checked and **ruled out** for the hard cut [P/C]: remounting (Part 9 verified the same marquee node and continuous `currentTime` across config changes); `prefers-reduced-motion` (overlays ignore it by policy, `globals.css`); different rendering paths (the admin preview iframe is the same `OverlayPage` at 1920×1080 and shows the identical 1-frame jump); `will-change`/clipping (no `will-change` on the panel; the `wipe` clip follows the wrapper box). Font loading changes the extension once after load (446 → 436 px in Part 9 measurements) — relevant to the fix (§4.4), not a cause of the cut.

### 4.3 Throwaway prototype [P]

A CSS `transition: width 450ms cubic-bezier(0.22,1,0.36,1)` was injected into the running page (no repository change):

| Change                    | Change frames | Span   | Largest step |
| ------------------------- | ------------- | ------ | ------------ |
| OFF → ON (+96 px)         | 22            | 383 ms | 26.4 px      |
| ON → OFF (−96 px)         | 21            | 333 ms | 42.0 px      |
| OFF → ON, max 40 (+40 px) | 20            | 350 ms | 9.7 px       |

Rows and background moved together (row left − panel left constant). **But it exposed a second defect:** during the transition 5 names flipped `data-scrolling` true → false (the `ResizeObserver` in `OverflowMarquee` saw a half-wide name column and briefly started marquees). The hard-cut build had 0 flips. The large first step comes from the ease-out curve; a symmetric curve spreads it.

### 4.4 Proposed fix (A1, recommended)

- **One designed transition:** the panel width (and, for a left-anchored panel, the wrapper's `left`) animates from the old to the new extension as one piece — background, header, rows and legend together. Duration **400 ms**, symmetric ease-in-out `cubic-bezier(0.4, 0, 0.2, 1)`, via the Web Animations API (or Motion's `animate` on `width`, not Motion `layout`, which would scale-stretch text). Keep the Part 9 `layout layoutRoot` rows container so rows never slide independently, and keep `layout="position"` on rows for rank changes.
- **Animate only operator-visible changes after the panel has settled:** the first layout after mount and the first layout after `document.fonts.ready` snap (no animated "settling" on load); later extension changes (Save, roster rename, scale/font change) animate. An interrupted transition (second Save mid-flight) retargets from the current width, never jumps.
- **Marquee decisions come from the target layout, not mid-transition sizes:** while the panel is transitioning, `OverflowMarquee` keeps its current decision and ignores `ResizeObserver` callbacks; one re-measure runs when the transition ends. Names that will scroll at the target start after settle; names that fit never start.
- **Text swap order:** OFF → ON shows the full names at the start (clipped, `text-overflow: clip`, revealed as the column widens); ON → OFF keeps the full names clipped while shrinking and switches to the `…` form when the transition ends. No ellipsis ever appears in a widening panel.
- **Cost:** width animation re-lays out ~25 rows per frame for 0.4 s. Measured headroom (Part 9: 22 marquees at p95 16.9 ms) suggests this fits; it is measured as an acceptance criterion. **Fallback A2** if it does not: compositor-only FLIP (background layer `scaleX`, row content `translateX`) — more code, no per-frame layout.
- Rejected: **A3** revert Part 9 `layoutRoot` (brings back the background/row tear); Motion `layout` on the panel (scales text); longer duration/easing tweaks alone (do not create a transition).

### 4.5 Measurable acceptance criteria (Issue A)

Measured by per-frame DOM sampling (`requestAnimationFrame`, `getBoundingClientRect` of the panel and every row, `data-scrolling` mutation log) in headless Chromium, standalone and admin preview:

| #    | Criterion                                              | Target                                                                                                                                                               |
| ---- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1  | Panel transition duration (first → last changed frame) | 350–450 ms                                                                                                                                                           |
| A-2  | Changed frames at 60 fps                               | ≥ 18                                                                                                                                                                 |
| A-3  | Largest per-frame step for a 96 px change              | ≤ 10 px (ease-in-out peak ≈ 2× average 4 px)                                                                                                                         |
| A-4  | Rows vs background                                     | `                                                                                                                                                                    | Δrow.left − Δpanel.left | ≤ 0.5 px` on every frame |
| A-5  | Marquee flips during the transition                    | 0                                                                                                                                                                    |
| A-6  | Marquees that should scroll at the target              | running ≤ 100 ms after the transition ends                                                                                                                           |
| A-7  | Time from snapshot arrival to stable layout            | ≤ 500 ms                                                                                                                                                             |
| A-8  | First mount and font load                              | no animated movement (change applied in one frame before first paint / at fonts-ready)                                                                               |
| A-9  | Interrupted change (second Save mid-flight)            | no frame-to-frame jump > 10 px                                                                                                                                       |
| A-10 | Viewports / scale                                      | 1920×1080, 1280×720, 1366×768, 2560×1440 × scale 0.7/0.85/1/1.15; plus admin preview iframe                                                                          |
| A-11 | Frame time during transition with 22 marquees          | p95 ≤ 17.5 ms (one tab)                                                                                                                                              |
| A-12 | Regression                                             | `wipe`/`zoom-fade`/`slide`/`fade` HIDE → ON AIR unchanged; rank change still animates `translateY` with `translateX = 0`; Part 9 48-case fit matrix still 0 failures |
| A-13 | OBS                                                    | operator check (cannot be automated here)                                                                                                                            |

"Continuous" marquee scrolling is excluded from A-1…A-4 by sampling the panel/row boxes, not the marquee track.

---

## 5. Feature B — Fullscreen Top Kill

### 5.1 Data audit [C]

| Question                             | Finding                                                                                                                                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth                      | `ClosedMapTeamResult.eliminations` (`shared/src/domain/series.ts:28-54`). It is the team's elimination count stored at close; `killPoints = eliminations × pointsPerElimination` is derived from it (`standings.ts:162`, `series-store.ts` `resultsFromEdits:60-111`). |
| PCOB vs Manual                       | Same closed-map model for both. Live PCOB `Team.eliminations` = Σ player high-water kills (`standings.ts:126`); Manual = operator count. The PCOB team `killNum` is not read (no cross-check).                                                                         |
| Edits after close                    | `editClosedMap` replaces `eliminations` in place and re-derives points (`series-store.ts:419-446`) — Top Kill follows corrections automatically.                                                                                                                       |
| Identity                             | Closed-map snapshot `name`/`logoUrl` (Part 6) with the map's `teamNo` (ADR-0019 pattern).                                                                                                                                                                              |
| Kill count vs kill points vs scoring | Shown count = `eliminations`; kill points shown separately and labelled. Additional points (Part 8) are not kills and are ignored.                                                                                                                                     |
| Unfinished map                       | Live `eliminations` can still move; not used by default (§21 Q3).                                                                                                                                                                                                      |
| Per-player kills                     | Not stored on closed maps — Top Kill is a **team** stat.                                                                                                                                                                                                               |

### 5.2 Selection rule (proposed)

1. Map = per-instance setting `topKillMatchSelection: 'latest' | <ClosedMapResult.id>` (default `'latest'` = `closedMaps.at(-1)`), mirroring `postGameMatchSelection` (`broadcast-state.ts:430-512`, admin dropdown `AppearanceEditor.tsx:240-305`).
2. Candidates = teams in that map with `eliminations ≥ 1`.
3. Order: `eliminations` desc → `placement` asc (better finish) → `teamNo` asc. Deterministic and uses only official fields; scoring unchanged.
4. Show **at most 4**. Displayed rank uses competition ranking (1, 2, 2, 4) with a **TIED** tag, so a tie is never hidden. If teams beyond the 4th share the 4th card's count, a footnote says "N more teams also on X eliminations" (recommended over growing the layout to 5–6 cards, which would break the composition and still not bound the case).
5. Fewer than 4 candidates → only real teams are drawn (hero + 0–2 rows); no empty placeholder cards.
6. All teams 0 → empty state "No eliminations recorded in Match N". No closed map / pinned map missing → "No finished match yet" / "Selected match no longer exists" (+ admin warning, same pattern as `isPinnedPostGameMatchUnavailable`).

### 5.3 Design (see §13–§15) — recommended concept TK-2 "hero + ladder"

Prototype: `PMCC2026-ObsidianVault/Attachments/Part 10 Prototypes/topkill.png` (+ `.html`). #1 gets the single bold element (oversized tabular kill numeral, name, logo, slot pill, supporting "Finished #2 · Kill points +14 · Match points 20"); #2–#4 are compact rows with right-aligned tabular numerals and a thin zero-based proportional bar showing the margin; ties carry "TIED"; the footnote states the source and tie rule.

### 5.4 Routing / lifecycle

New overlay type `top-kill`, default instance id `top-kill`; routes `/overlay/top-kill`, `/overlay/$instanceId/top-kill`, shortcut `/top-kill` (same pattern as `postgame-series`, `router.tsx:83-92, 155-163, 215-224`). Visibility is operator ON AIR only (like postgame screens; no automatic trigger). Data changes (a correction) re-render in place without replaying the entrance. `?preview=1` shows a labelled sample, never a roster team (Part 9 preview rule).

---

## 6. Feature C — Fullscreen Most Improved Team

### 6.1 Standings audit [C]

| Question                   | Finding                                                                                                                                                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overall standings          | `selectSeriesStandings` (`broadcast-state.ts:592-700`): `totalPoints` desc → `wwcdCount` desc → Σ `placementPoints` desc → Σ `killPoints` desc → latest placement asc → `teamNo` asc. Strict total order; `seriesRank = index + 1` of that sort.                                                    |
| Live tower rank            | different chain: points → `teamNo` (`standings.ts:196`).                                                                                                                                                                                                                                            |
| Per-map standings snapshot | **not stored**. Standings after map k are exactly reproducible by running the selector on `closedMaps.slice(0, k + 1)` (pure function; latest placement reads `maps.at(-1)`).                                                                                                                       |
| Live teams                 | the selector also adds teams that merely **appeared live** (0 points) (`:606-619`). For historical ranks this must be off, otherwise a team that had not played yet would be ranked last and then "climb".                                                                                          |
| Identity                   | `teamNo` only; roster has no stable id (`team-roster.ts:19-40`). Ripple Shift renumbering does **not** rewrite closed maps (`roster-reorder.ts`, `logo-store.ts:122`), so after a renumber the same slot number can mean different teams in different maps (Known Issue: slot-keyed series totals). |
| Corrections                | standings are recomputed from current closed maps, so a correction to an earlier map changes both endpoints (consistent with the series overlay).                                                                                                                                                   |
| Ordering                   | array index is the truth; `mapNumber` = position (renumbered on insert/delete), except Excel import which keeps the sheet's round number (`excel/import.ts:373-416`).                                                                                                                               |

### 6.2 Formula and range

- `Improvement(team) = Rank_after(start) − Rank_after(end)`; positive = climbed, 0 = unchanged, negative = dropped. Rank 1 is best.
- Rank source: the official overall chain above (recommended, §21 Q5), computed on closed maps only (live-appeared teams excluded).
- Range: per-instance `mostImprovedFrom: 'previous' | <mapId>` and `mostImprovedTo: 'latest' | <mapId>`; defaults `previous → latest` ("after the previous match → after the latest match"). The selected maps are **the snapshot boundaries**: "Match 1 → Match 2" compares standings after Match 1 with standings after Match 2 (never "before Match 1").
- Valid only when `index(from) < index(to)`, both exist and are closed; otherwise the overlay shows "Comparison unavailable" and the admin explains why (missing map, reversed or equal range, fewer than 2 closed maps). Unclosed maps are never selectable.

### 6.3 Eligibility

| Case                                                                        | Treatment                                                                                                         |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Team first plays after the start map                                        | excluded (no start rank)                                                                                          |
| Team in start standings but absent from end standings                       | cannot happen with closed-map-only standings (standings are cumulative); if deleted maps make it happen, excluded |
| Team deleted from roster later                                              | still ranked from its closed-map snapshots; name/logo from the latest snapshot in range                           |
| Renamed team                                                                | same `teamNo`, latest snapshot name shown                                                                         |
| Renumbered team (same `teamNo` → different snapshot names inside the range) | flagged; recommended **exclude + admin warning** (§21 Q7)                                                         |
| Equal ranks                                                                 | impossible in the strict chain                                                                                    |
| Equal improvement                                                           | better end rank first (end rank is unique → deterministic)                                                        |
| No team with improvement > 0                                                | empty state "No team climbed between Match A and Match B"; a dropping team is never shown as most improved        |

### 6.4 Display — recommended MI-2 "hero + rank rail"

Prototype: `Attachments/Part 10 Prototypes/mostimproved.png` (+ `.html`). Hero: identity, "After Match 1 **18** → After Match 2 **5**", "▲ 13 places up" (sign and glyph, never colour alone), series points shown separately and labelled ("Series points 4 → 27"); a vertical rank rail (1 at top) with the two real endpoints connected. "Also climbing": up to 3 compact rows "#20 → #11 ▲ 9". Footnote states the rank rule and tie rule.

---

## 7. Feature D — WWCD Prediction on Final 4

### 7.1 Data inventory [C]

| Feature                               | Available?                                                                    | Source                                                                                                                                                                         | Update frequency                                                                 | Usable?                                            |
| ------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| Players standing per team             | yes                                                                           | `Team.standingPlayerCount` (alive + knocked + disconnected) `standings.ts:127`; Manual = `aliveCount`                                                                          | PCOB poll 1 s (`PCOB_POLL_INTERVAL_MS`, upstream ~2 s); Manual on operator input | **yes** (core input)                               |
| Knocked state                         | PCOB only                                                                     | `Player.liveState` 4 (`payload.ts:12-20`)                                                                                                                                      | as above                                                                         | not in baseline (Manual cannot provide it)         |
| Health                                | PCOB only                                                                     | `Player.health`                                                                                                                                                                | as above                                                                         | no (Manual synthetic 100/0; no calibration)        |
| Team eliminations                     | yes                                                                           | `Team.eliminations`                                                                                                                                                            | as above                                                                         | not in baseline (strength proxy needs calibration) |
| Total / match points                  | yes                                                                           | `Team.totalPoints`                                                                                                                                                             | as above                                                                         | **no** — points do not affect survival             |
| Placement                             | yes                                                                           | `Team.placement` (final or fallback order)                                                                                                                                     | as above                                                                         | only for eliminated teams (OUT label)              |
| Damage, knocks feed, location, circle | **no** (PCOB API has some, not mapped; `specs/PCOB-API.md:356-374, 420, 489`) | —                                                                                                                                                                              | —                                                                                | no                                                 |
| Snapshot freshness                    | yes                                                                           | `ingest.state` (`connected/stale/disconnected`), stale after 10 s (`match-store.ts:83`), `revision`, `generatedAt`                                                             | 1 s check                                                                        | yes (stale handling)                               |
| Match identity / phase                | yes                                                                           | `match.matchId`, `match.phase`                                                                                                                                                 | per snapshot                                                                     | yes (reset per match)                              |
| Historical outcomes with live states  | **no**                                                                        | live telemetry is memory-only (ADR-0004); 0 closed maps in production; `.pre-restore-snapshot.zip` has 2 manual test maps with 0 eliminations; no PCOB time series in the repo | —                                                                                | **0 usable matches**                               |

### 7.2 Candidate models

|                              | Model                                                                           | P(team i is WWCD)                                                   | Basis                                                                                                                                                                                                                                                                                                               | Verdict                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **U** (recommended baseline) | uniform last survivor                                                           | `nᵢ / N` (nᵢ standing players of team i, N = Σ over standing teams) | Exact if each elimination removes a uniformly random standing player: the removal order is a random permutation, so the last survivor is uniform over the current N players [R: urn argument, math.stackexchange 3511828]. Parameter-free; 0 for wiped teams; 1 when one team remains; equal inputs → equal shares. | Transparent, testable, works in Manual and PCOB. **Not calibrated** (no data); must be labelled as a model.        |
| **S** (alternative)          | random shooter → random enemy (stochastic Lanchester / "OK Corral" for 2 teams) | exact dynamic program over ≤ 5⁴ states                              | Kingman 1999 for 2 teams [R]; multi-team generalisation is our construction [I]. Bigger squads win more than proportionally.                                                                                                                                                                                        | Transparent but more aggressive; equally uncalibrated.                                                             |
| **E**                        | eliminations as strength (Luce/Plackett–Luce weights)                           | softmax/Luce over `f(elims) × players`                              | Needs a fitted parameter; softmax/Luce has IIA, cannot express who is fighting whom [R].                                                                                                                                                                                                                            | Rejected until calibrated on data.                                                                                 |
| **B** (empirical)            | logistic / gradient boosting on live states                                     | learned                                                             | Literature (Dota 2 Hodge 2021; CS:GO Xenopoulos 2020; LoL/AWS) uses many live features and large datasets [R].                                                                                                                                                                                                      | **Not feasible now: 0 usable matches.** Possible later only after a recorder (separate approval; ADR-0004 change). |

Verified example outputs (exact DP, run in this audit) [P]:

| Standing players | Model U           | Model S                  |
| ---------------- | ----------------- | ------------------------ |
| 4, 3, 2, 1       | 40 / 30 / 20 / 10 | 58.2 / 26.4 / 11.4 / 4.0 |
| 4, 1             | 80 / 20           | 99.2 / 0.8               |
| 2, 2, 1          | 40 / 40 / 20      | 43.9 / 43.9 / 12.2       |
| 4, 2, 2          | 50 / 25 / 25      | 76.7 / 11.7 / 11.7       |
| 4, 4, 4, 4       | 25 each           | 25 each                  |

**Validation strategy (once data exists):** record (matchId, revision, time, per-team standing counts and eliminations) and the WWCD outcome; evaluate U vs S (and later E/B) with **Brier score and log loss**, reliability diagrams, splits **grouped by match and ordered in time** (no snapshot of a test match in training) [R: scikit-learn calibration & CV docs, Hyndman FPP3, Guo 2017]; stratify by number of standing teams. With fewer than a few hundred matches only Platt/temperature-style calibration is defensible [R: scikit-learn]. Until then the display must say it is a model estimate.

### 7.3 Exactly 100% — rounding

Largest remainder (Hamilton) method [R: Wikipedia, Stack Overflow 13483430]: `Pᵢ = 100·pᵢ`; take `⌊Pᵢ⌋`; distribute the missing `100 − Σ⌊Pᵢ⌋` points one each to the largest remainders; ties → larger raw value → lower `teamNo`. Every value is the floor or ceiling of its exact share, never negative, never > 100, total exactly 100. Under Model U with ≤ 16 players every standing team has ≥ 6.25 % → never rounds to 0. (Model S can produce < 0.5 %; if S is chosen, show "<1%" only with an agreed rule — §21 Q9.)

### 7.4 Prediction set and data quality

- Set = standing teams of the locked Final 4 cohort (`selectFinalFourCohort`, `broadcast-state.ts:129-202`); eliminated cohort cards show **OUT #n**, not 0 %.
- If any appeared team has unknown status (no players in the snapshot — the same rule as the Part 9 WWCD resolver), **no team gets a number**: all cards show "Estimate unavailable". Probability is never redistributed silently.
- `ingest.state` `stale`/`disconnected` → values held, dimmed, label "DATA STALE"; no recomputation from old data.

### 7.5 Lifecycle

- Pure function of `(matchId, cohort, standing counts)`, memoised: identical inputs give identical output, so duplicate snapshots cannot flicker; snapshots are only re-broadcast when the change key differs (`live-hub.ts:260-266`). No polling added.
- Recomputes only when a standing count changes (an elimination). Number change tweened ≤ 400 ms, bar width animated; tabular numerals and fixed widths → no layout shift.
- Final 4 is visible only for 2–4 standing teams (`resolveLeaderboardLayoutMode`, `broadcast-state.ts:86-116`). When the live WWCD becomes `provisional`, the layout switches to the WWCD screen and Final 4 hides; the prediction stops updating at that moment (frozen internally, never shown as a result). Recommended: keep this (§21 Q12).
- New `matchId` → state reset; restart of the same match id → recomputed from the current snapshot.

### 7.6 Toggle per instance

`showWwcdPrediction: boolean` (zod `.default(false)`) in the shared appearance schema; editor toggle shown only for `final4` instances; route body carries the stored value over when a stale admin omits it (Part 8 guard pattern, `routes/config.ts`). Default OFF → the card renders exactly as today (no reserved space). No `PROTOCOL_VERSION` change (config travels on the overlay message; old overlays ignore the unknown field); no `CONFIG_SCHEMA_VERSION` change.

### 7.7 Visual (prototype `Attachments/Part 10 Prototypes/final4-prediction.png`)

A 30 design-px strip under each card: small label "WIN CHANCE · MODEL", a thin zero-based bar, integer % right-aligned (17 px, lighter than the team name). **Integration risk found [P]:** the Final 4 bar ends at y = 141.5 px (cards 46.5–141.5) and the elimination banner moves to `u(164)` in Final-4 mode (`EliminationOverlay.tsx:44`), leaving 22.5 px. A 30 px strip would overlap the banner by ~7.5 px, and the elimination overlay cannot see the Final 4 instance's toggle (each overlay receives only its own instance config). Options in §21 Q11.

---

## 8. Integration audit

| Interaction                     | Finding / rule                                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Last vs current match           | Top Kill / Most Improved read **closed maps only**; the live map never feeds them. Prediction reads only the live match.                                                                                                  |
| Manual vs PCOB                  | Same closed-map model; prediction Model U works in both (Manual standing = `aliveCount`).                                                                                                                                 |
| Team Order vs identity          | `teamNo` is the only id; snapshot names are used for history; renumber inside a Most Improved range is detected via snapshot-name change.                                                                                 |
| Corrections                     | Top Kill and Most Improved re-derive from current closed maps; nothing is stored, nothing historical is rewritten by opening an overlay.                                                                                  |
| Overlay instances / ON AIR      | Two new types with operator ON AIR; Final 4 prediction is a per-instance toggle; no change to States A–D.                                                                                                                 |
| Admin preview vs browser source | Same `OverlayPage`; preview shows saved settings (ADR-0013).                                                                                                                                                              |
| Old schema / old clients        | New appearance fields default; new overlay types are additive enum values. **Downgrade risk:** an older app version would reject an `overlay-instances.json` containing the new types (zod enum) — document in CHANGELOG. |
| Seeding                         | `migrateOverlayInstances` seeds default instances only for `version < 5` (`migrations.ts:137-170`) → existing installs would not get `top-kill`/`most-improved` defaults (§21 Q14).                                       |
| Elimination banner              | conflicts with the prediction strip (§7.7).                                                                                                                                                                               |

---

## 9. Research summary (full notes with URLs: Obsidian `Research/Part 10 Research Sources.md`)

- **Platform:** MDN CSS animation tips (restart behaviour); React docs (keys reset state) — used to rule out remount causes.
- **Broadcast references:** OGN PUBG league scoreboard (Idonix) — number in its own high-contrast cell, density over decoration; LoL Worlds 2024 Global Power Rankings "Where They Stand" and its **"Biggest Mover"** highlight — precedent for Most Improved; Riot/AWS live win probability (narrative tool, 2-team only); ESPN MLB win-probability bug — **integer %, sums to 100, secondary to the score**; PUBG Esports recaps report kills next to points/WWCD; FT Visual Vocabulary (ranking, slope for rank change, deviation bars); CDC bump chart guidance.
- **Probability:** Hodge et al. 2021 (Dota 2 live prediction), Xenopoulos et al. 2020 (CS:GO WP: players remaining + HP; Brier/log loss/AUC; calibration curves), Kaggle/Rokad PUBG placement (post-match stats, not live), Sagong & Kim 2025 (survival sequences), Guo et al. 2017 (calibration, temperature scaling), scikit-learn calibration and CV, Hyndman FPP3 rolling origin, Brier score, Bradley–Terry/Plackett–Luce and IIA, Kingman 1999 (OK Corral), urn last-survivor argument; Westwood et al. 2020 and The Atlantic 2024 on how audiences misread win %; Kay 2016 / Fernandes 2018 on frequency framing.
- **Rounding:** largest remainder (Hamilton) method; Stack Overflow 13483430.
- Gaps: no primary source for an F1/football "positions gained" graphic; PMGC/PMPL in-broadcast "top fragger"/prediction graphics and Behance galleries not viewed; three papers read as abstracts only.

## 10. Design skills — evaluation and how they shaped decisions

| Skill                                                                        | Source / install / scripts                                                                                                                                                                                                                                                                                                                          | Applied                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **frontend-design** (anthropics/skills)                                      | `SKILL.md` + licence only; no scripts or dependencies; no version field, last change 2026-09-03; install `npx skills add https://github.com/anthropics/skills --skill frontend-design`. Not installed (no need; read from source).                                                                                                                  | "Spend boldness in one place" → only Top Kill #1 gets the giant numeral; Most Improved puts boldness in the 18 → 5 pair, not a single big number. "Structure is information" → the bar, rail and TIED tag each encode data. "One orchestrated moment" → one entrance per screen. Its warnings against the big-number hero and all-caps labels are deliberately overridden **only** where broadcast vernacular requires them (team names and titles in caps, matching existing overlays); captions/footnotes use sentence case. Avoided gradient washes, zero-offset glows, identical-card kits. |
| **ui-taste** (uizze.sh, v0.3.0, Apache-2.0; adapted from pbakaus/impeccable) | Markdown playbooks, states it runs no scripts and needs no dependency; install via `npx skills add https://uizze.sh/` (skills CLI sends telemetry unless disabled). Not installed. Its "image first" step needs an image-generation tool, which this environment does not have → disclosed; HTML prototypes rendered in Chromium were used instead. | Tabular numerals for every compared number; never colour alone (▲ + sign, "TIED", "OUT #4", "DATA STALE" in words); covered states (empty, unavailable, stale, preview, error); "don't imply interpolation is measurement" → no count-up animations of kill counts or ranks; motion must be interruptible/reversible → Issue A retargeting rule.                                                                                                                                                                                                                                                |

Neither skill is available through this agent's skill mechanism; their instructions were read from the original sources and applied manually.

## 11. Design exploration

**Top Kill** (all 1920×1080, existing espresso/gold/ivory tokens, overlay font):

| Concept                              | Description                                                                | Readability                | Long names / logos                                 | Balance                    | Motion                                                 | Risk                                      |
| ------------------------------------ | -------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------- | -------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| TK-1 Ranked ladder                   | 4 full-width rows, #1 tallest, kill count in a contrasting cell (OGN)      | fastest scan               | good (wide name column)                            | even, little hierarchy     | rows resolve #4→#1                                     | looks like a table; weak "achievement"    |
| **TK-2 Hero + ladder (recommended)** | #1 hero block with oversized numeral; #2–#4 compact rows + zero-based bars | #1 instantly; others clear | hero name wraps to 2 lines; rows marquee if needed | strong single focal point  | rows slide in, then hero numeral settles (no count-up) | one bold element — matches skill guidance |
| TK-3 Proportional bars               | 4 horizontal bars scaled to kills                                          | shows margins best         | names compete with bars                            | flat                       | bars grow once                                         | bars dominate, numbers smaller            |
| TK-4 Podium                          | 2-1-3 podium + 4th aside                                                   | dramatic                   | narrow columns hurt long names                     | symmetric but 4th orphaned | podium rise                                            | weakest for 4 items and ties              |

**Most Improved:**

| Concept                                 | Description                                                                                           | Pros                                                                                  | Cons                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| MI-1 Slope chart                        | two rank columns (after A / after B), lines for top movers, hero line accented (FT slope, bump chart) | honest, shows context                                                                 | small text for 4+ lines; less hero moment                            |
| **MI-2 Hero + rank rail (recommended)** | identity, "18 → 5", "▲ 13 places up", vertical rail 1…N with both endpoints; 3 runners-up             | clearest story; visually distinct from Top Kill (vertical ascent vs number dominance) | rail needs N (team count) — known from standings                     |
| MI-3 Diverging bars                     | top movers as bars right of a zero line                                                               | compares several movers                                                               | reads like points; risks the rank/points confusion the brief forbids |

Prototypes of the recommended concepts were rendered (not production code) and saved to the vault: `Attachments/Part 10 Prototypes/{topkill,mostimproved,final4-prediction}.{html,png}`.

## 12. Routing, API, persistence, schema

| Change                                                                                                | Where                                                                                                                                                        | Compatibility                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overlay types `top-kill`, `most-improved`                                                             | `shared/src/config/overlay-instance.ts` (`overlayTypeSchema`, `DEFAULT_INSTANCE_ID_BY_TYPE`, `defaultAppearanceForType`, `DEFAULT_OVERLAY_INSTANCES`)        | additive; downgrade-incompatible (old enum)                                                                                                                                                           |
| Appearance fields `topKillMatchSelection`, `mostImprovedFrom`, `mostImprovedTo`, `showWwcdPrediction` | same schema, zod defaults                                                                                                                                    | old files parse; stale-admin carry-over in `routes/config.ts`                                                                                                                                         |
| Seeding defaults for existing installs                                                                | `backend/src/persistence/migrations.ts`                                                                                                                      | §21 Q14 (recommended: version-gated v5→v6 step that only appends the two new default instances when no instance of that type exists; migration test on a copy of production `overlay-instances.json`) |
| Routes                                                                                                | `frontend/src/router.tsx`, `OverlayRoute.tsx`, `OverlayPage.tsx` (surface mode, default id, title, render branch)                                            | none                                                                                                                                                                                                  |
| Admin                                                                                                 | `overlay-types.ts`, `AdminPage.tsx` (groups, OBS URLs), `OverlayPreview.tsx`, `AppearanceEditor.tsx` (map selectors, prediction toggle, validation messages) | none                                                                                                                                                                                                  |
| Selectors                                                                                             | `broadcast-state.ts` (`selectTopKill`, `selectMostImproved` with a closed-maps-only standings option), new `wwcd-prediction.ts` (Model U, LRM rounding)      | pure functions                                                                                                                                                                                        |
| Snapshot / protocol                                                                                   | unchanged                                                                                                                                                    | no bump                                                                                                                                                                                               |
| Backend API                                                                                           | unchanged (all derived from `closedMaps` and live snapshot)                                                                                                  | —                                                                                                                                                                                                     |

## 13. Test matrix

**Issue A** (unit + scripted browser): ON/OFF; repeated Saves; Save mid-transition; short and very long names; marquee needed / not needed; hidden → ON AIR (`wipe`, `zoom-fade`, `slide`, `fade`); font delayed 3 s and fallback; 1920×1080, 1280×720, 1366×768, 2560×1440; scale 0.7/0.85/1/1.15; admin preview iframe; 22 marquees frame pacing; mount/unmount; reduced motion (overlay ignores, admin respects); left and right anchor; rank change during/after transition; regression of all entrance animations.

**Top Kill** (unit on selector + render + browser): varied kills; all 0; < 4 qualifying; tie at 4th; many ties; tie at #1; rename after match (snapshot name kept); renumber after match; no logo; pinned map; pinned map deleted; corrected map; Manual vs PCOB maps; no closed map; live map ignored; additional points ignored.

**Most Improved:** 18 → 5 (+13); unchanged; dropped; tied improvement; valid ranges 1→2, 2→3, 1→3; reversed/equal range; missing map; team new after start; renumber inside range; rename; correction to an earlier map; no climber; < 2 closed maps; rank-vs-points divergence fixture (team gains most points but not most places); live-appeared teams excluded.

**WWCD Prediction:** distinct counts (4/3/2/1 → 40/30/20/10); identical counts; 2-team and 3-team states; elims/points differences do **not** change Model U; unknown-status team → unavailable; stale → held + label; missing data; duplicate snapshots (same output object); no new events; match restart; new matchId reset; provisional WWCD → Final 4 hides, no recompute; toggle OFF (layout identical to today — DOM snapshot); toggle ON in one instance only; old overlay ignoring field; LRM property test (random inputs: sum = 100, each within ±1 of exact, none < 0 or > 100); extreme inputs (0 players, N = 0 → unavailable); deterministic tie-break.

**Regression:** full suites, typecheck, lint, format check (repo files only), build, migration tests on a temp copy of production config, browser checks of every existing overlay, persistence after refresh and server restart, production hashes unchanged.

## 14. Acceptance criteria

- **A:** §4.5 A-1…A-12 measured on both surfaces; A-13 by the operator.
- **B:** selection rule §5.2 exactly (unit fixtures); hero numeral ≥ 200 design px; every name fully readable (wrap in hero, marquee in rows); identity from snapshots; empty/unavailable states render; no console errors; 1920×1080 screenshot reviewed.
- **C:** formula §6.2 on fixtures incl. 18 → 5 = +13; range validation messages; eligibility table §6.3; result unchanged by refresh (deterministic); no write to any data file when the range changes (hash check).
- **D:** Model U outputs equal the table in §7.2; displayed % sum to exactly 100 in every tested state; no number when data is unknown or stale; OFF renders the current card unchanged; prediction never overlaps the elimination banner (geometry check); updates only on standing-count change (render count test).
- **All:** full gates green; production data hashes unchanged; Obsidian updated.

## 15. Risks and mitigations

| Risk                                              | Mitigation                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Width animation costs layout per frame in OBS     | measure A-11; fallback A2 (compositor FLIP)                                                                       |
| Marquee thrash during transition                  | freeze decisions while settling (A-5)                                                                             |
| Audience reads the % as fact                      | "MODEL"/"estimate" label, integers, no live graph, hides at WWCD; Model U assumption documented in the user guide |
| Uncalibrated model                                | explicit; recorder + Brier evaluation as a later, separately approved step                                        |
| Prediction strip collides with elimination banner | §21 Q11 decision before implementation                                                                            |
| Renumber corrupts history comparisons             | snapshot-name check; exclusion + warning                                                                          |
| New overlay types break downgrade                 | CHANGELOG upgrade note; backup before upgrade                                                                     |
| Seeding migration repeats the ADR-0015 incident   | version-gated, append-only, tested on a copy of production config                                                 |

## 16. Files expected to change (after approval)

- `frontend/src/components/overlay/`: `LeaderboardOverlay.tsx`, `OverflowMarquee.tsx`, `useTeamNameLayout.ts`, `TeamRow.tsx` (if needed), `broadcast-state.ts`, `FinalFourOverlay.tsx`, `EliminationOverlay.tsx` (Q11), new `TopKillOverlay.tsx`, `MostImprovedOverlay.tsx`, `wwcd-prediction.ts`, tests.
- `frontend/src/pages/{OverlayPage,OverlayRoute,AdminPage}.tsx`, `frontend/src/router.tsx`, `frontend/src/features/admin/{AppearanceEditor.tsx,OverlayPreview.tsx,overlay-types.ts}`.
- `shared/src/config/overlay-instance.ts`; `backend/src/routes/config.ts`; `backend/src/persistence/migrations.ts` (Q14) + tests.
- Docs: this file (implementation report section later), ADR-0020 (WWCD prediction model and its limits), `CHANGELOG.md`, user guides en/hu, `docs/checkpoint.md`, `docs/progress.md`.

## 17. Implementation order (after approval)

1. WS-10.1 Issue A transition + marquee freeze (measure A-criteria before/after).
2. WS-10.2 shared schema + seeding + routes + admin scaffolding for the two overlay types.
3. WS-10.3 Top Kill selector + overlay.
4. WS-10.4 Most Improved selector + overlay + range editor.
5. WS-10.5 WWCD prediction model + Final 4 strip + elimination clearance.
6. WS-10.6 regression, browser matrix, docs, Obsidian.

## 21. Questions for the user

| #   | Question                                                                                                                                                                                                                                                                 | Recommendation                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Q1  | Issue A motion: panel width animates ~400 ms ease-in-out with background and rows moving as one piece; first load and font load snap. OK?                                                                                                                                | Yes                                                             |
| Q2  | ON → OFF: keep full names clipped while shrinking and switch to `…` at the end?                                                                                                                                                                                          | Yes                                                             |
| Q3  | Top Kill "last match" = last **closed** map (with optional pin), never the running map?                                                                                                                                                                                  | Yes (kills on a running map can still change)                   |
| Q4  | Tie at the 4th place: show exactly 4 cards (tie-break elims → better placement → slot), shared rank numbers + TIED tag + "N more teams also on X" footnote? Or expand beyond 4?                                                                                          | Exactly 4 + footnote                                            |
| Q5  | Most Improved rank = official overall series standings chain (points → WWCD → placement pts → kill pts → last placement → slot), not the live tower order?                                                                                                               | Series chain                                                    |
| Q6  | Most Improved display: one hero + up to 3 "also climbing", or a single team only?                                                                                                                                                                                        | Hero + 3                                                        |
| Q7  | A team whose recorded name changes for its slot inside the range (possible renumber): exclude with an admin warning, or include with a warning?                                                                                                                          | Exclude + warning                                               |
| Q8  | Range defaults `previous → latest`, both pinnable per instance?                                                                                                                                                                                                          | Yes                                                             |
| Q9  | Prediction model: **U** (players-standing share, provable under a stated assumption, not calibrated), **S** (squad-strength, more aggressive), or **wait** until a recorder has collected matches for calibration?                                                       | U now, labelled as model; recorder as a separate later proposal |
| Q10 | Count knocked/disconnected players as standing (same as alive bars and the WWCD resolver)?                                                                                                                                                                               | Yes                                                             |
| Q11 | Prediction strip below the card (+30 px) requires moving the elimination banner in Final-4 mode from `u(164)` to about `u(194)` for every instance (Part 6 positioning change). Alternatively a compact in-card variant (no height change, % in the lower strip). Which? | Strip below + banner `u(194)`                                   |
| Q12 | When WWCD is confirmed the Final 4 hides (WWCD screen takes over), so the prediction is never shown as a final result. Keep?                                                                                                                                             | Keep                                                            |
| Q13 | Label wording: "WIN CHANCE · MODEL", "WWCD CHANCE (EST.)", or other?                                                                                                                                                                                                     | "WIN CHANCE · MODEL"                                            |
| Q14 | Give existing installs default `top-kill` / `most-improved` instances via a version-gated v5 → v6 seeding step, or let operators create them in the admin?                                                                                                               | v6 seeding step (tested on a copy)                              |
| Q15 | Top Kill and Most Improved go on air only by operator (ON AIR), no automatic trigger?                                                                                                                                                                                    | Yes                                                             |

## 22. Obsidian and next step

Progress, evidence and open questions are logged in the vault session note (timestamps UTC+07:00); research sources in `Research/Part 10 Research Sources.md`; prototypes in `Attachments/Part 10 Prototypes/`. **Next step: wait for explicit approval of this proposal and answers to Q1–Q15. No implementation before that.**

## 23. Approval record (2026-10-23)

The user approved all 15 recommendations of §21 and gave **approval to implement Part 10**, with these conditions:

- **Issue A:** ~400 ms panel-width transition with panel and rows moving together; no animation on initial load and font load; scrolling decisions frozen during the transition (no name may start and stop scrolling mid-transition); `…` shown only after the panel has finished shrinking; all unrelated behaviour preserved.
- **Top Kill:** data only from the last closed map (no pin); at most four cards; order eliminations → placement → slot; `TIED` tags; extra teams tied at the 4th place go in a footnote; clear empty state when all teams have 0 eliminations; manual ON AIR only.
- **Most Improved:** `improvement = start rank − end rank` on the official series standings of closed maps; one hero + three runners-up; teams that first played after the start match excluded; teams whose identity/numbering cannot be verified safely inside the range excluded with an informative warning; default range previous → latest, editable and pinnable per instance; validation of range, data and the no-eligible-team case; manual ON AIR only.
- **WWCD Prediction:** Model U (`standing players of the team / verified total standing players`); largest remainder to exactly 100%; label `WIN CHANCE · MODEL` with a short note that it is an estimate from players still standing, not a calibrated empirical model; knocked/disconnected count as standing while the source has not eliminated them; incomplete, stale, conflicting or insufficient data never shown as valid numbers; no silent redistribution; per-instance Final 4 toggle; updates on live changes and stops once WWCD is confirmed; Final 4 stays hidden after WWCD.
- **Layout/config:** prediction strip below the Final 4 cards and elimination banner moved to `u(194)` (no overlap at any resolution or player count); default Top Kill / Most Improved instances via a v5 → v6 migration tested (migration, old configs, rollback) on copies first; existing instances preserved; no destructive migration; no historical telemetry recording in this part.

## 24. Implementation report (2026-10-23)

### 24.1 What was built

| Area            | Delivered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Issue A         | `LeaderboardOverlay`: CSS `width` transition 400 ms `cubic-bezier(0.45, 0, 0.55, 1)` on the panel; a left-anchored panel's position (`left`) transitions in step (`OverlayPage`). Transition derived during render (state-from-props) so the first render of a new layout already holds marquee decisions and, when leaving extended mode, the full-name rows (`…` appears only after `transitionend`). Width snaps on first paint, until `document.fonts.ready` + 2 frames, on font-load re-layouts (`TeamNameLayout.instant`) and on remount (HIDE → ON AIR). `OverflowMarquee` gained `frozen` (ignores `ResizeObserver` while true, re-measures once after); also frozen until the first real measurement (`TeamNameLayout.measured`). |
| Top Kill        | `top-kill.ts` (`selectTopKill`), `TopKillOverlay.tsx`; route `/overlay/top-kill`, `/overlay/<id>/top-kill`, `/top-kill`; last closed map only; max 4; competition ranks + `TIED`; cutoff footnote; empty states; operator ON AIR only (default instance `default-top-kill`, `onAir: false`).                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Most Improved   | `most-improved.ts` (`resolveMostImprovedRange`, `selectMostImproved`), `MostImprovedOverlay.tsx`; ranks from `selectSeriesStandings` on closed-map prefixes with no live teams; range per instance (`mostImprovedFrom` `'previous'`/id, `mostImprovedTo` `'latest'`/id) edited in the admin with validation and the excluded-teams list; identity guard on snapshot names; preview shows real data once two maps exist.                                                                                                                                                                                                                                                                                                                    |
| WWCD Prediction | `wwcd-prediction.ts` (Model U, largest remainder), `FinalFourOverlay` strip (`ub(30)`) + note, per-instance `showWwcdPrediction` (default off, admin toggle for Final-4); ADR-0020. Elimination banner Final-4 position `ub(194)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Config v6       | `CONFIG_SCHEMA_VERSION` 6; `migrateOverlayInstances` seeds only the two new types into v5 documents (append-only, never replaces an id/type), keeps a stored `dual` WWCD variant (the old rule would have reset it — production uses `dual`); `JsonDocument` keeps `<file>.v<old>.bak` once before an upgrade rewrite. `PROTOCOL_VERSION` unchanged (11). Stale-admin carry-over for the three new appearance fields (`routes/config.ts`).                                                                                                                                                                                                                                                                                                 |
| Admin           | `overlay-types`, AdminPage group _Broadcast Statistics_ + OBS URLs 9/10, preview view modes, AppearanceEditor (prediction toggle, Top Kill source note, Most Improved range editor).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### 24.2 Deviations from the proposal

1. Easing `cubic-bezier(0.45, 0, 0.55, 1)` instead of `(0.4, 0, 0.2, 1)`: the latter measured 10.9 px max per-frame step for 96 px (criterion A-3 ≤ 10 px); the symmetric curve measures 7.25 px.
2. Top Kill has no pin option (user decision 6: last closed map only).
3. Elimination banner uses base units `ub(194)` (not `u(194)`): with `u()` an elimination instance scaled below ~0.88 would overlap the cards; measured gap now constant at 22.5 design px for banner scales 0.7/1/1.15.
4. `migrateOverlayInstances` `dual` preservation and `JsonDocument` pre-upgrade copies were added because the v6 bump would otherwise have reset production's Dual WWCD setting and made rollback impossible.
5. Most Improved preview: sample only while fewer than two maps are closed (real data otherwise), so preview equals broadcast.

### 24.3 Verification (all run on 2026-10-23)

| Gate                              | Result                                                                                                                                                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend tests                     | **351/351** (27 files; baseline 343). New: v5→v6 migration (5), pre-upgrade copy (2), config carry-over/per-instance toggle (1).                                                                                                                                        |
| Frontend tests                    | **241/241** (20 files; baseline 178). New: Top Kill (17), Most Improved (25), WWCD prediction (21 incl. 2 000-case rounding property test); banner test updated to `ub(194)`.                                                                                           |
| Typecheck / lint / format / build | 0 errors / no diagnostics / clean / OK (known chunk warning)                                                                                                                                                                                                            |
| Note                              | On this machine the default parallel backend run hit worker out-of-memory crashes several times while browsers/agents were running; the same suite passes 351/351 with `--maxWorkers=2` and passed 351/351 in one default run earlier. Environment, not a test failure. |

Browser (headless Chromium, built app, temp copy of `backend/data`):

| Check                                    | Result                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1/A-2 duration, frames                 | 350–400 ms, 22–25 changed frames (all 16 viewport×scale cases and both surfaces)                                                                                                                                                                                           |
| A-3 max step (96 px)                     | 7.25 px (standalone), 7.3 px (preview); 3.05 px for 40 px                                                                                                                                                                                                                  |
| A-4 rows vs background                   | 0 px deviation; right edge drift 0 (right anchor), 0.02 px (left anchor)                                                                                                                                                                                                   |
| A-5 marquee flips during transition      | 0 in every run (was 5 with the naive prototype)                                                                                                                                                                                                                            |
| A-6 marquee start after settle           | 16–17 ms                                                                                                                                                                                                                                                                   |
| A-7 stable                               | 418–449 ms from the config write (preview via real Save button: 674–701 ms incl. click and save round-trip)                                                                                                                                                                |
| A-8 first load / fonts                   | font delayed 3 s: one 10 px snap, no animation; HIDE → ON AIR: 0 width frames, 0 flips (all four entrance types; layout width constant)                                                                                                                                    |
| A-9 interruption                         | ON then OFF after 150 ms: max step 7.19 px, ends at 340 px                                                                                                                                                                                                                 |
| A-10 matrix                              | 1920×1080, 1280×720, 1366×768, 2560×1440 × scale 1/0.85/1.15/0.7: 0 failures, 0 clipped/stuck names                                                                                                                                                                        |
| A-11 pacing                              | 20 marquees running during a transition: p50 16.7, p95 16.9, max 17.1 ms                                                                                                                                                                                                   |
| A-12 regression                          | rank change still slides (`translateY` 1056 → 0 in ~480 ms, x = 0)                                                                                                                                                                                                         |
| Top Kill                                 | hidden until ON AIR; no map → "No finished match yet"; tie at 4th → `TIED` + "2 more teams also on 2 eliminations"; running map with 12 live kills ignored; all-zero map → empty state; correction of the last map updated the hero live; 2 candidates → hero + 1 row only |
| Most Improved                            | default Match 2 → 3: T20 11 → 1 (▲10); pinned 1 → 3: T08 25 → 10 (▲15) + 3 climbers; reversed range and missing pinned id → "Comparison unavailable" with reason; renamed slot excluded with on-air note and admin warning; admin range editor saves; preview = broadcast  |
| Prediction                               | 4/3/2/1 → 40/30/20/10 (sum 100); after an elimination 45/33/22/OUT #4; 4 vs 3 → 57/43; 1 vs 3 → 25/75; sole survivor → Final 4 hidden; next match reset; 4/4/2/1 → 37/36/18/9 (deterministic tie); toggle OFF → no strip, card bottom back to 141.5 px                     |
| Banner clearance                         | Final 4 with strip ends at 171.5 design px, banner at 194: gap 22.5 design px (14.4 px at 1280×720, 30.7 px at 2560×1440) for banner scale 0.7/1/1.15                                                                                                                      |
| Migration on a copy of production config | v5 → v6, 8 instances unchanged + `default-top-kill`, `default-most-improved` (hidden), `dual` kept; `.v5.bak` files byte-identical to production originals                                                                                                                 |
| Rollback                                 | previous release (`4893dc6`, built in a temp folder) refuses v6 `overlay-instances.json` with a clear error; after restoring the `.v5.bak` files it starts normally                                                                                                        |
| Persistence                              | after restart: pinned range, ON AIR states and toggle persisted                                                                                                                                                                                                            |
| Production data                          | `backend/data/*.json` SHA-256 unchanged; no `.bak` written there                                                                                                                                                                                                           |

Not verified: OBS Browser Source (not available); stale/disconnected and conflicting-data prediction states in a browser (unit-tested only — Manual mode never goes stale and conflicts cannot be produced through the Manual UI); a second Final 4 instance in the browser (per-instance persistence covered by the config route test).

### 24.4 Remaining risks

- The WWCD estimate is uncalibrated by design (ADR-0020); equal teams can show a 1-point difference.
- Downgrade requires restoring the `.v5.bak` files (documented in CHANGELOG).
- The title and footnotes of Top Kill / Most Improved sit on the transparent canvas with a dark text shadow; legibility over very bright footage should be checked in OBS.
