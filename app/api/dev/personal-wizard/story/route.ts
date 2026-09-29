import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { readBodyWithLimit } from '@/lib/personal-wizard/intake-gate';
import { IntakeLedger } from '@/lib/personal-wizard/intake-ledger';
import { readIntakeApiKey } from '@/lib/personal-wizard/intake-config';
import { resolvePersonalWizardOptions } from '@/lib/personal-wizard/options';
import { storyAccess, storyResponse } from '@/lib/personal-wizard/story-access';
import { STORY_LIMITS, storyReservationUsd } from '@/lib/personal-wizard/story-config';
import { createPersonalStoryProvider } from '@/lib/personal-wizard/story-openai';
import { preparePersonalStory, writePersonalStory, StoryWriterError } from '@/lib/personal-wizard/story-writer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const envelope = z.object({ jobId: z.string().regex(/^s_[a-z0-9]{12,40}$/), request: z.unknown() }).strict();
function ledger(): IntakeLedger {
  const holder = globalThis as typeof globalThis & { __personalStoryPilotLedger?: IntakeLedger };
  return (holder.__personalStoryPilotLedger ??= new IntakeLedger());
}
export async function GET(req: NextRequest) {
  const access = await storyAccess(req);
  if (!access.ok) return access.response;
  return storyResponse({ available: Boolean(readIntakeApiKey()), model: access.settings.model, reservationUsd: storyReservationUsd(access.settings.model) });
}
export async function POST(req: NextRequest) {
  const access = await storyAccess(req);
  if (!access.ok) return access.response;
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return storyResponse({ error: 'unsupported_type' }, 415);
  const body = await readBodyWithLimit(req, 32_768);
  if (body === null) return storyResponse({ error: 'body_too_large' }, 413);
  let raw: unknown;
  try { raw = JSON.parse(body.toString('utf8')); }
  catch { return storyResponse({ error: 'invalid_json' }, 400); }
  const parsed = envelope.safeParse(raw);
  if (!parsed.success) return storyResponse({ error: 'invalid_envelope' }, 422);
  let prepared;
  try { prepared = preparePersonalStory(parsed.data.request, resolvePersonalWizardOptions()); }
  catch (error) { return storyResponse({ error: error instanceof StoryWriterError ? error.code : 'story_invalid_request' }, 422); }
  // No key access before an authorised caller AND a valid reviewed request/length.
  const apiKey = readIntakeApiKey();
  if (!apiKey) return storyResponse({ error: 'writer_unavailable' }, 503);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  req.signal.addEventListener('abort', cancel, { once: true });
  if (req.signal.aborted) controller.abort();
  const timer = setTimeout(cancel, STORY_LIMITS.timeoutMs);
  try {
    return storyResponse(await writePersonalStory({ prepared, userId: access.userId, jobId: parsed.data.jobId, settings: access.settings, ledger: ledger(), signal: controller.signal, provider: () => createPersonalStoryProvider(apiKey, access.settings.model), record: (receipt) => console.info(JSON.stringify({ event: 'personal_manuscript_pilot', ...receipt })) }));
  } catch (error) {
    const code = error instanceof StoryWriterError ? error.code : 'story_failed';
    return storyResponse({ error: code, accounting: error instanceof StoryWriterError ? error.accounting ?? null : null }, ['duplicate_job', 'user_busy', 'job_limit', 'budget_exhausted'].includes(code) ? 409 : code === 'story_cancelled' ? 408 : 502);
  } finally {
    clearTimeout(timer);
    req.signal.removeEventListener('abort', cancel);
  }
}
