import * as fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Supabase-backed upload so persist* never touches the network or disk.
vi.mock('../../image-storage', () => ({
  uploadOrderArtifact: vi.fn(async (input: { orderId: string; kind: string; filename: string }) => ({
    url:
      `https://qvksgpzzosotubcbizay.supabase.co/storage/v1/object/public/book-images/` +
      `orders/${input.orderId}/${input.kind}/${input.filename}`,
    storageKey: `orders/${input.orderId}/${input.kind}/${input.filename}`,
  })),
}));

import { uploadOrderArtifact } from '../../image-storage';
import {
  assertArtifactWriteAllowed,
  cleanupTemp,
  isUnderOsTmp,
  maybeMirrorLocal,
  persistBuffer,
  persistJson,
  tempPath,
} from '../runtime-artifact-store';

const ENV_KEYS = ['VERCEL_ENV', 'LOCAL_ARTIFACTS_ENABLED'] as const;

describe('runtime-artifact-store (0094 M1)', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    for (const k of ENV_KEYS) delete process.env[k];
    vi.clearAllMocks();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('throws when a serverless runtime writes outside the OS temp dir', () => {
    process.env.VERCEL_ENV = 'preview';
    const outside = path.join(process.cwd(), 'outputs', 'set-appearance-boards', 'board.png');
    expect(() => assertArtifactWriteAllowed(outside)).toThrow(/serverless runtime/);
  });

  it('allows writes under the OS temp dir even on a serverless runtime', () => {
    process.env.VERCEL_ENV = 'production';
    const inside = path.join(os.tmpdir(), 'small-heroes', 'ord1', 'scratch', 'p.png');
    expect(isUnderOsTmp(inside)).toBe(true);
    expect(() => assertArtifactWriteAllowed(inside)).not.toThrow();
  });

  it('allows project writes on local dev (no VERCEL_ENV set)', () => {
    const outside = path.join(process.cwd(), 'outputs', 'foo.json');
    expect(() => assertArtifactWriteAllowed(outside)).not.toThrow();
  });

  it('tempPath returns a path under the OS temp dir and creates it', () => {
    process.env.VERCEL_ENV = 'preview';
    const dir = tempPath('ord 42!', 'page-images');
    try {
      expect(isUnderOsTmp(dir)).toBe(true);
      expect(fs.existsSync(dir)).toBe(true);
    } finally {
      cleanupTemp('ord 42!');
    }
  });

  it('persistBuffer / persistJson go to Supabase (no local mkdir/write in persist)', async () => {
    process.env.VERCEL_ENV = 'preview';
    const desc = await persistBuffer(
      'ord1',
      'set-appearance-boards',
      'board.png',
      Buffer.from('binary'),
      'image/png'
    );
    expect(desc.storageKey).toBe('orders/ord1/set-appearance-boards/board.png');
    expect(desc.url).toContain('orders/ord1/set-appearance-boards/board.png');

    const json = await persistJson('ord1', 'debug', 'meta.json', { a: 1 });
    expect(json.storageKey).toBe('orders/ord1/debug/meta.json');

    expect(uploadOrderArtifact).toHaveBeenCalledTimes(2);
    const jsonCall = vi.mocked(uploadOrderArtifact).mock.calls[1][0];
    expect(jsonCall.contentType).toBe('application/json');
    expect(JSON.parse(jsonCall.buffer.toString())).toEqual({ a: 1 });
  });

  it('maybeMirrorLocal is a no-op on a serverless runtime even with the flag set', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.LOCAL_ARTIFACTS_ENABLED = 'true';
    const rel = 'mirror-test/serverless.json';
    const abs = path.join(process.cwd(), 'outputs', rel);
    fs.rmSync(abs, { force: true });
    maybeMirrorLocal(rel, '{}');
    expect(fs.existsSync(abs)).toBe(false);
  });

  it('maybeMirrorLocal is a no-op locally when the flag is unset', () => {
    const rel = 'mirror-test/local-off.json';
    const abs = path.join(process.cwd(), 'outputs', rel);
    fs.rmSync(abs, { force: true });
    maybeMirrorLocal(rel, '{}');
    expect(fs.existsSync(abs)).toBe(false);
  });

  it('maybeMirrorLocal writes under ./outputs locally when the flag is set', () => {
    process.env.LOCAL_ARTIFACTS_ENABLED = 'true';
    const rel = 'mirror-test/local-on.json';
    const abs = path.join(process.cwd(), 'outputs', rel);
    try {
      maybeMirrorLocal(rel, '{"ok":true}');
      expect(fs.existsSync(abs)).toBe(true);
      expect(JSON.parse(fs.readFileSync(abs, 'utf-8'))).toEqual({ ok: true });
    } finally {
      fs.rmSync(path.join(process.cwd(), 'outputs', 'mirror-test'), { recursive: true, force: true });
    }
  });
});
