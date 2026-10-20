import type { IngestSourceKind, MatchState, OverlayAppearance } from '@cdf/shared';
import { motion } from 'motion/react';
import { appearanceToCssVariables, ROW_VARIANTS } from './appearance';
import { LEADERBOARD_METRICS as M, u } from './overlay-scale';
import { TeamRow } from './TeamRow';

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
}: LeaderboardOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const columns = showLogos
    ? `${u(M.rankColumn)} ${u(M.logoColumn)} 1fr ${u(M.aliveColumn)} ${u(M.pointsColumn)} ${u(M.elimsColumn)}`
    : `${u(M.rankColumn)} 1fr ${u(M.aliveColumn)} ${u(M.pointsColumn)} ${u(M.elimsColumn)}`;
  const teams = match.teams.slice(0, appearance.maxTeams);
  const legendEntries =
    source === 'manual' ? LEGEND.filter((entry) => entry.label !== 'KNOCKED') : LEGEND;

  return (
    <div
      style={{
        ...appearanceToCssVariables(appearance),
        width: u(M.panelWidth),
        backgroundColor: 'var(--overlay-bg)',
        fontFamily: 'var(--overlay-font-family)',
        borderRadius: u(3),
        border: `${u(1)} solid rgba(129, 96, 54, 0.55)`,
        boxShadow: `0 ${u(10)} ${u(28)} rgba(0, 0, 0, 0.52)`,
        overflow: 'hidden',
      }}
    >
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
          columnGap: u(6),
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
        {teams.map((team, index) =>
          animateRows ? (
            /*
             * A wrapper rather than variants on TeamRow itself: the row already animates its own
             * opacity to dim eliminated teams, and two things writing the same property fight. The
             * two opacities simply multiply, which is the behaviour we want anyway.
             */
            <motion.div key={team.teamNo} variants={ROW_VARIANTS}>
              <TeamRow
                team={team}
                isAlternate={index % 2 === 1}
                showLogo={showLogos}
                showTeamNumber={showTeamNumbers}
              />
            </motion.div>
          ) : (
            <TeamRow
              key={team.teamNo}
              team={team}
              isAlternate={index % 2 === 1}
              showLogo={showLogos}
              showTeamNumber={showTeamNumbers}
            />
          ),
        )}
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
