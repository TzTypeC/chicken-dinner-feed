/**
 * Resolution-independent sizing for overlay surfaces (ADR-0011).
 *
 * Every dimension in an overlay is written in **design-canvas pixels** — the 1920×1080 grid the
 * layout was authored against — and converted here. `--overlay-unit` is one design pixel expressed
 * as a real length, so the whole overlay scales uniformly to 1080p, 1440p or 4K with no breakpoints
 * and no reflow.
 *
 * A literal `px` anywhere in an overlay component is a bug: it will look right at 1080p, where
 * development happens, and wrong everywhere else.
 */
export function u(designPixels: number): string {
  return `calc(${designPixels} * var(--overlay-unit))`;
}

/**
 * Unscaled 1920×1080 design-canvas pixels (`--overlay-base-unit`).
 *
 * Used for full-canvas broadcast compositions (`Final-4` top bar, `WWCD` victory screen, and
 * `Post-Game Standings`) whose geometry spans the 1920×1080 frame and must remain locked to the
 * 16:9 broadcast safe area regardless of the side-tower `scale` multiplier.
 */
export function ub(designPixels: number): string {
  return `calc(${designPixels} * var(--overlay-base-unit))`;
}

/** Formats a canonical 1-based team slot number (`teamNo`) as `T01`–`T25` (`D-PMCC-01`). */
export function formatTeamSlot(teamNo: number): string {
  return `T${String(teamNo).padStart(2, '0')}`;
}

/** Layout constants for the leaderboard, in design-canvas pixels. Mirrors `specs/example.png`. */
export const LEADERBOARD_METRICS = {
  panelWidth: 340,
  /** The panel's own outline, each side. */
  panelBorder: 1,
  /** The left stripe every row reserves for the leader highlight. */
  rowLeaderStripe: 2,
  paddingX: 10,
  /** The accent strip along the top of the panel — the overlay's branding colour. */
  accentBarHeight: 3,
  headerHeight: 40,
  rowHeight: 44,
  legendHeight: 34,

  rankColumn: 26,
  logoColumn: 28,
  /**
   * Part 8 reclaimed slack here for the TEAM column without touching the frame: the four bars need
   * 48 (was 62), the ELIMS header ≈ 40 (was 50), and gaps dropped from 6 to 4.
   */
  aliveColumn: 50,
  pointsColumn: 42,
  elimsColumn: 44,
  columnGap: 4,

  barWidth: 9,
  barGap: 4,
  barHeight: 27,
  /** A dead player still shows a stub, so the slot stays legible instead of vanishing. */
  deadBarHeight: 5,
} as const;

/**
 * The leaderboard's grid template, shared by the header and every row so they can never drift out
 * of alignment. TEAM is the only flexible column: an extended-mode panel's extra width goes there.
 */
export function leaderboardColumns(showLogos: boolean): string {
  const M = LEADERBOARD_METRICS;
  return showLogos
    ? `${u(M.rankColumn)} ${u(M.logoColumn)} 1fr ${u(M.aliveColumn)} ${u(M.pointsColumn)} ${u(M.elimsColumn)}`
    : `${u(M.rankColumn)} 1fr ${u(M.aliveColumn)} ${u(M.pointsColumn)} ${u(M.elimsColumn)}`;
}
