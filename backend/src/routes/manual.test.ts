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
      const hasAppeared = seriesStore.getSeriesHasAppeared();
      autoMatch.setSeriesContext(
        totals,
        hasAppeared,
        seriesStore.getBankedPointsForMatch(autoMatch.currentMatchId()),
      );
      manualMatch.setSeriesContext(
        totals,
        hasAppeared,
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

    await app.register(manualRoutes, {
      prefix: '/api',
      manual: manualStore,
      manualMatch,
      autoMatch,
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
    });

    await app.ready();
  }

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cdf-manual-routes-'));
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

  it('closes a Manual Mode map into SeriesStore only on explicit close-map and resets cleanly for the next map', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/manual/mode',
      payload: { mode: 'manual' },
    });

    // Wipe Bravo (#3) and Charlie (#2), leaving only Alpha alive (#1) with 5 eliminations.
    await app.inject({
      method: 'PATCH',
      url: '/api/manual/teams/2',
      payload: { aliveCount: 0, eliminations: 1 },
    });
    await app.inject({
      method: 'PATCH',
      url: '/api/manual/teams/3',
      payload: { aliveCount: 0, eliminations: 2 },
    });
    await app.inject({
      method: 'PATCH',
      url: '/api/manual/teams/1',
      payload: { aliveCount: 4, eliminations: 5 },
    });

    // Even with <= 1 team standing, Manual Mode never auto-closes on its own (D-06).
    expect(seriesStore.getState().closedMaps).toHaveLength(0);

    // Operator explicitly closes the map via POST /api/series/close-map.
    const closeRes = await app.inject({ method: 'POST', url: '/api/series/close-map' });
    expect(closeRes.statusCode).toBe(200);
    expect(closeRes.json().closedMaps).toHaveLength(1);

    // Banked-points netting ensures Alpha's 15 pts (10 WWCD + 5 kills) are not double-counted
    // before the operator clicks Reset manual match.
    const alphaBeforeReset = activeStore.project().match.teams.find((t) => t.teamNo === 1);
    expect(alphaBeforeReset?.totalPoints).toBe(15);

    // Operator resets manual match for Map 2: Alpha keeps 15 series points and starts Map 2 at 0 kills.
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/manual/reset',
      payload: {},
    });
    expect(resetRes.statusCode).toBe(200);
    // On Map 2 reset, Alpha has 0 kills, 5 guaranteed placement points (worst possible finish in a
    // 3-team lobby is #3 = 5 pts), plus 15 banked series points from Map 1 = 20 total points.
    const alphaMap2 = activeStore.project().match.teams.find((t) => t.teamNo === 1);
    expect(alphaMap2?.eliminations).toBe(0);
    expect(alphaMap2?.killPoints).toBe(0);
    expect(alphaMap2?.placementPoints).toBe(5);
    expect(alphaMap2?.totalPoints).toBe(20);
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
