import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TeamRosterEntry } from '@cdf/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ManualStore, resolveManualPlacements } from './manual-store.js';
import { MatchStore } from './match-store.js';

function makeRoster(...teamNos: number[]): TeamRosterEntry[] {
  return teamNos.map((teamNo) => ({
    teamNo,
    name: `Team ${teamNo}`,
    logoUrl: null,
  }));
}

describe('ManualStore', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'cdf-manual-store-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('initialises a default manual match document for the configured roster and persists it to disk', async () => {
    const roster = makeRoster(1, 2, 3);
    const store = new ManualStore({ dataDir: tempDir, roster });
    const loaded = await store.load();

    expect(loaded.mode).toBe('auto');
    expect(loaded.matchId).toMatch(/^manual-/);
    expect(loaded.teams).toEqual([
      {
        teamNo: 1,
        present: true,
        aliveCount: 4,
        eliminations: 0,
        eliminatedSeq: null,
        placementOverride: null,
      },
      {
        teamNo: 2,
        present: true,
        aliveCount: 4,
        eliminations: 0,
        eliminatedSeq: null,
        placementOverride: null,
      },
      {
        teamNo: 3,
        present: true,
        aliveCount: 4,
        eliminations: 0,
        eliminatedSeq: null,
        placementOverride: null,
      },
    ]);
  });

  it('persists mode and team edits across store reloads and reconciles roster changes', async () => {
    const store = new ManualStore({ dataDir: tempDir, roster: makeRoster(1, 2, 3) });
    await store.load();

    await store.setMode('manual');
    await store.patchTeam(2, { aliveCount: 2, eliminations: 5 });

    // Reload with team 1 removed and team 4 added.
    const reloaded = new ManualStore({ dataDir: tempDir, roster: makeRoster(2, 3, 4) });
    const doc = await reloaded.load();

    expect(doc.mode).toBe('manual');
    expect(doc.teams.map((t) => t.teamNo)).toEqual([2, 3, 4]);
    expect(doc.teams.find((t) => t.teamNo === 2)).toMatchObject({
      aliveCount: 2,
      eliminations: 5,
    });
    expect(doc.teams.find((t) => t.teamNo === 4)).toMatchObject({
      aliveCount: 4,
      eliminations: 0,
    });
  });

  it('tracks reversible elimination order and Projects all 4 player slots into MatchStore', async () => {
    const roster = makeRoster(1, 2, 3, 4);
    const manualStore = new ManualStore({ dataDir: tempDir, roster });
    await manualStore.load();

    const matchStore = new MatchStore({ source: 'manual', roster });

    // Wipe Team 3 first (#4), then Team 1 second (#3).
    await manualStore.patchTeam(3, { aliveCount: 0, eliminations: 1 });
    await manualStore.patchTeam(1, { aliveCount: 0, eliminations: 4 });
    await manualStore.patchTeam(2, { aliveCount: 3, eliminations: 6 });

    matchStore.applyUpdate(manualStore.toIngestUpdate(roster));
    let projection = matchStore.project();

    const byTeam = new Map(projection.match.teams.map((t) => [t.teamNo, t]));
    expect(byTeam.get(3)?.isEliminated).toBe(true);
    expect(byTeam.get(3)?.placement).toBe(4);
    expect(byTeam.get(1)?.isEliminated).toBe(true);
    expect(byTeam.get(1)?.placement).toBe(3);
    expect(byTeam.get(2)?.isEliminated).toBe(false);
    expect(byTeam.get(2)?.placement).toBeNull();
    expect(byTeam.get(2)?.standingPlayerCount).toBe(3);
    expect(byTeam.get(2)?.players.map((p) => p.liveState)).toEqual([
      'alive',
      'alive',
      'alive',
      'dead',
    ]);

    // Operator realizes Team 3 was not actually wiped and restores 1 survivor:
    // Team 3 returns to live play (`placement: null`), and Team 1 moves down to #4!
    await manualStore.patchTeam(3, { aliveCount: 1 });
    matchStore.applyUpdate(manualStore.toIngestUpdate(roster));
    projection = matchStore.project();

    const afterUndo = new Map(projection.match.teams.map((t) => [t.teamNo, t]));
    expect(afterUndo.get(3)?.isEliminated).toBe(false);
    expect(afterUndo.get(3)?.placement).toBeNull();
    expect(afterUndo.get(1)?.isEliminated).toBe(true);
    expect(afterUndo.get(1)?.placement).toBe(4);
  });

  it('marks non-participating teams (present: false) as hasAppeared: false and excludes them from placement pool', async () => {
    const roster = makeRoster(1, 2, 3);
    const manualStore = new ManualStore({ dataDir: tempDir, roster });
    await manualStore.load();

    const matchStore = new MatchStore({ source: 'manual', roster });

    // Team 3 is not in this lobby; Team 2 is wiped out first among the 2 present teams (#2).
    await manualStore.patchTeam(3, { present: false });
    await manualStore.patchTeam(2, { aliveCount: 0 });

    matchStore.applyUpdate(manualStore.toIngestUpdate(roster));
    const { match } = matchStore.project();

    const team1 = match.teams.find((t) => t.teamNo === 1);
    const team2 = match.teams.find((t) => t.teamNo === 2);
    const team3 = match.teams.find((t) => t.teamNo === 3);

    expect(team1?.hasAppeared).toBe(true);
    expect(team2?.hasAppeared).toBe(true);
    expect(team2?.placement).toBe(2); // 2nd out of 2 present teams, not 3rd!
    expect(team3?.hasAppeared).toBe(false);
    expect(team3?.placement).toBeNull();
  });

  it('honours explicit placementOverride and rejects duplicate overrides across participating teams', async () => {
    const roster = makeRoster(1, 2, 3);
    const manualStore = new ManualStore({ dataDir: tempDir, roster });
    await manualStore.load();

    await manualStore.patchTeam(1, { aliveCount: 0, placementOverride: 2 });
    await expect(manualStore.patchTeam(2, { placementOverride: 2 })).rejects.toThrow(
      /same placement override/i,
    );

    const placements = resolveManualPlacements(manualStore.getState().teams);
    expect(placements.get(1)).toBe(2);
  });

  it('never marks a manual MatchStore as stale during operator pauses', async () => {
    const roster = makeRoster(1, 2);
    const manualStore = new ManualStore({ dataDir: tempDir, roster });
    await manualStore.load();

    const matchStore = new MatchStore({ source: 'manual', roster, staleAfterMs: 10 });
    matchStore.applyUpdate(manualStore.toIngestUpdate(roster), 1_000);

    expect(matchStore.markStaleIfSilent(100_000)).toBe(false);
    expect(matchStore.project().ingest.state).toBe('connected');
  });

  it('seeds manual match state from PCOB standings during mid-match failover', async () => {
    const roster = makeRoster(1, 2, 3);
    const autoStore = new MatchStore({ source: 'pcob', roster });

    // Simulate a PCOB match where Team 1 is alive with 3 players & 5 kills,
    // Team 2 was wiped at #2 with 2 kills, and Team 3 never appeared.
    autoStore.applyUpdate({
      matchId: 'pcob-99',
      phase: 'live',
      players: [
        {
          id: 'p1-1',
          name: 'P1',
          teamNo: 1,
          slot: 1,
          liveState: 'alive',
          health: 100,
          healthMax: 100,
          kills: 5,
          rank: 0,
        },
        {
          id: 'p1-2',
          name: 'P2',
          teamNo: 1,
          slot: 2,
          liveState: 'knocked',
          health: 50,
          healthMax: 100,
          kills: 0,
          rank: 0,
        },
        {
          id: 'p1-3',
          name: 'P3',
          teamNo: 1,
          slot: 3,
          liveState: 'alive',
          health: 80,
          healthMax: 100,
          kills: 0,
          rank: 0,
        },
        {
          id: 'p2-1',
          name: 'P4',
          teamNo: 2,
          slot: 1,
          liveState: 'dead',
          health: 0,
          healthMax: 100,
          kills: 2,
          rank: 2,
        },
      ],
    });

    const manualStore = new ManualStore({ dataDir: tempDir, roster });
    await manualStore.load();

    const seeded = await manualStore.resetMatch({
      seedFromTeams: autoStore.project().match.teams,
    });

    expect(seeded.teams).toEqual([
      {
        teamNo: 1,
        present: true,
        aliveCount: 3,
        eliminations: 5,
        eliminatedSeq: null,
        placementOverride: null,
      },
      {
        teamNo: 2,
        present: true,
        aliveCount: 0,
        eliminations: 2,
        eliminatedSeq: 1,
        placementOverride: null,
      },
      {
        teamNo: 3,
        present: false,
        aliveCount: 4,
        eliminations: 0,
        eliminatedSeq: null,
        placementOverride: null,
      },
    ]);
  });
});
