import type { TeamRosterEntry } from '@cdf/shared';

/**
 * Ripple Shift (Sisip & Geser) renumbering algorithm (Fitur E).
 *
 * Dragging source team S to target slot D:
 * - If target slot D is vacant: team S simply takes slot D.
 * - If S > D: team S takes slot D; all teams occupying slots in [D, S - 1] shift down by +1.
 * - If S < D: team S takes slot D; all teams occupying slots in [S + 1, D] shift up by -1.
 * - Teams outside the [min(S, D), max(S, D)] range remain untouched.
 */
export function applyRippleShift(
  teams: readonly TeamRosterEntry[],
  sourceTeamNo: number,
  targetTeamNo: number,
): TeamRosterEntry[] {
  if (sourceTeamNo === targetTeamNo) return [...teams];
  const sourceTeam = teams.find((t) => t.teamNo === sourceTeamNo);
  if (!sourceTeam) return [...teams];

  const targetOccupied = teams.some((t) => t.teamNo === targetTeamNo);

  // If destination slot is empty, move directly without shifting others
  if (!targetOccupied) {
    return teams
      .map((t) =>
        t.teamNo === sourceTeamNo
          ? {
              ...t,
              teamNo: targetTeamNo,
              previousTeamNo: t.previousTeamNo ?? sourceTeamNo,
            }
          : t,
      )
      .sort((a, b) => a.teamNo - b.teamNo);
  }

  return teams
    .map((team) => {
      if (team.teamNo === sourceTeamNo) {
        return {
          ...team,
          teamNo: targetTeamNo,
          previousTeamNo: team.previousTeamNo ?? sourceTeamNo,
        };
      }

      if (sourceTeamNo > targetTeamNo) {
        // Dragging downward (e.g. 12 -> 3): items in [3, 11] shift +1
        if (team.teamNo >= targetTeamNo && team.teamNo < sourceTeamNo) {
          return {
            ...team,
            teamNo: team.teamNo + 1,
            previousTeamNo: team.previousTeamNo ?? team.teamNo,
          };
        }
      } else {
        // Dragging upward (e.g. 3 -> 12): items in [4, 12] shift -1
        if (team.teamNo > sourceTeamNo && team.teamNo <= targetTeamNo) {
          return {
            ...team,
            teamNo: team.teamNo - 1,
            previousTeamNo: team.previousTeamNo ?? team.teamNo,
          };
        }
      }

      return team;
    })
    .sort((a, b) => a.teamNo - b.teamNo);
}

/**
 * Direct Slot Swap (Fitur E).
 *
 * Exchanges slots between teamA and teamB without shifting intermediate teams.
 * If teamB is vacant, teamA moves to teamB directly.
 */
export function applyDirectSwap(
  teams: readonly TeamRosterEntry[],
  teamA: number,
  teamB: number,
): TeamRosterEntry[] {
  if (teamA === teamB) return [...teams];
  const teamAEntry = teams.find((t) => t.teamNo === teamA);
  if (!teamAEntry) return [...teams];

  const teamBEntry = teams.find((t) => t.teamNo === teamB);

  return teams
    .map((team) => {
      if (team.teamNo === teamA) {
        return {
          ...team,
          teamNo: teamB,
          previousTeamNo: team.previousTeamNo ?? teamA,
        };
      }
      if (teamBEntry && team.teamNo === teamB) {
        return {
          ...team,
          teamNo: teamA,
          previousTeamNo: team.previousTeamNo ?? teamB,
        };
      }
      return team;
    })
    .sort((a, b) => a.teamNo - b.teamNo);
}
