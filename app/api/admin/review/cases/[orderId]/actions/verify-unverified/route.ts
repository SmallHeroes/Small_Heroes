/**
 * POST /api/admin/review/cases/[orderId]/actions/verify-unverified
 *
 * Preview-only exact-byte human verification for exactly one `safety_hold:unverified:page:N` artifact. This route is
 * deliberately separate from the confirmed-hazard false-positive release route: it never accepts a hazard marker,
 * never takes an actor from the request, and delegates all DB authority/evidence checks to preparation + readiness.
 */
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminSecret } from '@/lib/admin/assert-generation-secret';
import { prisma } from '@/lib/prisma';
import {
  commitBaseBookReadiness,
  isReadinessManifestEnabled,
  ReleasePreconditionError,
} from '@/lib/generation-pipeline/readiness-manifest';
import {
  abortPreparedHumanVerifiedUnverifiedRelease,
  prepareHumanVerifiedUnverifiedRelease,
} from '@/lib/generation-pipeline/human-verified-unverified-preparation';
import {
  HumanVerifiedUnverifiedAdmissibilityError,
  type HumanVerifiedUnverifiedReleaseRequest,
} from '@/lib/generation-pipeline/human-verified-unverified-release';
import { parseSinglePageSafetyUnverifiedMarker } from '@/lib/generation-pipeline/order-authority';

export const runtime = 'nodejs';
export const maxDuration = 300;

const ACTOR = 'admin:exact_byte_human_verification';
const SHA256_RE = /^[0-9a-f]{64}$/;
const PAGE_ARTIFACT_RE = /^page:([1-9][0-9]*)$/;
const BODY_KEYS = ['artifactKey', 'assetSha256', 'expectedMarker', 'inspectionDigest', 'reviewReason'] as const;

type RouteContext = { params: Promise<{ orderId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactBodyKeys(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body).sort();
  const expected = [...BODY_KEYS].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function isRouteEnabled(): boolean {
  return (
    process.env.VERCEL_ENV === 'preview' &&
    process.env.ALLOW_STAGING_QA === 'true' &&
    process.env.HUMAN_VERIFIED_UNVERIFIED_RELEASE_ENABLED === 'true' &&
    isReadinessManifestEnabled() &&
    process.env.QA_SOFT_DELIVER !== 'true'
  );
}

function hidden(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

function isSuccessfulDelivery(result: {
  manifestStatus: string;
  orderStatus: string;
  enqueued: boolean;
}): boolean {
  return result.manifestStatus === 'passed' && result.orderStatus === 'ready' && result.enqueued === true;
}

function successResponse(): NextResponse {
  return NextResponse.json({
    verified: true,
    shipped: true,
    manifestStatus: 'passed',
    orderStatus: 'ready',
  });
}

function notReadyResponse(): NextResponse {
  return NextResponse.json(
    { verified: false, error: 'Verification did not produce a ready delivery', rule: 'not_ready' },
    { status: 409 },
  );
}

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  // Authentication is intentionally first: no params, body, service, or DB work occurs for an unauthenticated call.
  const denied = assertAdminSecret(req);
  if (denied) return denied;

  // This is a narrow Preview ceremony, never a local-development or Production API. Every switch fails closed.
  if (!isRouteEnabled()) return hidden();

  const { orderId: rawOrderId } = await context.params;
  const orderId = rawOrderId?.trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  const idempotencyKey = req.headers.get('Idempotency-Key')?.trim();
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'Idempotency-Key header required' }, { status: 400 });
  }

  let decoded: unknown;
  try {
    decoded = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isRecord(decoded) || !hasExactBodyKeys(decoded)) {
    return NextResponse.json({ error: 'Request body must contain exactly artifactKey, expectedMarker, assetSha256, inspectionDigest, reviewReason' }, { status: 400 });
  }

  const artifactKey = decoded.artifactKey;
  const expectedMarker = decoded.expectedMarker;
  const expectedAssetSha256 = decoded.assetSha256;
  const inspectionDigest = decoded.inspectionDigest;
  const rawReviewReason = decoded.reviewReason;
  if (
    typeof artifactKey !== 'string' ||
    typeof expectedMarker !== 'string' ||
    typeof expectedAssetSha256 !== 'string' ||
    typeof inspectionDigest !== 'string' ||
    typeof rawReviewReason !== 'string'
  ) {
    return NextResponse.json({ error: 'All request fields must be strings' }, { status: 400 });
  }

  const artifactMatch = PAGE_ARTIFACT_RE.exec(artifactKey);
  const artifactPage = artifactMatch ? Number(artifactMatch[1]) : NaN;
  if (!artifactMatch || !Number.isSafeInteger(artifactPage)) {
    return NextResponse.json({ error: 'artifactKey must be one canonical page:<n>' }, { status: 400 });
  }
  const marker = parseSinglePageSafetyUnverifiedMarker(expectedMarker);
  if (!marker) {
    return NextResponse.json({ error: 'expectedMarker must be one canonical safety_hold:unverified:page:<n> marker' }, { status: 400 });
  }
  if (artifactPage !== marker.pageNumber) {
    return NextResponse.json({ error: 'artifactKey and expectedMarker must identify the same page' }, { status: 400 });
  }
  if (!SHA256_RE.test(expectedAssetSha256)) {
    return NextResponse.json({ error: 'assetSha256 must be a lowercase 64-hex SHA-256' }, { status: 400 });
  }
  if (!SHA256_RE.test(inspectionDigest)) {
    return NextResponse.json({ error: 'inspectionDigest must be a lowercase 64-hex SHA-256' }, { status: 400 });
  }
  const reviewReason = rawReviewReason.trim();
  if (!reviewReason) {
    return NextResponse.json({ error: 'reviewReason is required' }, { status: 400 });
  }

  let preparedRequest: HumanVerifiedUnverifiedReleaseRequest | null = null;
  try {
    const prepared = await prepareHumanVerifiedUnverifiedRelease(prisma, {
      orderId,
      inspectionDigest,
      artifactKey,
      expectedMarker,
      expectedAssetSha256,
      reviewReason,
      actor: ACTOR,
      idempotencyKey,
    });
    if (prepared.alreadyCommitted !== undefined) {
      return isSuccessfulDelivery(prepared.alreadyCommitted) ? successResponse() : notReadyResponse();
    }
    preparedRequest = prepared.request;
    const result = await commitBaseBookReadiness(prisma, {
      orderId,
      humanVerifiedUnverifiedRelease: preparedRequest,
    });
    if (isSuccessfulDelivery(result)) return successResponse();
    await abortPreparedHumanVerifiedUnverifiedRelease(prisma, {
      orderId,
      request: preparedRequest,
      rule: 'not_ready',
    }).catch(() => false);
    return notReadyResponse();
  } catch (error) {
    if (error instanceof HumanVerifiedUnverifiedAdmissibilityError) {
      if (preparedRequest) {
        await abortPreparedHumanVerifiedUnverifiedRelease(prisma, {
          orderId,
          request: preparedRequest,
          rule: error.rule,
        }).catch(() => false);
      }
      return NextResponse.json(
        { verified: false, error: 'Human verification was refused', rule: error.rule },
        { status: 409 },
      );
    }
    if (error instanceof ReleasePreconditionError) {
      if (preparedRequest) {
        await abortPreparedHumanVerifiedUnverifiedRelease(prisma, {
          orderId,
          request: preparedRequest,
          rule: 'competing_hold',
        }).catch(() => false);
      }
      return NextResponse.json(
        { verified: false, error: 'Order authority changed before delivery', rule: 'competing_hold' },
        { status: 409 },
      );
    }
    throw error;
  }
}
