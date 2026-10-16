/**
 * Child-likeness probe (standalone diagnostic; never the Wizard, production or the new-book experiment).
 *
 * A REAL child photo -> production's own drawn Style-01 anchor (photo first, technique references, no template: buildStage0MethodBPrompt /
 * buildStage0MethodBReferences, reference mode anchor_photo_style_only) -> ONE picture-book page through the book engine's own page mode
 * (book_identity: anchor, companion, object atlas, location atlas) -> likeness checks with the engine's identity evaluator: photo vs anchor,
 * photo vs page, anchor vs page, and a control (a different, fictional child's reference vs the anchor; a discriminating evaluator says
 * "different"). Every image is gpt-image-2 LOW 1024x1024 through the engine's metered adapter; every check is the existing gpt-4o evaluator.
 *
 * Dry run by default: the plan (prompts, references by name and hash, each call's reservation, cap fit). No key read, nothing written.
 * --execute: one run into a fresh PRIVATE folder outside the protected checkouts (protectedCheckouts), each call once (no retry), under the
 * probe's own hard cap; a failed call or unusable identity evidence stops and seals the run. The folder holds the photo's copy, the drawn
 * likenesses and the render receipts, which contain the generated images' bytes (the original photo is never in a record): private, never
 * copied into a repository or a review folder. The scores are diagnostic; the owner's own comparison (probe.html) is the verdict.
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/personal-likeness-probe.ts --config <absolute json> [--execute]
 */
import { existsSync, lstatSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildStage0MethodBPrompt, buildStage0MethodBReferences } from '../lib/generation-pipeline/stage0-method-b';
import { planGPTImageRequest } from '../lib/generate-image';
import { previewSha } from '../lib/local-story-preview';
import { STYLE_01_SHARED } from '../lib/style01-prompt-core';
import { STYLE_01_AVOIDANCE_NEGATIVE } from '../lib/style01-gptimage';
import { AUDITION_PAGE_SUFFIX } from '../lib/personal-wizard/simple-book-reviewed-audition';
import type { AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import type { PageChildResemblanceVisionResult } from '../lib/generation-pipeline/page-child-resemblance-vision';
import { AuditionMeter, auditionAdapters, keyReader, renderMaximum, IDENTITY_MAXIMUM_MICRO_USD } from './personal-simple-book-reviewed-audition';
import { exclusiveJson, exclusiveText, realDirectory } from './personal-causal-trial-journal';

export const LIKENESS_PROBE_VERSION = 'likeness-probe/v1' as const;
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const absolutePng = z.string().refine(p => path.isAbsolute(p) && /\.png$/i.test(p), 'absolute .png path');
export const likenessProbeConfigSchema = z.object({
  version: z.literal('likeness-probe-config/v1'),
  /** Output folder suffix: likeness-probe-<label>. */
  label: z.string().regex(/^[a-z0-9-]{3,60}$/),
  /** The real child photo (PNG); sent only to the image edit and the identity checks, copied only into the probe's own output folder. */
  photo: absolutePng,
  child: z.object({ age: z.number().int().min(2).max(12), gender: z.enum(['boy', 'girl']) }).strict(),
  /** Optional clothing for the anchor (production's wardrobe lock); absent, the anchor's clothing is the model's. */
  wardrobe: z.string().trim().min(5).max(400).optional(),
  companion: absolutePng,
  /** The page mode's object and location atlases (named inputs; this probe draws no story). */
  atlases: z.object({ entities: absolutePng, locations: absolutePng }).strict(),
  /** A DIFFERENT, fictional child's reference: the evaluator's discrimination control. */
  control: absolutePng,
  scene: z.string().trim().min(40).max(1200),
  outputParent: z.string().refine(p => path.isAbsolute(p), 'absolute directory'),
  keyEnvFile: z.string().refine(p => path.isAbsolute(p), 'absolute file'),
  capMicroUsd: z.number().int().positive().max(1000000),
}).strict();
export type LikenessProbeConfig = z.infer<typeof likenessProbeConfigSchema>;

const STEPS = ['anchor', 'anchor_identity', 'control_identity', 'page', 'page_identity', 'page_anchor_identity'] as const;

/**
 * The checkouts a real child's photo and its likenesses must never enter, derived from THIS script's own location (never the launch
 * directory): the checkout holding it and, when that is a linked worktree, its main checkout (from the .git pointer). An unverifiable
 * location is refused. Scope: other repositories elsewhere on the machine are not detected.
 */
export function protectedCheckouts(scriptDirectory = __dirname): string[] {
  const root = path.resolve(scriptDirectory, '..'), dotGit = path.join(root, '.git');
  if (!existsSync(path.join(root, 'scripts', 'personal-likeness-probe.ts')) || !existsSync(dotGit)) return fail('likeness_probe_source_root');
  realDirectory(root);
  const roots = [root];
  if (lstatSync(dotGit).isFile()) {
    const pointer = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(dotGit, 'utf8'))?.[1];
    const common = pointer ? path.resolve(root, pointer).replace(/[\\/]worktrees[\\/][^\\/]+$/, '') : null;
    if (!common || path.basename(common).toLowerCase() !== '.git' || !existsSync(common)) return fail('likeness_probe_source_root');
    roots.push(path.dirname(common));
  }
  return roots;
}
const within = (child: string, parent: string) => {
  const r = path.relative(path.resolve(parent).toLowerCase(), path.resolve(child).toLowerCase());
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};
/**
 * A destination inside a protected checkout is refused (lexically, case-insensitively; it need not exist yet). The run then also requires
 * the destination to be a physical directory path (realDirectory: no junction or symbolic-link component), so no alias reaches a checkout.
 */
export function assertOutsideCheckouts(outputParent: string) {
  for (const root of protectedCheckouts()) if (within(outputParent, root)) fail('likeness_probe_output_in_repository');
}

/** The validated configuration; the output folder must be outside the protected checkouts (a real child's photo and likeness never enter them). */
export function likenessProbeConfig(file: string): LikenessProbeConfig {
  if (!path.isAbsolute(file)) fail('likeness_probe_config');
  const parsed = likenessProbeConfigSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) return fail('likeness_probe_config');
  const config = parsed.data;
  assertOutsideCheckouts(config.outputParent);
  for (const p of [config.photo, config.companion, config.atlases.entities, config.atlases.locations, config.control]) if (!existsSync(p)) fail('likeness_probe_input_missing');
  return config;
}

/**
 * The probe's own reading of an identity answer (the evaluator and its 0.70 threshold are unchanged):
 * - decision: a valid same / below-threshold / different answer, or a valid visibility result (candidate missing, several children);
 * - not_assessable: a valid answer that the pair cannot be judged (uncertain, subject or reference not assessable). A diagnostic result in
 *   its own right, recorded and never counted as a likeness pass;
 * - unusable: no valid answer (malformed, transport, cancelled, bytes unavailable, credential). The run stops before its next call.
 */
const DECISIONS = new Set(['same_child', 'below_threshold', 'different_child', 'candidate_missing', 'multiple_children']);
const NOT_ASSESSABLE = new Set(['uncertain', 'subject_not_assessable', 'reference_not_assessable']);
export function identityOutcome(r: PageChildResemblanceVisionResult): 'decision' | 'not_assessable' | 'unusable' {
  if ((r.status === 'passed' || r.status === 'failed') && DECISIONS.has(r.reasonCode)) return 'decision';
  if (r.status === 'evidence_unknown' && NOT_ASSESSABLE.has(r.reasonCode) && r.featureAssessments !== null) return 'not_assessable';
  return 'unusable';
}

const pronoun = (gender: 'boy' | 'girl') => gender === 'boy' ? { subject: 'he', possessive: 'his' } : { subject: 'she', possessive: 'her' };
/** Production's anchor identity text needs a locked description: only what the owner states (age, gender); identity comes from the photo. */
export function anchorPrompt(config: Pick<LikenessProbeConfig, 'child' | 'wardrobe'>) {
  return buildStage0MethodBPrompt({ order: { childAge: config.child.age, childGender: config.child.gender },
    lockedChildDescription: `A ${config.child.age}-year-old ${config.child.gender}. Hair, skin tone, eyes and face come only from reference image 1 (the photo).`,
    ...(config.wardrobe ? { wardrobeLock: `WARDROBE LOCK: ${config.wardrobe}` } : {}), childPhotoDescription: null, referenceLayout: 'photo_only_no_template' });
}
/**
 * The anchor request text exactly as production composes it: its prompt, then its negative prompt as the [AVOID] block (generateGPTImage
 * appends it after the reference prefix; the engine's adapter forwards no negative prompt, so it is appended here in the same order).
 * The negative prompt contains "text", so no extra no-text line follows (as in production).
 */
export const anchorRenderText = (config: Pick<LikenessProbeConfig, 'child' | 'wardrobe'>) =>
  `${anchorPrompt(config)}\n\n[AVOID]\n${STYLE_01_AVOIDANCE_NEGATIVE}`;
/** The probe page: the engine's page-mode suffix around a configured scene; nothing from any story. */
export function pagePrompt(config: Pick<LikenessProbeConfig, 'child' | 'scene'>) {
  const p = pronoun(config.child.gender);
  return [STYLE_01_SHARED,
    'LIKENESS PROBE PAGE: one picture-book illustration (not a story page). Only the child and the companion appear.',
    `CHILD: the ${config.child.age}-year-old ${config.child.gender} of image 1; keep exactly ${p.possessive} face, hair, skin tone and proportions, so that ${p.subject} is recognisably the same child.`,
    'COMPANION: the companion of image 2, exactly as designed.',
    `SCENE: ${config.scene}`, AUDITION_PAGE_SUFFIX].join('\n');
}
/** Production's anchor references for this photo: the photo first, then the Style-01 technique references (their files, in order). */
export function anchorReferenceFiles(config: Pick<LikenessProbeConfig, 'photo' | 'child'>) {
  const refs = buildStage0MethodBReferences({ childPhotoUrl: config.photo, childGender: config.child.gender, layout: 'photo_only_no_template' });
  if (refs.referenceMode !== 'anchor_photo_style_only' || refs.paths[0] !== config.photo || refs.labels[0] !== 'raw_child_photo') fail('likeness_probe_anchor_references');
  return refs.paths.map((file, i) => ({ file, label: refs.labels[i] }));
}

/** Provider-free plan: what each call sends (names and hashes only) and reserves, and whether the run fits its cap. No key, no write. */
export function planLikenessProbe(config: LikenessProbeConfig) {
  const sha = (file: string) => previewSha(readFileSync(file));
  const anchorRefs = anchorReferenceFiles(config);
  const anchorPlan = planGPTImageRequest({ finalPrompt: anchorRenderText(config), referenceImages: anchorRefs.map(r => r.file), referenceMode: 'anchor_photo_style_only',
    requireReferenceEdit: true, quality: 'low', size: '1024x1024', modelOverride: 'gpt-image-2' }, { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
  const pageRefFiles = ['(anchor from this run)', config.companion, config.atlases.entities, config.atlases.locations];
  const pagePlan = planGPTImageRequest({ finalPrompt: pagePrompt(config), referenceImages: pageRefFiles, referenceMode: 'book_identity',
    requireReferenceEdit: true, quality: 'low', size: '1024x1024', modelOverride: 'gpt-image-2' }, { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
  if (anchorPlan.referenceCountPassed !== anchorRefs.length || pagePlan.referenceCountPassed !== 4) fail('likeness_probe_reference_truncated');
  const reservations = { anchor: renderMaximum(anchorPlan.finalPrompt, anchorRefs.length), page: renderMaximum(pagePlan.finalPrompt, 4),
    identityEach: IDENTITY_MAXIMUM_MICRO_USD };
  // The meter reserves each call's maximum before it is sent and settles it at its actual cost: a call is admitted only when its reservation
  // fits beside the spend settled so far, otherwise the run stops (sealed failed). The largest reservation must fit at all; the sum of every
  // maximum is reported, not required (actual image and identity costs are a small fraction of their maxima).
  const largestReservation = Math.max(reservations.anchor, reservations.page, reservations.identityEach);
  const worstCaseSequential = reservations.anchor + reservations.page + 4 * reservations.identityEach;
  return { version: LIKENESS_PROBE_VERSION, label: config.label, output: path.join(config.outputParent, `likeness-probe-${config.label}`),
    child: config.child, inputs: { photo: { sha256: sha(config.photo) }, companion: { sha256: sha(config.companion) },
      atlases: { entities: { sha256: sha(config.atlases.entities) }, locations: { sha256: sha(config.atlases.locations) } }, control: { sha256: sha(config.control) } },
    calls: STEPS, anchor: { mode: 'anchor_photo_style_only', references: anchorRefs.map(r => r.label), prompt: anchorPlan.finalPrompt },
    page: { mode: 'book_identity', references: ['anchor', 'companion', 'atlas_entities', 'atlas_locations'], prompt: pagePlan.finalPrompt },
    reservations, capMicroUsd: config.capMicroUsd, largestReservationMicroUsd: largestReservation, worstCaseSequentialMicroUsd: worstCaseSequential,
    fitsCap: largestReservation <= config.capMicroUsd,
    capNote: 'the cap admits the largest single reservation; each later call is admitted only if its reservation fits beside the spend settled so far, so the cap alone does not guarantee completion',
    privateOutput: 'the output folder holds the photo copy, the drawn likenesses and render receipts containing the generated images\' bytes: private, never copied into a repository or review folder',
    providerCalls: 0, keyRead: false };
}

type Adapters = Pick<ReturnType<typeof auditionAdapters>, 'writeImage' | 'bytesOf' | 'render' | 'identity'>;
const checkSummary = (step: string, reference: string, candidate: string, r: PageChildResemblanceVisionResult) => ({ step, reference, candidate,
  outcome: identityOutcome(r), status: r.status, sameChild: r.sameChild, reasonCode: r.reasonCode, resemblanceScore: r.resemblanceScore,
  featureAssessments: r.featureAssessments });
type CheckSummary = ReturnType<typeof checkSummary>;

/**
 * The paid run, once: a fresh private folder outside the protected checkouts (checked here too, before anything is created, copied or
 * called), each call once in order, the run sealed complete or failed (no retry; unusable identity evidence stops before the next call).
 */
export async function runLikenessProbe(args: { config: LikenessProbeConfig; signal: AbortSignal; log: (line: string) => void;
  adapters?: (directory: string, meter: AuditionMeter) => Adapters }) {
  const { config } = args;
  assertOutsideCheckouts(config.outputParent);
  realDirectory(config.outputParent);
  const plan = planLikenessProbe(config);
  if (!plan.fitsCap) fail('likeness_probe_cap');
  const out = plan.output, images = path.join(out, 'illustrations');
  try { mkdirSync(out); } catch { fail('likeness_probe_used'); }
  mkdirSync(images);
  const meter = new AuditionMeter(path.join(out, 'paid-stages'), config.capMicroUsd, STEPS.length);
  const save = (name: string, value: unknown) => exclusiveJson(path.join(out, `${name}.json`), value);
  const seal = (status: 'complete' | 'failed', extra: Record<string, unknown> = {}) => {
    save('spend', meter.snapshot()); save('sealed', { version: LIKENESS_PROBE_VERSION, status, ...extra, runtimeEligible: false });
  };
  // Every recorded comparison, and the one whose evidence was unusable (if any): both go into the failed seal.
  const checks: CheckSummary[] = [], stopped: { check: CheckSummary | null } = { check: null };
  try {
    const io: Adapters = args.adapters ? args.adapters(images, meter)
      : auditionAdapters({ directory: images, meter, key: keyReader(config.keyEnvFile), signal: args.signal });
    const copy = async (name: string, file: string) => io.writeImage(name, readFileSync(file));
    const anchorRefs = anchorReferenceFiles(config);
    const anchorInputs: AuditionImage[] = [];
    for (const [i, ref] of anchorRefs.entries()) anchorInputs.push(await copy(i === 0 ? 'photo.png' : `style_${i}.png`, ref.file));
    const photo = anchorInputs[0], companion = await copy('companion.png', config.companion), control = await copy('control.png', config.control);
    const atlasEntities = await copy('atlas_entities.png', config.atlases.entities), atlasLocations = await copy('atlas_locations.png', config.atlases.locations);
    save('plan', { ...plan, anchor: { ...plan.anchor, prompt: undefined, promptSha256: previewSha(Buffer.from(plan.anchor.prompt)) },
      page: { ...plan.page, prompt: undefined, promptSha256: previewSha(Buffer.from(plan.page.prompt)) } });
    // A comparison is recorded whatever its valid answer (a decision or not assessable); unusable evidence stops the run right here.
    const measure = async (step: string, reference: string, candidate: string, referenceImage: AuditionImage, candidateImage: AuditionImage) => {
      const check = checkSummary(step, reference, candidate, await io.identity(step, referenceImage, candidateImage));
      args.log(`${check.step}: ${check.outcome} ${check.status} ${check.reasonCode} sameChild=${check.sameChild} score=${check.resemblanceScore}`);
      if (check.outcome === 'unusable') { stopped.check = check; fail('likeness_probe_identity_unusable'); }
      checks.push(check);
    };
    const anchor = await io.render('anchor', anchorRenderText(config), anchorInputs, 'anchor_photo_style_only');
    args.log(`anchor: ${anchor.imageName}`);
    await measure('anchor_identity', 'photo', 'anchor', photo, anchor);
    await measure('control_identity', 'control', 'anchor', control, anchor);
    const page = await io.render('page', pagePrompt(config), [anchor, companion, atlasEntities, atlasLocations], 'book_identity');
    args.log(`page: ${page.imageName}`);
    await measure('page_identity', 'photo', 'page', photo, page);
    await measure('page_anchor_identity', 'anchor', 'page', anchor, page);
    const results = { version: LIKENESS_PROBE_VERSION, label: config.label, child: config.child, images: { photo, anchor, page, control },
      checks, verdict: 'owner: compare probe.html; the scores are diagnostic only (the evaluator is not a calibrated confidence)' };
    save('results', results);
    exclusiveText(path.join(out, 'probe.html'), likenessProbeHTML(results, img => `data:image/png;base64,${io.bytesOf(img).toString('base64')}`));
    seal('complete');
    return { status: 'complete' as const, results, spend: meter.snapshot() };
  } catch (error) {
    if (!existsSync(path.join(out, 'sealed.json'))) seal('failed', { code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'likeness_probe_failed',
      ...(stopped.check ? { failedCheck: stopped.check, completedChecks: checks } : {}) });
    throw error;
  }
}

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** A local, self-contained comparison page (never published: it holds a real child's photo and likeness). */
export function likenessProbeHTML(results: { label: string; child: { age: number; gender: string }; images: Record<'photo' | 'anchor' | 'page' | 'control', AuditionImage>;
  checks: CheckSummary[] }, src: (img: AuditionImage) => string) {
  const fig = (img: AuditionImage, caption: string) => `<figure><img src="${src(img)}" alt="${esc(caption)}"><figcaption>${esc(caption)}</figcaption></figure>`;
  const row = (c: CheckSummary) => `<tr><td>${esc(c.reference)} ↔ ${esc(c.candidate)}</td><td>${esc(c.outcome)}</td><td>${esc(c.status)} (${esc(c.reasonCode)})</td><td>${esc(c.sameChild)}</td>` +
    `<td>${esc(c.resemblanceScore)}</td><td>${esc(c.featureAssessments ? Object.entries(c.featureAssessments).map(([k, v]) => `${k}: ${v}`).join(', ') : '—')}</td></tr>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Likeness probe ${esc(results.label)}</title>
<style>body{font:16px/1.5 Arial,sans-serif;margin:0;background:#f5f0e6;color:#263542}main{max-width:1100px;margin:auto;padding:20px}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
figure{margin:0;background:#fff;padding:8px;border-radius:10px}img{width:100%;display:block;border-radius:6px}table{border-collapse:collapse;width:100%;margin-top:16px;background:#fff}
td,th{border:1px solid #ddd;padding:6px;font-size:14px;text-align:left}.note{font-size:14px;color:#555}@media(max-width:700px){.row{grid-template-columns:1fr}}</style>
<main><h1>Likeness probe: ${esc(results.label)}</h1><p class="note">Local diagnostic only, never published: this page holds a real child's photo and drawn likenesses. Child: ${esc(results.child.age)}, ${esc(results.child.gender)}. LOW quality, one attempt each. The owner's comparison is the verdict; the scores below come from the existing evaluator and are not a calibrated confidence.</p>
<div class="row">${fig(results.images.photo, 'Real photo (reference)')}${fig(results.images.anchor, 'Drawn anchor (production Style-01 prompt)')}${fig(results.images.page, 'Probe page (book engine page mode)')}</div>
<table><tr><th>check</th><th>outcome</th><th>status (reason)</th><th>same child</th><th>score</th><th>features</th></tr>${results.checks.map(row).join('')}</table>
<p class="note">Outcome: "decision" is a valid answer (same, different, below threshold, or a visibility result); "not_assessable" is a valid answer that the pair cannot be judged, never a likeness pass.</p>
<p class="note">Control: a different, fictional child's reference compared with this anchor. A discriminating evaluator answers "different".</p>
<div class="row" style="grid-template-columns:1fr 3fr">${fig(results.images.control, 'Control reference (fictional child)')}</div></main></html>`;
}

function argValue(name: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const file = argValue('--config') ?? fail('likeness_probe_arguments');
  const config = likenessProbeConfig(file!);
  if (!process.argv.includes('--execute')) console.log(JSON.stringify(planLikenessProbe(config), null, 2));
  else {
    const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
    runLikenessProbe({ config, signal: controller.signal, log: line => console.log(line) })
      .then(r => console.log(JSON.stringify({ status: r.status, checks: r.results.checks, spend: r.spend }, null, 2)))
      .catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
  }
}
