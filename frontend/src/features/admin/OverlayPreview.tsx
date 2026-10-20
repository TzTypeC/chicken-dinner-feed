import { BellRing } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { resolveLeaderboardLayoutMode } from '@/components/overlay/broadcast-state';
import { useElementWidth } from '@/hooks/useElementWidth';
import type {
  OverlayPreviewLayerConfig,
  OverlayPreviewMessage,
  OverlayPreviewViewMode,
} from '@/pages/OverlayPage';
import { useLiveStore } from '@/stores/live-store';

type PreviewMode = 'canvas' | 'actual';

/** The broadcast canvas the overlay is authored against (ADR-0011). */
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export interface OverlayPreviewProps {
  instanceId: string;
}

/**
 * The overlay itself, embedded.
 *
 * Includes multi-layer preview toggles (`Leaderboard`, `Match Info`, `Elimination Alert`) and a
 * `Test Elimination Alert` button so operators can rehearse all three broadcast layers on the
 * 16:9 canvas without affecting on-air browser sources.
 */
export function OverlayPreview({ instanceId }: OverlayPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>('canvas');
  const [layers, setLayers] = useState<OverlayPreviewLayerConfig>({
    leaderboard: true,
    matchInfo: true,
    elimination: true,
    viewMode: 'auto',
  });

  const boxRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const boxWidth = useElementWidth(boxRef);

  const isCanvas = mode === 'canvas';
  const scale = isCanvas && boxWidth > 0 ? boxWidth / CANVAS_WIDTH : 1;

  const snapshot = useLiveStore((state) => state.snapshot);
  const liveMode = snapshot?.match
    ? resolveLeaderboardLayoutMode(snapshot.match, {
        showFinalFourLayout: true,
        showWwcdOverlay: true,
      })
    : 'tower';

  const viewMode = layers.viewMode ?? 'auto';
  const effectiveScreen = viewMode === 'auto' ? liveMode : viewMode;

  const previewPath =
    effectiveScreen === 'final-four'
      ? `/overlay/${instanceId}/final4`
      : effectiveScreen === 'wwcd'
        ? `/overlay/${instanceId}/wwcd`
        : effectiveScreen === 'postgame'
          ? `/overlay/${instanceId}/postgame`
          : `/overlay/${instanceId}`;

  const previewSrc = `${previewPath}?preview=1`;

  const postToIframe = (message: OverlayPreviewMessage) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(message, window.location.origin);
  };

  useEffect(() => {
    postToIframe({ type: 'cdf:preview-layers', layers });
  }, [layers]);

  const toggleLayer = (key: 'leaderboard' | 'matchInfo' | 'elimination') => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
  };

  const setViewMode = (viewMode: OverlayPreviewViewMode) => {
    setLayers((prev) => ({ ...prev, viewMode }));
  };

  const handleTestEliminationAlert = () => {
    setLayers((prev) => ({ ...prev, elimination: true }));
    postToIframe({ type: 'cdf:test-elimination-alert' });
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ['canvas', 'Full canvas'],
              ['actual', 'Actual size'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`min-h-8 rounded px-2.5 py-1 ${
                mode === value
                  ? 'bg-secondary font-medium'
                  : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleTestEliminationAlert}
          className="border-border hover:bg-secondary inline-flex min-h-8 items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium text-[var(--brand-gold)] transition-colors"
          title="Fire a simulated elimination banner in this preview window only"
        >
          <BellRing className="size-3.5" aria-hidden />
          <span>Test Elimination Alert</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground mr-1">Preview screen:</span>
        {(
          [
            ['auto', 'Auto (Live)'],
            ['tower', 'Tower'],
            ['final-four', 'Final-4'],
            ['wwcd', 'WWCD'],
            ['postgame', 'Post-Game'],
          ] as const
        ).map(([value, label]) => {
          const active = (layers.viewMode ?? 'auto') === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setViewMode(value)}
              aria-pressed={active}
              className={`min-h-7 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)] text-black font-semibold'
                  : 'border-border text-muted-foreground hover:text-foreground bg-transparent'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground mr-1">Preview layers:</span>
        {(
          [
            ['leaderboard', 'Leaderboard'],
            ['matchInfo', 'Match Info'],
            ['elimination', 'Elimination Alert'],
          ] as const
        ).map(([key, label]) => {
          const active = layers[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleLayer(key)}
              aria-pressed={active}
              className={`min-h-7 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]'
                  : 'border-border text-muted-foreground hover:text-foreground bg-transparent'
              }`}
            >
              {label}: {active ? 'ON' : 'OFF'}
            </button>
          );
        })}
      </div>

      <div
        ref={boxRef}
        className="border-border relative w-full rounded border"
        style={{
          backgroundColor: '#0a1420',
          ...(isCanvas
            ? { aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`, overflow: 'hidden' }
            : { height: 520, overflow: 'auto' }),
        }}
      >
        <iframe
          ref={iframeRef}
          key={`${instanceId}-${effectiveScreen}`}
          src={previewSrc}
          onLoad={() => postToIframe({ type: 'cdf:preview-layers', layers })}
          title={`Live preview of the ${instanceId} overlay (${effectiveScreen})`}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="pointer-events-none block border-0"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: isCanvas ? 'absolute' : 'static',
            top: 0,
            left: 0,
            backgroundColor: 'transparent',
          }}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        {isCanvas
          ? 'The whole 16∶9 frame — use this to judge placement. Collapse the sidebar for a bigger preview.'
          : 'True 1080p pixels — use this to judge colours and legibility.'}
      </p>
    </div>
  );
}
