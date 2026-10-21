import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PMCC_2026_ROSTER,
  DEFAULT_SCORING_RULESET,
  createDefaultSeriesDocument,
  type ClosedMapResult,
} from '@cdf/shared';
import { ConfigStore } from '../persistence/config-store.js';
import { FontStore } from '../persistence/font-store.js';
import { LogoStore } from '../persistence/logo-store.js';
import { ManualStore } from '../state/manual-store.js';
import { SeriesStore } from '../state/series-store.js';
import { buildExcelExport, resolveDefaultTemplatePath } from './export.js';
import { applyExcelImport, validateExcelImport } from './import.js';

describe('Excel Integration (WS-7.3 & WS-7.4)', () => {
  let testDir: string;
  let config: ConfigStore;
  let series: SeriesStore;
  let manual: ManualStore;
  let logos: LogoStore;
  let fonts: FontStore;

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), 'cdf-excel-test-'));
    config = new ConfigStore({ dataDir: testDir });
    await config.load();
    series = new SeriesStore({ dataDir: testDir });
    await series.load();
    manual = new ManualStore({ dataDir: testDir });
    await manual.load();
    logos = new LogoStore(testDir);
    await logos.init();
    fonts = new FontStore(testDir);
    await fonts.init();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('exports tournament scoring workbook preserving template structure, styles, and formulas', async () => {
    const closedMap1: ClosedMapResult = {
      id: 'map-1',
      mapNumber: 1,
      mapName: 'Erangel',
      startedAt: 1000,
      endedAt: 2000,
      teams: [
        {
          teamNo: 1,
          placement: 1,
          eliminations: 10,
          placementPoints: 10,
          killPoints: 10,
          totalPoints: 20,
        },
        {
          teamNo: 2,
          placement: 2,
          eliminations: 5,
          placementPoints: 6,
          killPoints: 5,
          totalPoints: 11,
        },
      ],
    };

    const seriesDoc = {
      ...createDefaultSeriesDocument(),
      closedMaps: [closedMap1],
    };

    const buffer = await buildExcelExport({
      roster: DEFAULT_PMCC_2026_ROSTER.teams,
      ruleset: DEFAULT_SCORING_RULESET,
      series: seriesDoc,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.byteLength).toBeGreaterThan(15000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet('10. Offline Scoring Sheets');
    expect(ws).toBeDefined();
    if (!ws) return;

    // Freeze panes check
    expect(ws.views[0]?.state).toBe('frozen');
    expect(ws.views[0]?.ySplit).toBe(5);

    // Merged cells check (14 merged ranges)
    expect(ws.hasMerges).toBe(true);

    // Col K: Literal string team name without external formula
    const cellK6 = ws.getCell('K6');
    expect(cellK6.value).toBe('SUKA SUKA SQUAD');
    expect(cellK6.formula).toBeUndefined();

    // Col L6 (Placement) & Q6 (Kills)
    expect(ws.getCell('L6').value).toBe(1);
    expect(ws.getCell('Q6').value).toBe(10);

    // Col V6 (Round 1 Total Points formula preserved and cached result populated)
    const cellV6 = ws.getCell('V6');
    expect(cellV6.formula).toContain('IF(L6=1,10');
    expect(cellV6.result).toBe(20);

    // Col AA6 (Total Placement Pts) & AB6 (Total Kill Pts)
    expect(ws.getCell('AA6').result).toBe(10);
    expect(ws.getCell('AB6').result).toBe(10);

    // Col AC6 (Total Points)
    expect(ws.getCell('AC6').formula).toBe('SUM(AA6:AB6)');
    expect(ws.getCell('AC6').result).toBe(20);

    // Col J6 (Rank 1 for highest points)
    expect(ws.getCell('J6').result).toBe(1);

    // Table 1 Col B6 (Rank 1 team name lookup result populated)
    const cellB6 = ws.getCell('B6');
    expect(cellB6.formula).toBe('INDEX($K$6:$K$30,MATCH(I6,$J$6:$J$30,0))');
    expect(cellB6.result).toBe('SUKA SUKA SQUAD');

    // Hidden cols P, U, Z preserved when <5 matches
    expect(ws.getColumn('P').hidden).toBe(true);
    expect(ws.getColumn('U').hidden).toBe(true);
    expect(ws.getColumn('Z').hidden).toBe(true);
  });

  it('unhides round 5 columns when 5 or more matches exist in export', async () => {
    const maps: ClosedMapResult[] = [1, 2, 3, 4, 5].map((num) => ({
      id: `map-${num}`,
      mapNumber: num,
      mapName: `Match ${num}`,
      startedAt: num * 1000,
      endedAt: num * 1000 + 500,
      teams: [
        {
          teamNo: 1,
          placement: 1,
          eliminations: 2,
          placementPoints: 10,
          killPoints: 2,
          totalPoints: 12,
        },
      ],
    }));

    const buffer = await buildExcelExport({
      roster: DEFAULT_PMCC_2026_ROSTER.teams,
      ruleset: DEFAULT_SCORING_RULESET,
      series: { ...createDefaultSeriesDocument(), closedMaps: maps },
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('10. Offline Scoring Sheets');
    expect(ws).toBeDefined();
    if (!ws) return;

    expect(ws.getColumn('P').hidden).toBe(false);
    expect(ws.getColumn('U').hidden).toBe(false);
    expect(ws.getColumn('Z').hidden).toBe(false);
  });

  it('validates and previews an exported template workbook cleanly', async () => {
    const buffer = await buildExcelExport({
      roster: DEFAULT_PMCC_2026_ROSTER.teams,
      ruleset: DEFAULT_SCORING_RULESET,
      series: createDefaultSeriesDocument(),
    });

    const previewResult = await validateExcelImport(buffer, 'full');
    expect(previewResult.ok).toBe(true);
    if (!previewResult.ok) return;

    expect(previewResult.value.teams).toHaveLength(25);
    expect(previewResult.value.teams[0]?.name).toBe('SUKA SUKA SQUAD');
    expect(previewResult.value.teams[19]?.name).toBe('Lanang nak chicken main pubg');
  });

  it('applies excel import in roster mode without modifying series state', async () => {
    const buffer = await buildExcelExport({
      roster: DEFAULT_PMCC_2026_ROSTER.teams,
      ruleset: DEFAULT_SCORING_RULESET,
      series: createDefaultSeriesDocument(),
    });

    const validated = await validateExcelImport(buffer, 'roster');
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const result = await applyExcelImport(validated.value, {
      config,
      series,
      backupDeps: { config, series, logos, fonts, manual },
    });

    expect(result.success).toBe(true);
    expect(result.importedTeamsCount).toBe(25);
    expect(result.importedMatchesCount).toBe(0);
    expect(config.teams.current.teams).toHaveLength(25);
    expect(config.teams.current.teams[19]?.name).toBe('Lanang nak chicken main pubg');
    expect(series.getState().closedMaps).toHaveLength(0);

    // Verify safety pre-restore snapshot was created on disk
    const entries = await readdir(testDir);
    expect(entries).toContain('.pre-restore-snapshot.zip');
  });

  it('applies excel import in matches mode with team snapshots', async () => {
    // Generate workbook with 1 completed round
    const closedMap1: ClosedMapResult = {
      id: 'map-1',
      mapNumber: 1,
      mapName: 'Erangel',
      startedAt: 1000,
      endedAt: 2000,
      teams: [
        {
          teamNo: 1,
          placement: 1,
          eliminations: 12,
          placementPoints: 10,
          killPoints: 12,
          totalPoints: 22,
        },
        {
          teamNo: 2,
          placement: 2,
          eliminations: 4,
          placementPoints: 6,
          killPoints: 4,
          totalPoints: 10,
        },
      ],
    };

    const buffer = await buildExcelExport({
      roster: DEFAULT_PMCC_2026_ROSTER.teams,
      ruleset: DEFAULT_SCORING_RULESET,
      series: { ...createDefaultSeriesDocument(), closedMaps: [closedMap1] },
    });

    const validated = await validateExcelImport(buffer, 'matches');
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const initialRosterCount = config.teams.current.teams.length;
    const result = await applyExcelImport(validated.value, {
      config,
      series,
      backupDeps: { config, series, logos, fonts, manual },
    });

    expect(result.success).toBe(true);
    expect(result.importedMatchesCount).toBe(1);
    expect(config.teams.current.teams).toHaveLength(initialRosterCount); // Unchanged roster
    expect(series.getState().closedMaps).toHaveLength(1);
    expect(series.getState().closedMaps[0]?.teams.find((t) => t.teamNo === 1)?.totalPoints).toBe(
      22,
    );
    expect(series.getState().closedMaps[0]?.teams.find((t) => t.teamNo === 1)?.name).toBe(
      'SUKA SUKA SQUAD',
    );
  });

  it('detects and flags duplicate placement errors in a round', async () => {
    const buffer = await buildExcelExport({
      roster: DEFAULT_PMCC_2026_ROSTER.teams,
      ruleset: DEFAULT_SCORING_RULESET,
      series: createDefaultSeriesDocument(),
    });

    // Manually tamper workbook to have duplicate placement #1 in Round 1
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('10. Offline Scoring Sheets')!;
    ws.getCell('L6').value = 1;
    ws.getCell('L7').value = 1; // Duplicate #1!

    const tampered = await wb.xlsx.writeBuffer();
    const result = await validateExcelImport(Buffer.from(tampered), 'matches');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes('Multiple teams share placement #1'))).toBe(
      true,
    );
  });

  it('imports the actual pristine template assets/PMCC 2026 OFLINE SCORING SHEETS.xlsx cleanly across modes', async () => {
    const templateBytes = await readFile(resolveDefaultTemplatePath());

    // Mode 1: Roster mode succeeds with all 25 teams
    const rosterRes = await validateExcelImport(templateBytes, 'roster');
    expect(rosterRes.ok).toBe(true);
    if (!rosterRes.ok) return;
    expect(rosterRes.value.teams).toHaveLength(25);
    expect(rosterRes.value.teams[0]?.name).toBe('SUKA SUKA SQUAD');
    expect(rosterRes.value.teams[19]?.name).toBe('Lanang nak chicken main pubg');
    expect(rosterRes.value.rounds).toHaveLength(0);

    // Mode 2: Full sync mode succeeds with 25 teams and warning that no match rounds exist
    const fullRes = await validateExcelImport(templateBytes, 'full');
    expect(fullRes.ok).toBe(true);
    if (!fullRes.ok) return;
    expect(fullRes.value.teams).toHaveLength(25);
    expect(
      fullRes.value.preview.warnings.some((w) =>
        w.message.includes('No completed match scoring rounds'),
      ),
    ).toBe(true);

    // Mode 3: Matches only mode on clean template produces explicit error without crashing
    const matchesRes = await validateExcelImport(templateBytes, 'matches');
    expect(matchesRes.ok).toBe(false);
    if (matchesRes.ok) return;
    expect(matchesRes.errors.some((e) => e.location === 'L4:P30')).toBe(true);
    expect(matchesRes.errors[0]?.message).toContain('No completed match scoring rounds');
  });

  it('parses formula cells in slot column (e.g. =I6+1) without evaluating to NaN or [object Object]', async () => {
    const templateBytes = await readFile(resolveDefaultTemplatePath());
    const res = await validateExcelImport(templateBytes, 'roster');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Slots 1 to 25 must be contiguous integers
    const slots = res.value.teams.map((t) => t.teamNo);
    expect(slots).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
});
