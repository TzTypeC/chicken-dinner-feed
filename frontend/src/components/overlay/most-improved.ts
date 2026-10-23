import type { ClosedMapResult, MatchState } from '@cdf/shared';
import { selectSeriesStandings, type SeriesStandingsRow } from './broadcast-state';
import { formatTeamSlot } from './overlay-scale';

/**
 * Most Improved (Part 10 §6): the team that climbed the most places in the official overall series
 * standings between two closed maps. Ranks always come from `selectSeriesStandings` run on a
 * closed-map prefix with no live match, so a running map never moves anyone.
 */

export interface MostImprovedMapRef {
  mapId: string;
  mapNumber: number;
  mapName: string | null;
}

export interface MostImprovedEntry {
  teamNo: number;
  name: string;
  logoUrl: string | null;
  startRank: number;
  endRank: number;
  /** `startRank − endRank`; positive = climbed. */
  improvement: number;
  startPoints: number;
  endPoints: number;
}

export interface MostImprovedExclusion {
  teamNo: number;
  name: string;
  reason: 'new-after-start' | 'identity-changed';
  detail: string;
}

export type MostImprovedUnavailableReason =
  'not-enough-maps' | 'missing-from' | 'missing-to' | 'invalid-range';

export type MostImprovedRange =
  | {
      ok: true;
      fromIndex: number;
      toIndex: number;
      from: MostImprovedMapRef;
      to: MostImprovedMapRef;
    }
  | { ok: false; reason: MostImprovedUnavailableReason; message: string };

export type MostImprovedBoard =
  | {
      status: 'ready' | 'preview';
      from: MostImprovedMapRef;
      to: MostImprovedMapRef;
      hero: MostImprovedEntry;
      others: MostImprovedEntry[];
      excluded: MostImprovedExclusion[];
      /** Teams in the end standings (length of the rank rail). */
      teamCount: number;
    }
  | {
      status: 'no-climber';
      from: MostImprovedMapRef;
      to: MostImprovedMapRef;
      excluded: MostImprovedExclusion[];
    }
  | { status: 'unavailable'; reason: MostImprovedUnavailableReason; message: string };

export interface SelectMostImprovedOptions {
  isPreviewSimulation?: boolean;
  rosterByNo?: ReadonlyMap<number, { name: string; logoUrl: string | null }>;
}

/** Standings must never include live teams: rank is computed from closed maps only. */
const NO_LIVE_MATCH: MatchState = { matchId: null, phase: 'idle', teams: [], standingTeamCount: 0 };

const MAX_OTHERS = 3;

function mapRef(map: ClosedMapResult): MostImprovedMapRef {
  return { mapId: map.id, mapNumber: map.mapNumber, mapName: map.mapName ?? null };
}

export function resolveMostImprovedRange(
  closedMaps: readonly ClosedMapResult[],
  from: string,
  to: string,
): MostImprovedRange {
  if (closedMaps.length < 2) {
    return {
      ok: false,
      reason: 'not-enough-maps',
      message: 'At least two closed matches are needed to compare standings.',
    };
  }
  const toKey = to.trim() || 'latest';
  const fromKey = from.trim() || 'previous';
  const toIndex =
    toKey === 'latest' ? closedMaps.length - 1 : closedMaps.findIndex((map) => map.id === toKey);
  if (toIndex < 0) {
    return {
      ok: false,
      reason: 'missing-to',
      message: 'The selected end match no longer exists. Pick another end match.',
    };
  }
  const fromIndex =
    fromKey === 'previous' ? toIndex - 1 : closedMaps.findIndex((map) => map.id === fromKey);
  if (fromKey !== 'previous' && fromIndex < 0) {
    return {
      ok: false,
      reason: 'missing-from',
      message: 'The selected start match no longer exists. Pick another start match.',
    };
  }
  if (fromIndex < 0 || fromIndex >= toIndex) {
    return {
      ok: false,
      reason: 'invalid-range',
      message: 'The start match must be earlier than the end match.',
    };
  }
  return {
    ok: true,
    fromIndex,
    toIndex,
    from: mapRef(closedMaps[fromIndex]!),
    to: mapRef(closedMaps[toIndex]!),
  };
}

function standingsByTeam(maps: readonly ClosedMapResult[]): Map<number, SeriesStandingsRow> {
  const board = selectSeriesStandings(NO_LIVE_MATCH, maps);
  return new Map((board?.rows ?? []).map((row) => [row.teamNo, row]));
}

function previewBoard(): MostImprovedBoard {
  const sample = (
    teamNo: number,
    name: string,
    startRank: number,
    endRank: number,
    startPoints: number,
    endPoints: number,
  ): MostImprovedEntry => ({
    teamNo,
    name,
    logoUrl: null,
    startRank,
    endRank,
    improvement: startRank - endRank,
    startPoints,
    endPoints,
  });
  return {
    status: 'preview',
    from: { mapId: 'preview-from', mapNumber: 2, mapName: null },
    to: { mapId: 'preview-to', mapNumber: 3, mapName: null },
    hero: sample(0, 'Preview sample', 18, 5, 14, 52),
    others: [
      sample(0, 'Sample team B', 20, 11, 9, 37),
      sample(0, 'Sample team C', 14, 8, 21, 44),
      sample(0, 'Sample team D', 9, 6, 30, 48),
    ],
    excluded: [],
    teamCount: 20,
  };
}

export function selectMostImproved(
  closedMaps: readonly ClosedMapResult[] | undefined,
  from: string,
  to: string,
  options: SelectMostImprovedOptions = {},
): MostImprovedBoard {
  const maps = closedMaps ?? [];
  // The admin preview shows the real comparison whenever there is one to make (same data and design
  // as the browser source); the labelled sample only fills in before two maps have been closed.
  if (options.isPreviewSimulation && maps.length < 2) return previewBoard();

  const range = resolveMostImprovedRange(maps, from, to);
  if (!range.ok) return { status: 'unavailable', reason: range.reason, message: range.message };

  const window = maps.slice(0, range.toIndex + 1);
  const start = standingsByTeam(maps.slice(0, range.fromIndex + 1));
  const end = standingsByTeam(window);

  // Identity: latest snapshot in the window; distinct snapshot names flag a possible renumber.
  const identity = new Map<
    number,
    { name?: string; logoUrl: string | null; names: Map<string, string> }
  >();
  for (const map of window) {
    for (const entry of map.teams) {
      const slot = identity.get(entry.teamNo) ?? {
        logoUrl: null,
        names: new Map<string, string>(),
      };
      const name = entry.name?.trim();
      if (name) {
        slot.name = name;
        slot.logoUrl = entry.logoUrl ?? null;
        const key = name.replace(/\s+/g, ' ').toLowerCase();
        if (!slot.names.has(key)) slot.names.set(key, name);
      }
      identity.set(entry.teamNo, slot);
    }
  }
  const displayOf = (teamNo: number) => {
    const slot = identity.get(teamNo);
    if (slot?.name) return { name: slot.name, logoUrl: slot.logoUrl };
    const roster = options.rosterByNo?.get(teamNo);
    if (roster) return { name: roster.name, logoUrl: roster.logoUrl };
    return { name: `Team ${formatTeamSlot(teamNo)}`, logoUrl: null };
  };

  const excluded: MostImprovedExclusion[] = [];
  const eligible: MostImprovedEntry[] = [];
  const endRows = [...end.values()].sort((a, b) => a.seriesRank - b.seriesRank);
  for (const endRow of endRows) {
    const { teamNo } = endRow;
    const display = displayOf(teamNo);
    const names = [...(identity.get(teamNo)?.names.values() ?? [])];
    if (names.length > 1) {
      excluded.push({
        teamNo,
        name: display.name,
        reason: 'identity-changed',
        detail: `${formatTeamSlot(teamNo)} was recorded as ${names.join(', ')}`,
      });
      continue;
    }
    const startRow = start.get(teamNo);
    if (!startRow) {
      excluded.push({
        teamNo,
        name: display.name,
        reason: 'new-after-start',
        detail: `${display.name} first played after Match ${range.from.mapNumber}`,
      });
      continue;
    }
    eligible.push({
      teamNo,
      name: display.name,
      logoUrl: display.logoUrl,
      startRank: startRow.seriesRank,
      endRank: endRow.seriesRank,
      improvement: startRow.seriesRank - endRow.seriesRank,
      startPoints: startRow.totalPoints,
      endPoints: endRow.totalPoints,
    });
  }

  const climbers = eligible
    .filter((entry) => entry.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement || a.endRank - b.endRank);
  const [hero, ...rest] = climbers;
  if (!hero) return { status: 'no-climber', from: range.from, to: range.to, excluded };
  return {
    status: 'ready',
    from: range.from,
    to: range.to,
    hero,
    others: rest.slice(0, MAX_OTHERS),
    excluded,
    teamCount: end.size,
  };
}
