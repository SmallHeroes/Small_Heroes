import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { exclusiveJson, fencedText } from '../../scripts/personal-causal-trial-journal';
import { findVoiceById } from '../../backend/config/voices';
import { prepareSimpleStory } from './simple-story-engine';
import { resolvePersonalWizardOptions } from './options';
import { reviewedTextDigest } from './reviewed-text-authorization';
import { SIMPLE_CHILD_MOMENTUM_EXPERIENCE } from './simple-story-experience';
import { momentumBookViewSchema, type MomentumBookView } from './momentum-book-view';

/**
 * Local, opt-in Wizard → momentum book bridge (2026-10-26). It records the Wizard's own accepted request for the ONE momentum book slot and
 * reports that book's progress. It never calls a provider, reads a key, claims the book or starts a worker: the paid run stays the gated
 * operator, whose grant binds this exact recorded request. Default off; old simple/native book actions and their slots are untouched.
 */
export const MOMENTUM_WIZARD_SLOT = Object.freeze({ cycle: 'owner-momentum-book-20261025/v1' as const, voiceIds: ['dad_v2'] as readonly string[],
  usedCompanions: ['fox_uri', 'lion_shaket', 'dragon_dini', 'chameleon_koko', 'panda_anat'] as readonly string[],
  consent: 'reviewed_text_to_momentum_book_trial' as const });
const hash = z.string().regex(/^[a-f0-9]{64}$/), absolute = z.string().refine(path.isAbsolute);
export const momentumWizardConfigSchema = z.object({ version: z.literal('local-momentum-wizard-config/v1'), cycle: z.literal(MOMENTUM_WIZARD_SLOT.cycle),
  seed: z.string().min(8).max(120), intakeFile: absolute, runDirectory: absolute, bookDir: absolute }).strict();
export type MomentumWizardConfig = z.infer<typeof momentumWizardConfigSchema>;
export const momentumIntakeSchema = z.object({ version: z.literal('local-momentum-wizard-intake/v1'), configDigest: hash, requestId: hash,
  optionsFingerprint: hash, voiceId: z.string(), consent: z.literal(MOMENTUM_WIZARD_SLOT.consent), request: z.unknown() }).strict();
export class MomentumBridgeError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new MomentumBridgeError(code); };

export function resolveMomentumBookSettings(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (env.PERSONAL_WIZARD_PREVIEW !== 'true' || env.PERSONAL_WIZARD_MOMENTUM_BOOK_RUNNER !== 'true' ||
      !env.PERSONAL_WIZARD_MOMENTUM_BOOK_CONFIG || !path.isAbsolute(env.PERSONAL_WIZARD_MOMENTUM_BOOK_CONFIG)) return null;
  return { configFile: env.PERSONAL_WIZARD_MOMENTUM_BOOK_CONFIG };
}
export function momentumBookConfig(file: string): MomentumWizardConfig {
  if (!path.isAbsolute(file)) fail('momentum_config');
  try { return momentumWizardConfigSchema.parse(JSON.parse(fencedText(file, 16000))); } catch { return fail('momentum_config'); }
}
/** Local-only gate (no session/DB): dev host names, the real Host header, and same-origin for writes. Rate limiting stays in the route. */
export function momentumLocalGate(r: { hostname: string; host: string | null; protocol: string; method: string; origin: string | null }) {
  const local = ['127.0.0.1', 'localhost', '[::1]'];
  if (!local.includes(r.hostname)) return 'not_found';
  let origin: string;
  try { const actual = new URL(`${r.protocol}//${r.host ?? ''}`); if (!local.includes(actual.hostname)) return 'invalid_host'; origin = actual.origin; }
  catch { return 'invalid_host'; }
  if (r.method !== 'GET' && r.origin !== origin) return 'invalid_origin';
  return null;
}
/** The Wizard's accepted request, validated for THIS slot: the updated story experience, 8 pages, no photo, a new companion, a Dad voice. */
export function prepareMomentumRequest(request: unknown, config: Pick<MomentumWizardConfig, 'seed'>, root?: string) {
  let prepared: ReturnType<typeof prepareSimpleStory>;
  try { prepared = prepareSimpleStory(request, resolvePersonalWizardOptions(root), config.seed, SIMPLE_CHILD_MOMENTUM_EXPERIENCE); }
  catch { return fail('momentum_request_binding'); }
  const c = prepared.accepted.canonical;
  if (prepared.book.pages !== 8) fail('momentum_length');
  if (prepared.accepted.containsFixtureData || c.appearance.photo !== 'none') fail('momentum_photo');
  if (MOMENTUM_WIZARD_SLOT.usedCompanions.includes(c.companion.id)) fail('momentum_companion_used');
  // The engine admits only a registry-declared appearance; refuse here, before any paid text, rather than after it.
  if (prepared.book.companion.appearance.status !== 'registry_declared') fail('momentum_companion_unresolved');
  const voiceId = c.bookOptions.voiceId;
  if (!voiceId || !MOMENTUM_WIZARD_SLOT.voiceIds.includes(voiceId) || !findVoiceById(voiceId)) fail('momentum_voice');
  if (c.child.age < 3 || c.child.age > 8) fail('momentum_age');
  return { prepared, voiceId: voiceId! };
}
function readIntake(config: MomentumWizardConfig) {
  try { return momentumIntakeSchema.parse(JSON.parse(fencedText(config.intakeFile, 64000))); } catch { return fail('momentum_intake'); }
}
/** Record ONE request. The same request again returns its status; any different request is refused: the slot is one book. */
export function enqueueMomentumBook(config: MomentumWizardConfig, input: { request: unknown; requestId: string }, root?: string): MomentumBookView {
  const { prepared, voiceId } = prepareMomentumRequest(input.request, config, root);
  if (input.requestId !== prepared.accepted.requestId) fail('momentum_request_binding');
  const intake = momentumIntakeSchema.parse({ version: 'local-momentum-wizard-intake/v1', configDigest: reviewedTextDigest(config), requestId: input.requestId,
    optionsFingerprint: prepared.accepted.optionsFingerprint, voiceId, consent: MOMENTUM_WIZARD_SLOT.consent, request: prepared.accepted.canonical });
  if (existsSync(config.intakeFile)) {
    if (reviewedTextDigest(readIntake(config)) !== reviewedTextDigest(intake)) fail('momentum_slot_consumed');
    return readMomentumBookStatus(config, input.requestId);
  }
  try { exclusiveJson(config.intakeFile, intake); } catch { return fail('momentum_intake'); }
  return readMomentumBookStatus(config, input.requestId);
}
const json = (file: string) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
function lastEvent(file: string) {
  if (!existsSync(file)) return null;
  const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/).reverse();
  for (const line of lines) { try { const e = JSON.parse(line); if (typeof e?.event === 'string') return e.event.slice(0, 300); } catch { /* not an event line */ } }
  return null;
}
/** Progress of the recorded book, read from the operator's run folder (live/stdout/result/stop) and nothing else. */
export function readMomentumBookStatus(config: MomentumWizardConfig, requestId: string): MomentumBookView {
  const intake = readIntake(config);
  if (intake.requestId !== requestId) fail('momentum_owner');
  const at = (name: string) => path.join(config.runDirectory, name);
  const result = json(at('EXECUTION-RESULT.json'))?.result, stop = json(at('EXECUTION-STOP.json'));
  const status: string | null = typeof result?.status === 'string' ? result.status : null;
  const phase: MomentumBookView['phase'] = status === 'full_book_diagnostic' ? 'ready' : status?.startsWith('held_') ? 'held' : status || stop ? 'stopped'
    : existsSync(at('live.json')) ? 'running' : 'received';
  const narration = typeof result?.narration?.status === 'string' ? result.narration.status : null;
  const reader = typeof result?.readerPreview?.url === 'string' ? result.readerPreview.url : null;
  const micro = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0 ? v as number : null;
  return momentumBookViewSchema.parse({ requestId, phase, event: stop ? `stopped: ${String(stop.code ?? 'unknown').slice(0, 80)}` : lastEvent(at('stdout.jsonl')),
    readerUrl: phase === 'ready' ? reader : null, narration: phase === 'ready' ? narration : null,
    accounting: result?.accounting ? { apiCumulativeMicroUsd: micro(result.accounting.api?.cumulativeAccountedMicroUsd), claudeMaxMicroUsd: micro(result.accounting.claudeMax?.accountedMicroUsd) } : null,
    runtimeEligible: false, productAccepted: false });
}
