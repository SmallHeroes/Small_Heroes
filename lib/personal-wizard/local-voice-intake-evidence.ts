import 'server-only';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { z } from 'zod';
import { exclusiveJson, fencedText, realDirectory } from '../../scripts/personal-causal-trial-journal';
import { isLocalUiOnlyBootstrap } from '../local-preview-bootstrap';
import { canonicalJson } from './request-acceptance';
import type { MomentumWizardConfig } from './momentum-book-bridge';

/** Optional local owner authority, separate from (never a replacement for) signed-in live intake. */
export const LOCAL_VOICE_VERSION = 'local-wizard-voice-intake/v1' as const;
export const voiceDigest = (x: unknown) => createHash('sha256').update(canonicalJson(x)).digest('hex');
export const voiceBytesDigest = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');
const hash = z.string().regex(/^[a-f0-9]{64}$/), micro = z.number().int().nonnegative().safe();
const absolute = z.string().refine(path.isAbsolute);
export const localVoiceGrantSchema = z.object({ version: z.literal(LOCAL_VOICE_VERSION), cycle: z.string().min(1),
  configSha256: hash, sourceRoot: absolute, sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  ownerFile: absolute, ownerSha256: hash, priorLedgerFile: absolute, priorLedgerSha256: hash, keyFile: absolute, origin: z.string().url(),
  priorApiMicroUsd: micro, apiCapMicroUsd: micro, combinedCapMicroUsd: micro, maxCalls: z.literal(2),
  reservationMicroUsd: z.number().int().min(10000).max(30000),
  transcribeModel: z.literal('gpt-transcribe'), extractModel: z.literal('gpt-6-luna'),
  priceVersion: z.literal('openai-standard/2026-10-26-local-voice-v1'),
}).strict().superRefine((g, c) => {
  if (g.priorApiMicroUsd + g.reservationMicroUsd > g.apiCapMicroUsd || g.apiCapMicroUsd > 7000000 ||
      g.combinedCapMicroUsd !== 8000000 || g.apiCapMicroUsd > g.combinedCapMicroUsd) c.addIssue({code:'custom',message:'budget'});
});
export type LocalVoiceGrant = z.infer<typeof localVoiceGrantSchema>;
export const voiceFiles = (run: string) => { const root = path.join(run, 'voice-intake'); return {
  root, grant: path.join(root, 'grant.json'), claim: path.join(root, 'job.claim.json'), outcome: path.join(root, 'job.outcome.json'),
  skipped: path.join(root, 'manual.claim.json'), meter: path.join(root, 'meter'),
}; };
export const readVoiceJson = (file: string) => JSON.parse(fencedText(file, 64000));
export class LocalVoiceError extends Error { constructor(readonly code: string) { super(code); } }
export const voiceFail = (code: string): never => { throw new LocalVoiceError(code); };

export function localVoiceConfigured(config: MomentumWizardConfig) { return existsSync(voiceFiles(config.runDirectory).grant); }
/** A changed/consumed/malformed opt-in is refused; it never falls back to the normal authenticated route. No key access. */
export function authorizeLocalVoice(config: MomentumWizardConfig, request: { url: string; host: string | null; origin: string | null; method: string },
  env: Readonly<Record<string,string|undefined>> = process.env,
  revision: (root: string) => { head: string; clean: boolean } = root => ({
    head: execFileSync('git', ['rev-parse','HEAD'], {cwd:root,encoding:'utf8',windowsHide:true}).trim(),
    clean: execFileSync('git', ['status','--porcelain'], {cwd:root,encoding:'utf8',windowsHide:true}).trim() === '',
  }), allowClaimed = false) {
  if (!isLocalUiOnlyBootstrap(env) || env.PERSONAL_WIZARD_MOMENTUM_BOOK_RUNNER !== 'true') voiceFail('voice_disabled');
  const files = voiceFiles(config.runDirectory), grant = localVoiceGrantSchema.parse(readVoiceJson(files.grant));
  const url = new URL(request.url), actual = new URL(`http://${request.host ?? ''}`);
  if (url.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) || actual.origin !== grant.origin ||
      actual.username || actual.password || actual.pathname !== '/' || actual.search || actual.hash ||
      url.origin !== actual.origin || new URL(env.APP_URL ?? env.NEXT_PUBLIC_APP_URL ?? '').origin !== actual.origin ||
      request.method !== 'GET' && request.origin !== actual.origin) voiceFail('voice_origin');
  if (grant.configSha256 !== voiceDigest(config) || grant.cycle !== config.cycle ||
      voiceBytesDigest(fencedText(grant.ownerFile, 32000)) !== grant.ownerSha256 ||
      voiceBytesDigest(fencedText(grant.priorLedgerFile, 64000)) !== grant.priorLedgerSha256) voiceFail('voice_binding');
  const prior = readVoiceJson(grant.priorLedgerFile);
  if (prior.cumulativeParentBudgetMicroUsd !== grant.priorApiMicroUsd || prior.apiReservedUnsettledMicroUsd !== 0) voiceFail('voice_prior');
  realDirectory(grant.sourceRoot);
  const source = revision(grant.sourceRoot);
  if (!source.clean || source.head !== grant.sourceHead) voiceFail('voice_source');
  if ((!allowClaimed && existsSync(files.claim)) || existsSync(files.outcome) || existsSync(files.skipped) || existsSync(config.intakeFile)) voiceFail('voice_consumed');
  return { grant, files, grantSha256: voiceBytesDigest(fencedText(files.grant, 64000)) };
}

const outcomeSchema = z.object({ version: z.literal(LOCAL_VOICE_VERSION), grantSha256: hash, claimSha256: hash,
  ok: z.boolean(), resultSha256: hash.nullable(), calls: z.number().int().min(0).max(2),
  knownMicroUsd: micro, unknownCost: z.number().int().min(0).max(2), unknownOutcome: z.number().int().min(0).max(2),
  journalSha256: hash, }).strict();
export type LocalVoiceOutcome = z.infer<typeof outcomeSchema>;
export function voiceJournalDigest(directory: string) {
  return voiceDigest(readdirSync(directory).sort().map(name => [name,voiceBytesDigest(fencedText(path.join(directory,name),64000))]));
}

/** Fence canonical submission against an active/unknown voice job. R4 still re-derives cost/calls from the native meter before spending. */
export function settleLocalVoiceForBook(config: MomentumWizardConfig) {
  if (!localVoiceConfigured(config)) return null;
  const f = voiceFiles(config.runDirectory);
  if (!existsSync(f.claim)) {
    if (!existsSync(f.skipped)) exclusiveJson(f.skipped, { version: LOCAL_VOICE_VERSION, configSha256: voiceDigest(config), mode:'manual' });
    if (existsSync(f.claim)) voiceFail('voice_pending');
    return null;
  }
  if (existsSync(f.skipped) || !existsSync(f.outcome)) voiceFail('voice_pending');
  const grant = localVoiceGrantSchema.parse(readVoiceJson(f.grant));
  if (grant.configSha256 !== voiceDigest(config) || grant.cycle !== config.cycle) voiceFail('voice_binding');
  const out = outcomeSchema.parse(readVoiceJson(f.outcome));
  if (out.unknownCost || out.unknownOutcome || out.grantSha256 !== voiceBytesDigest(fencedText(f.grant,64000)) ||
      out.claimSha256 !== voiceBytesDigest(fencedText(f.claim,64000)) || out.journalSha256 !== voiceJournalDigest(f.meter) ||
      out.knownMicroUsd > grant.reservationMicroUsd || grant.priorApiMicroUsd + out.knownMicroUsd > grant.apiCapMicroUsd) voiceFail('voice_unsettled');
  return out;
}
