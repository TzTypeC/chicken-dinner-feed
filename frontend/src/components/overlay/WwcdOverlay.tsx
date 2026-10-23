import type { IngestSourceKind, LiveMatchInfo, OverlayAppearance } from '@cdf/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlivePlayerBars } from './AlivePlayerBars';
import { appearanceToCssVariables } from './appearance';
import type { WwcdWinnerSummary } from './broadcast-state';
import { formatTeamSlot, ub } from './overlay-scale';

export interface WwcdOverlayProps {
  winner: WwcdWinnerSummary | null;
  matchInfo: LiveMatchInfo;
  appearance: OverlayAppearance;
  source?: IngestSourceKind;
  visible?: boolean;
}

/** Geometry in 1920×1080 design pixels. */
const CARD_WIDTH = 1160;
const BANNER_LEFT = 48;
const BANNER_WIDTH = 148;
/** How far the banner hangs past the card's bottom edge. */
const BANNER_OVERHANG = 44;
/** Depth of the swallowtail notch cut into the banner's hem. */
const BANNER_NOTCH = 28;
const CONTENT_LEFT = BANNER_LEFT + BANNER_WIDTH + 44;
const PLAQUE_CHAMFER = 18;

const BRONZE = '#816036';
const BRONZE_RULE = 'rgba(129, 96, 54, 0.55)';
const INK = '#160f0a';
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * The team name is the headline, so it is sized to the name rather than truncated: short names
 * get the full display size, long ones step down so they still fit on one line of the plaque.
 */
function teamNameSize(name: string): number {
  const length = name.trim().length;
  if (length <= 12) return 84;
  if (length <= 18) return 64;
  if (length <= 26) return 48;
  return 40;
}

/**
 * Winner Winner Chicken Dinner card (`docs/wwcd-screen-requirements.md`, `D-PMCC-03`).
 *
 * Drawn from the PMCC 2026 ID key visual's library hall: the winning squad's banner hangs from a
 * bronze rod, carrying the `#1`, logo and slot, over a dark plaque that holds the team name, squad
 * and points. The banner unfurling is the screen's single entrance moment.
 *
 * Squad line:
 * - PCOB mode (real player names): each player with alive/eliminated state and match kills.
 * - Manual mode (synthetic `Slot 1..4` names): the 4-segment `AlivePlayerBars` and a survivor
 *   count, never the synthetic names.
 */
export function WwcdOverlay({
  winner,
  matchInfo,
  appearance,
  source,
  visible = true,
}: WwcdOverlayProps) {
  const showLogos = appearance.showLogos ?? true;
  const showTeamNumbers = appearance.showTeamNumbers ?? true;
  const reduceMotion = useReducedMotion() ?? false;

  // Real player names are available only in PCOB/mock mode when players are not synthetic "Slot N"
  const hasRealPlayerNames =
    source !== 'manual' &&
    Boolean(
      winner &&
      winner.players.length > 0 &&
      winner.players.some((player) => !/^Slot\s+\d+$/i.test(player.name.trim())),
    );

  const mapName = matchInfo.mapName.trim();
  const matchContext = mapName
    ? `Match ${matchInfo.matchNumber}, ${mapName}`
    : `Match ${matchInfo.matchNumber}`;

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
        {visible && winner && (
          <motion.div
            key={`wwcd-${winner.teamNo}-${matchInfo.matchNumber}`}
            data-testid="wwcd-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.26, ease: 'easeIn' } }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="relative"
            style={{
              width: ub(CARD_WIDTH),
              color: 'var(--overlay-text)',
              // A filter rather than box-shadow: the plaque's chamfer is a clip-path, which would
              // cut a box-shadow off, and the banner needs the same lift off the gameplay.
              filter: `drop-shadow(0 ${ub(18)} ${ub(32)} rgba(0, 0, 0, 0.62))`,
            }}
          >
            {/* Plaque */}
            <div
              style={{
                backgroundColor: 'var(--overlay-bg)',
                clipPath: `polygon(0 0, 100% 0, 100% calc(100% - ${ub(PLAQUE_CHAMFER)}), calc(100% - ${ub(PLAQUE_CHAMFER)}) 100%, ${ub(PLAQUE_CHAMFER)} 100%, 0 calc(100% - ${ub(PLAQUE_CHAMFER)}))`,
                paddingLeft: ub(CONTENT_LEFT),
                paddingRight: ub(48),
                paddingTop: ub(30),
                paddingBottom: ub(30),
              }}
            >
              <motion.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.38, ease: 'easeOut' }}
              >
                <p
                  className="font-semibold tabular-nums"
                  style={{
                    fontSize: ub(17),
                    lineHeight: 1.2,
                    color: 'var(--overlay-text-muted)',
                  }}
                >
                  {matchContext}
                </p>

                {winner.sourceKind === 'preview' && (
                  <p
                    data-testid="wwcd-status-tag"
                    className="font-extrabold uppercase"
                    style={{
                      marginTop: ub(8),
                      fontSize: ub(14),
                      letterSpacing: ub(1.6),
                      color: 'var(--player-knocked)',
                    }}
                  >
                    Preview sample — not a result
                  </p>
                )}

                <h1
                  className="font-extrabold uppercase"
                  style={{
                    marginTop: ub(14),
                    fontSize: ub(24),
                    lineHeight: 1,
                    letterSpacing: '0.01em',
                    color: 'var(--overlay-text)',
                  }}
                >
                  WINNER WINNER CHICKEN DINNER
                </h1>

                <div
                  data-testid="wwcd-team-name"
                  className="truncate font-black uppercase"
                  style={{
                    marginTop: ub(6),
                    fontSize: ub(teamNameSize(winner.name)),
                    lineHeight: 1.08,
                    letterSpacing: '-0.01em',
                    color: 'var(--overlay-text)',
                  }}
                >
                  {winner.name}
                </div>

                {hasRealPlayerNames ? (
                  <ul
                    data-testid="wwcd-player-list"
                    className="flex flex-wrap"
                    style={{ marginTop: ub(16), columnGap: ub(36), rowGap: ub(8) }}
                  >
                    {winner.players.slice(0, 4).map((player, idx) => {
                      const isAlive = player.liveState !== 'dead';
                      return (
                        <li
                          key={`${player.name}-${idx}`}
                          className="flex min-w-0 items-center"
                          style={{ gap: ub(10), opacity: isAlive ? 1 : 0.5 }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: ub(4),
                              height: ub(18),
                              backgroundColor: isAlive
                                ? 'var(--player-alive)'
                                : 'var(--player-dead)',
                            }}
                          />
                          <span
                            className="truncate font-semibold"
                            style={{ fontSize: ub(17), maxWidth: ub(170) }}
                          >
                            {player.name}
                          </span>
                          <span
                            className="shrink-0 tabular-nums"
                            style={{ fontSize: ub(15), color: 'var(--overlay-text-muted)' }}
                          >
                            {player.kills} {player.kills === 1 ? 'elim' : 'elims'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div
                    data-testid="wwcd-survivor-bars"
                    className="flex items-end"
                    style={{ marginTop: ub(16), gap: ub(14) }}
                  >
                    {winner.players.length > 0 && <AlivePlayerBars players={winner.players} />}
                    {winner.aliveCount !== null && (
                      <span
                        className="font-semibold tabular-nums"
                        style={{ fontSize: ub(17), lineHeight: 1 }}
                      >
                        {winner.aliveCount} of 4 still standing
                      </span>
                    )}
                  </div>
                )}

                <dl
                  className="flex tabular-nums"
                  style={{
                    marginTop: ub(22),
                    paddingTop: ub(18),
                    borderTop: `${ub(1)} solid ${BRONZE_RULE}`,
                    gap: ub(64),
                  }}
                >
                  <WwcdStat
                    testId="wwcd-match-elims"
                    value={String(winner.eliminations)}
                    label="Eliminations"
                  />
                  <WwcdStat
                    testId="wwcd-match-pts"
                    value={`+${winner.matchPoints}`}
                    label={
                      winner.provisional ? 'Points this match (provisional)' : 'Points this match'
                    }
                  />
                  <WwcdStat
                    testId="wwcd-series-pts"
                    value={String(winner.seriesPoints)}
                    label={winner.provisional ? 'Series total (provisional)' : 'Series total'}
                  />
                </dl>
              </motion.div>
            </div>

            {/* Rod the banner hangs from, with the key visual's diamond finials */}
            <div
              aria-hidden
              className="absolute"
              style={{ left: 0, right: 0, top: 0, height: ub(2), backgroundColor: BRONZE }}
            >
              {(['left', 'right'] as const).map((side) => (
                <span
                  key={side}
                  className="absolute"
                  style={{
                    [side]: ub(-5),
                    top: ub(-4),
                    width: ub(10),
                    height: ub(10),
                    transform: 'rotate(45deg)',
                    backgroundColor: 'var(--overlay-accent)',
                  }}
                />
              ))}
            </div>

            {/* Banner: unfurls from the rod */}
            <motion.div
              className="absolute"
              initial={reduceMotion ? false : { clipPath: 'inset(0 0 100% 0)' }}
              animate={{ clipPath: 'inset(0 0 0% 0)' }}
              transition={{ duration: 0.62, delay: 0.08, ease: EASE_OUT }}
              style={{
                left: ub(BANNER_LEFT),
                width: ub(BANNER_WIDTH),
                top: ub(-4),
                bottom: ub(-BANNER_OVERHANG),
              }}
            >
              <div
                className="flex h-full flex-col items-center tabular-nums"
                style={{
                  paddingTop: ub(26),
                  gap: ub(16),
                  color: INK,
                  background: `linear-gradient(180deg, #eeb058 0%, var(--overlay-accent) 48%, #b67925 100%)`,
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - ${ub(BANNER_NOTCH)}), 0 100%)`,
                }}
              >
                <span className="font-black" style={{ fontSize: ub(56), lineHeight: 0.9 }}>
                  #1
                </span>

                {showLogos && (
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: ub(100),
                      height: ub(100),
                      padding: ub(10),
                      backgroundColor: INK,
                    }}
                  >
                    {winner.logoUrl ? (
                      <img
                        src={winner.logoUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <span
                        className="font-black"
                        style={{ fontSize: ub(26), color: 'var(--overlay-accent)' }}
                      >
                        {formatTeamSlot(winner.teamNo)}
                      </span>
                    )}
                  </div>
                )}

                {showTeamNumbers && (
                  <span
                    data-testid="wwcd-team-slot"
                    className="font-extrabold"
                    style={{ fontSize: ub(20), lineHeight: 1 }}
                  >
                    {formatTeamSlot(winner.teamNo)}
                  </span>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WwcdStat({ testId, value, label }: { testId: string; value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt style={{ fontSize: ub(15), lineHeight: 1.2, color: 'var(--overlay-text-muted)' }}>
        {label}
      </dt>
      <dd
        data-testid={testId}
        className="font-black"
        style={{ fontSize: ub(40), lineHeight: 1.05, marginBottom: ub(2) }}
      >
        {value}
      </dd>
    </div>
  );
}
