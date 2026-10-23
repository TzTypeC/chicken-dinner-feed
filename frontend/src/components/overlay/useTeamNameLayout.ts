import type { OverlayAppearance } from '@cdf/shared';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  BADGE_GAP,
  fitDisplayName,
  maxExtensionOnCanvas,
  NAME_FONT_MAX,
  nameColumnWidth,
  nameExtension,
  normalizeTeamName,
  REFERENCE_GLYPHS,
  truncateTeamName,
  uniformNameFontSize,
} from './team-name-fit';

/**
 * How one row prints its name.
 *
 * - `static`: normal mode — the limited text, clipped by CSS only as a last guard.
 * - `scroll`: extended mode — the full name through `OverflowMarquee`, which keeps it still when it
 *   fits and scrolls it when it does not. The row never decides that itself.
 */
export type TeamNamePlan = { mode: 'static'; text: string } | { mode: 'scroll'; text: string };

export interface TeamNameLayout {
  /** The single name font size every row uses, in design px. */
  fontSize: number;
  /** How far the panel widens to the left, in design px (0 outside extended mode). */
  extension: number;
  rows: ReadonlyMap<number, TeamNamePlan>;
  /**
   * True when this layout differs from the previous one only because a web font finished loading.
   * Such a change is applied without the panel-width transition (Part 10): the operator did not ask
   * for it, and animating "settling" metrics would read as the overlay moving by itself.
   */
  instant: boolean;
  /** False for the pre-measurement fallback: nothing may decide from its sizes (marquees wait). */
  measured: boolean;
}

/**
 * The hidden measuring probe, drawn inside the panel with the panel's real `--overlay-unit`:
 *
 * - `text` and `badge` are measured at the **real rendered size**, not at a reference size scaled
 *   linearly — glyph advances and device-pixel snapping do not scale linearly, which used to leave
 *   the widest name a fraction of a pixel too wide at any unit other than 1.
 * - `rulerPx` (1000 real px wide) gives the scale of every ancestor transform: the show/hide
 *   animation's zoom entrance scales this probe too, and `getBoundingClientRect` reports transformed
 *   sizes. Dividing by it makes each measurement independent of whatever the page is animating.
 * - `rulerUnit` (1000 design px wide) gives the real size of one design pixel.
 */
export interface TeamNameProbeRefs {
  probe: RefObject<HTMLElement | null>;
  text: RefObject<HTMLElement | null>;
  badge: RefObject<HTMLElement | null>;
  rulerPx: RefObject<HTMLElement | null>;
  rulerUnit: RefObject<HTMLElement | null>;
}

/** The font size the reference glyph run is measured at (design px). Only an estimator's yardstick. */
const REFERENCE_FONT_SIZE = 100;
const RULER_LENGTH = 1000;
/** Fixed slack added to the extension, on top of one device pixel (see `nameExtension`). */
const EXTENSION_MARGIN_DESIGN_PX = 2;

/**
 * What the layout is before (or without) a browser to measure in — static markup, tests: the
 * character limit at the design size, CSS clipping as the guard. A real browser replaces it before
 * the first paint (`useLayoutEffect`).
 */
export function fallbackTeamNameLayout(
  teams: readonly { teamNo: number; name: string }[],
  appearance: OverlayAppearance,
): TeamNameLayout {
  const rows = new Map<number, TeamNamePlan>();
  for (const team of teams) {
    rows.set(
      team.teamNo,
      appearance.teamNameExtendedMode
        ? { mode: 'scroll', text: normalizeTeamName(team.name) }
        : { mode: 'static', text: truncateTeamName(team.name, appearance.teamNameMaxChars) },
    );
  }
  return { fontSize: NAME_FONT_MAX, extension: 0, rows, instant: true, measured: false };
}

/**
 * Computes the name font size, the extended-mode width and each row's text once per change of what
 * actually affects them — the team names, the font (and when it finishes loading), the limit, the
 * mode, the extension cap and the columns/anchor — never per live snapshot. Uses every team in the
 * snapshot, not just the visible `maxTeams`, so standings moving on air never resize anything.
 *
 * Every width is measured in layout space (see `TeamNameProbeRefs`), so the result does not depend
 * on the overlay's scale, the browser source's resolution or an entrance animation in progress.
 */
export function useTeamNameLayout(
  teams: readonly { teamNo: number; name: string }[],
  appearance: OverlayAppearance,
  refs: TeamNameProbeRefs,
): TeamNameLayout {
  const [fontEpoch, setFontEpoch] = useState(0);
  const [layout, setLayout] = useState<TeamNameLayout | null>(null);

  // Web fonts (Google Fonts, uploaded fonts) can arrive after the first measurement; metrics taken
  // against the fallback font would be wrong. Re-measure once whenever a font load settles.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    let cancelled = false;
    const bump = () => {
      if (!cancelled) setFontEpoch((epoch) => epoch + 1);
    };
    void document.fonts.ready.then(bump);
    document.fonts.addEventListener('loadingdone', bump);
    return () => {
      cancelled = true;
      document.fonts.removeEventListener('loadingdone', bump);
    };
  }, []);

  const { fontFamily, teamNameMaxChars, teamNameExtendedMode, teamNameMaxExtension } = appearance;
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const { anchor, offsetX, scale } = appearance;

  const namesKey = useMemo(
    () => JSON.stringify(teams.map((team) => [team.teamNo, team.name])),
    [teams],
  );

  /** The non-font inputs of the last measurement, to tell a font-load re-layout from a real change. */
  const lastInputsRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const textEl = refs.text.current;
    const rulerPx = refs.rulerPx.current;
    const rulerUnit = refs.rulerUnit.current;
    if (!textEl || !rulerPx || !rulerUnit) return;

    // Ancestor transform scale, and real px per design px, both in layout space.
    const ancestorScale = rulerPx.getBoundingClientRect().width / RULER_LENGTH;
    const unit = rulerUnit.getBoundingClientRect().width / ancestorScale / RULER_LENGTH;
    // Not laid out (hidden or detached): keep the previous layout rather than measure zeros.
    if (!(ancestorScale > 0) || !(unit > 0)) return;

    /** Width of `text` at `designFontSize`, in design px, whatever transform the page is in. */
    const measureDesign = (text: string, designFontSize: number): number => {
      textEl.style.fontSize = `${designFontSize * unit}px`;
      textEl.textContent = text;
      return textEl.getBoundingClientRect().width / ancestorScale / unit;
    };

    const badgeWidth =
      showTeamNumbers && refs.badge.current
        ? refs.badge.current.getBoundingClientRect().width / ancestorScale / unit + BADGE_GAP
        : 0;
    const area = nameColumnWidth(showLogos) - badgeWidth;
    const averageAdvanceEm =
      measureDesign(REFERENCE_GLYPHS, REFERENCE_FONT_SIZE) /
      REFERENCE_FONT_SIZE /
      REFERENCE_GLYPHS.length;
    const fontSize = uniformNameFontSize({ area, limit: teamNameMaxChars, averageAdvanceEm });

    // From here on names are measured at the size they are drawn at.
    const cache = new Map<string, number>();
    const widthAtFontSize = (text: string): number => {
      const cached = cache.get(text);
      if (cached !== undefined) return cached;
      const width = measureDesign(text, fontSize);
      cache.set(text, width);
      return width;
    };

    const entries: [number, string][] = JSON.parse(namesKey);
    const rows = new Map<number, TeamNamePlan>();
    let extension = 0;

    if (!teamNameExtendedMode) {
      for (const [teamNo, name] of entries) {
        rows.set(teamNo, {
          mode: 'static',
          text: fitDisplayName({
            name,
            limit: teamNameMaxChars,
            fontSize,
            area,
            measureEm: (text) => widthAtFontSize(text) / fontSize,
          }),
        });
      }
    } else {
      const full = entries.map(([teamNo, name]) => {
        const text = normalizeTeamName(name);
        return { teamNo, text, width: widthAtFontSize(text) };
      });
      extension = nameExtension({
        fullWidths: full.map((entry) => entry.width),
        area,
        maxExtension: maxExtensionOnCanvas({
          anchor,
          offsetX,
          scale,
          configured: teamNameMaxExtension,
        }),
        margin: EXTENSION_MARGIN_DESIGN_PX + 1 / unit,
      });
      for (const entry of full) rows.set(entry.teamNo, { mode: 'scroll', text: entry.text });
    }
    textEl.textContent = '';
    textEl.style.fontSize = '';
    const inputs = JSON.stringify([
      namesKey,
      fontFamily,
      teamNameMaxChars,
      teamNameExtendedMode,
      teamNameMaxExtension,
      showLogos,
      showTeamNumbers,
      anchor,
      offsetX,
      scale,
    ]);
    const instant = lastInputsRef.current === null || lastInputsRef.current === inputs;
    lastInputsRef.current = inputs;
    setLayout((previous) =>
      previous &&
      previous.fontSize === fontSize &&
      previous.extension === extension &&
      sameRows(previous.rows, rows)
        ? previous
        : { fontSize, extension, rows, instant, measured: true },
    );
  }, [
    refs,
    namesKey,
    fontFamily,
    fontEpoch,
    teamNameMaxChars,
    teamNameExtendedMode,
    teamNameMaxExtension,
    showLogos,
    showTeamNumbers,
    anchor,
    offsetX,
    scale,
  ]);

  return layout ?? fallbackTeamNameLayout(teams, appearance);
}

function sameRows(a: ReadonlyMap<number, TeamNamePlan>, b: ReadonlyMap<number, TeamNamePlan>) {
  if (a.size !== b.size) return false;
  for (const [teamNo, plan] of a) {
    const other = b.get(teamNo);
    if (!other || other.mode !== plan.mode || other.text !== plan.text) return false;
  }
  return true;
}
