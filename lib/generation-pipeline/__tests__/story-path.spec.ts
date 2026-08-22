import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, expect, it } from 'vitest';

import {
  assertFrozenOrderStorySourceFile,
  resolveCachedStoryFilePath,
  resolveFrozenOrderStorySelection,
  runtimeStoryKey,
  toRepoRelativeStoryPath,
} from '../story-path';

const ACCEPTED_REVISION =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/integrated.md';

describe('story-path (0095 P0)', () => {
  it('toRepoRelativeStoryPath makes an absolute cwd path repo-relative (posix)', () => {
    const abs = path.join(process.cwd(), 'story-bank', 'v3-approved', 'dragon_dini_bedtime.md');
    expect(toRepoRelativeStoryPath(abs)).toBe('story-bank/v3-approved/dragon_dini_bedtime.md');
  });

  it('toRepoRelativeStoryPath leaves a relative path unchanged', () => {
    expect(toRepoRelativeStoryPath('story-bank/v5-fixed-v2/x.md')).toBe('story-bank/v5-fixed-v2/x.md');
  });

  it('resolves the absolute path from { storyDir, selectionFilename }', () => {
    const got = resolveCachedStoryFilePath({
      storyDir: 'v3-approved',
      selectionFilename: 'fox_uri_adventure.md',
    });
    expect(got).toBe(path.join(process.cwd(), 'story-bank', 'v3-approved', 'fox_uri_adventure.md'));
  });

  it('resolves a relative storyFilePath to absolute', () => {
    const got = resolveCachedStoryFilePath({ storyFilePath: 'story-bank/v3-approved/x.md' });
    expect(got).toBe(path.join(process.cwd(), 'story-bank', 'v3-approved', 'x.md'));
  });

  it('returns a legacy absolute storyFilePath unchanged (in-flight caches)', () => {
    const abs = path.join(process.cwd(), 'story-bank', 'v3-approved', 'x.md');
    expect(resolveCachedStoryFilePath({ storyFilePath: abs })).toBe(abs);
  });

  it('prefers devStoryBankFile over storyFilePath', () => {
    const got = resolveCachedStoryFilePath({
      devStoryBankFile: 'story-bank/v5-fixed-v2/d.md',
      storyFilePath: 'story-bank/v3-approved/x.md',
    });
    expect(got).toBe(path.join(process.cwd(), 'story-bank', 'v5-fixed-v2', 'd.md'));
  });

  it('returns undefined when the cache carries no story reference', () => {
    expect(resolveCachedStoryFilePath({})).toBeUndefined();
  });

  it('requires an exact accepted ref when cache authority claims an accepted revision', () => {
    expect(
      resolveCachedStoryFilePath({
        storyDir: 'qa-autonomous-20260815-v1',
        storyKey: 'chameleon_koko_bedtime',
        storySourceAuthorityKind: 'product_accepted_revision',
        selectionFilename: 'chameleon_koko_bedtime.md',
      }),
    ).toBeUndefined();
    expect(
      resolveCachedStoryFilePath({
        storyFilePath: ACCEPTED_REVISION,
        storyKey: 'chameleon_koko_bedtime',
        storySourceAuthorityKind: 'product_accepted_revision',
      }),
    ).toBe(path.join(process.cwd(), ...ACCEPTED_REVISION.split('/')));
  });

  it('round-trips: store relative → resolve to absolute → relative again', () => {
    const abs = path.join(process.cwd(), 'story-bank', 'v3-approved', 'x.md');
    const rel = toRepoRelativeStoryPath(abs);
    expect(path.isAbsolute(rel)).toBe(false);
    const resolved = resolveCachedStoryFilePath({ storyFilePath: rel })!;
    expect(path.isAbsolute(resolved)).toBe(true);
    expect(toRepoRelativeStoryPath(resolved)).toBe(rel);
  });

  it('rehydrates an exact package-bound Order story without changing its bank', () => {
    expect(
      resolveFrozenOrderStorySelection(
        'story-bank/qa-autonomous-20260815-v1/chameleon_koko_bedtime.md',
      ),
    ).toEqual({
      storyFilePath: path.join(
        process.cwd(),
        'story-bank',
        'qa-autonomous-20260815-v1',
        'chameleon_koko_bedtime.md',
      ),
      storyFileRef:
        'story-bank/qa-autonomous-20260815-v1/chameleon_koko_bedtime.md',
      storyDir: 'qa-autonomous-20260815-v1',
      storyKey: 'chameleon_koko_bedtime',
      storySourceAuthorityKind: 'legacy_story_bank',
      selectionFilename: 'chameleon_koko_bedtime.md',
      revisionDigest: null,
    });
  });

  it('rehydrates an exact product-accepted immutable revision with an explicit story key', () => {
    expect(resolveFrozenOrderStorySelection(ACCEPTED_REVISION)).toEqual({
      storyFilePath: path.join(process.cwd(), ...ACCEPTED_REVISION.split('/')),
      storyFileRef: ACCEPTED_REVISION,
      storyDir: null,
      storyKey: 'chameleon_koko_bedtime',
      storySourceAuthorityKind: 'product_accepted_revision',
      selectionFilename: 'integrated.md',
      revisionDigest:
        '20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb',
    });
    expect(
      runtimeStoryKey({
        storyFilePath: ACCEPTED_REVISION,
        selectionFilename: 'integrated.md',
      }),
    ).toBe('chameleon_koko_bedtime');
  });

  it('accepts one regular accepted-revision file and rejects a hard-linked alias', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'story-authority-hardlink-'));
    try {
      const ref =
        `story-pipeline/04_approved_story_sources/accepted/story_key/revisions/${'a'.repeat(64)}/integrated.md`;
      const target = path.join(root, ...ref.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'ordinary source', 'utf8');
      const selection = resolveFrozenOrderStorySelection(ref, {
        repoRoot: root,
      });
      expect(selection).not.toBeNull();
      expect(() =>
        assertFrozenOrderStorySourceFile(selection!, { repoRoot: root }),
      ).not.toThrow();

      const secondName = path.join(root, 'same-bytes.md');
      fs.linkSync(target, secondName);
      expect(() =>
        assertFrozenOrderStorySourceFile(selection!, { repoRoot: root }),
      ).toThrow('frozen_story_source_link_count_invalid');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an accepted-revision path whose parent resolves outside the repository root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'story-authority-root-'));
    const outside = fs.mkdtempSync(
      path.join(os.tmpdir(), 'story-authority-outside-'),
    );
    try {
      const ref =
        `story-pipeline/04_approved_story_sources/accepted/story_key/revisions/${'b'.repeat(64)}/integrated.md`;
      const revisionDir = path.dirname(path.join(root, ...ref.split('/')));
      fs.mkdirSync(path.dirname(revisionDir), { recursive: true });
      fs.writeFileSync(path.join(outside, 'integrated.md'), 'escaped source', 'utf8');
      fs.symlinkSync(
        outside,
        revisionDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      const selection = resolveFrozenOrderStorySelection(ref, {
        repoRoot: root,
      });
      expect(selection).not.toBeNull();
      expect(() =>
        assertFrozenOrderStorySourceFile(selection!, { repoRoot: root }),
      ).toThrow('frozen_story_source_path_alias_invalid');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('rejects an accepted-revision path whose parent aliases another in-repository directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'story-authority-alias-'));
    try {
      const ref =
        `story-pipeline/04_approved_story_sources/accepted/story_key/revisions/${'c'.repeat(64)}/integrated.md`;
      const revisionDir = path.dirname(path.join(root, ...ref.split('/')));
      const actual = path.join(root, 'actual-revision');
      fs.mkdirSync(path.dirname(revisionDir), { recursive: true });
      fs.mkdirSync(actual, { recursive: true });
      fs.writeFileSync(path.join(actual, 'integrated.md'), 'aliased source', 'utf8');
      fs.symlinkSync(
        actual,
        revisionDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      const selection = resolveFrozenOrderStorySelection(ref, {
        repoRoot: root,
      });
      expect(selection).not.toBeNull();
      expect(() =>
        assertFrozenOrderStorySourceFile(selection!, { repoRoot: root }),
      ).toThrow('frozen_story_source_path_alias_invalid');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('prefers the explicit durable story key on accepted-revision resumes', () => {
    expect(
      runtimeStoryKey({
        storyFilePath: ACCEPTED_REVISION,
        storyKey: 'chameleon_koko_bedtime',
        storySourceAuthorityKind: 'product_accepted_revision',
        selectionFilename: 'integrated.md',
      }),
    ).toBe('chameleon_koko_bedtime');
    expect(
      runtimeStoryKey({
        storyFilePath: ACCEPTED_REVISION,
        storyKey: 'bunny_ometz_bedtime',
        storySourceAuthorityKind: 'product_accepted_revision',
      }),
    ).toBeNull();
    expect(
      runtimeStoryKey({
        storyFilePath: ACCEPTED_REVISION,
        storyKey: 'chameleon_koko_bedtime',
        storySourceAuthorityKind: 'legacy_story_bank',
      }),
    ).toBeNull();
    expect(
      runtimeStoryKey({
        selectionFilename: 'integrated.md',
        storyKey: 'chameleon_koko_bedtime',
      }),
    ).toBeNull();
    expect(
      runtimeStoryKey({
        storyFilePath:
          'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/not-a-digest/integrated.md',
        storyKey: 'chameleon_koko_bedtime',
      }),
    ).toBeNull();
    expect(runtimeStoryKey({ selectionFilename: 'integrated.md' })).toBeNull();
    expect(runtimeStoryKey({ storyKey: '../escape' })).toBeNull();
  });

  it.each([
    'chameleon_koko_bedtime.md',
    '../story-bank/qa-autonomous-20260815-v1/chameleon_koko_bedtime.md',
    'story-bank/../secret.md',
    'story-bank/qa-autonomous-20260815-v1/not-markdown.json',
    'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/not-a-digest/integrated.md',
    'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/story.md',
    'story-pipeline/04_approved_story_sources/accepted/../revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/integrated.md',
    'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/extra/revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/integrated.md',
    'story-pipeline\\04_approved_story_sources\\accepted\\chameleon_koko_bedtime\\revisions\\20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb\\integrated.md',
    ' story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/revisions/20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb/integrated.md',
  ])('does not reinterpret legacy or escaping Order refs: %s', (value) => {
    expect(resolveFrozenOrderStorySelection(value)).toBeNull();
  });
});
