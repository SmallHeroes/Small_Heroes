/**
 * POST /api/admin/review/cases/[orderId]/actions/release — the human FALSE-POSITIVE safety release (2a-2).
 *
 * The last operator action that closes the loop: a reviewer who has looked at a `safety_hold:hazard:` image and judged
 * the detector wrong releases it. This is NOT `runOperatorAction` — the release is an all-or-nothing MODE of
 * `commitBaseBookReadiness`: inside ONE transaction it re-checks admissibility on raw data (authority), writes both
 * gate overrides, transitions the marker to `qa_released:safety:`, closes the safety case, audits, and ships via the
 * shared readiness ship CAS + Outbox. If admissibility fails or a competing hold blocks the ship, the whole thing
 * rolls back — 409, nothing written. Idempotency is the marker CAS (a replay finds `qa_released:` → refused), so no
 * Idempotency-Key is required. Auth: GENERATION_SECRET header/Bearer (the same gate as the other review routes).
 */
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminSecret } from '@/lib/admin/assert-generation-secret';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { commitBaseBookReadiness, isReadinessManifestEnabled, ReleasePreconditionError } from '@/lib/generation-pipeline/readiness-manifest';
import { ReleaseAdmissibilityError, ReleaseAlreadyCommittedError, type SafetyReleaseRequest } from '@/lib/generation-pipeline/safety-release';
import { syncHumanQaHoldCasePostCommit } from '@/lib/human-qa/sync-hold-case';

const log = createLogger({ subsystem: 'safety-release', route: '/api/admin/review/cases/[orderId]/actions/release' });
const SHA256_RE = /^[0-9a-f]{64}$/;
const ARTIFACT_RE = /^(cover|page:[1-9][0-9]*)$/;

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = assertAdminSecret(req); // header/Bearer only
  if (denied) return denied;

  const { orderId } = await context.params;
  if (!orderId?.trim()) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  if (!isReadinessManifestEnabled()) {
    return NextResponse.json({ error: 'Release requires the readiness delivery path (READINESS_MANIFEST_ENABLED)' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  // Validate the request SHAPE before touching the DB (admissibility re-checks the SEMANTICS on raw data in-tx).
  const artifactKey = typeof body.artifactKey === 'string' ? body.artifactKey : '';
  const expectedMarker = typeof body.expectedMarker === 'string' ? body.expectedMarker : '';
  const assetSha256 = typeof body.assetSha256 === 'string' ? body.assetSha256 : '';
  const overrideReason = typeof body.overrideReason === 'string' ? body.overrideReason.trim() : '';
  const overriddenHazards = Array.isArray(body.overriddenHazards) && body.overriddenHazards.every((h) => typeof h === 'string')
    ? (body.overriddenHazards as string[]) : null;
  const note = typeof body.note === 'string' ? body.note : null;
  const actor = typeof body.actor === 'string' && body.actor.trim() ? body.actor.trim() : 'admin:safety_release';

  if (!ARTIFACT_RE.test(artifactKey)) return NextResponse.json({ error: 'artifactKey must be "cover" or "page:<n>"' }, { status: 400 });
  if (!expectedMarker.startsWith('safety_hold:hazard:')) return NextResponse.json({ error: 'expectedMarker must begin safety_hold:hazard: (never unverified)' }, { status: 400 });
  if (!SHA256_RE.test(assetSha256)) return NextResponse.json({ error: 'assetSha256 must be a lowercase 64-hex SHA-256' }, { status: 400 });
  if (!overriddenHazards || overriddenHazards.length === 0) return NextResponse.json({ error: 'overriddenHazards must be a non-empty string array' }, { status: 400 });
  if (!overrideReason) return NextResponse.json({ error: 'overrideReason (a written reason) is required' }, { status: 400 });

  const release: SafetyReleaseRequest = { artifactKey, expectedMarker, overriddenHazards, assetSha256, overrideReason, actor, note };

  try {
    // (Codex round-5) The commit derives the anchor disposition from its own fresh producing
    // snapshot. A safety release on an order whose FRESH anchor band also holds now correctly
    // refuses to ship (the release ships only when readiness would pass) instead of force-allowing
    // the anchor leg with a caller-supplied `anchorAllowsDelivery: true`.
    const result = await commitBaseBookReadiness(prisma, {
      orderId,
      release,
    });
    if (result.orderStatus !== 'ready' || !result.enqueued) {
      // A release that neither shipped nor threw — surface it (and its reason) rather than reporting a false success.
      log.warn('Safety release did not ship', { orderId, actor, artifactKey, orderStatus: result.orderStatus, reason: result.reason });
      return NextResponse.json({ released: false, reason: result.reason ?? 'not_shipped', orderStatus: result.orderStatus }, { status: 409 });
    }
    // Reconcile the (now-closed) case with the committed ready outcome, best-effort (idempotent).
    await syncHumanQaHoldCasePostCommit(prisma, orderId).catch(() => {});
    log.info('Safety false-positive release shipped', { orderId, actor, artifactKey, hazards: overriddenHazards });
    return NextResponse.json({ released: true, shipped: true, orderStatus: result.orderStatus, manifestStatus: result.manifestStatus });
  } catch (e) {
    // (re-gate P2) REPLAY of a committed release — recognised from durable state (override + audit), NOT the marker.
    // Idempotent success, not a refusal: the first release stands, this attempt wrote nothing (the tx rolled back).
    if (e instanceof ReleaseAlreadyCommittedError) {
      log.info('Safety release replay — already released (idempotent)', { orderId, actor, artifactKey });
      return NextResponse.json({ released: true, alreadyReleased: true, orderStatus: 'ready' }, { status: 200 });
    }
    // (§3/§7) Refusal → a STRUCTURED observability event OUTSIDE the tx (the in-tx audit is release-only). The
    // operator sees WHICH rule refused; Unit-3 instrumentation counts refusals to catch a repeated impossible attempt.
    if (e instanceof ReleaseAdmissibilityError) {
      log.warn('Safety release refused', { orderId, actor, artifactKey, rule: e.rule });
      return NextResponse.json({ released: false, error: e.message, rule: e.rule }, { status: 409 });
    }
    if (e instanceof ReleasePreconditionError || (e as { name?: string })?.name === 'ReleasePreconditionError') {
      const pre = e as ReleasePreconditionError;
      log.warn('Safety release aborted — a competing hold landed after the transition (rolled back)', { orderId, actor, artifactKey, expected: pre.expectedHoldReason, actual: pre.actual });
      return NextResponse.json({ released: false, error: 'a competing hold landed before the ship — released nothing', rule: 'competing_hold' }, { status: 409 });
    }
    log.error('Safety release failed (unexpected)', e, { orderId, actor, artifactKey });
    throw e;
  }
}
