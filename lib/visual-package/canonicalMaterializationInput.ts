import fs from 'node:fs';
import path from 'node:path';

import {
  canonicalLiveAuthoringJsonBytes,
} from './canonicalLiveAuthoringArtifacts';
import {
  canonicalJsonDigest,
  repoRelativePath,
} from './integrity';
import {
  writeImmutableLocalArtifact,
} from './preRenderBlueprintLifecycle';

export const CANONICAL_MATERIALIZATION_INPUT_VERSION =
  'canonical-materialization-input/v1' as const;
export const CANONICAL_MATERIALIZATION_INPUT_CATEGORY =
  'canonical-materialization-inputs' as const;
export const CANONICAL_MATERIALIZATION_INPUT_KINDS = [
  'source-authoring-live-request',
  'canonical-live-execution-request',
] as const;

export type CanonicalMaterializationInputKind =
  (typeof CANONICAL_MATERIALIZATION_INPUT_KINDS)[number];

export interface CanonicalMaterializationInputEnvelope<
  Kind extends CanonicalMaterializationInputKind =
    CanonicalMaterializationInputKind,
  Payload = unknown,
> {
  version: typeof CANONICAL_MATERIALIZATION_INPUT_VERSION;
  kind: Kind;
  payloadSchemaVersion: string;
  payload: Payload;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
}

export type CanonicalMaterializationInputReadReasonCode =
  | 'canonical_materialization_input_bytes_noncanonical'
  | 'canonical_materialization_input_canonical_domain_rejected'
  | 'canonical_materialization_input_collision'
  | 'canonical_materialization_input_content_address_mismatch'
  | 'canonical_materialization_input_digest_mismatch'
  | 'canonical_materialization_input_envelope_rejected'
  | 'canonical_materialization_input_filesystem_rejected'
  | 'canonical_materialization_input_kind_mismatch'
  | 'canonical_materialization_input_payload_rejected'
  | 'canonical_materialization_input_payload_schema_mismatch'
  | 'canonical_materialization_input_post_write_verification_rejected'
  | 'canonical_materialization_input_source_changed';

export class CanonicalMaterializationInputReadError extends Error {
  constructor(
    readonly reasonCode:
      CanonicalMaterializationInputReadReasonCode,
  ) {
    super(reasonCode);
    this.name = 'CanonicalMaterializationInputReadError';
  }
}

export interface CanonicalMaterializationInputReadHooks {
  afterOpen?: (absolutePath: string) => void;
  beforePathIdentityRecheck?: (absolutePath: string) => void;
}

export interface CanonicalMaterializationInputPersistenceHooks {
  beforePostWriteVerification?: (args: {
    absolutePath: string;
    artifactPath: string;
    created: boolean;
  }) => void;
}

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const PAYLOAD_SCHEMA_PATTERN =
  /^[a-z0-9][a-z0-9-]*(?:\/v[1-9][0-9]*)$/;
const MAX_INPUT_BYTES = 1024 * 1024;

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const wanted = expected.slice().sort();
  return (
    actual.length === wanted.length &&
    actual.every((field, index) => field === wanted[index])
  );
}

function normalizedPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

function pathsEqual(left: string, right: string): boolean {
  return normalizedPath(left) === normalizedPath(right);
}

function reject(
  reasonCode: CanonicalMaterializationInputReadReasonCode,
): never {
  throw new CanonicalMaterializationInputReadError(reasonCode);
}

export function canonicalMaterializationRelativePathIssues(
  value: unknown,
): string[] {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 1024 ||
    path.isAbsolute(value) ||
    value.includes('\\') ||
    value.includes('\0') ||
    /[*?[\]{}!]/.test(value)
  ) {
    return ['path_invalid'];
  }
  const segments = value.split('/');
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === '.' ||
        segment === '..',
    ) ||
    path.posix.normalize(value) !== value
  ) {
    return ['path_invalid'];
  }
  return [];
}

export function canonicalMaterializationRepositoryRealPath(
  repoRoot: string,
): string {
  try {
    if (!path.isAbsolute(repoRoot)) {
      throw new Error('not_absolute');
    }
    const lexical = path.resolve(repoRoot);
    const real = fs.realpathSync(lexical);
    const stat = fs.statSync(real);
    if (!pathsEqual(lexical, real) || !stat.isDirectory()) {
      throw new Error('alias_or_not_directory');
    }
    return real;
  } catch {
    throw new CanonicalMaterializationInputReadError(
      'canonical_materialization_input_filesystem_rejected',
    );
  }
}

function assertContained(
  repositoryRealPath: string,
  candidatePath: string,
): void {
  const relative = path.relative(
    repositoryRealPath,
    candidatePath,
  );
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    reject('canonical_materialization_input_filesystem_rejected');
  }
}

function envelopeWithoutDigest(
  value: Pick<
    CanonicalMaterializationInputEnvelope,
    'version' | 'kind' | 'payloadSchemaVersion' | 'payload'
  >,
): unknown {
  return value;
}

export function canonicalMaterializationInputEnvelopeIssues(
  value: unknown,
): string[] {
  const envelope = recordValue(value);
  if (!envelope) {
    return ['canonical_materialization_input_not_object'];
  }
  const issues: string[] = [];
  if (
    !exactKeys(envelope, [
      'version',
      'kind',
      'payloadSchemaVersion',
      'payload',
      'digestAlgorithm',
      'digest',
    ])
  ) {
    issues.push(
      'canonical_materialization_input_fields_invalid',
    );
  }
  if (
    envelope.version !==
    CANONICAL_MATERIALIZATION_INPUT_VERSION
  ) {
    issues.push(
      'canonical_materialization_input_version_invalid',
    );
  }
  if (
    !CANONICAL_MATERIALIZATION_INPUT_KINDS.includes(
      envelope.kind as CanonicalMaterializationInputKind,
    )
  ) {
    issues.push('canonical_materialization_input_kind_invalid');
  }
  if (
    typeof envelope.payloadSchemaVersion !== 'string' ||
    !PAYLOAD_SCHEMA_PATTERN.test(
      envelope.payloadSchemaVersion,
    )
  ) {
    issues.push(
      'canonical_materialization_input_payload_schema_invalid',
    );
  }
  if (recordValue(envelope.payload) === null) {
    issues.push(
      'canonical_materialization_input_payload_invalid',
    );
  }
  if (envelope.digestAlgorithm !== 'canonical-json-sha256') {
    issues.push(
      'canonical_materialization_input_digest_algorithm_invalid',
    );
  }
  if (
    typeof envelope.digest !== 'string' ||
    !DIGEST_PATTERN.test(envelope.digest)
  ) {
    issues.push(
      'canonical_materialization_input_digest_invalid',
    );
  } else if (
    envelope.version ===
      CANONICAL_MATERIALIZATION_INPUT_VERSION &&
    CANONICAL_MATERIALIZATION_INPUT_KINDS.includes(
      envelope.kind as CanonicalMaterializationInputKind,
    ) &&
    typeof envelope.payloadSchemaVersion === 'string' &&
    PAYLOAD_SCHEMA_PATTERN.test(envelope.payloadSchemaVersion) &&
    recordValue(envelope.payload) !== null
  ) {
    try {
      const expectedDigest = canonicalJsonDigest(
        envelopeWithoutDigest({
          version: CANONICAL_MATERIALIZATION_INPUT_VERSION,
          kind:
            envelope.kind as CanonicalMaterializationInputKind,
          payloadSchemaVersion:
            envelope.payloadSchemaVersion,
          payload: envelope.payload,
        }),
      );
      if (envelope.digest !== expectedDigest) {
        issues.push(
          'canonical_materialization_input_digest_stale',
        );
      }
    } catch {
      issues.push(
        'canonical_materialization_input_digest_domain_invalid',
      );
    }
  }
  return [...new Set(issues)].sort();
}

export function buildCanonicalMaterializationInputEnvelope<
  Kind extends CanonicalMaterializationInputKind,
  Payload,
>(args: {
  kind: Kind;
  payloadSchemaVersion: string;
  payload: Payload;
}): CanonicalMaterializationInputEnvelope<Kind, Payload> {
  const withoutDigest = {
    version: CANONICAL_MATERIALIZATION_INPUT_VERSION,
    kind: args.kind,
    payloadSchemaVersion: args.payloadSchemaVersion,
    payload: args.payload,
  };
  let digest: string;
  try {
    digest = canonicalJsonDigest(
      envelopeWithoutDigest(withoutDigest),
    );
  } catch {
    reject(
      'canonical_materialization_input_canonical_domain_rejected',
    );
  }
  const envelope = {
    ...withoutDigest,
    digestAlgorithm: 'canonical-json-sha256' as const,
    digest,
  };
  if (
    canonicalMaterializationInputEnvelopeIssues(envelope)
      .length > 0
  ) {
    reject('canonical_materialization_input_envelope_rejected');
  }
  return envelope;
}

function readUniqueCanonicalFile(args: {
  repositoryRealPath: string;
  inputPath: string;
  hooks?: CanonicalMaterializationInputReadHooks;
}): {
  absolutePath: string;
  raw: Buffer;
} {
  if (
    canonicalMaterializationRelativePathIssues(args.inputPath)
      .length > 0
  ) {
    reject('canonical_materialization_input_filesystem_rejected');
  }
  let lexical: string;
  let descriptor: number | null = null;
  try {
    lexical = path.resolve(
      args.repositoryRealPath,
      args.inputPath,
    );
    assertContained(args.repositoryRealPath, lexical);
    const real = fs.realpathSync(lexical);
    assertContained(args.repositoryRealPath, real);
    const lstat = fs.lstatSync(lexical);
    if (
      !pathsEqual(lexical, real) ||
      lstat.isSymbolicLink() ||
      !lstat.isFile() ||
      repoRelativePath(args.repositoryRealPath, real) !==
        args.inputPath
    ) {
      throw new Error('alias_or_noncanonical_path');
    }
    descriptor = fs.openSync(lexical, 'r');
    const opened = fs.fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      opened.size < 0 ||
      opened.size > MAX_INPUT_BYTES
    ) {
      throw new Error('not_unique_regular_file');
    }
    args.hooks?.afterOpen?.(lexical);
    const raw = fs.readFileSync(descriptor);
    const afterRead = fs.fstatSync(descriptor);
    if (
      raw.length !== opened.size ||
      afterRead.dev !== opened.dev ||
      afterRead.ino !== opened.ino ||
      afterRead.size !== opened.size ||
      afterRead.nlink !== 1 ||
      afterRead.mtimeMs !== opened.mtimeMs ||
      afterRead.ctimeMs !== opened.ctimeMs
    ) {
      reject('canonical_materialization_input_source_changed');
    }
    args.hooks?.beforePathIdentityRecheck?.(lexical);
    const currentReal = fs.realpathSync(lexical);
    const current = fs.statSync(currentReal);
    if (
      !pathsEqual(currentReal, lexical) ||
      current.dev !== opened.dev ||
      current.ino !== opened.ino ||
      current.size !== opened.size ||
      current.nlink !== 1 ||
      current.mtimeMs !== opened.mtimeMs ||
      current.ctimeMs !== opened.ctimeMs ||
      !fs.readFileSync(currentReal).equals(raw)
    ) {
      reject('canonical_materialization_input_source_changed');
    }
    return { absolutePath: lexical, raw };
  } catch (error) {
    if (error instanceof CanonicalMaterializationInputReadError) {
      throw error;
    }
    throw new CanonicalMaterializationInputReadError(
      'canonical_materialization_input_filesystem_rejected',
    );
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

export function readCanonicalMaterializationInputArtifact<
  Kind extends CanonicalMaterializationInputKind,
  Payload,
>(args: {
  repoRoot: string;
  inputPath: string;
  expectedKind: Kind;
  expectedPayloadSchemaVersion: string;
  validatePayload: (value: unknown) => asserts value is Payload;
  hooks?: CanonicalMaterializationInputReadHooks;
}): CanonicalMaterializationInputEnvelope<Kind, Payload> {
  const repositoryRealPath =
    canonicalMaterializationRepositoryRealPath(args.repoRoot);
  const source = readUniqueCanonicalFile({
    repositoryRealPath,
    inputPath: args.inputPath,
    hooks: args.hooks,
  });
  let value: unknown;
  try {
    value = JSON.parse(source.raw.toString('utf8')) as unknown;
  } catch {
    reject('canonical_materialization_input_envelope_rejected');
  }
  let canonicalBytes: string;
  try {
    canonicalBytes = canonicalLiveAuthoringJsonBytes(value);
  } catch {
    reject('canonical_materialization_input_envelope_rejected');
  }
  if (
    !source.raw.equals(Buffer.from(canonicalBytes, 'utf8'))
  ) {
    reject('canonical_materialization_input_bytes_noncanonical');
  }
  const envelopeIssues =
    canonicalMaterializationInputEnvelopeIssues(value);
  if (envelopeIssues.length > 0) {
    if (
      envelopeIssues.includes(
        'canonical_materialization_input_digest_stale',
      )
    ) {
      reject('canonical_materialization_input_digest_mismatch');
    }
    reject('canonical_materialization_input_envelope_rejected');
  }
  const envelope =
    value as CanonicalMaterializationInputEnvelope;
  if (envelope.kind !== args.expectedKind) {
    reject('canonical_materialization_input_kind_mismatch');
  }
  if (
    envelope.payloadSchemaVersion !==
    args.expectedPayloadSchemaVersion
  ) {
    reject(
      'canonical_materialization_input_payload_schema_mismatch',
    );
  }
  const expectedSuffix = path.posix.join(
    CANONICAL_MATERIALIZATION_INPUT_CATEGORY,
    envelope.kind,
    `${envelope.digest}.json`,
  );
  if (
    args.inputPath !== expectedSuffix &&
    !args.inputPath.endsWith(`/${expectedSuffix}`)
  ) {
    reject(
      'canonical_materialization_input_content_address_mismatch',
    );
  }
  try {
    args.validatePayload(envelope.payload);
  } catch {
    reject('canonical_materialization_input_payload_rejected');
  }
  return envelope as CanonicalMaterializationInputEnvelope<
    Kind,
    Payload
  >;
}

function ensureContainedDirectory(args: {
  repositoryRealPath: string;
  relativePath: string;
}): string {
  if (
    canonicalMaterializationRelativePathIssues(args.relativePath)
      .length > 0
  ) {
    reject('canonical_materialization_input_filesystem_rejected');
  }
  let current = args.repositoryRealPath;
  try {
    for (const segment of args.relativePath.split('/')) {
      const candidate = path.join(current, segment);
      try {
        fs.mkdirSync(candidate);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error;
        }
      }
      const lstat = fs.lstatSync(candidate);
      const real = fs.realpathSync(candidate);
      assertContained(args.repositoryRealPath, real);
      if (
        lstat.isSymbolicLink() ||
        !lstat.isDirectory() ||
        !pathsEqual(candidate, real)
      ) {
        throw new Error('directory_alias_rejected');
      }
      current = candidate;
    }
    return current;
  } catch (error) {
    if (error instanceof CanonicalMaterializationInputReadError) {
      throw error;
    }
    reject('canonical_materialization_input_filesystem_rejected');
  }
}

function removeCreatedArtifactIfUnchanged(args: {
  absolutePath: string;
  bytes: string;
}): void {
  const lstat = fs.lstatSync(args.absolutePath);
  const real = fs.realpathSync(args.absolutePath);
  if (
    lstat.isSymbolicLink() ||
    !lstat.isFile() ||
    lstat.nlink !== 1 ||
    !pathsEqual(real, args.absolutePath) ||
    !fs
      .readFileSync(real)
      .equals(Buffer.from(args.bytes, 'utf8'))
  ) {
    reject('canonical_materialization_input_source_changed');
  }
  fs.unlinkSync(real);
}

export function persistCanonicalMaterializationInputArtifact<
  Kind extends CanonicalMaterializationInputKind,
  Payload,
>(args: {
  repoRoot: string;
  outputDir: string;
  kind: Kind;
  payloadSchemaVersion: string;
  payload: Payload;
  validatePayload: (value: unknown) => asserts value is Payload;
  hooks?: CanonicalMaterializationInputPersistenceHooks;
}): {
  envelope: CanonicalMaterializationInputEnvelope<Kind, Payload>;
  path: string;
  created: boolean;
} {
  try {
    args.validatePayload(args.payload);
  } catch {
    reject('canonical_materialization_input_payload_rejected');
  }
  const envelope = buildCanonicalMaterializationInputEnvelope({
    kind: args.kind,
    payloadSchemaVersion: args.payloadSchemaVersion,
    payload: args.payload,
  });
  let bytes: string;
  try {
    bytes = canonicalLiveAuthoringJsonBytes(envelope);
  } catch {
    reject(
      'canonical_materialization_input_canonical_domain_rejected',
    );
  }
  const repositoryRealPath =
    canonicalMaterializationRepositoryRealPath(args.repoRoot);
  const categoryRoot = path.posix.join(
    args.outputDir,
    CANONICAL_MATERIALIZATION_INPUT_CATEGORY,
  );
  ensureContainedDirectory({
    repositoryRealPath,
    relativePath: categoryRoot,
  });
  const kindDirectory = ensureContainedDirectory({
    repositoryRealPath,
    relativePath: path.posix.join(categoryRoot, args.kind),
  });
  const destinationPath = path.join(
    kindDirectory,
    `${envelope.digest}.json`,
  );
  let persistence: { created: boolean };
  try {
    persistence = writeImmutableLocalArtifact({
      destinationPath,
      bytes,
    });
  } catch {
    if (fs.existsSync(destinationPath)) {
      reject('canonical_materialization_input_collision');
    }
    reject('canonical_materialization_input_filesystem_rejected');
  }
  const artifactPath = repoRelativePath(
    repositoryRealPath,
    destinationPath,
  );
  try {
    args.hooks?.beforePostWriteVerification?.({
      absolutePath: destinationPath,
      artifactPath,
      created: persistence.created,
    });
    readCanonicalMaterializationInputArtifact({
      repoRoot: repositoryRealPath,
      inputPath: artifactPath,
      expectedKind: args.kind,
      expectedPayloadSchemaVersion: args.payloadSchemaVersion,
      validatePayload: args.validatePayload,
    });
  } catch (error) {
    if (persistence.created) {
      try {
        removeCreatedArtifactIfUnchanged({
          absolutePath: destinationPath,
          bytes,
        });
      } catch {
        // A changed publication is preserved for forensic inspection.
      }
    }
    throw new CanonicalMaterializationInputReadError(
      'canonical_materialization_input_post_write_verification_rejected',
    );
  }
  return {
    envelope,
    path: artifactPath,
    created: persistence.created,
  };
}
