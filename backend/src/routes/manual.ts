import {
  manualMatchDocumentSchema,
  manualTeamPatchSchema,
  operatingModeSchema,
  teamSchema,
  type OperatingMode,
} from '@cdf/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ManualStore } from '../state/manual-store.js';
import type { MatchStore } from '../state/match-store.js';

export interface ManualRoutesOptions {
  manual: ManualStore;
  manualMatch: MatchStore;
  autoMatch: MatchStore;
  /** Called whenever a manual team edit or match reset occurs so `manualMatch` and `LiveHub` update. */
  onManualStateChanged: () => Promise<void> | void;
  /** Called when the operator switches between PCOB (`auto`) and `manual` operating modes. */
  onModeChanged: (mode: OperatingMode) => Promise<void> | void;
}

const errorSchema = z.object({ error: z.string() });

const manualResponseSchema = z.object({
  document: manualMatchDocumentSchema,
  standings: z.array(teamSchema),
});

const bulkUpdateSchema = z.object({
  teams: z
    .array(
      manualTeamPatchSchema.extend({
        teamNo: z.number().int().min(1).max(25),
      }),
    )
    .min(1),
});

const resetBodySchema = z
  .object({
    seedFromAuto: z.boolean().optional(),
  })
  .optional();

/**
 * Manual team input & operating mode routes (`/api/manual/*`).
 *
 * Allows an operator to switch between the automatic feed (`PCOB API` / `mock`) and `Manual` mode,
 * update live team survival counts and eliminations, or seed a manual match from the automatic
 * feed during a mid-match failover.
 */
export const manualRoutes: FastifyPluginAsyncZod<ManualRoutesOptions> = async (app, options) => {
  const { manual, manualMatch, autoMatch, onManualStateChanged, onModeChanged } = options;

  const buildResponse = () => ({
    document: manual.getState(),
    standings: manualMatch.project().match.teams,
  });

  app.get(
    '/manual',
    {
      schema: {
        summary: 'Read the manual match document and current manual standings',
        tags: ['manual'],
        response: {
          200: manualResponseSchema,
        },
      },
    },
    async () => buildResponse(),
  );

  app.put(
    '/manual/mode',
    {
      schema: {
        summary: 'Switch between PCOB API mode (auto) and Manual mode (manual)',
        tags: ['manual'],
        body: z.object({ mode: operatingModeSchema }),
        response: {
          200: manualResponseSchema,
        },
      },
    },
    async (request) => {
      await manual.setMode(request.body.mode);
      await onModeChanged(request.body.mode);
      return buildResponse();
    },
  );

  app.patch(
    '/manual/teams/:teamNo',
    {
      schema: {
        summary: "Update a single team's manual match state (present, aliveCount, eliminations)",
        tags: ['manual'],
        params: z.object({
          teamNo: z.coerce.number().int().min(1).max(25),
        }),
        body: manualTeamPatchSchema,
        response: {
          200: manualResponseSchema,
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await manual.patchTeam(request.params.teamNo, request.body);
        await onManualStateChanged();
        return buildResponse();
      } catch (error) {
        return reply.code(400).send({ error: (error as Error).message });
      }
    },
  );

  app.put(
    '/manual/teams',
    {
      schema: {
        summary: 'Bulk-update multiple teams in the manual match',
        tags: ['manual'],
        body: bulkUpdateSchema,
        response: {
          200: manualResponseSchema,
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await manual.updateTeams(request.body.teams);
        await onManualStateChanged();
        return buildResponse();
      } catch (error) {
        return reply.code(400).send({ error: (error as Error).message });
      }
    },
  );

  app.post(
    '/manual/reset',
    {
      schema: {
        summary:
          'Reset the manual match for a new map, optionally seeding from the current PCOB state',
        tags: ['manual'],
        body: resetBodySchema,
        response: {
          200: manualResponseSchema,
        },
      },
    },
    async (request) => {
      const seedFromAuto = request.body?.seedFromAuto ?? false;
      await manual.resetMatch(
        seedFromAuto ? { seedFromTeams: autoMatch.project().match.teams } : {},
      );
      await onManualStateChanged();
      return buildResponse();
    },
  );
};
