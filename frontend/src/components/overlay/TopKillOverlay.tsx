import type { OverlayAppearance } from '@cdf/shared';
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { appearanceToCssVariables } from './appearance';
import { formatTeamSlot, ub } from './overlay-scale';
import { OverflowMarquee } from './OverflowMarquee';
import type { TopKillBoard, TopKillEntry, TopKillMapRef } from './top-kill';

export interface TopKillOverlayProps {
  board: TopKillBoard;
  appearance: OverlayAppearance;
}

const PANEL_BG = 'var(--overlay-bg)';
const BRONZE = 'rgba(129, 96, 54, 0.9)';
const TABULAR: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

function mapLabel(map: TopKillMapRef): string {
  return map.mapName ? `Match ${map.mapNumber} — ${map.mapName}` : `Match ${map.mapNumber}`;
}

function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '—';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

function LogoBox({
  entry,
  size,
  showLogos,
}: {
  entry: TopKillEntry;
  size: number;
  showLogos: boolean;
}) {
  return (
    <div
      style={{
        width: ub(size),
        height: ub(size),
        flex: 'none',
        border: `${ub(1)} solid ${BRONZE}`,
        background: '#2a1d13',
        display: 'grid',
        placeItems: 'center',
        fontSize: ub(size * 0.34),
        color: 'var(--overlay-text-muted)',
      }}
      className="font-black"
    >
      {showLogos && entry.logoUrl ? (
        <img
          src={entry.logoUrl}
          alt=""
          style={{ width: '86%', height: '86%', objectFit: 'contain' }}
        />
      ) : (
        monogram(entry.name)
      )}
    </div>
  );
}

function TiedTag({ testId }: { testId: string }) {
  return (
    <span
      data-testid={testId}
      className="font-extrabold"
      style={{
        fontSize: ub(16),
        color: 'var(--overlay-accent)',
        border: `${ub(1)} solid var(--overlay-accent)`,
        padding: `${ub(1)} ${ub(6)}`,
        flex: 'none',
      }}
    >
      TIED
    </span>
  );
}

function Hero({
  entry,
  showLogos,
  showTeamNumbers,
}: {
  entry: TopKillEntry;
  showLogos: boolean;
  showTeamNumbers: boolean;
}) {
  return (
    <motion.section
      data-testid="top-kill-hero"
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        background: PANEL_BG,
        border: `${ub(1)} solid ${BRONZE}`,
        borderTop: `${ub(6)} solid var(--overlay-accent)`,
        padding: `${ub(44)} ${ub(48)}`,
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr auto',
        minHeight: 0,
      }}
    >
      <div
        className="flex items-center font-extrabold uppercase"
        style={{
          gap: ub(14),
          fontSize: ub(22),
          letterSpacing: '0.06em',
          color: 'var(--overlay-accent)',
        }}
      >
        <span data-testid="top-kill-hero-rank">
          {entry.tied ? 'Tied 1st' : '1st in eliminations'}
        </span>
        {showTeamNumbers && entry.teamNo > 0 && (
          <span
            className="font-extrabold"
            style={{
              fontSize: ub(18),
              padding: `${ub(4)} ${ub(10)}`,
              border: `${ub(1)} solid ${BRONZE}`,
              color: 'var(--overlay-text-muted)',
            }}
          >
            {formatTeamSlot(entry.teamNo)}
          </span>
        )}
      </div>
      <div className="flex items-center" style={{ gap: ub(24), marginTop: ub(28) }}>
        <LogoBox entry={entry} size={112} showLogos={showLogos} />
        <div
          data-testid="top-kill-hero-name"
          className="font-black uppercase"
          style={{
            fontSize: ub(46),
            lineHeight: 1.05,
            color: 'var(--overlay-text)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}
        >
          {entry.name}
        </div>
      </div>
      <div
        className="flex items-baseline"
        style={{ alignSelf: 'end', gap: ub(22), marginTop: ub(20) }}
      >
        <span
          data-testid="top-kill-hero-elims"
          className="font-black"
          style={{
            ...TABULAR,
            fontSize: ub(300),
            lineHeight: 0.8,
            letterSpacing: '-0.04em',
            color: 'var(--overlay-accent)',
          }}
        >
          {entry.eliminations}
        </span>
        <span
          className="font-extrabold uppercase"
          style={{ fontSize: ub(40), color: 'var(--overlay-text)' }}
        >
          {entry.eliminations === 1 ? 'elimination' : 'eliminations'}
        </span>
      </div>
      <div
        data-testid="top-kill-hero-support"
        className="flex font-semibold"
        style={{
          gap: ub(40),
          borderTop: `${ub(1)} solid ${BRONZE}`,
          paddingTop: ub(20),
          marginTop: ub(28),
          fontSize: ub(22),
          color: 'var(--overlay-text-muted)',
        }}
      >
        <span>
          Finished{' '}
          <b style={{ ...TABULAR, color: 'var(--overlay-text)' }}>
            {entry.placement !== null ? `#${entry.placement}` : '—'}
          </b>
        </span>
        <span>
          Kill points{' '}
          <b style={{ ...TABULAR, color: 'var(--overlay-text)' }}>+{entry.killPoints}</b>
        </span>
        <span>
          Match points{' '}
          <b style={{ ...TABULAR, color: 'var(--overlay-text)' }}>{entry.matchPoints}</b>
        </span>
      </div>
    </motion.section>
  );
}

function Row({
  entry,
  index,
  heroElims,
  showLogos,
  showTeamNumbers,
}: {
  entry: TopKillEntry;
  index: number;
  heroElims: number;
  showLogos: boolean;
  showTeamNumbers: boolean;
}) {
  const ratio = heroElims > 0 ? Math.min(1, entry.eliminations / heroElims) : 0;
  return (
    <motion.div
      data-testid={`top-kill-row-${index}`}
      data-elims={entry.eliminations}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 + index * 0.1 }}
      style={{
        background: PANEL_BG,
        border: `${ub(1)} solid rgba(129, 96, 54, 0.6)`,
        display: 'grid',
        gridTemplateColumns: `${ub(96)} ${ub(76)} 1fr ${ub(170)}`,
        alignItems: 'center',
        columnGap: ub(22),
        paddingRight: ub(32),
        position: 'relative',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        data-testid={`top-kill-row-${index}-rank`}
        className="font-black"
        style={{
          ...TABULAR,
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--overlay-header-bg)',
          fontSize: ub(40),
          color: 'var(--overlay-text-muted)',
        }}
      >
        {entry.displayRank}
      </div>
      <LogoBox entry={entry} size={76} showLogos={showLogos} />
      <div style={{ minWidth: 0 }}>
        <div className="flex items-center" style={{ gap: ub(10), minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: '0 1 auto', overflow: 'hidden' }}>
            <OverflowMarquee
              testId={`top-kill-row-${index}-name`}
              text={entry.name}
              fontSize={32}
              fontSizeCss={ub(32)}
              color="var(--overlay-text)"
              className="font-black uppercase"
            />
          </div>
          {entry.tied && <TiedTag testId={`top-kill-row-${index}-tied`} />}
        </div>
        <div
          className="font-semibold"
          style={{ fontSize: ub(18), marginTop: ub(6), color: 'var(--overlay-text-muted)' }}
        >
          {showTeamNumbers && entry.teamNo > 0 ? `${formatTeamSlot(entry.teamNo)} · ` : ''}
          {entry.placement !== null ? `finished #${entry.placement}` : 'finish not recorded'}
        </div>
      </div>
      <div
        data-testid={`top-kill-row-${index}-elims`}
        className="font-black"
        style={{
          ...TABULAR,
          textAlign: 'right',
          fontSize: ub(96),
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: 'var(--overlay-text)',
        }}
      >
        {entry.eliminations}
      </div>
      <div
        data-testid={`top-kill-row-${index}-bar`}
        style={{
          position: 'absolute',
          left: ub(96),
          bottom: 0,
          height: ub(6),
          width: `calc((100% - ${ub(96)}) * ${ratio})`,
          background: 'var(--overlay-accent)',
          opacity: 0.85,
        }}
      />
    </motion.div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 0 }}>
      <div
        data-testid="top-kill-empty"
        className="font-bold"
        style={{
          background: PANEL_BG,
          border: `${ub(1)} solid ${BRONZE}`,
          padding: `${ub(40)} ${ub(64)}`,
          fontSize: ub(36),
          color: 'var(--overlay-text)',
        }}
      >
        {message}
      </div>
    </div>
  );
}

export function TopKillOverlay({ board, appearance }: TopKillOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const scale = appearance.scale ?? 1;
  const map = board.status === 'no-map' ? null : board.map;
  const hasEntries = board.status === 'ready' || board.status === 'preview';
  const hero = hasEntries ? board.entries[0] : undefined;

  return (
    <div
      data-testid="top-kill-overlay"
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
        padding: `${ub(72)} ${ub(96)}`,
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        gap: ub(36),
        pointerEvents: 'none',
        fontFamily: 'var(--overlay-font-family)',
        color: 'var(--overlay-text)',
        // The title and footnotes sit straight on the broadcast picture: a dark, tight shadow keeps
        // them legible over bright game footage (inherited; invisible on the dark panels).
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.85), 0 0 18px rgba(0, 0, 0, 0.55)',
      }}
    >
      <div
        className="flex items-baseline"
        style={{
          gap: ub(24),
          borderBottom: `${ub(2)} solid var(--overlay-accent)`,
          paddingBottom: ub(18),
        }}
      >
        <h1
          className="font-black uppercase"
          style={{ fontSize: ub(64), letterSpacing: '-0.01em', margin: 0 }}
        >
          Top Kill
        </h1>
        <span
          data-testid="top-kill-context"
          className="font-semibold"
          style={{ fontSize: ub(22), color: 'var(--overlay-text-muted)' }}
        >
          Most eliminations
          {map && (
            <>
              {' '}
              · <b style={{ color: 'var(--overlay-text)' }}>{mapLabel(map)}</b>
            </>
          )}
        </span>
        {board.status === 'preview' && (
          <span
            data-testid="top-kill-preview-banner"
            className="font-extrabold uppercase"
            style={{
              marginLeft: 'auto',
              fontSize: ub(20),
              letterSpacing: '0.08em',
              padding: `${ub(6)} ${ub(14)}`,
              border: `${ub(2)} solid var(--overlay-accent)`,
              background: PANEL_BG,
              color: 'var(--overlay-accent)',
            }}
          >
            PREVIEW SAMPLE — NOT A RESULT
          </span>
        )}
      </div>

      {hasEntries && hero ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${ub(820)} 1fr`,
            gap: ub(40),
            minHeight: 0,
          }}
        >
          <Hero entry={hero} showLogos={showLogos} showTeamNumbers={showTeamNumbers} />
          <section
            style={{
              display: 'grid',
              gridTemplateRows: 'repeat(3, 1fr)',
              gap: ub(20),
              minHeight: 0,
            }}
          >
            {board.entries.slice(1).map((entry, i) => (
              <Row
                key={entry.teamNo}
                entry={entry}
                index={i + 1}
                heroElims={hero.eliminations}
                showLogos={showLogos}
                showTeamNumbers={showTeamNumbers}
              />
            ))}
          </section>
        </div>
      ) : (
        <EmptyState
          message={
            board.status === 'no-eliminations'
              ? `No eliminations were recorded in Match ${board.map.mapNumber}`
              : 'No finished match yet'
          }
        />
      )}

      <div
        className="flex justify-between font-semibold"
        style={{ fontSize: ub(18), color: 'var(--overlay-text-muted)', gap: ub(24) }}
      >
        <span>
          {map && hasEntries
            ? `Eliminations recorded when Match ${map.mapNumber} was closed. Ties: better finish first.`
            : ''}
        </span>
        {hasEntries && board.cutoffTiedExtra > 0 && (
          <span data-testid="top-kill-cutoff-note">
            {board.cutoffTiedExtra} more {board.cutoffTiedExtra === 1 ? 'team' : 'teams'} also on{' '}
            {board.cutoffEliminations}{' '}
            {board.cutoffEliminations === 1 ? 'elimination' : 'eliminations'}
          </span>
        )}
      </div>
    </div>
  );
}
