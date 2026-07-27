import fs from 'node:fs';
import path from 'node:path';

import {
  repoRelativePath,
  resolveRepoPath,
} from './integrity';
import {
  writeImmutableLocalArtifact,
} from './preRenderBlueprintLifecycle';
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

function stableCanonicalValue(
  value: unknown,
  location = '$',
): unknown {
  if (typeof value === 'string') return value.normalize('NFC');
  if (
    value === null ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(
        `canonical live artifact contains a non-finite number at ${location}`,
      );
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      stableCanonicalValue(entry, `${location}[${index}]`),
    );
  }
  if (value && typeof value === 'object') {
    const normalizedEntries = Object.entries(
      value as Record<string, unknown>,
    ).map(([key, entry]) => [
      key.normalize('NFC'),
      entry,
    ] as const);
    const normalizedKeys = new Set<string>();
    const result: Record<string, unknown> = {};
    for (const [key, entry] of normalizedEntries.sort(
      ([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
    )) {
      if (normalizedKeys.has(key)) {
        throw new Error(
          `canonical live artifact has duplicate normalized key at ${location}`,
        );
      }
      normalizedKeys.add(key);
      result[key] = stableCanonicalValue(
        entry,
        `${location}.${key}`,
      );
    }
    return result;
  }
  throw new Error(
    `canonical live artifact contains a non-JSON value at ${location}`,
  );
}

export function canonicalLiveAuthoringJsonBytes(
  value: unknown,
): string {
  return `${JSON.stringify(
    stableCanonicalValue(value),
    null,
    2,
  )}\n`;
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
    outputDir: string;
  },
): CanonicalLiveAuthoringArtifactStore {
  const repoRoot = path.resolve(args.repoRoot);
  const repositoryRealPath = fs.realpathSync(repoRoot);
  const outputRoot = resolveRepoPath(
    repoRoot,
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
      const result = writeImmutableLocalArtifact({
        destinationPath,
        bytes: canonicalLiveAuthoringJsonBytes(value),
      });
      return {
        path: repoRelativePath(
          repoRoot,
          destinationPath,
        ),
        digest,
        created: result.created,
      };
    },
  };
}
