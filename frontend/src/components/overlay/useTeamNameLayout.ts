import type { OverlayAppearance } from '@cdf/shared';
import { useEffect, useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import {
  BADGE_GAP,
  fitDisplayName,
  MARQUEE_GAP_EM,
  maxExtensionOnCanvas,
  NAME_FONT_MAX,
  nameColumnWidth,
  nameExtension,
  normalizeTeamName,
  REFERENCE_GLYPHS,
  truncateTeamName,
  uniformNameFontSize,
} from './team-name-fit';

/** How one row prints its name. */
export type TeamNamePlan =
  | { mode: 'static'; text: string }
  | { mode: 'marquee'; text: string; /** One copy plus its gap, in design px. */ distance: number };

export interface TeamNameLayout {
  /** The single name font size every row uses, in design px. */
  fontSize: number;
  /** How far the panel widens to the left, in design px (0 outside extended mode). */
  extension: number;
  rows: ReadonlyMap<number, TeamNamePlan>;
}

/**
 * The hidden measuring probe. It sets `--overlay-unit: 1px`, so every `u()` length inside it is one
 * real pixel per design pixel and measured widths come back in design pixels whatever the operator's
 * scale or the browser source's resolution.
 */
export interface TeamNameProbeRefs {
  probe: RefObject<HTMLElement | null>;
  text: RefObject<HTMLElement | null>;
  badge: RefObject<HTMLElement | null>;
}

const PROBE_FONT_SIZE = 100;

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
    rows.set(team.teamNo, {
      mode: 'static',
      text: appearance.teamNameExtendedMode
        ? normalizeTeamName(team.name)
        : truncateTeamName(team.name, appearance.teamNameMaxChars),
    });
  }
  return { fontSize: NAME_FONT_MAX, extension: 0, rows };
}

/**
 * Computes the name font size, the extended-mode width and each row's text once per change of what
 * actually affects them — the team names, the font (and when it finishes loading), the limit, the
 * mode, the extension cap and the columns/anchor — never per live snapshot. Uses every team in the
 * snapshot, not just the visible `maxTeams`, so standings moving on air never resize anything.
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

  useLayoutEffect(() => {
    const textEl = refs.text.current;
    if (!textEl) return;

    const cache = new Map<string, number>();
    const measureEm = (text: string): number => {
      const cached = cache.get(text);
      if (cached !== undefined) return cached;
      textEl.textContent = text;
      const em = textEl.getBoundingClientRect().width / PROBE_FONT_SIZE;
      cache.set(text, em);
      return em;
    };

    const badgeWidth =
      showTeamNumbers && refs.badge.current
        ? refs.badge.current.getBoundingClientRect().width + BADGE_GAP
        : 0;
    const area = nameColumnWidth(showLogos) - badgeWidth;
    const averageAdvanceEm = measureEm(REFERENCE_GLYPHS) / REFERENCE_GLYPHS.length;
    const fontSize = uniformNameFontSize({ area, limit: teamNameMaxChars, averageAdvanceEm });
    const entries: [number, string][] = JSON.parse(namesKey);

    const rows = new Map<number, TeamNamePlan>();
    let extension = 0;

    if (!teamNameExtendedMode) {
      for (const [teamNo, name] of entries) {
        rows.set(teamNo, {
          mode: 'static',
          text: fitDisplayName({ name, limit: teamNameMaxChars, fontSize, area, measureEm }),
        });
      }
    } else {
      const full = entries.map(([teamNo, name]) => {
        const text = normalizeTeamName(name);
        return { teamNo, text, width: measureEm(text) * fontSize };
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
      });
      for (const entry of full) {
        rows.set(
          entry.teamNo,
          entry.width <= area + extension
            ? { mode: 'static', text: entry.text }
            : {
                mode: 'marquee',
                text: entry.text,
                distance: entry.width + MARQUEE_GAP_EM * fontSize,
              },
        );
      }
    }

    textEl.textContent = '';
    setLayout({ fontSize, extension, rows });
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
