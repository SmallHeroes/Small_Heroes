/**
 * POST /api/admin/review/cases/[orderId]/actions/inspect-unverified
 *
 * Authenticated Preview-only, provider-free and mutation-free preflight for the exact-byte human-verification
 * ceremony. The response is deliberately redacted: one digest plus canonical page artifact-key sets only.
 */
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminSecret } from '@/lib/admin/assert-generation-secret';
import {
  HumanVerifiedUnverifiedAdmissibilityError,
} from '@/lib/generation-pipeline/human-verified-unverified-release';
import {
  inspectHumanVerifiedUnverifiedRelease,
} from '@/lib/generation-pipeline/human-verified-unverified-preparation';
import { isReadinessManifestEnabled } from '@/lib/generation-pipeline/readiness-manifest';
import { parseSinglePageSafetyUnverifiedMarker } from '@/lib/generation-pipeline/order-authority';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 300;

const SHA256_RE = /^[0-9a-f]{64}$/;
const PAGE_ARTIFACT_RE = /^page:([1-9][0-9]*)$/;
const BODY_KEYS = ['artifactKey', 'assetSha256', 'expectedMarker'] as const;

type RouteContext = { params: Promise<{ orderId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactBodyKeys(body: Record<string, unknown>): boolean {
  const actual = Object.keys(body).sort();
  const expected = [...BODY_KEYS].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
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

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = assertAdminSecret(req);
  if (denied) return denied;
  if (!isRouteEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { orderId: rawOrderId } = await context.params;
  const orderId = rawOrderId?.trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  let decoded: unknown;
  try {
    decoded = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isRecord(decoded) || !hasExactBodyKeys(decoded)) {
    return NextResponse.json(
      { error: 'Request body must contain exactly artifactKey, expectedMarker, assetSha256' },
      { status: 400 },
    );
  }
  const artifactKey = decoded.artifactKey;
  const expectedMarker = decoded.expectedMarker;
  const expectedAssetSha256 = decoded.assetSha256;
  if (
    typeof artifactKey !== 'string' ||
    typeof expectedMarker !== 'string' ||
    typeof expectedAssetSha256 !== 'string'
  ) {
    return NextResponse.json({ error: 'All request fields must be strings' }, { status: 400 });
  }
  const artifactMatch = PAGE_ARTIFACT_RE.exec(artifactKey);
  const marker = parseSinglePageSafetyUnverifiedMarker(expectedMarker);
  if (
    !artifactMatch ||
    !marker ||
    Number(artifactMatch[1]) !== marker.pageNumber ||
    !SHA256_RE.test(expectedAssetSha256)
  ) {
    return NextResponse.json({ error: 'Invalid exact-page inspection request' }, { status: 400 });
  }

  try {
    const result = await inspectHumanVerifiedUnverifiedRelease(prisma, {
      orderId,
      artifactKey,
      expectedMarker,
      expectedAssetSha256,
    });
    return NextResponse.json({
      inspectionDigest: result.inspectionDigest,
      requiredArtifacts: result.requiredArtifacts,
      needsProofArtifacts: result.needsProofArtifacts,
    });
  } catch (error) {
    if (error instanceof HumanVerifiedUnverifiedAdmissibilityError) {
      return NextResponse.json(
        { inspected: false, error: 'Inspection was refused', rule: error.rule },
        { status: 409 },
      );
    }
    throw error;
  }
}
