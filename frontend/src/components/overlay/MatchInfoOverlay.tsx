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
              borderRadius: u(4),
              backgroundColor: 'var(--overlay-bg)',
              color: 'var(--overlay-text)',
              boxShadow: `0 ${u(6)} ${u(18)} rgba(0, 0, 0, 0.42)`,
              border: `${u(1)} solid rgba(255, 255, 255, 0.12)`,
            }}
          >
            {/* Left Accent Strip */}
            <div
              style={{
                width: u(4),
                backgroundColor: 'var(--overlay-accent)',
              }}
            />

            {/* Match Number Segment */}
            <div
              className="flex items-center justify-center font-extrabold uppercase tabular-nums"
              style={{
                paddingInline: u(14),
                backgroundColor: 'var(--overlay-header-bg)',
                fontSize: u(15),
                letterSpacing: u(1.1),
                color: 'var(--overlay-text)',
                borderRight: showMapName ? `${u(1)} solid var(--overlay-accent)` : 'none',
              }}
            >
              MATCH {matchInfo.matchNumber}
            </div>

            {/* Map Name Segment */}
            {showMapName && (
              <div
                className="flex items-center justify-center font-bold uppercase"
                style={{
                  paddingInline: u(16),
                  fontSize: u(15),
                  letterSpacing: u(1.2),
                  color: 'var(--overlay-text)',
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
