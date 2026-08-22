import fs from 'fs';
import path from 'path';

import { getCompanionById } from '@/lib/companions';
import { frontmatterField } from '@/lib/story-bank-v3-import';
import {
  storySourceGenderCompilerPromptValue,
  storySourceGenderModeIsValid,
  type StorySourceGenderMode,
} from '@/lib/story-source-gender';
import {
  assertSourceHasRealProse,
} from '@/lib/visual-contract-compiler';
import {
  AuthoredCoverAuthorityError,
  authoredCoverAuthorityFromLocationBible,
  type AuthoredCoverAuthority,
} from '@/lib/visual-contract-compiler/coverSourceAuthority';
import {
  parseStorySourceContent,
  toVisualContractFrontmatterMarkdown,
} from '@/lib/visual-contract-compiler/storySourceContent';
import {
  assertValidSourceEvidenceCatalog,
  buildSourceEvidenceCatalog,
  type SourceEvidenceCatalog,
} from '@/lib/visual-contract-compiler/sourceEvidenceCatalog';
import type {
  PageImageDirection,
} from '@/lib/visual-contract-compiler/compileBookVisualContract';
import type {
  TemplateCompileInput,
} from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';

import {
  buildStorySourceIdentity,
  canonicalJsonDigest,
  normalizeTextForDigest,
  normalizedTextDigest,
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  writeCanonicalContentAddressedJsonArtifact,
} from './canonicalContentAddressedJson';
import type { StorySourceIdentity } from './types';

export const STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION =
  'story-source-authority-snapshot/v3' as const;
export const LEGACY_STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION_V2 =
  'story-source-authority-snapshot/v2' as const;

const DEFAULT_CHILD_GENDER = 'female';

export interface StorySourceAuthorityPage {
  pageNumber: number;
  text: string;
}

export interface StorySourceAuthoritySnapshotContent {
  storyKey: string;
  sourceIdentity: StorySourceIdentity;
  normalizedRawStorySource: string;
  fullStoryText: string;
  pages: StorySourceAuthorityPage[];
  sourceEvidenceCatalog: SourceEvidenceCatalog;
  pageImageDirections: PageImageDirection[];
  authoredCoverAuthority: AuthoredCoverAuthority | null;
  sourceGenderMode: StorySourceGenderMode;
  companion: { id: string; name?: string } | null;
}

export interface StorySourceAuthoritySnapshot {
  version: typeof STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION;
  content: StorySourceAuthoritySnapshotContent;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export interface LegacyStorySourceAuthoritySnapshotV2 {
  version: typeof LEGACY_STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION_V2;
  content: Omit<StorySourceAuthoritySnapshotContent, 'sourceGenderMode'> & {
    childGender: StorySourceGenderMode;
  };
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export function legacyStorySourceAuthoritySnapshotV2(
  snapshot: StorySourceAuthoritySnapshot,
): LegacyStorySourceAuthoritySnapshotV2 {
  const {
    sourceGenderMode,
    ...unchangedContent
  } = snapshot.content;
  const payload = {
    version: LEGACY_STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION_V2,
    content: {
      ...unchangedContent,
      childGender: sourceGenderMode,
    },
  };
  return {
    ...payload,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(payload),
  };
}

export interface StorySourceAuthorityRequest {
  repoRoot: string;
  storyKey: string;
  storyPath: string;
}

export interface StorySourceAuthorityArtifactWrite {
  path: string;
  digest: string;
  created: boolean;
}

function snapshotPayload(
  snapshot: Omit<
    StorySourceAuthoritySnapshot,
    'digestAlgorithm' | 'digest'
  >,
): unknown {
  return snapshot;
}

function normalizedStoryKey(value: string): string {
  const storyKey = value.trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,159}$/i.test(storyKey)) {
    throw new Error(
      'storyKey must be a non-empty bounded identifier containing only letters, numbers, "_" or "-"',
    );
  }
  return storyKey;
}

function loadAuthoredCoverAuthority(args: {
  storyAbsolute: string;
  companion: StorySourceAuthoritySnapshotContent['companion'];
}): AuthoredCoverAuthority | null {
  const locationBiblePath = args.storyAbsolute.replace(
    /\.md$/i,
    '.location-bible.json',
  );
  if (
    locationBiblePath === args.storyAbsolute ||
    !fs.existsSync(locationBiblePath)
  ) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(locationBiblePath, 'utf8')) as unknown;
  } catch {
    throw new Error(
      'story_source_cover_authority_invalid: adjacent location-bible JSON is invalid',
    );
  }
  try {
    return authoredCoverAuthorityFromLocationBible(raw, args.companion);
  } catch (error) {
    if (error instanceof AuthoredCoverAuthorityError) {
      throw new Error(
        `story_source_cover_authority_invalid: ${error.issues
          .map((issue) => issue.code)
          .join(', ')}`,
      );
    }
    throw error;
  }
}

export function buildStorySourceAuthoritySnapshot(
  request: StorySourceAuthorityRequest,
): StorySourceAuthoritySnapshot {
  const storyKey = normalizedStoryKey(request.storyKey);
  const storyAbsolute = resolveRepoPath(
    request.repoRoot,
    request.storyPath,
  );
  if (!fs.existsSync(storyAbsolute)) {
    throw new Error(`Story Source is missing: ${request.storyPath}`);
  }
  const rawStorySource = fs.readFileSync(storyAbsolute, 'utf8');
  const normalizedRawStorySource =
    normalizeTextForDigest(rawStorySource);
  const content = parseStorySourceContent(normalizedRawStorySource);
  assertSourceHasRealProse(
    storyKey,
    content.pages,
    'source-authority-snapshot',
  );
  const frontmatter = toVisualContractFrontmatterMarkdown(
    normalizedRawStorySource,
  );
  const sourceGenderMode =
    frontmatterField(frontmatter, 'gender') ?? DEFAULT_CHILD_GENDER;
  if (!storySourceGenderModeIsValid(sourceGenderMode)) {
    throw new Error('Story Source gender mode is invalid');
  }
  const companionId = frontmatterField(frontmatter, 'companionId');
  const companion = companionId
    ? {
        id: companionId,
        ...(getCompanionById(companionId)?.name
          ? { name: getCompanionById(companionId)!.name }
          : {}),
      }
    : null;
  const authoredCoverAuthority = loadAuthoredCoverAuthority({
    storyAbsolute,
    companion,
  });
  const sourceIdentity = buildStorySourceIdentity({
    repoRoot: request.repoRoot,
    storyPath: request.storyPath,
  });
  const sourceEvidenceCatalog = buildSourceEvidenceCatalog({
    storyKey,
    sourceIdentity,
    pages: content.pages,
  });
  const snapshotWithoutDigest = {
    version: STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION,
    content: {
      storyKey,
      sourceIdentity,
      normalizedRawStorySource,
      fullStoryText: content.fullStoryText,
      pages: content.pages
        .slice()
        .sort((left, right) => left.pageNumber - right.pageNumber),
      sourceEvidenceCatalog,
      pageImageDirections: content.pageImageDirections
        .slice()
        .sort((left, right) => left.pageNumber - right.pageNumber),
      authoredCoverAuthority,
      sourceGenderMode,
      companion,
    },
  };
  return {
    ...snapshotWithoutDigest,
    digestAlgorithm: 'canonical-json-sha256',
    digest: canonicalJsonDigest(
      snapshotPayload(snapshotWithoutDigest),
    ),
  };
}

export function assertValidStorySourceAuthoritySnapshot(
  snapshot: StorySourceAuthoritySnapshot,
): void {
  const issues: string[] = [];
  if (snapshot.version !== STORY_SOURCE_AUTHORITY_SNAPSHOT_VERSION) {
    issues.push('snapshot version is unsupported');
  }
  if (
    snapshot.digestAlgorithm !== 'canonical-json-sha256' ||
    snapshot.digest !==
      canonicalJsonDigest({
        version: snapshot.version,
        content: snapshot.content,
      })
  ) {
    issues.push('snapshot digest is stale');
  }
  if (
    snapshot.content.sourceIdentity.digest !==
    normalizedTextDigest(
      snapshot.content.normalizedRawStorySource,
    )
  ) {
    issues.push(
      'snapshot source identity does not bind normalized raw Story Source',
    );
  }
  if (
    snapshot.content.normalizedRawStorySource !==
    normalizeTextForDigest(
      snapshot.content.normalizedRawStorySource,
    )
  ) {
    issues.push(
      'snapshot raw Story Source is not normalized',
    );
  }
  const reparsed = parseStorySourceContent(
    snapshot.content.normalizedRawStorySource,
  );
  const reparsedGenderMode =
    frontmatterField(
      toVisualContractFrontmatterMarkdown(
        snapshot.content.normalizedRawStorySource,
      ),
      'gender',
    ) ?? DEFAULT_CHILD_GENDER;
  if (
    canonicalJsonDigest(reparsed.pages) !==
      canonicalJsonDigest(snapshot.content.pages) ||
    canonicalJsonDigest(reparsed.pageImageDirections) !==
      canonicalJsonDigest(
        snapshot.content.pageImageDirections,
      ) ||
    reparsed.fullStoryText !== snapshot.content.fullStoryText
  ) {
    issues.push(
      'snapshot parsed pages/image directions diverge from normalized raw Story Source',
    );
  }
  if (
    !storySourceGenderModeIsValid(snapshot.content.sourceGenderMode) ||
    reparsedGenderMode !== snapshot.content.sourceGenderMode
  ) {
    issues.push('snapshot source gender mode is stale or malformed');
  }
  const pages = snapshot.content.pages.map((page) => page.pageNumber);
  if (
    pages.length !== snapshot.content.sourceIdentity.pageCount ||
    JSON.stringify(pages) !==
      JSON.stringify(snapshot.content.sourceIdentity.pageNumbers)
  ) {
    issues.push('snapshot page coverage differs from source identity');
  }
  try {
    assertValidSourceEvidenceCatalog({
      catalog: snapshot.content.sourceEvidenceCatalog,
      storyKey: snapshot.content.storyKey,
      sourceIdentity: snapshot.content.sourceIdentity,
      pages: snapshot.content.pages,
    });
  } catch {
    issues.push(
      'snapshot Source Evidence Catalog is stale or malformed',
    );
  }
  if (issues.length > 0) {
    throw new Error(
      `Invalid Story Source authority snapshot:\n- ${issues.join('\n- ')}`,
    );
  }
}

export function storySourceSnapshotToTemplateInput(
  snapshot: StorySourceAuthoritySnapshot,
): TemplateCompileInput {
  return {
    storyKey: snapshot.content.storyKey,
    fullStoryText: snapshot.content.fullStoryText,
    pageCount: snapshot.content.pages.length,
    childGender: storySourceGenderCompilerPromptValue(
      snapshot.content.sourceGenderMode,
    ),
    companion: snapshot.content.companion,
    pageImageDirections: snapshot.content.pageImageDirections,
    pages: snapshot.content.pages,
    sourceEvidenceCatalog:
      snapshot.content.sourceEvidenceCatalog,
    sourceIdentity: snapshot.content.sourceIdentity,
    ...(snapshot.content.authoredCoverAuthority
      ? {
          authoredCoverAuthority:
            snapshot.content.authoredCoverAuthority,
        }
      : {}),
  };
}

export function persistStorySourceAuthoritySnapshot(args: {
  repoRoot: string;
  outputDir: string;
  snapshot: StorySourceAuthoritySnapshot;
  write?: boolean;
}): StorySourceAuthorityArtifactWrite {
  const outputRoot = path.resolve(args.repoRoot, args.outputDir);
  repoRelativePath(args.repoRoot, outputRoot);
  const destinationPath = path.join(
    outputRoot,
    'source-snapshots',
    `${args.snapshot.digest}.json`,
  );
  const result =
    args.write === true
      ? writeCanonicalContentAddressedJsonArtifact({
          destinationPath,
          value: args.snapshot,
        })
      : { created: false };
  return {
    path: repoRelativePath(args.repoRoot, destinationPath),
    digest: args.snapshot.digest,
    created: result.created,
  };
}
