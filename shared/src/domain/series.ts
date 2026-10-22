import { z } from 'zod';
import { CONFIG_SCHEMA_VERSION } from '../versions.js';

/** Inclusive bounds for an operator's per-team, per-map bonus or penalty (Part 8). */
export const ADDITIONAL_POINTS_MIN = -100;
export const ADDITIONAL_POINTS_MAX = 100;
/** Longest optional reason an operator can attach to an adjustment. */
export const ADJUSTMENT_NOTE_MAX_LENGTH = 120;

/**
 * One team's result in a map that has already closed.
 *
 * Deliberately mirrors `Team`'s point fields rather than storing a single opaque total: an operator
 * correcting a wrong auto-detected result edits `placement`/`eliminations` (the raw inputs), and
 * `killPoints`/`placementPoints`/`totalPoints` are always re-derived from the scoring ruleset, never
 * accepted as a direct override — the same rule that governs live scoring.
 *
 * `additionalPoints` (Part 8, ADR-0018) is a third raw input, not an override: a discretionary
 * bonus or penalty stored on its own, which the re-derivation adds exactly once —
 * `totalPoints = killPoints + placementPoints + additionalPoints`. The official `killPoints` and
 * `placementPoints` never include it, so tie-breakers and audits keep seeing the ruleset values.
 *
 * The adjustment fields are optional rather than defaulted: a map recorded before Part 8 reads back
 * exactly as it was written (absent = no adjustment, read with `additionalPointsOf`), and its
 * stored `totalPoints` is never recomputed on load.
 */
export const closedMapTeamResultSchema = z.object({
  teamNo: z.number().int().min(1).max(25),
  /** 1-based, unique within the map — enforced when a map is closed or edited. */
  placement: z.number().int().min(1),
  eliminations: z.number().int().min(0),
  killPoints: z.number().int().min(0),
  placementPoints: z.number().int().min(0),
  /** Signed: a penalty larger than the official points takes a map total below zero. */
  totalPoints: z.number().int(),
  /** Operator bonus (+) or penalty (−) for this map. Absent means 0. */
  additionalPoints: z
    .number()
    .int()
    .min(ADDITIONAL_POINTS_MIN)
    .max(ADDITIONAL_POINTS_MAX)
    .optional(),
  /** Optional operator reason for the adjustment. */
  adjustmentNote: z.string().max(ADJUSTMENT_NOTE_MAX_LENGTH).optional(),
  /** Epoch ms of the last change to `additionalPoints`/`adjustmentNote`; absent/null if never set. */
  adjustedAt: z.number().int().nullable().optional(),
  /**
   * Snapshot of the team's identity at the moment this map closed (D-PMCC Part 6).
   * Preserves historical accuracy if the active roster is subsequently renumbered or teams deleted.
   */
  name: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
});
export type ClosedMapTeamResult = z.infer<typeof closedMapTeamResultSchema>;

/** The adjustment recorded for one team in one map; 0 for maps recorded before Part 8. */
export function additionalPointsOf(team: Pick<ClosedMapTeamResult, 'additionalPoints'>): number {
  return team.additionalPoints ?? 0;
}

/**
 * One map's final result, permanently recorded once it closes.
 *
 * `mapName` stays null in practice today — the PCOB API exposes no field naming the map (Erangel,
 * Miramar, ...), confirmed against every field alias in `payload.ts` and the vendor documents
 * (`specs/PCOB-API.md`). Modelled as nullable rather than omitted so a future API version that does
 * expose it needs no shape change here.
 *
 * `startedAt` and `endedAt` are both nullable, for two different reasons. A backend restart mid-map
 * loses the moment the map actually started, and that must read as "unknown" rather than as a
 * fabricated, wrong timestamp. A map added by hand (one played before the app was running, say)
 * never had either — writing "now" into `endedAt` there would put a map inserted at position 1 later
 * on the clock than the maps after it.
 */
export const closedMapResultSchema = z.object({
  /** Server-generated, stable identity for editing/deleting this specific map later. */
  id: z.string().min(1),
  /** 1-based, sequential within the current series. Renumbered on delete so it stays contiguous. */
  mapNumber: z.number().int().min(1),
  mapName: z.string().min(1).nullable(),
  /**
   * The PCOB match (`GameID`) this map was closed from, or `null` for a hand-added one.
   *
   * Load-bearing in three places, not just informational. It is how a restart mid-`ended` knows the
   * map is already recorded and must not be closed a second time (the in-memory guard alone does not
   * survive the restart); how a second close of the same still-running match is refused; and how the
   * live PTS column knows how much of the currently displayed match is *already* banked in the
   * series total, so it adds only what has been earned since rather than freezing or double-counting.
   *
   * Defaulted rather than migrated: a document written before this field existed reads back with
   * `null`, which is exactly right — nothing can be inferred about which match those maps came from.
   */
  matchId: z.string().nullable().default(null),
  startedAt: z.number().int().nullable(),
  endedAt: z.number().int().nullable(),
  teams: z.array(closedMapTeamResultSchema),
});
export type ClosedMapResult = z.infer<typeof closedMapResultSchema>;

/** One non-zero operator adjustment, flattened for warnings and audit displays. */
export interface RecordedAdjustment {
  mapId: string;
  mapNumber: number;
  mapName: string | null;
  teamNo: number;
  /** The team name snapshotted with that map, when one was recorded. */
  teamName: string | null;
  additionalPoints: number;
  adjustmentNote: string | null;
}

/**
 * Every non-zero adjustment across `closedMaps`, in map then slot order. The official Excel scoring
 * sheet has no column for these (Part 8, Q12), so this is what its export and import warn about.
 */
export function listRecordedAdjustments(
  closedMaps: readonly ClosedMapResult[],
): RecordedAdjustment[] {
  return closedMaps.flatMap((map) =>
    map.teams
      .filter((team) => additionalPointsOf(team) !== 0)
      .sort((a, b) => a.teamNo - b.teamNo)
      .map((team) => ({
        mapId: map.id,
        mapNumber: map.mapNumber,
        mapName: map.mapName,
        teamNo: team.teamNo,
        teamName: team.name ?? null,
        additionalPoints: additionalPointsOf(team),
        adjustmentNote: team.adjustmentNote ?? null,
      })),
  );
}

/**
 * Built-in competitive PUBG / PUBG Mobile map presets offered in the Admin Match Configuration bar.
 * Operators may also type any custom map or stage name.
 */
export const PUBG_MAP_PRESETS = [
  'Erangel',
  'Miramar',
  'Sanhok',
  'Vikendi',
  'Rondo',
  'Taego',
  'Deston',
  'Livik',
  'Karakin',
] as const;

export const seriesMatchInfoPatchSchema = z.object({
  /**
   * Explicit 1-based match number override. When `null`, the active match number is derived
   * automatically as `closedMaps.length + 1`.
   */
  activeMatchNumber: z.number().int().min(1).max(99).nullable(),
  /**
   * Active map name displayed on the Match Information Overlay and stamped onto the next closed map.
   */
  activeMapName: z.string().trim().max(64),
});
export type SeriesMatchInfoPatch = z.infer<typeof seriesMatchInfoPatchSchema>;

/**
 * The persisted series/tournament history (ADR-0004).
 *
 * `seriesId` changes on every reset — a cheap, unambiguous way for a client to notice "this is a
 * different series now" without comparing the whole document.
 */
export const seriesDocumentSchema = z.object({
  schemaVersion: z.number().int().min(1),
  seriesId: z.string().min(1),
  closedMaps: z.array(closedMapResultSchema),
  /**
   * Optional operator override for the current match number. When `null`, the effective match
   * number is `closedMaps.length + 1`. Defaulted so existing `series.json` files load seamlessly.
   */
  activeMatchNumber: z.number().int().min(1).max(99).nullable().default(null),
  /**
   * Active map name for the current match (e.g. "Erangel", "Miramar", "Sanhok"). Defaulted so
   * existing `series.json` files load seamlessly.
   */
  activeMapName: z.string().trim().max(64).default('Erangel'),
});
export type SeriesDocument = z.infer<typeof seriesDocumentSchema>;

/**
 * Resolves the effective 1-based match number for display on overlays and admin headers.
 */
export function getEffectiveMatchNumber(
  series: Pick<SeriesDocument, 'closedMaps' | 'activeMatchNumber'>,
): number {
  return series.activeMatchNumber ?? series.closedMaps.length + 1;
}

/**
 * Takes the new id as a parameter rather than generating one: this package has no Node-only or
 * DOM-only APIs (it is imported by both the backend and the browser), so id generation belongs to
 * the caller, which has `node:crypto` available.
 */
export function createDefaultSeriesDocument(seriesId: string): SeriesDocument {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    seriesId,
    closedMaps: [],
    activeMatchNumber: null,
    activeMapName: 'Erangel',
  };
}
