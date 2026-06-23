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
  assertCacheHasNoLocalArtifactPaths,
  assertCanonGenerationLocal,
  cleanupTemp,
  findEphemeralLocalArtifactPaths,
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

describe('pipelineCache local-path invariant (0094 M3b)', () => {
  it('passes a clean cache (URLs + committed story-bank paths only)', () => {
    const cache = {
      storyFilePath: 'story-bank/v3-approved/dragon_dini_bedtime.md',
      devStoryBankFile: 'story-bank/v3-approved/fox_adventure.md',
      dna: { childDNA: 'a freckled child', companionDNA: 'a small dragon' },
      characterAnchorStore: {
        child: {
          url:
            'https://qvksgpzzosotubcbizay.supabase.co/storage/v1/object/public/book-images/' +
            'orders/o1/character-anchors/child.png',
        },
      },
      childExpressionSheet: {
        baseAnchorUrl:
          'https://qvksgpzzosotubcbizay.supabase.co/storage/v1/object/public/book-images/orders/o1/x.png',
      },
    };
    expect(findEphemeralLocalArtifactPaths(cache)).toEqual([]);
    expect(() => assertCacheHasNoLocalArtifactPaths(cache)).not.toThrow();
  });

  it('flags an ./outputs artifact path', () => {
    const cache = { board: { boardPath: 'outputs/set-appearance-boards/scene1/board.png' } };
    const found = findEphemeralLocalArtifactPaths(cache);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('board.boardPath');
    expect(() => assertCacheHasNoLocalArtifactPaths(cache)).toThrow(/ephemeral local artifact path/);
  });

  it('flags Windows-absolute and /tmp and /var/task paths, anywhere in the tree', () => {
    const cache = {
      a: 'C:\\Users\\guy\\outputs\\board.png',
      b: { nested: ['ok', '/tmp/small-heroes/o1/scratch/p.png'] },
      c: '/var/task/outputs/page.json',
    };
    expect(findEphemeralLocalArtifactPaths(cache).length).toBe(3);
  });

  it('does NOT flag https URLs that merely contain the word outputs', () => {
    const cache = { u: 'https://cdn.example.com/outputs/page.png' };
    expect(findEphemeralLocalArtifactPaths(cache)).toEqual([]);
  });

  // 0095 P0: committed read-only bundle assets survive across invocations — allowed in cache.
  it('does NOT flag committed read-only bundle paths under /var/task (story-bank, public)', () => {
    const cache = {
      storyFilePath: '/var/task/story-bank/v3-approved/dragon_dini_bedtime.md', // legacy absolute committed
      sheet: '/var/task/public/companions/dragon_dini/style01-sheets/front.png',
    };
    expect(findEphemeralLocalArtifactPaths(cache)).toEqual([]);
    expect(() => assertCacheHasNoLocalArtifactPaths(cache)).not.toThrow();
  });

  // 0103: Style-01 anchor referenceOrderUsed carries committed /var/task/style-references textures.
  it('does NOT flag committed read-only style-references paths in anchor referenceOrderUsed', () => {
    const cache = {
      characterAnchorStore: {
        child: {
          url:
            'https://qvksgpzzosotubcbizay.supabase.co/storage/v1/object/public/book-images/orders/o1/character-anchors/child.png',
          referenceOrderUsed: [
            'https://qvksgpzzosotubcbizay.supabase.co/storage/v1/object/public/book-images/orders/o1/references/main-child.jpg',
            '/var/task/style-references/01/style01-texture-night-window.png',
            '/var/task/style-references/01/style01-texture-porch-lavender.png',
          ],
        },
      },
    };
    expect(findEphemeralLocalArtifactPaths(cache)).toEqual([]);
    expect(() => assertCacheHasNoLocalArtifactPaths(cache)).not.toThrow();
  });

  it('still flags a genuinely ephemeral /var/task/outputs path alongside committed style-references', () => {
    const cache = {
      characterAnchorStore: {
        child: {
          referenceOrderUsed: [
            '/var/task/style-references/01/style01-texture-night-window.png', // committed → ok
            '/var/task/outputs/anchors/o1/candidate-1.png', // generated → flagged
          ],
        },
      },
    };
    const found = findEphemeralLocalArtifactPaths(cache);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('/var/task/outputs/anchors/o1/candidate-1.png');
    expect(() => assertCacheHasNoLocalArtifactPaths(cache)).toThrow(/ephemeral local artifact path/);
  });

  it('still flags a GENERATED artifact written under /var/task/outputs', () => {
    expect(
      findEphemeralLocalArtifactPaths({ x: '/var/task/outputs/set-appearance-boards/s/board.png' })
    ).toHaveLength(1);
  });

  it('still flags a non-committed absolute /var/task path', () => {
    expect(findEphemeralLocalArtifactPaths({ x: '/var/task/something/else.png' })).toHaveLength(1);
  });
});

describe('canon generation load-only guard (0094 M4)', () => {
  const saved = process.env.VERCEL_ENV;
  afterEach(() => {
    if (saved === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = saved;
  });

  it('throws on a serverless runtime (canon tools never run in the cloud)', () => {
    process.env.VERCEL_ENV = 'preview';
    expect(() => assertCanonGenerationLocal('generateCompanionCharacterSheet')).toThrow(
      /local canon\/dev tool/
    );
  });

  it('is a no-op on local dev (no VERCEL_ENV)', () => {
    delete process.env.VERCEL_ENV;
    expect(() => assertCanonGenerationLocal('generateZoneObjectSheetCandidates')).not.toThrow();
  });
});
