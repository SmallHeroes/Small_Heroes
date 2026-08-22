import { type NextRequest, NextResponse } from 'next/server';

import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import {
  runWizardPreorderAttestation,
  WIZARD_PREORDER_DEFAULT_STYLE_ID,
} from '@/lib/generation-pipeline/wizard-preorder-attestation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isDevEnvironment()) return devOnlyJsonError();

  const storyKey = req.nextUrl.searchParams.get('storyKey')?.trim() ?? '';
  const styleId =
    req.nextUrl.searchParams.get('styleId')?.trim() ??
    WIZARD_PREORDER_DEFAULT_STYLE_ID;
  const result = await runWizardPreorderAttestation({
    repoRoot: process.cwd(),
    storyKey,
    styleId,
  });
  return NextResponse.json(result, {
    status:
      result.status === 'passed'
        ? 200
        : result.reasons.includes('request_invalid')
          ? 400
          : 409,
    headers: { 'Cache-Control': 'no-store' },
  });
}
