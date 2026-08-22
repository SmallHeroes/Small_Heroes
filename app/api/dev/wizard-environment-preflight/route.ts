import { NextResponse } from 'next/server';

import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import { buildWizardPreviewEnvironmentPreflight } from '@/lib/generation-pipeline/wizard-preview-environment-preflight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDevEnvironment()) return devOnlyJsonError();

  const result = buildWizardPreviewEnvironmentPreflight();
  return NextResponse.json(result, {
    status: result.status === 'passed' ? 200 : 409,
    headers: { 'Cache-Control': 'no-store' },
  });
}
