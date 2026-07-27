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

export function canonicalLiveAuthoringJsonBytes(
  value: unknown,
): string {
  return canonicalContentAddressedJsonBytes(value);
}

function assertContainedRealPath(
  repositoryRealPath: string,
  candidateRealPath: string,
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
      'canonical live authoring output resolves outside the repository',
    );
  }
}

function nearestExistingAncestor(targetPath: string): string {
  let candidate = path.resolve(targetPath);
  while (!fs.existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) {
      throw new Error(
        'canonical live authoring output has no existing ancestor',
      );
    }
    candidate = parent;
  }
  return candidate;
}

let writableProbeCounter = 0;

function writableProbe(directory: string): void {
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
      'canonical live authoring output is not writable',
    );
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (fs.existsSync(probePath)) fs.unlinkSync(probePath);
  }
}

export function createCanonicalLiveAuthoringArtifactStore(
  args: {
    repoRoot: string;
    repositoryRealPath?: string;
    outputDir: string;
  },
): CanonicalLiveAuthoringArtifactStore {
  const suppliedRepoRoot = path.resolve(args.repoRoot);
  const repositoryRealPath =
    args.repositoryRealPath ??
    fs.realpathSync(suppliedRepoRoot);
  if (
    fs.realpathSync(suppliedRepoRoot) !==
    fs.realpathSync(repositoryRealPath)
  ) {
    throw new Error(
      'canonical live authoring repository real path mismatch',
    );
  }
  const outputRoot = resolveRepoPath(
    repositoryRealPath,
    args.outputDir,
  );
  const existingAncestor = nearestExistingAncestor(
    outputRoot,
  );
  assertContainedRealPath(
    repositoryRealPath,
    fs.realpathSync(existingAncestor),
  );

  let prepared = false;
  const categoryDirectories = new Map<
    CanonicalLiveAuthoringArtifactCategory,
    string
  >();

  return {
    prepare() {
      fs.mkdirSync(outputRoot, { recursive: true });
      const outputRealPath = fs.realpathSync(outputRoot);
      assertContainedRealPath(
        repositoryRealPath,
        outputRealPath,
      );
      for (const category of
        CANONICAL_LIVE_AUTHORING_ARTIFACT_CATEGORIES) {
        const directory = path.join(outputRoot, category);
        fs.mkdirSync(directory, { recursive: true });
        const directoryRealPath = fs.realpathSync(directory);
        assertContainedRealPath(
          repositoryRealPath,
          directoryRealPath,
        );
        writableProbe(directoryRealPath);
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
          'canonical live authoring artifact store was not prepared',
        );
      }
      if (!/^[a-f0-9]{64}$/.test(digest)) {
        throw new Error(
          'canonical live authoring artifact digest is invalid',
        );
      }
      const directory = categoryDirectories.get(category);
      if (!directory) {
        throw new Error(
          'canonical live authoring artifact category is invalid',
        );
      }
      const destinationPath = path.join(
        directory,
        `${digest}.json`,
      );
      assertContainedRealPath(
        repositoryRealPath,
        fs.realpathSync(path.dirname(destinationPath)),
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
