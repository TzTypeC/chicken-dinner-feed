import type { ClosedMapResult, MatchState, OverlayAppearance, Team } from '@cdf/shared';

export type LeaderboardLayoutMode = 'tower' | 'final-four' | 'wwcd';

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
  /** Single-match total points (`killPoints + placementPoints`). */
  matchPoints: number;
  /** Cumulative tournament points including this match. */
  seriesPoints: number;
  aliveCount: number;
  players: Team['players'];
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

  const showWwcd = appearance.showWwcdOverlay ?? true;
  if (showWwcd && standingTeams.length === 1) {
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
 * Resolves the confirmed WWCD winner for either:
 * - automatic in-game WWCD display (`allowClosedMapFallback = false`), or
 * - dedicated `/overlay/wwcd` route / admin preview (`allowClosedMapFallback = true`).
 */
export function selectWwcdWinner(
  match: MatchState,
  lastClosedMap: ClosedMapResult | null | undefined,
  options: { allowClosedMapFallback?: boolean; isPreviewSimulation?: boolean } = {},
): WwcdWinnerSummary | null {
  const { allowClosedMapFallback = false, isPreviewSimulation = false } = options;

  if (match.phase !== 'idle') {
    const appeared = match.teams.filter((team) => team.hasAppeared);
    const standing = appeared.filter((team) => !team.isEliminated);
    const eliminatedCount = appeared.filter((team) => team.isEliminated).length;

    if (standing.length === 1 && eliminatedCount >= 1) {
      const winner = standing[0]!;
      return teamToWinnerSummary(winner, 'live');
    }
  }

  if (allowClosedMapFallback && lastClosedMap && lastClosedMap.teams.length > 0) {
    const closedWinner =
      lastClosedMap.teams.find((entry) => entry.placement === 1) ??
      [...lastClosedMap.teams].sort((a, b) => a.placement - b.placement)[0]!;
    const rosterMatch = match.teams.find((team) => team.teamNo === closedWinner.teamNo);

    return {
      teamNo: closedWinner.teamNo,
      name: rosterMatch?.name ?? `Team ${closedWinner.teamNo}`,
      logoUrl: rosterMatch?.logoUrl ?? null,
      eliminations: closedWinner.eliminations,
      killPoints: closedWinner.killPoints,
      placementPoints: closedWinner.placementPoints,
      matchPoints: closedWinner.totalPoints,
      seriesPoints: rosterMatch?.totalPoints ?? closedWinner.totalPoints,
      aliveCount: rosterMatch && !rosterMatch.isEliminated ? rosterMatch.standingPlayerCount : 4,
      players: rosterMatch?.players ?? [],
      sourceKind: 'closed-map',
    };
  }

  if (isPreviewSimulation && match.teams.length > 0) {
    const topTeam = match.teams[0]!;
    return teamToWinnerSummary(topTeam, 'preview');
  }

  return null;
}

function teamToWinnerSummary(team: Team, sourceKind: 'live' | 'preview'): WwcdWinnerSummary {
  const matchPoints = team.killPoints + team.placementPoints;
  return {
    teamNo: team.teamNo,
    name: team.name,
    logoUrl: team.logoUrl,
    eliminations: team.eliminations,
    killPoints: team.killPoints,
    placementPoints: team.placementPoints,
    matchPoints,
    seriesPoints: team.totalPoints,
    aliveCount: team.standingPlayerCount > 0 ? team.standingPlayerCount : 4,
    players: team.players,
    sourceKind,
  };
}

export interface PostGameTeamRow {
  /** 1-based rank in this match's points table (`totalMatchPoints` desc, `placement` asc). */
  matchRank: number;
  teamNo: number;
  name: string;
  logoUrl: string | null;
  /** 1-based match survival placement (`#1` = WWCD winner). */
  placement: number;
  eliminations: number;
  placementPoints: number;
  killPoints: number;
  /** Single-match total points (`placementPoints + killPoints`). */
  totalMatchPoints: number;
  /** Cumulative series points across the tournament. */
  seriesTotalPoints: number;
}

export interface PostGameBoardData {
  mapNumber: number;
  mapName: string;
  /** The team that won the match (`placement === 1`, or rank 1 if placements are tied in preview). */
  winner: PostGameTeamRow;
  /** All participating teams (#1–#25) ordered by `totalMatchPoints` descending (`D-PMCC-04` / `A3`). */
  rows: PostGameTeamRow[];
  sourceKind: 'closed-map' | 'live-fallback' | 'preview';
}

/**
 * Resolves the post-game detailed standings board from persisted `ClosedMapResult` (`lastClosedMap`),
 * with a clean fallback to finished live match data (or preview simulation) when no closed map has
 * been saved yet (`docs/postgame-standings-requirements.md`, `D-PMCC-04`).
 */
export function selectPostGameResults(
  match: MatchState,
  lastClosedMap: ClosedMapResult | null | undefined,
  matchInfo: { matchNumber: number; mapName: string },
  options: { isPreviewSimulation?: boolean } = {},
): PostGameBoardData | null {
  const rosterByNo = new Map(match.teams.map((team) => [team.teamNo, team]));

  if (lastClosedMap && lastClosedMap.teams.length > 0) {
    const unsorted: Omit<PostGameTeamRow, 'matchRank'>[] = lastClosedMap.teams.map((entry) => {
      const rosterTeam = rosterByNo.get(entry.teamNo);
      return {
        teamNo: entry.teamNo,
        name: rosterTeam?.name ?? `Team ${entry.teamNo}`,
        logoUrl: rosterTeam?.logoUrl ?? null,
        placement: entry.placement,
        eliminations: entry.eliminations,
        placementPoints: entry.placementPoints,
        killPoints: entry.killPoints,
        totalMatchPoints: entry.totalPoints,
        seriesTotalPoints: rosterTeam?.totalPoints ?? entry.totalPoints,
      };
    });

    const sorted = [...unsorted].sort((a, b) => {
      if (b.totalMatchPoints !== a.totalMatchPoints) return b.totalMatchPoints - a.totalMatchPoints;
      if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
      if (a.placement !== b.placement) return a.placement - b.placement;
      return a.teamNo - b.teamNo;
    });

    const rows: PostGameTeamRow[] = sorted.map((row, idx) => ({
      ...row,
      matchRank: idx + 1,
    }));

    const winner =
      rows.find((row) => row.placement === 1) ??
      [...rows].sort((a, b) => a.placement - b.placement)[0]!;

    return {
      mapNumber: lastClosedMap.mapNumber,
      mapName: lastClosedMap.mapName ?? matchInfo.mapName,
      winner,
      rows,
      sourceKind: 'closed-map',
    };
  }

  // Fallback when operator switches to /overlay/postgame at match end before clicking "Close map",
  // or when previewing Post-Game Standings in the Admin Preview.
  const appearedTeams = match.teams.filter((team) => team.hasAppeared);
  const standingCount = appearedTeams.filter((team) => !team.isEliminated).length;
  const isFinishedLiveMatch =
    match.phase !== 'idle' && appearedTeams.length >= 2 && standingCount <= 1;

  if (isFinishedLiveMatch || (options.isPreviewSimulation && match.teams.length > 0)) {
    const sourceTeams = appearedTeams.length >= 2 ? appearedTeams : match.teams;
    const unsorted: Omit<PostGameTeamRow, 'matchRank'>[] = sourceTeams.map((team, idx) => {
      const matchPoints = team.killPoints + team.placementPoints;
      return {
        teamNo: team.teamNo,
        name: team.name,
        logoUrl: team.logoUrl,
        placement: team.placement ?? idx + 1,
        eliminations: team.eliminations,
        placementPoints: team.placementPoints,
        killPoints: team.killPoints,
        totalMatchPoints: matchPoints,
        seriesTotalPoints: team.totalPoints,
      };
    });

    const sorted = [...unsorted].sort((a, b) => {
      if (b.totalMatchPoints !== a.totalMatchPoints) return b.totalMatchPoints - a.totalMatchPoints;
      if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
      if (a.placement !== b.placement) return a.placement - b.placement;
      return a.teamNo - b.teamNo;
    });

    const rows: PostGameTeamRow[] = sorted.map((row, idx) => ({
      ...row,
      matchRank: idx + 1,
    }));

    const winner = rows.find((row) => row.placement === 1) ?? rows[0]!;

    return {
      mapNumber: matchInfo.matchNumber,
      mapName: matchInfo.mapName,
      winner,
      rows,
      sourceKind: isFinishedLiveMatch ? 'live-fallback' : 'preview',
    };
  }

  return null;
}
