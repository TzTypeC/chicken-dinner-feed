import {
  DEFAULT_POST_GAME_BACKGROUND,
  type IngestSourceKind,
  type LiveMatchInfo,
  type OverlayAppearance,
} from '@cdf/shared';
import { AnimatePresence, motion } from 'motion/react';
import { appearanceToCssVariables } from './appearance';
import type { WwcdWinnerSummary } from './broadcast-state';
import { formatTeamSlot, ub } from './overlay-scale';

export interface FullscreenWwcdOverlayProps {
  winner: WwcdWinnerSummary | null;
  matchInfo: LiveMatchInfo;
  appearance: OverlayAppearance;
  totalTeams?: number;
  source?: IngestSourceKind;
  visible?: boolean;
}

/**
 * Fullscreen Winner Winner Chicken Dinner (WWCD) Victory Celebration (`wwcd-fullscreen`).
 *
 * Adapted from the local fork (`T:\codebook\guthib\pmcc2026\chicken-dinner-feed`, commit `88b6ad3`)
 * and integrated with:
 * - Authoritative `selectWwcdWinner` (`WwcdWinnerSummary`) + `LiveMatchInfo` data contracts.
 * - PMCC 2026 visual identity tokens (`appearanceToCssVariables`) and `ub()` resolution scaling.
 * - Optional 3D stage background (`showFullscreenStageBg` or custom `postGameBackground`), allowing
 *   either an opaque fullscreen celebration scene or a transparent OBS composite over live game video.
 * - Independently toggleable 5-character squad lineup (`showFullscreenCharacters`) and scrolling
 *   championship marquee ribbon (`showFullscreenMarquee`).
 */
export function FullscreenWwcdOverlay({
  winner,
  matchInfo,
  appearance,
  totalTeams = 25,
  visible = true,
}: FullscreenWwcdOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const showFullscreenCharacters = appearance.showFullscreenCharacters ?? true;
  const showFullscreenMarquee = appearance.showFullscreenMarquee ?? true;
  const showFullscreenStageBg = appearance.showFullscreenStageBg ?? true;

  const customBg = appearance.postGameBackground ?? DEFAULT_POST_GAME_BACKGROUND;
  const hasCustomMedia =
    customBg.mode !== 'disabled' && Boolean(customBg.mediaUrl) && customBg.opacity > 0;
  const blurScale = customBg.blur > 0 ? 1 + customBg.blur * 0.008 : 1;

  const displayMapName = matchInfo.mapName.trim();

  return (
    <div
      style={{
        ...appearanceToCssVariables(appearance),
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: ub(1920),
        height: ub(1080),
        transform: 'translate(-50%, -50%)',
        zIndex: 25,
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: 'var(--overlay-font-family)',
        color: 'var(--overlay-text)',
      }}
    >
      <style>{`
        @keyframes cdfWwcdMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .cdf-wwcd-marquee {
          display: flex;
          width: max-content;
          animation: cdfWwcdMarquee 25s linear infinite;
        }
        @keyframes cdfPulseGlow {
          0%, 100% { filter: drop-shadow(0 0 15px rgba(229, 169, 60, 0.6)) drop-shadow(0 0 35px rgba(229, 169, 60, 0.38)); }
          50% { filter: drop-shadow(0 0 28px rgba(238, 176, 88, 0.9)) drop-shadow(0 0 56px rgba(229, 169, 60, 0.68)); }
        }
        .cdf-pulse-glow {
          animation: cdfPulseGlow 3s ease-in-out infinite;
        }
      `}</style>

      <AnimatePresence mode="wait">
        {visible && winner && (
          <motion.div
            key={`wwcd-fullscreen-${winner.teamNo}-${matchInfo.matchNumber}`}
            data-testid="wwcd-fullscreen-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
            }}
          >
            {/* OPTIONAL STAGE BACKGROUND LAYER */}
            {(showFullscreenStageBg || hasCustomMedia) && (
              <div
                data-testid="wwcd-fullscreen-stage-bg"
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 0,
                  overflow: 'hidden',
                  backgroundColor: '#0c0805',
                }}
              >
                {hasCustomMedia && customBg.mediaUrl ? (
                  customBg.mode === 'video' ? (
                    <video
                      src={customBg.mediaUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: customBg.opacity / 100,
                        filter: customBg.blur > 0 ? `blur(${ub(customBg.blur)})` : undefined,
                        transform: blurScale > 1 ? `scale(${blurScale})` : undefined,
                      }}
                    />
                  ) : (
                    <img
                      src={customBg.mediaUrl}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: customBg.opacity / 100,
                        filter: customBg.blur > 0 ? `blur(${ub(customBg.blur)})` : undefined,
                        transform: blurScale > 1 ? `scale(${blurScale})` : undefined,
                      }}
                    />
                  )
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: "url('/images/postgame-bg.png')",
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }}
                  />
                )}

                {/* Warm PMCC Volumetric Lighting & Vignette */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(0deg, rgba(12, 8, 5, 0.94) 0%, rgba(22, 15, 10, 0.42) 50%, rgba(12, 8, 5, 0.82) 100%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'radial-gradient(circle at 50% 55%, rgba(229, 169, 60, 0.16) 0%, rgba(22, 15, 10, 0.52) 45%, rgba(12, 8, 5, 0.88) 80%, rgba(8, 5, 3, 0.96) 100%)',
                  }}
                />
              </div>
            )}

            {/* Subtle Golden Stage Spotlight Beam */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '28%',
                left: '50%',
                width: ub(860),
                height: ub(860),
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                opacity: 0.28,
                filter: `blur(${ub(52)})`,
                background:
                  'radial-gradient(circle, rgba(238, 176, 88, 0.62) 0%, rgba(229, 169, 60, 0.2) 50%, transparent 72%)',
                zIndex: 1,
              }}
            />

            {/* FOREGROUND STAGE CONTENT */}
            <div
              className="relative flex flex-col justify-between"
              style={{
                zIndex: 10,
                width: '100%',
                height: '100%',
                paddingInline: ub(48),
                paddingBlock: ub(32),
              }}
            >
              {/* TOP CHAMPIONSHIP HEADER BAR */}
              <motion.header
                initial={{ y: -36, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center justify-between"
                style={{
                  paddingInline: ub(26),
                  paddingBlock: ub(14),
                  borderRadius: ub(4),
                  backgroundColor: 'var(--overlay-header-bg)',
                  border: `${ub(1)} solid rgba(229, 169, 60, 0.55)`,
                  boxShadow: `0 ${ub(8)} ${ub(30)} rgba(0, 0, 0, 0.78)`,
                }}
              >
                {/* Left Brand Crest */}
                <div className="flex items-center" style={{ gap: ub(16) }}>
                  <div
                    className="flex items-center justify-center font-black"
                    style={{
                      width: ub(46),
                      height: ub(46),
                      borderRadius: ub(3),
                      background:
                        'linear-gradient(135deg, #eeb058 0%, var(--overlay-accent) 55%, #816036 100%)',
                      color: '#160f0a',
                      border: `${ub(1)} solid rgba(255, 239, 200, 0.45)`,
                    }}
                  >
                    <span style={{ fontSize: ub(20) }} aria-hidden>
                      ◇
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center" style={{ gap: ub(10) }}>
                      <span
                        className="font-black uppercase"
                        style={{
                          fontSize: ub(10.5),
                          letterSpacing: ub(1.8),
                          paddingInline: ub(8),
                          paddingBlock: ub(2),
                          borderRadius: ub(2),
                          backgroundColor: 'rgba(229, 169, 60, 0.16)',
                          border: `${ub(1)} solid rgba(229, 169, 60, 0.42)`,
                          color: 'var(--overlay-accent)',
                        }}
                      >
                        PMCC CHAMPIONSHIP BROADCAST
                      </span>
                      <span
                        className="font-bold uppercase"
                        style={{
                          fontSize: ub(10.5),
                          letterSpacing: ub(1.4),
                          color: 'var(--overlay-text-muted)',
                        }}
                      >
                        OFFICIAL VICTORY CEREMONY
                      </span>
                    </div>
                    <div
                      className="font-black uppercase"
                      style={{
                        fontSize: ub(24),
                        letterSpacing: ub(2),
                        color: 'var(--overlay-text)',
                        marginTop: ub(2),
                      }}
                    >
                      WINNER WINNER CHICKEN DINNER
                    </div>
                  </div>
                </div>

                {/* Center Match Context Pill */}
                <div
                  className="flex items-center tabular-nums"
                  style={{
                    gap: ub(12),
                    paddingInline: ub(20),
                    paddingBlock: ub(8),
                    borderRadius: ub(999),
                    backgroundColor: 'var(--overlay-bg)',
                    border: `${ub(1)} solid rgba(129, 96, 54, 0.72)`,
                  }}
                >
                  <span
                    className="font-black uppercase"
                    style={{
                      fontSize: ub(13),
                      letterSpacing: ub(1.4),
                      color: 'var(--overlay-accent)',
                    }}
                  >
                    MATCH {matchInfo.matchNumber}
                  </span>
                  {displayMapName && (
                    <>
                      <span style={{ color: 'rgba(229, 169, 60, 0.5)', fontSize: ub(11) }}>◇</span>
                      <span
                        className="font-extrabold uppercase"
                        style={{
                          fontSize: ub(13),
                          letterSpacing: ub(1.4),
                          color: 'var(--overlay-text)',
                        }}
                      >
                        {displayMapName}
                      </span>
                    </>
                  )}
                  <span style={{ color: 'rgba(229, 169, 60, 0.5)', fontSize: ub(11) }}>◇</span>
                  <span
                    className="font-bold uppercase"
                    style={{
                      fontSize: ub(12.5),
                      letterSpacing: ub(1.2),
                      color: 'var(--overlay-text-muted)',
                    }}
                  >
                    {totalTeams} SQUADS
                  </span>
                </div>

                {/* Right WWCD Pan Emblem Pill */}
                <div
                  className="flex items-center"
                  style={{
                    gap: ub(10),
                    paddingInline: ub(16),
                    paddingBlock: ub(8),
                    borderRadius: ub(3),
                    background:
                      'linear-gradient(90deg, rgba(229, 169, 60, 0.22) 0%, rgba(38, 24, 15, 0.7) 100%)',
                    border: `${ub(1)} solid rgba(229, 169, 60, 0.55)`,
                  }}
                >
                  <img
                    src="/images/chicken-dinner-badge.png"
                    alt=""
                    style={{
                      width: ub(24),
                      height: ub(24),
                      objectFit: 'contain',
                    }}
                  />
                  <span
                    className="font-black uppercase"
                    style={{
                      fontSize: ub(12.5),
                      letterSpacing: ub(1.5),
                      color: 'var(--overlay-accent)',
                    }}
                  >
                    #1 MATCH CHAMPION
                  </span>
                </div>
              </motion.header>

              {/* CENTER STAGE: GRAND PAN CREST, HEADLINE & 5-CHARACTER SQUAD LINEUP */}
              <div
                className="relative flex flex-1 flex-col items-center justify-end"
                style={{ minHeight: 0 }}
              >
                {/* Floating Grand Pan Emblem & Hero Typography */}
                <div
                  style={{
                    position: 'absolute',
                    top: showFullscreenCharacters ? ub(8) : '22%',
                    left: 0,
                    right: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    zIndex: 20,
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.86, opacity: 0, y: -18 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col items-center text-center"
                  >
                    <div style={{ position: 'relative', marginBottom: ub(6) }}>
                      <img
                        src="/images/chicken-dinner-badge.png"
                        alt=""
                        className="cdf-pulse-glow"
                        style={{
                          width: ub(136),
                          height: ub(136),
                          objectFit: 'contain',
                        }}
                      />
                    </div>
                    <div
                      className="font-black uppercase"
                      style={{
                        fontSize: ub(20),
                        letterSpacing: ub(7),
                        marginRight: `-${ub(7)}`,
                        color: 'var(--overlay-accent)',
                        textShadow: `0 ${ub(2)} ${ub(8)} rgba(0, 0, 0, 0.9)`,
                      }}
                    >
                      WINNER WINNER
                    </div>
                    <div
                      className="font-black uppercase"
                      style={{
                        fontSize: ub(68),
                        lineHeight: 1.02,
                        letterSpacing: ub(3),
                        marginRight: `-${ub(3)}`,
                        color: 'var(--overlay-text)',
                        textShadow: `0 ${ub(6)} ${ub(26)} rgba(0, 0, 0, 0.88), 0 0 ${ub(24)} rgba(229, 169, 60, 0.45)`,
                      }}
                    >
                      CHICKEN DINNER
                    </div>
                  </motion.div>
                </div>

                {/* 5-Character Squad Stage Lineup */}
                {showFullscreenCharacters && (
                  <div
                    data-testid="wwcd-fullscreen-characters"
                    className="relative flex items-end justify-center"
                    style={{
                      width: ub(1280),
                      height: ub(520),
                      zIndex: 10,
                    }}
                  >
                    {/* Left Wing: char1 */}
                    <motion.div
                      initial={{ x: -80, opacity: 0 }}
                      animate={{ x: 0, opacity: 0.95 }}
                      transition={{ duration: 0.72, delay: 0.25 }}
                      style={{
                        position: 'absolute',
                        left: '11%',
                        bottom: 0,
                        height: '82%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        filter: `drop-shadow(0 ${ub(14)} ${ub(28)} rgba(0,0,0,0.9))`,
                      }}
                    >
                      <img
                        src="/images/characters/char1.png"
                        alt=""
                        style={{ height: '100%', objectFit: 'contain' }}
                      />
                    </motion.div>

                    {/* Mid-Left: char4 */}
                    <motion.div
                      initial={{ x: -48, opacity: 0 }}
                      animate={{ x: 0, opacity: 0.96 }}
                      transition={{ duration: 0.72, delay: 0.34 }}
                      style={{
                        position: 'absolute',
                        left: '26%',
                        bottom: 0,
                        height: '89%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        filter: `drop-shadow(0 ${ub(14)} ${ub(28)} rgba(0,0,0,0.9))`,
                      }}
                    >
                      <img
                        src="/images/characters/char4.png"
                        alt=""
                        style={{ height: '100%', objectFit: 'contain' }}
                      />
                    </motion.div>

                    {/* Center Leader: char5 */}
                    <motion.div
                      initial={{ y: 64, opacity: 0, scale: 0.96 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      transition={{ duration: 0.8, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        position: 'relative',
                        zIndex: 10,
                        bottom: 0,
                        height: '98%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        filter: `drop-shadow(0 ${ub(18)} ${ub(40)} rgba(0,0,0,0.95))`,
                      }}
                    >
                      <img
                        src="/images/characters/char5.png"
                        alt=""
                        style={{
                          height: '100%',
                          objectFit: 'contain',
                          // Optical centering compensation: char5.png has 110px excess left margin (123px left pad vs 13px right pad),
                          // so shifting it ~2.5% left perfectly balances the helmet & body axis with the crest and title.
                          transform: 'translateX(-2.5%)',
                        }}
                      />
                    </motion.div>

                    {/* Mid-Right: char3 */}
                    <motion.div
                      initial={{ x: 48, opacity: 0 }}
                      animate={{ x: 0, opacity: 0.96 }}
                      transition={{ duration: 0.72, delay: 0.34 }}
                      style={{
                        position: 'absolute',
                        right: '26%',
                        bottom: 0,
                        height: '89%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        filter: `drop-shadow(0 ${ub(14)} ${ub(28)} rgba(0,0,0,0.9))`,
                      }}
                    >
                      <img
                        src="/images/characters/char3.png"
                        alt=""
                        style={{ height: '100%', objectFit: 'contain' }}
                      />
                    </motion.div>

                    {/* Right Wing: char2 */}
                    <motion.div
                      initial={{ x: 80, opacity: 0 }}
                      animate={{ x: 0, opacity: 0.95 }}
                      transition={{ duration: 0.72, delay: 0.25 }}
                      style={{
                        position: 'absolute',
                        right: '11%',
                        bottom: 0,
                        height: '82%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        filter: `drop-shadow(0 ${ub(14)} ${ub(28)} rgba(0,0,0,0.9))`,
                      }}
                    >
                      <img
                        src="/images/characters/char2.png"
                        alt=""
                        style={{ height: '100%', objectFit: 'contain' }}
                      />
                    </motion.div>
                  </div>
                )}
              </div>

              {/* BOTTOM SECTION: CHAMPIONSHIP MARQUEE RIBBON & 4-COLUMN STATS PANEL */}
              <div
                className="relative flex flex-col"
                style={{
                  zIndex: 20,
                  gap: ub(14),
                }}
              >
                {/* Scrolling Championship Marquee Ticker */}
                {showFullscreenMarquee && (
                  <motion.div
                    data-testid="wwcd-fullscreen-marquee"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.55, delay: 0.38 }}
                    className="w-full overflow-hidden"
                    style={{
                      paddingBlock: ub(7),
                      background:
                        'linear-gradient(90deg, var(--overlay-bg) 0%, var(--overlay-header-bg) 50%, var(--overlay-bg) 100%)',
                      borderTop: `${ub(1)} solid var(--overlay-accent)`,
                      borderBottom: `${ub(1)} solid var(--overlay-accent)`,
                      boxShadow: `0 ${ub(4)} ${ub(24)} rgba(0, 0, 0, 0.8)`,
                    }}
                  >
                    <div
                      className="cdf-wwcd-marquee font-black uppercase whitespace-nowrap"
                      style={{
                        fontSize: ub(13),
                        letterSpacing: ub(3.2),
                        color: 'var(--overlay-accent)',
                      }}
                    >
                      {Array.from({ length: 8 }).map((_, idx) => (
                        <span key={idx} className="flex items-center">
                          <span style={{ marginInline: ub(22) }}>
                            ◇ WINNER WINNER CHICKEN DINNER — {winner.name}
                          </span>
                          <span style={{ marginInline: ub(22), color: 'var(--overlay-text)' }}>
                            •
                          </span>
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* 4-Column Stats Panel with PMCC Corner Brackets */}
                <motion.div
                  initial={{ y: 36, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.55, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="grid tabular-nums"
                  style={{
                    gridTemplateColumns: '1.3fr 1fr 1fr 1fr',
                    columnGap: ub(16),
                  }}
                >
                  {/* BOX 1: CHAMPION TEAM LOGO, SLOT & NAME */}
                  <FullscreenStatCard>
                    <div className="flex items-center" style={{ gap: ub(16), minWidth: 0 }}>
                      {showLogos && (
                        <div
                          className="flex shrink-0 items-center justify-center"
                          style={{
                            width: ub(72),
                            height: ub(72),
                            padding: ub(8),
                            borderRadius: ub(4),
                            backgroundColor: 'rgba(38, 24, 15, 0.9)',
                            border: `${ub(1)} solid rgba(229, 169, 60, 0.65)`,
                          }}
                        >
                          {winner.logoUrl ? (
                            <img
                              src={winner.logoUrl}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <img
                              src="/images/chicken-dinner-badge.png"
                              alt=""
                              style={{ width: ub(48), height: ub(48), objectFit: 'contain' }}
                            />
                          )}
                        </div>
                      )}

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div
                          className="flex items-center"
                          style={{ gap: ub(8), marginBottom: ub(4) }}
                        >
                          {showTeamNumbers && (
                            <span
                              data-testid="wwcd-fullscreen-team-slot"
                              className="font-black uppercase tabular-nums"
                              style={{
                                fontSize: ub(10.5),
                                paddingInline: ub(8),
                                paddingBlock: ub(2.5),
                                borderRadius: ub(2),
                                backgroundColor: 'rgba(229, 169, 60, 0.16)',
                                border: `${ub(1)} solid rgba(229, 169, 60, 0.55)`,
                                color: 'var(--overlay-accent)',
                                letterSpacing: ub(1.2),
                              }}
                            >
                              SLOT {formatTeamSlot(winner.teamNo)}
                            </span>
                          )}
                          <span
                            className="font-bold uppercase"
                            style={{
                              fontSize: ub(10.5),
                              letterSpacing: ub(1.4),
                              color: 'var(--overlay-text-muted)',
                            }}
                          >
                            CHAMPION SQUAD
                          </span>
                        </div>
                        <div
                          data-testid="wwcd-fullscreen-team-name"
                          className="truncate font-black uppercase tracking-wider"
                          style={{
                            fontSize: ub(28),
                            lineHeight: 1.12,
                            color: 'var(--overlay-text)',
                          }}
                        >
                          {winner.name}
                        </div>
                        <span
                          className="font-bold uppercase"
                          style={{
                            fontSize: ub(11),
                            letterSpacing: ub(1.2),
                            color: 'var(--overlay-accent)',
                            marginTop: ub(2),
                          }}
                        >
                          SURVIVING SQUAD: {winner.aliveCount} / 4 ALIVE
                        </span>
                      </div>
                    </div>
                  </FullscreenStatCard>

                  {/* BOX 2: MATCH PLACEMENT */}
                  <FullscreenStatCard>
                    <span
                      className="font-black uppercase"
                      style={{
                        fontSize: ub(11.5),
                        letterSpacing: ub(1.6),
                        color: 'var(--overlay-accent)',
                      }}
                    >
                      MATCH PLACEMENT
                    </span>
                    <div className="flex items-baseline" style={{ gap: ub(8), marginBlock: ub(4) }}>
                      <span
                        className="font-black tabular-nums"
                        style={{
                          fontSize: ub(44),
                          lineHeight: 1,
                          color: 'var(--overlay-accent)',
                        }}
                      >
                        #1
                      </span>
                      <span
                        className="font-bold uppercase"
                        style={{
                          fontSize: ub(13),
                          letterSpacing: ub(1.2),
                          color: 'var(--overlay-text-muted)',
                        }}
                      >
                        / {totalTeams} TEAMS
                      </span>
                    </div>
                    <span
                      className="font-semibold uppercase"
                      style={{
                        fontSize: ub(11),
                        letterSpacing: ub(1.2),
                        color: 'var(--overlay-text-muted)',
                      }}
                    >
                      +{winner.placementPoints} PLACEMENT PTS
                    </span>
                  </FullscreenStatCard>

                  {/* BOX 3: MATCH ELIMINATIONS */}
                  <FullscreenStatCard>
                    <span
                      className="font-black uppercase"
                      style={{
                        fontSize: ub(11.5),
                        letterSpacing: ub(1.6),
                        color: 'var(--overlay-accent)',
                      }}
                    >
                      MATCH ELIMINATIONS
                    </span>
                    <div className="flex items-baseline" style={{ gap: ub(8), marginBlock: ub(4) }}>
                      <span
                        data-testid="wwcd-fullscreen-match-elims"
                        className="font-black tabular-nums"
                        style={{
                          fontSize: ub(44),
                          lineHeight: 1,
                          color: 'var(--overlay-text)',
                        }}
                      >
                        {winner.eliminations}
                      </span>
                      <span
                        className="font-bold uppercase"
                        style={{
                          fontSize: ub(13),
                          letterSpacing: ub(1.2),
                          color: 'var(--overlay-text-muted)',
                        }}
                      >
                        ELIMS
                      </span>
                    </div>
                    <span
                      className="font-semibold uppercase"
                      style={{
                        fontSize: ub(11),
                        letterSpacing: ub(1.2),
                        color: 'var(--overlay-text-muted)',
                      }}
                    >
                      +{winner.killPoints} ELIMINATION PTS
                    </span>
                  </FullscreenStatCard>

                  {/* BOX 4: MATCH POINTS & SERIES TOTAL */}
                  <FullscreenStatCard>
                    <span
                      className="font-black uppercase"
                      style={{
                        fontSize: ub(11.5),
                        letterSpacing: ub(1.6),
                        color: 'var(--overlay-accent)',
                      }}
                    >
                      MATCH TOTAL POINTS
                    </span>
                    <div className="flex items-baseline" style={{ gap: ub(8), marginBlock: ub(4) }}>
                      <span
                        data-testid="wwcd-fullscreen-match-pts"
                        className="font-black tabular-nums"
                        style={{
                          fontSize: ub(44),
                          lineHeight: 1,
                          color: 'var(--overlay-accent)',
                        }}
                      >
                        +{winner.matchPoints}
                      </span>
                      <span
                        className="font-bold uppercase"
                        style={{
                          fontSize: ub(13),
                          letterSpacing: ub(1.2),
                          color: 'var(--overlay-text-muted)',
                        }}
                      >
                        MATCH PTS
                      </span>
                    </div>
                    <span
                      data-testid="wwcd-fullscreen-series-pts"
                      className="font-semibold uppercase"
                      style={{
                        fontSize: ub(11),
                        letterSpacing: ub(1.2),
                        color: 'var(--overlay-text-muted)',
                      }}
                    >
                      SERIES TOTAL: {winner.seriesPoints} PTS
                    </span>
                  </FullscreenStatCard>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FullscreenStatCard({ children }: { children: React.ReactNode }) {
  const bracketStyle = {
    position: 'absolute' as const,
    width: ub(10),
    height: ub(10),
    borderColor: 'var(--overlay-accent)',
  };

  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden"
      style={{
        paddingInline: ub(20),
        paddingBlock: ub(16),
        borderRadius: ub(4),
        backgroundColor: 'var(--overlay-bg)',
        border: `${ub(1)} solid rgba(229, 169, 60, 0.48)`,
        boxShadow: `0 ${ub(10)} ${ub(32)} rgba(0, 0, 0, 0.72)`,
      }}
    >
      <div
        style={{
          ...bracketStyle,
          top: ub(4),
          left: ub(4),
          borderTop: `${ub(2)} solid var(--overlay-accent)`,
          borderLeft: `${ub(2)} solid var(--overlay-accent)`,
        }}
      />
      <div
        style={{
          ...bracketStyle,
          top: ub(4),
          right: ub(4),
          borderTop: `${ub(2)} solid var(--overlay-accent)`,
          borderRight: `${ub(2)} solid var(--overlay-accent)`,
        }}
      />
      <div
        style={{
          ...bracketStyle,
          bottom: ub(4),
          left: ub(4),
          borderBottom: `${ub(2)} solid var(--overlay-accent)`,
          borderLeft: `${ub(2)} solid var(--overlay-accent)`,
        }}
      />
      <div
        style={{
          ...bracketStyle,
          bottom: ub(4),
          right: ub(4),
          borderBottom: `${ub(2)} solid var(--overlay-accent)`,
          borderRight: `${ub(2)} solid var(--overlay-accent)`,
        }}
      />
      {children}
    </div>
  );
}
