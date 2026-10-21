import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import type { ScoringRuleset, SeriesDocument, TeamRosterEntry } from '@cdf/shared';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function resolveDefaultTemplatePath(): string {
  const candidates = [
    path.resolve(packageRoot, 'assets/PMCC 2026 OFLINE SCORING SHEETS.xlsx'),
    path.resolve(packageRoot, '../assets/PMCC 2026 OFLINE SCORING SHEETS.xlsx'),
    path.resolve(process.cwd(), 'assets/PMCC 2026 OFLINE SCORING SHEETS.xlsx'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

export interface ExcelExportDependencies {
  roster: readonly TeamRosterEntry[];
  ruleset: ScoringRuleset;
  series: SeriesDocument;
  templatePath?: string;
}

const ROUND_COLUMNS = [
  { placement: 'L', kills: 'Q', total: 'V' },
  { placement: 'M', kills: 'R', total: 'W' },
  { placement: 'N', kills: 'S', total: 'X' },
  { placement: 'O', kills: 'T', total: 'Y' },
  { placement: 'P', kills: 'U', total: 'Z' },
] as const;

export async function buildExcelExport(deps: ExcelExportDependencies): Promise<Buffer> {
  const templatePath = deps.templatePath ?? resolveDefaultTemplatePath();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);

  const ws = wb.getWorksheet('10. Offline Scoring Sheets');
  if (!ws) {
    throw new Error('Template is missing worksheet "10. Offline Scoring Sheets".');
  }

  const rosterByNo = new Map(deps.roster.map((t) => [t.teamNo, t]));
  const closedMaps = deps.series.closedMaps;

  // Unhide Round 5 columns if 5 or more matches exist
  if (closedMaps.length >= 5) {
    ws.getColumn('P').hidden = false;
    ws.getColumn('U').hidden = false;
    ws.getColumn('Z').hidden = false;
  }

  interface TeamCalculatedRow {
    teamNo: number;
    teamName: string;
    rowNumber: number;
    roundPoints: number[];
    totalPlacementPoints: number;
    totalKillPoints: number;
    totalPoints: number;
    rank: number;
  }

  const calculatedRows: TeamCalculatedRow[] = [];

  // Step 1: Populate Table 2 inputs and calculate individual team totals
  for (let slot = 1; slot <= 25; slot++) {
    const rowNum = slot + 5; // Rows 6 to 30
    const row = ws.getRow(rowNum);
    const rosterTeam = rosterByNo.get(slot);

    // Col I: Slot number
    row.getCell('I').value = slot;

    // Col K: Literal team name (decoupling from missing external workbook link)
    const rawK = row.getCell('K').value;
    let existingName = '';
    if (typeof rawK === 'string') {
      existingName = rawK.trim();
    } else if (rawK && typeof rawK === 'object' && 'result' in rawK && rawK.result !== undefined) {
      existingName = String(rawK.result).trim();
    }
    const teamName = rosterTeam?.name ?? (existingName || `Team ${slot}`);
    row.getCell('K').value = teamName;

    const roundPoints: number[] = [];
    let totalPlacementPoints = 0;
    let totalKillPoints = 0;

    for (let r = 0; r < 5; r++) {
      const cols = ROUND_COLUMNS[r]!;
      const mapResult = closedMaps[r];
      const teamResult = mapResult?.teams.find((t) => t.teamNo === slot);

      if (teamResult) {
        row.getCell(cols.placement).value = teamResult.placement;
        row.getCell(cols.kills).value = teamResult.eliminations;

        const pPoints = deps.ruleset.placementPoints[teamResult.placement - 1] ?? 0;
        const kPoints = teamResult.eliminations * deps.ruleset.pointsPerElimination;
        const pts = pPoints + kPoints;

        roundPoints.push(pts);
        totalPlacementPoints += pPoints;
        totalKillPoints += kPoints;

        const origTotalFormula = row.getCell(cols.total).formula;
        if (origTotalFormula) {
          row.getCell(cols.total).value = { formula: origTotalFormula, result: pts };
        } else {
          row.getCell(cols.total).value = pts;
        }
      } else {
        roundPoints.push(0);
        const origTotalFormula = row.getCell(cols.total).formula;
        if (origTotalFormula) {
          row.getCell(cols.total).value = { formula: origTotalFormula, result: 0 };
        }
      }
    }

    const totalPoints = totalPlacementPoints + totalKillPoints;

    const origAAFormula = row.getCell('AA').formula;
    if (origAAFormula) {
      row.getCell('AA').value = { formula: origAAFormula, result: totalPlacementPoints };
    } else {
      row.getCell('AA').value = totalPlacementPoints;
    }

    const origABFormula = row.getCell('AB').formula;
    if (origABFormula) {
      row.getCell('AB').value = { formula: origABFormula, result: totalKillPoints };
    } else {
      row.getCell('AB').value = totalKillPoints;
    }

    const origACFormula = row.getCell('AC').formula;
    if (origACFormula) {
      row.getCell('AC').value = { formula: origACFormula, result: totalPoints };
    } else {
      row.getCell('AC').value = totalPoints;
    }

    calculatedRows.push({
      teamNo: slot,
      teamName,
      rowNumber: rowNum,
      roundPoints,
      totalPlacementPoints,
      totalKillPoints,
      totalPoints,
      rank: 1, // Computed below
    });
  }

  // Step 2: Compute Excel RANK + COUNTIF - 1 behavior for Col J
  // In Excel: =RANK(AC6,$AC$4:$AC$30)+COUNTIF($AC$6:AC6,AC6)-1
  // Ties broken by earlier row number (slot order).
  for (let i = 0; i < calculatedRows.length; i++) {
    const row = calculatedRows[i]!;
    let higherCount = 0;
    for (let j = 0; j < calculatedRows.length; j++) {
      if (calculatedRows[j]!.totalPoints > row.totalPoints) {
        higherCount++;
      }
    }
    let sameEarlierCount = 0;
    for (let k = 0; k <= i; k++) {
      if (calculatedRows[k]!.totalPoints === row.totalPoints) {
        sameEarlierCount++;
      }
    }
    const computedRank = higherCount + sameEarlierCount; // same as RANK + COUNTIF - 1
    row.rank = computedRank;

    const excelRow = ws.getRow(row.rowNumber);
    const origJFormula = excelRow.getCell('J').formula;
    if (origJFormula) {
      excelRow.getCell('J').value = { formula: origJFormula, result: computedRank };
    } else {
      excelRow.getCell('J').value = computedRank;
    }
  }

  // Step 3: Populate Table 1 (Left Table: Overall Leaderboard by Rank 1..25)
  // Rows 6..30 in Table 1 display the team whose Col J rank matches row rank
  for (let rank = 1; rank <= 25; rank++) {
    const table1Row = ws.getRow(rank + 5);
    const matchingTeam = calculatedRows.find((r) => r.rank === rank) ?? calculatedRows[rank - 1]!;

    // Col A: Rank
    if (rank === 1) {
      table1Row.getCell('A').value = 1;
    } else {
      const origAFormula = table1Row.getCell('A').formula;
      table1Row.getCell('A').value = origAFormula ? { formula: origAFormula, result: rank } : rank;
    }

    // Col B: Team Name (=INDEX($K$6:$K$30,MATCH(I6,$J$6:$J$30,0)))
    const origBFormula = table1Row.getCell('B').formula;
    if (origBFormula) {
      table1Row.getCell('B').value = { formula: origBFormula, result: matchingTeam.teamName };
    } else {
      table1Row.getCell('B').value = matchingTeam.teamName;
    }

    // Cols C..F: Round 1 to 4 points (=VLOOKUP(rank,$J$6:$AC$30,col,0))
    const roundColLetters = ['C', 'D', 'E', 'F'] as const;
    for (let r = 0; r < 4; r++) {
      const colLetter = roundColLetters[r]!;
      const rPoints = matchingTeam.roundPoints[r] ?? 0;
      const origFormula = table1Row.getCell(colLetter).formula;
      if (origFormula) {
        table1Row.getCell(colLetter).value = { formula: origFormula, result: rPoints };
      } else {
        table1Row.getCell(colLetter).value = rPoints;
      }
    }

    // Col G: Total Points (=VLOOKUP(rank,$J$6:$AC$30,20,0))
    const origGFormula = table1Row.getCell('G').formula;
    if (origGFormula) {
      table1Row.getCell('G').value = {
        formula: origGFormula,
        result: matchingTeam.totalPoints,
      };
    } else {
      table1Row.getCell('G').value = matchingTeam.totalPoints;
    }
  }

  const outputBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(outputBuffer as ArrayBuffer);
}
