import { z } from 'zod';
import type { TeamRosterEntry } from '../config/team-roster.js';
import { CONFIG_SCHEMA_VERSION } from '../versions.js';

/**
 * Which match data source is active at runtime.
 *
 * - `auto` — the configured automatic ingest adapter (`pcob` or `mock`, per `INGEST_SOURCE`).
 * - `manual` — operator-entered team state from the admin Manual control page.
 */
export const operatingModeSchema = z.enum(['auto', 'manual']);
export type OperatingMode = z.infer<typeof operatingModeSchema>;

/**
 * One team's manually managed live match state.
 *
 * Operates at the team level because the leaderboard overlay only renders team-level facts
 * (rank, logo, name, 4 alive bars, points, eliminations). Individual player slots are synthesised
 * deterministically from `aliveCount` and `eliminations` behind the adapter boundary.
 */
export const manualTeamStateSchema = z.object({
  teamNo: z.number().int().min(1).max(25),
  /** Whether this roster team is participating in the current match (`hasAppeared`). */
  present: z.boolean(),
  /** Players still standing (0 = eliminated, 1–4 = alive). */
  aliveCount: z.number().int().min(0).max(4),
  /** Total team eliminations in the current match. */
  eliminations: z.number().int().min(0).max(999),
  /**
   * Monotonic sequence number assigned when `aliveCount` transitions to `0` (earliest wiped team
   * gets the lowest sequence number and therefore the worst unclaimed placement). Cleared back to
   * `null` whenever `aliveCount` is raised above `0`, so an accidental click on `0` is reversible.
   */
  eliminatedSeq: z.number().int().min(1).nullable(),
  /**
   * Optional explicit placement override (1–25). When `null`, placement is derived automatically
   * from `eliminatedSeq` once `aliveCount === 0` (and from survivor ordering when a map closes).
   */
  placementOverride: z.number().int().min(1).max(25).nullable(),
});
export type ManualTeamState = z.infer<typeof manualTeamStateSchema>;

/** Partial update for a single team's manual state. */
export const manualTeamPatchSchema = z.object({
  present: z.boolean().optional(),
  aliveCount: z.number().int().min(0).max(4).optional(),
  eliminations: z.number().int().min(0).max(999).optional(),
  placementOverride: z.number().int().min(1).max(25).nullable().optional(),
});
export type ManualTeamPatch = z.infer<typeof manualTeamPatchSchema>;

/**
 * The persisted manual match document (`backend/data/manual-match.json`).
 */
export const manualMatchDocumentSchema = z.object({
  schemaVersion: z.number().int().min(1),
  mode: operatingModeSchema,
  matchId: z.string().min(1),
  nextEliminatedSeq: z.number().int().min(1),
  teams: z.array(manualTeamStateSchema),
});
export type ManualMatchDocument = z.infer<typeof manualMatchDocumentSchema>;

export function createDefaultManualTeamState(teamNo: number): ManualTeamState {
  return {
    teamNo,
    present: true,
    aliveCount: 4,
    eliminations: 0,
    eliminatedSeq: null,
    placementOverride: null,
  };
}

/**
 * Takes `matchId` as a parameter rather than generating one so `@cdf/shared` remains free of
 * Node-only APIs (`node:crypto`), matching `createDefaultSeriesDocument`.
 */
export function createDefaultManualMatchDocument(
  matchId: string,
  roster: readonly TeamRosterEntry[],
  mode: OperatingMode = 'auto',
): ManualMatchDocument {
  const sorted = [...roster].sort((a, b) => a.teamNo - b.teamNo);
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    mode,
    matchId,
    nextEliminatedSeq: 1,
    teams: sorted.map((entry) => createDefaultManualTeamState(entry.teamNo)),
  };
}

