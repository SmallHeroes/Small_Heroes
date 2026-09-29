/**
 * POST /api/dev/personal-wizard/intake/text — extraction only, no audio: a text the parent wrote
 * instead of recording, or an explicit re-organisation of a transcript the parent corrected. Same
 * authority, ledger and logging rules as the audio route.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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

/** Exactly these three strings; anything else (null, arrays, scalars, extra fields) is a 400. */
const textBodySchema = z.object({ jobId: z.string(), draftId: z.string(), text: z.string() }).strict();

export async function POST(req: NextRequest) {
  const access = await gateLiveIntake(req);
  if (!access.ok) return access.response;

  const raw = await readBodyWithLimit(req, MAX_BODY_BYTES);
  if (!raw) return NextResponse.json({ error: 'too_large' }, { status: 413, headers: NO_STORE });
  let json: unknown;
  try {
    json = JSON.parse(raw.toString('utf8'));
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  }
  const parsed = textBodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  const body = parsed.data;

  const ledger = getIntakeLedger();
  const outcome = await runTextIntake(
    {
      createProvider: () => createOpenAiIntakeProvider(access.config),
      ledger,
      config: access.config,
      measureAudio: (audio, container, maxDurationMs) => measureAudioDuration(audio, container, { maxDurationMs }),
      topics: resolvePersonalWizardOptions().topics,
    },
    {
      userId: access.userId,
      jobId: body.jobId,
      draftId: body.draftId,
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
