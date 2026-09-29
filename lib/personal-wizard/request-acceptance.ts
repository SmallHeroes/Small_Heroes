import 'server-only';

import { createHash } from 'crypto';

import { reviewedPersonalBookRequestSchema, type ReviewedPersonalBookRequest } from './contract';
import { requestContainsFixtureData } from './draft';
import type { PersonalWizardOptions } from './options';

export const PERSONAL_REQUEST_IDENTITY_VERSION = 'personal-book-request-identity/v1';

export type AcceptanceIssue = { path: string; code: string };

export type AcceptanceResult =
  | {
      ok: true;
      /** Content-bound identity derived here; the browser never supplies it. */
      requestId: string;
      canonical: ReviewedPersonalBookRequest;
      optionsFingerprint: string;
      containsFixtureData: boolean;
      /** The personal writer/runtime is not connected; nothing is written, rendered or charged. */
      writer: 'not_connected';
    }
  | { ok: false; issues: AcceptanceIssue[] };

/** Stable JSON: object keys sorted recursively, array order preserved. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Server-side acceptance of a browser-built request. The strict schema rejects unknown fields
 * (approval flags, budgets, keys, runtime switches); option ids must belong to the current option
 * set; the identity binds the canonical content to that option set.
 */
export function acceptPersonalBookRequest(input: unknown, options: PersonalWizardOptions): AcceptanceResult {
  const parsed = reviewedPersonalBookRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.message })),
    };
  }
  const request = parsed.data;
  const issues: AcceptanceIssue[] = [];
  if (!options.companions.some((companion) => companion.id === request.companion.id)) {
    issues.push({ path: 'companion.id', code: 'companion_not_offered' });
  }
  if (request.intent?.kind === 'topic') {
    const { topicId } = request.intent;
    if (!options.topics.some((topic) => topic.id === topicId)) {
      issues.push({ path: 'intent.topicId', code: 'topic_not_offered' });
    }
  }
  const { lengthId, voiceId } = request.bookOptions;
  if (lengthId !== null && !options.lengths.some((length) => length.id === lengthId)) {
    issues.push({ path: 'bookOptions.lengthId', code: 'length_not_offered' });
  }
  if (voiceId !== null && !options.voices.some((voice) => voice.id === voiceId)) {
    issues.push({ path: 'bookOptions.voiceId', code: 'voice_not_offered' });
  }
  if (issues.length > 0) return { ok: false, issues };

  const requestId = createHash('sha256')
    .update(`${PERSONAL_REQUEST_IDENTITY_VERSION}\n${options.fingerprint}\n${canonicalJson(request)}`)
    .digest('hex');
  return {
    ok: true,
    requestId,
    canonical: request,
    optionsFingerprint: options.fingerprint,
    containsFixtureData: requestContainsFixtureData(request),
    writer: 'not_connected',
  };
}
