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
const DARK_BG = 'rgba(16, 12, 7, 0.92)';
const CARD_BORDER = '1px solid rgba(245, 166, 35, 0.65)';

interface CardGeometry {
  matchNumber: number;
  thumbLeft: number;
  thumbTop: number;
  thumbWidth: number;
  thumbHeight: number;
}

const GEOMETRIES: CardGeometry[] = [
  { matchNumber: 1, thumbLeft: 137, thumbTop: 291, thumbWidth: 346, thumbHeight: 460 },
  { matchNumber: 2, thumbLeft: 571, thumbTop: 291, thumbWidth: 346, thumbHeight: 460 },
  { matchNumber: 3, thumbLeft: 1005, thumbTop: 291, thumbWidth: 346, thumbHeight: 460 },
  { matchNumber: 4, thumbLeft: 1439, thumbTop: 291, thumbWidth: 346, thumbHeight: 460 },
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
    <motion.div
      data-testid={`next-map-card-${card.matchNumber}`}
      data-state="upcoming"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        position: 'absolute',
        left: ub(geo.thumbLeft),
        top: ub(geo.thumbTop),
        width: ub(geo.thumbWidth),
        height: ub(geo.thumbHeight),
        border: `${ub(2)} solid ${GOLD}`,
        boxShadow: `0 0 ${ub(28)} rgba(245, 166, 35, 0.75), inset 0 0 ${ub(20)} rgba(245, 166, 35, 0.35)`,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: ub(16),
      }}
    >
      {/* Top dynamic badge: UPCOMING MATCH */}
      <motion.div
        data-testid="next-map-upcoming-badge"
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        className="flex items-center justify-center font-black uppercase tracking-wider"
        style={{
          background: GOLD,
          color: '#000000',
          padding: `${ub(8)} ${ub(16)}`,
          fontSize: ub(15),
          boxShadow: `0 ${ub(4)} ${ub(12)} rgba(0, 0, 0, 0.65)`,
          gap: ub(8),
        }}
      >
        <span
          className="rounded-full"
          style={{
            width: ub(8),
            height: ub(8),
            backgroundColor: '#000000',
            animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
          }}
        />
        UPCOMING MATCH
      </motion.div>

      {/* Bottom status badge */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.35 }}
        className="flex flex-col items-center justify-center font-black uppercase text-center"
        style={{
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          border: `${ub(1)} solid ${GOLD}`,
          padding: `${ub(8)} ${ub(12)}`,
        }}
      >
        <span style={{ fontSize: ub(12), color: GOLD, letterSpacing: '0.1em' }}>
          NEXT BATTLEGROUND
        </span>
        <span style={{ fontSize: ub(18), color: '#FFFFFF', letterSpacing: '0.04em' }}>
          {card.mapName}
        </span>
      </motion.div>
    </motion.div>
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
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45 }}
      style={{
        position: 'absolute',
        left: ub(geo.thumbLeft),
        top: ub(geo.thumbTop),
        width: ub(geo.thumbWidth),
        height: ub(geo.thumbHeight),
        background: DARK_BG,
        backdropFilter: 'blur(8px)',
        border: CARD_BORDER,
        boxShadow: `0 ${ub(12)} ${ub(28)} rgba(0, 0, 0, 0.85)`,
        padding: ub(20),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        textAlign: 'center',
        ...TABULAR,
      }}
    >
      {/* Top WWCD Header */}
      <div className="flex flex-col items-center" style={{ gap: ub(6) }}>
        <img
          src="/images/chicken-dinner-badge.png"
          alt="WWCD"
          style={{ width: ub(72), height: ub(72), objectFit: 'contain' }}
        />
        <div
          data-testid={`next-map-wwcd-badge-${card.matchNumber}`}
          className="font-black uppercase tracking-wider"
          style={{ fontSize: ub(16), color: GOLD }}
        >
          WINNER WINNER
        </div>
        <div
          className="font-extrabold uppercase text-xs"
          style={{ fontSize: ub(11), color: 'var(--overlay-text-muted)', letterSpacing: '0.1em' }}
        >
          CHICKEN DINNER
        </div>
      </div>

      {/* Winner Team info */}
      <div
        className="flex flex-col items-center"
        style={{ gap: ub(10), width: '100%', minWidth: 0 }}
      >
        {showLogos && (
          <div
            className="grid place-items-center overflow-hidden rounded"
            style={{
              width: ub(64),
              height: ub(64),
              background: 'rgba(255, 255, 255, 0.06)',
              border: `${ub(1)} solid rgba(245, 166, 35, 0.4)`,
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
            fontSize={22}
            fontSizeCss={ub(22)}
            color="#FFFFFF"
            className="font-black uppercase"
          />
        </div>

        {showTeamNumbers && winner.teamNo > 0 && (
          <span
            className="font-extrabold"
            style={{
              fontSize: ub(12),
              padding: `${ub(2)} ${ub(8)}`,
              border: `${ub(1)} solid rgba(245, 166, 35, 0.5)`,
              color: 'var(--overlay-text-muted)',
            }}
          >
            {formatTeamSlot(winner.teamNo)}
          </span>
        )}
      </div>

      {/* Quick stats pills: Kills & Points */}
      <div className="grid grid-cols-2 gap-2" style={{ width: '100%', marginTop: ub(4) }}>
        <div
          className="flex flex-col items-center rounded"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: `${ub(1)} solid rgba(255, 255, 255, 0.1)`,
            padding: `${ub(6)} ${ub(8)}`,
          }}
        >
          <span style={{ fontSize: ub(10), color: 'var(--overlay-text-muted)', fontWeight: 700 }}>
            ELIMS
          </span>
          <span
            data-testid={`next-map-winner-elims-${card.matchNumber}`}
            className="font-black text-base"
            style={{ fontSize: ub(20), color: '#FFFFFF' }}
          >
            {winner.eliminations}
          </span>
        </div>

        <div
          className="flex flex-col items-center rounded"
          style={{
            background: 'rgba(245, 166, 35, 0.12)',
            border: `${ub(1)} solid rgba(245, 166, 35, 0.35)`,
            padding: `${ub(6)} ${ub(8)}`,
          }}
        >
          <span style={{ fontSize: ub(10), color: GOLD, fontWeight: 700 }}>POINTS</span>
          <span
            data-testid={`next-map-winner-points-${card.matchNumber}`}
            className="font-black text-base"
            style={{ fontSize: ub(20), color: GOLD }}
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
        width: ub(geo.thumbWidth),
        height: ub(geo.thumbHeight),
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: ub(16),
      }}
    >
      <div
        className="font-extrabold uppercase tracking-wider text-xs"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(2px)',
          border: `${ub(1)} solid rgba(255, 255, 255, 0.15)`,
          color: 'var(--overlay-text-muted)',
          padding: `${ub(4)} ${ub(12)}`,
        }}
      >
        STANDBY
      </div>
    </div>
  );
}

export function NextMapOverlay({ board, appearance }: NextMapOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const scale = appearance.scale ?? 1;

  return (
    <div
      data-testid="next-map-overlay"
      style={{
        ...appearanceToCssVariables(appearance),
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: ub(1920),
        height: ub(1080),
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
        overflow: 'hidden',
        pointerEvents: 'none',
        fontFamily: 'var(--overlay-font-family)',
        color: 'var(--overlay-text)',
      }}
    >
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

      {/* Dynamic layer for each of the 4 match cards */}
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
  );
}
