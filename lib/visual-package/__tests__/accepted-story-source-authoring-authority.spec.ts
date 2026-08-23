import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  acceptedStorySourceAuthoringAuthorityBindsSource,
  loadAcceptedStorySourceAuthoringAuthority,
} from '../acceptedStorySourceAuthoringAuthority';
import {
  buildStorySourceAuthoritySnapshot,
  storySourceSnapshotToTemplateInput,
} from '../storySourceAuthority';
import {
  buildTemplateCompileUserPrompt,
} from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';
import { extractDeterministicFacts } from '@/lib/visual-contract-compiler/extractDeterministicFacts';

const STORY_KEY = 'chameleon_koko_bedtime';
const REVISION =
  '3ef645415b3cdd5945baeaa275d97ae0aa0491bf30addbcc46208475278f534a';
const STORY_PATH =
  `story-pipeline/04_approved_story_sources/accepted/${STORY_KEY}/` +
  `revisions/${REVISION}/integrated.md`;
const REVISION_ROOT = path.dirname(STORY_PATH);
const LEGACY_REVISION =
  '20a1280107a94ca0134c08351bc18565883ee358ce7ed1ca47ea797549bca1eb';
const LEGACY_STORY_PATH =
  `story-pipeline/04_approved_story_sources/accepted/${STORY_KEY}/` +
  `revisions/${LEGACY_REVISION}/integrated.md`;

const temporaryRoots: string[] = [];

function tempAcceptedRevision(): string {
  const repoRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'accepted-authoring-authority-'),
  );
  temporaryRoots.push(repoRoot);
  const target = path.join(repoRoot, REVISION_ROOT);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(process.cwd(), REVISION_ROOT), target, {
    recursive: true,
  });
  return repoRoot;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('accepted Story Source authoring authority', () => {
  it('revalidates the exact nine-file accepted-v3 inventory and binds continuity into the prompt input', () => {
    const authority = loadAcceptedStorySourceAuthoringAuthority({
      repoRoot: process.cwd(),
      storyKey: STORY_KEY,
      storyPath: STORY_PATH,
    });
    expect(authority).toMatchObject({
      version: 'accepted-story-source-authoring-authority/v1',
      revisionDigest: REVISION,
      manifestDigest:
        '157d729d9e023fde4e22d82a96bafcc19825523a1d5c7378d3df0a50eb4f8462',
      manifestSha256:
        'e25df837debd54d6ffb958584f434b477a872d8f235d36731862b80102cf40ef',
      productAcceptanceDigest:
        'bf267c499381a581b34365790b6e3a74b2ab8e34bfee34d2f39143e456cad98b',
      technicalReviewDigest:
        'b447194273806856307c924974ebc13d07417272fa44a125ab25d87ad1b369f0',
      continuityIntent: {
        childWardrobeTransitionPages: [8],
        companionStateTransitionPages: [2, 3, 5, 6],
      },
    });
    expect(Object.keys(authority!.fileSha256).sort()).toEqual([
      'enrichment-manifest.json',
      'enrichment-review-bundle.json',
      'integrated.md',
      'manifest.json',
      'product-acceptance.json',
      'revision-identity.json',
      'story.md',
      'technical-review.json',
      'visual-directions.json',
    ]);
    expect(
      acceptedStorySourceAuthoringAuthorityBindsSource({
        authority: authority!,
        storyKey: STORY_KEY,
        storyPath: STORY_PATH,
      }),
    ).toBe(true);
    expect(
      acceptedStorySourceAuthoringAuthorityBindsSource({
        authority: authority!,
        storyKey: 'replayed_story',
        storyPath: 'stories/replayed_story.md',
      }),
    ).toBe(false);

    const snapshot = buildStorySourceAuthoritySnapshot({
      repoRoot: process.cwd(),
      storyKey: STORY_KEY,
      storyPath: STORY_PATH,
    });
    expect(snapshot.version).toBe('story-source-authority-snapshot/v4');
    expect(snapshot.content.acceptedRevisionAuthority).toEqual(authority);
    const input = storySourceSnapshotToTemplateInput(snapshot);
    expect(input.continuityIntent).toEqual(authority!.continuityIntent);
    const prompt = buildTemplateCompileUserPrompt(
      input,
      extractDeterministicFacts(input),
    );
    expect(prompt).toContain('PRODUCT-ACCEPTED CONTINUITY INTENT');
    expect(prompt).toContain('exactly pages [8]');
    expect(prompt).toContain('exactly pages [2, 3, 5, 6]');
    expect(prompt).toContain('tiny fabric shoulder satchel in warm mustard');
  });

  it('fails closed on stale accepted bytes and on a non-exact inventory', () => {
    const staleRoot = tempAcceptedRevision();
    fs.appendFileSync(
      path.join(staleRoot, STORY_PATH),
      '\nmutated\n',
      'utf8',
    );
    expect(() =>
      loadAcceptedStorySourceAuthoringAuthority({
        repoRoot: staleRoot,
        storyKey: STORY_KEY,
        storyPath: STORY_PATH,
      }),
    ).toThrow('accepted_story_source_manifest_file_stale');

    const extraRoot = tempAcceptedRevision();
    fs.writeFileSync(
      path.join(extraRoot, REVISION_ROOT, 'unexpected.json'),
      '{}\n',
      'utf8',
    );
    expect(() =>
      loadAcceptedStorySourceAuthoringAuthority({
        repoRoot: extraRoot,
        storyKey: STORY_KEY,
        storyPath: STORY_PATH,
      }),
    ).toThrow('accepted_story_source_inventory_invalid');

    const hardlinkRoot = tempAcceptedRevision();
    const integratedPath = path.join(hardlinkRoot, STORY_PATH);
    const linkedSource = path.join(hardlinkRoot, 'linked-integrated.md');
    fs.renameSync(integratedPath, linkedSource);
    fs.linkSync(linkedSource, integratedPath);
    expect(() =>
      loadAcceptedStorySourceAuthoringAuthority({
        repoRoot: hardlinkRoot,
        storyKey: STORY_KEY,
        storyPath: STORY_PATH,
      }),
    ).toThrow('accepted_story_source_inventory_file_invalid');
  });

  it('rejects malformed accepted paths while leaving ordinary Story Sources unbound', () => {
    expect(
      loadAcceptedStorySourceAuthoringAuthority({
        repoRoot: process.cwd(),
        storyKey: 'ordinary_story',
        storyPath: 'stories/ordinary_story.md',
      }),
    ).toBeNull();
    expect(
      loadAcceptedStorySourceAuthoringAuthority({
        repoRoot: process.cwd(),
        storyKey: STORY_KEY,
        storyPath:
          `story-pipeline/04_approved_story_sources/accepted/` +
          `${STORY_KEY}/story.md`,
      }),
    ).toBeNull();
    const legacySnapshot = buildStorySourceAuthoritySnapshot({
      repoRoot: process.cwd(),
      storyKey: STORY_KEY,
      storyPath: LEGACY_STORY_PATH,
    });
    expect(legacySnapshot.content.acceptedRevisionAuthority).toBeNull();
    expect(() =>
      loadAcceptedStorySourceAuthoringAuthority({
        repoRoot: process.cwd(),
        storyKey: STORY_KEY,
        storyPath:
          `story-pipeline/04_approved_story_sources/accepted/${STORY_KEY}/` +
          `revisions/${REVISION}/story.md`,
      }),
    ).toThrow('accepted_story_source_revision_path_invalid');
  });
});
