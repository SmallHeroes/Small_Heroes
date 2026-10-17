/**
 * child-anchor-style/v1 visual diagnostic (standalone; never the Wizard, production, the held book or any existing experiment folder).
 * At most four Sol/image calls, once each, no correction and no retry:
 *   1 control_style_qa           the style review of an EXISTING rejected anchor (negative control, copied by hash). Only a style defect
 *                                continues: a pass means the criterion does not discriminate, unassessable means no signal; both stop.
 *   2 reference_child            ONE new fictional child from its written design (R1: production description prompt minus the template
 *                                sentence, the pinned technique references, `style` mode), gpt-image-2 LOW 1024x1024.
 *   3 reference_child_style_qa   its style review.      4 reference_child_qa   its design + apparent-age review.
 * The judge is a second signal only; Guy's eye on probe.html decides "our style". No acceptance of any child follows from this run.
 * Dry run by default (prompt, references by hash, reservations, cap admission). No key read, nothing written.
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/personal-child-anchor-style-probe.ts --config <absolute json> [--execute]
 */
import { existsSync, lstatSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { previewSha } from '../lib/local-story-preview';
import { simpleReferenceDesignContext, type AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { CHILD_ANCHOR_STYLE_VERSION, CHILD_ANCHOR_MANIFEST_SHA256, CHILD_ANCHOR_TECHNIQUE_MANIFEST, resolveChildAnchorTechnique, childAnchorDescriptionRequest,
  assertChildAnchorRenderPlan, childAnchorRecipeSchema, childAnchorRecipeSha, childAnchorControlBinding, childAnchorStyleDisposition,
  childAnchorDesignDisposition, childAnchorDisposition } from '../lib/personal-wizard/child-anchor-style';
import { AuditionMeter, auditionAdapters, auditionRenderRule, auditionReviewRule, keyReader, renderMaximum, type MeterRule } from './personal-simple-book-reviewed-audition';
import { SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from './personal-simple-book-illustrator';
import { childAnchorJudges, type ChildAnchorDesignJudge, type ChildAnchorStyleJudge } from './personal-child-anchor-judges';
import { assertOutsideCheckouts } from './personal-likeness-probe';
import { exclusiveJson, exclusiveText, realDirectory } from './personal-causal-trial-journal';

export const CHILD_ANCHOR_PROBE_VERSION = 'child-anchor-style-probe/v1' as const;
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const absolutePng = z.string().refine(p => path.isAbsolute(p) && /\.png$/i.test(p), 'absolute .png path');
export const childAnchorProbeConfigSchema = z.object({
  version: z.literal('child-anchor-style-probe-config/v1'),
  label: z.string().regex(/^[a-z0-9-]{3,60}$/),
  /** A NEW fictional child (not a real child, not an existing book's child): its declared design is the only identity authority. */
  child: z.object({ age: z.number().int().min(2).max(12), gender: z.enum(['boy', 'girl']), design: z.string().trim().min(20).max(1500),
    wardrobe: z.string().trim().min(5).max(400) }).strict(),
  /** An existing anchor the owner rejected for style, read-only and copied by hash (the held book is never written). */
  negativeControl: z.object({ file: absolutePng, sha256: hash }).strict(),
  outputParent: z.string().refine(p => path.isAbsolute(p), 'absolute directory'),
  keyEnvFile: z.string().refine(p => path.isAbsolute(p), 'absolute file'),
  capMicroUsd: z.number().int().positive().max(1000000),
}).strict();
export type ChildAnchorProbeConfig = z.infer<typeof childAnchorProbeConfigSchema>;

export const CHILD_ANCHOR_PROBE_STEPS = ['control_style_qa', 'reference_child', 'reference_child_style_qa', 'reference_child_qa'] as const;
const PROBE_RULES: Record<string, MeterRule> = { control_style_qa: auditionReviewRule, reference_child: auditionRenderRule,
  reference_child_style_qa: auditionReviewRule, reference_child_qa: auditionReviewRule };
const probeRules = (step: string) => Object.prototype.hasOwnProperty.call(PROBE_RULES, step) ? PROBE_RULES[step] : undefined;
/** The plan's stated expectation of actual costs (render about $0.05, reviews about $0.04): an assumption for the admission estimate, never a reservation. */
export const ASSUMED_ACTUAL_MICRO_USD = Object.freeze({ review: 40000, render: 50000 });

export function childAnchorProbeConfig(file: string): ChildAnchorProbeConfig {
  if (!path.isAbsolute(file)) fail('child_anchor_probe_config');
  const parsed = childAnchorProbeConfigSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) return fail('child_anchor_probe_config');
  assertOutsideCheckouts(parsed.data.outputParent);
  return parsed.data;
}
/** The reviewed checkout this script belongs to (never the launch directory's own claim): the pinned files are read from here. */
const workspace = () => path.resolve(__dirname, '..');
function controlBytes(config: ChildAnchorProbeConfig) {
  const stat = lstatSync(config.negativeControl.file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20000000) fail('child_anchor_probe_control');
  const bytes = readFileSync(config.negativeControl.file);
  if (previewSha(bytes) !== config.negativeControl.sha256) fail('child_anchor_probe_control');
  return bytes;
}
const designContext = (child: ChildAnchorProbeConfig['child']) =>
  simpleReferenceDesignContext({ age: child.age, address: child.gender, fictionalDesign: child.design, wardrobe: child.wardrobe, role: 'child' });

/** Provider-free plan: the exact anchor request, its references by hash, each call's reservation, and cap admission (worst case and assumed). */
export function planChildAnchorProbe(config: ChildAnchorProbeConfig) {
  controlBytes(config);
  const technique = resolveChildAnchorTechnique(workspace()), request = childAnchorDescriptionRequest(config.child);
  const plan = assertChildAnchorRenderPlan(request.prompt, technique.length, request.referenceMode);
  const reservations = CHILD_ANCHOR_PROBE_STEPS.map(step => ({ step,
    reservationMicroUsd: step === 'reference_child' ? renderMaximum(plan.finalPrompt, technique.length) : SOL_PIXEL_REVIEW_SLOT_MICRO_USD,
    assumedActualMicroUsd: step === 'reference_child' ? ASSUMED_ACTUAL_MICRO_USD.render : ASSUMED_ACTUAL_MICRO_USD.review }));
  // The meter admits a call only when its reservation fits beside every earlier call's settled cost.
  const admission = (settle: (r: typeof reservations[number]) => number) => {
    let settled = 0;
    return reservations.map(r => { const fits = settled + r.reservationMicroUsd <= config.capMicroUsd; settled += settle(r); return { step: r.step, fits }; });
  };
  return { version: CHILD_ANCHOR_PROBE_VERSION, childAnchor: CHILD_ANCHOR_STYLE_VERSION, label: config.label,
    output: path.join(config.outputParent, `child-anchor-probe-${config.label}`), child: config.child,
    negativeControl: { sha256: config.negativeControl.sha256 },
    anchor: { identitySource: request.identitySource, mode: request.referenceMode, prompt: plan.finalPrompt, promptSha256: previewSha(Buffer.from(plan.finalPrompt)),
      references: CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(({ label, file, sha256 }) => ({ label, file, sha256 })), manifestSha256: CHILD_ANCHOR_MANIFEST_SHA256,
      model: plan.model, quality: plan.quality, size: plan.size },
    calls: reservations, capMicroUsd: config.capMicroUsd,
    admissionIfEachSettlesAtItsReservation: admission(r => r.reservationMicroUsd),
    admissionAtAssumedActuals: admission(r => r.assumedActualMicroUsd),
    capNote: 'the cap is not raised and no reservation lowered: a call whose reservation does not fit stops the run (sealed failed, reported honestly)',
    stopRules: ['control style passed: criterion not discriminating, stop before any render', 'control style unassessable: no signal, stop',
      'any failed, invalid, unpriced or cancelled call: stop (no retry, no correction)'],
    providerCalls: 0, keyRead: false };
}

type Adapters = { writeImage: (name: string, bytes: Buffer) => Promise<AuditionImage>; bytesOf: (image: AuditionImage) => Buffer;
  render: (step: string, prompt: string, refs: AuditionImage[], mode: 'style') => Promise<AuditionImage>; style: ChildAnchorStyleJudge; design: ChildAnchorDesignJudge };

/** The paid run, once, into a fresh folder outside the protected checkouts; sealed complete, stopped or failed. */
export async function runChildAnchorProbe(args: { config: ChildAnchorProbeConfig; signal: AbortSignal; log: (line: string) => void;
  adapters?: (directory: string, meter: AuditionMeter) => Adapters }) {
  const { config } = args;
  assertOutsideCheckouts(config.outputParent); realDirectory(config.outputParent);
  const plan = planChildAnchorProbe(config), out = plan.output, images = path.join(out, 'illustrations');
  try { mkdirSync(out); } catch { fail('child_anchor_probe_used'); }
  mkdirSync(images);
  const meter = new AuditionMeter(path.join(out, 'paid-stages'), config.capMicroUsd, CHILD_ANCHOR_PROBE_STEPS.length, 0, 0, probeRules);
  const save = (name: string, value: unknown) => exclusiveJson(path.join(out, `${name}.json`), value);
  const seal = (status: string, extra: Record<string, unknown> = {}) => {
    save('spend', meter.snapshot()); save('sealed', { version: CHILD_ANCHOR_PROBE_VERSION, status, ...extra, runtimeEligible: false });
  };
  try {
    const io: Adapters = args.adapters ? args.adapters(images, meter) : (() => {
      const base = auditionAdapters({ directory: images, meter, key: keyReader(config.keyEnvFile), signal: args.signal });
      return { ...base, ...childAnchorJudges({ bytesOf: base.bytesOf, meter, key: keyReader(config.keyEnvFile), signal: args.signal, guard: () => {} }) };
    })();
    save('plan', { ...plan, anchor: { ...plan.anchor, prompt: undefined } });
    // 1. The negative control.
    const control = await io.writeImage('negative_control.png', controlBytes(config)), bound = childAnchorControlBinding(control.imageSha);
    const controlStyle = childAnchorStyleDisposition(await io.style('control_style_qa', control, bound.contextSha, bound.recipeSha), control.imageSha, bound.contextSha, bound.recipeSha);
    save('control_style_review', { binding: bound, ...controlStyle }); args.log(`negative control style: ${controlStyle.disposition}`);
    if (controlStyle.disposition !== 'defect') {
      const status = controlStyle.disposition === 'passed' ? 'stopped_criterion_not_discriminating' : 'stopped_control_not_assessable';
      seal(status); return { status, spend: meter.snapshot() };
    }
    // 2-4. One new fictional child under R1, its style review and its design + age review (both requested whatever the style answer).
    const technique = resolveChildAnchorTechnique(workspace()), request = childAnchorDescriptionRequest(config.child);
    const refs: AuditionImage[] = [];
    for (const [i, t] of technique.entries()) refs.push(await io.writeImage(`style_ref_${i + 1}.png`, t.bytes));
    if (refs.some((r, i) => r.imageSha !== technique[i].sha256)) fail('child_anchor_reference_changed');
    assertChildAnchorRenderPlan(request.prompt, refs.length, 'style');
    const candidate = await io.render('reference_child', request.prompt, refs, 'style');
    const recipe = childAnchorRecipeSchema.parse({ version: CHILD_ANCHOR_STYLE_VERSION, identitySource: 'description', manifestSha256: CHILD_ANCHOR_MANIFEST_SHA256,
      step: 'reference_child', referenceMode: 'style', references: technique.map(t => ({ role: t.label, sha256: t.sha256 })),
      promptSha256: previewSha(Buffer.from(request.prompt)), requestedAge: config.child.age });
    const recipeSha = childAnchorRecipeSha(recipe), context = designContext(config.child), contextSha = previewSha(JSON.stringify(context));
    const style = childAnchorStyleDisposition(await io.style('reference_child_style_qa', candidate, contextSha, recipeSha), candidate.imageSha, contextSha, recipeSha);
    save('reference_child_style_review', { recipe, recipeSha, ...style }); args.log(`anchor style: ${style.disposition}`);
    const design = childAnchorDesignDisposition(await io.design('reference_child_qa', candidate, context, contextSha, recipe), candidate.imageSha, contextSha, recipe);
    save('reference_child_design_review', { recipe, recipeSha, design: design.design, apparentAge: design.apparentAge, review: design.full });
    args.log(`anchor design: ${design.design}, apparent age: ${design.apparentAge.verdict}`);
    const outcome = childAnchorDisposition(style, design);
    const results = { version: CHILD_ANCHOR_PROBE_VERSION, label: config.label, child: config.child, control: { image: control, style: controlStyle },
      anchor: { image: candidate, recipe, recipeSha, style, design: { disposition: design.design, apparentAge: design.apparentAge, review: design.review } },
      judgeOutcome: outcome.disposition, verdict: 'owner: compare probe.html; the judge is a second signal, never acceptance; no correction in this diagnostic' };
    save('results', results);
    exclusiveText(path.join(out, 'probe.html'), childAnchorProbeHTML(results, img => `data:image/png;base64,${io.bytesOf(img).toString('base64')}`));
    seal('complete', { judgeOutcome: outcome.disposition });
    return { status: 'complete' as const, judgeOutcome: outcome.disposition, spend: meter.snapshot() };
  } catch (error) {
    if (!existsSync(path.join(out, 'sealed.json'))) seal('failed', { code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'child_anchor_probe_failed' });
    throw error;
  }
}

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function childAnchorProbeHTML(r: { label: string; child: ChildAnchorProbeConfig['child']; control: { image: AuditionImage; style: { disposition: string; review: { notes: string } } };
  anchor: { image: AuditionImage; style: { disposition: string; review: { notes: string } }; design: { disposition: string; apparentAge: { verdict: string; observation: string } } };
  judgeOutcome: string }, src: (img: AuditionImage) => string) {
  const fig = (img: AuditionImage, caption: string) => `<figure><img src="${src(img)}" alt="${esc(caption)}"><figcaption>${esc(caption)}</figcaption></figure>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Child anchor style ${esc(r.label)}</title>
<style>body{font:16px/1.5 Arial,sans-serif;margin:0;background:#f5f0e6;color:#263542}main{max-width:1000px;margin:auto;padding:20px}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
figure{margin:0;background:#fff;padding:8px;border-radius:10px}img{width:100%;display:block;border-radius:6px}.note{font-size:14px;color:#555}@media(max-width:700px){.row{grid-template-columns:1fr}}</style>
<main><h1>Child anchor style (R1): ${esc(r.label)}</h1><p class="note">Local diagnostic of ${esc(CHILD_ANCHOR_STYLE_VERSION)}: one new fictional child, LOW quality, one attempt, no correction. Your eye decides whether this is our style; the judge below is a second signal only.</p>
<div class="row">${fig(r.control.image, `Rejected anchor (negative control): style ${r.control.style.disposition}`)}${fig(r.anchor.image, `New R1 anchor: style ${r.anchor.style.disposition}`)}</div>
<p>Child: ${esc(r.child.age)}, ${esc(r.child.gender)}. ${esc(r.child.design)}</p>
<p>Judge: style ${esc(r.anchor.style.disposition)} (${esc(r.anchor.style.review.notes)}); design ${esc(r.anchor.design.disposition)}; apparent age ${esc(r.anchor.design.apparentAge.verdict)} (${esc(r.anchor.design.apparentAge.observation)}); combined ${esc(r.judgeOutcome)}.</p>
<p class="note">Control: ${esc(r.control.style.review.notes)}</p></main></html>`;
}

function argValue(name: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const config = childAnchorProbeConfig(argValue('--config') ?? fail('child_anchor_probe_arguments'));
  if (!process.argv.includes('--execute')) console.log(JSON.stringify(planChildAnchorProbe(config), null, 2));
  else {
    const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
    runChildAnchorProbe({ config, signal: controller.signal, log: line => console.log(line) })
      .then(r => console.log(JSON.stringify(r, null, 2)))
      .catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
  }
}
