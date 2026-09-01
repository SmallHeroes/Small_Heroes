import { NextRequest, NextResponse } from 'next/server';

import { handleCheckoutPost } from '@/app/api/checkout/handler';
import {
  canUseFakePayments,
  env,
  isFakePaymentEnabled,
} from '@/lib/env';
import {
  parseWizardProductBindingV1,
  ReleaseV1ContinuityError,
} from '@/lib/generation-pipeline/release-v1-continuity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (
    env.PAYMENT_PROVIDER !== 'fake' ||
    !canUseFakePayments() ||
    !isFakePaymentEnabled()
  ) {
    return NextResponse.json(
      { error: 'release_v1_fake_payment_only' },
      { status: 503 },
    );
  }
  try {
    const body = await req.clone().json();
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
  return handleCheckoutPost(req, { routeProtocol: 'release/v1' });
}
