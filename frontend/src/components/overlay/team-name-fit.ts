import { LEADERBOARD_METRICS as M } from './overlay-scale';

/**
 * Team-name presentation for the vertical leaderboard (Part 8, ADR-0018 sibling decisions in
 * docs/part8-audit-and-proposal.md §5–§6). Pure functions only — every DOM measurement is injected —
 * so the rules can be tested without a browser. All lengths are design-canvas pixels (ADR-0011).
 */

/** The design size names were drawn at; a short limit never enlarges text beyond it. */
export const NAME_FONT_MAX = 15;
/** Below this a name is shortened further instead of shrinking further (Q1 option B). */
export const NAME_FONT_MIN = 10;
/** What a cut name ends in; its three characters count toward the limit. */
export const ELLIPSIS = '...';
/** Gap between the `T##` badge and the name. */
export const BADGE_GAP = 5;
/** The 1920-wide design canvas a side-anchored panel must stay inside. */
export const CANVAS_WIDTH = 1920;

/** Extended-mode marquee: constant reading speed, a pause on the first letter every cycle. */
export const MARQUEE_SPEED = 40; // design px per second
export const MARQUEE_HOLD_MS = 1500;
/** Space between the end of a name and its repeat, in ems of the name font. */
export const MARQUEE_GAP_EM = 2;

/**
 * The reference glyph set behind the uniform font size: uppercase Latin, digits and a space — what
 * PMCC names are made of once the leaderboard uppercases them. Sizing to its average advance, not to
 * the widest name actually on screen, keeps the size a function of the limit alone.
 */
export const REFERENCE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789';

/** Trims and collapses whitespace runs — exactly what HTML renders, so counts match the screen. */
export function normalizeTeamName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** User-perceived characters (UAX #29 grapheme clusters): an emoji or accented letter counts once. */
export function graphemes(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (part) => part.segment);
  return Array.from(text); // Code points: never splits a surrogate pair, at worst a ZWJ sequence.
}

/**
 * The display text for a limit of `limit` graphemes: unchanged when it fits, otherwise the first
 * `limit − 3` graphemes followed by `...`, so the whole result is exactly `limit` long.
 * `Lanang nak chicken main pubg` at 14 → `Lanang nak ...`.
 */
export function truncateTeamName(name: string, limit: number): string {
  const normalized = normalizeTeamName(name);
  const parts = graphemes(normalized);
  if (parts.length <= limit) return normalized;
  return parts.slice(0, Math.max(1, limit - ELLIPSIS.length)).join('') + ELLIPSIS;
}

/**
 * Width of the leaderboard's flexible TEAM column in normal mode: the panel minus its border, the
 * row's leader stripe, padding, every fixed column and the gaps between columns.
 */
export function nameColumnWidth(showLogos: boolean): number {
  const fixed =
    M.rankColumn + (showLogos ? M.logoColumn : 0) + M.aliveColumn + M.pointsColumn + M.elimsColumn;
  const columns = showLogos ? 6 : 5;
  return (
    M.panelWidth -
    2 * M.panelBorder -
    M.rowLeaderStripe -
    2 * M.paddingX -
    fixed -
    (columns - 1) * M.columnGap
  );
}

/**
 * One font size for every row: the size at which `limit` average reference glyphs fill `area`,
 * clamped to [`min`, `max`]. Depends only on the limit, the font and the geometry — never on which
 * other teams are on screen.
 */
export function uniformNameFontSize(options: {
  area: number;
  limit: number;
  averageAdvanceEm: number;
  min?: number;
  max?: number;
}): number {
  const { area, limit, averageAdvanceEm, min = NAME_FONT_MIN, max = NAME_FONT_MAX } = options;
  if (!(averageAdvanceEm > 0) || !(limit > 0)) return max;
  const ideal = area / (limit * averageAdvanceEm);
  return Math.round(Math.min(max, Math.max(min, ideal)) * 100) / 100;
}

/**
 * Normal-mode text for one row. Applies the character limit, then — only if this particular result
 * is still wider than `area` at the shared `fontSize` (unusually wide glyphs, or a limit the floor
 * could not reach) — keeps the longest grapheme prefix + `...` that fits. Never changes the font
 * size and never returns more than `limit` graphemes.
 */
export function fitDisplayName(options: {
  name: string;
  limit: number;
  fontSize: number;
  area: number;
  measureEm: (text: string) => number;
}): string {
  const { name, limit, fontSize, area, measureEm } = options;
  const limited = truncateTeamName(name, limit);
  if (measureEm(limited) * fontSize <= area) return limited;

  const parts = graphemes(normalizeTeamName(name));
  let low = 1;
  let high = Math.min(parts.length, limit - ELLIPSIS.length);
  let best = 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (measureEm(parts.slice(0, mid).join('') + ELLIPSIS) * fontSize <= area) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return parts.slice(0, best).join('') + ELLIPSIS;
}

/**
 * The most the panel may widen to the left without leaving the canvas (Q6). Offsets are in the
 * base unit and the panel in the scaled one, so the room is divided by `scale`.
 */
export function maxExtensionOnCanvas(options: {
  anchor: 'left' | 'right';
  offsetX: number;
  scale: number;
  configured: number;
}): number {
  const { anchor, offsetX, scale, configured } = options;
  const room =
    anchor === 'left' ? offsetX / scale : (CANVAS_WIDTH - offsetX) / scale - M.panelWidth;
  return Math.max(0, Math.min(configured, Math.floor(room)));
}

/** Extended mode: widen just enough for the widest full name, never more than `maxExtension`. */
export function nameExtension(options: {
  fullWidths: readonly number[];
  area: number;
  maxExtension: number;
}): number {
  const widest = Math.max(0, ...options.fullWidths);
  return Math.max(0, Math.min(options.maxExtension, Math.ceil(widest - options.area)));
}

/**
 * One marquee cycle: hold on the first letter, then travel one copy-plus-gap at constant speed.
 * Duration grows with the name, so long names never scroll faster than short ones.
 */
export function marqueeTiming(distance: number): { durationMs: number; holdOffset: number } {
  const travelMs = (distance / MARQUEE_SPEED) * 1000;
  const durationMs = Math.round(MARQUEE_HOLD_MS + travelMs);
  return { durationMs, holdOffset: MARQUEE_HOLD_MS / durationMs };
}
