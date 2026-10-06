import 'server-only';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { singleBookPolicySchema } from '../../scripts/personal-single-book-calibration';
import { exclusiveJson, fencedText, realDirectory } from '../../scripts/personal-causal-trial-journal';
import { gitAt } from '../../scripts/personal-story-frozen-engine';
import { preparePersonalStory } from './story-writer';
import { resolvePersonalWizardOptions } from './options';
import { reviewedTextAuthorizationSchema, reviewedTextDigest, assertReviewedTextAuthorization } from './reviewed-text-authorization';
import { nativeBookViewSchema, NATIVE_TEXT_MODELS, type NativeBookView } from './native-book-preview';

export const nativeBridgeConfigSchema = z.object({ version: z.literal('local-native-wizard-config/v1'),
  workspace: z.string().min(1), outputParent: z.string().min(1), policy: singleBookPolicySchema,
  existingKeyEnvFile: z.string().min(1),
}).strict();
export type NativeBridgeConfig = z.infer<typeof nativeBridgeConfigSchema>;
const queuedSchema = z.object({ version: z.literal('local-native-wizard-request/v1'), configDigest: z.string(),
  authorization: reviewedTextAuthorizationSchema, request: z.unknown() }).strict();
export class NativeBridgeError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new NativeBridgeError(code); };
export function nativeBridgeConfig(file: string): NativeBridgeConfig {
  if (!path.isAbsolute(file)) fail('native_config');
  const config = nativeBridgeConfigSchema.parse(JSON.parse(fencedText(file, 32000)));
  for (const directory of [config.workspace, config.outputParent]) realDirectory(directory);
  if (!path.isAbsolute(config.existingKeyEnvFile) || config.policy.mode !== 'live_explicit' ||
      config.policy.reviewMode !== 'benchmark' || config.policy.draftCritique !== true || config.policy.synopsisRepair !== true) fail('native_config');
  return config;
}
export function resolveNativeBookSettings(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (env.PERSONAL_WIZARD_PREVIEW !== 'true' || env.PERSONAL_WIZARD_NATIVE_BOOK_RUNNER !== 'true' ||
      !env.PERSONAL_WIZARD_NATIVE_BOOK_CONFIG || !path.isAbsolute(env.PERSONAL_WIZARD_NATIVE_BOOK_CONFIG)) return null;
  const operators = new Set((env.PERSONAL_WIZARD_NATIVE_BOOK_OPERATORS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  if (!operators.size || [...operators].some(s => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))) return null;
  return { model: 'gpt-6-astra' as const, budgetUsd: 12, maxJobs: 1, operators,
    configFile: env.PERSONAL_WIZARD_NATIVE_BOOK_CONFIG };
}
export function assertNativeSource(config: NativeBridgeConfig) {
  if (path.resolve(config.workspace).toLowerCase() !== path.resolve(process.cwd()).toLowerCase() ||
      gitAt(config.workspace, ['rev-parse', 'HEAD']).toString().trim() !== config.policy.sourceHead ||
      gitAt(config.workspace, ['status', '--porcelain']).toString().trim()) fail('native_source_changed');
}
export function nativeQueueDirectory(config: NativeBridgeConfig) {
  const common = gitAt(config.workspace, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  realDirectory(common);
  return path.join(common, 'codex-native-wizard', reviewedTextDigest(config.policy.approval.reference));
}
export function queuedNativeRequest(config: NativeBridgeConfig) {
  const directory = nativeQueueDirectory(config); realDirectory(directory);
  const queued = queuedSchema.parse(JSON.parse(fencedText(path.join(directory, 'request.json'), 64000)));
  if (queued.configDigest !== reviewedTextDigest(config)) fail('native_config_changed');
  const prepared = preparePersonalStory(queued.request, resolvePersonalWizardOptions(config.workspace));
  assertReviewedTextAuthorization(queued.authorization, prepared, config.policy.approval.reference, config.policy.sourceHead);
  return { directory, queued, prepared };
}
export function enqueueNativeBook(config: NativeBridgeConfig, input: { request: unknown; requestId: string; userId: string }) {
  assertNativeSource(config);
  const prepared = preparePersonalStory(input.request, resolvePersonalWizardOptions(config.workspace));
  if (prepared.brief.beats !== 8 || prepared.accepted.requestId !== input.requestId) fail('native_request_binding');
  const directory = nativeQueueDirectory(config), parent = path.dirname(directory);
  if (!existsSync(parent)) { try { mkdirSync(parent); } catch { if (!existsSync(parent)) fail('native_queue'); } }
  realDirectory(parent);
  const auth = reviewedTextAuthorizationSchema.parse({ version: 'local-reviewed-text-authorization/v1',
    approvalReference: config.policy.approval.reference, userId: input.userId, requestId: prepared.accepted.requestId,
    requestDigest: reviewedTextDigest(prepared.accepted.canonical), optionsFingerprint: prepared.accepted.optionsFingerprint,
    sourceHead: config.policy.sourceHead, consent: 'reviewed_text_to_opus_and_astra' });
  try { mkdirSync(directory); }
  catch {
    // No new family/job is minted for refresh, a second user or a changed request.
    const prior = queuedNativeRequest(config);
    if (reviewedTextDigest(prior.queued.authorization) !== reviewedTextDigest(auth)) fail('native_approval_consumed');
    return readNativeStatus(config, input.userId, input.requestId);
  }
  exclusiveJson(path.join(directory, 'request.json'), { version: 'local-native-wizard-request/v1',
    configDigest: reviewedTextDigest(config), authorization: auth, request: prepared.accepted.canonical });
  return emptyNativeView(input.requestId);
}
export function emptyNativeView(requestId: string): NativeBookView {
  return { version: 'local-native-book-view/v1', requestId, revision: 0, phase: 'queued',
    models: { ...NATIVE_TEXT_MODELS },
    original: null, edited: null, readings: [], error: null, runtimeEligible: false,
    accounting: { knownEstimateMicroUsd: 0, unknownAttemptCosts: 0, logicalAttempts: 0, allowanceMicroUsd: 12000000, kind: 'estimate_not_invoice' } };
}
export function readNativeStatus(config: NativeBridgeConfig, userId: string, requestId: string) {
  const { directory, queued } = queuedNativeRequest(config);
  if (queued.authorization.userId !== userId || queued.authorization.requestId !== requestId) fail('native_owner');
  const names = readdirSync(directory).filter(n => /^view-\d{4}\.json$/.test(n)).sort();
  if (!names.length) return emptyNativeView(requestId);
  const record = z.object({ configDigest: z.string(), authorizationDigest: z.string(), view: nativeBookViewSchema }).strict()
    .parse(JSON.parse(fencedText(path.join(directory, names[names.length - 1]), 256000)));
  if (record.configDigest !== queued.configDigest || record.authorizationDigest !== reviewedTextDigest(queued.authorization) ||
      record.view.requestId !== requestId || record.view.revision !== Number(names[names.length - 1].slice(5, 9))) fail('native_view_binding');
  return record.view;
}
export function claimNativeWorker(config: NativeBridgeConfig) {
  assertNativeSource(config); const queued = queuedNativeRequest(config);
  exclusiveJson(path.join(queued.directory, 'worker-claimed.json'), { configDigest: reviewedTextDigest(config),
    authorizationDigest: reviewedTextDigest(queued.queued.authorization) });
  let sequence = readdirSync(queued.directory).filter(n => /^view-\d{4}\.json$/.test(n)).length;
  return { ...queued, publish(view: NativeBookView) {
    const parsed = nativeBookViewSchema.parse(view);
    if (parsed.requestId !== queued.queued.authorization.requestId || sequence >= 30) fail('native_view_binding');
    exclusiveJson(path.join(queued.directory, `view-${String(++sequence).padStart(4, '0')}.json`), {
      configDigest: queued.queued.configDigest, authorizationDigest: reviewedTextDigest(queued.queued.authorization), view: { ...parsed, revision: sequence } });
  } };
}
