import { DEFAULT_OVERLAY_APPEARANCE, type MatchState, type Team } from '@cdf/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FinalFourCardItem } from './broadcast-state';
import { FinalFourOverlay } from './FinalFourOverlay';
import { computeWwcdPrediction, type WwcdPrediction } from './wwcd-prediction';

function team(teamNo: number, standing: number, overrides: Partial<Team> = {}): Team {
  return {
    teamNo,
    name: `Team ${teamNo}`,
    logoUrl: null,
    players: [],
    standingPlayerCount: standing,
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

const TEAMS = [
  team(1, 4),
  team(2, 3),
  team(3, 2),
  team(4, 0, { isEliminated: true, placement: 4 }),
  team(5, 0, { isEliminated: true, placement: 5 }),
];
const MATCH: MatchState = { matchId: 'm', phase: 'live', standingTeamCount: 3, teams: TEAMS };
const COHORT: FinalFourCardItem[] = TEAMS.slice(0, 4).map((t) => ({
  team: t,
  isKnockedOut: t.isEliminated,
  eliminatedPlacement: t.placement,
})) as FinalFourCardItem[];

const predict = (ingestState: 'connected' | 'stale' | 'connecting') =>
  computeWwcdPrediction({ match: MATCH, cohortTeamNos: [1, 2, 3, 4], ingestState });

/** Static markup lookup by `data-testid` (no DOM in this test environment). */
let html = '';
interface Found {
  text: string;
  attr: (name: string) => string | null;
}
const screen = {
  getByTestId(id: string): Found {
    const start = html.indexOf(`data-testid="${id}"`);
    if (start < 0) throw new Error(`missing ${id}`);
    const open = html.lastIndexOf('<', start);
    const tag = /^<(\w+)/.exec(html.slice(open))![1]!;
    const tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
    tags.lastIndex = open;
    let depth = 0;
    let end = html.length;
    for (let m = tags.exec(html); m; m = tags.exec(html)) {
      depth += m[1] ? -1 : 1;
      if (depth === 0) {
        end = m.index + m[0].length;
        break;
      }
    }
    const chunk = html.slice(open, end);
    const head = chunk.slice(0, chunk.indexOf('>'));
    return {
      text: chunk.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&'),
      attr: (name) => new RegExp(`${name}="([^"]*)"`).exec(head)?.[1] ?? null,
    };
  },
};

function renderBar(prediction?: WwcdPrediction | null) {
  html = renderToStaticMarkup(
    <FinalFourOverlay
      cohort={COHORT}
      matchInfo={{ matchNumber: 1, mapName: 'Erangel' }}
      appearance={DEFAULT_OVERLAY_APPEARANCE}
      prediction={prediction}
    />,
  );
  return html;
}

const percentText = (slot: number) =>
  screen.getByTestId(`final-four-prediction-percent-${slot}`).text;

describe('FinalFourOverlay win chance strip', () => {
  it('renders no strip or note without a prediction', () => {
    expect(renderBar(null)).not.toContain('final-four-prediction');
    expect(renderBar(undefined)).not.toContain('final-four-prediction');
  });

  it('shows live percents summing to 100 and OUT on the knocked-out card', () => {
    renderBar(predict('connected'));
    expect(screen.getByTestId('final-four-prediction-note').text).toContain(
      'estimate, not a calibrated model',
    );
    const values = [0, 1, 2].map((slot) => Number.parseInt(percentText(slot) ?? '', 10));
    expect(values).toEqual([45, 33, 22]);
    expect(values.reduce((s, v) => s + v, 0)).toBe(100);
    expect(percentText(3)).toBe('OUT #4');
    expect(screen.getByTestId('final-four-prediction-0').attr('data-state')).toBe('live');
    expect(screen.getByTestId('final-four-prediction-0').text).toContain('WIN CHANCE · MODEL');
  });

  it('labels stale data and keeps the held values', () => {
    renderBar(predict('stale'));
    const strip = screen.getByTestId('final-four-prediction-0');
    expect(strip.attr('data-state')).toBe('stale');
    expect(strip.text).toContain('DATA STALE');
    expect(percentText(0)).toBe('45%');
  });

  it('shows an em dash when unavailable', () => {
    renderBar(predict('connecting'));
    expect(screen.getByTestId('final-four-prediction-0').text).toContain('ESTIMATE UNAVAILABLE');
    expect(percentText(0)).toBe('—');
    expect(percentText(3)).toBe('OUT #4');
  });
});
