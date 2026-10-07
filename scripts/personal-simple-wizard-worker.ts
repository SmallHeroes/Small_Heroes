/** Explicit local worker; never launched by a page, import, queue request or polling. */
import path from 'node:path';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import OpenAI from 'openai';
import { simpleBookConfig, assertSimpleBookSource, queuedSimpleBook, claimSimpleBookWorker, type SimpleBookConfig } from '../lib/personal-wizard/simple-book-bridge';
import { SimpleBookBudget, simpleBookExternalCosts } from '../lib/personal-wizard/simple-book-budget';
import { runSimpleWizardBook, SimpleBookFlowError, type SimpleBookReadingCall } from '../lib/personal-wizard/simple-book-flow';
import { emptySimpleBookView, type SimpleBookView } from '../lib/personal-wizard/simple-book-view';
import { personalBookProviderPayload, decodePersonalBookProviderOutput } from '../lib/personal-wizard/book-openai';
import type { SimpleStoryboardDiagnosticCall } from '../lib/personal-wizard/simple-storyboard-diagnostic';
import { generationTimeoutMs } from '../lib/personal-wizard/story-config';
import { CAUSAL_MODELS, createAstraCausalTransport, createOpusCausalTransport, prepareCausalWire, wireReservation, type WirePolicy } from './personal-causal-trial-adapters';
import { exclusiveJson, exclusiveText, fencedText } from './personal-causal-trial-journal';
import { safeUsage } from './personal-story-trial-guard';
import { readAuditionApproval, runSimpleBookIllustrator } from './personal-simple-book-illustrator';

const sha = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
const rates = { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 } };
/** Reuses the existing strict real SDK storyboard wire and decoder. */
export function simpleWizardVisualPayload(call: SimpleStoryboardDiagnosticCall) {
  return personalBookProviderPayload(call, CAUSAL_MODELS.astra);
}
function existingKey(config: SimpleBookConfig) {
  const lines = fencedText(config.existingKeyEnvFile, 256000).split(/\r?\n/).filter(l => /^\s*OPENAI_API_KEY\s*=/.test(l));
  const key = lines.length === 1 ? parseEnv(lines[0]).OPENAI_API_KEY : null;
  if (!key || !/^sk-\S{20,}$/.test(key)) throw new SimpleBookFlowError('simple_key_unavailable');
  return key;
}
export async function simpleWizardWorkerCLI(argv: string[]) {
  if (argv.length < 2 || argv.length > 3 || argv[0] !== '--config' || !path.isAbsolute(argv[1]) ||
      argv.length === 3 && argv[2] !== '--execute') throw Error('simple_worker_arguments');
  const config = simpleBookConfig(argv[1]); assertSimpleBookSource(config);
  if (sha(readFileSync(config.executable)) !== config.executableSha256) throw Error('simple_executable_changed');
  const externalMicroUsd = simpleBookExternalCosts(config.engineeringReceipts);
  readAuditionApproval(config);
  const queued = queuedSimpleBook(config);
  if (argv.length === 2) {
    console.log(JSON.stringify({ status: 'simple_worker_preview', requestId: queued.queued.requestId,
      sourceHead: config.sourceHead, pages: 8, cover: true, externalMicroUsd, maximumMicroUsd: 12000000,
      stageCount: 6, providerCalls: 0, imagesAvailable: !!config.illustratedAudition, runtimeEligible: false })); return 0;
  }
  // Empty workspace outside the repository: no project story examples/history for either fresh session.
  const cliWorkspace = path.join(config.outputParent, 'simple-book-cli-workspace'); mkdirSync(cliWorkspace);
  const worker = claimSimpleBookWorker(config), controller = new AbortController();
  const policy: WirePolicy = { executable: config.executable, executableSha256: config.executableSha256,
    workspace: cliWorkspace, maxWireBytes: 104000, rates };
  const opus = createOpusCausalTransport(policy);
  const astra = createAstraCausalTransport({ key: () => existingKey(config), rates: rates.astra });
  const budget = new SimpleBookBudget(path.join(worker.directory, 'paid-stages'), externalMicroUsd);
  const imageCalls = () => readdirSync(budget.root).filter(n => /^(?:reference_(?:child|entities|locations)|page_[0-8]_[01])\.claim\.json$/.test(n)).length;
  let failedStageCode: string | null = null;
  let last = emptySimpleBookView(worker.queued.requestId);
  const publish = (view: SimpleBookView) => {
    const snapshot = budget.snapshot();
    last = { ...view, accounting: { ...view.accounting, knownEstimateMicroUsd: snapshot.knownEstimateMicroUsd,
      unknownAttemptCosts: snapshot.unknownAttemptCosts, logicalAttempts: snapshot.logicalAttempts } };
    worker.publish(last); console.log(JSON.stringify({ phase: view.phase, ...snapshot, runtimeEligible: false }));
  };
  const assertCurrent = () => {
    if (controller.signal.aborted) throw new SimpleBookFlowError('simple_book_cancelled');
    assertSimpleBookSource(config);
    const current = simpleBookConfig(argv[1]);
    if (JSON.stringify(current) !== JSON.stringify(config)) throw new SimpleBookFlowError('simple_config_changed');
    simpleBookExternalCosts(config.engineeringReceipts);
  };
  async function openAIStage(call: SimpleStoryboardDiagnosticCall, signal: AbortSignal) {
    assertCurrent();
    if (signal !== controller.signal) throw new SimpleBookFlowError('simple_signal_binding');
    const payload = simpleWizardVisualPayload(call);
    const wireBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8'); if (wireBytes > 128000) throw new SimpleBookFlowError('simple_wire_limit');
    const rate = rates.astra;
    const maximumMicroUsd = wireReservation(wireBytes, call.maxOutputTokens, rate);
    const step = call.stage === 'review' ? 'storyboard_review' : call.stage;
    return budget.run(step, payload, maximumMicroUsd, async () => {
      // Claims/wire are already durable before credential read or HTTP dispatch.
      const client = new OpenAI({ apiKey: existingKey(config), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off' });
      const response = await client.responses.create(payload, { signal, timeout: generationTimeoutMs(call.maxOutputTokens) });
      const usage = safeUsage(response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null);
      const estimatedMicroUsd = usage && response.model === payload.model && response.service_tier === 'default'
        ? Math.ceil(usage.inputTokens * rate.inputMicroUsdPerToken + usage.outputTokens * rate.outputMicroUsdPerToken) : null;
      const receipt = { raw: response, usage, estimatedMicroUsd, model: response.model, stage: step };
      // Keep the actual response even if status, schema, tier or output is rejected.
      exclusiveJson(path.join(worker.directory, `${step}-provider-response.json`), receipt);
      if (signal.aborted || response.model !== payload.model || response.service_tier !== 'default' ||
          response.status !== 'completed' || !response.output_text || !usage || usage.outputTokens > call.maxOutputTokens) {
        throw Object.assign(new SimpleBookFlowError('simple_provider_invalid'), { receipt });
      }
      let raw: unknown;
      try { raw = JSON.parse(response.output_text); } catch { throw Object.assign(new SimpleBookFlowError('simple_provider_json'), { receipt }); }
      let output: unknown;
      try { output = decodePersonalBookProviderOutput(call, raw); }
      catch { throw Object.assign(new SimpleBookFlowError('simple_provider_schema'), { receipt }); }
      return { value: output, estimatedMicroUsd, receipt };
    }).catch(error => {
      failedStageCode = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[a-z0-9_]+$/.test(error.code)
        ? error.code : 'simple_provider_transport';
      throw error;
    });
  }
  const interrupt = () => controller.abort(); process.on('SIGINT', interrupt);
  try {
    publish(last);
    const result = await runSimpleWizardBook({ request: worker.queued.request, options: worker.options, seed: config.seed,
      signal: controller.signal, reservedWritingUsd: 4, publish,
      opus: async (call, signal) => {
        assertCurrent(); if (signal !== controller.signal) throw new SimpleBookFlowError('simple_signal_binding');
        const instructionFile = path.join(worker.directory, `${call.stage}-instructions.txt`); exclusiveText(instructionFile, call.instructions);
        const dispatch = { ...call, role: 'opus' as const, conversationKey: `wizard:${worker.queued.requestId}:${call.stage}` };
        const wire = prepareCausalWire(dispatch, policy, 2000000, instructionFile);
        // CLI cost is cumulative across internal turns; its existing --max-budget-usd is $2.
        // Visible-wire/token estimates are NOT a bound on that aggregate. Reserve the declared slot.
        return budget.run(call.stage, { ...wire, payload: wire.payload }, 2000000, async () => {
          const reply = await opus(wire, dispatch, signal);
          return { value: reply, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
        }).catch(error => {
          failedStageCode = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[a-z0-9_]+$/.test(error.code)
            ? error.code : 'simple_opus_transport';
          throw error;
        });
      }, reader: async (call: SimpleBookReadingCall, signal: AbortSignal) => {
        assertCurrent(); if (signal !== controller.signal) throw new SimpleBookFlowError('simple_signal_binding');
        const dispatch = { ...call, role: 'astra' as const, conversationKey: `wizard:${worker.queued.requestId}:${call.stage}` };
        const wire = prepareCausalWire(dispatch, policy, 2000000);
        return budget.run(call.stage, wire, wire.reservedMicroUsd, async () => {
          const reply = await astra(wire, dispatch, signal);
          return { value: reply.output, estimatedMicroUsd: reply.estimatedMicroUsd, receipt: reply };
        }).catch(error => {
          failedStageCode = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[a-z0-9_]+$/.test(error.code)
            ? error.code : 'simple_provider_transport';
          throw error;
        });
      }, visual: openAIStage });
    assertCurrent();
    exclusiveJson(path.join(worker.directory, 'simple-book-result.json'), result);
    exclusiveText(path.join(worker.directory, 'story.md'), `# ${result.source.manuscript.title}\n\n` +
      result.source.manuscript.pages.map(p => `## עמוד ${p.pageNumber}\n\n${p.text}`).join('\n\n') + '\n');
    let illustrated = false;
    if (config.illustratedAudition && result.status === 'review_supported') {
      const manifest = await runSimpleBookIllustrator({ config, directory: worker.directory, budget, key: () => existingKey(config),
        assertCurrent, signal: controller.signal, result, request: worker.queued.request, options: worker.options,
        progress: (phase, images) => publish({ ...last, phase, images }) });
      assertCurrent();
      publish({ ...last, phase: 'illustrated_audition', images: manifest.pages.map(p => ({ pageNumber: p.pageNumber, ...p.candidate })) });
      illustrated = true;
    }
    exclusiveJson(path.join(worker.directory, 'sealed.json'), { status: illustrated ? 'illustrated_audition' : result.status, snapshot: budget.snapshot(),
      imageCalls: imageCalls(), illustrated, runtimeEligible: false, visualQualification: 'not_granted' });
    return result.status === 'review_supported' ? 0 : 2;
  } catch (error) {
    const code = failedStageCode ?? (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[a-z0-9_]+$/.test(error.code)
      ? error.code : 'simple_worker_failed');
    controller.abort(); publish({ ...last, phase: 'failed', error: code });
    exclusiveJson(path.join(worker.directory, 'sealed.json'), { status: 'failed', code, snapshot: budget.snapshot(), imageCalls: imageCalls(), runtimeEligible: false });
    return 1;
  } finally { process.off('SIGINT', interrupt); }
}
