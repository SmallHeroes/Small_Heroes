import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';

export const VITEST_WORKLOAD_POLICY_SCHEMA =
  'small-heroes-vitest-workload-policy/v1';

const EVIDENCE_IDS = new Set([
  'direct_child_process_load',
  'measured_full_load_timeout',
  'measured_repository_scan_contention',
]);

const ERROR_CODES = new Set([
  'alias_ambiguity',
  'duplicate_canonical_path',
  'duplicate_manifest_target',
  'include_surface_invalid',
  'inventory_omission',
  'manifest_evidence_invalid',
  'manifest_not_sorted',
  'manifest_path_invalid',
  'missing_manifest_target',
  'noncanonical_phase_target',
  'overlapping_phase_target',
  'policy_invalid',
]);

export class VitestWorkloadClassificationError extends Error {
  constructor(code) {
    if (!ERROR_CODES.has(code)) {
      throw new TypeError('unknown workload classification error code');
    }
    super(`Vitest workload classification failed: ${code}`);
    this.name = 'VitestWorkloadClassificationError';
    this.code = code;
  }
}

function fail(code) {
  throw new VitestWorkloadClassificationError(code);
}

function isCanonicalPath(value) {
  return (
    typeof value === 'string' &&
    value.startsWith('lib/') &&
    value.endsWith('.spec.ts') &&
    !value.includes('\\') &&
    path.posix.normalize(value) === value &&
    !value.split('/').includes('..')
  );
}

function segmentMatches(value, pattern) {
  let expression = '^';
  for (const character of pattern) {
    if (character === '*') {
      expression += '[^/]*';
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  expression += '$';
  return new RegExp(expression).test(value);
}

export function matchesVitestInclude(candidate, includePattern) {
  const candidateSegments = candidate.split('/');
  const patternSegments = includePattern.split('/');

  const matchAt = (candidateIndex, patternIndex) => {
    if (patternIndex === patternSegments.length) {
      return candidateIndex === candidateSegments.length;
    }
    if (patternSegments[patternIndex] === '**') {
      if (patternIndex === patternSegments.length - 1) {
        return true;
      }
      for (
        let nextCandidate = candidateIndex;
        nextCandidate <= candidateSegments.length;
        nextCandidate += 1
      ) {
        if (matchAt(nextCandidate, patternIndex + 1)) {
          return true;
        }
      }
      return false;
    }
    return (
      candidateIndex < candidateSegments.length &&
      segmentMatches(
        candidateSegments[candidateIndex],
        patternSegments[patternIndex],
      ) &&
      matchAt(candidateIndex + 1, patternIndex + 1)
    );
  };

  return matchAt(0, 0);
}

function validateCanonicalPathList(paths) {
  if (!Array.isArray(paths)) {
    fail('policy_invalid');
  }
  const exact = new Set();
  const aliases = new Map();

  for (const candidate of paths) {
    if (!isCanonicalPath(candidate)) {
      fail('manifest_path_invalid');
    }
    if (exact.has(candidate)) {
      fail('duplicate_canonical_path');
    }
    exact.add(candidate);

    const aliasKey = candidate.toLowerCase();
    if (aliases.has(aliasKey) && aliases.get(aliasKey) !== candidate) {
      fail('alias_ambiguity');
    }
    aliases.set(aliasKey, candidate);
  }

  return [...paths];
}

function validatePolicy(policy) {
  if (
    !policy ||
    typeof policy !== 'object' ||
    policy.schemaVersion !== VITEST_WORKLOAD_POLICY_SCHEMA ||
    !Array.isArray(policy.canonicalIncludes) ||
    policy.canonicalIncludes.length === 0 ||
    !Array.isArray(policy.resourceIntensiveSpecs) ||
    !Number.isSafeInteger(policy.ordinaryMaxWorkers) ||
    policy.ordinaryMaxWorkers < 1 ||
    policy.ordinaryMaxWorkers > 4 ||
    !Number.isSafeInteger(policy.resourceIntensiveMaxWorkers) ||
    policy.resourceIntensiveMaxWorkers < 1 ||
    policy.resourceIntensiveMaxWorkers > 2
  ) {
    fail('policy_invalid');
  }

  const includes = new Set();
  for (const includePattern of policy.canonicalIncludes) {
    if (
      typeof includePattern !== 'string' ||
      !includePattern.startsWith('lib/') ||
      includePattern.includes('\\') ||
      includes.has(includePattern)
    ) {
      fail('include_surface_invalid');
    }
    includes.add(includePattern);
  }

  const manifestPaths = [];
  const seenManifestPaths = new Set();
  for (const entry of policy.resourceIntensiveSpecs) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !isCanonicalPath(entry.path)
    ) {
      fail('manifest_path_invalid');
    }
    if (seenManifestPaths.has(entry.path)) {
      fail('duplicate_manifest_target');
    }
    seenManifestPaths.add(entry.path);
    manifestPaths.push(entry.path);

    if (
      !Array.isArray(entry.evidence) ||
      entry.evidence.length === 0 ||
      new Set(entry.evidence).size !== entry.evidence.length ||
      entry.evidence.some((evidence) => !EVIDENCE_IDS.has(evidence))
    ) {
      fail('manifest_evidence_invalid');
    }
  }

  const sortedManifest = [...manifestPaths].sort();
  if (
    manifestPaths.some((manifestPath, index) =>
      manifestPath !== sortedManifest[index],
    )
  ) {
    fail('manifest_not_sorted');
  }

  return policy;
}

export function loadVitestWorkloadPolicy(repositoryRoot) {
  const policyPath = path.join(
    repositoryRoot,
    'test-infrastructure',
    'vitest-workload-policy.json',
  );
  return validatePolicy(
    JSON.parse(readFileSync(policyPath, 'utf8')),
  );
}

export function discoverCanonicalVitestSpecs(
  repositoryRoot,
  canonicalIncludes,
) {
  if (!Array.isArray(canonicalIncludes) || canonicalIncludes.length === 0) {
    fail('include_surface_invalid');
  }

  const repositoryRealPath = realpathSync.native(repositoryRoot);
  const libRoot = path.join(repositoryRealPath, 'lib');
  const candidates = [];
  const realPathOwners = new Map();

  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path
        .relative(repositoryRealPath, absolutePath)
        .split(path.sep)
        .join('/');
      const stat = lstatSync(absolutePath);

      if (stat.isSymbolicLink()) {
        fail('alias_ambiguity');
      }
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (
        !entry.isFile() ||
        !canonicalIncludes.some((includePattern) =>
          matchesVitestInclude(relativePath, includePattern),
        )
      ) {
        continue;
      }
      if (!isCanonicalPath(relativePath)) {
        fail('manifest_path_invalid');
      }

      const fileRealPath = realpathSync.native(absolutePath);
      const contained = path.relative(repositoryRealPath, fileRealPath);
      if (
        contained === '..' ||
        contained.startsWith(`..${path.sep}`) ||
        path.isAbsolute(contained)
      ) {
        fail('alias_ambiguity');
      }
      const realPathKey = fileRealPath.toLowerCase();
      if (
        realPathOwners.has(realPathKey) &&
        realPathOwners.get(realPathKey) !== relativePath
      ) {
        fail('alias_ambiguity');
      }
      realPathOwners.set(realPathKey, relativePath);
      candidates.push(relativePath);
    }
  };

  walk(libRoot);
  candidates.sort();
  return validateCanonicalPathList(candidates);
}

export function assertVitestPartition({
  inventory,
  ordinary,
  resourceIntensive,
}) {
  const canonicalInventory = validateCanonicalPathList(inventory);
  const canonicalOrdinary = validateCanonicalPathList(ordinary);
  const canonicalResource = validateCanonicalPathList(resourceIntensive);
  const inventorySet = new Set(canonicalInventory);
  const ordinarySet = new Set(canonicalOrdinary);
  const resourceSet = new Set(canonicalResource);

  for (const candidate of ordinarySet) {
    if (resourceSet.has(candidate)) {
      fail('overlapping_phase_target');
    }
  }
  for (const candidate of [...ordinarySet, ...resourceSet]) {
    if (!inventorySet.has(candidate)) {
      fail('noncanonical_phase_target');
    }
  }
  for (const candidate of inventorySet) {
    if (!ordinarySet.has(candidate) && !resourceSet.has(candidate)) {
      fail('inventory_omission');
    }
  }

  if (ordinarySet.size + resourceSet.size !== inventorySet.size) {
    fail('inventory_omission');
  }
}

export function classifyVitestWorkloads(inventory, policy) {
  validatePolicy(policy);
  const canonicalInventory = validateCanonicalPathList(inventory);
  const inventorySet = new Set(canonicalInventory);
  const resourceIntensive = policy.resourceIntensiveSpecs.map(
    (entry) => entry.path,
  );

  for (const manifestTarget of resourceIntensive) {
    if (!inventorySet.has(manifestTarget)) {
      fail('missing_manifest_target');
    }
  }

  const resourceSet = new Set(resourceIntensive);
  const ordinary = canonicalInventory.filter(
    (candidate) => !resourceSet.has(candidate),
  );

  assertVitestPartition({
    inventory: canonicalInventory,
    ordinary,
    resourceIntensive,
  });

  return Object.freeze({
    inventory: Object.freeze(canonicalInventory),
    ordinary: Object.freeze(ordinary),
    resourceIntensive: Object.freeze(resourceIntensive),
  });
}
