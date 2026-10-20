import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BackgroundStore,
  detectBackgroundFormat,
  fileNameFromBackgroundUrl,
} from './background-store.js';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_HEADER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const MP4_HEADER = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);
const WEBM_HEADER = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
const SVG_TEXT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8');

describe('BackgroundStore', () => {
  let tempDir: string;
  let store: BackgroundStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'cdf-bg-test-'));
    store = new BackgroundStore(tempDir);
    await store.init();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('detects PNG, JPEG, WebP images and MP4, WebM videos by magic bytes', () => {
    expect(detectBackgroundFormat(PNG_HEADER)).toEqual({ extension: 'png', kind: 'image' });
    expect(detectBackgroundFormat(JPEG_HEADER)).toEqual({ extension: 'jpg', kind: 'image' });
    expect(detectBackgroundFormat(WEBP_HEADER)).toEqual({ extension: 'webp', kind: 'image' });
    expect(detectBackgroundFormat(MP4_HEADER)).toEqual({ extension: 'mp4', kind: 'video' });
    expect(detectBackgroundFormat(WEBM_HEADER)).toEqual({ extension: 'webm', kind: 'video' });
  });

  it('rejects SVG and arbitrary binary payloads', () => {
    expect(detectBackgroundFormat(SVG_TEXT)).toBeNull();
    expect(detectBackgroundFormat(Buffer.from('not a media file'))).toBeNull();
    // RIFF header without WEBP signature (e.g. WAV) must be rejected
    expect(
      detectBackgroundFormat(
        Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]),
      ),
    ).toBeNull();
  });

  it('saves a background file, replaces an older format for the same instance, and removes cleanly', async () => {
    const savedImage = await store.save('main', PNG_HEADER, 1000);
    expect(savedImage).toEqual({
      fileName: 'main.png',
      kind: 'image',
      url: '/api/backgrounds/main.png?v=1000',
    });
    expect(await readdir(store.root)).toEqual(['main.png']);

    const savedVideo = await store.save('main', MP4_HEADER, 2000);
    expect(savedVideo).toEqual({
      fileName: 'main.mp4',
      kind: 'video',
      url: '/api/backgrounds/main.mp4?v=2000',
    });
    expect(await readdir(store.root)).toEqual(['main.mp4']);

    expect(fileNameFromBackgroundUrl(savedVideo.url)).toBe('main.mp4');

    const removed = await store.remove('main');
    expect(removed).toBe(true);
    expect(await readdir(store.root)).toEqual([]);
  });

  it('prunes unreferenced background files past the grace window', async () => {
    await store.save('main', PNG_HEADER, 1000);
    await writeFile(path.join(store.root, 'orphan.jpg'), JPEG_HEADER);

    // Advance `now` by 60 seconds so the grace window passes
    await store.prune(new Set(['main.png']), Date.now() + 60_000);

    expect(await readdir(store.root)).toEqual(['main.png']);
  });
});

