import type { IngestSourceKind, MatchState, OverlayAppearance } from '@cdf/shared';
import { motion } from 'motion/react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { appearanceToCssVariables, ROW_VARIANTS } from './appearance';
import { formatTeamSlot, LEADERBOARD_METRICS as M, leaderboardColumns, u } from './overlay-scale';
import { TeamRow } from './TeamRow';
import { SLOT_BADGE_CLASS, SLOT_BADGE_STYLE, TEAM_NAME_CLASS } from './team-row-styles';
import { truncateTeamName } from './team-name-fit';
import { useTeamNameLayout } from './useTeamNameLayout';

const LEGEND = [
  { label: 'ALIVE', color: 'var(--player-alive)' },
  { label: 'KNOCKED', color: 'var(--player-knocked)' },
  { label: 'ELIM', color: 'var(--player-dead)' },
] as const;

export interface LeaderboardOverlayProps {
  match: MatchState;
  appearance: OverlayAppearance;
  /** Active ingest source; when `'manual'`, the `KNOCKED` legend item is omitted (`D-05`). */
  source?: IngestSourceKind;
  /**
   * Whether rows should fade in one after another once the panel has arrived. The timing itself is
   * orchestrated by the panel above, so this only decides whether a row takes part.
   */
  animateRows?: boolean;
  /**
   * Extended mode: how far the panel currently widens to the left, in design px. The page uses it
   * to keep a left-anchored panel's right edge in place (see `appearanceToPosition`).
   */
  onExtensionChange?(extension: number): void;
}

/**
 * The team standings panel from `specs/example.png`.
 *
 * Rows are rendered in the order the backend supplies, which is already ranked — the overlay never
 * sorts. Two overlays disagreeing about the standings at the same instant would be a visible defect,
 * so ranking is computed once, server-side (ADR-0007).
 */
export function LeaderboardOverlay({
  match,
  appearance,
  source,
  animateRows = false,
  onExtensionChange,
}: LeaderboardOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const columns = leaderboardColumns(showLogos);
  const teams = match.teams.slice(0, appearance.maxTeams);
  const legendEntries =
    source === 'manual' ? LEGEND.filter((entry) => entry.label !== 'KNOCKED') : LEGEND;

  const probeRef = useRef<HTMLDivElement>(null);
  const probeTextRef = useRef<HTMLSpanElement>(null);
  const probeBadgeRef = useRef<HTMLSpanElement>(null);
  const rulerPxRef = useRef<HTMLDivElement>(null);
  const rulerUnitRef = useRef<HTMLDivElement>(null);
  const probeRefs = useMemo(
    () => ({
      probe: probeRef,
      text: probeTextRef,
      badge: probeBadgeRef,
      rulerPx: rulerPxRef,
      rulerUnit: rulerUnitRef,
    }),
    [],
  );
  // Every team in the snapshot, not only the visible rows: standings moving on air never resize.
  const nameLayout = useTeamNameLayout(match.teams, appearance, probeRefs);
  const extension = nameLayout.extension;

  // Layout effect: the page repositions in the same frame, before anything is painted.
  useLayoutEffect(() => {
    onExtensionChange?.(extension);
  }, [extension, onExtensionChange]);

  return (
    <div
      data-testid="leaderboard-panel"
      style={{
        ...appearanceToCssVariables(appearance),
        // Extended mode widens the panel to the LEFT only: the right edge — and with it the ALIVE,
        // PTS and ELIMS columns — stays exactly where it is. A right-anchored panel grows leftward
        // by itself; a left-anchored one is moved left by the page (`onExtensionChange`).
        width: u(M.panelWidth + extension),
        position: 'relative',
        backgroundColor: 'var(--overlay-bg)',
        fontFamily: 'var(--overlay-font-family)',
        borderRadius: u(3),
        border: `${u(M.panelBorder)} solid rgba(129, 96, 54, 0.55)`,
        boxShadow: `0 ${u(10)} ${u(28)} rgba(0, 0, 0, 0.52)`,
        overflow: 'hidden',
      }}
    >
      {/*
       * Measuring probe for the name layout, drawn with the panel's real `--overlay-unit` so names
       * are measured at the size they are painted at. The two rulers turn the measurements into
       * design px and cancel any transform an ancestor is animating. Never visible.
       */}
      <div
        ref={probeRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          width: 0,
          height: 0,
          overflow: 'hidden',
        }}
      >
        <div ref={rulerPxRef} style={{ width: '1000px', height: 0 }} />
        <div ref={rulerUnitRef} style={{ width: u(1000), height: 0 }} />
        <span ref={probeTextRef} className={TEAM_NAME_CLASS} />
        <span ref={probeBadgeRef} className={SLOT_BADGE_CLASS} style={SLOT_BADGE_STYLE}>
          {formatTeamSlot(25)}
        </span>
      </div>

      {/*
       * The accent strip. Styled with the PMCC 2026 championship gold gradient and subtle diamond
       * centre accent while respecting the operator's `--overlay-accent` colour.
       */}
      <div
        style={{
          height: u(M.accentBarHeight),
          background:
            'linear-gradient(90deg, rgba(129, 96, 54, 0.85) 0%, var(--overlay-accent) 50%, rgba(129, 96, 54, 0.85) 100%)',
        }}
      />

      <div
        className="grid items-center"
        style={{
          height: u(M.headerHeight),
          paddingInline: u(M.paddingX),
          gridTemplateColumns: columns,
          columnGap: u(M.columnGap),
          backgroundColor: 'var(--overlay-header-bg)',
          color: 'var(--overlay-text-muted)',
          fontSize: u(11),
          letterSpacing: u(0.8),
          borderBottom: `${u(1)} solid var(--overlay-accent)`,
        }}
      >
        <span className="font-bold">#</span>
        {/* The logo column has no heading; omitted cleanly when logos are toggled off. */}
        {showLogos && <span />}
        <span className="font-bold">TEAM</span>
        <span className="text-center font-bold">ALIVE</span>
        <span className="text-center font-bold">PTS</span>
        <span className="text-center font-bold">ELIMS</span>
      </div>

      {/*
       * `layoutRoot`: the rows' reorder animation is measured relative to this container, and the
       * container itself never animates. When extended mode widens the panel to the left, every row
       * moves with the panel instead of sliding back from its old position (Part 9); rank changes —
       * a row's position *within* the list — still animate.
       */}
      <motion.div layout layoutRoot className="flex flex-col">
        {teams.map((team, index) => (
          /*
           * Always the same keyed wrapper, so switching the row stagger on or off never remounts the
           * rows (and their marquees). Variants live here rather than on TeamRow: the row already
           * animates its own opacity to dim eliminated teams, and two things writing the same
           * property fight; the two opacities simply multiply.
           */
          <motion.div key={team.teamNo} variants={animateRows ? ROW_VARIANTS : undefined}>
            <TeamRow
              team={team}
              isAlternate={index % 2 === 1}
              showLogo={showLogos}
              showTeamNumber={showTeamNumbers}
              nameFontSize={nameLayout.fontSize}
              namePlan={
                nameLayout.rows.get(team.teamNo) ?? {
                  mode: 'static',
                  text: truncateTeamName(team.name, appearance.teamNameMaxChars),
                }
              }
            />
          </motion.div>
        ))}
      </motion.div>

      {appearance.showLegend && (
        <div
          className="flex items-center justify-center"
          style={{
            height: u(M.legendHeight),
            gap: u(14),
            backgroundColor: 'var(--overlay-header-bg)',
            color: 'var(--overlay-text-muted)',
            fontSize: u(10),
            letterSpacing: u(0.5),
          }}
        >
          {legendEntries.map((entry) => (
            <span key={entry.label} className="flex items-center" style={{ gap: u(5) }}>
              <span
                style={{
                  width: u(6),
                  height: u(6),
                  borderRadius: '50%',
                  backgroundColor: entry.color,
                }}
              />
              {entry.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
