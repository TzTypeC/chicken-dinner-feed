import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_OVERLAY_APPEARANCE, type OverlayInstance } from '@cdf/shared';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackgroundStore } from '../persistence/background-store.js';
import { ConfigStore } from '../persistence/config-store.js';
import { backgroundRoutes } from './backgrounds.js';

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const VALID_MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);

function makeMultipartBody(fieldName: string, fileName: string, mimeType: string, bytes: Buffer) {
  const boundary = '----cdf-test-boundary';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
    'utf8',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.concat([head, bytes, tail]),
  };
}

describe('background routes', () => {
  let app: FastifyInstance;
  let dataDir: string;
  let configStore: ConfigStore;
  let backgrounds: BackgroundStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'cdf-bg-routes-'));
    configStore = new ConfigStore({ dataDir, onWarn: () => {} });
    await configStore.load();
    await configStore.saveInstances([
      {
        id: 'main',
        name: 'Main leaderboard',
        type: 'leaderboard',
        appearance: structuredClone(DEFAULT_OVERLAY_APPEARANCE),
      },
    ]);
    backgrounds = new BackgroundStore(dataDir);
    await backgrounds.init();

    app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(multipart);
    await app.register(backgroundRoutes, { config: configStore, backgrounds });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('uploads a PNG background and sets postGameBackground.mode to image', async () => {
    const mp = makeMultipartBody('background', 'bg.png', 'image/png', VALID_PNG);
    const res = await app.inject({
      method: 'POST',
      url: '/overlays/main/background',
      headers: { 'content-type': mp.contentType },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as OverlayInstance;
    expect(body.appearance.postGameBackground.mode).toBe('image');
    expect(body.appearance.postGameBackground.mediaUrl).toMatch(
      /^\/api\/backgrounds\/main\.png\?v=\d+$/,
    );
  });

  it('uploads an MP4 background, replaces the previous PNG, and sets mode to video', async () => {
    const mp1 = makeMultipartBody('background', 'bg.png', 'image/png', VALID_PNG);
    await app.inject({
      method: 'POST',
      url: '/overlays/main/background',
      headers: { 'content-type': mp1.contentType },
      payload: mp1.payload,
    });

    const mp2 = makeMultipartBody('background', 'loop.mp4', 'video/mp4', VALID_MP4);
    const res = await app.inject({
      method: 'POST',
      url: '/overlays/main/background',
      headers: { 'content-type': mp2.contentType },
      payload: mp2.payload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as OverlayInstance;
    expect(body.appearance.postGameBackground.mode).toBe('video');
    expect(body.appearance.postGameBackground.mediaUrl).toMatch(
      /^\/api\/backgrounds\/main\.mp4\?v=\d+$/,
    );
  });

  it('rejects unsupported file magic bytes with 400', async () => {
    const mp = makeMultipartBody(
      'background',
      'evil.svg',
      'image/svg+xml',
      Buffer.from('<svg></svg>', 'utf8'),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/overlays/main/background',
      headers: { 'content-type': mp.contentType },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(400);
  });

  it('deletes an uploaded background and resets mode to disabled and mediaUrl to null', async () => {
    const mp = makeMultipartBody('background', 'bg.png', 'image/png', VALID_PNG);
    await app.inject({
      method: 'POST',
      url: '/overlays/main/background',
      headers: { 'content-type': mp.contentType },
      payload: mp.payload,
    });

    const delRes = await app.inject({
      method: 'DELETE',
      url: '/overlays/main/background',
    });
    expect(delRes.statusCode).toBe(200);
    const body = delRes.json() as OverlayInstance;
    expect(body.appearance.postGameBackground.mode).toBe('disabled');
    expect(body.appearance.postGameBackground.mediaUrl).toBeNull();
  });
});
