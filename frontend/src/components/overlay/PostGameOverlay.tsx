import {
  DEFAULT_POST_GAME_BACKGROUND,
  type LiveMatchInfo,
  type OverlayAppearance,
} from '@cdf/shared';
import { motion } from 'motion/react';
import { appearanceToCssVariables } from './appearance';
import type { PostGameBoardData, PostGameStatus, PostGameTeamRow } from './broadcast-state';
import { formatSignedPoints } from '@/lib/points';
import { formatTeamSlot, ub } from './overlay-scale';

export interface PostGameOverlayProps {
  board: PostGameBoardData | null;
  matchInfo: LiveMatchInfo;
  appearance: OverlayAppearance;
  unavailableSelection?: boolean;
}

/**
 * Post-Game Detailed Standings Broadcast Screen (`/overlay/postgame` and `/overlay/:instanceId/postgame`).
 *
 * Implements `docs/postgame-standings-requirements.md`, `D-PMCC-04` (`A3`), and `D-PMCC-05`:
 * 1. **3-Layer Background Isolation:**
 *    - Layer 1 (`z-0`): Optional uploaded background image (`<img>`) or video (`<video autoPlay loop muted playsInline>`)
 *      with configurable `opacity` (`0–100%`) and `blur` (`0–24px`) + edge-scale compensation so blur never
 *      causes transparent border fringes or touches foreground text.
 *    - Layer 2 (`z-0`): Warm PMCC espresso vignette scrim proportional to background opacity.
 *    - Layer 3 (`z-10`): 100% crisp foreground standings board. When background mode is `'disabled'`,
 *      the surrounding 1920×1080 canvas remains completely transparent for OBS scene compositing.
 * 2. **Asymmetric 2-Zone Broadcast Composition (`1920×1080`):**
 *    - Top Championship Header with `MATCH N RESULTS • MAP`, framed by burnished bronze rules and `◇` diamond nodes.
 *    - Left Zone (`460px`): Featured `#1 WWCD Winner` Spotlight Card (Winner Logo, `SLOT T##`, Team Name,
 *      `#1 PLACEMENT`, `MATCH ELIMS`, `PLACE PTS`, `ELIM PTS`, `MATCH TOTAL PTS`, and `SERIES TOTAL`).
 *    - Right Zone: Structured Standings Table of all teams (`#1–#25` per `A3`) sorted by Total Match Points,
 *      automatically splitting into 2 balanced side-by-side table columns when `> 12` teams are present
 *      so up to 25 teams fit on a single 1080p frame with zero vertical scrolling.
 */
export function PostGameOverlay({
  board,
  matchInfo,
  appearance,
  unavailableSelection = false,
}: PostGameOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const bg = appearance.postGameBackground ?? DEFAULT_POST_GAME_BACKGROUND;
  const hasActiveBackground = bg.mode !== 'disabled' && Boolean(bg.mediaUrl) && bg.opacity > 0;
  // Compensate slightly for Gaussian blur kernel radius so edges stay crisp inside overflow-hidden
  const blurScale = bg.blur > 0 ? 1 + bg.blur * 0.008 : 1;

  const rows = board?.rows ?? [];
  const isTwoColumnTable = rows.length > 12;
  const midpoint = isTwoColumnTable ? Math.ceil(rows.length / 2) : rows.length;
  const leftTableRows = rows.slice(0, midpoint);
  const rightTableRows = isTwoColumnTable ? rows.slice(midpoint) : [];
  // The ADJ column appears only when this match actually carries an operator adjustment, so the
  // on-air arithmetic (P.PTS + E.PTS + ADJ = MATCH) stays checkable and unadjusted maps look as before.
  const showAdjustment = rows.some((row) => row.additionalPoints !== 0);

  const displayMapNumber = board?.mapNumber ?? matchInfo.matchNumber;
  const displayMapName = (board?.mapName ?? matchInfo.mapName).trim();

  return (
    <motion.div
      data-testid="postgame-overlay"
      initial={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{
        ...appearanceToCssVariables(appearance),
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: ub(1920),
        height: ub(1080),
        transform: 'translate(-50%, -50%)',
        overflow: 'hidden',
        pointerEvents: 'none',
        fontFamily: 'var(--overlay-font-family)',
        color: 'var(--overlay-text)',
      }}
    >
      {/* LAYER 1 & 2: Isolated Post-Game Background Media + Espresso Contrast Scrim */}
      {hasActiveBackground && bg.mediaUrl && (
        <div
          data-testid="postgame-background-layer"
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
              data-testid="postgame-bg-video"
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
              data-testid="postgame-bg-image"
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

          {/* Warm PMCC Espresso Contrast Vignette Scrim */}
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

      {/* LAYER 3: 100% Crisp Foreground Standings Board */}
      <div
        data-testid="postgame-foreground-layer"
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
                POST-GAME MATCH STANDINGS
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
                SINGLE-MATCH BREAKDOWN
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
                MATCH {displayMapNumber}
              </div>

              {displayMapName && (
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
                  {displayMapName}
                </div>
              )}

              {board && board.status !== 'final' && (
                <div
                  data-testid="postgame-status-banner"
                  className="flex items-center font-extrabold uppercase"
                  style={{
                    paddingInline: ub(14),
                    paddingBlock: ub(6),
                    borderRadius: ub(2),
                    backgroundColor: 'rgba(196, 70, 42, 0.2)',
                    border: `${ub(1)} solid var(--player-knocked)`,
                    fontSize: ub(15),
                    letterSpacing: ub(1.4),
                    color: 'var(--player-knocked)',
                  }}
                >
                  {board.status === 'preview'
                    ? 'PREVIEW SAMPLE — NOT A RESULT'
                    : board.status === 'not-recorded'
                      ? 'WWCD NOT RECORDED'
                      : 'PROVISIONAL — MAP NOT CLOSED'}
                </div>
              )}

              <span style={{ fontSize: ub(15), color: 'var(--overlay-accent)' }} aria-hidden>
                ◇
              </span>
            </div>
          </div>
        </motion.div>

        {/* Main Body: Left #1 Winner Spotlight + Right Standings Table (or Empty Holding State) */}
        {!board ? (
          <div
            data-testid={
              unavailableSelection ? 'postgame-unavailable-state' : 'postgame-empty-state'
            }
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
              {unavailableSelection
                ? 'SELECTED MATCH RESULT UNAVAILABLE'
                : 'AWAITING CLOSED MAP RESULTS'}
            </div>
            <div
              className="font-semibold uppercase"
              style={{
                fontSize: ub(13),
                letterSpacing: ub(1.4),
                color: 'var(--overlay-text-muted)',
              }}
            >
              {unavailableSelection
                ? `PINNED MATCH (${appearance.postGameMatchSelection}) WAS REMOVED OR RESET — SELECT A VALID MATCH IN ADMIN`
                : `MATCH ${displayMapNumber}${displayMapName ? `  •  ${displayMapName}` : ''}`}
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
            {/* LEFT ZONE: Featured #1 WWCD Match Winner Spotlight Card */}
            {board.winner ? (
              <motion.div
                data-testid="postgame-winner-card"
                initial={{ opacity: 0, x: -25, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.96 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  borderRadius: ub(4),
                  backgroundColor: 'var(--overlay-bg)',
                  border: `${ub(1)} solid var(--overlay-accent)`,
                  boxShadow: `0 ${ub(16)} ${ub(44)} rgba(0, 0, 0, 0.62)`,
                }}
              >
                <div>
                  {/* Top Winner Banner Header */}
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
                        {board.status === 'provisional'
                          ? 'WWCD · PROVISIONAL'
                          : 'WINNER WINNER CHICKEN DINNER'}
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
                      #{board.winner.placement}
                    </span>
                  </div>

                  {/* Winner Logo & Team Identity */}
                  <div
                    className="relative flex flex-col items-center text-center"
                    style={{
                      // A stacking context of its own, so the glow can sit behind the text (z -1)
                      // without leaving the block.
                      isolation: 'isolate',
                      paddingInline: ub(24),
                      paddingTop: ub(28),
                      paddingBottom: ub(22),
                    }}
                  >
                    {/*
                     * The gold glow. Its own layer, filling this block, with an ellipse sized to the
                     * nearest edges (`closest-side`): it reaches full transparency before any edge, so
                     * it can never be cut into a hard band whatever the block's height is — with the
                     * logo box (taller block) or without it. The old gradient was painted straight on
                     * the content-sized block with the default `farthest-corner` size.
                     */}
                    <div
                      aria-hidden
                      data-testid="postgame-winner-glow"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: -1,
                        pointerEvents: 'none',
                        background:
                          'radial-gradient(ellipse closest-side at 50% 40%, rgba(229, 169, 60, 0.16) 0%, rgba(229, 169, 60, 0) 100%)',
                      }}
                    />
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
                        {board.winner.logoUrl ? (
                          <img
                            src={board.winner.logoUrl}
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
                            {formatTeamSlot(board.winner.teamNo)}
                          </span>
                        )}
                      </div>
                    )}

                    {showTeamNumbers && (
                      <span
                        data-testid="postgame-winner-slot"
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
                        SLOT {formatTeamSlot(board.winner.teamNo)}
                      </span>
                    )}

                    <div
                      data-testid="postgame-winner-name"
                      className="w-full truncate font-black uppercase tracking-wide"
                      style={{
                        fontSize: ub(30),
                        lineHeight: 1.12,
                        color: 'var(--overlay-text)',
                      }}
                    >
                      {board.winner.name}
                    </div>
                  </div>
                </div>

                {/* Winner Match Stat Breakdown Grid */}
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
                    <WinnerStatBox label="MATCH PLACEMENT" value={`#${board.winner.placement}`} />
                    <WinnerStatBox label="MATCH ELIMS" value={String(board.winner.eliminations)} />
                    <WinnerStatBox
                      label="PLACEMENT PTS"
                      value={`+${board.winner.placementPoints}`}
                    />
                    <WinnerStatBox label="ELIMINATION PTS" value={`+${board.winner.killPoints}`} />
                  </div>

                  {/* Total Match Points Callout Bar */}
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
                        {board.status === 'provisional'
                          ? 'TOTAL MATCH POINTS (PROVISIONAL)'
                          : 'TOTAL MATCH POINTS'}
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
                        SINGLE-MATCH SCORE ({board.winner.placementPoints}P +{' '}
                        {board.winner.killPoints}E
                        {board.winner.additionalPoints !== 0 &&
                          ` ${board.winner.additionalPoints > 0 ? '+' : '\u2212'} ${Math.abs(board.winner.additionalPoints)}A`}
                        )
                      </span>
                    </div>
                    <span
                      data-testid="postgame-winner-match-pts"
                      className="font-black tabular-nums"
                      style={{
                        fontSize: ub(34),
                        lineHeight: 1,
                        color: 'var(--overlay-accent)',
                      }}
                    >
                      {board.winner.totalMatchPoints}
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <NoWinnerCard status={board.status} />
            )}

            {/* RIGHT ZONE: Structured Standings Table (1 Column <=12 teams, 2 Columns 13..25 teams) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              style={{
                gridTemplateColumns: isTwoColumnTable
                  ? 'repeat(2, minmax(0, 1fr))'
                  : 'minmax(0, 1fr)',
                columnGap: ub(16),
                minHeight: 0,
              }}
            >
              <StandingsColumnTable
                rows={leftTableRows}
                showLogos={showLogos}
                showTeamNumbers={showTeamNumbers}
                showAdjustment={showAdjustment}
                winnerTeamNo={board.winner?.teamNo ?? null}
                compact={isTwoColumnTable}
              />
              {isTwoColumnTable && (
                <StandingsColumnTable
                  rows={rightTableRows}
                  showLogos={showLogos}
                  showTeamNumbers={showTeamNumbers}
                  showAdjustment={showAdjustment}
                  winnerTeamNo={board.winner?.teamNo ?? null}
                  compact
                />
              )}
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function WinnerStatBox({ label, value }: { label: string; value: string }) {
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

interface StandingsColumnTableProps {
  rows: PostGameTeamRow[];
  showLogos: boolean;
  showTeamNumbers: boolean;
  compact: boolean;
  /** The WWCD team, by identity (never by `placement === 1`); `null` when none is confirmed. */
  winnerTeamNo: number | null;
  /** Adds the ADJ column (operator bonus/penalty); only when some row has one. */
  showAdjustment: boolean;
}

function StandingsColumnTable({
  rows,
  showLogos,
  showTeamNumbers,
  showAdjustment,
  compact,
  winnerTeamNo,
}: StandingsColumnTableProps) {
  const rankW = compact ? 34 : 42;
  const logoW = compact ? 28 : 34;
  const placeW = compact ? 48 : 64;
  const elimsW = compact ? 48 : 64;
  const pPtsW = compact ? 52 : 70;
  const kPtsW = compact ? 52 : 70;
  const adjW = compact ? 46 : 62;
  const totW = compact ? 58 : 78;

  const gridCols = [
    ub(rankW),
    ...(showLogos ? [ub(logoW)] : []),
    'minmax(0, 1fr)',
    ub(placeW),
    ub(elimsW),
    ub(pPtsW),
    ub(kPtsW),
    ...(showAdjustment ? [ub(adjW)] : []),
    ub(totW),
  ].join(' ');

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
        <span className="text-center">PLACE</span>
        <span className="text-center">ELIMS</span>
        <span className="text-center">P.PTS</span>
        <span className="text-center">E.PTS</span>
        {showAdjustment && (
          <span className="text-center" data-testid="postgame-adj-header">
            ADJ
          </span>
        )}
        <span className="text-center" style={{ color: 'var(--overlay-accent)' }}>
          MATCH
        </span>
      </div>

      {/* Team Standings Rows */}
      <div className="flex flex-1 flex-col">
        {rows.map((row, idx) => {
          const isWinner = winnerTeamNo !== null && row.teamNo === winnerTeamNo;
          const isTop3 = row.matchRank <= 3;

          return (
            <motion.div
              key={row.teamNo}
              data-testid={`postgame-row-${row.teamNo}`}
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
                backgroundColor: isWinner
                  ? 'rgba(229, 169, 60, 0.14)'
                  : idx % 2 === 1
                    ? 'var(--overlay-row-alt-bg)'
                    : 'transparent',
                borderLeft: isWinner
                  ? `${ub(3)} solid var(--overlay-accent)`
                  : `${ub(3)} solid transparent`,
                borderBottom: `${ub(1)} solid rgba(129, 96, 54, 0.18)`,
              }}
            >
              {/* Match Rank */}
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
                {row.matchRank}
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
                    data-testid={`postgame-slot-${row.teamNo}`}
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

              {/* Placement */}
              <span
                className="text-center font-bold tabular-nums"
                style={{
                  fontSize: ub(compact ? 13 : 14.5),
                  color: isWinner ? 'var(--overlay-accent)' : 'var(--overlay-text-muted)',
                }}
              >
                {row.placement === null ? '—' : `#${row.placement}`}
              </span>

              {/* Match Eliminations */}
              <span
                className="text-center font-bold tabular-nums"
                style={{
                  fontSize: ub(compact ? 13.5 : 15),
                  color: 'var(--overlay-text)',
                }}
              >
                {row.eliminations}
              </span>

              {/* Placement Points */}
              <span
                className="text-center font-semibold tabular-nums"
                style={{
                  fontSize: ub(compact ? 13 : 14.5),
                  color: 'var(--overlay-text-muted)',
                }}
              >
                {row.placementPoints}
              </span>

              {/* Kill / Elimination Points */}
              <span
                className="text-center font-semibold tabular-nums"
                style={{
                  fontSize: ub(compact ? 13 : 14.5),
                  color: 'var(--overlay-text-muted)',
                }}
              >
                {row.killPoints}
              </span>

              {/* Operator adjustment */}
              {showAdjustment && (
                <span
                  data-testid={`postgame-adj-${row.teamNo}`}
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
              {/* Total Match Points */}
              <motion.span
                data-testid={`postgame-match-pts-${row.teamNo}`}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.25, delay: 0.15 + idx * 0.035 }}
                className="text-center font-black tabular-nums"
                style={{
                  fontSize: ub(compact ? 14.5 : 16.5),
                  color: 'var(--overlay-accent)',
                }}
              >
                {row.totalMatchPoints}
              </motion.span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const NO_WINNER_COPY: Record<Exclude<PostGameStatus, 'final' | 'provisional'>, [string, string]> = {
  unconfirmed: [
    'WWCD NOT CONFIRMED YET',
    'The last team standing cannot be confirmed from the available data. Close the map once the result is known.',
  ],
  'not-recorded': [
    'WWCD NOT RECORDED',
    'This map has no valid placement #1, so no winner is shown. Correct it in Series control.',
  ],
  preview: ['PREVIEW SAMPLE', 'Sample table for the admin preview — not a match result.'],
};

/** The left card when there is no winner to name: says so, never substitutes the top scorer. */
function NoWinnerCard({ status }: { status: PostGameStatus }) {
  const [title, detail] =
    status === 'not-recorded' || status === 'preview'
      ? NO_WINNER_COPY[status]
      : NO_WINNER_COPY.unconfirmed;
  return (
    <motion.div
      data-testid="postgame-no-winner-card"
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center text-center"
      style={{
        borderRadius: ub(4),
        backgroundColor: 'var(--overlay-bg)',
        border: `${ub(1)} solid rgba(129, 96, 54, 0.65)`,
        boxShadow: `0 ${ub(16)} ${ub(44)} rgba(0, 0, 0, 0.62)`,
        paddingInline: ub(32),
        gap: ub(14),
      }}
    >
      <span style={{ fontSize: ub(22), color: 'var(--overlay-accent)' }} aria-hidden>
        ◇
      </span>
      <div
        className="font-extrabold uppercase"
        style={{ fontSize: ub(22), letterSpacing: ub(2), color: 'var(--overlay-text)' }}
      >
        {title}
      </div>
      <div
        className="font-semibold"
        style={{ fontSize: ub(13), lineHeight: 1.4, color: 'var(--overlay-text-muted)' }}
      >
        {detail}
      </div>
    </motion.div>
  );
}
