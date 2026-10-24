import { DEFAULT_OVERLAY_APPEARANCE } from '@cdf/shared';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NextMapBoard } from './next-map';
import { NextMapOverlay } from './NextMapOverlay';

interface Found {
  textContent: string;
  dataset: Record<string, string>;
  style: Record<string, string>;
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

    const styleStr = /style="([^"]*)"/.exec(attrs)?.[1] ?? '';
    const style: Record<string, string> = {};
    for (const part of styleStr.split(';')) {
      const [k, v] = part.split(':').map((s) => s.trim());
      if (k && v) style[k] = v;
    }

    const textContent = inner
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"');
    return { textContent, dataset, style };
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
        logoUrl: 'http://localhost/logo.png',
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

describe('NextMapOverlay strict boundaries and rendering', () => {
  it('strictly bounds all cards inside the inner photo frames with overflow hidden', () => {
    const { screen } = render(
      <NextMapOverlay board={MOCK_BOARD} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );

    const card1 = screen.getByTestId('next-map-card-1');
    const card2 = screen.getByTestId('next-map-card-2');
    const card3 = screen.getByTestId('next-map-card-3');
    const card4 = screen.getByTestId('next-map-card-4');

    expect(card1.style.overflow).toBe('hidden');
    expect(card2.style.overflow).toBe('hidden');
    expect(card3.style.overflow).toBe('hidden');
    expect(card4.style.overflow).toBe('hidden');

    // Verify left, top, width, height match the exact photo thumbnail frame (346x368 at y=383)
    expect(card1.style.left).toContain('137');
    expect(card1.style.top).toContain('383');
    expect(card1.style.width).toContain('346');
    expect(card1.style.height).toContain('368');

    expect(card2.style.left).toContain('571');
    expect(card3.style.left).toContain('1005');
    expect(card4.style.left).toContain('1439');
  });

  it('honors showTeamLogo toggle: renders logo when true and hides logo when false', () => {
    // When showTeamLogo is true (default)
    const withLogo = render(
      <NextMapOverlay
        board={MOCK_BOARD}
        appearance={{ ...DEFAULT_OVERLAY_APPEARANCE, showTeamLogo: true }}
      />,
    );
    expect(withLogo.screen.getByTestId('next-map-team-logo-1')).toBeTruthy();

    // When showTeamLogo is false
    const withoutLogo = render(
      <NextMapOverlay
        board={MOCK_BOARD}
        appearance={{ ...DEFAULT_OVERLAY_APPEARANCE, showTeamLogo: false }}
      />,
    );
    expect(withoutLogo.screen.queryByTestId('next-map-team-logo-1')).toBeNull();
    // Name and slot badge still render cleanly
    expect(withoutLogo.screen.getByTestId('next-map-winner-name-1').textContent).toContain(
      'BIGETRON ESPORTS',
    );
    expect(withoutLogo.screen.getByTestId('next-map-slot-badge-1').textContent).toContain('T07');
  });
});
