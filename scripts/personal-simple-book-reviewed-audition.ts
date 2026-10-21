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
  currentPersonalStoryboardFrame, storyboardOwnerAcceptance, type PersonalStoryboard } from '../lib/personal-wizard/storyboard';
import { simpleReferenceDesignContext, type AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { childAnchorAcceptanceVersions, childAnchorDescriptionRequest, childAnchorInspectionContext, assertChildAnchorInspectedAccepted,
  childAnchorPoseDescriptionRequest, CHILD_ANCHOR_POSE_VERSION } from '../lib/personal-wizard/child-anchor-style';
import { LANDMARK_KIND_CONTRACT_VERSION } from '../lib/personal-wizard/storyboard-landmark-kind';
import { STORYBOARD_MOMENTS_VERSION } from '../lib/personal-wizard/storyboard-moments';
import { SCENE_LOCATION_CONTRACT_VERSION } from '../lib/personal-wizard/storyboard-scene-location';
import { COMPILER_RULES_CONTRACT_VERSION } from '../lib/personal-wizard/storyboard-compiler-rules';
import { DRAWN_INSTANT_CONTRACT_VERSION } from '../lib/personal-wizard/storyboard-drawn-instant';
import { VISIBLE_MOMENT_CONTRACT_VERSION } from '../lib/personal-wizard/storyboard-visible-moment';
import { STORYBOARD_SELF_CHECK_VERSION, STORYBOARD_SELF_CHECK_NAMES_VERSION } from '../lib/personal-wizard/storyboard-self-check';
import { CLAIM_BASIS_CONTRACT_VERSION, CLAIM_BASIS_STAGING_FIELDS_VERSION } from '../lib/personal-wizard/storyboard-claim-basis';
import { STORYBOARD_CALIBRATION_VERSION } from '../lib/personal-wizard/storyboard-calibration';
import { STORYBOARD_PRESENCE_VERSION } from '../lib/personal-wizard/storyboard-presence';
import { STORYBOARD_REVIEW_IMPACT_VERSION } from '../lib/personal-wizard/storyboard-review-impact';
import { STAGE_RECOVERY_VERSION } from '../lib/personal-wizard/stage-recovery';
import { STORYBOARD_PRESERVATION_VERSION, storyboardPreservationDiff } from '../lib/personal-wizard/storyboard-preservation';
import { PARENT_STORYBOARD_DIR, replanGrantSchema } from './personal-storyboard-replan-grant';
import { illustrateReviewedAudition, rejudgeAudition, reviewedAuditionHTML, auditionSheetDesigns, auditionSheetPrompt, auditionPageChecks,
  auditionReviewSchema, auditionPageReviewSchema, auditionJudgeInstruction, AUDITION_IMPACTS, REVIEWED_AUDITION_POLICY, AUDITION_WORST_CASE_CALLS,
  AUDITION_SCALE_LINEUP_VERSION, reviewedAuditionPolicy, auditionSheetContext, sameSheetContext, ReviewedAuditionError, type ReferenceStatus, type SavedSheet }
  from '../lib/personal-wizard/simple-book-reviewed-audition';
import { auditionUsageCost, SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from './personal-simple-book-illustrator';
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
  savedCompanion: z.string().regex(/^[A-Za-z0-9_.-]{1,80}\/illustrations\/[a-z0-9_]+\.png$/).refine(s => folder.safeParse(s.split('/')[0]).success).nullable(),
  /**
   * Opt-in (fresh book, 2026-10-18): the child was adopted under child-anchor-inspection/v1, or child-anchor-materiality/v1 (owner amendment).
   * Absent: the legacy child check, unchanged.
   */
  childAnchor: z.enum(childAnchorAcceptanceVersions).optional(),
  /**
   * Opt-in (2026-10-21), only with childAnchor: the adopted anchor's context binds the pose clause of child-anchor-visible-pose/v1 (its
   * request is the pose description request). Absent: the context exactly as before.
   */
  childAnchorPose: z.literal(CHILD_ANCHOR_POSE_VERSION).optional() }).strict()
  .refine(l => l.childAnchorPose === undefined || l.childAnchor !== undefined, 'audition_layout_child_anchor_pose');
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

/** A repaired storyboard's saved repair input (the held parent's draft and raw review), beside its result. */
export const STORYBOARD_REPAIR_INPUT_FILE = 'storyboard_repair_input.json';
/** The owner's acceptance of a held storyboard (storyboard-owner-acceptance/v1), beside its result, present exactly when used under it. */
export const STORYBOARD_OWNER_ACCEPTANCE_FILE = 'storyboard_owner_acceptance.json';

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

/** The drawn-instant contract flag comes only from the saved, digest-bound book (never a CLI argument); an unknown marker is refused. */
export function savedDrawnInstantContract(savedBook: { drawnInstant?: unknown } | undefined): true | undefined {
  const marker = savedBook?.drawnInstant;
  if (marker === undefined) return undefined;
  return marker === DRAWN_INSTANT_CONTRACT_VERSION ? true : fail('audition_board_binding');
}

/** The scene-location contract flag comes only from the saved, digest-bound book (never a CLI argument); an unknown marker is refused. */
export function savedSceneLocationContract(savedBook: { sceneLocation?: unknown } | undefined): true | undefined {
  const marker = savedBook?.sceneLocation;
  if (marker === undefined) return undefined;
  return marker === SCENE_LOCATION_CONTRACT_VERSION ? true : fail('audition_board_binding');
}

/** The visible-moment contract flag comes only from the saved, digest-bound book (never a CLI argument); an unknown marker is refused. */
export function savedVisibleMomentContract(savedBook: { visibleMoment?: unknown } | undefined): true | undefined {
  const marker = savedBook?.visibleMoment;
  if (marker === undefined) return undefined;
  return marker === VISIBLE_MOMENT_CONTRACT_VERSION ? true : fail('audition_board_binding');
}

/** The self-check contract flag comes only from the saved, digest-bound book (its self-check names its version); an unknown version is refused. */
export function savedSelfCheckContract(savedBook: { selfCheck?: { version?: unknown } } | undefined): true | undefined {
  if (savedBook?.selfCheck === undefined) return undefined;
  return savedBook.selfCheck?.version === STORYBOARD_SELF_CHECK_VERSION ? true : fail('audition_board_binding');
}

/** The typed review policy comes only from the saved, digest-bound book (never a CLI argument); an unknown marker is refused. */
export function savedReviewImpactPolicy(savedBook: { reviewImpact?: unknown } | undefined): true | undefined {
  const marker = savedBook?.reviewImpact;
  if (marker === undefined) return undefined;
  return marker === STORYBOARD_REVIEW_IMPACT_VERSION ? true : fail('audition_board_binding');
}

/** The compile-level section-name resolution comes only from the saved, digest-bound book (its marker); an unknown marker is refused. */
export function savedSelfCheckNames(savedBook: { selfCheckNames?: unknown } | undefined): { selfCheckNames: true } | undefined {
  const marker = savedBook?.selfCheckNames;
  if (marker === undefined) return undefined;
  return marker === STORYBOARD_SELF_CHECK_NAMES_VERSION ? { selfCheckNames: true } : fail('audition_board_binding');
}

/** The claim basis comes only from the saved, digest-bound book (its marker names the version); an unknown version is refused. */
export function savedClaimBasisContract(savedBook: { claimBasis?: { version?: unknown } } | undefined): true | undefined {
  if (savedBook?.claimBasis === undefined) return undefined;
  return savedBook.claimBasis?.version === CLAIM_BASIS_CONTRACT_VERSION ? true : fail('audition_board_binding');
}

/** The compile-level staging-fields correction comes only from the saved, digest-bound book (its marker); an unknown marker is refused. */
export function savedStagingFields(savedBook: { stagingFields?: unknown } | undefined): { stagingFields: true } | undefined {
  const marker = savedBook?.stagingFields;
  if (marker === undefined) return undefined;
  return marker === CLAIM_BASIS_STAGING_FIELDS_VERSION ? { stagingFields: true } : fail('audition_board_binding');
}

/** The calibration contract comes only from the saved, digest-bound book (its marker names the version); an unknown version is refused. */
export function savedCalibrationContract(savedBook: { calibration?: { version?: unknown } } | undefined): true | undefined {
  if (savedBook?.calibration === undefined) return undefined;
  return savedBook.calibration?.version === STORYBOARD_CALIBRATION_VERSION ? true : fail('audition_board_binding');
}
/** The presence contract comes only from the saved, digest-bound book (its marker names the version); an unknown version is refused. */
export function savedPresenceContract(savedBook: { presence?: { version?: unknown } } | undefined): true | undefined {
  if (savedBook?.presence === undefined) return undefined;
  return savedBook.presence?.version === STORYBOARD_PRESENCE_VERSION ? true : fail('audition_board_binding');
}

/** A reviewed storyboard's admitted status: supported, or supported with bound detail notes (typed policy; the recomputed disposition decides). */
const admittedStatus = (status: unknown) => status === 'review_supported' || status === 'review_supported_with_notes';

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
  // The owner's acceptance of a held storyboard, present exactly when this storyboard is used under it: the saved result is then the held one
  // (its own review's disposition; a held run saves no frames) and every frame is built under that bound acceptance (storyboardOwnerAcceptance).
  const acceptanceFile = path.join(visual, STORYBOARD_OWNER_ACCEPTANCE_FILE);
  const ownerAcceptance: unknown = existsSync(acceptanceFile) ? read(acceptanceFile) : undefined;
  const held = (status: unknown) => status === 'held_uncertain' || status === 'held_contradiction';
  if ((ownerAcceptance === undefined ? !admittedStatus(result.status) || result.storyboard?.status !== result.status
    : !held(result.status) || result.storyboard?.status !== result.status) || result.runtimeEligible !== false) fail('audition_result_status');
  // The story was written under this book's seed (it picked the story shape): another layout seed is another book.
  if (result.source?.simpleSource?.evidence?.seed !== prepared.seed) fail('audition_request_binding');
  // The rebuilt source must reproduce the saved markers exactly: a stripped or added marker changes the digests and fails the board binding.
  const saved = result.storyboard?.storyboard;
  // A repaired storyboard's source includes its saved repair input (the held parent's draft and review), present exactly when the saved book
  // names its parent; the engine re-binds that input to the parent (and the parent's review must hold it), and any other input changes the
  // source digest and fails the board binding the same way.
  const repairFile = path.join(visual, STORYBOARD_REPAIR_INPUT_FILE);
  if (existsSync(repairFile) !== (saved?.repair !== undefined)) fail('audition_repair_binding');
  const source = prepareCurrentPersonalStoryboard(queued.request, result.source, options, true, savedMomentContract(saved), savedLandmarkKindContract(saved),
    undefined, savedSceneLocationContract(saved), savedCompilerRulesContract(saved), existsSync(repairFile) ? read(repairFile) : undefined,
    savedDrawnInstantContract(saved), savedVisibleMomentContract(saved), savedSelfCheckContract(saved), savedReviewImpactPolicy(saved),
    savedClaimBasisContract(saved), savedCalibrationContract(saved), savedPresenceContract(saved));
  const parentDraft = read(path.join(visual, 'owned_storyboard_draft.json'));
  const names = savedSelfCheckNames(saved), fields = savedStagingFields(saved);
  const book = names || fields ? compilePersonalStoryboard(source, parentDraft, { ...names, ...fields }) : compilePersonalStoryboard(source, parentDraft);
  // The book binds first: a changed book refuses here before its saved review is read (the review names the saved book's digests).
  const rawReview = result.storyboard.rawReview, disposition = () => storyboardReviewDisposition(book, rawReview).disposition;
  if (canonicalJson(book) !== canonicalJson(result.storyboard.storyboard) || !book.plan.actorAppearance ||
      (ownerAcceptance === undefined ? disposition() !== result.status || result.storyboard.framePackets.length !== 9
        : disposition() !== result.status || result.storyboard.framePackets.length !== 0)) fail('audition_board_binding');
  const current = { request: queued.request, writerResult: result.source, options };
  if (ownerAcceptance === undefined) {
    for (let n = 0; n <= 8; n++) if (canonicalJson(currentPersonalStoryboardFrame(book, rawReview, n, current)) !== canonicalJson(result.storyboard.framePackets[n])) fail('audition_frame_binding');
    return { queued, options, prepared, result, source, parentDraft, book, rawReview, current };
  }
  // Every frame builds under the acceptance (it binds this book, this review and all of its unsupported checks, or the engine refuses).
  for (let n = 0; n <= 8; n++) currentPersonalStoryboardFrame(book, rawReview, n, current, ownerAcceptance);
  return { queued, options, prepared, result, source, parentDraft, book, rawReview, current, ownerAcceptance };
}

/** The written child design a reference must show, under the active storyboard's wardrobe and owned clothing. */
export const reviewedChildDesign = (prepared: { brief: { child: { age: number; address: string } } }, book: PersonalStoryboard, layout: ReviewedBookLayout) =>
  ({ age: prepared.brief.child.age, address: prepared.brief.child.address, fictionalDesign: layout.childDesign,
    wardrobe: book.plan.wardrobe, role: 'child', clothing: book.plan.actorAppearance!.child.clothing });

export function loadReviewedBook(bookDir: string, workspace = process.cwd(), replanDir?: string, layout: ReviewedBookLayout = LEGACY_BOOK_LAYOUT) {
  const loadedBoard = loadReviewedStoryboard(bookDir, workspace, layout);
  const { queued, options, prepared, result, source, parentDraft, book, rawReview, current } = loadedBoard;
  const ownerAcceptance = 'ownerAcceptance' in loadedBoard ? loadedBoard.ownerAcceptance : undefined;
  // A re-plan's parent is a supported storyboard; an owner-accepted held one is never re-planned here.
  if (replanDir !== undefined && ownerAcceptance !== undefined) fail('audition_replan_owner_acceptance');
  // Optional re-plan (never the default): the child and companion references below are then checked against ITS storyboard.
  const replan = replanDir === undefined ? undefined
    : admitReplanStoryboard({ bookDir, request: queued.request, options, source: result.source, book, rawReview, draft: parentDraft }, replanDir);
  const active = replan ?? { result, book, rawReview, current, companionDescription: source.companionDescription };
  // Child: the reviewed, passed reference adopted for this book, bound to its recomputed original context.
  const childDir = path.join(bookDir, layout.childDir);
  const adoption = read(path.join(childDir, 'reference_child_adoption.json'));
  const childContext = simpleReferenceDesignContext(reviewedChildDesign(prepared, active.book, layout));
  const childBytes = readFileSync(path.join(childDir, 'illustrations', layout.childImage));
  if (layout.childAnchor) {
    // The inspected anchor: its context is rebuilt from this book (age, address, written design, active wardrobe), the request the
    // anchor's renderer plans and the layout's acceptance version; both settled answers must bind this candidate and THAT context and pass together.
    // Under the layout's pose contract the request is the pose description request and the view binds its pose clause.
    const child = { age: prepared.brief.child.age, gender: prepared.brief.child.address as 'boy' | 'girl', design: layout.childDesign, wardrobe: active.book.plan.wardrobe };
    const authority = layout.childAnchorPose
      ? childAnchorInspectionContext(child, childAnchorPoseDescriptionRequest(child).prompt, layout.childAnchor, layout.childAnchorPose)
      : childAnchorInspectionContext(child, childAnchorDescriptionRequest(child).prompt, layout.childAnchor);
    if (adoption.name !== 'child' || canonicalJson(adoption.context) !== canonicalJson(authority) || previewSha(childBytes) !== adoption.candidate?.imageSha)
      fail('audition_child_reference');
    try { assertChildAnchorInspectedAccepted(adoption.anchor, previewSha(childBytes), authority); } catch { fail('audition_child_reference'); }
  } else if (adoption.name !== 'child' || canonicalJson(adoption.context) !== canonicalJson(childContext) || previewSha(childBytes) !== adoption.candidate.imageSha ||
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
      comparability: replan.comparability } } : {}), ...(ownerAcceptance !== undefined ? { ownerAcceptance } : {}) };
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
      sample: z.array(z.number().int().min(1).max(8)).min(1).max(2).optional(),
      /** Optional common-scale lineup on the entities sheet (the only source of that flag for a paid run). Absent on every legacy grant. */
      scaleLineup: z.literal(AUDITION_SCALE_LINEUP_VERSION).optional(),
      /** Optional diagnostic comparison: these saved sheets of an earlier run of the same book are reused as judged there. Absent on every legacy grant. */
      reuseSheets: z.object({ sourceRun: z.string().min(1), roles: z.array(z.enum(['entities', 'locations'])).min(1).max(2) }).strict().optional(),
      /** Optional diagnostic comparison: at most this many attempts per page. Absent on every legacy grant. */
      pageAttempts: z.number().int().min(1).max(REVIEWED_AUDITION_POLICY.pageAttempts).optional(),
      /** Optional stage-recovery/v1 page rule (diagnosis after two held attempts, same ceiling); the only source of that flag. Absent on every legacy grant. */
      recovery: z.literal(STAGE_RECOVERY_VERSION).optional() }).strict(),
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
  if (g.scope.mode === 'render' && g.scope.reuseSheets && new Set(g.scope.reuseSheets.roles).size !== g.scope.reuseSheets.roles.length)
    ctx.addIssue({ code: 'custom', message: 'audition_grant_reuse' });
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
 * One paid call kind's live rule, for a meter that re-derives its OWN calls (opt-in): the claim maximum its bound request derives (null for a
 * request that is not this kind's), and how its saved raw provider answer settles (`completed`: the meter recorded a completed call).
 */
export type MeterRule = { reserve: (wire: any) => number | null;
  settle: (wire: any, receipt: any, completed: boolean) => { estimatedMicroUsd: number | null; coherent: boolean } };
/** The rule of each step a meter may claim; undefined for any other step. */
export type MeterRules = (step: string) => MeterRule | undefined;
const attempt = <T>(f: () => T) => { try { return f(); } catch { return null; } };
const ruleOf = (rules: MeterRules, step: string) => rules(step) ?? fail('audition_meter_rule');
/** The maximum a rule derives for a request. A request it cannot price has none: refused, never matched by an absent one. */
const ruledMaximum = (rule: MeterRule, wire: unknown) => attempt(() => rule.reserve(wire)) ?? fail('audition_meter_cost');
/** A meter folder's own records: one call's request, claim, result, receipt or failure, named by the call's step. */
const METER_RECORD = /^([a-z][a-z0-9_]{0,79})\.(wire|claim|result|receipt|failure)\.json$/;
/**
 * Every call of one meter folder, re-derived from its own evidence under its step's rule: the request its claim bound before the call (digest,
 * and the positive integer maximum that request derives) and, once settled, its raw provider answer (the cost it settles to, which the result
 * and receipt must record exactly; a completed call must be a valid answer). The folder holds nothing but records of claimed calls: a
 * surviving request, result, receipt or failure whose claim is missing, or any other entry, refuses, so no paid evidence is left out of the sum.
 * Claims are numbered 0..n-1 without a gap. An unknown step, or a missing, unreadable or contradictory record refuses; nothing is repaired.
 * Returns exactly the claim and result records it verified.
 */
export function verifyMeterRecords(root: string, rules: MeterRules) {
  const record = (file: string) => { try { return read(file); } catch { return fail('audition_meter_record'); } };
  const entries = readdirSync(root).map(name => METER_RECORD.exec(name) ?? fail('audition_meter_record'));
  const claimed = [...new Set(entries.filter(([, , kind]) => kind === 'claim').map(([, step]) => step))].sort();
  if (entries.some(([, step]) => !claimed.includes(step))) fail('audition_meter_record');
  const records = claimed.map(step => {
    const rule = ruleOf(rules, step);
    const at = (kind: string) => path.join(root, `${step}.${kind}.json`), claim = record(at('claim')), wire = record(at('wire'));
    if (claim?.step !== step || previewSha(canonicalJson(wire)) !== claim.wireDigest) fail('audition_meter_record');
    if (ruledMaximum(rule, wire) !== claim.maximumMicroUsd) fail('audition_meter_cost');
    if (!existsSync(at('result'))) return { claim, result: null };
    const result = record(at('result')), completed = result?.completed;
    if (typeof completed !== 'boolean' || result.wireDigest !== claim.wireDigest) fail('audition_meter_record');
    const receipt = completed ? record(at('receipt')) : record(at('failure'))?.receipt;
    const settled = attempt(() => rule.settle(wire, receipt, completed)), cost = settled?.estimatedMicroUsd;
    if (!settled?.coherent || cost !== result.estimatedMicroUsd ||
        receipt && typeof receipt === 'object' && 'estimatedMicroUsd' in receipt && receipt.estimatedMicroUsd !== cost) fail('audition_meter_cost');
    return { claim, result };
  });
  if (records.map(r => r.claim.seq as number).sort((a, b) => a - b).some((seq, i) => seq !== i)) fail('audition_meter_record');
  return records;
}

/**
 * Journals every paid call before dispatch. Prior spend is an explicit input. An unknown cost or an unknown outcome
 * (a claim without a result) stops further paid calls instead of hiding behind a reservation; two consecutive failed
 * calls stop the run instead of retrying silently.
 */
export class AuditionMeter {
  /**
   * `carriedUnresolvedMicroUsd`: an earlier call's cost that is still unknown, carried explicitly by an owner-approved continuation. It is
   * never known spend: it counts against the cap like a reservation and is reported on its own (absent when zero, as on every legacy run).
   * `rules` (opt-in): every snapshot, and so every claim and every resume, first re-derives each of this meter's own calls from its bound
   * request and raw answer (verifyMeterRecords) and sums exactly those records; absent, the saved records are summed as they are.
   */
  constructor(readonly root: string, readonly capMicroUsd: number, readonly maxCalls: number, readonly priorKnownApiMicroUsd = 0,
    readonly carriedUnresolvedMicroUsd = 0, readonly rules?: MeterRules) {
    if (![capMicroUsd, maxCalls, priorKnownApiMicroUsd, carriedUnresolvedMicroUsd].every(Number.isSafeInteger) || carriedUnresolvedMicroUsd < 0 ||
      capMicroUsd <= priorKnownApiMicroUsd + carriedUnresolvedMicroUsd ||
      capMicroUsd - priorKnownApiMicroUsd > 8000000 || maxCalls < 1 || maxCalls > AUDITION_WORST_CASE_CALLS + REVIEWED_AUDITION_POLICY.pageAttempts * 3) fail('audition_meter_policy');
    if (!existsSync(root)) mkdirSync(root); realDirectory(root);
  }
  snapshot() {
    const records = this.rules ? verifyMeterRecords(this.root, this.rules) : readdirSync(this.root).filter(n => n.endsWith('.claim.json')).map(name => {
      const file = path.join(this.root, name.replace('.claim.', '.result.'));
      return { claim: JSON.parse(readFileSync(path.join(this.root, name), 'utf8')), result: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null };
    });
    let newKnownApiMicroUsd = 0, reservedUnsettledMicroUsd = 0, calls = 0, failed = 0, unknownCost = 0, unknownOutcome = 0;
    const settled: { seq: number; stage: string; completed: boolean }[] = [];
    for (const { claim, result } of records) {
      calls++;
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
    const cumulativeAccountedMicroUsd = this.priorKnownApiMicroUsd + this.carriedUnresolvedMicroUsd + newKnownApiMicroUsd + reservedUnsettledMicroUsd;
    if (this.rules && ![newKnownApiMicroUsd, reservedUnsettledMicroUsd, cumulativeAccountedMicroUsd].every(Number.isSafeInteger)) fail('audition_meter_cost');
    return { priorKnownApiMicroUsd: this.priorKnownApiMicroUsd, newKnownApiMicroUsd, reservedUnsettledMicroUsd,
      ...(this.carriedUnresolvedMicroUsd ? { carriedUnresolvedMicroUsd: this.carriedUnresolvedMicroUsd } : {}),
      cumulativeAccountedMicroUsd,
      capMicroUsd: this.capMicroUsd, calls, maxCalls: this.maxCalls, failed, unknownCost, unknownOutcome,
      repeatedFailure,
      claudeMax: 'separate: not an API invoice, not $0 and not included' as const };
  }
  async run<T>(step: string, wire: unknown, maximumMicroUsd: number,
    dispatch: () => Promise<{ value: T; estimatedMicroUsd: number | null; receipt: unknown }>) {
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(step) || !Number.isSafeInteger(maximumMicroUsd) || maximumMicroUsd < 1) fail('audition_meter_policy');
    // Opted in: the new call is priced under its own rule, from the request exactly as it will be journaled, before anything is written, read
    // or sent. An unknown step, a request of another kind, or a maximum that is not the one its request derives refuses here.
    if (this.rules && ruledMaximum(ruleOf(this.rules, step), attempt(() => JSON.parse(JSON.stringify(wire)))) !== maximumMicroUsd) fail('audition_meter_cost');
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
  // Chosen from the judged context: an entities design carrying the opt-in lineup gets its checks; anything else the existing instruction.
  const instructions = auditionJudgeInstruction(args.kind, args.context);
  if (imageURLs.length > 10 || Buffer.byteLength(text + instructions, 'utf8') > 104000) fail('audition_pixel_input_limit');
  return { model: REVIEW_MODEL, store: false, service_tier: 'default' as const, reasoning: { effort: 'medium' as const }, instructions,
    input: [{ role: 'user' as const, content: [{ type: 'input_text' as const, text },
      ...imageURLs.map(image_url => ({ type: 'input_image' as const, image_url, detail: 'high' as const }))] }],
    max_output_tokens: 12000, text: { format: args.kind === 'page' ? zodTextFormat(auditionPageReviewSchema, 'personal_audition_pixels_v4')
      : zodTextFormat(auditionReviewSchema, 'personal_audition_pixels_v2') } };
}

// The paid adapters' own terms, shared by each live call and its meter rule (a re-derivation is the live call's own rule, never a second table).
/** A render: its pricing label and claim maximum (every prompt byte and reference at the image input rate, plus its output reservation). */
const RENDER_PRICING = 'image_input_8_output_30_conservative_no_cache';
export const renderMaximum = (prompt: string, references: number) => Buffer.byteLength(prompt, 'utf8') * 8 + references * 8192 * 8 + 8192 * 30;
/** A pixel review: its cost (Sol at the default tier, long-input rate included) and a usable answer (complete, at most 12,000 output tokens). */
const reviewCost = (raw: any) => raw.model === REVIEW_MODEL && raw.service_tier === 'default' ? auditionUsageCost(raw.usage, 'sol') : null;
const reviewAnswered = (raw: any) => raw.status === 'completed' && raw.model === REVIEW_MODEL && !!raw.output_text && !!raw.usage && !(raw.usage.output_tokens > 12000);
/** An identity measurement: its cost (a known gpt-4o model with usage) and a usable answer (HTTP 2xx, at most 180 completion tokens). */
const IDENTITY_MODEL = 'gpt-4o', IDENTITY_MODELS = [IDENTITY_MODEL, 'gpt-4o-2024-08-06', 'gpt-4o-2024-11-20'];
export const IDENTITY_MAXIMUM_MICRO_USD = 50000;
const identityCost = (raw: any) => auditionUsageCost(IDENTITY_MODELS.includes(raw.model ?? '') && raw.usage
  ? { input_tokens: raw.usage.prompt_tokens, output_tokens: raw.usage.completion_tokens } : null, 'identity');
const identityAnswered = (raw: any, status: unknown) => typeof status === 'number' && status >= 200 && status <= 299 &&
  IDENTITY_MODELS.includes(raw.model ?? '') && !!raw.usage && !(raw.usage.completion_tokens > 180);
/**
 * The adapters' meter rules (opt-in). Each binds its own request shape and model, so a record renamed to another kind, or an edited receipt
 * label, never selects a cheaper rule; the cost always comes from the raw answer.
 */
export const auditionRenderRule: MeterRule = {
  reserve: wire => wire?.body?.model === 'gpt-image-2' && wire.body.quality === 'low' && wire.body.size === '1024x1024' && wire.body.n === 1 &&
    typeof wire.body.prompt === 'string' && Array.isArray(wire.references) && wire.retries === 0 && wire.pricing === RENDER_PRICING &&
    wire.outputReservationTokens === 8192 ? renderMaximum(wire.body.prompt, wire.references.length) : null,
  settle: (_wire, receipt, completed) => ({ estimatedMicroUsd: auditionUsageCost(receipt?.raw?.usage, 'image'), coherent: !completed || receipt?.model === 'gpt-image-2' }),
};
export const auditionReviewRule: MeterRule = {
  reserve: wire => wire?.model === REVIEW_MODEL && wire.service_tier === 'default' && wire.max_output_tokens === 12000 ? SOL_PIXEL_REVIEW_SLOT_MICRO_USD : null,
  settle: (_wire, receipt, completed) => { const raw = receipt?.raw;
    return { estimatedMicroUsd: raw == null ? null : reviewCost(raw), coherent: !completed || raw != null && reviewAnswered(raw) }; },
};
export const auditionIdentityRule: MeterRule = {
  reserve: wire => wire?.model === IDENTITY_MODEL && wire.max_tokens === 180 ? IDENTITY_MAXIMUM_MICRO_USD : null,
  settle: (_wire, receipt, completed) => { const raw = receipt?.raw;
    return { estimatedMicroUsd: raw == null ? null : identityCost(raw), coherent: !completed || raw != null && identityAnswered(raw, receipt.status) }; },
};
/**
 * The reviewed audition's own paid steps: sheet and page renders (each attempt; `rN_` on a resume), their reviews (`_qa`) and a page's identity
 * measurement (`_identity`), each with its adapter's rule. Any other step (a rejudge included) has none, so an opted-in meter refuses it.
 */
export const auditionMeterRules: MeterRules = step => {
  const m = /^(?:r[0-9]{1,2}_)?(sheet_entities|sheet_locations|page_[0-9]{1,2})_[0-9]{1,2}(_qa|_identity)?$/.exec(step);
  return !m ? undefined : m[2] === '_qa' ? auditionReviewRule : m[2] !== '_identity' ? auditionRenderRule : m[1].startsWith('page_') ? auditionIdentityRule : undefined;
};

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
  // 'anchor_photo_style_only' is production's real-photo anchor mode (photo first, then technique references), used only by the likeness probe.
  // 'style' is production's technique-reference mode, used only by the opt-in child-anchor-style/v1 anchor (pinned character-free references).
  const render = async (step: string, prompt: string, refs: AuditionImage[], mode: 'book_identity' | 'book_design' | 'identity' | 'anchor_photo_style_only' | 'style',
    roles?: readonly BookDesignReferenceRole[]) => {
    check(); const bytes = refs.map(bytesOf);
    const input = { finalPrompt: prompt, referenceImages: refs.map(r => path.join(args.directory, r.imageName)), referenceMode: mode,
      ...(roles ? { referenceRoles: roles } : {}), requireReferenceEdit: refs.length > 0, quality: 'low' as const, size: '1024x1024' as const,
      modelOverride: 'gpt-image-2', signal: args.signal, requestTimeoutMs: 180000 };
    const plan = planGPTImageRequest(input, { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
    if (plan.referenceCountPassed !== refs.length) fail('audition_reference_truncated');
    if (plan.bodyWithoutBinaryImage.model !== 'gpt-image-2' || plan.bodyWithoutBinaryImage.quality !== 'low' ||
        plan.bodyWithoutBinaryImage.size !== '1024x1024' || plan.bodyWithoutBinaryImage.n !== 1) fail('audition_image_price_contract');
    const wire = { body: plan.bodyWithoutBinaryImage, mode: plan.apiMode, references: refs, ...(plan.referenceRoles ? { referenceRoles: plan.referenceRoles } : {}),
      retries: 0, deadlineMs: 180000, pricing: RENDER_PRICING, outputReservationTokens: 8192 };
    const maximumMicroUsd = renderMaximum(plan.finalPrompt, refs.length);
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
    return args.meter.run(step, digestImages(payload), SOL_PIXEL_REVIEW_SLOT_MICRO_USD, async () => {
      cancelled(); const client = new OpenAI({ apiKey: args.key(), baseURL: 'https://api.openai.com/v1', maxRetries: 0, logLevel: 'off' });
      const raw = await client.responses.create(payload, { signal: args.signal, timeout: 300000 });
      const estimatedMicroUsd = reviewCost(raw);
      const receipt = { raw, estimatedMicroUsd };
      if (!reviewAnswered(raw)) throw Object.assign(new ReviewedAuditionError('audition_pixel_provider_invalid'), { receipt });
      try { return { value: (kind === 'page' ? auditionPageReviewSchema : auditionReviewSchema).parse(JSON.parse(raw.output_text)), estimatedMicroUsd, receipt }; }
      catch { throw Object.assign(new ReviewedAuditionError('audition_pixel_schema'), { receipt }); }
    });
  };
  const identity = async (step: string, reference: AuditionImage, candidate: AuditionImage) => {
    check(); let transportError: unknown = null;
    const result = await evaluatePageChildResemblanceVision({ referenceImageUrl: dataUrl(bytesOf(reference)), candidateImageUrl: dataUrl(bytesOf(candidate)),
      threshold: .7, model: IDENTITY_MODEL, apiKey: 'credential-is-injected-only-after-claim', maxRetries: 0, shouldStartAttempt: () => !args.signal.aborted,
      fetchImpl: async (url, init) => {
        check(); const wire = JSON.parse(String(init!.body));
        return args.meter.run(step, digestImages(wire), IDENTITY_MAXIMUM_MICRO_USD, async () => {
          const response = await fetch(url, { ...init, signal: AbortSignal.any([args.signal, init!.signal!]),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.key()}` } });
          const raw = await response.clone().json() as { model?: string; usage?: { prompt_tokens: number; completion_tokens: number } };
          const estimatedMicroUsd = identityCost(raw);
          const receipt = { raw, estimatedMicroUsd, status: response.status };
          if (!identityAnswered(raw, response.status)) throw Object.assign(new ReviewedAuditionError('audition_identity_provider_failed'), { receipt });
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

/**
 * A comparison's reused sheets, read from the earlier run of THIS book that its grant names. That run's admission names the same request,
 * storyboard, child and companion images; each named sheet is that run's own saved record, whose complete context is exactly the one this run
 * derives for it (`derived`; its claimed sha alone never binds); every judged attempt's saved review is exactly the raw answer its receipt
 * holds, judged on a request whose complete context is that same derived context, with the instruction this run would send for it. The
 * orchestrator then re-derives each sheet from those reviews under that context (illustrateReviewedAudition).
 */
/** The complete sheet contexts a run of this book derives for the named roles (the authority a reused sheet must describe exactly). */
export function derivedSheetContexts(book: Parameters<typeof auditionSheetDesigns>[0], texts: readonly string[], roles: readonly ('entities' | 'locations')[],
  scaleLineup?: boolean) {
  const designs = auditionSheetDesigns(book, texts, scaleLineup);
  return Object.fromEntries(roles.map(role => [role, auditionSheetContext(role, designs[role])])) as Partial<Record<'entities' | 'locations',
    ReturnType<typeof auditionSheetContext>>>;
}

export function readReusedSheets(reuse: { sourceRun: string; roles: readonly ('entities' | 'locations')[] },
  binding: { requestId: string; storyboardDigest: string; child: AuditionImage; companion: AuditionImage }, out: string,
  derived: Partial<Record<'entities' | 'locations', { context: unknown; contextSha: string }>>) {
  if (!path.isAbsolute(reuse.sourceRun) || path.resolve(reuse.sourceRun).toLowerCase() === path.resolve(out).toLowerCase()) fail('audition_reuse_source');
  realDirectory(reuse.sourceRun);
  const at = (...parts: string[]) => path.join(reuse.sourceRun, ...parts);
  const admissionText = fencedText(at('admission.json'), 2_000_000), admission = attempt(() => JSON.parse(admissionText));
  if (admission?.requestId !== binding.requestId || admission?.storyboardDigest !== binding.storyboardDigest ||
      canonicalJson(admission?.child ?? null) !== canonicalJson(binding.child) || canonicalJson(admission?.companion ?? null) !== canonicalJson(binding.companion)) fail('audition_reuse_source');
  const sheets: Partial<Record<'entities' | 'locations', SavedSheet>> = {}, files: Record<string, string> = {};
  for (const role of reuse.roles) {
    const text = fencedText(at(`sheet_${role}.json`), 8_000_000), saved = attempt(() => JSON.parse(text) as SavedSheet), expected = derived[role];
    if (!saved || !Array.isArray(saved.attempts) || !expected || !sameSheetContext(saved, expected)) return fail('audition_reuse_source');
    // The chosen image is the one the saved record names, by hash, before anything is written anywhere.
    const chosen = saved.chosen?.candidate, file = chosen && /^[a-z0-9_]+\.png$/.test(chosen.imageName) ? at('illustrations', chosen.imageName) : null;
    if (!file || !existsSync(file) || lstatSync(file).isSymbolicLink() || previewSha(readFileSync(file)) !== chosen!.imageSha) fail('audition_reuse_source');
    for (const a of saved.attempts) {
      if (!a.review) continue;
      const step = `sheet_${role}_${a.attempt}_qa`;
      const wire = attempt(() => read(at('paid-stages', `${step}.wire.json`))), receipt = attempt(() => read(at('paid-stages', `${step}.receipt.json`)));
      const request = attempt(() => JSON.parse(wire.input[0].content[0].text)), answer = attempt(() => auditionReviewSchema.parse(JSON.parse(receipt.raw.output_text)));
      if (!request || !answer || canonicalJson(answer) !== canonicalJson(a.review) || !sameSheetContext(request, expected) ||
          request.candidateSha !== a.candidate?.imageSha || wire.instructions !== auditionJudgeInstruction('sheet', expected.context)) fail('audition_reuse_source');
    }
    sheets[role] = saved; files[role] = previewSha(text);
  }
  return { sheets, binding: { sourceRun: path.resolve(reuse.sourceRun), admissionSha256: previewSha(admissionText), roles: [...reuse.roles], sheets: files } };
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
  // The common-scale lineup comes only from the grant (never a CLI argument); the admission names it, so a resume under another flag is refused.
  const scaleLineup = grant.scope.mode === 'render' && grant.scope.scaleLineup === AUDITION_SCALE_LINEUP_VERSION ? true as const : undefined;
  // A diagnostic comparison (render grants only): the earlier run's saved sheets it reuses (verified, against the contexts this run derives,
  // before anything is created here) and its bound on page attempts, both named by the admission.
  const renderScope = grant.scope.mode === 'render' ? grant.scope : null;
  // The page recovery rule comes only from the grant too; the admission names it, so a resume under another rule is refused.
  const recovery = renderScope?.recovery === STAGE_RECOVERY_VERSION ? true as const : undefined;
  const reused = renderScope?.reuseSheets ? readReusedSheets(renderScope.reuseSheets, { requestId: loaded.queued.requestId, storyboardDigest: loaded.book.storyboardDigest,
    child: { imageName: 'reference_child.png', imageSha: previewSha(loaded.childBytes) },
    companion: { imageName: 'reference_companion.png', imageSha: previewSha(loaded.companionBytes) } }, args.out,
    derivedSheetContexts(loaded.book, loaded.texts, renderScope.reuseSheets.roles, scaleLineup)) : null;
  if (existsSync(args.out) !== !!args.resume) fail(args.resume ? 'audition_resume_missing' : 'audition_out_exists');
  if (!args.resume) mkdirSync(args.out); realDirectory(args.out);
  const directory = path.join(args.out, 'illustrations'); if (!args.resume) mkdirSync(directory); realDirectory(directory);
  // An experiment's audition (its grant names it, so a start or resume without its guard is refused above) re-derives its own calls before
  // every claim, resume and spend record: opted in exactly here. Every other run sums its saved records as before.
  const meter = new AuditionMeter(path.join(args.out, 'paid-stages'), grant.capMicroUsd, grant.maxCalls, grant.ledger.priorKnownApiMicroUsd,
    grant.ledger.carriedUnresolvedMicroUsd ?? 0, args.experiment ? auditionMeterRules : undefined);
  const io = auditionAdapters({ directory, meter, key: keyReader(args.keyFile), signal: args.signal, ...(args.experiment ? { guard: args.experiment.guard } : {}) });
  const save = (name: string, value: unknown) => exclusiveJson(path.join(args.out, `${name}.json`), value);
  // A held storyboard used under the owner's acceptance names it (version and digest, as every page packet does); absent, the admission is as before.
  const accepted = 'ownerAcceptance' in loaded ? storyboardOwnerAcceptance(loaded.book, loaded.rawReview, loaded.ownerAcceptance) : null;
  const admission = (child: AuditionImage, companion: AuditionImage) => JSON.parse(JSON.stringify({ version: 'reviewed-simple-book-audition-admission/v2',
    requestId: loaded.queued.requestId, sourceDigest: loaded.book.sourceDigest, storyboardDigest: loaded.book.storyboardDigest, child, companion,
    policy: reviewedAuditionPolicy(scaleLineup), grant: { file: args.grantFile, sha256: grantSha256 }, imageModel: 'gpt-image-2', imageQuality: 'low',
    reviewModel: REVIEW_MODEL, identityModel: 'gpt-4o',
    ...(loaded.replan ? { replan: { dir: loaded.replan.dir, indexSha256: loaded.replan.indexSha256, producerGrantSha256: loaded.replan.producerGrantSha256,
      pairPages: loaded.replan.pairPages } } : {}), ...(accepted ? { ownerAcceptance: accepted } : {}),
    ...(scaleLineup ? { scaleLineup: AUDITION_SCALE_LINEUP_VERSION } : {}), ...(reused ? { reuseSheets: reused.binding } : {}),
    ...(renderScope?.pageAttempts !== undefined ? { pageAttempts: renderScope.pageAttempts } : {}),
    ...(recovery ? { recovery: STAGE_RECOVERY_VERSION } : {}) }));
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
  // The reused sheets' chosen images, copied by hash from the earlier run (once; a resume finds them in place, unchanged).
  for (const role of reused?.binding.roles ?? []) {
    const img = reused!.sheets[role]!.chosen.candidate;
    if (existsSync(path.join(directory, img.imageName))) { io.bytesOf(img); continue; }
    const bytes = readFileSync(path.join(reused!.binding.sourceRun, 'illustrations', img.imageName));
    if (previewSha(bytes) !== img.imageSha) fail('audition_reuse_source');
    await io.writeImage(img.imageName, bytes);
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
      canonical: [child, companion, references.entities.image, references.locations.image], references, frames, judge: io.judge, check: io.check, save,
      ...('ownerAcceptance' in loaded ? { ownerAcceptance: loaded.ownerAcceptance } : {}) });
    for (const r of results) log(`rejudge ${r.label} (page ${r.pageNumber}): ${r.status} ${JSON.stringify(r.assessment.counts)}`);
    const spend = meter.snapshot(); save('spend', spend);
    return { mode: 'rejudge' as const, results, spend };
  }
  const manifest = await illustrateReviewedAudition({ book: loaded.book, rawReview: loaded.rawReview, texts: loaded.texts, current: loaded.current,
    child, companion, companionDescription: loaded.companionDescription, pages: grant.scope.pages,
    ...(grant.scope.sample ? { sample: grant.scope.sample } : {}), ...('ownerAcceptance' in loaded ? { ownerAcceptance: loaded.ownerAcceptance } : {}),
    ...(scaleLineup ? { scaleLineup } : {}), ...(reused ? { reuseSheets: reused.sheets } : {}),
    ...(renderScope?.pageAttempts !== undefined ? { pageAttempts: renderScope.pageAttempts } : {}), ...(recovery ? { recovery } : {}),
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

/** Zero-provider admission, checks and prompt preview. `scaleLineup` previews the opt-in lineup (a paid run takes it from its grant only). */
export function dryRun(bookDir: string, storyboardDir?: string, layout?: ReviewedBookLayout, scaleLineup?: true) {
  const loaded = loadReviewedBook(bookDir, process.cwd(), storyboardDir, layout), designs = auditionSheetDesigns(loaded.book, loaded.texts, scaleLineup);
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
    ...(loaded.replan ? { replan: loaded.replan } : {}), ...(designs.entities.scaleLineup ? { scaleLineup: designs.entities.scaleLineup } : {}),
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
  // --scale-lineup previews the opt-in lineup in a dry run only: a paid run takes it from its grant, never from an argument.
  const previewLineup = process.argv.includes('--scale-lineup');
  if (previewLineup && process.argv.includes('--execute')) fail('audition_args');
  if (!process.argv.includes('--execute')) { console.log(JSON.stringify(dryRun(bookDir!, storyboardDir, layout, previewLineup ? true : undefined), null, 2)); }
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
