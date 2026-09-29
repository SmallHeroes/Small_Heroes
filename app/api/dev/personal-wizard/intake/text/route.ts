/**
 * POST /api/dev/personal-wizard/intake/text — explicit re-organisation of a transcript the parent
 * corrected (extraction only; no audio). Same authority, ledger and logging rules as the audio route.
 */
import { NextRequest, NextResponse } from 'next/server';

import { NO_STORE, gateLiveIntake, readBodyWithLimit } from '@/lib/personal-wizard/intake-gate';
import { getIntakeLedger } from '@/lib/personal-wizard/intake-ledger';
import { createOpenAiIntakeProvider } from '@/lib/personal-wizard/intake-openai';
import { runTextIntake } from '@/lib/personal-wizard/intake-service';
import { resolvePersonalWizardOptions } from '@/lib/personal-wizard/options';
import { measureAudioDuration } from '@/lib/personal-wizard/audio-probe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const MAX_BODY_BYTES = 24 * 1024;

export async function POST(req: NextRequest) {
  const access = await gateLiveIntake(req);
  if (!access.ok) return access.response;

  const raw = await readBodyWithLimit(req, MAX_BODY_BYTES);
  if (!raw) return NextResponse.json({ error: 'too_large' }, { status: 413, headers: NO_STORE });
  let body: { jobId?: unknown; draftId?: unknown; text?: unknown };
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  }

  const ledger = getIntakeLedger();
  const outcome = await runTextIntake(
    {
      provider: createOpenAiIntakeProvider(access.config),
      ledger,
      config: access.config,
      measureAudio: (audio, container, maxDurationMs) => measureAudioDuration(audio, container, { maxDurationMs }),
      topics: resolvePersonalWizardOptions().topics,
    },
    {
      userId: access.userId,
      jobId: typeof body.jobId === 'string' ? body.jobId : '',
      draftId: typeof body.draftId === 'string' ? body.draftId : '',
      text: body.text,
      signal: req.signal,
    },
  );
  console.info(
    JSON.stringify({
      event: 'personal_wizard_intake',
      kind: 'text',
      outcome: outcome.ok ? 'ok' : outcome.code,
      reservedUsd: outcome.ok ? Number(outcome.reservedUsd.toFixed(6)) : undefined,
      ledger: ledger.snapshot(),
    }),
  );
  if (!outcome.ok) return NextResponse.json({ error: outcome.code }, { status: outcome.status, headers: NO_STORE });
  return NextResponse.json(outcome.result, { headers: NO_STORE });
}
