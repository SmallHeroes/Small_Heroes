/**
 * The fresh-book owner-cycle authority (Guy 2026-10-18 closure amendment): ONE new LOW experimental book under the separate USD 7 subcap of
 * the unchanged USD 8 cycle, after the anchor amendment's settled re-review passed. Not NEW_BOOK_EXPERIMENT (bound to the consumed
 * new-book-20261012 slot, its approval, ledger and carry, all untouched): its own fixed claim under the fixed authority root, outside every
 * configurable path, so another output, label, profile or grant cannot fund a second book.
 * This module is the authority, ledger and gates only (no provider, no key). A stage driver calls `assertFreshBookPaid` synchronously
 * before EVERY paid claim (including after any awaited preparation) and `freshBookCycleLedger` for each meter's prior.
 */
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { previewSha } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { childAnchorAcceptanceVersions, CHILD_ANCHOR_POSE_VERSION, CHILD_ANCHOR_VISIBILITY_RECOVERABLE, CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION }
  from '../lib/personal-wizard/child-anchor-style';
import { AuditionMeter, auditionReviewRule, type MeterRules } from './personal-simple-book-reviewed-audition';
import { REREVIEW_AMENDMENT, rereviewAuthority, rereviewOutput, settledRereviewOutcome, type RereviewConfig } from './personal-child-anchor-rereview';

export class FreshBookError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new FreshBookError(code); };
const hash = z.string().regex(/^[a-f0-9]{64}$/);

/** Fixed in code: the cycle, its caps and its one claim. Nothing here is read from a profile, an output folder or a grant. */
export const FRESH_BOOK_CYCLE = Object.freeze({
  id: 'owner-autonomous-book-api-20261017/fresh-book-usd7',
  approval: 'Guy 2026-10-18 OWNER-AUTONOMOUS-BOOK-CLOSURE-AMENDMENT-20261018.txt: if the new exact evidence passes, ONE fresh LOW experimental book under the separate USD 7 subcap of the unchanged USD 8 cycle; two representative sample pages first, the remaining pages and cover only if gates pass; max 3 normal attempts/page; never another book or reset.',
  authorityRoot: REREVIEW_AMENDMENT.authorityRoot,
  claimName: 'owner-cycle-20261017-fresh-book-usd7.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.outcome.json',
  cycleCeilingMicroUsd: 8_000_000, diagnosticSubcapMicroUsd: REREVIEW_AMENDMENT.cumulativeCapMicroUsd, bookSubcapMicroUsd: 7_000_000,
  pages: 8, samplePages: 2, pageAttempts: 3,
  routes: Object.freeze({ author: 'claude-opus-5-5/claude-max', editor: 'claude-opus-5-5/claude-max', storyboardPlanner: 'claude-opus-5-5/claude-max',
    judges: 'gpt-6.1-sol', image: 'gpt-image-2/low' }),
  excludedCompanions: Object.freeze(['dragon_dini']),
});

/** The frozen fictional inputs of the one book (chosen by the operator, never a real child or private asset, no bank/category). */
export const freshBookProfileSchema = z.object({ version: z.literal('fresh-book-profile/v1'), cycle: z.literal(FRESH_BOOK_CYCLE.id),
  child: z.object({ name: z.string().trim().min(2).max(40), age: z.number().int().min(3).max(9), gender: z.enum(['boy', 'girl']),
    design: z.string().trim().min(40).max(1500), wardrobe: z.string().trim().min(5).max(400), fictional: z.literal(true) }).strict(),
  companion: z.object({ id: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/), design: z.string().trim().min(20).max(1200) }).strict(),
  /** Free-form parent-driven story inputs (what the parent would tell us); no story bank, category or premise list. */
  parentInputs: z.object({ about: z.string().trim().min(20).max(1200), wish: z.string().trim().min(10).max(600) }).strict(),
  /** The book's seed and the reviewed wizard request those inputs fill (the driver checks it names this child and companion, no photo). */
  seed: z.string().regex(/^[a-z0-9-]{8,120}$/), request: z.record(z.string(), z.unknown()),
  routes: z.object({ author: z.literal(FRESH_BOOK_CYCLE.routes.author), editor: z.literal(FRESH_BOOK_CYCLE.routes.editor),
    storyboardPlanner: z.literal(FRESH_BOOK_CYCLE.routes.storyboardPlanner), judges: z.literal(FRESH_BOOK_CYCLE.routes.judges),
    image: z.literal(FRESH_BOOK_CYCLE.routes.image) }).strict(),
  /** The child anchor's acceptance contract; child-anchor-materiality/v1 is the owner's 2026-10-18 opt-in (its admission re-review must match). */
  childAnchor: z.enum(childAnchorAcceptanceVersions),
}).strict().superRefine((p, ctx) => {
  if ((FRESH_BOOK_CYCLE.excludedCompanions as readonly string[]).includes(p.companion.id)) ctx.addIssue({ code: 'custom', message: 'fresh_book_companion_scope' });
});
export type FreshBookProfile = z.infer<typeof freshBookProfileSchema>;
export const freshBookProfileSha = (p: FreshBookProfile) => previewSha(canonicalJson(freshBookProfileSchema.parse(p)));

export type FreshBookEnv = { authorityRoot: string; head: () => { head: string; branch: string; clean: boolean } };
export const freshBookGrantSchema = z.object({ version: z.literal('fresh-book-grant/v1'), cycle: z.literal(FRESH_BOOK_CYCLE.id),
  approval: z.literal(FRESH_BOOK_CYCLE.approval), profileSha256: hash, engine: z.object({ head: z.string().regex(/^[a-f0-9]{40}$/), branch: z.string().min(1) }).strict(),
  pins: z.record(z.string(), hash), nativePlanSha256: hash, bookDir: z.string().refine(p => path.isAbsolute(p)) }).strict();
export type FreshBookGrant = z.infer<typeof freshBookGrantSchema>;

const fileBytes = (file: string) => { const s = lstatSync(file); if (!s.isFile() || s.isSymbolicLink()) fail('fresh_book_file'); return readFileSync(file); };

/**
 * Book admission: the amendment's outcome re-derived from its settled records (never a flag) must be passed, for the rounds actually
 * claimed (each with its outcome). Missing, held or mixed evidence refuses.
 */
export async function assertFreshBookAdmission(rereview: RereviewConfig, env: Pick<FreshBookEnv, 'authorityRoot'>) {
  let rounds = 0;
  while (rounds < REREVIEW_AMENDMENT.maxRounds && existsSync(path.join(env.authorityRoot, REREVIEW_AMENDMENT.claimName(rounds + 1)))) {
    if (!existsSync(path.join(env.authorityRoot, REREVIEW_AMENDMENT.outcomeName(rounds + 1)))) fail('fresh_book_admission_inflight');
    rounds++;
  }
  if (!rounds) return fail('fresh_book_admission_missing');
  const outcome = await settledRereviewOutcome({ ...rereview, round: rounds }, { rounds });
  if (outcome.disposition !== 'passed') fail('fresh_book_admission_held');
  return outcome;
}

/**
 * The diagnostic subcap's settled spend, derived only from records: the original diagnostic's own calls (re-derived by the re-review
 * authority) plus every claimed re-review round's calls, each re-derived under the review rule. An unfinished round or any unknown halts.
 */
export function freshBookDiagnosticSpend(rereview: RereviewConfig, env: Pick<FreshBookEnv, 'authorityRoot'>) {
  let total = rereviewAuthority({ ...rereview, round: 1 }).originalSettledMicroUsd;
  for (let round = 1; round <= REREVIEW_AMENDMENT.maxRounds && existsSync(path.join(env.authorityRoot, REREVIEW_AMENDMENT.claimName(round))); round++) {
    if (!existsSync(path.join(env.authorityRoot, REREVIEW_AMENDMENT.outcomeName(round)))) fail('fresh_book_admission_inflight');
    const stages = path.join(rereviewOutput(rereview, round), 'paid-stages');
    if (!existsSync(stages)) continue;
    const snapshot = new AuditionMeter(stages, REREVIEW_AMENDMENT.cumulativeCapMicroUsd, REREVIEW_AMENDMENT.maxReviewsPerRound, total, 0, REREVIEW_RULES).snapshot();
    if (snapshot.unknownCost || snapshot.unknownOutcome || snapshot.reservedUnsettledMicroUsd) fail('fresh_book_ledger_unknown');
    total += snapshot.newKnownApiMicroUsd;
  }
  return total;
}
const REREVIEW_RULES: MeterRules = step => step === 'reference_child_style_qa' || step === 'reference_child_qa' ? auditionReviewRule : undefined;

/** One stage's meter folder and the rules its calls settle under (the stage driver's own). */
export type FreshBookStage = { name: string; dir: string; rules: MeterRules; maxCalls: number };
/**
 * The cycle's cumulative ledger: the diagnostic subcap's settled spend (the original 59910 and every claimed re-review round, re-derived)
 * and every stage of THIS book, in order, each re-derived from its own records. Any unknown cost or outcome (an orphan claim, an in-flight
 * call on resume) halts: it is never reset or treated as headroom. Old books are never part of it.
 */
export function freshBookCycleLedger(args: { diagnosticSettledMicroUsd: number; stages: readonly FreshBookStage[] }) {
  if (!Number.isSafeInteger(args.diagnosticSettledMicroUsd) || args.diagnosticSettledMicroUsd < REREVIEW_AMENDMENT.originalSettledMicroUsd ||
      args.diagnosticSettledMicroUsd > FRESH_BOOK_CYCLE.diagnosticSubcapMicroUsd) fail('fresh_book_ledger_diagnostic');
  let book = 0;
  const stages = args.stages.map(stage => {
    if (!existsSync(path.join(stage.dir, 'paid-stages'))) return { name: stage.name, knownMicroUsd: 0, calls: 0 };
    const snapshot = new AuditionMeter(path.join(stage.dir, 'paid-stages'), FRESH_BOOK_CYCLE.bookSubcapMicroUsd, stage.maxCalls, book, 0, stage.rules).snapshot();
    if (snapshot.unknownCost || snapshot.unknownOutcome || snapshot.reservedUnsettledMicroUsd) fail('fresh_book_ledger_unknown');
    book += snapshot.newKnownApiMicroUsd;
    return { name: stage.name, knownMicroUsd: snapshot.newKnownApiMicroUsd, calls: snapshot.calls };
  });
  if (book > FRESH_BOOK_CYCLE.bookSubcapMicroUsd || book + args.diagnosticSettledMicroUsd > FRESH_BOOK_CYCLE.cycleCeilingMicroUsd) fail('fresh_book_ledger_cap');
  return { diagnosticSettledMicroUsd: args.diagnosticSettledMicroUsd, bookKnownMicroUsd: book, stages,
    /** The next book meter's cap is the smaller of the subcap and what the cycle ceiling leaves. */
    nextCapMicroUsd: Math.min(FRESH_BOOK_CYCLE.bookSubcapMicroUsd, FRESH_BOOK_CYCLE.cycleCeilingMicroUsd - args.diagnosticSettledMicroUsd),
    cycleAccountedMicroUsd: book + args.diagnosticSettledMicroUsd };
}

/** The one claim: written once, before the first provider or model stage; any existing claim refuses, for any profile, grant or folder. */
export function claimFreshBook(env: FreshBookEnv, grant: FreshBookGrant, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('fresh_book_authority_root');
  const file = path.join(env.authorityRoot, FRESH_BOOK_CYCLE.claimName);
  if (existsSync(path.join(env.authorityRoot, FRESH_BOOK_CYCLE.outcomeName))) fail('fresh_book_slot_used');
  let fd: number;
  try { fd = openSync(file, 'wx'); } catch { return fail('fresh_book_slot_used'); }
  try { writeFileSync(fd, JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, grantSha256: grantSha, profileSha256: grant.profileSha256,
    bookDir: path.resolve(grant.bookDir), engineHead: grant.engine.head, claimedAt: new Date().toISOString() }) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
  return file;
}
/**
 * Synchronous, before EVERY paid claim of every stage (and on resume): the same grant bytes, the profile it names, the claim this grant
 * wrote (same book folder), the clean source at the grant's head and every pinned file. Returns the parsed grant.
 */
export function assertFreshBookPaid(args: { env: FreshBookEnv; grantFile: string; grantSha: string; profile: FreshBookProfile; workspace: string }) {
  const bytes = fileBytes(args.grantFile);
  if (previewSha(bytes) !== args.grantSha) fail('fresh_book_grant');
  const grant = freshBookGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (grant.profileSha256 !== freshBookProfileSha(args.profile)) fail('fresh_book_profile_changed');
  const claimFile = path.join(args.env.authorityRoot, FRESH_BOOK_CYCLE.claimName);
  if (!existsSync(claimFile)) fail('fresh_book_claim');
  const claim = JSON.parse(fileBytes(claimFile).toString('utf8'));
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.grantSha256 !== args.grantSha || claim.profileSha256 !== grant.profileSha256 ||
      path.resolve(claim.bookDir).toLowerCase() !== path.resolve(grant.bookDir).toLowerCase() || claim.engineHead !== grant.engine.head) fail('fresh_book_claim_foreign');
  const engine = args.env.head();
  if (!engine.clean || engine.head !== grant.engine.head || engine.branch !== grant.engine.branch) fail('fresh_book_source_changed');
  for (const [rel, digest] of Object.entries(grant.pins)) if (previewSha(fileBytes(path.join(args.workspace, rel))) !== digest) fail('fresh_book_source_changed');
  return grant;
}

/**
 * The ONE same-book text recovery (Guy 2026-10-18 OWNER-AUTONOMOUS-BOOK-TEXT-RECOVERY-AMENDMENT): after THIS book's terminal failed_text
 * (critic_evidence) record, a bound successor of the same book, never a reopening. Fixed in code like the cycle: its own claim/outcome/audition
 * start under the fixed authority root and its own folder beside the failed text, so another label, folder or grant cannot fund a second use;
 * the original grant, claim, outcome, seal and paid evidence stay byte-identical and are pinned by digest. Its API allowance is additional to
 * the original text plan: ONE citation correction (normal 600000 reservation) and the still-required storyboard review, inside the unchanged caps.
 */
export const FRESH_BOOK_RECOVERY = Object.freeze({
  version: 'fresh-book-text-recovery/v1',
  amendment: 'Guy 2026-10-18 OWNER-AUTONOMOUS-BOOK-TEXT-RECOVERY-AMENDMENT-20261018.txt: ONE bound text recovery of the SAME existing book after its failed_text record; preserve all history; at most ONE additional Sol 6.1 citation-correction call (source references only, 600000 microUSD reservation), then the still-required Opus 5.5 Max storyboard and the original Sol storyboard review; same cumulative USD 7 book / USD 8 cycle caps; no writer/editor rerun, reset or second book use.',
  claimName: 'owner-cycle-20261017-fresh-book-usd7.text-recovery.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.text-recovery.outcome.json',
  auditionStartName: 'owner-cycle-20261017-fresh-book-usd7.text-recovery.audition.json',
  /** The verified successor's one durable provenance record (written once, at completion, only after its chain re-verifies). */
  successorName: 'owner-cycle-20261017-fresh-book-usd7.text-recovery.successor.json',
  folder: 'text-recovery',
  failedOutcome: 'failed_text', failedCode: 'critic_evidence',
  correctionCalls: 1, correctionReserveMicroUsd: 600_000, apiCalls: 2,
});
const sha40 = z.string().regex(/^[a-f0-9]{40}$/), micro = z.number().int().nonnegative();
export const freshBookRecoveryGrantSchema = z.object({ version: z.literal('fresh-book-recovery-grant/v1'), cycle: z.literal(FRESH_BOOK_CYCLE.id),
  approval: z.literal(FRESH_BOOK_CYCLE.approval), amendment: z.literal(FRESH_BOOK_RECOVERY.amendment), profileSha256: hash,
  bookDir: z.string().refine(p => path.isAbsolute(p)),
  /** The consumed original authority and failed evidence, by digest (the original grant's pins bind ITS head, never this one's). */
  original: z.object({ grantFile: z.string().refine(p => path.isAbsolute(p)), grantSha256: hash, engineHead: sha40, claimSha256: hash, outcomeSha256: hash,
    textSealSha256: hash, textEvidenceSha256: hash, requestSha256: hash, admissionSha256: hash }).strict(),
  ledger: z.object({ diagnosticSettledMicroUsd: micro, originalTextKnownMicroUsd: micro, originalTextCalls: micro }).strict(),
  allowance: z.object({ correctionCalls: z.literal(FRESH_BOOK_RECOVERY.correctionCalls), correctionReserveMicroUsd: z.literal(FRESH_BOOK_RECOVERY.correctionReserveMicroUsd),
    apiCalls: z.literal(FRESH_BOOK_RECOVERY.apiCalls) }).strict(),
  engine: z.object({ head: sha40, branch: z.string().min(1) }).strict(), pins: z.record(z.string(), hash), nativePlanSha256: hash }).strict();
export type FreshBookRecoveryGrant = z.infer<typeof freshBookRecoveryGrantSchema>;

/** The recovery's one claim: once, only while its outcome is absent; any existing claim refuses, for any grant, label or folder. */
export function claimFreshBookRecovery(env: FreshBookEnv, grant: FreshBookRecoveryGrant, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('fresh_book_authority_root');
  if (existsSync(path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.outcomeName))) fail('fresh_book_recovery_used');
  let fd: number;
  try { fd = openSync(path.join(env.authorityRoot, FRESH_BOOK_RECOVERY.claimName), 'wx'); } catch { return fail('fresh_book_recovery_used'); }
  try { writeFileSync(fd, JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, recovery: FRESH_BOOK_RECOVERY.version, grantSha256: grantSha,
    originalClaimSha256: grant.original.claimSha256, profileSha256: grant.profileSha256, bookDir: path.resolve(grant.bookDir), engineHead: grant.engine.head,
    claimedAt: new Date().toISOString() }) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
}
/** Synchronous, before EVERY paid call of a recovery-line stage: the recovery grant bytes, its profile, the claim it wrote, the original claim, source and pins. */
export function assertFreshBookRecoveryPaid(args: { env: FreshBookEnv; grantFile: string; grantSha: string; profile: FreshBookProfile; workspace: string }) {
  const bytes = fileBytes(args.grantFile);
  if (previewSha(bytes) !== args.grantSha) fail('fresh_book_recovery_grant');
  const grant = freshBookRecoveryGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (grant.profileSha256 !== freshBookProfileSha(args.profile)) fail('fresh_book_profile_changed');
  const claimFile = path.join(args.env.authorityRoot, FRESH_BOOK_RECOVERY.claimName), originalClaim = path.join(args.env.authorityRoot, FRESH_BOOK_CYCLE.claimName);
  if (!existsSync(claimFile) || !existsSync(originalClaim) || previewSha(fileBytes(originalClaim)) !== grant.original.claimSha256) fail('fresh_book_claim');
  const claim = JSON.parse(fileBytes(claimFile).toString('utf8'));
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.recovery !== FRESH_BOOK_RECOVERY.version || claim.grantSha256 !== args.grantSha ||
      claim.originalClaimSha256 !== grant.original.claimSha256 || claim.profileSha256 !== grant.profileSha256 ||
      path.resolve(claim.bookDir).toLowerCase() !== path.resolve(grant.bookDir).toLowerCase() || claim.engineHead !== grant.engine.head) fail('fresh_book_claim_foreign');
  const engine = args.env.head();
  if (!engine.clean || engine.head !== grant.engine.head || engine.branch !== grant.engine.branch) fail('fresh_book_source_changed');
  for (const [rel, digest] of Object.entries(grant.pins)) if (previewSha(fileBytes(path.join(args.workspace, rel))) !== digest) fail('fresh_book_source_changed');
  return grant;
}

/**
 * The ONE storyboard-only repair of the SAME book (Guy 2026-10-18 OWNER-STORYBOARD-RECOVERY-AND-FULL-BOOK-BRIEF-APPROVAL): after the text
 * recovery's terminal held_text record (its storyboard held by its own review), a bound successor of that held storyboard, never a reopening:
 * the held draft and its exact raw review are the repair input (storyboard-repair/v1; the engine derives the findings), the visible-moment
 * contract is added, ONE Opus 5.5 Claude Max planner repair and ONE Sol 6.1 review are new. Fixed in code like the cycle and the recovery:
 * its own claim/outcome/audition start/successor and folder, so another label, folder or grant cannot fund a second use; every earlier grant,
 * claim, outcome, seal, answer and cost stays byte-identical and is pinned by digest. Its review reserves at least the owner's normal 600000.
 */
export const FRESH_BOOK_STORYBOARD_REPAIR = Object.freeze({
  version: 'fresh-book-storyboard-repair/v1',
  amendment: 'Guy 2026-10-18 OWNER-STORYBOARD-RECOVERY-AND-FULL-BOOK-BRIEF-APPROVAL-20261018.txt: ONE storyboard-only repair successor of the SAME book after its held text-recovery storyboard: the held draft and its exact review are the structured repair input; ONE new Opus 5.5 Claude Max planner repair and ONE new Sol 6.1 storyboard review (at least the normal 600000 microUSD reservation); then child, references, two representative samples, the rest and the cover on their gates; same cumulative USD 7 book / USD 8 cycle caps; story, citations and every earlier record unchanged; no writer, editor or citation rerun, reset or second book.',
  claimName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-repair.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-repair.outcome.json',
  auditionStartName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-repair.audition.json',
  /** The verified successor's one durable provenance record (written once, at completion, only after its whole chain replays). */
  successorName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-repair.successor.json',
  folder: 'storyboard-repair',
  /** The terminal record it stands on: the text recovery held by its storyboard review (either held disposition). */
  heldOutcome: 'held_text', heldStatuses: Object.freeze(['held_uncertain', 'held_contradiction'] as const),
  plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600_000,
  addedContracts: Object.freeze(['visibleMomentContract'] as const),
});
export const freshBookStoryboardRepairGrantSchema = z.object({ version: z.literal('fresh-book-storyboard-repair-grant/v1'), cycle: z.literal(FRESH_BOOK_CYCLE.id),
  approval: z.literal(FRESH_BOOK_CYCLE.approval), amendment: z.literal(FRESH_BOOK_STORYBOARD_REPAIR.amendment), profileSha256: hash,
  bookDir: z.string().refine(p => path.isAbsolute(p)),
  /** The consumed recovery authority and its held evidence, by digest (the recovery grant's pins bind ITS head, never this one's). */
  recovery: z.object({ grantFile: z.string().refine(p => path.isAbsolute(p)), grantSha256: hash, claimSha256: hash, outcomeSha256: hash, sealSha256: hash,
    folderSha256: hash, originalClaimSha256: hash }).strict(),
  /** The held storyboard it repairs, re-derived from the recovery's own saved source, draft and raw review. */
  held: z.object({ sourceDigest: hash, storyboardDigest: hash, reviewDigest: hash, disposition: z.enum(FRESH_BOOK_STORYBOARD_REPAIR.heldStatuses),
    draftSha256: hash, findings: z.number().int().positive() }).strict(),
  ledger: z.object({ diagnosticSettledMicroUsd: micro, bookKnownMicroUsd: micro, calls: micro }).strict(),
  allowance: z.object({ plannerCalls: z.literal(FRESH_BOOK_STORYBOARD_REPAIR.plannerCalls), apiCalls: z.literal(FRESH_BOOK_STORYBOARD_REPAIR.apiCalls),
    reviewReserveFloorMicroUsd: z.literal(FRESH_BOOK_STORYBOARD_REPAIR.reviewReserveFloorMicroUsd) }).strict(),
  addedContracts: z.tuple([z.literal('visibleMomentContract')]),
  engine: z.object({ head: sha40, branch: z.string().min(1) }).strict(), pins: z.record(z.string(), hash), nativePlanSha256: hash }).strict();
export type FreshBookStoryboardRepairGrant = z.infer<typeof freshBookStoryboardRepairGrantSchema>;

/** The storyboard repair's one claim: once, only while its outcome is absent; any existing claim refuses, for any grant, label or folder. */
export function claimFreshBookStoryboardRepair(env: FreshBookEnv, grant: FreshBookStoryboardRepairGrant, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('fresh_book_authority_root');
  if (existsSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName))) fail('fresh_book_storyboard_repair_used');
  let fd: number;
  try { fd = openSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REPAIR.claimName), 'wx'); } catch { return fail('fresh_book_storyboard_repair_used'); }
  try { writeFileSync(fd, JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, storyboardRepair: FRESH_BOOK_STORYBOARD_REPAIR.version, grantSha256: grantSha,
    recoveryClaimSha256: grant.recovery.claimSha256, originalClaimSha256: grant.recovery.originalClaimSha256, profileSha256: grant.profileSha256,
    bookDir: path.resolve(grant.bookDir), engineHead: grant.engine.head, claimedAt: new Date().toISOString() }) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
}
/**
 * Synchronous, before EVERY paid call of a storyboard-repair-line stage: the repair grant bytes, its profile, the claim it wrote, the recovery
 * claim and the original claim it names, the clean source at its head and every pinned file.
 */
export function assertFreshBookStoryboardRepairPaid(args: { env: FreshBookEnv; grantFile: string; grantSha: string; profile: FreshBookProfile; workspace: string }) {
  const bytes = fileBytes(args.grantFile);
  if (previewSha(bytes) !== args.grantSha) fail('fresh_book_storyboard_repair_grant');
  const grant = freshBookStoryboardRepairGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (grant.profileSha256 !== freshBookProfileSha(args.profile)) fail('fresh_book_profile_changed');
  const at = (name: string) => path.join(args.env.authorityRoot, name), claimFile = at(FRESH_BOOK_STORYBOARD_REPAIR.claimName);
  if (!existsSync(claimFile) || !existsSync(at(FRESH_BOOK_RECOVERY.claimName)) || !existsSync(at(FRESH_BOOK_CYCLE.claimName)) ||
      previewSha(fileBytes(at(FRESH_BOOK_RECOVERY.claimName))) !== grant.recovery.claimSha256 ||
      previewSha(fileBytes(at(FRESH_BOOK_CYCLE.claimName))) !== grant.recovery.originalClaimSha256) fail('fresh_book_claim');
  const claim = JSON.parse(fileBytes(claimFile).toString('utf8'));
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardRepair !== FRESH_BOOK_STORYBOARD_REPAIR.version || claim.grantSha256 !== args.grantSha ||
      claim.recoveryClaimSha256 !== grant.recovery.claimSha256 || claim.originalClaimSha256 !== grant.recovery.originalClaimSha256 ||
      claim.profileSha256 !== grant.profileSha256 || path.resolve(claim.bookDir).toLowerCase() !== path.resolve(grant.bookDir).toLowerCase() ||
      claim.engineHead !== grant.engine.head) fail('fresh_book_claim_foreign');
  const engine = args.env.head();
  if (!engine.clean || engine.head !== grant.engine.head || engine.branch !== grant.engine.branch) fail('fresh_book_source_changed');
  for (const [rel, digest] of Object.entries(grant.pins)) if (previewSha(fileBytes(path.join(args.workspace, rel))) !== digest) fail('fresh_book_source_changed');
  return grant;
}

/**
 * The ONE diagnosed storyboard continuation of the SAME book (Guy 2026-10-19 OWNER-GENERAL-STORYBOARD-RECOVERY-AMENDMENT): after the first
 * storyboard repair's terminal held record (the stage's SECOND consecutive held candidate), a bound successor of that held repair, never a
 * reopening: the held repair's draft and exact raw review, with the repair's own input as its parentRepair ancestry, are the continuation
 * input (storyboard-repair/v1). The engine derives the stage-recovery state of both held candidates (stage-recovery/v1, ceiling
 * STORYBOARD_MAX_ATTEMPTS), their diagnosis (storyboard-diagnosis/v1), which the planner consumes, and the changed strategy: the planner
 * self-check and the typed review materiality contracts are added. ONE Opus 5.5 Claude Max planner and ONE Sol 6.1 review are new (at least the
 * normal 600000 reservation); it is the stage's last attempt. Fixed in code like every earlier line: its own claim/outcome/audition
 * start/successor and folder; every earlier grant, claim, outcome, seal, answer and cost stays byte-identical and is pinned by digest.
 */
export const FRESH_BOOK_STORYBOARD_CONTINUATION = Object.freeze({
  version: 'fresh-book-storyboard-continuation/v1',
  amendment: 'Guy 2026-10-19 OWNER-GENERAL-STORYBOARD-RECOVERY-AMENDMENT-20261019.txt: ONE diagnosed storyboard continuation of the SAME book after its held first storyboard repair (the second consecutive held storyboard candidate); engine retries, diagnosis of both held candidates and a changed strategy, typed impact materiality (minor positive-evidence notes only are non-blocking; major, unknown or unbound issues hold); ONE new Opus 5.5 Claude Max planner and ONE new Sol 6.1 storyboard review (at least the normal 600000 microUSD reservation); then child, references, two representative samples, the rest and the cover on their gates; same cumulative USD 7 book / USD 8 cycle caps; no separate paid diagnostic; story, citations and every earlier record unchanged; no owner waiver, reset or second book.',
  claimName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-continuation.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-continuation.outcome.json',
  auditionStartName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-continuation.audition.json',
  /** The verified successor's one durable provenance record (written once, at completion, only after its whole chain replays). */
  successorName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-continuation.successor.json',
  folder: 'storyboard-continuation',
  /** The terminal record it stands on: the first storyboard repair held by its own review (either held disposition). */
  heldOutcome: 'held_storyboard_repair', heldStatuses: Object.freeze(['held_uncertain', 'held_contradiction'] as const),
  /** Its own terminal record when its review holds it too: the stage's attempt ceiling is then reached. */
  ownHeldOutcome: 'held_storyboard_continuation',
  /** Admitted by its review: supported, or (typed policy) supported with bound detail notes. */
  admittedStatuses: Object.freeze(['review_supported', 'review_supported_with_notes'] as const),
  plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600_000,
  /** The two earlier held candidates of the stage (the recovery's and the first repair's) and the stage ceiling this attempt reaches. */
  priorAttempts: 2, maxAttempts: 3,
  addedContracts: Object.freeze(['selfCheckContract', 'reviewImpactPolicy'] as const),
});
export const freshBookStoryboardContinuationGrantSchema = z.object({ version: z.literal('fresh-book-storyboard-continuation-grant/v1'),
  cycle: z.literal(FRESH_BOOK_CYCLE.id), approval: z.literal(FRESH_BOOK_CYCLE.approval), amendment: z.literal(FRESH_BOOK_STORYBOARD_CONTINUATION.amendment),
  profileSha256: hash, bookDir: z.string().refine(p => path.isAbsolute(p)),
  /** The consumed repair authority and its held evidence, by digest (the repair grant's pins bind ITS head, never this one's). */
  repair: z.object({ grantFile: z.string().refine(p => path.isAbsolute(p)), grantSha256: hash, claimSha256: hash, outcomeSha256: hash, sealSha256: hash,
    folderSha256: hash, recoveryClaimSha256: hash, originalClaimSha256: hash, reviewReceiptSha256: hash }).strict(),
  /** The held repair storyboard it continues, re-derived from the repair's own saved source, draft and raw review. */
  held: z.object({ sourceDigest: hash, storyboardDigest: hash, reviewDigest: hash, disposition: z.enum(FRESH_BOOK_STORYBOARD_CONTINUATION.heldStatuses),
    draftSha256: hash, findings: z.number().int().positive() }).strict(),
  /** The stage's recovery state at admission, derived by the engine from both held candidates, and the diagnosis this attempt consumes. */
  recovery: z.object({ version: z.literal('stage-recovery/v1'), attempts: z.literal(FRESH_BOOK_STORYBOARD_CONTINUATION.priorAttempts),
    maxAttempts: z.literal(FRESH_BOOK_STORYBOARD_CONTINUATION.maxAttempts), consecutiveFailures: z.literal(2), mode: z.literal('diagnose_and_change_strategy'),
    stateSha256: hash, diagnosisDigest: hash, contextDigest: hash }).strict(),
  ledger: z.object({ diagnosticSettledMicroUsd: micro, bookKnownMicroUsd: micro, calls: micro }).strict(),
  allowance: z.object({ plannerCalls: z.literal(FRESH_BOOK_STORYBOARD_CONTINUATION.plannerCalls), apiCalls: z.literal(FRESH_BOOK_STORYBOARD_CONTINUATION.apiCalls),
    reviewReserveFloorMicroUsd: z.literal(FRESH_BOOK_STORYBOARD_CONTINUATION.reviewReserveFloorMicroUsd) }).strict(),
  addedContracts: z.tuple([z.literal('selfCheckContract'), z.literal('reviewImpactPolicy')]),
  engine: z.object({ head: sha40, branch: z.string().min(1) }).strict(), pins: z.record(z.string(), hash), nativePlanSha256: hash }).strict();
export type FreshBookStoryboardContinuationGrant = z.infer<typeof freshBookStoryboardContinuationGrantSchema>;

/** The continuation's one claim: once, only while its outcome is absent; any existing claim refuses, for any grant, label or folder. */
export function claimFreshBookStoryboardContinuation(env: FreshBookEnv, grant: FreshBookStoryboardContinuationGrant, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('fresh_book_authority_root');
  if (existsSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_CONTINUATION.outcomeName))) fail('fresh_book_storyboard_continuation_used');
  let fd: number;
  try { fd = openSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_CONTINUATION.claimName), 'wx'); } catch { return fail('fresh_book_storyboard_continuation_used'); }
  try { writeFileSync(fd, JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, storyboardContinuation: FRESH_BOOK_STORYBOARD_CONTINUATION.version, grantSha256: grantSha,
    repairClaimSha256: grant.repair.claimSha256, recoveryClaimSha256: grant.repair.recoveryClaimSha256, originalClaimSha256: grant.repair.originalClaimSha256,
    profileSha256: grant.profileSha256, bookDir: path.resolve(grant.bookDir), engineHead: grant.engine.head, claimedAt: new Date().toISOString() }) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
}
/**
 * Synchronous, before EVERY paid call of a continuation-line stage: the continuation grant bytes, its profile, the claim it wrote, the repair,
 * recovery and original claims it names, the clean source at its head and every pinned file.
 */
export function assertFreshBookStoryboardContinuationPaid(args: { env: FreshBookEnv; grantFile: string; grantSha: string; profile: FreshBookProfile; workspace: string }) {
  const bytes = fileBytes(args.grantFile);
  if (previewSha(bytes) !== args.grantSha) fail('fresh_book_storyboard_continuation_grant');
  const grant = freshBookStoryboardContinuationGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (grant.profileSha256 !== freshBookProfileSha(args.profile)) fail('fresh_book_profile_changed');
  const at = (name: string) => path.join(args.env.authorityRoot, name), claimFile = at(FRESH_BOOK_STORYBOARD_CONTINUATION.claimName);
  const named = [[FRESH_BOOK_STORYBOARD_REPAIR.claimName, grant.repair.claimSha256], [FRESH_BOOK_RECOVERY.claimName, grant.repair.recoveryClaimSha256],
    [FRESH_BOOK_CYCLE.claimName, grant.repair.originalClaimSha256]] as const;
  if (!existsSync(claimFile) || named.some(([name, digest]) => !existsSync(at(name)) || previewSha(fileBytes(at(name))) !== digest)) fail('fresh_book_claim');
  const claim = JSON.parse(fileBytes(claimFile).toString('utf8'));
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardContinuation !== FRESH_BOOK_STORYBOARD_CONTINUATION.version || claim.grantSha256 !== args.grantSha ||
      claim.repairClaimSha256 !== grant.repair.claimSha256 || claim.recoveryClaimSha256 !== grant.repair.recoveryClaimSha256 ||
      claim.originalClaimSha256 !== grant.repair.originalClaimSha256 || claim.profileSha256 !== grant.profileSha256 ||
      path.resolve(claim.bookDir).toLowerCase() !== path.resolve(grant.bookDir).toLowerCase() || claim.engineHead !== grant.engine.head) fail('fresh_book_claim_foreign');
  const engine = args.env.head();
  if (!engine.clean || engine.head !== grant.engine.head || engine.branch !== grant.engine.branch) fail('fresh_book_source_changed');
  for (const [rel, digest] of Object.entries(grant.pins)) if (previewSha(fileBytes(path.join(args.workspace, rel))) !== digest) fail('fresh_book_source_changed');
  return grant;
}

/**
 * The bound REVALIDATION of the continuation's paid answer (same owner amendment, same allowance): the ONE continuation ran its Opus 5.5
 * Max planner, and the engine refused the paid answer at compile with `storyboard_self_check_resolution_changed` (book-level section names
 * the strict v1 check did not resolve) BEFORE its ONE Sol review. This line completes that same allowance: the SAME paid answer (its saved
 * planner call replayed, never re-sent) is compiled under the opt-in storyboard-self-check-names/v1 correction and gets the ONE unspent review
 * (at least the normal 600000). No new planner call, no fourth storyboard attempt, no new book. Fixed in code like every earlier line: its own
 * claim/outcome/audition start/successor and folder; every earlier grant, claim, outcome, seal, answer and cost stays byte-identical.
 */
export const FRESH_BOOK_STORYBOARD_REVALIDATION = Object.freeze({
  version: 'fresh-book-storyboard-revalidation/v1',
  amendment: 'Guy 2026-10-19 OWNER-GENERAL-STORYBOARD-RECOVERY-AMENDMENT-20261019.txt (ONE further Opus 5.5 Max planner and ONE further Sol 6.1 review): the continuation\'s paid planner answer was refused at compile by an engine vocabulary defect (book-level self-check section names) before its review; this bound successor completes the SAME allowance: the same paid answer, compiled under the corrected engine (storyboard-self-check-names/v1), gets the ONE unspent Sol 6.1 storyboard review (at least the normal 600000 microUSD reservation); no new planner call, no fourth attempt, no new book; then child, references, two samples, the rest and the cover on their gates; same cumulative USD 7 book / USD 8 cycle caps.',
  claimName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-revalidation.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-revalidation.outcome.json',
  auditionStartName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-revalidation.audition.json',
  /** The verified successor's one durable provenance record (written once, at completion, only after its whole chain replays). */
  successorName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-revalidation.successor.json',
  folder: 'storyboard-revalidation',
  /** The ONE terminal record it stands on: the continuation refused at compile for exactly this reason, before its review. */
  failedOutcome: 'failed_storyboard_continuation', failedCode: 'storyboard_self_check_resolution_changed',
  ownHeldOutcome: 'held_storyboard_revalidation',
  admittedStatuses: Object.freeze(['review_supported', 'review_supported_with_notes'] as const),
  plannerCalls: 0, apiCalls: 1, reviewReserveFloorMicroUsd: 600_000,
});
export const freshBookStoryboardRevalidationGrantSchema = z.object({ version: z.literal('fresh-book-storyboard-revalidation-grant/v1'),
  cycle: z.literal(FRESH_BOOK_CYCLE.id), approval: z.literal(FRESH_BOOK_CYCLE.approval), amendment: z.literal(FRESH_BOOK_STORYBOARD_REVALIDATION.amendment),
  profileSha256: hash, bookDir: z.string().refine(p => path.isAbsolute(p)),
  /** The consumed continuation authority, its refusal and its PAID planner answer, by digest (its grant's pins bind ITS head, never this one's). */
  continuation: z.object({ grantFile: z.string().refine(p => path.isAbsolute(p)), grantSha256: hash, claimSha256: hash, outcomeSha256: hash, sealSha256: hash,
    folderSha256: hash, plannerReceiptSha256: hash, plannerWireDigest: hash, plannerMaxMicroUsd: micro, repairClaimSha256: hash, recoveryClaimSha256: hash,
    originalClaimSha256: hash }).strict(),
  /** The paid answer compiled under the correction: its digests, coverage and every section name the correction resolved. */
  candidate: z.object({ sourceDigest: hash, storyboardDigest: hash, draftSha256: hash, claims: z.number().int().positive(), resolutions: z.number().int().positive(),
    resolvedNames: z.array(z.object({ from: z.string().min(1).max(80), to: z.array(z.string().min(1).max(80)).min(1).max(16) }).strict()).min(1).max(24) }).strict(),
  /** The stage's recovery facts this review completes: attempt 3 of 3, the consumed continuation's state and diagnosis. */
  recovery: z.object({ attempt: z.literal(3), maxAttempts: z.literal(3), stateSha256: hash, diagnosisDigest: hash }).strict(),
  ledger: z.object({ diagnosticSettledMicroUsd: micro, bookKnownMicroUsd: micro, calls: micro }).strict(),
  allowance: z.object({ plannerCalls: z.literal(0), apiCalls: z.literal(FRESH_BOOK_STORYBOARD_REVALIDATION.apiCalls),
    reviewReserveFloorMicroUsd: z.literal(FRESH_BOOK_STORYBOARD_REVALIDATION.reviewReserveFloorMicroUsd) }).strict(),
  compile: z.tuple([z.literal('storyboard-self-check-names/v1')]),
  engine: z.object({ head: sha40, branch: z.string().min(1) }).strict(), pins: z.record(z.string(), hash), nativePlanSha256: hash }).strict();
export type FreshBookStoryboardRevalidationGrant = z.infer<typeof freshBookStoryboardRevalidationGrantSchema>;

/** The revalidation's one claim: once, only while its outcome is absent; any existing claim refuses, for any grant, label or folder. */
export function claimFreshBookStoryboardRevalidation(env: FreshBookEnv, grant: FreshBookStoryboardRevalidationGrant, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('fresh_book_authority_root');
  if (existsSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REVALIDATION.outcomeName))) fail('fresh_book_storyboard_revalidation_used');
  let fd: number;
  try { fd = openSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_REVALIDATION.claimName), 'wx'); } catch { return fail('fresh_book_storyboard_revalidation_used'); }
  try { writeFileSync(fd, JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, storyboardRevalidation: FRESH_BOOK_STORYBOARD_REVALIDATION.version, grantSha256: grantSha,
    continuationClaimSha256: grant.continuation.claimSha256, repairClaimSha256: grant.continuation.repairClaimSha256,
    recoveryClaimSha256: grant.continuation.recoveryClaimSha256, originalClaimSha256: grant.continuation.originalClaimSha256, profileSha256: grant.profileSha256,
    bookDir: path.resolve(grant.bookDir), engineHead: grant.engine.head, claimedAt: new Date().toISOString() }) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
}
/**
 * Synchronous, before EVERY paid call of a revalidation-line stage: the revalidation grant bytes, its profile, the claim it wrote, the
 * continuation, repair, recovery and original claims it names, the clean source at its head and every pinned file.
 */
export function assertFreshBookStoryboardRevalidationPaid(args: { env: FreshBookEnv; grantFile: string; grantSha: string; profile: FreshBookProfile; workspace: string }) {
  const bytes = fileBytes(args.grantFile);
  if (previewSha(bytes) !== args.grantSha) fail('fresh_book_storyboard_revalidation_grant');
  const grant = freshBookStoryboardRevalidationGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (grant.profileSha256 !== freshBookProfileSha(args.profile)) fail('fresh_book_profile_changed');
  const at = (name: string) => path.join(args.env.authorityRoot, name), claimFile = at(FRESH_BOOK_STORYBOARD_REVALIDATION.claimName);
  const named = [[FRESH_BOOK_STORYBOARD_CONTINUATION.claimName, grant.continuation.claimSha256], [FRESH_BOOK_STORYBOARD_REPAIR.claimName, grant.continuation.repairClaimSha256],
    [FRESH_BOOK_RECOVERY.claimName, grant.continuation.recoveryClaimSha256], [FRESH_BOOK_CYCLE.claimName, grant.continuation.originalClaimSha256]] as const;
  if (!existsSync(claimFile) || named.some(([name, digest]) => !existsSync(at(name)) || previewSha(fileBytes(at(name))) !== digest)) fail('fresh_book_claim');
  const claim = JSON.parse(fileBytes(claimFile).toString('utf8'));
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardRevalidation !== FRESH_BOOK_STORYBOARD_REVALIDATION.version || claim.grantSha256 !== args.grantSha ||
      claim.continuationClaimSha256 !== grant.continuation.claimSha256 || claim.repairClaimSha256 !== grant.continuation.repairClaimSha256 ||
      claim.recoveryClaimSha256 !== grant.continuation.recoveryClaimSha256 || claim.originalClaimSha256 !== grant.continuation.originalClaimSha256 ||
      claim.profileSha256 !== grant.profileSha256 || path.resolve(claim.bookDir).toLowerCase() !== path.resolve(grant.bookDir).toLowerCase() ||
      claim.engineHead !== grant.engine.head) fail('fresh_book_claim_foreign');
  const engine = args.env.head();
  if (!engine.clean || engine.head !== grant.engine.head || engine.branch !== grant.engine.branch) fail('fresh_book_source_changed');
  for (const [rel, digest] of Object.entries(grant.pins)) if (previewSha(fileBytes(path.join(args.workspace, rel))) !== digest) fail('fresh_book_source_changed');
  return grant;
}

/**
 * The ONE owner-approved EXTENSION of the storyboard stage (refined Proposal B, Guy's direct approval 2026-10-19): the revalidation reviewed
 * the stage's third and last attempt and held it (stop_allowance_exhausted). This explicitly bounded attempt 4 of 4 re-plans the SAME book
 * under the general claim-basis contract with ONE new Opus 5.5 Max planner and ONE Sol 6.1 review. Every earlier grant, claim, outcome,
 * seal, answer and cost stays byte-identical; its own claim/outcome/audition start/successor and folder are fixed in code like every line.
 */
export const FRESH_BOOK_STORYBOARD_EXTENSION = Object.freeze({
  version: 'fresh-book-storyboard-extension/v1',
  amendment: 'Guy 2026-10-19 OWNER-APPROVAL-REFINED-B-ATTEMPT4-20261019.txt (refined Proposal B, approved in chat: "מאשר B המתוקן"): ONE additional, explicitly bounded storyboard attempt (4 of 4) of the SAME book after its held revalidation (stop_allowance_exhausted at 3 of 3), under the general claim-basis contract (storyboard-claim-basis/v1): ONE Opus 5.5 Claude Max planner and ONE Sol 6.1 review (at least the normal 600000 microUSD reservation); all 3 historical attempts and the consumed compile refusal and revalidation records retained; no author/editor/comparison rerun, separate paid diagnosis, new book, old-grant repin, reset or further extension; then child, references, two samples, the rest and the cover on their gates; same cumulative USD 7 book / USD 8 cycle caps; held again ends the line with an honest report (no attempt 5).',
  claimName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-extension.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-extension.outcome.json',
  auditionStartName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-extension.audition.json',
  /** The verified successor's one durable provenance record (written once, at completion, only after its whole chain replays). */
  successorName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-extension.successor.json',
  folder: 'storyboard-extension',
  /** The terminal record it stands on: the revalidation held by its review at the stage's base ceiling. */
  heldOutcome: 'held_storyboard_revalidation', heldStatuses: Object.freeze(['held_uncertain', 'held_contradiction'] as const), heldRecovery: 'stop_allowance_exhausted',
  ownHeldOutcome: 'held_storyboard_extension',
  admittedStatuses: Object.freeze(['review_supported', 'review_supported_with_notes'] as const),
  plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600_000,
  /** The three earlier held candidates and the owner's explicit ceiling: this is attempt 4 of 4. */
  priorAttempts: 3, maxAttempts: 4,
  addedContracts: Object.freeze(['claimBasisContract'] as const),
  /** The owner's approval record: its exact verbatim approval line must be in it (its bytes are bound by digest). */
  approvalLine: 'Guy, verbatim: "מאשר B המתוקן"',
});
export const freshBookStoryboardExtensionGrantSchema = z.object({ version: z.literal('fresh-book-storyboard-extension-grant/v1'),
  cycle: z.literal(FRESH_BOOK_CYCLE.id), approval: z.literal(FRESH_BOOK_CYCLE.approval), amendment: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION.amendment),
  ownerApproval: z.object({ file: z.string().refine(p => path.isAbsolute(p)), sha256: hash }).strict(),
  profileSha256: hash, bookDir: z.string().refine(p => path.isAbsolute(p)),
  /** The consumed revalidation authority, its held review and every claim it names, by digest (its grant's pins bind ITS head, never this one's). */
  revalidation: z.object({ grantFile: z.string().refine(p => path.isAbsolute(p)), grantSha256: hash, claimSha256: hash, outcomeSha256: hash, sealSha256: hash,
    folderSha256: hash, reviewReceiptSha256: hash, recoveryFinalSha256: hash, continuationClaimSha256: hash, repairClaimSha256: hash,
    recoveryClaimSha256: hash, originalClaimSha256: hash }).strict(),
  /** The held candidate it re-plans (attempt 3), re-derived from the revalidation's own saved draft and raw review. */
  held: z.object({ sourceDigest: hash, storyboardDigest: hash, reviewDigest: hash, disposition: z.enum(FRESH_BOOK_STORYBOARD_EXTENSION.heldStatuses),
    draftSha256: hash, findings: z.number().int().positive() }).strict(),
  /** The stage's recovery state at admission (three consecutive held candidates, the owner's ceiling 4) and the diagnosis this attempt consumes. */
  recovery: z.object({ version: z.literal('stage-recovery/v1'), attempts: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION.priorAttempts),
    maxAttempts: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION.maxAttempts), consecutiveFailures: z.literal(3), mode: z.literal('diagnose_and_change_strategy'),
    stateSha256: hash, diagnosisDigest: hash, contextDigest: hash }).strict(),
  ledger: z.object({ diagnosticSettledMicroUsd: micro, bookKnownMicroUsd: micro, calls: micro }).strict(),
  allowance: z.object({ plannerCalls: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION.plannerCalls), apiCalls: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION.apiCalls),
    reviewReserveFloorMicroUsd: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION.reviewReserveFloorMicroUsd) }).strict(),
  addedContracts: z.tuple([z.literal('claimBasisContract')]), compile: z.tuple([z.literal('storyboard-self-check-names/v1')]),
  engine: z.object({ head: sha40, branch: z.string().min(1) }).strict(), pins: z.record(z.string(), hash), nativePlanSha256: hash }).strict();
export type FreshBookStoryboardExtensionGrant = z.infer<typeof freshBookStoryboardExtensionGrantSchema>;

/** The extension's one claim: once, only while its outcome is absent; any existing claim refuses, for any grant, label or folder. */
export function claimFreshBookStoryboardExtension(env: FreshBookEnv, grant: FreshBookStoryboardExtensionGrant, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('fresh_book_authority_root');
  if (existsSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_EXTENSION.outcomeName))) fail('fresh_book_storyboard_extension_used');
  let fd: number;
  try { fd = openSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_EXTENSION.claimName), 'wx'); } catch { return fail('fresh_book_storyboard_extension_used'); }
  try { writeFileSync(fd, JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, storyboardExtension: FRESH_BOOK_STORYBOARD_EXTENSION.version, grantSha256: grantSha,
    ownerApprovalSha256: grant.ownerApproval.sha256, revalidationClaimSha256: grant.revalidation.claimSha256,
    continuationClaimSha256: grant.revalidation.continuationClaimSha256, repairClaimSha256: grant.revalidation.repairClaimSha256,
    recoveryClaimSha256: grant.revalidation.recoveryClaimSha256, originalClaimSha256: grant.revalidation.originalClaimSha256, profileSha256: grant.profileSha256,
    bookDir: path.resolve(grant.bookDir), engineHead: grant.engine.head, claimedAt: new Date().toISOString() }) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
}
/**
 * Synchronous, before EVERY paid call of an extension-line stage: the extension grant bytes, the owner's approval record bytes, its profile, the
 * claim it wrote, the revalidation, continuation, repair, recovery and original claims it names, the clean source at its head, every pinned file.
 */
export function assertFreshBookStoryboardExtensionPaid(args: { env: FreshBookEnv; grantFile: string; grantSha: string; profile: FreshBookProfile; workspace: string }) {
  const bytes = fileBytes(args.grantFile);
  if (previewSha(bytes) !== args.grantSha) fail('fresh_book_storyboard_extension_grant');
  const grant = freshBookStoryboardExtensionGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (grant.profileSha256 !== freshBookProfileSha(args.profile)) fail('fresh_book_profile_changed');
  if (previewSha(fileBytes(grant.ownerApproval.file)) !== grant.ownerApproval.sha256) fail('fresh_book_storyboard_extension_approval');
  const at = (name: string) => path.join(args.env.authorityRoot, name), claimFile = at(FRESH_BOOK_STORYBOARD_EXTENSION.claimName);
  const named = [[FRESH_BOOK_STORYBOARD_REVALIDATION.claimName, grant.revalidation.claimSha256],
    [FRESH_BOOK_STORYBOARD_CONTINUATION.claimName, grant.revalidation.continuationClaimSha256], [FRESH_BOOK_STORYBOARD_REPAIR.claimName, grant.revalidation.repairClaimSha256],
    [FRESH_BOOK_RECOVERY.claimName, grant.revalidation.recoveryClaimSha256], [FRESH_BOOK_CYCLE.claimName, grant.revalidation.originalClaimSha256]] as const;
  if (!existsSync(claimFile) || named.some(([name, digest]) => !existsSync(at(name)) || previewSha(fileBytes(at(name))) !== digest)) fail('fresh_book_claim');
  const claim = JSON.parse(fileBytes(claimFile).toString('utf8'));
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardExtension !== FRESH_BOOK_STORYBOARD_EXTENSION.version || claim.grantSha256 !== args.grantSha ||
      claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 || claim.revalidationClaimSha256 !== grant.revalidation.claimSha256 ||
      claim.continuationClaimSha256 !== grant.revalidation.continuationClaimSha256 || claim.repairClaimSha256 !== grant.revalidation.repairClaimSha256 ||
      claim.recoveryClaimSha256 !== grant.revalidation.recoveryClaimSha256 || claim.originalClaimSha256 !== grant.revalidation.originalClaimSha256 ||
      claim.profileSha256 !== grant.profileSha256 || path.resolve(claim.bookDir).toLowerCase() !== path.resolve(grant.bookDir).toLowerCase() ||
      claim.engineHead !== grant.engine.head) fail('fresh_book_claim_foreign');
  const engine = args.env.head();
  if (!engine.clean || engine.head !== grant.engine.head || engine.branch !== grant.engine.branch) fail('fresh_book_source_changed');
  for (const [rel, digest] of Object.entries(grant.pins)) if (previewSha(fileBytes(path.join(args.workspace, rel))) !== digest) fail('fresh_book_source_changed');
  return grant;
}

/**
 * The bound revalidation of the extension (same owner record, same allowance, 2026-10-20). The ONE extension spent its ONE Opus 5.5 Max
 * planner, and the engine refused that paid answer at compile (storyboard_claim_basis_staging_ref) BEFORE its ONE Sol 6.1 review: the
 * planner staged plan direction fields, which the contract's own instruction invites but its strict validator did not accept. This line
 * completes that allowance: the SAME paid answer replayed (no planner call), compiled under the general correction
 * storyboard-claim-basis-staging-fields/v1, and the ONE unspent review. It is still attempt 4 of 4: held ends the line (no attempt 5).
 */
export const FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION = Object.freeze({
  version: 'fresh-book-storyboard-extension-revalidation/v1',
  amendment: 'Guy 2026-10-19 OWNER-APPROVAL-REFINED-B-ATTEMPT4-20261019.txt (refined Proposal B, approved in chat: "מאשר B המתוקן"), the SAME allowance of ONE Opus 5.5 Max planner and ONE Sol 6.1 review for attempt 4 of 4: the extension spent its planner and the engine refused that paid answer at compile (storyboard_claim_basis_staging_ref) before its review. Under the continuation prompt rule (at most 2 focused corrections, a frozen narrow re-gate before spend, no extra paid attempt), the SAME paid answer is replayed (no planner call), compiled under the general correction storyboard-claim-basis-staging-fields/v1 and given the ONE unspent review (at least 600000 microUSD reserved); every earlier grant, claim, outcome, seal, answer and cost stays byte-identical; same USD 7 book / USD 8 cycle caps; held ends the line with an honest report (no attempt 5).',
  claimName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-extension-revalidation.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-extension-revalidation.outcome.json',
  auditionStartName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-extension-revalidation.audition.json',
  /** The verified successor's one durable provenance record (written once, at completion, only after its whole chain replays). */
  successorName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-extension-revalidation.successor.json',
  folder: 'storyboard-extension-revalidation',
  /** The terminal record it stands on: exactly this refusal of the extension's paid answer, before its review. */
  failedOutcome: 'failed_storyboard_extension', failedCode: 'storyboard_claim_basis_staging_ref',
  ownHeldOutcome: 'held_storyboard_extension_revalidation',
  admittedStatuses: Object.freeze(['review_supported', 'review_supported_with_notes'] as const),
  plannerCalls: 0, apiCalls: 1, reviewReserveFloorMicroUsd: 600_000, attempt: 4, maxAttempts: 4,
});
export const freshBookStoryboardExtensionRevalidationGrantSchema = z.object({ version: z.literal('fresh-book-storyboard-extension-revalidation-grant/v1'),
  cycle: z.literal(FRESH_BOOK_CYCLE.id), approval: z.literal(FRESH_BOOK_CYCLE.approval), amendment: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.amendment),
  ownerApproval: z.object({ file: z.string().refine(p => path.isAbsolute(p)), sha256: hash }).strict(),
  profileSha256: hash, bookDir: z.string().refine(p => path.isAbsolute(p)),
  /** The consumed extension, its ONE paid planner session and every claim it names, by digest (its grant's pins bind ITS head, never this one's). */
  extension: z.object({ grantFile: z.string().refine(p => path.isAbsolute(p)), grantSha256: hash, claimSha256: hash, outcomeSha256: hash, sealSha256: hash,
    folderSha256: hash, plannerReceiptSha256: hash, plannerWireDigest: hash, plannerMaxMicroUsd: micro, revalidationClaimSha256: hash,
    continuationClaimSha256: hash, repairClaimSha256: hash, recoveryClaimSha256: hash, originalClaimSha256: hash }).strict(),
  /** The paid answer compiled under the correction: the candidate the ONE review reviews, and every staged plan direction field it admitted. */
  candidate: z.object({ sourceDigest: hash, storyboardDigest: hash, draftSha256: hash, claims: z.number().int().positive(), resolutions: z.number().int().positive(),
    stagedFields: z.array(z.object({ page: z.number().int().min(0).max(16), ref: z.string().min(1).max(64) }).strict()).min(1) }).strict(),
  recovery: z.object({ attempt: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.attempt),
    maxAttempts: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.maxAttempts), stateSha256: hash, diagnosisDigest: hash }).strict(),
  ledger: z.object({ diagnosticSettledMicroUsd: micro, bookKnownMicroUsd: micro, calls: micro }).strict(),
  allowance: z.object({ plannerCalls: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.plannerCalls), apiCalls: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.apiCalls),
    reviewReserveFloorMicroUsd: z.literal(FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.reviewReserveFloorMicroUsd) }).strict(),
  compile: z.tuple([z.literal('storyboard-self-check-names/v1'), z.literal('storyboard-claim-basis-staging-fields/v1')]),
  engine: z.object({ head: sha40, branch: z.string().min(1) }).strict(), pins: z.record(z.string(), hash), nativePlanSha256: hash }).strict();
export type FreshBookStoryboardExtensionRevalidationGrant = z.infer<typeof freshBookStoryboardExtensionRevalidationGrantSchema>;

/** The extension revalidation's one claim: once, only while its outcome is absent; any existing claim refuses, for any grant, label or folder. */
export function claimFreshBookStoryboardExtensionRevalidation(env: FreshBookEnv, grant: FreshBookStoryboardExtensionRevalidationGrant, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('fresh_book_authority_root');
  if (existsSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.outcomeName))) fail('fresh_book_storyboard_extension_revalidation_used');
  let fd: number;
  try { fd = openSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.claimName), 'wx'); }
  catch { return fail('fresh_book_storyboard_extension_revalidation_used'); }
  try { writeFileSync(fd, JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, storyboardExtensionRevalidation: FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.version,
    grantSha256: grantSha, ownerApprovalSha256: grant.ownerApproval.sha256, extensionClaimSha256: grant.extension.claimSha256,
    revalidationClaimSha256: grant.extension.revalidationClaimSha256, continuationClaimSha256: grant.extension.continuationClaimSha256,
    repairClaimSha256: grant.extension.repairClaimSha256, recoveryClaimSha256: grant.extension.recoveryClaimSha256,
    originalClaimSha256: grant.extension.originalClaimSha256, profileSha256: grant.profileSha256, bookDir: path.resolve(grant.bookDir),
    engineHead: grant.engine.head, claimedAt: new Date().toISOString() }) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
}
/**
 * Synchronous, before EVERY paid call of an extension-revalidation-line stage: its grant bytes, the owner's approval record bytes, its
 * profile, the claim it wrote, the extension, revalidation, continuation, repair, recovery and original claims it names, the clean source at
 * its head, every pinned file.
 */
export function assertFreshBookStoryboardExtensionRevalidationPaid(args: { env: FreshBookEnv; grantFile: string; grantSha: string; profile: FreshBookProfile;
  workspace: string }) {
  const bytes = fileBytes(args.grantFile);
  if (previewSha(bytes) !== args.grantSha) fail('fresh_book_storyboard_extension_revalidation_grant');
  const grant = freshBookStoryboardExtensionRevalidationGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (grant.profileSha256 !== freshBookProfileSha(args.profile)) fail('fresh_book_profile_changed');
  if (previewSha(fileBytes(grant.ownerApproval.file)) !== grant.ownerApproval.sha256) fail('fresh_book_storyboard_extension_approval');
  const at = (name: string) => path.join(args.env.authorityRoot, name), claimFile = at(FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.claimName);
  const named = [[FRESH_BOOK_STORYBOARD_EXTENSION.claimName, grant.extension.claimSha256], [FRESH_BOOK_STORYBOARD_REVALIDATION.claimName, grant.extension.revalidationClaimSha256],
    [FRESH_BOOK_STORYBOARD_CONTINUATION.claimName, grant.extension.continuationClaimSha256], [FRESH_BOOK_STORYBOARD_REPAIR.claimName, grant.extension.repairClaimSha256],
    [FRESH_BOOK_RECOVERY.claimName, grant.extension.recoveryClaimSha256], [FRESH_BOOK_CYCLE.claimName, grant.extension.originalClaimSha256]] as const;
  if (!existsSync(claimFile) || named.some(([name, digest]) => !existsSync(at(name)) || previewSha(fileBytes(at(name))) !== digest)) fail('fresh_book_claim');
  const claim = JSON.parse(fileBytes(claimFile).toString('utf8'));
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardExtensionRevalidation !== FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.version ||
      claim.grantSha256 !== args.grantSha || claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 || claim.extensionClaimSha256 !== grant.extension.claimSha256 ||
      claim.revalidationClaimSha256 !== grant.extension.revalidationClaimSha256 || claim.continuationClaimSha256 !== grant.extension.continuationClaimSha256 ||
      claim.repairClaimSha256 !== grant.extension.repairClaimSha256 || claim.recoveryClaimSha256 !== grant.extension.recoveryClaimSha256 ||
      claim.originalClaimSha256 !== grant.extension.originalClaimSha256 || claim.profileSha256 !== grant.profileSha256 ||
      path.resolve(claim.bookDir).toLowerCase() !== path.resolve(grant.bookDir).toLowerCase() || claim.engineHead !== grant.engine.head) fail('fresh_book_claim_foreign');
  const engine = args.env.head();
  if (!engine.clean || engine.head !== grant.engine.head || engine.branch !== grant.engine.branch) fail('fresh_book_source_changed');
  for (const [rel, digest] of Object.entries(grant.pins)) if (previewSha(fileBytes(path.join(args.workspace, rel))) !== digest) fail('fresh_book_source_changed');
  return grant;
}

/**
 * The owner-approved CALIBRATION attempt (corrected B, Guy's direct approval 2026-10-20): the extension revalidation reviewed attempt 4 of 4 and
 * held it (stop_allowance_exhausted). This explicitly bounded attempt 5 of 5 re-plans the SAME book under the general calibration contract
 * (storyboard-calibration/v1: the owner's visual-completion rule shared by planner and review, same-page multi-span citations, relation
 * lifetime, one source for changing state, root-cause grouping) with ONE new Opus 5.5 Max planner and ONE Sol 6.1 review. Every earlier grant,
 * claim, outcome, seal, answer and cost stays byte-identical; its own claim/outcome/audition start/successor and folder are fixed in code.
 */
export const FRESH_BOOK_STORYBOARD_CALIBRATION = Object.freeze({
  version: 'fresh-book-storyboard-calibration/v1',
  amendment: 'Guy 2026-10-20 OWNER-APPROVAL-CORRECTED-B-ATTEMPT5-20261020.txt (corrected B, approved in chat: "מסכים, תמשיך!"): the product rule "a reasonable visual completion is allowed when it does not contradict the text and changes no event, identity, age, safety or material relation; a meaningful contradiction still blocks; strong evidence stays required for actions, reveals and state changes", built as the general calibration contract (storyboard-calibration/v1), then ONE additional, explicitly bounded storyboard attempt (5 of 5) of the SAME book after its held extension revalidation (stop_allowance_exhausted at 4 of 4): ONE Opus 5.5 Claude Max planner repairing attempt 4\'s held candidate with its raw review and the grouped diagnosis, and ONE Sol 6.1 review (at least the normal 600000 microUSD reservation); every historical attempt, refusal and record retained; no text/author/editor rerun, new book, old-grant repin, reset, re-review of attempt 4\'s answer or retroactive pass; then child, references, two samples, the rest and the cover on their gates; same cumulative USD 7 book / USD 8 cycle caps; held again ends the line with an honest report (no attempt 6).',
  claimName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-calibration.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-calibration.outcome.json',
  auditionStartName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-calibration.audition.json',
  /** The verified successor's one durable provenance record (written once, at completion, only after its whole chain replays). */
  successorName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-calibration.successor.json',
  folder: 'storyboard-calibration',
  /** The terminal record it stands on: the extension revalidation held by its review at the owner's ceiling 4. */
  heldOutcome: 'held_storyboard_extension_revalidation', heldStatuses: Object.freeze(['held_uncertain', 'held_contradiction'] as const),
  heldRecovery: 'stop_allowance_exhausted', ownHeldOutcome: 'held_storyboard_calibration',
  admittedStatuses: Object.freeze(['review_supported', 'review_supported_with_notes'] as const),
  plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600_000,
  /** The four earlier held candidates and the owner's explicit ceiling: this is attempt 5 of 5. */
  priorAttempts: 4, maxAttempts: 5,
  addedContracts: Object.freeze(['calibrationContract'] as const),
  /** The planner request's schema compaction (personal-opus-storyboard-transport.ts): the same schema, shorter definition names. */
  plannerSchema: 'definition-names/v1',
  /** The owner's approval record: its exact verbatim approval line must be in it (its bytes are bound by digest). */
  approvalLine: 'Guy, verbatim: "מסכים, תמשיך!"',
});
export const freshBookStoryboardCalibrationGrantSchema = z.object({ version: z.literal('fresh-book-storyboard-calibration-grant/v1'),
  cycle: z.literal(FRESH_BOOK_CYCLE.id), approval: z.literal(FRESH_BOOK_CYCLE.approval), amendment: z.literal(FRESH_BOOK_STORYBOARD_CALIBRATION.amendment),
  ownerApproval: z.object({ file: z.string().refine(p => path.isAbsolute(p)), sha256: hash }).strict(),
  profileSha256: hash, bookDir: z.string().refine(p => path.isAbsolute(p)),
  /** The consumed extension-revalidation authority, its held review and every claim it names, by digest (its pins bind ITS head, never this one's). */
  extensionRevalidation: z.object({ grantFile: z.string().refine(p => path.isAbsolute(p)), grantSha256: hash, claimSha256: hash, outcomeSha256: hash,
    sealSha256: hash, folderSha256: hash, reviewReceiptSha256: hash, recoveryFinalSha256: hash, extensionClaimSha256: hash, revalidationClaimSha256: hash,
    continuationClaimSha256: hash, repairClaimSha256: hash, recoveryClaimSha256: hash, originalClaimSha256: hash }).strict(),
  /** The held candidate it re-plans (attempt 4), re-derived from the extension revalidation's own saved draft and raw review. */
  held: z.object({ sourceDigest: hash, storyboardDigest: hash, reviewDigest: hash, disposition: z.enum(FRESH_BOOK_STORYBOARD_CALIBRATION.heldStatuses),
    draftSha256: hash, findings: z.number().int().positive(), findingGroups: z.number().int().positive() }).strict(),
  /** The stage's recovery state at admission (four consecutive held candidates, the owner's ceiling 5) and the diagnosis this attempt consumes. */
  recovery: z.object({ version: z.literal('stage-recovery/v1'), attempts: z.literal(FRESH_BOOK_STORYBOARD_CALIBRATION.priorAttempts),
    maxAttempts: z.literal(FRESH_BOOK_STORYBOARD_CALIBRATION.maxAttempts), consecutiveFailures: z.literal(4), mode: z.literal('diagnose_and_change_strategy'),
    stateSha256: hash, diagnosisDigest: hash, contextDigest: hash }).strict(),
  ledger: z.object({ diagnosticSettledMicroUsd: micro, bookKnownMicroUsd: micro, calls: micro }).strict(),
  allowance: z.object({ plannerCalls: z.literal(FRESH_BOOK_STORYBOARD_CALIBRATION.plannerCalls), apiCalls: z.literal(FRESH_BOOK_STORYBOARD_CALIBRATION.apiCalls),
    reviewReserveFloorMicroUsd: z.literal(FRESH_BOOK_STORYBOARD_CALIBRATION.reviewReserveFloorMicroUsd) }).strict(),
  addedContracts: z.tuple([z.literal('calibrationContract')]),
  compile: z.tuple([z.literal('storyboard-self-check-names/v1'), z.literal('storyboard-claim-basis-staging-fields/v1')]),
  plannerSchema: z.literal(FRESH_BOOK_STORYBOARD_CALIBRATION.plannerSchema),
  engine: z.object({ head: sha40, branch: z.string().min(1) }).strict(), pins: z.record(z.string(), hash), nativePlanSha256: hash }).strict();
export type FreshBookStoryboardCalibrationGrant = z.infer<typeof freshBookStoryboardCalibrationGrantSchema>;

/** The calibration attempt's one claim: once, only while its outcome is absent; any existing claim refuses, for any grant, label or folder. */
export function claimFreshBookStoryboardCalibration(env: FreshBookEnv, grant: FreshBookStoryboardCalibrationGrant, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('fresh_book_authority_root');
  if (existsSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_CALIBRATION.outcomeName))) fail('fresh_book_storyboard_calibration_used');
  let fd: number;
  try { fd = openSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_CALIBRATION.claimName), 'wx'); } catch { return fail('fresh_book_storyboard_calibration_used'); }
  try { writeFileSync(fd, JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, storyboardCalibration: FRESH_BOOK_STORYBOARD_CALIBRATION.version, grantSha256: grantSha,
    ownerApprovalSha256: grant.ownerApproval.sha256, extensionRevalidationClaimSha256: grant.extensionRevalidation.claimSha256,
    extensionClaimSha256: grant.extensionRevalidation.extensionClaimSha256, revalidationClaimSha256: grant.extensionRevalidation.revalidationClaimSha256,
    continuationClaimSha256: grant.extensionRevalidation.continuationClaimSha256, repairClaimSha256: grant.extensionRevalidation.repairClaimSha256,
    recoveryClaimSha256: grant.extensionRevalidation.recoveryClaimSha256, originalClaimSha256: grant.extensionRevalidation.originalClaimSha256,
    profileSha256: grant.profileSha256, bookDir: path.resolve(grant.bookDir), engineHead: grant.engine.head, claimedAt: new Date().toISOString() }) + '\n');
    fsyncSync(fd); }
  finally { closeSync(fd); }
}
/**
 * Synchronous, before EVERY paid call of a calibration-line stage: its grant bytes, the owner's approval record bytes, its profile, the claim it
 * wrote, the extension-revalidation, extension, revalidation, continuation, repair, recovery and original claims it names, the clean source at
 * its head, every pinned file.
 */
export function assertFreshBookStoryboardCalibrationPaid(args: { env: FreshBookEnv; grantFile: string; grantSha: string; profile: FreshBookProfile; workspace: string }) {
  const bytes = fileBytes(args.grantFile);
  if (previewSha(bytes) !== args.grantSha) fail('fresh_book_storyboard_calibration_grant');
  const grant = freshBookStoryboardCalibrationGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (grant.profileSha256 !== freshBookProfileSha(args.profile)) fail('fresh_book_profile_changed');
  if (previewSha(fileBytes(grant.ownerApproval.file)) !== grant.ownerApproval.sha256) fail('fresh_book_storyboard_calibration_approval');
  const at = (name: string) => path.join(args.env.authorityRoot, name), claimFile = at(FRESH_BOOK_STORYBOARD_CALIBRATION.claimName), x = grant.extensionRevalidation;
  const named = [[FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.claimName, x.claimSha256], [FRESH_BOOK_STORYBOARD_EXTENSION.claimName, x.extensionClaimSha256],
    [FRESH_BOOK_STORYBOARD_REVALIDATION.claimName, x.revalidationClaimSha256], [FRESH_BOOK_STORYBOARD_CONTINUATION.claimName, x.continuationClaimSha256],
    [FRESH_BOOK_STORYBOARD_REPAIR.claimName, x.repairClaimSha256], [FRESH_BOOK_RECOVERY.claimName, x.recoveryClaimSha256],
    [FRESH_BOOK_CYCLE.claimName, x.originalClaimSha256]] as const;
  if (!existsSync(claimFile) || named.some(([name, digest]) => !existsSync(at(name)) || previewSha(fileBytes(at(name))) !== digest)) fail('fresh_book_claim');
  const claim = JSON.parse(fileBytes(claimFile).toString('utf8'));
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardCalibration !== FRESH_BOOK_STORYBOARD_CALIBRATION.version || claim.grantSha256 !== args.grantSha ||
      claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 || claim.extensionRevalidationClaimSha256 !== x.claimSha256 ||
      claim.extensionClaimSha256 !== x.extensionClaimSha256 || claim.revalidationClaimSha256 !== x.revalidationClaimSha256 ||
      claim.continuationClaimSha256 !== x.continuationClaimSha256 || claim.repairClaimSha256 !== x.repairClaimSha256 ||
      claim.recoveryClaimSha256 !== x.recoveryClaimSha256 || claim.originalClaimSha256 !== x.originalClaimSha256 || claim.profileSha256 !== grant.profileSha256 ||
      path.resolve(claim.bookDir).toLowerCase() !== path.resolve(grant.bookDir).toLowerCase() || claim.engineHead !== grant.engine.head) fail('fresh_book_claim_foreign');
  const engine = args.env.head();
  if (!engine.clean || engine.head !== grant.engine.head || engine.branch !== grant.engine.branch) fail('fresh_book_source_changed');
  for (const [rel, digest] of Object.entries(grant.pins)) if (previewSha(fileBytes(path.join(args.workspace, rel))) !== digest) fail('fresh_book_source_changed');
  return grant;
}

/**
 * The owner-directed PRESENCE attempt (Guy's direct same-book continuation 2026-10-20, after the calibration attempt 5 of 5 held on one
 * reference): ONE more storyboard attempt of the SAME book (historically attempt 6) under the general presence contract (storyboard-presence/v1:
 * an unplaced presence at an early drawn instant, and no re-quoting of a reference held for the same impact twice) with ONE new Opus 5.5 Max
 * planner and ONE Sol 6.1 review. Every earlier grant, claim, outcome, seal, answer and cost stays byte-identical; its own claim/outcome/
 * audition start/successor and folder are fixed in code; held ends the line (no attempt 7).
 */
export const FRESH_BOOK_STORYBOARD_PRESENCE = Object.freeze({
  version: 'fresh-book-storyboard-presence/v1',
  amendment: 'Guy 2026-10-20 OWNER-SAME-BOOK-CONTINUATION-AFTER-ATTEMPT5-20261020.txt (direct, in chat: "בכל מקרה אנחנו נמשיך כרגע בביצוע כדי לראות ספר"; model changes after a working book): after the calibration attempt 5 of 5 was held by its review on one reference (the child\'s place at page 8\'s early drawn instant, held for the same evidence reason in attempts 4 and 5), a minimal general engine remedy (storyboard-presence/v1: a visible cast member present in the drawn scene without a placement claim, and a repeated reference not re-quoted, recycled with a relation value it was held with, staged or hidden), then ONE additional, explicitly bounded storyboard attempt of the SAME book (historically attempt 6): ONE Opus 5.5 Claude Max planner repairing attempt 5\'s held candidate with its raw review, the grouped diagnosis and the repeated references, and ONE Sol 6.1 review (at least the normal 600000 microUSD reservation); every historical attempt, refusal and record retained; no text/author/editor rerun, new book, model change, old-grant repin, reset, re-review of attempt 5\'s answer or retroactive pass; then child, references, two samples, the rest and the cover on their gates; same cumulative USD 7 book / USD 8 cycle caps; held again ends the line with an honest report (no attempt 7).',
  claimName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-presence.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-presence.outcome.json',
  auditionStartName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-presence.audition.json',
  /** The verified successor's one durable provenance record (written once, at completion, only after its whole chain replays). */
  successorName: 'owner-cycle-20261017-fresh-book-usd7.storyboard-presence.successor.json',
  folder: 'storyboard-presence',
  /** The terminal record it stands on: the calibration held by its review at the owner's ceiling 5. */
  heldOutcome: 'held_storyboard_calibration', heldStatuses: Object.freeze(['held_uncertain', 'held_contradiction'] as const),
  heldRecovery: 'stop_allowance_exhausted', ownHeldOutcome: 'held_storyboard_presence',
  admittedStatuses: Object.freeze(['review_supported', 'review_supported_with_notes'] as const),
  plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600_000,
  /** The five earlier held candidates and the owner's new ceiling: this is attempt 6 of 6. */
  priorAttempts: 5, maxAttempts: 6,
  addedContracts: Object.freeze(['presenceContract'] as const),
  /** The planner request's schema compaction, as on the calibration line. */
  plannerSchema: 'definition-names/v1',
  /** The owner's record: Guy's verbatim continuation line must be in it (its bytes are bound by digest). */
  approvalLine: 'בכל מקרה אנחנו נמשיך כרגע בביצוע כדי לראות ספר',
});
export const freshBookStoryboardPresenceGrantSchema = z.object({ version: z.literal('fresh-book-storyboard-presence-grant/v1'),
  cycle: z.literal(FRESH_BOOK_CYCLE.id), approval: z.literal(FRESH_BOOK_CYCLE.approval), amendment: z.literal(FRESH_BOOK_STORYBOARD_PRESENCE.amendment),
  ownerApproval: z.object({ file: z.string().refine(p => path.isAbsolute(p)), sha256: hash }).strict(),
  profileSha256: hash, bookDir: z.string().refine(p => path.isAbsolute(p)),
  /** The consumed calibration authority, its held review and every claim it names, by digest (its pins bind ITS head, never this one's). */
  calibration: z.object({ grantFile: z.string().refine(p => path.isAbsolute(p)), grantSha256: hash, claimSha256: hash, outcomeSha256: hash, sealSha256: hash,
    folderSha256: hash, reviewReceiptSha256: hash, plannerReceiptSha256: hash, recoveryFinalSha256: hash, extensionRevalidationClaimSha256: hash,
    extensionClaimSha256: hash, revalidationClaimSha256: hash, continuationClaimSha256: hash, repairClaimSha256: hash, recoveryClaimSha256: hash,
    originalClaimSha256: hash }).strict(),
  /** The held candidate it re-plans (attempt 5), re-derived from the calibration's own saved planner answer and raw review. */
  held: z.object({ sourceDigest: hash, storyboardDigest: hash, reviewDigest: hash, disposition: z.enum(FRESH_BOOK_STORYBOARD_PRESENCE.heldStatuses),
    draftSha256: hash, findings: z.number().int().positive(), findingGroups: z.number().int().positive(), repeatedReferences: z.number().int().min(0) }).strict(),
  /** The stage's recovery state at admission (five consecutive held candidates, the owner's ceiling 6) and the diagnosis this attempt consumes. */
  recovery: z.object({ version: z.literal('stage-recovery/v1'), attempts: z.literal(FRESH_BOOK_STORYBOARD_PRESENCE.priorAttempts),
    maxAttempts: z.literal(FRESH_BOOK_STORYBOARD_PRESENCE.maxAttempts), consecutiveFailures: z.literal(5), mode: z.literal('diagnose_and_change_strategy'),
    stateSha256: hash, diagnosisDigest: hash, contextDigest: hash }).strict(),
  ledger: z.object({ diagnosticSettledMicroUsd: micro, bookKnownMicroUsd: micro, calls: micro }).strict(),
  allowance: z.object({ plannerCalls: z.literal(FRESH_BOOK_STORYBOARD_PRESENCE.plannerCalls), apiCalls: z.literal(FRESH_BOOK_STORYBOARD_PRESENCE.apiCalls),
    reviewReserveFloorMicroUsd: z.literal(FRESH_BOOK_STORYBOARD_PRESENCE.reviewReserveFloorMicroUsd) }).strict(),
  addedContracts: z.tuple([z.literal('presenceContract')]),
  compile: z.tuple([z.literal('storyboard-self-check-names/v1'), z.literal('storyboard-claim-basis-staging-fields/v1')]),
  plannerSchema: z.literal(FRESH_BOOK_STORYBOARD_PRESENCE.plannerSchema),
  engine: z.object({ head: sha40, branch: z.string().min(1) }).strict(), pins: z.record(z.string(), hash), nativePlanSha256: hash }).strict();
export type FreshBookStoryboardPresenceGrant = z.infer<typeof freshBookStoryboardPresenceGrantSchema>;

/** The presence attempt's one claim: once, only while its outcome is absent; any existing claim refuses, for any grant, label or folder. */
export function claimFreshBookStoryboardPresence(env: FreshBookEnv, grant: FreshBookStoryboardPresenceGrant, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('fresh_book_authority_root');
  if (existsSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_PRESENCE.outcomeName))) fail('fresh_book_storyboard_presence_used');
  let fd: number;
  try { fd = openSync(path.join(env.authorityRoot, FRESH_BOOK_STORYBOARD_PRESENCE.claimName), 'wx'); } catch { return fail('fresh_book_storyboard_presence_used'); }
  const c = grant.calibration;
  try { writeFileSync(fd, JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, storyboardPresence: FRESH_BOOK_STORYBOARD_PRESENCE.version, grantSha256: grantSha,
    ownerApprovalSha256: grant.ownerApproval.sha256, calibrationClaimSha256: c.claimSha256, extensionRevalidationClaimSha256: c.extensionRevalidationClaimSha256,
    extensionClaimSha256: c.extensionClaimSha256, revalidationClaimSha256: c.revalidationClaimSha256, continuationClaimSha256: c.continuationClaimSha256,
    repairClaimSha256: c.repairClaimSha256, recoveryClaimSha256: c.recoveryClaimSha256, originalClaimSha256: c.originalClaimSha256,
    profileSha256: grant.profileSha256, bookDir: path.resolve(grant.bookDir), engineHead: grant.engine.head, claimedAt: new Date().toISOString() }) + '\n');
    fsyncSync(fd); }
  finally { closeSync(fd); }
}
/**
 * Synchronous, before EVERY paid call of a presence-line stage: its grant bytes, the owner's record bytes, its profile, the claim it wrote, the
 * calibration, extension-revalidation, extension, revalidation, continuation, repair, recovery and original claims it names, the clean source
 * at its head, every pinned file.
 */
export function assertFreshBookStoryboardPresencePaid(args: { env: FreshBookEnv; grantFile: string; grantSha: string; profile: FreshBookProfile; workspace: string }) {
  const bytes = fileBytes(args.grantFile);
  if (previewSha(bytes) !== args.grantSha) fail('fresh_book_storyboard_presence_grant');
  const grant = freshBookStoryboardPresenceGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (grant.profileSha256 !== freshBookProfileSha(args.profile)) fail('fresh_book_profile_changed');
  if (previewSha(fileBytes(grant.ownerApproval.file)) !== grant.ownerApproval.sha256) fail('fresh_book_storyboard_presence_approval');
  const at = (name: string) => path.join(args.env.authorityRoot, name), claimFile = at(FRESH_BOOK_STORYBOARD_PRESENCE.claimName), c = grant.calibration;
  const named = [[FRESH_BOOK_STORYBOARD_CALIBRATION.claimName, c.claimSha256], [FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.claimName, c.extensionRevalidationClaimSha256],
    [FRESH_BOOK_STORYBOARD_EXTENSION.claimName, c.extensionClaimSha256], [FRESH_BOOK_STORYBOARD_REVALIDATION.claimName, c.revalidationClaimSha256],
    [FRESH_BOOK_STORYBOARD_CONTINUATION.claimName, c.continuationClaimSha256], [FRESH_BOOK_STORYBOARD_REPAIR.claimName, c.repairClaimSha256],
    [FRESH_BOOK_RECOVERY.claimName, c.recoveryClaimSha256], [FRESH_BOOK_CYCLE.claimName, c.originalClaimSha256]] as const;
  if (!existsSync(claimFile) || named.some(([name, digest]) => !existsSync(at(name)) || previewSha(fileBytes(at(name))) !== digest)) fail('fresh_book_claim');
  const claim = JSON.parse(fileBytes(claimFile).toString('utf8'));
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.storyboardPresence !== FRESH_BOOK_STORYBOARD_PRESENCE.version || claim.grantSha256 !== args.grantSha ||
      claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 || claim.calibrationClaimSha256 !== c.claimSha256 ||
      claim.extensionRevalidationClaimSha256 !== c.extensionRevalidationClaimSha256 || claim.extensionClaimSha256 !== c.extensionClaimSha256 ||
      claim.revalidationClaimSha256 !== c.revalidationClaimSha256 || claim.continuationClaimSha256 !== c.continuationClaimSha256 ||
      claim.repairClaimSha256 !== c.repairClaimSha256 || claim.recoveryClaimSha256 !== c.recoveryClaimSha256 || claim.originalClaimSha256 !== c.originalClaimSha256 ||
      claim.profileSha256 !== grant.profileSha256 || path.resolve(claim.bookDir).toLowerCase() !== path.resolve(grant.bookDir).toLowerCase() ||
      claim.engineHead !== grant.engine.head) fail('fresh_book_claim_foreign');
  const engine = args.env.head();
  if (!engine.clean || engine.head !== grant.engine.head || engine.branch !== grant.engine.branch) fail('fresh_book_source_changed');
  for (const [rel, digest] of Object.entries(grant.pins)) if (previewSha(fileBytes(path.join(args.workspace, rel))) !== digest) fail('fresh_book_source_changed');
  return grant;
}

/**
 * The owner-approved bounded CHILD RECOVERY (Guy's direct approval 2026-10-21 of Codex's proposal, after the presence line's held_child): the
 * presence line's admitted storyboard stays its successor; its held child anchor (the rejected edit target only) gets ONE gpt-image-2 LOW
 * correction under the general visible-pose contract and the typed visibility-only recovery, and that one corrected candidate exactly TWO
 * fresh Sol 6.1 reviews (style; design + age) under its frozen, bound context and recipe. Every earlier grant, claim, outcome, seal, pixel,
 * answer and cost stays byte-identical (held_child is not reset); its own claim/outcome/audition start/successor and folder are fixed in code;
 * a held correction ends the line with an honest report.
 */
export const FRESH_BOOK_CHILD_RECOVERY = Object.freeze({
  version: 'fresh-book-child-recovery/v1',
  amendment: 'Guy 2026-10-21 OWNER-APPROVAL-CHILD-VISIBILITY-RECOVERY-20261021.txt (direct, in chat, approving CODEX-PROPOSAL-CHILD-VISIBILITY-RECOVERY-20261021.txt after CODEX-ATTEMPT6-CHILD-OUTCOME-QA-20261021.txt): after the presence line held its child anchor (held_child, held_uncertain: a style defect, a slight smile and both hands hidden in the pockets while the inspection view requires them), a general offline engine change (child-anchor-visible-pose/v1: one source for the anchor pose and its required visible aspects, from which the render request and the inspection view are both built; child-anchor-visibility-recovery/v1: a typed visibility-only recovery into the one existing correction; missing data, an unreadable judge, material identity, age or safety uncertainty never become repair or PASS), then ONE gpt-image-2 LOW correction edit of the held candidate (the rejected edit target only) and exactly TWO fresh Sol 6.1 reviews (style; design + age) of that one corrected candidate under the frozen bound context and recipe, on the presence line\'s admitted storyboard; the same cumulative USD 7 book / USD 8 cycle caps, review reserves of at least 600000 microUSD; no fresh render, second edit, old PASS, diagnostic call, storyboard attempt 7, author/editor/planner rerun, model change or reset; only if the corrected child passes every gate: two representative samples, all 8 pages and the cover (LOW, the existing page gates and limits), the local viewer and the reports; a held correction stops with an honest report.',
  claimName: 'owner-cycle-20261017-fresh-book-usd7.child-recovery.claim.json',
  outcomeName: 'owner-cycle-20261017-fresh-book-usd7.child-recovery.outcome.json',
  auditionStartName: 'owner-cycle-20261017-fresh-book-usd7.child-recovery.audition.json',
  /** The recovered child's one durable provenance record (written once, at completion, only after its whole evidence re-derives). */
  successorName: 'owner-cycle-20261017-fresh-book-usd7.child-recovery.successor.json',
  folder: 'child-recovery',
  /** The terminal record it stands on: the presence line's child anchor held by its own gate. */
  heldOutcome: 'held_child', heldDisposition: 'held_uncertain', ownHeldOutcome: 'held_child_recovery',
  /** ONE correction edit and its TWO reviews (each at the reviewed 600000 microUSD slot), and no other call. */
  apiCalls: 3, editCalls: 1, reviewCalls: 2, reviewReserveMicroUsd: 600_000,
  steps: Object.freeze(['reference_child_repair', 'reference_child_repair_style_qa', 'reference_child_repair_qa'] as const),
  /** The owner's record: Guy's verbatim approval line must be in it (its bytes are bound by digest). */
  approvalLine: 'מאשר את תיקון המנוע הכללי והתאוששות הדמות המוגבלת שבהצעה: תיקון LOW אחד של הרפרנס הקיים ושתי ביקורות חדשות אחרי QA, באותן תקרות ועל הסטוריבורד שכבר עבר; אם הדמות עוברת, להמשיך אוטומטית לאיורים, לכריכה ולספר המלא.',
});
const abs = z.string().refine(p => path.isAbsolute(p));
export const freshBookChildRecoveryGrantSchema = z.object({ version: z.literal('fresh-book-child-recovery-grant/v1'),
  cycle: z.literal(FRESH_BOOK_CYCLE.id), approval: z.literal(FRESH_BOOK_CYCLE.approval), amendment: z.literal(FRESH_BOOK_CHILD_RECOVERY.amendment),
  ownerApproval: z.object({ file: abs, sha256: hash }).strict(), profileSha256: hash, bookDir: abs,
  /** The consumed presence authority (its grant, claim, terminal held_child record, admitted storyboard and successor) and every claim it names. */
  presence: z.object({ grantFile: abs, grantSha256: hash, claimSha256: hash, outcomeSha256: hash, successorSha256: hash, storyboardDigest: hash,
    calibrationClaimSha256: hash, extensionRevalidationClaimSha256: hash, extensionClaimSha256: hash, revalidationClaimSha256: hash,
    continuationClaimSha256: hash, repairClaimSha256: hash, recoveryClaimSha256: hash, originalClaimSha256: hash }).strict(),
  /** The held child it corrects: its folder, seal, candidate, recipe and context by digest, and its settled answers' dispositions, re-derived. */
  held: z.object({ folderSha256: hash, sealSha256: hash, candidateSha256: hash, recipeSha256: hash, contextSha256: hash, style: z.enum(['passed', 'defect']),
    design: z.literal(FRESH_BOOK_CHILD_RECOVERY.heldDisposition), disposition: z.literal(FRESH_BOOK_CHILD_RECOVERY.heldDisposition) }).strict(),
  /** The typed recovery the engine derives from those answers, and the one correction it plans: its prompt, recipe and bound context. */
  recovery: z.object({ version: z.literal(CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION), pose: z.literal(CHILD_ANCHOR_POSE_VERSION),
    aspects: z.array(z.enum(CHILD_ANCHOR_VISIBILITY_RECOVERABLE)).min(1), corrections: z.array(z.string().trim().min(1)).min(1),
    correctionPromptSha256: hash, recipeSha256: hash, contextSha256: hash, renderMaximumMicroUsd: micro }).strict(),
  ledger: z.object({ diagnosticSettledMicroUsd: micro, bookKnownMicroUsd: micro, calls: micro }).strict(),
  allowance: z.object({ apiCalls: z.literal(FRESH_BOOK_CHILD_RECOVERY.apiCalls), editCalls: z.literal(FRESH_BOOK_CHILD_RECOVERY.editCalls),
    reviewCalls: z.literal(FRESH_BOOK_CHILD_RECOVERY.reviewCalls), reviewReserveMicroUsd: z.literal(FRESH_BOOK_CHILD_RECOVERY.reviewReserveMicroUsd) }).strict(),
  engine: z.object({ head: sha40, branch: z.string().min(1) }).strict(), pins: z.record(z.string(), hash), nativePlanSha256: hash }).strict();
export type FreshBookChildRecoveryGrant = z.infer<typeof freshBookChildRecoveryGrantSchema>;

/** The child recovery's one claim: once, only while its outcome is absent; any existing claim refuses, for any grant, label or folder. */
export function claimFreshBookChildRecovery(env: FreshBookEnv, grant: FreshBookChildRecoveryGrant, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('fresh_book_authority_root');
  if (existsSync(path.join(env.authorityRoot, FRESH_BOOK_CHILD_RECOVERY.outcomeName))) fail('fresh_book_child_recovery_used');
  let fd: number;
  try { fd = openSync(path.join(env.authorityRoot, FRESH_BOOK_CHILD_RECOVERY.claimName), 'wx'); } catch { return fail('fresh_book_child_recovery_used'); }
  const p = grant.presence;
  try { writeFileSync(fd, JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, childRecovery: FRESH_BOOK_CHILD_RECOVERY.version, grantSha256: grantSha,
    ownerApprovalSha256: grant.ownerApproval.sha256, presenceClaimSha256: p.claimSha256, presenceOutcomeSha256: p.outcomeSha256,
    presenceSuccessorSha256: p.successorSha256, calibrationClaimSha256: p.calibrationClaimSha256, extensionRevalidationClaimSha256: p.extensionRevalidationClaimSha256,
    extensionClaimSha256: p.extensionClaimSha256, revalidationClaimSha256: p.revalidationClaimSha256, continuationClaimSha256: p.continuationClaimSha256,
    repairClaimSha256: p.repairClaimSha256, recoveryClaimSha256: p.recoveryClaimSha256, originalClaimSha256: p.originalClaimSha256,
    heldCandidateSha256: grant.held.candidateSha256, profileSha256: grant.profileSha256, bookDir: path.resolve(grant.bookDir), engineHead: grant.engine.head,
    claimedAt: new Date().toISOString() }) + '\n');
    fsyncSync(fd); }
  finally { closeSync(fd); }
}
/**
 * Synchronous, before EVERY paid call of a child-recovery-line stage: its grant bytes, the owner's record bytes, its profile, the claim it wrote,
 * the presence line's claim, terminal record and successor and every claim the presence chain names, the clean source at its head, every
 * pinned file.
 */
export function assertFreshBookChildRecoveryPaid(args: { env: FreshBookEnv; grantFile: string; grantSha: string; profile: FreshBookProfile; workspace: string }) {
  const bytes = fileBytes(args.grantFile);
  if (previewSha(bytes) !== args.grantSha) fail('fresh_book_child_recovery_grant');
  const grant = freshBookChildRecoveryGrantSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (grant.profileSha256 !== freshBookProfileSha(args.profile)) fail('fresh_book_profile_changed');
  if (previewSha(fileBytes(grant.ownerApproval.file)) !== grant.ownerApproval.sha256) fail('fresh_book_child_recovery_approval');
  const at = (name: string) => path.join(args.env.authorityRoot, name), claimFile = at(FRESH_BOOK_CHILD_RECOVERY.claimName), p = grant.presence;
  const named = [[FRESH_BOOK_STORYBOARD_PRESENCE.claimName, p.claimSha256], [FRESH_BOOK_STORYBOARD_PRESENCE.outcomeName, p.outcomeSha256],
    [FRESH_BOOK_STORYBOARD_PRESENCE.successorName, p.successorSha256], [FRESH_BOOK_STORYBOARD_CALIBRATION.claimName, p.calibrationClaimSha256],
    [FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.claimName, p.extensionRevalidationClaimSha256], [FRESH_BOOK_STORYBOARD_EXTENSION.claimName, p.extensionClaimSha256],
    [FRESH_BOOK_STORYBOARD_REVALIDATION.claimName, p.revalidationClaimSha256], [FRESH_BOOK_STORYBOARD_CONTINUATION.claimName, p.continuationClaimSha256],
    [FRESH_BOOK_STORYBOARD_REPAIR.claimName, p.repairClaimSha256], [FRESH_BOOK_RECOVERY.claimName, p.recoveryClaimSha256],
    [FRESH_BOOK_CYCLE.claimName, p.originalClaimSha256]] as const;
  if (!existsSync(claimFile) || named.some(([name, digest]) => !existsSync(at(name)) || previewSha(fileBytes(at(name))) !== digest)) fail('fresh_book_claim');
  const claim = JSON.parse(fileBytes(claimFile).toString('utf8'));
  if (claim.cycle !== FRESH_BOOK_CYCLE.id || claim.childRecovery !== FRESH_BOOK_CHILD_RECOVERY.version || claim.grantSha256 !== args.grantSha ||
      claim.ownerApprovalSha256 !== grant.ownerApproval.sha256 || claim.presenceClaimSha256 !== p.claimSha256 || claim.presenceOutcomeSha256 !== p.outcomeSha256 ||
      claim.presenceSuccessorSha256 !== p.successorSha256 || claim.calibrationClaimSha256 !== p.calibrationClaimSha256 ||
      claim.extensionRevalidationClaimSha256 !== p.extensionRevalidationClaimSha256 || claim.extensionClaimSha256 !== p.extensionClaimSha256 ||
      claim.revalidationClaimSha256 !== p.revalidationClaimSha256 || claim.continuationClaimSha256 !== p.continuationClaimSha256 ||
      claim.repairClaimSha256 !== p.repairClaimSha256 || claim.recoveryClaimSha256 !== p.recoveryClaimSha256 || claim.originalClaimSha256 !== p.originalClaimSha256 ||
      claim.heldCandidateSha256 !== grant.held.candidateSha256 || claim.profileSha256 !== grant.profileSha256 ||
      path.resolve(claim.bookDir).toLowerCase() !== path.resolve(grant.bookDir).toLowerCase() || claim.engineHead !== grant.engine.head) fail('fresh_book_claim_foreign');
  const engine = args.env.head();
  if (!engine.clean || engine.head !== grant.engine.head || engine.branch !== grant.engine.branch) fail('fresh_book_source_changed');
  for (const [rel, digest] of Object.entries(grant.pins)) if (previewSha(fileBytes(path.join(args.workspace, rel))) !== digest) fail('fresh_book_source_changed');
  return grant;
}

/** The sample gate: the remaining pages and the cover are claimable only after BOTH representative samples passed their gates. */
export type PageGate = { page: number; disposition: 'passed' | 'held_uncertain' | 'repair' | 'failed' | 'pending' };
export function assertLaterPagesAllowed(samples: readonly PageGate[]) {
  if (samples.length !== FRESH_BOOK_CYCLE.samplePages || new Set(samples.map(s => s.page)).size !== samples.length ||
      samples.some(s => !Number.isInteger(s.page) || s.page < 1 || s.page > FRESH_BOOK_CYCLE.pages)) fail('fresh_book_sample_set');
  if (samples.some(s => s.disposition !== 'passed')) fail('fresh_book_sample_held');
}
/** The viewer's reading order: cover, then pages 1..8. Complete only when the cover and every page passed; otherwise held/partial. */
export function freshBookReadingOrder(cover: PageGate['disposition'] | null, pages: readonly PageGate[]) {
  const byPage = new Map(pages.map(p => [p.page, p.disposition]));
  if (byPage.size !== pages.length) fail('fresh_book_pages');
  const order = [{ slot: 'cover', disposition: cover ?? 'pending' },
    ...Array.from({ length: FRESH_BOOK_CYCLE.pages }, (_, i) => ({ slot: `page-${i + 1}`, disposition: byPage.get(i + 1) ?? 'pending' as const }))];
  const status = order.every(o => o.disposition === 'passed') ? 'complete' as const : order.some(o => o.disposition === 'passed') ? 'partial' as const : 'held' as const;
  return { order, status };
}
