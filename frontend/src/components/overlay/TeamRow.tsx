import type { Team } from '@cdf/shared';
import { motion } from 'motion/react';
import { AlivePlayerBars } from './AlivePlayerBars';
import { formatTeamSlot, LEADERBOARD_METRICS as M, leaderboardColumns, u } from './overlay-scale';
import { BADGE_GAP, NAME_FONT_MAX } from './team-name-fit';
import { SLOT_BADGE_CLASS, SLOT_BADGE_STYLE, TEAM_NAME_CLASS } from './team-row-styles';
import { OverflowMarquee } from './OverflowMarquee';
import type { TeamNamePlan } from './useTeamNameLayout';

export interface TeamRowProps {
  team: Team;
  isAlternate: boolean;
  showLogo?: boolean;
  showTeamNumber?: boolean;
  /** How this row prints its name (Part 8). Defaults to the raw name, clipped by CSS. */
  namePlan?: TeamNamePlan;
  /** The uniform name font size shared by every row, in design px. */
  nameFontSize?: number;
}

/** A number that draws attention to itself when it changes, without moving the layout. */
function CountingValue({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.4, scale: 1.35 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="inline-block tabular-nums"
    >
      {value}
    </motion.span>
  );
}

export function TeamRow({
  team,
  isAlternate,
  showLogo = true,
  showTeamNumber = true,
  namePlan,
  nameFontSize = NAME_FONT_MAX,
}: TeamRowProps) {
  const isLeader = team.rank === 1 && !team.isEliminated;
  const textColor = team.isEliminated ? 'var(--overlay-text-muted)' : 'var(--overlay-text)';
  const rankColor = isLeader ? 'var(--overlay-accent)' : textColor;
  const columns = leaderboardColumns(showLogo);
  const plan: TeamNamePlan = namePlan ?? { mode: 'static', text: team.name };

  return (
    <motion.div
      // `layout` is what animates a team physically sliding past another as the standings change.
      // It is the single most visible piece of motion in the overlay. `position` only: a width
      // change (extended mode on/off) must snap, not scale-stretch the row's text (Part 8).
      layout="position"
      transition={{ layout: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }}
      className="grid items-center"
      style={{
        height: u(M.rowHeight),
        paddingInline: u(M.paddingX),
        gridTemplateColumns: columns,
        columnGap: u(M.columnGap),
        backgroundColor: isLeader
          ? 'rgba(229, 169, 60, 0.11)'
          : isAlternate
            ? 'var(--overlay-row-alt-bg)'
            : 'transparent',
        borderLeft: isLeader ? `${u(2)} solid var(--overlay-accent)` : `${u(2)} solid transparent`,
        borderBottom: `${u(1)} solid rgba(129, 96, 54, 0.16)`,
        // Eliminated teams recede rather than disappear — the director still needs to see where a
        // team finished. A team that has never actually shown up this match recedes further still:
        // it is a roster slot nobody has played, not a competitor, and must read as visibly
        // different from "alive, just no data yet" (which renders identically otherwise — full,
        // undimmed bars — see AlivePlayerBars' `fillFraction`).
        opacity: !team.hasAppeared ? 0.25 : team.isEliminated ? 0.45 : 1,
        transition: 'opacity 400ms ease',
      }}
    >
      <span className="font-extrabold tabular-nums" style={{ fontSize: u(16), color: rankColor }}>
        {team.rank}
      </span>

      {showLogo && (
        <div className="flex items-center justify-center" style={{ height: u(M.logoColumn) }}>
          {team.logoUrl ? (
            <img
              src={team.logoUrl}
              alt=""
              style={{ width: u(M.logoColumn), height: u(M.logoColumn), objectFit: 'contain' }}
            />
          ) : (
            // Placeholder until team logos are configurable, so the column keeps its width and the
            // layout does not shift when logos arrive.
            <div
              style={{
                width: u(M.logoColumn - 6),
                height: u(M.logoColumn - 6),
                borderRadius: u(2),
                backgroundColor: 'var(--overlay-row-alt-bg)',
                border: `${u(1)} solid rgba(129, 96, 54, 0.55)`,
                opacity: 0.65,
              }}
            />
          )}
        </div>
      )}

      <div className="flex min-w-0 items-center" style={{ gap: u(BADGE_GAP) }}>
        {showTeamNumber && (
          <span
            data-testid={`team-slot-${team.teamNo}`}
            className={SLOT_BADGE_CLASS}
            style={SLOT_BADGE_STYLE}
          >
            {formatTeamSlot(team.teamNo)}
          </span>
        )}
        {plan.mode === 'scroll' ? (
          <OverflowMarquee
            testId={`team-name-${team.teamNo}`}
            text={plan.text}
            fontSize={nameFontSize}
            fontSizeCss={u(nameFontSize)}
            color={textColor}
            className={TEAM_NAME_CLASS}
          />
        ) : (
          <span
            data-testid={`team-name-${team.teamNo}`}
            // The text is already limited; `truncate` is only the last guard against painting into
            // the ALIVE column (e.g. before a web font finishes loading).
            className={`truncate ${TEAM_NAME_CLASS}`}
            style={{ fontSize: u(nameFontSize), color: textColor }}
            title={team.name}
          >
            {plan.text}
          </span>
        )}
      </div>

      <div className="flex justify-center">
        <AlivePlayerBars players={team.players} />
      </div>

      <span className="text-center font-semibold" style={{ fontSize: u(16), color: textColor }}>
        <CountingValue value={team.totalPoints} />
      </span>

      <span className="text-center font-semibold" style={{ fontSize: u(16), color: textColor }}>
        <CountingValue value={team.eliminations} />
      </span>
    </motion.div>
  );
}
