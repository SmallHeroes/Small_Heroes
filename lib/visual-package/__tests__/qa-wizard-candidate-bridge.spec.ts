import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
  QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION,
  QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION_V1,
  advanceQaWizardApprovedReconciliation,
  attestQaWizardCandidateValidation,
  buildProductionAuthoringContext,
  buildReconciliationReviewBundle,
  buildStorySourceAuthoritySnapshot,
  buildVisualContractAuthoringRequest,
  buildVisualContractAuthoringReadinessEvidence,
  canonicalJsonDigest,
  captureQaWizardCanonicalSupervisorResultEvidence,
  loadQaWizardCandidateValidationAttestation,
  loadQaWizardCandidateBridgeManifest,
  persistReconciliationDraftBundle,
  persistQaWizardCandidateBridgeManifest,
  persistVisualContractAuthoringReadiness,
  persistVisualContractAuthoringReceipt,
  persistVisualContractCandidate,
  prepareCanonicalPreLiveReadiness,
  prepareQaWizardCandidateReconciliation,
  qaWizardCandidateBridgeManifestIsValid,
  qaWizardCandidateValidationAttestationIsValid,
  recordQaWizardReconciliationApproval,
  renderReconciliationReviewMarkdown,
  runCanonicalLiveExecution,
  runVisualContractAuthoring,
  type CanonicalPreLiveReadinessEvidence,
  type LiveRequestMaterializationManifest,
  type QaWizardCandidateBridgeManifest,
  type SourcePromptReconciliation,
  type StorySourceAuthoritySnapshot,
  type VisualContractAuthoringRequest,
} from '@/lib/visual-package';
import { canonicalLiveAuthoringJsonBytes } from '@/lib/visual-package/canonicalLiveAuthoringArtifacts';
import { canonicalContentAddressedJsonBytes } from '@/lib/visual-package/canonicalContentAddressedJson';
import {
  createOpenAIResponsesVisualContractAuthoringAdapter,
  OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
  type OpenAIResponsesAuthoringTransport,
} from '@/lib/visual-package/openaiResponsesVisualContractAuthoringAdapter';
import {
  projectPageMustShow,
  type BookVisualContract,
  type BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler';

const roots: string[] = [];
const BANK = path.join(process.cwd(), 'story-bank', 'v3-approved');
const STORY_KEY = 'bunny_ometz_adventure';
const STORY_PATH = `story-bank/v3-approved/${STORY_KEY}.md`;
const STYLE_ID = 'soft_hand_drawn_storybook';
const OUTPUT_ROOT = 'outputs/qa-wizard-canonical-fixture';
const BRANCH = 'codex/qa-wizard-canonical-fixture';
const REQUESTED_AT = '2026-08-17T07:30:00.000Z';
const APPROVED_AT = '2026-08-17T08:00:00.000Z';

interface CanonicalCandidateFixture {
  repoRoot: string;
  storyPath: string;
  requestPath: string;
  receiptPath: string;
  readinessPath: string;
  candidatePath: string;
  freshReadinessPath: string;
  supervisorExecutionRequestPath: string;
  supervisorExecutionResultPath: string;
  candidateValidationAttestationPath: string;
  supervisorStatus:
    | 'readiness_rejected'
    | 'credential_rejected'
    | 'child_completed'
    | 'child_failed';
  supervisorOutputAuthorityPresent: boolean;
  supervisorCaptureRejected: boolean;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(prefix = 'qa-wizard-candidate-bridge-'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

function git(cwd: string, argv: string[]): string {
  const result = spawnSync('git', argv, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`fixture Git failed: ${argv.join(' ')}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function writeText(root: string, relativePath: string, value: string): void {
  const absolute = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, value, 'utf8');
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function copyFile(root: string, relativePath: string, sourcePath: string): void {
  const absolute = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.copyFileSync(sourcePath, absolute);
}

function createDependencyAuthority(repoRoot: string): void {
  const versions = {
    tsx: '4.22.2',
    typescript: '6.0.3',
    prisma: '6.19.3',
    '@prisma/client': '6.19.3',
  };
  writeJson(repoRoot, 'package.json', {
    name: 'qa-wizard-bridge-fixture',
    private: true,
    devDependencies: {
      prisma: versions.prisma,
      tsx: versions.tsx,
      typescript: versions.typescript,
    },
    dependencies: {
      '@prisma/client': versions['@prisma/client'],
    },
  });
  writeJson(repoRoot, 'package-lock.json', {
    name: 'qa-wizard-bridge-fixture',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {},
      'node_modules/tsx': { version: versions.tsx },
      'node_modules/typescript': { version: versions.typescript },
      'node_modules/prisma': { version: versions.prisma },
      'node_modules/@prisma/client': {
        version: versions['@prisma/client'],
      },
    },
  });
  for (const entry of [
    {
      packagePath: 'node_modules/tsx/package.json',
      version: versions.tsx,
      authorityPath: 'node_modules/tsx/dist/cli.mjs',
    },
    {
      packagePath: 'node_modules/typescript/package.json',
      version: versions.typescript,
      authorityPath: 'node_modules/typescript/lib/tsc.js',
    },
    {
      packagePath: 'node_modules/prisma/package.json',
      version: versions.prisma,
      authorityPath: 'node_modules/prisma/build/index.js',
    },
    {
      packagePath: 'node_modules/@prisma/client/package.json',
      version: versions['@prisma/client'],
      authorityPath: 'node_modules/@prisma/client/default.js',
    },
  ]) {
    writeJson(repoRoot, entry.packagePath, {
      name: entry.packagePath,
      version: entry.version,
    });
    writeText(repoRoot, entry.authorityPath, `// ${entry.version}\n`);
  }
  writeText(
    repoRoot,
    'node_modules/.prisma/client/schema.prisma',
    'generator client { provider = "prisma-client-js" }\n',
  );
}

function fullyActionedDraft(
  snapshot: StorySourceAuthoritySnapshot,
): BookVisualContractTemplate & Record<string, unknown> {
  const draft = JSON.parse(
    fs.readFileSync(
      path.join(BANK, `${STORY_KEY}.visual-contract-template.json`),
      'utf8',
    ),
  ) as BookVisualContractTemplate & Record<string, unknown>;
  for (const page of draft.pageContracts) {
    const evidence = snapshot.content.sourceEvidenceCatalog.entries.find(
      (entry) => entry.pageNumber === page.pageNumber,
    );
    if (!evidence) throw new Error(`missing page ${page.pageNumber} evidence`);
    (page as unknown as Record<string, unknown>).actionRequirements = [
      {
        beatId: `beat:p${page.pageNumber}:look`,
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'looks_at',
        object: null,
        polarity: 'must',
        laterality: null,
      },
    ];
    (page as unknown as Record<string, unknown>).actionSemanticCoverage = [
      {
        beatId: `beat:p${page.pageNumber}:look`,
        sourceEvidenceId: evidence.sourceEvidenceId,
        disposition: { kind: 'action_requirement' },
      },
    ];
  }
  for (const page of draft.pageContracts) {
    page.mustShow = [
      ...new Set([
        ...page.mustShow,
        ...projectPageMustShow(page, draft as unknown as BookVisualContract),
      ]),
    ];
  }
  return draft;
}

function streamedResponse(output: unknown): Record<string, unknown> {
  return {
    id: 'resp_bridge_fixture_1',
    model: 'gpt-5.6-sol',
    status: 'completed',
    output: [
      { id: 'reasoning_1', type: 'reasoning', summary: [] },
      {
        id: 'message_1',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [
          {
            annotations: [],
            text: JSON.stringify(output),
            type: 'output_text',
          },
        ],
      },
    ],
    usage: {
      input_tokens: 1_000,
      input_tokens_details: {
        cached_tokens: 200,
        cache_write_tokens: 0,
      },
      output_tokens: 2_000,
      output_tokens_details: { reasoning_tokens: 500 },
      total_tokens: 3_000,
    },
  };
}

function canonicalProvider(draft: unknown) {
  const transport: OpenAIResponsesAuthoringTransport = {
    create: vi.fn(async (request) => {
      request.observations.transportDispatchStarted = true;
      request.observations.transportDispatchCount += 1;
      request.observations.canonicalRouteConfirmed = true;
      request.observations.canonicalModelConfirmed =
        request.body.model === 'gpt-5.6-sol';
      return streamedResponse(draft);
    }),
  };
  return createOpenAIResponsesVisualContractAuthoringAdapter({
    readCredential: vi.fn(() => 'fixture-key-never-persisted'),
    transport,
  });
}

function fakeChild(args: {
  beforeClose?: () => void | Promise<void>;
  exitCode?: number;
} = {}) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: (signal?: NodeJS.Signals) => boolean;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => true;
  process.nextTick(async () => {
    try {
      await args.beforeClose?.();
      child.stdout.end();
      child.stderr.end();
      child.emit('close', args.exitCode ?? 0, null);
    } catch {
      child.stdout.end();
      child.stderr.end();
      child.emit('close', 1, null);
    }
  });
  return child;
}

function freshPath(evidence: CanonicalPreLiveReadinessEvidence): string {
  return `${evidence.request.outputRoot}/canonical-pre-live-readiness-evidence/${evidence.digest}.json`;
}

function writeRedigestedCanonicalArtifact(args: {
  repoRoot: string;
  sourcePath: string;
  mutate: (value: Record<string, unknown>) => void;
}): string {
  const value = JSON.parse(
    fs.readFileSync(path.join(args.repoRoot, args.sourcePath), 'utf8'),
  ) as Record<string, unknown>;
  args.mutate(value);
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = value;
  value.digest = canonicalJsonDigest(payload);
  const relativePath = path.posix.join(
    path.posix.dirname(args.sourcePath),
    `${value.digest}.json`,
  );
  writeText(
    args.repoRoot,
    relativePath,
    canonicalLiveAuthoringJsonBytes(value),
  );
  return relativePath;
}

function persistLegacyBridgeManifest(args: {
  repoRoot: string;
  source: QaWizardCandidateBridgeManifest;
  version?:
    | typeof QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION
    | typeof QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION_V1;
  mutate?: (value: QaWizardCandidateBridgeManifest) => void;
}): {
  manifest: QaWizardCandidateBridgeManifest;
  path: string;
} {
  const manifest = structuredClone(args.source);
  manifest.version =
    args.version ?? QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION_V1;
  delete manifest.candidateValidation;
  args.mutate?.(manifest);
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = manifest;
  manifest.digest = canonicalJsonDigest(payload);
  const manifestPath = path.posix.join(
    path.posix.dirname(path.posix.dirname(args.source.visualContract.templatePath)),
    'bridge-manifests',
    `${manifest.digest}.json`,
  );
  writeText(
    args.repoRoot,
    manifestPath,
    canonicalContentAddressedJsonBytes(manifest),
  );
  return { manifest, path: manifestPath };
}

async function materializeCanonicalCandidate(
  options: { supervisedAuthoring?: boolean } = {},
): Promise<CanonicalCandidateFixture> {
  const parent = tempRoot();
  const repoRoot = path.join(parent, 'repository');
  const remoteRoot = path.join(parent, 'remote.git');
  fs.mkdirSync(repoRoot, { recursive: true });
  git(repoRoot, ['init', '-b', BRANCH]);
  git(repoRoot, ['config', 'user.email', 'fixture@example.test']);
  git(repoRoot, ['config', 'user.name', 'QA Wizard Bridge Fixture']);
  writeText(repoRoot, '.gitignore', 'node_modules/\noutputs/\n');
  copyFile(repoRoot, STORY_PATH, path.join(BANK, `${STORY_KEY}.md`));
  copyFile(
    repoRoot,
    STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
    path.join(process.cwd(), STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH),
  );
  createDependencyAuthority(repoRoot);
  const provisionalSnapshot = buildStorySourceAuthoritySnapshot({
    repoRoot,
    storyKey: STORY_KEY,
    storyPath: STORY_PATH,
  });
  const provisionalRequest = buildVisualContractAuthoringRequest({
    snapshot: provisionalSnapshot,
    mode: 'live',
    requestId: 'qa-wizard-template-fixture',
    requestedAt: REQUESTED_AT,
  });
  const provisionalRun = await runVisualContractAuthoring({
    request: provisionalRequest,
    snapshot: provisionalSnapshot,
    provider: canonicalProvider(fullyActionedDraft(provisionalSnapshot)),
    requiredMode: 'live',
    requiredProviderEvidenceVersion:
      OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
  });
  expect(provisionalRun.receipt.status).toBe('completed');
  expect(provisionalRun.compileResult).not.toBeNull();
  git(repoRoot, [
    'add',
    '.gitignore',
    'package.json',
    'package-lock.json',
    STORY_PATH,
    STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
  ]);
  git(repoRoot, ['commit', '-m', 'canonical bridge fixture']);
  git(parent, ['init', '--bare', remoteRoot]);
  git(repoRoot, ['remote', 'add', 'origin', remoteRoot]);
  git(repoRoot, ['push', '-u', 'origin', BRANCH]);
  const canonicalRepoRoot = fs.realpathSync(repoRoot);

  const fresh = prepareCanonicalPreLiveReadiness({
    input: {
      repoRoot: canonicalRepoRoot,
      outputRoot: OUTPUT_ROOT,
      storySourceKey: STORY_KEY,
      storySourcePath: STORY_PATH,
      requestId: 'qa-wizard-bridge-fresh-001',
      requestedAt: REQUESTED_AT,
      credentialSourcePath: path.join(parent, 'opaque-credential-label.env'),
    },
    launchAuthority: {
      npmCliSha256: 'a'.repeat(64),
      offlineInstallCompleted: true,
      prismaGenerationCompleted: true,
    },
  });
  if (fresh.status !== 'ready_for_spend_gate') {
    throw new Error('fixture Fresh Readiness did not reach ready_for_spend_gate');
  }
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(canonicalRepoRoot, fresh.canonicalAuthorities.b0.manifestPath),
      'utf8',
    ),
  ) as LiveRequestMaterializationManifest;
  const requestPath = manifest.artifacts.liveAuthoringRequest.path;
  const snapshotPath = manifest.artifacts.sourceSnapshot.path;
  const snapshot = JSON.parse(
    fs.readFileSync(path.join(canonicalRepoRoot, snapshotPath), 'utf8'),
  ) as StorySourceAuthoritySnapshot;
  const request = JSON.parse(
    fs.readFileSync(path.join(canonicalRepoRoot, requestPath), 'utf8'),
  ) as VisualContractAuthoringRequest;

  let receiptPath: string | null = null;
  let readinessPath: string | null = null;
  let candidatePath: string | null = null;
  const persistAuthoringOutputs = async () => {
    const run = await runVisualContractAuthoring({
      request,
      snapshot,
      provider: canonicalProvider(fullyActionedDraft(snapshot)),
      requiredMode: 'live',
      requiredProviderEvidenceVersion:
        OPENAI_RESPONSES_AUTHORING_EVIDENCE_VERSION,
    });
    expect(run.receipt.status).toBe('completed');
    expect(run.compileResult).not.toBeNull();
    const readiness = buildVisualContractAuthoringReadinessEvidence({
      snapshot,
      request,
      receipt: run.receipt,
    });
    const outputDir = `${OUTPUT_ROOT}/b0`;
    const receiptWrite = persistVisualContractAuthoringReceipt({
      repoRoot: canonicalRepoRoot,
      outputDir,
      request,
      receipt: run.receipt,
      write: true,
    });
    const readinessWrite = persistVisualContractAuthoringReadiness({
      repoRoot: canonicalRepoRoot,
      outputDir,
      request,
      evidence: readiness,
      receipt: run.receipt,
      write: true,
    });
    const candidateWrite = persistVisualContractCandidate({
      repoRoot: canonicalRepoRoot,
      outputDir,
      request,
      receipt: run.receipt,
      compileResult: run.compileResult!,
      write: true,
    });
    for (const category of [
      'provider-call-failure-evidence',
      'rejected-authoring-requests',
    ]) {
      fs.mkdirSync(path.join(canonicalRepoRoot, outputDir, category), {
        recursive: true,
      });
    }
    receiptPath = receiptWrite.path;
    readinessPath = readinessWrite.path;
    candidatePath = candidateWrite.path;
  };

  const credentialState = { cleared: false };
  const supervisedAuthoring = options.supervisedAuthoring !== false;
  const liveResult = await runCanonicalLiveExecution({
    repoRoot: canonicalRepoRoot,
    requestPath: fresh.canonicalAuthorities.executionRequest.path,
    dependencies: {
      env: { NODE_ENV: 'test' },
      readCredential() {
        return {
          value: 'fixture-supervisor-key-never-persisted',
          clear() {
            credentialState.cleared = true;
          },
        };
      },
      spawnTrusted() {
        return fakeChild({
          ...(supervisedAuthoring
            ? { beforeClose: persistAuthoringOutputs }
            : {}),
        }) as never;
      },
    },
  });
  expect(credentialState.cleared).toBe(true);
  if (supervisedAuthoring) {
    expect(liveResult.status).toBe('child_completed');
    expect(liveResult.outputAuthority).not.toBeNull();
  } else {
    expect(liveResult.status).toBe('child_failed');
    expect(liveResult.outputAuthority).toBeNull();
    await persistAuthoringOutputs();
  }
  if (!receiptPath || !readinessPath || !candidatePath) {
    throw new Error('fixture canonical authoring outputs were not persisted');
  }
  const supervisorResultSourcePath =
    `${OUTPUT_ROOT}/execution/supervisor-live-result.json`;
  writeJson(canonicalRepoRoot, supervisorResultSourcePath, liveResult);
  let supervisorCaptureRejected = false;
  let supervisorExecutionResultPath: string;
  if (supervisedAuthoring) {
    supervisorExecutionResultPath =
      captureQaWizardCanonicalSupervisorResultEvidence({
        repoRoot: canonicalRepoRoot,
        outputDir: `${OUTPUT_ROOT}/execution`,
        supervisorResultSourcePath,
        write: true,
      }).path;
  } else {
    expect(() =>
      captureQaWizardCanonicalSupervisorResultEvidence({
        repoRoot: canonicalRepoRoot,
        outputDir: `${OUTPUT_ROOT}/execution`,
        supervisorResultSourcePath,
        write: true,
      }),
    ).toThrow(/Supervisor execution result/i);
    supervisorCaptureRejected = true;
    const resultDigest = canonicalJsonDigest(liveResult);
    supervisorExecutionResultPath =
      `${OUTPUT_ROOT}/execution/canonical-live-execution-results/${resultDigest}.json`;
    writeText(
      canonicalRepoRoot,
      supervisorExecutionResultPath,
      canonicalLiveAuthoringJsonBytes(liveResult),
    );
  }
  expect(git(canonicalRepoRoot, ['status', '--porcelain=v1'])).toBe('');
  const candidateValidationAttestationPath = supervisedAuthoring
    ? attestQaWizardCandidateValidation({
        repoRoot: canonicalRepoRoot,
        outputDir: `${OUTPUT_ROOT}/execution`,
        storyKey: STORY_KEY,
        storyPath: STORY_PATH,
        candidatePath,
        authoringRequestPath: requestPath,
        authoringReceiptPath: receiptPath,
        authoringReadinessPath: readinessPath,
        freshReadinessPath: freshPath(fresh),
        supervisorExecutionRequestPath:
          fresh.canonicalAuthorities.executionRequest.path,
        supervisorExecutionResultPath,
        write: true,
      }).artifact.path
    : `${OUTPUT_ROOT}/execution/candidate-validation-attestations/${'0'.repeat(64)}.json`;
  return {
    repoRoot: canonicalRepoRoot,
    storyPath: STORY_PATH,
    requestPath,
    receiptPath,
    readinessPath,
    candidatePath,
    freshReadinessPath: freshPath(fresh),
    supervisorExecutionRequestPath:
      fresh.canonicalAuthorities.executionRequest.path,
    supervisorExecutionResultPath,
    candidateValidationAttestationPath,
    supervisorStatus: liveResult.status,
    supervisorOutputAuthorityPresent: liveResult.outputAuthority !== null,
    supervisorCaptureRejected,
  };
}

function prepareArgs(
  fixture: CanonicalCandidateFixture,
  outputDir = 'outputs/bridge',
) {
  return {
    repoRoot: fixture.repoRoot,
    outputDir,
    storyKey: STORY_KEY,
    storyPath: fixture.storyPath,
    candidatePath: fixture.candidatePath,
    authoringRequestPath: fixture.requestPath,
    authoringReceiptPath: fixture.receiptPath,
    authoringReadinessPath: fixture.readinessPath,
    freshReadinessPath: fixture.freshReadinessPath,
    supervisorExecutionRequestPath: fixture.supervisorExecutionRequestPath,
    supervisorExecutionResultPath: fixture.supervisorExecutionResultPath,
    candidateValidationAttestationPath:
      fixture.candidateValidationAttestationPath,
  };
}

function candidateValidationArgs(
  fixture: CanonicalCandidateFixture,
  outputDir = `${OUTPUT_ROOT}/execution`,
) {
  return {
    repoRoot: fixture.repoRoot,
    outputDir,
    storyKey: STORY_KEY,
    storyPath: fixture.storyPath,
    candidatePath: fixture.candidatePath,
    authoringRequestPath: fixture.requestPath,
    authoringReceiptPath: fixture.receiptPath,
    authoringReadinessPath: fixture.readinessPath,
    freshReadinessPath: fixture.freshReadinessPath,
    supervisorExecutionRequestPath: fixture.supervisorExecutionRequestPath,
    supervisorExecutionResultPath: fixture.supervisorExecutionResultPath,
  };
}

function assertCandidateValidationTamperGuards(
  fixture: CanonicalCandidateFixture,
): void {
  const tampered = (
    mutate: (value: Record<string, unknown>) => void,
  ): string =>
    writeRedigestedCanonicalArtifact({
      repoRoot: fixture.repoRoot,
      sourcePath: fixture.candidateValidationAttestationPath,
      mutate,
    });
  const expectRejected = (attestationPath: string, pattern: RegExp) =>
    expect(() =>
      prepareQaWizardCandidateReconciliation({
        ...prepareArgs(fixture),
        candidateValidationAttestationPath: attestationPath,
      }),
    ).toThrow(pattern);

  expectRejected(
    tampered((value) => {
      (value.subject as Record<string, unknown>).candidateDigest = 'f'.repeat(64);
    }),
    /cross_candidate_replay|subject_mismatch/,
  );
  expectRejected(
    tampered((value) => {
      (value.authoring as Record<string, unknown>).freshReadinessDigest =
        'f'.repeat(64);
    }),
    /authoring_provenance_mismatch/,
  );
  expectRejected(
    tampered((value) => {
      (value.authoring as Record<string, unknown>).repositoryHead =
        'f'.repeat(40);
    }),
    /authoring_head_mismatch/,
  );
  expectRejected(
    tampered((value) => {
      const validation = value.validation as Record<string, unknown>;
      validation.status = 'failed';
      validation.errorCount = 1;
      validation.issues = ['closed validation failure'];
    }),
    /candidate_validation_not_passed/,
  );
  for (const invalidPath of [
    tampered((value) => {
      value.authorityScope = 'wizard_render';
    }),
    tampered((value) => {
      value.extra = 'not allowed';
    }),
  ]) {
    expect(() =>
      loadQaWizardCandidateValidationAttestation({
        repoRoot: fixture.repoRoot,
        attestationPath: invalidPath,
      }),
    ).toThrow(/attestation_shape_invalid/);
  }
  expectRejected(
    tampered((value) => {
      const consumer = value.consumer as Record<string, unknown>;
      consumer.head = 'f'.repeat(40);
      consumer.upstreamHead = 'f'.repeat(40);
    }),
    /consumer_head_stale/,
  );

  const arbitraryPath = 'outputs/arbitrary-attestation.json';
  fs.copyFileSync(
    path.join(fixture.repoRoot, fixture.candidateValidationAttestationPath),
    path.join(fixture.repoRoot, arbitraryPath),
  );
  expectRejected(arbitraryPath, /canonical|category|path/i);

  writeText(fixture.repoRoot, 'dirty-consumer-marker.txt', 'dirty\n');
  expectRejected(
    fixture.candidateValidationAttestationPath,
    /consumer_repository_stale_or_dirty/,
  );
  fs.unlinkSync(path.join(fixture.repoRoot, 'dirty-consumer-marker.txt'));

  git(fixture.repoRoot, ['switch', '-c', 'codex/wrong-consumer-branch']);
  git(fixture.repoRoot, [
    'branch',
    '--set-upstream-to',
    `origin/${BRANCH}`,
  ]);
  expectRejected(
    fixture.candidateValidationAttestationPath,
    /consumer_repository_stale_or_dirty/,
  );
  git(fixture.repoRoot, ['switch', BRANCH]);
}

function approveReconciliation(args: {
  reconciliation: SourcePromptReconciliation;
  template: BookVisualContractTemplate;
}): SourcePromptReconciliation {
  const approved = structuredClone(args.reconciliation);
  approved.review = {
    status: 'approved',
    reviewedBy: 'Guy',
    reviewedAt: APPROVED_AT,
  };
  for (const frame of approved.frames) {
    const pageIndex =
      frame.frameKind === 'page'
        ? args.template.pageContracts.findIndex(
            (page) => page.pageNumber === frame.pageNumber,
          )
        : -1;
    for (const [index, requirement] of frame.sourceRequirements.entries()) {
      const historical =
        requirement.sourceKind === 'historical_image_direction';
      const pointer = historical
        ? `/pageContracts/${pageIndex}/camera`
        : frame.frameKind === 'cover'
          ? '/coverContract/mustShow/0'
          : `/pageContracts/${pageIndex}/mustShow/0`;
      const value = historical
        ? args.template.pageContracts[pageIndex]!.camera
        : frame.frameKind === 'cover'
          ? args.template.coverContract.mustShow[0]
          : args.template.pageContracts[pageIndex]!.mustShow[0];
      requirement.visualBeats = [
        {
          id: `review:${frame.frameKind}:${frame.pageNumber}:${index}`,
          description: `Exact reviewed meaning for ${frame.frameKind} ${frame.pageNumber}`,
          aspects: historical ? ['camera'] : ['narrative_meaning'],
          disposition: 'preserved',
          contractEvidence: [{ path: pointer, value }],
          justification: null,
          supersessionReview: null,
        },
      ];
    }
  }
  return approved;
}

function buildApprovedArtifacts(args: {
  fixture: CanonicalCandidateFixture;
  prepared: ReturnType<typeof prepareQaWizardCandidateReconciliation>;
  outputDir?: string;
}) {
  const pending = JSON.parse(
    fs.readFileSync(
      path.join(
        args.fixture.repoRoot,
        args.prepared.reconciliationArtifacts.reconciliationPath,
      ),
      'utf8',
    ),
  ) as SourcePromptReconciliation;
  const template = JSON.parse(
    fs.readFileSync(
      path.join(
        args.fixture.repoRoot,
        args.prepared.manifest.visualContract.templatePath,
      ),
      'utf8',
    ),
  ) as BookVisualContractTemplate;
  const approved = approveReconciliation({ reconciliation: pending, template });
  const snapshot = buildStorySourceAuthoritySnapshot({
    repoRoot: args.fixture.repoRoot,
    storyKey: STORY_KEY,
    storyPath: args.fixture.storyPath,
  });
  const reviewBundle = buildReconciliationReviewBundle({
    reconciliation: approved,
    sourceIdentity: snapshot.content.sourceIdentity,
    sourceAuthoritySnapshotDigest: snapshot.digest,
    rawStorySource: snapshot.content.normalizedRawStorySource,
    template,
    ...(snapshot.content.authoredCoverAuthority
      ? { authoredCoverAuthority: snapshot.content.authoredCoverAuthority }
      : {}),
    actionSemanticCoverage: approved.actionSemanticCoverageAuthority.records,
  });
  expect(reviewBundle.readyForApproval).toBe(true);
  return {
    approved,
    reviewBundle,
    artifacts: persistReconciliationDraftBundle({
      repoRoot: args.fixture.repoRoot,
      outputDir: args.outputDir ?? 'outputs/approved',
      reconciliation: approved,
      reviewBundle,
      markdown: renderReconciliationReviewMarkdown(reviewBundle),
      write: true,
    }),
  };
}

describe('QA Wizard real-candidate reconciliation bridge', () => {
  it('fails closed through the process CLI without leaking or claiming a write', () => {
    const missingRequest = path.join(
      tempRoot('qa-wizard-cli-rejection-'),
      'secret_debug_payload-request.json',
    );
    const outputDir = `outputs/qa-wizard-cli-rejection-${process.pid}`;
    const outputAbsolute = path.join(process.cwd(), outputDir);
    expect(fs.existsSync(outputAbsolute)).toBe(false);
    const result = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        '--require',
        path.join(
          process.cwd(),
          'scripts',
          'shims',
          'register-server-only.cjs',
        ),
        path.join(process.cwd(), 'scripts', 'qa-wizard-candidate-bridge.ts'),
        'prepare-reconciliation',
        '--request',
        missingRequest,
        '--out',
        outputDir,
        '--write',
        'true',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      },
    );
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      status: 'rejected',
      localImmutableWriteState: 'not_attested_after_rejection',
      reasonCodes: ['bridge_request_invalid'],
    });
    expect(parsed).not.toHaveProperty('zeroWrite');
    expect(parsed).not.toHaveProperty('localImmutableWrite');
    expect(result.stdout).not.toContain('secret_debug_payload');
    expect(result.stdout).not.toMatch(/stack|exception|ENOENT/i);
    expect(fs.existsSync(outputAbsolute)).toBe(false);
  });

  it('attests the unchanged Candidate at a later clean pushed consumer HEAD, rejects tamper and repository drift, and carries authority through manifest v3', async () => {
    const fixture = await materializeCanonicalCandidate();
    const original = loadQaWizardCandidateValidationAttestation({
      repoRoot: fixture.repoRoot,
      attestationPath: fixture.candidateValidationAttestationPath,
    });
    expect(qaWizardCandidateValidationAttestationIsValid(original)).toBe(true);
    expect(original.validation).toEqual({
      validator: 'validateBookVisualContractTemplate',
      templateSchemaVersion: original.subject.templateSchemaVersion,
      status: 'passed',
      errorCount: 0,
      issues: [],
    });
    expect(original.authoring.repositoryHead).toBe(original.consumer.head);

    const preview = attestQaWizardCandidateValidation({
      ...candidateValidationArgs(fixture, 'outputs/attestation-preview'),
      write: false,
    });
    const written = attestQaWizardCandidateValidation({
      ...candidateValidationArgs(fixture, 'outputs/attestation-preview'),
      write: true,
    });
    expect(preview.attestation).toEqual(written.attestation);
    expect(preview.artifact).toEqual({
      path: written.artifact.path,
      digest: written.artifact.digest,
      created: false,
    });
    expect(written.artifact.created).toBe(true);
    expect(
      fs.readFileSync(path.join(fixture.repoRoot, written.artifact.path), 'utf8'),
    ).toBe(canonicalContentAddressedJsonBytes(written.attestation));

    const cliRequestPath = 'outputs/candidate-validation-cli-request.json';
    const {
      outputDir: _candidateValidationOutputDir,
      ...cliRequest
    } = candidateValidationArgs(fixture, 'outputs/candidate-validation-cli');
    writeJson(fixture.repoRoot, cliRequestPath, cliRequest);
    const cli = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        '--require',
        path.join(
          process.cwd(),
          'scripts',
          'shims',
          'register-server-only.cjs',
        ),
        path.join(process.cwd(), 'scripts', 'qa-wizard-candidate-bridge.ts'),
        'attest-candidate-validation',
        '--request',
        path.join(fixture.repoRoot, cliRequestPath),
        '--out',
        'outputs/candidate-validation-cli',
        '--write',
        'false',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      },
    );
    expect(cli.status).toBe(0);
    expect(JSON.parse(cli.stdout)).toMatchObject({
      status: 'candidate_validation_attestation_preview_ready',
      localImmutableWriteRequested: false,
      bridgeBoundaryEvidence: {
        credentialAccess: 'none',
        providerCalls: 0,
        imageCalls: 0,
        networkCalls: 0,
        databaseWrites: 0,
        productionWrites: 0,
      },
    });
    assertCandidateValidationTamperGuards(fixture);

    const authoringHead = original.authoring.repositoryHead;
    writeText(
      fixture.repoRoot,
      'consumer-validator-head.txt',
      'current validator consumer authority\n',
    );
    git(fixture.repoRoot, ['add', 'consumer-validator-head.txt']);
    git(fixture.repoRoot, ['commit', '-m', 'advance consumer validator']);
    git(fixture.repoRoot, ['push']);
    const consumerHead = git(fixture.repoRoot, ['rev-parse', 'HEAD']);
    expect(consumerHead).not.toBe(authoringHead);
    expect(git(fixture.repoRoot, ['status', '--porcelain=v1'])).toBe('');

    const current = attestQaWizardCandidateValidation({
      ...candidateValidationArgs(fixture, 'outputs/current-consumer-attestation'),
      write: true,
    });
    expect(current.attestation.authoring.repositoryHead).toBe(authoringHead);
    expect(current.attestation.consumer.head).toBe(consumerHead);
    expect(current.attestation.consumer.upstreamHead).toBe(consumerHead);
    expect(() =>
      prepareQaWizardCandidateReconciliation({
        ...prepareArgs(fixture, 'outputs/stale-consumer-bridge'),
        candidateValidationAttestationPath:
          fixture.candidateValidationAttestationPath,
      }),
    ).toThrow(/candidate_validation_consumer_head_stale/);

    const prepared = prepareQaWizardCandidateReconciliation({
      ...prepareArgs(fixture, 'outputs/cross-head-bridge'),
      candidateValidationAttestationPath: current.artifact.path,
      write: true,
    });
    expect(prepared.manifest.version).toBe(
      'qa-wizard-candidate-bridge-manifest/v3',
    );
    expect(prepared.manifest.candidateValidation).toEqual({
      version: current.attestation.version,
      digest: current.attestation.digest,
      path: current.artifact.path,
    });
    expect(
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: prepared.manifestArtifact.path,
      }),
    ).toEqual(prepared.manifest);
    const localHead = git(fixture.repoRoot, ['rev-parse', 'HEAD']);
    const tree = git(fixture.repoRoot, ['write-tree']);
    const remoteHead = git(fixture.repoRoot, [
      'commit-tree',
      tree,
      '-p',
      localHead,
      '-m',
      'advance remote consumer head',
    ]);
    git(fixture.repoRoot, [
      'push',
      'origin',
      `${remoteHead}:refs/heads/${BRANCH}`,
    ]);
    git(fixture.repoRoot, ['fetch', 'origin']);
    expect(() =>
      prepareQaWizardCandidateReconciliation({
        ...prepareArgs(fixture, 'outputs/behind-consumer-bridge'),
        candidateValidationAttestationPath: current.artifact.path,
      }),
    ).toThrow(/consumer_repository_stale_or_dirty/);

    git(fixture.repoRoot, ['merge', '--ff-only', '@{upstream}']);
    const advancedAuthority = attestQaWizardCandidateValidation({
      ...candidateValidationArgs(fixture, 'outputs/advanced-consumer-attestation'),
      write: true,
    });
    writeText(fixture.repoRoot, 'local-ahead-head.txt', 'ahead\n');
    git(fixture.repoRoot, ['add', 'local-ahead-head.txt']);
    git(fixture.repoRoot, ['commit', '-m', 'local ahead consumer head']);
    expect(() =>
      prepareQaWizardCandidateReconciliation({
        ...prepareArgs(fixture, 'outputs/ahead-consumer-bridge'),
        candidateValidationAttestationPath: advancedAuthority.artifact.path,
      }),
    ).toThrow(/consumer_head_stale|consumer_repository_stale_or_dirty/);
  }, 60_000);

  it('requires exact canonical Fresh Readiness and completed Supervisor-live provenance', async () => {
    const fixture = await materializeCanonicalCandidate();
    expect(fixture.supervisorStatus).toBe('child_completed');
    expect(fixture.supervisorOutputAuthorityPresent).toBe(true);
    expect(fixture.supervisorCaptureRejected).toBe(false);
    expect(() =>
      prepareQaWizardCandidateReconciliation({
        ...prepareArgs(fixture),
        supervisorExecutionResultPath:
          `${OUTPUT_ROOT}/execution/canonical-live-execution-results/missing.json`,
      }),
    ).toThrow(/Supervisor execution result is missing/i);

    const supervisorSourcePath =
      `${OUTPUT_ROOT}/execution/supervisor-live-result.json`;
    const supervisorSourceAbsolute = path.join(
      fixture.repoRoot,
      supervisorSourcePath,
    );
    const supervisorSourceBytes = fs.readFileSync(
      supervisorSourceAbsolute,
      'utf8',
    );
    const priorSupervisorResult = JSON.parse(
      supervisorSourceBytes,
    ) as Record<string, unknown>;
    priorSupervisorResult.version =
      'canonical-live-execution-result/v21';
    writeText(
      fixture.repoRoot,
      supervisorSourcePath,
      canonicalLiveAuthoringJsonBytes(priorSupervisorResult),
    );
    expect(() =>
      captureQaWizardCanonicalSupervisorResultEvidence({
        repoRoot: fixture.repoRoot,
        outputDir: `${OUTPUT_ROOT}/execution-prior-result`,
        supervisorResultSourcePath: supervisorSourcePath,
        write: false,
      }),
    ).toThrow(/Supervisor execution result/i);
    fs.writeFileSync(
      supervisorSourceAbsolute,
      supervisorSourceBytes,
      'utf8',
    );

    const resultAbsolute = path.join(
      fixture.repoRoot,
      fixture.supervisorExecutionResultPath,
    );
    const originalResult = fs.readFileSync(resultAbsolute, 'utf8');
    const tamperedResult = JSON.parse(originalResult) as Record<string, unknown>;
    const child = tamperedResult.child as {
      termination: { exitCode: number };
    };
    child.termination.exitCode = 1;
    fs.writeFileSync(resultAbsolute, `${JSON.stringify(tamperedResult)}\n`, 'utf8');
    expect(() =>
      prepareQaWizardCandidateReconciliation(prepareArgs(fixture)),
    ).toThrow(/Supervisor execution result/i);
    fs.writeFileSync(resultAbsolute, originalResult, 'utf8');

    const freshAbsolute = path.join(fixture.repoRoot, fixture.freshReadinessPath);
    const originalFresh = fs.readFileSync(freshAbsolute, 'utf8');
    const tamperedFresh = JSON.parse(originalFresh) as Record<string, unknown>;
    tamperedFresh.providerCalls = 1;
    fs.writeFileSync(freshAbsolute, `${JSON.stringify(tamperedFresh)}\n`, 'utf8');
    expect(() =>
      prepareQaWizardCandidateReconciliation(prepareArgs(fixture)),
    ).toThrow();
    fs.writeFileSync(freshAbsolute, originalFresh, 'utf8');

    const executionRequest = JSON.parse(
      fs.readFileSync(
        path.join(fixture.repoRoot, fixture.supervisorExecutionRequestPath),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(executionRequest.expectedAbsentPaths).toEqual([
      `${OUTPUT_ROOT}/b0/authoring-receipts`,
      `${OUTPUT_ROOT}/b0/contract-candidates`,
      `${OUTPUT_ROOT}/b0/provider-call-failure-evidence`,
      `${OUTPUT_ROOT}/b0/readiness-evidence`,
      `${OUTPUT_ROOT}/b0/rejected-authoring-requests`,
    ]);
    const alteredAbsenceRequestPath = writeRedigestedCanonicalArtifact({
      repoRoot: fixture.repoRoot,
      sourcePath: fixture.supervisorExecutionRequestPath,
      mutate(value) {
        value.expectedAbsentPaths = [
          `${OUTPUT_ROOT}/b0/authoring-receipts`,
          `${OUTPUT_ROOT}/b0/contract-candidates`,
          `${OUTPUT_ROOT}/b0/provider-call-failure-evidence`,
          `${OUTPUT_ROOT}/b0/readiness-evidence`,
          `${OUTPUT_ROOT}/b0/unrelated-empty-category`,
        ];
      },
    });
    expect(() =>
      prepareQaWizardCandidateReconciliation({
        ...prepareArgs(fixture),
        supervisorExecutionRequestPath: alteredAbsenceRequestPath,
      }),
    ).toThrow(/execution[ _]request|cross-bound|expected/i);

    const alteredChildIdsFreshPath = writeRedigestedCanonicalArtifact({
      repoRoot: fixture.repoRoot,
      sourcePath: fixture.freshReadinessPath,
      mutate(value) {
        const request = value.request as {
          childRequestIds: { b0: string; execution: string };
        };
        request.childRequestIds = {
          b0: 'redigested-but-unbound:b0',
          execution: 'redigested-but-unbound:execution',
        };
      },
    });
    expect(() =>
      prepareQaWizardCandidateReconciliation({
        ...prepareArgs(fixture),
        freshReadinessPath: alteredChildIdsFreshPath,
      }),
    ).toThrow(/cross-bound/i);

    const alteredRequestedAtFreshPath = writeRedigestedCanonicalArtifact({
      repoRoot: fixture.repoRoot,
      sourcePath: fixture.freshReadinessPath,
      mutate(value) {
        const request = value.request as { requestedAt: string };
        request.requestedAt = '2026-08-17T07:30:01.000Z';
      },
    });
    expect(() =>
      prepareQaWizardCandidateReconciliation({
        ...prepareArgs(fixture),
        freshReadinessPath: alteredRequestedAtFreshPath,
      }),
    ).toThrow(/cross-bound/i);

    const prepared = prepareQaWizardCandidateReconciliation({
      ...prepareArgs(fixture),
      write: true,
    });
    expect(
      git(fixture.repoRoot, [
        'ls-files',
        '*.visual-contract-template.json',
      ]),
    ).toBe('');
    const candidate = JSON.parse(
      fs.readFileSync(
        path.join(fixture.repoRoot, fixture.candidatePath),
        'utf8',
      ),
    ) as {
      digest: string;
      templateDigest: string;
      template: BookVisualContractTemplate;
    };
    expect(prepared.templateProjectionArtifact).toEqual({
      path:
        `outputs/bridge/candidate-template-projections/${candidate.templateDigest}.json`,
      digest: candidate.templateDigest,
      created: true,
    });
    expect(
      fs.readFileSync(
        path.join(
          fixture.repoRoot,
          prepared.templateProjectionArtifact.path,
        ),
        'utf8',
      ),
    ).toBe(canonicalContentAddressedJsonBytes(candidate.template));
    expect(prepared.manifest.visualContract).toMatchObject({
      candidateDigest: candidate.digest,
      candidatePath: fixture.candidatePath,
      templateSchemaVersion: candidate.template.schemaVersion,
      templateDigest: candidate.templateDigest,
      templatePath: prepared.templateProjectionArtifact.path,
    });
    const replayed = prepareQaWizardCandidateReconciliation({
      ...prepareArgs(fixture),
      write: true,
    });
    expect(replayed.templateProjectionArtifact.created).toBe(false);
    expect(replayed.manifest.digest).toBe(prepared.manifest.digest);
    expect(
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: prepared.manifestArtifact.path,
      }).digest,
    ).toBe(prepared.manifest.digest);
    expect(qaWizardCandidateBridgeManifestIsValid(prepared.manifest)).toBe(true);
    expect(prepared.manifest).toMatchObject({
      stage: 'reconciliation_pending',
      supervisor: {
        freshReadinessDigest: path.basename(
          fixture.freshReadinessPath,
          '.json',
        ),
        executionResultDigest: path.basename(
          fixture.supervisorExecutionResultPath,
          '.json',
        ),
      },
      reconciliation: {
        status: 'pending',
        reviewedBy: null,
        approvalAttestationVersion: null,
        approvalAttestationDigest: null,
        approvalAttestationPath: null,
        pendingManifestDigest: null,
      },
      productionContext: null,
      blueprint: null,
      visualPackage: null,
      wizard: null,
    });
    expect(JSON.stringify(prepared.manifest)).not.toMatch(
      /systemPrompt|userPrompt|rawResponse|responseBody|providerMessage|apiKey|secret_debug_payload/i,
    );

    const {
      outputDir: _directOutputDir,
      ...cliRequest
    } = prepareArgs(fixture, 'outputs/bridge-cli');
    const cliRequestPath = 'outputs/bridge-cli-request.json';
    writeJson(fixture.repoRoot, cliRequestPath, cliRequest);
    const runCli = (requestPath: string) =>
      spawnSync(
        process.execPath,
        [
          path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
          '--require',
          path.join(
            process.cwd(),
            'scripts',
            'shims',
            'register-server-only.cjs',
          ),
          path.join(process.cwd(), 'scripts', 'qa-wizard-candidate-bridge.ts'),
          'prepare-reconciliation',
          '--request',
          path.join(fixture.repoRoot, requestPath),
          '--out',
          'outputs/bridge-cli',
          '--write',
          'true',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          shell: false,
          windowsHide: true,
        },
      );
    const cliResult = runCli(cliRequestPath);
    expect(cliResult.status).toBe(0);
    expect(JSON.parse(cliResult.stdout)).toMatchObject({
      status: 'awaiting_exact_reconciliation_content',
      manifest: {
        version: 'qa-wizard-candidate-bridge-manifest/v3',
        visualContract: {
          templatePath:
            `outputs/bridge-cli/candidate-template-projections/${candidate.templateDigest}.json`,
        },
      },
    });
    const legacyRequestPath = 'outputs/bridge-cli-legacy-request.json';
    writeJson(fixture.repoRoot, legacyRequestPath, {
      ...cliRequest,
      templatePath: 'authorities/operator-supplied-template.json',
    });
    const legacyResult = runCli(legacyRequestPath);
    expect(legacyResult.status).toBe(1);
    expect(JSON.parse(legacyResult.stdout)).toMatchObject({
      status: 'rejected',
      reasonCodes: ['bridge_request_invalid'],
    });
  }, 15_000);

  it('rejects an exit-zero child with no outputs even after post-hoc authoring artifacts are spliced in', async () => {
    const fixture = await materializeCanonicalCandidate({
      supervisedAuthoring: false,
    });
    expect(fixture.supervisorStatus).toBe('child_failed');
    expect(fixture.supervisorOutputAuthorityPresent).toBe(false);
    expect(fixture.supervisorCaptureRejected).toBe(true);
    expect(fs.existsSync(path.join(fixture.repoRoot, fixture.receiptPath))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(fixture.repoRoot, fixture.readinessPath)),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(fixture.repoRoot, fixture.candidatePath)),
    ).toBe(true);
    expect(() =>
      prepareQaWizardCandidateReconciliation(prepareArgs(fixture)),
    ).toThrow(/Supervisor execution result|candidate validation attestation/i);
  });

  it('rejects output-category junctions before persisting bridge artifacts', async () => {
    const fixture = await materializeCanonicalCandidate();
    const outputDir = 'outputs/junction-bridge';
    const outputAbsolute = path.join(fixture.repoRoot, outputDir);
    const external = tempRoot('qa-wizard-external-category-');
    fs.mkdirSync(outputAbsolute, { recursive: true });
    fs.symlinkSync(
      external,
      path.join(outputAbsolute, 'candidate-template-projections'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    expect(() =>
      prepareQaWizardCandidateReconciliation({
        ...prepareArgs(fixture, outputDir),
        write: true,
      }),
    ).toThrow(/outside|symlink|junction|alias|contained/i);
    expect(
      fs.readdirSync(external, { recursive: true }).filter((entry) =>
        String(entry).endsWith('.json'),
      ),
    ).toEqual([]);
  });

  it('rejects projected-template tamper, wrapper substitution, arbitrary paths, cross-candidate replay, hardlinks, and collisions', async () => {
    const fixture = await materializeCanonicalCandidate();
    const prepared = prepareQaWizardCandidateReconciliation({
      ...prepareArgs(fixture),
      write: true,
    });
    const manifestPath = prepared.manifestArtifact.path;
    const projectionPath = prepared.templateProjectionArtifact.path;
    const projectionAbsolute = path.join(fixture.repoRoot, projectionPath);
    const projectionBytes = fs.readFileSync(projectionAbsolute, 'utf8');
    const candidateAbsolute = path.join(
      fixture.repoRoot,
      fixture.candidatePath,
    );
    const candidateBytes = fs.readFileSync(candidateAbsolute, 'utf8');

    fs.writeFileSync(projectionAbsolute, candidateBytes, 'utf8');
    expect(() =>
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath,
      }),
    ).toThrow(/template projection|canonical/i);
    fs.writeFileSync(projectionAbsolute, projectionBytes, 'utf8');

    const candidateTamper = JSON.parse(candidateBytes) as Record<
      string,
      unknown
    >;
    candidateTamper.status = 'not-a-candidate';
    fs.writeFileSync(
      candidateAbsolute,
      canonicalContentAddressedJsonBytes(candidateTamper),
      'utf8',
    );
    expect(() =>
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath,
      }),
    ).toThrow(/candidate|canonical|cross-bound/i);
    fs.writeFileSync(candidateAbsolute, candidateBytes, 'utf8');

    const arbitraryProjectionPath =
      `outputs/bridge/arbitrary/${prepared.manifest.visualContract.templateDigest}.json`;
    fs.mkdirSync(
      path.dirname(path.join(fixture.repoRoot, arbitraryProjectionPath)),
      { recursive: true },
    );
    fs.copyFileSync(
      projectionAbsolute,
      path.join(fixture.repoRoot, arbitraryProjectionPath),
    );
    const arbitraryManifestPath = writeRedigestedCanonicalArtifact({
      repoRoot: fixture.repoRoot,
      sourcePath: manifestPath,
      mutate(value) {
        const visualContract = value.visualContract as {
          templatePath: string;
        };
        visualContract.templatePath = arbitraryProjectionPath;
      },
    });
    expect(() =>
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: arbitraryManifestPath,
      }),
    ).toThrow(/projection identity|canonical|cross-bound/i);

    const crossCandidatePath = writeRedigestedCanonicalArtifact({
      repoRoot: fixture.repoRoot,
      sourcePath: fixture.candidatePath,
      mutate(value) {
        value.authoringRequestDigest = 'f'.repeat(64);
      },
    });
    const crossCandidateManifestPath = writeRedigestedCanonicalArtifact({
      repoRoot: fixture.repoRoot,
      sourcePath: manifestPath,
      mutate(value) {
        const visualContract = value.visualContract as {
          candidateDigest: string;
          candidatePath: string;
        };
        visualContract.candidatePath = crossCandidatePath;
        visualContract.candidateDigest = path.posix.basename(
          crossCandidatePath,
          '.json',
        );
      },
    });
    expect(() =>
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: crossCandidateManifestPath,
      }),
    ).toThrow(/Supervisor|cross-bound|candidate/i);

    const hardlinkPath = path.join(
      fixture.repoRoot,
      'outputs/bridge/candidate-template-projections/hardlink.json',
    );
    fs.linkSync(projectionAbsolute, hardlinkPath);
    expect(() =>
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath,
      }),
    ).toThrow(/unique regular file|filesystem identity/i);
    fs.unlinkSync(hardlinkPath);

    const collisionCandidate = JSON.parse(
      candidateBytes,
    ) as { templateDigest: string };
    const collisionPath = path.join(
      fixture.repoRoot,
      'outputs/collision-bridge/candidate-template-projections',
      `${collisionCandidate.templateDigest}.json`,
    );
    fs.mkdirSync(path.dirname(collisionPath), { recursive: true });
    fs.writeFileSync(
      collisionPath,
      canonicalContentAddressedJsonBytes({ collision: true }),
      'utf8',
    );
    expect(() =>
      prepareQaWizardCandidateReconciliation({
        ...prepareArgs(fixture, 'outputs/collision-bridge'),
        write: true,
      }),
    ).toThrow(/immutable|already exists|collision/i);
  }, 30_000);

  it('replays exact legacy v2 and v1 pending and approved manifests read-only without upgrading them', async () => {
    const fixture = await materializeCanonicalCandidate();
    const prepared = prepareQaWizardCandidateReconciliation({
      ...prepareArgs(fixture),
      write: true,
    });
    const legacyV2Pending = persistLegacyBridgeManifest({
      repoRoot: fixture.repoRoot,
      source: prepared.manifest,
      version: QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION,
    });
    expect(
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: legacyV2Pending.path,
      }),
    ).toEqual(legacyV2Pending.manifest);
    expect(() =>
      recordQaWizardReconciliationApproval({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/bridge',
        pendingManifestPath: legacyV2Pending.path,
        approvedReconciliationPath: 'outputs/missing/reconciliation.json',
        approvedReviewBundlePath: 'outputs/missing/review.json',
        approvedReviewMarkdownPath: 'outputs/missing/review.md',
        approvedBy: 'Guy',
        approvedAt: APPROVED_AT,
      }),
    ).toThrow(/read-only/i);
    const legacyTemplatePath = 'outputs/legacy-v1/template.json';
    const projectedTemplateBytes = fs.readFileSync(
      path.join(
        fixture.repoRoot,
        prepared.templateProjectionArtifact.path,
      ),
      'utf8',
    );
    writeText(
      fixture.repoRoot,
      legacyTemplatePath,
      projectedTemplateBytes,
    );
    const legacyPending = persistLegacyBridgeManifest({
      repoRoot: fixture.repoRoot,
      source: prepared.manifest,
      mutate(manifest) {
        manifest.visualContract.templatePath = legacyTemplatePath;
      },
    });
    expect(
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: legacyPending.path,
      }),
    ).toEqual(legacyPending.manifest);

    const legacyTemplateAbsolute = path.join(
      fixture.repoRoot,
      legacyTemplatePath,
    );
    fs.writeFileSync(
      legacyTemplateAbsolute,
      canonicalContentAddressedJsonBytes({ tampered: true }),
      'utf8',
    );
    expect(() =>
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: legacyPending.path,
      }),
    ).toThrow(/template|candidate|ready/i);
    fs.writeFileSync(
      legacyTemplateAbsolute,
      projectedTemplateBytes,
      'utf8',
    );

    expect(() =>
      persistQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/bridge',
        manifest: legacyPending.manifest,
        write: false,
      }),
    ).toThrow(/manifest is invalid/i);
    expect(() =>
      recordQaWizardReconciliationApproval({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/bridge',
        pendingManifestPath: legacyPending.path,
        approvedReconciliationPath: 'outputs/missing/reconciliation.json',
        approvedReviewBundlePath: 'outputs/missing/review.json',
        approvedReviewMarkdownPath: 'outputs/missing/review.md',
        approvedBy: 'Guy',
        approvedAt: APPROVED_AT,
      }),
    ).toThrow(/read-only/i);
    expect(() =>
      advanceQaWizardApprovedReconciliation({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/bridge',
        bridgeManifestPath: legacyPending.path,
        approvedReconciliationPath: 'outputs/missing/reconciliation.json',
        approvedReviewBundlePath: 'outputs/missing/review.json',
        approvedReviewMarkdownPath: 'outputs/missing/review.md',
        approvalAttestationPath: 'outputs/missing/approval.json',
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      }),
    ).toThrow(/read-only/i);

    const approved = buildApprovedArtifacts({ fixture, prepared });
    const approval = recordQaWizardReconciliationApproval({
      repoRoot: fixture.repoRoot,
      outputDir: 'outputs/bridge',
      pendingManifestPath: prepared.manifestArtifact.path,
      approvedReconciliationPath: approved.artifacts.reconciliationPath,
      approvedReviewBundlePath: approved.artifacts.reviewBundlePath,
      approvedReviewMarkdownPath: approved.artifacts.markdownPath,
      approvedBy: 'Guy',
      approvedAt: APPROVED_AT,
      write: true,
    });
    const advanced = advanceQaWizardApprovedReconciliation({
      repoRoot: fixture.repoRoot,
      outputDir: 'outputs/bridge',
      bridgeManifestPath: prepared.manifestArtifact.path,
      approvedReconciliationPath:
        approval.approvedReconciliationArtifacts.reconciliationPath,
      approvedReviewBundlePath:
        approval.approvedReconciliationArtifacts.reviewBundlePath,
      approvedReviewMarkdownPath:
        approval.approvedReconciliationArtifacts.markdownPath,
      approvalAttestationPath: approval.artifact.path,
      styleId: STYLE_ID,
      styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      write: true,
    });
    const legacyV2Approval = structuredClone(approval.attestation);
    legacyV2Approval.pendingManifestDigest = legacyV2Pending.manifest.digest;
    const {
      digestAlgorithm: _v2ApprovalDigestAlgorithm,
      digest: _v2ApprovalDigest,
      ...legacyV2ApprovalPayload
    } = legacyV2Approval;
    legacyV2Approval.digest = canonicalJsonDigest(legacyV2ApprovalPayload);
    const legacyV2ApprovalPath =
      `outputs/bridge/reconciliation-approvals/${legacyV2Approval.digest}.json`;
    writeText(
      fixture.repoRoot,
      legacyV2ApprovalPath,
      canonicalContentAddressedJsonBytes(legacyV2Approval),
    );
    const legacyV2Approved = persistLegacyBridgeManifest({
      repoRoot: fixture.repoRoot,
      source: advanced.manifest,
      version: QA_WIZARD_CANDIDATE_BRIDGE_LEGACY_MANIFEST_VERSION,
      mutate(manifest) {
        manifest.reconciliation.pendingManifestDigest =
          legacyV2Pending.manifest.digest;
        manifest.reconciliation.approvalAttestationDigest =
          legacyV2Approval.digest;
        manifest.reconciliation.approvalAttestationPath =
          legacyV2ApprovalPath;
      },
    });
    expect(
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: legacyV2Approved.path,
      }),
    ).toEqual(legacyV2Approved.manifest);
    const legacyApproval = structuredClone(approval.attestation);
    legacyApproval.pendingManifestDigest = legacyPending.manifest.digest;
    const {
      digestAlgorithm: _approvalDigestAlgorithm,
      digest: _approvalDigest,
      ...legacyApprovalPayload
    } = legacyApproval;
    legacyApproval.digest = canonicalJsonDigest(legacyApprovalPayload);
    const legacyApprovalPath =
      `outputs/bridge/reconciliation-approvals/${legacyApproval.digest}.json`;
    writeText(
      fixture.repoRoot,
      legacyApprovalPath,
      canonicalContentAddressedJsonBytes(legacyApproval),
    );
    const legacyContext = buildProductionAuthoringContext({
      repoRoot: fixture.repoRoot,
      storyKey: STORY_KEY,
      storyPath: fixture.storyPath,
      templatePath: legacyTemplatePath,
      reconciliationPath: advanced.manifest.reconciliation.path,
      candidatePath: fixture.candidatePath,
      styleId: STYLE_ID,
      styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
    });
    const legacyApproved = persistLegacyBridgeManifest({
      repoRoot: fixture.repoRoot,
      source: advanced.manifest,
      mutate(manifest) {
        manifest.visualContract.templatePath = legacyTemplatePath;
        manifest.reconciliation.pendingManifestDigest =
          legacyPending.manifest.digest;
        manifest.reconciliation.approvalAttestationDigest =
          legacyApproval.digest;
        manifest.reconciliation.approvalAttestationPath =
          legacyApprovalPath;
        manifest.productionContext!.digest = legacyContext.digest;
      },
    });
    expect(
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: legacyApproved.path,
      }),
    ).toEqual(legacyApproved.manifest);

    const legacyApprovalAbsolute = path.join(
      fixture.repoRoot,
      legacyApprovalPath,
    );
    const legacyApprovalBytes = fs.readFileSync(
      legacyApprovalAbsolute,
      'utf8',
    );
    const tamperedLegacyApproval = JSON.parse(
      legacyApprovalBytes,
    ) as Record<string, unknown>;
    tamperedLegacyApproval.approvedAt =
      '2026-08-17T08:00:01.000Z';
    fs.writeFileSync(
      legacyApprovalAbsolute,
      canonicalContentAddressedJsonBytes(tamperedLegacyApproval),
      'utf8',
    );
    expect(() =>
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: legacyApproved.path,
      }),
    ).toThrow(/approval attestation|tampered/i);
    fs.writeFileSync(
      legacyApprovalAbsolute,
      legacyApprovalBytes,
      'utf8',
    );
  }, 60_000);

  it('requires a separate exact Guy approval attestation and rejects tamper and replay', async () => {
    const fixture = await materializeCanonicalCandidate();
    const prepared = prepareQaWizardCandidateReconciliation({
      ...prepareArgs(fixture),
      write: true,
    });
    const approved = buildApprovedArtifacts({ fixture, prepared });

    expect(() =>
      advanceQaWizardApprovedReconciliation({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/bridge',
        bridgeManifestPath: prepared.manifestArtifact.path,
        approvedReconciliationPath: approved.artifacts.reconciliationPath,
        approvedReviewBundlePath: approved.artifacts.reviewBundlePath,
        approvedReviewMarkdownPath: approved.artifacts.markdownPath,
        approvalAttestationPath:
          'outputs/bridge/reconciliation-approvals/missing.json',
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      }),
    ).toThrow(/approval attestation is missing/i);

    const approval = recordQaWizardReconciliationApproval({
      repoRoot: fixture.repoRoot,
      outputDir: 'outputs/bridge',
      pendingManifestPath: prepared.manifestArtifact.path,
      approvedReconciliationPath: approved.artifacts.reconciliationPath,
      approvedReviewBundlePath: approved.artifacts.reviewBundlePath,
      approvedReviewMarkdownPath: approved.artifacts.markdownPath,
      approvedBy: 'Guy',
      approvedAt: APPROVED_AT,
      write: true,
    });
    expect(approval.attestation.authorityScope).toBe(
      'reconciliation_exact_content_approval_only',
    );
    expect(approval.attestation.doesNotAuthorize).toContain('wizard_render');

    const attestationAbsolute = path.join(
      fixture.repoRoot,
      approval.artifact.path,
    );
    const originalAttestation = fs.readFileSync(attestationAbsolute, 'utf8');
    const tamperedAttestation = JSON.parse(originalAttestation) as Record<
      string,
      unknown
    >;
    tamperedAttestation.approvedAt = '2026-08-17T08:00:01.000Z';
    fs.writeFileSync(
      attestationAbsolute,
      `${JSON.stringify(tamperedAttestation)}\n`,
      'utf8',
    );
    expect(() =>
      advanceQaWizardApprovedReconciliation({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/bridge',
        bridgeManifestPath: prepared.manifestArtifact.path,
        approvedReconciliationPath: approved.artifacts.reconciliationPath,
        approvedReviewBundlePath: approved.artifacts.reviewBundlePath,
        approvedReviewMarkdownPath: approved.artifacts.markdownPath,
        approvalAttestationPath: approval.artifact.path,
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      }),
    ).toThrow(/approval attestation/i);
    fs.writeFileSync(attestationAbsolute, originalAttestation, 'utf8');

    const arbitraryApprovedPath =
      'outputs/bridge/staging/approved-reconciliation-copy.json';
    fs.mkdirSync(
      path.dirname(path.join(fixture.repoRoot, arbitraryApprovedPath)),
      { recursive: true },
    );
    fs.copyFileSync(
      path.join(
        fixture.repoRoot,
        approval.approvedReconciliationArtifacts.reconciliationPath,
      ),
      path.join(fixture.repoRoot, arbitraryApprovedPath),
    );
    expect(() =>
      advanceQaWizardApprovedReconciliation({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/bridge',
        bridgeManifestPath: prepared.manifestArtifact.path,
        approvedReconciliationPath: arbitraryApprovedPath,
        approvedReviewBundlePath:
          approval.approvedReconciliationArtifacts.reviewBundlePath,
        approvedReviewMarkdownPath:
          approval.approvedReconciliationArtifacts.markdownPath,
        approvalAttestationPath: approval.artifact.path,
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      }),
    ).toThrow(/does not bind the exact approved content/i);

    const secondPrepared = prepareQaWizardCandidateReconciliation({
      ...prepareArgs(fixture, 'outputs/bridge-two'),
      write: true,
    });
    expect(() =>
      advanceQaWizardApprovedReconciliation({
        repoRoot: fixture.repoRoot,
        outputDir: 'outputs/bridge-two',
        bridgeManifestPath: secondPrepared.manifestArtifact.path,
        approvedReconciliationPath: approved.artifacts.reconciliationPath,
        approvedReviewBundlePath: approved.artifacts.reviewBundlePath,
        approvedReviewMarkdownPath: approved.artifacts.markdownPath,
        approvalAttestationPath: approval.artifact.path,
        styleId: STYLE_ID,
        styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      }),
    ).toThrow(/does not bind|exact approved content/i);

    const advanced = advanceQaWizardApprovedReconciliation({
      repoRoot: fixture.repoRoot,
      outputDir: 'outputs/bridge',
      bridgeManifestPath: prepared.manifestArtifact.path,
      approvedReconciliationPath:
        approval.approvedReconciliationArtifacts.reconciliationPath,
      approvedReviewBundlePath:
        approval.approvedReconciliationArtifacts.reviewBundlePath,
      approvedReviewMarkdownPath:
        approval.approvedReconciliationArtifacts.markdownPath,
      approvalAttestationPath: approval.artifact.path,
      styleId: STYLE_ID,
      styleAuthorityPath: STYLE01_PRODUCTION_STYLE_AUTHORITY_PATH,
      write: true,
    });
    expect(advanced.context.version).toBe('production-authoring-context/v3');
    expect(advanced.manifest).toMatchObject({
      stage: 'reconciliation_approved',
      reconciliation: {
        digest: canonicalJsonDigest(approved.approved),
        status: 'approved',
        reviewedBy: 'Guy',
        approvalAttestationVersion:
          'qa-wizard-reconciliation-approval-attestation/v1',
        approvalAttestationDigest: approval.attestation.digest,
        approvalAttestationPath: approval.artifact.path,
        pendingManifestDigest: prepared.manifest.digest,
      },
      productionContext: {
        version: 'production-authoring-context/v3',
        digest: advanced.context.digest,
        styleId: STYLE_ID,
      },
    });
    expect(qaWizardCandidateBridgeManifestIsValid(advanced.manifest)).toBe(true);
    expect(
      loadQaWizardCandidateBridgeManifest({
        repoRoot: fixture.repoRoot,
        manifestPath: advanced.manifestArtifact.path,
      }),
    ).toEqual(advanced.manifest);
  }, 25_000);
});
