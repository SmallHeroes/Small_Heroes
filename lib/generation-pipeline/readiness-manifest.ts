/**
 * Phase-1 base_book_integrity — readiness orchestration (flag READINESS_MANIFEST_ENABLED, default OFF).
 *
 * The Manifest is IMMUTABLE: one terminal INSERT per evaluation (passed|blocked); evidence + status are
 * never mutated. BookReadiness is the MUTABLE pointer to the current state. A revision is allocated
 * atomically (the unique (orderId,scope,revision) constraint + a tx-level retry guarantees two concurrent
 * evaluators never share a revision). On PASS-and-anchor-allows the whole thing — manifest INSERT,
 * readiness pointer, Outbox enqueue, Order.ready, GenerationJob done — commits in ONE transaction; the
 * email is sent later by the Outbox worker (so `ready` never depends on the mail provider being up).
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { evaluateBaseBookIntegrity, BASE_BOOK_SCOPE, type IntegrityInput, type IntegrityResult } from './integrity-gate';
import { inspectAsset, type AssetInspection } from './asset-integrity';
import { enqueueDelivery, type BookReadyPayload } from '@/lib/generation-chunked/delivery-outbox';
import { createLogger } from '@/lib/logger';

const log = createLogger({ subsystem: 'readiness-manifest' });

export function isReadinessManifestEnabled(): boolean {
  return process.env.READINESS_MANIFEST_ENABLED === 'true';
}

type Tx = Prisma.TransactionClient;

export interface OrderTruth {
  id: string;
  fulfillmentVersion: number;
  expectedPageCount: number | null;
  storySourceHash: string | null;
  customerEmail: string;
  customerName: string | null;
  childName: string;
}
export interface BookData {
  coverImageUrl: string | null;
  readUrl: string | null;
  pdfUrl: string | null;
  firstAudioUrl: string | null;
  pages: Array<{ pageNumber: number; imageUrl: string | null; text: string }>;
}
export interface CommitArgs {
  order: OrderTruth;
  book: BookData;
  /** From the existing anchor delivery gate: does the anchor permit customer delivery? */
  anchorAllowsDelivery: boolean;
  anchorOrderStatus: string; // deliveryGate.orderStatus (e.g. 'ready' | 'needs_human_qa')
  anchorReason: string | null;
}
export interface CommitDeps {
  inspect?: (url: string | null | undefined) => Promise<AssetInspection>;
  now?: () => Date;
}
export interface CommitResult {
  manifestStatus: 'passed' | 'blocked';
  enqueued: boolean;
  orderStatus: string;
  reason: string | null;
  revision: number;
}

function isRevisionCollision(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: string }).code === 'P2002';
}

function buildIntegrityInput(order: OrderTruth, book: BookData): IntegrityInput {
  return {
    scope: BASE_BOOK_SCOPE,
    frozen: { expectedPageCount: order.expectedPageCount, storySourceHash: order.storySourceHash },
    cover: { imageUrl: book.coverImageUrl },
    pages: book.pages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageUrl, text: p.text })),
  };
}

function buildPayload(order: OrderTruth, book: BookData): BookReadyPayload {
  return {
    to: order.customerEmail,
    customerName: order.customerName ?? order.childName,
    childName: order.childName,
    readUrl: book.readUrl ?? '',
    audioUrl: book.firstAudioUrl ?? undefined,
    pdfUrl: book.pdfUrl ?? undefined,
  };
}

async function nextRevision(tx: Tx, orderId: string, scope: string): Promise<number> {
  const last = await tx.bookReadinessManifest.findFirst({
    where: { orderId, scope },
    orderBy: { revision: 'desc' },
    select: { revision: true },
  });
  return (last?.revision ?? 0) + 1;
}

/**
 * The single PASS/BLOCK transaction. May throw a P2002 (revision collision) when a concurrent evaluator
 * grabbed the same revision — the caller retries the whole transaction (eval is already in memory).
 */
async function runReadinessTxn(
  tx: Tx,
  args: CommitArgs,
  result: IntegrityResult,
  now: Date,
): Promise<CommitResult> {
  const { order } = args;
  const scope = BASE_BOOK_SCOPE;
  const revision = await nextRevision(tx, order.id, scope);

  // (1) IMMUTABLE manifest — terminal INSERT (throws P2002 on a concurrent same-revision insert).
  const manifest = await tx.bookReadinessManifest.create({
    data: {
      orderId: order.id,
      scope,
      revision,
      status: result.status,
      inputsHash: result.inputsHash,
      evidence: result.evidence as unknown as Prisma.InputJsonValue,
      reason: result.reason,
    },
  });

  // (2) MUTABLE readiness pointer → current manifest.
  await tx.bookReadiness.upsert({
    where: { orderId_scope: { orderId: order.id, scope } },
    create: { orderId: order.id, scope, status: result.status, currentManifestId: manifest.id, reason: result.reason },
    update: { status: result.status, currentManifestId: manifest.id, reason: result.reason },
  });

  let enqueued = false;
  let orderStatus: string;
  let deliveryHoldReason: string | null;

  if (result.status === 'passed' && args.anchorAllowsDelivery) {
    // (3) enqueue the delivery IN the same transaction (enqueue != send), then (4) mark the order ready.
    await enqueueDelivery(tx, { orderId: order.id, scope, fulfillmentVersion: order.fulfillmentVersion, payload: buildPayload(order, args.book), now });
    enqueued = true;
    orderStatus = 'ready';
    deliveryHoldReason = null;
  } else if (result.status === 'passed') {
    // Integrity passed but the ANCHOR still holds delivery (Phase-1 keeps the anchor hold — fix #4). No enqueue.
    orderStatus = args.anchorOrderStatus;
    deliveryHoldReason = args.anchorReason;
  } else {
    // Integrity BLOCKED → held, no enqueue, no email; re-evaluation is triggered by a dedicated fn, not a loop.
    orderStatus = 'needs_human_qa';
    deliveryHoldReason = `base_book_integrity:${result.reason ?? 'blocked'}`;
  }

  await tx.order.update({ where: { id: order.id }, data: { status: orderStatus as never, packageStatus: 'done', deliveryHoldReason } });
  // (5) GenerationJob terminal — the package stage ran.
  await tx.generationJob.update({ where: { orderId: order.id }, data: { status: 'done', currentStage: 'done', completedAt: now, packaged: true } });

  return { manifestStatus: result.status, enqueued, orderStatus, reason: deliveryHoldReason, revision };
}

/**
 * Evaluate integrity in memory, then commit the manifest + readiness + (on pass+anchor) the Outbox enqueue
 * and Order/Job terminal updates in ONE transaction. Retries the transaction on a revision collision.
 */
export async function commitBaseBookReadiness(prisma: PrismaClient, args: CommitArgs, deps: CommitDeps = {}): Promise<CommitResult> {
  const now = deps.now?.() ?? new Date();
  const result = await evaluateBaseBookIntegrity(buildIntegrityInput(args.order, args.book), deps.inspect ?? inspectAsset);

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await prisma.$transaction((tx) => runReadinessTxn(tx, args, result, now));
    } catch (e) {
      if (isRevisionCollision(e) && attempt < 5) {
        log.warn('Readiness revision collision — retrying transaction', { orderId: args.order.id, attempt });
        continue;
      }
      throw e;
    }
  }
  throw new Error('readiness_revision_allocation_failed');
}

/**
 * Send-time recheck for the Outbox worker: re-evaluate integrity NOW and confirm nothing changed since the
 * manifest was written — readiness still `passed`, the current manifest's inputsHash still matches the live
 * assets, and the order is not re-held. Any drift => the worker suppresses (no stale delivery).
 */
export async function recheckBaseBookDelivery(
  prisma: PrismaClient,
  orderId: string,
  scope: string,
  deps: CommitDeps = {},
): Promise<{ ok: boolean; reason?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, status: true, expectedPageCount: true, storySourceHash: true,
      book: {
        select: {
          coverImageUrl: true,
          pages: { orderBy: { pageNumber: 'asc' }, select: { pageNumber: true, text: true, imageAsset: { select: { url: true, presentationUrl: true } } } },
        },
      },
    },
  });
  if (!order || !order.book) return { ok: false, reason: 'order_or_book_missing' };
  if (order.status === 'needs_human_qa' || order.status === 'failed') return { ok: false, reason: `order_re_held:${order.status}` };

  const readiness = await prisma.bookReadiness.findUnique({ where: { orderId_scope: { orderId, scope } }, select: { status: true, currentManifestId: true } });
  if (!readiness || readiness.status !== 'passed' || !readiness.currentManifestId) return { ok: false, reason: 'readiness_not_passed' };
  const manifest = await prisma.bookReadinessManifest.findUnique({ where: { id: readiness.currentManifestId }, select: { inputsHash: true } });
  if (!manifest) return { ok: false, reason: 'manifest_missing' };

  const fresh = await evaluateBaseBookIntegrity(
    {
      scope: BASE_BOOK_SCOPE,
      frozen: { expectedPageCount: order.expectedPageCount, storySourceHash: order.storySourceHash },
      cover: { imageUrl: order.book.coverImageUrl },
      pages: order.book.pages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null, text: p.text })),
    },
    deps.inspect ?? inspectAsset,
  );
  if (fresh.status !== 'passed') return { ok: false, reason: `integrity_now_${fresh.reason ?? 'blocked'}` };
  if (fresh.inputsHash !== manifest.inputsHash) return { ok: false, reason: 'inputs_changed_since_manifest' };
  return { ok: true };
}
