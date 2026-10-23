import type { ClosedMapResult, ClosedMapTeamResult, MatchState, Team } from '@cdf/shared';
import { describe, expect, it } from 'vitest';
import { selectPostGameResults, selectSeriesStandings } from './broadcast-state';

/** Default PMCC ruleset: 10/6/5/4/3/2/1/1, 1 point per elimination. */
const PLACEMENT_POINTS = [10, 6, 5, 4, 3, 2, 1, 1];

function result(
  teamNo: number,
  placement: number,
  eliminations: number,
  additionalPoints?: number,
): ClosedMapTeamResult {
  const placementPoints = PLACEMENT_POINTS[placement - 1] ?? 0;
  return {
    teamNo,
    placement,
    eliminations,
    placementPoints,
    killPoints: eliminations,
    totalPoints: placementPoints + eliminations + (additionalPoints ?? 0),
    ...(additionalPoints !== undefined ? { additionalPoints } : {}),
    name: `Team ${teamNo}`,
  };
}

function map(id: string, mapNumber: number, teams: ClosedMapTeamResult[]): ClosedMapResult {
  return {
    id,
    mapNumber,
    mapName: 'Erangel',
    matchId: null,
    startedAt: null,
    endedAt: null,
    teams,
  };
}

const IDLE_MATCH: MatchState = {
  matchId: null,
  phase: 'idle',
  standingTeamCount: 0,
  teams: [] as Team[],
};

describe('postgame selectors with Additional Points (Part 8)', () => {
  it('ranks a single match by the adjusted total while official columns stay official', () => {
    // T1 wins (10 + 2 = 12) but takes −8; T2 (6 + 4 = 10) now leads on 10 vs 4.
    const closed = map('m1', 1, [result(1, 1, 2, -8), result(2, 2, 4), result(3, 3, 0, 0)]);

    const board = selectPostGameResults(IDLE_MATCH, closed, {
      matchNumber: 1,
      mapName: 'Erangel',
    })!;

    expect(board.rows.map((row) => row.teamNo)).toEqual([2, 3, 1]);
    const team1 = board.rows.find((row) => row.teamNo === 1)!;
    expect(team1).toMatchObject({
      placement: 1,
      eliminations: 2,
      placementPoints: 10,
      killPoints: 2,
      additionalPoints: -8,
      totalMatchPoints: 4,
    });
    // The WWCD winner is still the team that placed 1st; a penalty does not move placement.
    expect(board.winner!.teamNo).toBe(1);
  });

  it('a pre-Part-8 map reads as no adjustment', () => {
    const closed = map('legacy', 1, [result(1, 1, 3)]);
    const board = selectPostGameResults(IDLE_MATCH, closed, {
      matchNumber: 1,
      mapName: 'Erangel',
    })!;
    expect(board.rows[0]).toMatchObject({ additionalPoints: 0, totalMatchPoints: 13 });
  });

  it('series totals include each adjustment once and keep official tie-breakers', () => {
    const maps = [
      // Map 1: T1 wins (10 + 0), T2 2nd (6 + 4).
      map('m1', 1, [result(1, 1, 0), result(2, 2, 4)]),
      // Map 2: T2 wins (10 + 0) but takes −10; T1 2nd (6 + 4) with a +0 adjustment recorded.
      map('m2', 2, [result(2, 1, 0, -10), result(1, 2, 4, 0)]),
    ];

    const board = selectSeriesStandings(IDLE_MATCH, maps)!;
    const team1 = board.rows.find((row) => row.teamNo === 1)!;
    const team2 = board.rows.find((row) => row.teamNo === 2)!;

    expect(team1).toMatchObject({ totalPoints: 20, additionalPoints: 0 });
    expect(team2).toMatchObject({
      totalPoints: 10,
      additionalPoints: -10,
      placementPoints: 16,
      killPoints: 4,
      wwcdCount: 1,
    });
    expect(board.rows.map((row) => row.teamNo)).toEqual([1, 2]);
  });

  it('when an adjustment creates a tie, the official chain (WWCD, then placement points) decides', () => {
    // T1: 10 + 0 (WWCD) = 10. T2: 6 + 2 = 8, +2 bonus = 10. Tied on 10 → T1 has the WWCD.
    const maps = [map('m1', 1, [result(1, 1, 0), result(2, 2, 2, 2)])];
    const board = selectSeriesStandings(IDLE_MATCH, maps)!;
    expect(board.rows.map((row) => [row.teamNo, row.totalPoints])).toEqual([
      [1, 10],
      [2, 10],
    ]);
  });

  it('a negative series total is reported as-is, never clamped', () => {
    const maps = [map('m1', 1, [result(4, 5, 0, -20), result(5, 6, 0)])];
    const board = selectSeriesStandings(IDLE_MATCH, maps)!;
    expect(board.rows.find((row) => row.teamNo === 4)!.totalPoints).toBe(3 - 20);
    expect(board.rows.at(-1)!.teamNo).toBe(4);
  });
});
