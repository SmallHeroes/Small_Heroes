import fs from 'node:fs';
import path from 'node:path';

import {
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  canonicalContentAddressedJsonBytes,
  writeCanonicalContentAddressedJsonArtifact,
} from './canonicalContentAddressedJson';
import type {
  VisualContractAuthoringArtifactWrite,
} from './visualContractAuthoringLifecycle';

export const CANONICAL_LIVE_AUTHORING_ARTIFACT_CATEGORIES =
  [
    'source-snapshots',
    'authoring-requests',
    'rejected-authoring-requests',
    'authoring-receipts',
    'readiness-evidence',
    'contract-candidates',
  ] as const;

export type CanonicalLiveAuthoringArtifactCategory =
  (typeof CANONICAL_LIVE_AUTHORING_ARTIFACT_CATEGORIES)[number];

export interface CanonicalLiveAuthoringArtifactStore {
  prepare(): void;
  persist(args: {
    category: CanonicalLiveAuthoringArtifactCategory;
    digest: string;
    value: unknown;
  }): VisualContractAuthoringArtifactWrite;
}

export interface ContainedContentAddressedJsonArtifactStore<
  Category extends string,
> {
  prepare(): void;
  persist(args: {
    category: Category;
    digest: string;
    value: unknown;
  }): VisualContractAuthoringArtifactWrite;
}

export function canonicalLiveAuthoringJsonBytes(
  value: unknown,
): string {
  return canonicalContentAddressedJsonBytes(value);
}

function assertContainedRealPath(
  repositoryRealPath: string,
  candidateRealPath: string,
  errorPrefix = 'canonical live authoring',
): void {
  const relative = path.relative(
    repositoryRealPath,
    candidateRealPath,
  );
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `${errorPrefix} output resolves outside the repository`,
    );
  }
}

function nearestExistingAncestor(
  targetPath: string,
  errorPrefix = 'canonical live authoring',
): string {
  let candidate = path.resolve(targetPath);
  while (!fs.existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) {
      throw new Error(
        `${errorPrefix} output has no existing ancestor`,
      );
    }
    candidate = parent;
  }
  return candidate;
}

let writableProbeCounter = 0;

function writableProbe(
  directory: string,
  errorPrefix = 'canonical live authoring',
): void {
  writableProbeCounter += 1;
  const probePath = path.join(
    directory,
    `.canonical-live-write-probe-${process.pid}-${writableProbeCounter}`,
  );
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(probePath, 'wx');
    fs.writeFileSync(descriptor, 'probe', 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
  } catch {
    throw new Error(
      `${errorPrefix} output is not writable`,
    );
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (fs.existsSync(probePath)) fs.unlinkSync(probePath);
  }
}

function normalizedPathForComparison(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

function pathsEqual(left: string, right: string): boolean {
  return (
    normalizedPathForComparison(left) ===
    normalizedPathForComparison(right)
  );
}

export function createContainedContentAddressedJsonArtifactStore<
  Category extends string,
>(
  args: {
    repoRoot: string;
    repositoryRealPath?: string;
    outputDir: string;
    categories: readonly Category[];
    rejectSymlinkAliases?: boolean;
    errorPrefix?: string;
  },
): ContainedContentAddressedJsonArtifactStore<Category> {
  const errorPrefix =
    args.errorPrefix ?? 'canonical live authoring';
  if (
    args.categories.length === 0 ||
    new Set(args.categories).size !== args.categories.length ||
    args.categories.some(
      (category) =>
        !/^[a-z0-9][a-z0-9-]{0,79}$/.test(category),
    )
  ) {
    throw new Error(
      `${errorPrefix} artifact categories are invalid`,
    );
  }
  const suppliedRepoRoot = path.resolve(args.repoRoot);
  const repositoryRealPath =
    args.repositoryRealPath ??
    fs.realpathSync(suppliedRepoRoot);
  if (
    fs.realpathSync(suppliedRepoRoot) !==
    fs.realpathSync(repositoryRealPath)
  ) {
    throw new Error(
      `${errorPrefix} repository real path mismatch`,
    );
  }
  const outputRoot = resolveRepoPath(
    repositoryRealPath,
    args.outputDir,
  );
  const existingAncestor = nearestExistingAncestor(
    outputRoot,
    errorPrefix,
  );
  const existingAncestorRealPath =
    fs.realpathSync(existingAncestor);
  assertContainedRealPath(
    repositoryRealPath,
    existingAncestorRealPath,
    errorPrefix,
  );
  if (
    args.rejectSymlinkAliases === true &&
    !pathsEqual(existingAncestor, existingAncestorRealPath)
  ) {
    throw new Error(
      `${errorPrefix} output uses a symlink or junction alias`,
    );
  }

  let prepared = false;
  const categoryDirectories = new Map<
    Category,
    string
  >();

  return {
    prepare() {
      fs.mkdirSync(outputRoot, { recursive: true });
      const outputRealPath = fs.realpathSync(outputRoot);
      assertContainedRealPath(
        repositoryRealPath,
        outputRealPath,
        errorPrefix,
      );
      if (
        args.rejectSymlinkAliases === true &&
        !pathsEqual(outputRoot, outputRealPath)
      ) {
        throw new Error(
          `${errorPrefix} output uses a symlink or junction alias`,
        );
      }
      for (const category of args.categories) {
        const directory = path.join(outputRoot, category);
        fs.mkdirSync(directory, { recursive: true });
        const directoryRealPath = fs.realpathSync(directory);
        assertContainedRealPath(
          repositoryRealPath,
          directoryRealPath,
          errorPrefix,
        );
        if (
          args.rejectSymlinkAliases === true &&
          !pathsEqual(directory, directoryRealPath)
        ) {
          throw new Error(
            `${errorPrefix} output category uses a symlink or junction alias`,
          );
        }
        writableProbe(directoryRealPath, errorPrefix);
        categoryDirectories.set(
          category,
          directoryRealPath,
        );
      }
      prepared = true;
    },
    persist({ category, digest, value }) {
      if (!prepared) {
        throw new Error(
          `${errorPrefix} artifact store was not prepared`,
        );
      }
      if (!/^[a-f0-9]{64}$/.test(digest)) {
        throw new Error(
          `${errorPrefix} artifact digest is invalid`,
        );
      }
      const directory = categoryDirectories.get(category);
      if (!directory) {
        throw new Error(
          `${errorPrefix} artifact category is invalid`,
        );
      }
      const destinationPath = path.join(
        directory,
        `${digest}.json`,
      );
      assertContainedRealPath(
        repositoryRealPath,
        fs.realpathSync(path.dirname(destinationPath)),
        errorPrefix,
      );
      const result =
        writeCanonicalContentAddressedJsonArtifact({
          destinationPath,
          value,
        });
      return {
        path: repoRelativePath(
          repositoryRealPath,
          destinationPath,
        ),
        digest,
        created: result.created,
      };
    },
  };
}

export function createCanonicalLiveAuthoringArtifactStore(
  args: {
    repoRoot: string;
    repositoryRealPath?: string;
    outputDir: string;
  },
): CanonicalLiveAuthoringArtifactStore {
  return createContainedContentAddressedJsonArtifactStore({
    ...args,
    categories:
      CANONICAL_LIVE_AUTHORING_ARTIFACT_CATEGORIES,
    errorPrefix: 'canonical live authoring',
  });
}
