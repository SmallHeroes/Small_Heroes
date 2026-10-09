/**
 * Reviewed LOW audition of the ONE already-reviewed simple book. Dry run by default: no key, no provider.
 *   node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/personal-simple-book-reviewed-audition.ts \
 *     --book-dir <one-approved-book-20261008> --out <new empty directory> [--execute --key-env-file <file> --max-usd 6 [--resume]]
 * Not production, customer or release authority. Every paid call is journaled before dispatch.
 */
import path from 'node:path';
import { existsSync, mkdirSync, readdirSync, readFileSync, lstatSync, openSync, writeFileSync, fsyncSync, closeSync } from 'node:fs';
import sharp from 'sharp';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { generateGPTImage, planGPTImageRequest, type BookDesignReferenceRole } from '../lib/generate-image';
import { getCompanionById } from '../lib/companions';
import { PREVIEW_JUDGE_INSTRUCTION, previewQualityReviewSchema, qualityDisposition } from '../lib/local-preview-quality';
import { previewSha } from '../lib/local-story-preview';
import { evaluatePageChildResemblanceVision } from '../lib/generation-pipeline/page-child-resemblance-vision';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { prepareSimpleStory } from '../lib/personal-wizard/simple-story-engine';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardReviewDisposition,
  currentPersonalStoryboardFrame } from '../lib/personal-wizard/storyboard';
import { simpleReferenceDesignContext, type AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { illustrateReviewedAudition, reviewedAuditionHTML, auditionSheetDesigns, auditionSheetPrompt, AUDITION_SHEET_JUDGE_INSTRUCTION,
  REVIEWED_AUDITION_POLICY, AUDITION_WORST_CASE_CALLS, ReviewedAuditionError } from '../lib/personal-wizard/simple-book-reviewed-audition';
import { auditionUsageCost } from './personal-simple-book-illustrator';
import { exclusiveJson, exclusiveText, fencedText, realDirectory } from './personal-causal-trial-journal';

const fail = (code: string): never => { throw new ReviewedAuditionError(code); };
const read = (file: string) => JSON.parse(fencedText(file, 32000000));
const SEED = 'goni-new-cardboard-adventure-20261008';
const CHILD_DESIGN = 'A new fictional six-year-old girl with short softly wavy chestnut-brown hair, warm brown eyes and light warm skin; natural child proportions, expressive but not oversized eyes. No glasses or face accessories. Match the exact wardrobe specified by the whole-book plan.';
const REVIEW_MODEL = 'gpt-6.1-sol';

/** Strict read-only admission of the reviewed storyboard and the accepted child/companion references. */
export function loadReviewedBook(bookDir: string, workspace = process.cwd()) {
  realDirectory(bookDir);
  const queued = z.object({ version: z.literal('local-simple-wizard-request/v1'), requestId: z.string(), optionsFingerprint: z.string(),
    request: z.unknown() }).passthrough().parse(read(path.join(bookDir, 'request.json')));
  const options = resolvePersonalWizardOptions(workspace), prepared = prepareSimpleStory(queued.request, options, SEED);
  if (prepared.accepted.requestId !== queued.requestId || prepared.accepted.optionsFingerprint !== queued.optionsFingerprint ||
      prepared.book.pages !== 8 || prepared.accepted.containsFixtureData || prepared.accepted.canonical.appearance.photo !== 'none') fail('audition_request_binding');
  const visual = path.join(bookDir, 'controlled-visual-continuation-20261008');
  const result = read(path.join(visual, 'visual_simple_book_result.json'));
  if (result.status !== 'review_supported' || result.runtimeEligible !== false || result.storyboard?.status !== 'review_supported') fail('audition_result_status');
  const source = prepareCurrentPersonalStoryboard(queued.request, result.source, options, true);
  const book = compilePersonalStoryboard(source, read(path.join(visual, 'owned_storyboard_draft.json')));
  const rawReview = result.storyboard.rawReview;
  if (canonicalJson(book) !== canonicalJson(result.storyboard.storyboard) || !book.plan.actorAppearance ||
      storyboardReviewDisposition(book, rawReview).disposition !== 'review_supported' || result.storyboard.framePackets.length !== 9) fail('audition_board_binding');
  const current = { request: queued.request, writerResult: result.source, options };
  for (let n = 0; n <= 8; n++) if (canonicalJson(currentPersonalStoryboardFrame(book, rawReview, n, current)) !== canonicalJson(result.storyboard.framePackets[n])) fail('audition_frame_binding');
  // Child: the reviewed, passed reference adopted by the last continuation, bound to its recomputed original context.
  const m17 = path.join(bookDir, 'reference-role-repair-continuation-20261009');
  const adoption = read(path.join(m17, 'reference_child_adoption.json'));
  const childDesign = { age: prepared.brief.child.age, address: prepared.brief.child.address, fictionalDesign: CHILD_DESIGN,
    wardrobe: book.plan.wardrobe, role: 'child', clothing: book.plan.actorAppearance!.child.clothing };
  const childContext = simpleReferenceDesignContext(childDesign);
  const childBytes = readFileSync(path.join(m17, 'illustrations', 'reference_child_checkpoint.png'));
  if (adoption.name !== 'child' || canonicalJson(adoption.context) !== canonicalJson(childContext) || previewSha(childBytes) !== adoption.candidate.imageSha ||
      qualityDisposition(adoption.review, adoption.candidate.imageSha, previewSha(JSON.stringify(childContext))).disposition !== 'passed') fail('audition_child_reference');
  const card = getCompanionById((queued.request as { companion: { id: string } }).companion.id)?.cardImage;
  if (!card || !/^\/companions\/[a-z0-9_]+\/style01-sheets\/front\.png$/.test(card)) return fail('audition_companion_reference');
  const companionBytes = readFileSync(path.join(workspace, 'public', card.slice(1)));
  if (previewSha(companionBytes) !== previewSha(readFileSync(path.join(m17, 'illustrations', 'companion_reference.png')))) fail('audition_companion_reference');
  return { queued, options, prepared, result, book, rawReview, current, childBytes, companionBytes,
    texts: (result.source.manuscript.pages as { text: string }[]).map(p => p.text), title: result.source.manuscript.title as string,
    pages: result.source.manuscript.pages as { text: string }[] };
}

/** Journals every paid call before dispatch; a failed call costs its known amount (or its full reservation) but does not end the book. */
export class AuditionMeter {
  // A full run plus one interrupted page redone once on resume.
  constructor(readonly root: string, readonly capMicroUsd: number, readonly maxCalls = AUDITION_WORST_CASE_CALLS + REVIEWED_AUDITION_POLICY.pageAttempts * 3) {
    if (!Number.isSafeInteger(capMicroUsd) || capMicroUsd < 1 || capMicroUsd > 8000000) fail('audition_meter_policy');
    if (!existsSync(root)) mkdirSync(root); realDirectory(root);
  }
  snapshot() {
    let accountedMicroUsd = 0, knownMicroUsd = 0, calls = 0, failed = 0, unknown = 0;
    for (const name of readdirSync(this.root).filter(n => n.endsWith('.claim.json'))) {
      const claim = JSON.parse(readFileSync(path.join(this.root, name), 'utf8')), file = path.join(this.root, name.replace('.claim.', '.result.'));
      const result = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null; calls++;
      if (result && !result.completed) failed++;
      if (typeof result?.estimatedMicroUsd === 'number') { accountedMicroUsd += result.estimatedMicroUsd; knownMicroUsd += result.estimatedMicroUsd; }
      else { accountedMicroUsd += claim.maximumMicroUsd; unknown++; }
    }
    return { accountedMicroUsd, knownMicroUsd, calls, failed, unknown };
  }
  async run<T>(step: string, wire: unknown, maximumMicroUsd: number,
    dispatch: () => Promise<{ value: T; estimatedMicroUsd: number | null; receipt: unknown }>) {
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(step) || !Number.isSafeInteger(maximumMicroUsd) || maximumMicroUsd < 1) fail('audition_meter_policy');
    const state = this.snapshot();
    if (state.calls >= this.maxCalls) fail('audition_call_limit');
    if (state.accountedMicroUsd + maximumMicroUsd > this.capMicroUsd) fail('audition_budget_exhausted');
    const wireDigest = previewSha(canonicalJson(wire));
    exclusiveJson(path.join(this.root, `${step}.wire.json`), wire);
    exclusiveJson(path.join(this.root, `${step}.claim.json`), { step, wireDigest, maximumMicroUsd });
    try {
      const made = await dispatch();
      exclusiveJson(path.join(this.root, `${step}.receipt.json`), made.receipt);
      exclusiveJson(path.join(this.root, `${step}.result.json`), { wireDigest, estimatedMicroUsd: made.estimatedMicroUsd, completed: true });
      return made.value;
    } catch (error) {
      const receipt = error && typeof error === 'object' && 'receipt' in error ? (error as { receipt: unknown }).receipt : null;
      const cost = receipt && typeof receipt === 'object' && 'estimatedMicroUsd' in receipt &&
        Number.isSafeInteger((receipt as { estimatedMicroUsd: unknown }).estimatedMicroUsd) ? (receipt as { estimatedMicroUsd: number }).estimatedMicroUsd : null;
      const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[a-z0-9_]+$/.test(error.code) ? error.code : 'audition_stage_failed';
      exclusiveJson(path.join(this.root, `${step}.failure.json`), { code, message: error instanceof Error ? error.message.slice(0, 500) : null, receipt });
      exclusiveJson(path.join(this.root, `${step}.result.json`), { wireDigest, estimatedMicroUsd: cost, completed: false });
      throw error;
    }
  }
}

/** Reads ONLY the OPENAI_API_KEY line, only when a claimed call dispatches. Never logged. */
export function keyReader(file: string) {
  return () => {
    const line = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).find(l => /^\s*(export\s+)?OPENAI_API_KEY\s*=/.test(l));
    const value = line?.replace(/^\s*(export\s+)?OPENAI_API_KEY\s*=\s*/, '').trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!value || /\s/.test(value)) fail('audition_key_missing');
    return value!;
  };
}

const dataUrl = (bytes: Buffer) => `data:image/png;base64,${bytes.toString('base64')}`;
const digestImages = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (_k, v) =>
  typeof v === 'string' && v.startsWith('data:image/png;base64,') ? `sha256:${previewSha(Buffer.from(v.slice(22), 'base64'))}` : v));

export async function runReviewedAudition(args: { bookDir: string; out: string; keyFile: string; maxMicroUsd: number; signal: AbortSignal;
  log: (line: string) => void; resume?: true }) {
  const loaded = loadReviewedBook(args.bookDir);
  if (existsSync(args.out) !== !!args.resume) fail(args.resume ? 'audition_resume_missing' : 'audition_out_exists');
  if (!args.resume) mkdirSync(args.out); realDirectory(args.out);
  const directory = path.join(args.out, 'illustrations'); if (!args.resume) mkdirSync(directory); realDirectory(directory);
  const meter = new AuditionMeter(path.join(args.out, 'paid-stages'), args.maxMicroUsd), key = keyReader(args.keyFile);
  const save = (name: string, value: unknown) => exclusiveJson(path.join(args.out, `${name}.json`), value);
  const check = () => { if (args.signal.aborted) fail('audition_cancelled'); };
  const writeImage = async (name: string, bytes: Buffer) => {
    if (!/^[a-z0-9_]+\.png$/.test(name)) fail('audition_image_path');
    const meta = await sharp(bytes).metadata();
    if (meta.format !== 'png' || !meta.width || !meta.height || meta.width > 1536 || meta.height > 1536) fail('audition_image_dimensions');
    const fd = openSync(path.join(directory, name), 'wx'); try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
    return { imageName: name, imageSha: previewSha(bytes) };
  };
  const bytesOf = (image: AuditionImage) => {
    if (!/^[a-z0-9_]+\.png$/.test(image.imageName)) fail('audition_image_path');
    const file = path.join(directory, image.imageName), stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20000000) fail('audition_image_file');
    const bytes = readFileSync(file); if (previewSha(bytes) !== image.imageSha) fail('audition_image_changed'); return bytes;
  };
  const admissionFor = (child: AuditionImage, companion: AuditionImage) => ({ version: 'reviewed-simple-book-audition-admission/v1', requestId: loaded.queued.requestId,
    sourceDigest: loaded.book.sourceDigest, storyboardDigest: loaded.book.storyboardDigest, child, companion, policy: REVIEWED_AUDITION_POLICY,
    capMicroUsd: args.maxMicroUsd, imageModel: 'gpt-image-2', imageQuality: 'low', reviewModel: REVIEW_MODEL, identityModel: 'gpt-4o' });
  let child: AuditionImage, companion: AuditionImage, resume: Parameters<typeof illustrateReviewedAudition>[0]['resume'];
  if (args.resume) {
    // Same book, same accepted references, same policy and cap; completed work is re-bound, never trusted blindly.
    const prior = read(path.join(args.out, 'admission.json'));
    child = { imageName: 'reference_child.png', imageSha: previewSha(loaded.childBytes) };
    companion = { imageName: 'reference_companion.png', imageSha: previewSha(loaded.companionBytes) };
    bytesOf(child); bytesOf(companion);
    if (canonicalJson(prior) !== canonicalJson(JSON.parse(JSON.stringify(admissionFor(child, companion))))) fail('audition_resume_admission');
    const optional = (name: string) => existsSync(path.join(args.out, `${name}.json`)) ? read(path.join(args.out, `${name}.json`)) : undefined;
    const pages = []; for (let n = 0; n <= 8 && optional(`page_${n}`); n++) pages.push(optional(`page_${n}`));
    const markers = readdirSync(args.out).filter(n => /^resume-[0-9]+\.json$/.test(n)).length + 1;
    resume = { designs: read(path.join(args.out, 'audition_sheet_designs.json')), sheets: { entities: optional('sheet_entities'), locations: optional('sheet_locations') },
      pages, stepPrefix: `r${markers}_` };
    save(`resume-${markers}`, { resumedPages: pages.length, spendBefore: meter.snapshot(), at: new Date().toISOString() });
    args.log(`resume ${markers}: reusing ${pages.length} completed pages, spent so far ${(meter.snapshot().accountedMicroUsd / 1e6).toFixed(3)}`);
  } else {
    child = await writeImage('reference_child.png', loaded.childBytes);
    companion = await writeImage('reference_companion.png', loaded.companionBytes);
    save('admission', admissionFor(child, companion));
  }

  const render = async (step: string, prompt: string, refs: AuditionImage[], mode: 'book_identity' | 'book_design', roles?: readonly BookDesignReferenceRole[]) => {
    check(); const bytes = refs.map(bytesOf);
    const input = { finalPrompt: prompt, referenceImages: refs.map(r => path.join(directory, r.imageName)), referenceMode: mode,
      ...(roles ? { referenceRoles: roles } : {}), requireReferenceEdit: refs.length > 0, quality: 'low' as const, size: '1024x1024' as const,
      modelOverride: 'gpt-image-2', signal: args.signal, requestTimeoutMs: 180000 };
    const plan = planGPTImageRequest(input, { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
    if (plan.referenceCountPassed !== refs.length) fail('audition_reference_truncated');
    if (plan.bodyWithoutBinaryImage.model !== 'gpt-image-2' || plan.bodyWithoutBinaryImage.quality !== 'low' ||
        plan.bodyWithoutBinaryImage.size !== '1024x1024' || plan.bodyWithoutBinaryImage.n !== 1) fail('audition_image_price_contract');
    const wire = { body: plan.bodyWithoutBinaryImage, mode: plan.apiMode, references: refs, ...(plan.referenceRoles ? { referenceRoles: plan.referenceRoles } : {}),
      retries: 0, deadlineMs: 180000, pricing: 'image_input_8_output_30_conservative_no_cache', outputReservationTokens: 8192 };
    const maximumMicroUsd = Buffer.byteLength(plan.finalPrompt, 'utf8') * 8 + refs.length * 8192 * 8 + 8192 * 30;
    return meter.run(step, wire, maximumMicroUsd, async () => {
      let raw: unknown = null;
      try {
        const image = await generateGPTImage({ ...input, apiKey: key(), exactReferenceBytes: bytes, observeProviderResponse: response => { raw = response; } });
        const cost = auditionUsageCost(image.usage, 'image');
        if (image.model !== 'gpt-image-2' || image.fallbackUsed) throw Object.assign(new ReviewedAuditionError('audition_image_model'), { receipt: { raw: digestImages(raw), estimatedMicroUsd: cost } });
        const meta = await sharp(image.buffer).metadata();
        if (meta.width !== 1024 || meta.height !== 1024) throw Object.assign(new ReviewedAuditionError('audition_image_dimensions'), { receipt: { raw: digestImages(raw), estimatedMicroUsd: cost } });
        const candidate = await writeImage(`${step}.png`, image.buffer); check();
        return { value: candidate, estimatedMicroUsd: cost, receipt: { raw: digestImages(raw), estimatedMicroUsd: cost, model: image.model, candidate } };
      } catch (error) {
        if (error && typeof error === 'object' && 'receipt' in error) throw error;
        const usage = raw && typeof raw === 'object' && 'usage' in raw ? (raw as { usage: unknown }).usage : null;
        throw Object.assign(new ReviewedAuditionError('audition_image_provider_failed'), { cause: error,
          receipt: { raw: digestImages(raw), estimatedMicroUsd: auditionUsageCost(usage, 'image') } });
      }
    });
  };

  const judge = async (step: string, candidate: AuditionImage, context: unknown, contextSha: string, refs: AuditionImage[],
    predecessor: AuditionImage | null, kind: 'sheet' | 'page') => {
    check(); const buffer = bytesOf(candidate), meta = await sharp(buffer).metadata();
    const width = meta.width!, height = meta.height!, cw = Math.ceil(width * .7), ch = Math.ceil(height * .7);
    const crops = await Promise.all([[0, 0], [width - cw, 0], [0, height - ch], [width - cw, height - ch]].map(async ([left, top]) =>
      dataUrl(await sharp(buffer).extract({ left, top, width: cw, height: ch }).png().toBuffer())));
    const imageURLs = [dataUrl(buffer), ...crops, ...refs.map(r => dataUrl(bytesOf(r))), ...(predecessor ? [dataUrl(bytesOf(predecessor))] : [])];
    const refRoles = ['canonical_child', 'canonical_companion', 'canonical_entities', 'canonical_locations'].slice(0, refs.length);
    const text = JSON.stringify({ candidateSha: candidate.imageSha, contextSha, context,
      imageRoles: ['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right', 'candidate_crop_bottom_left', 'candidate_crop_bottom_right',
        ...refRoles, ...(predecessor ? ['prior_same_scene_comparison_not_authority'] : [])] });
    const instructions = kind === 'sheet' ? AUDITION_SHEET_JUDGE_INSTRUCTION : PREVIEW_JUDGE_INSTRUCTION;
    if (imageURLs.length > 10 || Buffer.byteLength(text + instructions, 'utf8') > 104000) fail('audition_pixel_input_limit');
    const payload = { model: REVIEW_MODEL, store: false, service_tier: 'default' as const, reasoning: { effort: 'medium' as const }, instructions,
      input: [{ role: 'user' as const, content: [{ type: 'input_text' as const, text },
        ...imageURLs.map(image_url => ({ type: 'input_image' as const, image_url, detail: 'high' as const }))] }],
      max_output_tokens: 12000, text: { format: zodTextFormat(previewQualityReviewSchema, 'personal_audition_pixels') } };
    return meter.run(step, digestImages(payload), 600000, async () => {
      check(); const client = new OpenAI({ apiKey: key(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off' });
      const raw = await client.responses.create(payload, { signal: args.signal, timeout: 300000 });
      const estimatedMicroUsd = raw.model === REVIEW_MODEL && raw.service_tier === 'default' ? auditionUsageCost(raw.usage, 'sol') : null;
      const receipt = { raw, estimatedMicroUsd };
      if (raw.status !== 'completed' || raw.model !== REVIEW_MODEL || !raw.output_text || !raw.usage || raw.usage.output_tokens > 12000)
        throw Object.assign(new ReviewedAuditionError('audition_pixel_provider_invalid'), { receipt });
      try { return { value: previewQualityReviewSchema.parse(JSON.parse(raw.output_text)), estimatedMicroUsd, receipt }; }
      catch { throw Object.assign(new ReviewedAuditionError('audition_pixel_schema'), { receipt }); }
    });
  };

  const identity = async (step: string, reference: AuditionImage, candidate: AuditionImage) => {
    check(); let transportError: unknown = null;
    const result = await evaluatePageChildResemblanceVision({ referenceImageUrl: dataUrl(bytesOf(reference)), candidateImageUrl: dataUrl(bytesOf(candidate)),
      threshold: .7, model: 'gpt-4o', apiKey: 'credential-is-injected-only-after-claim', maxRetries: 0, shouldStartAttempt: () => !args.signal.aborted,
      fetchImpl: async (url, init) => {
        check(); const wire = JSON.parse(String(init!.body));
        return meter.run(step, digestImages(wire), 50000, async () => {
          const response = await fetch(url, { ...init, signal: AbortSignal.any([args.signal, init!.signal!]),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key()}` } });
          const raw = await response.clone().json() as { model?: string; usage?: { prompt_tokens: number; completion_tokens: number } };
          const knownModel = ['gpt-4o', 'gpt-4o-2024-08-06', 'gpt-4o-2024-11-20'].includes(raw.model ?? '');
          const estimatedMicroUsd = auditionUsageCost(knownModel && raw.usage ? { input_tokens: raw.usage.prompt_tokens, output_tokens: raw.usage.completion_tokens } : null, 'identity');
          const receipt = { raw, estimatedMicroUsd, status: response.status };
          if (!response.ok || !knownModel || !raw.usage || raw.usage.completion_tokens > 180) throw Object.assign(new ReviewedAuditionError('audition_identity_provider_failed'), { receipt });
          return { value: response, estimatedMicroUsd, receipt };
        }).catch(error => { transportError = error; throw error; });
      } });
    if (transportError) throw transportError;
    return result;
  };

  const manifest = await illustrateReviewedAudition({ book: loaded.book, rawReview: loaded.rawReview, texts: loaded.texts, current: loaded.current,
    child, companion, render, judge, identity, check, save, ...(resume ? { resume } : {}),
    progress: e => args.log(`${e.phase} ${e.name} attempt ${e.attempt}: ${e.disposition} penalty=${e.penalty}${e.identity === undefined ? '' : ` identity=${e.identity ?? 'n/a'}`} · spent≈$${(meter.snapshot().accountedMicroUsd / 1e6).toFixed(3)}`) });
  const html = reviewedAuditionHTML(manifest, { title: loaded.title, pages: loaded.pages }, image => dataUrl(bytesOf(image)));
  exclusiveText(path.join(args.out, 'book.html'), html);
  const spend = meter.snapshot(); save('spend', spend);
  return { manifest, spend };
}

/** Zero-provider admission and prompt preview. */
export function dryRun(bookDir: string) {
  const loaded = loadReviewedBook(bookDir), designs = auditionSheetDesigns(loaded.book, loaded.texts);
  const ids = (d: { entities?: { id: string }[]; props?: { id: string }[]; locations?: { id: string }[] }) =>
    ({ entities: d.entities?.map(e => e.id), props: d.props?.map(e => e.id), locations: d.locations?.map(e => e.id) });
  const page = currentPersonalStoryboardFrame(loaded.book, loaded.rawReview, 1, loaded.current);
  return { requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest, title: loaded.title,
    actorOwnedIds: designs.actorOwnedIds, entitiesSheet: ids(designs.entities as never), locationsSheet: ids(designs.locations as never),
    mutable: designs.entities.referenceState.mutableAttributes.map(a => `${a.entityId}.${a.attribute} = ${a.knownValues.map(v => v.value).join(' | ')}`),
    promptBytes: { entities: Buffer.byteLength(auditionSheetPrompt('entities', designs.entities)), locations: Buffer.byteLength(auditionSheetPrompt('locations', designs.locations)),
      page1: Buffer.byteLength(page.render.prompt) } };
}

function argValue(name: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const bookDir = argValue('--book-dir') ?? fail('audition_args');
  if (!process.argv.includes('--execute')) { console.log(JSON.stringify(dryRun(bookDir!), null, 2)); }
  else {
    const out = argValue('--out') ?? fail('audition_args'), keyFile = argValue('--key-env-file') ?? fail('audition_args');
    const maxUsd = Number(argValue('--max-usd') ?? '6');
    if (!path.isAbsolute(out!) || !path.isAbsolute(keyFile!) || !(maxUsd > 0 && maxUsd <= 8)) fail('audition_args');
    process.env.GPT_IMAGE_EDIT_MAX_REFERENCES ??= '4';
    const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
    const started = Date.now();
    runReviewedAudition({ bookDir: bookDir!, out: out!, keyFile: keyFile!, maxMicroUsd: Math.round(maxUsd * 1e6), signal: controller.signal, ...(process.argv.includes('--resume') ? { resume: true as const } : {}),
      log: line => console.log(`[${((Date.now() - started) / 60000).toFixed(1)}m] ${line}`) })
      .then(({ manifest, spend }) => console.log(JSON.stringify({ status: 'complete', spend, pages: manifest.pages.map(p => ({ page: p.pageNumber, attempts: p.attempts, flags: p.flags, identity: p.identityScore })) }, null, 2)))
      .catch(error => { console.error('FAILED', error?.code ?? error?.message ?? error); process.exitCode = 1; });
  }
}
