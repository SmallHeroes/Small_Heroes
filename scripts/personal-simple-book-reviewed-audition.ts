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
  childAnchorPoseDescriptionRequest, childAnchorPoseVersions, CHILD_ANCHOR_POSE_V2, CHILD_ANCHOR_MATERIALITY_VERSION } from '../lib/personal-wizard/child-anchor-style';
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
import { AUDITION_ANATOMY_VERSION } from '../lib/personal-wizard/audition-anatomy';
import { STORYBOARD_PRESERVATION_VERSION, storyboardPreservationDiff } from '../lib/personal-wizard/storyboard-preservation';
import { PARENT_STORYBOARD_DIR, replanGrantSchema } from './personal-storyboard-replan-grant';
import { illustrateReviewedAudition, rejudgeAudition, reviewedAuditionHTML, auditionSheetDesigns, auditionSheetPrompt, auditionPageChecks,
  auditionReviewSchema, auditionPageReviewSchema, auditionPageReviewSchemaForContext, auditionLandmarkTopology, auditionAnatomyCast, auditionJudgeInstruction, AUDITION_IMPACTS, REVIEWED_AUDITION_POLICY, AUDITION_WORST_CASE_CALLS,
  AUDITION_SCALE_LINEUP_VERSION, reviewedAuditionPolicy, auditionSheetContext, sameSheetContext, ReviewedAuditionError, AUDITION_ATTEMPT_INTERRUPTED,
  AUDITION_CALIBRATION_VERSION, AUDITION_TOPOLOGY_CONTINUATION_VERSION, LANDMARK_TOPOLOGY_VERSION,
  AUDITION_COVERAGE_CONTINUATION_VERSION, LANDMARK_COVERAGE_TOPOLOGY_VERSION,
  AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION, type AuditionFullBookDiagnostic,
  type AuditionAnatomyRecovery, type AuditionCoverageContinuation, type AuditionTopologyContinuation, type AuditionCalibration, type ReferenceStatus, type SavedSheet, type SavedPage, type AuditionAttempt } from '../lib/personal-wizard/simple-book-reviewed-audition';
import { auditionUsageCost, SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from './personal-simple-book-illustrator';
import { exclusiveJson, exclusiveText, fencedText, realDirectory } from './personal-causal-trial-journal';
import { DURABLE_REVIEW_VERSION, DurableReviewJournal, durableReviewJob } from './personal-durable-review';

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
   * Opt-in (2026-10-21), only with childAnchor: the adopted anchor's context binds the pose contract of child-anchor-visible-pose/v1 or /v2
   * (its request is that version's pose description request). Absent: the context exactly as before.
   */
  childAnchorPose: z.enum(childAnchorPoseVersions).optional() }).strict()
  .refine(l => l.childAnchorPose === undefined || l.childAnchor !== undefined, 'audition_layout_child_anchor_pose')
  // v2 binds the materiality contract's occlusion record: only beside the materiality acceptance.
  .refine(l => l.childAnchorPose !== CHILD_ANCHOR_POSE_V2 || l.childAnchor === CHILD_ANCHOR_MATERIALITY_VERSION, 'audition_layout_child_anchor_pose');
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
      ? childAnchorInspectionContext(child, childAnchorPoseDescriptionRequest(child, layout.childAnchorPose).prompt, layout.childAnchor, layout.childAnchorPose)
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
 * A conservative budget debit (opt-in, owner-approved, ONE journaled call each; never a default or a policy): the claim maximum of one paid
 * call that ended without a receipt, so its cost cannot be known, counted against the cap in place of that unknown while its actual charge
 * stays unknown. It binds exactly that record (its step, sequence, request digest and maximum, and the bytes of its claim, result and failure
 * records). It is never a receipt and never known spend, and it settles nothing else: any other unknown cost or outcome still stops the meter.
 */
export const AUDITION_CONSERVATIVE_DEBIT_VERSION = 'audition-conservative-debit/v1' as const;
export const conservativeDebitSchema = z.object({ version: z.literal(AUDITION_CONSERVATIVE_DEBIT_VERSION), step: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
  seq: z.number().int().nonnegative(), wireDigest: hash, maximumMicroUsd: z.number().int().positive(), debitMicroUsd: z.number().int().positive(),
  claimSha256: hash, resultSha256: hash, failureSha256: hash, actualCost: z.literal('unknown') }).strict()
  .refine(d => d.debitMicroUsd === d.maximumMicroUsd, 'audition_meter_debit');
export type ConservativeDebit = z.infer<typeof conservativeDebitSchema>;
/** Different from a failed-call debit: explicitly approved budget provision for ONE ID-less orphan; outcome AND charge stay UNKNOWN. */
export const orphanProvisionSchema = z.object({ version: z.literal('audition-orphan-provision/v1'), step: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
  seq: z.number().int().nonnegative(), wireDigest: hash, maximumMicroUsd: z.number().int().positive(), provisionMicroUsd: z.number().int().positive(),
  claimSha256: hash, wireSha256: hash, actualCost: z.literal('unknown'), actualOutcome: z.literal('unknown') }).strict()
  .refine(d => d.provisionMicroUsd === d.maximumMicroUsd, 'audition_orphan_provision');
export type OrphanProvision = z.infer<typeof orphanProvisionSchema>;
export function orphanProvisionOf(root: string, step: string): OrphanProvision {
  if (!/^[a-z][a-z0-9_]{0,79}$/.test(step)) fail('audition_orphan_provision');
  const at = (k: string) => path.join(root, `${step}.${k}.json`);
  if (!existsSync(at('claim')) || !existsSync(at('wire')) || ['result', 'receipt', 'failure'].some(k => existsSync(at(k)))) fail('audition_orphan_provision');
  const c = read(at('claim')), wire = read(at('wire'));
  if (c.step !== step || previewSha(canonicalJson(wire)) !== c.wireDigest) fail('audition_orphan_provision');
  return orphanProvisionSchema.parse({ version: 'audition-orphan-provision/v1', step, seq: c.seq, wireDigest: c.wireDigest,
    maximumMicroUsd: c.maximumMicroUsd, provisionMicroUsd: c.maximumMicroUsd, claimSha256: previewSha(readFileSync(at('claim'))),
    wireSha256: previewSha(readFileSync(at('wire'))), actualCost: 'unknown', actualOutcome: 'unknown' });
}
/** The conservative debit of one journaled call of a meter folder, derived from its own records only (the plan's one source of a debit). */
export function conservativeDebitOf(root: string, step: string): ConservativeDebit {
  const at = (kind: string) => path.join(root, `${step}.${kind}.json`);
  if (![at('wire'), at('claim'), at('result'), at('failure')].every(f => existsSync(f)) || existsSync(at('receipt'))) fail('audition_meter_debit');
  const claim = read(at('claim')), result = read(at('result')), failure = read(at('failure'));
  if (claim?.step !== step || result?.completed !== false || result.estimatedMicroUsd !== null || result.wireDigest !== claim.wireDigest ||
      failure?.receipt !== null) fail('audition_meter_debit');
  const parsed = conservativeDebitSchema.safeParse({ version: AUDITION_CONSERVATIVE_DEBIT_VERSION, step, seq: claim.seq, wireDigest: claim.wireDigest,
    maximumMicroUsd: claim.maximumMicroUsd, debitMicroUsd: claim.maximumMicroUsd, claimSha256: previewSha(readFileSync(at('claim'))),
    resultSha256: previewSha(readFileSync(at('result'))), failureSha256: previewSha(readFileSync(at('failure'))), actualCost: 'unknown' });
  return parsed.success ? parsed.data : fail('audition_meter_debit');
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
   * `debits` (opt-in, owner-approved): conservative debits, each of exactly ONE of this meter's own unknown-cost records (see
   * conservativeDebitSchema). A bound record counts its debit against the cap in place of the unknown and is reported on its own, never as
   * known spend; a debit that does not bind one such record exactly refuses. Absent: every snapshot exactly as before.
   */
  constructor(readonly root: string, readonly capMicroUsd: number, readonly maxCalls: number, readonly priorKnownApiMicroUsd = 0,
    readonly carriedUnresolvedMicroUsd = 0, readonly rules?: MeterRules, readonly debits: readonly ConservativeDebit[] = [],
    readonly orphanProvisions: readonly OrphanProvision[] = []) {
    if (![capMicroUsd, maxCalls, priorKnownApiMicroUsd, carriedUnresolvedMicroUsd].every(Number.isSafeInteger) || carriedUnresolvedMicroUsd < 0 ||
      capMicroUsd <= priorKnownApiMicroUsd + carriedUnresolvedMicroUsd ||
      capMicroUsd - priorKnownApiMicroUsd > 8000000 || maxCalls < 1 || maxCalls > AUDITION_WORST_CASE_CALLS + REVIEWED_AUDITION_POLICY.pageAttempts * 3) fail('audition_meter_policy');
    if (debits.some(d => !conservativeDebitSchema.safeParse(d).success) || new Set(debits.map(d => d.step)).size !== debits.length) fail('audition_meter_debit');
    if (orphanProvisions.length > 1 || orphanProvisions.some(p => !orphanProvisionSchema.safeParse(p).success || debits.some(d => d.step === p.step)))
      fail('audition_orphan_provision');
    if (!existsSync(root)) mkdirSync(root); realDirectory(root);
  }
  /** A debit binds exactly its one record: the record's own bytes, request digest, sequence and maximum; no receipt; cost still unknown. */
  private boundDebit(debit: ConservativeDebit, claim: any, result: any) {
    const at = (kind: string) => path.join(this.root, `${debit.step}.${kind}.json`);
    const sha = (kind: string) => existsSync(at(kind)) ? previewSha(readFileSync(at(kind))) : null;
    if (claim.step !== debit.step || claim.seq !== debit.seq || claim.wireDigest !== debit.wireDigest || claim.maximumMicroUsd !== debit.maximumMicroUsd ||
        result.completed !== false || result.estimatedMicroUsd !== null || existsSync(at('receipt')) || sha('claim') !== debit.claimSha256 ||
        sha('result') !== debit.resultSha256 || sha('failure') !== debit.failureSha256) fail('audition_meter_debit');
    return debit.debitMicroUsd;
  }
  snapshot() {
    const records = this.rules ? verifyMeterRecords(this.root, this.rules) : readdirSync(this.root).filter(n => n.endsWith('.claim.json')).map(name => {
      const file = path.join(this.root, name.replace('.claim.', '.result.'));
      return { claim: JSON.parse(readFileSync(path.join(this.root, name), 'utf8')), result: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null };
    });
    let newKnownApiMicroUsd = 0, reservedUnsettledMicroUsd = 0, calls = 0, failed = 0, unknownCost = 0, unknownOutcome = 0, conservativeDebitMicroUsd = 0;
    const settled: { seq: number; stage: string; completed: boolean }[] = [], debited = new Set<string>(), provisioned = new Set<string>();
    let orphanProvisionMicroUsd = 0;
    for (const { claim, result } of records) {
      calls++;
      const debit = this.debits.find(d => d.step === claim.step);
      const provision = this.orphanProvisions.find(p => p.step === claim.step);
      if (provision) {
        if (result || canonicalJson(orphanProvisionOf(this.root, claim.step)) !== canonicalJson(provision)) fail('audition_orphan_provision');
        orphanProvisionMicroUsd += provision.provisionMicroUsd; provisioned.add(provision.step); continue;
      }
      // A debit names a record whose outcome is settled (failed) and whose cost alone is unknown; anything else is not what it binds.
      if (debit && (!result || typeof result.estimatedMicroUsd === 'number')) fail('audition_meter_debit');
      if (!result) { unknownOutcome++; reservedUnsettledMicroUsd += claim.maximumMicroUsd; continue; }
      settled.push({ seq: claim.seq, stage: auditionStage(claim.step), completed: result.completed === true });
      if (!result.completed) failed++;
      if (typeof result.estimatedMicroUsd === 'number') newKnownApiMicroUsd += result.estimatedMicroUsd;
      else if (debit) { conservativeDebitMicroUsd += this.boundDebit(debit, claim, result); debited.add(debit.step); }
      else { unknownCost++; reservedUnsettledMicroUsd += claim.maximumMicroUsd; }
    }
    if (debited.size !== this.debits.length) fail('audition_meter_debit');
    if (provisioned.size !== this.orphanProvisions.length) fail('audition_orphan_provision');
    // Two consecutive failures overall, or in one logical stage even when calls of another stage succeeded in between.
    const lastTwo = (list: typeof settled) => { const two = list.slice(-2); return two.length === 2 && two.every(s => !s.completed); };
    const ordered = settled.sort((a, b) => a.seq - b.seq);
    const repeatedFailure = lastTwo(ordered) || [...new Set(ordered.map(s => s.stage))].some(stage => lastTwo(ordered.filter(s => s.stage === stage)));
    const cumulativeAccountedMicroUsd = this.priorKnownApiMicroUsd + this.carriedUnresolvedMicroUsd + newKnownApiMicroUsd + conservativeDebitMicroUsd +
      reservedUnsettledMicroUsd + orphanProvisionMicroUsd;
    if (this.rules && ![newKnownApiMicroUsd, reservedUnsettledMicroUsd, cumulativeAccountedMicroUsd].every(Number.isSafeInteger)) fail('audition_meter_cost');
    return { priorKnownApiMicroUsd: this.priorKnownApiMicroUsd, newKnownApiMicroUsd, reservedUnsettledMicroUsd,
      ...(this.carriedUnresolvedMicroUsd ? { carriedUnresolvedMicroUsd: this.carriedUnresolvedMicroUsd } : {}),
      // Opted in only: the conservative debits, apart from known spend; their calls' actual charge stays unknown.
      ...(this.debits.length ? { conservativeDebitMicroUsd, conservativeDebitCalls: debited.size, actualChargeUnknownCalls: debited.size } : {}),
      ...(this.orphanProvisions.length ? { orphanProvisionMicroUsd, provisionedOrphanCalls: provisioned.size,
        actualOutcomeUnknownCalls: provisioned.size, actualChargeUnknownCalls: debited.size + provisioned.size } : {}),
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
      // A durable provider job may still be running. Do not invent a settled failure (or a new attempt) from a local interruption.
      if (error && typeof error === 'object' && 'durableReviewPending' in error && error.durableReviewPending === true) throw error;
      const receipt = error && typeof error === 'object' && 'receipt' in error ? (error as { receipt: unknown }).receipt : null;
      const cost = receipt && typeof receipt === 'object' && 'estimatedMicroUsd' in receipt &&
        Number.isSafeInteger((receipt as { estimatedMicroUsd: unknown }).estimatedMicroUsd) ? (receipt as { estimatedMicroUsd: number }).estimatedMicroUsd : null;
      const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[a-z0-9_]+$/.test(error.code) ? error.code : 'audition_stage_failed';
      // The layer that ended the call, when the error carries one (2026-10-22); absent, the record exactly as before.
      const cause = causeChain(error);
      exclusiveJson(path.join(this.root, `${step}.failure.json`), { code, message: error instanceof Error ? error.message.slice(0, 500) : null, receipt,
        ...(cause.length ? { cause } : {}) });
      exclusiveJson(path.join(this.root, `${step}.result.json`), { wireDigest, estimatedMicroUsd: cost, completed: false });
      throw error;
    }
  }
  /**
   * Explicit reconciliation of ONE existing claim, never a new call/slot. Its transport MUST be the GET-only durable resume seam. The
   * original request/claim are checked before dispatch; the result is settled from the same raw answer under its own meter rule. Another
   * unknown still blocks. A receipt already fsynced before a crash is preserved byte-for-byte, not overwritten.
   */
  async recover<T>(step: string, wire: unknown, retrieve: () => Promise<{ value: T; estimatedMicroUsd: number | null; receipt: unknown }>) {
    if (!this.rules || !/^[a-z][a-z0-9_]{0,79}$/.test(step)) fail('audition_recovery_binding');
    const rules = this.rules ?? fail('audition_recovery_binding');
    const at = (kind: string) => path.join(this.root, `${step}.${kind}.json`), snapshot = this.snapshot();
    if (snapshot.unknownCost || snapshot.unknownOutcome !== 1 || !existsSync(at('claim')) || existsSync(at('result')))
      fail('audition_recovery_binding');
    const claim = read(at('claim')), wireDigest = previewSha(canonicalJson(wire));
    if (claim.step !== step || claim.wireDigest !== wireDigest || canonicalJson(read(at('wire'))) !== canonicalJson(wire) ||
        ruledMaximum(ruleOf(rules, step), wire) !== claim.maximumMicroUsd) fail('audition_recovery_binding');
    const claimSha256 = previewSha(readFileSync(at('claim'))), wireSha256 = previewSha(readFileSync(at('wire')));
    // A crash may leave exactly our first settlement write. Adopt only that actual-failure prefix, never a generic failure or a PASS.
    const priorFailureSha256 = existsSync(at('failure')) ? previewSha(readFileSync(at('failure'))) : null;
    const priorFailure = priorFailureSha256 === null ? null : read(at('failure'));
    if (priorFailureSha256 !== null) {
      if (!priorFailure || typeof priorFailure !== 'object' || Object.keys(priorFailure).sort().join(',') !== 'code,receipt' ||
          priorFailure.code !== 'audition_recovered_terminal_failure' || !priorFailure.receipt || existsSync(at('receipt')))
        fail('audition_recovery_binding');
      const settled = ruleOf(rules, step).settle(wire, priorFailure.receipt, false);
      if (!settled.coherent || settled.estimatedMicroUsd === null || settled.estimatedMicroUsd !== priorFailure.receipt.estimatedMicroUsd)
        fail('audition_recovery_binding');
    }
    const same = () => {
      const now = this.snapshot();
      if (previewSha(readFileSync(at('claim'))) !== claimSha256 || previewSha(readFileSync(at('wire'))) !== wireSha256 ||
          now.unknownCost || now.unknownOutcome !== 1 || existsSync(at('result')) ||
          (existsSync(at('failure')) ? previewSha(readFileSync(at('failure'))) : null) !== priorFailureSha256)
        fail('audition_recovery_binding');
    };
    let made: Awaited<ReturnType<typeof retrieve>>;
    try { made = await retrieve(); }
    catch (error) {
      // A terminal response may fail schema/status while still carrying real usage. Only an actual receipt may settle that failure.
      if (!error || typeof error !== 'object' || !('receipt' in error) || !error.receipt) throw error;
      same();
      const receipt = error.receipt as { estimatedMicroUsd?: number | null }, settled = ruleOf(rules, step).settle(wire, receipt, false);
      if (!settled.coherent || settled.estimatedMicroUsd !== receipt.estimatedMicroUsd || existsSync(at('receipt'))) fail('audition_meter_cost');
      if (priorFailureSha256 !== null) {
        if (canonicalJson(priorFailure.receipt) !== canonicalJson(receipt)) fail('audition_recovery_binding');
      } else exclusiveJson(at('failure'), { code: 'audition_recovered_terminal_failure', receipt });
      exclusiveJson(at('result'), { wireDigest, estimatedMicroUsd: settled.estimatedMicroUsd, completed: false });
      this.snapshot(); throw error;
    }
    same();
    if (priorFailureSha256 !== null) fail('audition_recovery_binding');
    const settled = ruleOf(rules, step).settle(wire, made.receipt, true);
    if (!settled.coherent || settled.estimatedMicroUsd !== made.estimatedMicroUsd) fail('audition_meter_cost');
    if (existsSync(at('receipt'))) {
      if (canonicalJson(read(at('receipt'))) !== canonicalJson(made.receipt)) fail('audition_recovery_binding');
    } else exclusiveJson(at('receipt'), made.receipt);
    exclusiveJson(at('result'), { wireDigest, estimatedMicroUsd: made.estimatedMicroUsd, completed: true });
    this.snapshot();
    if (made.estimatedMicroUsd === null) fail('audition_unknown_cost');
    return made.value;
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
    max_output_tokens: 12000, text: { format: args.kind === 'page' ? zodTextFormat(auditionPageReviewSchemaForContext(args.context),
      auditionAnatomyCast(args.context) ? 'personal_audition_pixels_anatomy_v2'
        : auditionLandmarkTopology(args.context) === LANDMARK_COVERAGE_TOPOLOGY_VERSION ? 'personal_audition_pixels_topology_v2'
        : auditionLandmarkTopology(args.context) ? 'personal_audition_pixels_topology_v1' : 'personal_audition_pixels_v4')
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

/**
 * The pixel review's client deadline (2026-10-21, after a page review was abandoned at 300 s with no receipt): a 12000-token answer at the
 * observed ~60 tokens/s takes ~200 s alone, so 600 s leaves room for a slow provider. Still no retries, the same model, output cap, request
 * and acceptance. A deadline is not proof of a provider failure or of a zero charge: a call it ends has no receipt, so its cost is unknown
 * and the meter stops.
 */
export const AUDITION_REVIEW_TIMEOUT_MS = 600_000;
/**
 * The review's own transport (2026-10-22, after both lost page reviews ended at ~300 s although the second one's SDK deadline was 600 s).
 * Node's built-in fetch (undici) ends a request whose response headers, or the next part of whose body, have not arrived within ITS limits
 * (300 s each by default), whatever the SDK deadline says, and the SDK reports that as "Request timed out." without the cause. So each review
 * call gets its own dispatcher of the same class as Node's fetch, with finite header and body limits a fixed margin above the call's deadline:
 * the deadline governs, and a stalled body still ends. The process-wide dispatcher is never replaced. Unavailable: refused before anything
 * is sent, never a silent fall back to the defaults.
 */
export const AUDITION_TRANSPORT_MARGIN_MS = 30_000;
const NODE_FETCH_DISPATCHER = Symbol.for('undici.globalDispatcher.1');
type FetchDispatcher = { dispatch: unknown; destroy: () => Promise<void> };
type FetchAgentClass = new (options: { headersTimeout: number; bodyTimeout: number }) => FetchDispatcher;
function fetchAgentClass(): FetchAgentClass {
  // Node loads its fetch implementation on first use; reading one of its globals loads it, and it installs its process-wide Agent. No request.
  void globalThis.Response;
  const current = (globalThis as unknown as Record<symbol, { dispatch?: unknown } | undefined>)[NODE_FETCH_DISPATCHER];
  const Agent = current?.constructor as FetchAgentClass | undefined;
  if (typeof Agent !== 'function' || typeof current?.dispatch !== 'function' || Agent.name !== 'Agent') fail('audition_transport_unavailable');
  return Agent!;
}
/**
 * One call's transport: its own finite dispatcher, a fetch that uses it and keeps its own failure (with its cause), and its release. The paid
 * judge always uses the fixed margin; the local transport tests pass a short one, so a limit can be reached in a test.
 */
export function reviewTransport(deadlineMs: number, marginMs = AUDITION_TRANSPORT_MARGIN_MS) {
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || !Number.isSafeInteger(marginMs) || marginMs < 1) fail('audition_transport_policy');
  const limitMs = deadlineMs + marginMs, Agent = fetchAgentClass();
  const dispatcher = new Agent({ headersTimeout: limitMs, bodyTimeout: limitMs });
  let failure: unknown = null;
  const transportFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    try { return await fetch(input, { ...init, dispatcher } as RequestInit); } catch (error) { failure = error; throw error; }
  }) as typeof fetch;
  return { limits: { headersTimeoutMs: limitMs, bodyTimeoutMs: limitMs }, dispatcher, fetch: transportFetch,
    /** The SDK keeps no cause on its own error: the transport's failure is attached to it for the record (causeChain). */
    annotate: (error: unknown) => { if (failure && error && typeof error === 'object') Object.assign(error, { transportCause: failure }); return error; },
    release: () => dispatcher.destroy().catch(() => undefined) };
}
/**
 * ONE review call, exactly as the paid judge sends it: its own transport (reviewTransport), a client without retries, the SDK deadline and the
 * caller's signal. The local transport tests call this same function against a 127.0.0.1 server.
 */
export async function sendReview(payload: Awaited<ReturnType<typeof auditionJudgePayload>>,
  opts: { apiKey: string; signal: AbortSignal; deadlineMs: number; baseURL: string;
    /** Made by the caller BEFORE its claim (an unavailable transport then refuses with nothing claimed or sent); released by that caller. */
    transport?: ReturnType<typeof reviewTransport>;
    /** Prospective opt-in only. The original claim/wire must exist; resume retrieves that SAME provider ID, never generates a replacement. */
    durable?: { directory: string; claimFile: string; wireFile: string; resume?: true; pollMs?: number; afterIdCheckpoint?: () => void } }) {
  const own = !opts.transport, transport = opts.transport ?? reviewTransport(opts.deadlineMs);
  if (transport.limits.headersTimeoutMs <= opts.deadlineMs || transport.limits.bodyTimeoutMs <= opts.deadlineMs) fail('audition_transport_policy');
  try {
    const client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL, maxRetries: 0, logLevel: 'off', fetch: transport.fetch });
    if (opts.durable) {
      const body = durableReviewPayload(payload), d = opts.durable;
      const wire = read(d.wireFile), claim = read(d.claimFile), wireDigest = previewSha(canonicalJson(digestImages(body)));
      if (body.model !== REVIEW_MODEL || path.basename(d.wireFile) !== `${claim.step}.wire.json` ||
          path.basename(d.claimFile) !== `${claim.step}.claim.json` || path.dirname(d.claimFile) !== path.dirname(d.wireFile) ||
          canonicalJson(wire) !== canonicalJson(digestImages(body)) || claim.wireDigest !== wireDigest ||
          claim.maximumMicroUsd !== SOL_PIXEL_REVIEW_SLOT_MICRO_USD) fail('audition_durable_claim');
      const journal = new DurableReviewJournal(d.directory, { version: DURABLE_REVIEW_VERSION, wireDigest,
        claimSha256: previewSha(readFileSync(d.claimFile)), bodySha256: previewSha(canonicalJson(body)), model: body.model,
        semanticRequestSha256: body.metadata.semantic_request_sha256, retention: 'background-store-false-temporary' });
      try {
        return await durableReviewJob({ journal, resume: d.resume, signal: opts.signal, deadlineMs: opts.deadlineMs, pollMs: d.pollMs,
          afterIdCheckpoint: d.afterIdCheckpoint,
          create: async o => await client.responses.create(body, { signal: o.signal, timeout: o.timeoutMs }),
          retrieve: async (id, o) => await client.responses.retrieve(id, {}, { signal: o.signal, timeout: o.timeoutMs }) });
      } catch (error) {
        // Leave the claim unresolved. The saved provider job might still complete; the next authorized operation may retrieve only its ID.
        if (error && typeof error === 'object') Object.assign(error, { durableReviewPending: true });
        throw error;
      }
    }
    return await client.responses.create(payload, { signal: opts.signal, timeout: opts.deadlineMs });
  } catch (error) { throw transport.annotate(error); }
  finally { if (own) await transport.release(); }
}
/** Same semantic request, explicitly different transport wire; its metadata binds the pre-transport request without a self-referential hash. */
export function durableReviewPayload(payload: Awaited<ReturnType<typeof auditionJudgePayload>>) {
  return { ...payload, background: true as const, store: false,
    metadata: { semantic_request_sha256: previewSha(canonicalJson(digestImages(payload))) } };
}
/** The EXACT renderer's pure dry plan, shared by native first-operation admission. No key, provider or image write. */
export function auditionRenderPlan(directory: string, prompt: string, refs: AuditionImage[],
  mode: 'book_identity' | 'book_design' | 'identity' | 'anchor_photo_style_only' | 'style',
  roles?: readonly BookDesignReferenceRole[], signal?: AbortSignal) {
  const input = { finalPrompt: prompt, referenceImages: refs.map(r => path.join(directory, r.imageName)), referenceMode: mode,
    ...(roles ? { referenceRoles: roles } : {}), requireReferenceEdit: refs.length > 0, quality: 'low' as const, size: '1024x1024' as const,
    modelOverride: 'gpt-image-2', signal, requestTimeoutMs: 180000 };
  const plan = planGPTImageRequest(input, { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
  if (plan.referenceCountPassed !== refs.length) fail('audition_reference_truncated');
  if (plan.bodyWithoutBinaryImage.model !== 'gpt-image-2' || plan.bodyWithoutBinaryImage.quality !== 'low' ||
      plan.bodyWithoutBinaryImage.size !== '1024x1024' || plan.bodyWithoutBinaryImage.n !== 1) fail('audition_image_price_contract');
  const wire = { body: plan.bodyWithoutBinaryImage, mode: plan.apiMode, references: refs, ...(plan.referenceRoles ? { referenceRoles: plan.referenceRoles } : {}),
    retries: 0, deadlineMs: 180000, pricing: RENDER_PRICING, outputReservationTokens: 8192 };
  return { input, wire, maximumMicroUsd: renderMaximum(plan.finalPrompt, refs.length) };
}
/**
 * A failure's cause chain for its record (2026-10-22: a lost call must say which layer ended it): the transport's own failure when the
 * adapter attached one, else the error's `cause`; each link's class, code and message (at most 4 links, 200 characters, key-like text redacted).
 */
export function causeChain(error: unknown) {
  const redact = (s: string) => s.replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  const links: { class: string; code?: string; message: string }[] = [], seen = new Set<unknown>();
  let link: unknown = error && typeof error === 'object' ? (error as { transportCause?: unknown }).transportCause ?? (error as { cause?: unknown }).cause : null;
  while (link && typeof link === 'object' && !seen.has(link) && links.length < 4) {
    seen.add(link);
    const l = link as { constructor?: { name?: unknown }; code?: unknown; message?: unknown; cause?: unknown };
    links.push({ class: String(l.constructor?.name ?? 'Object').slice(0, 60), ...(typeof l.code === 'string' ? { code: l.code.slice(0, 60) } : {}),
      message: redact(String(l.message ?? '')).slice(0, 200) });
    link = l.cause;
  }
  return links;
}
/** The paid adapters (render, judge, identity) over one illustrations folder and one meter. Shared with the new-book experiment. */
export function auditionAdapters(args: { directory: string; meter: AuditionMeter; key: () => string; signal: AbortSignal; guard?: () => void;
  /** Opt-in: steps whose request must be exactly a known one (a re-review re-sends the lost request): checked before the claim. */
  expectedWire?: Readonly<Record<string, string>>;
  /** Fixed native diagnostic operations only, each still atomically single-use in the ORIGINAL cumulative meter. */
  allowedSteps?: readonly string[];
  /** Native grant opt-in, never a CLI/default switch. Reconciliation names just ONE existing job and cannot claim a new generation. */
  durableReviews?: { version: typeof DURABLE_REVIEW_VERSION; resumeStep?: string } }) {
  if (args.durableReviews && args.durableReviews.version !== DURABLE_REVIEW_VERSION) fail('audition_durable_policy');
  const cancelled = () => { if (args.signal.aborted) fail('audition_cancelled'); };
  // Before a claim: cancellation and the caller's guard. After a provider response (inside a claim): cancellation only.
  const check = () => { cancelled(); args.guard?.(); };
  const allowed = args.allowedSteps ? new Set(args.allowedSteps) : null;
  if (allowed && (!allowed.size || allowed.size !== args.allowedSteps!.length)) fail('audition_diagnostic_scope');
  const checkStep = (step: string) => { check(); if (allowed && !allowed.has(step)) fail('audition_diagnostic_scope'); };
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
    checkStep(step); const bytes = refs.map(bytesOf);
    const { input, wire, maximumMicroUsd } = auditionRenderPlan(args.directory, prompt, refs, mode, roles, args.signal);
    const expected = args.expectedWire?.[step];
    if (expected !== undefined && previewSha(canonicalJson(wire)) !== expected) fail('audition_rereview_wire');
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
    checkStep(step);
    const payload = await auditionJudgePayload({ candidate, candidateBytes: bytesOf(candidate), context, contextSha, refs: refs.map(r => bytesOf(r)),
      predecessor: predecessor ? bytesOf(predecessor) : null, kind });
    // The crops were prepared asynchronously: re-check before the claim, so nothing is claimed after a change during preparation.
    checkStep(step);
    const wire = digestImages(args.durableReviews ? durableReviewPayload(payload) : payload), expected = args.expectedWire?.[step];
    if (expected !== undefined && previewSha(canonicalJson(wire)) !== expected) fail('audition_rereview_wire');
    // The call's own transport, made before the claim: an unavailable one refuses here, with nothing claimed or sent.
    const transport = reviewTransport(AUDITION_REVIEW_TIMEOUT_MS);
    try {
      const dispatch = async () => {
        cancelled();
        const durableRoot = path.join(path.dirname(args.meter.root), 'review-jobs');
        if (args.durableReviews) {
          if (!existsSync(durableRoot)) mkdirSync(durableRoot);
          realDirectory(durableRoot);
        }
        const raw = await sendReview(payload, { apiKey: args.key(), signal: args.signal, deadlineMs: AUDITION_REVIEW_TIMEOUT_MS,
          baseURL: 'https://api.openai.com/v1', transport,
          ...(args.durableReviews ? { durable: { directory: path.join(durableRoot, step), claimFile: path.join(args.meter.root, `${step}.claim.json`),
            wireFile: path.join(args.meter.root, `${step}.wire.json`), ...(args.durableReviews.resumeStep === step ? { resume: true as const } : {}) } } : {}) });
        const estimatedMicroUsd = reviewCost(raw);
        const receipt = { raw, estimatedMicroUsd };
        if (!reviewAnswered(raw)) throw Object.assign(new ReviewedAuditionError('audition_pixel_provider_invalid'), { receipt });
        try { return { value: (kind === 'page' ? auditionPageReviewSchemaForContext(context) : auditionReviewSchema).parse(JSON.parse(raw.output_text)), estimatedMicroUsd, receipt }; }
        catch { throw Object.assign(new ReviewedAuditionError('audition_pixel_schema'), { receipt }); }
      };
      return await (args.durableReviews?.resumeStep === step ? args.meter.recover(step, wire, dispatch)
        : args.meter.run(step, wire, SOL_PIXEL_REVIEW_SLOT_MICRO_USD, dispatch));
    } finally { await transport.release(); }
  };
  const identity = async (step: string, reference: AuditionImage, candidate: AuditionImage) => {
    checkStep(step); let transportError: unknown = null;
    const result = await evaluatePageChildResemblanceVision({ referenceImageUrl: dataUrl(bytesOf(reference)), candidateImageUrl: dataUrl(bytesOf(candidate)),
      threshold: .7, model: IDENTITY_MODEL, apiKey: 'credential-is-injected-only-after-claim', maxRetries: 0, shouldStartAttempt: () => !args.signal.aborted,
      fetchImpl: async (url, init) => {
        checkStep(step); const wire = JSON.parse(String(init!.body));
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

/**
 * RSM-1 (every resume): the paid progress an interrupted run left for ONE image (a sheet role or a page) that has no saved record,
 * reconstructed from the meter's bound journal. Each journaled render of that image, under any run prefix, is one spent attempt, numbered
 * by its own step: exactly 0..k-1, without a gap or a repeat. Each comes back CLOSED (AUDITION_ATTEMPT_INTERRUPTED): it counts against the
 * image's attempt ceiling and keeps the candidate its render's receipt names (by the image's own bytes), and it is never re-judged, selected
 * or used for a correction. Its review and identity records stay in the journal as they are; the meter alone prices them. Nothing is repaired
 * or sent again.
 */
export function interruptedAttempts(root: string, directory: string, phase: 'sheet' | 'page', name: string): AuditionAttempt[] {
  if (!(phase === 'sheet' ? /^(entities|locations)$/ : /^[0-8]$/).test(name)) fail('audition_resume_journal');
  if (!existsSync(root)) return [];
  const pattern = new RegExp(`^(?:r[0-9]{1,2}_)?${phase}_${name}_([0-9]{1,2})$`);
  const renders = readdirSync(root).map(n => /^([a-z0-9_]+)\.claim\.json$/.exec(n)?.[1]).filter((s): s is string => !!s && pattern.test(s))
    .map(step => ({ step, attempt: Number(pattern.exec(step)![1]) })).sort((a, b) => a.attempt - b.attempt);
  if (renders.some((r, i) => r.attempt !== i)) fail('audition_resume_journal');
  return renders.map(({ step, attempt }) => {
    const at = (kind: string) => path.join(root, `${step}.${kind}.json`), claim = read(at('claim'));
    const result = existsSync(at('result')) ? read(at('result')) : null;
    if (claim?.step !== step || result && result.wireDigest !== claim.wireDigest) fail('audition_resume_journal');
    let candidate: AuditionImage | null = null;
    if (result?.completed === true) {
      const named = image.safeParse(read(at('receipt'))?.candidate), file = named.success ? path.join(directory, named.data.imageName) : null;
      if (!named.success || !file || !existsSync(file) || lstatSync(file).isSymbolicLink() || previewSha(readFileSync(file)) !== named.data.imageSha)
        fail('audition_resume_journal');
      candidate = { imageName: named.data!.imageName, imageSha: named.data!.imageSha };
    }
    return { attempt, candidate, review: null, assessment: null, status: 'unavailable' as const, error: AUDITION_ATTEMPT_INTERRUPTED };
  });
}

/**
 * The re-reviews a resume may perform (AUDITION_REREVIEW_VERSION), each checked against the bound journal before anything is sent: ONE per
 * saved page without a saved successor; the named attempt drew its candidate (the render's receipt names exactly the saved attempt's image);
 * its review `lostStep` ended without a receipt (its own records) and is debited by this run; no other review of that attempt was ever
 * claimed. Each re-sends exactly the lost request under the new step `${stepPrefix}page_N_k_qa` (its wire digest, checked before the claim).
 */
export function rereviewAllowance(list: readonly { page: number; attempt: number; lostStep: string }[], at: { paid: string;
  pages: Record<number, SavedPage | undefined>; rebound: Record<number, unknown>; debits: readonly ConservativeDebit[]; stepPrefix: string }) {
  if (new Set(list.map(r => r.page)).size !== list.length) fail('audition_rereview_binding');
  const claims = existsSync(at.paid) ? readdirSync(at.paid).map(n => /^([a-z0-9_]+)\.claim\.json$/.exec(n)?.[1]).filter((s): s is string => !!s) : [];
  return list.map(r => {
    if (!Number.isInteger(r.page) || r.page < 0 || r.page > 8 || !Number.isInteger(r.attempt) || r.attempt < 0 || r.attempt > 9) return fail('audition_rereview_binding');
    const saved = at.pages[r.page], target = saved?.attempts?.find(a => a.attempt === r.attempt);
    const reviews = new RegExp(`^(?:r[0-9]{1,2}_)?page_${r.page}_${r.attempt}_qa$`), debit = at.debits.find(d => d.step === r.lostStep);
    if (!saved || r.page in at.rebound || !target?.candidate || !reviews.test(r.lostStep) || claims.filter(s => reviews.test(s)).join() !== r.lostStep || !debit ||
        canonicalJson(conservativeDebitOf(at.paid, r.lostStep)) !== canonicalJson(debit)) fail('audition_rereview_binding');
    const render = r.lostStep.slice(0, -'_qa'.length);
    if (read(path.join(at.paid, `${render}.result.json`))?.completed !== true ||
        canonicalJson(read(path.join(at.paid, `${render}.receipt.json`))?.candidate ?? null) !== canonicalJson(target!.candidate)) fail('audition_rereview_binding');
    const step = `${at.stepPrefix}page_${r.page}_${r.attempt}_qa`;
    if (claims.includes(step) || !auditionMeterRules(step)) fail('audition_rereview_binding');
    return { page: r.page, attempt: r.attempt, lostStep: r.lostStep, wireDigest: debit!.wireDigest, step };
  });
}

export async function runReviewedAudition(args: { bookDir: string; out: string; keyFile: string; grantFile: string; signal: AbortSignal;
  log: (line: string) => void; resume?: true; storyboardDir?: string; layout?: ReviewedBookLayout;
  /** Required exactly for a grant issued to an experiment: its slot, claim and guard (claim + source pin), run before every paid call. */
  experiment?: { slot: string; claimSha256: string; guard: () => void };
  /** Opt-in, owner-approved conservative debits of this audition's own unknown-cost records (see AuditionMeter); only with a resume. */
  debits?: readonly ConservativeDebit[];
  /**
   * Opt-in, owner-approved re-reviews (AUDITION_REREVIEW_VERSION), only with a resume: ONE per saved page, of the named attempt, whose
   * review `lostStep` ended without a receipt and is debited by this run. The re-review re-sends exactly that lost request.
   */
  rereview?: readonly { page: number; attempt: number; lostStep: string }[];
  /** Only a new native continuation claim may supply this; the consumed audition grant/admission remain immutable. */
  calibration?: { grantSha256: string; contract: AuditionCalibration };
  topologyContinuation?: { grantSha256: string; contract: AuditionTopologyContinuation; firstReview: { step: string; wireDigest: string } };
  coverageContinuation?: { grantSha256: string; contract: AuditionCoverageContinuation; firstReview: { step: string; wireDigest: string } };
  /** New one-use native successor only: old ID-less orphan stays UNKNOWN and its original admission remains immutable. */
  coverageOrphanRecovery?: { version: 'audition-orphan-continuation/v1'; parentAdmissionSha256: string; provision: OrphanProvision };
  anatomyRecovery?: { grantSha256: string; contract: AuditionAnatomyRecovery; provision: OrphanProvision;
    firstReview: { step: string; wireDigest: string } };
  fullBookDiagnostic?: { grantSha256: string; parentAdmissionSha256: string; contract: AuditionFullBookDiagnostic; provision: OrphanProvision;
    firstOperation: { step: string; wireDigest: string } } }) {
  const diagnostic = args.fullBookDiagnostic;
  if (diagnostic && (!args.resume || !args.experiment || args.calibration || args.topologyContinuation || args.coverageContinuation ||
      args.coverageOrphanRecovery || args.anatomyRecovery || args.rereview?.length || !/^[a-f0-9]{64}$/.test(diagnostic.grantSha256) ||
      diagnostic.contract.version !== AUDITION_FULL_BOOK_DIAGNOSTIC_VERSION ||
      !existsSync(path.join(args.out, 'admission-anatomy.json')) ||
      previewSha(readFileSync(path.join(args.out, 'admission-anatomy.json'))) !== diagnostic.parentAdmissionSha256)) fail('audition_diagnostic_parent');
  if (existsSync(path.join(args.out, 'admission-full-book-diagnostic.json'))) fail('audition_diagnostic_used');
  if (args.anatomyRecovery && (!args.resume || !args.experiment || args.calibration || args.topologyContinuation || args.coverageContinuation ||
      args.coverageOrphanRecovery || args.rereview?.length || !/^[a-f0-9]{64}$/.test(args.anatomyRecovery.grantSha256) ||
      args.anatomyRecovery.contract.version !== AUDITION_ANATOMY_VERSION ||
      !existsSync(path.join(args.out, 'admission-coverage-orphan.json')))) fail('audition_anatomy_parent');
  if (existsSync(path.join(args.out, 'admission-anatomy.json')) && !diagnostic) fail('audition_anatomy_used');
  if (args.debits?.length && !args.resume) fail('audition_meter_debit');
  if (args.rereview?.length && !args.resume) fail('audition_rereview_binding');
  if (args.calibration && (!args.resume || !args.experiment || args.rereview?.length ||
      !/^[a-f0-9]{64}$/.test(args.calibration.grantSha256) || args.calibration.contract.version !== AUDITION_CALIBRATION_VERSION))
    fail('audition_calibration_binding');
  if (args.topologyContinuation && (!args.resume || !args.experiment || args.calibration || args.rereview?.length ||
      !/^[a-f0-9]{64}$/.test(args.topologyContinuation.grantSha256) ||
      args.topologyContinuation.contract.version !== AUDITION_TOPOLOGY_CONTINUATION_VERSION ||
      !existsSync(path.join(args.out, 'admission-calibration.json')))) fail('audition_topology_parent');
  if (args.coverageContinuation && (!args.resume || !args.experiment || args.calibration || args.topologyContinuation || args.rereview?.length ||
      !/^[a-f0-9]{64}$/.test(args.coverageContinuation.grantSha256) ||
      args.coverageContinuation.contract.version !== AUDITION_COVERAGE_CONTINUATION_VERSION ||
      !existsSync(path.join(args.out, 'admission-topology.json')))) fail('audition_coverage_parent');
  if (args.coverageOrphanRecovery && (!args.coverageContinuation || args.coverageOrphanRecovery.version !== 'audition-orphan-continuation/v1' ||
      previewSha(readFileSync(path.join(args.out, 'admission-coverage.json'))) !== args.coverageOrphanRecovery.parentAdmissionSha256 ||
      canonicalJson(read(path.join(args.out, 'admission-coverage.json')).contract) !== canonicalJson(args.coverageContinuation.contract))) fail('audition_orphan_parent');
  if (existsSync(path.join(args.out, 'admission-coverage.json')) && !args.coverageOrphanRecovery && !args.anatomyRecovery && !diagnostic) fail('audition_coverage_used');
  if (existsSync(path.join(args.out, 'admission-coverage-orphan.json')) && !args.anatomyRecovery && !diagnostic) fail('audition_orphan_used');
  if (existsSync(path.join(args.out, 'admission-topology.json')) && !args.coverageContinuation && !args.anatomyRecovery && !diagnostic) fail('audition_topology_used');
  if (existsSync(path.join(args.out, 'admission-calibration.json')) && !args.topologyContinuation && !args.coverageContinuation && !args.anatomyRecovery && !diagnostic) fail('audition_calibration_used');
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
    grant.ledger.carriedUnresolvedMicroUsd ?? 0, args.experiment ? auditionMeterRules : undefined, args.debits ?? [],
    args.coverageOrphanRecovery ? [args.coverageOrphanRecovery.provision] : args.anatomyRecovery ? [args.anatomyRecovery.provision] : diagnostic ? [diagnostic.provision] : []);
  if (args.coverageOrphanRecovery) meter.snapshot();
  // A re-review's step must send exactly its lost request (filled below on a resume, before anything is dispatched).
  const expectedWire: Record<string, string> = {};
  if (args.topologyContinuation) expectedWire[args.topologyContinuation.firstReview.step] = args.topologyContinuation.firstReview.wireDigest;
  if (args.coverageContinuation) expectedWire[args.coverageContinuation.firstReview.step] = args.coverageContinuation.firstReview.wireDigest;
  if (args.anatomyRecovery) expectedWire[args.anatomyRecovery.firstReview.step] = args.anatomyRecovery.firstReview.wireDigest;
  if (diagnostic) expectedWire[diagnostic.firstOperation.step] = diagnostic.firstOperation.wireDigest;
  let diagnosticSteps: string[] | undefined;
  if (diagnostic) {
    const diagnosticScope = renderScope ?? fail('audition_diagnostic_scope');
    if (canonicalJson(diagnostic.contract.pages.map(p => p.page)) !== canonicalJson(diagnosticScope.sample) ||
        canonicalJson(diagnosticScope.pages) !== canonicalJson([0, 1, 2, 3, 4, 5, 6, 7, 8])) fail('audition_diagnostic_scope');
    const prefix = `r${readdirSync(args.out).filter(n => /^resume-[0-9]+\.json$/.test(n)).length + 1}_`;
    const frames = [...diagnosticScope.pages.filter(n => n > 0 && !diagnostic.contract.pages.some(p => p.page === n)).sort((a, b) => a - b), 0];
    if (frames.length !== 7 || diagnostic.firstOperation.step !== `${prefix}page_${frames[0]}_0`) fail('audition_diagnostic_scope');
    diagnosticSteps = frames.flatMap(n => ['', '_qa', '_identity'].map(s => `${prefix}page_${n}_0${s}`));
  }
  const io = auditionAdapters({ directory, meter, key: keyReader(args.keyFile), signal: args.signal, ...(args.experiment ? { guard: args.experiment.guard } : {}),
    expectedWire, ...(diagnosticSteps ? { allowedSteps: diagnosticSteps } : {}),
    ...(args.coverageOrphanRecovery || args.anatomyRecovery || diagnostic ? { durableReviews: { version: DURABLE_REVIEW_VERSION } } : {}) });
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
    if (args.calibration) save('admission-calibration', { version: AUDITION_CALIBRATION_VERSION,
      parentAdmissionSha256: previewSha(readFileSync(path.join(args.out, 'admission.json'))), grantSha256: args.calibration.grantSha256,
      contract: args.calibration.contract, policy: reviewedAuditionPolicy(scaleLineup, true) });
    if (args.topologyContinuation) save('admission-topology', { version: AUDITION_TOPOLOGY_CONTINUATION_VERSION,
      parentAdmissionSha256: previewSha(readFileSync(path.join(args.out, 'admission-calibration.json'))),
      grantSha256: args.topologyContinuation.grantSha256, contract: args.topologyContinuation.contract,
      firstReview: args.topologyContinuation.firstReview, policy: reviewedAuditionPolicy(scaleLineup, true, LANDMARK_TOPOLOGY_VERSION) });
    if (args.coverageContinuation && !args.coverageOrphanRecovery) save('admission-coverage', { version: AUDITION_COVERAGE_CONTINUATION_VERSION,
      parentAdmissionSha256: previewSha(readFileSync(path.join(args.out, 'admission-topology.json'))),
      grantSha256: args.coverageContinuation.grantSha256, contract: args.coverageContinuation.contract,
      firstReview: args.coverageContinuation.firstReview, policy: reviewedAuditionPolicy(scaleLineup, true, LANDMARK_COVERAGE_TOPOLOGY_VERSION) });
    if (args.coverageOrphanRecovery) save('admission-coverage-orphan', { ...args.coverageOrphanRecovery,
      grantSha256: args.coverageContinuation!.grantSha256, contract: args.coverageContinuation!.contract,
      firstReview: args.coverageContinuation!.firstReview, durableReview: DURABLE_REVIEW_VERSION,
      policy: reviewedAuditionPolicy(scaleLineup, true, LANDMARK_COVERAGE_TOPOLOGY_VERSION) });
    if (args.anatomyRecovery) save('admission-anatomy', { ...args.anatomyRecovery,
      parentAdmissionSha256: previewSha(readFileSync(path.join(args.out, 'admission-coverage-orphan.json'))),
      policy: reviewedAuditionPolicy(undefined, true, LANDMARK_COVERAGE_TOPOLOGY_VERSION, true), durableReview: DURABLE_REVIEW_VERSION });
    if (diagnostic) save('admission-full-book-diagnostic', { ...diagnostic,
      policy: reviewedAuditionPolicy(undefined, true, LANDMARK_COVERAGE_TOPOLOGY_VERSION, true),
      diagnosticOnly: true, runtimeEligible: false, productAccepted: false, durableReview: DURABLE_REVIEW_VERSION });
    const optional = (name: string) => existsSync(path.join(args.out, `${name}.json`)) ? read(path.join(args.out, `${name}.json`)) : undefined;
    const markers = readdirSync(args.out).filter(n => /^resume-[0-9]+\.json$/.test(n)).length + 1;
    const pages = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => [n, optional(`page_${n}`)]).filter(([, p]) => p));
    const sheets = { entities: optional('sheet_entities'), locations: optional('sheet_locations') };
    // RSM-1: every image without a saved record keeps the paid attempts its journal shows (closed), before anything else is dispatched.
    const paid = path.join(args.out, 'paid-stages');
    const closedSheets = Object.fromEntries((['entities', 'locations'] as const).filter(role => !sheets[role])
      .map(role => [role, interruptedAttempts(paid, directory, 'sheet', role)] as const).filter(([, a]) => a.length));
    const closedPages = Object.fromEntries((renderScope?.pages ?? []).filter(n => !pages[n])
      .map(n => [n, interruptedAttempts(paid, directory, 'page', String(n))] as const).filter(([, a]) => a.length));
    const interrupted = Object.keys(closedSheets).length || Object.keys(closedPages).length
      ? { ...(Object.keys(closedSheets).length ? { sheets: closedSheets } : {}), ...(Object.keys(closedPages).length ? { pages: closedPages } : {}) } : null;
    if (diagnostic && interrupted) fail('audition_diagnostic_parent');
    // Re-reviews: every saved successor is re-bound (by the orchestrator, from its raw review); an allowance judges its attempt once, now.
    const stepPrefix = `r${markers}_`;
    const rebound = Object.fromEntries(Object.keys(pages).map(Number).filter(n => existsSync(path.join(args.out, `page_${n}_rereview.json`)))
      .map(n => [n, { attempt: read(path.join(args.out, `page_${n}_rereview.json`)).attempt as number, saved: read(path.join(args.out, `page_${n}_rereview.json`)) }]));
    const allowed = rereviewAllowance(args.rereview ?? [], { paid, pages, rebound, debits: args.debits ?? [], stepPrefix });
    for (const a of allowed) expectedWire[a.step] = a.wireDigest;
    const rereview = args.anatomyRecovery || diagnostic ? null : Object.keys(rebound).length || allowed.length
      ? { pages: { ...rebound, ...Object.fromEntries(allowed.map(a => [a.page, { attempt: a.attempt }])) } } : null;
    resume = { designs: read(path.join(args.out, 'audition_sheet_designs.json')), sheets, pages, stepPrefix, ...(interrupted ? { interrupted } : {}),
      ...(rereview ? { rereview } : {}) };
    // Native diagnostic parents carry their own fully bound v15 attempts; legacy root page records cannot reset/adopt them.
    if (diagnostic) resume = { designs: resume.designs, sheets: resume.sheets, pages: {}, stepPrefix };
    const counts = (closed: Record<string, AuditionAttempt[]>) => Object.fromEntries(Object.entries(closed).map(([k, a]) => [k, a.length]));
    save(`resume-${markers}`, { resumedPages: Object.keys(pages).map(Number),
      // Absent when nothing was interrupted (every earlier resume record's shape, unchanged).
      ...(interrupted ? { interrupted: { ...(interrupted.sheets ? { sheets: counts(interrupted.sheets) } : {}),
        ...(interrupted.pages ? { pages: counts(interrupted.pages) } : {}) } } : {}),
      // Absent without re-reviews: those re-bound, and the one this run performs (its lost request and its new step).
      ...(rereview ? { rereview: { ...(Object.keys(rebound).length ? { rebound: Object.keys(rebound).map(Number) } : {}),
        ...(allowed.length ? { performed: allowed } : {}) } } : {}),
      spendBefore: meter.snapshot(), at: new Date().toISOString() });
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
  // A later run of the same audition (a resume after a finished run) keeps the earlier manifest and writes its own beside it.
  const engineSave = (name: string, value: unknown) => save(name === 'reviewed_audition_manifest' && resume && existsSync(path.join(args.out, `${name}.json`))
    ? `${name}-${resume.stepPrefix.slice(0, -1)}` : name, value);
  const manifest = await illustrateReviewedAudition({ book: loaded.book, rawReview: loaded.rawReview, texts: loaded.texts, current: loaded.current,
    child, companion, companionDescription: loaded.companionDescription, pages: grant.scope.pages,
    ...(grant.scope.sample ? { sample: grant.scope.sample } : {}), ...('ownerAcceptance' in loaded ? { ownerAcceptance: loaded.ownerAcceptance } : {}),
    ...(scaleLineup ? { scaleLineup } : {}), ...(reused ? { reuseSheets: reused.sheets } : {}),
    ...(renderScope?.pageAttempts !== undefined ? { pageAttempts: renderScope.pageAttempts } : {}), ...(recovery ? { recovery } : {}),
    ...(args.calibration ? { calibration: args.calibration.contract } : {}),
    ...(args.topologyContinuation ? { topologyContinuation: args.topologyContinuation.contract, landmarkTopology: LANDMARK_TOPOLOGY_VERSION } : {}),
    ...(args.coverageContinuation ? { coverageContinuation: args.coverageContinuation.contract, landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION } : {}),
    ...(args.anatomyRecovery ? { anatomyRecovery: args.anatomyRecovery.contract, structuralAnatomy: true,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION } : {}),
    ...(diagnostic ? { fullBookDiagnostic: diagnostic.contract, structuralAnatomy: true,
      landmarkTopology: LANDMARK_COVERAGE_TOPOLOGY_VERSION } : {}),
    render: io.render, judge: io.judge, identity: io.identity, check: io.check, save: engineSave, ...(resume ? { resume } : {}),
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
