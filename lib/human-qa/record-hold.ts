import 'server-only';

import { randomUUID } from 'crypto';
import {
  Prisma,
  type HumanQaHoldKind,
  type HumanQaReviewCase,
  type OperatorNotificationOutbox,
} from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';

/**
 * (Human-QA Slice 1, Unit 1) PURE planner + a thin tx applier for the delivery-hold review lifecycle.
 *
 * INERT: nothing in the pipeline calls `recordHumanQaHoldInTx` yet. This module NEVER decides whether to hold or
 * parses quality evidence — the caller passes an already-made hold decision. The planner is a total pure function
 * of (existing active case, incoming args); the applier is the smallest transactional wrapper that realizes the
 * plan and lets the DB (nullable-unique `activeKey`, unique `(orderId,scope,revision)` and `dedupeKey`) collapse a
 * concurrent duplicate to exactly one case + one outbox.
 */

// ─── Hold kinds + precedence ──────────────────────────────────────────────────────────────────────────────────

export const HUMAN_QA_HOLD_KINDS = [
  'safety',
  'contract_world',
  'anchor',
  'payment_integrity',
  'legacy_unknown',
] as const satisfies readonly HumanQaHoldKind[];

/**
 * Precedence WITHIN the `base_book` scope: a stronger active hold is NEVER replaced by a weaker incoming one (the
 * safety invariant). `payment_integrity` lives in a DIFFERENT scope (`payment`), so it is only ever compared with
 * another `payment_integrity` — never precedence-ranked against the base_book kinds. Its rank is isolated
 * (`-1`) purely so a stray cross-scope comparison could never read it as "stronger than" a base_book kind.
 */
export function holdKindRank(kind: HumanQaHoldKind): number {
  switch (kind) {
    case 'safety':
      return 3;
    case 'contract_world':
      return 2;
    case 'anchor':
      return 1;
    case 'legacy_unknown':
      return 0;
    case 'payment_integrity':
      return -1;
  }
}

/** base_book for safety/contract_world/anchor/legacy_unknown; payment for payment_integrity. */
export function scopeForHoldKind(kind: HumanQaHoldKind): 'base_book' | 'payment' {
  return kind === 'payment_integrity' ? 'payment' : 'base_book';
}

// ─── Fingerprint (deterministic hold identity) ────────────────────────────────────────────────────────────────

export interface HumanQaFingerprintArgs {
  kind: HumanQaHoldKind;
  scope: string;
  rawReason: string;
  inputVersion: number;
  contractHash?: string | null;
  sourceManifestId?: string | null;
  artifactRefs?: unknown;
}

/**
 * The stable identity of a hold. `revision` is deliberately NOT folded in — it is a CONSEQUENCE of the identity
 * (a re-hold with the same identity is idempotent; a different identity supersedes and bumps the revision). Uses
 * `canonicalHash` so the hash is invariant to key order + Unicode normal form.
 */
export function computeHoldFingerprint(args: HumanQaFingerprintArgs): string {
  return canonicalHash({
    kind: args.kind,
    scope: args.scope,
    rawReason: args.rawReason,
    inputVersion: args.inputVersion,
    contractHash: args.contractHash ?? null,
    sourceManifestId: args.sourceManifestId ?? null,
    artifactRefs: args.artifactRefs ?? null,
  });
}

// ─── Pure planner ─────────────────────────────────────────────────────────────────────────────────────────────

export type HumanQaHoldAction = 'idempotent' | 'create' | 'supersede' | 'skip_weaker';

export interface HumanQaHoldPlan {
  action: HumanQaHoldAction;
  revision: number;
  fingerprint: string;
}

/** The minimal facts the planner needs about the current active (`open`) case for (orderId, scope). */
export interface ActiveHoldCaseFacts {
  revision: number;
  holdFingerprint: string;
  kind: HumanQaHoldKind;
}

export interface PlanHumanQaHoldArgs extends HumanQaFingerprintArgs {
  /** Max existing revision across ALL cases (any status) for (orderId, scope). Defaults to 0 ⇒ first revision = 1. */
  maxRevision?: number;
}

/**
 * PURE. Decides what to do given the current active case (or null) and the incoming hold args.
 *  - no active case                              → create  (revision = maxRevision + 1)
 *  - active, same fingerprint                    → idempotent (existing revision; caller writes nothing)
 *  - active, different fp, incoming rank < active → skip_weaker (a weaker hold never replaces a stronger active one)
 *  - active, different fp, incoming rank ≥ active → supersede (revision = active.revision + 1)
 *
 * The precedence comparison is only ever reached for a same-scope active case (the applier looks it up by
 * `activeKey = ${orderId}:${scope}`), so payment_integrity is only compared with payment_integrity.
 */
export function planHumanQaHold(
  existing: ActiveHoldCaseFacts | null,
  args: PlanHumanQaHoldArgs,
): HumanQaHoldPlan {
  const fingerprint = computeHoldFingerprint(args);
  const maxRevision = args.maxRevision ?? 0;

  if (!existing) {
    return { action: 'create', revision: maxRevision + 1, fingerprint };
  }
  if (existing.holdFingerprint === fingerprint) {
    return { action: 'idempotent', revision: existing.revision, fingerprint };
  }
  if (holdKindRank(args.kind) < holdKindRank(existing.kind)) {
    return { action: 'skip_weaker', revision: existing.revision, fingerprint };
  }
  return { action: 'supersede', revision: existing.revision + 1, fingerprint };
}

// ─── Operator-notification payload ────────────────────────────────────────────────────────────────────────────

export interface OperatorNotificationPayload {
  orderId: string;
  childName: string;
  kind: HumanQaHoldKind;
  scope: string;
  humanReason: string;
  /** Best-effort page(s) parsed from the raw hold marker; omitted when none parse. */
  pages?: number[];
  /**
   * NO customer access key and NO deep link to a page are ever carried here. A link to the not-yet-built admin
   * console (Slice 2) would be a link to a 404, which is not "visible lifecycle" — so we carry the orderId +
   * human reason and this explicit pending marker instead of a URL.
   */
  reviewConsole: 'pending_slice_2';
}

/** Extract page numbers from a raw hold marker like `anchor_low_confidence:page:3` or `... pages 4,5`. */
export function parsePagesFromRawReason(rawReason: string): number[] {
  const pages = new Set<number>();
  const re = /\bpages?\b[^0-9]{0,4}(\d{1,3}(?:\s*[,\-]\s*\d{1,3})*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawReason)) !== null) {
    for (const tok of m[1].split(/[,\-]/)) {
      const n = Number.parseInt(tok.trim(), 10);
      if (Number.isFinite(n)) pages.add(n);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export function buildOperatorNotificationPayload(args: {
  orderId: string;
  childName: string;
  kind: HumanQaHoldKind;
  scope: string;
  humanReason: string;
  rawReason: string;
}): OperatorNotificationPayload {
  const pages = parsePagesFromRawReason(args.rawReason);
  return {
    orderId: args.orderId,
    childName: args.childName,
    kind: args.kind,
    scope: args.scope,
    humanReason: args.humanReason,
    ...(pages.length > 0 ? { pages } : {}),
    reviewConsole: 'pending_slice_2',
  };
}

// ─── Thin transactional applier ───────────────────────────────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;

export interface RecordHumanQaHoldArgs {
  orderId: string;
  scope: string;
  kind: HumanQaHoldKind;
  rawReason: string;
  humanReason: string;
  childName: string;
  inputVersion: number;
  contractHash?: string | null;
  sourceManifestId?: string | null;
  artifactRefs?: Prisma.InputJsonValue | null;
  now?: Date;
}

export interface RecordHumanQaHoldResult {
  caseId: string;
  revision: number;
  action: HumanQaHoldAction;
  outboxId: string;
}

function activeKeyFor(orderId: string, scope: string): string {
  return `${orderId}:${scope}`;
}

interface InsertOutcome {
  /** True iff THIS call inserted the new case row (vs. a concurrent producer having already won the race). */
  created: boolean;
  caseId: string;
  revision: number;
  outboxId: string;
}

/**
 * Insert one open case + its scheduled notification outbox for the given plan. Shared by create + supersede.
 *
 * NON-ABORTING by construction (mirrors `runFenced` in lib/generation-pipeline/atomic-operation.ts): both inserts
 * are raw `INSERT … ON CONFLICT DO NOTHING RETURNING "id"`. A unique violation in Postgres would ABORT the whole
 * surrounding transaction ("current transaction is aborted") — fatal here because the payment fences call this in
 * the SAME tx as their money writes, so an aborting conflict would roll back a money outcome. `ON CONFLICT DO
 * NOTHING` instead returns ZERO rows and leaves the tx healthy, so a concurrent duplicate collapses to the winning
 * row via a plain follow-up SELECT. The bare (target-less) `ON CONFLICT DO NOTHING` covers BOTH unique constraints
 * on each table (case: `activeKey` + `(orderId,scope,revision)`; outbox: `dedupeKey`). The raw insert bypasses
 * Prisma's `@default(cuid())`, so the id is minted here with `randomUUID()` — the same id source `runFenced` uses.
 */
async function insertCaseWithOutbox(
  tx: Tx,
  args: RecordHumanQaHoldArgs,
  plan: HumanQaHoldPlan,
  now: Date,
): Promise<InsertOutcome> {
  const activeKey = activeKeyFor(args.orderId, args.scope);
  const caseId = randomUUID();
  const openStatus = 'open';
  const artifactRefsJson = args.artifactRefs == null ? null : JSON.stringify(args.artifactRefs);

  const insertedCase = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "HumanQaReviewCase" (
      "id", "activeKey", "orderId", "scope", "revision", "kind", "status",
      "holdFingerprint", "rawReason", "humanReason", "sourceManifestId",
      "inputVersion", "contractHash", "artifactRefs", "heldAt", "createdAt", "updatedAt"
    )
    VALUES (
      ${caseId}, ${activeKey}, ${args.orderId}, ${args.scope}, ${plan.revision},
      ${args.kind}::"HumanQaHoldKind", ${openStatus}::"HumanQaReviewCaseStatus",
      ${plan.fingerprint}, ${args.rawReason}, ${args.humanReason}, ${args.sourceManifestId ?? null},
      ${args.inputVersion}, ${args.contractHash ?? null}, ${artifactRefsJson}::jsonb, ${now}, ${now}, ${now}
    )
    ON CONFLICT DO NOTHING
    RETURNING "id"`;

  if (insertedCase.length === 0) {
    // A concurrent producer already owns this (orderId,scope) / revision. The conflict did NOT abort the tx, so we
    // can safely re-select the winning active case + its live outbox and collapse to it.
    const winner = await tx.humanQaReviewCase.findUnique({ where: { activeKey } });
    if (!winner) throw new Error(`human_qa_hold_conflict_without_active_case:${activeKey}`);
    const outbox = await liveOutboxFor(tx, winner.id);
    return { created: false, caseId: winner.id, revision: winner.revision, outboxId: outbox?.id ?? '' };
  }

  const ownedCaseId = insertedCase[0].id;
  const payload = buildOperatorNotificationPayload({
    orderId: args.orderId,
    childName: args.childName,
    kind: args.kind,
    scope: args.scope,
    humanReason: args.humanReason,
    rawReason: args.rawReason,
  });
  const outboxId = randomUUID();
  const scheduledStatus = 'scheduled';
  const insertedOutbox = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "OperatorNotificationOutbox" (
      "id", "dedupeKey", "caseId", "orderId", "scope", "status", "payload", "payloadHash", "createdAt"
    )
    VALUES (
      ${outboxId}, ${`human-qa/${args.orderId}/${args.scope}/${plan.revision}`}, ${ownedCaseId},
      ${args.orderId}, ${args.scope}, ${scheduledStatus}::"OperatorNotificationOutboxStatus",
      ${JSON.stringify(payload)}::jsonb, ${canonicalHash(payload)}, ${now}
    )
    ON CONFLICT DO NOTHING
    RETURNING "id"`;

  // We own the case, so its dedupeKey is free — but stay defensive: if the outbox insert no-op'd, re-select it.
  const liveId =
    insertedOutbox.length > 0 ? insertedOutbox[0].id : (await liveOutboxFor(tx, ownedCaseId))?.id ?? '';
  return { created: true, caseId: ownedCaseId, revision: plan.revision, outboxId: liveId };
}

/** The live outbox for a case (its single scheduled/sent/failed row; a suppressed one is a superseded remnant). */
async function liveOutboxFor(tx: Tx, caseId: string): Promise<OperatorNotificationOutbox | null> {
  return tx.operatorNotificationOutbox.findFirst({
    where: { caseId, status: { not: 'suppressed' } },
  });
}

/**
 * The thin applier. Reads the active case for (orderId, scope), computes the max revision, plans, then writes the
 * minimal rows via non-aborting `ON CONFLICT DO NOTHING` inserts (see insertCaseWithOutbox). There is NO throwing
 * conflict path to catch: the DB unique constraints (`activeKey`, `(orderId,scope,revision)`, `dedupeKey`) plus
 * non-aborting ON CONFLICT DO NOTHING guarantee a concurrent duplicate can never create a second row AND never
 * aborts the caller's — possibly money-bearing — transaction; a lost race simply re-selects and returns the
 * winning row. Outcome is always exactly one active case + one live outbox.
 */
export async function recordHumanQaHoldInTx(
  tx: Tx,
  args: RecordHumanQaHoldArgs,
): Promise<RecordHumanQaHoldResult> {
  const now = args.now ?? new Date();
  const activeKey = activeKeyFor(args.orderId, args.scope);

  const active = await tx.humanQaReviewCase.findUnique({ where: { activeKey } });
  const maxRow = await tx.humanQaReviewCase.findFirst({
    where: { orderId: args.orderId, scope: args.scope },
    orderBy: { revision: 'desc' },
    select: { revision: true },
  });

  const plan = planHumanQaHold(
    active ? { revision: active.revision, holdFingerprint: active.holdFingerprint, kind: active.kind } : null,
    { ...args, maxRevision: maxRow?.revision ?? 0 },
  );

  // Same identity, or a weaker hold meeting a stronger active one → return the existing active case + its live
  // outbox, writing nothing. skip_weaker returns the STRONGER active case, never the incoming weaker one.
  if ((plan.action === 'idempotent' || plan.action === 'skip_weaker') && active) {
    const outbox = await liveOutboxFor(tx, active.id);
    return { caseId: active.id, revision: active.revision, action: plan.action, outboxId: outbox?.id ?? '' };
  }

  if (plan.action === 'supersede' && active) {
    // Retire the old active case, then open the new revision. Order matters: the old case's `activeKey` MUST be
    // freed (nulled) BEFORE the new case claims the same `${orderId}:${scope}`, or the nullable-unique index would
    // reject the insert. A plain UPDATE never aborts the tx (only a failing constraint does), so this ordering is
    // safe. The forward pointer is patched in after the new id exists. The old case's evidence snapshot fields are
    // NEVER touched (immutable). Its still-unsent outbox is suppressed so no operator ping fires for a hold that a
    // stronger/newer one has replaced. If we LOST the insert race (created=false), the winner already performed
    // these side effects, so we skip them and return the winner.
    const oldOutbox = await tx.operatorNotificationOutbox.findFirst({ where: { caseId: active.id } });
    await tx.humanQaReviewCase.update({
      where: { id: active.id },
      data: { status: 'superseded', activeKey: null },
    });
    const inserted = await insertCaseWithOutbox(tx, args, plan, now);
    if (inserted.created) {
      await tx.humanQaReviewCase.update({
        where: { id: active.id },
        data: { supersededByCaseId: inserted.caseId },
      });
      if (oldOutbox && oldOutbox.sendAttempted === false && oldOutbox.status !== 'suppressed') {
        await tx.operatorNotificationOutbox.update({
          where: { id: oldOutbox.id },
          data: { status: 'suppressed' },
        });
      }
    }
    return {
      caseId: inserted.caseId,
      revision: inserted.revision,
      action: inserted.created ? 'supersede' : 'idempotent',
      outboxId: inserted.outboxId,
    };
  }

  // create
  const inserted = await insertCaseWithOutbox(tx, args, plan, now);
  return {
    caseId: inserted.caseId,
    revision: inserted.revision,
    action: inserted.created ? 'create' : 'idempotent',
    outboxId: inserted.outboxId,
  };
}

/**
 * Close the active case for (orderId, scope) on release IFF its kind is in the allowlist. Used by the
 * anchor-release endpoint (later unit) gated on `kinds:['anchor']`, so it can NEVER release a safety /
 * contract_world / payment_integrity case. Resolving also suppresses the case's still-unsent outbox. No active
 * case, or a kind outside the allowlist → no-op returns null.
 */
export async function resolveHumanQaCaseOnReleaseInTx(
  tx: Tx,
  args: {
    orderId: string;
    scope: string;
    kinds: HumanQaHoldKind[];
    actor: string;
    note?: string;
    now?: Date;
  },
): Promise<{ resolvedCaseId: string | null }> {
  const now = args.now ?? new Date();
  const activeKey = activeKeyFor(args.orderId, args.scope);

  const active = await tx.humanQaReviewCase.findUnique({ where: { activeKey } });
  if (!active || active.status !== 'open' || !args.kinds.includes(active.kind)) {
    return { resolvedCaseId: null };
  }

  await tx.humanQaReviewCase.update({
    where: { id: active.id },
    data: {
      status: 'resolved',
      activeKey: null,
      resolvedActor: args.actor,
      resolvedAt: now,
      decisionNote: args.note ?? null,
    },
  });

  const outbox = await tx.operatorNotificationOutbox.findFirst({ where: { caseId: active.id } });
  if (outbox && outbox.sendAttempted === false && outbox.status !== 'suppressed') {
    await tx.operatorNotificationOutbox.update({
      where: { id: outbox.id },
      data: { status: 'suppressed' },
    });
  }

  return { resolvedCaseId: active.id };
}

export type { HumanQaHoldKind, HumanQaReviewCase };
