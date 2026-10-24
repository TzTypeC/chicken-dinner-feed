import type { ClosedMapResult, MatchState, Team } from '@cdf/shared';

export type MatchCardState = 'upcoming' | 'completed' | 'future';

export interface NextMapWinnerInfo {
  teamNo: number;
  name: string;
  logoUrl: string | null;
  eliminations: number;
  totalPoints: number;
}

export interface NextMapCard {
  matchNumber: number; // 1, 2, 3, 4
  defaultMapName: string; // 'Erangel' | 'Miramar'
  mapName: string;
  state: MatchCardState;
  winner: NextMapWinnerInfo | null;
}

export interface NextMapBoard {
  upcomingMatchNumber: number | null; // 1..4, or null if all 4 completed
  allCompleted: boolean;
  cards: NextMapCard[];
}

export interface SelectNextMapOptions {
  isPreviewSimulation?: boolean;
  rosterByNo?: ReadonlyMap<number, Pick<Team, 'name' | 'logoUrl'>>;
  liveMatch?: MatchState | null;
  simulatorMode?: 'disabled' | 'match-1' | 'match-2' | 'match-3' | 'all-completed';
}

const DEFAULT_SCHEDULE: readonly { matchNumber: number; defaultMapName: string }[] = [
  { matchNumber: 1, defaultMapName: 'Erangel' },
  { matchNumber: 2, defaultMapName: 'Erangel' },
  { matchNumber: 3, defaultMapName: 'Miramar' },
  { matchNumber: 4, defaultMapName: 'Miramar' },
];

const SIMULATED_WINNERS: readonly NextMapWinnerInfo[] = [
  {
    teamNo: 1,
    name: 'SUKA SUKA SQUAD',
    logoUrl: null,
    eliminations: 14,
    totalPoints: 24,
  },
  {
    teamNo: 7,
    name: 'BIGETRON ESPORTS',
    logoUrl: null,
    eliminations: 16,
    totalPoints: 26,
  },
  {
    teamNo: 3,
    name: 'RRQ RYU',
    logoUrl: null,
    eliminations: 12,
    totalPoints: 22,
  },
  {
    teamNo: 5,
    name: 'ALTER EGO LIMAX',
    logoUrl: null,
    eliminations: 15,
    totalPoints: 25,
  },
];

export function selectNextMapBoard(
  closedMaps: readonly ClosedMapResult[] = [],
  selection: 'auto' | '1' | '2' | '3' | '4' = 'auto',
  options: SelectNextMapOptions = {},
): NextMapBoard {
  const {
    isPreviewSimulation = false,
    rosterByNo = new Map(),
    simulatorMode = 'disabled',
  } = options;

  // Simulator Mode logic (Admin interactive testing)
  const effectiveSim =
    simulatorMode !== 'disabled'
      ? simulatorMode
      : isPreviewSimulation && closedMaps.length === 0
        ? 'match-1'
        : 'disabled';

  if (effectiveSim !== 'disabled') {
    const completedCount =
      effectiveSim === 'all-completed'
        ? 4
        : effectiveSim === 'match-3'
          ? 3
          : effectiveSim === 'match-2'
            ? 2
            : 1;

    const allCompleted = completedCount >= 4;
    const upcoming = allCompleted ? null : completedCount + 1;

    return {
      upcomingMatchNumber: upcoming,
      allCompleted,
      cards: DEFAULT_SCHEDULE.map(({ matchNumber, defaultMapName }) => {
        const isCompleted = matchNumber <= completedCount;
        const isUpcoming = matchNumber === upcoming;
        const state: MatchCardState = isCompleted
          ? 'completed'
          : isUpcoming
            ? 'upcoming'
            : 'future';

        return {
          matchNumber,
          defaultMapName,
          mapName: defaultMapName,
          state,
          winner: isCompleted ? (SIMULATED_WINNERS[matchNumber - 1] ?? null) : null,
        };
      }),
    };
  }

  // Map closed maps by match number
  const closedByMatch = new Map<number, ClosedMapResult>();
  for (const map of closedMaps) {
    closedByMatch.set(map.mapNumber, map);
  }

  // Determine which matches 1..4 are completed
  const completedMatchNos = new Set<number>();
  for (let m = 1; m <= 4; m++) {
    if (closedByMatch.has(m)) {
      completedMatchNos.add(m);
    }
  }

  let upcomingMatchNumber: number | null = null;
  let allCompleted = false;

  if (selection !== 'auto') {
    upcomingMatchNumber = Number(selection);
  } else {
    allCompleted = completedMatchNos.size >= 4;
    if (!allCompleted) {
      for (let m = 1; m <= 4; m++) {
        if (!completedMatchNos.has(m)) {
          upcomingMatchNumber = m;
          break;
        }
      }
    }
  }

  const cards: NextMapCard[] = DEFAULT_SCHEDULE.map(({ matchNumber, defaultMapName }) => {
    const closed = closedByMatch.get(matchNumber);
    let winner: NextMapWinnerInfo | null = null;

    if (closed && closed.teams.length > 0) {
      const sortedTeams = [...closed.teams].sort((a, b) => {
        const placeA = a.placement ?? 999;
        const placeB = b.placement ?? 999;
        if (placeA !== placeB) return placeA - placeB;
        return b.eliminations - a.eliminations;
      });

      const winnerTeam = sortedTeams[0];
      if (winnerTeam) {
        const rosterTeam = rosterByNo.get(winnerTeam.teamNo);
        const killPoints = winnerTeam.killPoints ?? winnerTeam.eliminations;
        const placePoints = winnerTeam.placementPoints ?? 0;
        const totalPoints = winnerTeam.totalPoints ?? killPoints + placePoints;

        winner = {
          teamNo: winnerTeam.teamNo,
          name: rosterTeam?.name ?? winnerTeam.name,
          logoUrl: rosterTeam?.logoUrl ?? winnerTeam.logoUrl ?? null,
          eliminations: winnerTeam.eliminations,
          totalPoints,
        };
      }
    }

    let state: MatchCardState;
    if (upcomingMatchNumber !== null && matchNumber === upcomingMatchNumber) {
      state = 'upcoming';
    } else if (winner && (upcomingMatchNumber === null || matchNumber < upcomingMatchNumber)) {
      state = 'completed';
    } else if (allCompleted && winner) {
      state = 'completed';
    } else {
      state = 'future';
    }

    return {
      matchNumber,
      defaultMapName,
      mapName: closed?.mapName || defaultMapName,
      state,
      winner,
    };
  });

  return {
    upcomingMatchNumber,
    allCompleted,
    cards,
  };
}
