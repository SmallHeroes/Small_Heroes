import 'server-only';

import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import {
  attemptStatus,
  type AuditionAttempt,
} from '@/lib/personal-wizard/simple-book-reviewed-audition';
import {
  authorityDigest, bookDigest, boundBookManifest, digestSchema, engineSiteFail,
  identifierSchema, utcSchema,
    type EngineOrderAuthority,
} from './contract';

/** This is a subset of engine output AFTER raw review/context/byte admission, never public input. */
export type AdmittedFrame = {
  pageNumber: number;
  attempt: Pick<AuditionAttempt, 'candidate' | 'assessment' | 'identity'>;
};

export type AutomaticAcceptance = ReturnType<typeof evaluateAutomaticAcceptance>;

/**
 * Project the existing engine rule; do not add a second pixel judge. The caller must admit raw
 * reviews/reference/scale evidence using the engine before supplying frames. This function
 * cannot attest the truth of external evidence, decode assets, or promote an audition to production.
 */
export function evaluateAutomaticAcceptance(input: {
  authority: EngineOrderAuthority;
  manifest: unknown;
  frames: readonly AdmittedFrame[];
  prerequisiteHolds: readonly string[];
}) {
  const book = boundBookManifest(input.authority, input.manifest);
  const holds = new Set(input.prerequisiteHolds.map(reason => identifierSchema.parse(reason)));
  if (input.frames.length !== 9 || input.frames.some((frame, index) => frame.pageNumber !== index)) {
    holds.add('engine_frame_coverage');
  }
  for (const frame of input.frames) {
    const page = book.pages[frame.pageNumber];
    if (!page || frame.attempt.candidate?.imageSha !== page.imageSha256) {
      holds.add('engine_candidate_binding');
      continue;
    }
    // Same identity 0.70, safety, materiality and citation policy as the native engine.
    // Fine-detail findings remain in its stored evidence and do not block this result.
    try {
      if (attemptStatus('page', frame.attempt) !== 'qa_supported') holds.add('engine_page_held');
    } catch { holds.add('engine_evidence_unusable'); }
  }
  const holdReasons = [...holds].sort();
  return Object.freeze({
    version: 'engine-site-automatic-acceptance/v1' as const,
    orderId: book.orderId,
    authoritySha256: authorityDigest(input.authority),
    bookSha256: bookDigest(book),
    status: holdReasons.length ? 'held' as const : 'accepted' as const,
    holdReasons,
  });
}

export const launchGatePolicySchema = z.object({
  version: z.literal('engine-site-launch-gate/v1'),
  revision: identifierSchema,
  mode: z.enum(['required', 'off']),
  changedBy: identifierSchema,
  changedAt: utcSchema,
  reason: z.string().trim().min(1).max(500),
}).strict();
export type LaunchGatePolicy = z.infer<typeof launchGatePolicySchema>;

export const operatorDecisionSchema = z.object({
  version: z.literal('engine-site-operator-decision/v1'),
  orderId: identifierSchema,
  authoritySha256: digestSchema,
  bookSha256: digestSchema,
  sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  previousDecisionSha256: digestSchema.nullable(),
  policySha256: digestSchema,
  decision: z.enum(['approve', 'reject']),
  actorId: identifierSchema,
  decidedAt: utcSchema,
  reason: z.string().trim().min(1).max(500),
}).strict();
export type OperatorDecision = z.infer<typeof operatorDecisionSchema>;
export const policyDigest = (policy: LaunchGatePolicy) => canonicalHash(launchGatePolicySchema.parse(policy));
export const operatorDecisionDigest = (decision: OperatorDecision) => canonicalHash(operatorDecisionSchema.parse(decision));

/** The repository supplies the full append-only history under an Order lock, not an arbitrary latest flag. */
export function validateDecisionHistory(orderId: string, authoritySha256: string, raw: readonly unknown[]) {
  const history = raw.map(decision => operatorDecisionSchema.parse(decision));
  for (const [index, decision] of history.entries()) {
    if (decision.orderId !== orderId || decision.authoritySha256 !== authoritySha256 ||
        decision.sequence !== index + 1 ||
        decision.previousDecisionSha256 !== (index === 0 ? null : operatorDecisionDigest(history[index - 1])) ||
        (index > 0 && decision.decidedAt < history[index - 1].decidedAt)) {
      engineSiteFail('operator_history_invalid');
    }
  }
  return history;
}

/** Authenticated server routes supply actor + time. This helper grants no authentication by itself. */
export function nextOperatorDecision(input: {
  authority: EngineOrderAuthority;
  manifest: unknown;
  policy: LaunchGatePolicy;
  history: readonly unknown[];
  actorId: string;
  now: Date;
  decision: 'approve' | 'reject';
  reason: string;
}): OperatorDecision {
  const book = boundBookManifest(input.authority, input.manifest);
  const digest = authorityDigest(input.authority);
  const history = validateDecisionHistory(book.orderId, digest, input.history);
  const previous = history[history.length - 1];
  const decision = operatorDecisionSchema.parse({
    version: 'engine-site-operator-decision/v1', orderId: book.orderId,
    authoritySha256: digest, bookSha256: bookDigest(book), sequence: history.length + 1,
    previousDecisionSha256: previous ? operatorDecisionDigest(previous) : null,
    policySha256: policyDigest(input.policy), decision: input.decision,
    actorId: input.actorId, decidedAt: input.now.toISOString(), reason: input.reason,
  });
  validateDecisionHistory(book.orderId, digest, [...history, decision]);
  return decision;
}

/**
 * An extra gate above automatic acceptance, shared by readiness AND send-time recheck.
 * It returns eligibility only: payment/readiness/fence CAS still own delivery. Malformed or
 * absent policy fails closed. Turning off review never overrides explicit rejection.
 */
export function evaluateLaunchDeliveryGate(input: {
  authority: EngineOrderAuthority;
  manifest: unknown;
  automatic: AutomaticAcceptance;
  policy: unknown;
  history: readonly unknown[];
}) {
  const book = boundBookManifest(input.authority, input.manifest);
  const contentSha256 = bookDigest(book), authSha256 = authorityDigest(input.authority);
  const history = validateDecisionHistory(book.orderId, authSha256, input.history);
  const parsed = launchGatePolicySchema.safeParse(input.policy);
  const automatic = input.automatic;
  const reasons: string[] = [];
  if (automatic.version !== 'engine-site-automatic-acceptance/v1' || automatic.orderId !== book.orderId ||
      automatic.authoritySha256 !== authSha256 || automatic.bookSha256 !== contentSha256 ||
      automatic.status !== 'accepted' || automatic.holdReasons.length !== 0) reasons.push('automatic_acceptance_held');
  if (input.authority.purpose !== 'customer') reasons.push('test_book_not_deliverable');
  if (!parsed.success) reasons.push('launch_policy_unavailable');
  const latest = history[history.length - 1];
  // Explicit rejection is a domain hold until a later audited decision, even after content changes or gate-off.
  if (latest?.decision === 'reject') reasons.push('operator_rejected');
  if (parsed.success && parsed.data.mode === 'required' &&
      (!latest || latest.decision !== 'approve' || latest.bookSha256 !== contentSha256 ||
       latest.policySha256 !== policyDigest(parsed.data))) reasons.push('operator_review_required');
  return Object.freeze({
    version: 'engine-site-delivery-gate-result/v1' as const,
    orderId: book.orderId, bookSha256: contentSha256,
    automaticSha256: canonicalHash(automatic),
    policySha256: parsed.success ? policyDigest(parsed.data) : null,
    latestDecisionSha256: latest ? operatorDecisionDigest(latest) : null,
    eligible: reasons.length === 0, holdReasons: reasons,
  });
}

/** Bind this token into readiness/final-send authority; any new book, policy or decision invalidates it. */
export const launchDeliveryFenceDigest = (result: ReturnType<typeof evaluateLaunchDeliveryGate>) => canonicalHash(result);
