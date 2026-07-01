/**
 * #7-a 6 — exception-processor recovery for infra_transient(quality_evidence_unknown).
 *
 * Re-QA the SAME delivered bytes (ZERO renders — inspectAsset + evaluatePageVisualQa on the STORED url) for
 * every inadmissible QualityEvidence row (verdict evidence_unknown, or a stale evaluatorContractVersion) and
 * persist the refreshed verdict (the persist preserves the DB-reserved regenCount, carry-in #4). The refreshed
 * verdicts then feed the existing recommit:
 *   - all required artifacts now `passed`  → readiness passes → the recovery case resolves;
 *   - a `failed`-after-budget artifact      → the readiness commit opens quality_failed, which UPGRADES this
 *                                             infra_transient case (precedence 1→6) → refund_pending;
 *   - a persistent evidence_unknown / a failed-with-budget → readiness re-blocks → the case retries until the
 *                                             recovery budget (EXCEPTION_MAX_RECOVERY_ATTEMPTS) is spent → refund.
 */
import type { PrismaClient } from '@prisma/client';
import {
  persistDeliveredQualityEvidence,
  type QaContext,
  type ProducerDeps,
} from './quality-evidence-producer';
import { QUALITY_EVALUATOR_CONTRACT_VERSION } from './quality-evidence';

export interface QualityRecoveryResult {
  reQaCount: number;
  nowPassed: string[];
  nowFailed: string[];
  stillUnknown: string[];
}

/** Re-QA the inadmissible evidence rows of an order against their STORED delivered bytes (no re-render). */
export async function reQaUnknownQualityEvidence(
  prisma: PrismaClient,
  orderId: string,
  deps: ProducerDeps = {},
): Promise<QualityRecoveryResult> {
  const rows = await prisma.qualityEvidence.findMany({
    where: { orderId },
    select: { artifactKey: true, verdict: true, evaluatorContractVersion: true, evidence: true },
  });
  const result: QualityRecoveryResult = { reQaCount: 0, nowPassed: [], nowFailed: [], stillUnknown: [] };
  for (const row of rows) {
    // A durable passed/failed on the CURRENT evaluator is authoritative — only re-QA the inadmissible rows.
    const stale = row.evaluatorContractVersion !== QUALITY_EVALUATOR_CONTRACT_VERSION;
    if (row.verdict !== 'evidence_unknown' && !stale) continue;

    const ev = (row.evidence ?? {}) as { deliveredUrl?: string | null; qaContext?: QaContext | null };
    result.reQaCount += 1;
    // presentationApplied=true forces a fresh Vision pass on the STORED delivered URL (never reuse a raw
    // verdict); the producer computes assetSha256 = inspect(deliveredUrl).sha256 and preserves regenCount.
    await persistDeliveredQualityEvidence(
      prisma,
      {
        orderId,
        artifactKey: row.artifactKey,
        deliveredUrl: ev.deliveredUrl ?? null,
        presentationApplied: true,
        rawVerdict: undefined,
        qaContext: ev.qaContext ?? undefined,
        regenAttempts: null,
      },
      deps,
    );

    const fresh = await prisma.qualityEvidence.findUnique({
      where: { orderId_artifactKey: { orderId, artifactKey: row.artifactKey } },
      select: { verdict: true },
    });
    if (fresh?.verdict === 'passed') result.nowPassed.push(row.artifactKey);
    else if (fresh?.verdict === 'failed') result.nowFailed.push(row.artifactKey);
    else result.stillUnknown.push(row.artifactKey);
  }
  return result;
}
