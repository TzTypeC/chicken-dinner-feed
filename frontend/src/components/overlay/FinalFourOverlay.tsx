import type { IngestSourceKind, LiveMatchInfo, OverlayAppearance } from '@cdf/shared';
import { motion } from 'motion/react';
import { AlivePlayerBars } from './AlivePlayerBars';
import { appearanceToCssVariables } from './appearance';
import type { FinalFourCardItem } from './broadcast-state';
import { formatTeamSlot, ub } from './overlay-scale';

export interface FinalFourOverlayProps {
  cohort: FinalFourCardItem[];
  matchInfo: LiveMatchInfo;
  appearance: OverlayAppearance;
  source?: IngestSourceKind;
}

/**
 * Automatic Final-4 Horizontal Top Bar (`docs/final-four-leaderboard-audit.md`, `D-PMCC-02` / `A1`).
 *
 * Anchored across the top-center of the 1920×1080 broadcast frame (`width: 1440px`) so the entire
 * center, bottom, and sides of the gameplay feed remain clear during the final-circle fight.
 *
 * Retains all 4 cards as squads are eliminated from 4 down to 3 and 2 alive teams: eliminated
 * Final-4 squads transition into a grayed-out knocked-out visual state (`isKnockedOut === true`,
 * muted gunmetal surface, dimmed logo/name, gray player bars, and `OUT #4` / `OUT #3` badge) rather
 * than disappearing.
 */
export function FinalFourOverlay({ cohort, matchInfo, appearance }: FinalFourOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const aliveTeamCount = cohort.filter((item) => !item.isKnockedOut).length;

  return (
    <motion.div
      data-testid="final-four-overlay"
      initial={{ opacity: 0, y: -22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      style={{
        ...appearanceToCssVariables(appearance),
        position: 'fixed',
        top: ub(24),
        left: '50%',
        transform: 'translateX(-50%)',
        width: ub(1448),
        zIndex: 18,
        pointerEvents: 'none',
        fontFamily: 'var(--overlay-font-family)',
      }}
    >
      {/* Top PMCC 2026 Architectural Micro-Header */}
      <div
        className="flex items-center justify-between"
        style={{
          marginBottom: ub(6),
          paddingInline: ub(4),
        }}
      >
        <div className="flex items-center" style={{ gap: ub(8) }}>
          <span
            aria-hidden
            style={{
              fontSize: ub(11),
              color: 'var(--overlay-accent)',
              lineHeight: 1,
            }}
          >
            ◇
          </span>
          <span
            className="font-extrabold uppercase"
            style={{
              fontSize: ub(11),
              letterSpacing: ub(2),
              color: 'var(--overlay-accent)',
            }}
          >
            FINAL 4 SHOWDOWN
          </span>
          <span
            style={{
              width: ub(36),
              height: ub(1),
              backgroundColor: 'rgba(129, 96, 54, 0.65)',
            }}
          />
          <span
            className="font-bold uppercase tabular-nums"
            style={{
              fontSize: ub(11),
              letterSpacing: ub(1.2),
              color: 'var(--overlay-text-muted)',
            }}
          >
            {aliveTeamCount} / 4 SQUADS ALIVE
          </span>
        </div>

        <div className="flex items-center" style={{ gap: ub(8) }}>
          <span
            className="font-bold uppercase tabular-nums"
            style={{
              fontSize: ub(11),
              letterSpacing: ub(1.2),
              color: 'var(--overlay-text-muted)',
            }}
          >
            MATCH {matchInfo.matchNumber}
            {matchInfo.mapName.trim() ? `  •  ${matchInfo.mapName.trim().toUpperCase()}` : ''}
          </span>
          <span
            aria-hidden
            style={{
              fontSize: ub(11),
              color: 'var(--overlay-accent)',
              lineHeight: 1,
            }}
          >
            ◇
          </span>
        </div>
      </div>

      {/* 4 Horizontal Squad Cards */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          columnGap: ub(14),
        }}
      >
        {cohort.map((item, index) => {
          const { team, isKnockedOut, eliminatedPlacement } = item;
          const isLeader = team.rank === 1 && !isKnockedOut;

          return (
            <motion.div
              key={team.teamNo}
              data-testid={`final-four-card-${team.teamNo}`}
              data-status={isKnockedOut ? 'eliminated' : 'alive'}
              layout
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: isKnockedOut ? 0.56 : 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: index * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex flex-col overflow-hidden"
              style={{
                borderRadius: ub(3),
                backgroundColor: isKnockedOut ? 'rgba(36, 33, 29, 0.88)' : 'var(--overlay-bg)',
                border: isKnockedOut
                  ? `${ub(1)} solid rgba(110, 102, 90, 0.45)`
                  : isLeader
                    ? `${ub(1)} solid var(--overlay-accent)`
                    : `${ub(1)} solid rgba(129, 96, 54, 0.65)`,
                boxShadow: isKnockedOut
                  ? `0 ${ub(4)} ${ub(14)} rgba(0, 0, 0, 0.38)`
                  : `0 ${ub(10)} ${ub(26)} rgba(0, 0, 0, 0.55)`,
                filter: isKnockedOut ? 'grayscale(0.85)' : 'none',
                transition: 'opacity 320ms ease, filter 320ms ease, border-color 320ms ease',
              }}
            >
              {/* Top Accent Hairline */}
              <div
                style={{
                  height: ub(3),
                  background: isKnockedOut
                    ? 'rgba(82, 82, 91, 0.65)'
                    : isLeader
                      ? 'linear-gradient(90deg, var(--overlay-accent) 0%, #eeb058 50%, var(--overlay-accent) 100%)'
                      : 'rgba(129, 96, 54, 0.85)',
                }}
              />

              {/* Upper Identity Row: Live Rank + Logo + Team Slot (T##) + Team Name */}
              <div
                className="flex items-center"
                style={{
                  height: ub(50),
                  paddingInline: ub(12),
                  gap: ub(10),
                  backgroundColor: isKnockedOut
                    ? 'rgba(28, 26, 23, 0.92)'
                    : 'var(--overlay-header-bg)',
                }}
              >
                {/* Live Match Rank Pillar */}
                <div
                  className="flex shrink-0 flex-col items-center justify-center tabular-nums"
                  style={{
                    minWidth: ub(34),
                    height: ub(34),
                    borderRadius: ub(2),
                    backgroundColor: isKnockedOut
                      ? 'rgba(61, 54, 43, 0.45)'
                      : isLeader
                        ? 'var(--overlay-accent)'
                        : 'rgba(61, 54, 43, 0.72)',
                    color: isKnockedOut
                      ? 'var(--overlay-text-muted)'
                      : isLeader
                        ? '#160f0a'
                        : 'var(--overlay-text)',
                    border: isLeader ? 'none' : `${ub(1)} solid rgba(129, 96, 54, 0.5)`,
                  }}
                >
                  <span
                    className="font-extrabold tabular-nums"
                    style={{ fontSize: ub(15), lineHeight: 1 }}
                  >
                    #{team.rank}
                  </span>
                </div>

                {/* Team Logo */}
                {showLogos && (
                  <div
                    className="flex shrink-0 items-center justify-center"
                    style={{ width: ub(34), height: ub(34) }}
                  >
                    {team.logoUrl ? (
                      <img
                        src={team.logoUrl}
                        alt=""
                        style={{
                          width: ub(34),
                          height: ub(34),
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: ub(28),
                          height: ub(28),
                          borderRadius: ub(2),
                          backgroundColor: 'var(--overlay-row-alt-bg)',
                          border: `${ub(1)} solid rgba(129, 96, 54, 0.55)`,
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Team Slot Badge + Team Name */}
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <div className="flex min-w-0 items-center" style={{ gap: ub(6) }}>
                    {showTeamNumbers && (
                      <span
                        data-testid={`final-four-slot-${team.teamNo}`}
                        className="shrink-0 font-bold uppercase tabular-nums"
                        style={{
                          fontSize: ub(9.5),
                          lineHeight: 1,
                          paddingInline: ub(4.5),
                          paddingBlock: ub(2.5),
                          borderRadius: ub(2),
                          backgroundColor: 'rgba(61, 54, 43, 0.85)',
                          border: `${ub(1)} solid rgba(129, 96, 54, 0.55)`,
                          color: 'var(--overlay-text-muted)',
                        }}
                      >
                        {formatTeamSlot(team.teamNo)}
                      </span>
                    )}
                    <span
                      className="truncate font-extrabold uppercase tracking-wide"
                      style={{
                        fontSize: ub(15),
                        color: isKnockedOut ? 'var(--overlay-text-muted)' : 'var(--overlay-text)',
                      }}
                    >
                      {team.name}
                    </span>
                  </div>
                </div>

                {/* Knocked-out status pill when eliminated in 4th/3rd */}
                {isKnockedOut && (
                  <span
                    className="shrink-0 font-extrabold uppercase tabular-nums"
                    style={{
                      fontSize: ub(9.5),
                      lineHeight: 1,
                      paddingInline: ub(6),
                      paddingBlock: ub(3),
                      borderRadius: ub(2),
                      backgroundColor: 'rgba(82, 82, 91, 0.55)',
                      border: `${ub(1)} solid rgba(161, 161, 170, 0.35)`,
                      color: 'var(--overlay-text-muted)',
                      letterSpacing: ub(0.6),
                    }}
                  >
                    {eliminatedPlacement ? `OUT #${eliminatedPlacement}` : 'ELIMINATED'}
                  </span>
                )}
              </div>

              {/* Lower Tactical Strip: 4-Segment Alive Bars + Match Elims + Total Points */}
              <div
                className="flex items-center justify-between"
                style={{
                  height: ub(40),
                  paddingInline: ub(12),
                  borderTop: `${ub(1)} solid rgba(129, 96, 54, 0.32)`,
                }}
              >
                {/* Alive Player Bars + Alive Count */}
                <div className="flex items-center" style={{ gap: ub(8) }}>
                  <AlivePlayerBars players={team.players} />
                  <span
                    className="font-bold uppercase tabular-nums"
                    style={{
                      fontSize: ub(10.5),
                      letterSpacing: ub(0.6),
                      color: 'var(--overlay-text-muted)',
                    }}
                  >
                    {isKnockedOut ? '0/4' : `${team.standingPlayerCount}/4`}
                  </span>
                </div>

                {/* Match Eliminations & Total Points */}
                <div className="flex items-center tabular-nums" style={{ gap: ub(14) }}>
                  <div className="flex items-baseline" style={{ gap: ub(4) }}>
                    <span
                      className="font-bold uppercase"
                      style={{
                        fontSize: ub(9.5),
                        letterSpacing: ub(0.7),
                        color: 'var(--overlay-text-muted)',
                      }}
                    >
                      ELIMS
                    </span>
                    <span
                      className="font-extrabold tabular-nums"
                      style={{
                        fontSize: ub(15),
                        color: isKnockedOut ? 'var(--overlay-text-muted)' : 'var(--overlay-text)',
                      }}
                    >
                      {team.eliminations}
                    </span>
                  </div>

                  <div className="flex items-baseline" style={{ gap: ub(4) }}>
                    <span
                      className="font-bold uppercase"
                      style={{
                        fontSize: ub(9.5),
                        letterSpacing: ub(0.7),
                        color: 'var(--overlay-text-muted)',
                      }}
                    >
                      PTS
                    </span>
                    <span
                      className="font-extrabold tabular-nums"
                      style={{
                        fontSize: ub(15),
                        color: isKnockedOut ? 'var(--overlay-text-muted)' : 'var(--overlay-accent)',
                      }}
                    >
                      {team.totalPoints}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
