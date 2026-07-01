/**
 * #7-a Quality gate fail-closed — the durable per-artifact visual-QA evidence layer.
 *
 * One QualityEvidence row per REQUIRED delivered artifact (cover + every page). The render/persist seam
 * writes the verdict + a SHA-256 of the EXACT delivered bytes (presentationUrl ?? url); the readiness commit
 * reads them FAIL-CLOSED via `evaluateQualityGate`. There is NO "assume passed" default and NO production
 * escape hatch: missing / stale / hash-mismatched / non-`passed` evidence BLOCKS delivery.
 *
 * `evaluateQualityGate` is PURE (no DB, no clock, no env) so the anti-bypass matrix is unit-testable; the DB
 * helpers take an injected client/tx.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Bump when the evaluator's semantics change. Evidence carrying an older version is treated as stale (→ BLOCK,
 * re-evaluate) so a semantics change can never deliver on evidence produced by the previous evaluator.
 */
export const QUALITY_EVALUATOR_CONTRACT_VERSION = 'qa-v1';

/** Durable regen budget per artifact: one candidate + at most two replacements is 2 regens (#7-a: 5→2). */
export const QUALITY_REGEN_BUDGET = 2;

export const QUALITY_SCOPE = 'base_book';

export type QualityVerdict = 'passed' | 'failed' | 'evidence_unknown';

export function coverArtifactKey(): string {
  return 'cover';
}
export function pageArtifactKey(pageNumber: number): string {
  return `page:${pageNumber}`;
}

/** The full required artifact set for a book: cover + page:1..expectedPageCount. */
export function requiredArtifactKeys(expectedPageCount: number): string[] {
  const keys = [coverArtifactKey()];
  for (let n = 1; n <= expectedPageCount; n++) keys.push(pageArtifactKey(n));
  return keys;
}

/** A persisted evidence row, projected to the fields the gate reads. */
export interface QualityEvidenceRow {
  artifactKey: string;
  assetSha256: string;
  verdict: string; // stored free-text (CHECK-constrained); an unrecognized value is inadmissible → BLOCK
  evaluatorContractVersion: string;
  reason: string | null;
  regenCount: number;
}

/** Current delivered-bytes hash per artifact, from the integrity gate's `inspect` (the source of truth). */
export type ArtifactHashes = Map<string, string | null>;

export type QualityGateStatus = 'passed' | 'failed' | 'evidence_unknown';

export interface QualityGateResult {
  status: QualityGateStatus;
  /** null only when passed. */
  reason: string | null;
  /** Artifacts with a deterministic, budget-exhausted `failed` verdict on the CURRENT bytes (→ terminal refund). */
  failedArtifacts: string[];
  /** Artifacts that are missing / stale / hash-mismatched / unknown / failed-with-budget-remaining (→ recovery). */
  unknownArtifacts: string[];
  evidence: Record<string, unknown>;
}

/**
 * PURE fail-closed aggregate over the REQUIRED artifacts.
 *
 * Per artifact, given its persisted row and the CURRENT delivered-bytes hash:
 *  - no row                                   → unknown (missing)
 *  - evaluatorContractVersion != current      → unknown (stale_version)  [anti-bypass: old evaluator]
 *  - no current hash, or assetSha256 != it    → unknown (hash_mismatch)  [anti-bypass: a PASS for other bytes
 *                                                cannot authorize the current/delivered image]
 *  - verdict 'passed'                          → passed
 *  - verdict 'failed' & regenCount >= budget   → failed (deterministic, budget spent → terminal)
 *  - verdict 'failed' & regenCount <  budget   → unknown (recoverable: a targeted regen still has budget)
 *  - verdict 'evidence_unknown' / unrecognized → unknown
 *
 * Aggregate: any terminal-failed → 'failed'; else any unknown → 'evidence_unknown'; else 'passed'.
 */
export function evaluateQualityGate(
  requiredKeys: string[],
  rows: QualityEvidenceRow[],
  currentHashes: ArtifactHashes,
  opts: { budget?: number; contractVersion?: string } = {},
): QualityGateResult {
  const budget = opts.budget ?? QUALITY_REGEN_BUDGET;
  const contractVersion = opts.contractVersion ?? QUALITY_EVALUATOR_CONTRACT_VERSION;
  const byKey = new Map(rows.map((r) => [r.artifactKey, r]));

  const failedArtifacts: string[] = [];
  const unknownArtifacts: string[] = [];
  const perArtifact: Record<string, unknown> = {};

  for (const key of requiredKeys) {
    const row = byKey.get(key);
    const currentHash = currentHashes.get(key) ?? null;

    if (!row) {
      unknownArtifacts.push(key);
      perArtifact[key] = { state: 'missing' };
      continue;
    }
    if (row.evaluatorContractVersion !== contractVersion) {
      unknownArtifacts.push(key);
      perArtifact[key] = { state: 'stale_version', have: row.evaluatorContractVersion, want: contractVersion };
      continue;
    }
    if (!currentHash || row.assetSha256 !== currentHash) {
      unknownArtifacts.push(key);
      perArtifact[key] = { state: 'hash_mismatch', evidenceHash: row.assetSha256, currentHash };
      continue;
    }
    if (row.verdict === 'passed') {
      perArtifact[key] = { state: 'passed' };
      continue;
    }
    if (row.verdict === 'failed') {
      if (row.regenCount >= budget) {
        failedArtifacts.push(key);
        perArtifact[key] = { state: 'failed_terminal', reason: row.reason, regenCount: row.regenCount };
      } else {
        unknownArtifacts.push(key);
        perArtifact[key] = { state: 'failed_budget_remaining', reason: row.reason, regenCount: row.regenCount };
      }
      continue;
    }
    // 'evidence_unknown' or any unrecognized verdict string → inadmissible.
    unknownArtifacts.push(key);
    perArtifact[key] = { state: 'evidence_unknown', verdict: row.verdict, reason: row.reason };
  }

  let status: QualityGateStatus;
  let reason: string | null;
  if (failedArtifacts.length > 0) {
    status = 'failed';
    reason = `quality_failed:${failedArtifacts.join(',')}`;
  } else if (unknownArtifacts.length > 0) {
    status = 'evidence_unknown';
    reason = `quality_evidence_unknown:${unknownArtifacts.join(',')}`;
  } else {
    status = 'passed';
    reason = null;
  }
  return { status, reason, failedArtifacts, unknownArtifacts, evidence: { perArtifact, contractVersion, budget } };
}

/** A stable, order-independent hash of the quality evidence — folded into the readiness inputsHash + TOCTOU
 *  fingerprint so an evidence mutation between eval and commit invalidates the manifest (anti-bypass). */
export function qualityEvidenceFingerprint(rows: QualityEvidenceRow[]): string {
  const sorted = [...rows].sort((a, b) => a.artifactKey.localeCompare(b.artifactKey));
  const canonical = sorted.map((r) => [
    r.artifactKey,
    r.assetSha256,
    r.verdict,
    r.evaluatorContractVersion,
    r.regenCount,
  ]);
  return JSON.stringify(canonical);
}

export interface PersistQualityEvidenceArgs {
  orderId: string;
  artifactKey: string;
  assetSha256: string;
  verdict: QualityVerdict;
  reason?: string | null;
  regenCount?: number;
  providerModel?: string | null;
  evidence?: Prisma.InputJsonValue | null;
  evaluatorContractVersion?: string;
  now?: Date;
}

/** Upsert the authoritative evidence row for (orderId, artifactKey). Preserves regenCount unless provided. */
export async function persistQualityEvidence(db: Db, args: PersistQualityEvidenceArgs): Promise<void> {
  const now = args.now ?? new Date();
  const version = args.evaluatorContractVersion ?? QUALITY_EVALUATOR_CONTRACT_VERSION;
  const evidence = (args.evidence ?? undefined) as Prisma.InputJsonValue | undefined;
  await db.qualityEvidence.upsert({
    where: { orderId_artifactKey: { orderId: args.orderId, artifactKey: args.artifactKey } },
    create: {
      orderId: args.orderId,
      artifactKey: args.artifactKey,
      assetSha256: args.assetSha256,
      verdict: args.verdict,
      evaluatorContractVersion: version,
      reason: args.reason ?? null,
      regenCount: args.regenCount ?? 0,
      providerModel: args.providerModel ?? null,
      evidence,
      evaluatedAt: now,
    },
    update: {
      assetSha256: args.assetSha256,
      verdict: args.verdict,
      evaluatorContractVersion: version,
      reason: args.reason ?? null,
      ...(args.regenCount === undefined ? {} : { regenCount: args.regenCount }),
      providerModel: args.providerModel ?? null,
      evidence,
      evaluatedAt: now,
    },
  });
}

/** Load the evidence rows for an order, projected to what the gate reads. */
export async function loadQualityEvidence(db: Db, orderId: string): Promise<QualityEvidenceRow[]> {
  const rows = await db.qualityEvidence.findMany({
    where: { orderId },
    select: {
      artifactKey: true,
      assetSha256: true,
      verdict: true,
      evaluatorContractVersion: true,
      reason: true,
      regenCount: true,
    },
  });
  return rows;
}

/**
 * Durably reserve ONE regen against an artifact's budget BEFORE generating a replacement — so a crash between
 * reserve and render can never reset the budget. Atomic (a conditional increment); returns true iff a regen was
 * granted (regenCount was < budget). The row MUST already exist (the candidate render persists it first).
 * Vision transport retries must NOT call this — only a deterministic QA failure consumes image-regen budget.
 */
export async function reserveQualityRegen(
  db: Db,
  args: { orderId: string; artifactKey: string; budget?: number },
): Promise<boolean> {
  const budget = args.budget ?? QUALITY_REGEN_BUDGET;
  const bumped = await db.qualityEvidence.updateMany({
    where: { orderId: args.orderId, artifactKey: args.artifactKey, regenCount: { lt: budget } },
    data: { regenCount: { increment: 1 } },
  });
  return bumped.count === 1;
}
