import {
  DEFAULT_OVERLAY_APPEARANCE,
  type ClosedMapResult,
  type MatchState,
  type Team,
} from '@cdf/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { selectPostGameResults, selectWwcdWinner, type PostGameBoardData } from './broadcast-state';
import { FullscreenWwcdOverlay } from './FullscreenWwcdOverlay';
import { PostGameOverlay } from './PostGameOverlay';
import { WwcdOverlay } from './WwcdOverlay';

function team(teamNo: number, overrides: Partial<Team> = {}): Team {
  return {
    teamNo,
    name: `Team ${teamNo}`,
    logoUrl: null,
    players: [],
    standingPlayerCount: 4,
    eliminations: 0,
    killPoints: 0,
    placementPoints: 0,
    totalPoints: 0,
    rank: teamNo,
    placement: null,
    isEliminated: false,
    hasAppeared: true,
    ...overrides,
  };
}

const out = (teamNo: number, overrides: Partial<Team> = {}) =>
  team(teamNo, { isEliminated: true, standingPlayerCount: 0, ...overrides });

const INFO = { matchNumber: 2, mapName: 'Miramar' };

/** Team A (6 kills) went out 2nd; Team B survives with no kills. */
const LIVE: MatchState = {
  matchId: 'live-1',
  phase: 'live',
  standingTeamCount: 1,
  teams: [
    out(1, { name: 'Team A', eliminations: 6, killPoints: 6, placementPoints: 6, placement: 2 }),
    team(2, { name: 'Team B', placementPoints: 10 }),
    out(3, { name: 'Team C', placement: 3, placementPoints: 5 }),
  ],
};

function recorded(placements: [number, number][]): ClosedMapResult {
  return {
    id: 'map-1',
    mapNumber: 1,
    mapName: 'Erangel',
    matchId: 'live-1',
    startedAt: null,
    endedAt: 1,
    teams: placements.map(([teamNo, placement]) => ({
      teamNo,
      placement,
      eliminations: 0,
      killPoints: 0,
      placementPoints: 0,
      totalPoints: 0,
      name: `Snapshot ${teamNo}`,
      logoUrl: null,
    })),
  };
}

const render = (board: PostGameBoardData | null, showLogos = false) =>
  renderToStaticMarkup(
    <PostGameOverlay
      board={board}
      matchInfo={INFO}
      appearance={{ ...DEFAULT_OVERLAY_APPEARANCE, showLogos }}
    />,
  );

describe('PostGameOverlay result status (Part 9)', () => {
  it('labels a provisional board and its points, and highlights only the confirmed survivor', () => {
    const html = render(selectPostGameResults(LIVE, null, INFO, { closedMaps: [] }));

    expect(html).toContain('data-testid="postgame-status-banner"');
    expect(html).toContain('PROVISIONAL — MAP NOT CLOSED');
    expect(html).toContain('WWCD · PROVISIONAL');
    expect(html).toContain('TOTAL MATCH POINTS (PROVISIONAL)');
    expect(html).toContain('data-testid="postgame-winner-name"');
    expect(html).toMatch(/postgame-winner-name[^>]*>Team B</);
    // Exactly one table row carries the winner highlight, and it is Team B's, not Team A's (top scorer).
    expect(html.split('rgba(229, 169, 60, 0.14)').length - 1).toBe(1);
    expect(html).toMatch(/postgame-row-2"[^>]*rgba\(229, 169, 60, 0\.14\)/);
  });

  it('shows no banner and the official title for a final board', () => {
    const map = recorded([
      [2, 1],
      [1, 2],
    ]);
    const html = render(selectPostGameResults(LIVE, map, INFO, { closedMaps: [map] }));

    expect(html).not.toContain('postgame-status-banner');
    expect(html).toContain('WINNER WINNER CHICKEN DINNER');
    expect(html).not.toContain('PROVISIONAL');
  });

  it('says "not recorded" instead of crowning anybody when a closed map has no #1', () => {
    const map = recorded([
      [1, 2],
      [2, 3],
    ]);
    const html = render(selectPostGameResults(LIVE, map, INFO, { closedMaps: [map] }));

    expect(html).toContain('data-testid="postgame-no-winner-card"');
    expect(html).toContain('WWCD NOT RECORDED');
    expect(html).not.toContain('data-testid="postgame-winner-card"');
  });

  it('says "not confirmed yet" when the survivor cannot be confirmed', () => {
    const partial: MatchState = {
      ...LIVE,
      teams: [team(1), team(2, { standingPlayerCount: 0 }), out(3)],
    };
    const html = render(selectPostGameResults(partial, null, INFO, { closedMaps: [] }));

    expect(html).toContain('WWCD NOT CONFIRMED YET');
    expect(html).toContain('PROVISIONAL — MAP NOT CLOSED');
  });

  it('shows a dash, not an invented number, for a team without a placement yet', () => {
    const live: MatchState = {
      ...LIVE,
      teams: [...LIVE.teams, team(4, { name: 'Team D', standingPlayerCount: 0 })],
    };
    const html = render(selectPostGameResults(live, null, INFO, { closedMaps: [] }));
    // Team D has appeared, is not eliminated and has no player data → unconfirmed, no #1 anywhere.
    expect(html).not.toMatch(/>#1</);
  });
});

describe('postgame winner glow layer (Part 9)', () => {
  const map = recorded([[2, 1]]);

  it.each([false, true])(
    'is its own full-block layer sized to the nearest edges (logos %s)',
    (logos) => {
      const html = render(selectPostGameResults(LIVE, map, INFO, { closedMaps: [map] }), logos);

      expect(html).toContain('data-testid="postgame-winner-glow"');
      expect(html).toContain('ellipse closest-side at 50% 40%');
      // The fade ends fully transparent, so no edge can cut a visible band.
      expect(html).toContain('rgba(229, 169, 60, 0) 100%');
      expect(html).not.toContain('circle at 50% 25%');
    },
  );
});

describe('WWCD overlays show provisional vs final (Part 9, Q4b)', () => {
  const provisional = selectWwcdWinner(LIVE, null, { closedMaps: [] });
  const map = recorded([[2, 1]]);
  const final = selectWwcdWinner(LIVE, map, { closedMaps: [map] });

  it('renders clean WWCD celebration without redundant provisional text', () => {
    const live = renderToStaticMarkup(
      <WwcdOverlay winner={provisional} matchInfo={INFO} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );
    expect(live).not.toContain('wwcd-status-tag');
    expect(live).not.toContain('Provisional — map not closed');

    const closed = renderToStaticMarkup(
      <WwcdOverlay winner={final} matchInfo={INFO} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );
    expect(closed).not.toContain('wwcd-status-tag');
    expect(closed).not.toContain('Provisional — map not closed');
  });

  it('renders official celebration on fullscreen without provisional banner', () => {
    const live = renderToStaticMarkup(
      <FullscreenWwcdOverlay
        winner={provisional}
        matchInfo={INFO}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(live).not.toContain('PROVISIONAL — MAP NOT CLOSED');
    expect(live).toContain('OFFICIAL VICTORY CEREMONY');

    const closed = renderToStaticMarkup(
      <FullscreenWwcdOverlay
        winner={final}
        matchInfo={INFO}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(closed).toContain('OFFICIAL VICTORY CEREMONY');
    expect(closed).not.toContain('PROVISIONAL — MAP NOT CLOSED');
  });

  it('labels the admin-preview sample as not a result', () => {
    const sample = selectWwcdWinner({ ...LIVE, phase: 'idle' }, null, {
      isPreviewSimulation: true,
    });
    const html = renderToStaticMarkup(
      <WwcdOverlay winner={sample} matchInfo={INFO} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );
    expect(html).toContain('Preview sample — not a result');
    expect(html).not.toContain('Team A');
  });
});
