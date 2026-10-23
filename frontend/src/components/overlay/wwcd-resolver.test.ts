import type { ClosedMapResult, ClosedMapTeamResult, MatchState, Team } from '@cdf/shared';
import { describe, expect, it } from 'vitest';
import {
  resolveLeaderboardLayoutMode,
  selectPostGameResults,
  selectWwcdWinner,
} from './broadcast-state';
import { resolveClosedWwcd, resolveLiveWwcd } from './wwcd-resolver';

function team(teamNo: number, overrides: Partial<Team> = {}): Team {
  return {
    teamNo,
    name: `Team ${teamNo}`,
    logoUrl: null,
    players: [],
    standingPlayerCount: 4,
    eliminations: 0,
    killPoints: 0,
    placementPoints: 0,
    totalPoints: 0,
    rank: teamNo,
    placement: null,
    isEliminated: false,
    hasAppeared: true,
    ...overrides,
  };
}

const out = (teamNo: number, overrides: Partial<Team> = {}) =>
  team(teamNo, { isEliminated: true, standingPlayerCount: 0, ...overrides });

function match(teams: Team[], overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchId: 'live-1',
    phase: 'live',
    teams,
    standingTeamCount: teams.filter((t) => t.hasAppeared && !t.isEliminated).length,
    ...overrides,
  };
}

function closedEntry(
  teamNo: number,
  placement: number,
  overrides: Partial<ClosedMapTeamResult> = {},
): ClosedMapTeamResult {
  return {
    teamNo,
    placement,
    eliminations: 0,
    killPoints: 0,
    placementPoints: 0,
    totalPoints: 0,
    name: `Snapshot ${teamNo}`,
    logoUrl: null,
    ...overrides,
  };
}

function closedMap(
  teams: ClosedMapTeamResult[],
  overrides: Partial<ClosedMapResult> = {},
): ClosedMapResult {
  return {
    id: 'map-1',
    mapNumber: 1,
    mapName: 'Erangel',
    matchId: 'live-1',
    startedAt: null,
    endedAt: 1,
    teams,
    ...overrides,
  };
}

const INFO = { matchNumber: 2, mapName: 'Miramar' };

/** The reported case: Team A out 2nd with 6 kills, Team B the survivor with 0 kills and fewer points. */
function reportedCase(): MatchState {
  return match([
    out(1, {
      name: 'Team A',
      eliminations: 6,
      killPoints: 6,
      placementPoints: 6,
      totalPoints: 12,
      placement: 2,
      rank: 1,
    }),
    team(2, { name: 'Team B', placementPoints: 10, totalPoints: 10, rank: 2 }),
    out(3, { name: 'Team C', placement: 3, placementPoints: 5, totalPoints: 5, rank: 3 }),
  ]);
}

describe('resolveLiveWwcd (unclosed map)', () => {
  it('confirms a sole survivor with positive alive evidence as provisional', () => {
    const result = resolveLiveWwcd(reportedCase());
    expect(result.state).toBe('provisional');
    expect(result.winner?.teamNo).toBe(2);
  });

  it('is running while two teams stand, and while nobody has been eliminated', () => {
    expect(resolveLiveWwcd(match([team(1), team(2), out(3)])).state).toBe('running');
    expect(resolveLiveWwcd(match([team(1), team(2)])).state).toBe('running');
  });

  it('is none when idle', () => {
    expect(resolveLiveWwcd(match([team(1), out(2)], { phase: 'idle' })).state).toBe('none');
  });

  it('does not confirm a survivor while another appeared team has no player data', () => {
    const partial = match([team(1), team(2, { standingPlayerCount: 0 }), out(3)]);
    expect(resolveLiveWwcd(partial).state).toBe('unconfirmed');
  });

  it('is unconfirmed when nobody is confirmed standing', () => {
    expect(resolveLiveWwcd(match([out(1), out(2)])).state).toBe('unconfirmed');
  });

  it('is unconfirmed when the API placement #1 disagrees with the survivor', () => {
    const conflict = match([team(1), out(2, { placement: 1 })]);
    expect(resolveLiveWwcd(conflict).state).toBe('unconfirmed');
  });

  it('accepts an API placement #1 that agrees with the survivor', () => {
    const agrees = match([team(1, { placement: 1 }), out(2, { placement: 2 })]);
    expect(resolveLiveWwcd(agrees).winner?.teamNo).toBe(1);
  });

  it('ignores teams that never appeared in this match', () => {
    const lobby = match([team(1), out(2), team(9, { hasAppeared: false, standingPlayerCount: 0 })]);
    expect(resolveLiveWwcd(lobby).winner?.teamNo).toBe(1);
  });

  it('never names the top scorer, the rank-1 team, the first array entry or the lowest teamNo', () => {
    const result = resolveLiveWwcd(reportedCase());
    expect(result.winner?.teamNo).not.toBe(1); // top scorer, rank 1, first in the array, lowest teamNo
  });
});

describe('resolveClosedWwcd (recorded map)', () => {
  it('names the single placement #1', () => {
    const result = resolveClosedWwcd(closedMap([closedEntry(4, 2), closedEntry(7, 1)]));
    expect(result).toMatchObject({ state: 'final', winner: { teamNo: 7 } });
  });

  it('names nobody when there is no #1 or more than one', () => {
    expect(resolveClosedWwcd(closedMap([closedEntry(1, 2), closedEntry(2, 3)])).winner).toBeNull();
    expect(resolveClosedWwcd(closedMap([closedEntry(1, 1), closedEntry(2, 1)])).state).toBe(
      'final-invalid',
    );
  });
});

describe('selectPostGameResults for the current map (provisional) — the reported bug', () => {
  it('crowns the confirmed survivor (#1), not the highest scorer, and says it is provisional', () => {
    const board = selectPostGameResults(reportedCase(), null, INFO, { closedMaps: [] })!;

    expect(board.status).toBe('provisional');
    expect(board.winner?.teamNo).toBe(2);
    expect(board.winner?.placement).toBe(1);
    // The table is still the competitive match ranking: Team A (12 pts) is first.
    expect(board.rows[0]?.teamNo).toBe(1);
    // No placement is invented from the table position: nobody else is "#1" and Team A keeps #2.
    expect(board.rows.filter((row) => row.placement === 1)).toHaveLength(1);
    expect(board.rows.find((row) => row.teamNo === 1)?.placement).toBe(2);
  });

  it('shows the finished current map instead of the previous closed map', () => {
    const previous = closedMap([closedEntry(1, 1), closedEntry(3, 2)], {
      id: 'old',
      matchId: 'm-0',
    });
    const board = selectPostGameResults(reportedCase(), previous, INFO, {
      closedMaps: [previous],
    })!;

    expect(board.status).toBe('provisional');
    expect(board.mapNumber).toBe(2);
    expect(board.winner?.teamNo).toBe(2);
  });

  it('reports "unconfirmed" with no winner when the survivor cannot be confirmed', () => {
    const partial = match([team(1), team(2, { standingPlayerCount: 0 }), out(3)]);
    const board = selectPostGameResults(partial, null, INFO, { closedMaps: [] })!;

    expect(board.status).toBe('unconfirmed');
    expect(board.winner).toBeNull();
    expect(board.rows.some((row) => row.placement === 1)).toBe(false);
  });

  it('becomes final, with the same team, once the map is closed', () => {
    const live = reportedCase();
    const closed = closedMap(
      [
        closedEntry(2, 1, { name: 'Team B', totalPoints: 10 }),
        closedEntry(1, 2, { name: 'Team A', totalPoints: 12, eliminations: 6 }),
        closedEntry(3, 3, { name: 'Team C', totalPoints: 5 }),
      ],
      { matchId: 'live-1' },
    );
    const before = selectPostGameResults(live, null, INFO, { closedMaps: [] })!;
    const after = selectPostGameResults(live, closed, INFO, { closedMaps: [closed] })!;

    expect(before.status).toBe('provisional');
    expect(after.status).toBe('final');
    expect(after.sourceKind).toBe('closed-map');
    expect(after.winner?.teamNo).toBe(before.winner?.teamNo);
  });

  it('shows the previous closed map while the current map is still running', () => {
    const previous = closedMap([closedEntry(1, 1), closedEntry(3, 2)], {
      id: 'old',
      matchId: 'm-0',
    });
    const board = selectPostGameResults(match([team(1), team(2), out(3)]), previous, INFO, {
      closedMaps: [previous],
    })!;

    expect(board.status).toBe('final');
    expect(board.mapId).toBe('old');
  });
});

describe('selectPostGameResults for recorded maps', () => {
  it('names the placement #1, even when another team has more points', () => {
    const map = closedMap([
      closedEntry(1, 2, { eliminations: 6, killPoints: 6, placementPoints: 6, totalPoints: 12 }),
      closedEntry(2, 1, { placementPoints: 10, totalPoints: 10 }),
    ]);
    const board = selectPostGameResults(match([]), map, INFO, { closedMaps: [map] })!;

    expect(board.status).toBe('final');
    expect(board.winner?.teamNo).toBe(2);
    expect(board.rows[0]?.teamNo).toBe(1);
  });

  it('does not promote #2 when a recorded map has no #1', () => {
    const map = closedMap([closedEntry(1, 2, { totalPoints: 12 }), closedEntry(2, 3)]);
    const board = selectPostGameResults(match([]), map, INFO, { closedMaps: [map] })!;

    expect(board.status).toBe('not-recorded');
    expect(board.winner).toBeNull();
  });

  it('keeps the snapshot identity after a rename or renumber of the live roster', () => {
    const map = closedMap(
      [closedEntry(4, 1, { name: 'Old Name', logoUrl: '/api/logos/old.png' })],
      {
        matchId: 'm-old',
      },
    );
    const renamed = match([team(4, { name: 'New Name', logoUrl: null })], { matchId: 'm-new' });
    const board = selectPostGameResults(renamed, map, INFO, { closedMaps: [map] })!;

    expect(board.winner?.name).toBe('Old Name');
    expect(board.winner?.logoUrl).toBe('/api/logos/old.png');
  });

  it('breaks equal total points with kill points, then placement, then teamNo (unchanged official order)', () => {
    const map = closedMap([
      closedEntry(3, 2, { totalPoints: 10, killPoints: 4 }),
      closedEntry(2, 1, { totalPoints: 10, killPoints: 0 }),
      closedEntry(1, 3, { totalPoints: 10, killPoints: 4 }),
    ]);
    const board = selectPostGameResults(match([]), map, INFO, { closedMaps: [map] })!;
    expect(board.rows.map((row) => row.teamNo)).toEqual([3, 1, 2]);
  });
});

describe('selectWwcdWinner', () => {
  it('names the provisional survivor, flagged provisional, with a live source', () => {
    const winner = selectWwcdWinner(reportedCase(), null, { closedMaps: [] });
    expect(winner).toMatchObject({
      teamNo: 2,
      provisional: true,
      sourceKind: 'live',
      matchPoints: 10,
    });
  });

  it('is final and uses the recorded result once the shown match is closed', () => {
    const map = closedMap(
      [closedEntry(2, 1, { name: 'Team B', totalPoints: 12, killPoints: 2, placementPoints: 10 })],
      { matchId: 'live-1' },
    );
    const winner = selectWwcdWinner(reportedCase(), map, { closedMaps: [map] });
    expect(winner).toMatchObject({
      teamNo: 2,
      provisional: false,
      sourceKind: 'closed-map',
      matchPoints: 12,
    });
  });

  it('names nobody when the current map cannot be confirmed — not even the previous map winner', () => {
    const previous = closedMap([closedEntry(1, 1)], { id: 'old', matchId: 'm-0' });
    const partial = match([team(1), team(2, { standingPlayerCount: 0 }), out(3)]);
    expect(
      selectWwcdWinner(partial, previous, { allowClosedMapFallback: true, closedMaps: [previous] }),
    ).toBeNull();
  });

  it('uses snapshot identity, not the current roster, for a recorded winner', () => {
    const map = closedMap(
      [closedEntry(4, 1, { name: 'Old Name', logoUrl: '/api/logos/old.png' })],
      {
        matchId: 'm-old',
      },
    );
    const renamed = match([team(4, { name: 'New Name', logoUrl: '/api/logos/new.png' })], {
      matchId: 'm-new',
      phase: 'idle',
    });
    const winner = selectWwcdWinner(renamed, map, {
      allowClosedMapFallback: true,
      closedMaps: [map],
    });

    expect(winner?.name).toBe('Old Name');
    expect(winner?.logoUrl).toBe('/api/logos/old.png');
    expect(winner?.aliveCount).toBeNull();
    expect(winner?.players).toEqual([]);
  });

  it('does not promote #2 when the recorded map has no #1', () => {
    const map = closedMap([closedEntry(1, 2), closedEntry(2, 3)], { matchId: 'm-old' });
    const idle = match([], { matchId: null, phase: 'idle' });
    expect(
      selectWwcdWinner(idle, map, { allowClosedMapFallback: true, closedMaps: [map] }),
    ).toBeNull();
  });

  it('never fabricates a roster team in the admin preview', () => {
    const idle = match([team(1, { rank: 1, name: 'Rank One' }), team(2)], { phase: 'idle' });
    const sample = selectWwcdWinner(idle, null, { isPreviewSimulation: true });
    expect(sample?.sourceKind).toBe('preview');
    expect(sample?.name).toBe('PREVIEW SAMPLE');
  });

  it('sums the series total from the records, not from the running match', () => {
    const map1 = closedMap([closedEntry(2, 1, { totalPoints: 12 })], { id: 'a', matchId: 'm-1' });
    const map2 = closedMap([closedEntry(2, 1, { totalPoints: 15 })], { id: 'b', matchId: 'm-2' });
    const running = match([team(2, { totalPoints: 999 }), team(3)], { matchId: 'm-3' });
    const winner = selectWwcdWinner(running, map2, {
      allowClosedMapFallback: true,
      closedMaps: [map1, map2],
    });
    expect(winner?.seriesPoints).toBe(27);
  });
});

describe('automatic WWCD layout', () => {
  const appearance = { showFinalFourLayout: true, showWwcdOverlay: true };

  it('switches to the WWCD screen only for a confirmed survivor', () => {
    expect(resolveLeaderboardLayoutMode(reportedCase(), appearance)).toBe('wwcd');
  });

  it('does not switch when a team has unknown status', () => {
    const partial = match([team(1), team(2, { standingPlayerCount: 0 }), out(3)]);
    expect(resolveLeaderboardLayoutMode(partial, appearance)).not.toBe('wwcd');
  });
});
