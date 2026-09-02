import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';
import {
  humanVerifiedUnverifiedOperationKey,
  humanVerifiedUnverifiedPreparedOutcome,
  humanVerifiedUnverifiedRequestHash,
  humanVerificationSnapshotDigest,
  deliveredUrlHash,
  paymentSnapshotDigest,
  refundAuthorityDigest,
  resemblanceProofDigest,
  resemblanceProofsFromRows,
  type HumanVerifiedUnverifiedReleaseRequest,
} from '@/lib/generation-pipeline/human-verified-unverified-release';
import {
  commitBaseBookReadiness,
  type CommitResult,
} from '@/lib/generation-pipeline/readiness-manifest';
import {
  HUMAN_VERIFIED_UNVERIFIED_REVIEW_STATUS,
  HUMAN_VERIFIED_UNVERIFIED_VERSION,
  humanVerifiedUnverifiedQualityAuthorityDigest,
  parseHumanVerifiedUnverifiedAtomicReceiptResult,
  parseHumanVerifiedUnverifiedOutcome,
  parseHumanVerifiedUnverifiedReviewReason,
} from '@/lib/generation-pipeline/human-verified-unverified-contract';
import {
  QUALITY_EVALUATOR_CONTRACT_VERSION,
  coverArtifactKey,
  evaluateQualityGate,
  inspectHumanReviewAuthorityBytes,
  loadQualityEvidence,
  pageArtifactKey,
} from '@/lib/generation-pipeline/quality-evidence';
import {
  PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
} from '@/lib/generation-pipeline/page-child-resemblance-vision';

const ORDER_ID = 'cmtj2vvrw0002ju04a9covxqv';
const CASE_ID = '6be97a90-65a0-4883-b7d1-819317a1dc19';
const ACTION_ID = 'human-action-page-6';
const PAYMENT_ID = 'payment-existing-1';
const NOW = new Date('2026-09-02T12:00:00.000Z');
const MARKER = 'safety_hold:unverified:page:6';
const CASE_FINGERPRINT = 'a'.repeat(64);
const INSPECTION_DIGEST = 'b'.repeat(64);
const REFERENCE_URL = 'https://assets.example/lavi-approved-anchor.png';

type FailurePoint = 'outbox' | 'finalization' | null;

interface ImageAssetState {
  id: string;
  url: string;
  presentationUrl: string | null;
  safetyVerified: boolean;
  safetyHazards: string[];
  safetyContentSha256: string | null;
  safetyOverriddenHazards: string[];
  safetyOverrideSha256: string | null;
}

interface BookPageState {
  id: string;
  pageNumber: number;
  text: string;
  audioUrl: string | null;
  imageAsset: ImageAssetState;
}

interface GeneratedBookState {
  id: string;
  orderId: string;
  coverImageUrl: string;
  readUrl: string;
  pdfUrl: string | null;
  coverSafetyVerified: boolean;
  coverSafetyHazards: string[];
  coverSafetyContentSha256: string;
  coverSafetyOverriddenHazards: string[];
  coverSafetyOverrideSha256: string | null;
  pages: BookPageState[];
}

interface OrderState {
  id: string;
  fulfillmentVersion: number;
  inputVersion: number;
  deliveryFenceVersion: number;
  expectedPageCount: number;
  storySourceHash: string;
  selectionFilename: string;
  frozenProductVersion: string;
  visualPackageAuthority: null;
  illustrationStyle: string;
  customerEmail: string;
  customerName: string;
  childName: string;
  visualContractHash: null;
  status: string;
  packageStatus: string;
  deliveryHoldReason: string | null;
  manualReviewRequired: boolean;
  stripePaid: boolean;
  paymentProvider: string | null;
  paymentId: string | null;
  stripePaymentId: string;
  totalPrice: number;
}

interface QualityEvidenceState {
  id: string;
  orderId: string;
  artifactKey: string;
  assetSha256: string;
  verdict: string;
  evaluatorContractVersion: string;
  reason: string | null;
  regenCount: number;
  providerModel: string | null;
  contractHash: string | null;
  safetyOverride: boolean;
  safetyOverrideSha256: string | null;
  evidence: Prisma.JsonValue;
  evaluatedAt: Date;
  reviewStatus: string | null;
  reviewedAssetSha256: string | null;
  reviewedContractHash: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface HumanReviewCaseState {
  id: string;
  activeKey: string | null;
  orderId: string;
  scope: string;
  revision: number;
  kind: string;
  status: string;
  holdFingerprint: string;
  rawReason: string;
  inputVersion: number;
  contractHash: string | null;
  resolvedActor: string | null;
  resolvedAt: Date | null;
  decisionNote: string | null;
}

interface PaymentState {
  id: string;
  orderId: string;
  provider: string;
  amount: number;
  currency: string;
  paid: boolean;
  paidAt: Date | null;
}

interface OperatorActionState {
  id: string;
  idempotencyKey: string;
  requestHash: string;
  orderId: string;
  caseId: string;
  caseRevision: number;
  kind: string;
  status: string;
  actor: string;
  targetArtifacts: string[];
  observedMarker: string;
  observedFence: number;
  observedInputVersion: number;
  overriddenHazards: string[];
  overrideReason: string;
  assetSha256: string;
  outcome: unknown;
}

interface AtomicReceiptState {
  id: string;
  operationKey: string;
  orderId: string;
  kind: string;
  payloadHash: string;
  result: unknown;
  createdAt: Date;
}

interface HarnessState {
  orders: OrderState[];
  payments: PaymentState[];
  books: GeneratedBookState[];
  qualityEvidence: QualityEvidenceState[];
  humanReviewCases: HumanReviewCaseState[];
  operatorActions: OperatorActionState[];
  operatorNotificationOutbox: Array<{
    id: string;
    caseId: string;
    status: string;
    sendAttempted: boolean;
  }>;
  exceptionCases: Array<Record<string, unknown>>;
  generationJobs: Array<{
    orderId: string;
    pipelineCache: Record<string, unknown>;
    status: string;
    currentStage: string;
    completedAt: Date | null;
    packaged: boolean;
  }>;
  manifests: Array<Record<string, unknown>>;
  readiness: Array<Record<string, unknown>>;
  deliveryOutbox: Array<Record<string, unknown>>;
  receipts: AtomicReceiptState[];
}

interface MutationMetrics {
  qualityReviewWrites: number;
  humanMarkerTransitions: number;
  caseResolutions: number;
  manifestCreates: number;
  outboxCreates: number;
  shipTransitions: number;
  actionFinalizations: number;
  receiptBusinessCompletions: number;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function shaOf(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function inspectExistingAsset(
  url: string | null | undefined,
): Promise<AssetInspection> {
  const value = (url ?? '').trim();
  if (!value) {
    return Promise.resolve({
      ok: false,
      bytes: 0,
      format: null,
      mime: null,
      width: null,
      height: null,
      sha256: null,
      error: 'url_not_allowlisted',
    });
  }
  return Promise.resolve({
    ok: true,
    bytes: 4096,
    format: 'png',
    mime: 'image/png',
    width: 1024,
    height: 1024,
    sha256: shaOf(value),
  });
}

function initialFixture(): {
  state: HarnessState;
  request: HumanVerifiedUnverifiedReleaseRequest;
} {
  const anchor = {
    orderId: ORDER_ID,
    styleId: 'pencil_watercolor',
    characterId: 'child',
    role: 'child',
    anchorType: 'canonical_portrait',
    source: 'uploaded_photo',
    url: REFERENCE_URL,
    qaStatus: 'passed',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
  const pages: BookPageState[] = Array.from({ length: 6 }, (_, index) => {
    const pageNumber = index + 1;
    const url = `https://assets.example/existing-page-${pageNumber}.png`;
    return {
      id: `book-page-${pageNumber}`,
      pageNumber,
      text: `טקסט קיים בעמוד ${pageNumber}`,
      audioUrl: pageNumber === 1
        ? 'https://assets.example/existing-audio-1.mp3'
        : null,
      imageAsset: {
        id: `asset-page-${pageNumber}`,
        url,
        presentationUrl: null,
        safetyVerified: pageNumber !== 6,
        safetyHazards: [],
        safetyContentSha256: shaOf(url),
        safetyOverriddenHazards: [],
        safetyOverrideSha256: null,
      },
    };
  });
  const coverUrl = 'https://assets.example/existing-cover.png';
  const book: GeneratedBookState = {
    id: 'book-existing-1',
    orderId: ORDER_ID,
    coverImageUrl: coverUrl,
    readUrl: `https://app.example.com/ready?orderId=${ORDER_ID}`,
    pdfUrl: 'https://assets.example/existing-book.pdf',
    coverSafetyVerified: true,
    coverSafetyHazards: [],
    coverSafetyContentSha256: shaOf(coverUrl),
    coverSafetyOverriddenHazards: [],
    coverSafetyOverrideSha256: null,
    pages,
  };
  const order: OrderState = {
    id: ORDER_ID,
    fulfillmentVersion: 1,
    inputVersion: 9,
    deliveryFenceVersion: 4,
    expectedPageCount: 6,
    storySourceHash: 'existing-story-source-hash',
    selectionFilename: 'bedtime/lavi-existing.md',
    frozenProductVersion: 'story-product/v1',
    visualPackageAuthority: null,
    illustrationStyle: 'pencil_watercolor',
    customerEmail: 'existing-customer@example.com',
    customerName: 'Existing Customer',
    childName: 'לביא',
    visualContractHash: null,
    status: 'needs_human_qa',
    packageStatus: 'done',
    deliveryHoldReason: MARKER,
    manualReviewRequired: false,
    stripePaid: true,
    paymentProvider: 'stripe',
    paymentId: PAYMENT_ID,
    stripePaymentId: 'pi_existing_1',
    totalPrice: 79,
  };
  const payment: PaymentState = {
    id: PAYMENT_ID,
    orderId: ORDER_ID,
    provider: 'stripe',
    amount: 79,
    currency: 'ILS',
    paid: true,
    paidAt: new Date('2026-09-01T10:00:00.000Z'),
  };
  const reviewCase: HumanReviewCaseState = {
    id: CASE_ID,
    activeKey: `${ORDER_ID}:base_book`,
    orderId: ORDER_ID,
    scope: 'base_book',
    revision: 3,
    kind: 'safety',
    status: 'open',
    holdFingerprint: CASE_FINGERPRINT,
    rawReason: MARKER,
    inputVersion: order.inputVersion,
    contractHash: null,
    resolvedActor: null,
    resolvedAt: null,
    decisionNote: null,
  };
  const qualityEvidence: QualityEvidenceState[] = [
    {
      id: 'quality-cover',
      orderId: ORDER_ID,
      artifactKey: 'cover',
      assetSha256: shaOf(coverUrl),
      verdict: 'passed',
      evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      reason: null,
      regenCount: 0,
      providerModel: 'existing-quality-evaluator',
      contractHash: null,
      safetyOverride: false,
      safetyOverrideSha256: null,
      evidence: {},
      evaluatedAt: new Date('2026-09-02T08:00:00.000Z'),
      reviewStatus: null,
      reviewedAssetSha256: null,
      reviewedContractHash: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
      createdAt: new Date('2026-09-02T07:59:00.000Z'),
      updatedAt: new Date('2026-09-02T08:00:00.000Z'),
    },
    ...pages.map((page): QualityEvidenceState => {
      const target = page.pageNumber === 6;
      const requiredSibling = page.pageNumber === 2;
      const requiresResemblance = target || requiredSibling;
      return {
        id: `quality-page-${page.pageNumber}`,
        orderId: ORDER_ID,
        artifactKey: `page:${page.pageNumber}`,
        assetSha256: page.imageAsset.safetyContentSha256!,
        verdict: target ? 'evidence_unknown' : 'passed',
        evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
        reason: target ? 'safety:unverified+vision_malformed' : null,
        regenCount: target ? 2 : 0,
        providerModel: target ? 'existing-vision-evaluator' : 'existing-quality-evaluator',
        contractHash: null,
        safetyOverride: false,
        safetyOverrideSha256: null,
        evidence: requiresResemblance
          ? {
              qaContext: { expectsChild: true },
              pageResemblanceGate: {
                required: true,
                status: 'passed',
                evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
                resemblanceScore: target
                  ? PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD
                  : 0.82,
                threshold: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
                subjectVisible: true,
                sameChild: true,
                deliveredBytesSha256: page.imageAsset.safetyContentSha256,
                referenceBytesSha256: shaOf(REFERENCE_URL),
                referenceImageUrl: REFERENCE_URL,
                source: 'raw_same_bytes',
              },
            }
          : { qaContext: { expectsChild: false } },
        evaluatedAt: new Date('2026-09-02T08:00:00.000Z'),
        reviewStatus: null,
        reviewedAssetSha256: null,
        reviewedContractHash: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewReason: null,
        createdAt: new Date('2026-09-02T07:59:00.000Z'),
        updatedAt: new Date('2026-09-02T08:00:00.000Z'),
      };
    }),
  ];
  const targetPage = pages[5];
  const targetEvidence = qualityEvidence.find(
    (row) => row.artifactKey === 'page:6',
  )!;
  const requiredResemblanceArtifacts = ['page:2', 'page:6'];
  const resemblanceArtifactBindings = new Map(
    [pages[1], targetPage].map((page) => [
      `page:${page.pageNumber}`,
      {
        assetId: page.imageAsset.id,
        deliveredUrl:
          page.imageAsset.presentationUrl ?? page.imageAsset.url,
      },
    ]),
  );
  const proofDigest = resemblanceProofDigest(
    qualityEvidence,
    requiredResemblanceArtifacts,
    resemblanceArtifactBindings,
  );
  if (!proofDigest) throw new Error('fixture_resemblance_proof_missing');
  const resemblanceProofs = resemblanceProofsFromRows(
    qualityEvidence,
    requiredResemblanceArtifacts,
    resemblanceArtifactBindings,
  );
  if (!resemblanceProofs) throw new Error('fixture_resemblance_proofs_missing');
  const snapshotDigest = humanVerificationSnapshotDigest({
    order,
    reviewCase,
    target: {
      pageId: targetPage.id,
      pageNumber: targetPage.pageNumber,
      assetId: targetPage.imageAsset.id,
      url: targetPage.imageAsset.url,
      presentationUrl: targetPage.imageAsset.presentationUrl,
      safetyVerified: targetPage.imageAsset.safetyVerified,
      safetyHazards: targetPage.imageAsset.safetyHazards,
      safetyContentSha256: targetPage.imageAsset.safetyContentSha256,
      safetyOverriddenHazards:
        targetPage.imageAsset.safetyOverriddenHazards,
      safetyOverrideSha256: targetPage.imageAsset.safetyOverrideSha256,
    },
    evidence: targetEvidence,
  });
  const paymentDigest = paymentSnapshotDigest({
    order,
    payment,
    paymentCaseActive: false,
    refundAuthorityDigest: refundAuthorityDigest({
      exceptionCases: [],
      refundAttempts: [],
    }),
  });
  const request: HumanVerifiedUnverifiedReleaseRequest = {
    inspectionDigest: INSPECTION_DIGEST,
    artifactKey: 'page:6',
    expectedMarker: MARKER,
    expectedCaseId: CASE_ID,
    expectedCaseRevision: reviewCase.revision,
    expectedCaseFingerprint: CASE_FINGERPRINT,
    expectedAssetId: targetPage.imageAsset.id,
    expectedAssetSha256: targetPage.imageAsset.safetyContentSha256!,
    expectedDeliveredUrlHash: deliveredUrlHash(targetPage.imageAsset.url),
    expectedAnchorEntryDigest: canonicalHash(anchor),
    expectedAnchorUrlHash: canonicalHash(anchor.url),
    expectedAnchorBytesSha256: shaOf(anchor.url),
    expectedContractHash: null,
    expectedEvaluatorVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
    snapshotDigest,
    refundAuthorityDigest: refundAuthorityDigest({
      exceptionCases: [],
      refundAttempts: [],
    }),
    paymentSnapshotDigest: paymentDigest,
    resemblanceProofDigest: proofDigest,
    resemblanceProofs,
    requiredResemblanceArtifacts,
    reviewReason:
      'Human reviewed the exact stored bytes and verified the page as safe.',
    actor: 'operator@example.com',
    idempotencyKey: 'existing-order-page-6-human-review-v1',
  };
  const operationKey = humanVerifiedUnverifiedOperationKey(
    ORDER_ID,
    request.idempotencyKey,
  );
  const action: OperatorActionState = {
    id: ACTION_ID,
    idempotencyKey: operationKey,
    requestHash: humanVerifiedUnverifiedRequestHash(ORDER_ID, request),
    orderId: ORDER_ID,
    caseId: CASE_ID,
    caseRevision: reviewCase.revision,
    kind: 'release',
    status: 'pending',
    actor: request.actor,
    targetArtifacts: [request.artifactKey],
    observedMarker: request.expectedMarker,
    observedFence: order.deliveryFenceVersion,
    observedInputVersion: order.inputVersion,
    overriddenHazards: [],
    overrideReason: request.reviewReason,
    assetSha256: request.expectedAssetSha256,
    outcome: humanVerifiedUnverifiedPreparedOutcome(request),
  };
  return {
    request,
    state: {
      orders: [order],
      payments: [payment],
      books: [book],
      qualityEvidence,
      humanReviewCases: [reviewCase],
      operatorActions: [action],
      operatorNotificationOutbox: [
        {
          id: 'operator-notification-existing-1',
          caseId: CASE_ID,
          status: 'pending',
          sendAttempted: false,
        },
      ],
      exceptionCases: [],
      generationJobs: [
        {
          orderId: ORDER_ID,
          pipelineCache: {
            characterAnchorStore: { child: anchor },
          },
          status: 'running',
          currentStage: 'package',
          completedAt: null,
          packaged: true,
        },
      ],
      manifests: [],
      readiness: [],
      deliveryOutbox: [],
      receipts: [],
    },
  };
}

function recordOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('expected_record');
  }
  return value as Record<string, unknown>;
}

function queryShape(args: unknown[]): { text: string; values: unknown[] } {
  const strings = args[0];
  if (!Array.isArray(strings)) throw new Error('expected_tagged_sql');
  return { text: strings.join(' '), values: args.slice(1) };
}

function matchesFlat(
  row: object,
  where: Record<string, unknown>,
): boolean {
  const candidate = row as Record<string, unknown>;
  return Object.entries(where).every(([key, value]) => candidate[key] === value);
}

function statefulPrisma(initial: HarnessState) {
  let committed = clone(initial);
  let failurePoint: FailurePoint = null;
  const metrics: MutationMetrics = {
    qualityReviewWrites: 0,
    humanMarkerTransitions: 0,
    caseResolutions: 0,
    manifestCreates: 0,
    outboxCreates: 0,
    shipTransitions: 0,
    actionFinalizations: 0,
    receiptBusinessCompletions: 0,
  };

  function commitOrderRow(state: HarnessState, orderId: string) {
    const order = state.orders.find((entry) => entry.id === orderId);
    const book = state.books.find((entry) => entry.orderId === orderId);
    const job = state.generationJobs.find((entry) => entry.orderId === orderId);
    if (!order || !book) return null;
    return {
      ...clone(order),
      generationJob: job
        ? { pipelineCache: clone(job.pipelineCache) }
        : null,
      book: {
        coverImageUrl: book.coverImageUrl,
        readUrl: book.readUrl,
        pdfUrl: book.pdfUrl,
        pages: book.pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
          audioUrl: page.audioUrl,
          imageAsset: {
            url: page.imageAsset.url,
            presentationUrl: page.imageAsset.presentationUrl,
          },
        })),
      },
    };
  }

  function clientFor(state: HarnessState) {
    const client = {
      order: {
        findUnique: async (args: { where: { id: string } }) =>
          commitOrderRow(state, args.where.id),
      },
      qualityEvidence: {
        findMany: async (args: { where: { orderId: string } }) =>
          clone(
            state.qualityEvidence.filter(
              (row) => row.orderId === args.where.orderId,
            ),
          ),
        updateMany: async (args: {
          where: Record<string, unknown>;
          data: Partial<QualityEvidenceState>;
        }) => {
          const row = state.qualityEvidence.find((entry) =>
            matchesFlat(entry, args.where),
          );
          if (!row) return { count: 0 };
          Object.assign(row, clone(args.data));
          row.updatedAt = NOW;
          metrics.qualityReviewWrites += 1;
          return { count: 1 };
        },
        findUnique: async (args: {
          where: {
            orderId_artifactKey: { orderId: string; artifactKey: string };
          };
        }) => {
          const key = args.where.orderId_artifactKey;
          const row = state.qualityEvidence.find(
            (entry) =>
              entry.orderId === key.orderId &&
              entry.artifactKey === key.artifactKey,
          );
          return row ? clone(row) : null;
        },
      },
      bookPage: {
        findFirst: async (args: {
          where: { book: { orderId: string }; pageNumber: number };
        }) => {
          const book = state.books.find(
            (entry) => entry.orderId === args.where.book.orderId,
          );
          const page = book?.pages.find(
            (entry) => entry.pageNumber === args.where.pageNumber,
          );
          return page ? clone(page) : null;
        },
        findMany: async (args: {
          where: {
            book: { orderId: string };
            pageNumber: { in: number[] };
          };
        }) => {
          const book = state.books.find(
            (entry) => entry.orderId === args.where.book.orderId,
          );
          return clone(
            (book?.pages ?? [])
              .filter((page) =>
                args.where.pageNumber.in.includes(page.pageNumber),
              )
              .map((page) => ({
                pageNumber: page.pageNumber,
                imageAsset: {
                  id: page.imageAsset.id,
                  url: page.imageAsset.url,
                  presentationUrl: page.imageAsset.presentationUrl,
                  safetyVerified: page.imageAsset.safetyVerified,
                  safetyHazards: page.imageAsset.safetyHazards,
                  safetyContentSha256: page.imageAsset.safetyContentSha256,
                  safetyOverriddenHazards:
                    page.imageAsset.safetyOverriddenHazards,
                  safetyOverrideSha256:
                    page.imageAsset.safetyOverrideSha256,
                },
              })),
          );
        },
      },
      generatedBook: {
        findUnique: async (args: { where: { orderId: string } }) => {
          const book = state.books.find(
            (entry) => entry.orderId === args.where.orderId,
          );
          if (!book) return null;
          return clone({
            coverImageUrl: book.coverImageUrl,
            coverSafetyVerified: book.coverSafetyVerified,
            coverSafetyHazards: book.coverSafetyHazards,
            coverSafetyContentSha256: book.coverSafetyContentSha256,
            coverSafetyOverriddenHazards:
              book.coverSafetyOverriddenHazards,
            coverSafetyOverrideSha256: book.coverSafetyOverrideSha256,
            pages: book.pages.map((page) => ({
              pageNumber: page.pageNumber,
              imageAsset: {
                safetyVerified: page.imageAsset.safetyVerified,
                safetyHazards: page.imageAsset.safetyHazards,
                safetyContentSha256: page.imageAsset.safetyContentSha256,
                safetyOverriddenHazards:
                  page.imageAsset.safetyOverriddenHazards,
                safetyOverrideSha256:
                  page.imageAsset.safetyOverrideSha256,
              },
            })),
          });
        },
      },
      generationJob: {
        findUnique: async (args: { where: { orderId: string } }) => {
          const job = state.generationJobs.find(
            (entry) => entry.orderId === args.where.orderId,
          );
          return job ? clone(job) : null;
        },
        update: async (args: {
          where: { orderId: string };
          data: Record<string, unknown>;
        }) => {
          const job = state.generationJobs.find(
            (entry) => entry.orderId === args.where.orderId,
          );
          if (!job) throw new Error('generation_job_missing');
          Object.assign(job, clone(args.data));
          return clone(job);
        },
      },
      paymentRecord: {
        findUnique: async (args: { where: { orderId: string } }) => {
          const payment = state.payments.find(
            (entry) => entry.orderId === args.where.orderId,
          );
          return payment ? clone(payment) : null;
        },
      },
      humanQaReviewCase: {
        findUnique: async (args: { where: { activeKey: string } }) => {
          const reviewCase = state.humanReviewCases.find(
            (entry) => entry.activeKey === args.where.activeKey,
          );
          return reviewCase ? clone(reviewCase) : null;
        },
        findMany: async (args: { where: { id: { in: string[] } } }) =>
          clone(
            state.humanReviewCases.filter((entry) =>
              args.where.id.in.includes(entry.id),
            ),
          ),
        update: async (args: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const reviewCase = state.humanReviewCases.find(
            (entry) => entry.id === args.where.id,
          );
          if (!reviewCase) throw new Error('human_review_case_missing');
          Object.assign(reviewCase, clone(args.data));
          metrics.caseResolutions += 1;
          return clone(reviewCase);
        },
      },
      operatorNotificationOutbox: {
        findFirst: async (args: { where: { caseId: string } }) => {
          const row = state.operatorNotificationOutbox.find(
            (entry) => entry.caseId === args.where.caseId,
          );
          return row ? clone(row) : null;
        },
        update: async (args: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = state.operatorNotificationOutbox.find(
            (entry) => entry.id === args.where.id,
          );
          if (!row) throw new Error('operator_notification_missing');
          Object.assign(row, clone(args.data));
          return clone(row);
        },
      },
      exceptionCase: {
        findUnique: async (args: { where: { activeKey: string } }) => {
          const row = state.exceptionCases.find(
            (entry) => entry.activeKey === args.where.activeKey,
          );
          return row ? clone(row) : null;
        },
        findMany: async (args: { where: { orderId: string } }) =>
          clone(
            state.exceptionCases.filter(
              (entry) => entry.orderId === args.where.orderId,
            ),
          ),
      },
      refundAttempt: {
        findMany: async () => [],
      },
      humanQaOperatorAction: {
        findUnique: async (args: {
          where: { idempotencyKey?: string; id?: string };
        }) => {
          const row = state.operatorActions.find((entry) =>
            args.where.idempotencyKey
              ? entry.idempotencyKey === args.where.idempotencyKey
              : entry.id === args.where.id,
          );
          return row ? clone(row) : null;
        },
        findMany: async (args: { where: { id: { in: string[] } } }) =>
          clone(
            state.operatorActions.filter((entry) =>
              args.where.id.in.includes(entry.id),
            ),
          ),
        updateMany: async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          if (args.data.status === 'succeeded' && failurePoint === 'finalization') {
            throw new Error('injected_finalization_failure');
          }
          const row = state.operatorActions.find((entry) =>
            matchesFlat(entry, args.where),
          );
          if (!row) return { count: 0 };
          Object.assign(row, clone(args.data));
          if (args.data.status === 'succeeded') {
            metrics.actionFinalizations += 1;
          }
          return { count: 1 };
        },
      },
      bookReadinessManifest: {
        findFirst: async (args: { where: { orderId: string; scope: string } }) => {
          const rows = state.manifests
            .filter(
              (entry) =>
                entry.orderId === args.where.orderId &&
                entry.scope === args.where.scope,
            )
            .sort(
              (left, right) =>
                Number(right.revision ?? 0) - Number(left.revision ?? 0),
            );
          return rows[0] ? clone(rows[0]) : null;
        },
        create: async (args: { data: Record<string, unknown> }) => {
          const row = {
            id: `manifest-${state.manifests.length + 1}`,
            ...clone(args.data),
          };
          state.manifests.push(row);
          metrics.manifestCreates += 1;
          return clone(row);
        },
      },
      bookReadiness: {
        upsert: async (args: {
          where: { orderId_scope: { orderId: string; scope: string } };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          const key = args.where.orderId_scope;
          const existing = state.readiness.find(
            (entry) =>
              entry.orderId === key.orderId && entry.scope === key.scope,
          );
          if (existing) Object.assign(existing, clone(args.update));
          else state.readiness.push(clone(args.create));
          return clone(existing ?? args.create);
        },
        updateMany: async () => ({ count: 0 }),
      },
      deliveryOutbox: {
        findUnique: async (args: { where: { dedupeKey: string } }) => {
          const row = state.deliveryOutbox.find(
            (entry) => entry.dedupeKey === args.where.dedupeKey,
          );
          return row ? clone(row) : null;
        },
        create: async (args: { data: Record<string, unknown> }) => {
          if (failurePoint === 'outbox') {
            throw new Error('injected_outbox_failure');
          }
          const row = {
            id: `outbox-${state.deliveryOutbox.length + 1}`,
            sendAttempted: false,
            attempts: 0,
            ...clone(args.data),
          };
          state.deliveryOutbox.push(row);
          metrics.outboxCreates += 1;
          return clone(row);
        },
        updateMany: async () => ({ count: 0 }),
      },
      atomicOperationReceipt: {
        findUnique: async (args: { where: { operationKey: string } }) => {
          const row = state.receipts.find(
            (entry) => entry.operationKey === args.where.operationKey,
          );
          return row ? clone(row) : null;
        },
        findMany: async (args: {
          where: { operationKey: { in: string[] } };
        }) =>
          clone(
            state.receipts.filter((entry) =>
              args.where.operationKey.in.includes(entry.operationKey),
            ),
          ),
        update: async (args: {
          where: { operationKey: string };
          data: { result: unknown };
        }) => {
          const row = state.receipts.find(
            (entry) => entry.operationKey === args.where.operationKey,
          );
          if (!row) throw new Error('atomic_receipt_missing');
          row.result = clone(args.data.result);
          metrics.receiptBusinessCompletions += 1;
          return clone(row);
        },
      },
      $queryRaw: async (...queryArgs: unknown[]) => {
        const query = queryShape(queryArgs);
        if (query.text.includes('INSERT INTO "AtomicOperationReceipt"')) {
          const [id, operationKey, orderId, kind, payloadHash] = query.values;
          const existing = state.receipts.find(
            (entry) => entry.operationKey === operationKey,
          );
          if (existing) return [];
          state.receipts.push({
            id: String(id),
            operationKey: String(operationKey),
            orderId: String(orderId),
            kind: String(kind),
            payloadHash: String(payloadHash),
            result: {},
            createdAt: NOW,
          });
          return [{ id: String(id) }];
        }
        if (query.text.includes('SELECT "id" FROM "Order"')) {
          const orderId = String(query.values[0]);
          return state.orders.some((entry) => entry.id === orderId)
            ? [{ id: orderId }]
            : [];
        }
        if (
          query.text.includes('SELECT "pipelineCache"') &&
          query.text.includes('FROM "GenerationJob"')
        ) {
          const orderId = String(query.values[0]);
          const job = state.generationJobs.find(
            (entry) => entry.orderId === orderId,
          );
          return job ? [{ pipelineCache: clone(job.pipelineCache) }] : [];
        }
        if (
          query.text.includes('FROM "Order"') &&
          query.text.includes('"deliveryHoldReason"')
        ) {
          const orderId = String(query.values[0]);
          const order = state.orders.find((entry) => entry.id === orderId);
          return order ? [clone(order)] : [];
        }
        if (
          query.text.includes('FROM "HumanQaReviewCase"') &&
          query.text.includes('"holdFingerprint"')
        ) {
          const activeKey = String(query.values[0]);
          const reviewCase = state.humanReviewCases.find(
            (entry) => entry.activeKey === activeKey,
          );
          return reviewCase ? [clone(reviewCase)] : [];
        }
        if (query.text.includes('FROM "QualityEvidence"')) {
          const orderId = String(query.values[0]);
          return clone(
            state.qualityEvidence
              .filter((entry) => entry.orderId === orderId)
              .sort((left, right) =>
                left.artifactKey.localeCompare(right.artifactKey),
              ),
          );
        }
        throw new Error(`unhandled_query_raw:${query.text}`);
      },
      $executeRaw: async (...queryArgs: unknown[]) => {
        const query = queryShape(queryArgs);
        if (
          query.text.includes('UPDATE "Order"') &&
          query.text.includes('SET "deliveryHoldReason" =') &&
          !query.text.includes('SET "status" =')
        ) {
          const [releasedMarker, orderId, expectedMarker, expectedInputVersion, observedFence] =
            query.values;
          const order = state.orders.find((entry) => entry.id === orderId);
          const paymentCaseOpen = state.humanReviewCases.some(
            (entry) =>
              entry.activeKey === `${orderId}:payment` &&
              entry.status === 'open',
          );
          if (
            !order ||
            order.status !== 'needs_human_qa' ||
            order.deliveryHoldReason !== expectedMarker ||
            order.inputVersion !== expectedInputVersion ||
            order.deliveryFenceVersion !== observedFence ||
            order.manualReviewRequired ||
            paymentCaseOpen
          ) return 0;
          order.deliveryHoldReason = String(releasedMarker);
          order.deliveryFenceVersion += 1;
          metrics.humanMarkerTransitions += 1;
          return 1;
        }
        if (
          query.text.includes('UPDATE "Order"') &&
          query.text.includes('SET "status" =') &&
          query.text.includes("'ready'::\"OrderStatus\"")
        ) {
          const [deliveryHoldReason, orderId, inputVersion, deliveryFenceVersion] =
            query.values;
          const order = state.orders.find((entry) => entry.id === orderId);
          const activeStrongCase = state.humanReviewCases.some(
            (entry) =>
              (entry.activeKey === `${orderId}:base_book` ||
                entry.activeKey === `${orderId}:payment`) &&
              entry.status === 'open' &&
              ['safety', 'contract_world', 'payment_integrity'].includes(
                entry.kind,
              ),
          );
          if (
            !order ||
            order.inputVersion !== inputVersion ||
            order.deliveryFenceVersion !== deliveryFenceVersion ||
            order.manualReviewRequired ||
            order.status === 'ready' ||
            order.status === 'partial' ||
            activeStrongCase
          ) return 0;
          order.status = 'ready';
          order.packageStatus = 'done';
          order.deliveryHoldReason = deliveryHoldReason as string | null;
          metrics.shipTransitions += 1;
          return 1;
        }
        throw new Error(`unhandled_execute_raw:${query.text}`);
      },
    };
    return client;
  }

  const outer = clientFor(committed) as ReturnType<typeof clientFor> & {
    $transaction: (
      callback: (tx: ReturnType<typeof clientFor>) => Promise<unknown>,
      options?: unknown,
    ) => Promise<unknown>;
  };
  outer.$transaction = async (callback) => {
    const working = clone(committed);
    const tx = clientFor(working);
    const result = await callback(tx);
    // Keep the outer-client delegates attached to one object identity while publishing the
    // transaction's entire cloned state at commit. A throw skips this assignment, which is the
    // rollback boundary; a later public call therefore reads the newly committed rows, not the
    // fixture snapshot that existed when the fake client was constructed.
    Object.assign(committed, working);
    return result;
  };

  return {
    prisma: outer,
    snapshot: () => clone(committed),
    mutateCommitted: (mutate: (state: HarnessState) => void) => {
      mutate(committed);
    },
    metrics: () => clone(metrics),
    setFailure: (value: FailurePoint) => {
      failurePoint = value;
    },
  };
}

function targetEvidence(state: HarnessState): QualityEvidenceState {
  return state.qualityEvidence.find(
    (row) => row.artifactKey === 'page:6',
  )!;
}

function targetAsset(state: HarnessState): ImageAssetState {
  return state.books[0].pages.find((page) => page.pageNumber === 6)!
    .imageAsset;
}

function pageAsset(state: HarnessState, pageNumber: number): ImageAssetState {
  return state.books[0].pages.find((page) => page.pageNumber === pageNumber)!
    .imageAsset;
}

function qualityEvidenceFor(
  state: HarnessState,
  artifactKey: string,
): QualityEvidenceState {
  return state.qualityEvidence.find(
    (row) => row.artifactKey === artifactKey,
  )!;
}

type AuthorityByteInspect = (
  url: string | null | undefined,
) => Promise<{ sha256: string | null }>;

async function loadCurrentPublicHumanReviewGate(
  harness: ReturnType<typeof statefulPrisma>,
  inspect: AuthorityByteInspect = inspectExistingAsset,
) {
  const byteAuthority = await inspectHumanReviewAuthorityBytes(
    harness.prisma as never,
    ORDER_ID,
    inspect,
  );
  const rows = await loadQualityEvidence(
    harness.prisma as never,
    ORDER_ID,
    byteAuthority,
  );
  const state = harness.snapshot();
  const book = state.books[0];
  const currentHashes = new Map<string, string | null>();
  currentHashes.set(
    coverArtifactKey(),
    (await inspect(book.coverImageUrl)).sha256,
  );
  for (const page of book.pages) {
    currentHashes.set(
      pageArtifactKey(page.pageNumber),
      (await inspect(
        page.imageAsset.presentationUrl ?? page.imageAsset.url,
      )).sha256,
    );
  }
  const requiredKeys = [
    coverArtifactKey(),
    ...book.pages.map((page) => pageArtifactKey(page.pageNumber)),
  ];
  return {
    rows,
    gate: evaluateQualityGate(requiredKeys, rows, currentHashes, {
      activeContractHash: state.orders[0].visualContractHash,
    }),
  };
}

function humanReviewProjection(
  rows: Awaited<ReturnType<typeof loadQualityEvidence>>,
) {
  return rows.find((row) => row.artifactKey === 'page:6')!;
}

function assertCommittedHumanRelease(
  before: HarnessState,
  after: HarnessState,
  request: HumanVerifiedUnverifiedReleaseRequest,
): void {
  expect(after.orders).toHaveLength(before.orders.length);
  expect(after.orders.map((order) => order.id)).toEqual(
    before.orders.map((order) => order.id),
  );
  expect(after.payments).toHaveLength(before.payments.length);
  expect(after.payments).toEqual(before.payments);
  expect(after.orders[0]).toMatchObject({
    id: ORDER_ID,
    paymentId: PAYMENT_ID,
    stripePaymentId: before.orders[0].stripePaymentId,
    status: 'ready',
    deliveryHoldReason: null,
    deliveryFenceVersion: before.orders[0].deliveryFenceVersion + 1,
  });

  const action = after.operatorActions.find((entry) => entry.id === ACTION_ID)!;
  expect(action.status).toBe('succeeded');
  expect(action.requestHash).toBe(
    humanVerifiedUnverifiedRequestHash(ORDER_ID, request),
  );
  expect(recordOf(action.outcome)).toMatchObject({
    version: HUMAN_VERIFIED_UNVERIFIED_VERSION,
    decision: 'human_verified_safe',
    orderId: ORDER_ID,
    actionId: ACTION_ID,
    caseId: CASE_ID,
    caseRevision: 3,
    artifactKey: 'page:6',
    assetSha256: request.expectedAssetSha256,
    resemblanceProofDigest: request.resemblanceProofDigest,
    result: {
      manifestStatus: 'passed',
      orderStatus: 'ready',
      enqueued: true,
      revision: 1,
    },
  });
  const strictOutcome = parseHumanVerifiedUnverifiedOutcome(action.outcome);
  if (!strictOutcome) throw new Error('strict_action_outcome_missing');
  expect(strictOutcome).toMatchObject({
    requestHash: humanVerifiedUnverifiedRequestHash(ORDER_ID, request),
    receiptOperationKey: humanVerifiedUnverifiedOperationKey(
      ORDER_ID,
      request.idempotencyKey,
    ),
    refundAuthorityDigest: request.refundAuthorityDigest,
    observedFence: before.orders[0].deliveryFenceVersion,
    postFence: before.orders[0].deliveryFenceVersion + 1,
    observedInputVersion: before.orders[0].inputVersion,
  });
  expect(strictOutcome.resemblanceProofs).toHaveLength(2);
  expect(strictOutcome.resemblanceProofs).toEqual(request.resemblanceProofs);
  expect(strictOutcome.resemblanceProofs.find(
    (proof) => proof.artifactKey === 'page:2',
  )).toMatchObject({
    assetId: 'asset-page-2',
    deliveredUrlHash: deliveredUrlHash(
      'https://assets.example/existing-page-2.png',
    ),
    evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
    resemblanceScore: 0.82,
    threshold: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  });
  expect(strictOutcome.resemblanceProofs.find(
    (proof) => proof.artifactKey === 'page:6',
  )).toMatchObject({
    assetId: request.expectedAssetId,
    deliveredUrlHash: request.expectedDeliveredUrlHash,
    evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
    resemblanceScore: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
    threshold: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  });

  const reviewCase = after.humanReviewCases.find(
    (entry) => entry.id === CASE_ID,
  )!;
  expect(reviewCase).toMatchObject({
    status: 'resolved',
    activeKey: null,
    resolvedActor: request.actor,
    decisionNote: request.reviewReason,
  });

  const evidenceBefore = targetEvidence(before);
  const evidenceAfter = targetEvidence(after);
  expect(evidenceAfter).toMatchObject({
    reviewStatus: HUMAN_VERIFIED_UNVERIFIED_REVIEW_STATUS,
    reviewedAssetSha256: request.expectedAssetSha256,
    reviewedContractHash: null,
    reviewedBy: request.actor,
    reviewedAt: NOW,
  });
  expect(parseHumanVerifiedUnverifiedReviewReason(evidenceAfter.reviewReason)).toEqual({
    version: HUMAN_VERIFIED_UNVERIFIED_VERSION,
    actionId: ACTION_ID,
    reason: request.reviewReason,
  });
  expect({
    verdict: evidenceAfter.verdict,
    reason: evidenceAfter.reason,
    evaluatorContractVersion: evidenceAfter.evaluatorContractVersion,
    evidence: evidenceAfter.evidence,
    safetyOverride: evidenceAfter.safetyOverride,
    safetyOverrideSha256: evidenceAfter.safetyOverrideSha256,
  }).toEqual({
    verdict: evidenceBefore.verdict,
    reason: evidenceBefore.reason,
    evaluatorContractVersion: evidenceBefore.evaluatorContractVersion,
    evidence: evidenceBefore.evidence,
    safetyOverride: evidenceBefore.safetyOverride,
    safetyOverrideSha256: evidenceBefore.safetyOverrideSha256,
  });
  expect(strictOutcome.qualityEvidenceDigest).toBe(
    humanVerifiedUnverifiedQualityAuthorityDigest(evidenceAfter),
  );

  expect(targetAsset(after)).toEqual(targetAsset(before));
  expect(targetAsset(after)).toMatchObject({
    safetyVerified: false,
    safetyHazards: [],
    safetyContentSha256: request.expectedAssetSha256,
    safetyOverriddenHazards: [],
    safetyOverrideSha256: null,
  });
  expect(after.manifests).toHaveLength(1);
  expect(after.deliveryOutbox).toHaveLength(1);
  expect(after.receipts).toHaveLength(1);
  expect(after.receipts[0]).toMatchObject({
    operationKey: humanVerifiedUnverifiedOperationKey(
      ORDER_ID,
      request.idempotencyKey,
    ),
    orderId: ORDER_ID,
    kind: 'operator_action',
    payloadHash: humanVerifiedUnverifiedRequestHash(ORDER_ID, request),
  });
  const strictReceipt = parseHumanVerifiedUnverifiedAtomicReceiptResult(
    after.receipts[0].result,
  );
  if (!strictReceipt) throw new Error('strict_atomic_receipt_missing');
  expect(strictReceipt).toEqual({
    version: 'human_verified_unverified_receipt/v1',
    actionId: ACTION_ID,
    requestHash: humanVerifiedUnverifiedRequestHash(ORDER_ID, request),
    inspectionDigest: request.inspectionDigest,
    resemblanceProofDigest: request.resemblanceProofDigest,
    qualityEvidenceDigest: strictOutcome.qualityEvidenceDigest,
    result: {
      manifestStatus: 'passed',
      enqueued: true,
      orderStatus: 'ready',
      reason: null,
      revision: 1,
    },
  });
}

describe('commitBaseBookReadiness — stateful exact-byte human release transaction', () => {
  const envKeys = [
    'VERCEL_ENV',
    'ALLOW_STAGING_QA',
    'HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED',
    'QA_SOFT_DELIVER',
    'READINESS_MANIFEST_ENABLED',
    'NEXT_PUBLIC_APP_URL',
    'SUPABASE_URL',
    'DATABASE_URL',
  ] as const;
  let saved: Record<(typeof envKeys)[number], string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(
      envKeys.map((key) => [key, process.env[key]]),
    ) as Record<(typeof envKeys)[number], string | undefined>;
    process.env.VERCEL_ENV = 'preview';
    process.env.ALLOW_STAGING_QA = 'true';
    process.env.HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED = 'true';
    process.env.READINESS_MANIFEST_ENABLED = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://human-review-preview.vercel.app';
    process.env.SUPABASE_URL = 'https://staging-project.supabase.co';
    process.env.DATABASE_URL = 'postgresql://test@staging-project.supabase.co/db';
    delete process.env.QA_SOFT_DELIVER;
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  async function commit(
    harness: ReturnType<typeof statefulPrisma>,
    request: HumanVerifiedUnverifiedReleaseRequest,
  ): Promise<CommitResult> {
    return commitBaseBookReadiness(
      harness.prisma as never,
      {
        orderId: ORDER_ID,
        humanVerifiedUnverifiedRelease: request,
      },
      {
        inspect: inspectExistingAsset,
        now: () => NOW,
        appBaseUrl: 'https://app.example.com',
        atomic: { sleep: async () => {} },
      },
    );
  }

  async function committedFixture() {
    const fixture = initialFixture();
    const harness = statefulPrisma(fixture.state);
    await commit(harness, fixture.request);
    const baseline = await loadCurrentPublicHumanReviewGate(harness);
    expect(humanReviewProjection(baseline.rows)).toMatchObject({
      humanReviewVerified: true,
      humanReviewActionDigest: humanVerifiedUnverifiedRequestHash(
        ORDER_ID,
        fixture.request,
      ),
    });
    expect(baseline.gate).toMatchObject({
      status: 'passed',
      reason: null,
      contractHardHold: false,
      hardHoldKind: null,
    });
    return { fixture, harness };
  }

  async function expectPublicLoaderAndGateFailClosed(
    harness: ReturnType<typeof statefulPrisma>,
    inspect: AuthorityByteInspect = inspectExistingAsset,
  ): Promise<void> {
    const current = await loadCurrentPublicHumanReviewGate(harness, inspect);
    expect(humanReviewProjection(current.rows)).toMatchObject({
      humanReviewVerified: false,
      humanReviewActionDigest: null,
    });
    expect(current.gate).toMatchObject({
      status: 'evidence_unknown',
      contractHardHold: true,
      hardHoldKind: 'safety',
    });
    expect(current.gate.unknownArtifacts).toContain('page:6');
  }

  it('commits review + exact case resolution + one delivery atomically, then replays the same key without a second mutation', async () => {
    const fixture = initialFixture();
    const harness = statefulPrisma(fixture.state);
    const before = harness.snapshot();

    const first = await commit(harness, fixture.request);

    expect(first).toEqual({
      manifestStatus: 'passed',
      enqueued: true,
      orderStatus: 'ready',
      reason: null,
      revision: 1,
    });
    const afterFirst = harness.snapshot();
    assertCommittedHumanRelease(before, afterFirst, fixture.request);
    const metricsAfterFirst = harness.metrics();
    expect(metricsAfterFirst).toEqual({
      qualityReviewWrites: 1,
      humanMarkerTransitions: 1,
      caseResolutions: 1,
      manifestCreates: 1,
      outboxCreates: 1,
      shipTransitions: 1,
      actionFinalizations: 1,
      receiptBusinessCompletions: 1,
    });

    const replay = await commit(harness, fixture.request);

    expect(replay).toEqual(first);
    expect(harness.snapshot()).toEqual(afterFirst);
    expect(harness.metrics()).toEqual(metricsAfterFirst);
  });

  it('fails closed when a sibling required page keeps passing but its current resemblance score changes', async () => {
    const { fixture, harness } = await committedFixture();
    harness.mutateCommitted((state) => {
      const sibling = qualityEvidenceFor(state, 'page:2');
      const evidence = recordOf(sibling.evidence);
      const gate = recordOf(evidence.pageResemblanceGate);
      gate.resemblanceScore = 0.81;
      sibling.updatedAt = new Date('2026-09-02T12:01:00.000Z');
    });

    await expectPublicLoaderAndGateFailClosed(harness);
    await expect(commit(harness, fixture.request)).rejects.toMatchObject({
      rule: 'evidence_changed',
    });
  });

  it.each([
    {
      name: 'deleted',
      mutate: (state: HarnessState) => {
        state.receipts.splice(0, state.receipts.length);
      },
    },
    {
      name: 'payload-mismatched',
      mutate: (state: HarnessState) => {
        state.receipts[0].payloadHash = '0'.repeat(64);
      },
    },
  ])('fails closed when the AtomicOperationReceipt is $name', async ({ mutate }) => {
    const { harness } = await committedFixture();
    harness.mutateCommitted(mutate);

    await expectPublicLoaderAndGateFailClosed(harness);
  });

  it('fails closed when the approved anchor entry changes while its URL bytes stay the same', async () => {
    const { harness } = await committedFixture();
    harness.mutateCommitted((state) => {
      const store = recordOf(
        state.generationJobs[0].pipelineCache.characterAnchorStore,
      );
      const child = recordOf(store.child);
      child.updatedAt = '2026-09-02T12:02:00.000Z';
    });

    await expectPublicLoaderAndGateFailClosed(harness);
  });

  it('fails closed when the current approved-anchor bytes change under the same entry and URL', async () => {
    const { harness } = await committedFixture();
    const changedAnchorBytes: AuthorityByteInspect = async (url) =>
      url === REFERENCE_URL
        ? { sha256: 'c'.repeat(64) }
        : { sha256: (await inspectExistingAsset(url)).sha256 };

    await expectPublicLoaderAndGateFailClosed(harness, changedAnchorBytes);
  });

  it('fails closed when historical refund/reconciliation authority appears after release', async () => {
    const { harness } = await committedFixture();
    harness.mutateCommitted((state) => {
      state.exceptionCases.push({
        id: 'historical-send-ambiguous-1',
        orderId: ORDER_ID,
        activeKey: null,
        kind: 'send_ambiguous',
        status: 'resolved',
        refundKey: null,
        providerActionId: null,
        actionAttemptedAt: null,
        notificationAttemptedAt: null,
        notificationMessageId: null,
        resolution: { noticeOutcome: 'ambiguous_no_resend' },
        lastError: null,
      });
    });

    await expectPublicLoaderAndGateFailClosed(harness);
  });

  it.each([
    {
      name: 'the PaymentRecord provider no longer matches the Order provider',
      mutate: (state: HarnessState) => {
        state.payments[0].provider = 'payme';
      },
    },
    {
      name: 'the Order payment provider is blank',
      mutate: (state: HarnessState) => {
        state.orders[0].paymentProvider = '';
      },
    },
    {
      name: 'the Order payment id is blank',
      mutate: (state: HarnessState) => {
        state.orders[0].paymentId = '';
      },
    },
    {
      name: 'the paid PaymentRecord has no paidAt timestamp',
      mutate: (state: HarnessState) => {
        state.payments[0].paidAt = null;
      },
    },
  ])('fails closed on public loading and receipt replay when $name', async ({ mutate }) => {
    const { fixture, harness } = await committedFixture();
    harness.mutateCommitted(mutate);

    await expectPublicLoaderAndGateFailClosed(harness);
    await expect(commit(harness, fixture.request)).rejects.toMatchObject({
      rule: 'evidence_changed',
    });
  });

  it('fails closed when a sibling proof asset ID changes with the same URL and bytes', async () => {
    const { harness } = await committedFixture();
    harness.mutateCommitted((state) => {
      pageAsset(state, 2).id = 'asset-page-2-replaced';
    });

    await expectPublicLoaderAndGateFailClosed(harness);
  });

  it('fails closed when the reviewed proof URL changes even if inspection returns the original bytes', async () => {
    const { harness } = await committedFixture();
    const originalUrl = pageAsset(harness.snapshot(), 6).url;
    const replacementUrl = 'https://assets.example/existing-page-6-moved.png';
    harness.mutateCommitted((state) => {
      pageAsset(state, 6).url = replacementUrl;
    });
    const sameBytesAtDifferentUrl: AuthorityByteInspect = async (url) =>
      url === replacementUrl
        ? { sha256: shaOf(originalUrl) }
        : { sha256: (await inspectExistingAsset(url)).sha256 };

    await expectPublicLoaderAndGateFailClosed(
      harness,
      sameBytesAtDifferentUrl,
    );
  });

  it('fails closed when the actual inspected SHA drifts under an unchanged sibling proof ID and URL', async () => {
    const { harness } = await committedFixture();
    const siblingUrl = pageAsset(harness.snapshot(), 2).url;
    const changedSiblingBytes: AuthorityByteInspect = async (url) =>
      url === siblingUrl
        ? { sha256: 'd'.repeat(64) }
        : { sha256: (await inspectExistingAsset(url)).sha256 };

    await expectPublicLoaderAndGateFailClosed(harness, changedSiblingBytes);
  });

  it.each([
    ['outbox', 'injected_outbox_failure'],
    ['finalization', 'injected_finalization_failure'],
  ] as const)(
    'rolls back every write on %s failure and leaves the pending prepared action safely retryable',
    async (failurePoint, message) => {
      const fixture = initialFixture();
      const harness = statefulPrisma(fixture.state);
      const before = harness.snapshot();
      harness.setFailure(failurePoint);

      await expect(commit(harness, fixture.request)).rejects.toThrow(message);

      const rolledBack = harness.snapshot();
      expect(rolledBack).toEqual(before);
      expect(rolledBack.orders).toHaveLength(1);
      expect(rolledBack.payments).toHaveLength(1);
      expect(rolledBack.manifests).toHaveLength(0);
      expect(rolledBack.deliveryOutbox).toHaveLength(0);
      expect(rolledBack.receipts).toHaveLength(0);
      expect(rolledBack.operatorActions[0]).toMatchObject({
        id: ACTION_ID,
        status: 'pending',
        outcome: humanVerifiedUnverifiedPreparedOutcome(fixture.request),
      });
      expect(targetEvidence(rolledBack)).toMatchObject({
        reviewStatus: null,
        reviewedAssetSha256: null,
        reviewedBy: null,
        reviewedAt: null,
      });
      expect(rolledBack.humanReviewCases[0]).toMatchObject({
        id: CASE_ID,
        activeKey: `${ORDER_ID}:base_book`,
        status: 'open',
      });
      expect(rolledBack.orders[0]).toMatchObject({
        id: ORDER_ID,
        status: 'needs_human_qa',
        deliveryHoldReason: MARKER,
        deliveryFenceVersion: 4,
      });

      harness.setFailure(null);
      const retried = await commit(harness, fixture.request);
      expect(retried).toMatchObject({
        manifestStatus: 'passed',
        enqueued: true,
        orderStatus: 'ready',
      });
      assertCommittedHumanRelease(before, harness.snapshot(), fixture.request);
    },
  );
});
