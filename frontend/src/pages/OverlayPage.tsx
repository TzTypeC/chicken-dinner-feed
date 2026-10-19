import { DEFAULT_OVERLAY_APPEARANCE } from '@cdf/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type CSSProperties } from 'react';
import { appearanceToAnimation, appearanceToPosition } from '@/components/overlay/appearance';
import { EliminationOverlay } from '@/components/overlay/EliminationOverlay';
import { LeaderboardOverlay } from '@/components/overlay/LeaderboardOverlay';
import { MatchInfoOverlay } from '@/components/overlay/MatchInfoOverlay';
import { u } from '@/components/overlay/overlay-scale';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useEliminationQueue, type EliminationAlertItem } from '@/hooks/useEliminationQueue';
import { useLiveStore } from '@/stores/live-store';

export type OverlaySurfaceMode = 'leaderboard' | 'elimination' | 'match-info';

export interface OverlayPageProps {
  instanceId?: string;
  surfaceMode?: OverlaySurfaceMode;
}

export interface OverlayPreviewLayerConfig {
  leaderboard: boolean;
  matchInfo: boolean;
  elimination: boolean;
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
 * An iframe cannot show the page behind it here: with no background of its own, the embedded
 * document still paints a canvas, and its colour comes from `color-scheme` — white by default, with
 * no value that means "transparent". A real browser source is composited transparently by the
 * broadcast software itself, so this never applies on air; the marker only ever arrives from the
 * admin, which appends it to the address.
 */
const PREVIEW_BACKDROP: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: -1,
  backgroundColor: '#0a1420',
  backgroundImage:
    'linear-gradient(45deg, #16283c 25%, transparent 25%), linear-gradient(-45deg, #16283c 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #16283c 75%), linear-gradient(-45deg, transparent 75%, #16283c 75%)',
  backgroundSize: '48px 48px',
  backgroundPosition: '0 0, 0 24px, 24px -24px, -24px 0px',
};

/**
 * A single overlay surface, rendered for consumption as a broadcast browser source.
 *
 * Supports three independent broadcast routes:
 * - `'leaderboard'` (`/overlay/:instanceId`)
 * - `'elimination'` (`/overlay/elimination` or `/overlay/:instanceId/elimination`)
 * - `'match-info'`  (`/overlay/match-info` or `/overlay/:instanceId/match-info`)
 */
export function OverlayPage({ instanceId, surfaceMode = 'leaderboard' }: OverlayPageProps) {
  // Read URL search params once on mount.
  const [searchConfig] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      isPreview: params.has('preview'),
      queryInstanceId: params.get('instance') ?? undefined,
    };
  });

  const isPreview = searchConfig.isPreview;

  // Multi-layer preview state when embedded in the admin OverlayPreview iframe.
  const [previewLayers, setPreviewLayers] = useState<OverlayPreviewLayerConfig>({
    leaderboard: true,
    matchInfo: false,
    elimination: true,
  });

  const snapshot = useLiveStore((state) => state.snapshot);
  const instances = useLiveStore((state) => state.instances);

  // Resolve effective instance ID: route param -> ?instance= query param -> 'main' -> first available instance
  const requestedId = instanceId ?? searchConfig.queryInstanceId;
  const resolvedInstanceId =
    requestedId ?? (instances['main'] ? 'main' : (Object.keys(instances)[0] ?? 'main'));

  const overlay = useLiveStore((state) => state.overlayStates[resolvedInstanceId]);
  const instance = useLiveStore((state) => state.instances[resolvedInstanceId] ?? null);
  const protocolMismatch = useLiveStore((state) => state.protocolMismatch);
  const connect = useLiveStore((state) => state.connect);

  useEffect(() => {
    // Marks the whole document as a broadcast surface: transparent, no cursor, no scrollbars.
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

  // Listen for preview control messages from the parent Admin OverlayPreview component.
  useEffect(() => {
    if (!isPreview) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as OverlayPreviewMessage | null;
      if (!data || typeof data !== 'object' || !('type' in data)) return;

      if (data.type === 'cdf:preview-layers' && data.layers) {
        setPreviewLayers(data.layers);
      } else if (data.type === 'cdf:test-elimination-alert') {
        setPreviewLayers((prev) => ({ ...prev, elimination: true }));
        triggerTestAlert(data.alert);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPreview, triggerTestAlert]);

  const titlePrefix =
    surfaceMode === 'elimination'
      ? 'Elimination Alert'
      : surfaceMode === 'match-info'
        ? 'Match Info'
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
        <div style={appearanceToPosition(appearance)}>
          {/*
           * `initial={false}` suppresses the animation on first paint only: an overlay that was already
           * on air when the page loaded must simply be there, not slide in as though a director had
           * just triggered it. Later show/hide transitions animate normally.
           */}
          <AnimatePresence initial={false}>
            {overlay.visible && (
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
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
