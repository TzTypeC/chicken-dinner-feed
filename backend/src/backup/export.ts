import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { BACKUP_FORMAT_VERSION, type BackupManifest } from '@cdf/shared';
import { APP_VERSION } from '../version.js';
import type { ConfigStore } from '../persistence/config-store.js';
import type { SeriesStore } from '../state/series-store.js';
import type { LogoStore } from '../persistence/logo-store.js';
import type { FontStore } from '../persistence/font-store.js';
import type { BackgroundStore } from '../persistence/background-store.js';
import type { ManualStore } from '../state/manual-store.js';
export interface ExportDependencies {
  config: ConfigStore;
  series: SeriesStore;
  logos: LogoStore;
  fonts: FontStore;
  /** Optional so older callers (and tests) that predate post-game backgrounds keep working. */
  backgrounds?: BackgroundStore;
  /** Optional manual store to export operator manual match scoring state (Fitur A). */
  manual?: ManualStore;
}

/** Every entry name the export/import pipeline agrees on — the single source of truth for both. */
export const BACKUP_ENTRIES = {
  manifest: 'manifest.json',
  overlayInstances: 'overlay-instances.json',
  teamRoster: 'team-roster.json',
  scoringRuleset: 'scoring-ruleset.json',
  customFonts: 'custom-fonts.json',
  series: 'series.json',
  manualMatch: 'manual-match.json',
  logosDir: 'logos/',
  fontsDir: 'fonts/',
  /** Post-game background media. Absent from backups made before it existed — that is fine. */
  backgroundsDir: 'backgrounds/',
} as const;

/**
 * Everything the operator can carry from one machine to another (specs, "Import & Export").
 *
 * Deliberately excluded, and why:
 * - `.env` — machine-specific (network binding, the PCOB API's address). Copying it verbatim could
 *   silently point the new machine at the wrong observer or the wrong port.
 * - Overlay show/hide state — never persisted at all (ADR-0012): "a restart should give a known
 *   state, not resurrect whatever was on screen." There is nothing here to export.
 * - Live match/ingest state — meaningless on a different machine; a match in progress is not a
 *   setting.
 */
export async function buildExportZip(deps: ExportDependencies): Promise<Buffer> {
  const zip = new AdmZip();
  const fileMap = new Map<string, Buffer>();

  fileMap.set(BACKUP_ENTRIES.overlayInstances, jsonBuffer(deps.config.instances.current));
  fileMap.set(BACKUP_ENTRIES.teamRoster, jsonBuffer(deps.config.teams.current));
  fileMap.set(BACKUP_ENTRIES.scoringRuleset, jsonBuffer(deps.config.scoring.current));
  fileMap.set(BACKUP_ENTRIES.customFonts, jsonBuffer(deps.config.fonts.current));
  fileMap.set(BACKUP_ENTRIES.series, jsonBuffer(deps.series.getState()));

  if (deps.manual) {
    fileMap.set(BACKUP_ENTRIES.manualMatch, jsonBuffer(deps.manual.getState()));
  }

  await collectDirectory(fileMap, BACKUP_ENTRIES.logosDir, deps.logos.root);
  await collectDirectory(fileMap, BACKUP_ENTRIES.fontsDir, deps.fonts.root);
  if (deps.backgrounds) {
    await collectDirectory(fileMap, BACKUP_ENTRIES.backgroundsDir, deps.backgrounds.root);
  }

  const sha256Checksums: Record<string, string> = {};
  for (const [name, bytes] of fileMap) {
    sha256Checksums[name] = createHash('sha256').update(bytes).digest('hex');
  }

  let logoCount = 0;
  let backgroundCount = 0;
  for (const name of fileMap.keys()) {
    if (name.startsWith(BACKUP_ENTRIES.logosDir)) logoCount++;
    if (name.startsWith(BACKUP_ENTRIES.backgroundsDir)) backgroundCount++;
  }

  const manifest: BackupManifest = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: Date.now(),
    appVersion: APP_VERSION,
    sha256Checksums,
    artifacts: {
      overlayInstances: deps.config.instances.current.instances.length,
      teams: deps.config.teams.current.teams.length,
      logos: logoCount,
      customFonts: deps.config.fonts.current.fonts.length,
      closedMaps: deps.series.getState().closedMaps.length,
      hasManualMatch: Boolean(deps.manual),
      backgrounds: backgroundCount,
    },
  };

  zip.addFile(BACKUP_ENTRIES.manifest, jsonBuffer(manifest));
  for (const [name, bytes] of fileMap) {
    zip.addFile(name, bytes);
  }

  return zip.toBuffer();
}

function jsonBuffer(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value, null, 2));
}

/** Every regular file directly inside `directory`, collected under `zipPrefix` — never recurses. */
async function collectDirectory(
  fileMap: Map<string, Buffer>,
  zipPrefix: string,
  directory: string,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const bytes = await readFile(path.join(directory, entry.name));
    fileMap.set(`${zipPrefix}${entry.name}`, bytes);
  }
}
