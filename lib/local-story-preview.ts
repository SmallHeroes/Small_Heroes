import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parseStoryMarkdown } from './story-validators/parser';
import { STYLE_01_SHARED, STYLE_01_RENDERING_CORRECTION, STYLE_01_CANONICAL_CHILD_ANCHOR_RULE } from './style01-gptimage';

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
}).strict();
export type PreviewPlan = z.infer<typeof previewPlanSchema>;

export function previewStory(raw: string, childName: string, gender: 'boy' | 'girl') {
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
  return { title: personalize(parsed.frontmatter.title), pages, sourceSha: previewSha(raw) };
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
    'Reference roles: image 1 = exact child identity and watercolor technique ONLY; image 2 = exact companion design ONLY; image 3, when attached = recurring PROP design board ONLY. Never copy their pose, expression, composition or blank backdrop. No panels, collage, captions, words or typography.',
    `CHILD: ${childAge}-year-old ${gender}; same face/hair/skin identity. BOOK WARDROBE LOCK: ${plan.wardrobe}`,
    `COMPANION: ${companionDescription}`,
    `VISUAL LANGUAGE: ${plan.visualLanguage}`,
    `LOCATION LOCK: ${plan.locations.find(l => l.id === p.locationId)!.design}`,
    `CAMERA: ${p.shot}, ${p.angle}. COMPOSITION: ${p.composition}`,
    `CHILD ACTION: ${p.childAction}. EXPRESSION: ${p.childExpression}. GAZE: ${p.childGaze}.`,
    'The child must be caught in a meaningful action, responding to the situation. Natural childlike asymmetry and weight; never a neutral portrait pasted into scenery. Expressions are transient, not identity. Do not make every page smile.',
    `COMPANION ACTION: ${p.companionAction}. SCENE: ${p.scene}`,
    ...p.props.map(o => `PROP ${o.id}: ${plan.recurringProps.find(r => r.id === o.id)!.design}. THIS MOMENT'S STATE: ${o.state}.`),
    'Only depict the props named for this moment, not every item in the design board. Preserve their structure, scale and design, while applying story changes (cut, opened, tilted, etc.). Draw one coherent moment, not multiple sequential actions. Physical contacts and ground support must be legible.',
    `PAGE TEXT (narrative evidence, not text to paint): ${text}`,
  ].join('\n\n');
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
    return prior;
  }
  if (fs.existsSync(claim)) throw Error('paid_step_outcome_unknown_no_automatic_retry');
  // The CLI holds an exclusive run.lock around this whole operation.
  const reserved = fs.readdirSync(root).filter(n => n.endsWith('.claim.json')).reduce((sum, n) => {
    const v = JSON.parse(fs.readFileSync(path.join(root, n), 'utf8')).reserveUsd;
    if (!Number.isFinite(v) || v <= 0) throw Error('invalid_reservation_record');
    return sum + v;
  }, 0);
  if (reserved + args.reserveUsd > args.budgetUsd + 1e-8) throw Error('preview_budget_exhausted');
  writePreviewJson(claim, { fingerprint, reserveUsd: args.reserveUsd, at: new Date().toISOString(), invoiceVerified: false });
  const made = await args.produce();
  const record = { fingerprint, value: made.value, usage: made.usage ?? null };
  writePreviewJson(result, record);
  return record;
}

export function previewImageDigest(file: string) {
  const bytes = fs.readFileSync(file);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw Error('preview_image_not_png');
  return previewSha(bytes);
}
