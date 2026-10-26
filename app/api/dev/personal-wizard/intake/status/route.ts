/**
 * GET /api/dev/personal-wizard/intake/status — whether this signed-in caller may use live intake.
 * Informational for the UI only; the audio/text routes enforce authority themselves.
 */
import { NextRequest, NextResponse } from 'next/server';

import { isDevEnvironment } from '@/lib/dev-only-guard';
import { isPersonalWizardPreviewEnabled } from '@/lib/personal-wizard/flags';
import { NO_STORE, liveIntakeStatus } from '@/lib/personal-wizard/intake-gate';
import { enforceRateLimit } from '@/lib/request-security';
import { localVoiceAccess } from '@/lib/personal-wizard/local-voice-intake-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isDevEnvironment() || !isPersonalWizardPreviewEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }
  const rateLimitError = enforceRateLimit(req, { namespace: 'dev-personal-wizard-intake-status', limit: 30, windowMs: 60_000 });
  if (rateLimitError) return rateLimitError;
  const local = localVoiceAccess(req);
  if (local) return NextResponse.json({ live: !('error' in local), audioOnly: true, reason: 'error' in local ? 'voice_unavailable' : null }, { headers: NO_STORE });
  return NextResponse.json(await liveIntakeStatus(req), { headers: NO_STORE });
}
