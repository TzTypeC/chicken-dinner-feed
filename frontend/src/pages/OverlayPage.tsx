import {
  DEFAULT_INSTANCE_ID_BY_TYPE,
  DEFAULT_OVERLAY_APPEARANCE,
  type AutoWwcdVariant,
  type LiveSnapshot,
  type OverlayInstance,
  type OverlayType,
  type OverlayVisibility,
} from '@cdf/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { appearanceToAnimation, appearanceToPosition } from '@/components/overlay/appearance';
import {
  isPinnedPostGameMatchUnavailable,
  resolveActiveAutoWwcdVariant,
  resolveLeaderboardLayoutMode,
  selectFinalFourCohort,
  selectPostGameResults,
  selectSeriesStandings,
  selectWwcdWinner,
  type LeaderboardLayoutMode,
  type WwcdVariantLatch,
} from '@/components/overlay/broadcast-state';
import { EliminationOverlay } from '@/components/overlay/EliminationOverlay';
import { FinalFourOverlay } from '@/components/overlay/FinalFourOverlay';
import { FullscreenWwcdOverlay } from '@/components/overlay/FullscreenWwcdOverlay';
import { LeaderboardOverlay } from '@/components/overlay/LeaderboardOverlay';
import { MatchInfoOverlay } from '@/components/overlay/MatchInfoOverlay';
import { PostGameOverlay } from '@/components/overlay/PostGameOverlay';
import { PostGameSeriesOverlay } from '@/components/overlay/PostGameSeriesOverlay';
import { WwcdOverlay } from '@/components/overlay/WwcdOverlay';
import { u } from '@/components/overlay/overlay-scale';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useEliminationQueue, type EliminationAlertItem } from '@/hooks/useEliminationQueue';
import { useLiveStore } from '@/stores/live-store';

export type OverlaySurfaceMode =
  | 'auto'
  | 'leaderboard'
  | 'final-four'
  | 'elimination'
  | 'match-info'
  | 'wwcd'
  | 'wwcd-fullscreen'
  | 'postgame'
  | 'postgame-match'
  | 'postgame-series';

export type OverlayPreviewViewMode =
  'auto' | LeaderboardLayoutMode | 'wwcd-fullscreen' | 'postgame' | 'postgame-series';

export interface OverlayPageProps {
  instanceId?: string;
  surfaceMode?: OverlaySurfaceMode;
  snapshot?: LiveSnapshot | null;
  instance?: OverlayInstance | null;
  overlayState?: OverlayVisibility | null;
  autoWwcdVariant?: AutoWwcdVariant;
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

function defaultInstanceIdForSurface(
  surfaceMode: OverlaySurfaceMode,
  storeInstances: Record<string, OverlayInstance | null>,
): string {
  switch (surfaceMode) {
    case 'final-four':
      return DEFAULT_INSTANCE_ID_BY_TYPE.final4;
    case 'match-info':
      return DEFAULT_INSTANCE_ID_BY_TYPE['match-info'];
    case 'elimination':
      return DEFAULT_INSTANCE_ID_BY_TYPE.elimination;
    case 'wwcd':
      return DEFAULT_INSTANCE_ID_BY_TYPE.wwcd;
    case 'wwcd-fullscreen':
      return DEFAULT_INSTANCE_ID_BY_TYPE['wwcd-fullscreen'];
    case 'postgame':
    case 'postgame-match':
      return DEFAULT_INSTANCE_ID_BY_TYPE['postgame-match'];
    case 'postgame-series':
      return DEFAULT_INSTANCE_ID_BY_TYPE['postgame-series'];
    case 'leaderboard':
    case 'auto':
    default:
      return storeInstances['main'] ? 'main' : (Object.keys(storeInstances)[0] ?? 'main');
  }
}

function surfaceFromInstanceType(
  type: OverlayType | undefined,
): Exclude<OverlaySurfaceMode, 'auto' | 'postgame-match'> {
  switch (type) {
    case 'final4':
      return 'final-four';
    case 'match-info':
      return 'match-info';
    case 'elimination':
      return 'elimination';
    case 'wwcd':
      return 'wwcd';
    case 'wwcd-fullscreen':
      return 'wwcd-fullscreen';
    case 'postgame-match':
      return 'postgame';
    case 'postgame-series':
      return 'postgame-series';
    case 'leaderboard':
    default:
      return 'leaderboard';
  }
}

/**
 * A single overlay surface, rendered for consumption as a broadcast browser source.
 *
 * Supports all 8 overlay types with independent per-instance configuration, ON AIR / HIDE controls,
 * selectable automatic WWCD presentation (`D-PMCC-08`), and historical Postgame Match selection (`D-PMCC-09`).
 */
export function OverlayPage({
  instanceId,
  surfaceMode = 'leaderboard',
  snapshot: propSnapshot,
  instance: propInstance,
  overlayState: propOverlayState,
  autoWwcdVariant: propAutoWwcdVariant,
}: OverlayPageProps) {
  const [searchConfig] = useState(() => {
    if (typeof window === 'undefined') {
      return { isPreview: false, queryInstanceId: undefined };
    }
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
  /** Extended-mode leftward widening reported by the tower (Part 8), in design px. */
  const [towerExtension, setTowerExtension] = useState(0);

  const storeSnapshot = useLiveStore((state) => state.snapshot);
  const storeInstances = useLiveStore((state) => state.instances);
  const storeAutoWwcdVariant = useLiveStore((state) => state.autoWwcdVariant);
  const snapshot = propSnapshot !== undefined ? propSnapshot : storeSnapshot;

  const requestedId = instanceId ?? searchConfig.queryInstanceId;
  const resolvedInstanceId =
    requestedId ?? defaultInstanceIdForSurface(surfaceMode, storeInstances);

  const storeOverlay = useLiveStore((state) => state.overlayStates[resolvedInstanceId]);
  const storeInstance = useLiveStore((state) => state.instances[resolvedInstanceId] ?? null);

  const overlay = propOverlayState !== undefined ? propOverlayState : storeOverlay;
  const instance = propInstance !== undefined ? propInstance : storeInstance;
  const protocolMismatch = useLiveStore((state) => state.protocolMismatch);
  const connect = useLiveStore((state) => state.connect);

  const effectiveSurface: Exclude<OverlaySurfaceMode, 'auto' | 'postgame-match'> =
    surfaceMode === 'auto'
      ? surfaceFromInstanceType(instance?.type)
      : surfaceMode === 'postgame-match'
        ? 'postgame'
        : surfaceMode;

  // Remembers the 4-squad cohort when the match first reaches 4 alive teams (`D-PMCC-02` / `A1`).
  const lockedFinalFourRef = useRef<{ matchId: string | null; teamNos: number[] } | null>(null);

  // Latches the automatic WWCD variant while an active WWCD celebration is running so changing the
  // preference mid-WWCD does not replay or switch victory animations (`D-PMCC-08` Req 10).
  const latchedWwcdRef = useRef<WwcdVariantLatch | null>(null);

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
  const isEnabled = instance?.enabled ?? true;
  const isOnAir = overlay ? overlay.visible : (instance?.onAir ?? true);
  const isOperatorVisible = isEnabled && isOnAir;

  const eliminationEnabled =
    isOperatorVisible &&
    (effectiveSurface === 'elimination' || (isPreview && previewLayers.elimination)) &&
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
    effectiveSurface === 'elimination'
      ? 'Elimination Alert'
      : effectiveSurface === 'match-info'
        ? 'Match Info'
        : effectiveSurface === 'final-four'
          ? 'Final-4 Leaderboard'
          : effectiveSurface === 'wwcd'
            ? 'WWCD Victory'
            : effectiveSurface === 'wwcd-fullscreen'
              ? 'WWCD Fullscreen'
              : effectiveSurface === 'postgame'
                ? 'Post-Game Match Standings'
                : effectiveSurface === 'postgame-series'
                  ? 'Post-Game Series Standings'
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
  if (effectiveSurface === 'leaderboard' && !overlay && !instance) return null;

  const animation = appearanceToAnimation(appearance);
  const matchInfo = snapshot.matchInfo ?? { matchNumber: 1, mapName: 'Erangel' };
  const lastClosedMap = snapshot.lastClosedMap ?? null;
  const closedMaps = snapshot.closedMaps ?? (lastClosedMap ? [lastClosedMap] : []);

  const previewViewMode = isPreview ? (previewLayers.viewMode ?? 'auto') : 'auto';
  const layoutOverride: LeaderboardLayoutMode | null =
    previewViewMode === 'tower' || previewViewMode === 'final-four' || previewViewMode === 'wwcd'
      ? previewViewMode
      : null;

  const activeLayoutMode = resolveLeaderboardLayoutMode(snapshot.match, appearance, layoutOverride);

  const configuredAutoWwcd: AutoWwcdVariant =
    propAutoWwcdVariant ?? snapshot.autoWwcdVariant ?? storeAutoWwcdVariant ?? 'standard';
  const { effectiveVariant: effectiveAutoWwcdVariant, nextLatch } = resolveActiveAutoWwcdVariant(
    activeLayoutMode,
    snapshot.match.matchId,
    configuredAutoWwcd,
    latchedWwcdRef.current,
  );
  latchedWwcdRef.current = nextLatch;

  const lockedNos =
    lockedFinalFourRef.current?.matchId === snapshot.match.matchId
      ? lockedFinalFourRef.current.teamNos
      : null;

  // Dedicated standalone & typed instance routes:
  if (effectiveSurface === 'elimination') {
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <EliminationOverlay
          alert={isOperatorVisible ? activeAlert : null}
          appearance={appearance}
          finalFourActive={activeLayoutMode === 'final-four'}
        />
      </>
    );
  }

  if (effectiveSurface === 'match-info') {
    const isMatchInfoVisible =
      isOperatorVisible && (appearance.showMatchInfo ?? true) && activeLayoutMode === 'tower';
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <MatchInfoOverlay
          matchInfo={matchInfo}
          appearance={appearance}
          visible={isMatchInfoVisible}
        />
      </>
    );
  }

  if (effectiveSurface === 'final-four') {
    const isPreviewingFinalFour =
      isPreview && (previewViewMode === 'final-four' || instance?.type === 'final4');
    const isFinalFourVisible =
      isOperatorVisible &&
      (appearance.showFinalFourLayout ?? true) &&
      (activeLayoutMode === 'final-four' || isPreviewingFinalFour);
    const cohort = selectFinalFourCohort(snapshot.match, lockedNos, isPreviewingFinalFour);
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <FinalFourOverlay
          cohort={cohort}
          matchInfo={matchInfo}
          appearance={appearance}
          source={snapshot.ingest.source}
          visible={isFinalFourVisible}
        />
      </>
    );
  }

  if (effectiveSurface === 'wwcd') {
    const isPreviewingWwcd = isPreview && (previewViewMode === 'wwcd' || instance?.type === 'wwcd');
    const isWwcdVisible =
      isOperatorVisible &&
      (appearance.showWwcdOverlay ?? true) &&
      ((activeLayoutMode === 'wwcd' &&
        (effectiveAutoWwcdVariant === 'standard' || effectiveAutoWwcdVariant === 'dual')) ||
        isPreviewingWwcd);
    const winner = selectWwcdWinner(snapshot.match, lastClosedMap, {
      allowClosedMapFallback: true,
      isPreviewSimulation: isPreviewingWwcd,
    });
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <WwcdOverlay
          winner={winner}
          matchInfo={matchInfo}
          appearance={appearance}
          source={snapshot.ingest.source}
          visible={isWwcdVisible}
        />
      </>
    );
  }

  if (effectiveSurface === 'wwcd-fullscreen') {
    const isPreviewingFullscreenWwcd =
      isPreview &&
      (previewViewMode === 'wwcd' ||
        previewViewMode === 'wwcd-fullscreen' ||
        instance?.type === 'wwcd-fullscreen');
    const isFullscreenWwcdVisible =
      isOperatorVisible &&
      (appearance.showWwcdOverlay ?? true) &&
      ((activeLayoutMode === 'wwcd' &&
        (effectiveAutoWwcdVariant === 'fullscreen' || effectiveAutoWwcdVariant === 'dual')) ||
        isPreviewingFullscreenWwcd);
    const winner = selectWwcdWinner(snapshot.match, lastClosedMap, {
      allowClosedMapFallback: true,
      isPreviewSimulation: isPreviewingFullscreenWwcd,
    });
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <FullscreenWwcdOverlay
          winner={winner}
          matchInfo={matchInfo}
          appearance={appearance}
          totalTeams={snapshot.match.teams.length > 0 ? snapshot.match.teams.length : 25}
          source={snapshot.ingest.source}
          visible={isFullscreenWwcdVisible}
        />
      </>
    );
  }

  if (effectiveSurface === 'postgame') {
    const unavailableSelection = isPinnedPostGameMatchUnavailable(
      appearance.postGameMatchSelection,
      closedMaps,
      lastClosedMap,
    );
    const board = selectPostGameResults(snapshot.match, lastClosedMap, matchInfo, {
      isPreviewSimulation: isPreview,
      closedMaps,
      postGameMatchSelection: appearance.postGameMatchSelection,
    });
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <AnimatePresence mode="wait" initial={false}>
          {isOperatorVisible && (
            <motion.div
              key="postgame-match-surface"
              variants={animation.variants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <PostGameOverlay
                board={board}
                matchInfo={matchInfo}
                appearance={appearance}
                unavailableSelection={unavailableSelection}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  if (effectiveSurface === 'postgame-series') {
    const board = selectSeriesStandings(snapshot.match, closedMaps, {
      isPreviewSimulation: isPreview,
      lastClosedMap,
    });
    return (
      <>
        {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}
        <AnimatePresence mode="wait" initial={false}>
          {isOperatorVisible && (
            <motion.div
              key="postgame-series-surface"
              variants={animation.variants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <PostGameSeriesOverlay board={board} matchInfo={matchInfo} appearance={appearance} />
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Main leaderboard route (`/overlay/:instanceId` when type==='leaderboard', `/overlay/:instanceId/main`, & `/main`):
  // Strictly renders LeaderboardOverlay only. When in Final-4 or WWCD, the vertical tower hides cleanly.
  return (
    <>
      {isPreview && <div style={PREVIEW_BACKDROP} aria-hidden />}

      {isPreview && previewLayers.matchInfo && (
        <MatchInfoOverlay
          matchInfo={matchInfo}
          appearance={appearance}
          visible={activeLayoutMode === 'tower'}
        />
      )}

      {isPreview && previewLayers.elimination && (
        <EliminationOverlay
          alert={activeAlert}
          appearance={appearance}
          finalFourActive={activeLayoutMode === 'final-four'}
        />
      )}

      {(!isPreview || previewLayers.leaderboard) && (
        <AnimatePresence mode="wait" initial={false}>
          {isOperatorVisible && activeLayoutMode === 'tower' && (
            <div key="layout-tower" style={appearanceToPosition(appearance, towerExtension)}>
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
                  onExtensionChange={setTowerExtension}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      )}
    </>
  );
}
