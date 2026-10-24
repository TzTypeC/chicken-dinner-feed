import type { OverlayAppearance } from '@cdf/shared';
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { appearanceToCssVariables } from './appearance';
import type { NextMapBoard, NextMapCard } from './next-map';
import { OverflowMarquee } from './OverflowMarquee';
import { formatTeamSlot, ub } from './overlay-scale';

export interface NextMapOverlayProps {
  board: NextMapBoard;
  appearance: OverlayAppearance;
}

const TABULAR: CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const GOLD = 'var(--overlay-accent, #F5A623)';
const DARK_BG = 'rgba(14, 10, 6, 0.92)';
const CARD_BORDER = '1px solid rgba(245, 166, 35, 0.65)';

interface CardGeometry {
  matchNumber: number;
  thumbLeft: number;
  thumbTop: number;
  thumbWidth: number;
  thumbHeight: number;
}

const GEOMETRIES: CardGeometry[] = [
  { matchNumber: 1, thumbLeft: 137, thumbTop: 383, thumbWidth: 346, thumbHeight: 368 },
  { matchNumber: 2, thumbLeft: 571, thumbTop: 383, thumbWidth: 346, thumbHeight: 368 },
  { matchNumber: 3, thumbLeft: 1005, thumbTop: 383, thumbWidth: 346, thumbHeight: 368 },
  { matchNumber: 4, thumbLeft: 1439, thumbTop: 383, thumbWidth: 346, thumbHeight: 368 },
];

function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '—';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

function UpcomingCardOverlay({ card, geo }: { card: NextMapCard; geo: CardGeometry }) {
  return (
    <div
      data-testid={`next-map-card-${card.matchNumber}`}
      data-state="upcoming"
      style={{
        position: 'absolute',
        left: ub(geo.thumbLeft),
        top: ub(geo.thumbTop),
        width: ub(geo.thumbWidth),
        height: ub(geo.thumbHeight),
        maxHeight: ub(geo.thumbHeight),
        overflow: 'hidden',
        borderRadius: ub(4),
        pointerEvents: 'none',
      }}
    >
      {/* 1. Strobe overlay: periodic dark pulse (100% -> 25% -> 100% light) */}
      <div
        className="next-map-strobe-layer"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#000000',
          animation: 'next-map-strobe 1.35s ease-in-out infinite',
          zIndex: 1,
        }}
      />

      {/* 2. Golden pulsing neon inner-glow border (inset only, no bleed outside frame) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 24px rgba(255, 174, 0, 0.85)',
          animation: 'next-map-neon-pulse 1.35s ease-in-out infinite',
          zIndex: 2,
        }}
      />
      {/* 3. Cyber scanline sweep moving vertically */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: ub(16),
          background:
            'linear-gradient(180deg, rgba(255, 200, 50, 0) 0%, rgba(255, 215, 60, 0.85) 50%, rgba(255, 200, 50, 0) 100%)',
          animation: 'next-map-scanline 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
          zIndex: 3,
        }}
      />

      {/* 4. Top status indicator */}
      <div
        style={{
          position: 'absolute',
          top: ub(10),
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 4,
          background: 'rgba(0, 0, 0, 0.75)',
          border: `${ub(1)} solid rgba(245, 166, 35, 0.5)`,
          padding: `${ub(3)} ${ub(10)}`,
          borderRadius: ub(2),
          whiteSpace: 'nowrap',
        }}
      >
        <span
          className="font-extrabold uppercase"
          style={{ fontSize: ub(10), color: GOLD, letterSpacing: '0.1em' }}
        >
          LIVE TARGET
        </span>
      </div>
      {/* 5. Bottom dynamic UPCOMING MATCH badge with blinking radar dot */}
      <div
        style={{
          position: 'absolute',
          bottom: ub(16),
          left: ub(14),
          right: ub(14),
          zIndex: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: ub(4),
        }}
      >
        <div
          data-testid="next-map-upcoming-badge"
          className="flex items-center justify-center font-black uppercase tracking-wider"
          style={{
            background: GOLD,
            color: '#000000',
            height: ub(36),
            paddingInline: ub(12),
            fontSize: ub(13),
            borderRadius: ub(2),
            boxShadow: `0 ${ub(4)} ${ub(12)} rgba(0, 0, 0, 0.75)`,
            gap: ub(8),
          }}
        >
          <span
            className="rounded-full"
            style={{
              width: ub(8),
              height: ub(8),
              backgroundColor: '#ff2222',
              animation: 'next-map-radar-blink 1s ease-in-out infinite',
            }}
          />
          UPCOMING MATCH
        </div>

        <div
          className="flex items-center justify-center font-extrabold uppercase text-center"
          style={{
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(4px)',
            border: `${ub(1)} solid rgba(245, 166, 35, 0.4)`,
            padding: `${ub(4)} ${ub(8)}`,
            borderRadius: ub(2),
            gap: ub(5),
          }}
        >
          <span style={{ fontSize: ub(10), color: GOLD, letterSpacing: '0.08em' }}>
            BATTLEGROUND
          </span>
          <span style={{ fontSize: ub(10), color: '#FFFFFF', letterSpacing: '0.03em' }}>
            • {card.mapName}
          </span>
        </div>
      </div>
    </div>
  );
}

function CompletedCardOverlay({
  card,
  geo,
  showLogos,
  showTeamNumbers,
}: {
  card: NextMapCard;
  geo: CardGeometry;
  showLogos: boolean;
  showTeamNumbers: boolean;
}) {
  const winner = card.winner;
  if (!winner) return null;

  return (
    <motion.div
      data-testid={`next-map-card-${card.matchNumber}`}
      data-state="completed"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        left: ub(geo.thumbLeft),
        top: ub(geo.thumbTop),
        width: ub(geo.thumbWidth),
        height: ub(geo.thumbHeight),
        maxHeight: ub(geo.thumbHeight),
        overflow: 'hidden',
        borderRadius: ub(4),
        background: DARK_BG,
        backdropFilter: 'blur(8px)',
        border: CARD_BORDER,
        boxShadow: `0 ${ub(12)} ${ub(28)} rgba(0, 0, 0, 0.85)`,
        padding: `${ub(14)} ${ub(16)}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        textAlign: 'center',
        pointerEvents: 'none',
        ...TABULAR,
      }}
    >
      {/* Top WWCD Header with Golden Shimmer Sweep */}
      <div className="flex flex-col items-center" style={{ gap: ub(4) }}>
        <div
          style={{
            position: 'relative',
            width: ub(36),
            height: ub(36),
            overflow: 'hidden',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <img
            src="/images/chicken-dinner-badge.png"
            alt="WWCD"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          {/* Shimmer sweep */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background:
                'linear-gradient(90deg, rgba(255,240,180,0) 0%, rgba(255,240,180,0.6) 50%, rgba(255,240,180,0) 100%)',
              animation: 'next-map-wwcd-shimmer 3.2s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div
          data-testid={`next-map-wwcd-badge-${card.matchNumber}`}
          className="font-black uppercase tracking-wider"
          style={{ fontSize: ub(12.5), color: GOLD, lineHeight: 1.1 }}
        >
          WINNER WINNER
        </div>
        <div
          className="font-extrabold uppercase text-xs"
          style={{ fontSize: ub(9.5), color: 'var(--overlay-text-muted)', letterSpacing: '0.1em' }}
        >
          CHICKEN DINNER
        </div>
      </div>

      {/* Winner Team info: honors showLogos and showTeamNumbers */}
      <div
        className="flex flex-col items-center justify-center"
        style={{ gap: ub(8), width: '100%', minWidth: 0, flex: 1 }}
      >
        {showLogos && (
          <div
            data-testid={`next-map-team-logo-${card.matchNumber}`}
            style={{
              width: ub(54),
              height: ub(54),
              background: 'rgba(255, 255, 255, 0.06)',
              border: `${ub(1)} solid rgba(245, 166, 35, 0.4)`,
              borderRadius: ub(3),
              flexShrink: 0,
            }}
          >
            {winner.logoUrl ? (
              <img src={winner.logoUrl} alt="" className="size-full object-contain p-1" />
            ) : (
              <span className="font-extrabold uppercase text-sm" style={{ color: GOLD }}>
                {monogram(winner.name)}
              </span>
            )}
          </div>
        )}

        <div style={{ width: '100%', minWidth: 0 }}>
          <OverflowMarquee
            testId={`next-map-winner-name-${card.matchNumber}`}
            text={winner.name}
            fontSize={showLogos ? 18 : 22}
            fontSizeCss={showLogos ? ub(18) : ub(22)}
            color="#FFFFFF"
            className="font-black uppercase"
          />
        </div>

        {showTeamNumbers && winner.teamNo > 0 && (
          <span
            data-testid={`next-map-slot-badge-${card.matchNumber}`}
            className="font-extrabold"
            style={{
              fontSize: ub(11),
              padding: `${ub(2)} ${ub(7)}`,
              borderRadius: ub(2),
              background: 'rgba(245, 166, 35, 0.15)',
              border: `${ub(1)} solid rgba(245, 166, 35, 0.5)`,
              color: 'var(--overlay-text-muted)',
            }}
          >
            {formatTeamSlot(winner.teamNo)}
          </span>
        )}
      </div>

      {/* Quick stats pills: Kills & Points */}
      {/* Quick stats pills: Kills & Points */}
      <div className="grid grid-cols-2 gap-2" style={{ width: '100%', marginTop: ub(2) }}>
        <div
          className="flex flex-col items-center rounded"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: `${ub(1)} solid rgba(255, 255, 255, 0.15)`,
            padding: `${ub(4)} ${ub(8)}`,
            height: ub(32),
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: ub(9),
              color: 'var(--overlay-text-muted)',
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          >
            ELIMS
          </span>
          <span
            data-testid={`next-map-winner-elims-${card.matchNumber}`}
            className="font-black"
            style={{ fontSize: ub(16), color: '#FFFFFF', lineHeight: 1 }}
          >
            {winner.eliminations}
          </span>
        </div>

        <div
          className="flex flex-col items-center rounded"
          style={{
            background: 'rgba(245, 166, 35, 0.15)',
            border: `${ub(1)} solid rgba(245, 166, 35, 0.5)`,
            padding: `${ub(4)} ${ub(8)}`,
            height: ub(32),
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: ub(9), color: GOLD, fontWeight: 800, letterSpacing: '0.05em' }}>
            POINTS
          </span>
          <span
            data-testid={`next-map-winner-points-${card.matchNumber}`}
            className="font-black"
            style={{ fontSize: ub(16), color: GOLD, lineHeight: 1 }}
          >
            {winner.totalPoints}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function FutureCardOverlay({ card, geo }: { card: NextMapCard; geo: CardGeometry }) {
  return (
    <div
      data-testid={`next-map-card-${card.matchNumber}`}
      data-state="future"
      style={{
        position: 'absolute',
        left: ub(geo.thumbLeft),
        top: ub(geo.thumbTop),
        height: ub(geo.thumbHeight),
        maxHeight: ub(geo.thumbHeight),
        overflow: 'hidden',
        borderRadius: ub(4),
        background: 'rgba(0, 0, 0, 0.45)', // Calm semi-transparent dark veil
        pointerEvents: 'none',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        className="font-extrabold uppercase tracking-wider text-xs"
        style={{
          background: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(3px)',
          border: `${ub(1)} solid rgba(255, 255, 255, 0.2)`,
          color: 'var(--overlay-text-muted)',
          padding: `${ub(4)} ${ub(14)}`,
          borderRadius: ub(2),
        }}
      >
        STANDBY
      </div>
    </div>
  );
}

export function NextMapOverlay({ board, appearance }: NextMapOverlayProps) {
  // Respect showTeamLogo toggle (default: true) or showLogos master
  const showLogos = (appearance.showTeamLogo ?? true) && (appearance.showLogos ?? true);
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const scale = appearance.scale ?? 1;

  return (
    <div
      className="next-map-viewport-container"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 25,
      }}
    >
      <div
        data-testid="next-map-overlay"
        style={{
          ...appearanceToCssVariables(appearance),
          position: 'relative',
          width: ub(1920),
          height: ub(1080),
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          overflow: 'hidden',
          pointerEvents: 'none',
          fontFamily: 'var(--overlay-font-family)',
          color: 'var(--overlay-text)',
        }}
      >
        {/* Broadcast animation keyframe definitions */}
        <style>{`
        @keyframes next-map-strobe {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.72; }
        }
        @keyframes next-map-neon-pulse {
          0%, 100% {
            box-shadow: inset 0 0 22px rgba(255, 174, 0, 0.6), 0 0 10px rgba(255, 174, 0, 0.4);
            border-color: rgba(255, 185, 30, 0.85);
          }
          50% {
            box-shadow: inset 0 0 38px rgba(255, 174, 0, 0.95), 0 0 24px rgba(255, 174, 0, 0.75);
            border-color: rgba(255, 225, 110, 1);
          }
        }
        @keyframes next-map-scanline {
          0% { transform: translateY(-120%); opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { transform: translateY(500%); opacity: 0; }
        }
        @keyframes next-map-radar-blink {
          0%, 100% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 6px #ff2222); }
          50% { transform: scale(1.35); opacity: 0.35; filter: drop-shadow(0 0 2px #ff2222); }
        }
        @keyframes next-map-wwcd-shimmer {
          0% { transform: translateX(-150%) rotate(25deg); }
          25%, 100% { transform: translateX(250%) rotate(25deg); }
        }
      `}</style>

        {/* Background base image */}
        <img
          src="/images/next-map-bg.jpg"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {/* Dynamic layer for each of the 4 match cards: strictly inside inner photo boundary */}
        {board.cards.map((card, index) => {
          const geo = GEOMETRIES[index] ?? GEOMETRIES[0];

          if (card.state === 'upcoming') {
            return <UpcomingCardOverlay key={card.matchNumber} card={card} geo={geo} />;
          }
          if (card.state === 'completed') {
            return (
              <CompletedCardOverlay
                key={card.matchNumber}
                card={card}
                geo={geo}
                showLogos={showLogos}
                showTeamNumbers={showTeamNumbers}
              />
            );
          }
          return <FutureCardOverlay key={card.matchNumber} card={card} geo={geo} />;
        })}
      </div>
    </div>
  );
}
