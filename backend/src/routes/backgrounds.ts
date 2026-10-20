import { overlayInstanceIdSchema, overlayInstanceSchema } from '@cdf/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ConfigStore } from '../persistence/config-store.js';
import { MAX_BACKGROUND_BYTES, type BackgroundStore } from '../persistence/background-store.js';

export interface BackgroundRoutesOptions {
  backgrounds: BackgroundStore;
  config: ConfigStore;
}

const paramsSchema = z.object({ instanceId: overlayInstanceIdSchema });
const errorSchema = z.object({ error: z.string() });

/**
 * Post-game background upload and removal (decision D-PMCC-05).
 *
 * Like a team logo, uploading writes the file **and** links it into the instance in one step, so
 * an upload can never look successful while nothing on air uses it. Only `postGameBackground` of
 * that one instance changes; the opacity and blur the operator already chose are kept.
 */
export const backgroundRoutes: FastifyPluginAsyncZod<BackgroundRoutesOptions> = async (
  app,
  options,
) => {
  const { backgrounds, config } = options;

  app.post(
    '/overlays/:instanceId/background',
    {
      schema: {
        summary: 'Upload the post-game background image or video for an overlay instance',
        tags: ['config'],
        params: paramsSchema,
        response: { 200: overlayInstanceSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const { instanceId } = request.params;
      const instance = config.findInstance(instanceId);
      if (!instance) {
        return reply.code(404).send({ error: `No overlay with the id "${instanceId}".` });
      }

      const upload = await request.file({ limits: { fileSize: MAX_BACKGROUND_BYTES } });
      if (!upload) return reply.code(400).send({ error: 'No file was uploaded.' });

      const bytes = await upload.toBuffer();
      if (upload.file.truncated) {
        return reply.code(400).send({
          error: `That file is larger than ${MAX_BACKGROUND_BYTES / 1024 / 1024} MB.`,
        });
      }

      let stored;
      try {
        stored = await backgrounds.save(instanceId, bytes);
      } catch (cause) {
        return reply.code(400).send({ error: (cause as Error).message });
      }

      const updated = {
        ...instance,
        appearance: {
          ...instance.appearance,
          postGameBackground: {
            ...instance.appearance.postGameBackground,
            mode: stored.kind,
            mediaUrl: stored.url,
          },
        },
      };
      await config.saveInstances(
        config.instances.current.instances.map((entry) =>
          entry.id === instanceId ? updated : entry,
        ),
      );
      return reply.send(updated);
    },
  );

  app.delete(
    '/overlays/:instanceId/background',
    {
      schema: {
        summary: 'Remove the post-game background media of an overlay instance',
        tags: ['config'],
        params: paramsSchema,
        response: { 200: overlayInstanceSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const { instanceId } = request.params;
      const instance = config.findInstance(instanceId);
      if (!instance) {
        return reply.code(404).send({ error: `No overlay with the id "${instanceId}".` });
      }

      await backgrounds.remove(instanceId);

      const updated = {
        ...instance,
        appearance: {
          ...instance.appearance,
          postGameBackground: {
            ...instance.appearance.postGameBackground,
            mode: 'disabled' as const,
            mediaUrl: null,
          },
        },
      };
      await config.saveInstances(
        config.instances.current.instances.map((entry) =>
          entry.id === instanceId ? updated : entry,
        ),
      );
      return reply.send(updated);
    },
  );
};
