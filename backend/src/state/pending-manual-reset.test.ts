import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ClosedMapResult } from '@cdf/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ManualStore } from './manual-store.js';
import { finishPendingManualReset } from './pending-manual-reset.js';
import { SeriesStore } from './series-store.js';

const roster = [
  { teamNo: 1, name: 'Alpha', logoUrl: null },
  { teamNo: 2, name: 'Bravo', logoUrl: null },
];

function closedMapFor(matchId: string | null): ClosedMapResult {
  return {
    id: `map-${matchId ?? 'hand'}`,
    mapNumber: 1,
    mapName: null,
    matchId,
    startedAt: null,
    endedAt: 1,
    teams: [
      {
        teamNo: 1,
        placement: 1,
        eliminations: 2,
        killPoints: 2,
        placementPoints: 10,
        totalPoints: 12,
      },
    ],
  };
}

describe('finishPendingManualReset (restart between close and reset)', () => {
  let dir: string;
  let manual: ManualStore;
  let series: SeriesStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cdf-pending-reset-'));
    manual = new ManualStore({ dataDir: dir, roster, defaultMode: 'manual' });
    await manual.load();
    series = new SeriesStore({ dataDir: dir });
    await series.load();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('finishes the reset when the manual match is already recorded, and keeps what was recorded', async () => {
    await manual.patchTeam(2, { aliveCount: 0, eliminations: 3 });
    const stale = manual.getState();
    await series.replaceState({
      ...series.getState(),
      closedMaps: [closedMapFor(stale.matchId)],
    });
    const recorded = JSON.stringify(series.getState());

    expect(await finishPendingManualReset(manual, series)).toBe(true);

    const fresh = manual.getState();
    expect(fresh.matchId).not.toBe(stale.matchId);
    expect(fresh.teams.every((team) => team.aliveCount === 4 && team.eliminations === 0)).toBe(
      true,
    );
    expect(JSON.stringify(series.getState())).toBe(recorded);
  });

  it('is idempotent: the second start finds nothing to do', async () => {
    await series.replaceState({
      ...series.getState(),
      closedMaps: [closedMapFor(manual.getState().matchId)],
    });

    expect(await finishPendingManualReset(manual, series)).toBe(true);
    const afterFirst = manual.getState();
    expect(await finishPendingManualReset(manual, series)).toBe(false);
    expect(manual.getState()).toEqual(afterFirst);
  });

  it('leaves a manual match that was never recorded alone', async () => {
    await manual.patchTeam(1, { eliminations: 4 });
    const before = manual.getState();

    expect(await finishPendingManualReset(manual, series)).toBe(false);
    expect(manual.getState()).toEqual(before);
  });

  it('never touches the manual draft while PCOB mode is active', async () => {
    await manual.setMode('auto');
    await series.replaceState({
      ...series.getState(),
      closedMaps: [closedMapFor(manual.getState().matchId)],
    });
    const before = manual.getState();

    expect(await finishPendingManualReset(manual, series)).toBe(false);
    expect(manual.getState()).toEqual(before);
  });
});
