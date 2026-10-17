/**
 * Scale-reference probe (Decision Gate 2026-10-17 v2, M1). A standalone diagnostic: never the Wizard, production, the held book or the
 * new-book experiment. Question: does a CORRECT, code-drawn size band under the legacy entities atlas change how large the renderer draws a
 * giant (declared three child heights) and keep the small characters small?
 *
 * A/B per control, ONE draw per arm: a diagnostic signal, not causal proof or engine calibration; no pair is ever re-drawn or selected.
 *   baseline: image 3 = the atlas above a BLANK band area.   band (M1): the same atlas above the marks (lib/personal-wizard/scale-band).
 *   Identical otherwise: the four references and their order, the canvas size and every atlas pixel, the prompt bytes, the models, and the
 *   judge request apart from the candidate (the judge's image 3 is the plain atlas in both arms, its text gives the declared ratios).
 * S1 = C1 (positive; a two-sided acceptance range, Guy 2026-10-17). S2 = C2 (perspective, report only), C3 (crop), C4 (small characters),
 * possible only after S1's candidate-positive gate AND the owner's recorded go (s2-owner-go.json, binding S1's seal): never on a judge pass.
 *
 * Dry run by default: inputs pinned by hash and read only, the band and both canvases composed IN MEMORY (nothing written), prompts, judge
 * contexts, each call's exact reservation and sequential projections. No key read, no provider call.
 * --execute --stage S1|S2: each stage once, into one private folder outside the protected checkouts, on ONE ledger of at most $2.00 and
 * 16 calls (S1 4, S2 12; no identity calls); every call is reserved before it is sent, an unknown cost or outcome stops, nothing is retried.
 * S1 needs the owner's spend grant beside the folder (scale-probe-<label>.grant.json), binding this configuration's exact bytes.
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/personal-scale-probe.ts --config <absolute json> [--execute --stage S1|S2]
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { planGPTImageRequest } from '../lib/generate-image';
import { previewSha } from '../lib/local-story-preview';
import { previewQualityContextSha } from '../lib/local-preview-quality';
import { STYLE_01_SHARED } from '../lib/style01-prompt-core';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { AUDITION_PAGE_SUFFIX, AUDITION_JUDGE_INSTRUCTIONS, auditionPageReviewSchema, assessAuditionReview } from '../lib/personal-wizard/simple-book-reviewed-audition';
import type { AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { scaleBand, scaleBandGeometry, scaleBandInputSchema, composeEntitiesCanvas, SCALE_BAND, SCALE_BAND_POST, ENTITIES_CANVAS } from '../lib/personal-wizard/scale-band';
import { AuditionMeter, auditionAdapters, auditionJudgePayload, auditionRenderRule, auditionReviewRule, digestImages, keyReader, renderMaximum,
  verifyMeterRecords, type MeterRules } from './personal-simple-book-reviewed-audition';
import { SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from './personal-simple-book-illustrator';
import { assertOutsideCheckouts } from './personal-likeness-probe';
import { exclusiveJson, exclusiveText, fencedText, realDirectory } from './personal-causal-trial-journal';

export const SCALE_PROBE_VERSION = 'scale-probe/v1' as const;
export class ScaleProbeError extends Error { constructor(readonly code: string, readonly detail?: string) { super(code); } }
const fail = (code: string, detail?: string): never => { throw new ScaleProbeError(code, detail); };
/** A failure's code: its own `code`, or a shared check's code-shaped message (e.g. quality_evidence_binding); anything else is generic. */
const errorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code
  : error instanceof Error && /^[a-z][a-z0-9_]{0,80}$/.test(error.message) ? error.message : 'scale_probe_failed';

/** One ledger: $2.00 at most, S1 four calls (two renders, two reviews), S2 twelve more; sixteen in all. */
export const SCALE_PROBE_LIMITS = Object.freeze({ capMicroUsd: 2000000, s1Calls: 4, totalCalls: 16 });
export const SCALE_PROBE_CONTROLS = [{ id: 'c1', kind: 'positive', stage: 'S1' }, { id: 'c2', kind: 'perspective', stage: 'S2' },
  { id: 'c3', kind: 'crop', stage: 'S2' }, { id: 'c4', kind: 'small', stage: 'S2' }] as const;
export const SCALE_PROBE_ARMS = ['baseline', 'band'] as const;
export type ControlId = typeof SCALE_PROBE_CONTROLS[number]['id'];
export type Arm = typeof SCALE_PROBE_ARMS[number];
export type Stage = 'S1' | 'S2';
/** A stage's calls in order: per control, per arm, its render and then its review (`_qa`). */
export const stageSteps = (stage: Stage) => SCALE_PROBE_CONTROLS.filter(c => c.stage === stage)
  .flatMap(c => SCALE_PROBE_ARMS.flatMap(arm => [`${c.id}_${arm}`, `${c.id}_${arm}_qa`]));
/** The probe's own paid steps and their adapters' rules: a render or a review of one control's arm. Anything else (identity included) has none. */
export const scaleProbeMeterRules: MeterRules = step => {
  const m = /^c[1-4]_(?:baseline|band)(_qa)?$/.exec(step);
  return !m ? undefined : m[1] ? auditionReviewRule : auditionRenderRule;
};

// ---------------------------------------------------------------------------------------------------------------
// Configuration: declared test inputs (explicit numbers), never a canonical size contract.
// ---------------------------------------------------------------------------------------------------------------
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const absolutePng = z.string().refine(p => path.isAbsolute(p) && /\.png$/i.test(p), 'absolute .png path');
const absolute = z.string().refine(p => path.isAbsolute(p), 'absolute path');
const text = (max: number) => z.string().trim().min(1).max(max);
const castId = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const fraction = z.number().finite().min(0).max(1);
const range = z.object({ min: z.number().finite().positive(), max: z.number().finite().positive() }).strict().refine(r => r.min < r.max, 'min < max');
const pinned = z.object({ file: absolutePng, sha256: sha }).strict();
const referenceState = z.object({ status: z.enum(['approved_reference', 'diagnostic_candidate']), knownFlaws: z.array(text(600)).max(8) }).strict()
  .refine(s => (s.status === 'approved_reference') === (s.knownFlaws.length === 0), 'an approved reference lists no flaw; a diagnostic one lists them');
const sceneSchema = z.object({ scene: text(900), camera: text(300) }).strict();
export const scaleProbeConfigSchema = z.object({
  version: z.literal('scale-probe-config/v1'),
  /** Output folder suffix: scale-probe-<label>. */
  label: z.string().regex(/^[a-z0-9-]{3,60}$/),
  /** Fictional inputs copied from the held run, each pinned by hash (the held run is only read, never written). */
  inputs: z.object({ child: pinned, companion: pinned, entitiesAtlas: pinned, locations: pinned }).strict(),
  /** Each atlas' review status as the held run recorded it; a diagnostic sheet keeps its notice in both arms and is never promoted. */
  referenceStatus: z.object({ entities: referenceState, locations: referenceState }).strict(),
  child: z.object({ name: text(40), description: text(200), clothing: text(400) }).strict(),
  companion: z.object({ name: text(40) }).strict(),
  /** The measured cast, each with its written design (its size prose included), as the held run's design data states it. */
  cast: z.array(z.object({ id: castId, design: text(600) }).strict()).min(1).max(6),
  /** The band's declared ratios in child heights: the post first at exactly 1. */
  band: scaleBandInputSchema,
  controls: z.object({ c1: sceneSchema, c2: sceneSchema, c3: sceneSchema, c4: sceneSchema }).strict(),
  /** Observable criteria (fractions of the picture's height; ratios of visible heights to the child's). */
  criteria: z.object({
    c1: z.object({ subject: castId, accept: range, sameDepthMax: fraction }).strict(),
    c2: z.object({ subject: castId, behindMin: fraction, consistent: range }).strict(),
    c3: z.object({ subject: castId, visibleAbove: z.number().finite().positive(), sameDepthMax: fraction, croppedTopMax: fraction }).strict(),
    c4: z.object({ subjects: z.array(z.object({ id: castId, accept: range }).strict()).min(1).max(3), sameDepthMax: fraction }).strict(),
  }).strict(),
  /** Per-call cost assumptions for the projections only (labelled; reservations never depend on them). */
  costAssumption: z.object({ renderMicroUsd: z.number().int().positive(), reviewMicroUsd: z.number().int().positive(), source: text(300) }).strict(),
  /** Folders the probe only reads (the held book): every input lies inside one, and the output folder and grant lie outside all of them. */
  readOnly: z.array(absolute).min(1).max(4),
  outputParent: absolute,
  keyEnvFile: absolute,
  capMicroUsd: z.literal(SCALE_PROBE_LIMITS.capMicroUsd),
}).strict().superRefine((c, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  const cast = c.cast.map(m => m.id), marks = new Map(c.band.marks.map(m => [m.id, m.ratio]));
  try { scaleBandGeometry(c.band); } catch { issue('the band geometry refuses'); }
  if (new Set(cast).size !== cast.length || cast.some(id => id === 'child' || id === 'companion' || id === SCALE_BAND_POST)) issue('cast ids');
  if ([...marks.keys()].some(id => id !== SCALE_BAND_POST && id !== 'companion' && !cast.includes(id))) issue('a band mark names the post, the companion or a cast member');
  const inside = (r: { min: number; max: number }, v: number | undefined) => v !== undefined && r.min <= v && v <= r.max;
  const k = c.criteria, measured = [k.c1.subject, k.c2.subject, k.c3.subject, ...k.c4.subjects.map(s => s.id)];
  if (measured.some(id => !cast.includes(id) || !marks.has(id))) issue('every measured subject is a cast member with a band mark');
  if (new Set(k.c4.subjects.map(s => s.id)).size !== k.c4.subjects.length) issue('c4 subjects are unique');
  if (!inside(k.c1.accept, marks.get(k.c1.subject))) issue('the c1 acceptance range contains the declared ratio');
  if (!inside(k.c2.consistent, marks.get(k.c2.subject))) issue('the c2 consistent range contains the declared ratio');
  if (!(k.c3.visibleAbove < (marks.get(k.c3.subject) ?? 0))) issue('the c3 threshold is below the declared ratio');
  if (k.c4.subjects.some(s => !inside(s.accept, marks.get(s.id)))) issue('each c4 acceptance range contains its declared ratio');
  if (Object.values(c.inputs).some(i => !c.readOnly.some(dir => within(i.file, dir)))) issue('every input lies inside a declared read-only folder');
});
export type ScaleProbeConfig = z.infer<typeof scaleProbeConfigSchema>;

/** Containment by path segment, case-insensitively (as the likeness probe's guard: only a ".." segment itself leaves the parent). */
function within(child: string, parent: string) {
  const r = path.relative(path.resolve(parent).toLowerCase(), path.resolve(child).toLowerCase());
  return !path.isAbsolute(r) && !/^\.\.(?:[\\/]|$)/.test(r);
}
/**
 * Where the probe may write: outside the protected checkouts (the likeness probe's guard, derived from the scripts' own location) and outside
 * every declared read-only folder, so the held book is never written. Checked at configuration and again at the run's entry.
 */
function writableOutput(config: Pick<ScaleProbeConfig, 'outputParent' | 'readOnly'>) {
  try { assertOutsideCheckouts(config.outputParent); }
  catch (error) { fail(errorCode(error) === 'likeness_probe_output_in_repository' ? 'scale_probe_output_in_repository' : 'scale_probe_source_root'); }
  if (config.readOnly.some(dir => within(config.outputParent, dir))) fail('scale_probe_output_in_read_only');
}
/** The validated configuration and the sha256 of its exact bytes (what the grant binds). */
export function readScaleProbeConfig(file: string) {
  if (!path.isAbsolute(file)) fail('scale_probe_config');
  let bytes: Buffer, raw: unknown;
  try { bytes = readFileSync(file); raw = JSON.parse(bytes.toString('utf8')); } catch { return fail('scale_probe_config'); }
  const parsed = scaleProbeConfigSchema.safeParse(raw);
  if (!parsed.success) return fail('scale_probe_config');
  writableOutput(parsed.data);
  for (const input of Object.values(parsed.data.inputs)) if (!existsSync(input.file)) fail('scale_probe_input_missing');
  return { config: parsed.data, configSha256: previewSha(bytes) };
}

// ---------------------------------------------------------------------------------------------------------------
// Prompts and judge requests: identical in both arms.
// ---------------------------------------------------------------------------------------------------------------
const controlOf = (id: ControlId) => SCALE_PROBE_CONTROLS.find(c => c.id === id)!;
/** The measured cast of a control (the child is always measured first and is not listed here). */
export function controlSubjects(config: ScaleProbeConfig, control: ControlId): string[] {
  const k = config.criteria;
  return control === 'c4' ? k.c4.subjects.map(s => s.id) : [k[control].subject];
}
const declaredRatio = (config: ScaleProbeConfig, id: string) => config.band.marks.find(m => m.id === id)!.ratio;
/** The ONE size sentence, present in both arms (in the baseline the strip shows no mark). */
export const sizeStripSentence = (config: Pick<ScaleProbeConfig, 'band'>) => `SIZE STRIP: below image 3's tiles is a size strip. Where it shows marks, each mark's height against the post (labelled "${config.band.marks[0].label}", one child height) is that character's standing height relative to the child, all on one ground line; on the page only perspective changes it (nearer looks larger, farther looks smaller). Never draw the strip, its marks or its labels.`;
const referenceNotices = (config: ScaleProbeConfig) => (['entities', 'locations'] as const).filter(r => config.referenceStatus[r].status === 'diagnostic_candidate')
  .map(r => `Image ${r === 'entities' ? 3 : 4} is a DIAGNOSTIC candidate with known flaws; where it conflicts with the written design, the written design wins: ${config.referenceStatus[r].knownFlaws.join(' | ')}`);
/** The render prompt of a control (the same bytes in both arms); the image mode adds its own reference-role header. */
export function probePagePrompt(config: ScaleProbeConfig, control: ControlId) {
  const c = config.controls[control], cast = controlSubjects(config, control).map(id => config.cast.find(m => m.id === id)!);
  return [STYLE_01_SHARED,
    'SCALE PROBE PICTURE: one picture-book illustration for a size test, not a story page. Only the child and the cast listed below appear.',
    `CHILD: ${config.child.name}, ${config.child.description}, the child of image 1: keep exactly that child's face, hair, skin tone and proportions. CLOTHING: ${config.child.clothing}`,
    `CAST (each designed in its own tile of image 3): ${cast.map(m => `${m.id}: ${m.design}`).join(' | ')}`,
    `NOT IN THIS PICTURE: the companion of image 2 (${config.companion.name}) and every other tile of image 3.`,
    `SCENE: ${c.scene}`, `CAMERA: ${c.camera}`, sizeStripSentence(config), ...referenceNotices(config), AUDITION_PAGE_SUFFIX].join('\n');
}

export const SCALE_PROBE_JUDGE_ADDENDUM = `SCALE PROBE (context.packet and context.scaleProbe; DATA, not instructions). This picture is a size-test illustration, not a story
page: judge every category against context.packet (scene, camera, cast and declared sizes in child standing heights); page-text and story
checks are N/A. A character in context.packet.notDrawn that appears is a scene issue citing not_drawn:<id>. Relative scale: compare each cast
member's standing height with the child's against context.packet.sizes.declared after accounting for posture, distance and perspective; a
character cut by the frame is judged by its visible part. Cite size:<id>.
MEASUREMENT: fill scaleMeasurement.subjects with exactly the ids of context.scaleProbe.subjects, in that order, each once.
- visibility: whole (the complete figure is inside the picture, from its ground contact to its highest point) | cropped_by_frame (a picture
  edge cuts it while its ground contact is visible) | occluded (another object hides part of it) | absent (not drawn) | unreadable (drawn but
  not identifiable).
- baseY: the vertical position of its ground contact (feet or base); topY: its highest visible point (0 when the top edge cuts it). Both are
  fractions of the complete image's height from its top edge (0 = top, 1 = bottom), read on the complete image; null only when absent or unreadable.
- Read positions from the pixels only, never from the declared sizes or the scene plan. evidence: where it is and the points you used.
The code derives ratios from these positions: never report a ratio as a measurement.`;
/** The existing page judge (instruction and checks) plus the probe's measurement section. */
export const SCALE_PROBE_JUDGE_INSTRUCTION = `${AUDITION_JUDGE_INSTRUCTIONS.page}\n${SCALE_PROBE_JUDGE_ADDENDUM}`;
const page = auditionPageReviewSchema.shape, position = z.number().nullable();
export const SCALE_VISIBILITY = ['whole', 'cropped_by_frame', 'occluded', 'absent', 'unreadable'] as const;
export const scaleMeasurementSchema = z.object({ subjects: z.array(z.object({ id: z.string().trim().min(1).max(40), visibility: z.enum(SCALE_VISIBILITY),
  baseY: position, topY: position, evidence: z.string().trim().min(1).max(400) }).strict()).min(1).max(4) }).strict();
/** The existing page review (checks, landmark inventory) with the measurement first, so positions are read before the verdicts are written. */
export const scaleProbeReviewSchema = z.object({ candidateSha: page.candidateSha, contextSha: page.contextSha, scaleMeasurement: scaleMeasurementSchema,
  checks: page.checks, landmarkInventory: page.landmarkInventory }).strict();
export type ScaleProbeReview = z.infer<typeof scaleProbeReviewSchema>;
export type MeasuredSubject = ScaleProbeReview['scaleMeasurement']['subjects'][number];
const REVIEW_FORMAT = 'scale_probe_pixels_v1';

/** A control's judge context: the same in both arms (no arm marker), with the declared ratios and the measured ids. */
export function probeJudgeContext(config: ScaleProbeConfig, control: ControlId, references: readonly AuditionImage[]) {
  const subjects = controlSubjects(config, control), c = config.controls[control];
  const requirementIds = ['scene_plan', 'framing', 'style', 'safety', 'anatomy', 'cast:child', ...subjects.flatMap(id => [`cast:${id}`, `size:${id}`]), 'not_drawn:companion'];
  const context = { version: 'scale-probe-judge-context/v1',
    packet: { probe: SCALE_PROBE_VERSION, control, kind: controlOf(control).kind, scene: c.scene, camera: c.camera, notDrawn: ['companion'],
      sizes: { unit: 'child standing heights', declared: Object.fromEntries(subjects.map(id => [id, declaredRatio(config, id)])) } },
    references, referenceStatus: config.referenceStatus, predecessor: null,
    checks: { notYetRevealed: [], uniqueLandmarks: [], castIdentity: [
      { id: 'child', reference: 'canonical_child', design: `the reference child (${config.child.description}); clothing: ${config.child.clothing}` },
      ...subjects.map(id => ({ id, reference: `canonical_entities tile ${id}`, design: config.cast.find(m => m.id === id)!.design }))] },
    requirementIds, scaleProbe: { subjects: ['child', ...subjects] } };
  return { context, contextSha: previewQualityContextSha(context), requirementIds, measured: context.scaleProbe.subjects };
}

// ---------------------------------------------------------------------------------------------------------------
// Outcomes (pure): the judge's positions give the ratios; its categorical relative_scale verdict must agree.
// ---------------------------------------------------------------------------------------------------------------
type Verdict = 'pass' | 'defect' | 'uncertain';
export type ControlOutcome = { control: ControlId; kind: string; outcome: string; reason: string; ratios: Record<string, number | null>; relativeScale: Verdict };
const height = (s: MeasuredSubject) => s.baseY! - s.topY!;
/**
 * The measurement must list exactly the measured ids in order; a visible (whole or cropped) subject has both positions in [0, 1] with its top
 * above its base. Anything else is an unusable review (the run stops), never a visual finding.
 */
export function validMeasurement(measurement: ScaleProbeReview['scaleMeasurement'], measured: readonly string[]) {
  const list = measurement.subjects, unit = (v: number | null) => v === null || (v >= 0 && v <= 1);
  if (list.length !== measured.length || list.some((s, i) => s.id !== measured[i])) fail('scale_probe_measurement');
  for (const s of list) {
    if (!unit(s.baseY) || !unit(s.topY)) fail('scale_probe_measurement');
    if ((s.visibility === 'whole' || s.visibility === 'cropped_by_frame') && (s.baseY === null || s.topY === null || !(s.topY < s.baseY))) fail('scale_probe_measurement');
  }
  return list;
}
/**
 * One arm's outcome under its control's criterion. Pass needs the measured ratio inside the range AND relative_scale pass; fail needs it outside
 * AND relative_scale defect; a disagreement, an uncertain verdict, an unrealised control or a safety-blocked picture (never evidence, as in the
 * audition) is inconclusive (C4: not counted). C2 is report only.
 */
export function controlOutcome(config: ScaleProbeConfig, control: ControlId, list: readonly MeasuredSubject[], relativeScale: Verdict,
  safetyBlocked = false): ControlOutcome {
  const [child, ...subjects] = list, kind = controlOf(control).kind, k = config.criteria;
  const ratios: Record<string, number | null> = Object.fromEntries(subjects.map(s => [s.id,
    (s.visibility === 'whole' || s.visibility === 'cropped_by_frame') && child.visibility === 'whole' ? height(s) / height(child) : null]));
  const result = (outcome: string, reason: string): ControlOutcome => ({ control, kind, outcome, reason, ratios, relativeScale });
  const unrealised = control === 'c4' ? 'not_counted' : 'inconclusive';
  if (safetyBlocked) return result(unrealised, 'safety_blocked');
  if (relativeScale === 'uncertain') return result(unrealised, 'judge_uncertain');
  if (child.visibility !== 'whole') return result(unrealised, 'child_not_whole');
  const agree = (inside: boolean, ok: string, bad: string) => inside && relativeScale === 'pass' ? result('pass', ok)
    : !inside && relativeScale === 'defect' ? result('fail', bad) : result(unrealised, 'judge_verdict_disagrees_with_measurement');
  const g = subjects[0], depth = (s: MeasuredSubject) => Math.abs(child.baseY! - s.baseY!);
  if (control === 'c1') {
    if (g.visibility !== 'whole') return result('inconclusive', 'subject_not_whole');
    if (depth(g) > k.c1.sameDepthMax) return result('inconclusive', 'bases_not_at_one_depth');
    const r = ratios[g.id]!;
    return agree(r >= k.c1.accept.min && r <= k.c1.accept.max, 'inside_range', r < k.c1.accept.min ? 'below_range' : 'above_range');
  }
  if (control === 'c2') {
    if (g.visibility !== 'whole') return result('inconclusive', 'subject_not_whole');
    if (child.baseY! - g.baseY! < k.c2.behindMin) return result('inconclusive', 'not_behind');
    const r = ratios[g.id]!;
    return r > k.c2.consistent.max ? result('over_scaled', 'above_consistent_range') : r >= k.c2.consistent.min ? result('consistent', 'not_proof')
      : result('inconclusive', 'below_consistent_range');
  }
  if (control === 'c3') {
    if (g.visibility !== 'cropped_by_frame' || g.topY! > k.c3.croppedTopMax) return result('inconclusive', 'not_cropped_at_top');
    if (depth(g) > k.c3.sameDepthMax) return result('inconclusive', 'bases_not_at_one_depth');
    return agree(ratios[g.id]! > k.c3.visibleAbove, 'visible_part_above_threshold', 'visible_part_at_or_below_threshold');
  }
  for (const s of subjects) {
    if (s.visibility !== 'whole') return result('not_counted', `${s.id}_${s.visibility}`);
    if (depth(s) > k.c4.sameDepthMax) return result('not_counted', `${s.id}_not_at_child_depth`);
  }
  return agree(k.c4.subjects.every(c => ratios[c.id]! >= c.accept.min && ratios[c.id]! <= c.accept.max), 'all_inside_range', 'outside_range');
}
/**
 * The C1 gate (who decides: the owner). O1 (band pass, baseline fail) PAUSES for the owner's go; O2 (both pass) stops: inconclusive about
 * added value; O3 (band fail, whatever the baseline did) stops; O4 (inconclusive or unusable evidence) stops.
 */
export function c1Gate(baseline: Pick<ControlOutcome, 'outcome'>, band: Pick<ControlOutcome, 'outcome'>) {
  const gate = band.outcome === 'fail' ? 'O3_band_fail' : band.outcome !== 'pass' ? 'O4_unusable'
    : baseline.outcome === 'pass' ? 'O2_both_pass' : baseline.outcome === 'fail' ? 'O1_candidate_positive' : 'O4_unusable';
  return { gate, pauseForOwner: gate === 'O1_candidate_positive' } as const;
}

// ---------------------------------------------------------------------------------------------------------------
// Plan (provider-free).
// ---------------------------------------------------------------------------------------------------------------
const readPinned = (input: { file: string; sha256: string }) => {
  const bytes = readFileSync(input.file);
  if (previewSha(bytes) !== input.sha256) fail('scale_probe_input_changed');
  return bytes;
};
const rows = async (png: Buffer) => (await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data;
const BLANK = [1, 3, 5].map(i => parseInt(SCALE_BAND.colours.background.slice(i, i + 2), 16));
/** The judge's image roles exactly as the adapter sends them (auditionJudgePayload: the candidate, its four crops, the four references). */
const JUDGE_IMAGE_ROLES = ['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right', 'candidate_crop_bottom_left',
  'candidate_crop_bottom_right', 'canonical_child', 'canonical_companion', 'canonical_entities', 'canonical_locations'];
/**
 * Everything both stages need, derived from the configuration alone and checked: the pinned inputs, the band, both canvases (the atlas rows
 * identical in both, the band area blank or exactly the band), every prompt, judge context and reservation. Nothing is written.
 */
export async function prepareScaleProbe(config: ScaleProbeConfig, configSha256: string) {
  const bytes = { child: readPinned(config.inputs.child), companion: readPinned(config.inputs.companion),
    atlas: readPinned(config.inputs.entitiesAtlas), locations: readPinned(config.inputs.locations) };
  const band = await scaleBand(config.band);
  const canvas = { baseline: await composeEntitiesCanvas(bytes.atlas, 'blank'), band: await composeEntitiesCanvas(bytes.atlas, band.png) };
  const split = ENTITIES_CANVAS.width * ENTITIES_CANVAS.atlasHeight * 3, atlasRows = await rows(bytes.atlas), bandRows = await rows(band.png);
  const [baseRows, markRows] = [await rows(canvas.baseline), await rows(canvas.band)];
  if (!baseRows.subarray(0, split).equals(atlasRows) || !markRows.subarray(0, split).equals(atlasRows) || !markRows.subarray(split).equals(bandRows) ||
    baseRows.subarray(split).some((v, i) => v !== BLANK[i % 3])) fail('scale_probe_canvas_parity');
  const image = (imageName: string, data: Buffer): AuditionImage => ({ imageName, imageSha: previewSha(data) });
  const images = { child: image('child.png', bytes.child), companion: image('companion.png', bytes.companion), atlasPlain: image('atlas_plain.png', bytes.atlas),
    locations: image('locations.png', bytes.locations), canvasBaseline: image('canvas_baseline.png', canvas.baseline), canvasBand: image('canvas_band.png', canvas.band) };
  const renderRefs: Record<Arm, AuditionImage[]> = { baseline: [images.child, images.companion, images.canvasBaseline, images.locations],
    band: [images.child, images.companion, images.canvasBand, images.locations] };
  const judgeRefs = [images.child, images.companion, images.atlasPlain, images.locations];
  const controls = SCALE_PROBE_CONTROLS.map(meta => {
    const prompt = probePagePrompt(config, meta.id);
    const planned = planGPTImageRequest({ finalPrompt: prompt, referenceImages: renderRefs.baseline.map(r => r.imageName), referenceMode: 'book_identity',
      requireReferenceEdit: true, quality: 'low', size: '1024x1024', modelOverride: 'gpt-image-2' }, { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
    if (planned.referenceCountPassed !== 4) fail('scale_probe_reference_truncated');
    const judge = probeJudgeContext(config, meta.id, judgeRefs);
    // The review text exactly as the adapter will send it: only the candidate's sha differs per arm, and it is always 64 characters.
    const judgeText = JSON.stringify({ candidateSha: '0'.repeat(64), contextSha: judge.contextSha, context: judge.context, imageRoles: JUDGE_IMAGE_ROLES });
    if (Buffer.byteLength(judgeText + SCALE_PROBE_JUDGE_INSTRUCTION, 'utf8') > 104000) fail('scale_probe_payload_limit');
    return { ...meta, subjects: controlSubjects(config, meta.id), scene: config.controls[meta.id].scene, camera: config.controls[meta.id].camera, prompt,
      finalPromptSha256: previewSha(Buffer.from(planned.finalPrompt)), finalPromptBytes: Buffer.byteLength(planned.finalPrompt, 'utf8'),
      renderReservationMicroUsd: renderMaximum(planned.finalPrompt, 4), reviewReservationMicroUsd: SOL_PIXEL_REVIEW_SLOT_MICRO_USD, judge,
      judgeTextBytes: Buffer.byteLength(judgeText, 'utf8') };
  });
  const reservation = (step: string) => { const c = controls.find(x => step.startsWith(`${x.id}_`))!; return step.endsWith('_qa') ? c.reviewReservationMicroUsd : c.renderReservationMicroUsd; };
  const steps = [...stageSteps('S1'), ...stageSteps('S2')];
  const project = (cost: (step: string) => number) => {
    let accounted = 0; const table: { step: string; accountedBeforeMicroUsd: number; reservationMicroUsd: number; sumMicroUsd: number; admitted: boolean }[] = [];
    for (const step of steps) {
      const r = reservation(step), admitted = accounted + r <= config.capMicroUsd;
      table.push({ step, accountedBeforeMicroUsd: accounted, reservationMicroUsd: r, sumMicroUsd: accounted + r, admitted });
      if (!admitted) break;
      accounted += cost(step);
    }
    return { stopsBefore: table.find(t => !t.admitted)?.step ?? null, calls: table.filter(t => t.admitted).length, table };
  };
  const assumed = (factor: number) => (step: string) => Math.round((step.endsWith('_qa') ? config.costAssumption.reviewMicroUsd : config.costAssumption.renderMicroUsd) * factor);
  const plan = { version: SCALE_PROBE_VERSION, label: config.label, configSha256, output: path.join(config.outputParent, `scale-probe-${config.label}`),
    grantFile: path.join(config.outputParent, `scale-probe-${config.label}.grant.json`),
    inputs: Object.fromEntries(Object.entries(config.inputs).map(([k, v]) => [k, { sha256: v.sha256 }])), referenceStatus: config.referenceStatus,
    band: { geometry: band.geometry, pngSha256: previewSha(band.png) },
    canvases: { width: ENTITIES_CANVAS.width, height: ENTITIES_CANVAS.height, baseline: images.canvasBaseline, band: images.canvasBand,
      atlasPixelsIdenticalInBoth: true, baselineBandAreaBlank: SCALE_BAND.colours.background, bandAreaIsTheBand: true },
    references: { render: { baseline: renderRefs.baseline, band: renderRefs.band }, judge: judgeRefs, mode: 'book_identity',
      onlyDifference: 'image 3 of the render request: canvas_baseline (blank band area) or canvas_band (the marks)' },
    controls, judge: { model: 'gpt-6.1-sol', instructionSha256: previewSha(Buffer.from(SCALE_PROBE_JUDGE_INSTRUCTION)), format: REVIEW_FORMAT, images: 9 },
    criteria: config.criteria, calls: { S1: stageSteps('S1'), S2: stageSteps('S2'), total: steps.length },
    capMicroUsd: config.capMicroUsd, maxCalls: SCALE_PROBE_LIMITS.totalCalls,
    projections: { costAssumption: config.costAssumption, assumed: project(assumed(1)), assumedPlus20Percent: project(assumed(1.2)), everyCallAtItsReservation: project(reservation),
      note: 'each claim must fit "accounted + its reservation <= cap"; a refused claim stops the run (an honest capped outcome, never a retry)' },
    privateOutput: 'the output folder holds fictional generated pictures and render receipts with their bytes: private, never copied into a repository or review folder',
    runtimeEligible: false };
  return { plan, planSha256: previewSha(canonicalJson(plan)), bytes, canvas, images, renderRefs, judgeRefs, controls };
}
/** The dry run: the plan and the folder's current state. No key, no provider, nothing written. */
export async function planScaleProbe(config: ScaleProbeConfig, configSha256: string) {
  const prepared = await prepareScaleProbe(config, configSha256);
  return { ...prepared.plan, planSha256: prepared.planSha256, state: { outputExists: existsSync(prepared.plan.output), grantExists: existsSync(prepared.plan.grantFile) },
    providerCalls: 0, keyRead: false, written: [] as string[] };
}

// ---------------------------------------------------------------------------------------------------------------
// Authority records: the owner's spend grant (S1) and the owner's go (S2), each written from the owner's own words.
// ---------------------------------------------------------------------------------------------------------------
const approval = z.object({ owner: z.literal('Guy'), quote: text(2000), recordedAt: z.string().datetime({ offset: true }), recordedBy: text(200) }).strict();
export const scaleProbeGrantSchema = z.object({ version: z.literal('scale-probe-grant/v1'), label: z.string(), configSha256: sha,
  capMicroUsd: z.literal(SCALE_PROBE_LIMITS.capMicroUsd), maxCalls: z.literal(SCALE_PROBE_LIMITS.totalCalls), s1Calls: z.literal(SCALE_PROBE_LIMITS.s1Calls), approval }).strict();
export const scaleProbeOwnerGoSchema = z.object({ version: z.literal('scale-probe-owner-go/v1'), label: z.string(), s1SealSha256: sha,
  gate: z.literal('O1_candidate_positive'), approval }).strict();
/** A record file read as it is stored (a regular, unlinked file) with the sha256 of its bytes; unreadable or not JSON refuses with `code`. */
const recordFile = (file: string, code: string) => {
  try { const raw = fencedText(file, 200000); return { value: JSON.parse(raw) as unknown, sha256: previewSha(Buffer.from(raw, 'utf8')) }; }
  catch { return fail(code); }
};
function readGrant(file: string, config: ScaleProbeConfig, configSha256: string) {
  const { value, sha256 } = recordFile(file, 'scale_probe_grant');
  const grant = scaleProbeGrantSchema.safeParse(value);
  if (!grant.success || grant.data.label !== config.label || grant.data.configSha256 !== configSha256) fail('scale_probe_grant');
  return { grantSha256: sha256 };
}

// ---------------------------------------------------------------------------------------------------------------
// Runner.
// ---------------------------------------------------------------------------------------------------------------
type ArmResult = { arm: Arm; image: AuditionImage; relativeScale: { verdict: Verdict; observation: string }; measurement: MeasuredSubject[];
  counts: Record<string, number>; findings: { category: string; impact: string; requirement: string; note: string; bound: boolean }[];
  invalidCitations: number; safetyBlocked: boolean; outcome: ControlOutcome };
type ControlResult = { control: ControlId; kind: string; scene: string; arms: Partial<Record<Arm, ArmResult>> };
const ledgerOf = (root: string) => verifyMeterRecords(root, scaleProbeMeterRules).map(r => ({ step: r.claim.step as string, seq: r.claim.seq as number,
  wireDigest: r.claim.wireDigest as string, maximumMicroUsd: r.claim.maximumMicroUsd as number,
  estimatedMicroUsd: (r.result?.estimatedMicroUsd ?? null) as number | null, completed: (r.result?.completed ?? null) as boolean | null }))
  .sort((a, b) => a.seq - b.seq);

/**
 * A stage, once. S1: the grant, then a fresh folder (exclusive), the inputs and canvases written by hash, C1's four calls. S2: S1 sealed with
 * the candidate-positive gate, the owner's go binding that exact seal, the same configuration, plan and grant, the ledger exactly S1's records,
 * then an exclusive start record and the remaining twelve calls. Any failed call, unusable review or refused claim stops and seals the stage.
 */
export async function runScaleProbe(args: { config: ScaleProbeConfig; configSha256: string; stage: Stage; signal: AbortSignal; log: (line: string) => void }) {
  const { config, configSha256, stage } = args;
  if (stage !== 'S1' && stage !== 'S2') fail('scale_probe_stage');
  writableOutput(config);
  realDirectory(config.outputParent);
  const prepared = await prepareScaleProbe(config, configSha256), out = prepared.plan.output, images = path.join(out, 'illustrations');
  const meterRoot = path.join(out, 'paid-stages'), s1Seal = path.join(out, 's1.sealed.json');
  const save = (name: string, value: unknown) => exclusiveJson(path.join(out, `${name}.json`), value);
  let grantSha256: string;
  if (stage === 'S1') {
    ({ grantSha256 } = readGrant(prepared.plan.grantFile, config, configSha256));
    try { mkdirSync(out); } catch { fail('scale_probe_used'); }
    mkdirSync(images);
  } else {
    if (!existsSync(s1Seal)) fail('scale_probe_s1_not_sealed');
    const sealed = recordFile(s1Seal, 'scale_probe_s1_not_sealed'), seal = sealed.value as Record<string, unknown>;
    if (seal?.stage !== 'S1' || seal.status !== 'complete' || seal.gate !== 'O1_candidate_positive' || seal.pauseForOwner !== true) fail('scale_probe_s1_gate');
    if (seal.configSha256 !== configSha256 || seal.planSha256 !== prepared.planSha256) fail('scale_probe_plan_changed');
    ({ grantSha256 } = readGrant(prepared.plan.grantFile, config, configSha256));
    if (seal.grantSha256 !== grantSha256) fail('scale_probe_grant');
    const go = recordFile(path.join(out, 's2-owner-go.json'), 'scale_probe_owner_go'), parsedGo = scaleProbeOwnerGoSchema.safeParse(go.value);
    if (!parsedGo.success || parsedGo.data.label !== config.label || parsedGo.data.s1SealSha256 !== sealed.sha256) fail('scale_probe_owner_go');
    // Once only: a started S2 refuses here (the exclusive start record below is the race-safe guard).
    if (existsSync(path.join(out, 's2.started.json'))) fail('scale_probe_s2_used');
    if (canonicalJson(ledgerOf(meterRoot)) !== canonicalJson(seal.ledger)) fail('scale_probe_ledger');
    try { save('s2.started', { version: SCALE_PROBE_VERSION, stage, s1SealSha256: sealed.sha256, ownerGoSha256: go.sha256, planSha256: prepared.planSha256 }); }
    catch { fail('scale_probe_s2_used'); }
  }
  const meter = new AuditionMeter(meterRoot, config.capMicroUsd, stage === 'S1' ? SCALE_PROBE_LIMITS.s1Calls : SCALE_PROBE_LIMITS.totalCalls, 0, 0, scaleProbeMeterRules);
  const key = keyReader(config.keyEnvFile);
  const io = auditionAdapters({ directory: images, meter, key, signal: args.signal });
  const results: ControlResult[] = [];
  // A completed stage seals its verified ledger and spend; a stopped or failed one seals whatever it can still verify (and why not).
  const sealStage = (status: 'complete' | 'stopped' | 'failed', extra: Record<string, unknown>) => {
    let books: { ledger: ReturnType<typeof ledgerOf> | null; spend: ReturnType<AuditionMeter['snapshot']> | null; booksError?: string };
    try { books = { ledger: ledgerOf(meterRoot), spend: meter.snapshot() }; }
    catch (error) { if (status === 'complete') throw error; books = { ledger: null, spend: null, booksError: errorCode(error) }; }
    const record = { version: SCALE_PROBE_VERSION, stage, status, ...extra, configSha256, planSha256: prepared.planSha256, grantSha256,
      ...books, runtimeEligible: false, productionQualified: false };
    save(`${stage.toLowerCase()}.sealed`, record);
    return { ...record, spend: books.spend! };
  };
  try {
    if (stage === 'S1') {
      for (const [name, data] of [['child.png', prepared.bytes.child], ['companion.png', prepared.bytes.companion], ['atlas_plain.png', prepared.bytes.atlas],
        ['locations.png', prepared.bytes.locations], ['canvas_baseline.png', prepared.canvas.baseline], ['canvas_band.png', prepared.canvas.band]] as const) {
        const written = await io.writeImage(name, data);
        if (canonicalJson(written) !== canonicalJson(Object.values(prepared.images).find(i => i.imageName === name))) fail('scale_probe_input_changed');
      }
      save('plan', { ...prepared.plan, planSha256: prepared.planSha256 });
    } else for (const img of Object.values(prepared.images)) io.bytesOf(img);
    const judge = async (step: string, candidate: AuditionImage, control: (typeof prepared.controls)[number]) => {
      io.check();
      const base = await auditionJudgePayload({ candidate, candidateBytes: io.bytesOf(candidate), context: control.judge.context, contextSha: control.judge.contextSha,
        refs: prepared.judgeRefs.map(r => io.bytesOf(r)), predecessor: null, kind: 'page' });
      const payload = { ...base, instructions: SCALE_PROBE_JUDGE_INSTRUCTION, text: { format: zodTextFormat(scaleProbeReviewSchema, REVIEW_FORMAT) } };
      const first = payload.input[0].content[0];
      if (first.type !== 'input_text' || Buffer.byteLength(first.text + payload.instructions, 'utf8') > 104000) fail('scale_probe_payload_limit');
      io.check();
      return meter.run(step, digestImages(payload), SOL_PIXEL_REVIEW_SLOT_MICRO_USD, async () => {
        if (args.signal.aborted) fail('audition_cancelled');
        const client = new OpenAI({ apiKey: key(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off' });
        const raw = await client.responses.create(payload, { signal: args.signal, timeout: 300000 });
        // The cost and the answered test are the review rule's own (the same terms the meter re-derives).
        const settled = auditionReviewRule.settle(null, { raw }, true), receipt = { raw, estimatedMicroUsd: settled.estimatedMicroUsd };
        if (!settled.coherent) throw Object.assign(new ScaleProbeError('scale_probe_review_provider_invalid'), { receipt });
        try { return { value: scaleProbeReviewSchema.parse(JSON.parse(raw.output_text)), estimatedMicroUsd: settled.estimatedMicroUsd, receipt }; }
        catch { throw Object.assign(new ScaleProbeError('scale_probe_review_schema'), { receipt }); }
      });
    };
    for (const control of prepared.controls.filter(c => c.stage === stage)) {
      const result: ControlResult = { control: control.id, kind: control.kind, scene: control.scene, arms: {} };
      results.push(result);
      for (const arm of SCALE_PROBE_ARMS) {
        const step = `${control.id}_${arm}`;
        const candidate = await io.render(step, control.prompt, prepared.renderRefs[arm], 'book_identity');
        args.log(`${step}: ${candidate.imageName}`);
        const review = await judge(`${step}_qa`, candidate, control);
        let read: Omit<ArmResult, 'arm' | 'image' | 'outcome'>;
        try {
          const { scaleMeasurement, ...pageReview } = review;
          const { assessment } = assessAuditionReview(pageReview, candidate.imageSha, control.judge.contextSha, control.judge.requirementIds, []);
          const measurement = validMeasurement(scaleMeasurement, control.judge.measured), rs = pageReview.checks.find(c => c.category === 'relative_scale')!;
          read = { relativeScale: { verdict: rs.verdict, observation: rs.observation }, measurement, counts: assessment.counts,
            findings: assessment.findings.map(f => ({ category: f.category, impact: f.impact, requirement: f.requirement, note: f.note, bound: f.bound })),
            invalidCitations: assessment.invalidCitations, safetyBlocked: assessment.safetyBlocked };
        } catch (error) { return fail('scale_probe_review_unusable', errorCode(error)); }
        const outcome = controlOutcome(config, control.id, read.measurement, read.relativeScale.verdict, read.safetyBlocked);
        result.arms[arm] = { arm, image: candidate, ...read, outcome };
        args.log(`${step}_qa: ${outcome.outcome} (${outcome.reason}) ratios=${JSON.stringify(outcome.ratios)} relative_scale=${outcome.relativeScale}`);
      }
    }
    const gate = stage === 'S1' ? c1Gate(results[0].arms.baseline!.outcome, results[0].arms.band!.outcome) : null;
    save(`${stage.toLowerCase()}.results`, { version: SCALE_PROBE_VERSION, stage, controls: results, ...(gate ? gate : {}),
      verdict: 'diagnostic only: the judge\'s positions and verdicts, then the owner\'s eye; not product acceptance' });
    const record = sealStage('complete', gate ?? {});
    exclusiveText(path.join(out, `${stage.toLowerCase()}-viewer.html`), scaleProbeHTML({ stage, controls: results, gate, spend: record.spend },
      img => `data:image/png;base64,${io.bytesOf(img).toString('base64')}`, { baseline: prepared.images.canvasBaseline, band: prepared.images.canvasBand }));
    return { status: record.status, gate, results, spend: record.spend };
  } catch (error) {
    const code = errorCode(error), detail = error instanceof ScaleProbeError ? error.detail : undefined;
    if (!existsSync(path.join(out, `${stage.toLowerCase()}.sealed.json`))) sealStage(code === 'audition_budget_exhausted' ? 'stopped' : 'failed',
      { code, ...(detail ? { detail } : {}), ...(stage === 'S1' ? { gate: 'O4_unusable', pauseForOwner: false } : {}), completed: results });
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The owner's local viewer (fictional pictures; private, never published).
// ---------------------------------------------------------------------------------------------------------------
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const KIND_HE: Record<string, string> = { positive: 'בדיקה חיובית: הדמות הענקית שלמה ליד הילד, באותו עומק', perspective: 'פרספקטיבה: הדמות הענקית רחוקה מאחור (לדיווח בלבד)',
  crop: 'חיתוך: הדמות הענקית ליד הילד, ראשה נחתך בשולי התמונה', small: 'דמויות קטנות ליד הילד, באותו עומק' };
const GATE_HE: Record<string, string> = { O1_candidate_positive: 'O1: סימן חיובי אפשרי (עם סימנים עבר, בלי סימנים נכשל). עוצרים עד שתחליט.',
  O2_both_pass: 'O2: שני הצדדים עברו. לא ברור שהסימנים הוסיפו משהו. עוצרים.', O3_band_fail: 'O3: עם הסימנים נכשל. עוצרים.',
  O4_unusable: 'O4: התוצאה לא חד־משמעית או לא שמישה. עוצרים.' };
export function scaleProbeHTML(view: { stage: Stage; controls: ControlResult[]; gate: { gate: string; pauseForOwner: boolean } | null; spend: { newKnownApiMicroUsd: number; cumulativeAccountedMicroUsd: number; calls: number } },
  src: (img: AuditionImage) => string, canvases: Record<Arm, AuditionImage>) {
  const arm = (a: ArmResult | undefined, title: string) => !a ? `<figure><figcaption>${esc(title)}: לא צויר (הריצה נעצרה)</figcaption></figure>`
    : `<figure><img src="${src(a.image)}" alt="${esc(title)}"><figcaption><b>${esc(title)}: ${esc(a.outcome.outcome)}</b> (${esc(a.outcome.reason)})<br>
<span dir="ltr">ratios ${esc(Object.entries(a.outcome.ratios).map(([k, v]) => `${k} ${v === null ? '—' : v.toFixed(2)}`).join(', '))} · relative_scale ${esc(a.relativeScale.verdict)}</span>
<details><summary>מה השופט ראה</summary><p dir="ltr">${esc(a.relativeScale.observation)}</p><ul dir="ltr">${a.measurement.map(m => `<li>${esc(m.id)}: ${esc(m.visibility)} base ${esc(m.baseY)} top ${esc(m.topY)}, ${esc(m.evidence)}</li>`).join('')}</ul></details></figcaption></figure>`;
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>בדיקת קנה מידה ${esc(view.stage)}</title>
<style>body{font:17px/1.6 Arial,sans-serif;margin:0;background:#f5f0e6;color:#263542}main{max-width:1300px;margin:auto;padding:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}
figure{margin:0;background:#fff;padding:10px;border-radius:12px}img{width:100%;display:block;border-radius:8px}.note{font-size:15px;color:#555}section{margin:22px 0}
.gate{background:#fff;border-radius:12px;padding:12px 16px}@media(max-width:760px){.pair{grid-template-columns:1fr}main{padding:12px}}</style>
<main><h1>בדיקת קנה מידה: שלב ${esc(view.stage)}</h1>
<p class="note">מקומי ופרטי, לא לפרסום. דמויות בדיוניות. איכות LOW, ציור אחד לכל צד, בלי בחירה ובלי ציור חוזר. היחסים מחושבים ממיקומים שהשופט העריך בתמונה: אומדן, לא מדידה של העולם. זו לא אישור מוצר.</p>
${view.gate ? `<div class="gate"><b>${esc(GATE_HE[view.gate.gate] ?? view.gate.gate)}</b>${view.gate.pauseForOwner ? '<p>מה נדרש ממך: להסתכל על שתי התמונות. האם עם הסימנים הדמות הענקית נראית בגובה שהוגדר לה ביחס לילד (כששניהם באותו עומק), ובלי הסימנים לא? שלב 2 ירוץ רק אם תאשר במפורש.</p>' : ''}</div>` : ''}
${view.controls.map(c => `<section><h2>${esc(c.control.toUpperCase())}: ${esc(KIND_HE[c.kind] ?? c.kind)}</h2><p class="note" dir="ltr">${esc(c.scene)}</p>
<div class="pair">${arm(c.arms.baseline, 'בלי סימנים (בסיס)')}${arm(c.arms.band, 'עם סימני הגובה (M1)')}</div></section>`).join('')}
<details><summary>מה הצייר קיבל כתמונה 3 (שני הצדדים)</summary><div class="pair"><figure><img src="${src(canvases.baseline)}" alt="בסיס"><figcaption>בסיס: רצועה ריקה</figcaption></figure>
<figure><img src="${src(canvases.band)}" alt="M1"><figcaption>M1: סימני גובה</figcaption></figure></div></details>
<p class="note">עלות השלב (הערכה לפי נתוני השימוש): $${(view.spend.newKnownApiMicroUsd / 1e6).toFixed(6)}. בספר החשבונות של הבדיקה רשומים $${(view.spend.cumulativeAccountedMicroUsd / 1e6).toFixed(6)} מתוך $2.00, ${view.spend.calls} קריאות.</p></main></html>`;
}

function argValue(name: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  (async () => {
    const { config, configSha256 } = readScaleProbeConfig(argValue('--config') ?? fail('scale_probe_arguments'));
    if (!process.argv.includes('--execute')) { console.log(JSON.stringify(await planScaleProbe(config, configSha256), null, 2)); return; }
    const stage = argValue('--stage');
    if (stage !== 'S1' && stage !== 'S2') return fail('scale_probe_stage');
    const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
    const r = await runScaleProbe({ config, configSha256, stage, signal: controller.signal, log: line => console.log(line) });
    console.log(JSON.stringify({ status: r.status, gate: r.gate, spend: r.spend }, null, 2));
  })().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
