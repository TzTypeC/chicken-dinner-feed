import {
  autoWwcdVariantSchema,
  defaultAppearanceForType,
  DEFAULT_PMCC_2026_ROSTER,
  overlayAppearanceSchema,
  overlayInstanceIdSchema,
  overlayInstanceSchema,
  overlayInstancesDocumentSchema,
  overlayTypeSchema,
  scoringRulesetSchema,
  TEAM_NAME_DISPLAY_LIMITS,
  teamRosterDocumentSchema,
  type OverlayInstance,
} from '@cdf/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ConfigStore } from '../persistence/config-store.js';
import type { LogoStore } from '../persistence/logo-store.js';

export interface ConfigRoutesOptions {
  store: ConfigStore;
  logos?: LogoStore;
}

const errorSchema = z.object({ error: z.string() });

/**
 * Create takes an id, a name, and an optional overlay type; appearance starts from the type's
 * defaults (or copied from an existing instance) and is edited afterwards.
 */
const createInstanceSchema = z.object({
  id: overlayInstanceIdSchema,
  name: z.string().min(1).max(60),
  type: overlayTypeSchema.default('leaderboard'),
  /** Copy another instance's look — the usual way a second overlay is made. */
  copyAppearanceFrom: overlayInstanceIdSchema.optional(),
});

const updateAutoWwcdSchema = z.object({
  autoWwcdVariant: autoWwcdVariantSchema,
});

/**
 * The replace body for an overlay instance. Identical to `overlayInstanceSchema`, except the Part 8
 * team-name settings are optional instead of defaulted: an admin tab loaded before Part 8 (its
 * bundle strips fields it does not know) sends an appearance without them, and a schema default
 * would then silently reset the operator's saved limit/extended mode on every unrelated save. An
 * omitted field keeps the stored value instead (see the handler); a present one is validated with
 * the same bounds.
 */
const updateInstanceSchema = overlayInstanceSchema.extend({
  appearance: overlayAppearanceSchema.extend({
    teamNameMaxChars: z
      .number()
      .int()
      .min(TEAM_NAME_DISPLAY_LIMITS.maxChars.min)
      .max(TEAM_NAME_DISPLAY_LIMITS.maxChars.max)
      .optional(),
    teamNameExtendedMode: z.boolean().optional(),
    teamNameMaxExtension: z
      .number()
      .int()
      .min(TEAM_NAME_DISPLAY_LIMITS.maxExtension.min)
      .max(TEAM_NAME_DISPLAY_LIMITS.maxExtension.max)
      .optional(),
    // Part 10: same reasoning — a pre-Part-10 admin tab must not reset these on an unrelated save.
    mostImprovedFrom: z.string().min(1).optional(),
    mostImprovedTo: z.string().min(1).optional(),
    showWwcdPrediction: z.boolean().optional(),
    nextMapUpcomingMatch: z.enum(['auto', '1', '2', '3', '4']).optional(),
    showTeamLogo: z.boolean().optional(),
    nextMapSimulatorMode: z
      .enum(['disabled', 'match-1', 'match-2', 'match-3', 'all-completed'])
      .optional(),
  }),
});

/**
 * Configuration the admin reads and writes (ADR-0004).
 *
 * Whole-document writes rather than field-level patches: these documents are small, an operator
 * saves a form rather than a field, and a whole-document write validated against the schema cannot
 * leave a half-updated document behind.
 */
export const configRoutes: FastifyPluginAsyncZod<ConfigRoutesOptions> = async (app, options) => {
  const { store } = options;

  app.get(
    '/config/overlays',
    {
      schema: {
        summary: 'List overlay instances',
        tags: ['config'],
        response: { 200: overlayInstancesDocumentSchema },
      },
    },
    async () => store.instances.current,
  );

  app.post(
    '/config/overlays',
    {
      schema: {
        summary: 'Create an overlay instance',
        tags: ['config'],
        body: createInstanceSchema,
        response: { 201: overlayInstanceSchema, 409: errorSchema },
      },
    },
    async (request, reply) => {
      const { id, name, type, copyAppearanceFrom } = request.body;

      if (store.findInstance(id)) {
        return reply.code(409).send({ error: `An overlay with the id "${id}" already exists.` });
      }

      const source = copyAppearanceFrom ? store.findInstance(copyAppearanceFrom) : null;
      const created = {
        id,
        name,
        type,
        enabled: true,
        onAir: true,
        appearance: source?.appearance ?? defaultAppearanceForType(type),
      };

      await store.saveInstances([...store.instances.current.instances, created]);
      return reply.code(201).send(created);
    },
  );

  app.put(
    '/config/auto-wwcd',
    {
      schema: {
        summary: 'Update the automatic WWCD presentation variant (D-PMCC-08)',
        tags: ['config'],
        body: updateAutoWwcdSchema,
        response: { 200: overlayInstancesDocumentSchema },
      },
    },
    async (request) => store.saveAutoWwcdVariant(request.body.autoWwcdVariant),
  );

  app.put(
    '/config/overlays/:instanceId',
    {
      schema: {
        summary: 'Replace an overlay instance',
        tags: ['config'],
        params: z.object({ instanceId: overlayInstanceIdSchema }),
        body: updateInstanceSchema,
        response: { 200: overlayInstanceSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const { instanceId } = request.params;
      const body = request.body;

      if (body.id !== instanceId) {
        // Renaming an id would silently break every browser source and Companion button already
        // pointing at it. Delete and recreate is the honest path.
        return reply
          .code(400)
          .send({ error: 'An overlay id cannot be changed. Create a new overlay instead.' });
      }
      const existing = store.findInstance(instanceId);
      if (!existing) {
        return reply.code(404).send({ error: `No overlay with the id "${instanceId}".` });
      }

      // `existing` was parsed through `overlayInstanceSchema`, so its values are always present.
      const updated: OverlayInstance = {
        ...body,
        appearance: {
          ...body.appearance,
          teamNameMaxChars:
            body.appearance.teamNameMaxChars ?? existing.appearance.teamNameMaxChars,
          teamNameExtendedMode:
            body.appearance.teamNameExtendedMode ?? existing.appearance.teamNameExtendedMode,
          teamNameMaxExtension:
            body.appearance.teamNameMaxExtension ?? existing.appearance.teamNameMaxExtension,
          mostImprovedFrom:
            body.appearance.mostImprovedFrom ?? existing.appearance.mostImprovedFrom,
          mostImprovedTo: body.appearance.mostImprovedTo ?? existing.appearance.mostImprovedTo,
          showWwcdPrediction:
            body.appearance.showWwcdPrediction ?? existing.appearance.showWwcdPrediction,
          nextMapUpcomingMatch:
            body.appearance.nextMapUpcomingMatch ?? existing.appearance.nextMapUpcomingMatch,
          showTeamLogo: body.appearance.showTeamLogo ?? existing.appearance.showTeamLogo,
          nextMapSimulatorMode:
            body.appearance.nextMapSimulatorMode ?? existing.appearance.nextMapSimulatorMode,
        },
      };

      await store.saveInstances(
        store.instances.current.instances.map((instance) =>
          instance.id === instanceId ? updated : instance,
        ),
      );
      return reply.send(updated);
    },
  );

  app.delete(
    '/config/overlays/:instanceId',
    {
      schema: {
        summary: 'Delete an overlay instance',
        tags: ['config'],
        params: z.object({ instanceId: overlayInstanceIdSchema }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (request, reply) => {
      const { instanceId } = request.params;
      if (!store.findInstance(instanceId)) {
        return reply.code(404).send({ error: `No overlay with the id "${instanceId}".` });
      }

      await store.saveInstances(
        store.instances.current.instances.filter((instance) => instance.id !== instanceId),
      );
      return reply.code(204).send(null);
    },
  );

  app.get(
    '/config/teams',
    {
      schema: {
        summary: 'Read the team roster',
        tags: ['config'],
        response: { 200: teamRosterDocumentSchema },
      },
    },
    async () => store.teams.current,
  );

  app.put(
    '/config/teams',
    {
      schema: {
        summary: 'Replace the team roster',
        tags: ['config'],
        body: teamRosterDocumentSchema,
        response: { 200: teamRosterDocumentSchema, 400: errorSchema },
      },
    },
    async (request, reply) => {
      const teamNumbers = request.body.teams.map((team) => team.teamNo);
      if (new Set(teamNumbers).size !== teamNumbers.length) {
        // The team number is the join key to PCOB data, so a duplicate would silently merge two
        // teams' players into one row.
        return reply.code(400).send({ error: 'Each team number can only appear once.' });
      }

      const existingDoc = store.teams.current;
      const existingTeams = existingDoc.teams;
      const nextTeams = request.body.teams;

      // Handle logos synchronization if logo store is available
      if (options.logos) {
        const nextTeamNos = new Set(nextTeams.map((t) => t.teamNo));

        // 1. Detect renumbered teams
        // Check either explicit previousTeamNo or logoUrl containing /api/logos/team-(\d+)
        const moves: Array<{ fromTeamNo: number; toTeamNo: number }> = [];
        for (const next of nextTeams) {
          let fromTeamNo: number | null = null;
          if (next.previousTeamNo !== undefined && next.previousTeamNo !== next.teamNo) {
            fromTeamNo = next.previousTeamNo;
          } else if (next.logoUrl) {
            const match = next.logoUrl.match(/\/api\/logos\/team-(\d+)\./);
            if (match) {
              const matchedNo = Number(match[1]);
              if (matchedNo !== next.teamNo) {
                fromTeamNo = matchedNo;
              }
            }
          }

          if (fromTeamNo !== null && fromTeamNo >= 1 && fromTeamNo <= 25) {
            moves.push({ fromTeamNo, toTeamNo: next.teamNo });
          }
        }

        const movedFrom = new Set(moves.map((m) => m.fromTeamNo));

        // 2. Clean up deleted teams' logo files (sparse slots: teams deleted and not moved)
        for (const prev of existingTeams) {
          if (!nextTeamNos.has(prev.teamNo) && !movedFrom.has(prev.teamNo)) {
            await options.logos.remove(prev.teamNo);
          }
        }

        // 3. Atomically reassign logos on disk for moved teams
        if (moves.length > 0) {
          const now = Date.now();
          const reassigned = await options.logos.reassignLogos(moves, now);
          for (const next of nextTeams) {
            const updatedLogo = reassigned.get(next.teamNo);
            if (updatedLogo) {
              next.logoUrl = updatedLogo.url;
            }
          }
        }
      }

      // Strip transient previousTeamNo before persisting to document
      const sanitizedTeams = nextTeams.map(({ teamNo, name, logoUrl }) => ({
        teamNo,
        name,
        logoUrl,
      }));

      return reply.send(
        await store.saveTeams({
          schemaVersion: request.body.schemaVersion,
          teams: sanitizedTeams,
        }),
      );
    },
  );

  app.post(
    '/config/teams/seed-pmcc',
    {
      schema: {
        summary: 'Seed the team roster with the official PMCC 2026 25 teams',
        tags: ['config'],
        response: { 200: teamRosterDocumentSchema },
      },
    },
    async (_request, reply) => {
      const saved = await store.saveTeams(DEFAULT_PMCC_2026_ROSTER);
      return reply.send(saved);
    },
  );

  app.get(
    '/config/scoring',
    {
      schema: {
        summary: 'Read the scoring ruleset',
        tags: ['config'],
        response: { 200: scoringRulesetSchema },
      },
    },
    async () => store.scoring.current,
  );

  app.put(
    '/config/scoring',
    {
      schema: {
        summary: 'Replace the scoring ruleset',
        tags: ['config'],
        body: scoringRulesetSchema,
        response: { 200: scoringRulesetSchema },
      },
    },
    async (request) => store.saveScoring(request.body),
  );
};
