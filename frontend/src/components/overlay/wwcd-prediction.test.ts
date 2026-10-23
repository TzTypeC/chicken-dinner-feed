import type { MatchState, Team } from '@cdf/shared';
import { describe, expect, it } from 'vitest';
import {
  computeWwcdPrediction,
  largestRemainderPercentages,
  type WwcdPrediction,
} from './wwcd-prediction';

function team(teamNo: number, standing: number, overrides: Partial<Team> = {}): Team {
  return {
    teamNo,
    name: `Team ${teamNo}`,
    logoUrl: null,
    players: [],
    standingPlayerCount: standing,
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
const out = (teamNo: number, placement: number) =>
  team(teamNo, 0, { isEliminated: true, placement });

function match(teams: Team[]): MatchState {
  return { matchId: 'm1', phase: 'live', standingTeamCount: teams.length, teams };
}

const run = (
  teams: Team[],
  cohort = teams.filter((t) => !t.isEliminated).map((t) => t.teamNo),
  ingestState: 'disconnected' | 'connecting' | 'connected' | 'stale' = 'connected',
) =>
  computeWwcdPrediction({
    match: match([out(20, 5), ...teams]),
    cohortTeamNos: cohort,
    ingestState,
  });

const percents = (p: WwcdPrediction) => p.entries.map((e) => e.percent);

describe('largestRemainderPercentages', () => {
  it('sums to 100 and stays within ±1 of exact over random inputs', () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 2000; round++) {
      const n = 1 + Math.floor(rand() * 8);
      const items = Array.from({ length: n }, (_, key) => ({
        key,
        value: round % 2 ? Math.floor(rand() * 5) : rand() * 100,
      }));
      const total = items.reduce((s, i) => s + i.value, 0);
      const result = largestRemainderPercentages(items);
      if (total === 0) {
        expect(result.size).toBe(0);
        continue;
      }
      expect([...result.values()].reduce((s, v) => s + v, 0)).toBe(100);
      for (const item of items) {
        const value = result.get(item.key)!;
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
        expect(Math.abs(value - (item.value * 100) / total)).toBeLessThan(1);
      }
    }
  });

  it('rounds the known case', () => {
    const r = largestRemainderPercentages([
      { key: 1, value: 13.63 },
      { key: 2, value: 47.99 },
      { key: 3, value: 9.6 },
      { key: 4, value: 28.79 },
    ]);
    expect([...r.entries()]).toEqual([
      [1, 14],
      [2, 48],
      [3, 9],
      [4, 29],
    ]);
  });

  it('breaks a three-way tie deterministically towards the smaller key', () => {
    const r = largestRemainderPercentages([
      { key: 7, value: 1 },
      { key: 3, value: 1 },
      { key: 5, value: 1 },
    ]);
    expect(r.get(3)).toBe(34);
    expect(r.get(5)).toBe(33);
    expect(r.get(7)).toBe(33);
  });

  it('returns an empty map when every value is zero', () => {
    expect(
      largestRemainderPercentages([
        { key: 1, value: 0 },
        { key: 2, value: 0 },
      ]).size,
    ).toBe(0);
  });
});

describe('computeWwcdPrediction', () => {
  it('4/3/2/1 → 40/30/20/10, sorted by teamNo', () => {
    const p = run([team(9, 1), team(2, 4), team(5, 3), team(7, 2)]);
    expect(p.status).toBe('live');
    expect(p.entries.map((e) => e.teamNo)).toEqual([2, 5, 7, 9]);
    expect(percents(p)).toEqual([40, 30, 20, 10]);
    expect(p.totalStandingPlayers).toBe(10);
  });

  it('equal counts → equal shares; 3/2/1 → 50/33/17', () => {
    expect(percents(run([team(1, 3), team(2, 3), team(3, 3), team(4, 3)]))).toEqual([
      25, 25, 25, 25,
    ]);
    expect(percents(run([team(1, 3), team(2, 2), team(3, 1)]))).toEqual([50, 33, 17]);
  });

  it('ignores elims and points', () => {
    const plain = run([team(1, 2), team(2, 2)]);
    const rich = run([
      team(1, 2, { eliminations: 12, totalPoints: 40, rank: 1 }),
      team(2, 2, { rank: 2 }),
    ]);
    expect(rich.entries).toEqual(plain.entries);
  });

  it('counts knocked players as standing (standingPlayerCount)', () => {
    const knocked = team(1, 3, {
      players: [
        { status: 'alive' },
        { status: 'knocked' },
        { status: 'knocked' },
        { status: 'dead' },
      ] as unknown as Team['players'],
    });
    expect(percents(run([knocked, team(2, 1)]))).toEqual([75, 25]);
  });

  it('is unavailable when any non-eliminated team has unknown status', () => {
    const p = run([team(1, 3), team(2, 2), team(11, 0)], [1, 2]);
    expect(p.status).toBe('unavailable');
    expect(p.entries).toEqual([]);
    expect(p.reason).toBeTruthy();
  });

  it('is unavailable when a cohort team reports 0 standing but is not eliminated', () => {
    const p = run([team(1, 3), team(2, 2), team(3, 0)], [1, 2, 3]);
    expect(p.status).toBe('unavailable');
    expect(p.entries).toEqual([]);
  });

  it('is unavailable when a standing team is outside the cohort', () => {
    expect(run([team(1, 3), team(2, 2), team(3, 1)], [1, 2]).status).toBe('unavailable');
  });

  it('holds entries as stale when stale or disconnected', () => {
    for (const state of ['stale', 'disconnected'] as const) {
      const p = run([team(1, 3), team(2, 1)], [1, 2], state);
      expect(p.status).toBe('stale');
      expect(p.reason).toBe('Data stale');
      expect(percents(p)).toEqual([75, 25]);
    }
  });

  it('is unavailable while connecting', () => {
    const p = run([team(1, 3), team(2, 1)], [1, 2], 'connecting');
    expect(p.status).toBe('unavailable');
    expect(p.entries).toEqual([]);
  });

  it('stops once the WWCD is provisional', () => {
    const p = run([team(1, 3), out(2, 2)], [1, 2]);
    expect(p.status).toBe('stopped');
    expect(p.entries).toEqual([]);
  });

  it('excludes knocked-out cohort teams from the set', () => {
    const p = run([team(1, 2), team(2, 2), out(3, 4)], [1, 2, 3]);
    expect(p.entries.map((e) => e.teamNo)).toEqual([1, 2]);
    expect(percents(p)).toEqual([50, 50]);
  });

  it('never rounds a standing team to 0 in the extreme 1 vs 15 case', () => {
    const p = run([team(1, 1), team(2, 15)], [1, 2]);
    expect(percents(p)).toEqual([6, 94]);
  });

  it('is deterministic', () => {
    const teams = [team(1, 1), team(2, 1), team(3, 1)];
    expect(run(teams)).toEqual(run(teams));
  });
});
