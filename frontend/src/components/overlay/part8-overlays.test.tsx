import {
  DEFAULT_OVERLAY_APPEARANCE,
  type ClosedMapResult,
  type MatchState,
  type Team,
} from '@cdf/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { selectPostGameResults } from './broadcast-state';
import { LeaderboardOverlay } from './LeaderboardOverlay';
import { PostGameOverlay } from './PostGameOverlay';

function team(teamNo: number, name: string, rank: number): Team {
  return {
    teamNo,
    name,
    logoUrl: null,
    players: [],
    standingPlayerCount: 4,
    eliminations: 0,
    killPoints: 0,
    placementPoints: 0,
    totalPoints: 0,
    rank,
    placement: null,
    isEliminated: false,
    hasAppeared: true,
  };
}

const MATCH: MatchState = {
  matchId: 'm1',
  phase: 'live',
  standingTeamCount: 2,
  teams: [team(20, 'Lanang nak chicken main pubg', 1), team(1, 'Team Alpha', 2)],
};

const MATCH_INFO = { matchNumber: 1, mapName: 'Erangel' };

describe('LeaderboardOverlay team names (Part 8, static markup)', () => {
  it('applies the default 14-character limit without touching the stored name', () => {
    const html = renderToStaticMarkup(
      <LeaderboardOverlay match={MATCH} appearance={DEFAULT_OVERLAY_APPEARANCE} source="manual" />,
    );
    expect(html).toContain('>Lanang nak ...<');
    expect(html).toContain('>Team Alpha<');
    // The full name stays available as the row's tooltip.
    expect(html).toContain('title="Lanang nak chicken main pubg"');
  });

  it('shows full names in extended mode and follows a changed limit', () => {
    const extended = renderToStaticMarkup(
      <LeaderboardOverlay
        match={MATCH}
        appearance={{ ...DEFAULT_OVERLAY_APPEARANCE, teamNameExtendedMode: true }}
        source="manual"
      />,
    );
    expect(extended).toContain('>Lanang nak chicken main pubg<');
    expect(extended).not.toContain('Lanang nak ...');

    const limit20 = renderToStaticMarkup(
      <LeaderboardOverlay
        match={MATCH}
        appearance={{ ...DEFAULT_OVERLAY_APPEARANCE, teamNameMaxChars: 20 }}
        source="manual"
      />,
    );
    expect(limit20).toContain('>Lanang nak chicke...<');
  });
});

describe('PostGameOverlay ADJ column (Part 8)', () => {
  const base: Omit<ClosedMapResult, 'teams'> = {
    id: 'm1',
    mapNumber: 1,
    mapName: 'Erangel',
    matchId: null,
    startedAt: null,
    endedAt: null,
  };
  const plain = {
    teamNo: 1,
    placement: 1,
    eliminations: 2,
    placementPoints: 10,
    killPoints: 2,
    totalPoints: 12,
  };

  it('is absent when the match has no adjustment', () => {
    const board = selectPostGameResults(MATCH, { ...base, teams: [plain] }, MATCH_INFO);
    const html = renderToStaticMarkup(
      <PostGameOverlay
        board={board}
        matchInfo={MATCH_INFO}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(html).not.toContain('postgame-adj-header');
    expect(html).toContain('SINGLE-MATCH SCORE (10P + 2E)');
  });

  it('appears with the signed value and an arithmetic label that adds up', () => {
    const board = selectPostGameResults(
      MATCH,
      { ...base, teams: [{ ...plain, additionalPoints: -8, totalPoints: 4 }] },
      MATCH_INFO,
    );
    const html = renderToStaticMarkup(
      <PostGameOverlay
        board={board}
        matchInfo={MATCH_INFO}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(html).toContain('data-testid="postgame-adj-header"');
    expect(html).toMatch(/data-testid="postgame-adj-1"[^>]*>\u22128</);
    expect(html).toContain('SINGLE-MATCH SCORE (10P + 2E \u2212 8A)');
    expect(html).toMatch(/data-testid="postgame-match-pts-1"[^>]*>4</);
  });
});
