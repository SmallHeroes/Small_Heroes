import 'server-only';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { exclusiveJson, fencedText, realDirectory } from '../../scripts/personal-causal-trial-journal';
import { gitAt } from '../../scripts/personal-source-git';
import { prepareSimpleStory } from './simple-story-engine';
import { resolvePersonalWizardOptions } from './options';
import { reviewedTextDigest } from './reviewed-text-authorization';
import { emptySimpleBookView, simpleBookViewSchema, type SimpleBookView } from './simple-book-view';
import { CAUSAL_MODELS } from '../../scripts/personal-causal-trial-adapters';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const simpleBookConfigSchema = z.object({ version: z.literal('local-simple-wizard-config/v1'), workspace: z.string().min(1),
  outputParent: z.string().min(1), sourceHead: z.string().regex(/^[a-f0-9]{40}$/), approvalReference: z.string().min(20).max(2000),
  maximumMicroUsd: z.literal(12000000), fictionalProfile: z.literal(true), seed: z.string().min(1).max(120),
  executable: z.string().min(1), executableSha256: hash, existingKeyEnvFile: z.string().min(1),
  // Missing means the historical Astra diagnostic. New active configurations select
  // the explicitly requested Sol reviewer; never reinterpret old wires/receipts.
  reviewModel: z.literal('gpt-6.1-sol').optional(), actorOwnedAppearance: z.literal(true).optional(),
  engineeringReceipts: z.array(z.object({ file: z.string().min(1), sha256: hash }).strict()).min(2).max(8),
  illustratedAudition: z.object({ approvalFile: z.string().min(1), approvalSha256: hash,
    childDesign: z.string().trim().min(20).max(1500) }).strict().optional(),
}).strict();
export type SimpleBookConfig = z.infer<typeof simpleBookConfigSchema>;
export function simpleBookReviewPolicy(config: Pick<SimpleBookConfig, 'reviewModel'>) {
  if (config.reviewModel !== undefined && config.reviewModel !== 'gpt-6.1-sol') throw Error('simple_review_model');
  return config.reviewModel ? { model: config.reviewModel, inputMicroUsdPerToken: 2, outputMicroUsdPerToken: 10 }
    : { model: CAUSAL_MODELS.astra, inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 };
}
const queuedSchema = z.object({ version: z.literal('local-simple-wizard-request/v1'), configDigest: hash,
  userId: z.string().min(1).max(200), requestId: hash, optionsFingerprint: hash,
  consent: z.literal('reviewed_text_to_simple_book_diagnostic'), request: z.unknown() }).strict();
export class SimpleBookBridgeError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new SimpleBookBridgeError(code); };

export function simpleBookConfig(file: string): SimpleBookConfig {
  if (!path.isAbsolute(file)) fail('simple_config');
  const config = simpleBookConfigSchema.parse(JSON.parse(fencedText(file, 32000)));
  for (const directory of [config.workspace, config.outputParent]) realDirectory(directory);
  const common = gitAt(config.workspace, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  for (const protectedRoot of [config.workspace, common]) {
    const relative = path.relative(protectedRoot, config.outputParent);
    if (!relative || !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) fail('simple_cli_workspace_inside_source');
  }
  for (const file of [config.executable, config.existingKeyEnvFile, ...config.engineeringReceipts.map(r => r.file),
    ...(config.illustratedAudition ? [config.illustratedAudition.approvalFile] : [])]) {
    if (!path.isAbsolute(file)) fail('simple_config');
  }
  return config;
}
export function resolveSimpleBookSettings(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (env.PERSONAL_WIZARD_PREVIEW !== 'true' || env.PERSONAL_WIZARD_SIMPLE_BOOK_RUNNER !== 'true' ||
      !env.PERSONAL_WIZARD_SIMPLE_BOOK_CONFIG || !path.isAbsolute(env.PERSONAL_WIZARD_SIMPLE_BOOK_CONFIG)) return null;
  const operators = new Set((env.PERSONAL_WIZARD_SIMPLE_BOOK_OPERATORS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  if (!operators.size || [...operators].some(s => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))) return null;
  return { model: CAUSAL_MODELS.astra, budgetUsd: 12, maxJobs: 1, operators, configFile: env.PERSONAL_WIZARD_SIMPLE_BOOK_CONFIG };
}
export function assertSimpleBookSource(config: SimpleBookConfig) {
  if (path.resolve(config.workspace).toLowerCase() !== path.resolve(process.cwd()).toLowerCase() ||
      gitAt(config.workspace, ['rev-parse', 'HEAD']).toString().trim() !== config.sourceHead ||
      gitAt(config.workspace, ['status', '--porcelain']).toString().trim()) fail('simple_source_changed');
}
export function simpleBookQueueDirectory(config: SimpleBookConfig) {
  const common = gitAt(config.workspace, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  realDirectory(common);
  // One approved pilot for this repository, not a new allowance from renamed configuration.
  // A new paid book needs a new explicit decision, not another outputParent/reference.
  return path.join(common, 'codex-simple-wizard-book', 'one-approved-book-20261008');
}
function prepareRequest(request: unknown, config: SimpleBookConfig) {
  const options = resolvePersonalWizardOptions(config.workspace), prepared = prepareSimpleStory(request, options, config.seed);
  if (prepared.book.pages !== 8 || prepared.accepted.containsFixtureData || prepared.accepted.canonical.appearance.photo !== 'none') fail('simple_request_binding');
  return { prepared, options };
}
export function queuedSimpleBook(config: SimpleBookConfig) {
  const directory = simpleBookQueueDirectory(config); realDirectory(directory);
  const queued = queuedSchema.parse(JSON.parse(fencedText(path.join(directory, 'request.json'), 64000)));
  const { prepared, options } = prepareRequest(queued.request, config);
  if (queued.configDigest !== reviewedTextDigest(config) || queued.requestId !== prepared.accepted.requestId ||
      queued.optionsFingerprint !== prepared.accepted.optionsFingerprint ||
      reviewedTextDigest(queued.request) !== reviewedTextDigest(prepared.accepted.canonical)) fail('simple_request_binding');
  return { directory, queued, prepared, options };
}
export function enqueueSimpleBook(config: SimpleBookConfig, input: { request: unknown; requestId: string; userId: string }) {
  assertSimpleBookSource(config);
  const { prepared } = prepareRequest(input.request, config);
  if (input.requestId !== prepared.accepted.requestId) fail('simple_request_binding');
  const directory = simpleBookQueueDirectory(config);
  const parent = path.dirname(directory);
  if (!existsSync(parent)) { try { mkdirSync(parent); } catch { if (!existsSync(parent)) fail('simple_queue'); } }
  realDirectory(parent);
  const request = queuedSchema.parse({ version: 'local-simple-wizard-request/v1', configDigest: reviewedTextDigest(config),
    userId: input.userId, requestId: input.requestId, optionsFingerprint: prepared.accepted.optionsFingerprint,
    consent: 'reviewed_text_to_simple_book_diagnostic', request: prepared.accepted.canonical });
  try { mkdirSync(directory); }
  catch {
    if (!existsSync(directory)) fail('simple_queue');
    const prior = queuedSimpleBook(config);
    if (reviewedTextDigest(prior.queued) !== reviewedTextDigest(request)) fail('simple_approval_consumed');
    return readSimpleBookStatus(config, input.userId, input.requestId);
  }
  exclusiveJson(path.join(directory, 'request.json'), request);
  return emptySimpleBookView(input.requestId);
}
export function readSimpleBookStatus(config: SimpleBookConfig, userId: string, requestId: string) {
  const { directory, queued } = queuedSimpleBook(config);
  if (queued.userId !== userId || queued.requestId !== requestId) fail('simple_owner');
  const names = readdirSync(directory).filter(n => /^view-\d{4}\.json$/.test(n)).sort();
  if (!names.length) return emptySimpleBookView(requestId);
  const record = z.object({ requestDigest: hash, view: simpleBookViewSchema }).strict()
    .parse(JSON.parse(fencedText(path.join(directory, names[names.length - 1]), 256000)));
  if (record.requestDigest !== reviewedTextDigest(queued) || record.view.requestId !== requestId ||
      record.view.revision !== Number(names[names.length - 1].slice(5, 9))) fail('simple_view_binding');
  return record.view;
}
export function claimSimpleBookWorker(config: SimpleBookConfig) {
  assertSimpleBookSource(config); const job = queuedSimpleBook(config);
  exclusiveJson(path.join(job.directory, 'worker-claimed.json'), { requestDigest: reviewedTextDigest(job.queued), sourceHead: config.sourceHead });
  let sequence = readdirSync(job.directory).filter(n => /^view-\d{4}\.json$/.test(n)).length;
  return { ...job, publish(view: SimpleBookView) {
    const parsed = simpleBookViewSchema.parse(view);
    if (parsed.requestId !== job.queued.requestId || sequence >= 80) fail('simple_view_binding');
    exclusiveJson(path.join(job.directory, `view-${String(++sequence).padStart(4, '0')}.json`), {
      requestDigest: reviewedTextDigest(job.queued), view: { ...parsed, revision: sequence } });
  } };
}
