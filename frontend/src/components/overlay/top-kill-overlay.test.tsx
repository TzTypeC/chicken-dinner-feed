import { DEFAULT_OVERLAY_APPEARANCE } from '@cdf/shared';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TopKillBoard, TopKillEntry } from './top-kill';
import { TopKillOverlay } from './TopKillOverlay';

interface Found {
  textContent: string;
  dataset: Record<string, string>;
  style: { width: string };
}

/** Static markup lookup by `data-testid` (no DOM in this test environment). */
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
    const width = /width:([^;"]*)/.exec(/style="([^"]*)"/.exec(attrs)?.[1] ?? '')?.[1] ?? '';
    const textContent = inner
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"');
    return { textContent, dataset, style: { width } };
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

const map = { mapId: 'm3', mapNumber: 3, mapName: 'Miramar' };

function e(
  teamNo: number,
  eliminations: number,
  displayRank: number,
  tied: boolean,
  placement: number | null = teamNo,
): TopKillEntry {
  return {
    teamNo,
    name: `Team ${teamNo}`,
    logoUrl: null,
    eliminations,
    placement,
    killPoints: eliminations,
    matchPoints: eliminations + 6,
    displayRank,
    tied,
  };
}

describe('TopKillOverlay', () => {
  it('renders the hero, rows, tie tags and the cutoff note', () => {
    const board: TopKillBoard = {
      status: 'ready',
      map,
      entries: [e(7, 14, 1, false, 2), e(3, 9, 2, true), e(12, 9, 2, true), e(6, 7, 4, true)],
      cutoffTiedExtra: 2,
      cutoffEliminations: 7,
    };
    const { screen } = render(
      <TopKillOverlay board={board} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );
    expect(screen.getByTestId('top-kill-overlay').dataset.status).toBe('ready');
    expect(screen.getByTestId('top-kill-context').textContent).toContain('Match 3 — Miramar');
    expect(screen.getByTestId('top-kill-hero-elims').textContent).toBe('14');
    expect(screen.getByTestId('top-kill-hero-rank').textContent).toBe('1st in eliminations');
    expect(screen.getByTestId('top-kill-hero-support').textContent).toContain('Finished #2');
    expect(screen.getByTestId('top-kill-row-1-elims').textContent).toBe('9');
    expect(screen.getByTestId('top-kill-row-3-rank').textContent).toBe('4');
    expect(screen.getByTestId('top-kill-row-1-tied').textContent).toBe('TIED');
    expect(screen.getByTestId('top-kill-row-1-bar').style.width).toContain('0.6428');
    expect(screen.getByTestId('top-kill-cutoff-note').textContent).toBe(
      '2 more teams also on 7 eliminations',
    );
    expect(screen.queryByTestId('top-kill-preview-banner')).toBeNull();
  });

  it('renders only real rows, a tied hero, and no cutoff note', () => {
    const board: TopKillBoard = {
      status: 'ready',
      map,
      entries: [e(1, 5, 1, true), e(2, 5, 1, true)],
      cutoffTiedExtra: 0,
      cutoffEliminations: null,
    };
    const { screen } = render(
      <TopKillOverlay board={board} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );
    expect(screen.getByTestId('top-kill-hero-rank').textContent).toBe('Tied 1st');
    expect(screen.getByTestId('top-kill-row-1')).toBeTruthy();
    expect(screen.queryByTestId('top-kill-row-2')).toBeNull();
    expect(screen.queryByTestId('top-kill-cutoff-note')).toBeNull();
  });

  it('labels the preview sample', () => {
    const board: TopKillBoard = {
      status: 'preview',
      map,
      entries: [e(1, 5, 1, false)],
      cutoffTiedExtra: 0,
      cutoffEliminations: null,
    };
    const { screen } = render(
      <TopKillOverlay board={board} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );
    expect(screen.getByTestId('top-kill-preview-banner').textContent).toBe(
      'PREVIEW SAMPLE — NOT A RESULT',
    );
  });

  it('renders the empty states', () => {
    let { screen } = render(
      <TopKillOverlay
        board={{ status: 'no-eliminations', map }}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(screen.getByTestId('top-kill-empty').textContent).toBe(
      'No eliminations were recorded in Match 3',
    );
    expect(screen.queryByTestId('top-kill-hero')).toBeNull();
    ({ screen } = render(
      <TopKillOverlay board={{ status: 'no-map' }} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    ));
    expect(screen.getByTestId('top-kill-empty').textContent).toBe('No finished match yet');
    expect(screen.getByTestId('top-kill-overlay').dataset.status).toBe('no-map');
  });
});
