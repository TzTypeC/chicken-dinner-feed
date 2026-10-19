import type { MatchState, Team } from '@cdf/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface EliminationAlertItem {
  id: string;
  matchId: string;
  teamNo: number;
  teamName: string;
  logoUrl: string | null;
  placement: number | null;
  rank: number;
  eliminations: number;
}

export interface EliminationTrackerState {
  matchId: string | null;
  initialized: boolean;
  eliminatedTeamNos: ReadonlySet<number>;
  queue: readonly EliminationAlertItem[];
  nextId: number;
}

export const INITIAL_ELIMINATION_TRACKER_STATE: EliminationTrackerState = {
  matchId: null,
  initialized: false,
  eliminatedTeamNos: new Set<number>(),
  queue: [],
  nextId: 1,
};

function toAlertItem(id: string, matchId: string, team: Team): EliminationAlertItem {
  return {
    id,
    matchId,
    teamNo: team.teamNo,
    teamName: team.name,
    logoUrl: team.logoUrl,
    placement: team.placement,
    rank: team.rank,
    eliminations: team.eliminations,
  };
}

/**
 * Pure state-transition step for elimination detection.
 *
 * Rules:
 * 1. When `match` or `match.matchId` is null, resets tracker state and clears queued alerts.
 * 2. On the **first** snapshot seen for a given `matchId` (such as initial page load, browser
 *    source refresh, or WebSocket reconnect mid-match), seeds `eliminatedTeamNos` with all teams
 *    that are already eliminated **without** emitting notifications.
 * 3. On subsequent snapshots for the same `matchId`:
 *    - If a previously eliminated team becomes `!isEliminated` (e.g., an operator in Manual Mode
 *      undoes an accidental `OUT`), removes `teamNo` from `eliminatedTeamNos` and cancels any
 *      unshown queued alert for that team.
 *    - When `!match.inWarmup`, any team that transitions to `hasAppeared && isEliminated` and is
 *      not yet in `eliminatedTeamNos` is added to `eliminatedTeamNos` and enqueued in FIFO order
 *      (sorted by placement descending so earlier-eliminated teams display first).
 */
export function stepEliminationTracker(
  prev: EliminationTrackerState,
  match: MatchState | null,
): EliminationTrackerState {
  if (!match || match.matchId === null) {
    if (!prev.initialized && prev.matchId === null && prev.queue.length === 0) {
      return prev;
    }
    return {
      matchId: null,
      initialized: false,
      eliminatedTeamNos: new Set<number>(),
      queue: [],
      nextId: prev.nextId,
    };
  }

  const { matchId, phase, teams } = match;

  // Initial snapshot for this matchId: seed baseline without firing alerts.
  if (!prev.initialized || prev.matchId !== matchId) {
    const baseline = new Set<number>();
    for (const team of teams) {
      if (team.hasAppeared && team.isEliminated) {
        baseline.add(team.teamNo);
      }
    }
    return {
      matchId,
      initialized: true,
      eliminatedTeamNos: baseline,
      queue: [],
      nextId: prev.nextId,
    };
  }

  const nextEliminated = new Set(prev.eliminatedTeamNos);
  let nextQueue = prev.queue;
  let nextId = prev.nextId;
  let changed = false;

  // 1. Handle Manual Mode undo (team restored from eliminated -> alive).
  for (const team of teams) {
    if (!team.isEliminated && nextEliminated.has(team.teamNo)) {
      nextEliminated.delete(team.teamNo);
      nextQueue = nextQueue.filter(
        (item) => !(item.matchId === matchId && item.teamNo === team.teamNo),
      );
      changed = true;
    }
  }

  // 2. Detect newly eliminated teams (suppressed while match phase is 'idle' / warmup).
  if (phase !== 'idle') {
    const newlyEliminated = teams
      .filter((team) => team.hasAppeared && team.isEliminated && !nextEliminated.has(team.teamNo))
      .sort((a, b) => {
        const placeA = a.placement ?? a.rank;
        const placeB = b.placement ?? b.rank;
        if (placeB !== placeA) return placeB - placeA;
        return a.teamNo - b.teamNo;
      });

    if (newlyEliminated.length > 0) {
      const additions: EliminationAlertItem[] = [];
      for (const team of newlyEliminated) {
        nextEliminated.add(team.teamNo);
        additions.push(toAlertItem(`elim-${matchId}-${team.teamNo}-${nextId++}`, matchId, team));
      }
      nextQueue = [...nextQueue, ...additions];
      changed = true;
    }
  }

  if (!changed) return prev;

  return {
    matchId,
    initialized: true,
    eliminatedTeamNos: nextEliminated,
    queue: nextQueue,
    nextId,
  };
}

export interface UseEliminationQueueOptions {
  /** Hold duration for each active banner in milliseconds (default: 3800ms). */
  holdMs?: number;
  /** Gap between consecutive banners in milliseconds (default: 260ms). */
  gapMs?: number;
  /** Whether notifications are enabled (default: true). */
  enabled?: boolean;
}

export interface UseEliminationQueueResult {
  activeAlert: EliminationAlertItem | null;
  queuedCount: number;
  triggerTestAlert: (sampleTeam?: Partial<EliminationAlertItem>) => void;
  clearAlerts: () => void;
}

export function useEliminationQueue(
  match: MatchState | null,
  options: UseEliminationQueueOptions = {},
): UseEliminationQueueResult {
  const holdMs = options.holdMs ?? 3800;
  const gapMs = options.gapMs ?? 260;
  const enabled = options.enabled ?? true;

  const trackerRef = useRef<EliminationTrackerState>(INITIAL_ELIMINATION_TRACKER_STATE);
  const [queue, setQueue] = useState<readonly EliminationAlertItem[]>([]);
  const [activeAlert, setActiveAlert] = useState<EliminationAlertItem | null>(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  // Process incoming match snapshots.
  useEffect(() => {
    const prev = trackerRef.current;
    const next = stepEliminationTracker(prev, match);
    if (next !== prev) {
      trackerRef.current = next;
      // If matchId changed, clear any currently visible alert from the old match immediately.
      if (prev.matchId !== next.matchId) {
        setActiveAlert(null);
        setIsCoolingDown(false);
      }
      setQueue(enabled ? next.queue : []);
    }
  }, [match, enabled]);

  // Clear active alert if master switch is turned off.
  useEffect(() => {
    if (!enabled) {
      setActiveAlert(null);
      setQueue([]);
      trackerRef.current = {
        ...trackerRef.current,
        queue: [],
      };
    }
  }, [enabled]);

  // Pop next alert from FIFO queue when idle.
  useEffect(() => {
    if (!enabled || activeAlert !== null || isCoolingDown || queue.length === 0) {
      return;
    }

    const [nextItem, ...rest] = queue;
    if (!nextItem) return;

    trackerRef.current = {
      ...trackerRef.current,
      queue: rest,
    };
    setQueue(rest);
    setActiveAlert(nextItem);
  }, [enabled, activeAlert, isCoolingDown, queue]);

  // Hold timer for the currently displayed alert, followed by brief inter-alert gap.
  useEffect(() => {
    if (!activeAlert) return;

    const holdTimer = window.setTimeout(() => {
      setActiveAlert(null);
      setIsCoolingDown(true);
    }, holdMs);

    return () => window.clearTimeout(holdTimer);
  }, [activeAlert, holdMs]);

  useEffect(() => {
    if (!isCoolingDown) return;

    const gapTimer = window.setTimeout(() => {
      setIsCoolingDown(false);
    }, gapMs);

    return () => window.clearTimeout(gapTimer);
  }, [isCoolingDown, gapMs]);

  const triggerTestAlert = useCallback(
    (sample?: Partial<EliminationAlertItem>) => {
      const sampleTeam = match?.teams.find((t) => t.hasAppeared) ?? match?.teams[0] ?? null;
      const nextId = trackerRef.current.nextId + 1;
      trackerRef.current = { ...trackerRef.current, nextId };

      const item: EliminationAlertItem = {
        id: `test-elim-${nextId}-${Date.now()}`,
        matchId: match?.matchId ?? 'preview',
        teamNo: sample?.teamNo ?? sampleTeam?.teamNo ?? 1,
        teamName: sample?.teamName ?? sampleTeam?.name ?? 'ALPHA SQUAD',
        logoUrl: sample?.logoUrl !== undefined ? sample.logoUrl : (sampleTeam?.logoUrl ?? null),
        placement:
          sample?.placement !== undefined ? sample.placement : (sampleTeam?.placement ?? 8),
        rank: sample?.rank ?? sampleTeam?.rank ?? 8,
        eliminations: sample?.eliminations ?? sampleTeam?.eliminations ?? 6,
      };

      const nextQueue = [...trackerRef.current.queue, item];
      trackerRef.current = {
        ...trackerRef.current,
        queue: nextQueue,
      };
      setQueue(nextQueue);
    },
    [match],
  );

  const clearAlerts = useCallback(() => {
    trackerRef.current = {
      ...trackerRef.current,
      queue: [],
    };
    setQueue([]);
    setActiveAlert(null);
    setIsCoolingDown(false);
  }, []);

  return {
    activeAlert,
    queuedCount: queue.length,
    triggerTestAlert,
    clearAlerts,
  };
}
