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
  resolveLeaderboardLayoutMode,
  selectFinalFourCohort,
  selectPostGameResults,
  selectWwcdWinner,
} from './broadcast-state';
import { EliminationOverlay } from './EliminationOverlay';
import { FinalFourOverlay } from './FinalFourOverlay';
import { LeaderboardOverlay } from './LeaderboardOverlay';
import { MatchInfoOverlay } from './MatchInfoOverlay';
import { PostGameOverlay } from './PostGameOverlay';
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
    expect(html).toContain('SLOT T08');
    expect(html).toContain('MATCH 5');
    expect(html).toContain('Sanhok');
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
    expect(html).toContain('SURVIVING SQUAD: 3 / 4 ALIVE');
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
    expect(board?.winner.teamNo).toBe(5);
    expect(board?.winner.totalMatchPoints).toBe(26); // 10 place + 16 elims
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

  function setStoreSnapshot(match: MatchState, appearance = DEFAULT_OVERLAY_APPEARANCE) {
    const mainInstance: OverlayInstance = {
      id: 'main',
      name: 'Main Leaderboard',
      type: 'leaderboard',
      appearance,
    };
    const snapshot: LiveSnapshot = {
      revision: 1,
      generatedAt: 1000,
      ingest: { state: 'connected', source: 'pcob', lastUpdateAt: 1000, message: null },
      match,
      matchInfo: { matchNumber: 2, mapName: 'Erangel' },
      lastClosedMap: null,
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
