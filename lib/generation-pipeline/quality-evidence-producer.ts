/**
 * #7-a 5a — the Quality-evidence PRODUCER seam. After the delivered bytes of an artifact are finalized
 * (post presentation transform for pages; the raw url for the cover), attach a durable Vision verdict for
 * THOSE exact bytes and persist a QualityEvidence row.
 *
 * Carry-ins honored:
 *  #1 SEMANTIC BYTE BINDING — the verdict must be for the DELIVERED bytes (presentationUrl ?? url). When a
 *     presentation transform changed the bytes (color-normalization / warm bias / WebP re-encode), we re-run
 *     Vision on the delivered image; a raw verdict is NEVER attached to a presentation hash.
 *  #2 the cover verdict is GENUINE (the cover's own QA verdict, or a re-QA) — never a synthesized PASS.
 *  #3 assetSha256 = inspectAsset(deliveredUrl).sha256 (the exact delivered bytes) so it equals what the
 *     readiness gate re-computes.
 *  #4 the persist does NOT set regenCount — the DB-reserved value (5b) is the source of truth and is preserved.
 *
 * Flag-gated by READINESS_MANIFEST_ENABLED (flag OFF → no-op; the legacy render path is unchanged).
 */
import type { PrismaClient, Prisma } from '@prisma/client';
import { inspectAsset, type AssetInspection } from './asset-integrity';
import { evaluatePageVisualQa, type PageVisualQaResult } from './page-visual-qa';
import { persistQualityEvidence, type QualityVerdict } from './quality-evidence';
import { isReadinessManifestEnabled } from './readiness-manifest';

type Db = PrismaClient | Prisma.TransactionClient;

export interface QaContext {
  expectsChild: boolean;
  expectsCompanion: boolean;
  expectedPageTimeOfDay: import('@/lib/story-time-of-day').StoryTimeOfDay | null;
  isEmotionalClosing: boolean;
  hasStructuredObjects: boolean;
  hasRailedBedOrCrib: boolean;
  hasHumanFamily: boolean;
}

export interface DeliveredEvidenceArgs {
  orderId: string;
  /** 'cover' | 'page:<n>' — from quality-evidence artifact-key helpers. */
  artifactKey: string;
  /** The exact bytes the customer receives: presentationUrl ?? url (null only on a broken render). */
  deliveredUrl: string | null;
  /** True when a presentation transform produced `deliveredUrl` (its bytes differ from the raw render). */
  presentationApplied: boolean;
  /** The in-loop verdict for the RAW render — reused ONLY when the delivered bytes equal the raw bytes. */
  rawVerdict: QualityVerdict | undefined;
  /** QA context captured at render time, so a delivered-bytes re-QA runs the same checks. */
  qaContext: QaContext | undefined;
  providerModel?: string | null;
  /** In-memory attempt count for observability only — NOT the durable regen budget (carry-in #4). */
  regenAttempts?: number | null;
}

export interface ProducerDeps {
  evaluate?: (input: Parameters<typeof evaluatePageVisualQa>[0]) => Promise<PageVisualQaResult>;
  inspect?: (url: string | null | undefined) => Promise<AssetInspection>;
}

/**
 * Resolve the durable verdict for the delivered bytes:
 *  - presentation transform applied → RE-QA the delivered image (never reuse the raw verdict). Carry-in #1.
 *  - no transform (delivered == raw) → reuse the genuine in-loop verdict for the same bytes.
 * Missing url / missing context / missing raw verdict → evidence_unknown (fail-closed, never a synthesized PASS).
 */
async function resolveDeliveredVerdict(
  args: DeliveredEvidenceArgs,
  evaluate: NonNullable<ProducerDeps['evaluate']>,
): Promise<{ verdict: QualityVerdict; reason: string | null }> {
  if (!args.deliveredUrl) return { verdict: 'evidence_unknown', reason: 'no_delivered_url' };
  if (args.presentationApplied) {
    if (!args.qaContext) return { verdict: 'evidence_unknown', reason: 'qa_context_missing' };
    const qa = await evaluate({ imageUrl: args.deliveredUrl, ...args.qaContext });
    return { verdict: qa.verdict, reason: qa.reason };
  }
  if (!args.rawVerdict) return { verdict: 'evidence_unknown', reason: 'raw_verdict_missing' };
  return { verdict: args.rawVerdict, reason: null };
}

export async function persistDeliveredQualityEvidence(
  db: Db,
  args: DeliveredEvidenceArgs,
  deps: ProducerDeps = {},
): Promise<void> {
  if (!isReadinessManifestEnabled()) return; // flag OFF → legacy path unchanged
  const inspect = deps.inspect ?? inspectAsset;
  const evaluate = deps.evaluate ?? evaluatePageVisualQa;

  let { verdict, reason } = await resolveDeliveredVerdict(args, evaluate);

  // Carry-in #3: bind the verdict to the EXACT delivered bytes. If the bytes can't be hashed, the verdict can't
  // be trusted → evidence_unknown, and the empty hash guarantees a mismatch at readiness (fail-closed).
  const inspection = await inspect(args.deliveredUrl);
  const assetSha256 = inspection.sha256 ?? '';
  if (!inspection.sha256) {
    verdict = 'evidence_unknown';
    reason = reason ?? `asset_inspect:${inspection.error ?? 'no_hash'}`;
  }

  await persistQualityEvidence(db, {
    orderId: args.orderId,
    artifactKey: args.artifactKey,
    assetSha256,
    verdict,
    reason,
    providerModel: args.providerModel ?? null,
    // regenCount intentionally omitted — the DB-reserved budget (5b) is authoritative and preserved (carry-in #4).
    // (#7-a 6) Persist the delivered URL + QA context so the exception-processor can RE-QA the SAME bytes
    // (zero renders) with the same checks during recovery.
    evidence: {
      presentationApplied: args.presentationApplied,
      regenAttempts: args.regenAttempts ?? null,
      deliveredUrl: args.deliveredUrl,
      qaContext: args.qaContext ?? null,
    } as unknown as Prisma.InputJsonValue,
  });
}
