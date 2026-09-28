/**
 * Browser client for live intake (P2). Every server answer is validated against the shared
 * contract, and an answer for a different job id is rejected. A 2xx without a valid body is an
 * error, never a partial success.
 */
import { intakeResultSchema, type IntakeResult } from './contract';

export type LiveIntakeError =
  | 'not_signed_in'
  | 'not_operator'
  | 'disabled'
  | 'rejected_audio'
  | 'busy'
  | 'budget'
  | 'rate_limited'
  | 'failed'
  | 'network'
  | 'malformed_response'
  | 'aborted';

export type LiveIntakeResponse = { ok: true; result: IntakeResult } | { ok: false; error: LiveIntakeError };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const REJECTED_AUDIO = new Set(['unsupported_format', 'format_mismatch', 'too_large', 'too_short', 'too_long', 'duration_unreadable']);

export function mapIntakeError(status: number, code: string | undefined): LiveIntakeError {
  if (status === 401) return 'not_signed_in';
  if (status === 403 && code === 'not_operator') return 'not_operator';
  if (status === 404) return 'disabled';
  if (status === 402) return 'budget';
  if (status === 409) return 'busy';
  if (status === 429) return code === 'job_limit' ? 'budget' : 'rate_limited';
  if (code && REJECTED_AUDIO.has(code)) return 'rejected_audio';
  return 'failed';
}

async function parse(response: Response, jobId: string): Promise<LiveIntakeResponse> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : undefined;
    return { ok: false, error: mapIntakeError(response.status, code) };
  }
  const parsed = intakeResultSchema.safeParse(body);
  if (!parsed.success || parsed.data.jobId !== jobId || parsed.data.source !== 'transcript') {
    return { ok: false, error: 'malformed_response' };
  }
  return { ok: true, result: parsed.data };
}

async function send(run: () => Promise<Response>, jobId: string, signal: AbortSignal): Promise<LiveIntakeResponse> {
  try {
    return await parse(await run(), jobId);
  } catch {
    return { ok: false, error: signal.aborted ? 'aborted' : 'network' };
  }
}

export async function fetchLiveIntakeStatus(fetchImpl: FetchLike = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl('/api/dev/personal-wizard/intake/status', { cache: 'no-store' });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return Boolean(body && typeof body === 'object' && (body as { live?: unknown }).live === true);
  } catch {
    return false;
  }
}

export function submitAudioIntake(input: {
  jobId: string;
  draftId: string;
  audio: Blob;
  mimeType: string;
  signal: AbortSignal;
  fetchImpl?: FetchLike;
}): Promise<LiveIntakeResponse> {
  const fetchImpl = input.fetchImpl ?? fetch;
  return send(
    () =>
      fetchImpl('/api/dev/personal-wizard/intake/audio', {
        method: 'POST',
        body: input.audio,
        headers: { 'Content-Type': input.mimeType, 'x-pw-job-id': input.jobId, 'x-pw-draft-id': input.draftId },
        signal: input.signal,
        cache: 'no-store',
      }),
    input.jobId,
    input.signal,
  );
}

export function submitTextIntake(input: {
  jobId: string;
  draftId: string;
  text: string;
  signal: AbortSignal;
  fetchImpl?: FetchLike;
}): Promise<LiveIntakeResponse> {
  const fetchImpl = input.fetchImpl ?? fetch;
  return send(
    () =>
      fetchImpl('/api/dev/personal-wizard/intake/text', {
        method: 'POST',
        body: JSON.stringify({ jobId: input.jobId, draftId: input.draftId, text: input.text }),
        headers: { 'Content-Type': 'application/json' },
        signal: input.signal,
        cache: 'no-store',
      }),
    input.jobId,
    input.signal,
  );
}
