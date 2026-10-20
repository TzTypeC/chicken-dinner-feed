import { DEFAULT_OVERLAY_APPEARANCE } from '@cdf/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { appearanceToAnimation, appearanceToPosition } from '@/components/overlay/appearance';
import {
  resolveLeaderboardLayoutMode,
  selectFinalFourCohort,
  selectPostGameResults,
  selectWwcdWinner,
  type LeaderboardLayoutMode,
} from '@/components/overlay/broadcast-state';
import { EliminationOverlay } from '@/components/overlay/EliminationOverlay';
import { FinalFourOverlay } from '@/components/overlay/FinalFourOverlay';
import { LeaderboardOverlay } from '@/components/overlay/LeaderboardOverlay';
import { MatchInfoOverlay } from '@/components/overlay/MatchInfoOverlay';
import { PostGameOverlay } from '@/components/overlay/PostGameOverlay';
import { WwcdOverlay } from '@/components/overlay/WwcdOverlay';
import { u } from '@/components/overlay/overlay-scale';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useEliminationQueue, type EliminationAlertItem } from '@/hooks/useEliminationQueue';
import { useLiveStore } from '@/stores/live-store';

export type OverlaySurfaceMode = 'leaderboard' | 'elimination' | 'match-info' | 'wwcd' | 'postgame';

export type OverlayPreviewViewMode = 'auto' | LeaderboardLayoutMode | 'postgame';

export interface OverlayPageProps {
  instanceId?: string;
  surfaceMode?: OverlaySurfaceMode;
}

export interface OverlayPreviewLayerConfig {
  leaderboard: boolean;
  matchInfo: boolean;
  elimination: boolean;
  viewMode?: OverlayPreviewViewMode;
}

export type OverlayPreviewMessage =
  | {
      type: 'cdf:preview-layers';
      layers: OverlayPreviewLayerConfig;
    }
  | {
      type: 'cdf:test-elimination-alert';
      alert?: Partial<EliminationAlertItem>;
    };

/**
 * A checkerboard drawn behind the panel when the page is embedded in the admin preview.
 *
 * Styled in dark espresso-charcoal tones so the PMCC 2026 gold/ivory overlays read accurately
 * while still showing which parts of the 1920×1080 canvas are transparent.
 */
const PREVIEW_BACKDROP: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: -1,
  backgroundColor: '#120c08',
  backgroundImage:
    'linear-gradient(45deg, #1f1610 25%, transparent 25%), linear-gradient(-45deg, #1f1610 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f1610 75%), linear-gradient(-45deg, transparent 75%, #1f1610 75%)',
  backgroundSize: '48px 48px',
  backgroundPosition: '0 0, 0 24px, 24px -24px, -24px 0px',
};

/**
 * A single overlay surface, rendered for consumption as a broadcast browser source.
 *
 * Supports five broadcast routes:
 * - `'leaderboard'` (`/overlay/:instanceId` — automatically transitions between Standard Tower,
 *   Final-4 Top Bar, and WWCD Victory Screen based on live alive-team count and appearance toggles)
 * - `'elimination'` (`/overlay/elimination` or `/overlay/:instanceId/elimination`)
 * - `'match-info'`  (`/overlay/match-info` or `/overlay/:instanceId/match-info`)
 * - `'wwcd'`        (`/overlay/wwcd` or `/overlay/:instanceId/wwcd`)
 * - `'postgame'`    (`/overlay/postgame` or `/overlay/:instanceId/postgame`)
 */
export function OverlayPage({ instanceId, surfaceMode = 'leaderboard' }: OverlayPageProps) {
  const [searchConfig] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      isPreview: params.has('preview'),
      queryInstanceId: params.get('instance') ?? undefined,
    };
  });

  const isPreview = searchConfig.isPreview;

  const [previewLayers, setPreviewLayers] = useState<OverlayPreviewLayerConfig>({
    leaderboard: true,
    matchInfo: false,
    elimination: true,
    viewMode: 'auto',
  });

  const snapshot = useLiveStore((state) => state.snapshot);
  const instances = useLiveStore((state) => state.instances);

  const requestedId = instanceId ?? searchConfig.queryInstanceId;
  const resolvedInstanceId =
    requestedId ?? (instances['main'] ? 'main' : (Object.keys(instances)[0] ?? 'main'));

  const overlay = useLiveStore((state) => state.overlayStates[resolvedInstanceId]);
  const instance = useLiveStore((state) => state.instances[resolvedInstanceId] ?? null);
  const protocolMismatch = useLiveStore((state) => state.protocolMismatch);
  const connect = useLiveStore((state) => state.connect);

  // Remembers the 4-squad cohort when the match first reaches 4 alive teams (`D-PMCC-02` / `A1`),
  // so when the 4th and 3rd teams are eliminated (leaving 3 or 2 alive), their cards stay in their
  // exact slots and turn gray rather than jumping or disappearing.
  const lockedFinalFourRef = useRef<{ matchId: string | null; teamNos: number[] } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.surface = 'overlay';
    return () => {
      delete document.documentElement.dataset.surface;
    };
  }, []);

  useEffect(
    () => connect(resolvedInstanceId, { isPreview }),
    [connect, resolvedInstanceId, isPreview],
  );

  const appearance = instance?.appearance ?? DEFAULT_OVERLAY_APPEARANCE;
  const eliminationEnabled =
    (surfaceMode === 'elimination' || (isPreview && previewLayers.elimination)) &&
    (appearance.showEliminationAlerts ?? true);

  const { activeAlert, triggerTestAlert } = useEliminationQueue(snapshot?.match ?? null, {
    enabled: eliminationEnabled,
  });

  useEffect(() => {
    if (!isPreview) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as OverlayPreviewMessage | null;
      if (!data || typeof data !== 'object' || !('type' in data)) return;

      if (data.type === 'cdf:preview-layers' && data.layers) {
        setPreviewLayers((prev) => ({
          ...prev,
          ...data.layers,
          viewMode: data.layers.viewMode ?? prev.viewMode ?? 'auto',
        }));
      } else if (data.type === 'cdf:test-elimination-alert') {
        setPreviewLayers((prev) => ({ ...prev, elimination: true }));
        triggerTestAlert(data.alert);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPreview, triggerTestAlert]);

  // Update the locked Final-4 cohort ref whenever the live match is at 4 standing teams (or reset
  // when >= 5 teams are alive or the match enters warmup / changes matchId).
  useEffect(() => {
    const match = snapshot?.match;
    if (!match) return;

    if (match.phase === 'idle') {
      lockedFinalFourRef.current = null;
      return;
    }

    const standing = match.teams.filter((team) => team.hasAppeared && !team.isEliminated);
    if (standing.length >= 5) {
      lockedFinalFourRef.current = null;
      return;
    }

    if (
      standing.length === 4 &&
      (lockedFinalFourRef.current === null || lockedFinalFourRef.current.matchId !== match.matchId)
    ) {
      lockedFinalFourRef.current = {
        matchId: match.matchId,
        teamNos: standing.map((team) => team.teamNo),
      };
    }
  }, [snapshot?.match]);

  const titlePrefix =
    surfaceMode === 'elimination'
      ? 'Elimination Alert'
      : surfaceMode === 'match-info'
        ? 'Match Info'
        : surfaceMode === 'wwcd'
          ? 'WWCD Victory'
          : surfaceMode === 'postgame'
            ? 'Post-Game Standings'
            : (instance?.name ?? resolvedInstanceId);
  useDocumentTitle(titlePrefix);

  if (protocolMismatch !== null) {
    return (
      <div
        style={{
          position: 'fixed',
          top: u(20),
          left: u(20),
          padding: u(12),
          borderRadius: u(4),
          background: 'oklch(0.35 0.15 25 / 0.92)',
          color: 'white',
          fontFamily: 'var(--overlay-font-family)',
          fontSize: u(14),
        }}
      >
        Overlay is out of date — the server speaks protocol v{protocolMismatch}. Reload this browser
        source.
      </div>
    );
  }

  if (!snapshot) return null;
  if (surfaceMode === 'leaderboard' && !overlay) return null;

  const animation = appearanceToAnimation(appearance);
  const matchInfo = snapshot.matchInfo ?? { matchNumber: 1, mapName: 'Erangel' };
  const lastClosedMap = snapshot.lastClosedMap ?? null;

  // Dedicated standalone routes:
  if (surfaceMode === 'elimination') {
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <EliminationOverlay alert={activeAlert} appearance={appearance} />
      </>
    );
  }

  if (surfaceMode === 'match-info') {
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <MatchInfoOverlay matchInfo={matchInfo} appearance={appearance} />
      </>
    );
  }

  if (surfaceMode === 'wwcd') {
    const winner = selectWwcdWinner(snapshot.match, lastClosedMap, {
      allowClosedMapFallback: true,
      isPreviewSimulation: isPreview,
    });
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <WwcdOverlay
          winner={winner}
          matchInfo={matchInfo}
          appearance={appearance}
          source={snapshot.ingest.source}
        />
      </>
    );
  }

  if (surfaceMode === 'postgame') {
    const board = selectPostGameResults(snapshot.match, lastClosedMap, matchInfo, {
      isPreviewSimulation: isPreview,
    });
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <PostGameOverlay board={board} matchInfo={matchInfo} appearance={appearance} />
      </>
    );
  }

  // Main leaderboard route (`/overlay/:instanceId`) + Admin multi-mode preview:
  const previewViewMode = isPreview ? (previewLayers.viewMode ?? 'auto') : 'auto';
  if (isPreview && previewViewMode === 'postgame') {
    const board = selectPostGameResults(snapshot.match, lastClosedMap, matchInfo, {
      isPreviewSimulation: true,
    });
    return (
      <>
        <div style={PREVIEW_BACKDROP} aria-hidden />
        <PostGameOverlay board={board} matchInfo={matchInfo} appearance={appearance} />
      </>
    );
  }

  const layoutOverride: LeaderboardLayoutMode | null =
    previewViewMode === 'tower' || previewViewMode === 'final-four' || previewViewMode === 'wwcd'
      ? previewViewMode
      : null;

  const activeLayoutMode = resolveLeaderboardLayoutMode(snapshot.match, appearance, layoutOverride);

  const lockedNos =
    lockedFinalFourRef.current?.matchId === snapshot.match.matchId
      ? lockedFinalFourRef.current.teamNos
      : null;

  return (
    <>
      {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}

      {isPreview && previewLayers.matchInfo && (
        <MatchInfoOverlay matchInfo={matchInfo} appearance={appearance} />
      )}

      {isPreview && previewLayers.elimination && (
        <EliminationOverlay alert={activeAlert} appearance={appearance} />
      )}

      {(!isPreview || previewLayers.leaderboard) && overlay && (
        <AnimatePresence mode="wait" initial={false}>
          {overlay.visible && activeLayoutMode === 'tower' && (
            <div key="layout-tower" style={appearanceToPosition(appearance)}>
              <motion.div
                key="panel"
                variants={animation.variants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <LeaderboardOverlay
                  match={snapshot.match}
                  appearance={appearance}
                  source={snapshot.ingest.source}
                  animateRows={animation.rowsEnabled}
                />
              </motion.div>
            </div>
          )}

          {overlay.visible && activeLayoutMode === 'final-four' && (
            <FinalFourOverlay
              key="layout-final-four"
              cohort={selectFinalFourCohort(
                snapshot.match,
                lockedNos,
                isPreview && previewViewMode === 'final-four',
              )}
              matchInfo={matchInfo}
              appearance={appearance}
              source={snapshot.ingest.source}
            />
          )}

          {overlay.visible && activeLayoutMode === 'wwcd' && (
            <WwcdOverlay
              key="layout-wwcd"
              winner={selectWwcdWinner(snapshot.match, lastClosedMap, {
                allowClosedMapFallback: isPreview && previewViewMode === 'wwcd',
                isPreviewSimulation: isPreview && previewViewMode === 'wwcd',
              })}
              matchInfo={matchInfo}
              appearance={appearance}
              source={snapshot.ingest.source}
            />
          )}
        </AnimatePresence>
      )}
    </>
  );
}
