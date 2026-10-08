import 'server-only';
import path from 'node:path';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { simpleBookConfig, queuedSimpleBook, assertSimpleBookSource } from './simple-book-bridge';
import { simpleBookExternalCosts, SimpleBookBudget } from './simple-book-budget';
import { simpleBookViewSchema, type SimpleBookView } from './simple-book-view';
import { canonicalJson } from './request-acceptance';
import { exclusiveJson, fencedText } from '../../scripts/personal-causal-trial-journal';
import { CAUSAL_MODELS, type TransportReply } from '../../scripts/personal-causal-trial-adapters';
import type { SimpleStoryCall } from './simple-story-engine';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const file = z.object({ file: z.string().min(1), sha256: hash }).strict();
const relative = z.string().regex(/^(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:json|txt)$/).refine(s => !s.split('/').includes('..'));
export const simpleBookContinuationConfigSchema = z.object({ version: z.literal('controlled-simple-book-continuation/v1'),
  originalConfig: file, sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  approvalReference: z.string().min(30).max(2000), maximumMicroUsd: z.literal(12000000),
  terminationReceipt: file, artifacts: z.array(z.object({ relative, sha256: hash }).strict()).min(15).max(100),
  extraEngineeringReceipts: z.array(file).min(1).max(3),
}).strict();
const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const read = (name: string) => JSON.parse(fencedText(name, 4000000));

/** Explicit one-use continuation, not a restart or an archival source downgrade. No keys/providers. */
export function prepareSimpleBookContinuation(configFile: string) {
  if (!path.isAbsolute(configFile)) fail('continuation_config');
  const configBytes = fencedText(configFile, 32000), config = simpleBookContinuationConfigSchema.parse(JSON.parse(configBytes));
  const checked = (f: z.infer<typeof file>) => {
    if (!path.isAbsolute(f.file) || sha(fencedText(f.file, 4000000)) !== f.sha256) fail('continuation_evidence_changed');
  };
  checked(config.originalConfig); checked(config.terminationReceipt);
  const original = simpleBookConfig(config.originalConfig.file), current = { ...original, sourceHead: config.sourceHead };
  assertSimpleBookSource(current);
  const job = queuedSimpleBook(original);
  const inventory = new Map(config.artifacts.map(f => [f.relative, f.sha256]));
  if (inventory.size !== config.artifacts.length) fail('continuation_inventory');
  const required = ['request.json', 'worker-claimed.json', 'sealed.json', 'author-instructions.txt', 'editor-instructions.txt',
    ...readdirSync(path.join(job.directory, 'paid-stages')).map(n => `paid-stages/${n}`)];
  if (required.some(n => !inventory.has(n))) fail('continuation_inventory');
  const verify = () => {
    if (fencedText(configFile, 32000) !== configBytes) fail('continuation_config_changed');
    checked(config.originalConfig); checked(config.terminationReceipt); assertSimpleBookSource(current);
    for (const [name, digest] of inventory) if (sha(fencedText(path.join(job.directory, name), 4000000)) !== digest) fail('continuation_evidence_changed');
    if (readdirSync(path.join(job.directory, 'paid-stages')).some(n => !inventory.has(`paid-stages/${n}`))) fail('continuation_inventory');
    simpleBookExternalCosts(original.engineeringReceipts);
    simpleBookExternalCosts(config.extraEngineeringReceipts);
  };
  verify();
  const terminal = z.object({ code: z.literal(1), signal: z.null(), terminationConfirmed: z.literal(true) }).passthrough().parse(read(config.terminationReceipt.file));
  const sealed = z.object({ status: z.literal('failed'), code: z.literal('incomplete'), imageCalls: z.literal(0),
    runtimeEligible: z.literal(false), snapshot: z.unknown() }).strict().parse(read(path.join(job.directory, 'sealed.json')));
  const priorBudget = new SimpleBookBudget(path.join(job.directory, 'paid-stages'), simpleBookExternalCosts(original.engineeringReceipts));
  const inherited = priorBudget.snapshot();
  if (canonicalJson(sealed.snapshot) !== canonicalJson(inherited) || inherited.unknownAttemptCosts !== 0 || inherited.logicalAttempts !== 3 ||
      !inherited.stopped || inherited.accountedMicroUsd !== inherited.knownEstimateMicroUsd) fail('continuation_prior_outcome');
  const failures = ['author', 'editor', 'final_review'].filter(s => !read(path.join(priorBudget.root, `${s}.result.json`)).completed);
  if (canonicalJson(failures) !== canonicalJson(['final_review'])) fail('continuation_prior_outcome');
  for (const stage of ['author', 'editor', 'final_review']) {
    const claim = read(path.join(priorBudget.root, `${stage}.claim.json`)), result = read(path.join(priorBudget.root, `${stage}.result.json`));
    if (result.estimatedMicroUsd > claim.maximumMicroUsd) fail('continuation_prior_outcome');
  }
  const failed = read(path.join(priorBudget.root, 'final_review.failure.json'));
  const outcome = read(path.join(priorBudget.root, 'final_review.result.json'));
  const native = failed.receipt?.raw, u = failed.receipt?.usage;
  if (failed.code !== 'incomplete' || native?.status !== 'incomplete' || native?.incomplete_details?.reason !== 'max_output_tokens' ||
      native?.model !== CAUSAL_MODELS.astra || native?.service_tier !== 'default' || !u ||
      !Number.isSafeInteger(u.inputTokens) || u.inputTokens < 0 || !Number.isSafeInteger(u.outputTokens) || u.outputTokens <= 0 ||
      native.usage?.input_tokens !== u.inputTokens || native.usage?.output_tokens !== u.outputTokens ||
      failed.receipt.estimatedMicroUsd !== outcome.estimatedMicroUsd ||
      outcome.estimatedMicroUsd !== Math.ceil(u.inputTokens * 10 + u.outputTokens * 50)) fail('continuation_prior_outcome');
  const oldClaim = z.object({ sourceHead: z.literal(original.sourceHead), requestDigest: hash }).strict().parse(read(path.join(job.directory, 'worker-claimed.json')));
  if (oldClaim.requestDigest !== sha(canonicalJson(job.queued))) fail('continuation_request');
  const records: Record<'author' | 'editor', TransportReply> = {} as never;
  for (const stage of ['author', 'editor'] as const) records[stage] = read(path.join(priorBudget.root, `${stage}.receipt.json`));
  const reuseWriting = async (call: SimpleStoryCall) => {
    verify();
    const wire = read(path.join(priorBudget.root, `${call.stage}.wire.json`)), claim = read(path.join(priorBudget.root, `${call.stage}.claim.json`));
    if (wire.role !== 'opus' || wire.model !== CAUSAL_MODELS.opus || wire.stage !== call.stage || wire.outputCap !== call.maxOutputTokens ||
        wire.payload.instructions !== call.instructions || wire.payload.stdin !== call.input ||
        JSON.stringify(wire.payload) !== wire.json || sha(wire.json) !== wire.digest || sha(canonicalJson(wire)) !== claim.wireDigest ||
        !wire.payload.freshProcess || !wire.payload.args.includes('--no-session-persistence')) fail('continuation_writer_binding');
    call.schema.parse(records[call.stage].output);
    return records[call.stage]; // Historical paid records; the existing current-source factory verifies them again.
  };
  const priorPaths = new Set(original.engineeringReceipts.map(f => path.resolve(f.file).toLowerCase()));
  if (config.extraEngineeringReceipts.some(f => priorPaths.has(path.resolve(f.file).toLowerCase()))) fail('continuation_duplicate_cost');
  const extra = simpleBookExternalCosts(config.extraEngineeringReceipts), externalMicroUsd = inherited.accountedMicroUsd + extra;
  if (externalMicroUsd >= 12000000) fail('continuation_budget');
  const directory = path.join(job.directory, 'controlled-continuation-20261008');
  return { config, current, original, job, terminal, inherited, extra, externalMicroUsd, directory, verify, reuseWriting,
    claim() {
      verify(); mkdirSync(directory); // Fixed repository-owned slot; changing config/output cannot create another continuation.
      exclusiveJson(path.join(directory, 'claim.json'), { requestDigest: oldClaim.requestDigest, sourceHead: config.sourceHead,
        originalSourceHead: original.sourceHead, configSha256: sha(configBytes), inherited, extra, runtimeEligible: false });
      const budget = new SimpleBookBudget(path.join(directory, 'paid-stages'), externalMicroUsd);
      exclusiveJson(path.join(directory, 'writing-reuse.json'), { mode: 'existing_paid_records_no_new_writer_dispatch',
        sourceHead: original.sourceHead, author: sha(canonicalJson(records.author)), editor: sha(canonicalJson(records.editor)) });
      let sequence = readdirSync(job.directory).filter(n => /^view-\d{4}\.json$/.test(n)).length;
      const worker = { ...job, publish(view: SimpleBookView) {
        // A source/config drift must still be reportable as failure, but never publish ready content after it.
        if (view.phase !== 'failed') verify();
        else if (sha(canonicalJson(read(path.join(job.directory, 'request.json')))) !== oldClaim.requestDigest) fail('continuation_request');
        const parsed = simpleBookViewSchema.parse(view);
        if (parsed.requestId !== job.queued.requestId || sequence >= 80) fail('continuation_view');
        exclusiveJson(path.join(job.directory, `view-${String(++sequence).padStart(4, '0')}.json`), {
          requestDigest: oldClaim.requestDigest, view: { ...parsed, revision: sequence } });
      } };
      return { budget, worker };
    } };
}
