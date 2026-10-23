import type { ClosedMapResult, ClosedMapTeamResult } from '@cdf/shared';
import { describe, expect, it } from 'vitest';
import { selectNextMapBoard } from './next-map';

function makeClosedMap(
  mapNumber: number,
  mapName: string,
  winnerTeamNo: number,
  winnerName: string,
  elims: number,
  totalPts: number,
): ClosedMapResult {
  const winner: ClosedMapTeamResult = {
    teamNo: winnerTeamNo,
    name: winnerName,
    placement: 1,
    eliminations: elims,
    placementPoints: 10,
    killPoints: elims,
    totalPoints: totalPts,
    logoUrl: null,
  };
  const runnerUp: ClosedMapTeamResult = {
    teamNo: 99,
    name: 'Runner Up',
    placement: 2,
    eliminations: 4,
    placementPoints: 6,
    killPoints: 4,
    totalPoints: 10,
    logoUrl: null,
  };
  return {
    id: `map-${mapNumber}`,
    mapNumber,
    mapName,
    matchId: null,
    startedAt: 1000 * mapNumber,
    endedAt: 2000 * mapNumber,
    teams: [winner, runnerUp],
  };
}

describe('selectNextMapBoard', () => {
  it('provides a preview simulation sample when no closed maps exist and preview is true', () => {
    const board = selectNextMapBoard([], 'auto', { isPreviewSimulation: true });
    expect(board.cards).toHaveLength(4);
    expect(board.cards[0].state).toBe('completed');
    expect(board.cards[0].winner?.name).toBe('SUKA SUKA SQUAD');
    expect(board.cards[1].state).toBe('upcoming');
    expect(board.cards[2].state).toBe('future');
    expect(board.cards[3].state).toBe('future');
    expect(board.upcomingMatchNumber).toBe(2);
  });

  it('sets Match 1 as upcoming in a fresh tournament with auto selection', () => {
    const board = selectNextMapBoard([], 'auto');
    expect(board.upcomingMatchNumber).toBe(1);
    expect(board.allCompleted).toBe(false);
    expect(board.cards[0].state).toBe('upcoming');
    expect(board.cards[1].state).toBe('future');
    expect(board.cards[2].state).toBe('future');
    expect(board.cards[3].state).toBe('future');
  });

  it('marks Match 1 completed and Match 2 upcoming once Match 1 is closed', () => {
    const map1 = makeClosedMap(1, 'Erangel', 5, 'TEAM FIVE', 12, 22);
    const board = selectNextMapBoard([map1], 'auto');

    expect(board.upcomingMatchNumber).toBe(2);
    expect(board.cards[0].state).toBe('completed');
    expect(board.cards[0].winner).toEqual({
      teamNo: 5,
      name: 'TEAM FIVE',
      logoUrl: null,
      eliminations: 12,
      totalPoints: 22,
    });
    expect(board.cards[1].state).toBe('upcoming');
    expect(board.cards[2].state).toBe('future');
    expect(board.cards[3].state).toBe('future');
  });

  it('supports manual override of upcoming match', () => {
    const map1 = makeClosedMap(1, 'Erangel', 5, 'TEAM FIVE', 12, 22);
    const board = selectNextMapBoard([map1], '3');

    expect(board.upcomingMatchNumber).toBe(3);
    expect(board.cards[0].state).toBe('completed');
    expect(board.cards[1].state).toBe('future');
    expect(board.cards[2].state).toBe('upcoming');
    expect(board.cards[3].state).toBe('future');
  });

  it('marks all 4 matches completed when all 4 maps have finished', () => {
    const map1 = makeClosedMap(1, 'Erangel', 1, 'Alpha', 8, 18);
    const map2 = makeClosedMap(2, 'Erangel', 2, 'Bravo', 10, 20);
    const map3 = makeClosedMap(3, 'Miramar', 3, 'Charlie', 14, 24);
    const map4 = makeClosedMap(4, 'Miramar', 4, 'Delta', 6, 16);

    const board = selectNextMapBoard([map1, map2, map3, map4], 'auto');
    expect(board.allCompleted).toBe(true);
    expect(board.upcomingMatchNumber).toBeNull();
    expect(board.cards.every((c) => c.state === 'completed')).toBe(true);
    expect(board.cards[0].winner?.name).toBe('Alpha');
    expect(board.cards[1].winner?.name).toBe('Bravo');
    expect(board.cards[2].winner?.name).toBe('Charlie');
    expect(board.cards[3].winner?.name).toBe('Delta');
  });
});
