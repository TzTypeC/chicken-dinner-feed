import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PRUNE_GRACE_MS = 30_000;

export type BackgroundKind = 'image' | 'video';

export interface StoredBackground {
  /** Path the overlay requests. Carries a version so a replaced file is not served from cache. */
  url: string;
  fileName: string;
  kind: BackgroundKind;
}

export const MAX_BACKGROUND_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_BACKGROUND_VIDEO_BYTES = 64 * 1024 * 1024;
export const MAX_BACKGROUND_BYTES = Math.max(
  MAX_BACKGROUND_IMAGE_BYTES,
  MAX_BACKGROUND_VIDEO_BYTES,
);

/** Instance ids are already URL-safe (`overlayInstanceIdSchema`); checked again before touching disk. */
const INSTANCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function detectBackgroundFormat(
  bytes: Buffer,
): { extension: string; kind: BackgroundKind } | null {
  const startsWith = (magic: number[], offset = 0): boolean =>
    bytes.length >= offset + magic.length &&
    magic.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: 'png', kind: 'image' };
  }
  if (startsWith([0xff, 0xd8, 0xff])) return { extension: 'jpg', kind: 'image' };
  // RIFF....WEBP — the RIFF header alone would also match WAV/AVI.
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return { extension: 'webp', kind: 'image' };
  }
  // ISO base media: a box size, then `ftyp`, at offset 4.
  if (startsWith([0x66, 0x74, 0x79, 0x70], 4)) return { extension: 'mp4', kind: 'video' };
  // EBML header (WebM / Matroska).
  if (startsWith([0x1a, 0x45, 0xdf, 0xa3])) return { extension: 'webm', kind: 'video' };

  return null;
}

/**
 * Post-game background media on disk (decision D-PMCC-05), modelled on `LogoStore`.
 *
 * Formats are identified from the file's own bytes, never from its name or declared content type.
 * SVG is deliberately *not* accepted here: unlike a logo there is no sharpness argument for it, and
 * every format we do accept is inert data.
 */
export class BackgroundStore {
  private readonly directory: string;

  constructor(dataDir: string) {
    this.directory = path.join(dataDir, 'backgrounds');
  }

  get root(): string {
    return this.directory;
  }

  async init(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  detectFormat(bytes: Buffer): { extension: string; kind: BackgroundKind } | null {
    return detectBackgroundFormat(bytes);
  }

  async save(
    instanceId: string,
    bytes: Buffer,
    now: number = Date.now(),
  ): Promise<StoredBackground> {
    if (!INSTANCE_ID_PATTERN.test(instanceId)) throw new Error('Invalid overlay id.');

    const format = this.detectFormat(bytes);
    if (!format) {
      throw new Error('That file is not a PNG, JPEG or WebP image, or an MP4 or WebM video.');
    }

    const limit = format.kind === 'video' ? MAX_BACKGROUND_VIDEO_BYTES : MAX_BACKGROUND_IMAGE_BYTES;
    if (bytes.length > limit) {
      throw new Error(
        `That ${format.kind} is larger than ${limit / 1024 / 1024} MB, the limit for a background ${format.kind}.`,
      );
    }

    await this.init();
    // One background per instance, so replacing it means removing whatever format was there.
    await this.remove(instanceId);

    const fileName = `${instanceId}.${format.extension}`;
    const target = path.join(this.directory, fileName);

    // Written beside the target and renamed into place, so a browser source never reads half a file.
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, bytes);
    await rename(temporary, target);

    return { fileName, kind: format.kind, url: this.urlFor(fileName, now) };
  }

  async remove(instanceId: string): Promise<boolean> {
    if (!INSTANCE_ID_PATTERN.test(instanceId)) return false;
    if (!existsSync(this.directory)) return false;

    const prefix = `${instanceId}.`;
    const matches = (await readdir(this.directory)).filter(
      (name) => name.startsWith(prefix) && !name.slice(prefix.length).includes('.'),
    );

    for (const name of matches) {
      await unlink(path.join(this.directory, name)).catch(() => {
        // Already gone is the outcome we wanted.
      });
    }

    return matches.length > 0;
  }

  /**
   * Deletes every stored file no instance refers to any more — after an instance is deleted, say.
   * Leftover `.tmp` files from an interrupted write are swept too.
   */
  async prune(referencedFileNames: ReadonlySet<string>, now: number = Date.now()): Promise<void> {
    if (!existsSync(this.directory)) return;
    for (const name of await readdir(this.directory)) {
      if (referencedFileNames.has(name)) continue;
      const filePath = path.join(this.directory, name);
      // A file written moments ago may be an upload whose instance has not been saved yet.
      const modifiedAt = await stat(filePath)
        .then((info) => info.mtimeMs)
        .catch(() => 0);
      if (now - modifiedAt < PRUNE_GRACE_MS) continue;
      await unlink(filePath).catch(() => {
        // Already gone is the outcome we wanted.
      });
    }
  }

  urlFor(fileName: string, version: number = Date.now()): string {
    return `/api/backgrounds/${fileName}?v=${version}`;
  }
}

/** `/api/backgrounds/<fileName>?v=...` → `<fileName>`. */
export function fileNameFromBackgroundUrl(url: string): string {
  return path.basename(url.split('?')[0] ?? url);
}
