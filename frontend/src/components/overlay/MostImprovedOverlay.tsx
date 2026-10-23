import type { OverlayAppearance } from '@cdf/shared';
import { motion } from 'motion/react';
import { appearanceToCssVariables } from './appearance';
import type { MostImprovedBoard, MostImprovedEntry, MostImprovedMapRef } from './most-improved';
import { OverflowMarquee } from './OverflowMarquee';
import { formatTeamSlot, ub } from './overlay-scale';

export interface MostImprovedOverlayProps {
  board: MostImprovedBoard;
  appearance: OverlayAppearance;
}

const CARD_BG = 'rgba(20, 14, 9, 0.92)';
const CARD_BORDER = '1px solid rgba(201, 182, 142, 0.35)';
const RAIL_TOP = 40;
const RAIL_BOTTOM = 540;
const TABULAR = { fontVariantNumeric: 'tabular-nums' } as const;

const matchLabel = (map: MostImprovedMapRef) => `Match ${map.mapNumber}`;

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

function TeamLogo({
  entry,
  show,
  size,
}: {
  entry: MostImprovedEntry;
  show: boolean;
  size: number;
}) {
  const box = {
    width: ub(size),
    height: ub(size),
    flexShrink: 0,
    border: CARD_BORDER,
    background: 'rgba(42, 29, 19, 0.9)',
  } as const;
  if (show && entry.logoUrl) {
    return <img src={entry.logoUrl} alt="" style={{ ...box, objectFit: 'contain' }} />;
  }
  return (
    <div
      aria-hidden
      className="flex items-center justify-center font-black"
      style={{ ...box, fontSize: ub(size * 0.36), color: 'var(--overlay-text-muted)' }}
    >
      {monogram(entry.name)}
    </div>
  );
}

/** Vertical rank rail 1..teamCount with start (hollow) and end (filled) markers. */
function RankRail({ hero, teamCount }: { hero: MostImprovedEntry; teamCount: number }) {
  const span = RAIL_BOTTOM - RAIL_TOP;
  const at = (rank: number) =>
    RAIL_TOP + (teamCount > 1 ? ((rank - 1) / (teamCount - 1)) * span : 0);
  const startY = at(hero.startRank);
  const endY = at(hero.endRank);
  const marker = 36;
  return (
    <div
      data-testid="most-improved-rail"
      aria-hidden
      style={{ position: 'relative', width: ub(200), height: ub(RAIL_BOTTOM + RAIL_TOP) }}
    >
      <div
        style={{
          position: 'absolute',
          left: ub(98),
          top: ub(RAIL_TOP),
          width: ub(4),
          height: ub(span),
          background: 'rgba(201, 182, 142, 0.25)',
        }}
      />
      {[1, teamCount].map((rank) => (
        <span
          key={rank}
          style={{
            position: 'absolute',
            left: ub(40),
            top: ub(at(rank) - 10),
            fontSize: ub(16),
            fontWeight: 700,
            color: 'var(--overlay-text-muted)',
            ...TABULAR,
          }}
        >
          {rank}
        </span>
      ))}
      <motion.div
        initial={{ height: 0, top: ub(startY) }}
        animate={{ height: ub(startY - endY), top: ub(endY) }}
        transition={{ duration: 0.9, delay: 0.5, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: ub(96),
          width: ub(8),
          background: 'var(--overlay-accent)',
        }}
      />
      <div
        data-testid="most-improved-rail-start"
        data-rank={hero.startRank}
        className="flex items-center justify-center font-black"
        style={{
          position: 'absolute',
          left: ub(100 - marker / 2),
          top: ub(startY - marker / 2),
          width: ub(marker),
          height: ub(marker),
          borderRadius: '50%',
          border: `${ub(3)} solid var(--overlay-text-muted)`,
          background: 'var(--overlay-bg)',
          fontSize: ub(14),
          color: 'var(--overlay-text)',
          ...TABULAR,
        }}
      >
        {hero.startRank}
      </div>
      <motion.div
        data-testid="most-improved-rail-end"
        data-rank={hero.endRank}
        initial={{ top: ub(startY - marker / 2) }}
        animate={{ top: ub(endY - marker / 2) }}
        transition={{ duration: 0.9, delay: 0.5, ease: 'easeInOut' }}
        className="flex items-center justify-center font-black"
        style={{
          position: 'absolute',
          left: ub(100 - marker / 2),
          width: ub(marker),
          height: ub(marker),
          borderRadius: '50%',
          background: 'var(--overlay-accent)',
          fontSize: ub(14),
          color: 'var(--overlay-bg)',
          ...TABULAR,
        }}
      >
        {hero.endRank}
      </motion.div>
    </div>
  );
}

/**
 * Most Improved (Part 10 §6): the biggest climber in the official overall standings between two
 * closed matches. Rank change and series points are shown separately and never mixed.
 */
export function MostImprovedOverlay({ board, appearance }: MostImprovedOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const scale = appearance.scale ?? 1;
  const hasRange = board.status !== 'unavailable';

  return (
    <div
      data-testid="most-improved-overlay"
      data-status={board.status}
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
        // The title and footnotes sit straight on the broadcast picture: a dark, tight shadow keeps
        // them legible over bright game footage (inherited; invisible on the dark panels).
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.85), 0 0 18px rgba(0, 0, 0, 0.55)',
        // Transparent canvas, like the other fullscreen screens without background media: only the
        // panels are painted, the broadcast shows through around them.
      }}
    >
      <div
        className="relative flex flex-col"
        style={{
          width: '100%',
          height: '100%',
          paddingInline: ub(96),
          paddingBlock: ub(64),
          gap: ub(36),
        }}
      >
        {board.status === 'preview' && (
          <div
            data-testid="most-improved-preview-banner"
            className="font-black uppercase"
            style={{
              alignSelf: 'flex-start',
              paddingInline: ub(16),
              paddingBlock: ub(6),
              border: `${ub(2)} solid var(--overlay-accent)`,
              color: 'var(--overlay-accent)',
              fontSize: ub(18),
              letterSpacing: '0.08em',
            }}
          >
            Preview sample — not a result
          </div>
        )}

        <header
          className="flex items-baseline"
          style={{
            gap: ub(24),
            paddingBottom: ub(18),
            borderBottom: `${ub(2)} solid var(--overlay-accent)`,
          }}
        >
          <h1
            className="font-black uppercase"
            style={{ fontSize: ub(72), lineHeight: 1, margin: 0 }}
          >
            Most Improved
          </h1>
          {hasRange && (
            <span
              data-testid="most-improved-subtitle"
              style={{ fontSize: ub(24), color: 'var(--overlay-text-muted)' }}
            >
              Overall standings ·{' '}
              <b style={{ color: 'var(--overlay-text)' }}>
                after {matchLabel(board.from)} → after {matchLabel(board.to)}
              </b>
            </span>
          )}
        </header>

        {board.status === 'ready' || board.status === 'preview' ? (
          <div className="flex" style={{ gap: ub(40), flex: 1, minHeight: 0 }}>
            <motion.section
              data-testid="most-improved-hero"
              data-team-no={board.hero.teamNo}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex"
              style={{ flex: 1, background: CARD_BG, border: CARD_BORDER }}
            >
              <div
                className="flex flex-col justify-between"
                style={{ flex: 1, padding: ub(48), minWidth: 0 }}
              >
                <div className="flex items-start" style={{ gap: ub(24) }}>
                  <TeamLogo entry={board.hero} show={showLogos} size={104} />
                  <div className="flex flex-col" style={{ gap: ub(10), minWidth: 0 }}>
                    <div
                      data-testid="most-improved-hero-name"
                      className="font-black uppercase"
                      style={{
                        fontSize: ub(50),
                        lineHeight: 1.05,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {board.hero.name}
                    </div>
                    {showTeamNumbers && board.hero.teamNo > 0 && (
                      <span
                        className="font-bold"
                        style={{
                          alignSelf: 'flex-start',
                          border: CARD_BORDER,
                          paddingInline: ub(10),
                          fontSize: ub(20),
                          color: 'var(--overlay-text-muted)',
                        }}
                      >
                        {formatTeamSlot(board.hero.teamNo)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-around" style={TABULAR}>
                  <div className="flex flex-col items-center">
                    <span style={{ fontSize: ub(24), color: 'var(--overlay-text-muted)' }}>
                      After {matchLabel(board.from)}
                    </span>
                    <span
                      data-testid="most-improved-start-rank"
                      className="font-black"
                      style={{
                        fontSize: ub(170),
                        lineHeight: 1,
                        color: 'var(--overlay-text-muted)',
                      }}
                    >
                      {board.hero.startRank}
                    </span>
                  </div>
                  <span aria-hidden style={{ fontSize: ub(72), color: 'var(--overlay-accent)' }}>
                    →
                  </span>
                  <div className="flex flex-col items-center">
                    <span style={{ fontSize: ub(24), color: 'var(--overlay-text-muted)' }}>
                      After {matchLabel(board.to)}
                    </span>
                    <span
                      data-testid="most-improved-end-rank"
                      className="font-black"
                      style={{ fontSize: ub(170), lineHeight: 1 }}
                    >
                      {board.hero.endRank}
                    </span>
                  </div>
                </div>

                <div
                  className="flex items-end justify-between"
                  style={{ borderTop: CARD_BORDER, paddingTop: ub(20), ...TABULAR }}
                >
                  <span
                    data-testid="most-improved-delta"
                    className="font-black uppercase"
                    style={{ fontSize: ub(28) }}
                  >
                    <span style={{ fontSize: ub(84), color: 'var(--overlay-accent)' }}>
                      ▲ {board.hero.improvement}
                    </span>{' '}
                    {board.hero.improvement === 1 ? 'place' : 'places'} up
                  </span>
                  <span
                    data-testid="most-improved-points"
                    style={{ fontSize: ub(22), color: 'var(--overlay-text-muted)' }}
                  >
                    Series points{' '}
                    <b style={{ color: 'var(--overlay-text)' }}>
                      {board.hero.startPoints} → {board.hero.endPoints}
                    </b>
                  </span>
                </div>
              </div>
              <div
                className="flex items-center justify-center"
                style={{
                  borderLeft: CARD_BORDER,
                  background: 'rgba(42, 29, 19, 0.6)',
                  paddingInline: ub(40),
                }}
              >
                <RankRail hero={board.hero} teamCount={board.teamCount} />
              </div>
            </motion.section>

            {board.others.length > 0 && (
              <section className="flex flex-col" style={{ width: ub(560), gap: ub(18) }}>
                <h2
                  className="font-bold"
                  style={{ fontSize: ub(24), margin: 0, color: 'var(--overlay-text-muted)' }}
                >
                  Also climbing
                </h2>
                {board.others.map((entry, i) => (
                  <motion.div
                    key={`${entry.teamNo}-${i}`}
                    data-testid={`most-improved-other-${i}`}
                    data-team-no={entry.teamNo}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                    className="flex items-center"
                    style={{
                      flex: 1,
                      gap: ub(20),
                      padding: ub(28),
                      background: CARD_BG,
                      border: CARD_BORDER,
                      ...TABULAR,
                    }}
                  >
                    <div className="flex flex-col" style={{ flex: 1, minWidth: 0, gap: ub(6) }}>
                      <OverflowMarquee
                        text={entry.name}
                        fontSize={26}
                        fontSizeCss={ub(26)}
                        color="var(--overlay-text)"
                        className="font-black uppercase"
                      />
                      <span style={{ fontSize: ub(20), color: 'var(--overlay-text-muted)' }}>
                        #{entry.startRank} → #{entry.endRank}
                      </span>
                    </div>
                    <span
                      className="font-black"
                      style={{ fontSize: ub(48), color: 'var(--overlay-accent)' }}
                    >
                      ▲ {entry.improvement}
                    </span>
                  </motion.div>
                ))}
                {/* Invisible spacers keep each card at a third of the column when fewer than
                    three teams climbed — never a placeholder that looks like a team. */}
                {Array.from({ length: Math.max(0, 3 - board.others.length) }, (_, i) => (
                  <div key={`spacer-${i}`} aria-hidden style={{ flex: 1 }} />
                ))}
              </section>
            )}
          </div>
        ) : (
          <div
            data-testid="most-improved-empty"
            className="flex flex-col items-center justify-center"
            style={{
              flex: 1,
              gap: ub(16),
              background: CARD_BG,
              border: CARD_BORDER,
              textAlign: 'center',
            }}
          >
            {board.status === 'no-climber' ? (
              <span className="font-black" style={{ fontSize: ub(44) }}>
                No team climbed between {matchLabel(board.from)} and {matchLabel(board.to)}
              </span>
            ) : (
              <>
                <span className="font-black uppercase" style={{ fontSize: ub(44) }}>
                  Comparison unavailable
                </span>
                <span style={{ fontSize: ub(26), color: 'var(--overlay-text-muted)' }}>
                  {'message' in board ? board.message : null}
                </span>
              </>
            )}
          </div>
        )}

        {hasRange && (
          <footer
            className="flex justify-between"
            style={{ gap: ub(32), fontSize: ub(18), color: 'var(--overlay-text-muted)' }}
          >
            <span>
              Rank = official overall standings (points, then WWCD, placement pts, elimination pts,
              last placement, slot).
              {board.excluded.length > 0 && (
                <span data-testid="most-improved-excluded-note">
                  {' '}
                  {board.excluded.length} {board.excluded.length === 1 ? 'team' : 'teams'} not
                  compared:{' '}
                  {board.excluded
                    .map(
                      (team) =>
                        `${team.name} (${team.reason === 'new-after-start' ? 'joined later' : 'slot identity changed'})`,
                    )
                    .join(', ')}
                  .
                </span>
              )}
            </span>
            <span style={{ flexShrink: 0 }}>
              Ties in places gained: better final position first.
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}
