import { type NextRequest, NextResponse } from 'next/server';
import path from 'path';

import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import { createPreflightBoardResolverDeps } from '@/lib/generation-chunked/supabase-staging-read-authority';
import { STYLE_IDS } from '@/lib/styles';
import {
  runWizardRuntimeAuthorityPreflight,
  WizardRuntimeAuthorityPreflightError,
} from '@/lib/generation-pipeline/wizard-runtime-authority-preflight';
import { WIZARD_PREVIEW_STAGING_SUPABASE_REF } from '@/lib/generation-pipeline/wizard-preview-environment-preflight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isDevEnvironment()) return devOnlyJsonError();

  const storyKey = req.nextUrl.searchParams.get('storyKey')?.trim() ?? '';
  const styleId =
    req.nextUrl.searchParams.get('styleId')?.trim() ??
    STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK;
  try {
    const repoRoot = process.cwd();
    const result = await runWizardRuntimeAuthorityPreflight(
      {
        repoRoot,
        storyKey,
        styleId,
      },
      {
        boardResolverDeps: createPreflightBoardResolverDeps({
          expectedProjectRef: WIZARD_PREVIEW_STAGING_SUPABASE_REF,
          rootDir: path.join(repoRoot, 'set-identity-boards'),
        }),
      },
    );
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const code =
      error instanceof WizardRuntimeAuthorityPreflightError
        ? error.code
        : 'reference_preflight_failed';
    return NextResponse.json(
      {
        version: 'wizard-runtime-authority-preflight/v1',
        status: 'failed',
        code,
      },
      {
        status: code === 'request_invalid' ? 400 : 409,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
