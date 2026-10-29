/**
 * The metered companion sheet operator (CS-1, 2026-10-28; plan Codex-passed, S1 cap approved by Guy).
 *
 * A new companion's style01 sheet set is made from its OWNER-APPROVED front, never from the legacy generator (hidden retries, fail-open QA,
 * a pixel "resemblance" that cannot tell characters apart). Every provider call is a once-only claim of one AuditionMeter under a consumed
 * grant: the live coordination guard and cancellation are checked before each claim, again inside it right before the key and the provider,
 * and again when the call returns; the key is read only inside a claimed call, there is no retry, and an unknown cost or outcome stops
 * everything. Every image is held as exact bytes: what is sent, judged and published is those bytes, never a later re-read of a path.
 *
 * - The approved front IS the sheet front (exact bytes) and is never redrawn. The approved three-quarter, when supplied, is offered too.
 * - The other views are LOW renders from that front, each with exactly one reference.
 * - One Sol review judges the whole set (front included). A view passes only when every check passes. One bounded redraw round
 *   (at most the grant's redraws in total, then one re-review); a held front, too many held views, or a view still held → the companion
 *   stays pending, honestly. A timeout, an invalid answer or an unknown cost is a stop, never a redraw and never a pass.
 * - A new companion without any approved look gets concept fronts (technique-only references) for Guy to choose from; no review.
 * - Output stays in the grant's own folder. Nothing is written to public/; admission is a separate reviewed change.
 * - CSR-1 (2026-10-28): every angle is drawn and judged under its VIEW CONTRACT (companion-sheet-view-contract.ts), derived from the
 *   companion's own grounded sheetGeometry: one fixed near side, where each accessory shows or hides, what a rear view hides, exact
 *   counts. The prompt is companion-only (no child rendering block, no page negative). Wires and reviews are v2; only v2 is priced.
 * - A REPAIR grant (runCompanionSheetRepair) redraws ONLY the views a prior PASS-reviewed outcome held, keeps the views that passed
 *   there as their exact judged bytes, and makes one six-view review: pass, or pending. Never a second redraw.
 *
 * Run: in ONE process, register the server-only shim and tsx, then call companionSheetsMain, e.g.
 *   node -e "require('./scripts/shims/register-server-only.cjs');require('./node_modules/tsx/dist/cjs/index.cjs');
 *     require('./scripts/personal-companion-sheets.ts').companionSheetsMain(['--grant','<abs>','--key-env-file','<abs>'])"
 * (the tsx CLI starts a child process, which would not inherit a parent --require).
 */
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { generateGPTImage, planGPTImageRequest } from '../lib/generate-image';
import { buildCompanionAccessoryLockBlock } from '../lib/companion-accessory';
import { style01SheetBlocks } from '../lib/generation-pipeline/companion-character-sheet';
import { COMPANION_SHEET_NEGATIVE, COMPANION_SHEET_VIEW_FILENAME, COMPANION_SHEET_VIEW_KINDS, COMPANION_SHEET_VIEW_SCENE,
  composeCompanionOnlySheetPrompt, type CompanionSheetViewKind } from '../lib/generation-pipeline/companion-sheet-prompt';
import { assertCompanionSheetGeometryGrounded, COMPANION_SHEET_VIEW_CONTRACT_VERSION, CONTRACT_VIEW_LINE, companionSheetViewContract,
  companionSheetViewContractText } from '../lib/generation-pipeline/companion-sheet-view-contract';
import { getPersonalAddedCompanion, personalCompanionVisual, type CompanionSheetGeometry } from '../lib/personal-wizard/personal-companions';
import { previewSha } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { AuditionMeter, AUDITION_REVIEW_TIMEOUT_MS, digestImages, keyReader, renderMaximum, RENDER_PRICING, REVIEW_MODEL, reviewAnswered,
  reviewCost, reviewTransport, sendReview, type MeterRule, type MeterRules } from './personal-simple-book-reviewed-audition';
import { auditionUsageCost, SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from './personal-simple-book-illustrator';
import { exclusiveJson, realDirectory } from './personal-causal-trial-journal';

export class CompanionSheetError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new CompanionSheetError(code); };

export const COMPANION_SHEET_GRANT_VERSION = 'companion-sheet-grant/v1' as const;
/** The marker every sheet render wire carries; the reader page rule refuses any wire with `sheetView`. */
/** v1 was the consumed S1 run's wire. v2 (CSR-1) is the companion-only path: every angle render carries its view contract. Only v2 is priced. */
export const COMPANION_SHEET_WIRE_VERSION = 'companion-sheet-wire/v1' as const;
export const COMPANION_SHEET_WIRE_VERSION_V2 = 'companion-sheet-wire/v2' as const;
/** v2 = v1's review plus each view's contract in the payload (every v1 check kept; the contract only adds facts). Only v2 is priced. */
export const COMPANION_SHEET_REVIEW_VERSION = 'companion-sheet-review/v1' as const;
export const COMPANION_SHEET_REVIEW_VERSION_V2 = 'companion-sheet-review/v2' as const;
export const COMPANION_SHEET_LEDGER = 'companion-sheets-20261028' as const;
export const COMPANION_SHEETS_REGISTRY_KEY = 'companionSheets20261028' as const;
export const COMPANION_SHEETS_EXECUTING_PHASE = 'COMPANION_SHEETS_S1_EXECUTING' as const;
export const COMPANION_SHEETS_EXECUTOR = 'Claude desktop af9211ff COMPANION-SHEETS executor' as const;
/** Guy, 2026-10-28: S1 only, $2.50, at most 12 calls. S2 is not approved, so no other stage exists here. */
export const S1_OWNER_LIMITS = Object.freeze({ capMicroUsd: 2_500_000, maxCalls: 12, maxRedrawsPerCompanion: 2 });
/**
 * Guy, 2026-10-28 night (OWNER-AUTHORIZATION.txt, recorded by Codex): ONE prospective repair of a pending set's held views + one
 * six-view review, at most 3 calls and $1.50, inside the unused S1 cap (S1's known spend + the repair cap stays within $2.50).
 */
export const REPAIR_OWNER_LIMITS = Object.freeze({ capMicroUsd: 1_500_000, maxCalls: 3, cumulativeCapMicroUsd: 2_500_000 });
/** A live lease: the registry key, phase and executor a paid run must find, now. */
export type CompanionSheetLease = { key: string; phase: string; executor: string };
export const S1_LEASE: CompanionSheetLease = Object.freeze({ key: COMPANION_SHEETS_REGISTRY_KEY, phase: COMPANION_SHEETS_EXECUTING_PHASE,
  executor: COMPANION_SHEETS_EXECUTOR });
export const REPAIR_LEASE: CompanionSheetLease = Object.freeze({ key: 'companionSheetRepair20261028', phase: 'COMPANION_SHEET_REPAIR_R1_EXECUTING',
  executor: 'Claude desktop af9211ff COMPANION-SHEET-REPAIR executor' });
const SHEET_SIZE = '1024x1536' as const, IMAGE_DEADLINE_MS = 180000, REVIEW_OUTPUT_CAP = 12000, OUTPUT_RESERVATION_TOKENS = 8192;
/** The views a render can make: never the front (the approved front is the sheet front). */
export const RENDERED_SHEET_VIEWS = ['three_quarter_front', 'side', 'three_quarter_back', 'happy', 'theme'] as const;
type RenderedView = typeof RENDERED_SHEET_VIEWS[number];
/** Every file whose bytes decide what this operator sends; a grant pins exactly these. */
export const COMPANION_SHEET_SOURCE_FILES = Object.freeze(['scripts/personal-companion-sheets.ts', 'lib/generation-pipeline/companion-sheet-prompt.ts',
  'lib/generation-pipeline/companion-sheet-view-contract.ts', 'lib/generation-pipeline/companion-character-sheet.ts', 'lib/personal-wizard/personal-companions.ts', 'lib/companion-accessory.ts',
  'scripts/personal-simple-book-reviewed-audition.ts', 'scripts/personal-simple-book-illustrator.ts', 'lib/generate-image.ts', 'lib/style01-gptimage.ts',
  'lib/style01-prompt-core.ts']);

// ---------------------------------------------------------------------------------------------------------------
// Meter rules: a sheet render and a sheet review each have their own; neither prices a reader page.
// ---------------------------------------------------------------------------------------------------------------
export const companionSheetRenderRule: MeterRule = {
  reserve: w => w?.body?.model === 'gpt-image-2' && w.body.quality === 'low' && w.body.size === SHEET_SIZE && w.body.n === 1 &&
    w.readerFraming === undefined && (w.sheetPlan === COMPANION_SHEET_WIRE_VERSION_V2 && (w.sheetView === 'concept_front' ? w.sheetContract === null
        : w.sheetContract?.version === COMPANION_SHEET_VIEW_CONTRACT_VERSION && w.sheetContract.view === w.sheetView && typeof w.sheetContract.sha256 === 'string')) &&
    ((RENDERED_SHEET_VIEWS as readonly string[]).includes(w.sheetView) && w.mode === 'images.edit' && w.references?.length === 1 ||
      w.sheetView === 'concept_front' && w.mode === 'images.edit' && w.references?.length === 2) &&
    typeof w.body.prompt === 'string' && w.retries === 0 && w.deadlineMs === IMAGE_DEADLINE_MS && w.pricing === RENDER_PRICING &&
    w.outputReservationTokens === OUTPUT_RESERVATION_TOKENS ? renderMaximum(w.body.prompt, w.references.length) : null,
  settle: (_w, receipt, completed) => ({ estimatedMicroUsd: auditionUsageCost(receipt?.raw?.usage, 'image'), coherent: !completed || receipt?.model === 'gpt-image-2' }),
};
export const companionSheetReviewRule: MeterRule = {
  reserve: w => w?.model === REVIEW_MODEL && w.service_tier === 'default' && w.store === false && w.max_output_tokens === REVIEW_OUTPUT_CAP &&
    w.metadata?.companion_sheet_review === COMPANION_SHEET_REVIEW_VERSION_V2 ? SOL_PIXEL_REVIEW_SLOT_MICRO_USD : null,
  settle: (_w, receipt, completed) => { const raw = receipt?.raw;
    return { estimatedMicroUsd: raw == null ? null : reviewCost(raw), coherent: !completed || raw != null && reviewAnswered(raw, REVIEW_OUTPUT_CAP) }; },
};
const ID = '[a-z][a-z0-9_]{1,40}';
export const companionSheetMeterRules: MeterRules = step =>
  new RegExp(`^sheet_${ID}_review_[12]$`).test(step) || new RegExp(`^repair_${ID}_review$`).test(step) ? companionSheetReviewRule
    : new RegExp(`^sheet_${ID}_(${RENDERED_SHEET_VIEWS.join('|')})_[12]$`).test(step) || new RegExp(`^concept_${ID}_[ab]$`).test(step) ||
      new RegExp(`^repair_${ID}_(${RENDERED_SHEET_VIEWS.join('|')})$`).test(step) ? companionSheetRenderRule : undefined;

// ---------------------------------------------------------------------------------------------------------------
// Grant: one stage, exact inputs, consumed once.
// ---------------------------------------------------------------------------------------------------------------
const sha = z.string().regex(/^[0-9a-f]{64}$/);
const pinned = z.object({ file: z.string().min(3), sha256: sha }).strict();
const companionId = z.string().regex(new RegExp(`^${ID}$`));
export const companionSheetGrantSchema = z.object({
  version: z.literal(COMPANION_SHEET_GRANT_VERSION),
  stage: z.literal('S1'),
  ledger: z.object({ name: z.literal(COMPANION_SHEET_LEDGER), priorKnownApiMicroUsd: z.literal(0) }).strict(),
  capMicroUsd: z.number().int().positive().max(S1_OWNER_LIMITS.capMicroUsd),
  maxCalls: z.number().int().positive().max(S1_OWNER_LIMITS.maxCalls),
  out: z.string().min(3),
  registry: z.string().min(3),
  lineage: z.object({ plan: pinned, planQa: pinned, descriptions: pinned, approvedIndex: pinned, ownerLooks: pinned, ownerCap: pinned }).strict(),
  source: z.object({ root: z.string().min(3), commit: z.string().regex(/^[0-9a-f]{40}$/), files: z.record(z.string(), sha) }).strict(),
  sheets: z.array(z.object({ companionId, descriptionSha256: sha, body: z.record(z.string(), z.unknown()), front: pinned, threeQuarter: pinned.nullable(),
    generate: z.array(z.enum(RENDERED_SHEET_VIEWS)).min(1).max(5), maxRedraws: z.number().int().min(0).max(S1_OWNER_LIMITS.maxRedrawsPerCompanion) }).strict()).max(1),
  concepts: z.array(z.object({ companionId, brief: z.string().min(40).max(1200),
    variants: z.array(z.object({ variant: z.enum(['a', 'b']), stance: z.string().min(10).max(300) }).strict()).length(2),
    techniqueRefs: z.array(pinned).length(2) }).strict()).max(2),
}).strict();
export type CompanionSheetGrant = z.infer<typeof companionSheetGrantSchema>;

const shaFile = (file: string) => previewSha(readFileSync(file));
const plainFile = (file: string) => {
  if (!path.isAbsolute(file) || !existsSync(file)) fail('companion_sheet_input_missing');
  const stat = lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20_000_000) fail('companion_sheet_input_file');
  return file;
};
const pinnedBytes = (p: { file: string; sha256: string }) => { const bytes = readFileSync(plainFile(p.file)); if (previewSha(bytes) !== p.sha256) fail('companion_sheet_input_changed'); return bytes; };
/** The worst-case calls a grant can make: every render, review, redraw and re-review it allows. */
export const grantWorstCaseCalls = (g: Pick<CompanionSheetGrant, 'sheets' | 'concepts'>) =>
  g.sheets.reduce((n, s) => n + s.generate.length + 1 + s.maxRedraws + (s.maxRedraws > 0 ? 1 : 0), 0) + g.concepts.length * 2;

/**
 * Everything a grant names, checked before anything is written or claimed (no key read): the exact source bytes and commit, the reviewed
 * plan, its QA, the descriptions draft, the approved-look index and both owner approvals; each companion's declared appearance and body
 * exactly as the reviewed draft states them; each approved front and three-quarter as indexed; the concept briefs and stances as drafted;
 * and a call ceiling equal to the grant's worst case.
 */
export function admitCompanionSheetGrant(file: string) {
  const text = readFileSync(plainFile(file), 'utf8'), grantSha256 = previewSha(Buffer.from(text, 'utf8'));
  const grant = companionSheetGrantSchema.parse(JSON.parse(text));
  if (!path.isAbsolute(grant.out) || existsSync(grant.out) || !existsSync(path.dirname(grant.out))) fail('companion_sheet_out');
  if (!path.isAbsolute(grant.source.root)) fail('companion_sheet_source');
  const files = Object.keys(grant.source.files);
  if (files.length !== COMPANION_SHEET_SOURCE_FILES.length || COMPANION_SHEET_SOURCE_FILES.some(f => !files.includes(f)) ||
      files.some(f => shaFile(plainFile(path.join(grant.source.root, f))) !== grant.source.files[f])) fail('companion_sheet_source');
  const head = execFileSync('git', ['-C', grant.source.root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== grant.source.commit) fail('companion_sheet_source');
  for (const p of Object.values(grant.lineage)) pinnedBytes(p);
  const draft = JSON.parse(readFileSync(grant.lineage.descriptions.file, 'utf8')), index = JSON.parse(readFileSync(grant.lineage.approvedIndex.file, 'utf8'));
  const indexed = (id: string, p: { file: string; sha256: string }) => Array.isArray(index) && index.some((row: { id?: string; sha256?: string; file?: string }) =>
    row.id === id && row.sha256 === p.sha256 && typeof row.file === 'string' && path.basename(row.file) === path.basename(p.file));
  const ids = [...grant.sheets.map(s => s.companionId), ...grant.concepts.map(c => c.companionId)];
  if (new Set(ids).size !== ids.length || !ids.length) fail('companion_sheet_scope');
  for (const s of grant.sheets) {
    const visual = personalCompanionVisual(s.companionId);
    // Only an added companion: the six already have sheets; an alias of a legacy id is refused.
    if (!getPersonalAddedCompanion(s.companionId) || !visual?.description.trim() || visual.source !== 'lib/personal-wizard/personal-companions.ts') fail('companion_sheet_companion');
    const drafted = draft?.companions?.[s.companionId];
    if (drafted?.visualDescription !== visual!.description || previewSha(Buffer.from(visual!.description, 'utf8')) !== s.descriptionSha256 ||
        canonicalJson(drafted.body) !== canonicalJson(s.body)) fail('companion_sheet_description');
    if (!bodyAgrees(s.body, companionSheetGeometry(s.companionId, visual!.description))) fail('companion_sheet_geometry');
    if (!indexed(s.companionId, s.front) || path.basename(s.front.file) !== 'front-candidate.png') fail('companion_sheet_front');
    if (s.threeQuarter && !indexed(s.companionId, s.threeQuarter)) fail('companion_sheet_three_quarter');
    const views = [...(s.threeQuarter ? ['three_quarter_front'] : []), ...s.generate].sort();
    if (canonicalJson(views) !== canonicalJson([...RENDERED_SHEET_VIEWS].sort())) fail('companion_sheet_views');
    pinnedBytes(s.front); if (s.threeQuarter) pinnedBytes(s.threeQuarter);
  }
  for (const c of grant.concepts) {
    const added = getPersonalAddedCompanion(c.companionId), drafted = draft?.conceptBriefs?.[c.companionId];
    if (!added || added.image !== null || added.visualDescription !== null) fail('companion_sheet_concept');
    if (drafted?.brief !== c.brief || c.variants.map(v => v.variant).join() !== 'a,b' ||
        c.variants.some(v => drafted?.variants?.[v.variant.toUpperCase()] !== v.stance)) fail('companion_sheet_concept');
    c.techniqueRefs.forEach(pinnedBytes);
  }
  if (grantWorstCaseCalls(grant) !== grant.maxCalls) fail('companion_sheet_calls');
  return { grant, grantSha256, text };
}

// ---------------------------------------------------------------------------------------------------------------
// Prompts, wires and the review.
// ---------------------------------------------------------------------------------------------------------------
/** One render's exact dry plan: prompt, provider input and wire (no key, no I/O beyond the caller's reference files). */
export function companionSheetRenderPlan(args: { companionId: string; view: RenderedView | 'concept_front'; references: string[];
  visualLock: string; stance?: string; geometry?: CompanionSheetGeometry | null; signal?: AbortSignal }) {
  const concept = args.view === 'concept_front';
  // An angle is drawn only under its view contract, from the companion's own grounded geometry; a concept front has no look yet.
  if (!concept && !args.geometry) fail('companion_sheet_geometry');
  if (concept && args.geometry) fail('companion_sheet_geometry');
  const contract = concept ? null : companionSheetViewContract(args.geometry!, args.view as CompanionSheetViewKind);
  const prompt = composeCompanionOnlySheetPrompt({ mode: concept ? 'concept_front_technique_refs' : 'angle_variant_contract',
    viewLine: concept ? `${COMPANION_SHEET_VIEW_SCENE.front} Stance: ${args.stance}.` : CONTRACT_VIEW_LINE[args.view as CompanionSheetViewKind],
    contract: contract ? companionSheetViewContractText(contract) : undefined,
    visualLock: args.visualLock,
    accessoryLock: buildCompanionAccessoryLockBlock({ companionId: args.companionId, companionPresence: 'present', context: 'character_sheet' }),
    style: style01SheetBlocks() });
  const input = { finalPrompt: prompt, negativePrompt: COMPANION_SHEET_NEGATIVE, referenceImages: args.references,
    referenceMode: concept ? 'style' as const : 'anchor_companion_from_sheet_view' as const, requireReferenceEdit: true, quality: 'low' as const,
    size: SHEET_SIZE, modelOverride: 'gpt-image-2', signal: args.signal, requestTimeoutMs: IMAGE_DEADLINE_MS };
  const plan = planGPTImageRequest(input, { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
  if (plan.referenceCountPassed !== args.references.length || plan.apiMode !== 'images.edit') fail('companion_sheet_reference_plan');
  const wire = { body: plan.bodyWithoutBinaryImage, mode: plan.apiMode, references: args.references.map(r => ({ imageName: path.basename(r), imageSha: shaFile(r) })),
    sheetPlan: COMPANION_SHEET_WIRE_VERSION_V2, sheetView: args.view,
    sheetContract: contract ? { version: contract.version, view: contract.view, sha256: previewSha(Buffer.from(canonicalJson(contract), 'utf8')) } : null,
    retries: 0, deadlineMs: IMAGE_DEADLINE_MS, pricing: RENDER_PRICING, outputReservationTokens: OUTPUT_RESERVATION_TOKENS };
  return { input, wire, contract, maximumMicroUsd: renderMaximum(plan.finalPrompt, args.references.length) };
}

/** The geometry a sheet path draws from: the added companion's own, grounded in its own description (refused otherwise). */
export function companionSheetGeometry(companionId: string, description: string): CompanionSheetGeometry {
  const g = getPersonalAddedCompanion(companionId)?.sheetGeometry ?? fail('companion_sheet_geometry');
  try { assertCompanionSheetGeometryGrounded(description, g); } catch { fail('companion_sheet_geometry'); }
  return g;
}

const verdictSchema = z.object({ view: z.enum(COMPANION_SHEET_VIEW_KINDS as [CompanionSheetViewKind, ...CompanionSheetViewKind[]]),
  correctAngle: z.boolean(), sameCharacterAsFront: z.boolean(), anatomyConsistent: z.boolean(), accessoryConsistent: z.boolean(),
  paletteConsistent: z.boolean(), styleMatchesFront: z.boolean(), isolatedOnPlainBackground: z.boolean(), noTextNoExtraFigures: z.boolean(),
  verdict: z.enum(['pass', 'hold']), reason: z.string().trim().min(1).max(500) }).strict();
export const companionSheetReviewSchema = z.object({ views: z.array(verdictSchema).length(6), notes: z.string().max(800) }).strict();
export type CompanionSheetReview = z.infer<typeof companionSheetReviewSchema>;
const CHECKS = ['correctAngle', 'sameCharacterAsFront', 'anatomyConsistent', 'accessoryConsistent', 'paletteConsistent', 'styleMatchesFront',
  'isolatedOnPlainBackground', 'noTextNoExtraFigures'] as const;

export const COMPANION_SHEET_REVIEW_INSTRUCTIONS = [
  'You are the strict, independent reviewer of ONE children\'s-picture-book companion character sheet.',
  'Image 1 is the APPROVED FRONT: it is the identity authority. The other images are the other sheet views, in the order the JSON lists them.',
  'Judge EVERY listed view, the front included, and return exactly one verdict per view.',
  'correctAngle: front faces the viewer; three_quarter_front is turned about 30 degrees so both eyes and the snout, beak or muzzle read; side is a clean lateral profile; three_quarter_back mostly shows the back with at most a hint of cheek or eye; happy is clearly happy; theme shows one gentle calm mood. Each is a full-body view.',
  'sameCharacterAsFront: same species, proportions, colours, markings, face and eyes as Image 1; only the angle or expression changes.',
  'anatomyConsistent: compare with declaredBody and Image 1. Count only what THIS angle can show: a leg, paw, ear, eye, tail or accessory that this angle naturally hides is NOT missing. An extra, duplicated, merged, misplaced or impossible part IS a hold.',
  'accessoryConsistent: exactly the declared accessories, each in its declared place and side, and no new clothing or object.',
  'paletteConsistent: the same muted soft colours as Image 1, not brighter, darker or shifted.',
  'styleMatchesFront: the same paper, linework, soft watercolour and coloured-pencil rendering and eye style as Image 1.',
  'isolatedOnPlainBackground: one full-body figure on plain warm cream paper, no scene, ground props or panels.',
  'noTextNoExtraFigures: no text, letters, labels or arrows, and no child, human or other creature.',
  'verdict is pass only when every check is true; otherwise hold. reason: one short sentence naming the defect, or "ok".',
].join('\n');
/** v2: every v1 line, plus the view contracts (they only add facts; no v1 check is relaxed). */
export const COMPANION_SHEET_REVIEW_INSTRUCTIONS_V2 = [
  COMPANION_SHEET_REVIEW_INSTRUCTIONS,
  'Each image entry also carries its viewContract: which way the companion faces, its near side (sides are the companion\'s OWN left and right), what this angle shows and hides, where each accessory sits, and the exact counts. correctAngle, anatomyConsistent and accessoryConsistent are true only when the view ALSO matches its viewContract; a contract never excuses a defect the checks above name.',
].join('\n');

export async function companionSheetReviewPayload(args: { companionId: string; description: string; body: unknown; geometry: CompanionSheetGeometry;
  images: { view: CompanionSheetViewKind; provenance: 'owner_approved_candidate' | 'generated'; bytes: Buffer }[] }) {
  if (args.images.length !== 6 || args.images[0].view !== 'front' || new Set(args.images.map(i => i.view)).size !== 6) fail('companion_sheet_review_input');
  for (const i of args.images) { const m = await sharp(i.bytes).metadata(); if (m.format !== 'png' || m.width !== 1024 || m.height !== 1536) fail('companion_sheet_review_input'); }
  const text = JSON.stringify({ companionId: args.companionId, declaredAppearance: args.description, declaredBody: args.body,
    images: args.images.map((i, n) => ({ image: n + 1, view: i.view, provenance: i.provenance, sha256: previewSha(i.bytes),
      viewContract: companionSheetViewContract(args.geometry, i.view) })) });
  return { model: REVIEW_MODEL, store: false, service_tier: 'default' as const, reasoning: { effort: 'medium' as const },
    instructions: COMPANION_SHEET_REVIEW_INSTRUCTIONS_V2,
    input: [{ role: 'user' as const, content: [{ type: 'input_text' as const, text },
      ...args.images.map(i => ({ type: 'input_image' as const, image_url: `data:image/png;base64,${i.bytes.toString('base64')}`, detail: 'high' as const }))] }],
    metadata: { companion_sheet_review: COMPANION_SHEET_REVIEW_VERSION_V2 }, max_output_tokens: REVIEW_OUTPUT_CAP,
    text: { format: zodTextFormat(companionSheetReviewSchema, 'companion_sheet_review_v2') } };
}

/** A review is usable only when it judges each of the six views exactly once. */
export function parseCompanionSheetReview(outputText: string): CompanionSheetReview {
  const review = companionSheetReviewSchema.parse(JSON.parse(outputText));
  if (canonicalJson(review.views.map(v => v.view).sort()) !== canonicalJson([...COMPANION_SHEET_VIEW_KINDS].sort())) fail('companion_sheet_review_views');
  return review;
}
/** A view passes only when the reviewer says pass AND every check is true; anything else is held. */
export const viewPasses = (v: CompanionSheetReview['views'][number]) => v.verdict === 'pass' && CHECKS.every(c => v[c] === true);

/**
 * What a set's review decides. The front is immutable: a held front leaves the set pending. A second round never redraws. More held
 * views than redraws left leaves it pending (no partial attempt); otherwise exactly the held views are redrawn once.
 */
export function companionSheetDisposition(review: CompanionSheetReview, round: 1 | 2, redrawsLeft: number):
  { status: 'passed' } | { status: 'pending'; reason: 'front_held' | 'held_after_redraw' | 'too_many_held' } | { status: 'redraw'; views: RenderedView[] } {
  const held = review.views.filter(v => !viewPasses(v)).map(v => v.view);
  if (!held.length) return { status: 'passed' };
  if (held.includes('front')) return { status: 'pending', reason: 'front_held' };
  if (round === 2) return { status: 'pending', reason: 'held_after_redraw' };
  if (held.length > redrawsLeft) return { status: 'pending', reason: 'too_many_held' };
  return { status: 'redraw', views: RENDERED_SHEET_VIEWS.filter(v => held.includes(v)) };
}

// ---------------------------------------------------------------------------------------------------------------
// The run.
// ---------------------------------------------------------------------------------------------------------------
type Generated = Awaited<ReturnType<typeof generateGPTImage>>;
/** Provider seams (tests only pass fakes; the CLI never does). */
export type CompanionSheetProviders = { generate: typeof generateGPTImage; review: (payload: unknown, opts: { apiKey: string; signal: AbortSignal;
  deadlineMs: number; baseURL: string; transport: ReturnType<typeof reviewTransport> }) => Promise<any> };
const PROVIDERS: CompanionSheetProviders = { generate: generateGPTImage,
  review: (payload, opts) => sendReview(payload as Parameters<typeof sendReview>[0], opts) };

/** The live lease: this exact grant is the one the coordination registry is executing, now, under the stated lease (S1 or repair). */
export function companionSheetGuard(registry: string, grantSha256: string, lease: CompanionSheetLease = S1_LEASE) {
  return () => {
    const s = JSON.parse(readFileSync(registry, 'utf8'));
    if (s.phase !== lease.phase || s.coordination?.activeWriter !== lease.executor || s.coordination?.activeQA ||
        s[lease.key]?.executeGrantSha256 !== grantSha256) fail('companion_sheet_lease');
  };
}

/** An image a run holds: its working copy, and the exact bytes (and their hash) that are sent, judged and published. */
type Held = { file: string; bytes: Buffer; sha256: string };
type View = Held & { provenance: 'owner_approved_candidate' | 'generated' };
type SheetEntry = { companionId: string; status: string; reason?: string;
  views: Record<string, { image: string; provenance: string; sha256: string; verdict?: unknown }>; reviews: string[] };

/**
 * One paid run's folder, meter and fenced calls (S1 and the repair share them). Consumed once: the grant's own folder is created
 * exclusively, so a second run of the same grant refuses here. The full fence (cancellation and the live lease) runs before each claim,
 * again inside the claim right before the key and the provider (the lease may be revoked after the claim is written), and again after
 * the call returns, before anything uses its result.
 */
function openSheetRun(args: { out: string; registry: string; lease: CompanionSheetLease; grantFile: string; grantSha256: string; grantText: string;
  capMicroUsd: number; maxCalls: number; keyFile: string; signal: AbortSignal; providers: CompanionSheetProviders }) {
  const providers = args.providers, guard = companionSheetGuard(args.registry, args.grantSha256, args.lease);
  guard();
  mkdirSync(args.out); realDirectory(args.out);
  const at = (...p: string[]) => path.join(args.out, ...p), art = at('illustrations');
  exclusiveJson(at('consumed.json'), { grantFile: args.grantFile, grantSha256: args.grantSha256, at: new Date().toISOString() });
  writeFileSync(at('grant.json'), args.grantText, { flag: 'wx' }); // the admitted bytes, never a later re-read of the path
  mkdirSync(art);
  const meter = new AuditionMeter(at('paid'), args.capMicroUsd, args.maxCalls, 0, 0, companionSheetMeterRules);
  const key = keyReader(args.keyFile);
  const cancelled = () => { if (args.signal.aborted) fail('companion_sheet_cancelled'); };
  const check = () => { cancelled(); guard(); };
  const write = (name: string, bytes: Buffer, dir = art) => {
    if (!/^[a-z0-9_-]+\.png$/.test(name)) fail('companion_sheet_image_path');
    const fd = openSync(path.join(dir, name), 'wx'); try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
    return path.join(dir, name);
  };
  const held = (name: string, bytes: Buffer): Held => { const own = Buffer.from(bytes); return { file: write(name, own), bytes: own, sha256: previewSha(own) }; };

  const render = async (step: string, plan: ReturnType<typeof companionSheetRenderPlan>, references: Held[]): Promise<Held> => {
    check();
    // The claimed request names its references by hash; it must name exactly the bytes that are sent.
    if (plan.wire.references.length !== references.length || plan.wire.references.some((r, i) => r.imageSha !== references[i].sha256 ||
        previewSha(references[i].bytes) !== references[i].sha256)) fail('companion_sheet_reference_changed');
    const made = await meter.run(step, plan.wire, plan.maximumMicroUsd, async () => {
      check();
      let raw: unknown = null, generated: Generated;
      try {
        generated = await providers.generate({ ...plan.input, apiKey: key(), exactReferenceBytes: references.map(r => r.bytes), observeProviderResponse: r => { raw = r; } });
      } catch (error) {
        const usage = raw && typeof raw === 'object' && 'usage' in raw ? (raw as { usage: unknown }).usage : null;
        throw Object.assign(new CompanionSheetError('companion_sheet_image_provider_failed'), { cause: error,
          receipt: { raw: digestImages(raw), estimatedMicroUsd: auditionUsageCost(usage, 'image') } });
      }
      const cost = auditionUsageCost(generated.usage, 'image'), receipt = { raw: digestImages(raw), estimatedMicroUsd: cost, model: generated.model };
      if (generated.model !== 'gpt-image-2' || generated.fallbackUsed) throw Object.assign(new CompanionSheetError('companion_sheet_image_model'), { receipt });
      const m = await sharp(generated.buffer).metadata();
      if (m.format !== 'png' || m.width !== 1024 || m.height !== 1536) throw Object.assign(new CompanionSheetError('companion_sheet_image_dimensions'), { receipt });
      const candidate = held(`${step}.png`, generated.buffer);
      return { value: candidate, estimatedMicroUsd: cost, receipt: { ...receipt, candidate: { imageName: path.basename(candidate.file), imageSha: candidate.sha256 } } };
    });
    check(); // the call is recorded as it happened (receipt, cost); nothing continues from it once the lease is gone
    return made;
  };

  const review = async (step: string, payload: Awaited<ReturnType<typeof companionSheetReviewPayload>>) => {
    check();
    const transport = reviewTransport(AUDITION_REVIEW_TIMEOUT_MS); // made before the claim: unavailable refuses with nothing claimed
    try {
      const judged = await meter.run(step, digestImages(payload), SOL_PIXEL_REVIEW_SLOT_MICRO_USD, async () => {
        check();
        const raw = await providers.review(payload, { apiKey: key(), signal: args.signal, deadlineMs: AUDITION_REVIEW_TIMEOUT_MS,
          baseURL: 'https://api.openai.com/v1', transport });
        const estimatedMicroUsd = reviewCost(raw), receipt = { raw, estimatedMicroUsd };
        if (!reviewAnswered(raw, REVIEW_OUTPUT_CAP)) throw Object.assign(new CompanionSheetError('companion_sheet_review_invalid'), { receipt });
        try { return { value: parseCompanionSheetReview(raw.output_text), estimatedMicroUsd, receipt }; }
        catch { throw Object.assign(new CompanionSheetError('companion_sheet_review_schema'), { receipt }); }
      });
      check(); // recorded as it happened; no verdict is used once the lease is gone
      return judged;
    } finally { await transport.release(); }
  };

  /**
   * The set, exactly as the passing review judged it, in the shape companionIdentityReference reads. Not public/: admission is separate.
   * Every byte is checked before anything is written: the held bytes are still the judged ones, the front is still the granted front, and
   * no working copy has drifted (the contact sheet shows those copies). A drift stops with nothing published; no call is made for it.
   * The entry becomes "passed" only after the manifest is written.
   */
  const publish = (s: { companionId: string; front: { sha256: string }; descriptionSha256: string }, passed: (View & { view: CompanionSheetViewKind })[],
    entry: SheetEntry) => {
    check();
    if (passed.some(i => previewSha(i.bytes) !== i.sha256 || shaFile(i.file) !== i.sha256)) fail('companion_sheet_reviewed_bytes_changed');
    if (passed[0].view !== 'front' || passed[0].sha256 !== s.front.sha256) fail('companion_sheet_front_changed');
    const dir = at('sheets', s.companionId, 'style01-sheets'); mkdirSync(dir, { recursive: true });
    const views: Record<string, unknown> = {};
    for (const i of passed) {
      const published = write(COMPANION_SHEET_VIEW_FILENAME[i.view], i.bytes, dir);
      if (shaFile(published) !== i.sha256) fail('companion_sheet_reviewed_bytes_changed');
      views[i.view] = { filename: COMPANION_SHEET_VIEW_FILENAME[i.view], qaStatus: 'passed', provenance: i.provenance,
        source: path.basename(i.file), sha256: i.sha256, review: entry.reviews[entry.reviews.length - 1] };
    }
    exclusiveJson(path.join(dir, 'manifest.json'), { companionId: s.companionId, referenceJpg: null, generatedAt: new Date().toISOString(),
      grantSha256: args.grantSha256, descriptionSha256: s.descriptionSha256, views });
    entry.status = 'passed';
  };
  return { at, meter, held, render, review, publish };
}

/** The outcome entry of one judged set: each view's image, provenance, judged hash and verdict. */
function recordVerdicts(entry: SheetEntry, judgedSet: (View & { view: CompanionSheetViewKind })[], judged: CompanionSheetReview) {
  for (const v of judged.views) { const i = judgedSet.find(j => j.view === v.view)!;
    entry.views[v.view] = { image: path.basename(i.file), provenance: i.provenance, sha256: i.sha256, verdict: v }; }
}

export async function runCompanionSheets(args: { grantFile: string; keyFile: string; signal: AbortSignal; providers?: CompanionSheetProviders;
  log?: (line: string) => void }) {
  const log = args.log ?? (() => undefined), providers = args.providers ?? PROVIDERS;
  const { grant, grantSha256, text: grantText } = admitCompanionSheetGrant(args.grantFile);
  const { at, meter, held, render, review, publish } = openSheetRun({ out: grant.out, registry: grant.registry, lease: S1_LEASE, grantFile: args.grantFile,
    grantSha256, grantText, capMicroUsd: grant.capMicroUsd, maxCalls: grant.maxCalls, keyFile: args.keyFile, signal: args.signal, providers });

  const outcome: { concepts: { companionId: string; variant: string; image: string }[]; sheets: SheetEntry[];
    stopped?: { code: string; message: string } } = { concepts: [], sheets: [] };
  try {
    // Concept fronts first: they are independent, and Guy's choice needs them even if a later call stops the run.
    for (const c of grant.concepts) {
      const refs = c.techniqueRefs.map((r, i) => held(`${c.companionId}_technique_${i + 1}.png`, pinnedBytes(r)));
      for (const v of c.variants) {
        const step = `concept_${c.companionId}_${v.variant}`;
        const plan = companionSheetRenderPlan({ companionId: c.companionId, view: 'concept_front', references: refs.map(r => r.file), visualLock: c.brief,
          stance: v.stance, signal: args.signal });
        outcome.concepts.push({ companionId: c.companionId, variant: v.variant, image: path.basename((await render(step, plan, refs)).file) });
        log(`concept ${step}`);
      }
    }
    for (const s of grant.sheets) {
      const visual = personalCompanionVisual(s.companionId)!, geometry = companionSheetGeometry(s.companionId, visual.description);
      const front: View = { ...held(`${s.companionId}_front.png`, pinnedBytes(s.front)), provenance: 'owner_approved_candidate' };
      const current: Partial<Record<CompanionSheetViewKind, View>> = { front };
      if (s.threeQuarter) current.three_quarter_front = { ...held(`${s.companionId}_three_quarter_front_0.png`, pinnedBytes(s.threeQuarter)), provenance: 'owner_approved_candidate' };
      const entry: SheetEntry = { companionId: s.companionId, status: 'running', views: {}, reviews: [] };
      outcome.sheets.push(entry);
      const draw = async (view: RenderedView, n: 1 | 2) => {
        const plan = companionSheetRenderPlan({ companionId: s.companionId, view, references: [front.file], visualLock: visual.description, geometry, signal: args.signal });
        current[view] = { ...await render(`sheet_${s.companionId}_${view}_${n}`, plan, [front]), provenance: 'generated' };
        log(`sheet ${s.companionId} ${view} ${n}`);
      };
      for (const view of s.generate) await draw(view, 1);
      let redrawsLeft = s.maxRedraws, passed: (View & { view: CompanionSheetViewKind })[] | null = null;
      for (const round of [1, 2] as const) {
        // The exact bytes this review judges. A pass publishes these bytes, never whatever a path holds later.
        const judgedSet = COMPANION_SHEET_VIEW_KINDS.map(view => ({ view, ...current[view]! }));
        const payload = await companionSheetReviewPayload({ companionId: s.companionId, description: visual.description, body: s.body, geometry, images: judgedSet });
        const step = `sheet_${s.companionId}_review_${round}`, judged = await review(step, payload);
        entry.reviews.push(step);
        recordVerdicts(entry, judgedSet, judged);
        const decided = companionSheetDisposition(judged, round, redrawsLeft);
        log(`review ${step}: ${decided.status}`);
        if (decided.status === 'passed') { passed = judgedSet; break; }
        if (decided.status === 'pending') { entry.status = 'pending'; entry.reason = decided.reason; break; }
        for (const view of decided.views) { await draw(view, 2); redrawsLeft--; }
      }
      if (passed) publish(s, passed, entry);
    }
  } catch (error) {
    outcome.stopped = { code: (error as { code?: string })?.code ?? 'companion_sheet_stopped', message: String((error as Error)?.message ?? error).slice(0, 300) };
    for (const s of outcome.sheets) if (s.status === 'running') { s.status = 'stopped'; s.reason = outcome.stopped.code; }
  }
  const spend = meter.snapshot();
  exclusiveJson(at('outcome.json'), { version: 'companion-sheet-outcome/v1', grantSha256, ...outcome, spend, finishedAt: new Date().toISOString() });
  writeFileSync(at('contact-sheet.html'), contactSheet(outcome, 'גיליונות חברים מלווים — שלב 1'), { flag: 'wx' });
  return { ...outcome, spend };
}

// ---------------------------------------------------------------------------------------------------------------
// The repair (CSR-1): one prospective redraw of a pending set's held views, and one six-view review. No redraw round after it.
// ---------------------------------------------------------------------------------------------------------------
export const COMPANION_SHEET_REPAIR_GRANT_VERSION = 'companion-sheet-repair-grant/v1' as const;
export const companionSheetRepairGrantSchema = z.object({
  version: z.literal(COMPANION_SHEET_REPAIR_GRANT_VERSION),
  stage: z.literal('R1'),
  ledger: z.object({ name: z.literal(COMPANION_SHEET_LEDGER), priorKnownApiMicroUsd: z.number().int().min(0), priorCalls: z.number().int().min(0) }).strict(),
  capMicroUsd: z.number().int().positive().max(REPAIR_OWNER_LIMITS.capMicroUsd),
  maxCalls: z.number().int().positive().max(REPAIR_OWNER_LIMITS.maxCalls),
  out: z.string().min(3),
  registry: z.string().min(3),
  lineage: z.object({ descriptions: pinned, approvedIndex: pinned, ownerLooks: pinned, ownerAuthorization: pinned, priorGrant: pinned,
    priorOutcome: pinned, priorOutcomeQa: pinned }).strict(),
  source: z.object({ root: z.string().min(3), commit: z.string().regex(/^[0-9a-f]{40}$/), files: z.record(z.string(), sha) }).strict(),
  sheet: z.object({ companionId, descriptionSha256: sha, geometrySha256: sha, body: z.record(z.string(), z.unknown()), front: pinned, threeQuarter: pinned.nullable(),
    retained: z.array(z.object({ view: z.enum(RENDERED_SHEET_VIEWS), image: pinned }).strict()).max(4),
    repair: z.array(z.enum(RENDERED_SHEET_VIEWS)).min(1).max(2) }).strict(),
}).strict();
export type CompanionSheetRepairGrant = z.infer<typeof companionSheetRepairGrantSchema>;

const sourceAdmitted = (source: { root: string; commit: string; files: Record<string, string> }) => {
  if (!path.isAbsolute(source.root)) fail('companion_sheet_source');
  const files = Object.keys(source.files);
  if (files.length !== COMPANION_SHEET_SOURCE_FILES.length || COMPANION_SHEET_SOURCE_FILES.some(f => !files.includes(f)) ||
      files.some(f => shaFile(plainFile(path.join(source.root, f))) !== source.files[f])) fail('companion_sheet_source');
  if (execFileSync('git', ['-C', source.root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== source.commit) fail('companion_sheet_source');
};
/** The canonical hash of a companion's sheet geometry, as a grant pins it. */
export const companionSheetGeometrySha = (g: CompanionSheetGeometry) => previewSha(Buffer.from(canonicalJson(g), 'utf8'));
/** Declared body counts and geometry counts must agree wherever both name the same part. */
const bodyAgrees = (body: Record<string, unknown>, g: CompanionSheetGeometry) =>
  Object.entries(g.counts).every(([part, n]) => !(part in body) || body[part] === n);

/**
 * Everything a repair grant names, checked before anything is written or claimed (no key read):
 * - the exact source, the owner authorization, the descriptions draft and approved-look index;
 * - the PRIOR run: its grant, its outcome (bound to that grant, with known spend only: no unknown or unsettled amount) and that
 *   outcome's PASSing independent QA naming the outcome's hash; the prior spend and calls the ledger carries are the outcome's own;
 * - the cumulative cap: the prior known spend plus this cap stays within the owner's cumulative cap;
 * - the set: the prior outcome left this companion pending. The front and three-quarter front are the approved, indexed bytes.
 *   Each retained view is the EXACT bytes the prior review judged, and that view passed there with every check true. Each repaired
 *   view is one the prior review held. Together they are exactly the six views, each once;
 * - the companion's description, declared body and geometry (grounded in that description; body counts agree);
 * - calls = one render per repaired view + one review (no redraw, no re-review).
 */
export function admitCompanionSheetRepairGrant(file: string) {
  const text = readFileSync(plainFile(file), 'utf8'), grantSha256 = previewSha(Buffer.from(text, 'utf8'));
  const grant = companionSheetRepairGrantSchema.parse(JSON.parse(text));
  if (!path.isAbsolute(grant.out) || existsSync(grant.out) || !existsSync(path.dirname(grant.out))) fail('companion_sheet_out');
  sourceAdmitted(grant.source);
  for (const p of Object.values(grant.lineage)) pinnedBytes(p);
  if (grant.ledger.priorKnownApiMicroUsd + grant.capMicroUsd > REPAIR_OWNER_LIMITS.cumulativeCapMicroUsd) fail('companion_sheet_repair_cap');
  const prior = JSON.parse(readFileSync(grant.lineage.priorOutcome.file, 'utf8')), qa = readFileSync(grant.lineage.priorOutcomeQa.file, 'utf8');
  if (prior?.grantSha256 !== grant.lineage.priorGrant.sha256 || prior?.spend?.unknownCost !== 0 || prior.spend.unknownOutcome !== 0 ||
      prior.spend.reservedUnsettledMicroUsd !== 0 || prior.spend.newKnownApiMicroUsd !== grant.ledger.priorKnownApiMicroUsd ||
      prior.spend.calls !== grant.ledger.priorCalls) fail('companion_sheet_repair_prior');
  if (qa.trimStart().split(/\r?\n/)[0] !== 'DISPOSITION: PASS' || !new RegExp(`^OUTCOME_SHA256: ${grant.lineage.priorOutcome.sha256}\\s*$`, 'm').test(qa))
    fail('companion_sheet_repair_prior');
  const s = grant.sheet, entry = Array.isArray(prior.sheets) ? prior.sheets.find((e: { companionId?: string }) => e.companionId === s.companionId) : null;
  if (!entry || entry.status !== 'pending') fail('companion_sheet_repair_prior');
  const visual = personalCompanionVisual(s.companionId);
  if (!getPersonalAddedCompanion(s.companionId) || !visual?.description.trim() || visual.source !== 'lib/personal-wizard/personal-companions.ts') fail('companion_sheet_companion');
  const draft = JSON.parse(readFileSync(grant.lineage.descriptions.file, 'utf8')), drafted = draft?.companions?.[s.companionId];
  if (drafted?.visualDescription !== visual!.description || previewSha(Buffer.from(visual!.description, 'utf8')) !== s.descriptionSha256 ||
      canonicalJson(drafted.body) !== canonicalJson(s.body)) fail('companion_sheet_description');
  const geometry = companionSheetGeometry(s.companionId, visual!.description);
  if (companionSheetGeometrySha(geometry) !== s.geometrySha256 || !bodyAgrees(s.body, geometry)) fail('companion_sheet_geometry');
  const index = JSON.parse(readFileSync(grant.lineage.approvedIndex.file, 'utf8'));
  const indexed = (p: { file: string; sha256: string }) => Array.isArray(index) && index.some((row: { id?: string; sha256?: string; file?: string }) =>
    row.id === s.companionId && row.sha256 === p.sha256 && typeof row.file === 'string' && path.basename(row.file) === path.basename(p.file));
  const priorView = (view: CompanionSheetViewKind) => entry.views?.[view] as { sha256?: string; verdict?: CompanionSheetReview['views'][number] } | undefined;
  const priorPassed = (view: CompanionSheetViewKind, sha256: string) => { const v = priorView(view);
    return v?.sha256 === sha256 && v.verdict?.view === view && viewPasses(v.verdict); };
  if (!indexed(s.front) || path.basename(s.front.file) !== 'front-candidate.png' || !priorPassed('front', s.front.sha256)) fail('companion_sheet_front');
  if (s.threeQuarter && (!indexed(s.threeQuarter) || !priorPassed('three_quarter_front', s.threeQuarter.sha256))) fail('companion_sheet_three_quarter');
  for (const r of s.retained) if (!priorPassed(r.view, r.image.sha256)) fail('companion_sheet_repair_retained');
  for (const v of s.repair) { const p = priorView(v); if (!p?.verdict || p.verdict.view !== v || viewPasses(p.verdict)) fail('companion_sheet_repair_views'); }
  const views = [...(s.threeQuarter ? ['three_quarter_front'] : []), ...s.retained.map(r => r.view), ...s.repair];
  if (new Set(views).size !== views.length || canonicalJson([...views].sort()) !== canonicalJson([...RENDERED_SHEET_VIEWS].sort())) fail('companion_sheet_views');
  pinnedBytes(s.front); if (s.threeQuarter) pinnedBytes(s.threeQuarter); s.retained.forEach(r => pinnedBytes(r.image));
  if (grant.maxCalls !== s.repair.length + 1) fail('companion_sheet_calls');
  return { grant, grantSha256, text, geometry };
}

/** What a repair's single review decides: every view passes, or the set stays pending (never another redraw). */
export function companionSheetRepairDisposition(review: CompanionSheetReview): { status: 'passed' } | { status: 'pending'; reason: 'front_held' | 'held_after_repair' } {
  const held = review.views.filter(v => !viewPasses(v)).map(v => v.view);
  if (!held.length) return { status: 'passed' };
  return { status: 'pending', reason: held.includes('front') ? 'front_held' : 'held_after_repair' };
}

export async function runCompanionSheetRepair(args: { grantFile: string; keyFile: string; signal: AbortSignal; providers?: CompanionSheetProviders;
  log?: (line: string) => void }) {
  const log = args.log ?? (() => undefined), providers = args.providers ?? PROVIDERS;
  const { grant, grantSha256, text: grantText, geometry } = admitCompanionSheetRepairGrant(args.grantFile);
  const { at, meter, held, render, review, publish } = openSheetRun({ out: grant.out, registry: grant.registry, lease: REPAIR_LEASE, grantFile: args.grantFile,
    grantSha256, grantText, capMicroUsd: grant.capMicroUsd, maxCalls: grant.maxCalls, keyFile: args.keyFile, signal: args.signal, providers });
  const s = grant.sheet, visual = personalCompanionVisual(s.companionId)!;
  const entry: SheetEntry = { companionId: s.companionId, status: 'running', views: {}, reviews: [] };
  const outcome: { concepts: never[]; sheets: SheetEntry[]; stopped?: { code: string; message: string } } = { concepts: [], sheets: [entry] };
  try {
    const front: View = { ...held(`${s.companionId}_front.png`, pinnedBytes(s.front)), provenance: 'owner_approved_candidate' };
    const current: Partial<Record<CompanionSheetViewKind, View>> = { front };
    if (s.threeQuarter) current.three_quarter_front = { ...held(`${s.companionId}_three_quarter_front_0.png`, pinnedBytes(s.threeQuarter)), provenance: 'owner_approved_candidate' };
    for (const r of s.retained) current[r.view] = { ...held(`${s.companionId}_${r.view}_retained.png`, pinnedBytes(r.image)), provenance: 'generated' };
    for (const view of s.repair) {
      const plan = companionSheetRenderPlan({ companionId: s.companionId, view, references: [front.file], visualLock: visual.description, geometry, signal: args.signal });
      current[view] = { ...await render(`repair_${s.companionId}_${view}`, plan, [front]), provenance: 'generated' };
      log(`repair ${s.companionId} ${view}`);
    }
    const judgedSet = COMPANION_SHEET_VIEW_KINDS.map(view => ({ view, ...current[view]! }));
    const payload = await companionSheetReviewPayload({ companionId: s.companionId, description: visual.description, body: s.body, geometry, images: judgedSet });
    const step = `repair_${s.companionId}_review`, judged = await review(step, payload);
    entry.reviews.push(step);
    recordVerdicts(entry, judgedSet, judged);
    const decided = companionSheetRepairDisposition(judged);
    log(`review ${step}: ${decided.status}`);
    if (decided.status === 'passed') publish(s, judgedSet, entry);
    else { entry.status = 'pending'; entry.reason = decided.reason; }
  } catch (error) {
    outcome.stopped = { code: (error as { code?: string })?.code ?? 'companion_sheet_stopped', message: String((error as Error)?.message ?? error).slice(0, 300) };
    if (entry.status === 'running') { entry.status = 'stopped'; entry.reason = outcome.stopped.code; }
  }
  const spend = meter.snapshot();
  const cumulative = { priorKnownApiMicroUsd: grant.ledger.priorKnownApiMicroUsd, priorCalls: grant.ledger.priorCalls,
    cumulativeAccountedMicroUsd: grant.ledger.priorKnownApiMicroUsd + spend.cumulativeAccountedMicroUsd, cumulativeCalls: grant.ledger.priorCalls + spend.calls,
    cumulativeCapMicroUsd: REPAIR_OWNER_LIMITS.cumulativeCapMicroUsd };
  exclusiveJson(at('outcome.json'), { version: 'companion-sheet-repair-outcome/v1', grantSha256, ...outcome, spend, cumulative, finishedAt: new Date().toISOString() });
  writeFileSync(at('contact-sheet.html'), contactSheet(outcome, 'גיליון חבר מלווה — תיקון'), { flag: 'wx' });
  return { ...outcome, spend, cumulative };
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
function contactSheet(outcome: { concepts: { companionId: string; variant: string; image: string }[];
  sheets: { companionId: string; status: string; reason?: string; views: Record<string, { image: string; verdict?: unknown }> }[]; stopped?: { code: string } },
  heading: string) {
  const card = (src: string, label: string, note = '') => `<figure><img src="illustrations/${esc(src)}" alt="${esc(label)}"><figcaption>${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</figcaption></figure>`;
  const status: Record<string, string> = { passed: 'עבר בדיקה', pending: 'נשאר בהכנה', stopped: 'נעצר' };
  const sheets = outcome.sheets.map(s => `<section><h2>${esc(s.companionId)} — ${esc(status[s.status] ?? s.status)}${s.reason ? ` (${esc(s.reason)})` : ''}</h2><div class="row">${
    COMPANION_SHEET_VIEW_KINDS.filter(v => s.views[v]).map(v => { const verdict = s.views[v].verdict as { verdict?: string; reason?: string } | undefined;
      return card(s.views[v].image, v, verdict ? `${verdict.verdict}: ${verdict.reason}` : ''); }).join('')}</div></section>`).join('');
  const concepts = outcome.concepts.length ? `<section><h2>טיוטות לבחירה</h2><div class="row">${outcome.concepts.map(c => card(c.image, `${c.companionId} — ${c.variant.toUpperCase()}`)).join('')}</div></section>` : '';
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Companion sheets S1</title>
<style>body{font-family:system-ui,sans-serif;background:#faf7f2;color:#2b2b2b;margin:0;padding:16px}h1{font-size:22px}h2{font-size:18px;margin:24px 0 8px}
.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}figure{margin:0;background:#fff;border-radius:10px;padding:8px}
img{width:100%;height:auto;border-radius:6px;display:block}figcaption{font-size:13px;margin-top:6px}small{display:block;color:#666;margin-top:4px;direction:ltr;text-align:left}</style></head>
<body><h1>${esc(heading)}</h1>${outcome.stopped ? `<p>ההרצה נעצרה: ${esc(outcome.stopped.code)}</p>` : ''}${concepts}${sheets}</body></html>\n`;
}

/** The command line: --grant <abs> --key-env-file <abs>. Resolves when the run has written its outcome (or refused before anything). */
export async function companionSheetsMain(argv: readonly string[]) {
  const argValue = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const grantFile = argValue('--grant'), keyFile = argValue('--key-env-file');
  if (!grantFile || !keyFile || !path.isAbsolute(grantFile) || !path.isAbsolute(keyFile)) fail('companion_sheet_args');
  process.env.GPT_IMAGE_EDIT_MAX_REFERENCES ??= '4';
  const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
  const started = Date.now();
  try {
    const r = await runCompanionSheets({ grantFile: grantFile!, keyFile: keyFile!, signal: controller.signal,
      log: line => console.log(`[${((Date.now() - started) / 60000).toFixed(1)}m] ${line}`) });
    console.log(JSON.stringify({ status: r.stopped ? 'stopped' : 'complete', sheets: r.sheets.map(s => [s.companionId, s.status]), concepts: r.concepts.length,
      spend: r.spend }, null, 2));
    return r;
  } catch (error) { console.error('FAILED', (error as { code?: string })?.code ?? (error as Error)?.message ?? error); process.exitCode = 1; throw error; }
}

/** The repair's command line: --grant <abs> --key-env-file <abs>. Same launcher rules as companionSheetsMain. */
export async function companionSheetRepairMain(argv: readonly string[]) {
  const argValue = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const grantFile = argValue('--grant'), keyFile = argValue('--key-env-file');
  if (argv.length !== 4 || !grantFile || !keyFile || !path.isAbsolute(grantFile) || !path.isAbsolute(keyFile)) fail('companion_sheet_args');
  process.env.GPT_IMAGE_EDIT_MAX_REFERENCES ??= '4';
  const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
  const started = Date.now();
  try {
    const r = await runCompanionSheetRepair({ grantFile: grantFile!, keyFile: keyFile!, signal: controller.signal,
      log: line => console.log(`[${((Date.now() - started) / 60000).toFixed(1)}m] ${line}`) });
    console.log(JSON.stringify({ status: r.stopped ? 'stopped' : 'complete', sheets: r.sheets.map(s => [s.companionId, s.status, s.reason ?? null]),
      spend: r.spend, cumulative: r.cumulative }, null, 2));
    return r;
  } catch (error) { console.error('FAILED', (error as { code?: string })?.code ?? (error as Error)?.message ?? error); process.exitCode = 1; throw error; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) companionSheetsMain(process.argv.slice(2)).catch(() => undefined);
