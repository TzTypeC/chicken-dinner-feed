import type { LiveMatchInfo, OverlayAppearance } from '@cdf/shared';
import { AnimatePresence, motion } from 'motion/react';
import { appearanceToCssVariables } from './appearance';
import { u } from './overlay-scale';

export interface MatchInfoOverlayProps {
  matchInfo: LiveMatchInfo;
  appearance: OverlayAppearance;
  visible?: boolean;
}

/**
 * Broadcast Match Information Overlay (`/overlay/match-info`).
 *
 * Displays the active match number (`MATCH N`) and, when enabled via
 * `appearance.showMatchInfoMapName`, the active map name (`ERANGEL`, `MIRAMAR`, etc.).
 */
export function MatchInfoOverlay({ matchInfo, appearance, visible = true }: MatchInfoOverlayProps) {
  const showMatchInfo = (appearance.showMatchInfo ?? true) && visible;
  const showMapName =
    (appearance.showMatchInfoMapName ?? true) && matchInfo.mapName.trim().length > 0;

  return (
    <div
      style={{
        ...appearanceToCssVariables(appearance),
        position: 'fixed',
        top: u(36),
        left: u(40),
        zIndex: 15,
        pointerEvents: 'none',
        fontFamily: 'var(--overlay-font-family)',
      }}
    >
      <AnimatePresence initial={false}>
        {showMatchInfo && (
          <motion.div
            key="match-info-pill"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-stretch overflow-hidden"
            style={{
              height: u(42),
              borderRadius: u(3),
              backgroundColor: 'var(--overlay-bg)',
              color: 'var(--overlay-text)',
              boxShadow: `0 ${u(8)} ${u(22)} rgba(0, 0, 0, 0.52)`,
              border: `${u(1)} solid rgba(129, 96, 54, 0.65)`,
            }}
          >
            {/* Left PMCC Collegiate Gold Banner Strip */}
            <div
              style={{
                width: u(4),
                background:
                  'linear-gradient(180deg, var(--overlay-accent) 0%, rgba(129, 96, 54, 0.9) 100%)',
              }}
            />

            {/* Match Number Segment */}
            <div
              className="flex items-center justify-center font-extrabold uppercase tabular-nums"
              style={{
                paddingInline: u(14),
                gap: u(6),
                backgroundColor: 'var(--overlay-header-bg)',
                fontSize: u(15),
                letterSpacing: u(1.1),
                color: 'var(--overlay-text)',
                borderRight: showMapName ? `${u(1)} solid rgba(129, 96, 54, 0.65)` : 'none',
              }}
            >
              <span
                aria-hidden
                style={{
                  fontSize: u(10),
                  color: 'var(--overlay-accent)',
                  lineHeight: 1,
                }}
              >
                ◇
              </span>
              <span>MATCH {matchInfo.matchNumber}</span>
            </div>

            {/* Map Name Segment */}
            {showMapName && (
              <div
                className="flex items-center justify-center font-bold uppercase"
                style={{
                  paddingInline: u(16),
                  fontSize: u(15),
                  letterSpacing: u(1.2),
                  color: 'var(--overlay-accent)',
                }}
              >
                {matchInfo.mapName.trim()}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
