import { NextRequest, NextResponse } from 'next/server';

import { handleOrderPost } from '@/app/api/orders/handler';
import {
  parseWizardProductBindingV1,
  ReleaseV1ContinuityError,
} from '@/lib/generation-pipeline/release-v1-continuity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.clone().json();
    if (typeof body?.sessionId !== 'string' || !body.sessionId.trim()) {
      throw new ReleaseV1ContinuityError(['wizard session id is required']);
    }
    parseWizardProductBindingV1(body?.wizardProductBinding);
  } catch (error) {
    const reasons =
      error instanceof ReleaseV1ContinuityError
        ? error.reasons
        : ['request body is invalid'];
    return NextResponse.json(
      { error: 'release_v1_binding_required', reasons },
      { status: 400 },
    );
  }
  return handleOrderPost(req, { routeProtocol: 'release/v1' });
}
