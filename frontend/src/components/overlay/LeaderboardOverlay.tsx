import type { IngestSourceKind, MatchState, OverlayAppearance } from '@cdf/shared';
import { motion } from 'motion/react';
import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
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
  const probeRefs = useMemo(
    () => ({ probe: probeRef, text: probeTextRef, badge: probeBadgeRef }),
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
       * Measuring probe for the name layout. `--overlay-unit: 1px` makes every length inside it one
       * real pixel per design pixel, so measurements are scale-independent. Never visible.
       */}
      <div
        ref={probeRef}
        aria-hidden
        style={
          {
            '--overlay-unit': '1px',
            position: 'absolute',
            left: 0,
            top: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            width: 0,
            overflow: 'hidden',
          } as CSSProperties
        }
      >
        <span ref={probeTextRef} className={TEAM_NAME_CLASS} style={{ fontSize: '100px' }} />
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

      <div className="flex flex-col">
        {teams.map((team, index) => {
          const row = (
            <TeamRow
              key={animateRows ? undefined : team.teamNo}
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
          );
          return animateRows ? (
            /*
             * A wrapper rather than variants on TeamRow itself: the row already animates its own
             * opacity to dim eliminated teams, and two things writing the same property fight. The
             * two opacities simply multiply, which is the behaviour we want anyway.
             */
            <motion.div key={team.teamNo} variants={ROW_VARIANTS}>
              {row}
            </motion.div>
          ) : (
            row
          );
        })}
      </div>

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
