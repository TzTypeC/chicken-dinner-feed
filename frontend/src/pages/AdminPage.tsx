import type {
  CustomFont,
  OperatingMode,
  OverlayInstance,
  OverlayInstancesDocument,
  ScoringRuleset,
  TeamRosterDocument,
} from '@cdf/shared';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Toaster } from '@/components/Toaster';
import { AppearanceEditor } from '@/features/admin/AppearanceEditor';
import { FontManager } from '@/features/admin/FontManager';
import { ImportExport } from '@/features/admin/ImportExport';
import { ImportIniButton } from '@/features/admin/ImportIniButton';
import { InstanceToolbar } from '@/features/admin/InstanceToolbar';
import { CopyableUrl } from '@/features/admin/CopyableUrl';
import { ManualControl } from '@/features/admin/ManualControl';
import { OnAirBadge } from '@/features/admin/OnAirBadge';
import { OverlayPreview } from '@/features/admin/OverlayPreview';
import { ScoringEditor } from '@/features/admin/ScoringEditor';
import { SeriesControl } from '@/features/admin/SeriesControl';
import { TeamRosterEditor } from '@/features/admin/TeamRosterEditor';
import { api, ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useElementHeight } from '@/hooks/useElementSize';
import { applyCustomFontFaces } from '@/lib/font-faces';
import { isDeepEqual } from '@/lib/deep-equal';
import { toInstanceId } from '@/lib/instance-id';
import { useLiveStore } from '@/stores/live-store';
import { toast } from '@/stores/toast-store';

type Tab = 'overlays' | 'manual' | 'teams' | 'scoring' | 'fonts' | 'series' | 'importExport';

const SIDEBAR_STORAGE_KEY = 'cdf.admin.sidebar';

const CONNECTION_LABEL: Record<string, { label: string; hint: string; tone: string }> = {
  connected: { label: 'Connected', hint: 'Match data is arriving', tone: 'bg-emerald-500' },
  stale: {
    label: 'Stale',
    hint: 'Connected, but nothing new recently — check the room host',
    tone: 'bg-amber-500',
  },
  connecting: { label: 'Connecting', hint: 'Trying to reach the data source', tone: 'bg-sky-500' },
  error: {
    label: 'API Error',
    hint: 'Could not reach the PCOB API — check launch.bat or switch to Manual mode',
    tone: 'bg-rose-500',
  },
  disconnected: {
    label: 'Disconnected',
    hint: 'Check that launch.bat is running and "API Enable" is ticked',
    tone: 'bg-zinc-500',
  },
};

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

export function AdminPage() {
  useDocumentTitle('Admin - PUBG overlays');

  const snapshot = useLiveStore((state) => state.snapshot);
  const overlayStates = useLiveStore((state) => state.overlayStates);
  const protocolMismatch = useLiveStore((state) => state.protocolMismatch);
  const connect = useLiveStore((state) => state.connect);

  const [tab, setTab] = useState<Tab>('overlays');
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('auto');
  const [overlays, setOverlays] = useState<OverlayInstancesDocument | null>(null);
  /**
   * What the server last confirmed, kept beside the draft so an edit that is undone stops counting
   * as a change. Comparing against the live channel instead would tie the Save button to the socket
   * being connected.
   */
  const [savedOverlays, setSavedOverlays] = useState<OverlayInstance[]>([]);
  const [teams, setTeams] = useState<TeamRosterDocument | null>(null);
  const [scoring, setScoring] = useState<ScoringRuleset | null>(null);
  const [fonts, setFonts] = useState<CustomFont[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  /** The instance the operator has asked to delete, pending confirmation. */
  const [pendingDelete, setPendingDelete] = useState<OverlayInstance | null>(null);
  /**
   * Remembered across reloads: whether the preview or the instance list matters more is a working
   * preference, and an operator who collapsed it once should not have to do it again every session.
   */
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'collapsed',
  );

  /*
   * The sticky header and nav overlap anything else that sticks, so the control column has to sit
   * below them. Measured rather than hard-coded: the header wraps on a narrow window, and a fixed
   * offset would leave a gap on wide screens and a clipped panel on narrow ones.
   */
  const chromeRef = useRef<HTMLDivElement>(null);
  const chromeHeight = useElementHeight(chromeRef);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarOpen ? 'open' : 'collapsed');
  }, [sidebarOpen]);

  // The admin joins the live channel as an observer, with no instance id. It gets match data for
  // the preview plus the visibility of every overlay, so it can show what is genuinely on air —
  // including a change a director just made from a stream deck.
  useEffect(() => connect(), [connect]);

  useEffect(() => {
    if (!snapshot) return;
    setOperatingMode(snapshot.ingest.source === 'manual' ? 'manual' : 'auto');
  }, [snapshot]);

  const reloadOverlays = useCallback(async (): Promise<OverlayInstancesDocument | null> => {
    try {
      const document = await api.getOverlays();
      setOverlays(document);
      setSavedOverlays(document.instances);
      return document;
    } catch (error) {
      toast.error('Could not load the overlays', describe(error));
      return null;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [overlayDocument, teamDocument, ruleset, fontDocument, manualState] =
          await Promise.all([
            api.getOverlays(),
            api.getTeams(),
            api.getScoring(),
            api.getFonts(),
            api.getManualState(),
          ]);
        setOverlays(overlayDocument);
        setSavedOverlays(overlayDocument.instances);
        setTeams(teamDocument);
        setScoring(ruleset);
        setFonts(fontDocument.fonts);
        setOperatingMode(manualState.document.mode);
        // Registered here as well as on the live channel, so the previews and the sample text are
        // correct before any overlay message has arrived.
        applyCustomFontFaces(fontDocument.fonts);
        setSelectedId(overlayDocument.instances[0]?.id ?? null);
      } catch (error) {
        toast.error(
          'Could not load the configuration',
          `${describe(error)} Is the backend running?`,
        );
      }
    })();
  }, []);

  const selected = overlays?.instances.find((instance) => instance.id === selectedId) ?? null;
  const selectedVisible = selected ? overlayStates[selected.id]?.visible : undefined;
  const newInstanceId = toInstanceId(newName);

  const savedSelected = savedOverlays.find((instance) => instance.id === selectedId) ?? null;
  const isDirty = selected !== null && !isDeepEqual(selected, savedSelected);

  const patchSelected = (changes: Partial<OverlayInstance>) => {
    if (!overlays || !selected) return;
    setOverlays({
      ...overlays,
      instances: overlays.instances.map((instance) =>
        instance.id === selected.id ? { ...instance, ...changes } : instance,
      ),
    });
  };

  const saveInstance = async (instance: OverlayInstance) => {
    try {
      await api.updateOverlay(instance);
      setSavedOverlays((previous) =>
        previous.map((entry) => (entry.id === instance.id ? instance : entry)),
      );
      toast.success(
        `Saved “${instance.name}”`,
        'Every open browser source has already picked up the new look.',
      );
    } catch (error) {
      toast.error(`Could not save “${instance.name}”`, describe(error));
    }
  };

  const uploadBackground = async (instance: OverlayInstance, file: File) => {
    try {
      const updated = await api.uploadOverlayBackground(instance.id, file);
      const nextBg = updated.appearance.postGameBackground;
      setOverlays((prev) =>
        prev
          ? {
              ...prev,
              instances: prev.instances.map((entry) =>
                entry.id === instance.id
                  ? {
                      ...entry,
                      appearance: {
                        ...entry.appearance,
                        postGameBackground: {
                          ...nextBg,
                          opacity: entry.appearance.postGameBackground.opacity,
                          blur: entry.appearance.postGameBackground.blur,
                        },
                      },
                    }
                  : entry,
              ),
            }
          : prev,
      );
      setSavedOverlays((prev) => prev.map((entry) => (entry.id === instance.id ? updated : entry)));
      toast.success(
        'Post-game background uploaded',
        `Applied to “${instance.name}” (${nextBg.mode}).`,
      );
    } catch (error) {
      toast.error('Could not upload post-game background', describe(error));
    }
  };

  const removeBackground = async (instance: OverlayInstance) => {
    try {
      const updated = await api.deleteOverlayBackground(instance.id);
      const nextBg = updated.appearance.postGameBackground;
      setOverlays((prev) =>
        prev
          ? {
              ...prev,
              instances: prev.instances.map((entry) =>
                entry.id === instance.id
                  ? {
                      ...entry,
                      appearance: {
                        ...entry.appearance,
                        postGameBackground: nextBg,
                      },
                    }
                  : entry,
              ),
            }
          : prev,
      );
      setSavedOverlays((prev) => prev.map((entry) => (entry.id === instance.id ? updated : entry)));
      toast.success(
        'Post-game background removed',
        `Cleared custom background on “${instance.name}”.`,
      );
    } catch (error) {
      toast.error('Could not remove post-game background', describe(error));
    }
  };

  const createOverlay = async (id: string, name: string, copyFrom?: string) => {
    try {
      await api.createOverlay({ id, name, ...(copyFrom ? { copyAppearanceFrom: copyFrom } : {}) });
      await reloadOverlays();
      setSelectedId(id);
      setNewName('');
      toast.success(
        copyFrom ? `Duplicated as “${name}”` : `Created “${name}”`,
        `Its browser source address is /overlay/${id}`,
      );
    } catch (error) {
      toast.error(`Could not create “${name}”`, describe(error));
    }
  };

  const toggleVisibility = async (instance: OverlayInstance) => {
    try {
      const state = await api.setOverlayVisibility(instance.id, 'toggle');
      // Confirm what actually happened using the state the server returned, not what we assumed —
      // the two can differ if a director pressed a button at the same moment.
      toast.success(
        state.visible ? `“${instance.name}” is ON AIR` : `“${instance.name}” is hidden`,
        state.visible
          ? 'It animated on in every browser source showing this overlay.'
          : 'It animated off in every browser source showing this overlay.',
      );
    } catch (error) {
      toast.error(`Could not change “${instance.name}”`, describe(error));
    }
  };

  const deleteOverlay = async (instance: OverlayInstance) => {
    setPendingDelete(null);
    try {
      await api.deleteOverlay(instance.id);
      const refreshed = await reloadOverlays();
      setSelectedId(refreshed?.instances[0]?.id ?? null);
      toast.success(
        `Deleted “${instance.name}”`,
        `Any browser source still pointing at /overlay/${instance.id} will now show nothing.`,
      );
    } catch (error) {
      toast.error(`Could not delete “${instance.name}”`, describe(error));
    }
  };

  const changeMode = async (nextMode: OperatingMode) => {
    if (nextMode === operatingMode) return;
    try {
      const response = await api.setOperatingMode(nextMode);
      setOperatingMode(response.document.mode);
      toast.success(
        response.document.mode === 'manual'
          ? 'Switched to Manual mode'
          : 'Switched to PCOB API mode',
        response.document.mode === 'manual'
          ? 'Overlays are now driven by operator-entered manual data.'
          : 'Automatic polling resumed. Manual match numbers remain saved.',
      );
    } catch (error) {
      toast.error('Could not switch operating mode', describe(error));
    }
  };

  const [useScopedOverlayUrls, setUseScopedOverlayUrls] = useState(false);

  const ingest = snapshot?.ingest;
  const connection =
    operatingMode === 'manual' || ingest?.source === 'manual'
      ? {
          label: 'Manual mode',
          hint: 'Driven by operator controls',
          tone: 'bg-amber-400',
        }
      : ingest
        ? (CONNECTION_LABEL[ingest.state] ?? CONNECTION_LABEL.disconnected!)
        : null;

  return (
    <div className="min-h-dvh overflow-x-clip">
      {/*
       * Mounted here rather than at the router root on purpose: the overlay routes render onto a
       * broadcast surface, and a toast appearing there would go out on air.
       */}
      <Toaster />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete “${pendingDelete?.name ?? ''}”?`}
        confirmLabel="Delete it"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void deleteOverlay(pendingDelete)}
      >
        <p>
          Its settings are removed for good. Any browser source pointing at{' '}
          <code className="font-mono text-xs">/overlay/{pendingDelete?.id}</code> will show nothing
          afterwards, and Stream Deck buttons for it will stop working.
        </p>
        {pendingDelete && overlayStates[pendingDelete.id]?.visible && (
          <p className="text-destructive font-medium">
            This overlay is on air at the moment. Deleting it will take it off.
          </p>
        )}
      </ConfirmDialog>

      <div ref={chromeRef} className="bg-background sticky top-0 z-30">
        {protocolMismatch !== null && (
          <div className="bg-destructive text-destructive-foreground px-3 py-2 text-xs font-medium sm:px-6">
            Admin UI is out of date — the server speaks protocol v{protocolMismatch}. Reload this
            page.
          </div>
        )}

        <header className="flex flex-wrap items-center gap-2.5 border-b border-b-[var(--brand-gold)]/70 bg-[var(--brand-navy)] px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
          <img
            src="/images/app-logo-128.png"
            alt=""
            width={40}
            height={40}
            className="size-9 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:size-11"
          />
          <div className="mr-auto min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              <span className="text-[var(--brand-gold)]">Chicken</span> Dinner Feed
            </h1>
            <p className="text-muted-foreground hidden text-xs tracking-wide uppercase min-[400px]:block">
              Overlay control
            </p>
          </div>

          <div
            className="flex items-center rounded border border-white/15 bg-black/25 p-0.5 text-xs"
            role="group"
            aria-label="Operating mode selector"
          >
            <button
              type="button"
              onClick={() => void changeMode('auto')}
              aria-pressed={operatingMode === 'auto'}
              className={`min-h-8 rounded px-2.5 py-1 font-medium transition-colors ${
                operatingMode === 'auto'
                  ? 'bg-[var(--brand-gold)] font-semibold text-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Obtain live match telemetry from PCOB API"
            >
              PCOB API
            </button>
            <button
              type="button"
              onClick={() => void changeMode('manual')}
              aria-pressed={operatingMode === 'manual'}
              className={`min-h-8 rounded px-2.5 py-1 font-medium transition-colors ${
                operatingMode === 'manual'
                  ? 'bg-[var(--brand-gold)] font-semibold text-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Drive live overlays from operator-entered manual team data"
            >
              Manual
            </button>
          </div>

          {connection && (
            <div className="flex items-center gap-2" title={connection.hint}>
              <span className={`size-2 shrink-0 rounded-full ${connection.tone}`} />
              <span className="text-xs sm:text-sm">{connection.label}</span>
              <span className="text-muted-foreground hidden text-xs lg:inline">
                — {connection.hint}
              </span>
            </div>
          )}
        </header>

        <nav
          className="border-border flex gap-1 overflow-x-auto border-b px-3 whitespace-nowrap sm:px-6"
          aria-label="Admin sections"
        >
          {(
            [
              ['overlays', 'Overlays'],
              ['manual', 'Manual control'],
              ['teams', 'Teams'],
              ['scoring', 'Scoring'],
              ['fonts', 'Fonts'],
              ['series', 'Series control'],
              ['importExport', 'Import & Export'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`min-h-[42px] shrink-0 border-b-2 px-3 py-2 text-sm transition-colors ${
                tab === value
                  ? 'border-[var(--brand-gold)] font-medium text-[var(--brand-gold)]'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <main className="p-3 sm:p-6">
        {tab === 'overlays' && overlays && (
          <div
            className="cdf-overlays-layout gap-5 lg:gap-6"
            data-sidebar={sidebarOpen ? 'open' : 'collapsed'}
          >
            {/* Mobile & Tablet Instance Switcher (< 1024px) */}
            <div className="border-border bg-card grid gap-3 rounded-lg border p-3 md:col-span-2 lg:hidden">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium tracking-wide uppercase">
                  Overlay instances
                </span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="border-border hover:bg-secondary min-h-8 rounded border px-2.5 py-1 text-xs"
                >
                  {sidebarOpen ? 'Hide new instance form' : '+ New / Duplicate instance'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {overlays.instances.map((instance) => (
                  <button
                    key={instance.id}
                    type="button"
                    onClick={() => setSelectedId(instance.id)}
                    className={`inline-flex min-h-9 items-center gap-2 rounded border px-3 py-1.5 text-left text-xs transition-colors ${
                      instance.id === selectedId
                        ? 'border-[var(--brand-gold)] bg-secondary font-medium'
                        : 'border-border hover:bg-secondary/60'
                    }`}
                  >
                    <span className="truncate">{instance.name}</span>
                    <OnAirBadge visible={overlayStates[instance.id]?.visible} size="sm" />
                  </button>
                ))}
              </div>

              {sidebarOpen && (
                <div className="border-border/70 grid gap-2 border-t pt-2.5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <label className="grid gap-1 text-xs">
                    <span className="text-muted-foreground">New overlay name</span>
                    <input
                      type="text"
                      placeholder="Second leaderboard"
                      className="border-border bg-background min-h-9 rounded border px-2.5 py-1.5 text-sm"
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="border-border hover:bg-secondary min-h-9 rounded border px-3 py-1.5 text-xs disabled:opacity-40"
                    disabled={!newInstanceId}
                    onClick={() => void createOverlay(newInstanceId, newName.trim())}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    className="border-border hover:bg-secondary min-h-9 rounded border px-3 py-1.5 text-xs disabled:opacity-40"
                    disabled={!newInstanceId || !selected}
                    onClick={() =>
                      selected && void createOverlay(newInstanceId, newName.trim(), selected.id)
                    }
                  >
                    Duplicate
                  </button>
                </div>
              )}
            </div>

            {/* Desktop Collapsible Sidebar (>= 1024px) */}
            <aside className="border-border relative hidden border-r pr-5 lg:block">
              <div className="bg-background sticky top-4 z-10 flex items-center gap-2 pb-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="hover:bg-secondary text-muted-foreground grid size-8 shrink-0 place-items-center rounded transition-colors"
                  aria-label={sidebarOpen ? 'Collapse the instance list' : 'Show the instance list'}
                  aria-expanded={sidebarOpen}
                  title={
                    sidebarOpen
                      ? 'Collapse the list to make the preview bigger'
                      : 'Show the instance list'
                  }
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="size-4" aria-hidden />
                  ) : (
                    <PanelLeftOpen className="size-4" aria-hidden />
                  )}
                </button>
                <h2
                  className="text-sm font-medium whitespace-nowrap transition-opacity duration-200"
                  style={{ opacity: sidebarOpen ? 1 : 0 }}
                  aria-hidden={!sidebarOpen}
                >
                  Instances
                </h2>
              </div>

              <div className="overflow-hidden">
                <div
                  className="grid w-[15.25rem] content-start gap-3 transition-opacity duration-200"
                  style={{ opacity: sidebarOpen ? 1 : 0 }}
                  inert={!sidebarOpen}
                >
                  <>
                    <ul className="grid gap-1">
                      {overlays.instances.map((instance) => (
                        <li key={instance.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(instance.id)}
                            className={`flex w-full items-start gap-2 rounded px-3 py-2 text-left text-sm ${
                              instance.id === selectedId ? 'bg-secondary' : 'hover:bg-secondary/60'
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{instance.name}</span>
                              <span className="text-muted-foreground block truncate font-mono text-xs">
                                /overlay/{instance.id}
                              </span>
                            </span>
                            <OnAirBadge visible={overlayStates[instance.id]?.visible} size="sm" />
                          </button>
                        </li>
                      ))}
                    </ul>

                    <div className="grid gap-2">
                      <label className="grid gap-1 text-xs">
                        <span className="text-muted-foreground">New overlay name</span>
                        <input
                          type="text"
                          placeholder="Second leaderboard"
                          className="border-border bg-background min-h-9 rounded border px-2 py-1.5 text-sm"
                          value={newName}
                          onChange={(event) => setNewName(event.target.value)}
                        />
                      </label>

                      {newName.trim() && (
                        <p className="text-muted-foreground text-xs">
                          Address:{' '}
                          {newInstanceId ? (
                            <code className="font-mono">/overlay/{newInstanceId}</code>
                          ) : (
                            <span className="text-destructive">
                              that name has no letters or digits to build an address from
                            </span>
                          )}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="border-border hover:bg-secondary min-h-9 rounded border px-3 py-1.5 text-xs disabled:opacity-40"
                          disabled={!newInstanceId}
                          onClick={() => void createOverlay(newInstanceId, newName.trim())}
                          title="Create an overlay with the default appearance"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          className="border-border hover:bg-secondary min-h-9 rounded border px-3 py-1.5 text-xs disabled:opacity-40"
                          disabled={!newInstanceId || !selected}
                          onClick={() =>
                            selected &&
                            void createOverlay(newInstanceId, newName.trim(), selected.id)
                          }
                          title={
                            selected
                              ? `Create it with the appearance of “${selected.name}”`
                              : 'Select an overlay to copy first'
                          }
                        >
                          Duplicate
                        </button>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        <strong>Create</strong> starts from the defaults. <strong>Duplicate</strong>{' '}
                        copies the look of{' '}
                        {selected ? `“${selected.name}”` : 'the selected overlay'}.
                      </p>
                    </div>
                  </>
                </div>
              </div>
            </aside>

            {selected ? (
              <>
                <section className="order-2 grid min-w-0 content-start gap-5 md:order-1">
                  <AppearanceEditor
                    appearance={selected.appearance}
                    customFonts={fonts}
                    onChange={(appearance) => patchSelected({ appearance })}
                    onUploadBackground={(file) => uploadBackground(selected, file)}
                    onRemoveBackground={() => removeBackground(selected)}
                  />
                </section>

                <aside
                  className="order-1 grid min-w-0 content-start gap-3 self-start overflow-y-auto md:order-2 lg:sticky"
                  style={{
                    top: `calc(${chromeHeight}px + 1rem)`,
                    maxHeight:
                      chromeHeight > 0 ? `calc(100dvh - ${chromeHeight}px - 2rem)` : undefined,
                  }}
                >
                  <InstanceToolbar
                    instance={selected}
                    visible={selectedVisible}
                    isDirty={isDirty}
                    onRename={(name) => patchSelected({ name })}
                    onSave={() => void saveInstance(selected)}
                    onToggleVisibility={() => void toggleVisibility(selected)}
                    onDelete={() => setPendingDelete(selected)}
                  />

                  <OverlayPreview instanceId={selected.id} />

                  <p className="text-muted-foreground text-xs">
                    This is the overlay itself, loaded from the same address your browser source
                    uses — including its show/hide animation. It shows <strong>saved</strong>{' '}
                    settings, because that is what is on air: press Save to see a change here.
                  </p>

                  <div className="border-border bg-card/50 grid gap-2.5 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium">
                        OBS Browser Source URLs (1920×1080)
                      </span>
                      <button
                        type="button"
                        onClick={() => setUseScopedOverlayUrls((prev) => !prev)}
                        aria-pressed={useScopedOverlayUrls}
                        className={`min-h-7 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          useScopedOverlayUrls
                            ? 'border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                        title="Toggle between default URLs (/overlay/elimination) and instance-scoped URLs"
                      >
                        Scope to “{selected.id}”: {useScopedOverlayUrls ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    <CopyableUrl
                      label="1. Live Leaderboard Overlay"
                      url={`${window.location.origin}/overlay/${selected.id}`}
                    />

                    <CopyableUrl
                      label="2. Team Elimination Notification Overlay"
                      url={
                        useScopedOverlayUrls || selected.id !== 'main'
                          ? `${window.location.origin}/overlay/${selected.id}/elimination`
                          : `${window.location.origin}/overlay/elimination`
                      }
                    />

                    <CopyableUrl
                      label="3. Match Information Overlay (Match # & Map)"
                      url={
                        useScopedOverlayUrls || selected.id !== 'main'
                          ? `${window.location.origin}/overlay/${selected.id}/match-info`
                          : `${window.location.origin}/overlay/match-info`
                      }
                    />

                    <CopyableUrl
                      label="4. WWCD Victory Screen Overlay"
                      url={
                        useScopedOverlayUrls || selected.id !== 'main'
                          ? `${window.location.origin}/overlay/${selected.id}/wwcd`
                          : `${window.location.origin}/overlay/wwcd`
                      }
                    />

                    <CopyableUrl
                      label="5. Post-Game Detailed Standings Overlay"
                      url={
                        useScopedOverlayUrls || selected.id !== 'main'
                          ? `${window.location.origin}/overlay/${selected.id}/postgame`
                          : `${window.location.origin}/overlay/postgame`
                      }
                    />
                  </div>
                </aside>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                No overlays yet. Create one to get started.
              </p>
            )}
          </div>
        )}

        {tab === 'manual' && teams && (
          <ManualControl
            roster={teams.teams}
            mode={operatingMode}
            onModeChanged={setOperatingMode}
          />
        )}

        {tab === 'teams' && teams && (
          <div className="grid max-w-3xl gap-4">
            <ImportIniButton onImported={setTeams} />
            <TeamRosterEditor document={teams} onChange={setTeams} />
            <button
              type="button"
              className="bg-primary text-primary-foreground min-h-10 w-fit rounded px-3.5 py-1.5 text-sm font-medium"
              onClick={async () => {
                try {
                  setTeams(await api.saveTeams(teams));
                  toast.success('Teams saved', 'The names on air have already changed.');
                } catch (error) {
                  toast.error('Could not save the teams', describe(error));
                }
              }}
            >
              Save teams
            </button>
          </div>
        )}

        {tab === 'fonts' && (
          <div className="grid max-w-2xl gap-4">
            <FontManager fonts={fonts} onChange={setFonts} />
          </div>
        )}

        {tab === 'scoring' && scoring && (
          <div className="grid max-w-3xl gap-4">
            <ScoringEditor ruleset={scoring} onChange={setScoring} />
            <button
              type="button"
              className="bg-primary text-primary-foreground min-h-10 w-fit rounded px-3.5 py-1.5 text-sm font-medium"
              onClick={async () => {
                try {
                  setScoring(await api.saveScoring(scoring));
                  toast.success(
                    'Scoring saved',
                    'The standings were recalculated immediately, mid-match included.',
                  );
                } catch (error) {
                  toast.error('Could not save the scoring', describe(error));
                }
              }}
            >
              Save scoring
            </button>
          </div>
        )}

        {tab === 'series' && <SeriesControl />}

        {tab === 'importExport' && <ImportExport />}
      </main>
    </div>
  );
}
