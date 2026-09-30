import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { readBodyWithLimit } from '@/lib/personal-wizard/intake-gate';
import { IntakeLedger } from '@/lib/personal-wizard/intake-ledger';
import { readIntakeApiKey } from '@/lib/personal-wizard/intake-config';
import { resolvePersonalWizardOptions } from '@/lib/personal-wizard/options';
import { personalOperatorAccess, storyResponse } from '@/lib/personal-wizard/story-access';
import { BOOK_SPREAD_COUNTS, resolvePersonalBookSettings, personalBookOutputLimits, personalBookReservationUsd } from '@/lib/personal-wizard/book-config';
import { generatePersonalBook, PersonalBookError } from '@/lib/personal-wizard/book-runner';
import { createPersonalBookProvider } from '@/lib/personal-wizard/book-openai';
import { preparePersonalStory, StoryWriterError } from '@/lib/personal-wizard/story-writer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const envelope = z.object({ jobId: z.string().regex(/^b_[a-z0-9]{12,40}$/), request: z.unknown() }).strict();
function ledger(): IntakeLedger {
  const holder = globalThis as typeof globalThis & { __personalBookPilotLedger?: IntakeLedger };
  return (holder.__personalBookPilotLedger ??= new IntakeLedger());
}
const access = (req: NextRequest) => personalOperatorAccess(req, resolvePersonalBookSettings, 'personal-book-pilot');

export async function GET(req: NextRequest) {
  const allowed = await access(req);
  if (!allowed.ok) return allowed.response;
  // Configuration is not a claim that the credential/provider is available.
  return storyResponse({ configured: true, liveAvailabilityUnverified: true, runtimeEligible: false,
    model: allowed.settings.model, maxProviderAttempts: 4,
    reservations: BOOK_SPREAD_COUNTS.map(narrativeSpreads => {
      const reservationUsd = personalBookReservationUsd(allowed.settings.model, narrativeSpreads);
      const lengthId = resolvePersonalWizardOptions().lengths.find(length => length.pages === narrativeSpreads * 2)?.id;
      return { lengthId, narrativeSpreads, displayPages: narrativeSpreads * 2, outputLimits: personalBookOutputLimits(narrativeSpreads),
        reservationUsd, fitsConfiguredTotalBudget: reservationUsd <= allowed.settings.budgetUsd };
    }) });
}

export async function POST(req: NextRequest) {
  const allowed = await access(req);
  if (!allowed.ok) return allowed.response;
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return storyResponse({ error: 'unsupported_type' }, 415);
  const body = await readBodyWithLimit(req, 32_768);
  if (body === null) return storyResponse({ error: 'body_too_large' }, 413);
  let raw: unknown;
  try { raw = JSON.parse(body.toString('utf8')); }
  catch { return storyResponse({ error: 'invalid_json' }, 400); }
  const parsed = envelope.safeParse(raw);
  if (!parsed.success) return storyResponse({ error: 'invalid_envelope' }, 422);
  const options = resolvePersonalWizardOptions();
  try { preparePersonalStory(parsed.data.request, options); }
  catch (error) { return storyResponse({ error: error instanceof StoryWriterError ? error.code : 'story_invalid_request' }, 422); }
  try {
    return storyResponse(await generatePersonalBook({ request: parsed.data.request, options,
      userId: allowed.userId, operatorEmail: allowed.operatorEmail, jobId: parsed.data.jobId,
      settings: allowed.settings, ledger: ledger(), signal: req.signal,
      provider: () => {
        // Auth, reviewed input, cancellation AND whole-job reservation precede key access.
        const apiKey = readIntakeApiKey();
        if (!apiKey) throw new PersonalBookError('book_unavailable');
        return createPersonalBookProvider(apiKey, allowed.settings.model);
      },
      record: event => console.info(JSON.stringify({ event: 'personal_book_diagnostic', ...event })),
    }));
  } catch (error) {
    const code = error instanceof PersonalBookError ? error.code : 'book_failed';
    const status = ['book_duplicate_job', 'book_user_busy', 'book_job_limit', 'book_budget_exhausted'].includes(code) ? 409 :
      ['book_cancelled', 'book_timeout'].includes(code) ? 408 : code === 'book_unavailable' ? 503 : 502;
    return storyResponse({ error: code, writerResult: error instanceof PersonalBookError ? error.writerResult ?? null : null,
      accounting: error instanceof PersonalBookError ? error.accounting ?? null : null }, status);
  }
}
