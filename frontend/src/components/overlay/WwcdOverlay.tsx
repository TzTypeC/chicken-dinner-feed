import type { IngestSourceKind, LiveMatchInfo, OverlayAppearance } from '@cdf/shared';
import { AnimatePresence, motion } from 'motion/react';
import { AlivePlayerBars } from './AlivePlayerBars';
import { appearanceToCssVariables } from './appearance';
import type { WwcdWinnerSummary } from './broadcast-state';
import { formatTeamSlot, ub } from './overlay-scale';

export interface WwcdOverlayProps {
  winner: WwcdWinnerSummary | null;
  matchInfo: LiveMatchInfo;
  appearance: OverlayAppearance;
  source?: IngestSourceKind;
}

/**
 * Winner Winner Chicken Dinner (WWCD) Victory Screen (`docs/wwcd-screen-requirements.md`, `D-PMCC-03`).
 *
 * Art-directed in the PMCC 2026 visual identity (`assets/KV_2026 PMCC ID.png`):
 * - Deep espresso-obsidian & mahogany surface framed by burnished bronze hairlines and `◇` diamond nodes.
 * - Championship nib-gold vertical collegiate banner & `#1 VICTORY` crest.
 * - Displays Winner Logo, Persistent Team Slot (`T##`), Team Name, Match Number & Map, `#1` Placement,
 *   Match Eliminations, Match Points, Series Points, and surviving squad status:
 *   - In PCOB Mode (when real player names exist): renders the 4 squad player cards with real names,
 *     alive/eliminated status, and individual match kills.
 *   - In Manual Mode (where player names are synthetic `Slot 1..4`): renders the 4-segment visual
 *     `AlivePlayerBars` + `SURVIVING SQUAD: X / 4 ALIVE` without fake player names.
 */
export function WwcdOverlay({ winner, matchInfo, appearance, source }: WwcdOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;

  // Real player names are available only in PCOB/mock mode when players are not synthetic "Slot N"
  const hasRealPlayerNames =
    source !== 'manual' &&
    Boolean(
      winner &&
      winner.players.length > 0 &&
      winner.players.some((player) => !/^Slot\s+\d+$/i.test(player.name.trim())),
    );

  return (
    <div
      style={{
        ...appearanceToCssVariables(appearance),
        position: 'fixed',
        inset: 0,
        zIndex: 25,
        pointerEvents: 'none',
        fontFamily: 'var(--overlay-font-family)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AnimatePresence mode="wait">
        {winner && (
          <motion.div
            key={`wwcd-${winner.teamNo}-${matchInfo.matchNumber}`}
            data-testid="wwcd-overlay"
            initial={{ opacity: 0, y: 20, scale: 0.965 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: ub(1140),
              borderRadius: ub(4),
              overflow: 'hidden',
              backgroundColor: 'var(--overlay-bg)',
              color: 'var(--overlay-text)',
              border: `${ub(1)} solid rgba(129, 96, 54, 0.82)`,
              boxShadow: `0 ${ub(24)} ${ub(64)} rgba(0, 0, 0, 0.72), 0 0 0 ${ub(1)} rgba(238, 176, 88, 0.22) inset`,
            }}
          >
            {/* Top Championship Gold Architectural Bar */}
            <div
              style={{
                height: ub(5),
                background:
                  'linear-gradient(90deg, #816036 0%, var(--overlay-accent) 30%, #ffefc8 50%, var(--overlay-accent) 70%, #816036 100%)',
              }}
            />

            {/* Match & Map Context Ribbon with PMCC Diamond Nodes */}
            <div
              className="flex items-center justify-between"
              style={{
                height: ub(44),
                paddingInline: ub(28),
                backgroundColor: 'var(--overlay-header-bg)',
                borderBottom: `${ub(1)} solid rgba(129, 96, 54, 0.55)`,
              }}
            >
              <div className="flex items-center" style={{ gap: ub(10) }}>
                <span style={{ fontSize: ub(12), color: 'var(--overlay-accent)' }} aria-hidden>
                  ◇
                </span>
                <span
                  className="font-extrabold uppercase"
                  style={{
                    fontSize: ub(12),
                    letterSpacing: ub(2.4),
                    color: 'var(--overlay-accent)',
                  }}
                >
                  CHAMPIONSHIP VICTORY
                </span>
              </div>

              <div className="flex items-center tabular-nums" style={{ gap: ub(10) }}>
                <span
                  className="font-extrabold uppercase"
                  style={{
                    fontSize: ub(13),
                    letterSpacing: ub(1.6),
                    color: 'var(--overlay-text)',
                  }}
                >
                  MATCH {matchInfo.matchNumber}
                </span>
                {matchInfo.mapName.trim() && (
                  <>
                    <span style={{ color: 'rgba(129, 96, 54, 0.9)', fontSize: ub(11) }}>◇</span>
                    <span
                      className="font-bold uppercase"
                      style={{
                        fontSize: ub(13),
                        letterSpacing: ub(1.6),
                        color: 'var(--overlay-accent)',
                      }}
                    >
                      {matchInfo.mapName.trim()}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Hero Headline Banner: WINNER WINNER CHICKEN DINNER */}
            <div
              className="flex flex-col items-center justify-center text-center"
              style={{
                paddingBlock: ub(20),
                paddingInline: ub(32),
                background:
                  'radial-gradient(ellipse at 50% 0%, rgba(229, 169, 60, 0.22) 0%, rgba(38, 24, 15, 0.65) 70%, transparent 100%)',
                borderBottom: `${ub(1)} solid rgba(129, 96, 54, 0.55)`,
              }}
            >
              <motion.h1
                initial={{ opacity: 0, letterSpacing: ub(6) }}
                animate={{ opacity: 1, letterSpacing: ub(3.2) }}
                transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                className="font-black uppercase"
                style={{
                  fontSize: ub(40),
                  lineHeight: 1.05,
                  color: 'var(--overlay-text)',
                  textShadow: `0 ${ub(3)} ${ub(14)} rgba(0, 0, 0, 0.65)`,
                }}
              >
                WINNER WINNER CHICKEN DINNER
              </motion.h1>
            </div>

            {/* Main Winner Spotlight Body */}
            <div
              className="grid items-stretch"
              style={{
                gridTemplateColumns: '1fr auto',
                minHeight: ub(188),
              }}
            >
              {/* Left & Center: Collegiate Gold Pillar + Logo + Team Identity + Survivors */}
              <div
                className="flex items-center"
                style={{
                  paddingInline: ub(28),
                  paddingBlock: ub(24),
                  gap: ub(24),
                  minWidth: 0,
                }}
              >
                {/* Vertical PMCC Championship #1 Crest */}
                <div
                  className="flex shrink-0 flex-col items-center justify-center tabular-nums"
                  style={{
                    width: ub(76),
                    height: ub(124),
                    borderRadius: ub(3),
                    background:
                      'linear-gradient(180deg, #eeb058 0%, var(--overlay-accent) 55%, #816036 100%)',
                    color: '#160f0a',
                    boxShadow: `0 ${ub(6)} ${ub(18)} rgba(0, 0, 0, 0.45)`,
                  }}
                >
                  <span
                    className="font-extrabold uppercase"
                    style={{
                      fontSize: ub(10),
                      letterSpacing: ub(1.5),
                      opacity: 0.85,
                    }}
                  >
                    RANK
                  </span>
                  <span
                    className="font-black tabular-nums"
                    style={{
                      fontSize: ub(36),
                      lineHeight: 1.05,
                    }}
                  >
                    #1
                  </span>
                </div>

                {/* Winner Team Logo */}
                {showLogos && (
                  <div
                    className="flex shrink-0 items-center justify-center"
                    style={{
                      width: ub(124),
                      height: ub(124),
                      borderRadius: ub(4),
                      padding: ub(10),
                      backgroundColor: 'rgba(38, 24, 15, 0.78)',
                      border: `${ub(1)} solid rgba(229, 169, 60, 0.65)`,
                    }}
                  >
                    {winner.logoUrl ? (
                      <img
                        src={winner.logoUrl}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <span
                        className="font-black uppercase tabular-nums"
                        style={{
                          fontSize: ub(28),
                          color: 'var(--overlay-accent)',
                        }}
                      >
                        {formatTeamSlot(winner.teamNo)}
                      </span>
                    )}
                  </div>
                )}

                {/* Team Slot, Team Name & Squad Survivor Strip */}
                <div
                  className="flex min-w-0 flex-1 flex-col justify-center"
                  style={{ gap: ub(10) }}
                >
                  <div className="flex items-center" style={{ gap: ub(10) }}>
                    {showTeamNumbers && (
                      <span
                        data-testid="wwcd-team-slot"
                        className="shrink-0 font-extrabold uppercase tabular-nums"
                        style={{
                          fontSize: ub(12),
                          lineHeight: 1,
                          paddingInline: ub(8),
                          paddingBlock: ub(4),
                          borderRadius: ub(2),
                          backgroundColor: 'rgba(61, 54, 43, 0.9)',
                          border: `${ub(1)} solid rgba(229, 169, 60, 0.65)`,
                          color: 'var(--overlay-accent)',
                          letterSpacing: ub(1),
                        }}
                      >
                        SLOT {formatTeamSlot(winner.teamNo)}
                      </span>
                    )}
                    <span
                      className="font-bold uppercase"
                      style={{
                        fontSize: ub(12),
                        letterSpacing: ub(1.6),
                        color: 'var(--overlay-text-muted)',
                      }}
                    >
                      MATCH CHAMPION
                    </span>
                  </div>

                  <div
                    data-testid="wwcd-team-name"
                    className="truncate font-black uppercase tracking-wide"
                    style={{
                      fontSize: ub(38),
                      lineHeight: 1.08,
                      color: 'var(--overlay-text)',
                    }}
                  >
                    {winner.name}
                  </div>

                  {/* Squad Roster / Surviving Status Strip */}
                  {hasRealPlayerNames ? (
                    <div
                      data-testid="wwcd-player-list"
                      className="grid"
                      style={{
                        gridTemplateColumns: `repeat(${Math.min(4, winner.players.length)}, minmax(0, 1fr))`,
                        columnGap: ub(8),
                        marginTop: ub(4),
                      }}
                    >
                      {winner.players.slice(0, 4).map((player, idx) => {
                        const isAlive = player.liveState !== 'dead';
                        return (
                          <div
                            key={`${player.name}-${idx}`}
                            className="flex items-center justify-between overflow-hidden"
                            style={{
                              paddingInline: ub(10),
                              paddingBlock: ub(6),
                              borderRadius: ub(2),
                              backgroundColor: isAlive
                                ? 'rgba(38, 24, 15, 0.9)'
                                : 'rgba(61, 54, 43, 0.45)',
                              border: isAlive
                                ? `${ub(1)} solid rgba(229, 169, 60, 0.55)`
                                : `${ub(1)} solid rgba(129, 96, 54, 0.3)`,
                              opacity: isAlive ? 1 : 0.62,
                            }}
                          >
                            <div className="flex min-w-0 items-center" style={{ gap: ub(6) }}>
                              <span
                                style={{
                                  width: ub(6),
                                  height: ub(6),
                                  borderRadius: '50%',
                                  backgroundColor: isAlive
                                    ? 'var(--overlay-accent)'
                                    : 'var(--player-dead)',
                                }}
                              />
                              <span
                                className="truncate font-bold"
                                style={{
                                  fontSize: ub(12),
                                  color: 'var(--overlay-text)',
                                }}
                              >
                                {player.name}
                              </span>
                            </div>
                            <span
                              className="shrink-0 font-extrabold tabular-nums"
                              style={{
                                fontSize: ub(11),
                                color: 'var(--overlay-accent)',
                                marginLeft: ub(6),
                              }}
                            >
                              {player.kills}K
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      data-testid="wwcd-survivor-bars"
                      className="flex items-center"
                      style={{ gap: ub(12), marginTop: ub(4) }}
                    >
                      {winner.players.length > 0 && <AlivePlayerBars players={winner.players} />}
                      <span
                        className="font-bold uppercase tabular-nums"
                        style={{
                          fontSize: ub(12),
                          letterSpacing: ub(1.2),
                          color: 'var(--overlay-text-muted)',
                        }}
                      >
                        SURVIVING SQUAD: {winner.aliveCount} / 4 ALIVE
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Tabular Match Stat Callout Columns */}
              <div
                className="grid items-stretch tabular-nums"
                style={{
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  minWidth: ub(372),
                  backgroundColor: 'var(--overlay-header-bg)',
                  borderLeft: `${ub(1)} solid rgba(129, 96, 54, 0.55)`,
                }}
              >
                {/* Match Eliminations */}
                <div
                  className="flex flex-col items-center justify-center"
                  style={{
                    paddingInline: ub(18),
                    borderRight: `${ub(1)} solid rgba(129, 96, 54, 0.35)`,
                  }}
                >
                  <span
                    className="font-bold uppercase"
                    style={{
                      fontSize: ub(10.5),
                      letterSpacing: ub(1.3),
                      color: 'var(--overlay-text-muted)',
                    }}
                  >
                    MATCH ELIMS
                  </span>
                  <span
                    data-testid="wwcd-match-elims"
                    className="font-black tabular-nums"
                    style={{
                      fontSize: ub(34),
                      lineHeight: 1.15,
                      color: 'var(--overlay-text)',
                      marginTop: ub(4),
                    }}
                  >
                    {winner.eliminations}
                  </span>
                </div>

                {/* Single-Match Points */}
                <div
                  className="flex flex-col items-center justify-center"
                  style={{
                    paddingInline: ub(18),
                    borderRight: `${ub(1)} solid rgba(129, 96, 54, 0.35)`,
                  }}
                >
                  <span
                    className="font-bold uppercase"
                    style={{
                      fontSize: ub(10.5),
                      letterSpacing: ub(1.3),
                      color: 'var(--overlay-text-muted)',
                    }}
                  >
                    MATCH PTS
                  </span>
                  <span
                    data-testid="wwcd-match-pts"
                    className="font-black tabular-nums"
                    style={{
                      fontSize: ub(34),
                      lineHeight: 1.15,
                      color: 'var(--overlay-accent)',
                      marginTop: ub(4),
                    }}
                  >
                    +{winner.matchPoints}
                  </span>
                </div>

                {/* Accumulated Series Points */}
                <div
                  className="flex flex-col items-center justify-center"
                  style={{
                    paddingInline: ub(18),
                  }}
                >
                  <span
                    className="font-bold uppercase"
                    style={{
                      fontSize: ub(10.5),
                      letterSpacing: ub(1.3),
                      color: 'var(--overlay-text-muted)',
                    }}
                  >
                    SERIES PTS
                  </span>
                  <span
                    data-testid="wwcd-series-pts"
                    className="font-black tabular-nums"
                    style={{
                      fontSize: ub(34),
                      lineHeight: 1.15,
                      color: 'var(--overlay-text)',
                      marginTop: ub(4),
                    }}
                  >
                    {winner.seriesPoints}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
