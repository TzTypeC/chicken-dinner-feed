import { useCallback, useEffect, useState } from 'react';
import type {
  ManualMatchDocument,
  ManualTeamPatch,
  OperatingMode,
  Team,
  TeamRosterEntry,
} from '@cdf/shared';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLiveStore } from '@/stores/live-store';
import { toast } from '@/stores/toast-store';
import { MatchConfigBar } from './MatchConfigBar';

export interface ManualControlProps {
  roster: readonly TeamRosterEntry[];
  mode: OperatingMode;
  onModeChanged: (mode: OperatingMode) => void;
}

type TeamFilter = 'all' | 'lobby' | 'alive' | 'eliminated';
type ViewMode = 'auto' | 'cards' | 'table';

const VIEW_MODE_STORAGE_KEY = 'cdf.admin.manual.viewMode';

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

const ALIVE_CHOICES = [0, 1, 2, 3, 4] as const;

export function ManualControl({ roster, mode, onModeChanged }: ManualControlProps) {
  const liveSnapshot = useLiveStore((state) => state.snapshot);

  const [document, setDocument] = useState<ManualMatchDocument | null>(null);
  const [standings, setStandings] = useState<Team[]>([]);
  const [pendingReset, setPendingReset] = useState(false);
  const [pendingSeedFromAuto, setPendingSeedFromAuto] = useState(false);
  const [pendingCloseMap, setPendingCloseMap] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TeamFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return saved === 'cards' || saved === 'table' ? saved : 'auto';
  });

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const reload = useCallback(async () => {
    try {
      const response = await api.getManualState();
      setDocument(response.document);
      setStandings(response.standings);
      onModeChanged(response.document.mode);
    } catch (error) {
      toast.error('Could not load manual match state', describe(error));
    }
  }, [onModeChanged]);

  useEffect(() => {
    void reload();
  }, [reload, roster]);

  // When Manual Mode is active on air, keep the PTS/rank preview in sync with the live broadcast
  // snapshot so the operator sees any series or scoring changes immediately.
  const displayedStandings =
    mode === 'manual' && liveSnapshot?.ingest.source === 'manual'
      ? liveSnapshot.match.teams
      : standings;

  const standingsByTeamNo = new Map(displayedStandings.map((team) => [team.teamNo, team]));
  const rosterByTeamNo = new Map(roster.map((entry) => [entry.teamNo, entry]));

  const patchTeam = async (teamNo: number, patch: ManualTeamPatch) => {
    try {
      const response = await api.patchManualTeam(teamNo, patch);
      setDocument(response.document);
      setStandings(response.standings);
    } catch (error) {
      toast.error(`Could not update Team #${teamNo}`, describe(error));
    }
  };

  const switchToManual = async () => {
    try {
      const response = await api.setOperatingMode('manual');
      setDocument(response.document);
      setStandings(response.standings);
      onModeChanged(response.document.mode);
      toast.success(
        'Switched to Manual mode',
        'Overlays are now driven by the manual controls below.',
      );
    } catch (error) {
      toast.error('Could not switch to Manual mode', describe(error));
    }
  };

  const resetMatch = async (seedFromAuto: boolean) => {
    setPendingReset(false);
    setPendingSeedFromAuto(false);
    try {
      const response = await api.resetManualMatch({ seedFromAuto });
      setDocument(response.document);
      setStandings(response.standings);
      toast.success(
        seedFromAuto ? 'Copied current PCOB state' : 'Manual match reset',
        seedFromAuto
          ? 'Manual standings were seeded from the latest PCOB telemetry.'
          : 'Started a fresh manual map with 4 alive and 0 eliminations for every team.',
      );
    } catch (error) {
      toast.error('Could not reset manual match', describe(error));
    }
  };

  const closeMapNow = async () => {
    setPendingCloseMap(false);
    try {
      await api.closeMapNow();
      await reload();
      toast.success(
        'Map closed into series history',
        'When you are ready for the next map, click "Reset manual match".',
      );
    } catch (error) {
      toast.error('Could not close the map', describe(error));
    }
  };

  if (!document) {
    return <p className="text-muted-foreground text-sm">Loading manual match controls…</p>;
  }

  const orderedTeams = [...document.teams].sort((a, b) => a.teamNo - b.teamNo);
  const presentCount = orderedTeams.filter((team) => team.present).length;
  const standingCount = orderedTeams.filter((team) => team.present && team.aliveCount > 0).length;
  const eliminatedCount = orderedTeams.filter(
    (team) => team.present && team.aliveCount === 0,
  ).length;

  const filteredTeams = orderedTeams.filter((team) => {
    if (statusFilter === 'lobby') return team.present;
    if (statusFilter === 'alive') return team.present && team.aliveCount > 0;
    if (statusFilter === 'eliminated') return team.present && team.aliveCount === 0;
    return true;
  });

  const cardsVisibilityClass =
    viewMode === 'cards' ? 'grid' : viewMode === 'table' ? 'hidden' : 'grid md:hidden';
  const tableVisibilityClass =
    viewMode === 'table' ? 'block' : viewMode === 'cards' ? 'hidden' : 'hidden md:block';

  return (
    <div className="grid max-w-6xl gap-4 sm:gap-5">
      <ConfirmDialog
        open={pendingReset}
        title="Reset manual match for a new map?"
        confirmLabel="Reset manual match"
        destructive
        onCancel={() => setPendingReset(false)}
        onConfirm={() => void resetMatch(false)}
      >
        <p>
          Every participating team will be reset to <strong>4 alive</strong> and{' '}
          <strong>0 eliminations</strong> with a new match ID. Closed maps in Series history are
          untouched.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingSeedFromAuto}
        title="Copy current PCOB state into Manual mode?"
        confirmLabel="Copy from PCOB"
        destructive
        onCancel={() => setPendingSeedFromAuto(false)}
        onConfirm={() => void resetMatch(true)}
      >
        <p>
          This overwrites the current manual match numbers with the latest team survival counts,
          eliminations, and elimination order received from PCOB.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingCloseMap}
        title="Close the current manual map now?"
        confirmLabel="Close map now"
        onCancel={() => setPendingCloseMap(false)}
        onConfirm={() => void closeMapNow()}
      >
        <p>
          Records this map&apos;s placements and eliminations into the tournament series history.
          Any teams still alive will be assigned the top remaining placements sorted by
          eliminations.
        </p>
      </ConfirmDialog>

      <MatchConfigBar />

      {mode !== 'manual' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-amber-300">PCOB API mode is currently active on air</p>
            <p className="text-muted-foreground text-xs">
              You can stage manual team numbers below at any time. Switch to <strong>Manual</strong>{' '}
              mode when you want these controls to drive the live overlays.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void switchToManual()}
            className="min-h-9 rounded bg-[var(--brand-gold)] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            Switch to Manual mode
          </button>
        </div>
      )}

      <div className="border-border bg-card grid gap-3 rounded border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-base font-semibold">Live manual match control</h2>
            <p className="text-muted-foreground text-xs">
              Rows stay locked in team-number order (#1–#{orderedTeams.length}) so they never jump
              under your cursor. Standing teams: <strong>{standingCount}</strong> /{' '}
              <strong>{presentCount}</strong> in lobby.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingSeedFromAuto(true)}
              className="border-border hover:bg-secondary min-h-9 rounded border px-3 py-1.5 text-xs font-medium transition-colors"
              title="Seed manual match state from the latest PCOB telemetry (mid-match failover)"
            >
              Copy from PCOB
            </button>
            <button
              type="button"
              onClick={() => setPendingCloseMap(true)}
              disabled={mode !== 'manual'}
              className="border-border hover:bg-secondary min-h-9 rounded border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
              title={
                mode === 'manual'
                  ? 'Freeze the current manual map into Series history'
                  : 'Switch to Manual mode first to close the manual map'
              }
            >
              Close current map now
            </button>
            <button
              type="button"
              onClick={() => setPendingReset(true)}
              className="border-destructive/50 text-destructive hover:bg-destructive/10 min-h-9 rounded border px-3 py-1.5 text-xs font-medium transition-colors"
            >
              Reset manual match
            </button>
          </div>
        </div>

        {/* Filter pills & View Mode selector */}
        <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter teams">
            {(
              [
                ['all', `All (${orderedTeams.length})`],
                ['lobby', `In Lobby (${presentCount})`],
                ['alive', `Still Alive (${standingCount})`],
                ['eliminated', `Eliminated (${eliminatedCount})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                aria-pressed={statusFilter === value}
                className={`min-h-8 rounded px-2.5 py-1 font-medium transition-colors ${
                  statusFilter === value
                    ? 'bg-[var(--brand-gold)] font-semibold text-black'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className="flex items-center gap-1 rounded border border-white/10 bg-black/20 p-0.5"
            role="group"
            aria-label="Layout view mode"
          >
            <span className="text-muted-foreground px-1.5 text-[11px]">View:</span>
            {(
              [
                ['auto', 'Auto'],
                ['cards', 'Cards'],
                ['table', 'Table'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setViewMode(value)}
                aria-pressed={viewMode === value}
                className={`min-h-7 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  viewMode === value
                    ? 'bg-secondary text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredTeams.length === 0 && (
        <p className="text-muted-foreground rounded border border-dashed p-6 text-center text-sm">
          No teams match the selected filter.
        </p>
      )}

      {/* Mobile / Card Operator View (< 768px in Auto mode, or always when View = Cards) */}
      <div className={`${cardsVisibilityClass} gap-2.5 sm:grid-cols-2`}>
        {filteredTeams.map((teamState) => {
          const rosterEntry = rosterByTeamNo.get(teamState.teamNo);
          const projected = standingsByTeamNo.get(teamState.teamNo);
          const isEliminated = teamState.present && teamState.aliveCount === 0;

          return (
            <div
              key={teamState.teamNo}
              className={`border-border bg-card grid gap-2.5 rounded-lg border p-3 transition-colors ${
                !teamState.present
                  ? 'opacity-45'
                  : isEliminated
                    ? 'border-zinc-700/70 bg-zinc-900/45'
                    : ''
              }`}
            >
              {/* Card Header: Lobby toggle + Team identity + Rank/PTS badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Team ${teamState.teamNo} present in lobby`}
                    checked={teamState.present}
                    onChange={(event) =>
                      void patchTeam(teamState.teamNo, { present: event.target.checked })
                    }
                    className="size-4 shrink-0 accent-[var(--brand-gold)]"
                  />
                  <span className="text-muted-foreground shrink-0 font-mono text-xs font-semibold">
                    #{teamState.teamNo}
                  </span>
                  {rosterEntry?.logoUrl ? (
                    <img
                      src={rosterEntry.logoUrl}
                      alt=""
                      className="size-6 shrink-0 rounded object-contain"
                    />
                  ) : (
                    <span className="border-border bg-secondary/40 inline-block size-6 shrink-0 rounded border" />
                  )}
                  <span className="truncate text-sm font-semibold">
                    {rosterEntry?.name ?? `Team ${teamState.teamNo}`}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 font-mono text-xs">
                  {isEliminated && (
                    <span className="rounded bg-zinc-700/80 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200 uppercase">
                      OUT
                    </span>
                  )}
                  <span className="bg-secondary/60 rounded px-2 py-0.5 tabular-nums">
                    {projected ? `#${projected.rank}` : '—'} &middot;{' '}
                    <strong>{projected ? projected.totalPoints : 0}</strong> PTS
                  </span>
                </div>
              </div>

              {/* Alive Players Segmented Bar */}
              <div className="grid gap-1">
                <span className="text-muted-foreground text-[11px]">Alive players</span>
                <div
                  className="grid grid-cols-5 gap-1 rounded border border-zinc-700/80 p-1"
                  role="group"
                  aria-label={`Team ${teamState.teamNo} alive count`}
                >
                  {ALIVE_CHOICES.map((count) => {
                    const active = teamState.aliveCount === count;
                    const activeClass =
                      count === 0 ? 'bg-zinc-600 text-white' : 'bg-emerald-600 text-white';
                    return (
                      <button
                        key={count}
                        type="button"
                        disabled={!teamState.present}
                        onClick={() => void patchTeam(teamState.teamNo, { aliveCount: count })}
                        className={`min-h-10 rounded px-2 py-1.5 font-mono text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                          active
                            ? activeClass
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                        }`}
                      >
                        {count === 0 ? 'OUT' : count}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Eliminations Stepper + Placement Override */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-1">
                  <span className="text-muted-foreground text-[11px]">Eliminations</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!teamState.present || teamState.eliminations <= 0}
                      onClick={() =>
                        void patchTeam(teamState.teamNo, {
                          eliminations: Math.max(0, teamState.eliminations - 1),
                        })
                      }
                      className="border-border hover:bg-secondary min-h-10 min-w-10 rounded border px-2 py-1 font-mono text-xs font-semibold disabled:opacity-30"
                    >
                      -1
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      disabled={!teamState.present}
                      aria-label={`Team ${teamState.teamNo} eliminations`}
                      value={teamState.eliminations}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 999) {
                          void patchTeam(teamState.teamNo, { eliminations: parsed });
                        }
                      }}
                      className="border-border bg-background min-h-10 w-16 flex-1 rounded border px-2 py-1 text-center font-mono text-sm font-semibold tabular-nums"
                    />
                    {([1, 2, 4] as const).map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        disabled={!teamState.present || teamState.eliminations + delta > 999}
                        onClick={() =>
                          void patchTeam(teamState.teamNo, {
                            eliminations: Math.min(999, teamState.eliminations + delta),
                          })
                        }
                        className="border-border hover:bg-secondary min-h-10 min-w-10 rounded border px-2 py-1 font-mono text-xs font-semibold disabled:opacity-30"
                      >
                        +{delta}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="grid gap-1">
                  <span className="text-muted-foreground text-[11px]">Placement</span>
                  <select
                    aria-label={`Team ${teamState.teamNo} placement override`}
                    disabled={!teamState.present}
                    value={teamState.placementOverride ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value;
                      void patchTeam(teamState.teamNo, {
                        placementOverride: raw === '' ? null : Number.parseInt(raw, 10),
                      });
                    }}
                    className="border-border bg-background min-h-10 rounded border px-2 py-1 text-xs"
                  >
                    <option value="">
                      {projected?.placement !== null && projected?.placement !== undefined
                        ? `Auto (#${projected.placement})`
                        : 'Auto (live)'}
                    </option>
                    {Array.from({ length: Math.max(1, presentCount) }, (_, idx) => idx + 1).map(
                      (place) => (
                        <option key={place} value={place}>
                          Override #{place}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop / Tablet Table View (>= 768px in Auto mode, or when View = Table) */}
      <div className={`${tableVisibilityClass} border-border overflow-x-auto rounded border`}>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-border bg-secondary/40 text-muted-foreground border-b text-xs uppercase">
              <th className="px-3 py-2.5">In lobby</th>
              <th className="px-3 py-2.5">#</th>
              <th className="bg-secondary/40 sticky left-0 z-10 px-3 py-2.5">Team</th>
              <th className="px-3 py-2.5">Alive players</th>
              <th className="px-3 py-2.5">Eliminations</th>
              <th className="px-3 py-2.5">Map placement</th>
              <th className="px-3 py-2.5 text-right">Overlay rank</th>
              <th className="px-3 py-2.5 text-right">Total PTS</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {filteredTeams.map((teamState) => {
              const rosterEntry = rosterByTeamNo.get(teamState.teamNo);
              const projected = standingsByTeamNo.get(teamState.teamNo);
              const isEliminated = teamState.present && teamState.aliveCount === 0;

              return (
                <tr
                  key={teamState.teamNo}
                  className={`transition-colors ${
                    !teamState.present
                      ? 'opacity-40'
                      : isEliminated
                        ? 'bg-zinc-900/40 text-zinc-400'
                        : 'hover:bg-secondary/20'
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Team ${teamState.teamNo} present in lobby`}
                      checked={teamState.present}
                      onChange={(event) =>
                        void patchTeam(teamState.teamNo, { present: event.target.checked })
                      }
                      className="size-4 accent-[var(--brand-gold)]"
                    />
                  </td>

                  <td className="px-3 py-2 font-mono text-xs font-semibold">#{teamState.teamNo}</td>

                  <td className="bg-background/95 sticky left-0 z-10 px-3 py-2 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      {rosterEntry?.logoUrl ? (
                        <img
                          src={rosterEntry.logoUrl}
                          alt=""
                          className="size-6 shrink-0 rounded object-contain"
                        />
                      ) : (
                        <span className="border-border bg-secondary/40 inline-block size-6 shrink-0 rounded border" />
                      )}
                      <span className="font-medium">
                        {rosterEntry?.name ?? `Team ${teamState.teamNo}`}
                      </span>
                      {isEliminated && (
                        <span className="rounded bg-zinc-700/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-300 uppercase">
                          Eliminated
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <div
                      className="inline-flex rounded border border-zinc-700/80 p-0.5"
                      role="group"
                      aria-label={`Team ${teamState.teamNo} alive count`}
                    >
                      {ALIVE_CHOICES.map((count) => {
                        const active = teamState.aliveCount === count;
                        const activeClass =
                          count === 0 ? 'bg-zinc-600 text-white' : 'bg-emerald-600 text-white';
                        return (
                          <button
                            key={count}
                            type="button"
                            disabled={!teamState.present}
                            onClick={() => void patchTeam(teamState.teamNo, { aliveCount: count })}
                            className={`min-h-8 min-w-8 rounded px-2 py-1 font-mono text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                              active
                                ? activeClass
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                            }`}
                            title={
                              count === 0
                                ? 'Mark team eliminated (0 alive)'
                                : `Set ${count} player${count === 1 ? '' : 's'} alive`
                            }
                          >
                            {count === 0 ? 'OUT' : count}
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!teamState.present || teamState.eliminations <= 0}
                        onClick={() =>
                          void patchTeam(teamState.teamNo, {
                            eliminations: Math.max(0, teamState.eliminations - 1),
                          })
                        }
                        className="border-border hover:bg-secondary min-h-8 rounded border px-2 py-1 font-mono text-xs disabled:opacity-30"
                      >
                        -1
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        disabled={!teamState.present}
                        aria-label={`Team ${teamState.teamNo} eliminations`}
                        value={teamState.eliminations}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 999) {
                            void patchTeam(teamState.teamNo, { eliminations: parsed });
                          }
                        }}
                        className="border-border bg-background min-h-8 w-16 rounded border px-2 py-1 text-center font-mono text-xs tabular-nums"
                      />
                      {([1, 2, 4] as const).map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          disabled={!teamState.present || teamState.eliminations + delta > 999}
                          onClick={() =>
                            void patchTeam(teamState.teamNo, {
                              eliminations: Math.min(999, teamState.eliminations + delta),
                            })
                          }
                          className="border-border hover:bg-secondary min-h-8 rounded border px-2 py-1 font-mono text-xs disabled:opacity-30"
                        >
                          +{delta}
                        </button>
                      ))}
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <select
                      aria-label={`Team ${teamState.teamNo} placement override`}
                      disabled={!teamState.present}
                      value={teamState.placementOverride ?? ''}
                      onChange={(event) => {
                        const raw = event.target.value;
                        void patchTeam(teamState.teamNo, {
                          placementOverride: raw === '' ? null : Number.parseInt(raw, 10),
                        });
                      }}
                      className="border-border bg-background min-h-8 rounded border px-2 py-1 text-xs"
                    >
                      <option value="">
                        {projected?.placement !== null && projected?.placement !== undefined
                          ? `Auto (#${projected.placement})`
                          : 'Auto (live)'}
                      </option>
                      {Array.from({ length: Math.max(1, presentCount) }, (_, idx) => idx + 1).map(
                        (place) => (
                          <option key={place} value={place}>
                            Override #{place}
                          </option>
                        ),
                      )}
                    </select>
                  </td>

                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                    {projected ? `#${projected.rank}` : '—'}
                  </td>

                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                    {projected ? (
                      <span
                        title={`Kill pts: ${projected.killPoints} | Placement pts: ${projected.placementPoints}`}
                      >
                        {projected.totalPoints}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
