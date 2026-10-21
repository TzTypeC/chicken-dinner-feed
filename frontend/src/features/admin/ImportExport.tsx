import { Archive, Download, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { BackupPreview, ExcelImportMode, ExcelImportPreview } from '@cdf/shared';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toast-store';

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

interface PendingBackupImport {
  file: File;
  preview: BackupPreview;
}

interface PendingExcelImport {
  file: File;
  preview: ExcelImportPreview;
  mode: ExcelImportMode;
}

export function ImportExport() {
  const backupInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [backupDragOver, setBackupDragOver] = useState(false);
  const [excelDragOver, setExcelDragOver] = useState(false);

  // Backup state
  const [pendingBackup, setPendingBackup] = useState<PendingBackupImport | null>(null);
  const [backupErrors, setBackupErrors] = useState<string[] | null>(null);

  // Excel state
  const [excelMode, setExcelMode] = useState<ExcelImportMode>('full');
  const [pendingExcel, setPendingExcel] = useState<PendingExcelImport | null>(null);
  const [excelErrors, setExcelErrors] = useState<Array<{
    location?: string;
    message: string;
  }> | null>(null);
  // --- Backup Handlers ---
  const processBackupFile = async (file: File) => {
    setBackupErrors(null);
    setBusy(true);
    try {
      const preview = await api.previewImport(file);
      setPendingBackup({ file, preview });
    } catch (error) {
      const problems: string[] = [];
      if (error instanceof ApiError && error.errors && error.errors.length > 0) {
        for (const err of error.errors) {
          if (typeof err === 'string') {
            problems.push(err);
          } else if (err && typeof err === 'object') {
            problems.push(`${err.location ? `[${err.location}] ` : ''}${err.message}`);
          }
        }
      } else {
        problems.push(describe(error));
      }
      setBackupErrors(problems);
      toast.error(
        'This backup could not be imported',
        problems.length === 1
          ? problems[0]!
          : `${problems.length} problems were found — see below.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmBackupImport = async () => {
    if (!pendingBackup) return;
    setBusy(true);
    try {
      await api.confirmImport(pendingBackup.file);
      setPendingBackup(null);
      toast.success(
        'Backup imported successfully',
        'A pre-restore recovery snapshot was saved. Reloading admin...',
      );
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      toast.error('Could not restore the backup', describe(error));
    } finally {
      setBusy(false);
    }
  };

  // --- Excel Handlers ---
  const processExcelFile = async (file: File, mode: ExcelImportMode) => {
    setExcelErrors(null);
    setBusy(true);
    try {
      const res = await api.previewExcelImport(file, mode);
      if (!res.confirmed) {
        setPendingExcel({ file, preview: res.preview, mode });
      }
    } catch (error) {
      const problems: Array<{ location?: string; message: string }> = [];
      if (error instanceof ApiError && error.errors && error.errors.length > 0) {
        for (const err of error.errors) {
          if (typeof err === 'string') {
            problems.push({ message: err });
          } else if (err && typeof err === 'object') {
            problems.push({
              location: err.location,
              message: err.message,
            });
          }
        }
      } else {
        problems.push({ message: describe(error) });
      }
      setExcelErrors(problems);
      toast.error(
        'This Excel sheet could not be imported',
        problems.length === 1
          ? `${problems[0]!.location ? `[${problems[0]!.location}] ` : ''}${problems[0]!.message}`
          : `${problems.length} errors found — see below.`,
      );
      setBusy(false);
    }
  };

  const confirmExcelCommit = async () => {
    if (!pendingExcel) return;
    setBusy(true);
    try {
      const res = await api.confirmExcelImport(pendingExcel.file, pendingExcel.mode);
      setPendingExcel(null);
      toast.success(
        'Excel workbook imported successfully',
        `Imported ${res.result.importedTeamsCount} teams and ${res.result.importedMatchesCount} match rounds. Reloading...`,
      );
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      toast.error('Could not apply Excel import', describe(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid max-w-4xl gap-8 pb-12">
      {/* DIALOG 1: Backup Restore Confirmation */}
      <ConfirmDialog
        open={pendingBackup !== null}
        title="Restore Application Backup?"
        confirmLabel="Restore and Replace Everything"
        destructive
        onCancel={() => setPendingBackup(null)}
        onConfirm={() => void confirmBackupImport()}
      >
        {pendingBackup && (
          <div className="space-y-3 text-sm">
            <p>
              Exported {new Date(pendingBackup.preview.manifest.exportedAt).toLocaleString()} from
              app v{pendingBackup.preview.manifest.appVersion}. It contains:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{pendingBackup.preview.summary.overlayInstances} overlay instance(s)</li>
              <li>
                {pendingBackup.preview.summary.teams} team(s) and{' '}
                {pendingBackup.preview.summary.logos} logo file(s)
              </li>
              <li>{pendingBackup.preview.summary.customFonts} custom font(s)</li>
              <li>{pendingBackup.preview.summary.closedMaps} completed map(s) in series history</li>
              <li>{pendingBackup.preview.summary.backgrounds ?? 0} postgame background asset(s)</li>
              <li>
                Manual Scoring State:{' '}
                {pendingBackup.preview.summary.hasManualMatch ? (
                  <span className="text-[var(--brand-gold)] font-medium">Included</span>
                ) : (
                  <span className="text-muted-foreground">None (v1 backup)</span>
                )}
              </li>
            </ul>
            <div className="rounded border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/10 p-2.5 text-xs">
              <span className="font-semibold text-foreground">Safety Guarantee:</span> An automated
              pre-restore safety snapshot (<code>.pre-restore-snapshot.zip</code>) will be recorded
              on the server before changes are applied, enabling immediate rollback if an error
              occurs.
            </div>
          </div>
        )}
      </ConfirmDialog>

      {/* DIALOG 2: Excel Import Confirmation */}
      <ConfirmDialog
        open={pendingExcel !== null}
        title={`Apply Excel Import (${pendingExcel?.mode.toUpperCase()} Mode)?`}
        confirmLabel="Confirm and Apply to Application"
        destructive
        onCancel={() => setPendingExcel(null)}
        onConfirm={() => void confirmExcelCommit()}
      >
        {pendingExcel && (
          <div className="space-y-3 text-sm">
            <p className="font-medium text-foreground">
              Workbook &ldquo;10. Offline Scoring Sheets&rdquo; validated cleanly:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>{pendingExcel.preview.teamsFound} teams found</strong> (Slot 1:{' '}
                {pendingExcel.preview.teamNames[0] ?? 'T01'} &hellip; Slot{' '}
                {pendingExcel.preview.teamsFound}:{' '}
                {pendingExcel.preview.teamNames[pendingExcel.preview.teamsFound - 1] ?? 'T25'})
              </li>
              <li>
                <strong>{pendingExcel.preview.roundsFound} match rounds found</strong>
                {pendingExcel.preview.rounds.length > 0 && (
                  <span className="text-muted-foreground text-xs block">
                    {pendingExcel.preview.rounds
                      .map((r) => `Match ${r.roundNumber} (${r.participatingTeamsCount} teams)`)
                      .join(', ')}
                  </span>
                )}
              </li>
            </ul>

            {pendingExcel.preview.warnings.length > 0 && (
              <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                <p className="font-semibold">Import Warnings:</p>
                <ul className="list-disc pl-4 mt-1">
                  {pendingExcel.preview.warnings.map((w, idx) => (
                    <li key={idx}>
                      {w.location ? `[${w.location}] ` : ''}
                      {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-muted-foreground text-xs">
              {pendingExcel.mode === 'roster' &&
                'Roster Only mode: updates team names and slot assignments. Match history and logos remain untouched.'}
              {pendingExcel.mode === 'matches' &&
                'Match History Only mode: updates finished maps in series history using historical snapshots. Active roster remains untouched.'}
              {pendingExcel.mode === 'full' &&
                'Full Sync mode: synchronizes both team roster and series match history simultaneously.'}
            </p>
          </div>
        )}
      </ConfirmDialog>

      {/* SECTION 1: Application Data Backup & Restore (.zip) */}
      <section className="border-border rounded-lg border bg-black/20 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Archive className="size-5 text-[var(--brand-gold)]" />
          <h2 className="text-base font-semibold">Application Data Backup &amp; Restore</h2>
        </div>
        <p className="text-muted-foreground text-xs mb-4 max-w-2xl">
          Create complete, portable snapshots of all persistent application state. Backups contain
          overlay configurations, team roster, scoring rulesets, custom fonts, series match history,
          manual scoring state (<code>manual-match.json</code>), logos, and postgame backgrounds.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Export Box */}
          <div className="border-border rounded border bg-white/5 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold mb-1">Export Backup</h3>
              <p className="text-muted-foreground text-xs mb-4">
                Download a self-contained <code>.zip</code> package with SHA-256 integrity
                checksums. Ideal before server migration, code redeployment, or Railway container
                restarts.
              </p>
            </div>
            <a
              href={api.backupExportUrl}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-fit items-center gap-2 rounded px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <Download className="size-3.5" />
              Download Full Backup (.zip)
            </a>
          </div>

          {/* Import Box */}
          <div className="border-border rounded border bg-white/5 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold mb-1">Restore Backup</h3>
              <p className="text-muted-foreground text-xs mb-3">
                Upload a backup ZIP. The package is verified first with in-memory validation and Zip
                Slip path traversal protection before prompting confirmation.
              </p>
            </div>

            <div
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
              onClick={() => !busy && backupInputRef.current?.click()}
              onKeyDown={(e) => {
                if (!busy && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  backupInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setBackupDragOver(true);
              }}
              onDragLeave={() => setBackupDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setBackupDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void processBackupFile(file);
              }}
              className={`border-border grid cursor-pointer place-items-center gap-1.5 rounded border-2 border-dashed p-4 text-center transition-colors ${
                backupDragOver ? 'border-primary bg-primary/10' : 'hover:bg-white/5'
              } ${busy ? 'pointer-events-none opacity-50' : ''}`}
            >
              <Upload className="text-muted-foreground size-5" />
              <p className="text-xs font-medium">
                {busy ? 'Validating backup...' : 'Drop backup .zip here, or click to browse'}
              </p>
            </div>

            <input
              ref={backupInputRef}
              type="file"
              accept=".zip"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void processBackupFile(file);
              }}
              className="hidden"
            />
          </div>
        </div>

        {backupErrors && (
          <div className="border-destructive/50 bg-destructive/10 mt-4 rounded border p-3 text-xs text-destructive">
            <p className="font-semibold">Backup validation failed:</p>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              {backupErrors.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* SECTION 2: Excel Integration (.xlsx) */}
      <section className="border-border rounded-lg border bg-black/20 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet className="size-5 text-[var(--brand-gold)]" />
          <h2 className="text-base font-semibold">PMCC 2026 Excel Scoring Sheets</h2>
        </div>
        <p className="text-muted-foreground text-xs mb-4 max-w-2xl">
          High-fidelity integration with the official{' '}
          <code>PMCC 2026 OFLINE SCORING SHEETS.xlsx</code> tournament workbook. Retains 100% of the
          original structure: merged cells, hidden rows (ruleset legend), hidden columns (Round 5),
          freeze panes, and calculation formulas.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Excel Export Box */}
          <div className="border-border rounded border bg-white/5 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold mb-1">Export Scoring Sheet</h3>
              <p className="text-muted-foreground text-xs mb-4">
                Populates the pristine tournament template with your active team roster and series
                match results. Team names in K6:K30 are decoupled from local external links, and
                calculation formulas (<code>VLOOKUP</code>, <code>INDEX</code>, <code>MATCH</code>,{' '}
                <code>RANK</code>) evaluate cleanly on any machine.
              </p>
            </div>
            <a
              href={api.excelExportUrl}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-fit items-center gap-2 rounded px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <Download className="size-3.5" />
              Download Scoring Sheet (.xlsx)
            </a>
          </div>

          {/* Excel Import Box */}
          <div className="border-border rounded border bg-white/5 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold">Import Scoring Sheet</h3>
                <span className="text-[10px] text-muted-foreground">Mode:</span>
              </div>
              <p className="text-muted-foreground text-xs mb-3">
                Upload a completed scoring sheet. Select your desired import scope below:
              </p>

              {/* Scope Selection Radios */}
              <div className="grid grid-cols-3 gap-1.5 mb-3 text-[11px]">
                <button
                  type="button"
                  onClick={() => setExcelMode('full')}
                  className={`rounded border px-2 py-1 font-medium transition-colors ${
                    excelMode === 'full'
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/20 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  Full Sync
                </button>
                <button
                  type="button"
                  onClick={() => setExcelMode('roster')}
                  className={`rounded border px-2 py-1 font-medium transition-colors ${
                    excelMode === 'roster'
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/20 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  Roster Only
                </button>
                <button
                  type="button"
                  onClick={() => setExcelMode('matches')}
                  className={`rounded border px-2 py-1 font-medium transition-colors ${
                    excelMode === 'matches'
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/20 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  Matches Only
                </button>
              </div>
            </div>

            <div
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
              onClick={() => !busy && excelInputRef.current?.click()}
              onKeyDown={(e) => {
                if (!busy && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  excelInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setExcelDragOver(true);
              }}
              onDragLeave={() => setExcelDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setExcelDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void processExcelFile(file, excelMode);
              }}
              className={`border-border grid cursor-pointer place-items-center gap-1.5 rounded border-2 border-dashed p-4 text-center transition-colors ${
                excelDragOver ? 'border-primary bg-primary/10' : 'hover:bg-white/5'
              } ${busy ? 'pointer-events-none opacity-50' : ''}`}
            >
              <Upload className="text-muted-foreground size-5" />
              <p className="text-xs font-medium">
                {busy ? 'Validating Excel sheet...' : 'Drop .xlsx file here, or click to browse'}
              </p>
            </div>

            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void processExcelFile(file, excelMode);
              }}
              className="hidden"
            />
          </div>
        </div>

        {excelErrors && (
          <div className="border-destructive/50 bg-destructive/10 mt-4 rounded border p-3 text-xs text-destructive">
            <p className="font-semibold">Excel validation failed:</p>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              {excelErrors.map((err, idx) => (
                <li key={idx}>
                  {err.location ? (
                    <span className="font-mono font-bold mr-1">[{err.location}]</span>
                  ) : null}
                  {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Safety & Deployment Footer */}
      <div className="border-border rounded border bg-black/10 p-3.5 flex items-center gap-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-5 text-[var(--brand-gold)] shrink-0" />
        <p>
          <strong>Railway &amp; Ephemeral Container Protection:</strong> Local file snapshots and
          recovery points on the server filesystem do not persist across redeployments on ephemeral
          containers without a mounted Railway Volume. Always download and store a copy of your{' '}
          <code>.zip</code> backup off-server before performing redeployments or container upgrades.
        </p>
      </div>
    </div>
  );
}
