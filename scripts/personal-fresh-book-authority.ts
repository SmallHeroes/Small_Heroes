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
import { CHILD_ANCHOR_INSPECTION_VERSION } from '../lib/personal-wizard/child-anchor-style';
import { AuditionMeter, type MeterRules } from './personal-simple-book-reviewed-audition';
import { REREVIEW_AMENDMENT, settledRereviewOutcome, type RereviewConfig } from './personal-child-anchor-rereview';

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
  routes: z.object({ author: z.literal(FRESH_BOOK_CYCLE.routes.author), editor: z.literal(FRESH_BOOK_CYCLE.routes.editor),
    storyboardPlanner: z.literal(FRESH_BOOK_CYCLE.routes.storyboardPlanner), judges: z.literal(FRESH_BOOK_CYCLE.routes.judges),
    image: z.literal(FRESH_BOOK_CYCLE.routes.image) }).strict(),
  childAnchor: z.literal(CHILD_ANCHOR_INSPECTION_VERSION),
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
