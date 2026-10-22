import { ADJUSTMENT_NOTE_MAX_LENGTH } from '@cdf/shared';
import { useEffect, useRef, type ReactNode } from 'react';
import { parseAdditionalPoints } from './additional-points';

/**
 * An emptied field or a pasted non-numeric string yields `NaN` from `Number(...)`. The server
 * already rejects a non-integer with a clear 400, but that is a round-trip away — falling back to
 * the previous value keeps the input visibly a number the whole time instead of silently going
 * blank/`NaN` until the operator notices the confirm failed.
 */
function parsedOr(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface MapTeamResultValue {
  placement: number;
  eliminations: number;
  /**
   * The Additional Points entry exactly as typed. Kept as text, not a number: a numeric input
   * reports `""` while a leading `-` is being typed, which would make a penalty impossible to enter
   * and would turn malformed input into a silent 0. Parsed strictly by `parseAdditionalPoints`.
   */
  additionalPoints: string;
  /** Optional reason for the adjustment (Part 8). */
  adjustmentNote: string;
}

export interface MapResultDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Teams to show, in the order they should be listed. */
  teamNos: readonly number[];
  /** Fully populated by the caller — the dialog holds no defaults of its own. */
  values: Record<number, MapTeamResultValue>;
  teamName(teamNo: number): string;
  onChange(teamNo: number, changes: Partial<MapTeamResultValue>): void;
  onCancel(): void;
  onConfirm(): void;
  /** Extra controls above the team grid: the order switch, and where a hand-added map should go. */
  children?: ReactNode;
}

/**
 * Full-width placement/eliminations form for one map, as its own modal rather than expanding inline
 * in the (deliberately compact, side-by-side) finished-maps grid — a per-row label above each input
 * only had room to misalign itself in a narrow card; full width gives placement and eliminations
 * columns their own header row and consistent alignment down the whole team list.
 *
 * Serves both correcting a recorded map and adding one by hand. The two differ only in which teams
 * they list, what they are called, and whether a position picker is shown — not enough to justify
 * two components that would then have to be kept looking identical by hand.
 */
export function MapResultDialog({
  open,
  title,
  description,
  confirmLabel,
  teamNos,
  values,
  teamName,
  onChange,
  onCancel,
  onConfirm,
  children,
}: MapResultDialogProps) {
  const invalidAdjustments = teamNos.filter(
    (teamNo) => !parseAdditionalPoints(values[teamNo]?.additionalPoints ?? '').ok,
  ).length;
  const gridColumns =
    'grid-cols-[minmax(0,1fr)_4rem_4rem_5.5rem] sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_8rem]';
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      onCancel={onCancel}
      className="bg-card text-foreground border-border m-auto w-[min(48rem,calc(100vw-2rem))] rounded-lg border p-0 shadow-xl backdrop:bg-black/50"
    >
      {open && (
        <div className="grid gap-3 p-3 sm:p-5">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>

          {children}

          <p className="text-muted-foreground text-xs">
            <strong className="text-foreground font-medium">Adj. pts</strong> is a bonus (+) or
            penalty (−) added once to the team&rsquo;s calculated match points, from −100 to +100.
            Placement and elims are not changed, and 0 means no adjustment.
          </p>

          <div className="grid max-h-[60vh] gap-1 overflow-y-auto">
            <div className={`text-muted-foreground grid ${gridColumns} gap-2 px-1 text-xs`}>
              <span>Team</span>
              <span>Placement</span>
              <span>Elims</span>
              <span>Adj. pts</span>
            </div>
            {teamNos.map((teamNo) => {
              const value = values[teamNo];
              const rawAdjustment = value?.additionalPoints ?? '';
              const adjustment = parseAdditionalPoints(rawAdjustment);
              const errorId = `adj-error-${teamNo}`;
              return (
                <div key={teamNo} className="grid gap-1 px-1 py-0.5">
                  <div className={`grid ${gridColumns} items-center gap-2`}>
                    <span className="truncate text-sm">{teamName(teamNo)}</span>
                    <input
                      type="number"
                      min={1}
                      aria-label={`${teamName(teamNo)} placement`}
                      className="border-border bg-background min-h-9 rounded border px-2 py-1 text-sm"
                      value={value?.placement ?? 1}
                      onChange={(event) =>
                        onChange(teamNo, {
                          placement: parsedOr(event.target.value, value?.placement ?? 1),
                        })
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      aria-label={`${teamName(teamNo)} eliminations`}
                      className="border-border bg-background min-h-9 rounded border px-2 py-1 text-sm"
                      value={value?.eliminations ?? 0}
                      onChange={(event) =>
                        onChange(teamNo, {
                          eliminations: parsedOr(event.target.value, value?.eliminations ?? 0),
                        })
                      }
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`${teamName(teamNo)} additional points`}
                        aria-invalid={!adjustment.ok}
                        aria-describedby={adjustment.ok ? undefined : errorId}
                        className={`bg-background min-h-9 w-full min-w-0 rounded border px-2 py-1 text-sm tabular-nums ${
                          adjustment.ok ? 'border-border' : 'border-destructive'
                        }`}
                        value={rawAdjustment}
                        onChange={(event) =>
                          onChange(teamNo, { additionalPoints: event.target.value })
                        }
                      />
                      {rawAdjustment.trim() !== '0' && (
                        <button
                          type="button"
                          title="Reset to 0 (no adjustment)"
                          aria-label={`Reset ${teamName(teamNo)} additional points to 0`}
                          className="border-border hover:bg-secondary text-muted-foreground min-h-9 shrink-0 rounded border px-1.5 text-xs"
                          onClick={() =>
                            onChange(teamNo, { additionalPoints: '0', adjustmentNote: '' })
                          }
                        >
                          0
                        </button>
                      )}
                    </div>
                  </div>
                  {!adjustment.ok && (
                    <p id={errorId} className="text-destructive text-right text-xs">
                      {adjustment.error}
                    </p>
                  )}
                  {adjustment.ok && adjustment.value !== 0 && (
                    <input
                      type="text"
                      maxLength={ADJUSTMENT_NOTE_MAX_LENGTH}
                      placeholder="Reason (optional), e.g. Warning — late to lobby"
                      aria-label={`${teamName(teamNo)} adjustment reason`}
                      className="border-border bg-background min-h-8 rounded border px-2 py-1 text-xs"
                      value={value?.adjustmentNote ?? ''}
                      onChange={(event) => onChange(teamNo, { adjustmentNote: event.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {invalidAdjustments > 0 && (
            <p className="text-destructive text-right text-xs" role="alert">
              Fix {invalidAdjustments} invalid additional-points{' '}
              {invalidAdjustments === 1 ? 'entry' : 'entries'} before saving.
            </p>
          )}

          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="border-border hover:bg-secondary min-h-9 rounded border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={invalidAdjustments > 0}
              className="bg-primary text-primary-foreground min-h-9 rounded px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
