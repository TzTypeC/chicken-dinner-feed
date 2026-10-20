import { z } from 'zod';
import { ingestStatusSchema } from '../domain/ingest.js';
import { matchStateSchema } from '../domain/match.js';
import { customFontSchema } from '../config/fonts.js';
import { autoWwcdVariantSchema, overlayInstanceSchema } from '../config/overlay-instance.js';
import { overlayVisibilitySchema } from '../domain/overlay.js';
import { closedMapResultSchema } from '../domain/series.js';

export const liveMatchInfoSchema = z.object({
  matchNumber: z.number().int().min(1),
  mapName: z.string(),
});
export type LiveMatchInfo = z.infer<typeof liveMatchInfoSchema>;

/**
 * The complete live state, sent as a whole rather than as a delta (ADR-0007).
 *
 * A browser source can be opened, closed or reloaded at any point during a match, and must be
 * correct the instant it connects. At this payload size a delta protocol would buy nothing
 * measurable and would cost a class of desynchronisation bugs that only appear on air.
 */
export const liveSnapshotSchema = z.object({
  /**
   * Increments on every broadcast. Lets a client detect a backend restart (the revision goes
   * backwards) and makes "did anything change" trivially checkable in logs.
   */
  revision: z.number().int().min(0),
  /** Epoch milliseconds at which this snapshot was produced. */
  generatedAt: z.number().int(),
  ingest: ingestStatusSchema,
  match: matchStateSchema,
  /** Current match number and map name for the Match Information Overlay. */
  matchInfo: liveMatchInfoSchema.default({ matchNumber: 1, mapName: 'Erangel' }),
  /**
   * The most recently recorded map, exactly as persisted in the series history (or null before any
   * map has closed). Lets the post-game standings and WWCD screens read *saved* results — which
   * survive the next lobby loading — and update the moment a map is closed, corrected, added or
   * deleted, without a reload.
   */
  lastClosedMap: closedMapResultSchema.nullable().default(null),
  /**
   * All completed maps recorded in the current series (`series.json`), in sequential order.
   * Powers both historical single-match pinning (`D-PMCC-09`) and cumulative series statistics
   * (`postgame-series`).
   */
  closedMaps: z.array(closedMapResultSchema).default([]),
  /**
   * Which WWCD presentation variant activates on automatic match-end transitions (`D-PMCC-08`).
   */
  autoWwcdVariant: autoWwcdVariantSchema.default('standard'),
});
export type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;

/**
 * Messages the server sends over `/ws/live`.
 *
 * Every message carries `protocolVersion` so a browser source left open across a backend upgrade
 * can tell that it no longer understands what it is being sent, and say so visibly instead of
 * rendering partial data.
 */
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('snapshot'),
    protocolVersion: z.number().int(),
    snapshot: liveSnapshotSchema,
  }),
  /**
   * Show/hide state for the instance this client is rendering.
   *
   * Kept as its own message rather than folded into the snapshot on purpose: match data is shared
   * by every overlay and changes constantly, while visibility is per-instance and changes only when
   * a director presses a button. Merging them would make one director's key press rebroadcast the
   * entire match state to every overlay in the production.
   */
  z.object({
    type: z.literal('overlay'),
    protocolVersion: z.number().int(),
    overlay: overlayVisibilitySchema,
    /**
     * The instance's configuration, or null when the id has not been configured.
     *
     * Carried on the same channel as visibility so an appearance change made in the admin reaches
     * every browser source immediately, with no reload — which is also what makes the admin's live
     * preview genuinely live.
     */
    instance: overlayInstanceSchema.nullable(),
    /**
     * Fonts the operator has uploaded, so a browser source can register the `@font-face` rules it
     * needs. Global rather than per-instance, but delivered on this channel because it is the one
     * that already reaches every open overlay the moment configuration changes — a font uploaded
     * mid-setup should not need a reload to take effect.
     */
    fonts: z.array(customFontSchema),
    /**
     * Which WWCD presentation variant activates on automatic match-end transitions (`D-PMCC-08`).
     */
    autoWwcdVariant: autoWwcdVariantSchema.default('standard'),
  }),
  z.object({
    type: z.literal('error'),
    protocolVersion: z.number().int(),
    message: z.string(),
  }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
