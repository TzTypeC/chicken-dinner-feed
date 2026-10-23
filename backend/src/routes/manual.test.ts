import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { OperatingMode } from '@cdf/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigStore } from '../persistence/config-store.js';
import { ManualStore } from '../state/manual-store.js';
import { createDelegatingMatchStore, MatchStore } from '../state/match-store.js';
import { SeriesStore } from '../state/series-store.js';
import { healthRoutes } from './health.js';
import { manualRoutes } from './manual.js';
import { seriesRoutes } from './series.js';

describe('manual routes and mode switching', () => {
  let dir: string;
  let app: FastifyInstance;
  let configStore: ConfigStore;
  let seriesStore: SeriesStore;
  let manualStore: ManualStore;
  let autoMatch: MatchStore;
  let manualMatch: MatchStore;
  let activeStore: MatchStore;
  let autoPollingActive: boolean;
  /** Test seam: makes the next Reset Manual Match fail, to exercise the partial-failure path. */
  let failNextReset: boolean;

  const roster = [
    { teamNo: 1, name: 'Alpha', logoUrl: null },
    { teamNo: 2, name: 'Bravo', logoUrl: null },
    { teamNo: 3, name: 'Charlie', logoUrl: null },
  ];

  async function setupApp(initialMode?: OperatingMode): Promise<void> {
    configStore = new ConfigStore({ dataDir: dir });
    await configStore.load();
    await configStore.saveTeams({ schemaVersion: 1, teams: roster });

    seriesStore = new SeriesStore({ dataDir: dir });
    await seriesStore.load();

    manualStore = new ManualStore({ dataDir: dir, roster, defaultMode: initialMode ?? 'auto' });
    await manualStore.load();

    autoMatch = new MatchStore({
      source: 'pcob',
      roster,
      ruleset: configStore.scoring.current,
    });
    manualMatch = new MatchStore({
      source: 'manual',
      roster,
      ruleset: configStore.scoring.current,
    });

    activeStore = createDelegatingMatchStore(() =>
      manualStore.getMode() === 'manual' ? manualMatch : autoMatch,
    );

    const refreshSeriesContext = () => {
      const totals = seriesStore.getSeriesTotals();
      autoMatch.setSeriesContext(
        totals,
        seriesStore.getBankedPointsForMatch(autoMatch.currentMatchId()),
      );
      manualMatch.setSeriesContext(
        totals,
        seriesStore.getBankedPointsForMatch(manualMatch.currentMatchId()),
      );
    };

    const syncManualProjection = async () => {
      manualMatch.applyUpdate(manualStore.toIngestUpdate(roster));
      manualMatch.setStatus('connected', 'Manual mode active');
      await seriesStore.observeMatch(manualMatch.project(), Date.now());
      refreshSeriesContext();
    };
    await syncManualProjection();

    autoPollingActive = manualStore.getMode() === 'auto';

    app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(healthRoutes, {
      prefix: '/api',
      getActiveSource: () => (manualStore.getMode() === 'manual' ? 'manual' : 'pcob'),
    });

    // Same shape as app.ts: one reset mechanism for the route and for the close orchestration.
    const resetManualMatch = async () => {
      if (failNextReset) {
        failNextReset = false;
        throw new Error('simulated reset failure');
      }
      await manualStore.resetMatch({});
      await syncManualProjection();
    };

    await app.register(manualRoutes, {
      prefix: '/api',
      manual: manualStore,
      manualMatch,
      autoMatch,
      resetManualMatch,
      onManualStateChanged: async () => {
        await syncManualProjection();
      },
      onModeChanged: async (mode) => {
        if (mode === 'manual') {
          autoPollingActive = false;
          await syncManualProjection();
        } else {
          autoPollingActive = true;
          refreshSeriesContext();
        }
      },
    });

    await app.register(seriesRoutes, {
      prefix: '/api',
      series: seriesStore,
      match: activeStore,
      config: configStore,
      onSeriesChanged: () => {
        refreshSeriesContext();
      },
      afterMapClosed: async (closed) => {
        if (
          manualStore.getMode() !== 'manual' ||
          closed.matchId !== manualStore.getState().matchId
        ) {
          return 'skipped';
        }
        await resetManualMatch();
        return 'done';
      },
    });

    await app.ready();
  }

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cdf-manual-routes-'));
    failNextReset = false;
    await setupApp('auto');
  });

  afterEach(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('starts in PCOB (auto) mode by default and reports manual standings via GET /api/manual', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/manual' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.document.mode).toBe('auto');
    expect(body.document.teams).toHaveLength(3);
    expect(autoPollingActive).toBe(true);
    expect(activeStore.project().ingest.source).toBe('pcob');
  });

  it('starts directly in Manual mode when manual-match.json persisted mode="manual"', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/manual/mode',
      payload: { mode: 'manual' },
    });
    await app.close();

    // Rebuild app against the same dataDir to verify startup persistence.
    await setupApp();
    expect(manualStore.getMode()).toBe('manual');
    expect(autoPollingActive).toBe(false);
    expect(activeStore.project().ingest.source).toBe('manual');
  });

  it('switches cleanly between PCOB Mode and Manual Mode and handles rapid repeated toggling', async () => {
    for (const mode of ['manual', 'auto', 'manual', 'auto', 'manual'] as const) {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/manual/mode',
        payload: { mode },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().document.mode).toBe(mode);
    }

    expect(autoPollingActive).toBe(false);
    expect(activeStore.project().ingest.source).toBe('manual');

    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(health.json().ingestSource).toBe('manual');
  });

  it('isolates PCOB state and Manual state across mode switches and supports partial/reversible updates', async () => {
    // Populate PCOB state in autoMatch: Alpha has 8 kills, Bravo is dead.
    autoMatch.applyUpdate({
      matchId: 'pcob-live-1',
      phase: 'live',
      players: [
        {
          id: 'p1',
          name: 'A1',
          teamNo: 1,
          slot: 1,
          liveState: 'alive',
          health: 100,
          healthMax: 100,
          kills: 8,
          rank: 0,
        },
        {
          id: 'p2',
          name: 'B1',
          teamNo: 2,
          slot: 1,
          liveState: 'dead',
          health: 0,
          healthMax: 100,
          kills: 1,
          rank: 2,
        },
      ],
    });

    // Switch to Manual Mode and enter different manual values.
    await app.inject({
      method: 'PUT',
      url: '/api/manual/mode',
      payload: { mode: 'manual' },
    });

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/manual/teams/2',
      payload: { eliminations: 11, aliveCount: 3 },
    });
    expect(patchRes.statusCode).toBe(200);

    // Active store in Manual Mode reflects manual values (Bravo has 11 elims, 3 alive).
    const manualBravo = activeStore.project().match.teams.find((t) => t.teamNo === 2);
    expect(manualBravo?.eliminations).toBe(11);
    expect(manualBravo?.standingPlayerCount).toBe(3);

    // Switch back to PCOB Mode: PCOB state is untouched (Alpha 8 kills, Bravo 1 kill & eliminated).
    await app.inject({
      method: 'PUT',
      url: '/api/manual/mode',
      payload: { mode: 'auto' },
    });
    const pcobBravo = activeStore.project().match.teams.find((t) => t.teamNo === 2);
    expect(pcobBravo?.eliminations).toBe(1);
    expect(pcobBravo?.isEliminated).toBe(true);

    // Switch back to Manual Mode again: manual edits are still intact!
    await app.inject({
      method: 'PUT',
      url: '/api/manual/mode',
      payload: { mode: 'manual' },
    });
    expect(activeStore.project().match.teams.find((t) => t.teamNo === 2)?.eliminations).toBe(11);
  });

  it('switches to Manual Mode cleanly even when the PCOB API is in an error state', async () => {
    autoMatch.setStatus('error', 'ECONNREFUSED 127.0.0.1:10086');
    expect(activeStore.project().ingest.state).toBe('error');

    await app.inject({
      method: 'PUT',
      url: '/api/manual/mode',
      payload: { mode: 'manual' },
    });

    const proj = activeStore.project();
    expect(proj.ingest.source).toBe('manual');
    expect(proj.ingest.state).toBe('connected');
  });

  it('rejects invalid manual payloads with HTTP 400 and preserves previous valid state', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/api/manual/teams/1',
      payload: { eliminations: 4, aliveCount: 2 },
    });

    // Invalid aliveCount (> 4)
    const badAlive = await app.inject({
      method: 'PATCH',
      url: '/api/manual/teams/1',
      payload: { aliveCount: 9 },
    });
    expect(badAlive.statusCode).toBe(400);

    // Unknown teamNo (not in roster)
    const unknownTeam = await app.inject({
      method: 'PATCH',
      url: '/api/manual/teams/25',
      payload: { eliminations: 2 },
    });
    expect(unknownTeam.statusCode).toBe(400);

    // Duplicate placementOverride in bulk PUT
    const dupPlacement = await app.inject({
      method: 'PUT',
      url: '/api/manual/teams',
      payload: {
        teams: [
          { teamNo: 1, placementOverride: 1 },
          { teamNo: 2, placementOverride: 1 },
        ],
      },
    });
    expect(dupPlacement.statusCode).toBe(400);

    // Previous valid state on Team 1 is preserved
    const state = await app.inject({ method: 'GET', url: '/api/manual' });
    const team1 = state.json().document.teams.find((t: { teamNo: number }) => t.teamNo === 1);
    expect(team1.eliminations).toBe(4);
    expect(team1.aliveCount).toBe(2);
  });

  describe('Close Current Map resets the Manual Match it closed (Part 9)', () => {
    const post = (url: string, payload?: unknown) =>
      app.inject({ method: 'POST', url, ...(payload === undefined ? {} : { payload }) });
    const patch = (teamNo: number, payload: unknown) =>
      app.inject({ method: 'PATCH', url: `/api/manual/teams/${teamNo}`, payload });
    const manualDocument = async () =>
      (await app.inject({ method: 'GET', url: '/api/manual' })).json().document;

    /** Manual mode, Alpha wins with 5 eliminations after Bravo (#3) and Charlie (#2) went out. */
    async function playManualMap(): Promise<string> {
      await app.inject({ method: 'PUT', url: '/api/manual/mode', payload: { mode: 'manual' } });
      await patch(2, { aliveCount: 0, eliminations: 1 });
      await patch(3, { aliveCount: 0, eliminations: 2 });
      await patch(1, { aliveCount: 4, eliminations: 5 });
      return (await manualDocument()).matchId as string;
    }

    it('never closes on its own, then closes and resets the manual match in one request', async () => {
      const matchId = await playManualMap();
      // Even with <= 1 team standing, Manual Mode never auto-closes on its own (D-06).
      expect(seriesStore.getState().closedMaps).toHaveLength(0);

      const closeRes = await post('/api/series/close-map', { expectedMatchId: matchId });

      expect(closeRes.statusCode).toBe(200);
      expect(closeRes.headers['x-cdf-manual-reset']).toBe('done');
      expect(closeRes.json().closedMaps).toHaveLength(1);

      const fresh = await manualDocument();
      expect(fresh.matchId).not.toBe(matchId);
      expect(fresh.mode).toBe('manual');
      expect(fresh.teams).toEqual(
        [1, 2, 3].map((teamNo) => ({
          teamNo,
          present: true,
          aliveCount: 4,
          eliminations: 0,
          eliminatedSeq: null,
          placementOverride: null,
        })),
      );
      // Alpha keeps its 15 series points (10 WWCD + 5 kills) and starts the next map at 0 kills with
      // the guaranteed-minimum 5 points of a 3-team lobby: 20.
      const alpha = activeStore.project().match.teams.find((t) => t.teamNo === 1);
      expect(alpha?.eliminations).toBe(0);
      expect(alpha?.totalPoints).toBe(20);
    });

    it('leaves the recorded map exactly as it was closed', async () => {
      const matchId = await playManualMap();
      await post('/api/series/close-map', { expectedMatchId: matchId });
      const closedAfterClose = JSON.stringify(seriesStore.getState().closedMaps);

      await post('/api/manual/reset', {});
      await patch(1, { aliveCount: 0, eliminations: 9 });

      expect(JSON.stringify(seriesStore.getState().closedMaps)).toBe(closedAfterClose);
      const map = seriesStore.getState().closedMaps[0]!;
      expect(map.teams.find((t) => t.teamNo === 1)).toMatchObject({
        placement: 1,
        eliminations: 5,
        totalPoints: 15,
        name: 'Alpha',
      });
    });

    it('keeps the lobby presence flags through the reset', async () => {
      await app.inject({ method: 'PUT', url: '/api/manual/mode', payload: { mode: 'manual' } });
      await patch(3, { present: false });
      await patch(2, { aliveCount: 0, eliminations: 1 });
      const matchId = (await manualDocument()).matchId as string;

      const closeRes = await post('/api/series/close-map', { expectedMatchId: matchId });
      expect(closeRes.statusCode).toBe(200);

      const after = await manualDocument();
      expect(after.teams.map((t: { present: boolean }) => t.present)).toEqual([true, true, false]);

      // The button uses the same mechanism and behaves identically.
      await patch(2, { aliveCount: 0 });
      await post('/api/manual/reset', {});
      const afterButton = await manualDocument();
      expect(afterButton.teams.map((t: { present: boolean }) => t.present)).toEqual([
        true,
        true,
        false,
      ]);
    });

    it('refuses to close when nobody has been eliminated and then changes nothing', async () => {
      await app.inject({ method: 'PUT', url: '/api/manual/mode', payload: { mode: 'manual' } });
      const before = await manualDocument();

      const res = await post('/api/series/close-map', { expectedMatchId: before.matchId });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/No team has been eliminated/);
      expect(seriesStore.getState().closedMaps).toHaveLength(0);
      expect(await manualDocument()).toEqual(before);
    });

    it('records exactly one map for two simultaneous close requests (double-click)', async () => {
      const matchId = await playManualMap();

      const [first, second] = await Promise.all([
        post('/api/series/close-map', { expectedMatchId: matchId }),
        post('/api/series/close-map', { expectedMatchId: matchId }),
      ]);

      expect([first.statusCode, second.statusCode].sort()).toEqual([200, 409]);
      expect(seriesStore.getState().closedMaps).toHaveLength(1);
      expect((await manualDocument()).matchId).not.toBe(matchId);
    });

    it('answers 409 to a request for a match that is no longer running, recording nothing', async () => {
      const matchId = await playManualMap();
      await post('/api/series/close-map', { expectedMatchId: matchId });

      const stale = await post('/api/series/close-map', { expectedMatchId: matchId });
      const unknown = await post('/api/series/close-map', { expectedMatchId: 'manual-nope' });

      expect(stale.statusCode).toBe(409);
      expect(unknown.statusCode).toBe(409);
      expect(seriesStore.getState().closedMaps).toHaveLength(1);
    });

    it('does not fabricate a map when an old client closes again after the reset', async () => {
      // The hazard found in the audit: the fresh, unplayed manual match used to be recorded as map 2
      // with placements invented by "ending" it.
      const matchId = await playManualMap();
      await post('/api/series/close-map', { expectedMatchId: matchId });

      const oldClient = await post('/api/series/close-map');

      expect(oldClient.statusCode).toBe(400);
      expect(oldClient.json().error).toMatch(/No team has been eliminated/);
      expect(seriesStore.getState().closedMaps).toHaveLength(1);
    });

    it('keeps the closed map and warns when the reset fails, then recovers safely', async () => {
      const matchId = await playManualMap();
      failNextReset = true;

      const closeRes = await post('/api/series/close-map', { expectedMatchId: matchId });

      expect(closeRes.statusCode).toBe(200);
      expect(closeRes.headers['x-cdf-manual-reset']).toBe('failed');
      expect(closeRes.json().closedMaps).toHaveLength(1);
      // The manual match is still the one that was closed...
      expect((await manualDocument()).matchId).toBe(matchId);
      // ...so closing it again can never double-count it...
      const again = await post('/api/series/close-map', { expectedMatchId: matchId });
      expect(again.statusCode).toBe(409);
      expect(seriesStore.getState().closedMaps).toHaveLength(1);
      // ...and the operator's recovery is the ordinary Reset Manual Match button.
      expect((await post('/api/manual/reset', {})).statusCode).toBe(200);
      expect((await manualDocument()).matchId).not.toBe(matchId);
    });

    it('does not touch a manual draft when a PCOB map is closed', async () => {
      await patch(1, { aliveCount: 2, eliminations: 4 }); // a manual draft, mode stays `auto`
      const draft = await manualDocument();
      expect(draft.mode).toBe('auto');
      const ingestPlayer = (teamNo: number, liveState: 'alive' | 'dead') => ({
        id: `p${teamNo}`,
        name: `P${teamNo}`,
        teamNo,
        slot: 1,
        liveState,
        health: liveState === 'alive' ? 100 : 0,
        healthMax: 100,
        kills: 0,
        rank: 0,
      });
      autoMatch.applyUpdate({
        matchId: 'pcob-1',
        phase: 'live',
        players: [ingestPlayer(1, 'alive'), ingestPlayer(2, 'dead')],
      });

      const res = await post('/api/series/close-map', { expectedMatchId: 'pcob-1' });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-cdf-manual-reset']).toBe('skipped');
      expect(seriesStore.getState().closedMaps).toHaveLength(1);
      expect(await manualDocument()).toEqual(draft);
    });

    it('rejects a PCOB close when nobody has been eliminated yet', async () => {
      autoMatch.applyUpdate({
        matchId: 'pcob-2',
        phase: 'live',
        players: [
          {
            id: 'p1',
            name: 'P1',
            teamNo: 1,
            slot: 1,
            liveState: 'alive',
            health: 100,
            healthMax: 100,
            kills: 0,
            rank: 0,
          },
        ],
      });

      const res = await post('/api/series/close-map');

      expect(res.statusCode).toBe(400);
      expect(seriesStore.getState().closedMaps).toHaveLength(0);
    });
  });

  it('supports mid-match failover by seeding Manual Mode from the latest PCOB standings', async () => {
    autoMatch.applyUpdate({
      matchId: 'pcob-failover',
      phase: 'live',
      players: [
        {
          id: 'p1',
          name: 'A1',
          teamNo: 1,
          slot: 1,
          liveState: 'alive',
          health: 100,
          healthMax: 100,
          kills: 7,
          rank: 0,
        },
        {
          id: 'p2',
          name: 'B1',
          teamNo: 2,
          slot: 1,
          liveState: 'dead',
          health: 0,
          healthMax: 100,
          kills: 3,
          rank: 2,
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/manual/reset',
      payload: { seedFromAuto: true },
    });
    expect(res.statusCode).toBe(200);
    const teams = res.json().document.teams;
    expect(teams).toEqual([
      {
        teamNo: 1,
        present: true,
        aliveCount: 1,
        eliminations: 7,
        eliminatedSeq: null,
        placementOverride: null,
      },
      {
        teamNo: 2,
        present: true,
        aliveCount: 0,
        eliminations: 3,
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
