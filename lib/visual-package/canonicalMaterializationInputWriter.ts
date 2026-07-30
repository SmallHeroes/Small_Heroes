import {
  CANONICAL_MATERIALIZATION_INPUT_VERSION,
  CanonicalMaterializationInputReadError,
  canonicalMaterializationRepositoryRealPath,
  persistCanonicalMaterializationInputArtifact,
  type CanonicalMaterializationInputKind,
} from './canonicalMaterializationInput';
import {
  CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
  assertValidCanonicalLiveExecutionRequestMaterializationInput,
  type CanonicalLiveExecutionRequestMaterializationInput,
} from './liveExecutionRequestMaterialization';
import {
  LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
  assertValidLiveRequestMaterializationInput,
  type LiveRequestMaterializationInput,
} from './liveRequestMaterialization';

export const CANONICAL_MATERIALIZATION_INPUT_WRITE_RESULT_VERSION =
  'canonical-materialization-input-write-result/v1' as const;

export type CanonicalMaterializationInputWriteReasonCode =
  | 'canonical_materialization_input_write_canonical_domain_rejected'
  | 'canonical_materialization_input_write_cli_rejected'
  | 'canonical_materialization_input_write_collision'
  | 'canonical_materialization_input_write_failed'
  | 'canonical_materialization_input_write_filesystem_rejected'
  | 'canonical_materialization_input_write_post_verification_rejected'
  | 'canonical_materialization_input_write_schema_rejected';

const WRITE_REASON_CODES =
  new Set<CanonicalMaterializationInputWriteReasonCode>([
    'canonical_materialization_input_write_canonical_domain_rejected',
    'canonical_materialization_input_write_cli_rejected',
    'canonical_materialization_input_write_collision',
    'canonical_materialization_input_write_failed',
    'canonical_materialization_input_write_filesystem_rejected',
    'canonical_materialization_input_write_post_verification_rejected',
    'canonical_materialization_input_write_schema_rejected',
  ]);

class CanonicalMaterializationInputWriteError extends Error {
  constructor(
    readonly reasonCode:
      CanonicalMaterializationInputWriteReasonCode,
  ) {
    super(reasonCode);
    this.name = 'CanonicalMaterializationInputWriteError';
  }
}

interface ExternalBoundaryControlFlowEvidence {
  evidenceKind: 'invariant-and-control-flow/v1';
  credentialSourceReadsOrChecks: 0;
  networkCalls: 0;
  providerCalls: 0;
  externalStorageWrites: 0;
  databaseWrites: 0;
}

export interface CanonicalMaterializationInputWriteSuccess {
  version:
    typeof CANONICAL_MATERIALIZATION_INPUT_WRITE_RESULT_VERSION;
  status: 'written';
  artifact: {
    envelopeVersion:
      typeof CANONICAL_MATERIALIZATION_INPUT_VERSION;
    kind: CanonicalMaterializationInputKind;
    path: string;
    digest: string;
    created: boolean;
  };
  externalBoundaryControlFlowEvidence:
    ExternalBoundaryControlFlowEvidence;
}

export interface CanonicalMaterializationInputWriteRejection {
  version:
    typeof CANONICAL_MATERIALIZATION_INPUT_WRITE_RESULT_VERSION;
  status: 'rejected';
  reasonCodes: CanonicalMaterializationInputWriteReasonCode[];
  artifact: null;
  externalBoundaryControlFlowEvidence:
    ExternalBoundaryControlFlowEvidence;
}

export type CanonicalMaterializationInputWriteResult =
  | CanonicalMaterializationInputWriteSuccess
  | CanonicalMaterializationInputWriteRejection;

export interface SourceAuthoringLiveRequestInputWrite {
  mode: 'source-authoring-live-request';
  repoRoot: string;
  outputDir: string;
  storyKey: string;
  storyPath: string;
  requestId: string;
  requestedAt: string;
}

export interface CanonicalLiveExecutionRequestInputWrite {
  mode: 'canonical-live-execution-request';
  repoRoot: string;
  outputDir: string;
  requestId: string;
  requestedAt: string;
  manifestPath: string;
  materializationOutputDir: string;
  preservationPaths: string[];
  expectedAbsentPaths: string[];
  credentialSourcePath: string;
}

export type CanonicalMaterializationInputWrite =
  | SourceAuthoringLiveRequestInputWrite
  | CanonicalLiveExecutionRequestInputWrite;

function externalBoundaryControlFlowEvidence(): ExternalBoundaryControlFlowEvidence {
  return {
    evidenceKind: 'invariant-and-control-flow/v1',
    credentialSourceReadsOrChecks: 0,
    networkCalls: 0,
    providerCalls: 0,
    externalStorageWrites: 0,
    databaseWrites: 0,
  };
}

function writePayload<Payload>(args: {
  repoRoot: string;
  outputDir: string;
  kind: CanonicalMaterializationInputKind;
  payloadSchemaVersion: string;
  payload: Payload;
  validatePayload: (value: unknown) => asserts value is Payload;
}): CanonicalMaterializationInputWriteSuccess {
  let persisted: ReturnType<
    typeof persistCanonicalMaterializationInputArtifact<
      CanonicalMaterializationInputKind,
      Payload
    >
  >;
  try {
    persisted = persistCanonicalMaterializationInputArtifact(
      args,
    );
  } catch (error) {
    if (error instanceof CanonicalMaterializationInputReadError) {
      if (
        error.reasonCode ===
        'canonical_materialization_input_payload_rejected'
      ) {
        throw new CanonicalMaterializationInputWriteError(
          'canonical_materialization_input_write_schema_rejected',
        );
      }
      if (
        error.reasonCode ===
          'canonical_materialization_input_canonical_domain_rejected' ||
        error.reasonCode ===
          'canonical_materialization_input_envelope_rejected' ||
        error.reasonCode ===
          'canonical_materialization_input_digest_mismatch'
      ) {
        throw new CanonicalMaterializationInputWriteError(
          'canonical_materialization_input_write_canonical_domain_rejected',
        );
      }
      if (
        error.reasonCode ===
        'canonical_materialization_input_collision'
      ) {
        throw new CanonicalMaterializationInputWriteError(
          'canonical_materialization_input_write_collision',
        );
      }
      if (
        error.reasonCode ===
        'canonical_materialization_input_post_write_verification_rejected'
      ) {
        throw new CanonicalMaterializationInputWriteError(
          'canonical_materialization_input_write_post_verification_rejected',
        );
      }
      throw new CanonicalMaterializationInputWriteError(
        'canonical_materialization_input_write_filesystem_rejected',
      );
    }
    throw new CanonicalMaterializationInputWriteError(
      'canonical_materialization_input_write_failed',
    );
  }
  return {
    version:
      CANONICAL_MATERIALIZATION_INPUT_WRITE_RESULT_VERSION,
    status: 'written',
    artifact: {
      envelopeVersion: CANONICAL_MATERIALIZATION_INPUT_VERSION,
      kind: args.kind,
      path: persisted.path,
      digest: persisted.envelope.digest,
      created: persisted.created,
    },
    externalBoundaryControlFlowEvidence:
      externalBoundaryControlFlowEvidence(),
  };
}

export function writeCanonicalMaterializationInput(
  args: CanonicalMaterializationInputWrite,
): CanonicalMaterializationInputWriteSuccess {
  let repositoryRealPath: string;
  try {
    repositoryRealPath =
      canonicalMaterializationRepositoryRealPath(args.repoRoot);
  } catch {
    throw new CanonicalMaterializationInputWriteError(
      'canonical_materialization_input_write_filesystem_rejected',
    );
  }
  if (args.mode === 'source-authoring-live-request') {
    const payload: LiveRequestMaterializationInput = {
      version: LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
      repoRoot: repositoryRealPath,
      storyKey: args.storyKey,
      storyPath: args.storyPath,
      requestId: args.requestId,
      requestedAt: args.requestedAt,
    };
    return writePayload({
      repoRoot: repositoryRealPath,
      outputDir: args.outputDir,
      kind: args.mode,
      payloadSchemaVersion:
        LIVE_REQUEST_MATERIALIZATION_INPUT_VERSION,
      payload,
      validatePayload: assertValidLiveRequestMaterializationInput,
    });
  }
  const payload: CanonicalLiveExecutionRequestMaterializationInput =
    {
      version:
        CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
      requestId: args.requestId,
      requestedAt: args.requestedAt,
      manifestPath: args.manifestPath,
      outputDir: args.materializationOutputDir,
      preservationPaths: args.preservationPaths
        .slice()
        .sort(),
      expectedAbsentPaths: args.expectedAbsentPaths
        .slice()
        .sort(),
      credentialSourcePath: args.credentialSourcePath,
    };
  return writePayload({
    repoRoot: repositoryRealPath,
    outputDir: args.outputDir,
    kind: args.mode,
    payloadSchemaVersion:
      CANONICAL_LIVE_EXECUTION_REQUEST_MATERIALIZATION_INPUT_VERSION,
    payload,
    validatePayload:
      assertValidCanonicalLiveExecutionRequestMaterializationInput,
  });
}

export function canonicalMaterializationInputWriteRejection(
  reason:
    | CanonicalMaterializationInputWriteReasonCode
    | unknown = 'canonical_materialization_input_write_failed',
): CanonicalMaterializationInputWriteRejection {
  const reasonCode =
    reason instanceof CanonicalMaterializationInputWriteError
      ? reason.reasonCode
      : typeof reason === 'string' &&
          WRITE_REASON_CODES.has(
            reason as CanonicalMaterializationInputWriteReasonCode,
          )
        ? (reason as CanonicalMaterializationInputWriteReasonCode)
        : 'canonical_materialization_input_write_failed';
  return {
    version:
      CANONICAL_MATERIALIZATION_INPUT_WRITE_RESULT_VERSION,
    status: 'rejected',
    reasonCodes: [reasonCode],
    artifact: null,
    externalBoundaryControlFlowEvidence:
      externalBoundaryControlFlowEvidence(),
  };
}
