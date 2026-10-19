import { DEFAULT_OVERLAY_APPEARANCE, type MatchState } from '@cdf/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EliminationOverlay } from './EliminationOverlay';
import { LeaderboardOverlay } from './LeaderboardOverlay';
import { MatchInfoOverlay } from './MatchInfoOverlay';

const SAMPLE_MATCH: MatchState = {
  matchId: 'match-1',
  phase: 'live',
  standingTeamCount: 2,
  teams: [
    {
      teamNo: 1,
      name: 'ALPHA SQUAD',
      logoUrl: '/api/team-logos/alpha.png',
      rank: 1,
      hasAppeared: true,
      isEliminated: false,
      standingPlayerCount: 4,
      eliminations: 7,
      placement: null,
      killPoints: 7,
      placementPoints: 0,
      totalPoints: 7,
      players: [],
    },
  ],
};

describe('LeaderboardOverlay showLogos toggle', () => {
  it('renders logo img when showLogos is true (default)', () => {
    const html = renderToStaticMarkup(
      <LeaderboardOverlay
        match={SAMPLE_MATCH}
        appearance={{ ...DEFAULT_OVERLAY_APPEARANCE, showLogos: true }}
        source="manual"
        animateRows={false}
      />,
    );
    expect(html).toContain('/api/team-logos/alpha.png');
    expect(html).toContain('ALPHA SQUAD');
  });

  it('omits logo cell completely when showLogos is false', () => {
    const html = renderToStaticMarkup(
      <LeaderboardOverlay
        match={SAMPLE_MATCH}
        appearance={{ ...DEFAULT_OVERLAY_APPEARANCE, showLogos: false }}
        source="manual"
        animateRows={false}
      />,
    );
    expect(html).not.toContain('/api/team-logos/alpha.png');
    expect(html).toContain('ALPHA SQUAD');
  });
});

describe('EliminationOverlay toggles', () => {
  const sampleAlert = {
    id: 'elim-1',
    matchId: 'match-1',
    teamNo: 2,
    teamName: 'BRAVO ESPORTS',
    logoUrl: '/api/team-logos/bravo.png',
    placement: 8,
    rank: 8,
    eliminations: 5,
  };

  it('renders placement, team name, logo, and elimination count by default', () => {
    const html = renderToStaticMarkup(
      <EliminationOverlay alert={sampleAlert} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );
    expect(html).toContain('#8');
    expect(html).toContain('BRAVO ESPORTS');
    expect(html).toContain('TEAM ELIMINATED');
    expect(html).toContain('>5<');
    expect(html).toContain('ELIMS');
    expect(html).toContain('/api/team-logos/bravo.png');
  });

  it('hides elimination count badge when showEliminationAlertElims is false', () => {
    const html = renderToStaticMarkup(
      <EliminationOverlay
        alert={sampleAlert}
        appearance={{
          ...DEFAULT_OVERLAY_APPEARANCE,
          showEliminationAlertElims: false,
        }}
      />,
    );
    expect(html).toContain('BRAVO ESPORTS');
    expect(html).not.toContain('ELIMS');
  });

  it('hides logo when showLogos is false', () => {
    const html = renderToStaticMarkup(
      <EliminationOverlay
        alert={sampleAlert}
        appearance={{
          ...DEFAULT_OVERLAY_APPEARANCE,
          showLogos: false,
        }}
      />,
    );
    expect(html).toContain('BRAVO ESPORTS');
    expect(html).not.toContain('/api/team-logos/bravo.png');
  });

  it('renders nothing when showEliminationAlerts is false', () => {
    const html = renderToStaticMarkup(
      <EliminationOverlay
        alert={sampleAlert}
        appearance={{
          ...DEFAULT_OVERLAY_APPEARANCE,
          showEliminationAlerts: false,
        }}
      />,
    );
    expect(html).not.toContain('BRAVO ESPORTS');
  });
});

describe('MatchInfoOverlay toggles', () => {
  it('renders both match number and map name by default', () => {
    const html = renderToStaticMarkup(
      <MatchInfoOverlay
        matchInfo={{ matchNumber: 3, mapName: 'Miramar' }}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(html).toContain('MATCH 3');
    expect(html).toContain('Miramar');
  });

  it('hides map name segment when showMatchInfoMapName is false', () => {
    const html = renderToStaticMarkup(
      <MatchInfoOverlay
        matchInfo={{ matchNumber: 3, mapName: 'Miramar' }}
        appearance={{
          ...DEFAULT_OVERLAY_APPEARANCE,
          showMatchInfoMapName: false,
        }}
      />,
    );
    expect(html).toContain('MATCH 3');
    expect(html).not.toContain('Miramar');
  });

  it('hides entire pill when showMatchInfo is false', () => {
    const html = renderToStaticMarkup(
      <MatchInfoOverlay
        matchInfo={{ matchNumber: 3, mapName: 'Miramar' }}
        appearance={{
          ...DEFAULT_OVERLAY_APPEARANCE,
          showMatchInfo: false,
        }}
      />,
    );
    expect(html).not.toContain('MATCH 3');
    expect(html).not.toContain('Miramar');
  });
});
