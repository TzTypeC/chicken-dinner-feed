/**
 * Display order for Series Control (Part 8, Feature C).
 *
 * - `'standings'` — the order the backend already ranked `snapshot.match.teams` in
 *   (`computeStandings`). Nothing is re-sorted here, so the admin can never disagree with the
 *   leaderboard on air.
 * - `'teamNo'` — the canonical roster slot order (T01 → T25) from the Teams tab.
 *
 * Purely a view preference: it never writes the roster, the series or any score, and it is kept per
 * browser like the other `cdf.admin.*` preferences.
 */
export type SeriesOrderMode = 'standings' | 'teamNo';

export const SERIES_ORDER_STORAGE_KEY = 'cdf.admin.series.teamOrder';

export function loadSeriesOrderMode(): SeriesOrderMode {
  if (typeof localStorage === 'undefined') return 'standings';
  return localStorage.getItem(SERIES_ORDER_STORAGE_KEY) === 'teamNo' ? 'teamNo' : 'standings';
}

/**
 * Orders a set of team slots for display without changing which teams are in it.
 *
 * In `'standings'` mode each slot takes its position in `standingsTeamNos`; a slot missing from the
 * current standings (a team deleted since that map was played) goes after every ranked one, by slot.
 * Every comparison ends on the unique `teamNo`, so the result is deterministic whatever order the
 * input arrived in. Returns a new array; the input is never mutated.
 */
export function orderTeamNos(
  teamNos: readonly number[],
  mode: SeriesOrderMode,
  standingsTeamNos: readonly number[],
): number[] {
  if (mode === 'teamNo') return [...teamNos].sort((a, b) => a - b);

  const position = new Map(standingsTeamNos.map((teamNo, index) => [teamNo, index]));
  const unranked = standingsTeamNos.length;
  return [...teamNos].sort(
    (a, b) => (position.get(a) ?? unranked) - (position.get(b) ?? unranked) || a - b,
  );
}
