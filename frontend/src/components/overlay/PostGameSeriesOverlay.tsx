import {
  DEFAULT_POST_GAME_BACKGROUND,
  type LiveMatchInfo,
  type OverlayAppearance,
} from '@cdf/shared';
import { motion } from 'motion/react';
import { appearanceToCssVariables } from './appearance';
import type { SeriesStandingsBoardData, SeriesStandingsRow } from './broadcast-state';
import { formatSignedPoints } from '@/lib/points';
import { formatTeamSlot, ub } from './overlay-scale';

export interface PostGameSeriesOverlayProps {
  board: SeriesStandingsBoardData | null;
  matchInfo: LiveMatchInfo;
  appearance: OverlayAppearance;
}

/**
 * Post-Game Cumulative Series Standings Broadcast Screen (`/overlay/postgame-series` and
 * `/overlay/:instanceId/postgame-series`).
 *
 * Displays cumulative tournament standings across all persisted `ClosedMapResult` records in
 * `series.json` (`D-PMCC-04` / `postgame-series`), ordered by official PUBG Esports tie-breakers:
 * 1. Cumulative Total Points (`totalPoints`)
 * 2. Total WWCDs (`wwcdCount`)
 * 3. Cumulative Placement Points (`placementPoints`)
 * 4. Cumulative Elimination Points (`killPoints`)
 * 5. Most Recent Match Placement (`latestPlacement`)
 */
export function PostGameSeriesOverlay({
  board,
  matchInfo,
  appearance,
}: PostGameSeriesOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const showSeriesWwcdColumn = appearance.showSeriesWwcdColumn ?? true;
  const bg = appearance.postGameBackground ?? DEFAULT_POST_GAME_BACKGROUND;
  const hasActiveBackground = bg.mode !== 'disabled' && Boolean(bg.mediaUrl) && bg.opacity > 0;
  const blurScale = bg.blur > 0 ? 1 + bg.blur * 0.008 : 1;

  const rows = board?.rows ?? [];
  const isTwoColumnTable = rows.length > 12;
  const midpoint = isTwoColumnTable ? Math.ceil(rows.length / 2) : rows.length;
  const leftTableRows = rows.slice(0, midpoint);
  const rightTableRows = isTwoColumnTable ? rows.slice(midpoint) : [];
  // ADJ (cumulative operator adjustments) is shown only when the series carries one, so
  // P.PTS + E.PTS + ADJ = TOTAL stays checkable on air and unadjusted series look as before.
  const showAdjustment = rows.some((row) => row.additionalPoints !== 0);

  const completedCount = board?.completedMatchesCount ?? 0;
  const displayLastMap = (board?.lastMapName ?? matchInfo.mapName).trim();

  const appearanceScale = appearance.scale ?? 1;

  return (
    <div
      className="postgame-series-viewport-container"
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
      <motion.div
        data-testid="postgame-series-overlay"
        initial={{ opacity: 0, scale: 0.95 * appearanceScale, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1 * appearanceScale, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.96 * appearanceScale, filter: 'blur(4px)' }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          ...appearanceToCssVariables(appearance),
          width: ub(1920),
          height: ub(1080),
          transformOrigin: 'center center',
          overflow: 'hidden',
          pointerEvents: 'none',
          fontFamily: 'var(--overlay-font-family)',
          color: 'var(--overlay-text)',
        }}
      >
        {/* LAYER 1 & 2: Isolated Post-Game Background Media + Espresso Contrast Scrim */}
        {hasActiveBackground && bg.mediaUrl && (
          <div
            data-testid="postgame-series-background-layer"
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              overflow: 'hidden',
            }}
          >
            {bg.mode === 'video' ? (
              <video
                data-testid="postgame-series-bg-video"
                src={bg.mediaUrl}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: bg.opacity / 100,
                  filter: bg.blur > 0 ? `blur(${ub(bg.blur)})` : undefined,
                  transform: blurScale > 1 ? `scale(${blurScale})` : undefined,
                }}
              />
            ) : (
              <img
                data-testid="postgame-series-bg-image"
                src={bg.mediaUrl}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: bg.opacity / 100,
                  filter: bg.blur > 0 ? `blur(${ub(bg.blur)})` : undefined,
                  transform: blurScale > 1 ? `scale(${blurScale})` : undefined,
                }}
              />
            )}

            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 50% 42%, rgba(22, 15, 10, 0.32) 0%, rgba(12, 8, 5, 0.78) 100%)',
                opacity: bg.opacity / 100,
              }}
            />
          </div>
        )}

        {/* LAYER 3: 100% Crisp Foreground Series Standings Board */}
        <div
          data-testid="postgame-series-foreground-layer"
          className="relative flex flex-col"
          style={{
            zIndex: 10,
            width: '100%',
            height: '100%',
            paddingInline: ub(56),
            paddingBlock: ub(42),
            gap: ub(22),
          }}
        >
          {/* Top Championship Header Bar */}
          <motion.div
            initial={{ opacity: 0, y: -25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -25 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col overflow-hidden"
            style={{
              borderRadius: ub(3),
              backgroundColor: 'var(--overlay-header-bg)',
              border: `${ub(1)} solid rgba(129, 96, 54, 0.75)`,
              boxShadow: `0 ${ub(10)} ${ub(28)} rgba(0, 0, 0, 0.55)`,
            }}
          >
            <div
              style={{
                height: ub(4),
                background:
                  'linear-gradient(90deg, #816036 0%, var(--overlay-accent) 35%, #ffefc8 50%, var(--overlay-accent) 65%, #816036 100%)',
              }}
            />

            <div
              className="flex items-center justify-between"
              style={{
                height: ub(68),
                paddingInline: ub(28),
              }}
            >
              <div className="flex items-center" style={{ gap: ub(14) }}>
                <span style={{ fontSize: ub(15), color: 'var(--overlay-accent)' }} aria-hidden>
                  ◇
                </span>
                <span
                  className="font-black uppercase tracking-wider"
                  style={{
                    fontSize: ub(26),
                    letterSpacing: ub(2.2),
                    color: 'var(--overlay-text)',
                  }}
                >
                  OVERALL SERIES STANDINGS
                </span>
                <span
                  style={{
                    width: ub(2),
                    height: ub(24),
                    backgroundColor: 'rgba(129, 96, 54, 0.65)',
                  }}
                />
                <span
                  className="font-bold uppercase"
                  style={{
                    fontSize: ub(13),
                    letterSpacing: ub(1.6),
                    color: 'var(--overlay-text-muted)',
                  }}
                >
                  CUMULATIVE TOURNAMENT LEADERBOARD
                </span>
              </div>

              <div className="flex items-center tabular-nums" style={{ gap: ub(14) }}>
                <div
                  className="flex items-center font-extrabold uppercase"
                  style={{
                    paddingInline: ub(14),
                    paddingBlock: ub(6),
                    borderRadius: ub(2),
                    backgroundColor: 'rgba(61, 54, 43, 0.72)',
                    border: `${ub(1)} solid rgba(129, 96, 54, 0.65)`,
                    fontSize: ub(15),
                    letterSpacing: ub(1.4),
                    color: 'var(--overlay-text)',
                  }}
                >
                  {completedCount > 0
                    ? `AFTER MATCH ${completedCount}`
                    : `SERIES MATCH ${matchInfo.matchNumber}`}
                </div>

                {displayLastMap && (
                  <div
                    className="flex items-center font-extrabold uppercase"
                    style={{
                      paddingInline: ub(14),
                      paddingBlock: ub(6),
                      borderRadius: ub(2),
                      backgroundColor: 'rgba(229, 169, 60, 0.16)',
                      border: `${ub(1)} solid var(--overlay-accent)`,
                      fontSize: ub(15),
                      letterSpacing: ub(1.4),
                      color: 'var(--overlay-accent)',
                    }}
                  >
                    {displayLastMap}
                  </div>
                )}

                <span style={{ fontSize: ub(15), color: 'var(--overlay-accent)' }} aria-hidden>
                  ◇
                </span>
              </div>
            </div>
          </motion.div>

          {/* Main Body: Left #1 Series Leader Spotlight + Right Cumulative Standings Table */}
          {!board ? (
            <div
              data-testid="postgame-series-empty-state"
              className="flex flex-1 flex-col items-center justify-center text-center"
              style={{
                borderRadius: ub(4),
                backgroundColor: 'var(--overlay-bg)',
                border: `${ub(1)} solid rgba(129, 96, 54, 0.6)`,
                boxShadow: `0 ${ub(16)} ${ub(44)} rgba(0, 0, 0, 0.55)`,
                gap: ub(12),
              }}
            >
              <span style={{ fontSize: ub(22), color: 'var(--overlay-accent)' }} aria-hidden>
                ◇
              </span>
              <div
                className="font-extrabold uppercase"
                style={{
                  fontSize: ub(24),
                  letterSpacing: ub(2.2),
                  color: 'var(--overlay-text)',
                }}
              >
                AWAITING COMPLETED SERIES MATCHES
              </div>
              <div
                className="font-semibold uppercase"
                style={{
                  fontSize: ub(13),
                  letterSpacing: ub(1.4),
                  color: 'var(--overlay-text-muted)',
                }}
              >
                NO CLOSED MAPS RECORDED IN CURRENT SERIES
              </div>
            </div>
          ) : (
            <div
              className="grid flex-1 items-stretch"
              style={{
                gridTemplateColumns: `${ub(448)} minmax(0, 1fr)`,
                columnGap: ub(22),
                minHeight: 0,
              }}
            >
              {/* LEFT ZONE: Featured #1 Series Leader Spotlight Card */}
              <motion.div
                data-testid="postgame-series-leader-card"
                initial={{ opacity: 0, x: -25, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.96 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col justify-between overflow-hidden"
                style={{
                  borderRadius: ub(4),
                  backgroundColor: 'var(--overlay-bg)',
                  border: `${ub(1)} solid var(--overlay-accent)`,
                  boxShadow: `0 ${ub(16)} ${ub(44)} rgba(0, 0, 0, 0.62)`,
                }}
              >
                <div>
                  <div
                    className="flex items-center justify-between"
                    style={{
                      height: ub(46),
                      paddingInline: ub(20),
                      background:
                        'linear-gradient(90deg, rgba(229, 169, 60, 0.24) 0%, var(--overlay-header-bg) 100%)',
                      borderBottom: `${ub(1)} solid rgba(229, 169, 60, 0.55)`,
                    }}
                  >
                    <div className="flex items-center" style={{ gap: ub(8) }}>
                      <span
                        style={{ fontSize: ub(12), color: 'var(--overlay-accent)' }}
                        aria-hidden
                      >
                        ◇
                      </span>
                      <span
                        className="font-black uppercase"
                        style={{
                          fontSize: ub(13),
                          letterSpacing: ub(1.8),
                          color: 'var(--overlay-accent)',
                        }}
                      >
                        CURRENT SERIES LEADER
                      </span>
                    </div>
                    <span
                      className="font-black uppercase tabular-nums"
                      style={{
                        fontSize: ub(13),
                        paddingInline: ub(8),
                        paddingBlock: ub(2.5),
                        borderRadius: ub(2),
                        backgroundColor: 'var(--overlay-accent)',
                        color: '#160f0a',
                      }}
                    >
                      #{board.leader.seriesRank}
                    </span>
                  </div>

                  {/* Leader Logo & Team Identity */}
                  <div
                    className="flex flex-col items-center text-center"
                    style={{
                      paddingInline: ub(24),
                      paddingTop: ub(28),
                      paddingBottom: ub(22),
                      background:
                        'radial-gradient(circle at 50% 25%, rgba(229, 169, 60, 0.16) 0%, transparent 72%)',
                    }}
                  >
                    {showLogos && (
                      <div
                        className="flex items-center justify-center"
                        style={{
                          width: ub(136),
                          height: ub(136),
                          padding: ub(12),
                          borderRadius: ub(4),
                          backgroundColor: 'rgba(38, 24, 15, 0.85)',
                          border: `${ub(1)} solid rgba(229, 169, 60, 0.65)`,
                          marginBottom: ub(16),
                        }}
                      >
                        {board.leader.logoUrl ? (
                          <img
                            src={board.leader.logoUrl}
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
                              fontSize: ub(34),
                              color: 'var(--overlay-accent)',
                            }}
                          >
                            {formatTeamSlot(board.leader.teamNo)}
                          </span>
                        )}
                      </div>
                    )}

                    {showTeamNumbers && (
                      <span
                        data-testid="postgame-series-leader-slot"
                        className="font-extrabold uppercase tabular-nums"
                        style={{
                          fontSize: ub(12),
                          paddingInline: ub(10),
                          paddingBlock: ub(4),
                          borderRadius: ub(2),
                          backgroundColor: 'rgba(61, 54, 43, 0.88)',
                          border: `${ub(1)} solid rgba(229, 169, 60, 0.6)`,
                          color: 'var(--overlay-accent)',
                          letterSpacing: ub(1.2),
                          marginBottom: ub(10),
                        }}
                      >
                        SLOT {formatTeamSlot(board.leader.teamNo)}
                      </span>
                    )}

                    <div
                      data-testid="postgame-series-leader-name"
                      className="w-full truncate font-black uppercase tracking-wide"
                      style={{
                        fontSize: ub(30),
                        lineHeight: 1.12,
                        color: 'var(--overlay-text)',
                      }}
                    >
                      {board.leader.name}
                    </div>
                  </div>
                </div>

                {/* Leader Series Stat Breakdown Grid */}
                <div
                  style={{
                    paddingInline: ub(22),
                    paddingBottom: ub(22),
                  }}
                >
                  <div
                    className="grid tabular-nums"
                    style={{
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: ub(10),
                      marginBottom: ub(12),
                    }}
                  >
                    <SeriesStatBox
                      label="MATCHES PLAYED"
                      value={String(board.leader.matchesPlayed)}
                    />
                    <SeriesStatBox label="CHICKEN DINNERS" value={String(board.leader.wwcdCount)} />
                    <SeriesStatBox
                      label="PLACEMENT PTS"
                      value={`+${board.leader.placementPoints}`}
                    />
                    <SeriesStatBox label="ELIMINATION PTS" value={`+${board.leader.killPoints}`} />
                  </div>

                  {/* Cumulative Series Points Callout Bar */}
                  <div
                    className="flex items-center justify-between tabular-nums"
                    style={{
                      paddingInline: ub(18),
                      paddingBlock: ub(14),
                      borderRadius: ub(3),
                      background:
                        'linear-gradient(90deg, rgba(229, 169, 60, 0.22) 0%, rgba(38, 24, 15, 0.95) 100%)',
                      border: `${ub(1)} solid var(--overlay-accent)`,
                    }}
                  >
                    <div className="flex flex-col">
                      <span
                        className="font-extrabold uppercase"
                        style={{
                          fontSize: ub(11),
                          letterSpacing: ub(1.4),
                          color: 'var(--overlay-accent)',
                        }}
                      >
                        CUMULATIVE SERIES POINTS
                      </span>
                      <span
                        className="font-semibold uppercase"
                        style={{
                          fontSize: ub(10.5),
                          letterSpacing: ub(0.8),
                          color: 'var(--overlay-text-muted)',
                          marginTop: ub(2),
                        }}
                      >
                        AFTER {completedCount} {completedCount === 1 ? 'MATCH' : 'MATCHES'}
                      </span>
                    </div>
                    <span
                      data-testid="postgame-series-leader-total-pts"
                      className="font-black tabular-nums"
                      style={{
                        fontSize: ub(34),
                        lineHeight: 1,
                        color: 'var(--overlay-accent)',
                      }}
                    >
                      {board.leader.totalPoints}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* RIGHT ZONE: Structured Cumulative Series Standings Table */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                data-testid="postgame-series-standings-grid"
                className="grid items-stretch"
                style={{
                  display: 'grid',
                  gridTemplateColumns: isTwoColumnTable
                    ? 'repeat(2, minmax(0, 1fr))'
                    : 'minmax(0, 1fr)',
                  columnGap: ub(16),
                  minHeight: 0,
                }}
              >
                <SeriesStandingsColumnTable
                  rows={leftTableRows}
                  showLogos={showLogos}
                  showTeamNumbers={showTeamNumbers}
                  showSeriesWwcdColumn={showSeriesWwcdColumn}
                  showAdjustment={showAdjustment}
                  compact={isTwoColumnTable}
                />
                {isTwoColumnTable && (
                  <SeriesStandingsColumnTable
                    rows={rightTableRows}
                    showLogos={showLogos}
                    showTeamNumbers={showTeamNumbers}
                    showSeriesWwcdColumn={showSeriesWwcdColumn}
                    showAdjustment={showAdjustment}
                    compact
                  />
                )}
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SeriesStatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col justify-center"
      style={{
        paddingInline: ub(14),
        paddingBlock: ub(10),
        borderRadius: ub(2.5),
        backgroundColor: 'var(--overlay-header-bg)',
        border: `${ub(1)} solid rgba(129, 96, 54, 0.45)`,
      }}
    >
      <span
        className="font-bold uppercase"
        style={{
          fontSize: ub(9.5),
          letterSpacing: ub(1.1),
          color: 'var(--overlay-text-muted)',
        }}
      >
        {label}
      </span>
      <span
        className="font-extrabold tabular-nums"
        style={{
          fontSize: ub(22),
          lineHeight: 1.15,
          color: 'var(--overlay-text)',
          marginTop: ub(2),
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface SeriesStandingsColumnTableProps {
  rows: SeriesStandingsRow[];
  showLogos: boolean;
  showTeamNumbers: boolean;
  showSeriesWwcdColumn: boolean;
  /** Adds the ADJ column (cumulative operator adjustments); only when some row has one. */
  showAdjustment: boolean;
  compact: boolean;
}

function SeriesStandingsColumnTable({
  rows,
  showLogos,
  showTeamNumbers,
  showSeriesWwcdColumn,
  showAdjustment,
  compact,
}: SeriesStandingsColumnTableProps) {
  const rankW = compact ? 34 : 42;
  const logoW = compact ? 28 : 34;
  const matchesW = compact ? 40 : 54;
  const wwcdW = compact ? 48 : 64;
  const pPtsW = compact ? 52 : 70;
  const kPtsW = compact ? 52 : 70;
  const adjW = compact ? 46 : 62;
  const totW = compact ? 58 : 78;

  const colParts = [
    ub(rankW),
    ...(showLogos ? [ub(logoW)] : []),
    'minmax(0, 1fr)',
    ub(matchesW),
    ...(showSeriesWwcdColumn ? [ub(wwcdW)] : []),
    ub(pPtsW),
    ub(kPtsW),
    ...(showAdjustment ? [ub(adjW)] : []),
    ub(totW),
  ];
  const gridCols = colParts.join(' ');

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        borderRadius: ub(4),
        backgroundColor: 'var(--overlay-bg)',
        border: `${ub(1)} solid rgba(129, 96, 54, 0.65)`,
        boxShadow: `0 ${ub(12)} ${ub(36)} rgba(0, 0, 0, 0.52)`,
      }}
    >
      {/* Column Header Row */}
      <div
        className="grid items-center font-extrabold uppercase"
        style={{
          height: ub(42),
          paddingInline: ub(compact ? 12 : 18),
          gridTemplateColumns: gridCols,
          columnGap: ub(compact ? 6 : 10),
          backgroundColor: 'var(--overlay-header-bg)',
          color: 'var(--overlay-text-muted)',
          fontSize: ub(compact ? 10 : 11),
          letterSpacing: ub(0.9),
          borderBottom: `${ub(1)} solid var(--overlay-accent)`,
        }}
      >
        <span>#</span>
        {showLogos && <span />}
        <span>TEAM</span>
        <span className="text-center">M</span>
        {showSeriesWwcdColumn && <span className="text-center">WWCD</span>}
        <span className="text-center">P.PTS</span>
        <span className="text-center">E.PTS</span>
        {showAdjustment && (
          <span className="text-center" data-testid="postgame-series-adj-header">
            ADJ
          </span>
        )}
        <span className="text-center" style={{ color: 'var(--overlay-accent)' }}>
          TOTAL
        </span>
      </div>

      {/* Team Standings Rows */}
      <div className="flex flex-1 flex-col">
        {rows.map((row, idx) => {
          const isLeader = row.seriesRank === 1;
          const isTop3 = row.seriesRank <= 3;

          return (
            <motion.div
              key={row.teamNo}
              data-testid={`postgame-series-row-${row.teamNo}`}
              initial={{ opacity: 0, x: -12, y: 8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: -12, y: 6 }}
              transition={{ duration: 0.35, delay: 0.08 + idx * 0.035, ease: [0.16, 1, 0.3, 1] }}
              className="grid flex-1 items-center tabular-nums"
              style={{
                minHeight: ub(compact ? 42 : 48),
                maxHeight: ub(compact ? 58 : 64),
                paddingInline: ub(compact ? 12 : 18),
                gridTemplateColumns: gridCols,
                columnGap: ub(compact ? 6 : 10),
                backgroundColor: isLeader
                  ? 'rgba(229, 169, 60, 0.14)'
                  : idx % 2 === 1
                    ? 'var(--overlay-row-alt-bg)'
                    : 'transparent',
                borderLeft: isLeader
                  ? `${ub(3)} solid var(--overlay-accent)`
                  : `${ub(3)} solid transparent`,
                borderBottom: `${ub(1)} solid rgba(129, 96, 54, 0.18)`,
              }}
            >
              {/* Overall Series Rank */}
              <motion.span
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.25, delay: 0.12 + idx * 0.035 }}
                className="font-extrabold tabular-nums"
                style={{
                  fontSize: ub(compact ? 14 : 16),
                  color: isTop3 ? 'var(--overlay-accent)' : 'var(--overlay-text)',
                }}
              >
                {row.seriesRank}
              </motion.span>

              {/* Team Logo */}
              {showLogos && (
                <div
                  className="flex items-center justify-center"
                  style={{ width: ub(logoW), height: ub(logoW) }}
                >
                  {row.logoUrl ? (
                    <img
                      src={row.logoUrl}
                      alt=""
                      style={{
                        width: ub(logoW - 2),
                        height: ub(logoW - 2),
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: ub(logoW - 6),
                        height: ub(logoW - 6),
                        borderRadius: ub(2),
                        backgroundColor: 'var(--overlay-row-alt-bg)',
                        border: `${ub(1)} solid rgba(129, 96, 54, 0.5)`,
                      }}
                    />
                  )}
                </div>
              )}

              {/* Persistent Team Slot (T##) + Team Name */}
              <div className="flex min-w-0 items-center" style={{ gap: ub(6) }}>
                {showTeamNumbers && (
                  <span
                    data-testid={`postgame-series-slot-${row.teamNo}`}
                    className="shrink-0 font-bold uppercase tabular-nums"
                    style={{
                      fontSize: ub(compact ? 9 : 10),
                      lineHeight: 1,
                      paddingInline: ub(4.5),
                      paddingBlock: ub(2.5),
                      borderRadius: ub(2),
                      backgroundColor: 'rgba(61, 54, 43, 0.82)',
                      border: `${ub(1)} solid rgba(129, 96, 54, 0.55)`,
                      color: 'var(--overlay-text-muted)',
                    }}
                  >
                    {formatTeamSlot(row.teamNo)}
                  </span>
                )}
                <span
                  className="truncate font-bold uppercase tracking-wide"
                  style={{
                    fontSize: ub(compact ? 13.5 : 15),
                    color: 'var(--overlay-text)',
                  }}
                >
                  {row.name}
                </span>
              </div>

              {/* Matches Played */}
              <span
                className="text-center font-bold tabular-nums"
                style={{
                  fontSize: ub(compact ? 13 : 14.5),
                  color: 'var(--overlay-text-muted)',
                }}
              >
                {row.matchesPlayed}
              </span>

              {/* WWCD Count */}
              {showSeriesWwcdColumn && (
                <span
                  data-testid={`postgame-series-wwcd-${row.teamNo}`}
                  className="text-center font-bold tabular-nums"
                  style={{
                    fontSize: ub(compact ? 13 : 14.5),
                    color:
                      row.wwcdCount > 0 ? 'var(--overlay-accent)' : 'var(--overlay-text-muted)',
                  }}
                >
                  {row.wwcdCount}
                </span>
              )}

              {/* Cumulative Placement Points */}
              <span
                className="text-center font-semibold tabular-nums"
                style={{
                  fontSize: ub(compact ? 13 : 14.5),
                  color: 'var(--overlay-text-muted)',
                }}
              >
                {row.placementPoints}
              </span>

              {/* Cumulative Elimination Points */}
              <span
                className="text-center font-semibold tabular-nums"
                style={{
                  fontSize: ub(compact ? 13 : 14.5),
                  color: 'var(--overlay-text-muted)',
                }}
              >
                {row.killPoints}
              </span>

              {/* Cumulative operator adjustments */}
              {showAdjustment && (
                <span
                  data-testid={`postgame-series-adj-${row.teamNo}`}
                  className="text-center font-semibold tabular-nums"
                  style={{
                    fontSize: ub(compact ? 13 : 14.5),
                    color:
                      row.additionalPoints > 0
                        ? 'var(--overlay-accent)'
                        : row.additionalPoints < 0
                          ? 'var(--player-knocked)'
                          : 'var(--overlay-text-muted)',
                  }}
                >
                  {row.additionalPoints === 0 ? '—' : formatSignedPoints(row.additionalPoints)}
                </span>
              )}

              {/* Cumulative Total Series Points */}
              <motion.span
                data-testid={`postgame-series-total-pts-${row.teamNo}`}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.25, delay: 0.15 + idx * 0.035 }}
                className="text-center font-black tabular-nums"
                style={{
                  fontSize: ub(compact ? 14.5 : 16.5),
                  color: 'var(--overlay-accent)',
                }}
              >
                {row.totalPoints}
              </motion.span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
