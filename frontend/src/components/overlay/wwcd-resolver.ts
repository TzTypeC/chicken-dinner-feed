import type { ClosedMapResult, ClosedMapTeamResult, MatchState, Team } from '@cdf/shared';

/**
 * The one rule for "who won the chicken dinner", shared by the postgame screen, both WWCD overlays
 * and the automatic WWCD layout trigger (Part 9, ADR-0019).
 *
 * WWCD is **placement #1** (PUBG MOBILE rulebook: the first series tie-breaker is "times winning the
 * first placement"). While a map is still unclosed there is no recorded placement yet, so a team is
 * named only when it is the *confirmed* last one standing. The winner is never inferred from points,
 * rank, array order or `teamNo`, and anything ambiguous is reported as "not confirmed" instead of a
 * guess.
 *
 * Pure and DOM-free so every rule is unit-tested.
 */

/**
 * - `none`: no match is being shown (idle).
 * - `running`: the map is still being played (two or more teams standing, or nobody out yet).
 * - `provisional`: unclosed map, exactly one team is confirmed standing — a live result, not final.
 * - `unconfirmed`: teams are out, but the survivor cannot be confirmed (nobody standing, a team whose
 *   status is unknown, or conflicting placement data).
 * - `final`: the map is closed and has exactly one valid placement #1.
 * - `final-invalid`: the map is closed but has no, or more than one, placement #1.
 */
export type WwcdState =
  'none' | 'running' | 'provisional' | 'unconfirmed' | 'final' | 'final-invalid';

export interface LiveWwcdResolution {
  state: 'none' | 'running' | 'provisional' | 'unconfirmed';
  /** Set only for `provisional`. */
  winner: Team | null;
}

export interface ClosedWwcdResolution {
  state: 'final' | 'final-invalid';
  /** Set only for `final`. */
  winner: ClosedMapTeamResult | null;
}

/**
 * Resolves the **unclosed** map currently shown by `match`.
 *
 * "Confirmed standing" needs positive evidence: a team that has appeared but reports no players in
 * the current snapshot (a partial PCOB response) is neither eliminated nor alive — its status is
 * unknown, and while any team is unknown the survivor cannot be confirmed.
 */
export function resolveLiveWwcd(match: Pick<MatchState, 'phase' | 'teams'>): LiveWwcdResolution {
  if (match.phase === 'idle') return { state: 'none', winner: null };

  const appeared = match.teams.filter((team) => team.hasAppeared);
  const eliminated = appeared.filter((team) => team.isEliminated);
  const standing = appeared.filter((team) => !team.isEliminated && team.standingPlayerCount > 0);
  const unknown = appeared.filter((team) => !team.isEliminated && team.standingPlayerCount === 0);

  // Nobody has been eliminated yet (a lobby still filling up), or at least two teams are alive.
  if (eliminated.length === 0 || standing.length >= 2) return { state: 'running', winner: null };

  const [survivor] = standing;
  const firsts = appeared.filter((team) => team.placement === 1);
  const agrees =
    firsts.length === 0 || (firsts.length === 1 && firsts[0]?.teamNo === survivor?.teamNo);

  if (survivor && standing.length === 1 && unknown.length === 0 && agrees) {
    return { state: 'provisional', winner: survivor };
  }
  return { state: 'unconfirmed', winner: null };
}

/** Resolves a **closed** map: exactly one recorded placement #1, or no valid winner. */
export function resolveClosedWwcd(map: Pick<ClosedMapResult, 'teams'>): ClosedWwcdResolution {
  const firsts = map.teams.filter((entry) => entry.placement === 1);
  const [winner] = firsts;
  return firsts.length === 1 && winner
    ? { state: 'final', winner }
    : { state: 'final-invalid', winner: null };
}

/** The recorded map that was closed from the match currently shown, if any. */
export function findClosedMapForMatch(
  matchId: string | null,
  closedMaps: readonly ClosedMapResult[],
): ClosedMapResult | null {
  if (matchId === null) return null;
  return closedMaps.find((map) => map.matchId === matchId) ?? null;
}
