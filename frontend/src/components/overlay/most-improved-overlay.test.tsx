import { DEFAULT_OVERLAY_APPEARANCE } from '@cdf/shared';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MostImprovedBoard, MostImprovedEntry } from './most-improved';
import { MostImprovedOverlay } from './MostImprovedOverlay';

const entry = (overrides: Partial<MostImprovedEntry>): MostImprovedEntry => ({
  teamNo: 9,
  name: 'Timbang Tak Hack',
  logoUrl: null,
  startRank: 18,
  endRank: 5,
  improvement: 13,
  startPoints: 4,
  endPoints: 27,
  ...overrides,
});

const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'source']);

/** Server-renders the overlay and reads elements back by `data-testid` (no DOM in this suite). */
function render(element: ReactElement) {
  const html = renderToStaticMarkup(element);
  const queryByTestId = (id: string) => {
    const open = new RegExp(`<([a-z0-9]+)[^>]*data-testid="${id}"[^>]*>`).exec(html);
    if (!open) return null;
    const attrs = open[0];
    let depth = VOID_TAGS.has(open[1]!) ? 0 : 1;
    let text = '';
    const tags = /<(\/?)([a-z0-9]+)[^>]*>/g;
    tags.lastIndex = open.index + attrs.length;
    let cursor = tags.lastIndex;
    for (let tag = tags.exec(html); tag && depth > 0; tag = tags.exec(html)) {
      text += html.slice(cursor, tag.index);
      cursor = tags.lastIndex;
      if (tag[1]) depth -= 1;
      else if (!VOID_TAGS.has(tag[2]!)) depth += 1;
    }
    const decoded = text
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'");
    const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1];
    return {
      textContent: decoded,
      dataset: { status: attr('data-status'), rank: attr('data-rank') },
    };
  };
  return {
    getByTestId: (id: string) => {
      const node = queryByTestId(id);
      if (!node) throw new Error(`missing ${id}`);
      return node;
    },
    queryByTestId,
  };
}

const from = { mapId: 'm1', mapNumber: 1, mapName: null };
const to = { mapId: 'm2', mapNumber: 2, mapName: null };

describe('MostImprovedOverlay', () => {
  it('renders the hero climb, rail, others and exclusion note', () => {
    const board: MostImprovedBoard = {
      status: 'ready',
      from,
      to,
      hero: entry({}),
      others: [
        entry({ teamNo: 3, name: 'Cacing Zone', startRank: 20, endRank: 11, improvement: 9 }),
      ],
      excluded: [{ teamNo: 12, name: 'Late Team', reason: 'new-after-start', detail: '' }],
      teamCount: 25,
    };
    const screen = render(
      <MostImprovedOverlay board={board} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );
    expect(screen.getByTestId('most-improved-overlay').dataset.status).toBe('ready');
    expect(screen.getByTestId('most-improved-subtitle').textContent).toContain(
      'after Match 1 → after Match 2',
    );
    expect(screen.getByTestId('most-improved-hero').textContent).toContain('Timbang Tak Hack');
    expect(screen.getByTestId('most-improved-start-rank').textContent).toBe('18');
    expect(screen.getByTestId('most-improved-end-rank').textContent).toBe('5');
    expect(screen.getByTestId('most-improved-delta').textContent).toBe('▲ 13 places up');
    expect(screen.getByTestId('most-improved-points').textContent).toBe('Series points 4 → 27');
    expect(screen.getByTestId('most-improved-rail-start').dataset.rank).toBe('18');
    expect(screen.getByTestId('most-improved-rail-end').dataset.rank).toBe('5');
    const other = screen.getByTestId('most-improved-other-0');
    expect(other.textContent).toContain('#20 → #11');
    expect(other.textContent).toContain('▲ 9');
    expect(screen.getByTestId('most-improved-excluded-note').textContent).toContain(
      '1 team not compared: Late Team (joined later)',
    );
    expect(screen.queryByTestId('most-improved-preview-banner')).toBeNull();
  });

  it('uses singular "place" and shows the preview banner', () => {
    const board: MostImprovedBoard = {
      status: 'preview',
      from,
      to,
      hero: entry({ teamNo: 0, startRank: 3, endRank: 2, improvement: 1 }),
      others: [],
      excluded: [],
      teamCount: 20,
    };
    const screen = render(
      <MostImprovedOverlay board={board} appearance={DEFAULT_OVERLAY_APPEARANCE} />,
    );
    expect(screen.getByTestId('most-improved-delta').textContent).toBe('▲ 1 place up');
    expect(screen.getByTestId('most-improved-preview-banner').textContent).toBe(
      'Preview sample — not a result',
    );
  });

  it('renders the no-climber state', () => {
    const screen = render(
      <MostImprovedOverlay
        board={{ status: 'no-climber', from, to, excluded: [] }}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    expect(screen.getByTestId('most-improved-overlay').dataset.status).toBe('no-climber');
    expect(screen.getByTestId('most-improved-empty').textContent).toBe(
      'No team climbed between Match 1 and Match 2',
    );
    expect(screen.queryByTestId('most-improved-hero')).toBeNull();
  });

  it('renders the unavailable message', () => {
    const screen = render(
      <MostImprovedOverlay
        board={{
          status: 'unavailable',
          reason: 'invalid-range',
          message: 'The start match must be earlier than the end match.',
        }}
        appearance={DEFAULT_OVERLAY_APPEARANCE}
      />,
    );
    const empty = screen.getByTestId('most-improved-empty');
    expect(empty.textContent).toContain('Comparison unavailable');
    expect(empty.textContent).toContain('The start match must be earlier than the end match.');
    expect(screen.queryByTestId('most-improved-subtitle')).toBeNull();
  });
});
