import type { MatchState } from '@cdf/shared';
import { resolveLiveWwcd } from './wwcd-resolver';

/**
 * Final 4 "win chance" estimate (Part 10 §7, Model U).
 *
 * `share_i = standingPlayers_i / Σ standingPlayers` over the cohort teams still in the match. This
 * is a transparent heuristic, not a calibrated model: knocked and disconnected players count as
 * standing while the source has not eliminated them. Anything ambiguous yields no numbers rather
 * than a silent redistribution. Pure and DOM-free.
 */

/**
 * - `live`: entries computed from a fresh snapshot.
 * - `stale`: entries from the last received snapshot; the UI holds them dimmed.
 * - `unavailable`: no numbers — unknown or conflicting data.
 * - `stopped`: no numbers — the WWCD is confirmed or decided.
 */
export type WwcdPredictionStatus = 'live' | 'stale' | 'unavailable' | 'stopped';

export interface WwcdPredictionEntry {
  teamNo: number;
  standingPlayers: number;
  /** Exact share, 0..1. */
  share: number;
  /** Integer percentage; all entries sum to exactly 100. */
  percent: number;
}

export interface WwcdPrediction {
  status: WwcdPredictionStatus;
  reason: string | null;
  /** Sorted by `teamNo`; empty for `unavailable` and `stopped`. */
  entries: WwcdPredictionEntry[];
  totalStandingPlayers: number;
}

/**
 * Integer percentages by the largest remainder (Hamilton) method: the total is exactly 100. Ties for
 * the leftover points go to the larger remainder, then the larger raw value, then the smaller key.
 * All values 0 (or no items) → empty map. Negative values count as 0.
 */
export function largestRemainderPercentages(
  items: readonly { key: number; value: number }[],
): Map<number, number> {
  const clean = items.map(({ key, value }) => ({
    key,
    value: Number.isFinite(value) && value > 0 ? value : 0,
  }));
  const total = clean.reduce((sum, item) => sum + item.value, 0);
  const result = new Map<number, number>();
  if (total <= 0) return result;

  const parts = clean.map(({ key, value }) => {
    const exact = (value * 100) / total;
    const floor = Math.floor(exact);
    return { key, value, floor, remainder: exact - floor };
  });
  let leftover = 100 - parts.reduce((sum, part) => sum + part.floor, 0);
  const order = [...parts].sort(
    (a, b) => b.remainder - a.remainder || b.value - a.value || a.key - b.key,
  );
  for (const part of parts) result.set(part.key, part.floor);
  for (let i = 0; leftover > 0 && order.length > 0; i = (i + 1) % order.length, leftover--) {
    const part = order[i]!;
    result.set(part.key, (result.get(part.key) ?? 0) + 1);
  }
  return result;
}

export interface ComputeWwcdPredictionInput {
  match: MatchState;
  cohortTeamNos: readonly number[];
  ingestState: 'disconnected' | 'connecting' | 'connected' | 'stale';
}

const none = (status: WwcdPredictionStatus, reason: string | null): WwcdPrediction => ({
  status,
  reason,
  entries: [],
  totalStandingPlayers: 0,
});

export function computeWwcdPrediction({
  match,
  cohortTeamNos,
  ingestState,
}: ComputeWwcdPredictionInput): WwcdPrediction {
  if (resolveLiveWwcd(match).state === 'provisional') return none('stopped', 'WWCD confirmed');
  if (ingestState === 'connecting') return none('unavailable', 'Waiting for data');

  const cohort = new Set(cohortTeamNos);
  const inPlay = match.teams.filter((team) => team.hasAppeared && !team.isEliminated);

  if (inPlay.some((team) => team.standingPlayerCount === 0)) {
    return none(
      'unavailable',
      inPlay.some((team) => cohort.has(team.teamNo) && team.standingPlayerCount === 0)
        ? 'A Final 4 team reports no standing players'
        : 'A team has unknown status',
    );
  }
  if (inPlay.some((team) => !cohort.has(team.teamNo))) {
    return none('unavailable', 'A team outside the Final 4 is still standing');
  }

  const set = inPlay.filter((team) => cohort.has(team.teamNo)).sort((a, b) => a.teamNo - b.teamNo);
  if (set.length <= 1) return none('stopped', 'WWCD decided');

  const total = set.reduce((sum, team) => sum + team.standingPlayerCount, 0);
  if (total <= 0) return none('unavailable', 'No standing players');

  const percents = largestRemainderPercentages(
    set.map((team) => ({ key: team.teamNo, value: team.standingPlayerCount })),
  );
  const entries = set.map((team) => ({
    teamNo: team.teamNo,
    standingPlayers: team.standingPlayerCount,
    share: team.standingPlayerCount / total,
    percent: percents.get(team.teamNo) ?? 0,
  }));
  const stale = ingestState === 'stale' || ingestState === 'disconnected';
  return {
    status: stale ? 'stale' : 'live',
    reason: stale ? 'Data stale' : null,
    entries,
    totalStandingPlayers: total,
  };
}
