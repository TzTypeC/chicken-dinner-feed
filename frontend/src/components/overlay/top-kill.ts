import type { ClosedMapResult } from '@cdf/shared';

/**
 * Top Kill (Part 10 §5): the teams with the most eliminations in the last closed map.
 *
 * Only closed maps are read — a live match's counts are still moving, and a "top kill" screen
 * that changes under the caster is worse than none.
 */

export interface TopKillEntry {
  teamNo: number;
  name: string;
  logoUrl: string | null;
  eliminations: number;
  placement: number | null;
  killPoints: number;
  /** The map's total match points, additional points included — the same figure post-game shows. */
  matchPoints: number;
  /** Competition ranking by eliminations (1, 2, 2, 4) over every candidate, shown or not. */
  displayRank: number;
  tied: boolean;
}

export interface TopKillMapRef {
  mapId: string;
  mapNumber: number;
  mapName: string | null;
}

export type TopKillBoard =
  | {
      status: 'ready' | 'preview';
      map: TopKillMapRef;
      entries: TopKillEntry[];
      /** Candidates not shown that share the 4th shown entry's eliminations. */
      cutoffTiedExtra: number;
      cutoffEliminations: number | null;
    }
  | { status: 'no-eliminations'; map: TopKillMapRef }
  | { status: 'no-map' };

export const TOP_KILL_MAX_ENTRIES = 4;

export interface SelectTopKillOptions {
  isPreviewSimulation?: boolean;
  /** Fallback identity for snapshots recorded before closed maps carried name/logo. */
  rosterByNo?: ReadonlyMap<number, { name: string; logoUrl: string | null }>;
}

/** Invented teams: a preview must never present real roster teams as results (Part 9). */
const PREVIEW_TOP_KILL: Extract<TopKillBoard, { entries: TopKillEntry[] }> = {
  status: 'preview',
  map: { mapId: 'preview', mapNumber: 3, mapName: 'Miramar' },
  entries: [
    {
      teamNo: 7,
      name: 'Sample Team Alpha',
      logoUrl: null,
      eliminations: 14,
      placement: 2,
      killPoints: 14,
      matchPoints: 20,
      displayRank: 1,
      tied: false,
    },
    {
      teamNo: 3,
      name: 'Sample Team Bravo',
      logoUrl: null,
      eliminations: 9,
      placement: 1,
      killPoints: 9,
      matchPoints: 19,
      displayRank: 2,
      tied: true,
    },
    {
      teamNo: 12,
      name: 'Sample Team Charlie',
      logoUrl: null,
      eliminations: 9,
      placement: 6,
      killPoints: 9,
      matchPoints: 11,
      displayRank: 2,
      tied: true,
    },
    {
      teamNo: 6,
      name: 'Sample Team Delta',
      logoUrl: null,
      eliminations: 7,
      placement: 4,
      killPoints: 7,
      matchPoints: 12,
      displayRank: 4,
      tied: false,
    },
  ],
  cutoffTiedExtra: 0,
  cutoffEliminations: null,
};

export function selectTopKill(
  closedMaps: readonly ClosedMapResult[] | undefined,
  options: SelectTopKillOptions = {},
): TopKillBoard {
  const map = closedMaps && closedMaps.length > 0 ? closedMaps[closedMaps.length - 1] : undefined;
  if (!map) {
    return options.isPreviewSimulation
      ? { ...PREVIEW_TOP_KILL, entries: PREVIEW_TOP_KILL.entries.map((e) => ({ ...e })) }
      : { status: 'no-map' };
  }

  const mapRef: TopKillMapRef = { mapId: map.id, mapNumber: map.mapNumber, mapName: map.mapName };
  const candidates = map.teams
    .filter((entry) => entry.eliminations >= 1)
    .map((entry) => {
      const rosterTeam = options.rosterByNo?.get(entry.teamNo);
      return {
        teamNo: entry.teamNo,
        name: entry.name ?? rosterTeam?.name ?? `Team ${entry.teamNo}`,
        logoUrl: entry.logoUrl !== undefined ? entry.logoUrl : (rosterTeam?.logoUrl ?? null),
        eliminations: entry.eliminations,
        placement: (entry.placement as number | null | undefined) ?? null,
        killPoints: entry.killPoints,
        matchPoints: entry.totalPoints,
      };
    });
  if (candidates.length === 0) return { status: 'no-eliminations', map: mapRef };

  candidates.sort((a, b) => {
    if (b.eliminations !== a.eliminations) return b.eliminations - a.eliminations;
    if (a.placement !== b.placement) {
      if (a.placement === null) return 1;
      if (b.placement === null) return -1;
      return a.placement - b.placement;
    }
    return a.teamNo - b.teamNo;
  });

  const countByElims = new Map<number, number>();
  for (const c of candidates)
    countByElims.set(c.eliminations, (countByElims.get(c.eliminations) ?? 0) + 1);

  const ranked: TopKillEntry[] = candidates.map((c) => ({
    ...c,
    // Sorted desc, so the strictly-greater count is the index of the first equal entry.
    displayRank: candidates.findIndex((other) => other.eliminations === c.eliminations) + 1,
    tied: (countByElims.get(c.eliminations) ?? 0) > 1,
  }));

  const entries = ranked.slice(0, TOP_KILL_MAX_ENTRIES);
  const last = entries.length === TOP_KILL_MAX_ENTRIES ? entries[entries.length - 1] : undefined;
  const cutoffTiedExtra = last
    ? ranked.slice(TOP_KILL_MAX_ENTRIES).filter((c) => c.eliminations === last.eliminations).length
    : 0;

  return {
    status: 'ready',
    map: mapRef,
    entries,
    cutoffTiedExtra,
    cutoffEliminations: cutoffTiedExtra > 0 && last ? last.eliminations : null,
  };
}
