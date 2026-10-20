import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
});

