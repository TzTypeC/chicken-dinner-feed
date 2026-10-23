import {
  additionalPointsOf,
  type AutoWwcdVariant,
  type ClosedMapResult,
  type ClosedMapTeamResult,
  type MatchState,
  type OverlayAppearance,
  type Team,
} from '@cdf/shared';
import { findClosedMapForMatch, resolveClosedWwcd, resolveLiveWwcd } from './wwcd-resolver';

export type LeaderboardLayoutMode = 'tower' | 'final-four' | 'wwcd';

export interface WwcdVariantLatch {
  matchId: string | null;
  variant: AutoWwcdVariant;
}

/**
 * Resolves the effective automatic WWCD variant (`D-PMCC-08`), latching the chosen variant while
 * a live WWCD presentation (`layoutMode === 'wwcd'`) is active so changing the preference mid-WWCD
 * never triggers a new victory animation mid-celebration.
 */
export function resolveActiveAutoWwcdVariant(
  layoutMode: LeaderboardLayoutMode,
  matchId: string | null,
  configuredVariant: AutoWwcdVariant,
  currentLatch: WwcdVariantLatch | null,
): { effectiveVariant: AutoWwcdVariant; nextLatch: WwcdVariantLatch | null } {
  if (layoutMode !== 'wwcd') {
    return { effectiveVariant: configuredVariant, nextLatch: null };
  }
  if (currentLatch && currentLatch.matchId === matchId) {
    return { effectiveVariant: currentLatch.variant, nextLatch: currentLatch };
  }
  const nextLatch: WwcdVariantLatch = { matchId, variant: configuredVariant };
  return { effectiveVariant: configuredVariant, nextLatch };
}

export interface FinalFourCardItem {
  team: Team;
  /**
   * True when this squad is part of the Final-4 cohort but has since been eliminated (i.e. when
   * 3 or 2 squads remain alive). Its card stays in the 4-column top bar in a grayed-out state
   * (`D-PMCC-02` / `A1`).
   */
  isKnockedOut: boolean;
  /** Final match placement if already eliminated (e.g. 4 or 3). */
  eliminatedPlacement: number | null;
}

export interface WwcdWinnerSummary {
  teamNo: number;
  name: string;
  logoUrl: string | null;
  eliminations: number;
  killPoints: number;
  placementPoints: number;
  /** Single-match total points (`killPoints + placementPoints`, plus any adjustment once recorded). */
  matchPoints: number;
  /** Cumulative tournament points. */
  seriesPoints: number;
  /** Players still standing; `null` when the squad's live state is not known (a historical map). */
  aliveCount: number | null;
  players: Team['players'];
  /**
   * True while the map is not closed: the team is the confirmed last one standing, but the result
   * is not recorded yet and its points can still change. Final once the map is closed.
   */
  provisional: boolean;
  /** `preview` marks the admin-preview sample, which is not a result. */
  sourceKind: 'live' | 'closed-map' | 'preview';
}

/**
 * Determines which layout the main leaderboard surface (`/overlay/:instanceId`) should display.
 *
 * Strictly guards against false transitions during warmup (`match.phase === 'idle'`) or early lobby
 * loading before any squad has been eliminated (`eliminatedCount === 0`).
 *
 * Per `D-PMCC-02` (`A1`):
 * - Activates `'final-four'` when `2 <= standingTeams.length <= 4` and `eliminatedCount >= 1`.
 * - Reverts to `'tower'` only when `standingTeams.length >= 5` (or warmup / new match).
 * - Transitions to `'wwcd'` when `standingTeams.length === 1` and `eliminatedCount >= 1`.
 */
export function resolveLeaderboardLayoutMode(
  match: MatchState,
  appearance: Pick<OverlayAppearance, 'showFinalFourLayout' | 'showWwcdOverlay'>,
  previewOverride?: LeaderboardLayoutMode | null,
): LeaderboardLayoutMode {
  if (previewOverride) return previewOverride;

  if (match.phase === 'idle') return 'tower';

  const appearedTeams = match.teams.filter((team) => team.hasAppeared);
  const standingTeams = appearedTeams.filter((team) => !team.isEliminated);
  const eliminatedCount = appearedTeams.filter((team) => team.isEliminated).length;

  // Must have at least one eliminated team so a lobby still loading players (1..4 teams joined,
  // 0 eliminated) never falsely triggers Final-4 or WWCD.
  if (eliminatedCount < 1) return 'tower';

  // Only a *confirmed* sole survivor starts the WWCD screen: a team whose status is unknown (no
  // players in this snapshot), nobody standing, or conflicting data must not (Part 9).
  const showWwcd = appearance.showWwcdOverlay ?? true;
  if (showWwcd && resolveLiveWwcd(match).state === 'provisional') {
    return 'wwcd';
  }

  const showFinalFour = appearance.showFinalFourLayout ?? true;
  if (showFinalFour && standingTeams.length >= 2 && standingTeams.length <= 4) {
    return 'final-four';
  }

  return 'tower';
}

/**
 * Builds the 4-squad cohort for the Final-4 horizontal top bar (`D-PMCC-02` / `A1`).
 *
 * When 4 squads are alive, returns those 4 squads.
 * When 3 or 2 squads remain alive, retains all 4 cards by keeping the eliminated 4th-place / 3rd-place
 * squad(s) in the cohort in a grayed-out knocked-out state (`isKnockedOut: true`).
 *
 * If `lockedCohortTeamNos` is provided (captured when the match first entered Final-4 with 4 alive
 * squads), those exact 4 squads are preserved in order so cards do not jump slots when a squad is
 * eliminated.
 */
export function selectFinalFourCohort(
  match: MatchState,
  lockedCohortTeamNos?: readonly number[] | null,
  isPreviewSimulation = false,
): FinalFourCardItem[] {
  const byTeamNo = new Map(match.teams.map((team) => [team.teamNo, team]));
  const appearedTeams = match.teams.filter((team) => team.hasAppeared);
  const standingTeams = appearedTeams.filter((team) => !team.isEliminated);

  // If we locked the 4 team numbers when Final-4 began and all 4 still belong to this match's
  // top-4 survivors/eliminated, preserve that exact 4-team cohort.
  if (lockedCohortTeamNos && lockedCohortTeamNos.length === 4) {
    const lockedTeams = lockedCohortTeamNos
      .map((no) => byTeamNo.get(no))
      .filter((team): team is Team => team !== undefined);

    const allStandingIncluded = standingTeams.every((alive) =>
      lockedCohortTeamNos.includes(alive.teamNo),
    );
    if (lockedTeams.length === 4 && allStandingIncluded && standingTeams.length <= 4) {
      return lockedTeams.map((team) => ({
        team,
        isKnockedOut: team.isEliminated,
        eliminatedPlacement: team.isEliminated ? (team.placement ?? null) : null,
      }));
    }
  }

  // Otherwise construct the 4-card cohort from currently standing teams + most recently eliminated
  // top-4 placement teams (or top 4 teams overall when simulating in Admin Preview).
  if (isPreviewSimulation && (standingTeams.length > 4 || standingTeams.length < 2)) {
    const sample = match.teams.slice(0, 4);
    return sample.map((team, index) => ({
      team,
      isKnockedOut: team.isEliminated || index === 3,
      eliminatedPlacement: team.isEliminated ? (team.placement ?? 4) : index === 3 ? 4 : null,
    }));
  }

  const chosen: Team[] = [...standingTeams.slice(0, 4)];
  if (chosen.length < 4) {
    const chosenNos = new Set(chosen.map((team) => team.teamNo));
    // Pick eliminated teams that finished in 3rd / 4th place (or highest ranked eliminated teams).
    const eliminatedCandidates = appearedTeams
      .filter((team) => team.isEliminated && !chosenNos.has(team.teamNo))
      .sort((a, b) => {
        const placeA = a.placement ?? 99;
        const placeB = b.placement ?? 99;
        if (placeA !== placeB) return placeA - placeB;
        return a.rank - b.rank;
      });

    for (const candidate of eliminatedCandidates) {
      if (chosen.length >= 4) break;
      chosen.push(candidate);
    }
  }

  // Fallback if fewer than 4 teams have appeared in a tiny test lobby: fill from roster.
  if (chosen.length < 4) {
    const chosenNos = new Set(chosen.map((team) => team.teamNo));
    for (const team of match.teams) {
      if (chosen.length >= 4) break;
      if (!chosenNos.has(team.teamNo)) chosen.push(team);
    }
  }

  return chosen.map((team) => ({
    team,
    isKnockedOut: team.isEliminated,
    eliminatedPlacement: team.isEliminated ? (team.placement ?? null) : null,
  }));
}

/**
 * A sample shown only in the admin preview when there is no result to show. It is deliberately not
 * a roster team: inventing a winner out of the standings is exactly what Part 9 removed.
 */
const PREVIEW_WINNER_SAMPLE: WwcdWinnerSummary = {
  teamNo: 0,
  name: 'PREVIEW SAMPLE',
  logoUrl: null,
  eliminations: 0,
  killPoints: 0,
  placementPoints: 0,
  matchPoints: 0,
  seriesPoints: 0,
  aliveCount: null,
  players: [],
  provisional: false,
  sourceKind: 'preview',
};

/** The series total across every recorded map, so the card never mixes in a running match. */
function seriesTotalFor(closedMaps: readonly ClosedMapResult[], teamNo: number): number {
  let total = 0;
  for (const map of closedMaps) {
    for (const entry of map.teams) if (entry.teamNo === teamNo) total += entry.totalPoints;
  }
  return total;
}

/**
 * The winner of a **closed** map, from the record itself. Name and logo come from the snapshot taken
 * when the map closed; the live roster only fills in a map that predates snapshots. Live players are
 * used only when the screen still shows that very match.
 */
function closedEntryToSummary(
  entry: ClosedMapTeamResult,
  map: ClosedMapResult,
  match: MatchState,
  closedMaps: readonly ClosedMapResult[],
): WwcdWinnerSummary {
  const rosterTeam = match.teams.find((team) => team.teamNo === entry.teamNo);
  const sameMatch = map.matchId !== null && map.matchId === match.matchId;
  const live = sameMatch ? rosterTeam : undefined;

  return {
    teamNo: entry.teamNo,
    name: entry.name ?? rosterTeam?.name ?? `Team ${entry.teamNo}`,
    logoUrl: entry.logoUrl !== undefined ? entry.logoUrl : (rosterTeam?.logoUrl ?? null),
    eliminations: entry.eliminations,
    killPoints: entry.killPoints,
    placementPoints: entry.placementPoints,
    matchPoints: entry.totalPoints,
    seriesPoints: seriesTotalFor(closedMaps.length > 0 ? closedMaps : [map], entry.teamNo),
    aliveCount: live && live.standingPlayerCount > 0 ? live.standingPlayerCount : null,
    players: live?.players ?? [],
    provisional: false,
    sourceKind: 'closed-map',
  };
}

function teamToWinnerSummary(team: Team): WwcdWinnerSummary {
  return {
    teamNo: team.teamNo,
    name: team.name,
    logoUrl: team.logoUrl,
    eliminations: team.eliminations,
    killPoints: team.killPoints,
    placementPoints: team.placementPoints,
    matchPoints: team.killPoints + team.placementPoints,
    seriesPoints: team.totalPoints,
    aliveCount: team.standingPlayerCount,
    players: team.players,
    provisional: true,
    sourceKind: 'live',
  };
}

export interface SelectWwcdWinnerOptions {
  /** Dedicated `/overlay/wwcd` route / admin preview: may fall back to the last recorded map. */
  allowClosedMapFallback?: boolean;
  /** Admin preview: shows a labelled sample instead of nothing when there is no result. */
  isPreviewSimulation?: boolean;
  /** Every recorded map, to know whether the match on screen was already closed. */
  closedMaps?: readonly ClosedMapResult[];
}

/**
 * Who the WWCD overlays name (Part 9, ADR-0019), by the shared rule in `wwcd-resolver.ts`:
 *
 * 1. The match on screen was closed → the recorded placement #1 (`provisional: false`); a closed map
 *    without exactly one #1 names nobody.
 * 2. The map is unclosed and exactly one team is confirmed standing → that team, `provisional: true`.
 * 3. The map is unclosed and the survivor cannot be confirmed → nobody (never a guess).
 * 4. The map is still running → the last recorded map's winner when the fallback is allowed, or
 *    (preview only) a labelled sample.
 */
export function selectWwcdWinner(
  match: MatchState,
  lastClosedMap: ClosedMapResult | null | undefined,
  options: SelectWwcdWinnerOptions = {},
): WwcdWinnerSummary | null {
  const { allowClosedMapFallback = false, isPreviewSimulation = false } = options;
  const closedMaps =
    options.closedMaps && options.closedMaps.length > 0
      ? options.closedMaps
      : lastClosedMap
        ? [lastClosedMap]
        : [];

  const closedForShownMatch =
    match.phase !== 'idle' ? findClosedMapForMatch(match.matchId, closedMaps) : null;
  if (closedForShownMatch) {
    const { winner } = resolveClosedWwcd(closedForShownMatch);
    return winner ? closedEntryToSummary(winner, closedForShownMatch, match, closedMaps) : null;
  }

  const live = resolveLiveWwcd(match);
  if (live.winner) return teamToWinnerSummary(live.winner);
  if (live.state === 'unconfirmed') return null;

  if (allowClosedMapFallback && lastClosedMap && lastClosedMap.teams.length > 0) {
    const { winner } = resolveClosedWwcd(lastClosedMap);
    return winner ? closedEntryToSummary(winner, lastClosedMap, match, closedMaps) : null;
  }

  return isPreviewSimulation ? PREVIEW_WINNER_SAMPLE : null;
}

export interface PostGameTeamRow {
  /** 1-based rank in this match's points table (`totalMatchPoints` desc, `placement` asc). */
  matchRank: number;
  teamNo: number;
  name: string;
  logoUrl: string | null;
  /**
   * 1-based match survival placement (`#1` = WWCD winner). `null` while the map is unclosed and the
   * team has no final placement yet — never a number invented from the table position.
   */
  placement: number | null;
  eliminations: number;
  placementPoints: number;
  killPoints: number;
  /** The operator's bonus (+) or penalty (−) for this match; 0 when none (ADR-0018). */
  additionalPoints: number;
  /** Single-match total points (`placementPoints + killPoints + additionalPoints`). */
  totalMatchPoints: number;
  /** Cumulative series points across the tournament. */
  seriesTotalPoints: number;
}

/** The fields a single-match ranking reads. */
export interface MatchRankFields {
  totalMatchPoints: number;
  killPoints: number;
  placement: number | null;
  teamNo: number;
}

/**
 * Single-match ranking (Part 7 Feature D): match points (adjustment included) desc → official kill
 * points desc → placement asc (no placement yet sorts last) → slot asc. The one implementation
 * shared by the postgame board and the admin's finished-map cards, so the two can never order the
 * same map differently.
 */
export function compareMatchResults(a: MatchRankFields, b: MatchRankFields): number {
  return (
    b.totalMatchPoints - a.totalMatchPoints ||
    b.killPoints - a.killPoints ||
    (a.placement ?? Number.MAX_SAFE_INTEGER) - (b.placement ?? Number.MAX_SAFE_INTEGER) ||
    a.teamNo - b.teamNo
  );
}

/**
 * - `final`: a recorded map with exactly one placement #1.
 * - `provisional`: the current map, not closed yet, with a confirmed last-standing team.
 * - `unconfirmed`: the current map, not closed yet, whose winner cannot be confirmed.
 * - `not-recorded`: a recorded map without a valid placement #1.
 * - `preview`: admin-preview sample data, not a result.
 */
export type PostGameStatus = 'final' | 'provisional' | 'unconfirmed' | 'not-recorded' | 'preview';

export interface PostGameBoardData {
  mapId?: string;
  mapNumber: number;
  mapName: string;
  /** The WWCD team (`null` unless `status` is `final` or `provisional`). */
  winner: PostGameTeamRow | null;
  /** All participating teams (#1–#25) ordered by `totalMatchPoints` descending (`D-PMCC-04` / `A3`). */
  rows: PostGameTeamRow[];
  sourceKind: 'closed-map' | 'live-fallback' | 'preview';
  status: PostGameStatus;
}

export interface SelectPostGameResultsOptions {
  isPreviewSimulation?: boolean;
  /** All persisted completed matches in the series (`series.json`). */
  closedMaps?: readonly ClosedMapResult[];
  /**
   * Which completed match to display (`D-PMCC-09`):
   * - `'latest'` (default): the current map once it has a result (provisional until it is closed),
   *   otherwise the most recently completed match (`closedMaps.at(-1)` or `lastClosedMap`)
   * - `<ClosedMapResult.id>`: pinned historical match ID
   */
  postGameMatchSelection?: string;
}

/**
 * Checks whether a Postgame Match instance has a pinned historical match ID (`D-PMCC-09`) that is
 * no longer present in `closedMaps` (e.g. after a series reset or map deletion).
 */
export function isPinnedPostGameMatchUnavailable(
  postGameMatchSelection: string | undefined,
  closedMaps: readonly ClosedMapResult[] | undefined,
  lastClosedMap?: ClosedMapResult | null,
): boolean {
  const selection = postGameMatchSelection?.trim() || 'latest';
  if (selection === 'latest') return false;
  const maps =
    closedMaps && closedMaps.length > 0 ? closedMaps : lastClosedMap ? [lastClosedMap] : [];
  return !maps.some((m) => m.id === selection);
}

function rankRows(unsorted: Omit<PostGameTeamRow, 'matchRank'>[]): PostGameTeamRow[] {
  return [...unsorted]
    .sort(compareMatchResults)
    .map((row, idx) => ({ ...row, matchRank: idx + 1 }));
}

/** Rows for the current, unclosed map: real placements only (plus the confirmed survivor as #1). */
function liveRows(teams: readonly Team[], winnerTeamNo: number | null): PostGameTeamRow[] {
  return rankRows(
    teams.map((team) => ({
      teamNo: team.teamNo,
      name: team.name,
      logoUrl: team.logoUrl,
      placement: team.teamNo === winnerTeamNo ? 1 : team.placement,
      eliminations: team.eliminations,
      placementPoints: team.placementPoints,
      killPoints: team.killPoints,
      additionalPoints: 0,
      totalMatchPoints: team.killPoints + team.placementPoints,
      seriesTotalPoints: team.totalPoints,
    })),
  );
}

/**
 * Resolves the post-game single-match standings board (`D-PMCC-04` & `D-PMCC-09`, Part 9):
 *
 * - `'latest'` (or omitted): when the **current** map has a result but is not closed yet, that map
 *   — `provisional` with a confirmed last-standing team, `unconfirmed` when it cannot be confirmed.
 *   Otherwise the latest recorded map (`final`, or `not-recorded` without a valid placement #1).
 *   The previous map is never shown in place of a finished current one.
 * - A pinned `ClosedMapResult.id` renders **exclusively** from that record and returns `null` when it
 *   is unavailable (never silently substituting another match).
 */
export function selectPostGameResults(
  match: MatchState,
  lastClosedMap: ClosedMapResult | null | undefined,
  matchInfo: { matchNumber: number; mapName: string },
  options: SelectPostGameResultsOptions = {},
): PostGameBoardData | null {
  const rosterByNo = new Map(match.teams.map((team) => [team.teamNo, team]));
  const selection = options.postGameMatchSelection?.trim() || 'latest';
  const availableMaps =
    options.closedMaps && options.closedMaps.length > 0
      ? options.closedMaps
      : lastClosedMap
        ? [lastClosedMap]
        : [];

  let targetClosedMap: ClosedMapResult | null = null;
  if (selection === 'latest') {
    const currentMapIsClosed = findClosedMapForMatch(match.matchId, availableMaps) !== null;
    const live = currentMapIsClosed ? null : resolveLiveWwcd(match);

    if (live && (live.state === 'provisional' || live.state === 'unconfirmed')) {
      const appeared = match.teams.filter((team) => team.hasAppeared);
      const rows = liveRows(appeared, live.winner?.teamNo ?? null);
      return {
        mapNumber: matchInfo.matchNumber,
        mapName: matchInfo.mapName,
        winner: rows.find((row) => row.teamNo === live.winner?.teamNo) ?? null,
        rows,
        sourceKind: 'live-fallback',
        status: live.state,
      };
    }

    targetClosedMap = availableMaps.at(-1) ?? lastClosedMap ?? null;
  } else {
    targetClosedMap = availableMaps.find((m) => m.id === selection) ?? null;
    // D-PMCC-09 Rule 10 & 11: Never silently substitute a different match when a pinned match ID
    // is unavailable.
    if (!targetClosedMap) {
      return null;
    }
  }

  if (targetClosedMap && targetClosedMap.teams.length > 0) {
    const rows = rankRows(
      targetClosedMap.teams.map((entry) => {
        const rosterTeam = rosterByNo.get(entry.teamNo);
        return {
          teamNo: entry.teamNo,
          name: entry.name ?? rosterTeam?.name ?? `Team ${entry.teamNo}`,
          logoUrl: entry.logoUrl !== undefined ? entry.logoUrl : (rosterTeam?.logoUrl ?? null),
          placement: entry.placement,
          eliminations: entry.eliminations,
          placementPoints: entry.placementPoints,
          killPoints: entry.killPoints,
          additionalPoints: additionalPointsOf(entry),
          totalMatchPoints: entry.totalPoints,
          seriesTotalPoints: rosterTeam?.totalPoints ?? entry.totalPoints,
        };
      }),
    );

    const { winner } = resolveClosedWwcd(targetClosedMap);
    return {
      mapId: targetClosedMap.id,
      mapNumber: targetClosedMap.mapNumber,
      mapName: targetClosedMap.mapName ?? matchInfo.mapName,
      winner: rows.find((row) => row.teamNo === winner?.teamNo) ?? null,
      rows,
      sourceKind: 'closed-map',
      status: winner ? 'final' : 'not-recorded',
    };
  }

  // Admin preview only (`latest`, nothing recorded and nothing finished): a labelled sample board.
  if (selection === 'latest' && options.isPreviewSimulation && match.teams.length > 0) {
    const appeared = match.teams.filter((team) => team.hasAppeared);
    const sourceTeams = appeared.length >= 2 ? appeared : match.teams;
    return {
      mapNumber: matchInfo.matchNumber,
      mapName: matchInfo.mapName,
      winner: null,
      rows: liveRows(sourceTeams, null),
      sourceKind: 'preview',
      status: 'preview',
    };
  }

  return null;
}

export interface SeriesStandingsRow {
  /** 1-based overall tournament rank after PUBG Esports tie-breakers. */
  seriesRank: number;
  teamNo: number;
  name: string;
  logoUrl: string | null;
  /** Number of completed matches this team participated in (`M`). */
  matchesPlayed: number;
  /** Number of Chicken Dinners (`placement === 1`) across completed matches. */
  wwcdCount: number;
  /** Cumulative placement points across completed matches. */
  placementPoints: number;
  /** Cumulative elimination points across completed matches. */
  killPoints: number;
  /** Cumulative eliminations across completed matches. */
  eliminations: number;
  /** Cumulative operator adjustments across completed matches (0 when none). */
  additionalPoints: number;
  /** Cumulative total series points (`placementPoints + killPoints + additionalPoints`). */
  totalPoints: number;
  /** Placement in the most recent closed match (used as official 4th tie-breaker). */
  latestPlacement: number;
}

export interface SeriesStandingsBoardData {
  completedMatchesCount: number;
  lastMapName: string | null;
  leader: SeriesStandingsRow;
  rows: SeriesStandingsRow[];
  sourceKind: 'series' | 'preview';
}

/**
 * Computes cumulative series standings across all persisted `ClosedMapResult` records in `series.json`
 * (`D-PMCC-04` / `postgame-series`), ordered by official PUBG Esports tie-breakers:
 * 1. `totalPoints` desc
 * 2. `wwcdCount` desc
 * 3. `placementPoints` desc
 * 4. `killPoints` desc
 * 5. `latestPlacement` asc (placement in the most recent closed match)
 * 6. `teamNo` asc
 */
export function selectSeriesStandings(
  match: MatchState,
  closedMaps: readonly ClosedMapResult[] | undefined,
  options: { isPreviewSimulation?: boolean; lastClosedMap?: ClosedMapResult | null } = {},
): SeriesStandingsBoardData | null {
  const maps =
    closedMaps && closedMaps.length > 0
      ? closedMaps
      : options.lastClosedMap
        ? [options.lastClosedMap]
        : [];

  const rosterByNo = new Map(match.teams.map((team) => [team.teamNo, team]));

  if (maps.length > 0) {
    const allTeamNos = new Set<number>();
    for (const team of match.teams) {
      if (team.hasAppeared) allTeamNos.add(team.teamNo);
    }
    for (const map of maps) {
      for (const entry of map.teams) {
        allTeamNos.add(entry.teamNo);
      }
    }
    // If no team had hasAppeared on live match, still include all teams that appeared in closedMaps
    // (or full roster if needed).
    if (allTeamNos.size === 0) {
      for (const team of match.teams) allTeamNos.add(team.teamNo);
    }

    const latestMap = maps.at(-1)!;
    const latestPlacementByTeam = new Map<number, number>();
    for (const entry of latestMap.teams) {
      latestPlacementByTeam.set(entry.teamNo, entry.placement);
    }

    const unsorted: Omit<SeriesStandingsRow, 'seriesRank'>[] = [];
    for (const teamNo of allTeamNos) {
      const rosterTeam = rosterByNo.get(teamNo);
      let matchesPlayed = 0;
      let wwcdCount = 0;
      let placementPoints = 0;
      let killPoints = 0;
      let eliminations = 0;
      let additionalPoints = 0;
      let totalPoints = 0;

      for (const map of maps) {
        const entry = map.teams.find((t) => t.teamNo === teamNo);
        if (entry) {
          matchesPlayed += 1;
          if (entry.placement === 1) wwcdCount += 1;
          placementPoints += entry.placementPoints;
          killPoints += entry.killPoints;
          eliminations += entry.eliminations;
          additionalPoints += additionalPointsOf(entry);
          totalPoints += entry.totalPoints;
        }
      }

      // Find the most recent snapshot for name/logo if rosterTeam is deleted or not found
      let snapshotName: string | undefined;
      let snapshotLogoUrl: string | null | undefined;
      for (let i = maps.length - 1; i >= 0; i--) {
        const entry = maps[i]?.teams.find((t) => t.teamNo === teamNo);
        if (entry?.name) {
          snapshotName = entry.name;
          snapshotLogoUrl = entry.logoUrl;
          break;
        }
      }

      unsorted.push({
        teamNo,
        name: snapshotName ?? rosterTeam?.name ?? `Team ${teamNo}`,
        logoUrl: snapshotLogoUrl !== undefined ? snapshotLogoUrl : (rosterTeam?.logoUrl ?? null),
        matchesPlayed,
        wwcdCount,
        placementPoints,
        killPoints,
        eliminations,
        additionalPoints,
        totalPoints,
        latestPlacement: latestPlacementByTeam.get(teamNo) ?? 999,
      });
    }

    const sorted = [...unsorted].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.wwcdCount !== a.wwcdCount) return b.wwcdCount - a.wwcdCount;
      if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints;
      if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
      if (a.latestPlacement !== b.latestPlacement) return a.latestPlacement - b.latestPlacement;
      return a.teamNo - b.teamNo;
    });

    const rows: SeriesStandingsRow[] = sorted.map((row, idx) => ({
      ...row,
      seriesRank: idx + 1,
    }));

    return {
      completedMatchesCount: maps.length,
      lastMapName: latestMap.mapName ?? null,
      leader: rows[0]!,
      rows,
      sourceKind: 'series',
    };
  }

  if (options.isPreviewSimulation && match.teams.length > 0) {
    const unsorted: Omit<SeriesStandingsRow, 'seriesRank'>[] = match.teams.map((team, idx) => {
      const placePts = team.placementPoints;
      const killPts = team.killPoints;
      const totalPts = team.totalPoints !== 0 ? team.totalPoints : placePts + killPts;
      return {
        teamNo: team.teamNo,
        name: team.name,
        logoUrl: team.logoUrl,
        matchesPlayed: 1,
        wwcdCount: (team.placement ?? idx + 1) === 1 ? 1 : 0,
        placementPoints: placePts,
        killPoints: killPts,
        eliminations: team.eliminations,
        additionalPoints: 0,
        totalPoints: totalPts,
        latestPlacement: team.placement ?? idx + 1,
      };
    });

    const sorted = [...unsorted].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.wwcdCount !== a.wwcdCount) return b.wwcdCount - a.wwcdCount;
      if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints;
      if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
      if (a.latestPlacement !== b.latestPlacement) return a.latestPlacement - b.latestPlacement;
      return a.teamNo - b.teamNo;
    });

    const rows: SeriesStandingsRow[] = sorted.map((row, idx) => ({
      ...row,
      seriesRank: idx + 1,
    }));

    return {
      completedMatchesCount: 1,
      lastMapName: 'Erangel',
      leader: rows[0]!,
      rows,
      sourceKind: 'preview',
    };
  }

  return null;
}
