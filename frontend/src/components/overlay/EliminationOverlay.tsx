import type { OverlayAppearance } from '@cdf/shared';
import { AnimatePresence, motion } from 'motion/react';
import type { EliminationAlertItem } from '@/hooks/useEliminationQueue';
import { appearanceToCssVariables } from './appearance';
import { u } from './overlay-scale';

export interface EliminationOverlayProps {
  alert: EliminationAlertItem | null;
  appearance: OverlayAppearance;
}

/**
 * Broadcast Team Elimination Notification Banner (`/overlay/elimination`).
 *
 * Anchored at top-center of the 1920×1080 broadcast frame (`top: u(42)`), leaving center gameplay,
 * top-left match info, and side leaderboard unobstructed.
 *
 * Respects:
 * - `appearance.showEliminationAlerts` (master toggle)
 * - `appearance.showLogos` (shows or collapses the team logo slot)
 * - `appearance.showEliminationAlertElims` (shows or hides the match eliminations stat pill)
 */
export function EliminationOverlay({ alert, appearance }: EliminationOverlayProps) {
  const showAlerts = appearance.showEliminationAlerts ?? true;
  const showLogos = appearance.showLogos ?? true;
  const showElims = appearance.showEliminationAlertElims ?? true;

  const placementValue = alert ? (alert.placement ?? alert.rank) : null;

  return (
    <div
      style={{
        ...appearanceToCssVariables(appearance),
        position: 'fixed',
        top: u(42),
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        pointerEvents: 'none',
        fontFamily: 'var(--overlay-font-family)',
      }}
    >
      <AnimatePresence mode="wait">
        {showAlerts && alert && (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{
              minWidth: u(440),
              maxWidth: u(620),
              backgroundColor: 'var(--overlay-bg)',
              color: 'var(--overlay-text)',
              borderRadius: u(5),
              overflow: 'hidden',
              boxShadow: `0 ${u(10)} ${u(28)} rgba(0, 0, 0, 0.55)`,
              border: `${u(1)} solid rgba(255, 255, 255, 0.12)`,
            }}
          >
            {/* Top accent bar */}
            <div
              style={{
                height: u(4),
                backgroundColor: 'var(--overlay-accent)',
              }}
            />

            <div
              className="flex items-stretch"
              style={{
                minHeight: u(64),
              }}
            >
              {/* Placement Rank Block */}
              <div
                className="flex flex-col items-center justify-center tabular-nums"
                style={{
                  minWidth: u(76),
                  paddingInline: u(14),
                  backgroundColor: 'var(--overlay-header-bg)',
                  borderRight: `${u(2)} solid var(--overlay-accent)`,
                }}
              >
                <span
                  className="font-bold uppercase"
                  style={{
                    fontSize: u(10),
                    letterSpacing: u(1.2),
                    color: 'var(--overlay-text-muted)',
                    lineHeight: 1.1,
                  }}
                >
                  RANK
                </span>
                <span
                  className="font-extrabold tabular-nums"
                  style={{
                    fontSize: u(24),
                    lineHeight: 1.15,
                    color: 'var(--overlay-text)',
                  }}
                >
                  #{placementValue}
                </span>
              </div>

              {/* Main Identity Body */}
              <div
                className="flex flex-1 items-center"
                style={{
                  paddingInline: u(16),
                  paddingBlock: u(10),
                  gap: u(14),
                  minWidth: 0,
                }}
              >
                {showLogos && (
                  <div
                    className="flex shrink-0 items-center justify-center"
                    style={{
                      width: u(44),
                      height: u(44),
                    }}
                  >
                    {alert.logoUrl ? (
                      <img
                        src={alert.logoUrl}
                        alt=""
                        style={{
                          width: u(44),
                          height: u(44),
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center font-bold"
                        style={{
                          width: u(40),
                          height: u(40),
                          borderRadius: u(4),
                          backgroundColor: 'var(--overlay-row-alt-bg)',
                          border: `${u(1)} solid var(--overlay-text-muted)`,
                          color: 'var(--overlay-text-muted)',
                          fontSize: u(14),
                        }}
                      >
                        #{alert.teamNo}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <span
                    className="truncate font-extrabold uppercase tracking-wide"
                    style={{
                      fontSize: u(20),
                      lineHeight: 1.15,
                      color: 'var(--overlay-text)',
                    }}
                  >
                    {alert.teamName}
                  </span>
                  <div
                    className="flex items-center"
                    style={{
                      gap: u(6),
                      marginTop: u(3),
                    }}
                  >
                    <span
                      style={{
                        width: u(7),
                        height: u(7),
                        borderRadius: '50%',
                        backgroundColor: 'var(--overlay-accent)',
                      }}
                    />
                    <span
                      className="font-bold uppercase"
                      style={{
                        fontSize: u(11),
                        letterSpacing: u(1.4),
                        color: 'var(--overlay-text-muted)',
                      }}
                    >
                      TEAM ELIMINATED
                    </span>
                  </div>
                </div>
              </div>

              {/* Optional Match Eliminations Counter */}
              {showElims && (
                <div
                  className="flex flex-col items-center justify-center tabular-nums"
                  style={{
                    minWidth: u(82),
                    paddingInline: u(14),
                    backgroundColor: 'var(--overlay-header-bg)',
                    borderLeft: `${u(1)} solid rgba(255, 255, 255, 0.1)`,
                  }}
                >
                  <span
                    className="font-extrabold tabular-nums"
                    style={{
                      fontSize: u(22),
                      lineHeight: 1.15,
                      color: 'var(--overlay-text)',
                    }}
                  >
                    {alert.eliminations}
                  </span>
                  <span
                    className="font-bold uppercase"
                    style={{
                      fontSize: u(10),
                      letterSpacing: u(1.1),
                      color: 'var(--overlay-text-muted)',
                      lineHeight: 1.1,
                    }}
                  >
                    {alert.eliminations === 1 ? 'ELIM' : 'ELIMS'}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
