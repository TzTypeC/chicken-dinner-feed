import { TEAM_NAME_MAX_LENGTH } from '@cdf/shared';
import type { TeamRosterEntry } from '@cdf/shared';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseBulkTeamLines } from './bulk-teams';

export interface BulkTeamDialogProps {
  open: boolean;
  existingTeams: readonly TeamRosterEntry[];
  onCommit(newTeams: Array<{ teamNo: number; name: string }>): void;
  onClose(): void;
}

export function BulkTeamDialog({ open, existingTeams, onCommit, onClose }: BulkTeamDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputText, setInputText] = useState('');

  const existingSlots = useMemo(() => new Set(existingTeams.map((t) => t.teamNo)), [existingTeams]);

  const parsed = useMemo(
    () => parseBulkTeamLines(inputText, existingSlots, 25, existingTeams.length),
    [inputText, existingSlots, existingTeams.length],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      textareaRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    setInputText('');
    onClose();
  };

  const handleCommit = () => {
    if (!parsed.canCommit || parsed.validTeams.length === 0) return;
    onCommit(parsed.validTeams);
    handleClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onCancel={handleClose}
      className="bg-card text-foreground border-border m-auto w-[min(38rem,calc(100vw-2rem))] rounded-lg border p-0 shadow-2xl backdrop:bg-black/60"
    >
      <div className="grid gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Bulk Add Teams</h2>
            <p className="text-muted-foreground text-xs">
              Quickly paste or type multiple teams. Slots can be specified explicitly or
              auto-assigned.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground grid size-7 place-items-center rounded"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-2">
          <label htmlFor="bulk-teams-input" className="text-muted-foreground text-xs font-medium">
            Paste team list (one team per line):
          </label>
          <textarea
            id="bulk-teams-input"
            ref={textareaRef}
            rows={5}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="1 Alpha Squad&#10;2 Bravo Gaming&#10;Charlie Team&#10;T04 Delta Force"
            className="border-border bg-background placeholder:text-muted-foreground/60 w-full rounded border p-2.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-gold)]"
          />
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span>
              Supported: <code>1 TeamName</code>, <code>1, TeamName</code>, or just{' '}
              <code>TeamName</code>
            </span>
            <span>Max {TEAM_NAME_MAX_LENGTH} characters per name</span>
            <span>Roster capacity: {existingTeams.length}/25 slots</span>
          </div>
        </div>

        {/* Live Parsing Preview */}
        {parsed.rows.length > 0 && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                Preview ({parsed.validTeams.length} valid / {parsed.rows.length} lines)
              </span>
              {parsed.errorMessage && (
                <span className="text-destructive flex items-center gap-1 font-medium text-[11px]">
                  <AlertCircle className="size-3.5" />
                  {parsed.errorMessage}
                </span>
              )}
            </div>

            <div className="border-border max-h-48 overflow-y-auto rounded border bg-black/20 text-xs">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-border border-b bg-white/5 text-[11px] text-muted-foreground">
                    <th className="py-1.5 pl-2 pr-1 w-10">Line</th>
                    <th className="py-1.5 px-2 w-14">Slot</th>
                    <th className="py-1.5 px-2">Team Name</th>
                    <th className="py-1.5 pr-2 pl-1">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                  {parsed.rows.map((row) => (
                    <tr
                      key={row.lineIndex}
                      className={row.error ? 'bg-destructive/10' : 'hover:bg-white/5'}
                    >
                      <td className="py-1 pl-2 pr-1 text-muted-foreground">{row.lineIndex}</td>
                      <td className="py-1 px-2 font-semibold tabular-nums">
                        {row.slot !== null ? `T${String(row.slot).padStart(2, '0')}` : '—'}
                      </td>
                      <td className="py-1 px-2 truncate max-w-[14rem] font-sans font-medium text-foreground">
                        {row.name}
                      </td>
                      <td className="py-1 pr-2 pl-1">
                        {row.error ? (
                          <span className="text-destructive flex items-center gap-1 font-sans text-[11px]">
                            <AlertCircle className="size-3 shrink-0" />
                            {row.error}
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1 font-sans text-[11px]">
                            <CheckCircle2 className="size-3 shrink-0" />
                            Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleClose}
            className="border-border hover:bg-secondary min-h-8 rounded border px-3 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="bulk-add-commit-btn"
            disabled={!parsed.canCommit}
            onClick={handleCommit}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 min-h-8 rounded px-4 text-xs font-semibold transition-opacity"
          >
            {parsed.validTeams.length > 0
              ? `Add ${parsed.validTeams.length} Team${parsed.validTeams.length === 1 ? '' : 's'}`
              : 'Add Teams'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
