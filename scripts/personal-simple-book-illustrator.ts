/** The local worker's explicit opt-in audition adapter. No work runs on import. */
import path from 'node:path';
import { mkdirSync, readFileSync, lstatSync, openSync, writeFileSync, fsyncSync, closeSync } from 'node:fs';
import sharp from 'sharp';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { generateGPTImage, planGPTImageRequest } from '../lib/generate-image';
import { getCompanionById } from '../lib/companions';
import { PREVIEW_JUDGE_INSTRUCTION, previewQualityReviewSchema } from '../lib/local-preview-quality';
import { previewSha } from '../lib/local-story-preview';
import { evaluatePageChildResemblanceVision } from '../lib/generation-pipeline/page-child-resemblance-vision';
import { illustrateSimpleBook, illustratedBookHTML, illustratedAuditionApprovalSchema, type AuditionImage, SimpleIllustrationError } from '../lib/personal-wizard/simple-book-illustrations';
import { SimpleBookBudget } from '../lib/personal-wizard/simple-book-budget';
import { simpleBookReviewPolicy, type SimpleBookConfig } from '../lib/personal-wizard/simple-book-bridge';
import type { runSimpleWizardBook } from '../lib/personal-wizard/simple-book-flow';
import type { PersonalWizardOptions } from '../lib/personal-wizard/options';
import { exclusiveJson, exclusiveText, fencedText, realDirectory } from './personal-causal-trial-journal';
import { CAUSAL_MODELS } from './personal-causal-trial-adapters';

const fail = (code: string): never => { throw new SimpleIllustrationError(code); };
const tokens = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export function auditionUsageCost(raw: unknown, kind: 'image' | 'astra' | 'sol' | 'identity'): number | null {
  const u = z.object({ input_tokens: tokens, output_tokens: tokens }).passthrough().safeParse(raw);
  if (!u.success || u.data.input_tokens + u.data.output_tokens === 0) return null;
  // Image input is conservatively ALL priced at $8/M; no cache or lower text-input discount.
  const longSol = kind === 'sol' && u.data.input_tokens > 272000;
  // Official gpt-6.1-sol Pricing notes: >272K input =>2x input,1.5x output.
  // https://developers.openai.com/api/docs/models/gpt-6.1-sol
  return Math.ceil(u.data.input_tokens * (kind === 'image' ? 8 : kind === 'astra' ? 10 : kind === 'sol' ? longSol ? 4 : 2 : 2.5) +
    u.data.output_tokens * (kind === 'image' ? 30 : kind === 'astra' ? 50 : longSol ? 15 : 10));
}
export function readAuditionApproval(config: SimpleBookConfig) {
  if (!config.illustratedAudition) return null;
  const raw = fencedText(config.illustratedAudition.approvalFile, 32000);
  if (previewSha(raw) !== config.illustratedAudition.approvalSha256) fail('simple_visual_approval_changed');
  return illustratedAuditionApprovalSchema.parse(JSON.parse(raw));
}
export function readAuditionImage(directory: string, image: AuditionImage) {
  if (!/^[a-z0-9_]+\.png$/.test(image.imageName)) fail('simple_image_path');
  realDirectory(directory); const file = path.join(directory, image.imageName), stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 20000000) fail('simple_image_file');
  const bytes = readFileSync(file); if (previewSha(bytes) !== image.imageSha) fail('simple_image_changed'); return bytes;
}
/** Same source-bound real-pixel adapter for book pages and the explicit diagnostic control. */
export function createSimpleBookPixelJudge(args: {
  config: Pick<SimpleBookConfig, 'reviewModel'>; directory: string; budget: SimpleBookBudget; key: () => string;
  assertCurrent: () => void; signal: AbortSignal; save: (name: string, value: unknown) => void;
}): Parameters<typeof illustrateSimpleBook>[0]['judge'] {
  const reviewPolicy = simpleBookReviewPolicy(args.config), selectedModel = args.config.reviewModel;
  const check = () => { if (args.signal.aborted) fail('simple_illustration_cancelled');
    if (args.config.reviewModel !== selectedModel) fail('simple_review_model_changed'); args.assertCurrent(); };
  const data = (image: AuditionImage) => `data:image/png;base64,${readAuditionImage(args.directory, image).toString('base64')}`;
  return async (step, candidate, context, contextSha, refs, predecessor) => {
    check(); const buffer = readAuditionImage(args.directory, candidate), meta = await sharp(buffer).metadata();
    const width = meta.width!, height = meta.height!, cw = Math.ceil(width * .7), ch = Math.ceil(height * .7);
    const crops = await Promise.all([[0, 0], [width - cw, 0], [0, height - ch], [width - cw, height - ch]].map(async ([left, top]) =>
      `data:image/png;base64,${(await sharp(buffer).extract({ left, top, width: cw, height: ch }).png().toBuffer()).toString('base64')}`));
    const imageURLs = [data(candidate), ...crops, ...refs.map(data), ...(predecessor ? [data(predecessor)] : [])];
    const text = JSON.stringify({ candidateSha: candidate.imageSha, contextSha, context,
      imageRoles: ['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right', 'candidate_crop_bottom_left', 'candidate_crop_bottom_right',
        ...refs.map((_, i) => `canonical_${['child', 'companion', 'entities', 'locations'][i]}`), ...(predecessor ? ['prior_same_scene_comparison_not_authority'] : [])] });
    const payload = { model: reviewPolicy.model, store: false, service_tier: 'default' as const, reasoning: { effort: 'medium' as const },
      instructions: PREVIEW_JUDGE_INSTRUCTION,
      input: [{ role: 'user' as const, content: [{ type: 'input_text' as const, text },
        ...imageURLs.map(image_url => ({ type: 'input_image' as const, image_url, detail: 'high' as const }))] }],
      max_output_tokens: 12000, text: { format: zodTextFormat(previewQualityReviewSchema, 'personal_audition_pixels') } };
    if (selectedModel && (imageURLs.length > 10 || Buffer.byteLength(text + PREVIEW_JUDGE_INSTRUCTION, 'utf8') > 104000)) fail('simple_pixel_input_limit');
    // Official Sol calculator does not yet give a multiplier. An explicit conservative
    // USD0.60 admission slot, not an invented tokenizer bound or invoice hard cap.
    const maximumMicroUsd = selectedModel ? 600000
      : (Buffer.byteLength(text + PREVIEW_JUDGE_INSTRUCTION, 'utf8') + imageURLs.length * 3001) * 10 + 12000 * 50;
    return args.budget.run(step, payload, maximumMicroUsd, async () => {
      check(); const client = new OpenAI({ apiKey: args.key(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off' });
      const raw = await client.responses.create(payload, { signal: args.signal, timeout: 300000 });
      const estimatedMicroUsd = raw.model === reviewPolicy.model && raw.service_tier === 'default' ? auditionUsageCost(raw.usage, selectedModel ? 'sol' : 'astra') : null;
      const receipt = { raw, estimatedMicroUsd }; args.save(`${step}_provider`, receipt);
      if (raw.status !== 'completed' || raw.model !== reviewPolicy.model || raw.service_tier !== 'default' || !raw.output_text || !raw.usage || raw.usage.output_tokens > 12000)
        throw Object.assign(new SimpleIllustrationError('simple_pixel_provider_invalid'), { receipt });
      try { const value = previewQualityReviewSchema.parse(JSON.parse(raw.output_text)); check(); return { value, estimatedMicroUsd, receipt }; }
      catch { throw Object.assign(new SimpleIllustrationError('simple_pixel_schema'), { receipt }); }
    });
  };
}
export async function runSimpleBookIllustrator(args: {
  config: SimpleBookConfig; directory: string; budget: SimpleBookBudget; key: () => string; assertCurrent: () => void;
  signal: AbortSignal; result: Awaited<ReturnType<typeof runSimpleWizardBook>>; request: unknown; options: PersonalWizardOptions;
  progress: Parameters<typeof illustrateSimpleBook>[0]['progress'];
}) {
  const approval = readAuditionApproval(args.config); if (!approval) fail('simple_visual_approval_missing');
  const directory = path.join(args.directory, 'illustrations'); mkdirSync(directory); realDirectory(directory);
  const check = () => { if (args.signal.aborted) fail('simple_illustration_cancelled'); args.assertCurrent(); readAuditionApproval(args.config); };
  const writeImage = async (name: string, bytes: Buffer) => {
    if (!/^[a-z0-9_]+\.png$/.test(name)) fail('simple_image_path');
    const meta = await sharp(bytes).metadata();
    if (meta.format !== 'png' || !meta.width || !meta.height || meta.width > 1536 || meta.height > 1536) fail('simple_image_dimensions');
    const fd = openSync(path.join(directory, name), 'wx'); try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
    return { imageName: name, imageSha: previewSha(bytes) };
  };
  check();
  const companion = getCompanionById((args.request as { companion: { id: string } }).companion.id);
  const cardImage = companion?.cardImage;
  if (!cardImage || !/^\/companions\/[a-z0-9_]+\/style01-sheets\/front\.png$/.test(cardImage)) return fail('simple_companion_reference');
  const companionImage = await writeImage('companion_reference.png', readFileSync(path.join(args.config.workspace, 'public', cardImage.slice(1))));
  const data = (image: AuditionImage) => `data:image/png;base64,${readAuditionImage(directory, image).toString('base64')}`;
  const save = (name: string, value: unknown) => exclusiveJson(path.join(args.directory, `${name}.json`), value);
  const render: Parameters<typeof illustrateSimpleBook>[0]['render'] = async (step, prompt, refs, mode) => {
    check(); const bytes = refs.map(r => readAuditionImage(directory, r));
    const input = { finalPrompt: prompt, referenceImages: refs.map(r => path.join(directory, r.imageName)), referenceMode: mode,
      requireReferenceEdit: refs.length > 0, quality: 'low' as const, size: '1024x1024' as const, modelOverride: 'gpt-image-2',
      signal: args.signal, requestTimeoutMs: 180000 };
    const plan = planGPTImageRequest(input, { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
    if (plan.referenceCountPassed !== refs.length) fail('simple_reference_truncated');
    const owned = args.config.actorOwnedAppearance === true;
    if (owned && (plan.bodyWithoutBinaryImage.model !== 'gpt-image-2' || plan.bodyWithoutBinaryImage.quality !== 'low' ||
        plan.bodyWithoutBinaryImage.size !== '1024x1024' || plan.bodyWithoutBinaryImage.n !== 1)) fail('simple_image_price_contract');
    const wire = { body: plan.bodyWithoutBinaryImage, mode: plan.apiMode, references: refs,
      retries: 0, deadlineMs: 180000, pricing: 'image_input_8_output_30_conservative_no_cache',
      ...(owned ? { outputReservationTokens: 8192, policy: 'one_low_1024_owned_audition' } : {}) };
    // Legacy reservation unchanged. For the explicitly owned ONE LOW1024 image:
    // official output costs LOW$0.006, even HIGH$0.211 (=~7033 tokens at$30/M).
    // Reserve8192 output tokens, retaining the conservative8192 input/reference.
    // Real usage is still enforced; no model/quality/output/USD12 ceiling change.
    // https://developers.openai.com/api/docs/guides/image-generation#calculating-costs
    const maximumMicroUsd = Buffer.byteLength(plan.finalPrompt, 'utf8') * 8 + refs.length * 8192 * 8 + (owned ? 8192 : 32768) * 30;
    return args.budget.run(step, wire, maximumMicroUsd, async () => {
      let raw: unknown = null;
      try {
        const image = await generateGPTImage({ ...input, apiKey: args.key(), exactReferenceBytes: bytes,
          observeProviderResponse: response => { raw = response; save(`${step}_provider`, response); } });
        const cost = auditionUsageCost(image.usage, 'image');
        if (owned && (image.model !== 'gpt-image-2' || image.fallbackUsed)) throw Object.assign(new SimpleIllustrationError('simple_image_model'), { receipt: { raw, estimatedMicroUsd: null } });
        if (owned) { const metadata = await sharp(image.buffer).metadata();
          if (metadata.width !== 1024 || metadata.height !== 1024) throw Object.assign(new SimpleIllustrationError('simple_image_dimensions'), { receipt: { raw, estimatedMicroUsd: cost } }); }
        const candidate = await writeImage(`${step}.png`, image.buffer); check();
        return { value: candidate, estimatedMicroUsd: cost,
          receipt: { raw, estimatedMicroUsd: cost, model: image.model, refsRequested: image.referenceCountRequested, refsPassed: image.referenceCountPassed, candidate } };
      } catch (error) {
        const usage = raw && typeof raw === 'object' && 'usage' in raw ? raw.usage : null;
        throw Object.assign(new SimpleIllustrationError('simple_image_provider_failed'), {
          receipt: error && typeof error === 'object' && 'receipt' in error ? error.receipt : { raw, estimatedMicroUsd: auditionUsageCost(usage, 'image') } });
      }
    });
  };
  const judge = createSimpleBookPixelJudge({ config: args.config, directory, budget: args.budget, key: args.key,
    assertCurrent: check, signal: args.signal, save });
  const identity: Parameters<typeof illustrateSimpleBook>[0]['identity'] = async (step, child, candidate) => {
    check();
    let transportError: unknown = null;
    const result = await evaluatePageChildResemblanceVision({ referenceImageUrl: data(child), candidateImageUrl: data(candidate), threshold: .7,
      model: 'gpt-4o', apiKey: 'credential-is-injected-only-after-claim', maxRetries: 0, shouldStartAttempt: () => !args.signal.aborted,
      fetchImpl: async (url, init) => {
        check(); const wire = JSON.parse(String(init!.body));
        return args.budget.run(step, wire, 50000, async () => {
          const response = await fetch(url, { ...init, signal: AbortSignal.any([args.signal, init!.signal!]),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.key()}` } });
          const raw = await response.clone().json() as { model?: string; usage?: { prompt_tokens: number; completion_tokens: number } };
          const knownModel = ['gpt-4o', 'gpt-4o-2024-08-06', 'gpt-4o-2024-11-20'].includes(raw.model ?? '');
          const estimatedMicroUsd = auditionUsageCost(knownModel && raw.usage ? { input_tokens: raw.usage.prompt_tokens, output_tokens: raw.usage.completion_tokens } : null, 'identity');
          const receipt = { raw, estimatedMicroUsd, status: response.status }; save(`${step}_provider`, receipt);
          if (!response.ok || !knownModel || !raw.usage || raw.usage.completion_tokens > 180) throw Object.assign(new SimpleIllustrationError('simple_identity_provider_failed'), { receipt });
          return { value: response, estimatedMicroUsd, receipt };
        }).catch(error => { transportError = error; throw error; });
      } });
    if (transportError) throw transportError;
    return result;
  };
  const manifest = await illustrateSimpleBook({ result: args.result, request: args.request, options: args.options, seed: args.config.seed,
    approval, childDesign: args.config.illustratedAudition!.childDesign, companion: companionImage, signal: args.signal,
    actorOwnedAppearance: args.config.actorOwnedAppearance,
    render, judge, identity, save, progress: args.progress });
  exclusiveText(path.join(args.directory, 'book.html'), illustratedBookHTML(manifest, (imageName, imageSha) => data({ imageName, imageSha })));
  return manifest;
}
