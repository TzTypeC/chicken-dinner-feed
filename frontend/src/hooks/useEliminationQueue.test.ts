import type { MatchState, Team } from '@cdf/shared';
import { describe, expect, it } from 'vitest';
import { INITIAL_ELIMINATION_TRACKER_STATE, stepEliminationTracker } from './useEliminationQueue';

function makeTeam(overrides: Partial<Team> & Pick<Team, 'teamNo'>): Team {
  const { teamNo, ...rest } = overrides;
  return {
    teamNo,
    name: `Team ${teamNo}`,
    logoUrl: null,
    rank: teamNo,
    hasAppeared: true,
    isEliminated: false,
    standingPlayerCount: 4,
    eliminations: 0,
    placement: null,
    killPoints: 0,
    placementPoints: 0,
    totalPoints: 0,
    players: [],
    ...rest,
  };
}

function makeMatch(overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchId: 'match-1',
    phase: 'live',
    standingTeamCount: 2,
    teams: [makeTeam({ teamNo: 1 }), makeTeam({ teamNo: 2 })],
    ...overrides,
  };
}

describe('stepEliminationTracker', () => {
  it('seeds already-eliminated teams on the first snapshot without enqueueing alerts', () => {
    const initialMatch = makeMatch({
      teams: [
        makeTeam({ teamNo: 1, isEliminated: false }),
        makeTeam({ teamNo: 2, isEliminated: true, placement: 16 }),
      ],
    });

    const state = stepEliminationTracker(INITIAL_ELIMINATION_TRACKER_STATE, initialMatch);

    expect(state.initialized).toBe(true);
    expect(state.matchId).toBe('match-1');
    expect(state.eliminatedTeamNos.has(2)).toBe(true);
    expect(state.queue).toHaveLength(0);
  });

  it('enqueues an alert when an alive team transitions to eliminated on a subsequent snapshot', () => {
    const s1 = stepEliminationTracker(INITIAL_ELIMINATION_TRACKER_STATE, makeMatch());

    const s2 = stepEliminationTracker(
      s1,
      makeMatch({
        teams: [
          makeTeam({ teamNo: 1, isEliminated: false }),
          makeTeam({ teamNo: 2, isEliminated: true, placement: 12, eliminations: 5 }),
        ],
      }),
    );

    expect(s2.queue).toHaveLength(1);
    expect(s2.queue[0]).toMatchObject({
      matchId: 'match-1',
      teamNo: 2,
      teamName: 'Team 2',
      placement: 12,
      eliminations: 5,
    });

    // Repeated identical snapshots do not duplicate the alert.
    const s3 = stepEliminationTracker(
      s2,
      makeMatch({
        teams: [
          makeTeam({ teamNo: 1, isEliminated: false }),
          makeTeam({ teamNo: 2, isEliminated: true, placement: 12, eliminations: 5 }),
        ],
      }),
    );
    expect(s3.queue).toHaveLength(1);
  });

  it('orders simultaneous eliminations by placement descending (worst placement first)', () => {
    const s1 = stepEliminationTracker(
      INITIAL_ELIMINATION_TRACKER_STATE,
      makeMatch({
        teams: [makeTeam({ teamNo: 1 }), makeTeam({ teamNo: 2 }), makeTeam({ teamNo: 3 })],
      }),
    );

    const s2 = stepEliminationTracker(
      s1,
      makeMatch({
        teams: [
          makeTeam({ teamNo: 1, isEliminated: false }),
          makeTeam({ teamNo: 2, isEliminated: true, placement: 9 }),
          makeTeam({ teamNo: 3, isEliminated: true, placement: 10 }),
        ],
      }),
    );

    expect(s2.queue.map((item) => item.teamNo)).toEqual([3, 2]);
    expect(s2.queue.map((item) => item.placement)).toEqual([10, 9]);
  });

  it('suppresses elimination alerts while match phase is idle (warmup)', () => {
    const s1 = stepEliminationTracker(
      INITIAL_ELIMINATION_TRACKER_STATE,
      makeMatch({ phase: 'idle' }),
    );

    const s2 = stepEliminationTracker(
      s1,
      makeMatch({
        phase: 'idle',
        teams: [
          makeTeam({ teamNo: 1, isEliminated: false }),
          makeTeam({ teamNo: 2, isEliminated: true, placement: 16 }),
        ],
      }),
    );

    expect(s2.queue).toHaveLength(0);
  });

  it('cancels a pending alert and removes from seen set when Manual Mode undoes an elimination', () => {
    const s1 = stepEliminationTracker(INITIAL_ELIMINATION_TRACKER_STATE, makeMatch());

    // Operator accidentally clicks OUT on Team 2
    const s2 = stepEliminationTracker(
      s1,
      makeMatch({
        teams: [
          makeTeam({ teamNo: 1, isEliminated: false }),
          makeTeam({ teamNo: 2, isEliminated: true, placement: 16 }),
        ],
      }),
    );
    expect(s2.queue).toHaveLength(1);

    // Operator immediately restores Team 2 to alive
    const s3 = stepEliminationTracker(
      s2,
      makeMatch({
        teams: [
          makeTeam({ teamNo: 1, isEliminated: false }),
          makeTeam({ teamNo: 2, isEliminated: false, placement: null }),
        ],
      }),
    );
    expect(s3.eliminatedTeamNos.has(2)).toBe(false);
    expect(s3.queue).toHaveLength(0);

    // Later, Team 2 is genuinely eliminated at #5 -> fires alert cleanly
    const s4 = stepEliminationTracker(
      s3,
      makeMatch({
        teams: [
          makeTeam({ teamNo: 1, isEliminated: false }),
          makeTeam({ teamNo: 2, isEliminated: true, placement: 5 }),
        ],
      }),
    );
    expect(s4.queue).toHaveLength(1);
    expect(s4.queue[0]?.placement).toBe(5);
  });

  it('resets baseline and clears stale queue when matchId changes', () => {
    const s1 = stepEliminationTracker(INITIAL_ELIMINATION_TRACKER_STATE, makeMatch());
    const s2 = stepEliminationTracker(
      s1,
      makeMatch({
        teams: [
          makeTeam({ teamNo: 1, isEliminated: false }),
          makeTeam({ teamNo: 2, isEliminated: true, placement: 2 }),
        ],
      }),
    );
    expect(s2.queue).toHaveLength(1);

    const newMatch = makeMatch({
      matchId: 'match-2',
      teams: [makeTeam({ teamNo: 1 }), makeTeam({ teamNo: 2 })],
    });
    const s3 = stepEliminationTracker(s2, newMatch);
    expect(s3.matchId).toBe('match-2');
    expect(s3.queue).toHaveLength(0);
    expect(s3.eliminatedTeamNos.size).toBe(0);
  });
});
