import { ingestSourceKindSchema, PROTOCOL_VERSION, type IngestSourceKind } from '@cdf/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { config } from '../config.js';
import { APP_VERSION } from '../version.js';

export interface HealthRoutesOptions {
  getActiveSource?: () => IngestSourceKind;
}

const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  protocolVersion: z.number().int(),
  ingestSource: ingestSourceKindSchema,
  uptimeSeconds: z.number(),
});

/**
 * A liveness endpoint that `startup.bat` can poll to know when the server is actually ready,
 * rather than guessing with a sleep.
 */
export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (app, options) => {
  app.get(
    '/health',
    {
      schema: {
        summary: 'Liveness and build information',
        tags: ['system'],
        response: { 200: healthResponseSchema },
      },
    },
    async () => ({
      status: 'ok' as const,
      version: APP_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      ingestSource: options.getActiveSource?.() ?? config.ingestSource,
      uptimeSeconds: Math.round(process.uptime()),
    }),
  );
};
