import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  type ClosedMapResult,
  type ClosedMapTeamResult,
  type ExcelImportMode,
  type ExcelImportPreview,
  type ExcelImportResult,
  type ExcelRoundSummary,
  type ExcelValidationIssue,
  type ScoringRuleset,
  type SeriesDocument,
  type TeamRosterDocument,
  type TeamRosterEntry,
  TEAM_NAME_MAX_LENGTH,
} from '@cdf/shared';
import type { ConfigStore } from '../persistence/config-store.js';
import type { SeriesStore } from '../state/series-store.js';
import { buildExportZip, type ExportDependencies } from '../backup/export.js';
import { validateImportZip } from '../backup/import.js';

export interface ValidatedExcelTeam {
  teamNo: number;
  name: string;
}

export interface ValidatedExcelRoundTeam {
  teamNo: number;
  placement: number;
  eliminations: number;
}

export interface ValidatedExcelRound {
  roundNumber: number;
  teams: ValidatedExcelRoundTeam[];
}

export interface ValidatedExcelImport {
  mode: ExcelImportMode;
  teams: ValidatedExcelTeam[];
  rounds: ValidatedExcelRound[];
  preview: ExcelImportPreview;
}

export type ExcelImportValidationResult =
  | { ok: true; value: ValidatedExcelImport }
  | { ok: false; errors: ExcelValidationIssue[]; warnings: ExcelValidationIssue[] };

export interface ExcelImportDependencies {
  config: ConfigStore;
  series: SeriesStore;
  backupDeps?: ExportDependencies;
}

const ROUND_COLUMNS = [
  { placement: 'L', kills: 'Q' },
  { placement: 'M', kills: 'R' },
  { placement: 'N', kills: 'S' },
  { placement: 'O', kills: 'T' },
  { placement: 'P', kills: 'U' },
] as const;

function extractCellNumber(cell: ExcelJS.Cell | undefined | null): number | null {
  if (!cell) return null;
  const val = cell.value;
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'object' && val !== null && 'result' in val) {
    const res = Number(val.result);
    return isNaN(res) ? null : res;
  }
  const parsed = Number(val);
  return isNaN(parsed) ? null : parsed;
}

function extractCellString(cell: ExcelJS.Cell | undefined | null): string {
  if (!cell) return '';
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object' && val !== null && 'result' in val) {
    return String(val.result ?? '').trim();
  }
  return String(val).trim();
}

export async function validateExcelImport(
  buffer: Buffer,
  mode: ExcelImportMode = 'full',
  _options?: {
    roster?: readonly TeamRosterEntry[];
    existingClosedMaps?: readonly ClosedMapResult[];
    ruleset?: ScoringRuleset;
  },
): Promise<ExcelImportValidationResult> {
  const errors: ExcelValidationIssue[] = [];
  const warnings: ExcelValidationIssue[] = [];

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch (cause) {
    return {
      ok: false,
      errors: [{ message: `Not a valid Excel XLSX workbook file: ${String(cause)}` }],
      warnings: [],
    };
  }

  const ws = wb.getWorksheet('10. Offline Scoring Sheets');
  if (!ws) {
    return {
      ok: false,
      errors: [
        {
          message:
            'Workbook is missing required worksheet "10. Offline Scoring Sheets". Ensure the file matches the PMCC 2026 scoring sheet template.',
        },
      ],
      warnings: [],
    };
  }

  // 1. Parse and validate teams (Rows 6 to 30)
  const teams: ValidatedExcelTeam[] = [];
  const seenSlots = new Set<number>();

  for (let r = 6; r <= 30; r++) {
    const row = ws.getRow(r);
    const slot = extractCellNumber(row.getCell('I')) ?? r - 5;

    if (!slot || slot < 1 || slot > 25) {
      errors.push({
        location: `I${r}`,
        message: `Row ${r}: Invalid or missing team slot number. Expected integer 1..25.`,
      });
      continue;
    }

    if (seenSlots.has(slot)) {
      errors.push({
        location: `I${r}`,
        message: `Row ${r}: Duplicate slot number ${slot} found.`,
      });
      continue;
    }
    seenSlots.add(slot);

    // Read team name from Col K, with fallback to Col B
    const nameK = extractCellString(row.getCell('K'));
    const nameB = extractCellString(row.getCell('B'));
    const name = nameK || nameB;

    if (!name) {
      errors.push({
        location: `K${r}`,
        message: `Row ${r} (Slot ${slot}): Team name is blank or missing.`,
      });
      continue;
    }

    if (name.length > TEAM_NAME_MAX_LENGTH) {
      warnings.push({
        location: `K${r}`,
        message: `Row ${r} (Slot ${slot}): Team name "${name}" exceeds ${TEAM_NAME_MAX_LENGTH} characters.`,
      });
    }

    teams.push({ teamNo: slot, name });
  }

  // 2. Parse and validate match rounds
  const rounds: ValidatedExcelRound[] = [];
  const roundSummaries: ExcelRoundSummary[] = [];

  for (let roundIdx = 0; roundIdx < 5; roundIdx++) {
    const roundNumber = roundIdx + 1;
    const cols = ROUND_COLUMNS[roundIdx]!;
    const roundTeams: ValidatedExcelRoundTeam[] = [];
    let hasAnyData = false;

    for (let r = 6; r <= 30; r++) {
      const row = ws.getRow(r);
      const slot = extractCellNumber(row.getCell('I')) ?? r - 5;
      const placeNum = extractCellNumber(row.getCell(cols.placement));
      const elimsNum = extractCellNumber(row.getCell(cols.kills));

      if (placeNum !== null) {
        hasAnyData = true;
        if (placeNum < 1 || placeNum > 25) {
          errors.push({
            location: `${cols.placement}${r}`,
            message: `Round ${roundNumber}, Row ${r} (Slot ${slot}): Invalid placement (${placeNum}). Must be an integer 1..25.`,
          });
        }

        const eliminations = elimsNum !== null ? elimsNum : 0;
        if (eliminations < 0) {
          errors.push({
            location: `${cols.kills}${r}`,
            message: `Round ${roundNumber}, Row ${r} (Slot ${slot}): Invalid eliminations (${eliminations}). Must be non-negative.`,
          });
        }

        roundTeams.push({
          teamNo: slot,
          placement: placeNum,
          eliminations: Math.max(0, eliminations),
        });
      }
    }

    if (hasAnyData && roundTeams.length > 0) {
      // Check for duplicate placements in the round
      const seenPlacements = new Set<number>();
      for (const t of roundTeams) {
        if (seenPlacements.has(t.placement)) {
          errors.push({
            location: `${cols.placement}`,
            message: `Round ${roundNumber}: Multiple teams share placement #${t.placement}.`,
          });
        }
        seenPlacements.add(t.placement);
      }

      rounds.push({ roundNumber, teams: roundTeams });
      roundSummaries.push({
        roundNumber,
        matchName: `Match ${roundNumber}`,
        participatingTeamsCount: roundTeams.length,
      });
    }
  }

  // Handle cases where no completed matches were found
  if (mode === 'matches' && rounds.length === 0) {
    errors.push({
      location: 'L4:P30',
      message:
        'No completed match scoring rounds (placements/kills) were found in the workbook for "Matches Only" import mode. To import the 25 teams found, select "Roster Only" or "Full Sync" mode.',
    });
  } else if (mode === 'full' && rounds.length === 0) {
    warnings.push({
      message:
        'No completed match scoring rounds (placements/kills) were found. The 25 teams will be imported into the roster, but no match history will be recorded.',
    });
  }
  const valid = errors.length === 0;

  const preview: ExcelImportPreview = {
    valid,
    mode,
    teamsFound: teams.length,
    roundsFound: rounds.length,
    teamNames: teams.map((t) => t.name),
    rounds: roundSummaries,
    warnings,
    errors,
  };

  if (!valid) {
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    value: {
      mode,
      teams,
      rounds,
      preview,
    },
  };
}

export async function applyExcelImport(
  validated: ValidatedExcelImport,
  deps: ExcelImportDependencies,
): Promise<ExcelImportResult> {
  const { mode, teams, rounds } = validated;
  const warnings: string[] = [];

  // Create automatic safety pre-restore snapshot if backup dependencies exist
  if (deps.backupDeps) {
    const snapshotBuffer = await buildExportZip(deps.backupDeps);
    const selfCheck = validateImportZip(snapshotBuffer);
    if (!selfCheck.ok) {
      throw new Error(
        `Pre-import safety snapshot failed self-validation. Excel import aborted. Details: ${selfCheck.errors.join('; ')}`,
      );
    }
    // Save snapshot in data dir
    const baseDir = deps.config.instances.filePath
      ? path.dirname(deps.config.instances.filePath)
      : '.';
    const snapshotPath = path.join(baseDir, '.pre-restore-snapshot.zip');
    if (existsSync(snapshotPath)) {
      const prevPath = path.join(baseDir, '.pre-restore-snapshot.prev.zip');
      await copyFile(snapshotPath, prevPath).catch(() => {});
    }
    await writeFile(snapshotPath, snapshotBuffer);
  }

  let importedTeamsCount = 0;
  let importedMatchesCount = 0;

  // Mode: 'roster' or 'full' -> Update Team Roster
  if (mode === 'roster' || mode === 'full') {
    const currentRoster = deps.config.teams.current.teams;
    const rosterByNo = new Map(currentRoster.map((t) => [t.teamNo, t]));

    const nextRoster: TeamRosterEntry[] = teams.map((team) => {
      const existing = rosterByNo.get(team.teamNo);
      return {
        teamNo: team.teamNo,
        name: team.name,
        logoUrl: existing?.logoUrl ?? null,
      };
    });

    const newDocument: TeamRosterDocument = {
      schemaVersion: deps.config.teams.current.schemaVersion,
      teams: nextRoster,
    };

    await deps.config.saveTeams(newDocument);
    importedTeamsCount = nextRoster.length;
  }

  // Mode: 'matches' or 'full' -> Update Series Closed Maps
  if (mode === 'matches' || mode === 'full') {
    const ruleset = deps.config.scoring.current;
    const currentRoster = deps.config.teams.current.teams;
    const rosterByNo = new Map(currentRoster.map((t) => [t.teamNo, t]));
    const excelTeamsByNo = new Map(teams.map((t) => [t.teamNo, t]));

    const closedMaps: ClosedMapResult[] = rounds.map((round) => {
      const teamsResults: ClosedMapTeamResult[] = round.teams.map((t) => {
        const rosterTeam = rosterByNo.get(t.teamNo);
        const excelTeam = excelTeamsByNo.get(t.teamNo);
        const name = excelTeam?.name ?? rosterTeam?.name ?? `Team ${t.teamNo}`;
        const logoUrl = rosterTeam?.logoUrl ?? null;

        const placementPoints = ruleset.placementPoints[t.placement - 1] ?? 0;
        const killPoints = t.eliminations * ruleset.pointsPerElimination;
        const totalPoints = placementPoints + killPoints;

        return {
          teamNo: t.teamNo,
          placement: t.placement,
          eliminations: t.eliminations,
          placementPoints,
          killPoints,
          totalPoints,
          name,
          logoUrl,
        };
      });

      return {
        id: `excel-round-${round.roundNumber}-${randomUUID().slice(0, 8)}`,
        mapNumber: round.roundNumber,
        mapName: `Match ${round.roundNumber}`,
        matchId: null,
        startedAt: Date.now(),
        endedAt: Date.now(),
        teams: teamsResults,
      };
    });

    if (closedMaps.length > 0) {
      const seriesState = deps.series.getState();
      const updatedSeries: SeriesDocument = {
        ...seriesState,
        closedMaps,
        activeMatchNumber: closedMaps.length + 1,
      };
      await deps.series.replaceState(updatedSeries);
      importedMatchesCount = closedMaps.length;
    }
  }

  return {
    success: true,
    mode,
    importedTeamsCount,
    importedMatchesCount,
    warnings,
  };
}
