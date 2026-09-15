import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { parse as parseEnv } from 'dotenv';
import { bindPreviewRun, previewCheckpoint, previewImageDigest, previewPagePrompt, previewSha, previewStory, validatePreviewPlan, writePreviewJson } from '../lib/local-story-preview';
import { PREVIEW_QUALITY_VERSION, PREVIEW_JUDGE_MODEL, PREVIEW_JUDGE_EFFORT, qualityDisposition, validatePreviewContinuity } from '../lib/local-preview-quality';
import { STYLE_01_FRAMING_RULE } from '../lib/style01-gptimage';

// Separate, explicit editorial artifact authority. Never an order/release/package path.
export const DRAFT_VERSION = 'owner-book-draft/v1';
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const asset = z.object({ file: z.string().min(1), sha }).strict();
export const ownerDraftSchema = z.object({
  intent: z.literal('owner_requested_unaccepted_draft'),
  story: asset, plan: asset, childAnchor: asset, companionAnchor: asset,
  propBoard: asset.optional(),
  childName: z.string().min(1).max(50), childAge: z.number().int().min(3).max(8), gender: z.enum(['boy', 'girl']),
  companionDescription: z.string().min(1).max(1500), outputDir: z.string().min(1),
  imageBudgetUsd: z.number().positive().max(10), qaBudgetUsd: z.number().positive().max(10),
}).strict();

export function draftOutputRoot(repo: string, outputDir: string) {
  const outputs = path.resolve(repo, 'outputs');
  if (fs.realpathSync(outputs) !== outputs) throw Error('draft_outputs_alias');
  const root = path.resolve(repo, outputDir);
  // One new child root only; no ancestor traversal or aliased parent.
  if (path.dirname(root) !== outputs || !/^[a-z0-9][a-z0-9-]{2,100}$/.test(path.basename(root))) throw Error('draft_output_scope');
  if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink()) throw Error('draft_output_link');
  return root;
}

export function loadOwnerDraft(repo: string, raw: unknown) {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw Error('local_draft_only');
  const config = ownerDraftSchema.parse(raw);
  const read = (a: { file: string; sha: string }) => {
    const file = path.resolve(repo, a.file);
    const relative = path.relative(repo, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || fs.realpathSync(file) !== file) throw Error('draft_input_scope');
    const bytes = fs.readFileSync(file);
    if (previewSha(bytes) !== a.sha) throw Error('draft_input_changed');
    return { file, bytes, sha: a.sha };
  };
  const source = read(config.story), planSource = read(config.plan);
  const story = previewStory(source.bytes.toString('utf8'), config.childName, config.gender);
  const plan = validatePreviewPlan(JSON.parse(planSource.bytes.toString('utf8')), story.pages.length);
  plan.continuity = validatePreviewContinuity(plan.continuity, plan, [story.title, ...story.pages.map(p => p.text)]);
  if ((plan.pages.length + (plan.recurringProps.length ? 1 : 0)) * 0.5 > config.imageBudgetUsd) throw Error('draft_initial_reservation_limit');
  const refs = [read(config.childAnchor), read(config.companionAnchor)];
  const root = draftOutputRoot(repo, config.outputDir);
  const propBoard = config.propBoard ? read(config.propBoard) : undefined;
  return { config, story, plan, refs, root, propBoard };
}

export function draftManifest(story: ReturnType<typeof previewStory>, planSha: string, pages: unknown[]) {
  return { version: DRAFT_VERSION, title: story.title, sourceSha: story.sourceSha, planSha,
    authority: 'owner_requested_unaccepted_draft', status: 'complete_editorial_images_not_release_qualified',
    productionReady: false, productAcceptance: 'pending', calibrationStatus: 'not_established',
    automaticRepair: 'disabled_uncalibrated', pages };
}

export function ownerDraftPagePrompt(plan: ReturnType<typeof validatePreviewPlan>, pageNumber: number, text: string, age: number, gender: string, companion: string) {
  const page = plan.pages[pageNumber], framing = plan.continuity!.pages[pageNumber];
  const percent = Math.round(framing.childHeightFraction * 100);
  const exact = `DRAFT CAMERA AUTHORITY: ${page.shot}. Child FULL standing figure target ${percent}% of TOTAL IMAGE HEIGHT, approximately ${Math.round(1536 * framing.childHeightFraction)} pixels in this 1536-pixel-tall picture. Environment target ${Math.round(framing.environmentAreaFraction * 100)}% of image area. This page-specific target replaces any generic 35-50% range. Keep the child recognizable without enlarging the figure.`;
  return previewPagePrompt(plan, pageNumber, text, age, gender, companion).replace(STYLE_01_FRAMING_RULE, exact) + '\n\n' + exact +
    (page.shot === 'wide' ? '\nWIDE STAGING: Place all main characters in the middle distance, never looming foreground. Roughly head at 48% and feet at 81% of canvas height for a standing child; foreground ground and distant sky/village remain visible. Step camera BACK, do not fill available space with bodies. Single scenic picture, no borders.' : '');
}

function save(file: string, value: unknown) {
  if (!fs.existsSync(file)) writePreviewJson(file, value);
  else if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== JSON.stringify(value)) throw Error('draft_evidence_changed');
}

export async function runOwnerBookDraft(configFile: string, mode: 'preflight' | 'render' | 'qa', keyFile?: string, throughPage?: number) {
  const repo = path.resolve(__dirname, '..');
  const { config, story, plan, refs, root, propBoard } = loadOwnerDraft(repo, JSON.parse(fs.readFileSync(configFile, 'utf8')));
  if (throughPage !== undefined && (!Number.isInteger(throughPage) || throughPage < 0 || throughPage >= plan.pages.length)) throw Error('draft_page_limit');
  const normalized = await Promise.all(refs.map(async ref => ({ ...ref,
    bytes: await sharp(ref.bytes).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).png().toBuffer() })));
  const identity = { version: DRAFT_VERSION, config, refs: normalized.map(r => ({ file: r.file, sourceSha: r.sha, transportSha: previewSha(r.bytes) })),
    imageModel: 'gpt-image-2', quality: 'low', size: '1024x1536', qualityVersion: PREVIEW_QUALITY_VERSION,
    judgeModel: PREVIEW_JUDGE_MODEL, judgeEffort: PREVIEW_JUDGE_EFFORT, productionReady: false, automaticRepair: false };
  if (mode === 'preflight') { console.log(JSON.stringify({ status: 'offline_preflight_ok', pages: plan.pages.length, sourceSha: story.sourceSha, planSha: config.plan.sha, providerCalls: 0 })); return; }
  bindPreviewRun(root, identity);
  const lock = path.join(root, 'run.lock'), fd = fs.openSync(lock, 'wx');
  const oldKey = process.env.OPENAI_API_KEY, nativeFetch = globalThis.fetch;
  let endpoint: string | null = null, dispatched = false;
  const permit = (value: string) => { endpoint = value; dispatched = false; };
  try {
    const key = oldKey?.trim() || (keyFile ? parseEnv(fs.readFileSync(keyFile)).OPENAI_API_KEY?.trim() : undefined);
    if (!key) throw Error('existing_key_missing');
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.origin !== 'https://api.openai.com' || url.pathname !== endpoint || dispatched) throw Error('draft_dispatch_fence');
      dispatched = true;
      return nativeFetch(input, init);
    };
    process.env.OPENAI_API_KEY = key;
    const refPaths = normalized.map((ref, i) => {
      const file = path.join(root, `reference-${i + 1}.png`);
      if (!fs.existsSync(file)) fs.writeFileSync(file, ref.bytes, { flag: 'wx' });
      if (previewImageDigest(file) !== previewSha(ref.bytes)) throw Error('draft_reference_changed');
      return file;
    });
    const makeImage = async (step: string, prompt: string, references: string[], fileName: string) => {
      if (prompt.length > 24000 || references.length > 3) throw Error('draft_image_input_limit');
      const result = await previewCheckpoint({ root, step, input: { version: DRAFT_VERSION, model: 'gpt-image-2', quality: 'low', size: '1024x1536', prompt, refs: references.map(previewImageDigest) },
        reserveUsd: 0.5, budgetUsd: config.imageBudgetUsd, produce: async () => {
          const { generateGPTImage } = await import('../lib/generate-image');
          permit(references.length ? '/v1/images/edits' : '/v1/images/generations');
          const image = await generateGPTImage({ finalPrompt: prompt, referenceImages: references, referenceMode: 'explicit_role_map',
            requireReferenceEdit: references.length > 0, modelOverride: 'gpt-image-2', quality: 'low', size: '1024x1536', requestTimeoutMs: 600_000 });
          // Persist known provider output before checking transport assertions.
          fs.writeFileSync(path.join(root, fileName), image.buffer, { flag: 'wx' });
          return { value: { fileName, sha: previewSha(image.buffer), promptSha: previewSha(image.finalPrompt), durationMs: image.durationMs,
            model: image.model, fallbackUsed: Boolean(image.fallbackUsed), referencesPassed: image.referenceCountPassed }, usage: image.usage };
        } });
      const value = result.value;
      if (value.model !== 'gpt-image-2' || value.fallbackUsed || value.referencesPassed !== references.length || value.fileName !== fileName ||
        previewImageDigest(path.join(root, fileName)) !== value.sha) throw Error('draft_image_binding');
      console.log(JSON.stringify({ stage: step, imageSha: value.sha }));
      return value;
    };
    if (plan.recurringProps.length) {
      const boardName = 'prop-board.png';
      if (propBoard) {
        const file = path.join(root, boardName);
        if (!fs.existsSync(file)) fs.writeFileSync(file, propBoard.bytes, { flag: 'wx' });
        if (previewImageDigest(file) !== propBoard.sha) throw Error('draft_supplied_board_changed');
      } else if (mode === 'render') await makeImage('prop-board', [
        'Watercolor picture-book object design sheet on pale paper. No people or animals, no words, labels or panels. One separated full view per object, no overlaps. Living path shown as a simple short ochre carpet-like earthen strip with thin grass edges, NO blue flower yet. Props only, no scene.',
        plan.visualLanguage, ...plan.recurringProps.map(p => `${p.id}: ${p.design}`),
      ].join('\n'), [], boardName);
      const bytes = await sharp(path.join(root, boardName)).resize({ width: 1024, height: 1024, fit: 'inside' }).png().toBuffer();
      const boardRef = path.join(root, 'prop-board-reference.png');
      if (!fs.existsSync(boardRef)) fs.writeFileSync(boardRef, bytes, { flag: 'wx' });
      if (previewImageDigest(boardRef) !== previewSha(bytes)) throw Error('draft_board_changed');
      refPaths.push(boardRef);
    }
    if (mode === 'render') {
      const pages = [];
      for (const page of plan.pages) {
        if (throughPage !== undefined && page.pageNumber > throughPage) break;
        const text = page.pageNumber === 0 ? story.title : story.pages[page.pageNumber - 1].text;
        const imageName = `page-${String(page.pageNumber).padStart(2, '0')}.png`;
        const prompt = ownerDraftPagePrompt(plan, page.pageNumber, text, config.childAge, config.gender, config.companionDescription);
        const made = await makeImage(`page-${String(page.pageNumber).padStart(2, '0')}`, prompt, refPaths, imageName);
        pages.push({ pageNumber: page.pageNumber, text, imageName, imageSha: made.sha, automatedPassed: false, score: null,
          reason: 'editorial_draft_visual_and_numerical_qa_not_accepted' });
      }
      if (pages.length === plan.pages.length) save(path.join(root, 'manifest.json'), draftManifest(story, config.plan.sha, pages));
      console.log(JSON.stringify({ status: pages.length === plan.pages.length ? 'draft_images_complete' : 'draft_sample_complete', pages: pages.length }));
    } else {
      // Exact manifest and candidate binding before any QA dispatch; no model repairs.
      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
      if (manifest.sourceSha !== story.sourceSha || manifest.planSha !== config.plan.sha || manifest.productionReady !== false || manifest.pages.length !== plan.pages.length) throw Error('draft_manifest_binding');
      manifest.pages.forEach((p: { pageNumber: number; imageName: string; imageSha: string; text: string }, i: number) => {
        if (p.pageNumber !== i || p.imageName !== `page-${String(i).padStart(2, '0')}.png` || p.text !== (i === 0 ? story.title : story.pages[i - 1].text) ||
          previewImageDigest(path.join(root, p.imageName)) !== p.imageSha) throw Error('draft_manifest_page_binding');
      });
      const qaRoot = path.join(root, 'qa');
      bindPreviewRun(qaRoot, { ...identity, manifestSha: previewSha(JSON.stringify(manifest)) });
      const { judgePreviewCandidate } = await import('./lib/local-preview-judge');
      const results: { pageNumber: number; disposition: string; review?: unknown; error?: string }[] = [];
      let failures = 0;
      for (const page of manifest.pages) {
        const prior = results.filter(r => r.pageNumber > 0 && r.disposition === 'passed').slice(-3).map(r => manifest.pages[r.pageNumber]);
        const context = { plan, pageNumber: page.pageNumber, text: page.text, priorPages: prior, calibrationStatus: 'not_established', purpose: 'diagnostic_only' };
        const contextSha = previewSha(JSON.stringify({ version: PREVIEW_QUALITY_VERSION, context }));
        try {
          const review = await judgePreviewCandidate({ root: qaRoot, step: `qa-${String(page.pageNumber).padStart(2, '0')}`, budgetUsd: config.qaBudgetUsd,
            apiKey: key, candidatePath: path.join(root, page.imageName), candidateSha: page.imageSha, context, contextSha,
            references: [...refPaths.map((file, i) => ({ file, sha: previewImageDigest(file), role: ['child identity', 'companion identity', 'prop design'][i] })),
              ...prior.map((p: { pageNumber: number; imageName: string; imageSha: string }) => ({ file: path.join(root, p.imageName), sha: p.imageSha, role: `previous diagnostically passed page ${p.pageNumber}; comparison only, not a new canonical design` }))],
            permit: () => permit('/v1/responses') });
          const disposition = qualityDisposition(review, page.imageSha, contextSha).disposition;
          const result = { pageNumber: page.pageNumber, disposition, review };
          save(path.join(qaRoot, `page-${String(page.pageNumber).padStart(2, '0')}.json`), result);
          results.push(result); failures = 0;
          console.log(JSON.stringify({ stage: 'diagnostic_qa', page: page.pageNumber, disposition }));
        } catch (error) {
          const message = error instanceof Error && /^[a-z][a-z0-9_]{1,100}$/.test(error.message) ? error.message : 'diagnostic_qa_unresolved';
          results.push({ pageNumber: page.pageNumber, disposition: 'held', error: message }); failures++;
          console.log(JSON.stringify({ stage: 'diagnostic_qa_held', page: page.pageNumber, error: message }));
          // Any unknown paid outcome or budget fence halts; otherwise at most three independent failures.
          const steps = path.join(qaRoot, 'steps');
          const unknown = fs.existsSync(steps) && fs.readdirSync(steps).some(n => n.endsWith('.claim.json') && !fs.existsSync(path.join(steps, n.replace('.claim.json', '.result.json'))));
          if (unknown || message === 'preview_budget_exhausted' || message === 'preview_usage_exceeded_reservation' || failures >= 3) break;
        }
      }
      save(path.join(qaRoot, 'report.json'), { version: DRAFT_VERSION, productionReady: false, calibrated: false, results, unassessed: manifest.pages.length - results.length });
    }
  } finally {
    globalThis.fetch = nativeFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    fs.closeSync(fd); fs.unlinkSync(lock);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2), configFile = args[0];
  const mode = args.includes('--render') ? 'render' : args.includes('--qa') ? 'qa' : 'preflight';
  const key = args.indexOf('--key-env-file'), through = args.indexOf('--through-page');
  runOwnerBookDraft(configFile, mode, key >= 0 ? args[key + 1] : undefined, through >= 0 ? Number(args[through + 1]) : undefined).catch(error => {
    const message = error instanceof Error ? error.message : '';
    console.error(/^[a-z][a-z0-9_]{1,100}$/.test(message) ? message : 'owner_draft_failed_see_checkpoints'); process.exitCode = 1;
  });
}
