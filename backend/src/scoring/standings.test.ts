import type { ScoringRuleset, TeamRosterEntry } from '@cdf/shared';
import { describe, expect, it } from 'vitest';
import type { IngestPlayer } from '../ingest/source.js';
import { computeStandings } from './standings.js';

const ruleset: ScoringRuleset = {
  schemaVersion: 1,
  id: 'test',
  name: 'Test ruleset',
  pointsPerElimination: 1,
  placementPoints: [10, 6, 5],
};

function roster(...teamNos: number[]): TeamRosterEntry[] {
  return teamNos.map((teamNo) => ({
    teamNo,
    name: `T${teamNo}`,
    logoUrl: null,
  }));
}

function player(
  overrides: Partial<IngestPlayer> & Pick<IngestPlayer, 'teamNo' | 'slot'>,
): IngestPlayer {
  return {
    id: `p${overrides.teamNo}-${overrides.slot}`,
    name: `Player ${overrides.teamNo}-${overrides.slot}`,
    liveState: 'alive',
    health: 100,
    healthMax: 100,
    kills: 0,
    rank: 0,
    ...overrides,
  };
}

describe('computeStandings', () => {
  it('ranks by total points, highest first', () => {
    const teams = computeStandings({
      players: [
        player({ teamNo: 1, slot: 1, kills: 2 }),
        player({ teamNo: 2, slot: 1, kills: 5 }),
        player({ teamNo: 3, slot: 1, kills: 3 }),
      ],
      roster: roster(1, 2, 3),
      ruleset,
      placements: new Map(),
    });

    expect(teams.map((team) => team.teamNo)).toEqual([2, 3, 1]);
    expect(teams.map((team) => team.rank)).toEqual([1, 2, 3]);
  });

  it('sums eliminations across the team and converts them at the configured rate', () => {
    // A 4-team roster, not 1: with only one team possible in the match at all, it would trivially be
    // "guaranteed" 1st place from the start (the series-scoring guaranteed-minimum credit — see the
    // dedicated describe block below), which is not what this test means to exercise.
    const [team] = computeStandings({
      players: [player({ teamNo: 1, slot: 1, kills: 2 }), player({ teamNo: 1, slot: 2, kills: 3 })],
      roster: roster(1, 2, 3, 4),
      ruleset: { ...ruleset, pointsPerElimination: 2 },
      placements: new Map(),
    });

    expect(team?.eliminations).toBe(5);
    expect(team?.killPoints).toBe(10);
    expect(team?.totalPoints).toBe(10);
  });

  it('awards no placement points while the team is still in the match', () => {
    // Same reason for the 4-team roster as above.
    const [team] = computeStandings({
      players: [player({ teamNo: 1, slot: 1, kills: 1 })],
      roster: roster(1, 2, 3, 4),
      ruleset,
      placements: new Map(),
    });

    expect(team?.placement).toBeNull();
    expect(team?.placementPoints).toBe(0);
    expect(team?.totalPoints).toBe(1);
  });

  it('awards placement points once the placement is known', () => {
    const [team] = computeStandings({
      players: [player({ teamNo: 1, slot: 1, kills: 1 })],
      roster: roster(1),
      ruleset,
      placements: new Map([[1, 1]]),
    });

    expect(team?.placement).toBe(1);
    expect(team?.placementPoints).toBe(10);
    expect(team?.totalPoints).toBe(11);
  });

  it('scores zero for placements past the end of the table', () => {
    const [team] = computeStandings({
      players: [player({ teamNo: 1, slot: 1 })],
      roster: roster(1),
      ruleset,
      placements: new Map([[1, 9]]),
    });

    expect(team?.placementPoints).toBe(0);
  });

  it('counts knocked players as still standing', () => {
    const [team] = computeStandings({
      players: [
        player({ teamNo: 1, slot: 1, liveState: 'knocked', health: 0 }),
        player({ teamNo: 1, slot: 2, liveState: 'dead', health: 0 }),
      ],
      roster: roster(1),
      ruleset,
      placements: new Map(),
    });

    expect(team?.standingPlayerCount).toBe(1);
    expect(team?.isEliminated).toBe(false);
  });

  it('marks a team eliminated only when every reported player is dead', () => {
    const [team] = computeStandings({
      players: [
        player({ teamNo: 1, slot: 1, liveState: 'dead', health: 0 }),
        player({ teamNo: 1, slot: 2, liveState: 'dead', health: 0 }),
      ],
      roster: roster(1),
      ruleset,
      placements: new Map(),
    });

    expect(team?.standingPlayerCount).toBe(0);
    expect(team?.isEliminated).toBe(true);
  });

  it('does not treat a team with no reported players as eliminated', () => {
    // Before the first update arrives every team is unknown. Rendering them all as wiped out would
    // black out the entire table on air.
    const [team] = computeStandings({
      players: [],
      roster: roster(1),
      ruleset,
      placements: new Map(),
    });

    expect(team?.isEliminated).toBe(false);
    expect(team?.standingPlayerCount).toBe(0);
    expect(team?.players).toEqual([]);
  });

  it('keeps every roster team in the table even when the ingest reports none of its players', () => {
    const teams = computeStandings({
      players: [player({ teamNo: 2, slot: 1, kills: 1 })],
      roster: roster(1, 2, 3),
      ruleset,
      placements: new Map(),
    });

    expect(teams).toHaveLength(3);
    expect(teams.map((team) => team.teamNo).sort()).toEqual([1, 2, 3]);
  });

  describe('tower ordering: total points first, Team Order (teamNo) as the only tie-break (Part 9)', () => {
    it('puts the lower teamNo first when points tie, however the names sort', () => {
      const teams = computeStandings({
        players: [],
        roster: [
          { teamNo: 1, name: 'Zebra Esports', logoUrl: null },
          { teamNo: 2, name: 'Alpha Team', logoUrl: null },
          { teamNo: 3, name: 'Bravo Squad', logoUrl: null },
          { teamNo: 4, name: 'Delta Gaming', logoUrl: null },
        ],
        ruleset,
        placements: new Map(),
      });

      expect(teams.map((team) => team.name)).toEqual([
        'Zebra Esports',
        'Alpha Team',
        'Bravo Squad',
        'Delta Gaming',
      ]);
      expect(teams.map((team) => team.rank)).toEqual([1, 2, 3, 4]);
    });

    it('keeps Team A (order 1) above Team B (order 2) at equal points, and lets more points win', () => {
      const equal = computeStandings({
        players: [
          player({ teamNo: 1, slot: 1, kills: 10 }),
          player({ teamNo: 2, slot: 1, kills: 10 }),
        ],
        roster: roster(2, 1),
        ruleset,
        placements: new Map(),
      });
      expect(equal.map((team) => team.teamNo)).toEqual([1, 2]);

      const bWins = computeStandings({
        players: [
          player({ teamNo: 1, slot: 1, kills: 10 }),
          player({ teamNo: 2, slot: 1, kills: 15 }),
        ],
        roster: roster(1, 2),
        ruleset,
        placements: new Map(),
      });
      expect(bWins.map((team) => team.teamNo)).toEqual([2, 1]);
    });

    it('ignores eliminations on a points tie', () => {
      // Team 1: 0 kills + 10 (1st) = 10. Team 2: 2 kills + 5 (3rd) + 3 series = 10. More
      // eliminations (Team 2) must not matter: Team Order decides.
      const teams = computeStandings({
        players: [
          player({ teamNo: 1, slot: 1, kills: 0 }),
          player({ teamNo: 2, slot: 1, kills: 2 }),
        ],
        roster: roster(1, 2),
        ruleset,
        placements: new Map([
          [1, 1],
          [2, 3],
        ]),
        // Team 1: 0 kills + 10 (1st) = 10. Team 2: 2 kills + 5 (3rd) = 7 + 3 series = 10.
        seriesPointsByTeam: new Map([[2, 3]]),
      });
      expect(teams.map((team) => team.totalPoints)).toEqual([10, 10]);
      expect(teams[0]?.eliminations).toBe(0);
      expect(teams.map((team) => team.teamNo)).toEqual([1, 2]);
    });

    it('orders an all-zero table exactly like the roster, whatever order the roster array is in', () => {
      const shuffled = [7, 3, 12, 1, 25, 5];
      const teams = computeStandings({
        players: [],
        roster: shuffled.map((teamNo) => ({ teamNo, name: `n${26 - teamNo}`, logoUrl: null })),
        ruleset,
        placements: new Map(),
      });
      expect(teams.map((team) => team.teamNo)).toEqual([1, 3, 5, 7, 12, 25]);
    });

    it('does not use the name even when names are identical or differ only by case', () => {
      const teams = computeStandings({
        players: [],
        roster: [
          { teamNo: 2, name: 'TEAM A', logoUrl: null },
          { teamNo: 1, name: 'Team A', logoUrl: null },
          { teamNo: 3, name: 'Team A', logoUrl: null },
        ],
        ruleset,
        placements: new Map(),
      });
      expect(teams.map((team) => team.teamNo)).toEqual([1, 2, 3]);
    });

    it('does not push never-appeared teams below appeared teams that are tied with them', () => {
      // Team 3 has appeared; teams 1 and 2 never have. All have 0 points once Team 3 has none
      // either (no guaranteed-minimum credit: the standing count of 1 awards 10, so use a ruleset
      // whose first placement is worth nothing to isolate the ordering rule).
      const flat: ScoringRuleset = { ...ruleset, placementPoints: [0, 0, 0] };
      const teams = computeStandings({
        players: [player({ teamNo: 3, slot: 1 })],
        roster: roster(1, 2, 3),
        ruleset: flat,
        placements: new Map(),
        presentTeams: new Set([3]),
      });
      expect(teams.map((team) => team.teamNo)).toEqual([1, 2, 3]);
      expect(teams.map((team) => team.hasAppeared)).toEqual([false, false, true]);
    });

    it('sorts a large table by points descending then teamNo ascending, for any input order', () => {
      const teamNos = Array.from({ length: 25 }, (_unused, index) => index + 1);
      const killsOf = (teamNo: number) => (teamNo * 7) % 4; // 0..3, many ties
      const expected = [...teamNos].sort((a, b) => killsOf(b) - killsOf(a) || a - b);
      // Deterministic pseudo-shuffles of both the roster and the players.
      for (const seed of [1, 2, 3, 4, 5]) {
        const order = [...teamNos].sort(
          (a, b) => ((a * seed * 31) % 17) - ((b * seed * 31) % 17) || a - b,
        );
        const teams = computeStandings({
          players: order.map((teamNo) => player({ teamNo, slot: 1, kills: killsOf(teamNo) })),
          roster: order.map((teamNo) => ({
            teamNo,
            name: `x${(teamNo * seed) % 25}`,
            logoUrl: null,
          })),
          ruleset: { ...ruleset, placementPoints: [0, 0, 0] },
          placements: new Map(),
        });
        expect(teams.map((team) => team.teamNo)).toEqual(expected);
        expect(teams.map((team) => team.rank)).toEqual(teamNos);
      }
    });

    it('ranks a negative total below teams on zero, and still uses Team Order among equal negatives', () => {
      const teams = computeStandings({
        players: [],
        roster: roster(1, 2, 3),
        ruleset,
        placements: new Map(),
        presentTeams: new Set(),
        seriesPointsByTeam: new Map([
          [1, -5],
          [3, -5],
        ]),
      });
      expect(teams.map((team) => team.teamNo)).toEqual([2, 1, 3]);
    });

    it('includes series points in the comparison', () => {
      const teams = computeStandings({
        players: [],
        roster: roster(1, 2),
        ruleset,
        placements: new Map(),
        presentTeams: new Set(),
        seriesPointsByTeam: new Map([[2, 4]]),
      });
      expect(teams.map((team) => team.teamNo)).toEqual([2, 1]);
    });
  });

  it('orders players within a team by slot, so each player keeps the same bar', () => {
    const [team] = computeStandings({
      players: [
        player({ teamNo: 1, slot: 3 }),
        player({ teamNo: 1, slot: 1 }),
        player({ teamNo: 1, slot: 4 }),
        player({ teamNo: 1, slot: 2 }),
      ],
      roster: roster(1),
      ruleset,
      placements: new Map(),
    });

    expect(team?.players.map((p) => p.slot)).toEqual([1, 2, 3, 4]);
  });

  it('marks a team absent when presentTeams is given and it is not in the set', () => {
    const [team] = computeStandings({
      players: [],
      roster: roster(1),
      ruleset,
      placements: new Map(),
      presentTeams: new Set(),
    });

    expect(team?.hasAppeared).toBe(false);
  });

  it('defaults every roster team to present when presentTeams is not given', () => {
    // Preserves old behaviour for callers (mostly other tests) that do not care about presence.
    const [team] = computeStandings({
      players: [],
      roster: roster(1),
      ruleset,
      placements: new Map(),
    });

    expect(team?.hasAppeared).toBe(true);
  });

  it('a never-present roster team with a lower teamNo does not outrank the real team that scored', () => {
    // A small test lobby using 1 of a 16-team roster: the real team is the only one standing, so it
    // holds the guaranteed-minimum points and ranks first by points, not by roster position.
    const teams = computeStandings({
      players: [player({ teamNo: 2, slot: 1 })],
      roster: roster(1, 2),
      ruleset,
      placements: new Map(),
      presentTeams: new Set([2]),
    });

    expect(teams.map((team) => team.teamNo)).toEqual([2, 1]);
    expect(teams[0]?.hasAppeared).toBe(true);
    expect(teams[1]?.hasAppeared).toBe(false);
  });

  describe('multi-map series scoring (specs/SCORING-LOGIC-UPDATE.md)', () => {
    const pubgmRuleset: ScoringRuleset = {
      schemaVersion: 1,
      id: 'pubgm',
      name: 'PUBGM standard',
      pointsPerElimination: 1,
      placementPoints: [10, 6, 5, 4, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    };

    it('credits every still-alive team the guaranteed-minimum placement for 8 survivors out of 9', () => {
      // The spec's own example: 9 teams started, 1 has been eliminated (placed 9th), so none of the
      // remaining 8 can finish worse than 8th — all 8 are credited that now, on top of kills.
      const teamNos = Array.from({ length: 9 }, (_, i) => i + 1);
      const teams = computeStandings({
        players: teamNos.map((teamNo) => player({ teamNo, slot: 1 })),
        roster: roster(...teamNos),
        ruleset: pubgmRuleset,
        placements: new Map([[9, 9]]), // team 9 is the only one eliminated so far.
      });

      const survivors = teams.filter((team) => team.teamNo !== 9);
      expect(survivors).toHaveLength(8);
      for (const team of survivors) {
        expect(team.placement).toBeNull();
        expect(team.placementPoints).toBe(1); // placementPoints[8 - 1]
      }
      expect(teams.find((team) => team.teamNo === 9)?.placementPoints).toBe(0); // 9th scores nothing.
    });

    it('credits both remaining teams the 2nd-place guarantee once only 2 are left alive', () => {
      const teams = computeStandings({
        players: [player({ teamNo: 1, slot: 1 }), player({ teamNo: 2, slot: 1 })],
        roster: roster(1, 2),
        ruleset: pubgmRuleset,
        placements: new Map(),
      });

      expect(teams.every((team) => team.placement === null)).toBe(true);
      expect(teams.every((team) => team.placementPoints === 6)).toBe(true); // placementPoints[2 - 1]
    });

    it('replaces the guaranteed-minimum with the real placement once it is known, never less', () => {
      const [team] = computeStandings({
        players: [player({ teamNo: 1, slot: 1, kills: 3 })],
        roster: roster(1),
        ruleset: pubgmRuleset,
        placements: new Map([[1, 1]]), // finished 1st.
      });

      expect(team?.placementPoints).toBe(10); // the real 1st-place value, not a guaranteed-minimum.
      expect(team?.totalPoints).toBe(13);
    });

    it('adds series points from closed maps on top of this map, recomputed fresh rather than accumulated', () => {
      const [team] = computeStandings({
        players: [player({ teamNo: 1, slot: 1, kills: 2 })],
        roster: roster(1),
        ruleset: pubgmRuleset,
        placements: new Map(),
        seriesPointsByTeam: new Map([[1, 17]]),
      });

      // killPoints (2) + guaranteed-minimum for 1 team standing (placementPoints[0] = 10) + series (17).
      expect(team?.placementPoints).toBe(10);
      expect(team?.totalPoints).toBe(29);
    });

    it('does not credit a guaranteed-minimum to a team that has not appeared in this map at all', () => {
      const teams = computeStandings({
        players: [player({ teamNo: 1, slot: 1 })],
        roster: roster(1, 2),
        ruleset: pubgmRuleset,
        placements: new Map(),
        presentTeams: new Set([1]),
      });

      expect(teams.find((team) => team.teamNo === 2)?.placementPoints).toBe(0);
    });

    it('a team that sat out this map but scored earlier in the series ranks by its series points', () => {
      const teams = computeStandings({
        players: [],
        roster: roster(1, 2),
        ruleset: pubgmRuleset,
        placements: new Map(),
        presentTeams: new Set(), // neither team has appeared in THIS map yet.
        seriesPointsByTeam: new Map([[2, 12]]), // team 2 played (and scored) in an earlier map.
      });

      expect(teams.map((team) => team.teamNo)).toEqual([2, 1]);
      // The exposed `hasAppeared` stays this-match-only — the overlay's grey-out depends on that.
      expect(teams[0]?.hasAppeared).toBe(false);
    });

    it('bankedPointsByTeam stops double-counting a just-closed map still frozen on screen', () => {
      // Regression: found live, running the app — a map closing pushed its own points into the
      // series total while MatchStore was still showing that same match's data (frozen, per
      // ADR-0007, until the next map's first update). Without netting, PTS briefly counted the
      // closing map's points twice, then visibly dropped once the next match actually started.
      const [team] = computeStandings({
        players: [player({ teamNo: 1, slot: 1, kills: 8 })],
        roster: roster(1),
        ruleset: pubgmRuleset,
        placements: new Map([[1, 1]]), // this map's own, now-final placement: 1st.
        seriesPointsByTeam: new Map([[1, 121]]), // already includes this same map's 18 points.
        bankedPointsByTeam: new Map([[1, { killPoints: 8, placementPoints: 10 }]]),
      });

      // killPoints/placementPoints are still computed and returned normally for display...
      expect(team?.killPoints).toBe(8);
      expect(team?.placementPoints).toBe(10);
      // ...but totalPoints only counts the series figure, not a second helping on top of it.
      expect(team?.totalPoints).toBe(121);
    });

    it('still counts what is earned after a close, rather than freezing the column', () => {
      // Regression: an operator closing a map while the game was genuinely still running watched
      // PTS freeze for the rest of that match. The old all-or-nothing flag suppressed the match
      // wholesale and only cleared on a new match id, which never came while the same game ran on.
      const [team] = computeStandings({
        players: [player({ teamNo: 1, slot: 1, kills: 11 })], // three more kills since the close.
        roster: roster(1),
        ruleset: pubgmRuleset,
        placements: new Map([[1, 1]]),
        seriesPointsByTeam: new Map([[1, 121]]),
        bankedPointsByTeam: new Map([[1, { killPoints: 8, placementPoints: 10 }]]), // at the close.
      });

      // 11 kills + 10 placement = 21 earned this match, 18 of it already banked → 3 new points.
      expect(team?.totalPoints).toBe(124);
    });

    it('nets each half against its own kind, so a banked placement cannot eat live eliminations', () => {
      // Regression, caught by running the real store rather than by reading it. A map closed out of
      // a still-running match banks a *final* placement (survivors take the best remaining slots —
      // 1st, worth 10), but the live projection that follows is back to a *guaranteed minimum* (8
      // teams alive, worth 1). Netting one combined figure against the other compared the two
      // different bases: the leader's next six kills all vanished into a nine-point deficit before
      // the column moved at all — the very freeze this whole mechanism exists to prevent.
      const [team] = computeStandings({
        players: [player({ teamNo: 1, slot: 1, kills: 6 })], // one more kill since the close.
        roster: roster(1, 2, 3, 4, 5, 6, 7, 8),
        ruleset: pubgmRuleset,
        placements: new Map(), // Still live: nobody has placed, so all eight are guaranteed 8th.
        seriesPointsByTeam: new Map([[1, 15]]),
        bankedPointsByTeam: new Map([[1, { killPoints: 5, placementPoints: 10 }]]),
      });

      expect(team?.placementPoints).toBe(1); // The guaranteed minimum, reported gross as always.
      // 15 already banked + the one kill scored since. Not 15, and not 15 + 6 + 1 either.
      expect(team?.totalPoints).toBe(16);
    });

    it('never returns a negative total, whatever the banked figure claims', () => {
      // `Team.totalPoints` is schema-typed non-negative, and a client silently drops a snapshot that
      // fails validation — an overlay frozen on its last good frame with no visible error. A stale
      // banked figure (a corrected map, say) must degrade to a stalled column, not a dead overlay.
      const [team] = computeStandings({
        players: [player({ teamNo: 1, slot: 1, kills: 1 })],
        roster: roster(1),
        ruleset: pubgmRuleset,
        placements: new Map([[1, 1]]),
        seriesPointsByTeam: new Map([[1, 50]]),
        bankedPointsByTeam: new Map([[1, { killPoints: 999, placementPoints: 999 }]]),
      });

      expect(team?.totalPoints).toBe(50);
    });
  });
});
