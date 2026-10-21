import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigStore } from '../persistence/config-store.js';
import { FontStore } from '../persistence/font-store.js';
import { LogoStore } from '../persistence/logo-store.js';
import { ManualStore } from '../state/manual-store.js';
import { SeriesStore } from '../state/series-store.js';
import { excelRoutes } from './excel.js';
import { buildExcelExport } from '../excel/export.js';
import {
  DEFAULT_PMCC_2026_ROSTER,
  DEFAULT_SCORING_RULESET,
  createDefaultSeriesDocument,
} from '@cdf/shared';

describe('excel routes (WS-7.3 & WS-7.4)', () => {
  let dir: string;
  let app: FastifyInstance;
  let configStore: ConfigStore;
  let seriesStore: SeriesStore;
  let manualStore: ManualStore;
  let logoStore: LogoStore;
  let fontStore: FontStore;
  let importedCount = 0;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cdf-excel-routes-'));
    importedCount = 0;

    configStore = new ConfigStore({ dataDir: dir });
    await configStore.load();
    seriesStore = new SeriesStore({ dataDir: dir });
    await seriesStore.load();
    manualStore = new ManualStore({ dataDir: dir });
    await manualStore.load();
    logoStore = new LogoStore(dir);
    await logoStore.init();
    fontStore = new FontStore(dir);
    await fontStore.init();

    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(fastifyMultipart, { limits: { fileSize: 16 * 1024 * 1024, files: 1 } });

    await app.register(excelRoutes, {
      prefix: '/api',
      config: configStore,
      series: seriesStore,
      backupDeps: {
        config: configStore,
        series: seriesStore,
        logos: logoStore,
        fonts: fontStore,
        manual: manualStore,
      },
      onImported: () => {
        importedCount++;
      },
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('GET /api/excel/export returns a valid XLSX file with correct headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/excel/export',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toContain(
      'attachment; filename="PMCC-2026-Scoring-Sheet-',
    );
    expect(res.rawPayload.byteLength).toBeGreaterThan(15000);
  });

  it('POST /api/excel/import validates and previews an uploaded workbook (confirm=false)', async () => {
    const validXlsx = await buildExcelExport({
      roster: DEFAULT_PMCC_2026_ROSTER.teams,
      ruleset: DEFAULT_SCORING_RULESET,
      series: createDefaultSeriesDocument(),
    });

    // Multipart form data boundaries
    const boundary = '---------------------------excelboundary123';
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="scoring.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
      ),
      validXlsx,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/excel/import?confirm=false&mode=roster',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.confirmed).toBe(false);
    expect(body.preview.valid).toBe(true);
    expect(body.preview.teamsFound).toBe(25);
    expect(importedCount).toBe(0); // Not imported yet!
  });

  it('POST /api/excel/import commits changes and triggers onImported (confirm=true)', async () => {
    const validXlsx = await buildExcelExport({
      roster: DEFAULT_PMCC_2026_ROSTER.teams,
      ruleset: DEFAULT_SCORING_RULESET,
      series: createDefaultSeriesDocument(),
    });

    const boundary = '---------------------------excelboundary456';
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="scoring.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
      ),
      validXlsx,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/excel/import?confirm=true&mode=roster',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.confirmed).toBe(true);
    expect(body.result.success).toBe(true);
    expect(body.result.importedTeamsCount).toBe(25);
    expect(importedCount).toBe(1);
    expect(configStore.teams.current.teams).toHaveLength(25);
  });
});
