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
import { childAnchorAcceptanceVersions } from '../lib/personal-wizard/child-anchor-style';
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
