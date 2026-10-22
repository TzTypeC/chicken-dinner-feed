import { describe, expect, it } from 'vitest';
import {
  fitDisplayName,
  graphemes,
  marqueeTiming,
  maxExtensionOnCanvas,
  MARQUEE_HOLD_MS,
  nameColumnWidth,
  nameExtension,
  truncateTeamName,
  uniformNameFontSize,
} from './team-name-fit';

/** A fake monospace measurer: every grapheme is 0.7 em wide. */
const mono = (text: string) => graphemes(text).length * 0.7;

describe('truncateTeamName', () => {
  it('turns the brief’s example into exactly `Lanang nak ...` at the default 14', () => {
    expect(truncateTeamName('Lanang nak chicken main pubg', 14)).toBe('Lanang nak ...');
  });

  it('leaves names shorter than or exactly at the limit unchanged', () => {
    expect(truncateTeamName('Team Alpha', 14)).toBe('Team Alpha');
    expect(truncateTeamName('PENYETAN ALLAN', 14)).toBe('PENYETAN ALLAN');
  });

  it('never exceeds the limit, for every allowed limit', () => {
    const name = 'Lanang nak chicken main pubg';
    for (let limit = 6; limit <= 32; limit++) {
      expect(graphemes(truncateTeamName(name, limit)).length).toBeLessThanOrEqual(limit);
    }
    expect(truncateTeamName(name, 32)).toBe(name);
  });

  it('counts an emoji ZWJ sequence, a flag and a combining accent as one character each', () => {
    const name = 'Équipe 👨‍👩‍👧🇮🇩 Été e\u0301 chicken';
    // 12 = 9 visible clusters (`É` `q` `u` `i` `p` `e` ` ` family flag) + the three dots.
    const cut = truncateTeamName(name, 12);
    expect(graphemes(cut)).toHaveLength(12);
    expect(cut).toBe('Équipe 👨‍👩‍👧🇮🇩...');
  });

  it('never splits a cluster at the cut point', () => {
    // The 4th visible character is a family emoji: it is kept whole or not at all.
    expect(truncateTeamName('ABC👨‍👩‍👧DEFGHIJ', 7)).toBe('ABC👨‍👩‍👧...');
    expect(truncateTeamName('ABC👨‍👩‍👧DEFGHIJ', 6)).toBe('ABC...');
  });

  it('counts what HTML renders: edge and repeated whitespace collapse first', () => {
    expect(truncateTeamName('  Team    Alpha  ', 14)).toBe('Team Alpha');
  });
});

describe('uniform name font size', () => {
  const area = nameColumnWidth(false) - (29.7 + 5);

  it('derives one size from the limit alone, clamped to 10–15 px', () => {
    // ≈103 px at 0.691 em per glyph: limit 14 → ≈10.7 px (Part 8 Q1 option B).
    expect(uniformNameFontSize({ area, limit: 14, averageAdvanceEm: 0.691 })).toBeCloseTo(10.68, 1);
    expect(uniformNameFontSize({ area, limit: 6, averageAdvanceEm: 0.691 })).toBe(15);
    expect(uniformNameFontSize({ area, limit: 32, averageAdvanceEm: 0.691 })).toBe(10);
  });

  it('frees space inside the unchanged 340 px frame', () => {
    expect(nameColumnWidth(false)).toBe(138);
    expect(nameColumnWidth(true)).toBe(106);
  });
});

describe('fitDisplayName', () => {
  it('keeps the limited text when it fits at the shared size', () => {
    expect(
      fitDisplayName({
        name: 'Lanang nak chicken main pubg',
        limit: 14,
        fontSize: 10,
        area: 100,
        measureEm: mono,
      }),
    ).toBe('Lanang nak ...');
  });

  it('shortens only an unusually wide name further, keeping the font size and the dots', () => {
    const wide = (text: string) => graphemes(text).length * (text.startsWith('W') ? 1.1 : 0.7);
    const text = fitDisplayName({
      name: 'WWWWWWWWWWWWWWWWWW',
      limit: 14,
      fontSize: 10,
      area: 100,
      measureEm: wide,
    });
    expect(text.endsWith('...')).toBe(true);
    expect(wide(text) * 10).toBeLessThanOrEqual(100);
    expect(graphemes(text).length).toBeLessThan(14);
  });
});

describe('extended mode geometry', () => {
  it('widens only as far as the widest full name needs, capped at the maximum', () => {
    expect(nameExtension({ fullWidths: [80, 90], area: 103, maxExtension: 200 })).toBe(0);
    expect(nameExtension({ fullWidths: [80, 196.4], area: 103, maxExtension: 200 })).toBe(94);
    expect(nameExtension({ fullWidths: [600], area: 103, maxExtension: 200 })).toBe(200);
  });

  it('keeps a right-anchored panel on canvas and a left-anchored one from leaving the left edge', () => {
    expect(maxExtensionOnCanvas({ anchor: 'right', offsetX: 24, scale: 1, configured: 200 })).toBe(
      200,
    );
    expect(maxExtensionOnCanvas({ anchor: 'left', offsetX: 24, scale: 1, configured: 200 })).toBe(
      24,
    );
    expect(maxExtensionOnCanvas({ anchor: 'left', offsetX: 300, scale: 2, configured: 200 })).toBe(
      150,
    );
    expect(
      maxExtensionOnCanvas({ anchor: 'right', offsetX: 1500, scale: 1, configured: 200 }),
    ).toBe(80);
  });

  it('scrolls at constant speed: longer names take proportionally longer, with a fixed hold', () => {
    const short = marqueeTiming(200);
    const long = marqueeTiming(400);
    expect(long.durationMs - MARQUEE_HOLD_MS).toBe(2 * (short.durationMs - MARQUEE_HOLD_MS));
    expect(short.holdOffset).toBeCloseTo(MARQUEE_HOLD_MS / short.durationMs, 6);
  });
});
