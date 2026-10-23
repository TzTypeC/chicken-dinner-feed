import {
  DEFAULT_OVERLAY_APPEARANCE,
  DEFAULT_POST_GAME_BACKGROUND,
  type ClosedMapResult,
  type LiveSnapshot,
  type MatchState,
  type OverlayInstance,
  type Team,
} from '@cdf/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OverlayPage } from '@/pages/OverlayPage';
import { useLiveStore } from '@/stores/live-store';
import {
  isPinnedPostGameMatchUnavailable,
  resolveActiveAutoWwcdVariant,
  resolveLeaderboardLayoutMode,
  selectFinalFourCohort,
  selectPostGameResults,
  selectSeriesStandings,
  selectWwcdWinner,
} from './broadcast-state';
import { EliminationOverlay } from './EliminationOverlay';
import { FinalFourOverlay } from './FinalFourOverlay';
import { FullscreenWwcdOverlay } from './FullscreenWwcdOverlay';
import { LeaderboardOverlay } from './LeaderboardOverlay';
import { MatchInfoOverlay } from './MatchInfoOverlay';
import { PostGameOverlay } from './PostGameOverlay';
import { PostGameSeriesOverlay } from './PostGameSeriesOverlay';
import { WwcdOverlay } from './WwcdOverlay';

function makeTeam(overrides: Partial<Team> & { teamNo: number; rank: number }): Team {
  return {
    teamNo: overrides.teamNo,
    name: overrides.name ?? `TEAM ${overrides.teamNo}`,
    logoUrl: overrides.logoUrl ?? `/api/logos/team-${overrides.teamNo}.png`,
    rank: overrides.rank,
    hasAppeared: overrides.hasAppeared ?? true,
    isEliminated: overrides.isEliminated ?? false,
    standingPlayerCount: overrides.standingPlayerCount ?? (overrides.isEliminated ? 0 : 4),
    eliminations: overrides.eliminations ?? 3,
    placement: overrides.placement ?? null,
    killPoints: overrides.killPoints ?? overrides.eliminations ?? 3,
    placementPoints: overrides.placementPoints ?? 0,
    totalPoints: overrides.totalPoints ?? 10,
    players: overrides.players ?? [
      {
        id: 'p1',
        name: 'Ace',
        teamNo: overrides.teamNo,
        slot: 1,
        liveState: 'alive',
        health: 100,
        healthMax: 100,
        kills: 2,
      },
      {
        id: 'p2',
        name: 'Blaze',
        teamNo: overrides.teamNo,
        slot: 2,
        liveState: 'alive',
        health: 100,
        healthMax: 100,
        kills: 1,
      },
      {
        id: 'p3',
        name: 'Cipher',
        teamNo: overrides.teamNo,
        slot: 3,
        liveState: 'dead',
        health: 0,
        healthMax: 100,
        kills: 0,
      },
      {
        id: 'p4',
        name: 'Drift',
        teamNo: overrides.teamNo,
        slot: 4,
        liveState: 'alive',
        health: 80,
        healthMax: 100,
        kills: 0,
      },
    ],
  };
}

const SAMPLE_MATCH: MatchState = {
  matchId: 'match-1',
  phase: 'live',
  standingTeamCount: 2,
  teams: [
    makeTeam({
      teamNo: 5,
      name: 'ALPHA SQUAD',
      logoUrl: '/api/team-logos/alpha.png',
      rank: 1,
      eliminations: 7,
      killPoints: 7,
      totalPoints: 27,
    }),
  ],
};

describe('LeaderboardOverlay showLogos and showTeamNumbers toggles', () => {
  it('renders logo img and persistent T05 slot badge alongside rank #1 by default', () => {
    const html = renderToStaticMarkup(
      <LeaderboardOverlay
        match={SAMPLE_MATCH}
        appearance={{ ...DEFAULT_OVERLAY_APPEARANCE, showLogos: true, showTeamNumbers: true }}
        source="manual"
        animateRows={false}
      />,
    );
    expect(html).toContain('/api/team-logos/alpha.png');
    expect(html).toContain('ALPHA SQUAD');
    expect(html).toContain('T05');
    expect(html).toContain('data-testid="team-slot-5"');
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

  it('hides persistent T05 slot badge when showTeamNumbers is false', () => {
    const html = renderToStaticMarkup(
      <LeaderboardOverlay
        match={SAMPLE_MATCH}
        appearance={{ ...DEFAULT_OVERLAY_APPEARANCE, showTeamNumbers: false }}
        source="manual"
        animateRows={false}
      />,
    );
    expect(html).not.toContain('T05');
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

  it('renders placement, team slot T02, team name, logo, and elimination count by default', () => {
    const html = renderToStaticMarkup(
      <EliminationOverlay alert={sampleAlert} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );
    expect(html).toContain('#8');
    expect(html).toContain('T02');
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

describe('Final-4 & WWCD state machine (D-PMCC-02 / A1 & D-PMCC-03)', () => {
  const baseTeams = [
    makeTeam({ teamNo: 5, name: 'ALPHA', rank: 1, isEliminated: false }),
    makeTeam({ teamNo: 12, name: 'BRAVO', rank: 2, isEliminated: false }),
    makeTeam({ teamNo: 3, name: 'CHARLIE', rank: 3, isEliminated: false }),
    makeTeam({ teamNo: 9, name: 'DELTA', rank: 4, isEliminated: false }),
    makeTeam({ teamNo: 7, name: 'ECHO', rank: 5, isEliminated: true, placement: 5 }),
    makeTeam({ teamNo: 14, name: 'FOXTROT', rank: 6, isEliminated: true, placement: 6 }),
  ];

  it('never triggers Final-4 or WWCD during warmup (phase === idle) or when 0 teams are eliminated', () => {
    const warmupMatch: MatchState = {
      matchId: 'm1',
      phase: 'idle',
      standingTeamCount: 4,
      teams: baseTeams,
    };
    expect(resolveLeaderboardLayoutMode(warmupMatch, DEFAULT_OVERLAY_APPEARANCE)).toBe('tower');

    const lobbyLoadingMatch: MatchState = {
      matchId: 'm1',
      phase: 'live',
      standingTeamCount: 4,
      teams: baseTeams.slice(0, 4), // 4 joined, 0 eliminated
    };
    expect(resolveLeaderboardLayoutMode(lobbyLoadingMatch, DEFAULT_OVERLAY_APPEARANCE)).toBe(
      'tower',
    );
  });

  it('transitions to final-four at 4, 3, and 2 alive teams, reverts to tower at >=5, and transitions to wwcd at 1', () => {
    // 4 alive
    const match4: MatchState = {
      matchId: 'm1',
      phase: 'live',
      standingTeamCount: 4,
      teams: baseTeams,
    };
    expect(resolveLeaderboardLayoutMode(match4, DEFAULT_OVERLAY_APPEARANCE)).toBe('final-four');

    // 3 alive (teamNo 9 eliminated in 4th)
    const match3: MatchState = {
      matchId: 'm1',
      phase: 'live',
      standingTeamCount: 3,
      teams: baseTeams.map((t) =>
        t.teamNo === 9 ? { ...t, isEliminated: true, standingPlayerCount: 0, placement: 4 } : t,
      ),
    };
    expect(resolveLeaderboardLayoutMode(match3, DEFAULT_OVERLAY_APPEARANCE)).toBe('final-four');

    // 2 alive (teamNo 3 also eliminated in 3rd)
    const match2: MatchState = {
      matchId: 'm1',
      phase: 'live',
      standingTeamCount: 2,
      teams: match3.teams.map((t) =>
        t.teamNo === 3 ? { ...t, isEliminated: true, standingPlayerCount: 0, placement: 3 } : t,
      ),
    };
    expect(resolveLeaderboardLayoutMode(match2, DEFAULT_OVERLAY_APPEARANCE)).toBe('final-four');

    // Cohort retention check: at 2 alive teams, all 4 Final-4 cards remain and the 2 eliminated ones are marked knocked out
    const cohortAt2 = selectFinalFourCohort(match2, [5, 12, 3, 9]);
    expect(cohortAt2).toHaveLength(4);
    expect(cohortAt2.map((c) => c.team.teamNo)).toEqual([5, 12, 3, 9]);
    expect(cohortAt2.map((c) => c.isKnockedOut)).toEqual([false, false, true, true]);
    expect(cohortAt2[2]?.eliminatedPlacement).toBe(3);
    expect(cohortAt2[3]?.eliminatedPlacement).toBe(4);

    // Render FinalFourOverlay at 2 alive teams and verify grayed-out cards and persistent T## slots
    const f4Html = renderToStaticMarkup(
      <FinalFourOverlay
        cohort={cohortAt2}
        matchInfo={{ matchNumber: 4, mapName: 'Erangel' }}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(f4Html).toContain('2 / 4 SQUADS ALIVE');
    expect(f4Html).toContain('T05');
    expect(f4Html).toContain('T12');
    expect(f4Html).toContain('T03');
    expect(f4Html).toContain('T09');
    expect(f4Html).toContain('OUT #3');
    expect(f4Html).toContain('OUT #4');
    expect(f4Html).toContain('data-status="eliminated"');

    // Manual Mode correction: 5 teams alive -> reverts to vertical tower
    const match5: MatchState = {
      matchId: 'm1',
      phase: 'live',
      standingTeamCount: 5,
      teams: baseTeams.map((t) =>
        t.teamNo === 7 ? { ...t, isEliminated: false, standingPlayerCount: 2, placement: null } : t,
      ),
    };
    expect(resolveLeaderboardLayoutMode(match5, DEFAULT_OVERLAY_APPEARANCE)).toBe('tower');

    // 1 team alive -> transitions to WWCD
    const match1: MatchState = {
      matchId: 'm1',
      phase: 'live',
      standingTeamCount: 1,
      teams: match2.teams.map((t) =>
        t.teamNo === 12 ? { ...t, isEliminated: true, standingPlayerCount: 0, placement: 2 } : t,
      ),
    };
    expect(resolveLeaderboardLayoutMode(match1, DEFAULT_OVERLAY_APPEARANCE)).toBe('wwcd');
  });
});

describe('WwcdOverlay rendering in PCOB vs Manual mode', () => {
  const match1: MatchState = {
    matchId: 'm1',
    phase: 'live',
    standingTeamCount: 1,
    teams: [
      makeTeam({
        teamNo: 8,
        name: 'GARUDA CHAMPIONS',
        rank: 1,
        isEliminated: false,
        standingPlayerCount: 3,
        eliminations: 14,
        killPoints: 14,
        placementPoints: 10,
        totalPoints: 62,
      }),
      makeTeam({
        teamNo: 2,
        name: 'RUNNER UP',
        rank: 2,
        isEliminated: true,
        standingPlayerCount: 0,
        placement: 2,
      }),
    ],
  };

  it('renders WWCD banner, T08 slot, match vs series points, and real PCOB player names', () => {
    const winner = selectWwcdWinner(match1, null);
    expect(winner).not.toBeNull();
    expect(winner?.matchPoints).toBe(24);
    expect(winner?.seriesPoints).toBe(62);

    const html = renderToStaticMarkup(
      <WwcdOverlay
        winner={winner}
        matchInfo={{ matchNumber: 5, mapName: 'Sanhok' }}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
        source="pcob"
      />,
    );
    expect(html).toContain('WINNER WINNER CHICKEN DINNER');
    expect(html).toContain('GARUDA CHAMPIONS');
    expect(html).toContain('data-testid="wwcd-team-slot"');
    expect(html).toContain('T08');
    expect(html).toContain('Match 5, Sanhok');
    expect(html).toContain('+24');
    expect(html).toContain('>62<');
    expect(html).toContain('Ace');
    expect(html).toContain('Blaze');
    expect(html).toContain('data-testid="wwcd-player-list"');
  });

  it('renders visual survivor bars instead of synthetic Slot 1..4 names in Manual Mode', () => {
    const manualWinnerMatch: MatchState = {
      ...match1,
      teams: match1.teams.map((t, i) =>
        i === 0
          ? {
              ...t,
              players: [
                {
                  id: '1',
                  name: 'Slot 1',
                  teamNo: t.teamNo,
                  slot: 1,
                  liveState: 'alive',
                  health: 100,
                  healthMax: 100,
                  kills: 0,
                },
                {
                  id: '2',
                  name: 'Slot 2',
                  teamNo: t.teamNo,
                  slot: 2,
                  liveState: 'alive',
                  health: 100,
                  healthMax: 100,
                  kills: 0,
                },
                {
                  id: '3',
                  name: 'Slot 3',
                  teamNo: t.teamNo,
                  slot: 3,
                  liveState: 'alive',
                  health: 100,
                  healthMax: 100,
                  kills: 0,
                },
                {
                  id: '4',
                  name: 'Slot 4',
                  teamNo: t.teamNo,
                  slot: 4,
                  liveState: 'dead',
                  health: 0,
                  healthMax: 100,
                  kills: 0,
                },
              ],
            }
          : t,
      ),
    };
    const winner = selectWwcdWinner(manualWinnerMatch, null);
    const html = renderToStaticMarkup(
      <WwcdOverlay
        winner={winner}
        matchInfo={{ matchNumber: 5, mapName: 'Sanhok' }}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
        source="manual"
      />,
    );
    expect(html).toContain('3 of 4 still standing');
    expect(html).not.toContain('Slot 1');
    expect(html).toContain('data-testid="wwcd-survivor-bars"');
  });
});

describe('PostGameOverlay & Custom Background Media (D-PMCC-04 / A3 & D-PMCC-05)', () => {
  const closedMap: ClosedMapResult = {
    id: 'closed-1',
    mapNumber: 3,
    mapName: 'Miramar',
    matchId: 'match-3',
    startedAt: 1000,
    endedAt: 2000,
    teams: Array.from({ length: 16 }, (_, idx) => {
      const placement = idx + 1;
      const teamNo = ((idx + 4) % 16) + 1;
      const placementPoints = placement === 1 ? 10 : placement === 2 ? 6 : placement === 3 ? 5 : 0;
      const eliminations = Math.max(0, 16 - idx);
      return {
        teamNo,
        placement,
        eliminations,
        killPoints: eliminations,
        placementPoints,
        totalPoints: placementPoints + eliminations,
      };
    }),
  };

  const matchWith16Teams: MatchState = {
    matchId: 'match-4',
    phase: 'idle',
    standingTeamCount: 0,
    teams: Array.from({ length: 16 }, (_, idx) =>
      makeTeam({
        teamNo: idx + 1,
        name: `SQUAD ${idx + 1}`,
        rank: idx + 1,
        totalPoints: 80 - idx * 2, // series points different from single-map points
      }),
    ),
  };

  it('renders #1 winner in left spotlight AND all 16 teams in 2-column right table from persisted ClosedMapResult', () => {
    const board = selectPostGameResults(matchWith16Teams, closedMap, {
      matchNumber: 3,
      mapName: 'Miramar',
    });
    expect(board).not.toBeNull();
    expect(board?.sourceKind).toBe('closed-map');
    expect(board?.winner!.teamNo).toBe(5);
    expect(board?.winner!.totalMatchPoints).toBe(26); // 10 place + 16 elims
    expect(board?.rows).toHaveLength(16);

    const html = renderToStaticMarkup(
      <PostGameOverlay
        board={board}
        matchInfo={{ matchNumber: 3, mapName: 'Miramar' }}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );

    // Winner spotlight card
    expect(html).toContain('data-testid="postgame-winner-card"');
    expect(html).toContain('SLOT T05');
    expect(html).toContain('SQUAD 5');
    expect(html).toContain('>26<');

    // All 16 teams present in the right standings table (including #1 winner row 5)
    for (let teamNo = 1; teamNo <= 16; teamNo++) {
      expect(html).toContain(`data-testid="postgame-row-${teamNo}"`);
      expect(html).toContain(`data-testid="postgame-slot-${teamNo}"`);
    }

    // Background disabled by default -> no background layer rendered (transparent OBS canvas)
    expect(html).not.toContain('data-testid="postgame-background-layer"');
  });

  it('renders isolated background image or video with opacity and blur without blurring foreground layer', () => {
    const board = selectPostGameResults(matchWith16Teams, closedMap, {
      matchNumber: 3,
      mapName: 'Miramar',
    });

    const imageHtml = renderToStaticMarkup(
      <PostGameOverlay
        board={board}
        matchInfo={{ matchNumber: 3, mapName: 'Miramar' }}
        appearance={{
          ...DEFAULT_OVERLAY_APPEARANCE,
          postGameBackground: {
            ...DEFAULT_POST_GAME_BACKGROUND,
            mode: 'image',
            mediaUrl: '/api/backgrounds/main.png?v=123',
            opacity: 75,
            blur: 8,
          },
        }}
      />,
    );
    expect(imageHtml).toContain('data-testid="postgame-background-layer"');
    expect(imageHtml).toContain('data-testid="postgame-bg-image"');
    expect(imageHtml).toContain('/api/backgrounds/main.png?v=123');
    expect(imageHtml).toContain('opacity:0.75');
    expect(imageHtml).toContain('blur(calc(8 * var(--overlay-base-unit)))');

    const videoHtml = renderToStaticMarkup(
      <PostGameOverlay
        board={board}
        matchInfo={{ matchNumber: 3, mapName: 'Miramar' }}
        appearance={{
          ...DEFAULT_OVERLAY_APPEARANCE,
          postGameBackground: {
            ...DEFAULT_POST_GAME_BACKGROUND,
            mode: 'video',
            mediaUrl: '/api/backgrounds/main.mp4?v=456',
            opacity: 50,
            blur: 0,
          },
        }}
      />,
    );
    expect(videoHtml).toContain('data-testid="postgame-bg-video"');
    expect(videoHtml).toContain('/api/backgrounds/main.mp4?v=456');
    expect(videoHtml).toContain('opacity:0.5');
  });
});

describe('Overlay route isolation & global visibility coordination (Part 4)', () => {
  const teams6: Team[] = [
    makeTeam({ teamNo: 1, name: 'SQUAD ONE', rank: 1, isEliminated: false }),
    makeTeam({ teamNo: 2, name: 'SQUAD TWO', rank: 2, isEliminated: false }),
    makeTeam({ teamNo: 3, name: 'SQUAD THREE', rank: 3, isEliminated: false }),
    makeTeam({ teamNo: 4, name: 'SQUAD FOUR', rank: 4, isEliminated: false }),
    makeTeam({ teamNo: 5, name: 'SQUAD FIVE', rank: 5, isEliminated: false }),
    makeTeam({ teamNo: 6, name: 'SQUAD SIX', rank: 6, isEliminated: true, placement: 6 }),
  ];

  function setupLiveMatch(standingCount: number, phase: MatchState['phase'] = 'live'): MatchState {
    const teams = teams6.map((t, idx) => {
      const isAlive = idx < standingCount;
      return {
        ...t,
        isEliminated: !isAlive,
        standingPlayerCount: isAlive ? 4 : 0,
        placement: isAlive ? null : idx + 1,
      };
    });
    return {
      matchId: 'test-match-1',
      phase,
      standingTeamCount: standingCount,
      teams,
    };
  }

  function setStoreSnapshot(
    match: MatchState,
    appearance = DEFAULT_OVERLAY_APPEARANCE,
    autoWwcdVariant: 'standard' | 'fullscreen' = 'standard',
  ) {
    const mainInstance: OverlayInstance = {
      id: 'main',
      name: 'Main Leaderboard',
      type: 'leaderboard',
      enabled: true,
      onAir: true,
      appearance,
    };
    const snapshot: LiveSnapshot = {
      revision: 1,
      generatedAt: 1000,
      ingest: { state: 'connected', source: 'pcob', lastUpdateAt: 1000, message: null },
      match,
      matchInfo: { matchNumber: 2, mapName: 'Erangel' },
      lastClosedMap: null,
      closedMaps: [],
      autoWwcdVariant,
    };
    useLiveStore.setState({
      snapshot,
      instances: { main: mainInstance },
      overlayStates: { main: { instanceId: 'main', visible: true, changedAt: 1000 } },
    });
    return {
      snapshot,
      instance: mainInstance,
      overlayState: { instanceId: 'main', visible: true, changedAt: 1000 },
    };
  }

  it('State A (> 4 alive): /main shows vertical leaderboard, /final4 and /wwcd are hidden, /match-info is visible', () => {
    const match = setupLiveMatch(5); // 5 alive, 1 eliminated
    const ctx = setStoreSnapshot(match);

    // /main route: renders vertical leaderboard only
    const mainHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="leaderboard" {...ctx} />,
    );
    expect(mainHtml).toContain('SQUAD ONE');
    expect(mainHtml).not.toContain('data-testid="final-four-overlay"');
    expect(mainHtml).not.toContain('data-testid="wwcd-overlay"');

    // /final4 route: hidden during State A
    const f4Html = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="final-four" {...ctx} />,
    );
    expect(f4Html).not.toContain('data-testid="final-four-overlay"');

    // /wwcd route: hidden during State A
    const wwcdHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="wwcd" {...ctx} />,
    );
    expect(wwcdHtml).not.toContain('data-testid="wwcd-overlay"');

    // /match-info route: visible during State A
    const infoHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="match-info" {...ctx} />,
    );
    expect(infoHtml).toContain('MATCH 2');
    expect(infoHtml).toContain('Erangel');
  });

  it('State B (4 alive): /final4 shows horizontal cards, /main hides vertical tower and NEVER renders Final-4/WWCD, /match-info hides', () => {
    const match = setupLiveMatch(4); // 4 alive, 2 eliminated
    const ctx = setStoreSnapshot(match);

    // /main route: vertical tower is hidden, NEVER renders Final-4 cards
    const mainHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="leaderboard" {...ctx} />,
    );
    expect(mainHtml).not.toContain('data-testid="final-four-overlay"');
    expect(mainHtml).not.toContain('data-testid="wwcd-overlay"');
    expect(mainHtml).not.toContain('FINAL 4 SHOWDOWN');
    expect(mainHtml).not.toContain('SQUAD ONE'); // Tower is cleanly hidden

    // /final4 route: displays the 4-team horizontal showdown
    const f4Html = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="final-four" {...ctx} />,
    );
    expect(f4Html).toContain('data-testid="final-four-overlay"');
    expect(f4Html).toContain('FINAL 4 SHOWDOWN');
    expect(f4Html).toContain('4 / 4 SQUADS ALIVE');
    expect(f4Html).toContain('SQUAD ONE');
    expect(f4Html).toContain('SQUAD FOUR');

    // /wwcd route: stays hidden
    const wwcdHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="wwcd" {...ctx} />,
    );
    expect(wwcdHtml).not.toContain('data-testid="wwcd-overlay"');

    // /match-info route: hides to prevent duplication with Final-4 header pill
    const infoHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="match-info" {...ctx} />,
    );
    expect(infoHtml).not.toContain('MATCH 2');
  });

  it('State C (3 or 2 alive in Final-4): /final4 retains all 4 cards with grayed-out eliminated cards, /main stays hidden', () => {
    const match = setupLiveMatch(2); // 2 alive, 4 eliminated
    const ctx = setStoreSnapshot(match);

    // /main route remains completely hidden
    const mainHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="leaderboard" {...ctx} />,
    );
    expect(mainHtml).not.toContain('data-testid="final-four-overlay"');
    expect(mainHtml).not.toContain('data-testid="wwcd-overlay"');
    expect(mainHtml).not.toContain('SQUAD ONE');

    // /final4 route retains all 4 cards with eliminated squads in grayed-out state
    const f4Html = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="final-four" {...ctx} />,
    );
    expect(f4Html).toContain('data-testid="final-four-overlay"');
    expect(f4Html).toContain('2 / 4 SQUADS ALIVE');
    expect(f4Html).toContain('data-status="eliminated"');

    // /wwcd route remains hidden until confirmed 1 team alive
    const wwcdHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="wwcd" {...ctx} />,
    );
    expect(wwcdHtml).not.toContain('data-testid="wwcd-overlay"');
  });

  it('State D (Confirmed WWCD, 1 alive): /wwcd displays victory screen and takes precedence; /main, /final4, and /match-info are all hidden', () => {
    const match = setupLiveMatch(1); // 1 alive, 5 eliminated
    const ctx = setStoreSnapshot(match);

    // /wwcd route displays the WWCD victory screen
    const wwcdHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="wwcd" {...ctx} />,
    );
    expect(wwcdHtml).toContain('data-testid="wwcd-overlay"');
    expect(wwcdHtml).toContain('WINNER WINNER CHICKEN DINNER');
    expect(wwcdHtml).toContain('SQUAD ONE');

    // /main route is hidden and NEVER renders WWCD
    const mainHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="leaderboard" {...ctx} />,
    );
    expect(mainHtml).not.toContain('data-testid="wwcd-overlay"');
    expect(mainHtml).not.toContain('WINNER WINNER CHICKEN DINNER');
    expect(mainHtml).not.toContain('data-testid="final-four-overlay"');

    // /final4 route is hidden
    const f4Html = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="final-four" {...ctx} />,
    );
    expect(f4Html).not.toContain('data-testid="final-four-overlay"');

    // /match-info route is hidden
    const infoHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="match-info" {...ctx} />,
    );
    expect(infoHtml).not.toContain('MATCH 2');
  });

  it('New match or valid reset restores State A (normal leaderboard) and hides WWCD/Final-4', () => {
    // Reset back to 6 alive teams
    const resetMatch = setupLiveMatch(6);
    const ctx = setStoreSnapshot(resetMatch);

    const mainHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="leaderboard" {...ctx} />,
    );
    expect(mainHtml).toContain('SQUAD ONE'); // Vertical leaderboard restored

    const f4Html = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="final-four" {...ctx} />,
    );
    expect(f4Html).not.toContain('data-testid="final-four-overlay"');

    const wwcdHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="wwcd" {...ctx} />,
    );
    expect(wwcdHtml).not.toContain('data-testid="wwcd-overlay"');
  });

  it('Warmup with 1 team alive does NOT falsely trigger WWCD', () => {
    const warmupMatch = setupLiveMatch(1, 'idle');
    const ctx = setStoreSnapshot(warmupMatch);

    const wwcdHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="wwcd" {...ctx} />,
    );
    expect(wwcdHtml).not.toContain('data-testid="wwcd-overlay"');
  });

  it('Feature disabled (showFinalFourLayout: false) keeps vertical tower active at 4 alive teams and hides /final4', () => {
    const match = setupLiveMatch(4);
    const ctx = setStoreSnapshot(match, {
      ...DEFAULT_OVERLAY_APPEARANCE,
      showFinalFourLayout: false,
    });

    // /main continues showing normal leaderboard when Final-4 feature is OFF
    const mainHtml = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="leaderboard" {...ctx} />,
    );
    expect(mainHtml).toContain('SQUAD ONE');

    // /final4 route is hidden
    const f4Html = renderToStaticMarkup(
      <OverlayPage instanceId="main" surfaceMode="final-four" {...ctx} />,
    );
    expect(f4Html).not.toContain('data-testid="final-four-overlay"');
  });
});

describe('Final-4 Overlay Centering on 1920×1080 canvas (Part 4 / Phase 4)', () => {
  const sampleCohort = [
    {
      team: makeTeam({ teamNo: 1, name: 'SQUAD ONE', rank: 1 }),
      isKnockedOut: false,
      eliminatedPlacement: null,
    },
    {
      team: makeTeam({ teamNo: 2, name: 'SQUAD TWO', rank: 2 }),
      isKnockedOut: false,
      eliminatedPlacement: null,
    },
    {
      team: makeTeam({ teamNo: 3, name: 'SQUAD THREE', rank: 3 }),
      isKnockedOut: true,
      eliminatedPlacement: 3,
    },
    {
      team: makeTeam({ teamNo: 4, name: 'SQUAD FOUR', rank: 4 }),
      isKnockedOut: true,
      eliminatedPlacement: 4,
    },
  ];

  it('renders outer container with fixed full-canvas flex centering (left: 0, right: 0, justify-content: center)', () => {
    const html = renderToStaticMarkup(
      <FinalFourOverlay
        cohort={sampleCohort}
        matchInfo={{ matchNumber: 1, mapName: 'Erangel' }}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(html).toContain('position:fixed');
    expect(html).toContain('left:0');
    expect(html).toContain('right:0');
    expect(html).toContain('display:flex');
    expect(html).toContain('justify-content:center');
    expect(html).toContain('width:calc(1448 * var(--overlay-base-unit))');
    // Does NOT use inline transform: translateX(-50%) on the motion element (which conflicted with translateY animation)
    expect(html).not.toContain('transform:translateX(-50%)');
  });

  it('keeps all 4 cards in an equal 4-column grid (repeat(4, minmax(0, 1fr))) when cards are eliminated', () => {
    const html = renderToStaticMarkup(
      <FinalFourOverlay
        cohort={sampleCohort}
        matchInfo={{ matchNumber: 1, mapName: 'Erangel' }}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(html).toContain('grid-template-columns:repeat(4, minmax(0, 1fr))');
    expect(html).toContain('column-gap:calc(14 * var(--overlay-base-unit))');
    expect(html).toContain('data-testid="final-four-card-1"');
    expect(html).toContain('data-testid="final-four-card-2"');
    expect(html).toContain('data-testid="final-four-card-3"');
    expect(html).toContain('data-testid="final-four-card-4"');
  });
});

describe('D-PMCC-08 — Configurable Automatic WWCD Presentation & Fullscreen WWCD', () => {
  function makeConfirmedWwcdMatch(): MatchState {
    const teams: Team[] = [
      makeTeam({
        teamNo: 1,
        name: 'CHAMPION SQUAD',
        rank: 1,
        isEliminated: false,
        standingPlayerCount: 4,
        eliminations: 14,
      }),
      makeTeam({
        teamNo: 2,
        name: 'RUNNER UP',
        rank: 2,
        isEliminated: true,
        standingPlayerCount: 0,
        placement: 2,
      }),
    ];
    return {
      matchId: 'match-wwcd-1',
      phase: 'ended',
      standingTeamCount: 1,
      teams,
    };
  }

  it('activates only Standard WWCD when autoWwcdVariant is "standard" and never puts both variants ON AIR simultaneously', () => {
    const match = makeConfirmedWwcdMatch();
    const snapshot: LiveSnapshot = {
      revision: 1,
      generatedAt: 2000,
      ingest: { state: 'connected', source: 'pcob', lastUpdateAt: 2000, message: null },
      match,
      matchInfo: { matchNumber: 1, mapName: 'Erangel' },
      lastClosedMap: null,
      closedMaps: [],
      autoWwcdVariant: 'standard',
    };
    const stdInstance: OverlayInstance = {
      id: 'default-wwcd',
      name: 'Standard WWCD',
      type: 'wwcd',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };
    const fsInstance: OverlayInstance = {
      id: 'default-wwcd-fullscreen',
      name: 'Fullscreen WWCD',
      type: 'wwcd-fullscreen',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };

    const stdHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-wwcd"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={stdInstance}
        overlayState={{ instanceId: 'default-wwcd', visible: true, changedAt: 2000 }}
      />,
    );
    const fsHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-wwcd-fullscreen"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={fsInstance}
        overlayState={{ instanceId: 'default-wwcd-fullscreen', visible: true, changedAt: 2000 }}
      />,
    );

    expect(stdHtml).toContain('data-testid="wwcd-overlay"');
    expect(stdHtml).toContain('CHAMPION SQUAD');
    expect(fsHtml).not.toContain('data-testid="wwcd-fullscreen-overlay"');
  });

  it('activates only Fullscreen WWCD when autoWwcdVariant is "fullscreen"', () => {
    const match = makeConfirmedWwcdMatch();
    const snapshot: LiveSnapshot = {
      revision: 2,
      generatedAt: 2100,
      ingest: { state: 'connected', source: 'pcob', lastUpdateAt: 2100, message: null },
      match,
      matchInfo: { matchNumber: 1, mapName: 'Erangel' },
      lastClosedMap: null,
      closedMaps: [],
      autoWwcdVariant: 'fullscreen',
    };
    const stdInstance: OverlayInstance = {
      id: 'default-wwcd',
      name: 'Standard WWCD',
      type: 'wwcd',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };
    const fsInstance: OverlayInstance = {
      id: 'default-wwcd-fullscreen',
      name: 'Fullscreen WWCD',
      type: 'wwcd-fullscreen',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };

    const stdHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-wwcd"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={stdInstance}
        overlayState={{ instanceId: 'default-wwcd', visible: true, changedAt: 2100 }}
      />,
    );
    const fsHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-wwcd-fullscreen"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={fsInstance}
        overlayState={{ instanceId: 'default-wwcd-fullscreen', visible: true, changedAt: 2100 }}
      />,
    );

    expect(stdHtml).not.toContain('data-testid="wwcd-overlay"');
    expect(fsHtml).toContain('data-testid="wwcd-fullscreen-overlay"');
    expect(fsHtml).toContain('CHAMPION SQUAD');
    expect(fsHtml).toContain('14');
  });

  it('respects explicit HIDE (onAir: false / visible: false) on the selected WWCD variant without silently showing the wrong variant', () => {
    const match = makeConfirmedWwcdMatch();
    const snapshot: LiveSnapshot = {
      revision: 3,
      generatedAt: 2200,
      ingest: { state: 'connected', source: 'pcob', lastUpdateAt: 2200, message: null },
      match,
      matchInfo: { matchNumber: 1, mapName: 'Erangel' },
      lastClosedMap: null,
      closedMaps: [],
      autoWwcdVariant: 'fullscreen',
    };
    const fsHiddenInstance: OverlayInstance = {
      id: 'default-wwcd-fullscreen',
      name: 'Fullscreen WWCD',
      type: 'wwcd-fullscreen',
      enabled: true,
      onAir: false,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };
    const stdInstance: OverlayInstance = {
      id: 'default-wwcd',
      name: 'Standard WWCD',
      type: 'wwcd',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };

    const fsHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-wwcd-fullscreen"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={fsHiddenInstance}
        overlayState={{ instanceId: 'default-wwcd-fullscreen', visible: false, changedAt: 2200 }}
      />,
    );
    const stdHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-wwcd"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={stdInstance}
        overlayState={{ instanceId: 'default-wwcd', visible: true, changedAt: 2200 }}
      />,
    );

    expect(fsHtml).not.toContain('data-testid="wwcd-fullscreen-overlay"');
    expect(stdHtml).not.toContain('data-testid="wwcd-overlay"');
  });

  it('latches the active WWCD variant during an already-running celebration so mid-WWCD preference edits do not trigger a new animation', () => {
    // Initially latched when WWCD confirmed with 'standard'
    const step1 = resolveActiveAutoWwcdVariant('wwcd', 'match-1', 'standard', null);
    expect(step1.effectiveVariant).toBe('standard');
    expect(step1.nextLatch).toEqual({ matchId: 'match-1', variant: 'standard' });

    // Operator changes setting to 'fullscreen' while WWCD is still active -> stays 'standard'
    const step2 = resolveActiveAutoWwcdVariant('wwcd', 'match-1', 'fullscreen', step1.nextLatch);
    expect(step2.effectiveVariant).toBe('standard');

    // Once match resets to 'tower', latch clears
    const step3 = resolveActiveAutoWwcdVariant('tower', 'match-2', 'fullscreen', step2.nextLatch);
    expect(step3.nextLatch).toBeNull();

    // Next WWCD uses the new 'fullscreen' preference
    const step4 = resolveActiveAutoWwcdVariant('wwcd', 'match-2', 'fullscreen', step3.nextLatch);
    expect(step4.effectiveVariant).toBe('fullscreen');
  });

  it('FullscreenWwcdOverlay respects showFullscreenCharacters, showFullscreenMarquee, and showFullscreenStageBg toggles', () => {
    const match = makeConfirmedWwcdMatch();
    const winner = selectWwcdWinner(match, null);
    const matchInfo = { matchNumber: 1, mapName: 'Erangel' };

    const fullHtml = renderToStaticMarkup(
      <FullscreenWwcdOverlay
        winner={winner}
        matchInfo={matchInfo}
        appearance={{
          ...DEFAULT_OVERLAY_APPEARANCE,
          showFullscreenCharacters: true,
          showFullscreenMarquee: true,
          showFullscreenStageBg: true,
        }}
      />,
    );
    expect(fullHtml).toContain('data-testid="wwcd-fullscreen-characters"');
    expect(fullHtml).toContain('data-testid="wwcd-fullscreen-marquee"');
    expect(fullHtml).toContain('data-testid="wwcd-fullscreen-stage-bg"');

    const minimalHtml = renderToStaticMarkup(
      <FullscreenWwcdOverlay
        winner={winner}
        matchInfo={matchInfo}
        appearance={{
          ...DEFAULT_OVERLAY_APPEARANCE,
          showFullscreenCharacters: false,
          showFullscreenMarquee: false,
          showFullscreenStageBg: false,
        }}
      />,
    );
    expect(minimalHtml).not.toContain('data-testid="wwcd-fullscreen-characters"');
    expect(minimalHtml).not.toContain('data-testid="wwcd-fullscreen-marquee"');
    expect(minimalHtml).not.toContain('data-testid="wwcd-fullscreen-stage-bg"');
  });

  it('Part 6 Feature A — activates BOTH Standard WWCD and Fullscreen WWCD in Dual mode when both are ON AIR', () => {
    const match = makeConfirmedWwcdMatch();
    const snapshot: LiveSnapshot = {
      revision: 4,
      generatedAt: 2300,
      ingest: { state: 'connected', source: 'pcob', lastUpdateAt: 2300, message: null },
      match,
      matchInfo: { matchNumber: 1, mapName: 'Erangel' },
      lastClosedMap: null,
      closedMaps: [],
      autoWwcdVariant: 'dual',
    };
    const stdInstance: OverlayInstance = {
      id: 'default-wwcd',
      name: 'Standard WWCD',
      type: 'wwcd',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };
    const fsInstance: OverlayInstance = {
      id: 'default-wwcd-fullscreen',
      name: 'Fullscreen WWCD',
      type: 'wwcd-fullscreen',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };

    const stdHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-wwcd"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={stdInstance}
        overlayState={{ instanceId: 'default-wwcd', visible: true, changedAt: 2300 }}
      />,
    );
    const fsHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-wwcd-fullscreen"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={fsInstance}
        overlayState={{ instanceId: 'default-wwcd-fullscreen', visible: true, changedAt: 2300 }}
      />,
    );

    // Both activate in dual mode
    expect(stdHtml).toContain('data-testid="wwcd-overlay"');
    expect(fsHtml).toContain('data-testid="wwcd-fullscreen-overlay"');
  });

  it('Part 6 Feature A — respects per-instance HIDE in Dual mode and does not force hidden instances on air', () => {
    const match = makeConfirmedWwcdMatch();
    const snapshot: LiveSnapshot = {
      revision: 5,
      generatedAt: 2400,
      ingest: { state: 'connected', source: 'pcob', lastUpdateAt: 2400, message: null },
      match,
      matchInfo: { matchNumber: 1, mapName: 'Erangel' },
      lastClosedMap: null,
      closedMaps: [],
      autoWwcdVariant: 'dual',
    };
    const stdHiddenInstance: OverlayInstance = {
      id: 'default-wwcd',
      name: 'Standard WWCD',
      type: 'wwcd',
      enabled: true,
      onAir: false,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };
    const fsInstance: OverlayInstance = {
      id: 'default-wwcd-fullscreen',
      name: 'Fullscreen WWCD',
      type: 'wwcd-fullscreen',
      enabled: true,
      onAir: true,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };

    const stdHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-wwcd"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={stdHiddenInstance}
        overlayState={{ instanceId: 'default-wwcd', visible: false, changedAt: 2400 }}
      />,
    );
    const fsHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-wwcd-fullscreen"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={fsInstance}
        overlayState={{ instanceId: 'default-wwcd-fullscreen', visible: true, changedAt: 2400 }}
      />,
    );

    expect(stdHtml).not.toContain('data-testid="wwcd-overlay"');
    expect(fsHtml).toContain('data-testid="wwcd-fullscreen-overlay"');
  });

  it('Part 6 Feature B — Fullscreen WWCD uses flex centering, letter-spacing compensation, and character optical alignment', () => {
    const match = makeConfirmedWwcdMatch();
    const winner = selectWwcdWinner(match, null);
    const matchInfo = { matchNumber: 1, mapName: 'Erangel' };

    const html = renderToStaticMarkup(
      <FullscreenWwcdOverlay
        winner={winner}
        matchInfo={matchInfo}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );

    // Flex container without Motion transform collision
    expect(html).toContain('display:flex;flex-direction:column;align-items:center');
    // Letter-spacing compensation margin
    expect(html).toContain('margin-right:-calc(7 * var(--overlay-base-unit))');
    // Optical compensation for char5 asset padding
    expect(html).toContain('transform:translateX(-2.5%)');
  });

  it('Part 6 Feature C — Elimination notification shifts from top: u(42) down to top: u(164) when Final-4 is active', () => {
    const alert = {
      id: 'alert-team-4',
      matchId: 'match-1',
      teamNo: 4,
      teamName: 'Delta Team',
      logoUrl: null,
      rank: 4,
      placement: 4,
      eliminations: 3,
    };

    const standardHtml = renderToStaticMarkup(
      <EliminationOverlay
        alert={alert}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
        finalFourActive={false}
      />,
    );
    expect(standardHtml).toContain('top:calc(42 * var(--overlay-unit))');

    const finalFourHtml = renderToStaticMarkup(
      <EliminationOverlay
        alert={alert}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
        finalFourActive={true}
      />,
    );
    expect(finalFourHtml).toContain('top:calc(164 * var(--overlay-unit))');
  });
});

describe('D-PMCC-09 — Postgame Match Historical Selection & Postgame Series Cumulative Standings', () => {
  const closedMap1: ClosedMapResult = {
    id: 'map-1-erangel',
    mapNumber: 1,
    mapName: 'Erangel',
    matchId: 'match-1',
    startedAt: 500,
    endedAt: 1000,
    teams: [
      {
        teamNo: 1,
        placement: 1,
        eliminations: 8,
        placementPoints: 10,
        killPoints: 8,
        totalPoints: 18,
      },
      {
        teamNo: 2,
        placement: 2,
        eliminations: 10,
        placementPoints: 6,
        killPoints: 10,
        totalPoints: 16,
      },
    ],
  };

  const closedMap2: ClosedMapResult = {
    id: 'map-2-miramar',
    mapNumber: 2,
    mapName: 'Miramar',
    matchId: 'match-2',
    startedAt: 1500,
    endedAt: 2000,
    teams: [
      {
        teamNo: 2,
        placement: 1,
        eliminations: 2,
        placementPoints: 10,
        killPoints: 2,
        totalPoints: 12,
      },
      {
        teamNo: 1,
        placement: 2,
        eliminations: 4,
        placementPoints: 6,
        killPoints: 4,
        totalPoints: 10,
      },
    ],
  };

  const baseMatch: MatchState = {
    matchId: 'live-match-3',
    phase: 'ended',
    standingTeamCount: 1,
    teams: [
      // Note: team.totalPoints on live match may include series total (e.g., 99),
      // which MUST NEVER leak into single-match postgame totalMatchPoints!
      makeTeam({
        teamNo: 1,
        name: 'ALPHA SQUAD',
        logoUrl: '/api/team-logos/alpha.png',
        rank: 1,
        isEliminated: false,
        placement: 1,
        placementPoints: 10,
        killPoints: 5,
        eliminations: 5,
        totalPoints: 99,
      }),
      makeTeam({
        teamNo: 2,
        name: 'BRAVO SQUAD',
        logoUrl: '/api/team-logos/bravo.png',
        rank: 2,
        isEliminated: true,
        placement: 2,
        placementPoints: 6,
        killPoints: 3,
        eliminations: 3,
        totalPoints: 80,
      }),
    ],
  };

  const matchInfo = { matchNumber: 2, mapName: 'Miramar' };

  it('selectPostGameResults resolves pinned historical Match 1 even when Match 2 is the latest closed map', () => {
    const match1Results = selectPostGameResults(baseMatch, closedMap2, matchInfo, {
      closedMaps: [closedMap1, closedMap2],
      postGameMatchSelection: 'map-1-erangel',
    });
    expect(match1Results?.mapNumber).toBe(1);
    expect(match1Results?.mapName).toBe('Erangel');
    expect(match1Results?.winner!.name).toBe('ALPHA SQUAD');
    expect(match1Results?.winner!.totalMatchPoints).toBe(18);

    // The live screen still shows match 2, which was closed: `latest` is that recorded map.
    const latestResults = selectPostGameResults(
      { ...baseMatch, matchId: 'match-2' },
      closedMap2,
      matchInfo,
      {
        closedMaps: [closedMap1, closedMap2],
        postGameMatchSelection: 'latest',
      },
    );
    expect(latestResults?.mapNumber).toBe(2);
    expect(latestResults?.mapName).toBe('Miramar');
    expect(latestResults?.winner!.name).toBe('BRAVO SQUAD');
    expect(latestResults?.winner!.totalMatchPoints).toBe(12);
  });

  it('renders deliberate unavailable state when a pinned historical match ID is missing and never substitutes another match', () => {
    expect(
      isPinnedPostGameMatchUnavailable('deleted-map-id', [closedMap1, closedMap2], closedMap2),
    ).toBe(true);
    const unavailableBoard = selectPostGameResults(baseMatch, closedMap2, matchInfo, {
      closedMaps: [closedMap1, closedMap2],
      postGameMatchSelection: 'deleted-map-id',
    });
    expect(unavailableBoard).toBeNull();

    const html = renderToStaticMarkup(
      <PostGameOverlay
        board={unavailableBoard}
        matchInfo={matchInfo}
        unavailableSelection={true}
        appearance={{
          ...DEFAULT_OVERLAY_APPEARANCE,
          postGameMatchSelection: 'deleted-map-id',
        }}
      />,
    );
    expect(html).toContain('data-testid="postgame-unavailable-state"');
    expect(html).toContain('SELECTED MATCH RESULT UNAVAILABLE');
    expect(html).not.toContain('BRAVO SQUAD');
  });

  it('never conflates cumulative series points into single-match PostGameOverlay when falling back to live match teams', () => {
    const results = selectPostGameResults(baseMatch, null, matchInfo, {
      closedMaps: [],
      postGameMatchSelection: 'latest',
    });
    // Placement points (10) + Kill points (5) = 15 (NOT 99 from team.totalPoints)
    expect(results?.winner!.totalMatchPoints).toBe(15);
  });

  it('selectSeriesStandings and PostGameSeriesOverlay compute cumulative statistics and apply PUBG Esports tie-breakers', () => {
    // Across Match 1 + Match 2:
    // ALPHA SQUAD: 18 + 10 = 28 pts, 1 WWCD, 16 Place Pts, 12 Elim Pts, Latest Placement = 2
    // BRAVO SQUAD: 16 + 12 = 28 pts, 1 WWCD, 16 Place Pts, 12 Elim Pts, Latest Placement = 1
    // Tie-breaker #5 (Latest Match Placement) ranks BRAVO SQUAD #1 and ALPHA SQUAD #2!
    const series = selectSeriesStandings(baseMatch, [closedMap1, closedMap2]);
    expect(series?.completedMatchesCount).toBe(2);
    expect(series?.rows).toHaveLength(2);
    expect(series?.rows[0]?.name).toBe('BRAVO SQUAD');
    expect(series?.rows[0]?.seriesRank).toBe(1);
    expect(series?.rows[0]?.totalPoints).toBe(28);
    expect(series?.rows[0]?.wwcdCount).toBe(1);
    expect(series?.rows[1]?.name).toBe('ALPHA SQUAD');
    expect(series?.rows[1]?.seriesRank).toBe(2);
    expect(series?.rows[1]?.totalPoints).toBe(28);

    const html = renderToStaticMarkup(
      <PostGameSeriesOverlay
        board={series}
        matchInfo={matchInfo}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(html).toContain('data-testid="postgame-series-overlay"');
    expect(html).toContain('OVERALL SERIES STANDINGS');
    expect(html).toContain('AFTER MATCH 2');
    expect(html).toContain('BRAVO SQUAD');
    expect(html).toContain('ALPHA SQUAD');
  });

  it('correctly ranks single-match results by match points vs series standings by cumulative points (Inverted Ranking Fixture)', () => {
    // Fixture per Feature D specification:
    // Match 1:
    // Team A (Slot 1): 60 pts
    // Team B (Slot 2): 45 pts
    // Team C (Slot 3): 85 pts
    const map1: ClosedMapResult = {
      id: 'fixture-map-1',
      mapNumber: 1,
      mapName: 'Erangel',
      matchId: null,
      startedAt: 1000,
      endedAt: 2000,
      teams: [
        {
          teamNo: 1,
          placement: 2,
          eliminations: 54,
          placementPoints: 6,
          killPoints: 54,
          totalPoints: 60,
          name: 'Team A',
        },
        {
          teamNo: 2,
          placement: 3,
          eliminations: 40,
          placementPoints: 5,
          killPoints: 40,
          totalPoints: 45,
          name: 'Team B',
        },
        {
          teamNo: 3,
          placement: 1,
          eliminations: 75,
          placementPoints: 10,
          killPoints: 75,
          totalPoints: 85,
          name: 'Team C',
        },
      ],
    };

    // Match 2:
    // Team A: 20 pts (Place #2, 14 elims) -> Series Total = 80
    // Team B: 25 pts (Place #1, 15 elims) -> Series Total = 70
    // Team C: 15 pts (Place #3, 10 elims) -> Series Total = 100
    const map2: ClosedMapResult = {
      id: 'fixture-map-2',
      mapNumber: 2,
      mapName: 'Miramar',
      matchId: null,
      startedAt: 3000,
      endedAt: 4000,
      teams: [
        {
          teamNo: 1,
          placement: 2,
          eliminations: 14,
          placementPoints: 6,
          killPoints: 14,
          totalPoints: 20,
          name: 'Team A',
        },
        {
          teamNo: 2,
          placement: 1,
          eliminations: 15,
          placementPoints: 10,
          killPoints: 15,
          totalPoints: 25,
          name: 'Team B',
        },
        {
          teamNo: 3,
          placement: 3,
          eliminations: 10,
          placementPoints: 5,
          killPoints: 10,
          totalPoints: 15,
          name: 'Team C',
        },
      ],
    };

    // 1. Postgame single-match for Match 2: Expected order is Team B (25), Team A (20), Team C (15)
    const match2Results = selectPostGameResults(
      baseMatch,
      map2,
      { matchNumber: 2, mapName: 'Miramar' },
      {
        closedMaps: [map1, map2],
        postGameMatchSelection: 'fixture-map-2',
      },
    );
    expect(match2Results).not.toBeNull();
    expect(match2Results?.winner!.name).toBe('Team B');
    expect(match2Results?.rows.map((r) => r.name)).toEqual(['Team B', 'Team A', 'Team C']);
    expect(match2Results?.rows[0]?.matchRank).toBe(1);
    expect(match2Results?.rows[0]?.totalMatchPoints).toBe(25);
    expect(match2Results?.rows[1]?.matchRank).toBe(2);
    expect(match2Results?.rows[1]?.totalMatchPoints).toBe(20);
    expect(match2Results?.rows[2]?.matchRank).toBe(3);
    expect(match2Results?.rows[2]?.totalMatchPoints).toBe(15);

    // 2. Series Standings across Match 1 + Match 2: Expected order is Team C (100), Team A (80), Team B (70)
    const seriesStandings = selectSeriesStandings(baseMatch, [map1, map2]);
    expect(seriesStandings).not.toBeNull();
    expect(seriesStandings?.leader.name).toBe('Team C');
    expect(seriesStandings?.rows.map((r) => r.name)).toEqual(['Team C', 'Team A', 'Team B']);
    expect(seriesStandings?.rows[0]?.seriesRank).toBe(1);
    expect(seriesStandings?.rows[0]?.totalPoints).toBe(100);
    expect(seriesStandings?.rows[1]?.seriesRank).toBe(2);
    expect(seriesStandings?.rows[1]?.totalPoints).toBe(80);
    expect(seriesStandings?.rows[2]?.seriesRank).toBe(3);
    expect(seriesStandings?.rows[2]?.totalPoints).toBe(70);
  });
});

describe('Universal ON AIR / HIDE enforcement across all overlay types', () => {
  it('hides elimination, postgame-match, and postgame-series when overlayState.visible is false', () => {
    const snapshot: LiveSnapshot = {
      revision: 1,
      generatedAt: 1000,
      ingest: { state: 'connected', source: 'pcob', lastUpdateAt: 1000, message: null },
      match: SAMPLE_MATCH,
      matchInfo: { matchNumber: 1, mapName: 'Erangel' },
      lastClosedMap: {
        id: 'map-1',
        mapNumber: 1,
        mapName: 'Erangel',
        matchId: 'match-1',
        startedAt: 500,
        endedAt: 1000,
        teams: [
          {
            teamNo: 5,
            placement: 1,
            eliminations: 7,
            placementPoints: 10,
            killPoints: 7,
            totalPoints: 17,
          },
        ],
      },
      closedMaps: [
        {
          id: 'map-1',
          mapNumber: 1,
          mapName: 'Erangel',
          matchId: 'match-1',
          startedAt: 500,
          endedAt: 1000,
          teams: [
            {
              teamNo: 5,
              placement: 1,
              eliminations: 7,
              placementPoints: 10,
              killPoints: 7,
              totalPoints: 17,
            },
          ],
        },
      ],
      autoWwcdVariant: 'standard',
    };

    const pgMatchInstance: OverlayInstance = {
      id: 'default-postgame-match',
      name: 'Postgame Match',
      type: 'postgame-match',
      enabled: true,
      onAir: false,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };
    const pgSeriesInstance: OverlayInstance = {
      id: 'default-postgame-series',
      name: 'Postgame Series',
      type: 'postgame-series',
      enabled: true,
      onAir: false,
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    };

    const hiddenMatchHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-postgame-match"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={pgMatchInstance}
        overlayState={{ instanceId: 'default-postgame-match', visible: false, changedAt: 1000 }}
      />,
    );
    const hiddenSeriesHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-postgame-series"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={pgSeriesInstance}
        overlayState={{ instanceId: 'default-postgame-series', visible: false, changedAt: 1000 }}
      />,
    );

    expect(hiddenMatchHtml).not.toContain('ALPHA SQUAD');
    expect(hiddenSeriesHtml).not.toContain('ALPHA SQUAD');

    // When visible: true, both render their respective content via surfaceMode="auto"
    const visibleMatchHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-postgame-match"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={{ ...pgMatchInstance, onAir: true }}
        overlayState={{ instanceId: 'default-postgame-match', visible: true, changedAt: 1000 }}
      />,
    );
    const visibleSeriesHtml = renderToStaticMarkup(
      <OverlayPage
        instanceId="default-postgame-series"
        surfaceMode="auto"
        snapshot={snapshot}
        instance={{ ...pgSeriesInstance, onAir: true }}
        overlayState={{ instanceId: 'default-postgame-series', visible: true, changedAt: 1000 }}
      />,
    );

    expect(visibleMatchHtml).toContain('ALPHA SQUAD');
    expect(visibleSeriesHtml).toContain('OVERALL SERIES STANDINGS');
  });

  it('Part 6 — preserves historical team name and logo from map snapshots in postgame even if active roster is renumbered or teams deleted', () => {
    const historicalMap: ClosedMapResult = {
      id: 'map-historic-1',
      mapNumber: 1,
      mapName: 'Erangel',
      matchId: 'match-1',
      startedAt: 100,
      endedAt: 200,
      teams: [
        {
          teamNo: 1,
          name: 'Historic Alpha Squad',
          logoUrl: '/api/logos/historic-alpha.png',
          placement: 1,
          eliminations: 10,
          killPoints: 10,
          placementPoints: 10,
          totalPoints: 20,
        },
      ],
    };

    // Live match roster has been renumbered or replaced: Team 1 is now "New Omega"
    const liveMatch: MatchState = {
      matchId: 'match-2',
      phase: 'live',
      standingTeamCount: 16,
      teams: [
        makeTeam({
          teamNo: 1,
          name: 'New Omega',
          logoUrl: '/api/logos/new-omega.png',
          rank: 1,
        }),
      ],
    };

    const board = selectPostGameResults(liveMatch, historicalMap, {
      matchNumber: 1,
      mapName: 'Erangel',
    });
    expect(board).not.toBeNull();
    // Uses the snapshot name and logo, not the new live roster identity
    expect(board?.rows[0]?.name).toBe('Historic Alpha Squad');
    expect(board?.rows[0]?.logoUrl).toBe('/api/logos/historic-alpha.png');
    expect(board?.winner!.name).toBe('Historic Alpha Squad');
    expect(board?.winner!.logoUrl).toBe('/api/logos/historic-alpha.png');
  });
});
