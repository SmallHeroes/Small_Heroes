/**
 * Owner closure amendment (Guy 2026-10-18): targeted RE-REVIEWS of the SAME saved fictional anchor candidate of the consumed R1 diagnostic
 * under child-anchor-inspection/v1. No drawing, no edit, no correction. The original diagnostic folder, its claim and outcome are read only.
 *   - At most 2 rounds ever (fixed claim names under the fixed authority root, one per round; another label, output or grant adds none),
 *     at most 2 Sol 6.1 reviews per round, at most 4 in total, each reserving its normal 600000 microUSD slot beside every settled cost
 *     before it (the original 59910 re-derived from its own records, then every earlier round's), under the original USD 1 cumulative cap.
 *   - The authoritative candidate, recipe and context are rebuilt from the actual producer (the diagnostic configuration by sha, the
 *     production request it planned, the settled render request, the candidate bytes), never taken from a saved hash alone.
 *   - A changed context means a fresh style AND design/age review; an old-context answer never pairs with a new-context one. Round 2 sends
 *     only the reviews whose exact request changed (a corrected criterion); an unchanged request is never re-sent (no stochastic retry).
 * Dry by default: the plan and the grant draft (no key read, no write, no provider).
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/personal-child-anchor-rereview.ts --config <abs json>
 *   ... --config <abs json> --execute --grant <abs grant.json> --grant-sha <sha256>   (only after Codex's frozen PASS)
 */
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { previewSha } from '../lib/local-story-preview';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import type { AuditionImage } from '../lib/personal-wizard/simple-book-illustrations';
import { CHILD_ANCHOR_INSPECTION_VERSION, resolveChildAnchorTechnique, childAnchorDescriptionRequest, assertChildAnchorRenderPlan,
  childAnchorAttemptRecipe, childAnchorRecipeSha, childAnchorInspectionContext, childAnchorInspectionContextSha, childAnchorStyleDisposition,
  childAnchorStyleReviewSchema, childAnchorInspectedDesignDisposition, childAnchorInspectedDesignReviewSchema, childAnchorDisposition,
  type ChildAnchorInspectionContext, type ChildAnchorRecipe } from '../lib/personal-wizard/child-anchor-style';
import { AuditionMeter, auditionAdapters, auditionRenderRule, auditionReviewRule, keyReader, verifyMeterRecords, type MeterRule, type MeterRules }
  from './personal-simple-book-reviewed-audition';
import { SOL_PIXEL_REVIEW_SLOT_MICRO_USD } from './personal-simple-book-illustrator';
import { childAnchorJudges, inspectedDesignWire, inspectedStyleWire, type ChildAnchorInspectedDesignJudge, type ChildAnchorInspectedStyleJudge }
  from './personal-child-anchor-judges';
import { childAnchorProbeConfig, type ChildAnchorProbeConfig } from './personal-child-anchor-style-probe';
import { assertOutsideCheckouts } from './personal-likeness-probe';
import { exclusiveJson, realDirectory } from './personal-causal-trial-journal';

export const CHILD_ANCHOR_REREVIEW_VERSION = 'child-anchor-rereview/v1' as const;
export class ChildAnchorRereviewError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new ChildAnchorRereviewError(code); };
const hash = z.string().regex(/^[a-f0-9]{64}$/);

/** The amendment's fixed terms, in code: none comes from a configuration, label, output folder or grant. */
export const REREVIEW_AMENDMENT = Object.freeze({
  id: 'owner-autonomous-book-closure-20261018/anchor-rereview',
  approval: 'Guy 2026-10-18 OWNER-AUTONOMOUS-BOOK-CLOSURE-AMENDMENT-20261018.txt: at most two distinct correction/re-gate rounds, at most two Sol 6.1 reviews per round, at most four new review calls total, of the SAME saved candidate, under the original USD 1 cumulative diagnostic subcap including the 59910 microUSD already spent; no drawing, no unchanged-wire retry.',
  authorityRoot: 'C:/GNart/Work/book-authority',
  claimName: (round: number) => `owner-cycle-20261017-anchor-rereview-round${round}.claim.json`,
  outcomeName: (round: number) => `owner-cycle-20261017-anchor-rereview-round${round}.outcome.json`,
  originalClaimName: 'owner-cycle-20261017-anchor-diagnostic-usd1.claim.json',
  originalOutcomeName: 'owner-cycle-20261017-anchor-diagnostic-usd1.outcome.json',
  cumulativeCapMicroUsd: 1_000_000, originalSettledMicroUsd: 59_910, originalCalls: 4,
  maxRounds: 2, maxReviewsPerRound: 2, maxReviewsTotal: 4,
});
export const REREVIEW_STEPS = ['reference_child_style_qa', 'reference_child_qa'] as const;
type Step = typeof REREVIEW_STEPS[number];
const REVIEW_RULES: Record<string, MeterRule> = { reference_child_style_qa: auditionReviewRule, reference_child_qa: auditionReviewRule };
const ORIGINAL_RULES: Record<string, MeterRule> = { control_style_qa: auditionReviewRule, reference_child: auditionRenderRule,
  reference_child_style_qa: auditionReviewRule, reference_child_qa: auditionReviewRule };
const rulesOf = (rules: Record<string, MeterRule>): MeterRules => step => Object.prototype.hasOwnProperty.call(rules, step) ? rules[step] : undefined;

export const rereviewConfigSchema = z.object({ version: z.literal('child-anchor-rereview-config/v1'), round: z.number().int().min(1).max(REREVIEW_AMENDMENT.maxRounds),
  diagnosticOutput: z.string().refine(p => path.isAbsolute(p)), diagnosticConfig: z.string().refine(p => path.isAbsolute(p)), diagnosticConfigSha256: hash,
  candidateSha256: hash, outputParent: z.string().refine(p => path.isAbsolute(p)), keyEnvFile: z.string().refine(p => path.isAbsolute(p)) }).strict();
export type RereviewConfig = z.infer<typeof rereviewConfigSchema>;
export function rereviewConfig(file: string) {
  if (!path.isAbsolute(file)) fail('rereview_config');
  const parsed = rereviewConfigSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) return fail('rereview_config');
  assertOutsideCheckouts(parsed.data.outputParent);
  return parsed.data;
}
/** The round's folder: fixed per round beside the original diagnostic's parent naming, never chosen by a label. */
export const rereviewOutput = (config: Pick<RereviewConfig, 'outputParent' | 'round'>, round = config.round) =>
  path.join(config.outputParent, `child-anchor-rereview-r1-anchor-diag-20261018-round${round}`);

const workspace = () => path.resolve(__dirname, '..');
const fileBytes = (file: string) => { const s = lstatSync(file); if (!s.isFile() || s.isSymbolicLink() || s.size > 32000000) fail('rereview_file'); return readFileSync(file); };
const json = (file: string) => JSON.parse(fileBytes(file).toString('utf8'));
/** Every file of a folder, recursively, by relative path and sha256 (the original diagnostic's preserved baseline). */
export function folderBaseline(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => { for (const name of readdirSync(dir).sort()) { const file = path.join(dir, name), s = lstatSync(file);
    if (s.isSymbolicLink()) fail('rereview_file');
    if (s.isDirectory()) walk(file); else out[path.relative(root, file).split(path.sep).join('/')] = previewSha(readFileSync(file)); } };
  walk(root); return out;
}

/**
 * The authority of the saved candidate, rebuilt: the diagnostic configuration (pinned sha) planned exactly the production request the
 * settled render wire sent; the recipe is rebuilt from that request and the pinned technique files and must be the recipe the diagnostic
 * saved; the candidate bytes are the image the diagnostic adopted as its candidate; its four settled calls re-derive to 59910 with nothing
 * unknown. Then the new inspection context is built from the same configured child and planned prompt.
 */
export function rereviewAuthority(config: RereviewConfig) {
  const configBytes = fileBytes(config.diagnosticConfig);
  if (previewSha(configBytes) !== config.diagnosticConfigSha256) fail('rereview_diagnostic_config');
  const diagnostic: ChildAnchorProbeConfig = childAnchorProbeConfig(config.diagnosticConfig);
  const out = config.diagnosticOutput, stages = path.join(out, 'paid-stages');
  // The original ledger: its own four records, each re-derived under its rule; the saved spend record is that snapshot exactly.
  const records = verifyMeterRecords(stages, rulesOf(ORIGINAL_RULES));
  const snapshot = new AuditionMeter(stages, REREVIEW_AMENDMENT.cumulativeCapMicroUsd, REREVIEW_AMENDMENT.originalCalls, 0, 0, rulesOf(ORIGINAL_RULES)).snapshot();
  if (records.length !== REREVIEW_AMENDMENT.originalCalls || snapshot.unknownCost || snapshot.unknownOutcome || snapshot.reservedUnsettledMicroUsd ||
      snapshot.newKnownApiMicroUsd !== REREVIEW_AMENDMENT.originalSettledMicroUsd || canonicalJson(json(path.join(out, 'spend.json'))) !== canonicalJson(snapshot))
    fail('rereview_original_ledger');
  const technique = resolveChildAnchorTechnique(workspace()), request = childAnchorDescriptionRequest(diagnostic.child);
  const plan = assertChildAnchorRenderPlan(request.prompt, technique.length, request.referenceMode);
  const renderWire = json(path.join(stages, 'reference_child.wire.json'));
  if (renderWire?.body?.prompt !== plan.finalPrompt || canonicalJson(renderWire.references?.map((r: { imageSha: string }) => r.imageSha)) !==
      canonicalJson(technique.map(t => t.sha256))) fail('rereview_render_lineage');
  // The recipe hashes the request's prompt as the probe did (the seam's finalPrompt adds its style-reference prefix; the wire carries that).
  const recipe = childAnchorAttemptRecipe('reference_child', 'style', technique.map(t => ({ role: t.label, sha256: t.sha256 })), request.prompt, diagnostic.child.age);
  const results = json(path.join(out, 'results.json')), sealed = json(path.join(out, 'sealed.json'));
  if (sealed.status !== 'complete' || canonicalJson(results.anchor?.recipe) !== canonicalJson(recipe) || results.anchor?.recipeSha !== childAnchorRecipeSha(recipe))
    fail('rereview_recipe_lineage');
  const candidateBytes = fileBytes(path.join(out, 'illustrations', 'reference_child.png'));
  if (previewSha(candidateBytes) !== config.candidateSha256 || results.anchor?.image?.imageSha !== config.candidateSha256 ||
      results.anchor?.image?.imageName !== 'reference_child.png') fail('rereview_candidate');
  const context = childAnchorInspectionContext(diagnostic.child, request.prompt);
  return { diagnostic, recipe, recipeSha: childAnchorRecipeSha(recipe), context, contextSha: childAnchorInspectionContextSha(context),
    candidate: { imageName: 'reference_child.png', imageSha: config.candidateSha256 } as AuditionImage, candidateBytes,
    originalSettledMicroUsd: snapshot.newKnownApiMicroUsd, baseline: folderBaseline(out) };
}
type Authority = ReturnType<typeof rereviewAuthority>;

/** The exact requests of this round's two reviews (images by digest), from the rebuilt authority and the current criterion. */
export async function expectedWires(a: Pick<Authority, 'candidate' | 'candidateBytes' | 'context' | 'recipe' | 'recipeSha'>) {
  return { reference_child_style_qa: inspectedStyleWire(a.candidate, a.candidateBytes, a.context, a.recipeSha),
    reference_child_qa: await inspectedDesignWire(a.candidate, a.candidateBytes, a.context, a.recipe) } as Record<Step, unknown>;
}
/** One earlier round, re-derived from its own records: its known spend (nothing unknown) and the request digest of each review it sent. */
function earlierRound(config: RereviewConfig, round: number) {
  const out = rereviewOutput(config, round), stages = path.join(out, 'paid-stages');
  if (!existsSync(stages)) fail('rereview_round_missing');
  const records = verifyMeterRecords(stages, rulesOf(REVIEW_RULES));
  const plan = json(path.join(out, 'plan.json'));
  if (plan.round !== round || plan.amendment !== REREVIEW_AMENDMENT.id || !Array.isArray(plan.steps) || plan.steps.length < 1 || plan.steps.length > REREVIEW_AMENDMENT.maxReviewsPerRound)
    fail('rereview_round_ledger');
  const snapshot = new AuditionMeter(stages, REREVIEW_AMENDMENT.cumulativeCapMicroUsd, plan.steps.length,
    plan.priorSettledMicroUsd, 0, rulesOf(REVIEW_RULES)).snapshot();
  if (snapshot.unknownCost || snapshot.unknownOutcome || canonicalJson(json(path.join(out, 'spend.json'))) !== canonicalJson(snapshot)) fail('rereview_round_ledger');
  return { out, knownMicroUsd: snapshot.newKnownApiMicroUsd, priorMicroUsd: snapshot.priorKnownApiMicroUsd, calls: records.length,
    digests: Object.fromEntries(records.map(r => [r.claim.step, r.claim.wireDigest])) as Partial<Record<Step, string>> };
}

export type RereviewEnv = { authorityRoot: string; head: () => { head: string; branch: string; clean: boolean } };
const git = (...a: string[]) => execFileSync('git', ['-C', workspace(), ...a], { encoding: 'utf8' }).trim();
export const realRereviewEnv = (): RereviewEnv => ({ authorityRoot: REREVIEW_AMENDMENT.authorityRoot,
  head: () => ({ head: git('rev-parse', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), clean: git('status', '--porcelain') === '' }) });
/** The engine files whose bytes the grant pins (relative to the reviewed checkout). */
export const REREVIEW_PINNED = Object.freeze(['scripts/personal-child-anchor-rereview.ts', 'scripts/personal-child-anchor-judges.ts',
  'scripts/personal-child-anchor-style-probe.ts', 'scripts/personal-simple-book-reviewed-audition.ts', 'scripts/personal-simple-book-illustrator.ts',
  'scripts/personal-causal-trial-journal.ts', 'lib/personal-wizard/child-anchor-style.ts', 'lib/generation-pipeline/stage0-method-b.ts',
  'lib/local-preview-quality.ts', 'lib/generate-image.ts', 'scripts/shims/register-server-only.cjs']);

/**
 * Provider-free plan of this round: the authority, every earlier round re-derived, which reviews are sent (only changed requests), their
 * reservations and admission against the cumulative cap, and the grant this exact state needs. Refuses an exhausted or used amendment.
 */
export async function planRereview(config: RereviewConfig, env: RereviewEnv) {
  const a = rereviewAuthority(config), wires = await expectedWires(a);
  const root = env.authorityRoot;
  for (const name of [REREVIEW_AMENDMENT.originalClaimName, REREVIEW_AMENDMENT.originalOutcomeName]) if (!existsSync(path.join(root, name))) fail('rereview_original_claim');
  if (existsSync(path.join(root, REREVIEW_AMENDMENT.claimName(config.round))) || existsSync(path.join(root, REREVIEW_AMENDMENT.outcomeName(config.round))) ||
      existsSync(rereviewOutput(config))) fail('rereview_round_used');
  const earlier = Array.from({ length: config.round - 1 }, (_, i) => {
    const round = i + 1;
    if (!existsSync(path.join(root, REREVIEW_AMENDMENT.claimName(round))) || !existsSync(path.join(root, REREVIEW_AMENDMENT.outcomeName(round)))) fail('rereview_round_missing');
    return { round, ...earlierRound(config, round) };
  });
  // The accepted earlier lineage this plan stands on, captured now (before any await) as part of the admission baseline.
  const lineage = lineageOf(config, root);
  // A later round follows only a held earlier one (a passed amendment needs no more reviews).
  if (earlier.length) {
    const prior = await settledRereviewOutcome(config, { authority: a, rounds: config.round - 1 });
    if (prior.disposition === 'passed') fail('rereview_already_passed');
  }
  let prior = a.originalSettledMicroUsd;
  for (const e of earlier) { if (e.priorMicroUsd !== prior) fail('rereview_round_ledger'); prior += e.knownMicroUsd; }
  const sentBefore = earlier.reduce((n, e) => n + e.calls, 0);
  // Only a changed request is sent; an unchanged one already has its settled answer (or none, if it was never sent).
  const steps = REREVIEW_STEPS.filter(step => earlier.every(e => e.digests[step] !== previewSha(canonicalJson(wires[step]))));
  if (!steps.length) fail('rereview_unchanged_criteria');
  if (sentBefore + steps.length > REREVIEW_AMENDMENT.maxReviewsTotal) fail('rereview_review_limit');
  // Admission: each reservation beside every settled cost before it, at its reservation (worst) and at an assumed actual.
  const admission = (settle: number) => { let settled = prior;
    return steps.map(step => { const fits = settled + SOL_PIXEL_REVIEW_SLOT_MICRO_USD <= REREVIEW_AMENDMENT.cumulativeCapMicroUsd; settled += settle; return { step, fits }; }); };
  const worst = admission(SOL_PIXEL_REVIEW_SLOT_MICRO_USD), assumed = admission(40000);
  const engine = env.head();
  const plan = { version: CHILD_ANCHOR_REREVIEW_VERSION, amendment: REREVIEW_AMENDMENT.id, round: config.round, output: rereviewOutput(config),
    inspection: CHILD_ANCHOR_INSPECTION_VERSION, candidateSha256: a.candidate.imageSha, recipeSha: a.recipeSha, contextSha: a.contextSha,
    diagnosticConfigSha256: config.diagnosticConfigSha256, diagnosticBaselineSha256: previewSha(canonicalJson(a.baseline)),
    steps: steps.map(step => ({ step, reservationMicroUsd: SOL_PIXEL_REVIEW_SLOT_MICRO_USD, wireDigest: previewSha(canonicalJson(wires[step])) })),
    reused: REREVIEW_STEPS.filter(s => !steps.includes(s)),
    priorSettledMicroUsd: prior, capMicroUsd: REREVIEW_AMENDMENT.cumulativeCapMicroUsd, reviewsBefore: sentBefore,
    admissionIfEachSettlesAtItsReservation: worst, admissionAtAssumedActuals: assumed,
    claim: path.join(root, REREVIEW_AMENDMENT.claimName(config.round)), providerCalls: 0, keyRead: false };
  const pins = Object.fromEntries(REREVIEW_PINNED.map(rel => [rel, previewSha(fileBytes(path.join(workspace(), rel)))]));
  const grantDraft = { version: 'child-anchor-rereview-grant/v1', amendment: REREVIEW_AMENDMENT.id, approval: REREVIEW_AMENDMENT.approval, round: config.round,
    engine: { head: engine.head, branch: engine.branch }, pins, configSha256: previewSha(canonicalJson(config)), planSha256: previewSha(canonicalJson(plan)) };
  return { plan, grantDraft, authority: a, wires, steps, lineage };
}

/** The original claim and outcome, and every earlier round's claim, outcome and folder, by digest. */
function lineageOf(config: RereviewConfig, root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const names: string[] = [REREVIEW_AMENDMENT.originalClaimName, REREVIEW_AMENDMENT.originalOutcomeName];
  for (let round = 1; round < config.round; round++) names.push(REREVIEW_AMENDMENT.claimName(round), REREVIEW_AMENDMENT.outcomeName(round));
  for (const name of names) out[`authority/${name}`] = previewSha(fileBytes(path.join(root, name)));
  for (let round = 1; round < config.round; round++)
    for (const [rel, digest] of Object.entries(folderBaseline(rereviewOutput(config, round)))) out[`round${round}/${rel}`] = digest;
  return out;
}

/** What admission adopted, captured once and never re-adopted: a later HEAD, grant, source or lineage is a change, not a new baseline. */
type AdmissionBaseline = { grantFile: string; grantBytes: Buffer; grantSha: string; engine: { head: string; branch: string }; pins: Record<string, string>;
  configSha256: string; original: Record<string, string>; lineage: Record<string, string> };
function assertAdmissionBaseline(config: RereviewConfig, env: RereviewEnv, b: AdmissionBaseline) {
  const bytes = fileBytes(b.grantFile);
  if (!bytes.equals(b.grantBytes) || previewSha(bytes) !== b.grantSha || previewSha(canonicalJson(config)) !== b.configSha256) fail('rereview_grant');
  const engine = env.head();
  if (!engine.clean || engine.head !== b.engine.head || engine.branch !== b.engine.branch) fail('rereview_source_changed');
  for (const [rel, digest] of Object.entries(b.pins)) if (previewSha(fileBytes(path.join(workspace(), rel))) !== digest) fail('rereview_source_changed');
  if (previewSha(fileBytes(config.diagnosticConfig)) !== config.diagnosticConfigSha256 ||
      canonicalJson(folderBaseline(config.diagnosticOutput)) !== canonicalJson(b.original)) fail('rereview_original_changed');
  if (canonicalJson(lineageOf(config, env.authorityRoot)) !== canonicalJson(b.lineage)) fail('rereview_lineage_changed');
}

/**
 * The grant must be exactly the draft this state rebuilds (and the externally pinned bytes); admission's own final read must be clean at
 * the draft's head and branch, with the complete pinned source, original and lineage unchanged. Returns the synchronous check of THAT
 * captured baseline, for the caller to run with no await before its exclusive write.
 */
async function admitted(config: RereviewConfig, env: RereviewEnv, grantFile: string, grantSha: string) {
  const bytes = fileBytes(grantFile);
  if (previewSha(bytes) !== grantSha) fail('rereview_grant_sha');
  const planned = await planRereview(config, env), engine = env.head(), draft = planned.grantDraft;
  if (canonicalJson(JSON.parse(bytes.toString('utf8'))) !== canonicalJson(draft)) fail('rereview_grant');
  if (!engine.clean || engine.head !== draft.engine.head || engine.branch !== draft.engine.branch) fail('rereview_source_changed');
  // The meter itself refuses any call whose reservation does not fit beside the actual settled costs; this only refuses a plan that cannot.
  if (planned.plan.admissionAtAssumedActuals.some(r => !r.fits)) fail('rereview_budget');
  const baseline: AdmissionBaseline = { grantFile, grantBytes: bytes, grantSha, engine: { head: draft.engine.head, branch: draft.engine.branch },
    pins: draft.pins, configSha256: draft.configSha256, original: planned.authority.baseline, lineage: planned.lineage };
  const stillSame = () => assertAdmissionBaseline(config, env, baseline);
  stillSame();
  return { planned, stillSame };
}
function claimRound(env: RereviewEnv, round: number, grantSha: string) {
  const s = lstatSync(env.authorityRoot); if (!s.isDirectory() || s.isSymbolicLink()) fail('rereview_authority_root');
  const file = path.join(env.authorityRoot, REREVIEW_AMENDMENT.claimName(round));
  let fd: number;
  try { fd = openSync(file, 'wx'); } catch { return fail('rereview_round_used'); }
  try { writeFileSync(fd, JSON.stringify({ amendment: REREVIEW_AMENDMENT.id, round, grantSha256: grantSha, claimedAt: new Date().toISOString(), pid: process.pid }) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
  return file;
}
const claimIsOurs = (env: RereviewEnv, round: number, grantSha: string) => {
  const c = json(path.join(env.authorityRoot, REREVIEW_AMENDMENT.claimName(round)));
  if (c.amendment !== REREVIEW_AMENDMENT.id || c.round !== round || c.grantSha256 !== grantSha || c.pid !== process.pid) fail('rereview_claim_foreign');
};

type Adapters = { writeImage: (name: string, bytes: Buffer) => Promise<AuditionImage>; bytesOf: (image: AuditionImage) => Buffer;
  inspectedStyle: ChildAnchorInspectedStyleJudge; inspectedDesign: ChildAnchorInspectedDesignJudge };
/**
 * The paid round, once: admitted, claimed (fixed name), then a fresh folder; before EACH paid call the grant, pins, source, original
 * baseline and claim are re-checked synchronously. Sealed complete or failed; the outcome is written beside the claim. No retry.
 */
export async function runRereview(args: { config: RereviewConfig; env: RereviewEnv; grantFile: string; grantSha: string; signal: AbortSignal;
  log: (line: string) => void; adapters?: (directory: string, meter: AuditionMeter, guard: () => void) => Adapters }) {
  const { config, env } = args;
  const { planned, stillSame } = await admitted(config, env, args.grantFile, args.grantSha), a = planned.authority, out = planned.plan.output;
  const outcomeFile = path.join(env.authorityRoot, REREVIEW_AMENDMENT.outcomeName(config.round));
  // No await from here to the exclusive claim: the captured admission baseline is re-verified synchronously, then the round is claimed.
  realDirectory(config.outputParent);
  if (existsSync(out) || existsSync(outcomeFile)) fail('rereview_round_used');
  stillSame();
  claimRound(env, config.round, args.grantSha);
  let result: Record<string, unknown>;
  try {
    mkdirSync(out); mkdirSync(path.join(out, 'illustrations'));
    const meter = new AuditionMeter(path.join(out, 'paid-stages'), REREVIEW_AMENDMENT.cumulativeCapMicroUsd, planned.steps.length,
      planned.plan.priorSettledMicroUsd, 0, rulesOf(REVIEW_RULES));
    // Synchronous, before every claim: the same admitted baseline (grant bytes, head/branch/clean, pins, original, lineage), claim ours.
    const guard = () => {
      stillSame();
      claimIsOurs(env, config.round, args.grantSha);
      if (meter.priorKnownApiMicroUsd !== planned.plan.priorSettledMicroUsd || meter.maxCalls !== planned.steps.length) fail('rereview_meter');
    };
    const io: Adapters = args.adapters ? args.adapters(path.join(out, 'illustrations'), meter, guard) : (() => {
      const base = auditionAdapters({ directory: path.join(out, 'illustrations'), meter, key: keyReader(config.keyEnvFile), signal: args.signal, guard });
      const judges = childAnchorJudges({ bytesOf: base.bytesOf, meter, key: keyReader(config.keyEnvFile), signal: args.signal, guard });
      return { writeImage: base.writeImage, bytesOf: base.bytesOf, inspectedStyle: judges.inspectedStyle, inspectedDesign: judges.inspectedDesign };
    })();
    exclusiveJson(path.join(out, 'plan.json'), planned.plan);
    exclusiveJson(path.join(out, 'context.json'), a.context);
    const candidate = await io.writeImage('reference_child.png', a.candidateBytes);
    if (candidate.imageSha !== a.candidate.imageSha) fail('rereview_candidate');
    for (const step of planned.steps) {
      if (step === 'reference_child_style_qa') await io.inspectedStyle(step, candidate, a.context, a.recipeSha);
      else await io.inspectedDesign(step, candidate, a.context, a.recipe);
      args.log(`${step}: settled`);
    }
    exclusiveJson(path.join(out, 'spend.json'), meter.snapshot());
    const outcome = await settledRereviewOutcome(config, { authority: a, rounds: config.round });
    exclusiveJson(path.join(out, 'outcome.json'), outcome);
    exclusiveJson(path.join(out, 'sealed.json'), { version: CHILD_ANCHOR_REREVIEW_VERSION, status: 'complete', disposition: outcome.disposition, runtimeEligible: false });
    result = { status: 'complete', disposition: outcome.disposition, spend: meter.snapshot() };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'rereview_failed';
    if (existsSync(out) && !existsSync(path.join(out, 'sealed.json'))) {
      try { if (existsSync(path.join(out, 'paid-stages')) && !existsSync(path.join(out, 'spend.json'))) exclusiveJson(path.join(out, 'spend.json'),
        new AuditionMeter(path.join(out, 'paid-stages'), REREVIEW_AMENDMENT.cumulativeCapMicroUsd, planned.steps.length, planned.plan.priorSettledMicroUsd, 0).snapshot()); } catch { /* the meter records stay authoritative */ }
      exclusiveJson(path.join(out, 'sealed.json'), { version: CHILD_ANCHOR_REREVIEW_VERSION, status: 'failed', code, runtimeEligible: false });
    }
    result = { status: 'failed', code };
  }
  exclusiveJson(outcomeFile, { amendment: REREVIEW_AMENDMENT.id, round: config.round, grantSha256: args.grantSha, finishedAt: new Date().toISOString(), result });
  if (result.status !== 'complete') throw new ChildAnchorRereviewError(String(result.code));
  return result;
}

/**
 * The amendment's outcome, derived ONLY from settled records (never a saved pass flag): for each review, the latest round's settled call
 * whose request is exactly the one the CURRENT authority and criterion build (so an answer under another context or criterion never counts),
 * a completed, priced answer parsed under its strict schema, then the same dispositions. Missing or mismatched evidence holds.
 * Every round up to `rounds` must be claimed, sealed and re-derive cleanly.
 */
export async function settledRereviewOutcome(config: RereviewConfig, opts: { authority?: Authority; rounds: number }) {
  const a = opts.authority ?? rereviewAuthority(config), wires = await expectedWires(a);
  const answers: Partial<Record<Step, { round: number; value: unknown }>> = {};
  for (let round = 1; round <= opts.rounds; round++) {
    const out = rereviewOutput(config, round), stages = path.join(out, 'paid-stages');
    if (!existsSync(stages)) fail('rereview_round_missing');
    for (const record of verifyMeterRecords(stages, rulesOf(REVIEW_RULES))) {
      const step = record.claim.step as Step;
      if (record.claim.wireDigest !== previewSha(canonicalJson(wires[step])) || !record.result?.completed || !Number.isSafeInteger(record.result.estimatedMicroUsd)) continue;
      const raw = json(path.join(stages, `${step}.receipt.json`))?.raw;
      const schema = step === 'reference_child_style_qa' ? childAnchorStyleReviewSchema : childAnchorInspectedDesignReviewSchema;
      let value: unknown; try { value = schema.parse(JSON.parse(raw.output_text)); } catch { continue; }
      answers[step] = { round, value };
    }
  }
  const style = answers.reference_child_style_qa ? childAnchorStyleDisposition(answers.reference_child_style_qa.value, a.candidate.imageSha, a.contextSha, a.recipeSha) : null;
  const design = answers.reference_child_qa ? childAnchorInspectedDesignDisposition(answers.reference_child_qa.value, a.candidate.imageSha, a.context, a.recipe) : null;
  const outcome = childAnchorDisposition(style, design);
  return { version: CHILD_ANCHOR_REREVIEW_VERSION, inspection: CHILD_ANCHOR_INSPECTION_VERSION, disposition: outcome.disposition, corrections: outcome.corrections,
    candidateSha256: a.candidate.imageSha, recipeSha: a.recipeSha, contextSha: a.contextSha,
    style: style ? { round: answers.reference_child_style_qa!.round, disposition: style.disposition } : null,
    design: design ? { round: answers.reference_child_qa!.round, disposition: design.design, apparentAge: design.apparentAge.verdict,
      visibleEvidence: design.visibleEvidence.map(e => ({ aspect: e.aspect, verdict: e.verdict })), unobservedConditional: design.unobservedConditional } : null };
}
export type RereviewOutcome = Awaited<ReturnType<typeof settledRereviewOutcome>>;
export type { ChildAnchorInspectionContext, ChildAnchorRecipe };

function argValue(name: string) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const config = rereviewConfig(argValue('--config') ?? fail('rereview_arguments')), env = realRereviewEnv();
  if (!process.argv.includes('--execute')) planRereview(config, env).then(({ plan, grantDraft }) => console.log(JSON.stringify({ plan, grantDraft }, null, 2)))
    .catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
  else {
    const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
    runRereview({ config, env, grantFile: argValue('--grant') ?? fail('rereview_arguments'), grantSha: argValue('--grant-sha') ?? fail('rereview_arguments'),
      signal: controller.signal, log: line => console.log(line) })
      .then(r => console.log(JSON.stringify(r, null, 2)))
      .catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
  }
}
