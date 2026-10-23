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
}

const DEFAULT_SCHEDULE: readonly { matchNumber: number; defaultMapName: string }[] = [
  { matchNumber: 1, defaultMapName: 'Erangel' },
  { matchNumber: 2, defaultMapName: 'Erangel' },
  { matchNumber: 3, defaultMapName: 'Miramar' },
  { matchNumber: 4, defaultMapName: 'Miramar' },
];

export function selectNextMapBoard(
  closedMaps: readonly ClosedMapResult[] = [],
  selection: 'auto' | '1' | '2' | '3' | '4' = 'auto',
  options: SelectNextMapOptions = {},
): NextMapBoard {
  const { isPreviewSimulation = false, rosterByNo = new Map() } = options;

  // Sample data for admin preview when no real matches have finished
  if (isPreviewSimulation && closedMaps.length === 0) {
    return {
      upcomingMatchNumber: 2,
      allCompleted: false,
      cards: [
        {
          matchNumber: 1,
          defaultMapName: 'Erangel',
          mapName: 'Erangel',
          state: 'completed',
          winner: {
            teamNo: 1,
            name: 'SUKA SUKA SQUAD',
            logoUrl: null,
            eliminations: 14,
            totalPoints: 24,
          },
        },
        {
          matchNumber: 2,
          defaultMapName: 'Erangel',
          mapName: 'Erangel',
          state: 'upcoming',
          winner: null,
        },
        {
          matchNumber: 3,
          defaultMapName: 'Miramar',
          mapName: 'Miramar',
          state: 'future',
          winner: null,
        },
        {
          matchNumber: 4,
          defaultMapName: 'Miramar',
          mapName: 'Miramar',
          state: 'future',
          winner: null,
        },
      ],
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

  const allCompleted = completedMatchNos.size >= 4;

  let upcomingMatchNumber: number | null = null;
  if (!allCompleted) {
    if (selection !== 'auto') {
      upcomingMatchNumber = Number(selection);
    } else {
      // Find the earliest match 1..4 not yet closed
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
      // Find team with placement === 1, or best finish
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
    if (allCompleted) {
      state = winner ? 'completed' : 'future';
    } else if (winner && (upcomingMatchNumber === null || matchNumber < upcomingMatchNumber)) {
      state = 'completed';
    } else if (matchNumber === upcomingMatchNumber) {
      state = 'upcoming';
    } else if (winner) {
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
