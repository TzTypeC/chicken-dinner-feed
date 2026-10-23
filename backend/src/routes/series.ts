import {
  additionalPointsOf,
  ADDITIONAL_POINTS_MAX,
  ADDITIONAL_POINTS_MIN,
  ADJUSTMENT_NOTE_MAX_LENGTH,
  seriesDocumentSchema,
  seriesMatchInfoPatchSchema,
  teamSchema,
  type ClosedMapResult,
} from '@cdf/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { MatchStore } from '../state/match-store.js';
import type { ClosedMapTeamEdit, SeriesStore } from '../state/series-store.js';
import type { ConfigStore } from '../persistence/config-store.js';

export interface SeriesRoutesOptions {
  series: SeriesStore;
  match: MatchStore;
  config: ConfigStore;
  /** Called after a close/reset/edit/delete changes the series so `MatchStore`'s PTS can catch up. */
  onSeriesChanged: () => void;
  /**
   * Runs right after a map was closed successfully, still inside the close lock. Decides whether the
   * map that just closed was the Manual Match and, if so, resets it with the one existing Reset
   * Manual Match mechanism. Throws if the reset failed: the close has then already succeeded.
   * Omitted where there is no manual match (the map stays as it is).
   */
  afterMapClosed?: (closed: ClosedMapResult) => Promise<'done' | 'skipped'>;
}

const errorSchema = z.object({ error: z.string() });

const closeMapBodySchema = z.object({
  /**
   * The match the operator is looking at. A close for a match that is no longer the running one
   * (already closed, a new match started, a stale tab or a double click) is refused with 409.
   */
  expectedMatchId: z.string().min(1).optional(),
});

/**
 * `additionalPoints`/`adjustmentNote` are optional on purpose (ADR-0018): on a correction, omitting
 * them keeps the stored adjustment, so a client that predates the field cannot wipe a penalty. zod's
 * `int()` already refuses NaN, Infinity, fractions and numeric strings.
 */
const teamResultsSchema = z
  .array(
    z.object({
      teamNo: z.number().int().min(1).max(25),
      placement: z.number().int().min(1),
      eliminations: z.number().int().min(0),
      additionalPoints: z
        .number()
        .int()
        .min(ADDITIONAL_POINTS_MIN)
        .max(ADDITIONAL_POINTS_MAX)
        .optional(),
      adjustmentNote: z.string().trim().max(ADJUSTMENT_NOTE_MAX_LENGTH).optional(),
    }),
  )
  .min(1);

const editSchema = z.object({ teams: teamResultsSchema });

const addMapSchema = z.object({
  /** 1-based insert position. Clamped server-side, so "past the end" simply appends. */
  position: z.number().int().min(1),
  teams: teamResultsSchema,
});

/**
 * The lightweight audit trail for operator adjustments: one log line per team whose bonus/penalty
 * or reason changed between `before` (absent for a new map) and `after`. The admin has no
 * authentication (ADR-0008), so there is no operator identity to record — the map, team, old and
 * new values, reason and time are what an operator needs to reconstruct who was adjusted and why.
 */
function logAdjustmentChanges(
  log: FastifyBaseLogger,
  before: ClosedMapResult | undefined,
  after: ClosedMapResult | undefined,
): void {
  if (!after) return;
  for (const team of after.teams) {
    const previous = before?.teams.find((entry) => entry.teamNo === team.teamNo);
    const from = previous ? additionalPointsOf(previous) : 0;
    const to = additionalPointsOf(team);
    const noteChanged = (previous?.adjustmentNote ?? '') !== (team.adjustmentNote ?? '');
    if (from === to && !noteChanged) continue;
    log.info(
      {
        event: 'series.additionalPoints',
        mapId: after.id,
        mapNumber: after.mapNumber,
        teamNo: team.teamNo,
        teamName: team.name ?? null,
        from,
        to,
        note: team.adjustmentNote ?? null,
        adjustedAt: team.adjustedAt ?? null,
      },
      'Additional points changed',
    );
  }
}

/**
 * Multi-map series scoring (specs/SCORING-LOGIC-UPDATE.md): current standings plus the closed-map
 * history, and the operations the Series control admin page needs against it.
 */
export const seriesRoutes: FastifyPluginAsyncZod<SeriesRoutesOptions> = async (app, options) => {
  const { series, match, config, onSeriesChanged, afterMapClosed } = options;
  // Close + reset run as one unit: a second request starts only after the first finished, and then
  // meets either a different running match (409) or an already-closed one (409/400).
  let closeQueue: Promise<unknown> = Promise.resolve();
  const runExclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = closeQueue.then(task, task);
    closeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  app.get(
    '/series',
    {
      schema: {
        summary: 'Read the series history and the live current-map standings',
        tags: ['series'],
        response: {
          200: z.object({ document: seriesDocumentSchema, standings: z.array(teamSchema) }),
        },
      },
    },
    async () => ({ document: series.getState(), standings: match.project().match.teams }),
  );

  app.put(
    '/series/match-info',
    {
      schema: {
        summary: 'Update the active match number override and active map name',
        tags: ['series'],
        body: seriesMatchInfoPatchSchema,
        response: { 200: seriesDocumentSchema },
      },
    },
    async (request) => {
      const updated = await series.setMatchInfo(request.body);
      onSeriesChanged();
      return updated;
    },
  );

  app.post(
    '/series/close-map',
    {
      schema: {
        summary:
          'Manually close the currently running map (and reset the Manual Match if that is what was closed)',
        tags: ['series'],
        response: { 200: seriesDocumentSchema, 400: errorSchema, 409: errorSchema },
      },
    },
    async (request, reply) =>
      runExclusive(async () => {
        // Parsed by hand: older clients POST without a body, which the typed body schema rejects.
        const body = closeMapBodySchema.safeParse(request.body ?? {});
        if (!body.success) {
          return reply.code(400).send({ error: 'expectedMatchId must be a non-empty string.' });
        }
        const expectedMatchId = body.data.expectedMatchId;
        try {
          // Checked here rather than in the store, which only ever sees a projection — and
          // `projectAsEnded()` has by then already dressed a warmup lobby up as a finished match,
          // complete with a final placement for every team in it.
          if (match.isInWarmup()) {
            throw new Error(
              'The round has not started yet — the lobby is still warming up. Nothing has been played to record.',
            );
          }

          const live = match.project().match;
          if (live.matchId === null) {
            throw new Error('There is no match running to close. Add the map by hand instead.');
          }
          if (expectedMatchId !== undefined) {
            if (live.matchId !== expectedMatchId || series.hasClosedMap(expectedMatchId)) {
              return reply.code(409).send({
                error:
                  'That map is no longer running (it was already closed, or a new match has started). Reload the page and check the series.',
              });
            }
          }

          // Judged on the live projection: `projectAsEnded()` hands every alive team a placement, so
          // checking it afterwards can never notice a match nobody has played (Part 9).
          if (
            !live.teams.some(
              (team) => team.hasAppeared && (team.isEliminated || team.placement !== null),
            )
          ) {
            throw new Error(
              'No team has been eliminated yet, so there is nothing to record. Play the map first.',
            );
          }

          const closed = await series.closeMapNow(match.projectAsEnded(), Date.now());
          // Re-derives what this match has now banked, so the PTS column stops counting it twice
          // without freezing: anything scored *after* this close still lands in the total.
          onSeriesChanged();

          let manualReset: 'done' | 'skipped' | 'failed' = 'skipped';
          if (afterMapClosed) {
            try {
              manualReset = await afterMapClosed(closed);
            } catch (error) {
              // The map is recorded and stays recorded; only the follow-up reset failed. The
              // operator is told, and boot reconciliation finishes it if the process dies first.
              manualReset = 'failed';
              request.log.error(
                { error, mapId: closed.id },
                'Manual match reset after close failed',
              );
            }
            onSeriesChanged();
          }
          reply.header('x-cdf-manual-reset', manualReset);
          return series.getState();
        } catch (error) {
          return reply.code(400).send({ error: (error as Error).message });
        }
      }),
  );

  app.post(
    '/series/maps',
    {
      schema: {
        summary: 'Add a map by hand, at any position in the series',
        tags: ['series'],
        body: addMapSchema,
        response: { 200: seriesDocumentSchema, 400: errorSchema },
      },
    },
    async (request, reply) => {
      try {
        const added = await series.insertManualMap(
          request.body.position,
          request.body.teams,
          config.scoring.current,
        );
        logAdjustmentChanges(request.log, undefined, added);
        onSeriesChanged();
        return series.getState();
      } catch (error) {
        return reply.code(400).send({ error: (error as Error).message });
      }
    },
  );

  app.post(
    '/series/reset',
    {
      schema: {
        summary: 'Reset the series: clears history, leaves the running map untouched',
        tags: ['series'],
        response: { 200: seriesDocumentSchema },
      },
    },
    async () => {
      const result = await series.resetSeries();
      onSeriesChanged();
      return result;
    },
  );

  app.put(
    '/series/maps/:mapId',
    {
      schema: {
        summary: "Correct a closed map's placements, eliminations and additional points",
        tags: ['series'],
        params: z.object({ mapId: z.string().min(1) }),
        body: editSchema,
        response: { 200: seriesDocumentSchema, 400: errorSchema },
      },
    },
    async (request, reply) => {
      const edits: ClosedMapTeamEdit[] = request.body.teams;
      const before = series.getState().closedMaps.find((map) => map.id === request.params.mapId);
      try {
        const result = await series.editClosedMap(
          request.params.mapId,
          edits,
          config.scoring.current,
        );
        logAdjustmentChanges(
          request.log,
          before,
          result.closedMaps.find((map) => map.id === request.params.mapId),
        );
        onSeriesChanged();
        return result;
      } catch (error) {
        return reply.code(400).send({ error: (error as Error).message });
      }
    },
  );

  app.delete(
    '/series/maps/:mapId',
    {
      schema: {
        summary: 'Delete a closed map and renumber the rest',
        tags: ['series'],
        params: z.object({ mapId: z.string().min(1) }),
        response: { 200: seriesDocumentSchema, 400: errorSchema },
      },
    },
    async (request, reply) => {
      try {
        const result = await series.deleteClosedMap(request.params.mapId);
        onSeriesChanged();
        return result;
      } catch (error) {
        return reply.code(400).send({ error: (error as Error).message });
      }
    },
  );
};
