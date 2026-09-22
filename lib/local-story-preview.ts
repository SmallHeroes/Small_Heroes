import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parseStoryMarkdown } from './story-validators/parser';
import { STYLE_01_SHARED, STYLE_01_RENDERING_CORRECTION, STYLE_01_CANONICAL_CHILD_ANCHOR_RULE, STYLE_01_FRAMING_RULE, STYLE_01_FRAMING_RULE_CLOSE_UP, buildStyle01ChildAnatomicalLock } from './style01-gptimage';
import { buildStyle01AnatomyIntegrityLock } from './style01-visual-polish';
import { previewContinuitySchema, previewContinuityContext } from './local-preview-quality';

// This is an audition artifact, deliberately not a VisualPackage or runtime authority.
export const PREVIEW_VERSION = 'local-story-preview/v1';
export const previewSha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const camera = z.enum(['wide', 'medium', 'close']);
const angle = z.enum(['eye_level', 'low', 'high', 'over_shoulder']);
export const previewPlanSchema = z.object({
  wardrobe: z.string(),
  visualLanguage: z.string(),
  recurringProps: z.array(z.object({ id: z.string(), design: z.string() }).strict()),
  locations: z.array(z.object({ id: z.string(), design: z.string() }).strict()),
  pages: z.array(z.object({
    pageNumber: z.number().int(), locationId: z.string(),
    shot: camera, angle, composition: z.string(),
    childAction: z.string(), childExpression: z.string(), childGaze: z.string(),
    companionAction: z.string(), scene: z.string(),
    props: z.array(z.object({ id: z.string(), state: z.string() }).strict()),
  }).strict()),
  continuity: previewContinuitySchema.optional(),
}).strict();
// New paid runs require structured continuity; old saved plans remain readable.
export const previewPlanV2Schema = previewPlanSchema.extend({ continuity: previewContinuitySchema });
export type PreviewPlan = z.infer<typeof previewPlanSchema>;

declare const parsedStoryOrigin: unique symbol;
export type PreviewStory = { title: string; pages: { pageNumber: number; text: string }[]; sourceSha: string;
  readonly [parsedStoryOrigin]: true };
// Process-local provenance, never a persisted approval or model-authored claim.
// Weak keys do not retain completed books. No marker is added to serialized artifacts.
const parsedStoryEvidence = new WeakMap<PreviewStory, { serialized: string; sourceSha: string; texts: string[] }>();

export function previewStoryEvidence(story: PreviewStory) {
  const evidence = parsedStoryEvidence.get(story);
  if (!evidence || JSON.stringify(story) !== evidence.serialized) throw Error('preview_story_source_binding');
  return { sourceSha: evidence.sourceSha, texts: [...evidence.texts] };
}

export function previewStory(raw: string, childName: string, gender: 'boy' | 'girl'): PreviewStory {
  if (!childName.trim() || childName.length > 50 || /[{}\r\n]/u.test(childName)) throw Error('invalid_child_name');
  const parsed = parseStoryMarkdown(raw);
  if (parsed.pages.length < 2 || parsed.pages.length > 24 || Number(parsed.frontmatter.pages) !== parsed.pages.length) throw Error('invalid_story_page_count');
  const personalize = (text: string) => {
    const result = text.split('{{childName}}').join(childName).replace(/\{([^{}|]+)\|([^{}|]+)\}/gu, (_: string, boy: string, girl: string) => gender === 'boy' ? boy : girl);
    if (/[{}]/u.test(result)) throw Error('unresolved_story_token');
    return result;
  };
  const pages = parsed.pages.map((p, i) => {
    if (p.pageNumber !== i + 1 || !p.text.trim()) throw Error('invalid_story_sequence');
    return { pageNumber: p.pageNumber, text: personalize(p.text) };
  });
  if (typeof parsed.frontmatter.title !== 'string') throw Error('missing_story_title');
  const story = { title: personalize(parsed.frontmatter.title), pages, sourceSha: previewSha(raw) } as PreviewStory;
  parsedStoryEvidence.set(story, { serialized: JSON.stringify(story), sourceSha: story.sourceSha,
    texts: [story.title, ...pages.map(p => p.text)] });
  return story;
}

export function validatePreviewPlan(value: unknown, pageCount: number): PreviewPlan {
  const plan = previewPlanSchema.parse(value);
  const nonempty = (s: string) => s.trim().length > 0 && s.length <= 1800;
  if (!nonempty(plan.wardrobe) || !nonempty(plan.visualLanguage)) throw Error('empty_visual_lock');
  if (plan.recurringProps.length > 8 || plan.locations.length < 1 || plan.locations.length > 16) throw Error('invalid_lock_inventory');
  for (const list of [plan.recurringProps, plan.locations]) {
    if (new Set(list.map(p => p.id)).size !== list.length || list.some(p => !/^[a-z][a-z0-9_]{0,49}$/.test(p.id) || !nonempty(p.design))) throw Error('invalid_visual_lock');
  }
  if (plan.pages.length !== pageCount + 1) throw Error('plan_page_count');
  plan.pages.forEach((p, i) => {
    if (p.pageNumber !== i || !plan.locations.some(l => l.id === p.locationId)) throw Error('plan_page_binding');
    if ([p.composition, p.childAction, p.childExpression, p.childGaze, p.companionAction, p.scene].some(s => !nonempty(s))) throw Error('empty_page_direction');
    if (new Set(p.props.map(o => o.id)).size !== p.props.length || p.props.some(o => !nonempty(o.state) || !plan.recurringProps.some(r => r.id === o.id))) throw Error('unknown_or_duplicate_prop');
  });
  if (pageCount >= 6 && (new Set(plan.pages.slice(1).map(p => p.shot)).size < 3 || new Set(plan.pages.slice(1).map(p => p.angle)).size < 3 || new Set(plan.pages.slice(1).map(p => p.childExpression.trim().toLowerCase())).size < 5)) throw Error('insufficient_visual_variety');
  return plan;
}

export function previewPagePrompt(plan: PreviewPlan, pageNumber: number, text: string, childAge: number, gender: string, companionDescription: string) {
  const p = plan.pages[pageNumber];
  if (!p || p.pageNumber !== pageNumber) throw Error('unknown_page');
  return [
    STYLE_01_SHARED, STYLE_01_RENDERING_CORRECTION, STYLE_01_CANONICAL_CHILD_ANCHOR_RULE,
    buildStyle01ChildAnatomicalLock({ childAge, allowDistinctSupportingChildren: true }), buildStyle01AnatomyIntegrityLock(),
    p.shot === 'close' ? STYLE_01_FRAMING_RULE_CLOSE_UP : STYLE_01_FRAMING_RULE,
    'Reference roles: image 1 = exact child identity and watercolor technique ONLY; image 2 = exact companion design ONLY; image 3, when attached = recurring PROP design board ONLY. Never copy their pose, expression, composition or blank backdrop. No panels, collage, captions, words or typography.',
    `CHILD: ${childAge}-year-old ${gender}; same face/hair/skin identity. BOOK WARDROBE LOCK: ${plan.wardrobe}`,
    `COMPANION: ${companionDescription}`,
    `VISUAL LANGUAGE: ${plan.visualLanguage}`,
    `LOCATION LOCK: ${plan.locations.find(l => l.id === p.locationId)!.design}`,
    ...(plan.continuity ? [
      `STRUCTURED CONTINUITY (same identity; only source-supported state changes): ${JSON.stringify(previewContinuityContext(plan.continuity, pageNumber))}`,
      ...plan.continuity.pages[pageNumber].visibleLocationIds.filter(id => id !== p.locationId)
        .map(id => `VISIBLE BACKGROUND LOCATION ${id}: ${plan.locations.find(l => l.id === id)!.design}`),
      'Canonical standing-height ratio is independent of posture and perspective. A crouching child does not make the companion grow. Numeric frame occupancy is a drawing target, not text to paint.',
    ] : []),
    `CAMERA: ${p.shot}, ${p.angle}. COMPOSITION: ${p.composition}`,
    `CHILD ACTION: ${p.childAction}. EXPRESSION: ${p.childExpression}. GAZE: ${p.childGaze}.`,
    'The child must be caught in a meaningful action, responding to the situation. Natural childlike asymmetry and weight; never a neutral portrait pasted into scenery. Expressions are transient, not identity. Do not make every page smile.',
    `COMPANION ACTION: ${p.companionAction}. SCENE: ${p.scene}`,
    ...p.props.map(o => `PROP ${o.id}: ${plan.recurringProps.find(r => r.id === o.id)!.design}. THIS MOMENT'S STATE: ${o.state}.`),
    'Only depict the props named for this moment, not every item in the design board. Preserve their structure, scale and design, while applying story changes (cut, opened, tilted, etc.). Draw one coherent moment, not multiple sequential actions. Physical contacts and ground support must be legible.',
    `PAGE TEXT (narrative evidence, not text to paint): ${text}`,
  ].join('\n\n');
}

// Both local renderers consume the same current-page state projection. The full
// story belongs in book planning, not in every image's visual requirements.
export function selectedDraftQaContext(plan: PreviewPlan, pageNumber: number) {
  const page = plan.pages[pageNumber];
  const continuity = previewContinuityContext(plan.continuity!, pageNumber);
  return { scope: 'current_page_effective_state_only', wardrobe: plan.wardrobe, visualLanguage: plan.visualLanguage,
    page, recurringProps: plan.recurringProps.filter(p => page.props.some(active => active.id === p.id)),
    locations: plan.locations.filter(l => continuity.page.visibleLocationIds.includes(l.id)), continuity };
}

export function writePreviewJson(file: string, value: unknown) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}

export function bindPreviewRun(root: string, identity: unknown) {
  fs.mkdirSync(root, { recursive: true });
  const file = path.join(root, 'identity.json');
  const serialized = JSON.stringify(identity);
  if (fs.existsSync(file)) {
    if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== serialized) throw Error('preview_input_changed_new_run_required');
  } else {
    if (fs.readdirSync(root).length) throw Error('preview_root_not_empty');
    writePreviewJson(file, identity);
  }
}

export interface PreviewCheckpoint<T> { fingerprint: string; value: T; usage: Record<string, unknown> | null; }
// Upper-rate estimate, not an invoice: all tokens charged at $30/M, ignoring
// cheaper input/cached rates. Covers this lane's pinned gpt-image-2, gpt-5.4,
// gpt-5.5 and gpt-4o models (official pricing checked 2026-09-15, inputs <272K). Missing usage keeps
// the entire reservation, including errors/unknown outcomes. Never assume free.
export function previewUsageUpperUsd(usage: Record<string, unknown> | null): number | null {
  const input = usage?.input_tokens ?? usage?.prompt_tokens;
  const output = usage?.output_tokens ?? usage?.completion_tokens;
  if (typeof input !== 'number' || typeof output !== 'number' || !Number.isSafeInteger(input) || !Number.isSafeInteger(output) || input < 0 || output < 0 || input + output === 0) return null;
  return (input + output) * 30 / 1_000_000;
}
export function previewAccountedUsd(root: string): number {
  if (!fs.existsSync(root)) return 0;
  return fs.readdirSync(root).filter(n => n.endsWith('.claim.json')).reduce((sum, n) => {
    const claim = JSON.parse(fs.readFileSync(path.join(root, n), 'utf8'));
    if (!Number.isFinite(claim.reserveUsd) || claim.reserveUsd <= 0) throw Error('invalid_reservation_record');
    const resultFile = path.join(root, n.replace('.claim.json', '.result.json'));
    if (!fs.existsSync(resultFile)) return sum + claim.reserveUsd;
    const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    if (result.fingerprint !== claim.fingerprint) throw Error('checkpoint_identity_changed');
    return sum + (previewUsageUpperUsd(result.usage) ?? claim.reserveUsd);
  }, 0);
}
// Claim first, persist result second. A crash between the two is UNKNOWN, never a free retry.
export async function previewCheckpoint<T>(args: {
  root: string; step: string; input: unknown; reserveUsd: number; budgetUsd: number;
  produce: () => Promise<{ value: T; usage?: Record<string, unknown> | null }>;
}): Promise<PreviewCheckpoint<T>> {
  if (!/^[a-z][a-z0-9-]{0,50}$/.test(args.step)) throw Error('invalid_step');
  if (!Number.isFinite(args.reserveUsd) || args.reserveUsd <= 0 || !Number.isFinite(args.budgetUsd) || args.budgetUsd <= 0 || args.budgetUsd > 10) throw Error('invalid_preview_budget');
  const root = path.join(args.root, 'steps');
  fs.mkdirSync(root, { recursive: true });
  const claim = path.join(root, `${args.step}.claim.json`);
  const result = path.join(root, `${args.step}.result.json`);
  const fingerprint = previewSha(JSON.stringify(args.input));
  if (fs.existsSync(result)) {
    const prior = JSON.parse(fs.readFileSync(result, 'utf8')) as PreviewCheckpoint<T>;
    if (!fs.existsSync(claim) || prior.fingerprint !== fingerprint || JSON.parse(fs.readFileSync(claim, 'utf8')).fingerprint !== fingerprint) throw Error('checkpoint_identity_changed');
    const priorReservation = JSON.parse(fs.readFileSync(claim, 'utf8')).reserveUsd;
    if ((previewUsageUpperUsd(prior.usage) ?? priorReservation) > priorReservation + 1e-8) throw Error('preview_usage_exceeded_reservation');
    return prior;
  }
  if (fs.existsSync(claim)) throw Error('paid_step_outcome_unknown_no_automatic_retry');
  // The CLI holds an exclusive run.lock around this whole operation.
  const reserved = previewAccountedUsd(root);
  if (reserved + args.reserveUsd > args.budgetUsd + 1e-8) throw Error('preview_budget_exhausted');
  writePreviewJson(claim, { fingerprint, reserveUsd: args.reserveUsd, at: new Date().toISOString(), invoiceVerified: false });
  const made = await args.produce();
  const record = { fingerprint, value: made.value, usage: made.usage ?? null };
  writePreviewJson(result, record);
  // Preserve known results but halt this run if the observed upper estimate exceeded
  // the admission allowance. This is not an unknown outcome and must never be rebilled.
  if ((previewUsageUpperUsd(record.usage) ?? args.reserveUsd) > args.reserveUsd + 1e-8) throw Error('preview_usage_exceeded_reservation');
  return record;
}

export function previewImageDigest(file: string) {
  const bytes = fs.readFileSync(file);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw Error('preview_image_not_png');
  return previewSha(bytes);
}

export function previewAutomatedPassed(identityStatus: string, visual: {
  clearVisualSafetyIssue?: boolean; sceneMatches?: boolean; recurringPropsConsistent?: boolean;
  childFeelsActive?: boolean; anatomyCoherent?: boolean;
}) {
  return identityStatus === 'passed' && visual.clearVisualSafetyIssue === false &&
    visual.sceneMatches === true && visual.recurringPropsConsistent === true &&
    visual.childFeelsActive === true && visual.anatomyCoherent === true;
}
