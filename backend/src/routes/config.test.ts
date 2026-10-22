import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_OVERLAY_INSTANCES, type OverlayInstance } from '@cdf/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigStore } from '../persistence/config-store.js';
import { LogoStore } from '../persistence/logo-store.js';
import { configRoutes } from './config.js';

describe('config routes - Part 6 enhancements', () => {
  let dir: string;
  let app: FastifyInstance;
  let configStore: ConfigStore;
  let logoStore: LogoStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cdf-config-routes-'));

    configStore = new ConfigStore({ dataDir: dir });
    await configStore.load();

    logoStore = new LogoStore(dir);
    await logoStore.init();

    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(configRoutes, { prefix: '/api', store: configStore, logos: logoStore });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('PUT /api/config/auto-wwcd accepts standard, fullscreen, and dual modes', async () => {
    const res1 = await app.inject({
      method: 'PUT',
      url: '/api/config/auto-wwcd',
      payload: { autoWwcdVariant: 'dual' },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().autoWwcdVariant).toBe('dual');
    expect(configStore.instances.current.autoWwcdVariant).toBe('dual');

    const res2 = await app.inject({
      method: 'PUT',
      url: '/api/config/auto-wwcd',
      payload: { autoWwcdVariant: 'fullscreen' },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().autoWwcdVariant).toBe('fullscreen');

    const res3 = await app.inject({
      method: 'PUT',
      url: '/api/config/auto-wwcd',
      payload: { autoWwcdVariant: 'standard' },
    });
    expect(res3.statusCode).toBe(200);
    expect(res3.json().autoWwcdVariant).toBe('standard');
  });

  it('PUT /api/config/teams renumbers teams and renames logo files atomically without collisions', async () => {
    // 1. Seed two logos for team 1 and team 2
    // Minimal valid 1x1 PNG bytes
    const pngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
      'hex',
    );
    const logo1 = await logoStore.save(1, pngBytes);
    const logo2 = await logoStore.save(2, pngBytes);

    expect(await logoStore.findLogoFileName(1)).toBe('team-1.png');
    expect(await logoStore.findLogoFileName(2)).toBe('team-2.png');

    // 2. Perform Direct Swap: Team 1 <-> Team 2
    const swapPayload = {
      schemaVersion: 1,
      teams: [
        { teamNo: 1, name: 'Team Bravo', logoUrl: logo2.url, previousTeamNo: 2 },
        { teamNo: 2, name: 'Team Alpha', logoUrl: logo1.url, previousTeamNo: 1 },
      ],
    };

    const swapRes = await app.inject({
      method: 'PUT',
      url: '/api/config/teams',
      payload: swapPayload,
    });
    expect(swapRes.statusCode).toBe(200);

    // On disk: files should now match their new slots
    expect(await logoStore.findLogoFileName(1)).toBe('team-1.png');
    expect(await logoStore.findLogoFileName(2)).toBe('team-2.png');

    // Returned URLs in roster document should point to the new slot numbers
    const teams = swapRes.json().teams;
    const team1 = teams.find((t: { teamNo: number }) => t.teamNo === 1);
    const team2 = teams.find((t: { teamNo: number }) => t.teamNo === 2);
    expect(team1.logoUrl).toContain('/api/logos/team-1.png');
    expect(team2.logoUrl).toContain('/api/logos/team-2.png');
  });

  it('PUT /api/config/teams removes logos for deleted teams and preserves sparse slot numbering', async () => {
    const pngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
      'hex',
    );
    await logoStore.save(3, pngBytes);
    await logoStore.save(7, pngBytes);

    // Set initial roster with slots 3, 5, 7
    await configStore.saveTeams({
      schemaVersion: 1,
      teams: [
        { teamNo: 3, name: 'Team 3', logoUrl: '/api/logos/team-3.png' },
        { teamNo: 5, name: 'Team 5', logoUrl: null },
        { teamNo: 7, name: 'Team 7', logoUrl: '/api/logos/team-7.png' },
      ],
    });

    // Delete Team 3 (keeping sparse slots 5 and 7)
    const deletePayload = {
      schemaVersion: 1,
      teams: [
        { teamNo: 5, name: 'Team 5', logoUrl: null },
        { teamNo: 7, name: 'Team 7', logoUrl: '/api/logos/team-7.png' },
      ],
    };

    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/teams',
      payload: deletePayload,
    });
    expect(res.statusCode).toBe(200);

    // Slot 3 logo should be deleted from disk
    expect(await logoStore.findLogoFileName(3)).toBeNull();
    // Slot 7 logo remains intact
    expect(await logoStore.findLogoFileName(7)).toBe('team-7.png');

    // Sparse slots 5 and 7 are preserved in persistence
    const saved = configStore.teams.current.teams;
    expect(saved.map((t) => t.teamNo)).toEqual([5, 7]);
  });

  it('PUT /api/config/teams rejects duplicate team numbers with HTTP 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/teams',
      payload: {
        schemaVersion: 1,
        teams: [
          { teamNo: 1, name: 'Team One', logoUrl: null },
          { teamNo: 1, name: 'Duplicate One', logoUrl: null },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Each team number can only appear once');
  });

  it('POST /api/config/teams/seed-pmcc resets roster to official PMCC 2026 25 teams', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/config/teams/seed-pmcc',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.teams).toHaveLength(25);
    expect(body.teams[0]?.name).toBe('SUKA SUKA SQUAD');
    expect(body.teams[19]?.name).toBe('Lanang nak chicken main pubg');
    expect(body.teams[19]?.name).toHaveLength(28);
    expect(body.teams[24]?.name).toBe('DTMK NOT JTMK.');
  });

  it('PUT /api/config/teams validates TEAM_NAME_MAX_LENGTH=32 boundaries', async () => {
    // 24, 25, 28, 32 characters should pass
    const validRes = await app.inject({
      method: 'PUT',
      url: '/api/config/teams',
      payload: {
        schemaVersion: 1,
        teams: [
          { teamNo: 1, name: 'A'.repeat(24), logoUrl: null },
          { teamNo: 2, name: 'B'.repeat(25), logoUrl: null },
          { teamNo: 3, name: 'C'.repeat(28), logoUrl: null },
          { teamNo: 4, name: 'D'.repeat(32), logoUrl: null },
        ],
      },
    });
    expect(validRes.statusCode).toBe(200);
    expect(configStore.teams.current.teams).toHaveLength(4);

    // 33 characters should be rejected by Zod schema
    const invalidRes = await app.inject({
      method: 'PUT',
      url: '/api/config/teams',
      payload: {
        schemaVersion: 1,
        teams: [{ teamNo: 1, name: 'E'.repeat(33), logoUrl: null }],
      },
    });
    expect(invalidRes.statusCode).toBe(400);
  });
});

describe('config routes - Part 8 team-name display settings', () => {
  let dir: string;
  let app: FastifyInstance;
  let configStore: ConfigStore;

  const mainInstance = (): OverlayInstance => configStore.findInstance('main')!;

  const putMain = (appearance: Record<string, unknown>) =>
    app.inject({
      method: 'PUT',
      url: '/api/config/overlays/main',
      payload: { ...mainInstance(), appearance },
    });

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cdf-config-part8-'));
  });

  afterEach(async () => {
    await app?.close();
    await rm(dir, { recursive: true, force: true });
  });

  async function start(): Promise<void> {
    configStore = new ConfigStore({ dataDir: dir });
    await configStore.load();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(configRoutes, { prefix: '/api', store: configStore });
    await app.ready();
  }

  it('loads a pre-Part-8 overlay-instances.json with the safe defaults (14 / off / 200)', async () => {
    const legacy = structuredClone(DEFAULT_OVERLAY_INSTANCES) as unknown as {
      instances: { appearance: Record<string, unknown> }[];
    };
    for (const instance of legacy.instances) {
      delete instance.appearance.teamNameMaxChars;
      delete instance.appearance.teamNameExtendedMode;
      delete instance.appearance.teamNameMaxExtension;
    }
    await writeFile(path.join(dir, 'overlay-instances.json'), JSON.stringify(legacy));

    await start();

    expect(mainInstance().appearance).toMatchObject({
      teamNameMaxChars: 14,
      teamNameExtendedMode: false,
      teamNameMaxExtension: 200,
    });
  });

  it('persists valid values and rejects out-of-range or non-integer ones without saving', async () => {
    await start();
    const base = mainInstance().appearance;

    const ok = await putMain({
      ...base,
      teamNameMaxChars: 20,
      teamNameExtendedMode: true,
      teamNameMaxExtension: 480,
    });
    expect(ok.statusCode).toBe(200);
    expect(mainInstance().appearance).toMatchObject({
      teamNameMaxChars: 20,
      teamNameExtendedMode: true,
      teamNameMaxExtension: 480,
    });

    for (const bad of [
      { teamNameMaxChars: 5 },
      { teamNameMaxChars: 33 },
      { teamNameMaxChars: 14.5 },
      { teamNameMaxChars: '14' },
      { teamNameMaxExtension: -1 },
      { teamNameMaxExtension: 481 },
      { teamNameExtendedMode: 'yes' },
    ]) {
      const res = await putMain({ ...mainInstance().appearance, ...bad });
      expect(res.statusCode, JSON.stringify(bad)).toBe(400);
    }
    expect(mainInstance().appearance).toMatchObject({
      teamNameMaxChars: 20,
      teamNameExtendedMode: true,
      teamNameMaxExtension: 480,
    });
  });

  it('keeps the stored settings when a client that predates them saves the instance', async () => {
    await start();
    await putMain({
      ...mainInstance().appearance,
      teamNameMaxChars: 10,
      teamNameExtendedMode: true,
      teamNameMaxExtension: 120,
    });

    const {
      teamNameMaxChars: _a,
      teamNameExtendedMode: _b,
      teamNameMaxExtension: _c,
      ...staleAppearance
    } = mainInstance().appearance;
    const res = await putMain({ ...staleAppearance, scale: 1.2 });

    expect(res.statusCode).toBe(200);
    expect(mainInstance().appearance).toMatchObject({
      scale: 1.2,
      teamNameMaxChars: 10,
      teamNameExtendedMode: true,
      teamNameMaxExtension: 120,
    });
  });
});
