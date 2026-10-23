import type { ClosedMapResult, ClosedMapTeamResult } from '@cdf/shared';
import { describe, expect, it } from 'vitest';
import { selectTopKill, type TopKillBoard } from './top-kill';

function entry(
  teamNo: number,
  eliminations: number,
  placement: number,
  extra: Partial<ClosedMapTeamResult> = {},
): ClosedMapTeamResult {
  return {
    teamNo,
    placement,
    eliminations,
    killPoints: eliminations,
    placementPoints: 0,
    totalPoints: eliminations,
    name: `Snap ${teamNo}`,
    logoUrl: `https://logo/${teamNo}.png`,
    ...extra,
  };
}

function closedMap(mapNumber: number, teams: ClosedMapTeamResult[]): ClosedMapResult {
  return {
    id: `m${mapNumber}`,
    mapNumber,
    mapName: 'Miramar',
    matchId: null,
    startedAt: null,
    endedAt: null,
    teams,
  };
}

function ready(board: TopKillBoard) {
  if (board.status !== 'ready' && board.status !== 'preview')
    throw new Error(`unexpected ${board.status}`);
  return board;
}

describe('selectTopKill', () => {
  it('orders by eliminations and caps at four', () => {
    const b = ready(
      selectTopKill([
        closedMap(1, [
          entry(1, 3, 5),
          entry(2, 9, 2),
          entry(3, 1, 9),
          entry(4, 6, 1),
          entry(5, 4, 3),
          entry(6, 0, 4),
        ]),
      ]),
    );
    expect(b.status).toBe('ready');
    expect(b.entries.map((e) => e.teamNo)).toEqual([2, 4, 5, 1]);
    expect(b.entries.map((e) => e.displayRank)).toEqual([1, 2, 3, 4]);
    expect(b.entries.every((e) => !e.tied)).toBe(true);
    expect(b.cutoffTiedExtra).toBe(0);
    expect(b.cutoffEliminations).toBeNull();
    expect(b.map).toEqual({ mapId: 'm1', mapNumber: 1, mapName: 'Miramar' });
  });

  it('reports no-eliminations when every team has zero', () => {
    expect(selectTopKill([closedMap(2, [entry(1, 0, 1), entry(2, 0, 2)])])).toEqual({
      status: 'no-eliminations',
      map: { mapId: 'm2', mapNumber: 2, mapName: 'Miramar' },
    });
  });

  it('shows only real candidates when fewer than four have kills', () => {
    const b = ready(
      selectTopKill([closedMap(1, [entry(1, 2, 3), entry(2, 0, 1), entry(3, 5, 2)])]),
    );
    expect(b.entries.map((e) => e.teamNo)).toEqual([3, 1]);
    expect(b.cutoffTiedExtra).toBe(0);
  });

  it('counts the teams cut at a tie on the fourth place', () => {
    const b = ready(
      selectTopKill([
        closedMap(1, [
          entry(1, 10, 1),
          entry(2, 8, 2),
          entry(3, 6, 3),
          entry(4, 5, 4),
          entry(5, 5, 5),
          entry(6, 5, 6),
          entry(7, 2, 7),
        ]),
      ]),
    );
    expect(b.entries.map((e) => e.teamNo)).toEqual([1, 2, 3, 4]);
    expect(b.entries[3]).toMatchObject({ displayRank: 4, tied: true });
    expect(b.cutoffTiedExtra).toBe(2);
    expect(b.cutoffEliminations).toBe(5);
  });

  it('marks a tie at the top', () => {
    const b = ready(
      selectTopKill([closedMap(1, [entry(1, 7, 4), entry(2, 7, 2), entry(3, 3, 1)])]),
    );
    expect(b.entries.map((e) => [e.teamNo, e.displayRank, e.tied])).toEqual([
      [2, 1, true],
      [1, 1, true],
      [3, 3, false],
    ]);
  });

  it('uses competition ranking across many ties', () => {
    const b = ready(
      selectTopKill([
        closedMap(1, [
          entry(1, 4, 6),
          entry(2, 4, 5),
          entry(3, 4, 4),
          entry(4, 4, 3),
          entry(5, 4, 2),
          entry(6, 9, 1),
        ]),
      ]),
    );
    expect(b.entries.map((e) => e.displayRank)).toEqual([1, 2, 2, 2]);
    expect(b.entries.map((e) => e.teamNo)).toEqual([6, 5, 4, 3]);
    expect(b.cutoffTiedExtra).toBe(2);
    expect(b.cutoffEliminations).toBe(4);
  });

  it('breaks ties by placement, then team number, with missing placement last', () => {
    const noPlacement = {
      ...entry(1, 5, 1),
      placement: undefined,
    } as unknown as ClosedMapTeamResult;
    const b = ready(
      selectTopKill([closedMap(1, [noPlacement, entry(9, 5, 3), entry(4, 5, 3), entry(2, 5, 2)])]),
    );
    expect(b.entries.map((e) => e.teamNo)).toEqual([2, 4, 9, 1]);
    expect(b.entries[3].placement).toBeNull();
  });

  it('reads only the last closed map', () => {
    const b = ready(
      selectTopKill([closedMap(1, [entry(1, 20, 1)]), closedMap(2, [entry(2, 3, 1)])]),
    );
    expect(b.entries.map((e) => e.teamNo)).toEqual([2]);
    expect(b.map.mapNumber).toBe(2);
  });

  it('keeps the snapshot identity after a roster rename and falls back to roster when absent', () => {
    const roster = new Map([
      [1, { name: 'Renamed One', logoUrl: 'https://new/1.png' }],
      [2, { name: 'Roster Two', logoUrl: 'https://roster/2.png' }],
    ]);
    const legacy = {
      ...entry(2, 3, 2),
      name: undefined,
      logoUrl: undefined,
    } as ClosedMapTeamResult;
    const b = ready(
      selectTopKill([closedMap(1, [entry(1, 5, 1), legacy])], { rosterByNo: roster }),
    );
    expect(b.entries[0]).toMatchObject({ name: 'Snap 1', logoUrl: 'https://logo/1.png' });
    expect(b.entries[1]).toMatchObject({ name: 'Roster Two', logoUrl: 'https://roster/2.png' });
  });

  it('keeps a recorded null logo and names unknown teams by slot', () => {
    const b = ready(
      selectTopKill(
        [
          closedMap(1, [
            entry(1, 5, 1, { logoUrl: null }),
            { ...entry(3, 2, 2), name: undefined, logoUrl: undefined } as ClosedMapTeamResult,
          ]),
        ],
        {
          rosterByNo: new Map([[1, { name: 'R1', logoUrl: 'https://r/1.png' }]]),
        },
      ),
    );
    expect(b.entries[0].logoUrl).toBeNull();
    expect(b.entries[1]).toMatchObject({ name: 'Team 3', logoUrl: null });
  });

  it('reports match points including additional points', () => {
    const b = ready(
      selectTopKill([
        closedMap(1, [
          entry(1, 5, 2, {
            killPoints: 5,
            placementPoints: 6,
            additionalPoints: -2,
            totalPoints: 9,
          }),
        ]),
      ]),
    );
    expect(b.entries[0]).toMatchObject({ killPoints: 5, matchPoints: 9, placement: 2 });
  });

  it('returns no-map without closed maps and a labelled sample in preview', () => {
    expect(selectTopKill(undefined)).toEqual({ status: 'no-map' });
    expect(selectTopKill([])).toEqual({ status: 'no-map' });
    const p = ready(selectTopKill([], { isPreviewSimulation: true }));
    expect(p.status).toBe('preview');
    expect(p.entries.length).toBe(4);
    expect(p.entries.every((e) => e.name.startsWith('Sample'))).toBe(true);
  });

  it('does not mutate its input', () => {
    const maps = [closedMap(1, [entry(1, 1, 3), entry(2, 9, 1)])];
    const snapshot = structuredClone(maps);
    selectTopKill(maps);
    expect(maps).toEqual(snapshot);
  });
});
