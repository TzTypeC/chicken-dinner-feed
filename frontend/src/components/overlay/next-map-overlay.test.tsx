import { DEFAULT_OVERLAY_APPEARANCE } from '@cdf/shared';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NextMapBoard } from './next-map';
import { NextMapOverlay } from './NextMapOverlay';

interface Found {
  textContent: string;
  dataset: Record<string, string>;
}

function render(element: ReactElement) {
  const html = renderToStaticMarkup(element);
  const find = (id: string): Found | null => {
    const open = new RegExp(`<([a-z0-9]+)([^>]*?)data-testid="${id}"([^>]*)>`).exec(html);
    if (!open) return null;
    const tag = open[1];
    const attrs = open[2] + open[3];
    const tagRe = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
    tagRe.lastIndex = open.index + open[0].length;
    let depth = 1;
    let close = html.length;
    for (let m = tagRe.exec(html); m; m = tagRe.exec(html)) {
      depth += m[0].startsWith('</') ? -1 : 1;
      if (depth === 0) {
        close = m.index;
        break;
      }
    }
    const inner = html.slice(open.index + open[0].length, close);
    const dataset: Record<string, string> = {};
    for (const [, k, v] of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g)) dataset[k] = v;
    const textContent = inner
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"');
    return { textContent, dataset };
  };
  return {
    screen: {
      getByTestId: (id: string) => {
        const found = find(id);
        if (!found) throw new Error(`missing ${id}`);
        return found;
      },
      queryByTestId: find,
    },
  };
}

const MOCK_BOARD: NextMapBoard = {
  upcomingMatchNumber: 2,
  allCompleted: false,
  cards: [
    {
      matchNumber: 1,
      defaultMapName: 'Erangel',
      mapName: 'Erangel',
      state: 'completed',
      winner: {
        teamNo: 7,
        name: 'BIGETRON ESPORTS',
        logoUrl: null,
        eliminations: 16,
        totalPoints: 26,
      },
    },
    {
      matchNumber: 2,
      defaultMapName: 'Erangel',
      mapName: 'Erangel',
      state: 'upcoming',
      winner: null,
    },
    {
      matchNumber: 3,
      defaultMapName: 'Miramar',
      mapName: 'Miramar',
      state: 'future',
      winner: null,
    },
    {
      matchNumber: 4,
      defaultMapName: 'Miramar',
      mapName: 'Miramar',
      state: 'future',
      winner: null,
    },
  ],
};

describe('NextMapOverlay', () => {
  it('renders the overlay with all 4 match card states', () => {
    const { screen } = render(
      <NextMapOverlay board={MOCK_BOARD} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );

    expect(screen.getByTestId('next-map-overlay')).toBeTruthy();
    expect(screen.getByTestId('next-map-card-1').dataset.state).toBe('completed');
    expect(screen.getByTestId('next-map-card-2').dataset.state).toBe('upcoming');
    expect(screen.getByTestId('next-map-card-3').dataset.state).toBe('future');
    expect(screen.getByTestId('next-map-card-4').dataset.state).toBe('future');

    // Check Match 1 completed winner info
    expect(screen.getByTestId('next-map-wwcd-badge-1')).toBeTruthy();
    expect(screen.getByTestId('next-map-winner-name-1').textContent).toContain('BIGETRON ESPORTS');
    expect(screen.getByTestId('next-map-winner-elims-1').textContent).toBe('16');
    expect(screen.getByTestId('next-map-winner-points-1').textContent).toBe('26');

    // Check Match 2 upcoming badge
    expect(screen.getByTestId('next-map-upcoming-badge').textContent).toContain('UPCOMING MATCH');
  });
});
