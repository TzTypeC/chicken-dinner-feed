import type { TeamRosterDocument, TeamRosterEntry } from '@cdf/shared';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BulkTeamDialog } from './BulkTeamDialog';
import { applyDirectSwap, applyRippleShift } from './roster-reorder';
import { TeamLogoCell } from './TeamLogoCell';

export interface TeamRosterEditorProps {
  document: TeamRosterDocument;
  onChange(document: TeamRosterDocument): void;
  isMatchLive?: boolean;
}

export function TeamRosterEditor({
  document,
  onChange,
  isMatchLive = false,
}: TeamRosterEditorProps) {
  const masterCheckboxId = useId();
  const [selectedTeamNos, setSelectedTeamNos] = useState<Set<number>>(new Set());
  const [draggedTeamNo, setDraggedTeamNo] = useState<number | null>(null);
  const [dragOverTeamNo, setDragOverTeamNo] = useState<number | null>(null);

  // Dialog states
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [singleDeleteTeamNo, setSingleDeleteTeamNo] = useState<number | null>(null);

  const sortedTeams = useMemo(
    () => [...document.teams].sort((a, b) => a.teamNo - b.teamNo),
    [document.teams],
  );

  const patch = (teamNo: number, changes: Partial<TeamRosterEntry>) =>
    onChange({
      ...document,
      teams: document.teams.map((team) =>
        team.teamNo === teamNo ? { ...team, ...changes } : team,
      ),
    });

  const nextFreeTeamNo = (): number => {
    const used = new Set(document.teams.map((team) => team.teamNo));
    for (let candidate = 1; candidate <= 25; candidate += 1) {
      if (!used.has(candidate)) return candidate;
    }
    return 25;
  };

  // Selection handlers
  const allSelected = sortedTeams.length > 0 && selectedTeamNos.size === sortedTeams.length;
  const isIndeterminate = selectedTeamNos.size > 0 && selectedTeamNos.size < sortedTeams.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedTeamNos(new Set());
    } else {
      setSelectedTeamNos(new Set(sortedTeams.map((t) => t.teamNo)));
    }
  };

  const toggleSelectTeam = (teamNo: number) => {
    const next = new Set(selectedTeamNos);
    if (next.has(teamNo)) {
      next.delete(teamNo);
    } else {
      next.add(teamNo);
    }
    setSelectedTeamNos(next);
  };

  // Renumbering actions
  const handleDragStart = (e: React.DragEvent, teamNo: number) => {
    setDraggedTeamNo(teamNo);
    e.dataTransfer.setData('text/plain', String(teamNo));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, teamNo: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTeamNo !== teamNo) {
      setDragOverTeamNo(teamNo);
    }
  };

  const handleDrop = (e: React.DragEvent, targetTeamNo: number) => {
    e.preventDefault();
    setDragOverTeamNo(null);
    const sourceTeamNo = draggedTeamNo ?? Number(e.dataTransfer.getData('text/plain'));
    setDraggedTeamNo(null);

    if (!sourceTeamNo || sourceTeamNo === targetTeamNo) return;

    const renumbered = applyRippleShift(document.teams, sourceTeamNo, targetTeamNo);
    onChange({
      ...document,
      teams: renumbered,
    });
  };

  const handleDragEnd = () => {
    setDraggedTeamNo(null);
    setDragOverTeamNo(null);
  };

  const handleSlotChange = (sourceTeamNo: number, targetSlot: number) => {
    if (sourceTeamNo === targetSlot) return;
    const renumbered = applyDirectSwap(document.teams, sourceTeamNo, targetSlot);
    onChange({
      ...document,
      teams: renumbered,
    });
  };

  const handleStepUp = (teamNo: number) => {
    if (teamNo <= 1) return;
    const renumbered = applyDirectSwap(document.teams, teamNo, teamNo - 1);
    onChange({ ...document, teams: renumbered });
  };

  const handleStepDown = (teamNo: number) => {
    if (teamNo >= 25) return;
    const renumbered = applyDirectSwap(document.teams, teamNo, teamNo + 1);
    onChange({ ...document, teams: renumbered });
  };

  // Deletion logic (Preserving sparse slots)
  const confirmDeleteSelected = () => {
    const nextTeams = document.teams.filter((t) => !selectedTeamNos.has(t.teamNo));
    onChange({ ...document, teams: nextTeams });
    setSelectedTeamNos(new Set());
    setDeleteConfirmOpen(false);
  };

  const confirmDeleteAll = () => {
    onChange({ ...document, teams: [] });
    setSelectedTeamNos(new Set());
    setDeleteAllConfirmOpen(false);
  };

  const confirmDeleteSingle = () => {
    if (singleDeleteTeamNo === null) return;
    const nextTeams = document.teams.filter((t) => t.teamNo !== singleDeleteTeamNo);
    onChange({ ...document, teams: nextTeams });
    if (selectedTeamNos.has(singleDeleteTeamNo)) {
      const nextSel = new Set(selectedTeamNos);
      nextSel.delete(singleDeleteTeamNo);
      setSelectedTeamNos(nextSel);
    }
    setSingleDeleteTeamNo(null);
  };

  const handleBulkAddCommit = (newTeams: Array<{ teamNo: number; name: string }>) => {
    const existingMap = new Map(document.teams.map((t) => [t.teamNo, t]));
    for (const item of newTeams) {
      existingMap.set(item.teamNo, {
        teamNo: item.teamNo,
        name: item.name,
        logoUrl: null,
      });
    }
    onChange({
      ...document,
      teams: [...existingMap.values()].sort((a, b) => a.teamNo - b.teamNo),
    });
  };

  const singleTeamToDelete = singleDeleteTeamNo
    ? document.teams.find((t) => t.teamNo === singleDeleteTeamNo)
    : null;

  return (
    <div className="grid gap-3.5">
      {/* Live Match Warning */}
      {isMatchLive && (
        <div
          data-testid="live-match-roster-warning"
          className="flex items-start gap-2 rounded border border-amber-500/50 bg-amber-500/10 p-2.5 text-xs text-amber-200"
        >
          <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" aria-hidden />
          <div>
            <strong className="font-semibold">Live match in progress:</strong> Renumbering team
            slots or deleting teams will immediately remap live PCOB room telemetry and change
            on-air overlay graphics.
          </div>
        </div>
      )}

      {/* Guidance Header & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs max-w-xl">
          The slot number matches your <code>TeamLogoAndColor.ini</code> custom room seats. Drag
          rows to Ripple Shift slots, or select a slot from the dropdown to Direct Swap. Deleting
          teams preserves remaining slot numbers (sparse slots).
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="bulk-add-teams-btn"
            onClick={() => setBulkDialogOpen(true)}
            className="border-border hover:bg-secondary flex min-h-8 items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium"
          >
            <Layers className="size-3.5" />
            Bulk Add Teams
          </button>
          <button
            type="button"
            data-testid="add-single-team-btn"
            className="border-border hover:bg-secondary flex min-h-8 items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
            disabled={document.teams.length >= 25}
            onClick={() => {
              const teamNo = nextFreeTeamNo();
              onChange({
                ...document,
                teams: [...document.teams, { teamNo, name: `T${teamNo}`, logoUrl: null }].sort(
                  (a, b) => a.teamNo - b.teamNo,
                ),
              });
            }}
          >
            <Plus className="size-3.5" />
            Add Team
          </button>
          <button
            type="button"
            data-testid="delete-all-teams-btn"
            disabled={document.teams.length === 0}
            onClick={() => setDeleteAllConfirmOpen(true)}
            className="text-destructive hover:bg-destructive/10 border-destructive/30 flex min-h-8 items-center gap-1 rounded border px-2 py-1 text-xs disabled:opacity-30"
          >
            <Trash2 className="size-3" />
            Delete All
          </button>
        </div>
      </div>

      {/* Selection Action Bar */}
      {selectedTeamNos.size > 0 && (
        <div
          data-testid="selection-action-bar"
          className="flex items-center justify-between rounded border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/10 px-3 py-1.5 text-xs"
        >
          <span className="font-medium text-foreground">
            {selectedTeamNos.size} of {sortedTeams.length} team
            {selectedTeamNos.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTeamNos(new Set())}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Clear
            </button>
            <button
              type="button"
              data-testid="delete-selected-btn"
              onClick={() => setDeleteConfirmOpen(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex min-h-7 items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold"
            >
              <Trash2 className="size-3" />
              Delete Selected ({selectedTeamNos.size})
            </button>
          </div>
        </div>
      )}

      {/* Teams Table */}
      <div className="border-border overflow-hidden rounded border bg-black/20">
        {/* Table Column Header */}
        <div className="border-border flex items-center gap-2 border-b bg-white/5 px-2.5 py-2 text-[11px] font-semibold text-muted-foreground">
          <div className="flex w-6 items-center justify-center">
            <input
              type="checkbox"
              id={masterCheckboxId}
              aria-label="Select or deselect all teams"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = isIndeterminate;
              }}
              onChange={toggleSelectAll}
              className="size-3.5 rounded border-border"
            />
          </div>
          <div className="w-6 text-center" title="Drag Handle">
            #
          </div>
          <div className="w-20 text-center">Slot</div>
          <div className="w-16 text-center">Steppers</div>
          <div className="w-14 text-center">Logo</div>
          <div className="flex-1">Team Name</div>
          <div className="w-8 text-center">Action</div>
        </div>

        {sortedTeams.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No teams configured in the active roster. Use <strong>Add Team</strong>,{' '}
            <strong>Bulk Add Teams</strong>, or import an INI file.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {sortedTeams.map((team) => {
              const isSelected = selectedTeamNos.has(team.teamNo);
              const isDragging = draggedTeamNo === team.teamNo;
              const isOver = dragOverTeamNo === team.teamNo;

              return (
                <div
                  key={team.teamNo}
                  data-testid={`team-row-${team.teamNo}`}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, team.teamNo)}
                  onDragOver={(e) => handleDragOver(e, team.teamNo)}
                  onDrop={(e) => handleDrop(e, team.teamNo)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-2.5 py-1.5 transition-colors ${
                    isOver ? 'bg-[var(--brand-gold)]/20 ring-1 ring-[var(--brand-gold)]' : ''
                  } ${isDragging ? 'opacity-40' : ''} ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Select Checkbox */}
                  <div className="flex w-6 items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label={`Select team ${team.teamNo} (${team.name})`}
                      checked={isSelected}
                      onChange={() => toggleSelectTeam(team.teamNo)}
                      className="size-3.5 rounded border-border"
                    />
                  </div>

                  {/* Drag Handle */}
                  <div
                    className="flex w-6 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
                    title="Drag to Ripple Shift team slot"
                  >
                    <GripVertical className="size-3.5" />
                  </div>

                  {/* Accessible Slot Dropdown (Direct Swap) */}
                  <div className="w-20">
                    <select
                      aria-label={`Slot for team ${team.name}`}
                      value={team.teamNo}
                      onChange={(e) => handleSlotChange(team.teamNo, Number(e.target.value))}
                      className="border-border bg-background w-full rounded border px-1.5 py-1 text-xs font-semibold tabular-nums focus:outline-none"
                    >
                      {Array.from({ length: 25 }, (_, i) => i + 1).map((slotNum) => {
                        const occupant = document.teams.find((t) => t.teamNo === slotNum);
                        const label =
                          occupant && occupant.teamNo !== team.teamNo
                            ? `T${String(slotNum).padStart(2, '0')} (${occupant.name})`
                            : `T${String(slotNum).padStart(2, '0')}`;
                        return (
                          <option key={slotNum} value={slotNum}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Up / Down Steppers */}
                  <div className="flex w-16 items-center justify-center gap-0.5">
                    <button
                      type="button"
                      aria-label={`Move team ${team.teamNo} up`}
                      disabled={team.teamNo <= 1}
                      onClick={() => handleStepUp(team.teamNo)}
                      className="text-muted-foreground hover:text-foreground hover:bg-white/10 disabled:opacity-20 grid size-6 place-items-center rounded text-xs"
                      title="Move up one slot"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move team ${team.teamNo} down`}
                      disabled={team.teamNo >= 25}
                      onClick={() => handleStepDown(team.teamNo)}
                      className="text-muted-foreground hover:text-foreground hover:bg-white/10 disabled:opacity-20 grid size-6 place-items-center rounded text-xs"
                      title="Move down one slot"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>

                  {/* Logo Picker Cell */}
                  <div className="w-14 flex items-center justify-center">
                    <TeamLogoCell
                      team={team}
                      onChange={(updated) =>
                        onChange({
                          ...document,
                          teams: document.teams.map((entry) =>
                            entry.teamNo === updated.teamNo ? updated : entry,
                          ),
                        })
                      }
                    />
                  </div>

                  {/* Team Name Input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      aria-label={`Team ${team.teamNo} name`}
                      maxLength={24}
                      value={team.name}
                      onChange={(event) => patch(team.teamNo, { name: event.target.value })}
                      className="border-border bg-background min-h-8 w-full rounded border px-2 py-1 text-sm font-semibold"
                    />
                  </div>

                  {/* Delete Single Row Button */}
                  <div className="w-8 flex items-center justify-center">
                    <button
                      type="button"
                      aria-label={`Remove team ${team.teamNo}`}
                      onClick={() => setSingleDeleteTeamNo(team.teamNo)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 grid size-7 place-items-center rounded text-sm"
                      title={`Delete Team ${team.teamNo}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Add Teams Dialog */}
      <BulkTeamDialog
        open={bulkDialogOpen}
        existingTeams={document.teams}
        onCommit={handleBulkAddCommit}
        onClose={() => setBulkDialogOpen(false)}
      />

      {/* Delete Selected Teams Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={`Delete ${selectedTeamNos.size} Selected Team${selectedTeamNos.size === 1 ? '' : 's'}?`}
        confirmLabel="Delete Teams"
        destructive={true}
        onConfirm={confirmDeleteSelected}
        onCancel={() => setDeleteConfirmOpen(false)}
      >
        <p>
          Are you sure you want to delete the selected team
          {selectedTeamNos.size === 1 ? '' : 's'} from the active roster?
        </p>
        <div className="border-border max-h-32 overflow-y-auto rounded border bg-black/20 p-2 font-mono text-xs">
          {[...selectedTeamNos]
            .sort((a, b) => a - b)
            .map((slot) => {
              const t = document.teams.find((item) => item.teamNo === slot);
              return (
                <div key={slot}>
                  Slot {slot}: {t?.name ?? 'Unknown'}
                </div>
              );
            })}
        </div>
        <ul className="list-disc pl-4 text-xs space-y-1 text-muted-foreground mt-2">
          <li>These teams will be removed from the active roster immediately upon saving.</li>
          <li>Remaining teams will preserve their original slot numbers (sparse slots).</li>
          <li>Associated logo files for these slots will be removed from disk.</li>
          <li>Historical match results in past completed maps remain preserved.</li>
        </ul>
      </ConfirmDialog>

      {/* Delete All Teams Confirmation Dialog */}
      <ConfirmDialog
        open={deleteAllConfirmOpen}
        title="Delete ALL Teams from Roster?"
        confirmLabel="Delete All Teams"
        destructive={true}
        onConfirm={confirmDeleteAll}
        onCancel={() => setDeleteAllConfirmOpen(false)}
      >
        <p className="font-semibold text-destructive">
          This will remove all {sortedTeams.length} team(s) from the active broadcast roster!
        </p>
        <ul className="list-disc pl-4 text-xs space-y-1 text-muted-foreground mt-2">
          <li>All teams and player mappings will be cleared.</li>
          <li>All uploaded team logos will be deleted from disk.</li>
          <li>
            On-air broadcast overlays will display no teams until new teams are added or imported.
          </li>
          <li>Historical results recorded in completed matches remain untouched.</li>
        </ul>
      </ConfirmDialog>

      {/* Delete Single Team Confirmation Dialog */}
      <ConfirmDialog
        open={singleDeleteTeamNo !== null}
        title={`Delete Team ${singleDeleteTeamNo} (${singleTeamToDelete?.name ?? ''})?`}
        confirmLabel="Delete Team"
        destructive={true}
        onConfirm={confirmDeleteSingle}
        onCancel={() => setSingleDeleteTeamNo(null)}
      >
        <p>
          Are you sure you want to delete Slot {singleDeleteTeamNo} ({singleTeamToDelete?.name})?
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Remaining teams will preserve their original slot numbers. Slot {singleDeleteTeamNo} will
          become vacant.
        </p>
      </ConfirmDialog>
    </div>
  );
}
