import { NextResponse } from 'next/server';

import {
  resolveStoryProductTruth,
  StoryProductResolutionError,
} from '@/backend/providers/story-product-resolver';
import {
  assertReleaseV1OperationalAdmission,
  buildWizardProductBindingV1,
  releaseV1DeploymentDiagnostics,
  ReleaseV1ContinuityError,
} from '@/lib/generation-pipeline/release-v1-continuity';
import { mapStyleToDatabaseValue } from '@/lib/styles';
import { runWizardPreorderAttestation } from '@/lib/generation-pipeline/wizard-preorder-attestation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    assertReleaseV1OperationalAdmission();
    const illustrationStyle = mapStyleToDatabaseValue(
      searchParams.get('illustrationStyle'),
    );
    const resolved = resolveStoryProductTruth({
      companionId: searchParams.get('companionId'),
      clientDirection: searchParams.get('direction'),
      legacyLength: searchParams.get('length'),
      challengeCategory: searchParams.get('challengeCategory'),
      illustrationStyle,
    });
    if (
      resolved.source !== 'visual_package_v4' ||
      !resolved.visualPackageAuthority ||
      !resolved.storyFile
    ) {
      return NextResponse.json(
        { error: 'release_v1_visual_package_required' },
        { status: 422, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const binding = buildWizardProductBindingV1(
      resolved.visualPackageAuthority,
    );
    const attestation = await runWizardPreorderAttestation({
      repoRoot: process.cwd(),
      storyKey: binding.storyKey,
      styleId: binding.styleId,
    });
    const runtimeAuthority = attestation.runtimeAuthority;
    if (
      attestation.status !== 'passed' ||
      runtimeAuthority.status !== 'passed' ||
      runtimeAuthority.storyKey !== binding.storyKey ||
      runtimeAuthority.styleId !== binding.styleId ||
      runtimeAuthority.packageRevisionDigest !==
        binding.packageRevisionDigest ||
      runtimeAuthority.packageAuthorityDigest !==
        binding.packageAuthorityDigest ||
      runtimeAuthority.sourceRawDigest !== binding.sourceRawDigest
    ) {
      return NextResponse.json(
        {
          error: 'release_v1_preorder_authority_not_ready',
          reasons: attestation.reasons,
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      {
        direction: resolved.storyDirection,
        pages: resolved.pages,
        displayPages: resolved.displayPages,
        priceILS: resolved.priceILS,
        source: resolved.source,
        binding,
        deployment: releaseV1DeploymentDiagnostics(),
        authority: {
          attestationVersion: attestation.version,
          runtimeVersion: runtimeAuthority.version,
          contractHash: runtimeAuthority.contractHash,
          blueprintDigest: runtimeAuthority.blueprintDigest,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof ReleaseV1ContinuityError) {
      return NextResponse.json(
        { error: error.code, reasons: error.reasons },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (error instanceof StoryProductResolutionError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.httpStatus,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }
    console.error('[GET /api/release/v1/preorder]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
