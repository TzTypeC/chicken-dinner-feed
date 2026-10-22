import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigStore } from '../persistence/config-store.js';
import { FontStore } from '../persistence/font-store.js';
import { LogoStore } from '../persistence/logo-store.js';
import { ManualStore } from '../state/manual-store.js';
import { MatchStore } from '../state/match-store.js';
import { SeriesStore } from '../state/series-store.js';
import { buildExportZip, type ExportDependencies } from './export.js';
import { applyImport, validateImportZip } from './import.js';

async function makeDeps(dataDir: string): Promise<ExportDependencies & { manual: ManualStore }> {
  const config = new ConfigStore({ dataDir });
  await config.load();
  const series = new SeriesStore({ dataDir });
  await series.load();
  const manual = new ManualStore({ dataDir });
  await manual.load();
  const logos = new LogoStore(dataDir);
  await logos.init();
  const fonts = new FontStore(dataDir);
  await fonts.init();
  return { config, series, manual, logos, fonts };
}

describe('backup export/import', () => {
  let sourceDir: string;
  let targetDir: string;

  beforeEach(async () => {
    sourceDir = await mkdtemp(path.join(tmpdir(), 'cdf-backup-source-'));
    targetDir = await mkdtemp(path.join(tmpdir(), 'cdf-backup-target-'));
  });

  afterEach(async () => {
    await rm(sourceDir, { recursive: true, force: true });
    await rm(targetDir, { recursive: true, force: true });
  });

  it('round-trips config, logos, fonts and series history onto a fresh install', async () => {
    const source = await makeDeps(sourceDir);

    await writeFile(
      path.join(source.logos.root, 'team-1.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
    // Captured once: urlFor() stamps a fresh timestamp on every call, and the assertion below must
    // compare against the exact string that was actually saved, not a newly generated one.
    const logoUrl = source.logos.urlFor('team-1.png', 1_700_000_000_000);
    await source.config.saveTeams({
      schemaVersion: source.config.teams.current.schemaVersion,
      teams: [{ teamNo: 1, name: 'RGN', logoUrl }],
    });

    await writeFile(path.join(source.fonts.root, 'brand-bold.ttf'), Buffer.from('fake-font-bytes'));
    await source.config.saveFonts([
      {
        family: 'Brand Bold',
        fileName: 'brand-bold.ttf',
        url: '/api/fonts/brand-bold.ttf',
        originalName: 'Brand-Bold.ttf',
      },
    ]);

    const match = new MatchStore({
      source: 'pcob',
      roster: [{ teamNo: 1, name: 'RGN', logoUrl: null }],
    });
    match.applyUpdate({
      matchId: 'm1',
      phase: 'ended',
      players: [
        {
          id: '1-1',
          name: 'P1',
          teamNo: 1,
          slot: 1,
          liveState: 'alive',
          health: 100,
          healthMax: 100,
          kills: 3,
          rank: 0,
        },
      ],
    });
    await source.series.closeMapNow(match.projectAsEnded(), 1_000);

    const zip = await buildExportZip(source);

    const target = await makeDeps(targetDir);
    const validated = validateImportZip(zip);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    expect(validated.value.summary).toEqual({
      overlayInstances: source.config.instances.current.instances.length,
      teams: 1,
      logos: 1,
      customFonts: 1,
      closedMaps: 1,
      hasManualMatch: true,
      backgrounds: 0,
    });

    await applyImport(validated.value, target);

    expect(target.config.teams.current.teams).toEqual([{ teamNo: 1, name: 'RGN', logoUrl }]);
    expect(target.config.fonts.current.fonts[0]?.family).toBe('Brand Bold');
    expect(await readdir(target.logos.root)).toEqual(['team-1.png']);
    expect(await readdir(target.fonts.root)).toEqual(['brand-bold.ttf']);
    expect(target.series.getState().closedMaps).toHaveLength(1);
  });

  it('replaces existing logo/font files rather than merging with them', async () => {
    const target = await makeDeps(targetDir);
    await writeFile(path.join(target.logos.root, 'team-99.png'), Buffer.from('stale'));

    const source = await makeDeps(sourceDir);
    await writeFile(path.join(source.logos.root, 'team-1.png'), Buffer.from('fresh'));
    await source.config.saveTeams({
      schemaVersion: source.config.teams.current.schemaVersion,
      teams: [{ teamNo: 1, name: 'RGN', logoUrl: source.logos.urlFor('team-1.png') }],
    });

    const validated = validateImportZip(await buildExportZip(source));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    await applyImport(validated.value, target);

    // The stale, unreferenced file from the target's own previous state is gone, not merged in.
    expect(await readdir(target.logos.root)).toEqual(['team-1.png']);
  });

  it('rejects garbage bytes rather than throwing', () => {
    const result = validateImportZip(Buffer.from('this is not a zip file'));
    expect(result.ok).toBe(false);
  });

  it('rejects a backup missing one of the required documents, writing nothing', async () => {
    const source = await makeDeps(sourceDir);
    const zip = await buildExportZip(source);

    // Simulate a corrupted export: re-zip everything except team-roster.json.
    const archive = new AdmZip(zip);
    archive.deleteFile('team-roster.json');

    const result = validateImportZip(archive.toBuffer());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((message) => message.includes('team-roster.json'))).toBe(true);
  });

  it('rejects a team whose referenced logo file is missing from the archive', async () => {
    const source = await makeDeps(sourceDir);
    // A logoUrl pointing at a file that was never actually written/included — a corrupt export.
    await source.config.saveTeams({
      schemaVersion: source.config.teams.current.schemaVersion,
      teams: [{ teamNo: 1, name: 'RGN', logoUrl: '/api/logos/team-1.png?v=1' }],
    });

    const result = validateImportZip(await buildExportZip(source));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((message) => message.includes('team-1.png'))).toBe(true);
  });

  it('rejects a document that fails schema validation, writing nothing', async () => {
    const source = await makeDeps(sourceDir);
    const zip = await buildExportZip(source);

    const archive = new AdmZip(zip);
    archive.updateFile('scoring-ruleset.json', Buffer.from('{"not": "a valid ruleset"}'));

    const result = validateImportZip(archive.toBuffer());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((message) => message.includes('scoring-ruleset.json'))).toBe(true);
  });

  it('round-trips manual-match.json state onto a fresh install', async () => {
    const source = await makeDeps(sourceDir);
    await source.manual.setMode('manual');
    await source.manual.patchTeam(1, { eliminations: 7, aliveCount: 0 });

    const zip = await buildExportZip(source);
    const target = await makeDeps(targetDir);
    const validated = validateImportZip(zip);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    expect(validated.value.manualMatch?.mode).toBe('manual');
    expect(validated.value.manualMatch?.teams.find((t) => t.teamNo === 1)?.eliminations).toBe(7);

    await applyImport(validated.value, target);
    expect(target.manual.getMode()).toBe('manual');
    expect(target.manual.getState().teams.find((t) => t.teamNo === 1)?.eliminations).toBe(7);
  });

  it('round-trips a series adjustment and its effect on the total (Part 8)', async () => {
    const source = await makeDeps(sourceDir);
    await source.series.insertManualMap(
      1,
      [{ teamNo: 1, placement: 1, eliminations: 2, additionalPoints: -7, adjustmentNote: 'Late' }],
      source.config.scoring.current,
    );

    const validated = validateImportZip(await buildExportZip(source));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const target = await makeDeps(targetDir);
    await applyImport(validated.value, target);

    expect(target.series.getState().closedMaps[0]?.teams[0]).toMatchObject({
      additionalPoints: -7,
      adjustmentNote: 'Late',
      totalPoints: 10 + 2 - 7,
    });
    expect(target.series.getSeriesTotals().get(1)).toBe(5);
  });

  it('imports legacy backup format v1 cleanly without manualMatch and checksums', async () => {
    const source = await makeDeps(sourceDir);
    const v2Zip = await buildExportZip(source);
    const archive = new AdmZip(v2Zip);

    // Convert to v1: remove manual-match.json and downgrade manifest
    archive.deleteFile('manual-match.json');
    archive.updateFile(
      'manifest.json',
      Buffer.from(
        JSON.stringify({
          backupFormatVersion: 1,
          exportedAt: 123456789,
          appVersion: '1.1.0',
        }),
      ),
    );

    const validated = validateImportZip(archive.toBuffer());
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.manifest.backupFormatVersion).toBe(1);
    expect(validated.value.manualMatch).toBeNull();
    expect(validated.value.summary.hasManualMatch).toBe(false);
  });

  it('rejects tampered archives when a sha256 checksum does not match', async () => {
    const source = await makeDeps(sourceDir);
    const zip = await buildExportZip(source);
    const archive = new AdmZip(zip);

    // Tamper with scoring ruleset without updating manifest hash
    archive.updateFile(
      'scoring-ruleset.json',
      Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          placementPoints: [100, 50, 20],
          pointsPerElimination: 5,
        }),
      ),
    );

    const validated = validateImportZip(archive.toBuffer());
    expect(validated.ok).toBe(false);
    if (validated.ok) return;
    expect(validated.errors.some((err) => err.includes('Checksum mismatch'))).toBe(true);
  });

  it('blocks zip slip and directory traversal attacks', async () => {
    const source = await makeDeps(sourceDir);
    const zip = await buildExportZip(source);
    const archive = new AdmZip(zip);

    // Inject evil zip entry attempting path traversal
    archive.addFile('evil.sh', Buffer.from('rm -rf /'));
    const evilEntry = archive.getEntries().find((e) => e.entryName === 'evil.sh');
    if (evilEntry) evilEntry.entryName = '../evil.sh';
    const validated = validateImportZip(archive.toBuffer());
    expect(validated.ok).toBe(false);
    if (validated.ok) return;
    expect(validated.errors.some((err) => err.includes('Zip Slip'))).toBe(true);
  });

  it('creates and rotates safety recovery snapshot on disk before applying destructive restore', async () => {
    const source = await makeDeps(sourceDir);
    const target = await makeDeps(targetDir);

    const zip = await buildExportZip(source);
    const validated = validateImportZip(zip);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    await applyImport(validated.value, target);

    const snapshotFile = path.join(targetDir, '.pre-restore-snapshot.zip');
    const entries = await readdir(targetDir);
    expect(entries).toContain('.pre-restore-snapshot.zip');

    // A second import rotates snapshot into .prev.zip
    await applyImport(validated.value, target);
    const updatedEntries = await readdir(targetDir);
    expect(updatedEntries).toContain('.pre-restore-snapshot.zip');
    expect(updatedEntries).toContain('.pre-restore-snapshot.prev.zip');
  });
});
