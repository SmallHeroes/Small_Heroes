/**
 * POST /api/dev/personal-wizard/intake/audio — live transcription + extraction of one parent
 * recording (P2). Raw audio body; `x-pw-job-id` / `x-pw-draft-id` headers.
 *
 * Refused before the body is read unless: not production (middleware + isDevEnvironment), the
 * explicit preview and live flags, priced models, budget and job ceilings, same origin, rate limit,
 * and a signed-in operator session. The body is read with a hard byte ceiling. Audio exists in
 * memory and in one private temporary file for the duration measurement, removed in `finally`. Nothing is
 * persisted and no transcript, fact or email is logged.
 */
import { NextRequest, NextResponse } from 'next/server';

import { LIMITS } from '@/lib/personal-wizard/contract';
import { measureAudioDuration } from '@/lib/personal-wizard/audio-probe';
import { NO_STORE, gateLiveIntake, readBodyWithLimit } from '@/lib/personal-wizard/intake-gate';
import { getIntakeLedger } from '@/lib/personal-wizard/intake-ledger';
import { createOpenAiIntakeProvider } from '@/lib/personal-wizard/intake-openai';
import { runAudioIntake } from '@/lib/personal-wizard/intake-service';
import { resolvePersonalWizardOptions } from '@/lib/personal-wizard/options';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const access = await gateLiveIntake(req);
  if (!access.ok) return access.response;

  const declaredLength = Number(req.headers.get('content-length') ?? 'NaN');
  if (Number.isFinite(declaredLength) && declaredLength > LIMITS.recordingMaxBytes) {
    return NextResponse.json({ error: 'too_large' }, { status: 413, headers: NO_STORE });
  }
  const bytes = await readBodyWithLimit(req, LIMITS.recordingMaxBytes);
  if (!bytes) return NextResponse.json({ error: 'too_large' }, { status: 413, headers: NO_STORE });

  const ledger = getIntakeLedger();
  const outcome = await runAudioIntake(
    {
      createProvider: () => createOpenAiIntakeProvider(access.config),
      ledger,
      config: access.config,
      measureAudio: (audio, container, maxDurationMs) => measureAudioDuration(audio, container, { maxDurationMs }),
      topics: resolvePersonalWizardOptions().topics,
    },
    {
      userId: access.userId,
      jobId: req.headers.get('x-pw-job-id') ?? '',
      draftId: req.headers.get('x-pw-draft-id') ?? '',
      declaredType: req.headers.get('content-type') ?? '',
      bytes,
      signal: req.signal,
    },
  );
  console.info(
    JSON.stringify({
      event: 'personal_wizard_intake',
      kind: 'audio',
      outcome: outcome.ok ? 'ok' : outcome.code,
      reservedUsd: outcome.ok ? Number(outcome.reservedUsd.toFixed(6)) : undefined,
      // Usage-based estimate and each provider call (numbers only): not a bill, not the reservation.
      estimatedUsd: outcome.ok && outcome.estimatedUsd !== null ? Number(outcome.estimatedUsd.toFixed(6)) : undefined,
      calls: outcome.calls,
      ledger: ledger.snapshot(),
    }),
  );
  if (!outcome.ok) return NextResponse.json({ error: outcome.code }, { status: outcome.status, headers: NO_STORE });
  return NextResponse.json(outcome.result, { headers: NO_STORE });
}
