import type { ClosedMapResult } from '@cdf/shared';
import { describe, expect, it } from 'vitest';
import { resolveMostImprovedRange, selectMostImproved } from './most-improved';

type Row = [teamNo: number, points: number, name?: string];

/** A closed map; placement follows array order, all points are placement points. */
function map(id: string, mapNumber: number, rows: Row[]): ClosedMapResult {
  return {
    id,
    mapNumber,
    mapName: null,
    matchId: null,
    startedAt: null,
    endedAt: mapNumber,
    teams: rows.map(([teamNo, points, name], i) => ({
      teamNo,
      placement: i + 1,
      eliminations: 0,
      killPoints: 0,
      placementPoints: points,
      totalPoints: points,
      ...(name !== undefined ? { name } : {}),
    })),
  };
}

const slots = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

/** Map 1: team n scores 100 − n (rank = n). Map 2: team 18 scores enough to reach rank 5. */
function eighteenToFive(): ClosedMapResult[] {
  const m1 = map(
    'm1',
    1,
    slots(20).map((n) => [n, 100 - n, `Team ${n}`]),
  );
  // After map 2: team n (≠18) = 100 − n; team 18 = 82 + 13 = 95, tied with team 5 but has a WWCD → 5th.
  const m2 = map('m2', 2, [
    [18, 13, 'Team 18'],
    ...slots(20)
      .filter((n) => n !== 18)
      .map((n): Row => [n, 0, `Team ${n}`]),
  ]);
  return [m1, m2];
}

describe('resolveMostImprovedRange', () => {
  const maps = [map('a', 1, [[1, 1]]), map('b', 2, [[1, 1]]), map('c', 3, [[1, 1]])];

  it('defaults previous → latest to the last two maps', () => {
    expect(resolveMostImprovedRange(maps, 'previous', 'latest')).toMatchObject({
      ok: true,
      fromIndex: 1,
      toIndex: 2,
    });
  });

  it.each([
    ['a', 'b', 0, 1],
    ['b', 'c', 1, 2],
    ['a', 'c', 0, 2],
    ['previous', 'b', 0, 1],
  ])('resolves %s → %s', (from, to, fromIndex, toIndex) => {
    expect(resolveMostImprovedRange(maps, from, to)).toMatchObject({
      ok: true,
      fromIndex,
      toIndex,
    });
  });

  it('rejects reversed and equal ranges', () => {
    expect(resolveMostImprovedRange(maps, 'c', 'a')).toMatchObject({
      ok: false,
      reason: 'invalid-range',
      message: 'The start match must be earlier than the end match.',
    });
    expect(resolveMostImprovedRange(maps, 'b', 'b')).toMatchObject({
      ok: false,
      reason: 'invalid-range',
    });
    expect(resolveMostImprovedRange(maps, 'previous', 'a')).toMatchObject({
      ok: false,
      reason: 'invalid-range',
    });
  });

  it('reports missing pinned ids', () => {
    expect(resolveMostImprovedRange(maps, 'zzz', 'latest')).toMatchObject({
      ok: false,
      reason: 'missing-from',
    });
    expect(resolveMostImprovedRange(maps, 'a', 'zzz')).toMatchObject({
      ok: false,
      reason: 'missing-to',
    });
  });

  it('needs two closed maps', () => {
    expect(resolveMostImprovedRange(maps.slice(0, 1), 'previous', 'latest')).toMatchObject({
      ok: false,
      reason: 'not-enough-maps',
    });
    expect(selectMostImproved(undefined, 'previous', 'latest')).toMatchObject({
      status: 'unavailable',
      reason: 'not-enough-maps',
    });
  });
});

describe('selectMostImproved', () => {
  it('finds the 18 → 5 climber (+13)', () => {
    const board = selectMostImproved(eighteenToFive(), 'previous', 'latest');
    expect(board.status).toBe('ready');
    if (board.status !== 'ready') return;
    expect(board.hero).toMatchObject({
      teamNo: 18,
      name: 'Team 18',
      startRank: 18,
      endRank: 5,
      improvement: 13,
      startPoints: 82,
      endPoints: 95,
    });
    expect(board.teamCount).toBe(20);
    expect(board.from.mapNumber).toBe(1);
    expect(board.to.mapNumber).toBe(2);
    // Teams 5..17 each dropped one place; none of them is a climber.
    expect(board.others).toEqual([]);
  });

  it('reports no climber when standings are unchanged', () => {
    const maps = [
      map('m1', 1, [
        [1, 10],
        [2, 5],
      ]),
      map('m2', 2, [
        [1, 10],
        [2, 5],
      ]),
    ];
    expect(selectMostImproved(maps, 'previous', 'latest')).toMatchObject({
      status: 'no-climber',
      excluded: [],
    });
  });

  it('never presents a dropping team as most improved', () => {
    const maps = [
      map('m1', 1, [
        [1, 10],
        [2, 5],
        [3, 1],
      ]),
      map('m2', 2, [
        [3, 20],
        [1, 0],
        [2, 0],
      ]),
    ];
    const board = selectMostImproved(maps, 'previous', 'latest');
    if (board.status !== 'ready') throw new Error(board.status);
    expect(board.hero).toMatchObject({ teamNo: 3, startRank: 3, endRank: 1, improvement: 2 });
    expect(board.others).toEqual([]);
  });

  it('orders equal improvements by end rank', () => {
    const m1 = map(
      'm1',
      1,
      slots(8).map((n): Row => [n, 80 - n * 10]),
    );
    // t7 (10) +45 → 55, t8 (0) +45 → 45. Totals: 70,60,50,40,30,20,55,45
    // Order: t1 70, t2 60, t7 55, t3 50, t8 45, t4 40, t5 30, t6 20 → t7 7→3 (+4), t8 8→5 (+3).
    // Make equal: t8 +54 → 54 → order t1,t2,t7 55,t8 54,t3 → t7 +4, t8 +4.
    const m2 = map('m2', 2, [[7, 45], [8, 54], ...[1, 2, 3, 4, 5, 6].map((n): Row => [n, 0])]);
    const board = selectMostImproved([m1, m2], 'previous', 'latest');
    if (board.status !== 'ready') throw new Error(board.status);
    expect(board.hero).toMatchObject({ teamNo: 7, endRank: 3, improvement: 4 });
    expect(board.others[0]).toMatchObject({ teamNo: 8, endRank: 4, improvement: 4 });
  });

  it('compares over a pinned multi-map range', () => {
    const maps = [
      map('m1', 1, [
        [1, 30],
        [2, 20],
        [3, 10],
      ]),
      map('m2', 2, [
        [3, 15],
        [1, 0],
        [2, 0],
      ]),
      map('m3', 3, [
        [3, 10],
        [1, 0],
        [2, 0],
      ]),
    ];
    // After m1: 1,2,3. After m2: t1 30, t3 25, t2 20. After m3: t3 35, t1 30, t2 20.
    const oneToThree = selectMostImproved(maps, 'm1', 'm3');
    if (oneToThree.status !== 'ready') throw new Error(oneToThree.status);
    expect(oneToThree.hero).toMatchObject({ teamNo: 3, startRank: 3, endRank: 1, improvement: 2 });
    const twoToThree = selectMostImproved(maps, 'm2', 'm3');
    if (twoToThree.status !== 'ready') throw new Error(twoToThree.status);
    expect(twoToThree.hero).toMatchObject({ teamNo: 3, startRank: 2, endRank: 1, improvement: 1 });
    expect(selectMostImproved(maps, 'm3', 'm1')).toMatchObject({
      status: 'unavailable',
      reason: 'invalid-range',
    });
  });

  it('excludes late joiners from comparison with a reason', () => {
    const maps = [
      map('m1', 1, [
        [1, 10, 'Alpha'],
        [2, 5, 'Bravo'],
      ]),
      map('m2', 2, [
        [3, 30, 'Charlie'],
        [2, 10, 'Bravo'],
        [1, 0, 'Alpha'],
      ]),
    ];
    // After m2: Charlie 30, Bravo 15, Alpha 10 → Bravo 2→2, Alpha 1→3. Charlie is new.
    const board = selectMostImproved(maps, 'previous', 'latest');
    expect(board).toMatchObject({
      status: 'no-climber',
      excluded: [{ teamNo: 3, name: 'Charlie', reason: 'new-after-start' }],
    });
  });

  it('excludes a slot whose snapshot name changed (possible renumber)', () => {
    const maps = [
      map('m1', 1, [
        [1, 10, 'Alpha'],
        [2, 5, 'Bravo'],
      ]),
      map('m2', 2, [
        [2, 20, 'Delta'],
        [1, 0, 'Alpha'],
      ]),
    ];
    const board = selectMostImproved(maps, 'previous', 'latest');
    expect(board.status).toBe('no-climber');
    if (board.status !== 'no-climber') return;
    expect(board.excluded).toHaveLength(1);
    expect(board.excluded[0]).toMatchObject({
      teamNo: 2,
      name: 'Delta',
      reason: 'identity-changed',
    });
    expect(board.excluded[0]!.detail).toContain('Bravo');
    expect(board.excluded[0]!.detail).toContain('Delta');
  });

  it('does not treat case or whitespace variations as a rename', () => {
    const maps = [
      map('m1', 1, [
        [1, 10, 'Alpha'],
        [2, 5, 'bravo  esports'],
      ]),
      map('m2', 2, [
        [2, 20, ' Bravo Esports '],
        [1, 0, 'Alpha'],
      ]),
    ];
    const board = selectMostImproved(maps, 'previous', 'latest');
    if (board.status !== 'ready') throw new Error(board.status);
    expect(board.excluded).toEqual([]);
    expect(board.hero).toMatchObject({ teamNo: 2, name: 'Bravo Esports', improvement: 1 });
  });

  it('reflects a correction to an earlier map', () => {
    const before = [
      map('m1', 1, [
        [1, 10],
        [2, 5],
      ]),
      map('m2', 2, [
        [2, 10],
        [1, 0],
      ]),
    ];
    // t2 5 → 15 overtakes t1 10.
    expect(selectMostImproved(before, 'previous', 'latest')).toMatchObject({
      status: 'ready',
      hero: { teamNo: 2, improvement: 1 },
    });
    // Corrected map 1: t1 actually scored 20 → t2 never overtakes.
    const corrected = [
      map('m1', 1, [
        [1, 20],
        [2, 5],
      ]),
      before[1]!,
    ];
    expect(selectMostImproved(corrected, 'previous', 'latest').status).toBe('no-climber');
  });

  it('ranks by places gained, not by points gained', () => {
    const maps = [
      map('m1', 1, [
        [1, 100],
        [2, 50],
        [3, 49],
        [4, 10],
      ]),
      // t1 gains the most points (+40) but cannot climb; t4 gains +45 and climbs 4 → 2.
      map('m2', 2, [
        [4, 45],
        [1, 40],
        [2, 0],
        [3, 0],
      ]),
    ];
    const board = selectMostImproved(maps, 'previous', 'latest');
    if (board.status !== 'ready') throw new Error(board.status);
    expect(board.hero).toMatchObject({ teamNo: 4, startRank: 4, endRank: 2, improvement: 2 });

    const pointsLeader = [
      map('m1', 1, [
        [1, 100],
        [2, 50],
        [3, 49],
        [4, 10],
      ]),
      map('m2', 2, [
        [3, 2],
        [1, 60],
        [2, 0],
        [4, 0],
      ]),
    ];
    // t1 +60 points stays 1st; t3 +2 points climbs 3 → 2.
    const b2 = selectMostImproved(pointsLeader, 'previous', 'latest');
    if (b2.status !== 'ready') throw new Error(b2.status);
    expect(b2.hero).toMatchObject({ teamNo: 3, improvement: 1, startPoints: 49, endPoints: 51 });
  });

  it('only counts teams from closed maps (live teams never appear)', () => {
    const board = selectMostImproved(eighteenToFive(), 'previous', 'latest');
    if (board.status !== 'ready') throw new Error(board.status);
    expect(board.teamCount).toBe(20);
    const roster = new Map([[25, { name: 'Live Only', logoUrl: null }]]);
    const withRoster = selectMostImproved(eighteenToFive(), 'previous', 'latest', {
      rosterByNo: roster,
    });
    if (withRoster.status !== 'ready') throw new Error(withRoster.status);
    expect(withRoster.teamCount).toBe(20);
    expect([withRoster.hero, ...withRoster.others].some((e) => e.teamNo === 25)).toBe(false);
  });

  it('falls back to roster then slot label for identity', () => {
    const maps = [
      map('m1', 1, [
        [1, 10],
        [2, 5],
      ]),
      map('m2', 2, [
        [2, 10],
        [1, 0],
      ]),
    ];
    const roster = new Map([[2, { name: 'Roster Two', logoUrl: 'x.png' }]]);
    const named = selectMostImproved(maps, 'previous', 'latest', { rosterByNo: roster });
    expect(named).toMatchObject({ hero: { name: 'Roster Two', logoUrl: 'x.png' } });
    expect(selectMostImproved(maps, 'previous', 'latest')).toMatchObject({
      hero: { name: 'Team T02' },
    });
  });

  it('preview shows a labelled sample only while fewer than two maps are closed', () => {
    const sample = selectMostImproved(eighteenToFive().slice(0, 1), 'previous', 'latest', {
      isPreviewSimulation: true,
    });
    expect(sample).toMatchObject({
      status: 'preview',
      hero: { teamNo: 0, startRank: 18, endRank: 5, improvement: 13 },
    });

    // With a real comparison the preview shows exactly what the browser source shows.
    expect(
      selectMostImproved(eighteenToFive(), 'previous', 'latest', { isPreviewSimulation: true }),
    ).toEqual(selectMostImproved(eighteenToFive(), 'previous', 'latest'));
  });
});
