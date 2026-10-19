import { getEffectiveMatchNumber, PUBG_MAP_PRESETS, type SeriesDocument } from '@cdf/shared';
import { ChevronDown, ChevronUp, MapPin, SkipForward } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useLiveStore } from '@/stores/live-store';
import { toast } from '@/stores/toast-store';

const STORAGE_KEY = 'cdf.admin.matchConfigBar.open';

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

export interface MatchConfigBarProps {
  seriesDocument?: SeriesDocument | null;
  onSeriesUpdated?: (document: SeriesDocument) => void;
}

/**
 * Shared Match & Map Configuration Bar (`D-UI-03`).
 *
 * Placed in both `Series control` and `Manual control` tabs so operators can configure the active
 * Match Number and Map Name without switching tabs. Uses a safe Draft -> "Apply to Live" workflow
 * so mid-typing edits never flash on air prematurely.
 */
export function MatchConfigBar({ seriesDocument, onSeriesUpdated }: MatchConfigBarProps) {
  const liveMatchInfo = useLiveStore((state) => state.snapshot?.matchInfo ?? null);

  const [expanded, setExpanded] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'collapsed');
  const [localSeries, setLocalSeries] = useState<SeriesDocument | null>(seriesDocument ?? null);
  const [saving, setSaving] = useState(false);

  const effectiveDoc = seriesDocument ?? localSeries;
  const autoMatchNumber = (effectiveDoc?.closedMaps.length ?? 0) + 1;

  const liveMatchNumber =
    liveMatchInfo?.matchNumber ?? (effectiveDoc ? getEffectiveMatchNumber(effectiveDoc) : 1);
  const liveMapName = liveMatchInfo?.mapName ?? effectiveDoc?.activeMapName ?? 'Erangel';

  const [useAutoNumber, setUseAutoNumber] = useState<boolean>(
    () => (effectiveDoc?.activeMatchNumber ?? null) === null,
  );
  const [draftMatchNumber, setDraftMatchNumber] = useState<number>(liveMatchNumber);
  const [draftMapName, setDraftMapName] = useState<string>(liveMapName);
  const [hasEditedDraft, setHasEditedDraft] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, expanded ? 'open' : 'collapsed');
  }, [expanded]);

  // Fetch series document if parent did not supply one.
  useEffect(() => {
    if (seriesDocument !== undefined) {
      setLocalSeries(seriesDocument);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.getSeries();
        if (!cancelled) {
          setLocalSeries(res.document);
        }
      } catch {
        // Non-blocking: liveMatchInfo from WebSocket still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seriesDocument]);

  // Sync draft with live values whenever operator does not have unsaved local edits.
  useEffect(() => {
    if (hasEditedDraft) return;
    setDraftMatchNumber(liveMatchNumber);
    setDraftMapName(liveMapName);
    if (effectiveDoc) {
      setUseAutoNumber(effectiveDoc.activeMatchNumber === null);
    }
  }, [liveMatchNumber, liveMapName, effectiveDoc, hasEditedDraft]);

  const effectiveDraftNumber = useAutoNumber ? autoMatchNumber : draftMatchNumber;
  const trimmedMapName = draftMapName.trim();
  const isDirty =
    hasEditedDraft &&
    (effectiveDraftNumber !== liveMatchNumber ||
      trimmedMapName !== liveMapName ||
      (effectiveDoc !== null &&
        (useAutoNumber ? null : draftMatchNumber) !== effectiveDoc.activeMatchNumber));

  const applyPatch = async (
    nextMatchNumber: number | null,
    nextMapName: string,
    summaryLabel?: string,
  ) => {
    const cleanMap = nextMapName.trim() || 'Erangel';
    setSaving(true);
    try {
      const updated = await api.updateSeriesMatchInfo({
        activeMatchNumber: nextMatchNumber,
        activeMapName: cleanMap,
      });
      setLocalSeries(updated);
      onSeriesUpdated?.(updated);
      const resolvedNum = getEffectiveMatchNumber(updated);
      setUseAutoNumber(updated.activeMatchNumber === null);
      setDraftMatchNumber(resolvedNum);
      setDraftMapName(updated.activeMapName);
      setHasEditedDraft(false);
      toast.success(
        summaryLabel ?? `Live: Match ${resolvedNum} — ${updated.activeMapName}`,
        'Match info overlay updated on air.',
      );
    } catch (error) {
      toast.error('Could not update match info', describe(error));
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToLive = () => {
    const numToSave = useAutoNumber
      ? null
      : Math.max(1, Math.min(99, Math.round(draftMatchNumber || 1)));
    void applyPatch(numToSave, draftMapName);
  };

  const handleNextMatch = () => {
    const nextNumber = Math.min(99, liveMatchNumber + 1);
    void applyPatch(
      nextNumber,
      trimmedMapName || liveMapName,
      `Advanced to Match ${nextNumber} — ${trimmedMapName || liveMapName}`,
    );
  };

  const handleResetDraft = () => {
    setDraftMatchNumber(liveMatchNumber);
    setDraftMapName(liveMapName);
    setUseAutoNumber((effectiveDoc?.activeMatchNumber ?? null) === null);
    setHasEditedDraft(false);
  };

  return (
    <section
      className="border-border bg-secondary/20 rounded-md border p-3 sm:p-4"
      aria-label="Match and map configuration"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <MapPin className="size-4 text-[var(--brand-gold)]" aria-hidden />
            <span>Match &amp; Map Info</span>
          </div>

          <div
            className="flex items-center gap-1.5 rounded border border-[var(--brand-gold)]/40 bg-black/35 px-2.5 py-1 text-xs font-semibold tracking-wide uppercase"
            title="Currently broadcasting on /overlay/match-info"
          >
            <span className="size-2 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-[var(--brand-gold)] tabular-nums">MATCH {liveMatchNumber}</span>
            <span className="text-muted-foreground">&middot;</span>
            <span className="text-foreground">{liveMapName}</span>
          </div>

          {isDirty && (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
              Unsaved draft
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleNextMatch}
            className="border-border hover:bg-secondary inline-flex min-h-9 items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40"
            title="Immediately increment live match number by 1"
          >
            <SkipForward className="size-3.5" aria-hidden />
            <span>Next Match (+1)</span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="border-border hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1 rounded border px-2.5 py-1 text-xs transition-colors"
          >
            <span>{expanded ? 'Hide controls' : 'Configure'}</span>
            {expanded ? (
              <ChevronUp className="size-3.5" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-border/70 mt-3 grid gap-3 border-t pt-3">
          <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-end">
            {/* Match Number Controls */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground font-medium">Match number</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextAuto = !useAutoNumber;
                    setUseAutoNumber(nextAuto);
                    if (nextAuto) {
                      setDraftMatchNumber(autoMatchNumber);
                    }
                    setHasEditedDraft(true);
                  }}
                  aria-pressed={useAutoNumber}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                    useAutoNumber
                      ? 'bg-[var(--brand-gold)]/20 text-[var(--brand-gold)]'
                      : 'text-muted-foreground hover:text-foreground bg-secondary/50'
                  }`}
                  title="Auto mode derives Match Number from finished maps + 1"
                >
                  Auto ({autoMatchNumber}) {useAutoNumber ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={effectiveDraftNumber <= 1}
                  onClick={() => {
                    setUseAutoNumber(false);
                    setDraftMatchNumber(Math.max(1, effectiveDraftNumber - 1));
                    setHasEditedDraft(true);
                  }}
                  className="border-border hover:bg-secondary min-h-9 min-w-9 rounded border px-2.5 py-1 text-sm font-semibold disabled:opacity-40"
                  aria-label="Decrease match number"
                >
                  &minus;
                </button>
                <input
                  type="number"
                  min={1}
                  max={99}
                  aria-label="Match number"
                  value={effectiveDraftNumber}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    setUseAutoNumber(false);
                    setDraftMatchNumber(
                      Number.isFinite(parsed) ? Math.max(1, Math.min(99, parsed)) : 1,
                    );
                    setHasEditedDraft(true);
                  }}
                  className="border-border bg-background min-h-9 w-16 rounded border px-2 py-1 text-center text-sm font-semibold tabular-nums"
                />
                <button
                  type="button"
                  disabled={effectiveDraftNumber >= 99}
                  onClick={() => {
                    setUseAutoNumber(false);
                    setDraftMatchNumber(Math.min(99, effectiveDraftNumber + 1));
                    setHasEditedDraft(true);
                  }}
                  className="border-border hover:bg-secondary min-h-9 min-w-9 rounded border px-2.5 py-1 text-sm font-semibold disabled:opacity-40"
                  aria-label="Increase match number"
                >
                  +
                </button>
              </div>
            </div>

            {/* Map Name Input + Preset Pills */}
            <div className="grid gap-1.5">
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground font-medium">
                  Map name (select preset or type custom)
                </span>
                <input
                  type="text"
                  maxLength={64}
                  placeholder="Erangel"
                  value={draftMapName}
                  onChange={(event) => {
                    setDraftMapName(event.target.value);
                    setHasEditedDraft(true);
                  }}
                  className="border-border bg-background min-h-9 w-full rounded border px-2.5 py-1 text-sm"
                />
              </label>
            </div>

            {/* Apply / Reset Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {hasEditedDraft && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleResetDraft}
                  className="border-border hover:bg-secondary min-h-9 rounded border px-3 py-1.5 text-xs"
                >
                  Reset draft
                </button>
              )}
              <button
                type="button"
                disabled={saving || !trimmedMapName}
                onClick={handleApplyToLive}
                className={`min-h-9 rounded px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  isDirty
                    ? 'bg-[var(--brand-gold)] text-black hover:brightness-110'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {saving ? 'Applying…' : 'Apply to Live'}
              </button>
            </div>
          </div>

          {/* 1-Click PUBG Map Preset Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground mr-1 text-xs">Presets:</span>
            {PUBG_MAP_PRESETS.map((preset) => {
              const isSelected = draftMapName.trim().toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDraftMapName(preset);
                    setHasEditedDraft(true);
                  }}
                  aria-pressed={isSelected}
                  className={`min-h-8 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-[var(--brand-gold)] font-semibold text-black'
                      : 'border-border bg-background/70 text-muted-foreground hover:text-foreground hover:bg-secondary border'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
