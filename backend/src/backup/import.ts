import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import {
  BACKUP_FORMAT_VERSION,
  backupManifestSchema,
  customFontsDocumentSchema,
  manualMatchDocumentSchema,
  overlayInstancesDocumentSchema,
  scoringRulesetSchema,
  seriesDocumentSchema,
  teamRosterDocumentSchema,
  type BackupManifest,
  type BackupSummary,
  type CustomFontsDocument,
  type ManualMatchDocument,
  type OverlayInstancesDocument,
  type ScoringRuleset,
  type SeriesDocument,
  type TeamRosterDocument,
} from '@cdf/shared';
import type { ZodType } from 'zod';
import {
  migrateOverlayInstances,
  migrateSchemaVersionOnly,
  migrateTeamRoster,
} from '../persistence/migrations.js';
import { BackgroundStore, fileNameFromBackgroundUrl } from '../persistence/background-store.js';
import { BACKUP_ENTRIES, buildExportZip, type ExportDependencies } from './export.js';

export interface ValidatedImport {
  manifest: BackupManifest;
  instances: OverlayInstancesDocument;
  teams: TeamRosterDocument;
  scoring: ScoringRuleset;
  fonts: CustomFontsDocument;
  series: SeriesDocument;
  manualMatch: ManualMatchDocument | null;
  /** File name (no path) → bytes, exactly as they will be written back to disk. */
  logoFiles: Map<string, Buffer>;
  fontFiles: Map<string, Buffer>;
  /** Post-game background media; empty for a backup made before backgrounds existed. */
  backgroundFiles: Map<string, Buffer>;
  summary: BackupSummary;
}

export type ImportValidationResult =
  { ok: true; value: ValidatedImport } | { ok: false; errors: string[] };

/**
 * Validates a whole backup ZIP and returns everything ready to write — or every problem found,
 * without having touched anything on disk. Nothing is applied until every document parses, migrates
 * forward cleanly (the same `migrate` functions a document loaded from disk normally runs), and every
 * file a document refers to (a team's logo, a custom font's own file) is actually present in the
 * archive. A single bad entry must not leave the app half-imported.
 */
export function validateImportZip(buffer: Buffer): ImportValidationResult {
  const errors: string[] = [];

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (cause) {
    return { ok: false, errors: [`Not a valid ZIP file. (${String(cause)})`] };
  }
  // Protect against Zip Slip / path traversal entries across entire archive
  for (const entry of zip.getEntries()) {
    if (
      entry.entryName.includes('..') ||
      entry.entryName.startsWith('/') ||
      entry.entryName.startsWith('\\') ||
      path.isAbsolute(entry.entryName)
    ) {
      errors.push(
        `Suspicious entry path "${entry.entryName}" blocked by Zip Slip / path traversal protection.`,
      );
    }
  }

  const manifest = parseEntry(
    zip,
    BACKUP_ENTRIES.manifest,
    backupManifestSchema,
    (raw) => raw,
    errors,
  );
  if (manifest && manifest.backupFormatVersion > BACKUP_FORMAT_VERSION) {
    errors.push(
      `This backup (format v${manifest.backupFormatVersion}) was made with a newer version of the ` +
        `app than this one understands (v${BACKUP_FORMAT_VERSION}). Update the app before importing it.`,
    );
  }

  // Verify SHA256 checksums if supplied by manifest (introduced in v2)
  if (manifest?.sha256Checksums) {
    for (const [entryName, expectedHash] of Object.entries(manifest.sha256Checksums)) {
      const entry = zip.getEntry(entryName);
      if (!entry) {
        errors.push(`Manifest refers to entry "${entryName}" which is missing in archive.`);
        continue;
      }
      const data = zip.readFile(entry) ?? Buffer.alloc(0);
      const actualHash = createHash('sha256').update(data).digest('hex');
      if (actualHash !== expectedHash) {
        errors.push(
          `Integrity error: Checksum mismatch for "${entryName}" (expected ${expectedHash}, got ${actualHash}).`,
        );
      }
    }
  }
  const instances = parseEntry(
    zip,
    BACKUP_ENTRIES.overlayInstances,
    overlayInstancesDocumentSchema,
    migrateOverlayInstances,
    errors,
  );
  const teams = parseEntry(
    zip,
    BACKUP_ENTRIES.teamRoster,
    teamRosterDocumentSchema,
    migrateTeamRoster,
    errors,
  );
  const scoring = parseEntry(
    zip,
    BACKUP_ENTRIES.scoringRuleset,
    scoringRulesetSchema,
    migrateSchemaVersionOnly,
    errors,
  );
  const fonts = parseEntry(
    zip,
    BACKUP_ENTRIES.customFonts,
    customFontsDocumentSchema,
    migrateSchemaVersionOnly,
    errors,
  );
  const series = parseEntry(
    zip,
    BACKUP_ENTRIES.series,
    seriesDocumentSchema,
    migrateSchemaVersionOnly,
    errors,
  );

  const manualEntry = zip.getEntry(BACKUP_ENTRIES.manualMatch);
  const manualMatch = manualEntry
    ? parseEntry(
        zip,
        BACKUP_ENTRIES.manualMatch,
        manualMatchDocumentSchema,
        migrateSchemaVersionOnly,
        errors,
      )
    : null;

  if (!manifest || !instances || !teams || !scoring || !fonts || !series) {
    return { ok: false, errors };
  }

  const logoFiles = readDirectoryEntries(zip, BACKUP_ENTRIES.logosDir, errors);
  const fontFiles = readDirectoryEntries(zip, BACKUP_ENTRIES.fontsDir, errors);
  const backgroundFiles = readDirectoryEntries(zip, BACKUP_ENTRIES.backgroundsDir, errors);
  const backgroundSniffer = new BackgroundStore('.');

  for (const instance of instances.instances) {
    const mediaUrl = instance.appearance.postGameBackground.mediaUrl;
    if (mediaUrl === null) continue;
    const fileName = fileNameFromBackgroundUrl(mediaUrl);
    const bytes = backgroundFiles.get(fileName);
    if (!bytes) {
      errors.push(
        `Overlay "${instance.name}" refers to a post-game background ("${fileName}") that is not ` +
          `in the backup.`,
      );
    } else if (!backgroundSniffer.detectFormat(bytes)) {
      errors.push(
        `The post-game background "${fileName}" in the backup is not a supported image or video.`,
      );
    }
  }

  for (const team of teams.teams) {
    if (team.logoUrl === null) continue;
    const fileName = fileNameFromLogoUrl(team.logoUrl);
    if (!logoFiles.has(fileName)) {
      errors.push(
        `Team ${team.teamNo} (${team.name}) refers to a logo file ("${fileName}") that is not in ` +
          `the backup.`,
      );
    }
  }

  for (const font of fonts.fonts) {
    if (!fontFiles.has(font.fileName)) {
      errors.push(
        `Custom font "${font.family}" refers to a file ("${font.fileName}") that is not in the ` +
          `backup.`,
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      manifest,
      instances,
      teams,
      scoring,
      fonts,
      series,
      logoFiles,
      fontFiles,
      backgroundFiles,
      manualMatch,
      summary: {
        overlayInstances: instances.instances.length,
        teams: teams.teams.length,
        logos: logoFiles.size,
        customFonts: fonts.fonts.length,
        closedMaps: series.closedMaps.length,
        hasManualMatch: manualMatch !== null,
        backgrounds: backgroundFiles.size,
      },
    },
  };
}

/**
 * Writes everything a validated import contains. Only ever called with the output of
 * `validateImportZip`'s success case — every document here is already schema-valid.
 *
 * Binary files are written before the config documents that reference them: saving a document
 * through `ConfigStore`'s normal methods immediately notifies open browser sources (the same
 * listener wiring a manual edit already goes through — ADR-0004), so the files it points to should
 * already be on disk first, not a moment later.
 */
export async function applyImport(
  validated: ValidatedImport,
  deps: ExportDependencies,
): Promise<void> {
  // Stage 1: Create in-memory safety snapshot before modifying active state
  const safetySnapshotBytes = await buildExportZip(deps);
  const snapshotValidation = validateImportZip(safetySnapshotBytes);
  if (!snapshotValidation.ok) {
    throw new Error(
      `Pre-restore safety snapshot failed self-validation. Restore aborted. Details: ${snapshotValidation.errors.join('; ')}`,
    );
  }

  // Rotate and persist safety recovery snapshot on disk (with rotation e.g. .prev.zip)
  const baseDir = deps.logos.root ? path.dirname(deps.logos.root) : '.';
  const snapshotPath = path.join(baseDir, '.pre-restore-snapshot.zip');
  const prevSnapshotPath = path.join(baseDir, '.pre-restore-snapshot.prev.zip');
  if (existsSync(snapshotPath)) {
    await copyFile(snapshotPath, prevSnapshotPath).catch(() => {});
  }
  await writeFile(snapshotPath, safetySnapshotBytes);

  // Stage 2: Apply with automated rollback on failure
  try {
    await replaceDirectory(deps.logos.root, validated.logoFiles);
    await replaceDirectory(deps.fonts.root, validated.fontFiles);
    if (deps.backgrounds) {
      const referenced = new Set(
        validated.instances.instances
          .map((instance) => instance.appearance.postGameBackground.mediaUrl)
          .filter((url): url is string => url !== null)
          .map(fileNameFromBackgroundUrl),
      );
      await replaceDirectory(
        deps.backgrounds.root,
        new Map([...validated.backgroundFiles].filter(([name]) => referenced.has(name))),
      );
    }

    await deps.config.saveTeams(validated.teams);
    await deps.config.saveScoring(validated.scoring);
    await deps.config.saveInstances(validated.instances.instances);
    await deps.config.saveFonts(validated.fonts.fonts);
    await deps.series.replaceState(validated.series);
    if (validated.manualMatch && deps.manual) {
      await deps.manual.replaceState(validated.manualMatch);
    }
  } catch (error) {
    // Automated rollback using validated safety snapshot
    try {
      const recovery = snapshotValidation.value;
      await replaceDirectory(deps.logos.root, recovery.logoFiles);
      await replaceDirectory(deps.fonts.root, recovery.fontFiles);
      if (deps.backgrounds) {
        await replaceDirectory(deps.backgrounds.root, recovery.backgroundFiles);
      }
      await deps.config.saveTeams(recovery.teams);
      await deps.config.saveScoring(recovery.scoring);
      await deps.config.saveInstances(recovery.instances.instances);
      await deps.config.saveFonts(recovery.fonts.fonts);
      await deps.series.replaceState(recovery.series);
      if (recovery.manualMatch && deps.manual) {
        await deps.manual.replaceState(recovery.manualMatch);
      }
    } catch (rollbackError) {
      throw new Error(
        `Restore failed midway, and automated rollback also encountered an error: ${String(rollbackError)}. A pre-restore snapshot remains at ${snapshotPath}. Original error: ${String(error)}`,
      );
    }
    throw new Error(
      `Restore failed midway and was cleanly rolled back to the prior safety snapshot. Original error: ${String(error)}`,
    );
  }
}

function parseEntry<T>(
  zip: AdmZip,
  entryName: string,
  schema: ZodType<T>,
  migrate: (raw: unknown) => unknown,
  errors: string[],
): T | null {
  const entry = zip.getEntry(entryName);
  if (!entry) {
    errors.push(`Missing "${entryName}" in the backup.`);
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(zip.readAsText(entry));
  } catch (cause) {
    errors.push(`"${entryName}" is not valid JSON. (${String(cause)})`);
    return null;
  }

  const migrated = migrate(raw);
  const result = schema.safeParse(migrated);
  if (!result.success) {
    errors.push(
      `"${entryName}" does not match the expected format. First problem: ` +
        `${result.error.issues[0]?.message ?? 'unknown'}.`,
    );
    return null;
  }

  return result.data;
}

/** Every file directly inside `zipPrefix`, keyed by its bare file name — protects against zip slip traversal. */
function readDirectoryEntries(
  zip: AdmZip,
  zipPrefix: string,
  errors: string[],
): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    if (!entry.entryName.startsWith(zipPrefix)) continue;
    const relative = entry.entryName.slice(zipPrefix.length);
    if (relative === '') continue;
    // Guard against directory traversal / zip slip tokens
    if (
      relative.includes('..') ||
      relative.includes('/') ||
      relative.includes('\\') ||
      path.basename(relative) !== relative
    ) {
      errors.push(
        `Suspicious entry path "${entry.entryName}" blocked by Zip Slip / path traversal protection.`,
      );
      continue;
    }
    files.set(relative, zip.readFile(entry) ?? Buffer.alloc(0));
  }
  return files;
}

/** `logoUrl` is `/api/logos/<fileName>?v=...` — strip the query string and any path down to the name. */
function fileNameFromLogoUrl(logoUrl: string): string {
  return path.basename(logoUrl.split('?')[0] ?? logoUrl);
}

async function replaceDirectory(
  directory: string,
  files: ReadonlyMap<string, Buffer>,
): Promise<void> {
  await mkdir(directory, { recursive: true });

  const existing = await readdir(directory).catch(() => []);
  for (const name of existing) {
    // Retain hidden files such as .gitkeep or .pre-restore-snapshot
    if (name.startsWith('.')) continue;
    await unlink(path.join(directory, name)).catch(() => {
      // Already gone is the outcome we wanted.
    });
  }

  for (const [name, bytes] of files) {
    const targetPath = path.resolve(directory, name);
    const resolvedDir = path.resolve(directory);
    if (!targetPath.startsWith(resolvedDir + path.sep)) {
      throw new Error(`Directory traversal attempt blocked: "${name}"`);
    }
    await writeFile(targetPath, bytes);
  }
}
