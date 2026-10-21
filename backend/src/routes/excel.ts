import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  excelImportModeSchema,
  excelImportPreviewSchema,
  excelImportResultSchema,
} from '@cdf/shared';
import type { ConfigStore } from '../persistence/config-store.js';
import type { SeriesStore } from '../state/series-store.js';
import type { ExportDependencies } from '../backup/export.js';
import { buildExcelExport } from '../excel/export.js';
import { applyExcelImport, validateExcelImport } from '../excel/import.js';

export interface ExcelRoutesOptions {
  config: ConfigStore;
  series: SeriesStore;
  backupDeps?: ExportDependencies;
  onImported: () => void;
}

const MAX_EXCEL_BYTES = 16 * 1024 * 1024; // 16 MB

const excelErrorSchema = z.object({
  error: z.string(),
  errors: z.array(z.object({ location: z.string().optional(), message: z.string() })),
});

const excelImportResponseSchema = z.discriminatedUnion('confirmed', [
  z.object({ confirmed: z.literal(false), preview: excelImportPreviewSchema }),
  z.object({ confirmed: z.literal(true), result: excelImportResultSchema }),
]);

export const excelRoutes: FastifyPluginAsyncZod<ExcelRoutesOptions> = async (app, options) => {
  const { config, series, backupDeps, onImported } = options;

  app.get(
    '/excel/export',
    {
      schema: {
        summary: 'Download populated tournament scoring sheet as Excel XLSX',
        tags: ['excel'],
      },
    },
    async (_request, reply) => {
      const buffer = await buildExcelExport({
        roster: config.teams.current.teams,
        ruleset: config.scoring.current,
        series: series.getState(),
      });
      const stamp = new Date().toISOString().slice(0, 10);
      reply.header(
        'content-disposition',
        `attachment; filename="PMCC-2026-Scoring-Sheet-${stamp}.xlsx"`,
      );
      return reply
        .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .send(buffer);
    },
  );

  app.post(
    '/excel/import',
    {
      schema: {
        summary: 'Validate and optionally apply Excel XLSX tournament scoring sheet import',
        tags: ['excel'],
        querystring: z.object({
          confirm: z
            .preprocess((val) => val === 'true' || val === true || val === '1', z.boolean())
            .default(false),
          mode: excelImportModeSchema.default('full'),
        }),
        response: {
          200: excelImportResponseSchema,
          400: excelErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const upload = await request.file({ limits: { fileSize: MAX_EXCEL_BYTES } });
      if (!upload) {
        return reply.code(400).send({ error: 'No Excel file was uploaded.', errors: [] });
      }

      const bytes = await upload.toBuffer();
      if (upload.file.truncated) {
        return reply.code(400).send({
          error: `The Excel file is larger than ${MAX_EXCEL_BYTES / 1024 / 1024} MB.`,
          errors: [],
        });
      }

      const mode = request.query.mode;
      const validation = await validateExcelImport(bytes, mode, {
        roster: config.teams.current.teams,
        existingClosedMaps: series.getState().closedMaps,
        ruleset: config.scoring.current,
      });

      if (!validation.ok) {
        return reply.code(400).send({
          error: 'The Excel workbook could not be validated.',
          errors: validation.errors,
        });
      }

      if (!request.query.confirm) {
        return reply.send({
          confirmed: false,
          preview: validation.value.preview,
        });
      }

      const result = await applyExcelImport(validation.value, {
        config,
        series,
        backupDeps,
      });

      onImported();
      return reply.send({
        confirmed: true,
        result,
      });
    },
  );
};
