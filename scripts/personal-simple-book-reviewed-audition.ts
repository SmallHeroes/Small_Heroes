/**
 * Reviewed LOW audition of the ONE already-reviewed simple book. Dry run by default: no key, no provider.
 *   node --require ./scripts/shims/register-server-only.cjs --import tsx scripts/personal-simple-book-reviewed-audition.ts \
 *     --book-dir <one-approved-book-20261008> [--execute --grant <grant.json> --key-env-file <file> --out <dir> [--resume]]
 *   A new reviewed book adds --layout <book-layout.json> (its folders, seed and written child design; see reviewedBookLayoutSchema).
 * A paid run needs a spend grant: an explicit approval with a cumulative ledger, a cap and a scope. A new output folder
 * never resets spending. Not production, customer or release authority. Every paid call is journaled before dispatch.
 */
import path from 'node:path';
import { existsSync, mkdirSync, readdirSync, readFileSync, lstatSync, openSync, writeFileSync, fsyncSync, closeSync, realpathSync } from 'node:fs';
import sharp from 'sharp';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { generateGPTImage, planGPTImageRequest, type BookDesignReferenceRole } from '../lib/generate-image';
import { getCompanionById } from '../lib/companions';
import { qualityDisposition } from '../lib/local-preview-quality';
import { previewSha } from '../lib/local-story-preview';
import { evaluatePageChildResemblanceVision } from '../lib/generation-pipeline/page-child-resemblance-vision';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { resolvePersonalWizardOptions, type PersonalWizardOptions } from '../lib/personal-wizard/options';
import { prepareSimpleStory } from '../lib/personal-wizard/simple-story-engine';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardReviewDisposition,
  currentPersonalStoryboardFrame, type PersonalStoryboard } from '../lib/personal-wizard/storyboard';
import { simpleReferenceDesignContext, type AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { LANDMARK_KIND_CONTRACT_VERSION } from '../lib/personal-wizard/storyboard-landmark-kind';
import { STORYBOARD_MOMENTS_VERSION } from '../lib/personal-wizard/storyboard-moments';
import { SCENE_LOCATION_CONTRACT_VERSION } from '../lib/personal-wizard/storyboard-scene-location';
import { COMPILER_RULES_CONTRACT_VERSION } from '../lib/personal-wizard/storyboard-compiler-rules';
import { STORYBOARD_PRESERVATION_VERSION, storyboardPreservationDiff } from '../lib/personal-wizard/storyboard-preservation';
import { PARENT_STORYBOARD_DIR, replanGrantSchema } from './personal-storyboard-replan-grant';
import { illustrateReviewedAudition, rejudgeAudition, reviewedAuditionHTML, auditionSheetDesigns, auditionSheetPrompt, auditionPageChecks,
  auditionReviewSchema, auditionPageReviewSchema, AUDITION_JUDGE_INSTRUCTIONS, AUDITION_IMPACTS, REVIEWED_AUDITION_POLICY, AUDITION_WORST_CASE_CALLS,
  ReviewedAuditionError, type ReferenceStatus } from '../lib/personal-wizard/simple-book-reviewed-audition';
import { auditionUsageCost } from './personal-simple-book-illustrator';
import { exclusiveJson, exclusiveText, fencedText, realDirectory } from './personal-causal-trial-journal';

const fail = (code: string): never => { throw new ReviewedAuditionError(code); };
const read = (file: string) => JSON.parse(fencedText(file, 32000000));
const SEED = 'goni-new-cardboard-adventure-20261008';
const CHILD_DESIGN = 'A new fictional six-year-old girl with short softly wavy chestnut-brown hair, warm brown eyes and light warm skin; natural child proportions, expressive but not oversized eyes. No glasses or face accessories. Match the exact wardrobe specified by the whole-book plan.';
const REVIEW_MODEL = 'gpt-6.1-sol';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const image = z.object({ imageName: z.string().regex(/^[a-z0-9_]+\.png$/), imageSha: hash }).strict();

/**
 * Where a reviewed book keeps its parts, and the two inputs its request cannot carry (seed, written child design). Routing only: the loader
 * recomputes every binding (request id, storyboard, frames, child context and review) from these, so another layout cannot borrow evidence.
 */
const folder = z.string().regex(/^[A-Za-z0-9_.-]{1,80}$/).refine(s => s !== '.' && s !== '..');
export const reviewedBookLayoutSchema = z.object({ version: z.literal('reviewed-book-layout/v1'), seed: z.string().min(1).max(120),
  childDesign: z.string().trim().min(20).max(1500), storyboardDir: folder, childDir: folder, childImage: z.string().regex(/^[a-z0-9_]+\.png$/),
  /** The companion copy a historical run saved beside its child; null: the registry card alone is the reference. */
  savedCompanion: z.string().regex(/^[A-Za-z0-9_.-]{1,80}\/illustrations\/[a-z0-9_]+\.png$/).refine(s => folder.safeParse(s.split('/')[0]).success).nullable() }).strict();
export type ReviewedBookLayout = z.infer<typeof reviewedBookLayoutSchema>;
/** The ONE already-reviewed book (2026-10-08): its historical folders and constants, unchanged. */
export const LEGACY_BOOK_LAYOUT: ReviewedBookLayout = Object.freeze({ version: 'reviewed-book-layout/v1', seed: SEED, childDesign: CHILD_DESIGN,
  storyboardDir: PARENT_STORYBOARD_DIR, childDir: 'reference-role-repair-continuation-20261009', childImage: 'reference_child_checkpoint.png',
  savedCompanion: 'reference-role-repair-continuation-20261009/illustrations/companion_reference.png' });
export function readReviewedBookLayout(file: string): ReviewedBookLayout {
  if (!path.isAbsolute(file)) fail('audition_layout');
  const parsed = reviewedBookLayoutSchema.safeParse(read(file));
  return parsed.success ? parsed.data : fail('audition_layout');
}

/** The moments contract flag comes only from the saved, digest-bound book (never a CLI argument); an unknown marker is refused. */
export function savedMomentContract(savedBook: { moments?: { version?: unknown } } | undefined): true | undefined {
  if (savedBook?.moments === undefined) return undefined;
  return savedBook.moments?.version === STORYBOARD_MOMENTS_VERSION ? true : fail('audition_board_binding');
}

/** Strict read-only admission of the reviewed storyboard and the accepted child/companion references. */
/** The landmark-kind contract flag comes only from the saved, digest-bound book (never a CLI argument); an unknown marker is refused. */
export function savedLandmarkKindContract(savedBook: { landmarkKind?: unknown } | undefined): true | undefined {
  const marker = savedBook?.landmarkKind;
  if (marker === undefined) return undefined;
  return marker === LANDMARK_KIND_CONTRACT_VERSION ? true : fail('audition_board_binding');
}

/** The compiler-rules contract flag comes only from the saved, digest-bound book (never a CLI argument); an unknown marker is refused. */
export function savedCompilerRulesContract(savedBook: { compilerRules?: unknown } | undefined): true | undefined {
  const marker = savedBook?.compilerRules;
  if (marker === undefined) return undefined;
  return marker === COMPILER_RULES_CONTRACT_VERSION ? true : fail('audition_board_binding');
}

/** The scene-location contract flag comes only from the saved, digest-bound book (never a CLI argument); an unknown marker is refused. */
export function savedSceneLocationContract(savedBook: { sceneLocation?: unknown } | undefined): true | undefined {
  const marker = savedBook?.sceneLocation;
  if (marker === undefined) return undefined;
  return marker === SCENE_LOCATION_CONTRACT_VERSION ? true : fail('audition_board_binding');
}

// ---------------------------------------------------------------------------------------------------------------
// Optional re-plan folder: the SAME saved source with a new kind-enabled storyboard, bound to the reviewed parent. Never written
// inside the protected parent folder; every file sha-indexed (immutable); admitted only when comparable with the parent's images.
// ---------------------------------------------------------------------------------------------------------------
export { PARENT_STORYBOARD_DIR };
export const REPLAN_RESULT_VERSION = 'storyboard-replan-result/v1' as const;
export const REPLAN_INDEX_VERSION = 'storyboard-replan-index/v1' as const;
export const REPLAN_INDEX_FILE = 'replan-index.json';
const indexedPath = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?$/;

/** Every regular file below `dir` (one sub-folder level), as forward-slash relative paths. A link or deeper nesting is refused. */
export function replanFiles(dir: string) {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const st = lstatSync(path.join(dir, name));
    if (st.isSymbolicLink()) fail('audition_replan_index');
    if (st.isFile()) { out.push(name); continue; }
    if (!st.isDirectory()) fail('audition_replan_index');
    for (const inner of readdirSync(path.join(dir, name))) {
      const s2 = lstatSync(path.join(dir, name, inner));
      if (!s2.isFile() || s2.isSymbolicLink()) fail('audition_replan_index');
      out.push(`${name}/${inner}`);
    }
  }
  return out.sort();
}

/** The folder is exactly its index: same file set, same bytes. A changed, added or removed file refuses the whole folder. */
export function verifyReplanIndex(dir: string) {
  const index = z.object({ version: z.literal(REPLAN_INDEX_VERSION),
    files: z.array(z.object({ path: z.string().regex(indexedPath), sha256: hash, bytes: z.number().int().nonnegative() }).strict()).min(1).max(64) }).strict()
    .safeParse(read(path.join(dir, REPLAN_INDEX_FILE)));
  if (!index.success) return fail('audition_replan_index');
  const listed = index.data.files.map(f => f.path).sort();
  if (new Set(listed).size !== listed.length || canonicalJson(listed) !== canonicalJson(replanFiles(dir).filter(f => f !== REPLAN_INDEX_FILE))) fail('audition_replan_index');
  for (const f of index.data.files) {
    const bytes = readFileSync(path.join(dir, ...f.path.split('/')));
    if (bytes.length !== f.bytes || previewSha(bytes) !== f.sha256) fail('audition_replan_index');
  }
  return { ...index.data, sha256: previewSha(readFileSync(path.join(dir, REPLAN_INDEX_FILE))) };
}

type ReplanParentBook = { bookDir: string; request: unknown; options: PersonalWizardOptions; source: unknown; book: PersonalStoryboard; rawReview: unknown;
  draft: unknown };
/**
 * Re-admits a re-plan against its reviewed parent: same source, preservation bound to the parent, new review and packets, comparable design.
 * Its compared-page scope comes ONLY from the saved producer grant (typed, sha-bound to the result and admission, and bound to this parent and
 * this re-planned source); result metadata must merely agree with it. An index proves file integrity, never scope.
 */
export function admitReplanStoryboard(parent: ReplanParentBook, replanDir: string) {
  if (!path.isAbsolute(replanDir)) fail('audition_replan_fence');
  realDirectory(replanDir);
  const real = realpathSync.native(replanDir).toLowerCase(), protectedRoot = realpathSync.native(parent.bookDir).toLowerCase();
  if (real === protectedRoot || real.startsWith(protectedRoot + path.sep)) fail('audition_replan_fence');
  const index = verifyReplanIndex(replanDir);
  if (!existsSync(path.join(replanDir, 'visual_simple_book_result.json'))) fail('audition_replan_status');
  const result = read(path.join(replanDir, 'visual_simple_book_result.json'));
  if (result.version !== REPLAN_RESULT_VERSION || result.status !== 'review_supported' || result.runtimeEligible !== false ||
      result.storyboard?.status !== 'review_supported') fail('audition_replan_status');
  if (result.parent?.storyboardDigest !== parent.book.storyboardDigest || result.parent?.sourceDigest !== parent.book.sourceDigest ||
      result.parent?.requestId !== parent.book.requestId || canonicalJson(result.source) !== canonicalJson(parent.source) ||
      result.replan?.preservation !== STORYBOARD_PRESERVATION_VERSION) fail('audition_replan_parent');
  const grantText = fencedText(path.join(replanDir, 'grant.json'), 200000), producerGrantSha256 = previewSha(grantText);
  const admission = read(path.join(replanDir, 'admission.json'));
  let producerRaw: unknown;
  try { producerRaw = JSON.parse(grantText); } catch { return fail('audition_replan_grant'); }
  const producer = replanGrantSchema.safeParse(producerRaw);
  if (!producer.success || result.replan?.grantSha256 !== producerGrantSha256 || admission?.grantSha256 !== producerGrantSha256) return fail('audition_replan_grant');
  const g = producer.data;
  if (path.resolve(g.parent.bookDir).toLowerCase() !== path.resolve(parent.bookDir).toLowerCase() || g.parent.requestId !== parent.book.requestId ||
      g.parent.sourceDigest !== parent.book.sourceDigest || g.parent.storyboardDigest !== parent.book.storyboardDigest ||
      g.parent.reviewDigest !== storyboardReviewDisposition(parent.book, parent.rawReview).reviewDigest ||
      g.parent.savedSourceSha256 !== previewSha(canonicalJson(parent.source))) fail('audition_replan_grant');
  const pairPages = g.replan.pairPages;
  if (pairPages.some(page => page > parent.book.narrativeSpreads) || canonicalJson(result.replan?.pairPages) !== canonicalJson(pairPages) ||
      canonicalJson(admission?.replan?.pairPages) !== canonicalJson(pairPages)) fail('audition_replan_scope');
  // The kind marker comes only from the saved, digest-bound book; a re-plan exists to add it.
  if (savedLandmarkKindContract(result.storyboard?.storyboard) !== true) fail('audition_replan_kind');
  const source = prepareCurrentPersonalStoryboard(parent.request, result.source, parent.options, true, undefined, true,
    { parentStoryboardDigest: parent.book.storyboardDigest, draft: parent.draft });
  // The producer grant was issued for exactly this re-planned source (parent, saved source, kind contract and preservation).
  if (g.replan.sourceDigest !== source.sourceDigest) fail('audition_replan_grant');
  const draft = read(path.join(replanDir, 'owned_storyboard_draft.json'));
  const book = compilePersonalStoryboard(source, draft);
  const rawReview = result.storyboard.rawReview;
  if (canonicalJson(book) !== canonicalJson(result.storyboard.storyboard) || !book.plan.actorAppearance ||
      storyboardReviewDisposition(book, rawReview).disposition !== 'review_supported' || result.storyboard.framePackets?.length !== book.narrativeSpreads + 1) fail('audition_board_binding');
  const current = { request: parent.request, writerResult: result.source, options: parent.options };
  for (let n = 0; n <= book.narrativeSpreads; n++)
    if (canonicalJson(currentPersonalStoryboardFrame(book, rawReview, n, current)) !== canonicalJson(result.storyboard.framePackets[n])) fail('audition_frame_binding');
  // Recomputed here (the saved report is evidence only): any drift beyond the added kinds refuses the saved images as fair controls.
  const comparability = storyboardPreservationDiff(parent.draft, draft, pairPages);
  if (comparability.verdict !== 'COMPARABLE') fail('audition_replan_not_comparable');
  return { dir: replanDir, indexSha256: index.sha256, producerGrantSha256, result, book, rawReview, current, comparability, pairPages,
    companionDescription: source.companionDescription };
}

/** The reviewed request and storyboard of a book (no references yet): every saved part recompiled and bound. */
export function loadReviewedStoryboard(bookDir: string, workspace = process.cwd(), layout: ReviewedBookLayout = LEGACY_BOOK_LAYOUT) {
  realDirectory(bookDir);
  const queued = z.object({ version: z.literal('local-simple-wizard-request/v1'), requestId: z.string(), optionsFingerprint: z.string(),
    request: z.unknown() }).passthrough().parse(read(path.join(bookDir, 'request.json')));
  const options = resolvePersonalWizardOptions(workspace), prepared = prepareSimpleStory(queued.request, options, layout.seed);
  if (prepared.accepted.requestId !== queued.requestId || prepared.accepted.optionsFingerprint !== queued.optionsFingerprint ||
      prepared.book.pages !== 8 || prepared.accepted.containsFixtureData || prepared.accepted.canonical.appearance.photo !== 'none') fail('audition_request_binding');
  const visual = path.join(bookDir, layout.storyboardDir);
  const result = read(path.join(visual, 'visual_simple_book_result.json'));
  if (result.status !== 'review_supported' || result.runtimeEligible !== false || result.storyboard?.status !== 'review_supported') fail('audition_result_status');
  // The story was written under this book's seed (it picked the story shape): another layout seed is another book.
  if (result.source?.simpleSource?.evidence?.seed !== prepared.seed) fail('audition_request_binding');
  // The rebuilt source must reproduce the saved markers exactly: a stripped or added marker changes the digests and fails the board binding.
  const saved = result.storyboard?.storyboard;
  const source = prepareCurrentPersonalStoryboard(queued.request, result.source, options, true, savedMomentContract(saved), savedLandmarkKindContract(saved),
    undefined, savedSceneLocationContract(saved), savedCompilerRulesContract(saved));
  const parentDraft = read(path.join(visual, 'owned_storyboard_draft.json'));
  const book = compilePersonalStoryboard(source, parentDraft);
  const rawReview = result.storyboard.rawReview;
  if (canonicalJson(book) !== canonicalJson(result.storyboard.storyboard) || !book.plan.actorAppearance ||
      storyboardReviewDisposition(book, rawReview).disposition !== 'review_supported' || result.storyboard.framePackets.length !== 9) fail('audition_board_binding');
  const current = { request: queued.request, writerResult: result.source, options };
  for (let n = 0; n <= 8; n++) if (canonicalJson(currentPersonalStoryboardFrame(book, rawReview, n, current)) !== canonicalJson(result.storyboard.framePackets[n])) fail('audition_frame_binding');
  return { queued, options, prepared, result, source, parentDraft, book, rawReview, current };
}

/** The written child design a reference must show, under the active storyboard's wardrobe and owned clothing. */
export const reviewedChildDesign = (prepared: { brief: { child: { age: number; address: string } } }, book: PersonalStoryboard, layout: ReviewedBookLayout) =>
  ({ age: prepared.brief.child.age, address: prepared.brief.child.address, fictionalDesign: layout.childDesign,
    wardrobe: book.plan.wardrobe, role: 'child', clothing: book.plan.actorAppearance!.child.clothing });

export function loadReviewedBook(bookDir: string, workspace = process.cwd(), replanDir?: string, layout: ReviewedBookLayout = LEGACY_BOOK_LAYOUT) {
  const { queued, options, prepared, result, source, parentDraft, book, rawReview, current } = loadReviewedStoryboard(bookDir, workspace, layout);
  // Optional re-plan (never the default): the child and companion references below are then checked against ITS storyboard.
  const replan = replanDir === undefined ? undefined
    : admitReplanStoryboard({ bookDir, request: queued.request, options, source: result.source, book, rawReview, draft: parentDraft }, replanDir);
  const active = replan ?? { result, book, rawReview, current, companionDescription: source.companionDescription };
  // Child: the reviewed, passed reference adopted for this book, bound to its recomputed original context.
  const childDir = path.join(bookDir, layout.childDir);
  const adoption = read(path.join(childDir, 'reference_child_adoption.json'));
  const childContext = simpleReferenceDesignContext(reviewedChildDesign(prepared, active.book, layout));
  const childBytes = readFileSync(path.join(childDir, 'illustrations', layout.childImage));
  if (adoption.name !== 'child' || canonicalJson(adoption.context) !== canonicalJson(childContext) || previewSha(childBytes) !== adoption.candidate.imageSha ||
      qualityDisposition(adoption.review, adoption.candidate.imageSha, previewSha(JSON.stringify(childContext))).disposition !== 'passed') fail('audition_child_reference');
  const card = getCompanionById((queued.request as { companion: { id: string } }).companion.id)?.cardImage;
  if (!card || !/^\/companions\/[a-z0-9_]+\/style01-sheets\/front\.png$/.test(card)) return fail('audition_companion_reference');
  const companionBytes = readFileSync(path.join(workspace, 'public', card.slice(1)));
  if (layout.savedCompanion !== null && previewSha(companionBytes) !== previewSha(readFileSync(path.join(bookDir, ...layout.savedCompanion.split('/'))))) fail('audition_companion_reference');
  return { queued, options, prepared, result: active.result, book: active.book, rawReview: active.rawReview, current: active.current, childBytes, companionBytes,
    companionDescription: active.companionDescription,
    texts: (result.source.manuscript.pages as { text: string }[]).map(p => p.text), title: result.source.manuscript.title as string,
    pages: result.source.manuscript.pages as { text: string }[],
    ...(replan ? { replan: { dir: replan.dir, indexSha256: replan.indexSha256, producerGrantSha256: replan.producerGrantSha256, pairPages: replan.pairPages,
      comparability: replan.comparability } } : {}) };
}

// ---------------------------------------------------------------------------------------------------------------
// Spend grant: who approved what, the inherited ledger, a cumulative cap and the exact scope.
// ---------------------------------------------------------------------------------------------------------------
const referenceSchema = z.object({ image, status: z.enum(['approved_reference', 'diagnostic_candidate']),
  knownFlaws: z.array(z.object({ impact: z.enum(AUDITION_IMPACTS), requirement: z.string().min(1).max(160), note: z.string().min(1).max(600) }).strict()).max(12) }).strict();
export const auditionGrantSchema = z.object({
  version: z.literal('audition-spend-grant/v1'),
  approvalReference: z.string().trim().min(30).max(2000),
  book: z.object({ requestId: hash, storyboardDigest: hash }).strict(),
  ledger: z.object({ priorKnownApiMicroUsd: z.number().int().nonnegative(),
    /** An earlier call's still-unknown cost carried by an owner-approved continuation (never known spend). Absent on every legacy grant. */
    carriedUnresolvedMicroUsd: z.number().int().positive().optional(),
    evidence: z.array(z.object({ file: z.string().min(1), sha256: hash }).strict()).min(1).max(16),
    note: z.string().min(10).max(1000) }).strict(),
  capMicroUsd: z.number().int().positive(), maxCalls: z.number().int().positive().max(AUDITION_WORST_CASE_CALLS + REVIEWED_AUDITION_POLICY.pageAttempts * 3),
  scope: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('render'), pages: z.array(z.number().int().min(0).max(8)).min(1).max(9),
      /** Optional early sample: drawn first; the other pages follow only if every sample page is qa_supported. Absent on every legacy grant. */
      sample: z.array(z.number().int().min(1).max(8)).min(1).max(2).optional() }).strict(),
    z.object({ mode: z.literal('rejudge'), sourceDirectory: z.string().min(1),
      references: z.object({ entities: referenceSchema, locations: referenceSchema }).strict(),
      frames: z.array(z.object({ label: z.string().min(1).max(80), pageNumber: z.number().int().min(0).max(8), image,
        predecessor: image.nullable() }).strict()).min(1).max(12),
      /** Required exactly when the run loads a re-plan folder (--storyboard-dir); absent on every legacy grant. */
      replan: z.object({ producerGrantSha256: hash, indexSha256: hash }).strict().optional() }).strict(),
  ]),
  claudeMax: z.literal('Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger'),
  /** A grant issued to one approved experiment: usable only through that experiment's guard (its claim, source pin and fixed output). */
  experiment: z.object({ slot: z.string().regex(/^[a-z0-9-]{1,60}$/), claimSha256: hash }).strict().optional(),
}).strict().superRefine((g, ctx) => {
  // A grant can only extend the ledger it names, by at most USD 8 of new API estimate.
  if (g.capMicroUsd <= g.ledger.priorKnownApiMicroUsd + (g.ledger.carriedUnresolvedMicroUsd ?? 0) || g.capMicroUsd - g.ledger.priorKnownApiMicroUsd > 8000000)
    ctx.addIssue({ code: 'custom', message: 'audition_grant_cap' });
  if (g.scope.mode === 'render' && g.scope.sample) {
    const { pages, sample } = g.scope;
    if (new Set(sample).size !== sample.length || sample.some((n, i) => !pages.includes(n) || i > 0 && n <= sample[i - 1]))
      ctx.addIssue({ code: 'custom', message: 'audition_grant_sample' });
  }
});
export type AuditionGrant = z.infer<typeof auditionGrantSchema>;

type GrantReferences = Extract<AuditionGrant['scope'], { mode: 'rejudge' }>['references'];
/** The reference status a rejudge grant's sheets give the checker (their recorded flaws as bound reference defects). Shared with re-selection. */
export function grantReferenceStatus(references: GrantReferences): ReferenceStatus {
  const status = (r: GrantReferences['entities']) => ({ ...r, knownFlaws: r.knownFlaws.map(f => ({ ...f, category: 'reference', verdict: 'defect' as const, bound: true })) });
  return { entities: status(references.entities), locations: status(references.locations) };
}

export function readAuditionGrant(file: string, book: { requestId: string; storyboardDigest: string }) {
  const grant = auditionGrantSchema.parse(read(file));
  if (grant.book.requestId !== book.requestId || grant.book.storyboardDigest !== book.storyboardDigest) fail('audition_grant_book');
  for (const e of grant.ledger.evidence) if (!path.isAbsolute(e.file) || previewSha(readFileSync(e.file)) !== e.sha256) fail('audition_grant_evidence');
  return { grant, sha256: previewSha(readFileSync(file)) };
}

// ---------------------------------------------------------------------------------------------------------------
// Meter: cumulative, fail-closed.
// ---------------------------------------------------------------------------------------------------------------
/** Logical stage of a paid step: image render, pixel review or child identity measurement. */
export const auditionStage = (step: string) => /_qa$|^rejudge_/.test(step) ? 'review' : /_identity$/.test(step) ? 'identity' : 'render';

/**
 * Journals every paid call before dispatch. Prior spend is an explicit input. An unknown cost or an unknown outcome
 * (a claim without a result) stops further paid calls instead of hiding behind a reservation; two consecutive failed
 * calls stop the run instead of retrying silently.
 */
export class AuditionMeter {
  /**
   * `carriedUnresolvedMicroUsd`: an earlier call's cost that is still unknown, carried explicitly by an owner-approved continuation. It is
   * never known spend: it counts against the cap like a reservation and is reported on its own (absent when zero, as on every legacy run).
   */
  constructor(readonly root: string, readonly capMicroUsd: number, readonly maxCalls: number, readonly priorKnownApiMicroUsd = 0,
    readonly carriedUnresolvedMicroUsd = 0) {
    if (![capMicroUsd, maxCalls, priorKnownApiMicroUsd, carriedUnresolvedMicroUsd].every(Number.isSafeInteger) || carriedUnresolvedMicroUsd < 0 ||
      capMicroUsd <= priorKnownApiMicroUsd + carriedUnresolvedMicroUsd ||
      capMicroUsd - priorKnownApiMicroUsd > 8000000 || maxCalls < 1 || maxCalls > AUDITION_WORST_CASE_CALLS + REVIEWED_AUDITION_POLICY.pageAttempts * 3) fail('audition_meter_policy');
    if (!existsSync(root)) mkdirSync(root); realDirectory(root);
  }
  snapshot() {
    let newKnownApiMicroUsd = 0, reservedUnsettledMicroUsd = 0, calls = 0, failed = 0, unknownCost = 0, unknownOutcome = 0;
    const settled: { seq: number; stage: string; completed: boolean }[] = [];
    for (const name of readdirSync(this.root).filter(n => n.endsWith('.claim.json'))) {
      const claim = JSON.parse(readFileSync(path.join(this.root, name), 'utf8')), file = path.join(this.root, name.replace('.claim.', '.result.'));
      const result = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null; calls++;
      if (!result) { unknownOutcome++; reservedUnsettledMicroUsd += claim.maximumMicroUsd; continue; }
      settled.push({ seq: claim.seq, stage: auditionStage(claim.step), completed: result.completed === true });
      if (!result.completed) failed++;
      if (typeof result.estimatedMicroUsd === 'number') newKnownApiMicroUsd += result.estimatedMicroUsd;
      else { unknownCost++; reservedUnsettledMicroUsd += claim.maximumMicroUsd; }
    }
    // Two consecutive failures overall, or in one logical stage even when calls of another stage succeeded in between.
    const lastTwo = (list: typeof settled) => { const two = list.slice(-2); return two.length === 2 && two.every(s => !s.completed); };
    const ordered = settled.sort((a, b) => a.seq - b.seq);
    const repeatedFailure = lastTwo(ordered) || [...new Set(ordered.map(s => s.stage))].some(stage => lastTwo(ordered.filter(s => s.stage === stage)));
    return { priorKnownApiMicroUsd: this.priorKnownApiMicroUsd, newKnownApiMicroUsd, reservedUnsettledMicroUsd,
      ...(this.carriedUnresolvedMicroUsd ? { carriedUnresolvedMicroUsd: this.carriedUnresolvedMicroUsd } : {}),
      cumulativeAccountedMicroUsd: this.priorKnownApiMicroUsd + this.carriedUnresolvedMicroUsd + newKnownApiMicroUsd + reservedUnsettledMicroUsd,
      capMicroUsd: this.capMicroUsd, calls, maxCalls: this.maxCalls, failed, unknownCost, unknownOutcome,
      repeatedFailure,
      claudeMax: 'separate: not an API invoice, not $0 and not included' as const };
  }
  async run<T>(step: string, wire: unknown, maximumMicroUsd: number,
    dispatch: () => Promise<{ value: T; estimatedMicroUsd: number | null; receipt: unknown }>) {
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(step) || !Number.isSafeInteger(maximumMicroUsd) || maximumMicroUsd < 1) fail('audition_meter_policy');
    const state = this.snapshot();
    if (state.unknownCost || state.unknownOutcome) fail('audition_unknown_cost');
    if (state.repeatedFailure) fail('audition_repeated_failure');
    if (state.calls >= this.maxCalls) fail('audition_call_limit');
    if (state.cumulativeAccountedMicroUsd + maximumMicroUsd > this.capMicroUsd) fail('audition_budget_exhausted');
    const wireDigest = previewSha(canonicalJson(wire));
    exclusiveJson(path.join(this.root, `${step}.wire.json`), wire);
    exclusiveJson(path.join(this.root, `${step}.claim.json`), { step, seq: state.calls, wireDigest, maximumMicroUsd });
    try {
      const made = await dispatch();
      exclusiveJson(path.join(this.root, `${step}.receipt.json`), made.receipt);
      exclusiveJson(path.join(this.root, `${step}.result.json`), { wireDigest, estimatedMicroUsd: made.estimatedMicroUsd, completed: true });
      if (made.estimatedMicroUsd === null) fail('audition_unknown_cost');
      return made.value;
    } catch (error) {
      if (existsSync(path.join(this.root, `${step}.result.json`))) throw error;
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
export const digestImages = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (_k, v) =>
  typeof v === 'string' && v.startsWith('data:image/png;base64,') ? `sha256:${previewSha(Buffer.from(v.slice(22), 'base64'))}` : v));

// ---------------------------------------------------------------------------------------------------------------
// Provider adapters.
// ---------------------------------------------------------------------------------------------------------------
/**
 * The exact judge request for one candidate: the complete image, its four 70% corner crops (derived from the same bytes), the canonical
 * references and an optional same-scene predecessor, each at high detail with its role, plus today's instruction and strict schema.
 * Shared by the paid judge and by saved-evidence admission, which rebuilds it from the actual bytes and requires exact equality.
 */
export async function auditionJudgePayload(args: { candidate: AuditionImage; candidateBytes: Buffer; context: unknown; contextSha: string;
  refs: readonly Buffer[]; predecessor: Buffer | null; kind: 'sheet' | 'page' }) {
  const buffer = args.candidateBytes, meta = await sharp(buffer).metadata();
  const width = meta.width!, height = meta.height!, cw = Math.ceil(width * .7), ch = Math.ceil(height * .7);
  const crops = await Promise.all([[0, 0], [width - cw, 0], [0, height - ch], [width - cw, height - ch]].map(async ([left, top]) =>
    dataUrl(await sharp(buffer).extract({ left, top, width: cw, height: ch }).png().toBuffer())));
  const imageURLs = [dataUrl(buffer), ...crops, ...args.refs.map(dataUrl), ...(args.predecessor ? [dataUrl(args.predecessor)] : [])];
  const refRoles = ['canonical_child', 'canonical_companion', 'canonical_entities', 'canonical_locations'].slice(0, args.refs.length);
  const text = JSON.stringify({ candidateSha: args.candidate.imageSha, contextSha: args.contextSha, context: args.context,
    imageRoles: ['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right', 'candidate_crop_bottom_left', 'candidate_crop_bottom_right',
      ...refRoles, ...(args.predecessor ? ['prior_same_scene_comparison_not_authority'] : [])] });
  const instructions = AUDITION_JUDGE_INSTRUCTIONS[args.kind];
  if (imageURLs.length > 10 || Buffer.byteLength(text + instructions, 'utf8') > 104000) fail('audition_pixel_input_limit');
  return { model: REVIEW_MODEL, store: false, service_tier: 'default' as const, reasoning: { effort: 'medium' as const }, instructions,
    input: [{ role: 'user' as const, content: [{ type: 'input_text' as const, text },
      ...imageURLs.map(image_url => ({ type: 'input_image' as const, image_url, detail: 'high' as const }))] }],
    max_output_tokens: 12000, text: { format: args.kind === 'page' ? zodTextFormat(auditionPageReviewSchema, 'personal_audition_pixels_v4')
      : zodTextFormat(auditionReviewSchema, 'personal_audition_pixels_v2') } };
}

/** The paid adapters (render, judge, identity) over one illustrations folder and one meter. Shared with the new-book experiment. */
export function auditionAdapters(args: { directory: string; meter: AuditionMeter; key: () => string; signal: AbortSignal; guard?: () => void }) {
  const cancelled = () => { if (args.signal.aborted) fail('audition_cancelled'); };
  // Before a claim: cancellation and the caller's guard. After a provider response (inside a claim): cancellation only.
  const check = () => { cancelled(); args.guard?.(); };
  const writeImage = async (name: string, bytes: Buffer) => {
    if (!/^[a-z0-9_]+\.png$/.test(name)) fail('audition_image_path');
    const meta = await sharp(bytes).metadata();
    if (meta.format !== 'png' || !meta.width || !meta.height || meta.width > 1536 || meta.height > 1536) fail('audition_image_dimensions');
    const fd = openSync(path.join(args.directory, name), 'wx'); try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
    return { imageName: name, imageSha: previewSha(bytes) };
  };
  const bytesOf = (img: AuditionImage) => {
    if (!/^[a-z0-9_]+\.png$/.test(img.imageName)) fail('audition_image_path');
    const file = path.join(args.directory, img.imageName), stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20000000) fail('audition_image_file');
    const bytes = readFileSync(file); if (previewSha(bytes) !== img.imageSha) fail('audition_image_changed'); return bytes;
  };
  // 'identity' is the plain reference mode of a fictional child anchor (none or one rejected edit target); sheets and pages are unchanged.
  const render = async (step: string, prompt: string, refs: AuditionImage[], mode: 'book_identity' | 'book_design' | 'identity', roles?: readonly BookDesignReferenceRole[]) => {
    check(); const bytes = refs.map(bytesOf);
    const input = { finalPrompt: prompt, referenceImages: refs.map(r => path.join(args.directory, r.imageName)), referenceMode: mode,
      ...(roles ? { referenceRoles: roles } : {}), requireReferenceEdit: refs.length > 0, quality: 'low' as const, size: '1024x1024' as const,
      modelOverride: 'gpt-image-2', signal: args.signal, requestTimeoutMs: 180000 };
    const plan = planGPTImageRequest(input, { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
    if (plan.referenceCountPassed !== refs.length) fail('audition_reference_truncated');
    if (plan.bodyWithoutBinaryImage.model !== 'gpt-image-2' || plan.bodyWithoutBinaryImage.quality !== 'low' ||
        plan.bodyWithoutBinaryImage.size !== '1024x1024' || plan.bodyWithoutBinaryImage.n !== 1) fail('audition_image_price_contract');
    const wire = { body: plan.bodyWithoutBinaryImage, mode: plan.apiMode, references: refs, ...(plan.referenceRoles ? { referenceRoles: plan.referenceRoles } : {}),
      retries: 0, deadlineMs: 180000, pricing: 'image_input_8_output_30_conservative_no_cache', outputReservationTokens: 8192 };
    const maximumMicroUsd = Buffer.byteLength(plan.finalPrompt, 'utf8') * 8 + refs.length * 8192 * 8 + 8192 * 30;
    return args.meter.run(step, wire, maximumMicroUsd, async () => {
      let raw: unknown = null;
      try {
        const generated = await generateGPTImage({ ...input, apiKey: args.key(), exactReferenceBytes: bytes, observeProviderResponse: response => { raw = response; } });
        const cost = auditionUsageCost(generated.usage, 'image');
        if (generated.model !== 'gpt-image-2' || generated.fallbackUsed) throw Object.assign(new ReviewedAuditionError('audition_image_model'), { receipt: { raw: digestImages(raw), estimatedMicroUsd: cost } });
        const meta = await sharp(generated.buffer).metadata();
        if (meta.width !== 1024 || meta.height !== 1024) throw Object.assign(new ReviewedAuditionError('audition_image_dimensions'), { receipt: { raw: digestImages(raw), estimatedMicroUsd: cost } });
        const candidate = await writeImage(`${step}.png`, generated.buffer); cancelled();
        return { value: candidate, estimatedMicroUsd: cost, receipt: { raw: digestImages(raw), estimatedMicroUsd: cost, model: generated.model, candidate } };
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
    check();
    const payload = await auditionJudgePayload({ candidate, candidateBytes: bytesOf(candidate), context, contextSha, refs: refs.map(r => bytesOf(r)),
      predecessor: predecessor ? bytesOf(predecessor) : null, kind });
    // The crops were prepared asynchronously: re-check before the claim, so nothing is claimed after a change during preparation.
    check();
    return args.meter.run(step, digestImages(payload), 600000, async () => {
      cancelled(); const client = new OpenAI({ apiKey: args.key(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off' });
      const raw = await client.responses.create(payload, { signal: args.signal, timeout: 300000 });
      const estimatedMicroUsd = raw.model === REVIEW_MODEL && raw.service_tier === 'default' ? auditionUsageCost(raw.usage, 'sol') : null;
      const receipt = { raw, estimatedMicroUsd };
      if (raw.status !== 'completed' || raw.model !== REVIEW_MODEL || !raw.output_text || !raw.usage || raw.usage.output_tokens > 12000)
        throw Object.assign(new ReviewedAuditionError('audition_pixel_provider_invalid'), { receipt });
      try { return { value: (kind === 'page' ? auditionPageReviewSchema : auditionReviewSchema).parse(JSON.parse(raw.output_text)), estimatedMicroUsd, receipt }; }
      catch { throw Object.assign(new ReviewedAuditionError('audition_pixel_schema'), { receipt }); }
    });
  };
  const identity = async (step: string, reference: AuditionImage, candidate: AuditionImage) => {
    check(); let transportError: unknown = null;
    const result = await evaluatePageChildResemblanceVision({ referenceImageUrl: dataUrl(bytesOf(reference)), candidateImageUrl: dataUrl(bytesOf(candidate)),
      threshold: .7, model: 'gpt-4o', apiKey: 'credential-is-injected-only-after-claim', maxRetries: 0, shouldStartAttempt: () => !args.signal.aborted,
      fetchImpl: async (url, init) => {
        check(); const wire = JSON.parse(String(init!.body));
        return args.meter.run(step, digestImages(wire), 50000, async () => {
          const response = await fetch(url, { ...init, signal: AbortSignal.any([args.signal, init!.signal!]),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.key()}` } });
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
  return { check, writeImage, bytesOf, render, judge, identity };
}

// ---------------------------------------------------------------------------------------------------------------
// Runner.
// ---------------------------------------------------------------------------------------------------------------
/**
 * A re-plan folder is admitted only for a rejudge of its producer-granted compared pages, under an audition grant that names that exact
 * folder (producer grant and sealed index): a consistently rewritten folder cannot borrow another approval. No render, no resume.
 * A legacy run (no re-plan) refuses a grant that names one.
 */
export function assertReplanAuditionScope(scope: AuditionGrant['scope'],
  replan: { producerGrantSha256: string; indexSha256: string; pairPages: number[] } | undefined, resume: boolean) {
  if (!replan) { if (scope.mode === 'rejudge' && scope.replan) fail('audition_replan_scope'); return; }
  if (scope.mode !== 'rejudge' || resume || !scope.replan || scope.replan.producerGrantSha256 !== replan.producerGrantSha256 ||
      scope.replan.indexSha256 !== replan.indexSha256 || scope.frames.some(f => !replan.pairPages.includes(f.pageNumber))) fail('audition_replan_scope');
}

export async function runReviewedAudition(args: { bookDir: string; out: string; keyFile: string; grantFile: string; signal: AbortSignal;
  log: (line: string) => void; resume?: true; storyboardDir?: string; layout?: ReviewedBookLayout;
  /** Required exactly for a grant issued to an experiment: its slot, claim and guard (claim + source pin), run before every paid call. */
  experiment?: { slot: string; claimSha256: string; guard: () => void } }) {
  args.experiment?.guard();
  const loaded = loadReviewedBook(args.bookDir, process.cwd(), args.storyboardDir, args.layout);
  const { grant, sha256: grantSha256 } = readAuditionGrant(args.grantFile, { requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest });
  if (!!grant.experiment !== !!args.experiment || grant.experiment && (grant.experiment.slot !== args.experiment!.slot ||
      grant.experiment.claimSha256 !== args.experiment!.claimSha256)) fail('audition_experiment_guard');
  assertReplanAuditionScope(grant.scope, loaded.replan, args.resume === true);
  if (existsSync(args.out) !== !!args.resume) fail(args.resume ? 'audition_resume_missing' : 'audition_out_exists');
  if (!args.resume) mkdirSync(args.out); realDirectory(args.out);
  const directory = path.join(args.out, 'illustrations'); if (!args.resume) mkdirSync(directory); realDirectory(directory);
  const meter = new AuditionMeter(path.join(args.out, 'paid-stages'), grant.capMicroUsd, grant.maxCalls, grant.ledger.priorKnownApiMicroUsd,
    grant.ledger.carriedUnresolvedMicroUsd ?? 0);
  const io = auditionAdapters({ directory, meter, key: keyReader(args.keyFile), signal: args.signal, ...(args.experiment ? { guard: args.experiment.guard } : {}) });
  const save = (name: string, value: unknown) => exclusiveJson(path.join(args.out, `${name}.json`), value);
  const admission = (child: AuditionImage, companion: AuditionImage) => JSON.parse(JSON.stringify({ version: 'reviewed-simple-book-audition-admission/v2',
    requestId: loaded.queued.requestId, sourceDigest: loaded.book.sourceDigest, storyboardDigest: loaded.book.storyboardDigest, child, companion,
    policy: REVIEWED_AUDITION_POLICY, grant: { file: args.grantFile, sha256: grantSha256 }, imageModel: 'gpt-image-2', imageQuality: 'low',
    reviewModel: REVIEW_MODEL, identityModel: 'gpt-4o',
    ...(loaded.replan ? { replan: { dir: loaded.replan.dir, indexSha256: loaded.replan.indexSha256, producerGrantSha256: loaded.replan.producerGrantSha256,
      pairPages: loaded.replan.pairPages } } : {}) }));
  let child: AuditionImage, companion: AuditionImage;
  let resume: Parameters<typeof illustrateReviewedAudition>[0]['resume'];
  if (args.resume) {
    // Same book, references, policy and grant; completed work is re-bound by the orchestrator, never trusted blindly.
    child = { imageName: 'reference_child.png', imageSha: previewSha(loaded.childBytes) };
    companion = { imageName: 'reference_companion.png', imageSha: previewSha(loaded.companionBytes) };
    io.bytesOf(child); io.bytesOf(companion);
    if (canonicalJson(read(path.join(args.out, 'admission.json'))) !== canonicalJson(admission(child, companion))) fail('audition_resume_admission');
    const optional = (name: string) => existsSync(path.join(args.out, `${name}.json`)) ? read(path.join(args.out, `${name}.json`)) : undefined;
    const markers = readdirSync(args.out).filter(n => /^resume-[0-9]+\.json$/.test(n)).length + 1;
    const pages = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => [n, optional(`page_${n}`)]).filter(([, p]) => p));
    resume = { designs: read(path.join(args.out, 'audition_sheet_designs.json')), sheets: { entities: optional('sheet_entities'), locations: optional('sheet_locations') },
      pages, stepPrefix: `r${markers}_` };
    save(`resume-${markers}`, { resumedPages: Object.keys(pages).map(Number), spendBefore: meter.snapshot(), at: new Date().toISOString() });
  } else {
    child = await io.writeImage('reference_child.png', loaded.childBytes);
    companion = await io.writeImage('reference_companion.png', loaded.companionBytes);
    save('admission', admission(child, companion));
  }
  const log = (line: string) => args.log(`${line} · new API ≈ $${(meter.snapshot().newKnownApiMicroUsd / 1e6).toFixed(3)}`);
  if (grant.scope.mode === 'rejudge') {
    if (args.resume) fail('audition_rejudge_resume');
    // Copy exactly the named saved images (sha-checked) from the earlier run; no render, no identity.
    const source = grant.scope.sourceDirectory; realDirectory(source);
    const copy = async (img: AuditionImage) => {
      const bytes = readFileSync(path.join(source, img.imageName));
      if (previewSha(bytes) !== img.imageSha) fail('audition_rejudge_source');
      return existsSync(path.join(directory, img.imageName)) ? (io.bytesOf(img), img) : io.writeImage(img.imageName, bytes);
    };
    const references = grantReferenceStatus({ entities: { ...grant.scope.references.entities, image: await copy(grant.scope.references.entities.image) },
      locations: { ...grant.scope.references.locations, image: await copy(grant.scope.references.locations.image) } });
    const frames = [];
    for (const f of grant.scope.frames) frames.push({ label: f.label, pageNumber: f.pageNumber, candidate: await copy(f.image), predecessor: f.predecessor ? await copy(f.predecessor) : null });
    const results = await rejudgeAudition({ book: loaded.book, rawReview: loaded.rawReview, current: loaded.current, companionDescription: loaded.companionDescription,
      canonical: [child, companion, references.entities.image, references.locations.image], references, frames, judge: io.judge, check: io.check, save });
    for (const r of results) log(`rejudge ${r.label} (page ${r.pageNumber}): ${r.status} ${JSON.stringify(r.assessment.counts)}`);
    const spend = meter.snapshot(); save('spend', spend);
    return { mode: 'rejudge' as const, results, spend };
  }
  const manifest = await illustrateReviewedAudition({ book: loaded.book, rawReview: loaded.rawReview, texts: loaded.texts, current: loaded.current,
    child, companion, companionDescription: loaded.companionDescription, pages: grant.scope.pages,
    ...(grant.scope.sample ? { sample: grant.scope.sample } : {}),
    render: io.render, judge: io.judge, identity: io.identity, check: io.check, save, ...(resume ? { resume } : {}),
    progress: e => log(`${e.phase} ${e.name} attempt ${e.attempt}: ${e.status}${e.counts ? ' ' + JSON.stringify(e.counts) : ''}${e.identity === undefined ? '' : ` identity=${e.identity ?? 'n/a'}`}${e.error ? ` error=${e.error}` : ''}`) });
  const images = new Map<string, string>();
  const used = [manifest.references.child, manifest.references.companion, manifest.references.entities, manifest.references.locations,
    ...manifest.pages.flatMap(p => [p.candidate, ...p.alternatives.map(a => a.candidate).filter((c): c is AuditionImage => !!c)])];
  for (const img of used) for (const size of ['full', 'thumb'] as const) {
    const bytes = io.bytesOf(img);
    images.set(`${img.imageName}:${size}`, size === 'full' ? dataUrl(bytes)
      : `data:image/jpeg;base64,${(await sharp(bytes).resize(320, 320).jpeg({ quality: 80 }).toBuffer()).toString('base64')}`);
  }
  exclusiveText(path.join(args.out, args.resume ? `book-${resume!.stepPrefix.slice(0, -1)}.html` : 'book.html'),
    reviewedAuditionHTML(manifest, { title: loaded.title, pages: loaded.pages }, (img, size) => images.get(`${img.imageName}:${size}`)!));
  const spend = meter.snapshot(); save(args.resume ? `spend-${resume!.stepPrefix.slice(0, -1)}` : 'spend', spend);
  return { mode: 'render' as const, manifest, spend };
}

/** Zero-provider admission, checks and prompt preview. */
export function dryRun(bookDir: string, storyboardDir?: string, layout?: ReviewedBookLayout) {
  const loaded = loadReviewedBook(bookDir, process.cwd(), storyboardDir, layout), designs = auditionSheetDesigns(loaded.book, loaded.texts);
  const ids = (d: { entities?: { id: string }[]; props?: { id: string }[]; locations?: { id: string }[]; landmarks?: { id: string }[] }) =>
    ({ entities: d.entities?.map(e => e.id), props: d.props?.map(e => e.id), locations: d.locations?.map(e => e.id), landmarks: d.landmarks?.map(e => e.id) });
  const checks = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => {
    const c = auditionPageChecks(loaded.book, n, loaded.companionDescription);
    return { page: n, notYetRevealed: c.notYetRevealed.map(x => x.id), cast: c.castIdentity.map(x => x.id), requirementIds: c.requirementIds.length };
  });
  // The landmark comparison catalogue is per book (identical on every page): shown here so it can be reviewed before any paid call.
  const landmarkCatalogue = auditionPageChecks(loaded.book, 0, loaded.companionDescription).uniqueLandmarks
    .map(l => ({ id: l.id, features: l.features.map(f => `${f.id} ${f.decisive ? "decisive" : "listed"} ${f.aspect}: ${f.text}`) }));
  return { requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest, title: loaded.title, landmarkCatalogue,
    ...(loaded.replan ? { replan: loaded.replan } : {}),
    pageDeferred: designs.pageDeferred.map(d => `${d.entityId}:${d.requirement} (${d.reason} -> ${d.verifiedOn})`),
    entitiesSheet: ids(designs.entities as never), locationsSheet: ids(designs.locations as never), checks,
    promptBytes: { entities: Buffer.byteLength(auditionSheetPrompt('entities', designs.entities)), locations: Buffer.byteLength(auditionSheetPrompt('locations', designs.locations)) } };
}

function argValue(name: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const bookDir = argValue('--book-dir') ?? fail('audition_args'), storyboardDir = argValue('--storyboard-dir'), layoutFile = argValue('--layout');
  // Absent: the one historical book's layout. A new book names its own layout file (routing only; every binding is recomputed).
  const layout = layoutFile === undefined ? undefined : readReviewedBookLayout(layoutFile);
  if (layout && storyboardDir !== undefined) fail('audition_args');
  if (storyboardDir !== undefined && !path.isAbsolute(storyboardDir)) fail('audition_args');
  if (!process.argv.includes('--execute')) { console.log(JSON.stringify(dryRun(bookDir!, storyboardDir, layout), null, 2)); }
  else {
    const out = argValue('--out') ?? fail('audition_args'), keyFile = argValue('--key-env-file') ?? fail('audition_args'), grantFile = argValue('--grant') ?? fail('audition_grant_required');
    if (![out!, keyFile!, grantFile!].every(p => path.isAbsolute(p))) fail('audition_args');
    process.env.GPT_IMAGE_EDIT_MAX_REFERENCES ??= '4';
    const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
    const started = Date.now();
    runReviewedAudition({ bookDir: bookDir!, out: out!, keyFile: keyFile!, grantFile: grantFile!, signal: controller.signal, ...(layout ? { layout } : {}),
      ...(process.argv.includes('--resume') ? { resume: true as const } : {}), ...(storyboardDir ? { storyboardDir } : {}),
      log: line => console.log(`[${((Date.now() - started) / 60000).toFixed(1)}m] ${line}`) })
      .then(result => console.log(JSON.stringify({ status: 'complete', mode: result.mode, spend: result.spend }, null, 2)))
      .catch(error => { console.error('FAILED', error?.code ?? error?.message ?? error); process.exitCode = 1; });
  }
}
