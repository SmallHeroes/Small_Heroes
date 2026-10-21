import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; } }));
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { providerStoryboard, providerReview, withKind } from './storyboard-replan-fixture';
import { STORYBOARD_MOMENTS_VERSION } from '../storyboard-moments';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import type { SimpleStoryDraft } from '../simple-story-engine';
import { decodePersonalBookProviderOutput } from '../book-openai';
import * as images from '../../generate-image';
import { causalSourceReviewPacket, causalReviewPackets } from '../story-causal-experiment';
import { preparePersonalStory } from '../story-writer';
import { resolvePersonalWizardOptions } from '../options';
import { citationTokens, compileSourceCitationReview, invalidSourceCitations, prepareSourceCitationCorrection, applySourceCitationCorrection,
  restoreSourceCitationReview } from '../story-source-citations';
import { canonicalJson } from '../request-acceptance';
import { previewSha } from '../../local-story-preview';
import { folderBaseline } from '../../../scripts/personal-child-anchor-rereview';
import { CHILD_ANCHOR_REQUIRED_VISIBLE, CHILD_ANCHOR_INSPECTION_VERSION, childAnchorInspectionContextSha, CHILD_ANCHOR_MATERIALITY_VERSION,
  CHILD_ANCHOR_POSE_VERSION, CHILD_ANCHOR_POSE_CLAUSE_SHA256, CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION, childAnchorVisibilityCorrection } from '../child-anchor-style';
import { auditionReviewRule, AuditionMeter, verifyMeterRecords, savedSelfCheckNames } from '../../../scripts/personal-simple-book-reviewed-audition';
import { inspectedDesignWire, inspectedStyleWire } from '../../../scripts/personal-child-anchor-judges';
import { planRereview, runRereview, REREVIEW_AMENDMENT, type RereviewConfig, type RereviewEnv } from '../../../scripts/personal-child-anchor-rereview';
import { FRESH_BOOK_CYCLE, FRESH_BOOK_RECOVERY, FRESH_BOOK_STORYBOARD_REPAIR, FRESH_BOOK_STORYBOARD_CONTINUATION, FRESH_BOOK_STORYBOARD_REVALIDATION,
  FRESH_BOOK_STORYBOARD_EXTENSION, FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION, FRESH_BOOK_STORYBOARD_CALIBRATION, FRESH_BOOK_STORYBOARD_PRESENCE,
  FRESH_BOOK_CHILD_RECOVERY, freshBookProfileSchema } from '../../../scripts/personal-fresh-book-authority';
import { planFreshBook, planFreshBookRecovery, runFreshBookText, runFreshBookTextRecovery, runFreshBookChild, runFreshBookBook, freshBookConfig, realFreshBookEnv,
  planFreshBookStoryboardRepair, previewFreshBookStoryboardRepair, runFreshBookStoryboardRepair, flooredReviewRule, assertReviewFloorFits,
  planFreshBookStoryboardContinuation, previewFreshBookStoryboardContinuation, runFreshBookStoryboardContinuation,
  planFreshBookStoryboardRevalidation, previewFreshBookStoryboardRevalidation, runFreshBookStoryboardRevalidation,
  planFreshBookStoryboardExtension, previewFreshBookStoryboardExtension, runFreshBookStoryboardExtension, EXTENSION_ADMISSION_FILE,
  planFreshBookStoryboardExtensionRevalidation, previewFreshBookStoryboardExtensionRevalidation, runFreshBookStoryboardExtensionRevalidation,
  EXTENSION_REVALIDATION_ADMISSION_FILE, planFreshBookStoryboardCalibration, previewFreshBookStoryboardCalibration, runFreshBookStoryboardCalibration,
  CALIBRATION_ADMISSION_FILE, planFreshBookStoryboardPresence, previewFreshBookStoryboardPresence, runFreshBookStoryboardPresence, PRESENCE_ADMISSION_FILE,
  STORYBOARD_REPAIR_RULES, REVIEW_RESERVE_FLOOR_MICRO_USD, planFreshBookChildRecovery, runFreshBookChildRecovery, CHILD_RECOVERY_ADMISSION_FILE,
  type FreshBookConfig, type FreshTextTransports } from '../../../scripts/personal-fresh-book-driver';
import { CALIBRATION_STORYBOARD_ADDENDUM, CALIBRATION_REVIEW_IMPACT_ADDENDUM, STORYBOARD_CALIBRATION_VERSION } from '../storyboard-calibration';
import { PRESENCE_STORYBOARD_ADDENDUM, PRESENCE_REVIEW_ADDENDUM, STORYBOARD_PRESENCE_VERSION } from '../storyboard-presence';
import { stageRules } from '../../../scripts/personal-new-book-experiment';
import { VISIBLE_MOMENT_STORYBOARD_ADDENDUM } from '../storyboard-visible-moment';
import { REPAIR_STORYBOARD_ADDENDUM } from '../storyboard-repair';
import { SELF_CHECK_STORYBOARD_ADDENDUM } from '../storyboard-self-check';
import { STORYBOARD_REVIEW_IMPACT_ADDENDUM } from '../storyboard-review-impact';
import { CLAIM_BASIS_STORYBOARD_ADDENDUM, CLAIM_BASIS_REVIEW_ADDENDUM, CLAIM_BASIS_STAGING_FIELDS_REVIEW_RULE, claimBasisSectionsView } from '../storyboard-claim-basis';
import { fullSelfCheck } from './storyboard-self-check-fixture';
const plainJson = (value: unknown) => JSON.parse(JSON.stringify(value));

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const ORIGINAL = 'C:/GNart/Work/book-renders/child-anchor-probe-r1-anchor-diag-20261018';
const ORIGINAL_CONFIG = 'C:/GNart/Work/Small_Heroes/_review/new-book-anchor-diagnostic-20261018/probe-config.json';
const REAL_CONFIG = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/fresh-book-config-materiality.json';
const REAL_GRANT = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/fresh-book-grant-materiality-STAGED-96dedda4.json';
const real = existsSync(path.join(ORIGINAL, 'sealed.json')) && existsSync(ORIGINAL_CONFIG);
const roots: string[] = [];
let f: Awaited<ReturnType<typeof personalStoryboardFixture>>;
/** Opt-in for the child-recovery chain: the book (profile and its admission re-review) under child-anchor-materiality/v1, as the actual book. */
let MATERIALITY = false;
beforeEach(async () => {
  sdk.create.mockReset();
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('no network in the recovery rehearsal'); }));
  f = await personalStoryboardFixture();
});
afterEach(async () => {
  await new Promise<void>(r => setImmediate(r));
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});
const passChecks = () => QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: `${category} ok`, correction: '' }));
const png = (shade: number, size = 64) => sharp({ create: { width: size, height: size, channels: 3, background: { r: shade, g: 60, b: 90 } } }).png().toBuffer();
/** A two-word anchor of a unit; `bad` drops the first letter of its first word (an omitted attached prefix, as in the actual failure). */
const anchorOf = (text: string, bad = false) => { const t = citationTokens(text); return bad ? `${t[0].slice(1)} ${t[1]}` : `${t[0]} ${t[1]}`; };
const readerReply = (output: unknown, wire: any) => ({ output, usage: { inputTokens: 1000, outputTokens: 500 }, estimatedMicroUsd: 7000, metadata: {},
  raw: { model: wire.model, service_tier: 'default', status: 'completed', output_text: JSON.stringify(output), usage: { input_tokens: 1000, output_tokens: 500 } } }) as any;
/** The comparison's one finding with a valid revised reference and an original anchor the exact check refuses. */
function failingComparison(input: string) {
  const { packetDigest, packet } = JSON.parse(input), o = packet.original.pages[0].units[0], r = packet.revised.pages[0].units[0];
  return { packetDigest, summary: 'Synthetic comparison reading, no product acceptance.', findings: [{ severity: 'polish', criterion: 'Synthetic criterion only.',
    kind: 'improvement', original: [{ startId: o.id, endId: o.id, anchor: anchorOf(o.text, true) }], revised: [{ startId: r.id, endId: r.id, anchor: anchorOf(r.text) }],
    explanation: 'Synthetic explanation only, never literary approval.' }] };
}
const validCorrection = (input: string) => { const { correctionDigest, correction } = JSON.parse(input);
  return { correctionDigest, corrections: correction.invalid.map((row: any) => ({ path: row.path, startId: row.units[0].id, endId: row.units[0].id, anchor: anchorOf(row.units[0].text) })) }; };

function textTransports(opts: { correction?: (input: string) => unknown; review?: (review: any) => any } = {}): Required<FreshTextTransports> {
  const fox = <T>(value: T): T => JSON.parse(JSON.stringify(value).replace(/דיני/g, 'אורי'));
  const plan = fox(f.result.plan), review = fox(f.review);
  const story: SimpleStoryDraft = { title: plan.title, childGoal: plan.childGoal, companionWant: plan.companionWant, comicPromise: plan.comicPromise,
    ending: plan.ending, pages: fox(f.result.manuscript.pages).map(p => ({ text: p.text + ' נועה ואורי משחקים בציור.' })),
    pageMap: plan.beats.map(({ pageNumber: _n, ...b }) => b), resilienceMoments: plan.resilience.moments.map(({ pageNumber, ...m }) => ({ page: pageNumber, ...m })) };
  const owned = fox(structuredClone(f.draft)) as any;
  delete owned.plan.wardrobe;
  owned.plan.actorAppearance = { child: { role: 'child', clothing: ['red shirt', 'blue shorts', 'teal shoes'] }, companion: { role: 'companion', authority: 'companionVisualAuthority' } };
  const structured = { ...providerStoryboard(withKind(owned)), moments: { version: STORYBOARD_MOMENTS_VERSION, frames: owned.plan.pages.map(() => ({ requirements: [], depicted: null })) } };
  const cli = (output: unknown, usd: number, session?: string) => { const termination = { code: 0, signal: null }, usage = { inputTokens: 100, outputTokens: 100 };
    return { output, usage, estimatedMicroUsd: Math.ceil(usd * 1e6), metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
      raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
        ...(session ? { session_id: session } : {}), total_cost_usd: usd, modelUsage: { 'claude-opus-5-5': usage }, structured_output: output }) } } as any; };
  return {
    opus: vi.fn(async (_w: any, call: any) => call.stage === 'author' ? cli(structuredClone(story), .23, '11111111-1111-4111-8111-111111111111')
      : cli({ ...structuredClone(story), editorChanges: ['Synthetic only.'] }, .23, '22222222-2222-4222-8222-222222222222')),
    reader: vi.fn(async (wire: any, call: any) => {
      if (call.stage === 'citation_correction') return readerReply((opts.correction ?? validCorrection)(call.input), wire);
      if (call.stage === 'comparison') return readerReply(failingComparison(call.input), wire);
      return readerReply({ packetDigest: JSON.parse(call.input).packetDigest, summary: 'Synthetic complete reading, no product acceptance.', findings: [] }, wire);
    }),
    responses: vi.fn(async (payload: any) => ({ model: payload.model, service_tier: 'default', status: 'completed', created_at: 1792300000,
      usage: { input_tokens: 10000, output_tokens: 5000 }, output_text: JSON.stringify(providerReview((opts.review ?? (r => r))(structuredClone(review)))) }) as any),
    planner: vi.fn(async (_w: any, call: any) => cli(decodePersonalBookProviderOutput(call, structured), .41)),
  };
}
/** Downstream providers at the SDK boundary (the real child/audition adapters, meters and settlement run); `firstShade` offsets the fake images. */
function providers(firstShade = 40) {
  let shade = firstShade;
  vi.spyOn(images, 'generateGPTImage').mockImplementation(async input => {
    const buffer = await png(shade++ % 250, 1024), usage = { input_tokens: 100, output_tokens: 300 };
    input.observeProviderResponse?.({ data: [{ b64_json: buffer.toString('base64') }], usage });
    return { buffer, usage, model: 'gpt-image-2', finalPrompt: input.finalPrompt, hasReferencePhoto: !!input.referenceImages?.length,
      apiMode: input.referenceImages?.length ? 'images.edit' : 'images.generate', referenceCountRequested: input.referenceImages?.length ?? 0,
      referenceCountPassed: input.referenceImages?.length ?? 0, durationMs: 1, fallbackUsed: false } as never;
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-4o-2024-08-06', choices: [{ message: { content: JSON.stringify({
    referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: true, sameChildDecision: 'same', faceStructure: 'match',
    eyesBrows: 'match', noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' }) } }], usage: { prompt_tokens: 1500, completion_tokens: 120 } }), { status: 200 })));
  sdk.create.mockImplementation(async (payload: any) => {
    const text = JSON.parse(payload.input[0].content[0].text), name: string = payload.text.format.name;
    const reply = (value: unknown) => ({ model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', usage: { input_tokens: 5000, output_tokens: 800 }, output_text: JSON.stringify(value) });
    if (name.includes('design_inspection')) return reply({ candidateSha: text.candidateSha, contextSha: text.contextSha, recipeSha: text.recipeSha,
      inspectionVersion: CHILD_ANCHOR_INSPECTION_VERSION, checks: passChecks(), apparentAge: { requestedAge: text.apparentAge.requestedAge, verdict: 'compatible', observation: 'reads the age', correction: '' },
      visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => ({ aspect, verdict: 'matched', observation: `${aspect} seen` })), unobservedConditional: [] });
    if (name.startsWith('child_anchor_style')) return reply({ candidateSha: text.candidateSha, contextSha: text.contextSha, recipeSha: text.recipeSha, assessable: true,
      style01Match: true, looksPhotoreal: false, looksPortrait: false, notes: 'watercolor' });
    const context = text.context, page = name === 'personal_audition_pixels_v4';
    const checks = passChecks().map(c => ({ ...c, issues: [] as unknown[] }));
    const landmarks = context.checks?.uniqueLandmarks ?? [];
    const inventory = { objects: landmarks.map((l: any, i: number) => ({ objectId: `o${i + 1}`, region: `${l.id} place`, description: l.id })),
      landmarks: landmarks.map((l: any, i: number) => ({ landmarkId: l.id, candidates: [{ objectId: `o${i + 1}`, association: 'this_landmark', evidence: 'seen',
        featureChecks: l.features.map((x: any) => ({ featureId: x.id, observed: 'matches' })) }] })) };
    return reply({ candidateSha: text.candidateSha, contextSha: text.contextSha, checks, ...(page ? { landmarkInventory: inventory } : {}) });
  });
}
/** Every file below a folder, by digest (the immutable-evidence baseline). */
const tree = (dir: string): Record<string, string> => Object.fromEntries(readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
  .map(e => { const p = path.join(e.parentPath, e.name); return [path.relative(dir, p), sha(readFileSync(p))]; }));

describe('story-source-citations-correction/v1 (provider-free)', { timeout: 60_000 }, () => {
  async function failed() {
    const prepared = preparePersonalStory(f.request, resolvePersonalWizardOptions());
    const doc = { plan: f.result.plan, manuscript: f.result.manuscript, characterDigest: prepared.brief.companion.characterDigest };
    const review = causalSourceReviewPacket(causalReviewPackets(prepared, doc, doc).comparison);
    const raw = failingComparison(JSON.stringify({ packetDigest: review.packetDigest, packet: review.packet }));
    return { review, raw };
  }
  it('names exactly the refused references; ONE valid correction changes only them; strict v1 compiles; the failed answer is untouched', async () => {
    const { review, raw } = await failed(), before = structuredClone(raw);
    expect(() => compileSourceCitationReview(review, raw)).toThrow('critic_evidence');
    expect(invalidSourceCitations(review, raw).invalid.map(i => i.path)).toEqual(['0/original/0']);
    const c = prepareSourceCitationCorrection(review, raw);
    expect(c.body.invalid[0]).toMatchObject({ path: '0/original/0', side: 'original', returned: raw.findings[0].original[0] });
    expect(JSON.stringify(c.body)).not.toContain(anchorOf(c.body.invalid[0].units[0].text) + '"');
    const applied = applySourceCitationCorrection(review, raw, c, validCorrection(c.input));
    expect(raw).toEqual(before);
    const { original: o1, ...restNew } = applied.corrected.findings[0], { original: o0, ...restOld } = raw.findings[0];
    expect(restNew).toEqual(restOld); expect(applied.corrected.summary).toBe(raw.summary); expect(o1).not.toEqual(o0);
    expect(applied.compiled.findings).toHaveLength(1);
  });
  it('refuses: another/duplicate/missing path, extra fields, another page\'s unit, a still-invalid anchor, a foreign digest or packet', async () => {
    const { review, raw } = await failed(), c = prepareSourceCitationCorrection(review, raw), ok = validCorrection(c.input);
    const row = ok.corrections[0], other = review.catalogue.find(u => u.side === 'original' && u.pageNumber === 2)!;
    expect(() => applySourceCitationCorrection(review, raw, c, { ...ok, corrections: [{ ...row, path: '0/revised/0' }] })).toThrow('critic_evidence');
    expect(() => applySourceCitationCorrection(review, raw, c, { ...ok, corrections: [row, row] })).toThrow('critic_evidence');
    expect(() => applySourceCitationCorrection(review, raw, c, { ...ok, corrections: [] })).toThrow('critic_binding');
    expect(() => applySourceCitationCorrection(review, raw, c, { ...ok, corrections: [{ ...row, explanation: 'rewritten finding' }] })).toThrow('critic_binding');
    expect(() => applySourceCitationCorrection(review, raw, c, { ...ok, summary: 'rewritten' })).toThrow('critic_binding');
    expect(() => applySourceCitationCorrection(review, raw, c, { ...ok, corrections: [{ ...row, startId: other.id, endId: other.id, anchor: anchorOf(other.text) }] })).toThrow('critic_evidence');
    expect(() => applySourceCitationCorrection(review, raw, c, { ...ok, corrections: [{ ...row, anchor: raw.findings[0].original[0].anchor }] })).toThrow('critic_evidence');
    expect(() => applySourceCitationCorrection(review, raw, c, { ...ok, correctionDigest: 'a'.repeat(64) })).toThrow('critic_binding');
    const changed = structuredClone(raw); changed.findings[0].explanation = 'A changed explanation of the finding.';
    expect(() => applySourceCitationCorrection(review, changed, c, ok)).toThrow('critic_binding');
    expect(() => prepareSourceCitationCorrection(review, { ...raw, packetDigest: 'b'.repeat(64) })).toThrow('critic_binding');
    const valid = applySourceCitationCorrection(review, raw, c, ok).corrected;
    expect(() => prepareSourceCitationCorrection(review, valid)).toThrow('critic_evidence');
  });
  it('restores a review from the request it sent, exactly; a changed unit, instruction or packet field refuses', async () => {
    const { review } = await failed(), restored = restoreSourceCitationReview(structuredClone(review.packet), review.instructions);
    expect(restored.catalogue).toEqual(review.catalogue); expect(restored.packetDigest).toBe(review.packetDigest);
    const unit = structuredClone(review.packet) as any; unit.original.pages[0].units[0].text += 'x';
    expect(() => restoreSourceCitationReview(unit, review.instructions)).toThrow('critic_binding');
    expect(() => restoreSourceCitationReview(review.packet, review.instructions + ' ')).toThrow('critic_binding');
    expect(() => restoreSourceCitationReview({ ...review.packet, sourcePacketDigest: 'c'.repeat(64) }, review.instructions)).not.toThrow();
    expect(restoreSourceCitationReview({ ...review.packet, sourcePacketDigest: 'c'.repeat(64) }, review.instructions).packetDigest).not.toBe(review.packetDigest);
  });
});

describe.skipIf(!real)('fresh-book same-book text recovery (native stages, synthetic providers)', { timeout: 240_000 }, () => {
  /** A temporary authority root and output parent, round-1 re-review passed for real (fake judges), then the ONE text stage FAILS on its comparison citation. */
  async function failedBook() {
    const root = mkdtempSync(path.join(tmpdir(), 'fresh-recovery-')); roots.push(root);
    const authority = path.join(root, 'book-authority'), parent = path.join(root, 'renders'); mkdirSync(authority); mkdirSync(parent);
    for (const n of [REREVIEW_AMENDMENT.originalClaimName, REREVIEW_AMENDMENT.originalOutcomeName]) writeFileSync(path.join(authority, n), '{}');
    const rereview: RereviewConfig = { version: 'child-anchor-rereview-config/v1', round: 1, diagnosticOutput: ORIGINAL, diagnosticConfig: ORIGINAL_CONFIG,
      diagnosticConfigSha256: sha(readFileSync(ORIGINAL_CONFIG)), candidateSha256: '6375db61419767bd120293396cac50b0c20ccc76fc27a333a65c34f2c9419c4f',
      outputParent: parent, keyEnvFile: path.join(root, 'no-key.env'), ...(MATERIALITY ? { acceptance: CHILD_ANCHOR_MATERIALITY_VERSION } : {}) };
    let head = 'f'.repeat(40), clean = true;
    const env = { authorityRoot: authority, head: () => ({ head, branch: 'claude/book-render-20261009', clean }) } satisfies RereviewEnv;
    const { grantDraft: rg } = await planRereview(rereview, env), rgFile = path.join(root, 'rereview-grant-1.json'); writeFileSync(rgFile, JSON.stringify(rg));
    await runRereview({ config: rereview, env, grantFile: rgFile, grantSha: sha(readFileSync(rgFile)), signal: new AbortController().signal, log: () => {},
      adapters: (directory: string, meter: AuditionMeter, guard: () => void) => {
        const reply = (wire: unknown, value: unknown) => { const raw = { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', output_text: JSON.stringify(value),
          usage: { input_tokens: 2000, output_tokens: 300 } }; const s = auditionReviewRule.settle(wire, { raw }, true);
          return { value, estimatedMicroUsd: s.estimatedMicroUsd, receipt: { raw, estimatedMicroUsd: s.estimatedMicroUsd } }; };
        return { writeImage: async (name: string, bytes: Buffer) => { writeFileSync(path.join(directory, name), bytes, { flag: 'wx' }); return { imageName: name, imageSha: sha(bytes) }; },
          bytesOf: (img: { imageName: string }) => readFileSync(path.join(directory, img.imageName)),
          inspectedStyle: async (step: string, c: any, ctx: any, recipeSha: string) => { guard(); const wire = inspectedStyleWire(c, readFileSync(path.join(directory, c.imageName)), ctx, recipeSha);
            return meter.run(step, wire, 600000, async () => reply(wire, { candidateSha: c.imageSha, contextSha: childAnchorInspectionContextSha(ctx), recipeSha, assessable: true,
              style01Match: true, looksPhotoreal: false, looksPortrait: false, notes: 'watercolor' })); },
          inspectedDesign: async (step: string, c: any, ctx: any, r: any) => { guard(); const wire = await inspectedDesignWire(c, readFileSync(path.join(directory, c.imageName)), ctx, r);
            const unobservedConditional = [{ trait: 'One front baby tooth missing, visible when she smiles', condition: 'open_mouth_or_smile', observation: 'lips closed' }];
            const recipeSha = (JSON.parse((wire as any).input[0].content[0].text)).recipeSha, contextSha = childAnchorInspectionContextSha(ctx);
            return meter.run(step, wire, 600000, async () => reply(wire, MATERIALITY
              ? { candidateSha: c.imageSha, contextSha, recipeSha, acceptanceVersion: CHILD_ANCHOR_MATERIALITY_VERSION, checks: passChecks(),
                apparentAge: { requestedAge: 6, verdict: 'compatible', observation: 'six', correction: '' },
                visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => ({ aspect, verdict: 'matched', observation: 'seen', materiality: 'not_applicable', deviation: '' })),
                unobservedConditional, recognizableCharacter: { verdict: 'same_character', observation: 'the same child' } }
              : { candidateSha: c.imageSha, contextSha, recipeSha, inspectionVersion: CHILD_ANCHOR_INSPECTION_VERSION,
                checks: passChecks(), apparentAge: { requestedAge: 6, verdict: 'compatible', observation: 'six', correction: '' },
                visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => ({ aspect, verdict: 'matched', observation: 'seen' })), unobservedConditional })); } } as any;
      } });
    const rereviewFile = path.join(root, 'rereview-config.json'); writeFileSync(rereviewFile, JSON.stringify(rereview));
    const profile = freshBookProfileSchema.parse({ version: 'fresh-book-profile/v1', cycle: FRESH_BOOK_CYCLE.id,
      child: { name: 'נועה', age: 5, gender: 'girl', design: 'A fictional five-year-old girl with short dark-brown hair, dark brown eyes and light olive skin; natural child proportions.',
        wardrobe: 'a red shirt, blue shorts and teal shoes', fictional: true },
      companion: { id: 'fox_uri', design: 'the registry fox Uri, copper fur and lantern eyes' },
      parentInputs: { about: 'She loves drawing in the garden and inventing games.', wish: 'to enjoy a silly adventure' },
      seed: 'fresh-book-driver-test-seed', request: { ...structuredClone(f.request), companion: { id: 'fox_uri' } }, routes: FRESH_BOOK_CYCLE.routes,
      childAnchor: MATERIALITY ? CHILD_ANCHOR_MATERIALITY_VERSION : CHILD_ANCHOR_INSPECTION_VERSION });
    const profileFile = path.join(root, 'profile.json'); writeFileSync(profileFile, JSON.stringify(profile));
    const executable = path.join(root, 'SYNTHETIC-claude.exe'); writeFileSync(executable, 'never spawned');
    const keyEnvFile = path.join(root, 'SYNTHETIC.env'); writeFileSync(keyEnvFile, 'OPENAI_API_KEY=sk-synthetic-test-value-not-a-credential-000\n');
    const config: FreshBookConfig = { version: 'fresh-book-driver-config/v1', profileFile, profileSha256: sha(readFileSync(profileFile)), rereviewConfig: rereviewFile,
      rereviewConfigSha256: sha(readFileSync(rereviewFile)), bookDir: path.join(parent, 'fresh-book'), executable, executableSha256: sha(readFileSync(executable)), keyEnvFile };
    const { grantDraft } = planFreshBook(config, env), grantFile = path.join(root, 'fresh-grant.json'); writeFileSync(grantFile, JSON.stringify(grantDraft));
    const original = { config, env, grantFile, grantSha: sha(readFileSync(grantFile)), signal: new AbortController().signal, log: () => {} };
    await expect(runFreshBookText({ ...original, transports: textTransports() })).rejects.toThrow('critic_evidence');
    expect(json(path.join(authority, FRESH_BOOK_CYCLE.outcomeName))).toMatchObject({ status: 'failed_text', code: 'critic_evidence' });
    // A NEW reviewed head for the recovery (the original grant's pins bind ITS head).
    head = 'e'.repeat(40);
    const grant = (name = 'recovery-grant.json') => { const g = planFreshBookRecovery(config, env, grantFile).grantDraft, file = path.join(root, name);
      writeFileSync(file, JSON.stringify(g)); return { ...original, grantFile: file, grantSha: sha(readFileSync(file)) }; };
    const frozen = () => ({ text: tree(path.join(config.bookDir, 'text')), request: sha(readFileSync(path.join(config.bookDir, 'request.json'))),
      admission: sha(readFileSync(path.join(config.bookDir, 'admission.json'))), grant: sha(readFileSync(grantFile)),
      claim: sha(readFileSync(path.join(authority, FRESH_BOOK_CYCLE.claimName))), outcome: sha(readFileSync(path.join(authority, FRESH_BOOK_CYCLE.outcomeName))) });
    return { root, authority, config, env, original, grant, frozen, setHead: (h: string) => { head = h; }, setClean: (c: boolean) => { clean = c; } };
  }
  const recoveryDir = (s: { config: FreshBookConfig }) => path.join(s.config.bookDir, FRESH_BOOK_RECOVERY.folder);
  const claims = (dir: string) => readdirSync(dir).filter(n => n.endsWith('.claim.json')).map(n => n.replace('.claim.json', '')).sort();

  it('positive: exact replay (no author/editor/reader callback), ONE citation-only correction, strict compile, Opus planner + Sol review, then child/book on the recovery line', async () => {
    const s = await failedBook(), before = s.frozen(), g = s.grant(), t = textTransports();
    const out = await runFreshBookTextRecovery({ ...g, transports: t });
    expect(out).toMatchObject({ status: 'review_supported', corrections: 1, replayed: ['author', 'editor', 'final_review', 'comparison'] });
    expect(vi.mocked(t.reader).mock.calls.map(c => (c[1] as any).stage)).toEqual(['citation_correction']);
    expect([vi.mocked(t.opus).mock.calls.length, vi.mocked(t.planner).mock.calls.length, vi.mocked(t.responses).mock.calls.length]).toEqual([0, 1, 1]);
    expect(claims(path.join(recoveryDir(s), 'paid-stages'))).toEqual(['citation_correction', 'storyboard_review']);
    expect(json(path.join(recoveryDir(s), 'paid-stages', 'citation_correction.claim.json')).maximumMicroUsd).toBe(600000);
    expect(claims(path.join(recoveryDir(s), 'claude-max-stages'))).toEqual(['storyboard']);
    const corr = json(path.join(recoveryDir(s), 'citation-correction.json'));
    expect(corr).toMatchObject({ stage: 'comparison', version: 'story-source-citations-correction/v1', paths: ['0/original/0'] });
    const failedRaw = json(path.join(s.config.bookDir, 'text', 'paid-stages', 'comparison.receipt.json')).output;
    expect({ ...corr.corrected, findings: corr.corrected.findings.map((x: any) => ({ ...x, original: null })) })
      .toEqual({ ...failedRaw, findings: failedRaw.findings.map((x: any) => ({ ...x, original: null })) });
    // Cumulative: the original text's 2 calls (14000) stay; the recovery adds its own; nothing reset.
    expect(json(path.join(s.authority, FRESH_BOOK_RECOVERY.successorName))).toMatchObject({ grantSha256: g.grantSha, stage: 'comparison',
      originalClaimSha256: sha(readFileSync(path.join(s.authority, FRESH_BOOK_CYCLE.claimName))) });
    expect(out.ledger.stages.slice(0, 2)).toEqual([{ name: 'text', knownMicroUsd: 14000, calls: 2 }, expect.objectContaining({ name: 'text-recovery', calls: 2 })]);
    expect(s.frozen()).toEqual(before);
    // The recovery is used once: the same, a re-issued or a relabelled grant cannot start another.
    await expect(runFreshBookTextRecovery({ ...g, transports: textTransports() })).rejects.toThrow(/fresh_book_recovery_(used|grant)|fresh_book_roots_changed/);
    await expect(runFreshBookTextRecovery({ ...s.grant('relabelled-grant.json'), transports: textTransports() })).rejects.toThrow('fresh_book_recovery_used');
    // Legacy refusal is unchanged: the original line still refuses the failed text.
    providers();
    await expect(runFreshBookChild(s.original)).rejects.toThrow(/fresh_book_grant|fresh_book_stage_not_passed|fresh_book_source_changed/);
    // ... and at the original head too: its grant admits, the failed text still refuses (the recovery line is never implied).
    s.setHead('f'.repeat(40));
    await expect(runFreshBookChild(s.original)).rejects.toThrow('fresh_book_stage_not_passed');
    s.setHead('e'.repeat(40));
    const g2 = s.grant('recovery-grant-downstream.json');
    expect(g2.grantSha).toBe(g.grantSha);
    expect(await runFreshBookChild({ ...g, recovery: true })).toMatchObject({ status: 'child_reference_passed' });
    expect(json(path.join(s.config.bookDir, 'book-layout.json')).storyboardDir).toBe('text-recovery');
    const book = await runFreshBookBook({ ...g, recovery: true });
    expect(book.status).toBe('complete');
    expect(book.ledger.stages.map(x => x.name)).toEqual(['text', 'text-recovery', 'child', 'audition']);
    expect(json(path.join(s.authority, FRESH_BOOK_RECOVERY.outcomeName)).status).toBe('complete');
    expect(json(path.join(s.config.bookDir, 'audition.grant.json')).experiment.claimSha256).toBe(sha(readFileSync(path.join(s.authority, FRESH_BOOK_RECOVERY.claimName))));
    expect(s.frozen()).toEqual(before);
  });

  it('a correction that is still invalid, or rewrites another reference, holds after its ONE call: no planner, no review, no second correction', async () => {
    for (const correction of [(input: string) => ({ ...validCorrection(input), corrections: validCorrection(input).corrections.map((c: any) => ({ ...c, anchor: anchorOf(JSON.parse(input).correction.invalid[0].units[0].text, true) })) }),
      (input: string) => ({ ...validCorrection(input), corrections: [...validCorrection(input).corrections.map((c: any) => ({ ...c, path: '0/revised/0' }))] })]) {
      const s = await failedBook(), before = s.frozen(), g = s.grant(), t = textTransports({ correction });
      await expect(runFreshBookTextRecovery({ ...g, transports: t })).rejects.toThrow();
      expect(vi.mocked(t.reader).mock.calls.length).toBe(1);
      expect([vi.mocked(t.planner).mock.calls.length, vi.mocked(t.responses).mock.calls.length]).toEqual([0, 0]);
      expect(json(path.join(s.authority, FRESH_BOOK_RECOVERY.outcomeName))).toMatchObject({ status: 'failed_text_recovery', code: 'critic_evidence' });
      expect(json(path.join(recoveryDir(s), 'spend.json'))).toMatchObject({ calls: 1, newKnownApiMicroUsd: 7000, unknownCost: 0, unknownOutcome: 0 });
      const t2 = textTransports();
      await expect(runFreshBookTextRecovery({ ...s.grant('again.json'), transports: t2 })).rejects.toThrow('fresh_book_recovery_used');
      expect(vi.mocked(t2.reader).mock.calls.length).toBe(0);
      await expect(runFreshBookChild({ ...g, recovery: true })).rejects.toThrow('fresh_book_stage_not_passed');
      expect(s.frozen()).toEqual(before);
    }
  });

  it('immutable inputs: changed saved answer/manuscript, head, grant, profile or original records refuse BEFORE the recovery claim or any call', async () => {
    const cases: Record<string, (s: Awaited<ReturnType<typeof failedBook>>) => { grant?: ReturnType<Awaited<ReturnType<typeof failedBook>>['grant']>; expect: RegExp }> = {
      'editor answer changed before planning': s => { const file = path.join(s.config.bookDir, 'text', 'claude-max-stages', 'editor.receipt.json'), r = json(file);
        r.output.pages[0].text += ' שינוי.'; writeFileSync(file, JSON.stringify(r)); return { expect: /fresh_book_recovery_replay|simple_story_source_receipt_output/ }; },
      'comparison answer changed after the grant': s => { const g = s.grant(), file = path.join(s.config.bookDir, 'text', 'paid-stages', 'comparison.receipt.json'), r = json(file);
        r.output.summary = 'A rewritten summary of the comparison.'; writeFileSync(file, JSON.stringify(r)); return { grant: g, expect: /fresh_book_recovery_grant/ }; },
      'head moved after the grant': s => { const g = s.grant(); s.setHead('d'.repeat(40)); return { grant: g, expect: /fresh_book_recovery_grant|fresh_book_source_changed/ }; },
      'dirty tree': s => { const g = s.grant(); s.setClean(false); return { grant: g, expect: /fresh_book_source_changed/ }; },
      'grant edited': s => { const g = s.grant(), x = json(g.grantFile); x.allowance.correctionCalls = 2; writeFileSync(g.grantFile, JSON.stringify(x));
        return { grant: { ...g, grantSha: sha(readFileSync(g.grantFile)) }, expect: /fresh_book_recovery_grant/ }; },
      'original outcome not this failure': s => { writeFileSync(path.join(s.authority, FRESH_BOOK_CYCLE.outcomeName), JSON.stringify({ cycle: FRESH_BOOK_CYCLE.id, status: 'held_text' }));
        return { expect: /fresh_book_recovery_original/ }; },
      'original grant bytes changed': s => { const g = s.grant(); writeFileSync(s.original.grantFile, readFileSync(s.original.grantFile, 'utf8') + ' ');
        return { grant: g, expect: /fresh_book_recovery_original|fresh_book_recovery_grant/ }; },
      'profile changed': s => { const g = s.grant(); writeFileSync(s.config.profileFile, readFileSync(s.config.profileFile, 'utf8') + '\n');
        return { grant: g, expect: /fresh_book_profile_changed/ }; },
    };
    for (const [name, mutate] of Object.entries(cases)) {
      const s = await failedBook(), t = textTransports();
      let c: ReturnType<typeof mutate>;
      try { c = mutate(s); } catch (e) { throw new Error(`${name}: ${e}`); }
      const run = c.grant ? runFreshBookTextRecovery({ ...c.grant, transports: t }) : Promise.resolve().then(() => runFreshBookTextRecovery({ ...s.grant(), transports: t }));
      await expect(run, name).rejects.toThrow(c.expect);
      const claimed = existsSync(path.join(s.authority, FRESH_BOOK_RECOVERY.claimName));
      if (name !== 'editor answer changed before planning') expect([name, claimed, existsSync(recoveryDir(s))]).toEqual([name, false, false]);
      expect([name, ...[t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)]).toEqual([name, 0, 0, 0]);
    }
  });

  it('a change during the paid correction (after its await) halts before the next call; an orphan cost halts every later stage', async () => {
    const s = await failedBook(), g = s.grant(), t = textTransports();
    vi.mocked(t.reader).mockImplementationOnce(async (wire: any, call: any) => {
      writeFileSync(path.join(s.authority, FRESH_BOOK_CYCLE.claimName), readFileSync(path.join(s.authority, FRESH_BOOK_CYCLE.claimName), 'utf8') + ' ');
      return readerReply(validCorrection(call.input), wire);
    });
    await expect(runFreshBookTextRecovery({ ...g, transports: t })).rejects.toThrow(/fresh_book_roots_changed|fresh_book_claim/);
    expect([vi.mocked(t.planner).mock.calls.length, vi.mocked(t.responses).mock.calls.length]).toEqual([0, 0]);
    expect(json(path.join(s.authority, FRESH_BOOK_RECOVERY.outcomeName)).status).toBe('failed_text_recovery');
    // Orphan: a successful recovery, then an unknown-outcome claim in its meter halts the child before any render.
    const o = await failedBook(), og = o.grant();
    await runFreshBookTextRecovery({ ...og, transports: textTransports() });
    const paid = path.join(recoveryDir(o), 'paid-stages');
    writeFileSync(path.join(paid, 'storyboard_review.result.json.bak'), 'x');
    providers();
    await expect(runFreshBookChild({ ...og, recovery: true })).rejects.toThrow();
    expect(vi.mocked(images.generateGPTImage).mock.calls.length).toBe(0);
    expect(existsSync(path.join(o.config.bookDir, 'child'))).toBe(false);
  });

  /** The F5 successor changes (Codex 2026-10-18): each leaves usage/settlement intact; `reseal` also rewrites the durable record to the changed folder. */
  const tamperSuccessor = (s: Awaited<ReturnType<typeof failedBook>>, kind: string, reseal = false) => {
    const dir = recoveryDir(s), write = (file: string, edit: (x: any) => void) => { const x = json(file); edit(x); writeFileSync(file, JSON.stringify(x)); };
    if (kind === 'paid_correction_raw') write(path.join(dir, 'paid-stages', 'citation_correction.receipt.json'), r => {
      const answer = JSON.parse(r.raw.output_text); answer.corrections[0].anchor = 'ציטוט שאיננו'; r.raw.output_text = JSON.stringify(answer); r.output = answer; });
    else if (kind === 'compiled_correction') write(path.join(dir, 'citation-correction.json'), p => {
      p.corrected.summary = 'This semantic summary was changed AFTER recovery.'; p.corrected.findings[0].explanation = 'A different finding, not the frozen failed answer.'; });
    else write(path.join(dir, 'recovery-admission.json'), p => { p.grantSha256 = '0'.repeat(64); p.original.claimSha256 = '1'.repeat(64); });
    if (reseal) write(path.join(s.authority, FRESH_BOOK_RECOVERY.successorName), r => { r.successorSha256 = previewSha(canonicalJson(folderBaseline(dir))); });
  };
  it.each(['paid_correction_raw', 'compiled_correction', 'recovery_admission'])('F5: a changed successor (%s) refuses the child BEFORE its folder, key or render, even with a re-sealed record', async kind => {
    const s = await failedBook(), g = s.grant();
    await runFreshBookTextRecovery({ ...g, transports: textTransports() });
    const before = s.frozen(), record = readFileSync(path.join(s.authority, FRESH_BOOK_RECOVERY.successorName));
    for (const reseal of [false, true]) {
      tamperSuccessor(s, kind, reseal);
      providers();
      await expect(runFreshBookChild({ ...g, recovery: true }), `${kind} reseal=${reseal}`).rejects.toThrow('fresh_book_recovery_successor');
      expect([kind, reseal, vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length, existsSync(path.join(s.config.bookDir, 'child'))])
        .toEqual([kind, reseal, 0, 0, false]);
    }
    expect(s.frozen()).toEqual(before);
    expect(existsSync(path.join(s.authority, FRESH_BOOK_RECOVERY.outcomeName))).toBe(false);
    expect(readFileSync(path.join(s.authority, FRESH_BOOK_RECOVERY.successorName)).equals(record)).toBe(false);
  });
  it('F5: a successor change AFTER the check (during an awaited render) halts at the next guard; book and resume entry refuse a changed successor', async () => {
    const s = await failedBook(), g = s.grant(), before = s.frozen();
    await runFreshBookTextRecovery({ ...g, transports: textTransports() });
    // Child: the check passes, then the successor changes during the first render: no review call follows.
    providers();
    const render = vi.mocked(images.generateGPTImage), real = render.getMockImplementation()!;
    render.mockImplementationOnce(async input => { tamperSuccessor(s, 'compiled_correction'); return real(input); });
    await expect(runFreshBookChild({ ...g, recovery: true })).rejects.toThrow('fresh_book_roots_changed');
    expect([render.mock.calls.length, sdk.create.mock.calls.length]).toEqual([1, 0]);
    expect(json(path.join(s.authority, FRESH_BOOK_RECOVERY.outcomeName)).status).toBe('failed_child');
    // Book/resume on a second book: the child passes, the book starts and the successor changes during its first render.
    const b = await failedBook(), bg = b.grant();
    await runFreshBookTextRecovery({ ...bg, transports: textTransports() });
    providers();
    expect(await runFreshBookChild({ ...bg, recovery: true })).toMatchObject({ status: 'child_reference_passed' });
    const r2 = vi.mocked(images.generateGPTImage), real2 = r2.getMockImplementation()!, rendered = r2.mock.calls.length;
    r2.mockImplementationOnce(async input => { tamperSuccessor(b, 'paid_correction_raw'); return real2(input); });
    await expect(runFreshBookBook({ ...bg, recovery: true })).rejects.toThrow('fresh_book_roots_changed');
    expect(r2.mock.calls.length).toBe(rendered + 1);
    expect(existsSync(path.join(b.config.bookDir, 'audition.grant.json'))).toBe(true);
    await expect(runFreshBookBook({ ...bg, recovery: true, resume: true })).rejects.toThrow('fresh_book_recovery_successor');
    await expect(runFreshBookBook({ ...bg, recovery: true })).rejects.toThrow('fresh_book_recovery_successor');
    expect(r2.mock.calls.length).toBe(rendered + 1);
    expect(existsSync(path.join(b.authority, FRESH_BOOK_RECOVERY.outcomeName))).toBe(false);
    expect(s.frozen()).toEqual(before);
  });

  describe('the ONE storyboard-only repair line (after the recovery\'s held storyboard)', () => {
    /** Held as the real recovery was: a book check uncertain (a finished state carried forward) and page 7's first check contradicted (sky only implied). */
    const heldReview = (r: any) => {
      r.bookChecks[1] = { ...r.bookChecks[1], verdict: 'uncertain', observation: 'a finished process is carried forward as still ongoing' };
      r.frames[7].checks[0] = { ...r.frames[7].checks[0], verdict: 'contradiction', observation: 'page 7: the sky the text names is only implied' };
      return r;
    };
    const repairDir = (s: { config: FreshBookConfig }) => path.join(s.config.bookDir, FRESH_BOOK_STORYBOARD_REPAIR.folder);
    const REPLAYED = ['text/claude-max-stages/author', 'text/claude-max-stages/editor', 'text/paid-stages/final_review', 'text/paid-stages/comparison',
      'text-recovery/paid-stages/citation_correction'];
    /** The failed book, its ONE recovery whose storyboard review HOLDS it, then a NEW reviewed head for the repair (its grant pins its own head). */
    async function heldBook() {
      const s = await failedBook(), recovery = s.grant();
      expect(await runFreshBookTextRecovery({ ...recovery, transports: textTransports({ review: heldReview }) })).toMatchObject({ status: 'held_uncertain', corrections: 1 });
      expect(json(path.join(s.authority, FRESH_BOOK_RECOVERY.outcomeName))).toMatchObject({ status: 'held_text', textStatus: 'held_uncertain' });
      s.setHead('d'.repeat(40));
      const repairGrant = (name = 'repair-grant.json') => { const g = planFreshBookStoryboardRepair(s.config, s.env, recovery.grantFile).grantDraft, file = path.join(s.root, name);
        writeFileSync(file, JSON.stringify(g)); return { ...s.original, grantFile: file, grantSha: sha(readFileSync(file)) }; };
      const frozenAll = () => ({ ...s.frozen(), recovery: tree(recoveryDir(s)), recoveryGrant: sha(readFileSync(recovery.grantFile)),
        recoveryClaim: sha(readFileSync(path.join(s.authority, FRESH_BOOK_RECOVERY.claimName))),
        recoveryOutcome: sha(readFileSync(path.join(s.authority, FRESH_BOOK_RECOVERY.outcomeName))) });
      return { ...s, recovery, repairGrant, frozenAll };
    }
    type Held = Awaited<ReturnType<typeof heldBook>>;

    it('positive: the held draft and its paid review are the repair input; replay only; ONE Opus planner + ONE floored Sol review; successor; child and book on its line', async () => {
      const s = await heldBook(), before = s.frozenAll(), g = s.repairGrant(), t = textTransports();
      const planned = planFreshBookStoryboardRepair(s.config, s.env, s.recovery.grantFile);
      expect(planned.grantDraft.held).toMatchObject({ disposition: 'held_uncertain', findings: 2 });
      expect([planned.plan.providerCalls, planned.plan.keyRead, planned.state.claimExists, planned.state.folderExists]).toEqual([0, false, false, false]);
      const out = await runFreshBookStoryboardRepair({ ...g, transports: t });
      expect(out.status).toBe('review_supported');
      // No author, editor, reader or correction callback (all replayed); exactly one planner session and one review.
      expect([t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0, 1, 1]);
      const dir = repairDir(s);
      expect([claims(path.join(dir, 'paid-stages')), claims(path.join(dir, 'claude-max-stages'))]).toEqual([['storyboard_review'], ['storyboard']]);
      // F6: the new review reserved max(600000, its own bound); the recovery's earlier review keeps the reservation it was claimed under.
      const reviewRule = (stageRules.text as any).storyboard_review, bound = reviewRule.reserve(json(path.join(dir, 'paid-stages', 'storyboard_review.wire.json')));
      const reserved = json(path.join(dir, 'paid-stages', 'storyboard_review.claim.json')).maximumMicroUsd;
      expect([bound < REVIEW_RESERVE_FLOOR_MICRO_USD, reserved]).toEqual([true, REVIEW_RESERVE_FLOOR_MICRO_USD]);
      expect(json(path.join(recoveryDir(s), 'paid-stages', 'storyboard_review.claim.json')).maximumMicroUsd)
        .toBe(reviewRule.reserve(json(path.join(recoveryDir(s), 'paid-stages', 'storyboard_review.wire.json'))));
      // The repair input: exactly the held draft and its raw review (the engine derives the findings), with the visible-moment contract added.
      const held = json(path.join(recoveryDir(s), 'simple-book-result.json'));
      expect(json(path.join(dir, 'storyboard_repair_input.json'))).toEqual({ parentStoryboardDigest: held.storyboard.storyboardDigest,
        draft: json(path.join(recoveryDir(s), 'owned_storyboard_draft.json')), review: held.storyboard.rawReview, addedContracts: ['visibleMomentContract'] });
      const plannerCall = vi.mocked(t.planner).mock.calls[0][1] as any, input = JSON.parse(plannerCall.input);
      expect(input.priorReviewedStoryboard.reviewFindings.map((x: any) => [x.scope, x.pageNumber ?? null, x.verdict]))
        .toEqual([['book', null, 'uncertain'], ['page', 7, 'contradiction']]);
      expect(plannerCall.instructions.endsWith(`\n${VISIBLE_MOMENT_STORYBOARD_ADDENDUM}\n${REPAIR_STORYBOARD_ADDENDUM}`)).toBe(true);
      // The paid planner request is exactly the preview admitted before the claim.
      const admission = json(path.join(dir, 'repair-admission.json'));
      expect(admission.preview.wireDigest).toBe(json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')).wireDigest);
      expect(admission.preview).toEqual(await previewFreshBookStoryboardRepair(s.config, json(path.join(dir, 'storyboard_repair_input.json'))));
      expect(json(path.join(dir, 'sealed.json'))).toEqual({ status: 'review_supported', repaired: { parentStoryboardDigest: held.storyboard.storyboardDigest,
        addedContracts: ['visibleMomentContract'] }, replayed: REPLAYED, runtimeEligible: false });
      expect(json(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.successorName))).toMatchObject({ grantSha256: g.grantSha, reviewReserveMicroUsd: reserved,
        parentStoryboardDigest: held.storyboard.storyboardDigest, recoveryClaimSha256: sha(readFileSync(path.join(s.authority, FRESH_BOOK_RECOVERY.claimName))) });
      // The same story; a new storyboard naming its parent and carrying the contract's marker.
      const result = json(path.join(dir, 'simple-book-result.json'));
      expect(result.source.manuscript).toEqual(held.source.manuscript);
      expect(result.storyboard.storyboard).toMatchObject({ visibleMoment: 'storyboard-visible-moment/v1', repair: { parentStoryboardDigest: held.storyboard.storyboardDigest } });
      expect(out.ledger.stages.map(x => [x.name, x.calls])).toEqual([['text', 2], ['text-recovery', 2], ['storyboard-repair', 1], ['child', 0], ['audition', 0]]);
      expect(s.frozenAll()).toEqual(before);
      // Once only: the same, a re-issued or a relabelled grant cannot start another repair.
      await expect(runFreshBookStoryboardRepair({ ...g, transports: textTransports() })).rejects.toThrow(/fresh_book_storyboard_repair_(used|grant)|fresh_book_roots_changed/);
      await expect(runFreshBookStoryboardRepair({ ...s.repairGrant('relabelled.json'), transports: textTransports() })).rejects.toThrow('fresh_book_storyboard_repair_used');
      // The earlier lines stay closed: the recovery line (its held outcome) and a repair grant on another line refuse before any child folder.
      providers();
      s.setHead('e'.repeat(40));
      await expect(runFreshBookChild({ ...s.recovery, recovery: true })).rejects.toThrow('fresh_book_stage_not_passed');
      s.setHead('d'.repeat(40));
      await expect(runFreshBookChild({ ...g, recovery: true })).rejects.toThrow('fresh_book_recovery_grant');
      await expect(runFreshBookChild(g)).rejects.toThrow('fresh_book_grant');
      expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
      expect(await runFreshBookChild({ ...g, storyboardRepair: true })).toMatchObject({ status: 'child_reference_passed' });
      expect(json(path.join(s.config.bookDir, 'book-layout.json')).storyboardDir).toBe('storyboard-repair');
      const book = await runFreshBookBook({ ...g, storyboardRepair: true });
      expect(book.status).toBe('complete');
      expect(book.ledger.stages.map(x => x.name)).toEqual(['text', 'text-recovery', 'storyboard-repair', 'child', 'audition']);
      expect(json(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName)).status).toBe('complete');
      expect(json(path.join(s.config.bookDir, 'audition.grant.json')).experiment.claimSha256)
        .toBe(sha(readFileSync(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.claimName))));
      expect(s.frozenAll()).toEqual(before);
    });

    it('a review that holds the repaired storyboard too ends the line: its own held outcome, no second planner or review, no child', async () => {
      const s = await heldBook(), before = s.frozenAll(), g = s.repairGrant(), t = textTransports({ review: heldReview });
      expect((await runFreshBookStoryboardRepair({ ...g, transports: t })).status).toBe('held_uncertain');
      expect([t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([1, 1]);
      expect(json(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName))).toMatchObject({ status: 'held_storyboard_repair', textStatus: 'held_uncertain' });
      expect(existsSync(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.successorName))).toBe(false);
      const t2 = textTransports();
      await expect(runFreshBookStoryboardRepair({ ...s.repairGrant('again.json'), transports: t2 })).rejects.toThrow('fresh_book_storyboard_repair_used');
      expect([t2.planner, t2.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0]);
      providers();
      await expect(runFreshBookChild({ ...g, storyboardRepair: true })).rejects.toThrow('fresh_book_stage_not_passed');
      expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
      expect(s.frozenAll()).toEqual(before);
    });

    it('F6: max(600000, bound) is the claim, the journal and the replay; a balance short of it refuses BEFORE the key or provider; history is not renormalized', async () => {
      const rule = { settle: () => ({ coherent: true, estimatedMicroUsd: 0 }), reserve: (w: any) => w?.bound ?? null } as any, floored = flooredReviewRule(rule);
      expect([1, 599999, 600000, 812345].map(bound => floored.reserve({ bound }))).toEqual([600000, 600000, 600000, 812345]);
      expect(floored.reserve({})).toBeNull();
      expect([STORYBOARD_REPAIR_RULES('citation_correction'), STORYBOARD_REPAIR_RULES('final_review'), STORYBOARD_REPAIR_RULES('storyboard')]).toEqual([undefined, undefined, undefined]);
      // Admission: the stage refuses before its one claim when the balance cannot cover even the floor (exactly the floor fits).
      expect(() => assertReviewFloorFits({ bookKnownMicroUsd: 6_400_001, nextCapMicroUsd: 7_000_000 })).toThrow('fresh_book_storyboard_repair_budget');
      expect(assertReviewFloorFits({ bookKnownMicroUsd: 6_400_000, nextCapMicroUsd: 7_000_000 })).toEqual({ remainingMicroUsd: 600000, reviewFloorMicroUsd: 600000 });
      // The journal: the claim must be the floored maximum; a balance short of it refuses before the dispatch (where the key is first read).
      const s = await heldBook(), from = path.join(recoveryDir(s), 'paid-stages'), wire = json(path.join(from, 'storyboard_review.wire.json'));
      const textRule = (stageRules.text as any).storyboard_review, bound = textRule.reserve(wire), maximum = STORYBOARD_REPAIR_RULES('storyboard_review')!.reserve(wire)!;
      expect([bound < 600000, maximum]).toEqual([true, 600000]);
      const probe = path.join(s.root, 'meter-probe'), dispatch = vi.fn();
      await expect(new AuditionMeter(probe, 1_000_000 + maximum - 1, 1, 1_000_000, 0, STORYBOARD_REPAIR_RULES).run('storyboard_review', wire, maximum, dispatch))
        .rejects.toThrow('audition_budget_exhausted');
      await expect(new AuditionMeter(probe, 1_000_000 + maximum, 1, 1_000_000, 0, STORYBOARD_REPAIR_RULES).run('storyboard_review', wire, bound, dispatch))
        .rejects.toThrow('audition_meter_cost');
      expect([dispatch.mock.calls.length, readdirSync(probe)]).toEqual([0, []]);
      // Replay: the recovery's settled review re-derives under the rule it was claimed under; the floored rule refuses that same record (never renormalized).
      const alone = path.join(s.root, 'review-alone'); mkdirSync(alone);
      for (const k of ['wire', 'result', 'receipt']) writeFileSync(path.join(alone, `storyboard_review.${k}.json`), readFileSync(path.join(from, `storyboard_review.${k}.json`)));
      writeFileSync(path.join(alone, 'storyboard_review.claim.json'), JSON.stringify({ ...json(path.join(from, 'storyboard_review.claim.json')), seq: 0 }));
      expect(verifyMeterRecords(alone, step => step === 'storyboard_review' ? textRule : undefined)).toHaveLength(1);
      expect(() => verifyMeterRecords(alone, STORYBOARD_REPAIR_RULES)).toThrow('audition_meter_cost');
      // ... and the repair's own floored claim is refused under the unfloored rule: the same rule is the claim and its replay.
      await runFreshBookStoryboardRepair({ ...s.repairGrant(), transports: textTransports() });
      expect(verifyMeterRecords(path.join(repairDir(s), 'paid-stages'), STORYBOARD_REPAIR_RULES)).toHaveLength(1);
      expect(() => verifyMeterRecords(path.join(repairDir(s), 'paid-stages'), step => step === 'storyboard_review' ? textRule : undefined)).toThrow('audition_meter_cost');
    });

    it('immutable inputs: a changed held draft/review/outcome, successor, head, grant or text evidence refuses BEFORE the repair claim or any call', async () => {
      const edit = (file: string, change: (x: any) => void) => { const x = json(file); change(x); writeFileSync(file, JSON.stringify(x)); };
      const cases: Record<string, (s: Held) => { grant?: ReturnType<Held['repairGrant']>; expect: RegExp }> = {
        'held draft changed': s => { const g = s.repairGrant(); edit(path.join(recoveryDir(s), 'owned_storyboard_draft.json'), d => { d.plan.pages[2].composition += ' changed'; });
          return { grant: g, expect: /fresh_book_storyboard_repair_recovery/ }; },
        'held review summary edited (not the paid answer)': s => { const g = s.repairGrant();
          for (const n of ['simple-book-result.json', 'visual_simple_book_result.json'])
            edit(path.join(recoveryDir(s), n), r => { r.storyboard.rawReview.frames[7].checks[0].observation += ' (reworded)'; });
          return { grant: g, expect: /fresh_book_storyboard_repair_recovery/ }; },
        'paid review answer changed': s => { const g = s.repairGrant();
          edit(path.join(recoveryDir(s), 'paid-stages', 'storyboard_review.receipt.json'), r => { const a = JSON.parse(r.raw.output_text);
            const k = Object.keys(a.frames[7])[0]; a.frames[7][k].observation += ' (reworded)'; r.raw.output_text = JSON.stringify(a); });
          return { grant: g, expect: /fresh_book_storyboard_repair_recovery/ }; },
        'recovery outcome not held': s => { const g = s.repairGrant();
          edit(path.join(s.authority, FRESH_BOOK_RECOVERY.outcomeName), o => { o.status = 'failed_text_recovery'; });
          return { grant: g, expect: /fresh_book_storyboard_repair_recovery/ }; },
        'a recovery successor appeared': s => { const g = s.repairGrant(); writeFileSync(path.join(s.authority, FRESH_BOOK_RECOVERY.successorName), '{}');
          return { grant: g, expect: /fresh_book_storyboard_repair_recovery/ }; },
        'head moved after the grant': s => { const g = s.repairGrant(); s.setHead('c'.repeat(40)); return { grant: g, expect: /fresh_book_storyboard_repair_grant|fresh_book_source_changed/ }; },
        'dirty tree': s => { const g = s.repairGrant(); s.setClean(false); return { grant: g, expect: /fresh_book_source_changed/ }; },
        'grant floor edited': s => { const g = s.repairGrant(); edit(g.grantFile, x => { x.allowance.reviewReserveFloorMicroUsd = 500000; });
          return { grant: { ...g, grantSha: sha(readFileSync(g.grantFile)) }, expect: /fresh_book_storyboard_repair_grant/ }; },
        'grant adds a contract': s => { const g = s.repairGrant(); edit(g.grantFile, x => { x.addedContracts = ['visibleMomentContract', 'drawnInstantContract']; });
          return { grant: { ...g, grantSha: sha(readFileSync(g.grantFile)) }, expect: /fresh_book_storyboard_repair_grant/ }; },
        'recovery grant bytes changed': s => { const g = s.repairGrant(); writeFileSync(s.recovery.grantFile, readFileSync(s.recovery.grantFile, 'utf8') + ' ');
          return { grant: g, expect: /fresh_book_storyboard_repair_(recovery|grant)/ }; },
        'editor answer changed (the replay)': s => { const g = s.repairGrant();
          edit(path.join(s.config.bookDir, 'text', 'claude-max-stages', 'editor.receipt.json'), r => { r.output.pages[0].text += ' שינוי.'; });
          return { grant: g, expect: /./ }; },
        // F7: the ORIGINAL authority the consumed recovery grant pins (its grant bytes, its failed outcome, seal, request and text evidence).
        'F7 original grant: one whitespace byte appended': s => { const g = s.repairGrant();
          writeFileSync(s.original.grantFile, Buffer.concat([readFileSync(s.original.grantFile), Buffer.from(' ')]));
          return { grant: g, expect: /fresh_book_recovery_original/ }; },
        'F7 original outcome code changed': s => { const g = s.repairGrant();
          edit(path.join(s.authority, FRESH_BOOK_CYCLE.outcomeName), o => { o.code = 'unrelated_terminal_failure'; });
          return { grant: g, expect: /fresh_book_recovery_original/ }; },
        'F7 original text seal changed': s => { const g = s.repairGrant();
          edit(path.join(s.config.bookDir, 'text', 'sealed.json'), x => { x.note = 'rewritten'; });
          return { grant: g, expect: /fresh_book_recovery_original/ }; },
        'F7 original request changed': s => { const g = s.repairGrant();
          writeFileSync(path.join(s.config.bookDir, 'request.json'), readFileSync(path.join(s.config.bookDir, 'request.json'), 'utf8') + '\n');
          return { grant: g, expect: /fresh_book_recovery_original/ }; },
      };
      for (const [name, mutate] of Object.entries(cases)) {
        const s = await heldBook(), t = textTransports();
        let c: ReturnType<typeof mutate>;
        try { c = mutate(s); } catch (e) { throw new Error(`${name}: ${e}`); }
        await expect(runFreshBookStoryboardRepair({ ...c.grant!, transports: t }), name).rejects.toThrow(c.expect);
        expect([name, existsSync(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.claimName)), existsSync(repairDir(s)),
          ...[t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)]).toEqual([name, false, false, 0, 0, 0, 0]);
      }
    });

    it('a change during the paid planner session (after its await) halts before the review: no review call, the line ends failed', async () => {
      const s = await heldBook(), g = s.repairGrant(), t = textTransports(), plan = vi.mocked(t.planner).getMockImplementation()!;
      vi.mocked(t.planner).mockImplementationOnce(async (w, call, sig) => {
        writeFileSync(path.join(s.authority, FRESH_BOOK_RECOVERY.claimName), readFileSync(path.join(s.authority, FRESH_BOOK_RECOVERY.claimName), 'utf8') + ' ');
        return plan(w, call, sig);
      });
      // The engine wraps the review callback's refusal in its own code; the line's terminal record keeps the guard's first code.
      await expect(runFreshBookStoryboardRepair({ ...g, transports: t })).rejects.toThrow(/fresh_book_roots_changed|simple_storyboard_diagnostic_review_callback_failed/);
      expect(vi.mocked(t.responses).mock.calls.length).toBe(0);
      expect(json(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName))).toMatchObject({ status: 'failed_storyboard_repair', code: 'fresh_book_roots_changed' });
      expect(claims(path.join(repairDir(s), 'paid-stages'))).toEqual([]);
      expect(existsSync(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.successorName))).toBe(false);
    });

    it('F7: an original-grant change during the paid planner halts before the review; after a supported repair a changed original record refuses child, book and resume', async () => {
      const appendByte = (file: string) => writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from(' ')]));
      // During the planner session (after its await): the next guard refuses with the lineage code; no review call, no review claim.
      const s = await heldBook(), g = s.repairGrant(), t = textTransports(), plan = vi.mocked(t.planner).getMockImplementation()!;
      vi.mocked(t.planner).mockImplementationOnce(async (w, call, sig) => { appendByte(s.original.grantFile); return plan(w, call, sig); });
      await expect(runFreshBookStoryboardRepair({ ...g, transports: t })).rejects.toThrow(/fresh_book_recovery_original|simple_storyboard_diagnostic_review_callback_failed/);
      expect(vi.mocked(t.responses).mock.calls.length).toBe(0);
      expect(json(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName))).toMatchObject({ status: 'failed_storyboard_repair', code: 'fresh_book_recovery_original' });
      expect(claims(path.join(repairDir(s), 'paid-stages'))).toEqual([]);
      // After a supported repair: a changed original outcome refuses the child before its folder, key or render; restored, it admits again.
      const a = await heldBook(), ag = a.repairGrant();
      expect((await runFreshBookStoryboardRepair({ ...ag, transports: textTransports() })).status).toBe('review_supported');
      const outcomeFile = path.join(a.authority, FRESH_BOOK_CYCLE.outcomeName), kept = readFileSync(outcomeFile);
      writeFileSync(outcomeFile, JSON.stringify({ ...json(outcomeFile), code: 'unrelated_terminal_failure' }));
      providers();
      await expect(runFreshBookChild({ ...ag, storyboardRepair: true })).rejects.toThrow('fresh_book_recovery_original');
      expect([existsSync(path.join(a.config.bookDir, 'child')), vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length]).toEqual([false, 0, 0]);
      writeFileSync(outcomeFile, kept);
      expect(await runFreshBookChild({ ...ag, storyboardRepair: true })).toMatchObject({ status: 'child_reference_passed' });
      // During an awaited book render the original grant changes: the next guard refuses; a resume and a fresh entry refuse before any render.
      const render = vi.mocked(images.generateGPTImage), real = render.getMockImplementation()!, rendered = render.mock.calls.length;
      render.mockImplementationOnce(async input => { appendByte(a.original.grantFile); return real(input); });
      await expect(runFreshBookBook({ ...ag, storyboardRepair: true })).rejects.toThrow('fresh_book_recovery_original');
      expect(render.mock.calls.length).toBe(rendered + 1);
      await expect(runFreshBookBook({ ...ag, storyboardRepair: true, resume: true })).rejects.toThrow('fresh_book_recovery_original');
      await expect(runFreshBookBook({ ...ag, storyboardRepair: true })).rejects.toThrow('fresh_book_recovery_original');
      expect([render.mock.calls.length, existsSync(path.join(a.authority, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName))]).toEqual([rendered + 1, false]);
    });

    /** Successor changes after a supported repair; `reseal` also rewrites the durable record to the changed folder. */
    const tamperRepair = (s: Held, kind: string, reseal = false) => {
      const dir = repairDir(s), write = (file: string, edit: (x: any) => void) => { const x = json(file); edit(x); writeFileSync(file, JSON.stringify(x)); };
      if (kind === 'paid_review_raw') write(path.join(dir, 'paid-stages', 'storyboard_review.receipt.json'), r => {
        const a = JSON.parse(r.raw.output_text), k = Object.keys(a.frames[3])[0]; a.frames[3][k] = { ...a.frames[3][k], verdict: 'uncertain' }; r.raw.output_text = JSON.stringify(a); });
      else if (kind === 'planner_output') write(path.join(dir, 'claude-max-stages', 'storyboard.receipt.json'), r => { r.output.plan.pages[2].composition += ' changed'; });
      else if (kind === 'repair_input') write(path.join(dir, 'storyboard_repair_input.json'), r => { r.review.frames[7].checks[0].observation += ' (reworded)'; });
      else write(path.join(dir, 'repair-admission.json'), a => { a.preview.wireDigest = '0'.repeat(64); });
      if (reseal) write(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.successorName), r => { r.successorSha256 = previewSha(canonicalJson(folderBaseline(dir))); });
    };
    it.each(['paid_review_raw', 'planner_output', 'repair_input', 'repair_admission'])('a changed repair successor (%s) refuses the child BEFORE its folder, key or render, even re-sealed', async kind => {
      const s = await heldBook(), g = s.repairGrant();
      await runFreshBookStoryboardRepair({ ...g, transports: textTransports() });
      const before = s.frozenAll(), record = readFileSync(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.successorName));
      for (const reseal of [false, true]) {
        tamperRepair(s, kind, reseal);
        providers();
        await expect(runFreshBookChild({ ...g, storyboardRepair: true }), `${kind} reseal=${reseal}`).rejects.toThrow('fresh_book_storyboard_repair_successor');
        expect([kind, reseal, vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length, existsSync(path.join(s.config.bookDir, 'child'))])
          .toEqual([kind, reseal, 0, 0, false]);
      }
      expect(s.frozenAll()).toEqual(before);
      expect(existsSync(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName))).toBe(false);
      expect(readFileSync(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.successorName)).equals(record)).toBe(false);
    });

    describe('the ONE diagnosed continuation (after the repair\'s held storyboard: the stage\'s second consecutive held candidate)', () => {
      const CONT = FRESH_BOOK_STORYBOARD_CONTINUATION;
      const contDir = (s: { config: FreshBookConfig }) => path.join(s.config.bookDir, CONT.folder);
      /** The repair's own review holds too: book check 1 in other words, and page 4 (page 7, held before, is resolved). */
      const heldRepairReview = (r: any) => {
        r.bookChecks[1] = { ...r.bookChecks[1], verdict: 'uncertain', observation: 'a finished process is still carried forward, now on another page' };
        r.frames[4].checks[2] = { ...r.frames[4].checks[2], verdict: 'contradiction', observation: 'page 4: the pause the text names is not shown' };
        return r;
      };
      /** The typed review of the continuation: every check lists its issues (none when supported); `change` adds the reviewer's typed issues. */
      const typedReview = (change: (r: any) => void = () => {}) => (r: any) => {
        for (const c of [...r.bookChecks, ...r.frames.flatMap((x: any) => x.checks)]) c.issues = [];
        change(r);
        return r;
      };
      const minorNote = (r: any) => { r.frames[5].checks[1] = { ...r.frames[5].checks[1], verdict: 'uncertain', observation: 'the hut roof is a shade darker than planned',
        issues: [{ impact: 'detail', ref: 'p5', note: 'roof shade', whyNotMaterial: 'the reader understands the same return and the picture shows the same hut' }] }; };
      /**
       * The continuation's planner: it reads its own request (the held repair draft, the diagnosis), changes the diagnosed pages (book findings:
       * an unprotected page), and returns the whole storyboard with a full self-check whose resolutions name exactly the changed sections.
       */
      /** A planner session's receipt; `structured` is the CLI's own structured answer (the provider shape) when it differs from the decoded output. */
      const cliReply = (output: unknown, usd: number, structured: unknown = output) => { const termination = { code: 0, signal: null }, usage = { inputTokens: 100, outputTokens: 100 };
        return { output, usage, estimatedMicroUsd: Math.ceil(usd * 1e6), metadata: { kind: 'cli_reported_estimate_not_invoice', reportedModels: ['claude-opus-5-5'], termination },
          raw: { termination, killConfirmed: true, stopped: false, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: usd,
            modelUsage: { 'claude-opus-5-5': usage }, structured_output: structured }) } } as any; };
      const continuationPlanner = () => vi.fn(async (_w: any, call: any) => {
        const input = JSON.parse(call.input), prior = input.priorReviewedStoryboard, diagnosis = prior.diagnosis;
        const draft = structuredClone(prior.storyboard);
        const pages = new Set<number>(diagnosis.findings.map((f: any) => f.key.startsWith('page:') ? Number(f.key.split(':')[1])
          : [1, 2, 3, 4, 5, 6, 7, 8].find(n => !diagnosis.protectedPages.includes(n))!));
        for (const n of pages) draft.plan.pages[n].composition += ' (re-planned after the diagnosis)';
        const texts = [input.story.title, ...input.story.pages.map((p: any) => p.text)];
        const selfCheck = fullSelfCheck(draft, texts, { diagnosis, parentDraft: prior.storyboard });
        const strip = ({ pageNumber: _n, ...row }: any) => row;
        const wire = { plan: { ...draft.plan, pages: draft.plan.pages.map(strip), continuity: { ...draft.plan.continuity, pages: draft.plan.continuity.pages.map(strip) } },
          sequence: { ...draft.sequence, pages: draft.sequence.pages.map(strip) }, moments: draft.moments, selfCheck };
        return cliReply(decodePersonalBookProviderOutput(call, wire), .43);
      });
      /** The held repair book, then a NEW reviewed head for the continuation (its grant pins its own head; the consumed repair grant is never re-pinned). */
      async function heldRepairBook() {
        const s = await heldBook(), repair = s.repairGrant();
        expect((await runFreshBookStoryboardRepair({ ...repair, transports: textTransports({ review: heldRepairReview }) })).status).toBe('held_uncertain');
        expect(json(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName))).toMatchObject({ status: 'held_storyboard_repair', textStatus: 'held_uncertain' });
        s.setHead('c'.repeat(40));
        const continuationGrant = (name = 'continuation-grant.json') => { const g = planFreshBookStoryboardContinuation(s.config, s.env, repair.grantFile).grantDraft;
          const file = path.join(s.root, name); writeFileSync(file, JSON.stringify(g)); return { ...s.original, grantFile: file, grantSha: sha(readFileSync(file)) }; };
        const frozenLine = () => ({ ...s.frozenAll(), repair: tree(repairDir(s)), repairGrant: sha(readFileSync(repair.grantFile)),
          repairClaim: sha(readFileSync(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.claimName))),
          repairOutcome: sha(readFileSync(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName))) });
        return { ...s, repair, continuationGrant, frozenLine };
      }
      const transports = (review: (r: any) => any) => ({ ...textTransports({ review }), planner: continuationPlanner() });

      it('positive: two historical held candidates force the diagnosis; ONE planner consumes it, ONE typed review admits with notes; successor; child and book on its line', async () => {
        const s = await heldRepairBook(), before = s.frozenLine(), g = s.continuationGrant(), t = transports(typedReview(minorNote));
        const planned = planFreshBookStoryboardContinuation(s.config, s.env, s.repair.grantFile);
        expect(planned.grantDraft.recovery).toMatchObject({ attempts: 2, maxAttempts: 3, consecutiveFailures: 2, mode: 'diagnose_and_change_strategy' });
        expect(planned.recoveryRecord.attempts.map(a => [a.line, a.disposition, a.findings.length])).toEqual([['text-recovery', 'held_uncertain', 2],
          ['storyboard-repair', 'held_uncertain', 2]]);
        expect(planned.recoveryRecord.attempts.map(a => a.costs)).toEqual([{ plannerClaudeMaxMicroUsd: 410000, reviewApiMicroUsd: expect.any(Number) },
          { plannerClaudeMaxMicroUsd: 410000, reviewApiMicroUsd: expect.any(Number) }]);
        const diagnosis = planned.diagnosisRecord.diagnosis;
        expect(diagnosis.findings.map(f => [f.key.split(':')[0], f.trajectory])).toEqual([['book', 'repeated_check_new_detail'], ['page', 'new']]);
        expect(diagnosis.resolved.map(f => f.key.split(':').slice(0, 2).join(':'))).toEqual(['page:7']);
        expect([diagnosis.protectedPages, diagnosis.allowance]).toEqual([[7], { nextAttempt: 3, maxAttempts: 3, remainingAfterNext: 0 }]);
        expect([planned.plan.providerCalls, planned.plan.keyRead, planned.state.claimExists, planned.state.folderExists]).toEqual([0, false, false, false]);
        // Deterministic: the same saved evidence plans the same grant (a restart or repeat cannot derive another strategy or reset the count).
        expect(planFreshBookStoryboardContinuation(s.config, s.env, s.repair.grantFile).grantDraft).toEqual(planned.grantDraft);
        const out = await runFreshBookStoryboardContinuation({ ...g, transports: t });
        expect(out.status).toBe('review_supported_with_notes');
        expect([t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0, 1, 1]);
        const dir = contDir(s);
        expect([claims(path.join(dir, 'paid-stages')), claims(path.join(dir, 'claude-max-stages'))]).toEqual([['storyboard_review'], ['storyboard']]);
        expect(json(path.join(dir, 'paid-stages', 'storyboard_review.claim.json')).maximumMicroUsd).toBeGreaterThanOrEqual(600000);
        // The planner request: the diagnosis it consumes, the self-check and repair instructions, the larger self-check cap.
        const plannerCall = vi.mocked(t.planner).mock.calls[0][1] as any, input = JSON.parse(plannerCall.input);
        expect(input.priorReviewedStoryboard.diagnosis).toEqual(diagnosis);
        expect(input.priorReviewedStoryboard.storyboard).toEqual(json(path.join(repairDir(s), 'owned_storyboard_draft.json')));
        expect(plannerCall.instructions.endsWith(`\n${VISIBLE_MOMENT_STORYBOARD_ADDENDUM}\n${SELF_CHECK_STORYBOARD_ADDENDUM}\n${REPAIR_STORYBOARD_ADDENDUM}`)).toBe(true);
        expect([plannerCall.maxOutputTokens, plannerCall.context.selfCheckContract]).toEqual([50000, true]);
        const reviewPayload = vi.mocked(t.responses).mock.calls[0][0] as any;
        expect(reviewPayload.instructions).toContain(STORYBOARD_REVIEW_IMPACT_ADDENDUM);
        expect(JSON.parse(reviewPayload.input)).toMatchObject({ selfCheck: { version: 'storyboard-self-check/v1' }, reviewImpact: { version: 'storyboard-review-impact/v1' } });
        // The durable records: the input (held draft + raw review + the repair input as ancestry), the recovery state, the diagnosis, the final state.
        const held = json(path.join(repairDir(s), 'simple-book-result.json'));
        expect(json(path.join(dir, 'storyboard_repair_input.json'))).toEqual({ parentStoryboardDigest: held.storyboard.storyboardDigest,
          draft: json(path.join(repairDir(s), 'owned_storyboard_draft.json')), review: held.storyboard.rawReview,
          parentRepair: json(path.join(repairDir(s), 'storyboard_repair_input.json')), addedContracts: ['selfCheckContract', 'reviewImpactPolicy'] });
        expect(json(path.join(dir, 'recovery-state.json'))).toEqual(plainJson(planned.recoveryRecord));
        expect(json(path.join(dir, 'diagnosis.json'))).toEqual(plainJson(planned.diagnosisRecord));
        expect(json(path.join(dir, 'recovery-final.json'))).toMatchObject({ mode: 'admitted', terminal: 'admitted', consecutiveFailures: 0,
          attempt: { attempt: 3, outcome: 'admitted', disposition: 'review_supported_with_notes', notes: [{ pageNumber: 5 }] } });
        const admission = json(path.join(dir, 'continuation-admission.json'));
        expect(admission.preview.wireDigest).toBe(json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')).wireDigest);
        expect(admission.preview).toEqual(await previewFreshBookStoryboardContinuation(s.config, json(path.join(dir, 'storyboard_repair_input.json'))));
        expect(json(path.join(dir, 'sealed.json'))).toEqual({ status: 'review_supported_with_notes', continued: { parentStoryboardDigest: held.storyboard.storyboardDigest,
          addedContracts: ['selfCheckContract', 'reviewImpactPolicy'] }, replayed: REPLAYED, runtimeEligible: false });
        const result = json(path.join(dir, 'simple-book-result.json'));
        expect(result.storyboard.storyboard).toMatchObject({ selfCheck: { version: 'storyboard-self-check/v1' }, reviewImpact: 'storyboard-review-impact/v1',
          repair: { parentStoryboardDigest: held.storyboard.storyboardDigest } });
        expect(result.source.manuscript).toEqual(held.source.manuscript);
        expect(json(path.join(s.authority, CONT.successorName))).toMatchObject({ grantSha256: g.grantSha, disposition: 'review_supported_with_notes', notes: 1,
          parentStoryboardDigest: held.storyboard.storyboardDigest, recoveryStateSha256: planned.grantDraft.recovery.stateSha256 });
        expect(out.ledger.stages.map(x => [x.name, x.calls])).toEqual([['text', 2], ['text-recovery', 2], ['storyboard-repair', 1], ['storyboard-continuation', 1],
          ['child', 0], ['audition', 0]]);
        expect(s.frozenLine()).toEqual(before);
        // Once only; the earlier lines stay closed; downstream runs only on this line.
        await expect(runFreshBookStoryboardContinuation({ ...g, transports: transports(typedReview()) })).rejects.toThrow(/fresh_book_storyboard_continuation_(used|grant)|fresh_book_roots_changed/);
        await expect(runFreshBookStoryboardContinuation({ ...s.continuationGrant('relabelled.json'), transports: transports(typedReview()) }))
          .rejects.toThrow('fresh_book_storyboard_continuation_used');
        providers();
        await expect(runFreshBookChild({ ...g, storyboardRepair: true })).rejects.toThrow('fresh_book_storyboard_repair_grant');
        expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
        expect(await runFreshBookChild({ ...g, storyboardContinuation: true })).toMatchObject({ status: 'child_reference_passed' });
        expect(json(path.join(s.config.bookDir, 'book-layout.json')).storyboardDir).toBe(CONT.folder);
        const book = await runFreshBookBook({ ...g, storyboardContinuation: true });
        expect(book.status).toBe('complete');
        expect(book.ledger.stages.map(x => x.name)).toEqual(['text', 'text-recovery', 'storyboard-repair', 'storyboard-continuation', 'child', 'audition']);
        // The audition grant carries the engine's page recovery rule; every page packet carries the review's bound notes.
        const auditionGrant = json(path.join(s.config.bookDir, 'audition.grant.json'));
        expect([auditionGrant.scope.recovery, auditionGrant.experiment.claimSha256]).toEqual(['stage-recovery/v1', sha(readFileSync(path.join(s.authority, CONT.claimName)))]);
        expect(json(path.join(s.config.bookDir, 'audition', 'admission.json')).recovery).toBe('stage-recovery/v1');
        expect(json(path.join(s.authority, CONT.outcomeName)).status).toBe('complete');
        expect(s.frozenLine()).toEqual(before);
      });

      it('held again: the stage ceiling is reached (stop_allowance_exhausted); no further planner or review; no child', async () => {
        const s = await heldRepairBook(), before = s.frozenLine(), g = s.continuationGrant();
        const story = typedReview(r => { r.frames[4].checks[0] = { ...r.frames[4].checks[0], verdict: 'contradiction', observation: 'the causal action is omitted',
          issues: [{ impact: 'story', ref: 'p4', note: 'the causal action is omitted', whyNotMaterial: '' }] }; });
        const t = transports(story);
        expect((await runFreshBookStoryboardContinuation({ ...g, transports: t })).status).toBe('held_contradiction');
        expect([t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([1, 1]);
        expect(json(path.join(s.authority, CONT.outcomeName))).toMatchObject({ status: 'held_storyboard_continuation', textStatus: 'held_contradiction',
          recovery: 'stop_allowance_exhausted' });
        expect(json(path.join(contDir(s), 'recovery-final.json'))).toMatchObject({ mode: 'stop_allowance_exhausted', remaining: 0, consecutiveFailures: 3,
          terminal: 'stop_allowance_exhausted', attempt: { attempt: 3, outcome: 'held' } });
        expect(existsSync(path.join(s.authority, CONT.successorName))).toBe(false);
        const t2 = transports(typedReview());
        await expect(runFreshBookStoryboardContinuation({ ...s.continuationGrant('again.json'), transports: t2 })).rejects.toThrow('fresh_book_storyboard_continuation_used');
        expect([t2.planner, t2.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0]);
        providers();
        await expect(runFreshBookChild({ ...g, storyboardContinuation: true })).rejects.toThrow('fresh_book_stage_not_passed');
        expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
        expect(s.frozenLine()).toEqual(before);
      });

      it('immutable lineage: a changed held repair draft/review/outcome, a repair successor, an unknown cost, a head, grant or ancestor byte refuse BEFORE the claim or any call', async () => {
        const edit = (file: string, change: (x: any) => void) => { const x = json(file); change(x); writeFileSync(file, JSON.stringify(x)); };
        type H = Awaited<ReturnType<typeof heldRepairBook>>;
        const cases: Record<string, (s: H) => { grant?: ReturnType<H['continuationGrant']>; expect: RegExp }> = {
          'held repair draft changed': s => { const g = s.continuationGrant(); edit(path.join(repairDir(s), 'owned_storyboard_draft.json'), d => { d.plan.pages[2].composition += ' x'; });
            return { grant: g, expect: /fresh_book_storyboard_continuation_(repair|grant)/ }; },
          'paid repair review answer changed': s => { const g = s.continuationGrant();
            edit(path.join(repairDir(s), 'paid-stages', 'storyboard_review.receipt.json'), r => { const a = JSON.parse(r.raw.output_text);
              const k = Object.keys(a.frames[4])[2]; a.frames[4][k].observation += ' (reworded)'; r.raw.output_text = JSON.stringify(a); });
            return { grant: g, expect: /fresh_book_storyboard_continuation_(repair|grant)/ }; },
          'repair outcome not held': s => { const g = s.continuationGrant(); edit(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.outcomeName), o => { o.status = 'complete'; });
            return { grant: g, expect: /fresh_book_storyboard_continuation_repair/ }; },
          'a repair successor appeared': s => { const g = s.continuationGrant(); writeFileSync(path.join(s.authority, FRESH_BOOK_STORYBOARD_REPAIR.successorName), '{}');
            return { grant: g, expect: /fresh_book_storyboard_continuation_repair/ }; },
          'repair input changed': s => { const g = s.continuationGrant(); edit(path.join(repairDir(s), 'storyboard_repair_input.json'), r => { r.review.frames[7].checks[0].observation += ' x'; });
            return { grant: g, expect: /fresh_book_storyboard_continuation_(repair|grant)/ }; },
          'unknown cost in the repair planner record': s => { const g = s.continuationGrant();
            edit(path.join(repairDir(s), 'claude-max-stages', 'storyboard.result.json'), r => { r.estimatedMicroUsd = null; });
            return { grant: g, expect: /fresh_book_storyboard_continuation_unknown_cost/ }; },
          'head moved after the grant': s => { const g = s.continuationGrant(); s.setHead('b'.repeat(40)); return { grant: g, expect: /fresh_book_storyboard_continuation_grant|fresh_book_source_changed/ }; },
          'dirty tree': s => { const g = s.continuationGrant(); s.setClean(false); return { grant: g, expect: /fresh_book_source_changed/ }; },
          'grant recovery digest edited': s => { const g = s.continuationGrant(); edit(g.grantFile, x => { x.recovery.diagnosisDigest = 'e'.repeat(64); });
            return { grant: { ...g, grantSha: sha(readFileSync(g.grantFile)) }, expect: /fresh_book_storyboard_continuation_grant/ }; },
          'grant drops a contract': s => { const g = s.continuationGrant(); edit(g.grantFile, x => { x.addedContracts = ['selfCheckContract']; });
            return { grant: { ...g, grantSha: sha(readFileSync(g.grantFile)) }, expect: /fresh_book_storyboard_continuation_grant/ }; },
          'consumed repair grant bytes changed': s => { const g = s.continuationGrant(); writeFileSync(s.repair.grantFile, readFileSync(s.repair.grantFile, 'utf8') + ' ');
            return { grant: g, expect: /fresh_book_storyboard_continuation_(repair|grant)/ }; },
          'consumed recovery grant bytes changed': s => { const g = s.continuationGrant(); writeFileSync(s.recovery.grantFile, readFileSync(s.recovery.grantFile, 'utf8') + ' ');
            return { grant: g, expect: /fresh_book_storyboard_repair_recovery|fresh_book_storyboard_continuation_repair/ }; },
          'original grant byte appended': s => { const g = s.continuationGrant(); writeFileSync(s.original.grantFile, Buffer.concat([readFileSync(s.original.grantFile), Buffer.from(' ')]));
            return { grant: g, expect: /fresh_book_recovery_original/ }; },
        };
        for (const [name, mutate] of Object.entries(cases)) {
          const s = await heldRepairBook(), t = transports(typedReview());
          let c: ReturnType<typeof mutate>;
          try { c = mutate(s); } catch (e) { throw new Error(`${name}: ${e}`); }
          await expect(runFreshBookStoryboardContinuation({ ...c.grant!, transports: t }), name).rejects.toThrow(c.expect);
          expect([name, existsSync(path.join(s.authority, CONT.claimName)), existsSync(contDir(s)),
            ...[t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)]).toEqual([name, false, false, 0, 0, 0, 0]);
        }
        // The balance must cover the review's floor before the claim (the same F6 rule, its own code).
        expect(() => assertReviewFloorFits({ bookKnownMicroUsd: 6_400_001, nextCapMicroUsd: 7_000_000 }, 'fresh_book_storyboard_continuation_budget'))
          .toThrow('fresh_book_storyboard_continuation_budget');
      });

      it('a changed continuation successor (planner output, recovery record, diagnosis) refuses the child BEFORE its folder, key or render', async () => {
        for (const kind of ['planner_output', 'recovery_state', 'diagnosis', 'recovery_final']) {
          const s = await heldRepairBook(), g = s.continuationGrant();
          await runFreshBookStoryboardContinuation({ ...g, transports: transports(typedReview()) });
          const dir = contDir(s), write = (file: string, change: (x: any) => void) => { const x = json(file); change(x); writeFileSync(file, JSON.stringify(x)); };
          if (kind === 'planner_output') write(path.join(dir, 'claude-max-stages', 'storyboard.receipt.json'), r => { r.output.plan.pages[2].composition += ' changed'; });
          else if (kind === 'recovery_state') write(path.join(dir, 'recovery-state.json'), r => { r.consecutiveFailures = 0; });
          else if (kind === 'diagnosis') write(path.join(dir, 'diagnosis.json'), r => { r.diagnosis.findings.pop(); });
          else write(path.join(dir, 'recovery-final.json'), r => { r.terminal = 'stop_allowance_exhausted'; });
          providers();
          await expect(runFreshBookChild({ ...g, storyboardContinuation: true }), kind).rejects.toThrow('fresh_book_storyboard_continuation_successor');
          expect([kind, vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length, existsSync(path.join(s.config.bookDir, 'child'))])
            .toEqual([kind, 0, 0, false]);
          vi.restoreAllMocks();
        }
      });

      describe('the bound revalidation (the continuation\'s paid answer, refused at compile by a short book-level section name before its review)', () => {
        const REVAL = FRESH_BOOK_STORYBOARD_REVALIDATION;
        const revalDir = (s: { config: FreshBookConfig }) => path.join(s.config.bookDir, REVAL.folder);
        const BORROWED = 'storyboard-continuation/claude-max-stages/storyboard';
        /**
         * The continuation's planner as the actual one answered: besides the diagnosed pages it changes a book-level section (a prop's design)
         * for the book finding and names it `book:recurringProps`, the v1 instruction's own short form, which the strict v1 check does not resolve.
         * Its CLI output carries the provider-shaped answer; the receipt's output is that answer decoded (as the native transport records it).
         */
        const shortNamePlanner = () => vi.fn(async (_w: any, call: any) => {
          const input = JSON.parse(call.input), prior = input.priorReviewedStoryboard, diagnosis = prior.diagnosis;
          const draft = structuredClone(prior.storyboard), bookPage = [1, 2, 3, 4, 5, 6, 7, 8].find(n => !diagnosis.protectedPages.includes(n))!;
          const pages = new Set<number>(diagnosis.findings.map((f: any) => f.key.startsWith('page:') ? Number(f.key.split(':')[1]) : bookPage));
          for (const n of pages) draft.plan.pages[n].composition += ' (re-planned after the diagnosis)';
          draft.plan.recurringProps[0].design += ', knotted twice';
          const texts = [input.story.title, ...input.story.pages.map((p: any) => p.text)];
          const selfCheck = fullSelfCheck(draft, texts, { diagnosis, parentDraft: prior.storyboard }, s => {
            for (const r of s.resolutions) if (r.finding.startsWith('book:')) r.changed = [`p${bookPage}:plan`, 'book:recurringProps']; });
          const strip = ({ pageNumber: _n, ...row }: any) => row;
          const wire = { plan: { ...draft.plan, pages: draft.plan.pages.map(strip), continuity: { ...draft.plan.continuity, pages: draft.plan.continuity.pages.map(strip) } },
            sequence: { ...draft.sequence, pages: draft.sequence.pages.map(strip) }, moments: draft.moments, selfCheck };
          return cliReply(decodePersonalBookProviderOutput(call, wire), .43, wire);
        });
        /** The held repair book, its ONE continuation refused at compile (no review), then a NEW reviewed head for the revalidation. */
        async function refusedBook() {
          const s = await heldRepairBook(), continuation = s.continuationGrant(), t = { ...textTransports({ review: typedReview() }), planner: shortNamePlanner() };
          await expect(runFreshBookStoryboardContinuation({ ...continuation, transports: t })).rejects.toThrow('storyboard_self_check_resolution_changed');
          expect([t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([1, 0]);
          expect(json(path.join(s.authority, CONT.outcomeName))).toMatchObject({ status: 'failed_storyboard_continuation', code: 'storyboard_self_check_resolution_changed' });
          s.setHead('9'.repeat(40));
          const revalidationGrant = async (name = 'revalidation-grant.json') => {
            const g = (await planFreshBookStoryboardRevalidation(s.config, s.env, continuation.grantFile)).grantDraft, file = path.join(s.root, name);
            writeFileSync(file, JSON.stringify(g)); return { ...s.original, grantFile: file, grantSha: sha(readFileSync(file)) }; };
          const frozenRefused = () => ({ ...s.frozenLine(), continuation: tree(contDir(s)), continuationGrant: sha(readFileSync(continuation.grantFile)),
            continuationClaim: sha(readFileSync(path.join(s.authority, CONT.claimName))), continuationOutcome: sha(readFileSync(path.join(s.authority, CONT.outcomeName))) });
          return { ...s, continuation, revalidationGrant, frozenRefused };
        }
        type Refused = Awaited<ReturnType<typeof refusedBook>>;
        const edit = (file: string, change: (x: any) => void) => { const x = json(file); change(x); writeFileSync(file, JSON.stringify(x)); };

        it('positive: NO planner call; the paid answer compiles under the correction; ONE floored review admits with notes; successor; child and book on its line', async () => {
          const s = await refusedBook(), before = s.frozenRefused(), g = await s.revalidationGrant(), t = transports(typedReview(minorNote));
          const planned = await planFreshBookStoryboardRevalidation(s.config, s.env, s.continuation.grantFile);
          const paid = json(path.join(contDir(s), 'claude-max-stages', 'storyboard.receipt.json'));
          expect(planned.grantDraft.candidate.resolvedNames).toEqual([{ from: 'book:recurringProps', to: ['book:plan.recurringProps'] }]);
          expect(planned.grantDraft.continuation).toMatchObject({ grantSha256: s.continuation.grantSha, plannerMaxMicroUsd: 430000,
            plannerWireDigest: json(path.join(contDir(s), 'claude-max-stages', 'storyboard.claim.json')).wireDigest,
            plannerReceiptSha256: sha(readFileSync(path.join(contDir(s), 'claude-max-stages', 'storyboard.receipt.json'))) });
          expect([planned.grantDraft.recovery.attempt, planned.grantDraft.recovery.maxAttempts, planned.grantDraft.compile, planned.grantDraft.allowance])
            .toEqual([3, 3, ['storyboard-self-check-names/v1'], { plannerCalls: 0, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 }]);
          expect([planned.plan.providerCalls, planned.plan.keyRead, planned.state.claimExists, planned.state.folderExists]).toEqual([0, false, false, false]);
          // Deterministic: the same saved evidence plans the same grant.
          expect((await planFreshBookStoryboardRevalidation(s.config, s.env, s.continuation.grantFile)).grantDraft).toEqual(planned.grantDraft);
          const out = await runFreshBookStoryboardRevalidation({ ...g, transports: t });
          expect(out.status).toBe('review_supported_with_notes');
          // The paid answer is replayed (never re-sent): no author, editor, reader, correction or planner callback; exactly the ONE review.
          expect([t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0, 0, 1]);
          const dir = revalDir(s);
          expect([claims(path.join(dir, 'paid-stages')), existsSync(path.join(dir, 'claude-max-stages'))]).toEqual([['storyboard_review'], false]);
          expect(json(path.join(dir, 'paid-stages', 'storyboard_review.claim.json')).maximumMicroUsd).toBeGreaterThanOrEqual(600000);
          // The review reads the engine's own section names; the draft is exactly the continuation's paid answer; the book carries the marker.
          const reviewInput = JSON.parse((vi.mocked(t.responses).mock.calls[0][0] as any).input);
          expect(reviewInput.selfCheck.resolutions.flatMap((r: any) => r.changed)).toContain('book:plan.recurringProps');
          expect(reviewInput.selfCheck.resolutions.flatMap((r: any) => r.changed)).not.toContain('book:recurringProps');
          expect(json(path.join(dir, 'owned_storyboard_draft.json'))).toEqual(paid.output);
          const result = json(path.join(dir, 'simple-book-result.json'));
          expect(result.storyboard.storyboard).toMatchObject({ selfCheckNames: 'storyboard-self-check-names/v1', storyboardDigest: planned.grantDraft.candidate.storyboardDigest });
          expect(json(path.join(dir, 'storyboard_repair_input.json'))).toEqual(json(path.join(contDir(s), 'storyboard_repair_input.json')));
          const admission = json(path.join(dir, 'revalidation-admission.json'));
          expect(admission.preview).toEqual(await previewFreshBookStoryboardRevalidation(s.config, json(path.join(dir, 'storyboard_repair_input.json'))));
          expect(admission.preview.payloadDigest).toBe(json(path.join(dir, 'paid-stages', 'storyboard_review.claim.json')).wireDigest);
          expect(json(path.join(dir, 'sealed.json'))).toEqual({ status: 'review_supported_with_notes', revalidated: { continuationGrantSha256: s.continuation.grantSha,
            plannerWireDigest: planned.grantDraft.continuation.plannerWireDigest, candidateStoryboardDigest: planned.grantDraft.candidate.storyboardDigest,
            compile: ['storyboard-self-check-names/v1'] }, replayed: [...REPLAYED, BORROWED], runtimeEligible: false });
          expect(json(path.join(dir, 'recovery-final.json'))).toMatchObject({ terminal: 'admitted', stateSha256AtAdmission: planned.grantDraft.recovery.stateSha256,
            attempt: { attempt: 3, line: REVAL.folder, outcome: 'admitted', disposition: 'review_supported_with_notes', notes: [{ pageNumber: 5 }] } });
          expect(json(path.join(s.authority, REVAL.successorName))).toMatchObject({ grantSha256: g.grantSha, disposition: 'review_supported_with_notes', notes: 1,
            continuationClaimSha256: sha(readFileSync(path.join(s.authority, CONT.claimName))), storyboardDigest: planned.grantDraft.candidate.storyboardDigest });
          expect(out.ledger.stages.map(x => [x.name, x.calls])).toEqual([['text', 2], ['text-recovery', 2], ['storyboard-repair', 1], ['storyboard-continuation', 0],
            ['storyboard-revalidation', 1], ['child', 0], ['audition', 0]]);
          // Every earlier record, answer and cost is byte-identical (the refused continuation is evidence, never rewritten).
          expect(s.frozenRefused()).toEqual(before);
          // Once only; the refused continuation's line stays closed; downstream runs only on this line.
          await expect(runFreshBookStoryboardRevalidation({ ...g, transports: transports(typedReview()) })).rejects.toThrow(/fresh_book_storyboard_revalidation_(used|grant)|fresh_book_roots_changed/);
          await expect(runFreshBookStoryboardRevalidation({ ...(await s.revalidationGrant('relabelled.json')), transports: transports(typedReview()) }))
            .rejects.toThrow('fresh_book_storyboard_revalidation_used');
          providers();
          await expect(runFreshBookChild({ ...s.continuation, storyboardContinuation: true })).rejects.toThrow(/fresh_book_stage_not_passed|fresh_book_storyboard_continuation_grant|fresh_book_source_changed/);
          await expect(runFreshBookChild({ ...g, storyboardContinuation: true })).rejects.toThrow('fresh_book_storyboard_continuation_grant');
          expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
          expect(await runFreshBookChild({ ...g, storyboardRevalidation: true })).toMatchObject({ status: 'child_reference_passed' });
          expect(json(path.join(s.config.bookDir, 'book-layout.json')).storyboardDir).toBe(REVAL.folder);
          const book = await runFreshBookBook({ ...g, storyboardRevalidation: true });
          expect(book.status).toBe('complete');
          expect(book.ledger.stages.map(x => x.name)).toEqual(['text', 'text-recovery', 'storyboard-repair', 'storyboard-continuation', 'storyboard-revalidation', 'child', 'audition']);
          const auditionGrant = json(path.join(s.config.bookDir, 'audition.grant.json'));
          expect([auditionGrant.scope.recovery, auditionGrant.experiment.claimSha256]).toEqual(['stage-recovery/v1', sha(readFileSync(path.join(s.authority, REVAL.claimName)))]);
          expect(json(path.join(s.authority, REVAL.outcomeName)).status).toBe('complete');
          // The loader binds the marker from the saved book only: an unknown one is refused, absent stays strict.
          expect([savedSelfCheckNames(undefined), savedSelfCheckNames({}), savedSelfCheckNames({ selfCheckNames: 'storyboard-self-check-names/v1' })])
            .toEqual([undefined, undefined, { selfCheckNames: true }]);
          expect(() => savedSelfCheckNames({ selfCheckNames: 'storyboard-self-check-names/v2' })).toThrow('audition_board_binding');
          expect(s.frozenRefused()).toEqual(before);
        });

        it('held by its review: the stage ceiling is reached (stop_allowance_exhausted); no planner call, no second review, no child', async () => {
          const s = await refusedBook(), before = s.frozenRefused(), g = await s.revalidationGrant();
          const t = transports(typedReview(r => { r.frames[4].checks[0] = { ...r.frames[4].checks[0], verdict: 'contradiction', observation: 'the causal action is omitted',
            issues: [{ impact: 'story', ref: 'p4', note: 'the causal action is omitted', whyNotMaterial: '' }] }; }));
          expect((await runFreshBookStoryboardRevalidation({ ...g, transports: t })).status).toBe('held_contradiction');
          expect([t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 1]);
          expect(json(path.join(s.authority, REVAL.outcomeName))).toMatchObject({ status: 'held_storyboard_revalidation', textStatus: 'held_contradiction',
            recovery: 'stop_allowance_exhausted' });
          expect(json(path.join(revalDir(s), 'recovery-final.json'))).toMatchObject({ terminal: 'stop_allowance_exhausted', remaining: 0, attempt: { attempt: 3, outcome: 'held' } });
          expect(existsSync(path.join(s.authority, REVAL.successorName))).toBe(false);
          const t2 = transports(typedReview());
          await expect(runFreshBookStoryboardRevalidation({ ...(await s.revalidationGrant('again.json')), transports: t2 })).rejects.toThrow('fresh_book_storyboard_revalidation_used');
          expect([t2.planner, t2.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0]);
          providers();
          await expect(runFreshBookChild({ ...g, storyboardRevalidation: true })).rejects.toThrow('fresh_book_stage_not_passed');
          expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
          expect(s.frozenRefused()).toEqual(before);
        });

        it('stands only on THIS refusal of THIS paid answer: any other failure, a review spent, a changed answer, record, grant or head refuses BEFORE the claim or any call', async () => {
          const cont = (s: Refused, ...p: string[]) => path.join(contDir(s), ...p);
          const cases: Record<string, (s: Refused) => Promise<{ grant: Awaited<ReturnType<Refused['revalidationGrant']>>; expect: RegExp }>> = {
            'another failure code': async s => { const g = await s.revalidationGrant(); edit(path.join(s.authority, CONT.outcomeName), o => { o.code = 'storyboard_self_check_claim_quote'; });
              return { grant: g, expect: /fresh_book_storyboard_revalidation_(continuation|grant)/ }; },
            'the continuation seal says another failure': async s => { const g = await s.revalidationGrant(); edit(cont(s, 'sealed.json'), x => { x.code = 'fresh_book_provider_transport'; });
              return { grant: g, expect: /fresh_book_storyboard_revalidation_(continuation|grant)/ }; },
            'a continuation review was claimed': async s => { const g = await s.revalidationGrant(); writeFileSync(cont(s, 'paid-stages', 'storyboard_review.claim.json'), '{}');
              return { grant: g, expect: /fresh_book_storyboard_revalidation_(continuation|grant)|fresh_book_ledger/ }; },
            'a continuation successor appeared': async s => { const g = await s.revalidationGrant(); writeFileSync(path.join(s.authority, CONT.successorName), '{}');
              return { grant: g, expect: /fresh_book_storyboard_revalidation_continuation/ }; },
            'a continuation terminal recovery record appeared': async s => { const g = await s.revalidationGrant(); writeFileSync(cont(s, 'recovery-final.json'), '{}');
              return { grant: g, expect: /fresh_book_storyboard_revalidation_continuation/ }; },
            'the paid answer (decoded output) changed': async s => { const g = await s.revalidationGrant();
              edit(cont(s, 'claude-max-stages', 'storyboard.receipt.json'), r => { r.output.plan.pages[2].composition += ' changed'; });
              return { grant: g, expect: /fresh_book_storyboard_(revalidation_continuation|revalidation_grant|repair_replay)/ }; },
            'the paid planner wire changed': async s => { const g = await s.revalidationGrant(); edit(cont(s, 'claude-max-stages', 'storyboard.wire.json'), w => { w.bytes += 1; });
              return { grant: g, expect: /fresh_book_storyboard_revalidation_(continuation|grant)/ }; },
            'the continuation input changed': async s => { const g = await s.revalidationGrant();
              edit(cont(s, 'storyboard_repair_input.json'), r => { r.review.frames[4].checks[2].observation += ' x'; });
              return { grant: g, expect: /fresh_book_storyboard_(revalidation_continuation|revalidation_grant|continuation_repair)/ }; },
            'consumed continuation grant bytes changed': async s => { const g = await s.revalidationGrant();
              writeFileSync(s.continuation.grantFile, readFileSync(s.continuation.grantFile, 'utf8') + ' ');
              return { grant: g, expect: /fresh_book_storyboard_revalidation_continuation/ }; },
            'grant names another correction': async s => { const g = await s.revalidationGrant();
              edit(g.grantFile, x => { x.candidate.resolvedNames[0].to = ['book:plan.locations']; });
              return { grant: { ...g, grantSha: sha(readFileSync(g.grantFile)) }, expect: /fresh_book_storyboard_revalidation_grant/ }; },
            'grant allows a planner call': async s => { const g = await s.revalidationGrant(); edit(g.grantFile, x => { x.allowance.plannerCalls = 1; });
              return { grant: { ...g, grantSha: sha(readFileSync(g.grantFile)) }, expect: /fresh_book_storyboard_revalidation_grant/ }; },
            'grant without the compile correction': async s => { const g = await s.revalidationGrant(); edit(g.grantFile, x => { x.compile = []; });
              return { grant: { ...g, grantSha: sha(readFileSync(g.grantFile)) }, expect: /fresh_book_storyboard_revalidation_grant/ }; },
            'head moved after the grant': async s => { const g = await s.revalidationGrant(); s.setHead('8'.repeat(40));
              return { grant: g, expect: /fresh_book_storyboard_revalidation_grant|fresh_book_source_changed/ }; },
            'dirty tree': async s => { const g = await s.revalidationGrant(); s.setClean(false); return { grant: g, expect: /fresh_book_source_changed/ }; },
          };
          for (const [name, mutate] of Object.entries(cases)) {
            const s = await refusedBook(), t = transports(typedReview());
            let c: Awaited<ReturnType<typeof mutate>>;
            try { c = await mutate(s); } catch (e) { throw new Error(`${name}: ${e}`); }
            await expect(runFreshBookStoryboardRevalidation({ ...c.grant, transports: t }), name).rejects.toThrow(c.expect);
            expect([name, existsSync(path.join(s.authority, REVAL.claimName)), existsSync(revalDir(s)),
              ...[t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)]).toEqual([name, false, false, 0, 0, 0, 0]);
          }
          // The CLI output is the authority for the paid answer: a re-planned grant over an edited structured answer refuses at the preview, before the claim.
          const s = await refusedBook(), t = transports(typedReview());
          edit(path.join(contDir(s), 'claude-max-stages', 'storyboard.receipt.json'), r => { const out = JSON.parse(r.raw.stdout);
            out.structured_output.plan.pages[2].composition += ' changed'; r.raw.stdout = JSON.stringify(out); });
          await expect(runFreshBookStoryboardRevalidation({ ...(await s.revalidationGrant()), transports: t })).rejects.toThrow('fresh_book_storyboard_repair_replay');
          expect([existsSync(path.join(s.authority, REVAL.claimName)), existsSync(revalDir(s)), vi.mocked(t.responses).mock.calls.length]).toEqual([false, false, 0]);
          // The balance must cover the review's floor before the claim (the same F6 rule, its own code).
          expect(() => assertReviewFloorFits({ bookKnownMicroUsd: 6_400_001, nextCapMicroUsd: 7_000_000 }, 'fresh_book_storyboard_revalidation_budget'))
            .toThrow('fresh_book_storyboard_revalidation_budget');
        }, 900_000);  // fifteen whole refused chains (text, recovery, repair, continuation), each built from scratch

        it('a changed revalidation successor (its draft, its terminal record) or a changed borrowed answer refuses the child BEFORE its folder, key or render', async () => {
          for (const kind of ['draft', 'recovery_final', 'borrowed_answer']) {
            const s = await refusedBook(), g = await s.revalidationGrant();
            await runFreshBookStoryboardRevalidation({ ...g, transports: transports(typedReview()) });
            if (kind === 'draft') edit(path.join(revalDir(s), 'owned_storyboard_draft.json'), d => { d.plan.pages[2].composition += ' changed'; });
            else if (kind === 'recovery_final') edit(path.join(revalDir(s), 'recovery-final.json'), r => { r.terminal = 'stop_allowance_exhausted'; });
            else edit(path.join(contDir(s), 'claude-max-stages', 'storyboard.receipt.json'), r => { r.output.plan.pages[2].composition += ' changed'; });
            providers();
            await expect(runFreshBookChild({ ...g, storyboardRevalidation: true }), kind)
              .rejects.toThrow(/fresh_book_storyboard_revalidation_(successor|grant|continuation)/);
            expect([kind, vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length, existsSync(path.join(s.config.bookDir, 'child'))])
              .toEqual([kind, 0, 0, false]);
            vi.restoreAllMocks();
          }
        });

        describe('the ONE owner-approved extension (attempt 4 of 4 under the claim basis, after the revalidation\'s own review held it)', () => {
          const EXTL = FRESH_BOOK_STORYBOARD_EXTENSION;
          const extDir = (s: { config: FreshBookConfig }) => path.join(s.config.bookDir, EXTL.folder);
          /** The revalidation's own review holds its candidate (page 4's causal action omitted) at the base ceiling. */
          const heldRevalidation = typedReview(r => { r.frames[4].checks[0] = { ...r.frames[4].checks[0], verdict: 'contradiction', observation: 'the causal action is omitted',
            issues: [{ impact: 'story', ref: 'p4', note: 'the causal action is omitted', whyNotMaterial: '' }] }; });
          /** The claim-basis review: every check lists its issues, every issue its citation (empty unless `change` gives one). */
          const basisReview = (change: (r: any) => void = () => {}) => (r: any) => {
            const all = () => [...r.bookChecks, ...r.frames.flatMap((x: any) => x.checks)];
            for (const c of all()) c.issues = [];
            change(r);
            for (const c of all()) c.issues = c.issues.map((i: any) => ({ citation: '', ...i }));
            return r;
          };
          /** Page 3's narrow requirement quote, bound by the review to that page's whole first sentence: a verified citation note. */
          const citationNote = (r: any) => { r.frames[3].checks[0] = { ...r.frames[3].checks[0], verdict: 'uncertain', observation: 'the requirement quote alone is narrow',
            issues: [{ impact: 'evidence', ref: 'p3:requirement:0', note: 'the quote names only the carrying', citation: 'p3:s1',
              whyNotMaterial: 'that sentence states the whole requirement: they leave the hut carrying the ribbon' }] }; };
          /**
           * The extension's planner: it reads its own request (the held attempt-3 draft without its self-check, every finding with its typed issues,
           * the diagnosis under the owner's ceiling), adopts the contract's shape, re-plans the diagnosed pages, binds a narrow requirement on page 3,
           * and returns the whole storyboard with a full self-check measured on the contract's neutral view (as the compiler measures it).
           */
          // Its CLI output carries the provider-shaped answer; the receipt's output is that answer decoded (as the native transport records it).
          const basisPlanner = (change: (draft: any) => void = () => {}) => vi.fn(async (_w: any, call: any) => {
            const input = JSON.parse(call.input), prior = input.priorReviewedStoryboard, diagnosis = prior.diagnosis;
            const draft = structuredClone(prior.storyboard);
            draft.moments.frames = draft.moments.frames.map((fr: any) => ({ ...fr, staging: [],
              requirements: fr.requirements.map((q: any) => ({ entityId: null, revealPage: null, ...q })) }));
            const bookPage = [1, 2, 3, 4, 5, 6, 7, 8].find(n => !diagnosis.protectedPages.includes(n))!;
            for (const n of new Set<number>(diagnosis.findings.map((x: any) => x.key.startsWith('page:') ? Number(x.key.split(':')[1]) : bookPage)))
              draft.plan.pages[n].composition += ' (re-planned under the claim basis)';
            draft.moments.frames[3].requirements = [{ kind: 'show', subject: 'the ribbon carried out of the hut', evidence: 'carrying the ribbon', entityId: null, revealPage: null }];
            change(draft);
            const texts = [input.story.title, ...input.story.pages.map((p: any) => p.text)];
            const selfCheck = fullSelfCheck(claimBasisSectionsView(draft), texts, { diagnosis, parentDraft: claimBasisSectionsView(prior.storyboard) });
            const strip = ({ pageNumber: _n, ...row }: any) => row;
            const wire = { plan: { ...draft.plan, pages: draft.plan.pages.map(strip), continuity: { ...draft.plan.continuity, pages: draft.plan.continuity.pages.map(strip) } },
              sequence: { ...draft.sequence, pages: draft.sequence.pages.map(strip) }, moments: draft.moments, selfCheck };
            return cliReply(decodePersonalBookProviderOutput(call, wire), .44, wire);
          });
          /** The refused continuation, its revalidation held by its own review, then a NEW reviewed head and the owner's approval record. */
          async function heldRevalidationBook() {
            const s = await refusedBook(), revalidation = await s.revalidationGrant();
            expect((await runFreshBookStoryboardRevalidation({ ...revalidation, transports: transports(heldRevalidation) })).status).toBe('held_contradiction');
            expect(json(path.join(s.authority, REVAL.outcomeName))).toMatchObject({ status: 'held_storyboard_revalidation', recovery: 'stop_allowance_exhausted' });
            s.setHead('7'.repeat(40));
            const approvalFile = path.join(s.root, 'OWNER-APPROVAL.txt');
            writeFileSync(approvalFile, `Synthetic owner approval record (test only).\n${EXTL.approvalLine}\n`);
            const extensionGrant = async (name = 'extension-grant.json') => {
              const g = (await planFreshBookStoryboardExtension(s.config, s.env, revalidation.grantFile, approvalFile)).grantDraft, file = path.join(s.root, name);
              writeFileSync(file, JSON.stringify(g)); return { ...s.original, grantFile: file, grantSha: sha(readFileSync(file)) }; };
            const frozenHeld = () => ({ ...s.frozenRefused(), revalidation: tree(revalDir(s)), revalidationGrant: sha(readFileSync(revalidation.grantFile)),
              revalidationClaim: sha(readFileSync(path.join(s.authority, REVAL.claimName))), revalidationOutcome: sha(readFileSync(path.join(s.authority, REVAL.outcomeName))),
              approval: sha(readFileSync(approvalFile)) });
            return { ...s, revalidation, approvalFile, extensionGrant, frozenHeld };
          }
          type HeldRevalidation = Awaited<ReturnType<typeof heldRevalidationBook>>;
          const extTransports = (review: (r: any) => any) => ({ ...textTransports({ review }), planner: basisPlanner() });

          it('positive: ONE claim-basis planner and ONE floored typed review (a verified citation note) admit attempt 4; successor; child and book on its line', async () => {
            const s = await heldRevalidationBook(), before = s.frozenHeld(), g = await s.extensionGrant(), t = extTransports(basisReview(citationNote));
            const planned = await planFreshBookStoryboardExtension(s.config, s.env, s.revalidation.grantFile, s.approvalFile);
            expect(planned.grantDraft.ownerApproval).toEqual({ file: path.resolve(s.approvalFile), sha256: sha(readFileSync(s.approvalFile)) });
            expect(planned.grantDraft.recovery).toMatchObject({ attempts: 3, maxAttempts: 4, consecutiveFailures: 3, mode: 'diagnose_and_change_strategy' });
            expect([planned.grantDraft.allowance, planned.grantDraft.addedContracts, planned.grantDraft.compile]).toEqual([{ plannerCalls: 1, apiCalls: 1,
              reviewReserveFloorMicroUsd: 600000 }, ['claimBasisContract'], ['storyboard-self-check-names/v1']]);
            expect(planned.recoveryRecord.attempts.map(a => [a.line, a.disposition])).toEqual([['text-recovery', 'held_uncertain'], ['storyboard-repair', 'held_uncertain'],
              [REVAL.folder, 'held_contradiction']]);
            expect(planned.diagnosisRecord.diagnosis.allowance).toEqual({ nextAttempt: 4, maxAttempts: 4, remainingAfterNext: 0 });
            expect(planned.input).toMatchObject({ addedContracts: ['claimBasisContract'], parentCompile: { selfCheckNames: true },
              extension: { version: 'storyboard-attempt-extension/v1', maxAttempts: 4, approvalSha256: sha(readFileSync(s.approvalFile)) } });
            expect([planned.plan.providerCalls, planned.plan.keyRead, planned.state.claimExists, planned.state.folderExists]).toEqual([0, false, false, false]);
            // Deterministic: the same saved evidence plans the same grant.
            expect((await planFreshBookStoryboardExtension(s.config, s.env, s.revalidation.grantFile, s.approvalFile)).grantDraft).toEqual(planned.grantDraft);
            const out = await runFreshBookStoryboardExtension({ ...g, transports: t });
            expect(out.status).toBe('review_supported_with_notes');
            // Replay only for the text and the correction: exactly one planner session and one review.
            expect([t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0, 1, 1]);
            const dir = extDir(s);
            expect([claims(path.join(dir, 'paid-stages')), claims(path.join(dir, 'claude-max-stages'))]).toEqual([['storyboard_review'], ['storyboard']]);
            expect(json(path.join(dir, 'paid-stages', 'storyboard_review.claim.json')).maximumMicroUsd).toBeGreaterThanOrEqual(600000);
            // The planner's request: the held attempt-3 draft without its own self-check, every finding with its typed issues, the diagnosis under the owner's ceiling.
            const plannerCall = vi.mocked(t.planner).mock.calls[0][1] as any, input = JSON.parse(plannerCall.input);
            const { selfCheck: _own, ...withoutOwn } = json(path.join(revalDir(s), 'owned_storyboard_draft.json'));
            expect(input.priorReviewedStoryboard.storyboard).toEqual(withoutOwn);
            expect(input.priorReviewedStoryboard.reviewFindings).toEqual([{ scope: 'page', pageNumber: 4, category: 'moment', verdict: 'contradiction',
              observation: 'the causal action is omitted', issues: [{ impact: 'story', ref: 'p4', note: 'the causal action is omitted' }] }]);
            expect([input.priorReviewedStoryboard.diagnosis.allowance, 'narrativePlan' in input]).toEqual([{ nextAttempt: 4, maxAttempts: 4, remainingAfterNext: 0 }, false]);
            expect(plannerCall.instructions).toContain(CLAIM_BASIS_STORYBOARD_ADDENDUM);
            expect(plannerCall.context).toMatchObject({ claimBasisContract: true, selfCheckContract: true, drawnInstantContract: true });
            const reviewPayload = vi.mocked(t.responses).mock.calls[0][0] as any;
            expect(reviewPayload.instructions).toContain(CLAIM_BASIS_REVIEW_ADDENDUM);
            expect(JSON.parse(reviewPayload.input)).toMatchObject({ claimBasis: { version: 'storyboard-claim-basis/v1' } });
            // The durable records: the input, the recovery state, the diagnosis, the final state, the admitted preview, the seal, the successor.
            expect(json(path.join(dir, 'storyboard_repair_input.json'))).toEqual(plainJson(planned.input));
            expect(json(path.join(dir, 'recovery-state.json'))).toEqual(plainJson(planned.recoveryRecord));
            expect(json(path.join(dir, 'diagnosis.json'))).toEqual(plainJson(planned.diagnosisRecord));
            expect(json(path.join(dir, 'recovery-final.json'))).toMatchObject({ terminal: 'admitted', attempt: { attempt: 4, line: EXTL.folder, outcome: 'admitted',
              disposition: 'review_supported_with_notes', notes: [{ pageNumber: 3 }] } });
            const admission = json(path.join(dir, EXTENSION_ADMISSION_FILE));
            expect(admission.preview).toEqual(await previewFreshBookStoryboardExtension(s.config, json(path.join(dir, 'storyboard_repair_input.json'))));
            expect(admission.preview.wireDigest).toBe(json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')).wireDigest);
            expect(json(path.join(dir, 'sealed.json'))).toEqual({ status: 'review_supported_with_notes', extended: { parentStoryboardDigest: planned.grantDraft.held.storyboardDigest,
              addedContracts: ['claimBasisContract'], attempt: 4 }, replayed: REPLAYED, runtimeEligible: false });
            const result = json(path.join(dir, 'simple-book-result.json'));
            expect(result.storyboard.storyboard).toMatchObject({ claimBasis: { version: 'storyboard-claim-basis/v1', hiddenOverridesDropped: [] },
              selfCheckNames: 'storyboard-self-check-names/v1', repair: { parentStoryboardDigest: planned.grantDraft.held.storyboardDigest } });
            expect(result.source.manuscript).toEqual(json(path.join(revalDir(s), 'simple-book-result.json')).source.manuscript);
            expect(json(path.join(s.authority, EXTL.successorName))).toMatchObject({ grantSha256: g.grantSha, ownerApprovalSha256: sha(readFileSync(s.approvalFile)),
              disposition: 'review_supported_with_notes', notes: 1, parentStoryboardDigest: planned.grantDraft.held.storyboardDigest,
              revalidationClaimSha256: sha(readFileSync(path.join(s.authority, REVAL.claimName))) });
            expect(out.ledger.stages.map(x => [x.name, x.calls])).toEqual([['text', 2], ['text-recovery', 2], ['storyboard-repair', 1], ['storyboard-continuation', 0],
              ['storyboard-revalidation', 1], [EXTL.folder, 1], ['child', 0], ['audition', 0]]);
            expect(s.frozenHeld()).toEqual(before);
            // Once only; the held revalidation's line stays closed; downstream runs only on this line.
            await expect(runFreshBookStoryboardExtension({ ...g, transports: extTransports(basisReview()) })).rejects.toThrow(/fresh_book_storyboard_extension_(used|grant)|fresh_book_roots_changed/);
            await expect(runFreshBookStoryboardExtension({ ...(await s.extensionGrant('relabelled.json')), transports: extTransports(basisReview()) }))
              .rejects.toThrow('fresh_book_storyboard_extension_used');
            providers();
            await expect(runFreshBookChild({ ...s.revalidation, storyboardRevalidation: true })).rejects.toThrow(/fresh_book_stage_not_passed|fresh_book_storyboard_revalidation_grant|fresh_book_source_changed/);
            await expect(runFreshBookChild({ ...g, storyboardRevalidation: true })).rejects.toThrow('fresh_book_storyboard_revalidation_grant');
            expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
            expect(await runFreshBookChild({ ...g, storyboardExtension: true })).toMatchObject({ status: 'child_reference_passed' });
            expect(json(path.join(s.config.bookDir, 'book-layout.json')).storyboardDir).toBe(EXTL.folder);
            const book = await runFreshBookBook({ ...g, storyboardExtension: true });
            expect(book.status).toBe('complete');
            expect(book.ledger.stages.map(x => x.name)).toEqual(['text', 'text-recovery', 'storyboard-repair', 'storyboard-continuation', 'storyboard-revalidation',
              EXTL.folder, 'child', 'audition']);
            const auditionGrant = json(path.join(s.config.bookDir, 'audition.grant.json'));
            expect([auditionGrant.scope.recovery, auditionGrant.experiment.claimSha256]).toEqual(['stage-recovery/v1', sha(readFileSync(path.join(s.authority, EXTL.claimName)))]);
            expect(json(path.join(s.authority, EXTL.outcomeName)).status).toBe('complete');
            expect(s.frozenHeld()).toEqual(before);
          }, 900_000);

          it('held by its review: the owner\'s ceiling is reached (attempt 4 of 4, stop_allowance_exhausted); no attempt 5; no child', async () => {
            const s = await heldRevalidationBook(), before = s.frozenHeld(), g = await s.extensionGrant();
            const t = extTransports(basisReview(r => { r.frames[4].checks[0] = { ...r.frames[4].checks[0], verdict: 'contradiction',
              observation: 'the causal action is still omitted', issues: [{ impact: 'story', ref: 'p4', note: 'the causal action is still omitted', whyNotMaterial: '' }] }; }));
            expect((await runFreshBookStoryboardExtension({ ...g, transports: t })).status).toBe('held_contradiction');
            expect([t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([1, 1]);
            expect(json(path.join(s.authority, EXTL.outcomeName))).toMatchObject({ status: 'held_storyboard_extension', textStatus: 'held_contradiction',
              recovery: 'stop_allowance_exhausted' });
            expect(json(path.join(extDir(s), 'recovery-final.json'))).toMatchObject({ terminal: 'stop_allowance_exhausted', remaining: 0, consecutiveFailures: 4,
              attempt: { attempt: 4, outcome: 'held' } });
            expect(existsSync(path.join(s.authority, EXTL.successorName))).toBe(false);
            const t2 = extTransports(basisReview());
            await expect(runFreshBookStoryboardExtension({ ...(await s.extensionGrant('again.json')), transports: t2 })).rejects.toThrow('fresh_book_storyboard_extension_used');
            expect([t2.planner, t2.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0]);
            providers();
            await expect(runFreshBookChild({ ...g, storyboardExtension: true })).rejects.toThrow('fresh_book_stage_not_passed');
            expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
            expect(s.frozenHeld()).toEqual(before);
          }, 900_000);

          it('immutable inputs: the owner\'s record, the held revalidation and its lineage, the grant\'s ceiling, contracts or approval, the head or the tree refuse BEFORE the claim or any call', async () => {
            const rev = (s: HeldRevalidation, ...p: string[]) => path.join(revalDir(s), ...p);
            const regrant = <G extends { grantFile: string }>(g: G) => ({ ...g, grantSha: sha(readFileSync(g.grantFile)) });
            const cases: Record<string, (s: HeldRevalidation) => Promise<{ grant: Awaited<ReturnType<HeldRevalidation['extensionGrant']>>; expect: RegExp }>> = {
              'owner record changed': async s => { const g = await s.extensionGrant(); writeFileSync(s.approvalFile, readFileSync(s.approvalFile, 'utf8') + ' ');
                return { grant: g, expect: /fresh_book_storyboard_extension_approval/ }; },
              'revalidation outcome no longer at the ceiling': async s => { const g = await s.extensionGrant();
                edit(path.join(s.authority, REVAL.outcomeName), o => { o.recovery = 'diagnose_and_change_strategy'; });
                return { grant: g, expect: /fresh_book_storyboard_extension_revalidation/ }; },
              'revalidation terminal record changed': async s => { const g = await s.extensionGrant(); edit(rev(s, 'recovery-final.json'), r => { r.remaining = 1; });
                return { grant: g, expect: /fresh_book_storyboard_extension_revalidation/ }; },
              'revalidation review answer changed': async s => { const g = await s.extensionGrant();
                edit(rev(s, 'paid-stages', 'storyboard_review.receipt.json'), r => { const a = JSON.parse(r.raw.output_text), k = Object.keys(a.frames[4])[0];
                  a.frames[4][k].observation += ' (reworded)'; r.raw.output_text = JSON.stringify(a); });
                return { grant: g, expect: /fresh_book_storyboard_extension_revalidation|fresh_book_ledger/ }; },
              'a revalidation successor appeared': async s => { const g = await s.extensionGrant(); writeFileSync(path.join(s.authority, REVAL.successorName), '{}');
                return { grant: g, expect: /fresh_book_storyboard_extension_revalidation/ }; },
              'consumed revalidation grant bytes changed': async s => { const g = await s.extensionGrant();
                writeFileSync(s.revalidation.grantFile, readFileSync(s.revalidation.grantFile, 'utf8') + ' ');
                return { grant: g, expect: /fresh_book_storyboard_extension_revalidation/ }; },
              'consumed continuation grant bytes changed': async s => { const g = await s.extensionGrant();
                writeFileSync(s.continuation.grantFile, readFileSync(s.continuation.grantFile, 'utf8') + ' ');
                return { grant: g, expect: /fresh_book_storyboard_(revalidation_continuation|extension_revalidation)/ }; },
              'unknown cost in the continuation planner record': async s => { const g = await s.extensionGrant();
                edit(path.join(contDir(s), 'claude-max-stages', 'storyboard.result.json'), r => { r.estimatedMicroUsd = null; });
                return { grant: g, expect: /fresh_book_storyboard_(extension_unknown_cost|extension_revalidation|revalidation_continuation)/ }; },
              'grant raises the ceiling': async s => { const g = await s.extensionGrant(); edit(g.grantFile, x => { x.recovery.maxAttempts = 5; });
                return { grant: regrant(g), expect: /fresh_book_storyboard_extension_grant/ }; },
              'grant drops the claim basis': async s => { const g = await s.extensionGrant(); edit(g.grantFile, x => { x.addedContracts = []; });
                return { grant: regrant(g), expect: /fresh_book_storyboard_extension_grant/ }; },
              'grant names another approval': async s => { const g = await s.extensionGrant(); edit(g.grantFile, x => { x.ownerApproval.sha256 = 'e'.repeat(64); });
                return { grant: regrant(g), expect: /fresh_book_storyboard_extension_(approval|grant)/ }; },
              'head moved after the grant': async s => { const g = await s.extensionGrant(); s.setHead('6'.repeat(40));
                return { grant: g, expect: /fresh_book_storyboard_extension_grant|fresh_book_source_changed/ }; },
              'dirty tree': async s => { const g = await s.extensionGrant(); s.setClean(false); return { grant: g, expect: /fresh_book_source_changed/ }; },
            };
            for (const [name, mutate] of Object.entries(cases)) {
              const s = await heldRevalidationBook(), t = extTransports(basisReview());
              let c: Awaited<ReturnType<typeof mutate>>;
              try { c = await mutate(s); } catch (e) { throw new Error(`${name}: ${e}`); }
              await expect(runFreshBookStoryboardExtension({ ...c.grant, transports: t }), name).rejects.toThrow(c.expect);
              expect([name, existsSync(path.join(s.authority, EXTL.claimName)), existsSync(extDir(s)),
                ...[t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)]).toEqual([name, false, false, 0, 0, 0, 0]);
            }
            // The plan itself needs the owner's record by absolute path, with the owner's verbatim line (never a summary of it).
            const s = await heldRevalidationBook(), bare = path.join(s.root, 'NO-LINE.txt');
            writeFileSync(bare, 'A summary of the approval, without its verbatim line.\n');
            await expect(planFreshBookStoryboardExtension(s.config, s.env, s.revalidation.grantFile, bare)).rejects.toThrow('fresh_book_storyboard_extension_approval');
            await expect(planFreshBookStoryboardExtension(s.config, s.env, s.revalidation.grantFile, 'OWNER-APPROVAL.txt')).rejects.toThrow('fresh_book_storyboard_extension_approval');
            // The balance must cover the review's floor before the claim (the same F6 rule, its own code).
            expect(() => assertReviewFloorFits({ bookKnownMicroUsd: 6_400_001, nextCapMicroUsd: 7_000_000 }, 'fresh_book_storyboard_extension_budget'))
              .toThrow('fresh_book_storyboard_extension_budget');
          }, 1_800_000);  // fourteen whole held chains (text, recovery, repair, continuation, revalidation), each built from scratch

          describe('the bound extension revalidation (the extension\'s paid answer, refused at compile by plan-field staging before its review)', () => {
            const XRV = FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION;
            const xrevalDir = (s: { config: FreshBookConfig }) => path.join(s.config.bookDir, XRV.folder);
            const BORROWED_EXT = `${EXTL.folder}/claude-max-stages/storyboard`;
            /** The extension's planner as the actual one answered: it also stages a plan direction field, which the strict v1 check refuses. */
            const fieldStagingPlanner = () => basisPlanner(draft => {
              draft.moments.frames[3].staging = [{ ref: 'p3:childAction', reason: 'the crouch and the laugh are visual direction the text does not state' }]; });
            /** The held revalidation, its ONE extension refused at compile (no review), then a NEW reviewed head for the extension revalidation. */
            async function refusedExtensionBook() {
              const s = await heldRevalidationBook(), extension = await s.extensionGrant(), t = { ...textTransports({ review: basisReview() }), planner: fieldStagingPlanner() };
              await expect(runFreshBookStoryboardExtension({ ...extension, transports: t })).rejects.toThrow('storyboard_claim_basis_staging_ref');
              expect([t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([1, 0]);
              expect(json(path.join(s.authority, EXTL.outcomeName))).toMatchObject({ status: 'failed_storyboard_extension', code: 'storyboard_claim_basis_staging_ref' });
              s.setHead('5'.repeat(40));
              const extensionRevalidationGrant = async (name = 'extension-revalidation-grant.json') => {
                const g = (await planFreshBookStoryboardExtensionRevalidation(s.config, s.env, extension.grantFile)).grantDraft, file = path.join(s.root, name);
                writeFileSync(file, JSON.stringify(g)); return { ...s.original, grantFile: file, grantSha: sha(readFileSync(file)) }; };
              const frozenRefusedExtension = () => ({ ...s.frozenHeld(), extension: tree(extDir(s)), extensionGrant: sha(readFileSync(extension.grantFile)),
                extensionClaim: sha(readFileSync(path.join(s.authority, EXTL.claimName))), extensionOutcome: sha(readFileSync(path.join(s.authority, EXTL.outcomeName))) });
              return { ...s, extension, extensionRevalidationGrant, frozenRefusedExtension };
            }
            type RefusedExtension = Awaited<ReturnType<typeof refusedExtensionBook>>;
            const reviewOnly = (review: (r: any) => any) => ({ ...textTransports({ review }), planner: fieldStagingPlanner() });
            /** A justified detail note on the staged plan field (a bound reference only under the correction). */
            const fieldNote = (r: any) => { r.frames[3].checks[1] = { ...r.frames[3].checks[1], verdict: 'uncertain', observation: 'the crouch is not stated',
              issues: [{ impact: 'detail', ref: 'p3:childAction', note: 'a crouch the text does not state', citation: '',
                whyNotMaterial: 'staged as direction; it fits the comic mistake and changes no event, meaning or identity' }] }; };

            it('positive: NO planner call; the paid answer compiles under the correction; ONE floored review admits with a note on the staged field; successor; child and book on its line', async () => {
              const s = await refusedExtensionBook(), before = s.frozenRefusedExtension(), g = await s.extensionRevalidationGrant(), t = reviewOnly(basisReview(fieldNote));
              const planned = await planFreshBookStoryboardExtensionRevalidation(s.config, s.env, s.extension.grantFile);
              const paid = json(path.join(extDir(s), 'claude-max-stages', 'storyboard.receipt.json'));
              expect(planned.grantDraft.candidate).toMatchObject({ stagedFields: [{ page: 3, ref: 'p3:childAction' }] });
              expect(planned.grantDraft.extension).toMatchObject({ grantSha256: s.extension.grantSha, plannerMaxMicroUsd: 440000,
                plannerWireDigest: json(path.join(extDir(s), 'claude-max-stages', 'storyboard.claim.json')).wireDigest,
                plannerReceiptSha256: sha(readFileSync(path.join(extDir(s), 'claude-max-stages', 'storyboard.receipt.json'))) });
              expect([planned.grantDraft.recovery.attempt, planned.grantDraft.recovery.maxAttempts, planned.grantDraft.compile, planned.grantDraft.allowance,
                planned.grantDraft.ownerApproval.sha256]).toEqual([4, 4, ['storyboard-self-check-names/v1', 'storyboard-claim-basis-staging-fields/v1'],
                { plannerCalls: 0, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 }, sha(readFileSync(s.approvalFile))]);
              expect([planned.plan.providerCalls, planned.plan.keyRead, planned.state.claimExists, planned.state.folderExists]).toEqual([0, false, false, false]);
              // Deterministic: the same saved evidence plans the same grant.
              expect((await planFreshBookStoryboardExtensionRevalidation(s.config, s.env, s.extension.grantFile)).grantDraft).toEqual(planned.grantDraft);
              const out = await runFreshBookStoryboardExtensionRevalidation({ ...g, transports: t });
              expect(out.status).toBe('review_supported_with_notes');
              // The paid answer is replayed (never re-sent): no author, editor, reader, correction or planner callback; exactly the ONE review.
              expect([t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0, 0, 1]);
              const dir = xrevalDir(s);
              expect([claims(path.join(dir, 'paid-stages')), existsSync(path.join(dir, 'claude-max-stages'))]).toEqual([['storyboard_review'], false]);
              expect(json(path.join(dir, 'paid-stages', 'storyboard_review.claim.json')).maximumMicroUsd).toBeGreaterThanOrEqual(600000);
              // The review reads the rule and may cite the staged field; the draft is exactly the extension's paid answer; the book carries both markers.
              const reviewPayload = vi.mocked(t.responses).mock.calls[0][0] as any;
              expect(reviewPayload.instructions).toContain(`\n${CLAIM_BASIS_STAGING_FIELDS_REVIEW_RULE}`);
              expect(JSON.parse(reviewPayload.input).reviewImpact.reviewRefs).toContain('p3:childAction');
              expect(json(path.join(dir, 'owned_storyboard_draft.json'))).toEqual(paid.output);
              const result = json(path.join(dir, 'simple-book-result.json'));
              expect(result.storyboard.storyboard).toMatchObject({ stagingFields: 'storyboard-claim-basis-staging-fields/v1', selfCheckNames: 'storyboard-self-check-names/v1',
                storyboardDigest: planned.grantDraft.candidate.storyboardDigest });
              expect(json(path.join(dir, 'storyboard_repair_input.json'))).toEqual(json(path.join(extDir(s), 'storyboard_repair_input.json')));
              const admission = json(path.join(dir, EXTENSION_REVALIDATION_ADMISSION_FILE));
              expect(admission.preview).toEqual(await previewFreshBookStoryboardExtensionRevalidation(s.config, json(path.join(dir, 'storyboard_repair_input.json'))));
              expect(admission.preview.payloadDigest).toBe(json(path.join(dir, 'paid-stages', 'storyboard_review.claim.json')).wireDigest);
              expect(json(path.join(dir, 'sealed.json'))).toEqual({ status: 'review_supported_with_notes', extensionRevalidated: { extensionGrantSha256: s.extension.grantSha,
                plannerWireDigest: planned.grantDraft.extension.plannerWireDigest, candidateStoryboardDigest: planned.grantDraft.candidate.storyboardDigest,
                compile: ['storyboard-self-check-names/v1', 'storyboard-claim-basis-staging-fields/v1'] }, replayed: [...REPLAYED, BORROWED_EXT], runtimeEligible: false });
              expect(json(path.join(dir, 'recovery-final.json'))).toMatchObject({ terminal: 'admitted', stateSha256AtAdmission: planned.grantDraft.recovery.stateSha256,
                attempt: { attempt: 4, line: XRV.folder, outcome: 'admitted', disposition: 'review_supported_with_notes', notes: [{ pageNumber: 3 }] } });
              expect(json(path.join(s.authority, XRV.successorName))).toMatchObject({ grantSha256: g.grantSha, disposition: 'review_supported_with_notes', notes: 1,
                extensionClaimSha256: sha(readFileSync(path.join(s.authority, EXTL.claimName))), storyboardDigest: planned.grantDraft.candidate.storyboardDigest });
              expect(out.ledger.stages.map(x => [x.name, x.calls])).toEqual([['text', 2], ['text-recovery', 2], ['storyboard-repair', 1], ['storyboard-continuation', 0],
                ['storyboard-revalidation', 1], [EXTL.folder, 0], [XRV.folder, 1], ['child', 0], ['audition', 0]]);
              // Every earlier record, answer and cost is byte-identical (the refused extension is evidence, never rewritten).
              expect(s.frozenRefusedExtension()).toEqual(before);
              // Once only; the refused extension's line stays closed; downstream runs only on this line.
              await expect(runFreshBookStoryboardExtensionRevalidation({ ...g, transports: reviewOnly(basisReview()) }))
                .rejects.toThrow(/fresh_book_storyboard_extension_revalidation_(used|grant)|fresh_book_roots_changed/);
              await expect(runFreshBookStoryboardExtensionRevalidation({ ...(await s.extensionRevalidationGrant('relabelled.json')), transports: reviewOnly(basisReview()) }))
                .rejects.toThrow('fresh_book_storyboard_extension_revalidation_used');
              providers();
              await expect(runFreshBookChild({ ...s.extension, storyboardExtension: true })).rejects.toThrow(/fresh_book_stage_not_passed|fresh_book_storyboard_extension_grant|fresh_book_source_changed/);
              await expect(runFreshBookChild({ ...g, storyboardExtension: true })).rejects.toThrow('fresh_book_storyboard_extension_grant');
              expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
              expect(await runFreshBookChild({ ...g, storyboardExtensionRevalidation: true })).toMatchObject({ status: 'child_reference_passed' });
              expect(json(path.join(s.config.bookDir, 'book-layout.json')).storyboardDir).toBe(XRV.folder);
              const book = await runFreshBookBook({ ...g, storyboardExtensionRevalidation: true });
              expect(book.status).toBe('complete');
              expect(book.ledger.stages.map(x => x.name)).toEqual(['text', 'text-recovery', 'storyboard-repair', 'storyboard-continuation', 'storyboard-revalidation',
                EXTL.folder, XRV.folder, 'child', 'audition']);
              const auditionGrant = json(path.join(s.config.bookDir, 'audition.grant.json'));
              expect([auditionGrant.scope.recovery, auditionGrant.experiment.claimSha256]).toEqual(['stage-recovery/v1', sha(readFileSync(path.join(s.authority, XRV.claimName)))]);
              expect(json(path.join(s.authority, XRV.outcomeName)).status).toBe('complete');
              expect(s.frozenRefusedExtension()).toEqual(before);
            }, 900_000);

            it('held by its review: attempt 4 of 4 ends the line (stop_allowance_exhausted); no planner call, no second review, no child', async () => {
              const s = await refusedExtensionBook(), before = s.frozenRefusedExtension(), g = await s.extensionRevalidationGrant();
              const t = reviewOnly(basisReview(r => { r.frames[4].checks[0] = { ...r.frames[4].checks[0], verdict: 'contradiction', observation: 'the causal action is still omitted',
                issues: [{ impact: 'story', ref: 'p4', note: 'the causal action is still omitted', whyNotMaterial: '' }] }; }));
              expect((await runFreshBookStoryboardExtensionRevalidation({ ...g, transports: t })).status).toBe('held_contradiction');
              expect([t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 1]);
              expect(json(path.join(s.authority, XRV.outcomeName))).toMatchObject({ status: 'held_storyboard_extension_revalidation', textStatus: 'held_contradiction',
                recovery: 'stop_allowance_exhausted' });
              expect(json(path.join(xrevalDir(s), 'recovery-final.json'))).toMatchObject({ terminal: 'stop_allowance_exhausted', remaining: 0, consecutiveFailures: 4,
                attempt: { attempt: 4, outcome: 'held' } });
              expect(existsSync(path.join(s.authority, XRV.successorName))).toBe(false);
              const t2 = reviewOnly(basisReview());
              await expect(runFreshBookStoryboardExtensionRevalidation({ ...(await s.extensionRevalidationGrant('again.json')), transports: t2 }))
                .rejects.toThrow('fresh_book_storyboard_extension_revalidation_used');
              expect([t2.planner, t2.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0]);
              providers();
              await expect(runFreshBookChild({ ...g, storyboardExtensionRevalidation: true })).rejects.toThrow('fresh_book_stage_not_passed');
              expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
              expect(s.frozenRefusedExtension()).toEqual(before);
            }, 900_000);

            it('stands only on THIS refusal of THIS paid answer: another code, a review spent, a changed answer, record, grant, owner record or head refuses BEFORE the claim or any call', async () => {
              const ext = (s: RefusedExtension, ...p: string[]) => path.join(extDir(s), ...p);
              const regrant = <G extends { grantFile: string }>(gr: G) => ({ ...gr, grantSha: sha(readFileSync(gr.grantFile)) });
              const cases: Record<string, (s: RefusedExtension) => Promise<{ grant: Awaited<ReturnType<RefusedExtension['extensionRevalidationGrant']>>; expect: RegExp }>> = {
                'another failure code': async s => { const g = await s.extensionRevalidationGrant();
                  edit(path.join(s.authority, EXTL.outcomeName), o => { o.code = 'storyboard_claim_basis_withhold_reveal'; });
                  return { grant: g, expect: /fresh_book_storyboard_extension_revalidation_(extension|grant)/ }; },
                'the extension seal says another failure': async s => { const g = await s.extensionRevalidationGrant(); edit(ext(s, 'sealed.json'), x => { x.code = 'fresh_book_provider_transport'; });
                  return { grant: g, expect: /fresh_book_storyboard_extension_revalidation_(extension|grant)/ }; },
                'an extension review was claimed': async s => { const g = await s.extensionRevalidationGrant(); mkdirSync(ext(s, 'paid-stages'), { recursive: true });
                  writeFileSync(ext(s, 'paid-stages', 'storyboard_review.claim.json'), '{}');
                  return { grant: g, expect: /fresh_book_storyboard_extension_revalidation_(extension|grant)|fresh_book_ledger/ }; },
                'an extension successor appeared': async s => { const g = await s.extensionRevalidationGrant(); writeFileSync(path.join(s.authority, EXTL.successorName), '{}');
                  return { grant: g, expect: /fresh_book_storyboard_extension_revalidation_extension/ }; },
                'the paid answer (decoded output) changed': async s => { const g = await s.extensionRevalidationGrant();
                  edit(ext(s, 'claude-max-stages', 'storyboard.receipt.json'), r => { r.output.plan.pages[2].composition += ' changed'; });
                  return { grant: g, expect: /fresh_book_storyboard_(extension_revalidation_extension|extension_revalidation_grant|repair_replay)/ }; },
                'the paid planner wire changed': async s => { const g = await s.extensionRevalidationGrant(); edit(ext(s, 'claude-max-stages', 'storyboard.wire.json'), w => { w.bytes += 1; });
                  return { grant: g, expect: /fresh_book_storyboard_extension_revalidation_(extension|grant)/ }; },
                'the extension input changed': async s => { const g = await s.extensionRevalidationGrant();
                  edit(ext(s, 'storyboard_repair_input.json'), r => { r.extension.approvalSha256 = 'f'.repeat(64); });
                  return { grant: g, expect: /fresh_book_storyboard_extension_revalidation_(extension|grant)/ }; },
                'consumed extension grant bytes changed': async s => { const g = await s.extensionRevalidationGrant();
                  writeFileSync(s.extension.grantFile, readFileSync(s.extension.grantFile, 'utf8') + ' ');
                  return { grant: g, expect: /fresh_book_storyboard_extension_revalidation_extension/ }; },
                'owner record changed': async s => { const g = await s.extensionRevalidationGrant(); writeFileSync(s.approvalFile, readFileSync(s.approvalFile, 'utf8') + ' ');
                  return { grant: g, expect: /fresh_book_storyboard_extension_approval/ }; },
                'grant without the staging-fields correction': async s => { const g = await s.extensionRevalidationGrant();
                  edit(g.grantFile, x => { x.compile = ['storyboard-self-check-names/v1']; });
                  return { grant: regrant(g), expect: /fresh_book_storyboard_extension_revalidation_grant/ }; },
                'grant allows a planner call': async s => { const g = await s.extensionRevalidationGrant(); edit(g.grantFile, x => { x.allowance.plannerCalls = 1; });
                  return { grant: regrant(g), expect: /fresh_book_storyboard_extension_revalidation_grant/ }; },
                'grant names another staged field': async s => { const g = await s.extensionRevalidationGrant();
                  edit(g.grantFile, x => { x.candidate.stagedFields = [{ page: 3, ref: 'p3:childGaze' }]; });
                  return { grant: regrant(g), expect: /fresh_book_storyboard_extension_revalidation_grant/ }; },
                'head moved after the grant': async s => { const g = await s.extensionRevalidationGrant(); s.setHead('4'.repeat(40));
                  return { grant: g, expect: /fresh_book_storyboard_extension_revalidation_grant|fresh_book_source_changed/ }; },
                'dirty tree': async s => { const g = await s.extensionRevalidationGrant(); s.setClean(false); return { grant: g, expect: /fresh_book_source_changed/ }; },
              };
              for (const [name, mutate] of Object.entries(cases)) {
                const s = await refusedExtensionBook(), t = reviewOnly(basisReview());
                let c: Awaited<ReturnType<typeof mutate>>;
                try { c = await mutate(s); } catch (e) { throw new Error(`${name}: ${e}`); }
                await expect(runFreshBookStoryboardExtensionRevalidation({ ...c.grant, transports: t }), name).rejects.toThrow(c.expect);
                expect([name, existsSync(path.join(s.authority, XRV.claimName)), existsSync(xrevalDir(s)),
                  ...[t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)]).toEqual([name, false, false, 0, 0, 0, 0]);
              }
              // The CLI output is the authority for the paid answer: a re-planned grant over an edited structured answer refuses at the preview, before the claim.
              const s = await refusedExtensionBook(), t = reviewOnly(basisReview());
              edit(path.join(extDir(s), 'claude-max-stages', 'storyboard.receipt.json'), r => { const out = JSON.parse(r.raw.stdout);
                out.structured_output.plan.pages[2].composition += ' changed'; r.raw.stdout = JSON.stringify(out); });
              await expect(runFreshBookStoryboardExtensionRevalidation({ ...(await s.extensionRevalidationGrant()), transports: t })).rejects.toThrow('fresh_book_storyboard_repair_replay');
              expect([existsSync(path.join(s.authority, XRV.claimName)), existsSync(xrevalDir(s)), vi.mocked(t.responses).mock.calls.length]).toEqual([false, false, 0]);
              // The balance must cover the review's floor before the claim (the same F6 rule, its own code).
              expect(() => assertReviewFloorFits({ bookKnownMicroUsd: 6_400_001, nextCapMicroUsd: 7_000_000 }, 'fresh_book_storyboard_extension_revalidation_budget'))
                .toThrow('fresh_book_storyboard_extension_revalidation_budget');
            }, 2_400_000);  // fifteen whole refused chains (text, recovery, repair, continuation, revalidation, extension), each built from scratch

            it('a changed extension revalidation successor (its draft, its terminal record) or a changed borrowed answer refuses the child BEFORE its folder, key or render', async () => {
              for (const kind of ['draft', 'recovery_final', 'borrowed_answer']) {
                const s = await refusedExtensionBook(), g = await s.extensionRevalidationGrant();
                expect((await runFreshBookStoryboardExtensionRevalidation({ ...g, transports: reviewOnly(basisReview()) })).status).toBe('review_supported');
                if (kind === 'draft') edit(path.join(xrevalDir(s), 'owned_storyboard_draft.json'), d => { d.plan.pages[2].composition += ' changed'; });
                else if (kind === 'recovery_final') edit(path.join(xrevalDir(s), 'recovery-final.json'), r => { r.terminal = 'stop_allowance_exhausted'; });
                else edit(path.join(extDir(s), 'claude-max-stages', 'storyboard.receipt.json'), r => { r.output.plan.pages[2].composition += ' changed'; });
                providers();
                await expect(runFreshBookChild({ ...g, storyboardExtensionRevalidation: true }), kind)
                  .rejects.toThrow(/fresh_book_storyboard_extension_revalidation_(successor|grant|extension)/);
                expect([kind, vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length, existsSync(path.join(s.config.bookDir, 'child'))])
                  .toEqual([kind, 0, 0, false]);
                vi.restoreAllMocks();
              }
            }, 900_000);

            describe('the ONE owner-approved calibration attempt (attempt 5 of 5 under storyboard-calibration/v1, after the extension revalidation\'s own review held it)', () => {
              const CALL = FRESH_BOOK_STORYBOARD_CALIBRATION;
              const calDir = (s: { config: FreshBookConfig }) => path.join(s.config.bookDir, CALL.folder);
              /** The extension revalidation's own review holds attempt 4 (page 4's causal action still omitted) at the owner's ceiling 4. */
              const heldX = basisReview(r => { r.frames[4].checks[0] = { ...r.frames[4].checks[0], verdict: 'contradiction', observation: 'the causal action is still omitted',
                issues: [{ impact: 'story', ref: 'p4', note: 'the causal action is still omitted', whyNotMaterial: '' }] }; });
              /** The calibration review: every issue gives its citation and the reviewer's basis (setting unless `change` says otherwise). */
              const calReview = (change: (r: any) => void = () => {}) => (r: any) => {
                const all = () => [...r.bookChecks, ...r.frames.flatMap((x: any) => x.checks)];
                for (const c of all()) c.issues = [];
                change(r);
                for (const c of all()) c.issues = c.issues.map((i: any) => ({ citation: '', basis: 'setting', ...i }));
                return r;
              };
              /** A justified setting completion on page 5's garden (the owner's rule): a note, not a hold. */
              const settingNote = (r: any) => { r.frames[5].checks[3] = { ...r.frames[5].checks[3], verdict: 'uncertain', observation: 'the garden\'s layout is not stated',
                issues: [{ impact: 'evidence', ref: 'location:garden', note: 'the layout is completed', basis: 'setting',
                  whyNotMaterial: 'the layout changes no event, identity, age, safety or material relation' }] }; };
              /**
               * The calibration planner: it reads its own request (the held attempt-4 draft without its self-check, every finding with its typed issues and
               * groups, the diagnosis under the owner's ceiling 5), re-plans the diagnosed pages and returns the whole storyboard with a full self-check and
               * its (empty) visual-state map, measured on the contract's neutral view.
               */
              const calPlanner = (change: (draft: any) => void = () => {}) => vi.fn(async (_w: any, call: any) => {
                const input = JSON.parse(call.input), prior = input.priorReviewedStoryboard, diagnosis = prior.diagnosis;
                const draft = structuredClone(prior.storyboard);
                const bookPage = [1, 2, 3, 4, 5, 6, 7, 8].find(n => !diagnosis.protectedPages.includes(n))!;
                for (const n of new Set<number>(diagnosis.findings.map((x: any) => x.key.startsWith('page:') ? Number(x.key.split(':')[1]) : bookPage)))
                  draft.plan.pages[n].composition += ' (re-planned under the calibration)';
                change(draft);
                const texts = [input.story.title, ...input.story.pages.map((p: any) => p.text)];
                const selfCheck = { ...fullSelfCheck(claimBasisSectionsView(draft), texts, { diagnosis, parentDraft: claimBasisSectionsView(prior.storyboard) }), visualStates: [] };
                const strip = ({ pageNumber: _n, ...row }: any) => row;
                const wire = { plan: { ...draft.plan, pages: draft.plan.pages.map(strip), continuity: { ...draft.plan.continuity, pages: draft.plan.continuity.pages.map(strip) } },
                  sequence: { ...draft.sequence, pages: draft.sequence.pages.map(strip) }, moments: draft.moments, selfCheck };
                return cliReply(decodePersonalBookProviderOutput(call, wire), .45, wire);
              });
              /** The refused extension, its extension revalidation held by its own review, then a NEW reviewed head and the owner's second approval record. */
              async function heldExtensionRevalidationBook() {
                const s = await refusedExtensionBook(), xreval = await s.extensionRevalidationGrant();
                expect((await runFreshBookStoryboardExtensionRevalidation({ ...xreval, transports: reviewOnly(heldX) })).status).toBe('held_contradiction');
                expect(json(path.join(s.authority, XRV.outcomeName))).toMatchObject({ status: 'held_storyboard_extension_revalidation', recovery: 'stop_allowance_exhausted' });
                s.setHead('8'.repeat(40));
                const approval5 = path.join(s.root, 'OWNER-APPROVAL-5.txt');
                writeFileSync(approval5, `Synthetic owner approval record (test only).\n${CALL.approvalLine}\n`);
                const calibrationGrant = async (name = 'calibration-grant.json') => {
                  const g = (await planFreshBookStoryboardCalibration(s.config, s.env, xreval.grantFile, approval5)).grantDraft, file = path.join(s.root, name);
                  writeFileSync(file, JSON.stringify(g)); return { ...s.original, grantFile: file, grantSha: sha(readFileSync(file)) }; };
                const frozenXHeld = () => ({ ...s.frozenRefusedExtension(), xreval: tree(xrevalDir(s)), xrevalGrant: sha(readFileSync(xreval.grantFile)),
                  xrevalClaim: sha(readFileSync(path.join(s.authority, XRV.claimName))), xrevalOutcome: sha(readFileSync(path.join(s.authority, XRV.outcomeName))),
                  approval5: sha(readFileSync(approval5)) });
                return { ...s, xreval, approval5, calibrationGrant, frozenXHeld };
              }
              type HeldX = Awaited<ReturnType<typeof heldExtensionRevalidationBook>>;
              const calTransports = (review: (r: any) => any) => ({ ...textTransports({ review }), planner: calPlanner() });

              it('positive: ONE calibrated planner (compacted wire) and ONE floored review under the owner\'s rule (a setting note) admit attempt 5; successor; child and book on its line', async () => {
                const s = await heldExtensionRevalidationBook(), before = s.frozenXHeld(), g = await s.calibrationGrant(), t = calTransports(calReview(settingNote));
                const planned = await planFreshBookStoryboardCalibration(s.config, s.env, s.xreval.grantFile, s.approval5);
                expect(planned.grantDraft.ownerApproval).toEqual({ file: path.resolve(s.approval5), sha256: sha(readFileSync(s.approval5)) });
                expect(planned.grantDraft.recovery).toMatchObject({ attempts: 4, maxAttempts: 5, consecutiveFailures: 4, mode: 'diagnose_and_change_strategy' });
                expect([planned.grantDraft.allowance, planned.grantDraft.addedContracts, planned.grantDraft.compile, planned.grantDraft.plannerSchema, planned.grantDraft.held.findings,
                  planned.grantDraft.held.findingGroups]).toEqual([{ plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 }, ['calibrationContract'],
                  ['storyboard-self-check-names/v1', 'storyboard-claim-basis-staging-fields/v1'], 'definition-names/v1', 1, 1]);
                expect(planned.recoveryRecord.attempts.map(a => [a.line, a.disposition])).toEqual([['text-recovery', 'held_uncertain'], ['storyboard-repair', 'held_uncertain'],
                  [REVAL.folder, 'held_contradiction'], [XRV.folder, 'held_contradiction']]);
                expect(planned.diagnosisRecord.diagnosis.allowance).toEqual({ nextAttempt: 5, maxAttempts: 5, remainingAfterNext: 0 });
                expect(planned.input).toMatchObject({ addedContracts: ['calibrationContract'], parentCompile: { selfCheckNames: true, stagingFields: true },
                  extension: { version: 'storyboard-attempt-extension/v2', maxAttempts: 5, approvalSha256: sha(readFileSync(s.approval5)),
                    previous: { version: 'storyboard-attempt-extension/v1', maxAttempts: 4, approvalSha256: sha(readFileSync(s.approvalFile)) } } });
                expect([planned.plan.providerCalls, planned.plan.keyRead, planned.state.claimExists, planned.state.folderExists]).toEqual([0, false, false, false]);
                expect((await planFreshBookStoryboardCalibration(s.config, s.env, s.xreval.grantFile, s.approval5)).grantDraft).toEqual(planned.grantDraft);
                const out = await runFreshBookStoryboardCalibration({ ...g, transports: t });
                expect(out.status).toBe('review_supported_with_notes');
                // Replay only for the text and the correction: exactly one planner session and one review.
                expect([t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0, 1, 1]);
                const dir = calDir(s);
                expect([claims(path.join(dir, 'paid-stages')), claims(path.join(dir, 'claude-max-stages'))]).toEqual([['storyboard_review'], ['storyboard']]);
                expect(json(path.join(dir, 'paid-stages', 'storyboard_review.claim.json')).maximumMicroUsd).toBeGreaterThanOrEqual(600000);
                expect(json(path.join(dir, 'claude-max-stages', 'storyboard.wire.json')).payload.schemaCompaction).toBe('definition-names/v1');
                // The planner's request: the calibration's instruction, the finding groups and the diagnosis under the owner's ceiling 5.
                const plannerCall = vi.mocked(t.planner).mock.calls[0][1] as any, input = JSON.parse(plannerCall.input);
                expect(plannerCall.instructions).toContain(CALIBRATION_STORYBOARD_ADDENDUM);
                expect(plannerCall.context).toMatchObject({ calibrationContract: true, claimBasisContract: true });
                expect([input.priorReviewedStoryboard.findingGroups, input.priorReviewedStoryboard.diagnosis.allowance])
                  .toEqual([[{ ref: 'p4', checks: ['page:4:moment'] }], { nextAttempt: 5, maxAttempts: 5, remainingAfterNext: 0 }]);
                // The review's instruction and input under the owner's rule.
                const reviewPayload = vi.mocked(t.responses).mock.calls[0][0] as any;
                expect(reviewPayload.instructions).toContain(CALIBRATION_REVIEW_IMPACT_ADDENDUM);
                expect(JSON.parse(reviewPayload.input)).toMatchObject({ calibration: { version: STORYBOARD_CALIBRATION_VERSION, visualStates: [] } });
                // The durable records.
                expect(json(path.join(dir, 'storyboard_repair_input.json'))).toEqual(plainJson(planned.input));
                expect(json(path.join(dir, 'recovery-state.json'))).toEqual(plainJson(planned.recoveryRecord));
                expect(json(path.join(dir, 'diagnosis.json'))).toEqual(plainJson(planned.diagnosisRecord));
                expect(json(path.join(dir, 'recovery-final.json'))).toMatchObject({ terminal: 'admitted', attempt: { attempt: 5, line: CALL.folder, outcome: 'admitted',
                  disposition: 'review_supported_with_notes', notes: [{ pageNumber: 5 }] } });
                const admission = json(path.join(dir, CALIBRATION_ADMISSION_FILE));
                expect(admission.preview).toEqual(await previewFreshBookStoryboardCalibration(s.config, json(path.join(dir, 'storyboard_repair_input.json'))));
                expect([admission.preview.wireDigest, admission.preview.schemaCompaction, admission.preview.findingGroups])
                  .toEqual([json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')).wireDigest, 'definition-names/v1', 1]);
                expect(json(path.join(dir, 'sealed.json'))).toEqual({ status: 'review_supported_with_notes', calibrated: { parentStoryboardDigest: planned.grantDraft.held.storyboardDigest,
                  addedContracts: ['calibrationContract'], attempt: 5, components: ['storyboard-review-severity/v1', 'storyboard-claim-basis-multispan/v1',
                    'storyboard-relation-lifetime/v1', 'storyboard-state-source/v1'], plannerSchema: 'definition-names/v1' }, replayed: REPLAYED, runtimeEligible: false });
                const result = json(path.join(dir, 'simple-book-result.json'));
                expect(result.storyboard.storyboard).toMatchObject({ calibration: { version: STORYBOARD_CALIBRATION_VERSION, visualStates: [] },
                  selfCheckNames: 'storyboard-self-check-names/v1', stagingFields: 'storyboard-claim-basis-staging-fields/v1',
                  repair: { parentStoryboardDigest: planned.grantDraft.held.storyboardDigest } });
                expect(json(path.join(s.authority, CALL.successorName))).toMatchObject({ grantSha256: g.grantSha, ownerApprovalSha256: sha(readFileSync(s.approval5)),
                  disposition: 'review_supported_with_notes', notes: 1, parentStoryboardDigest: planned.grantDraft.held.storyboardDigest,
                  extensionRevalidationClaimSha256: sha(readFileSync(path.join(s.authority, XRV.claimName))) });
                expect(out.ledger.stages.map(x => [x.name, x.calls])).toEqual([['text', 2], ['text-recovery', 2], ['storyboard-repair', 1], ['storyboard-continuation', 0],
                  ['storyboard-revalidation', 1], [EXTL.folder, 0], [XRV.folder, 1], [CALL.folder, 1], ['child', 0], ['audition', 0]]);
                expect(s.frozenXHeld()).toEqual(before);
                // Once only; the held extension revalidation's line stays closed; downstream runs only on this line.
                await expect(runFreshBookStoryboardCalibration({ ...g, transports: calTransports(calReview()) })).rejects.toThrow(/fresh_book_storyboard_calibration_(used|grant)|fresh_book_roots_changed/);
                await expect(runFreshBookStoryboardCalibration({ ...(await s.calibrationGrant('relabelled.json')), transports: calTransports(calReview()) }))
                  .rejects.toThrow('fresh_book_storyboard_calibration_used');
                providers();
                await expect(runFreshBookChild({ ...s.xreval, storyboardExtensionRevalidation: true })).rejects.toThrow(/fresh_book_stage_not_passed|fresh_book_storyboard_extension_revalidation_grant|fresh_book_source_changed/);
                await expect(runFreshBookChild({ ...g, storyboardExtensionRevalidation: true })).rejects.toThrow('fresh_book_storyboard_extension_revalidation_grant');
                expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
                expect(await runFreshBookChild({ ...g, storyboardCalibration: true })).toMatchObject({ status: 'child_reference_passed' });
                expect(json(path.join(s.config.bookDir, 'book-layout.json')).storyboardDir).toBe(CALL.folder);
                const book = await runFreshBookBook({ ...g, storyboardCalibration: true });
                expect(book.status).toBe('complete');
                expect(book.ledger.stages.map(x => x.name)).toEqual(['text', 'text-recovery', 'storyboard-repair', 'storyboard-continuation', 'storyboard-revalidation',
                  EXTL.folder, XRV.folder, CALL.folder, 'child', 'audition']);
                const auditionGrant = json(path.join(s.config.bookDir, 'audition.grant.json'));
                expect([auditionGrant.scope.recovery, auditionGrant.experiment.claimSha256]).toEqual(['stage-recovery/v1', sha(readFileSync(path.join(s.authority, CALL.claimName)))]);
                expect(json(path.join(s.authority, CALL.outcomeName)).status).toBe('complete');
                expect(s.frozenXHeld()).toEqual(before);
              }, 900_000);

              it('held by its review: attempt 5 of 5 ends the line (stop_allowance_exhausted); no attempt 6; no child', async () => {
                const s = await heldExtensionRevalidationBook(), before = s.frozenXHeld(), g = await s.calibrationGrant();
                const t = calTransports(calReview(r => { r.frames[4].checks[0] = { ...r.frames[4].checks[0], verdict: 'contradiction',
                  observation: 'the causal action is still omitted', issues: [{ impact: 'story', ref: 'p4', note: 'the causal action is still omitted', whyNotMaterial: '',
                    basis: 'contradiction' }] }; }));
                expect((await runFreshBookStoryboardCalibration({ ...g, transports: t })).status).toBe('held_contradiction');
                expect([t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([1, 1]);
                expect(json(path.join(s.authority, CALL.outcomeName))).toMatchObject({ status: 'held_storyboard_calibration', textStatus: 'held_contradiction',
                  recovery: 'stop_allowance_exhausted' });
                expect(json(path.join(calDir(s), 'recovery-final.json'))).toMatchObject({ terminal: 'stop_allowance_exhausted', remaining: 0, consecutiveFailures: 5,
                  attempt: { attempt: 5, outcome: 'held' } });
                expect(existsSync(path.join(s.authority, CALL.successorName))).toBe(false);
                const t2 = calTransports(calReview());
                await expect(runFreshBookStoryboardCalibration({ ...(await s.calibrationGrant('again.json')), transports: t2 })).rejects.toThrow('fresh_book_storyboard_calibration_used');
                expect([t2.planner, t2.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0]);
                providers();
                await expect(runFreshBookChild({ ...g, storyboardCalibration: true })).rejects.toThrow('fresh_book_stage_not_passed');
                expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
                expect(s.frozenXHeld()).toEqual(before);
              }, 900_000);

              it('immutable inputs: the owner\'s second record, the held extension revalidation and its lineage, the grant\'s ceiling, contract, compaction or approval, the head or the tree refuse BEFORE the claim or any call', async () => {
                const xr = (s: HeldX, ...p: string[]) => path.join(xrevalDir(s), ...p);
                const regrant = <G extends { grantFile: string }>(gr: G) => ({ ...gr, grantSha: sha(readFileSync(gr.grantFile)) });
                const cases: Record<string, (s: HeldX) => Promise<{ grant: Awaited<ReturnType<HeldX['calibrationGrant']>>; expect: RegExp }>> = {
                  'owner record changed': async s => { const g = await s.calibrationGrant(); writeFileSync(s.approval5, readFileSync(s.approval5, 'utf8') + ' ');
                    return { grant: g, expect: /fresh_book_storyboard_calibration_approval/ }; },
                  'extension revalidation outcome no longer at the ceiling': async s => { const g = await s.calibrationGrant();
                    edit(path.join(s.authority, XRV.outcomeName), o => { o.recovery = 'diagnose_and_change_strategy'; });
                    return { grant: g, expect: /fresh_book_storyboard_calibration_extension_revalidation/ }; },
                  'its review answer changed': async s => { const g = await s.calibrationGrant();
                    edit(xr(s, 'paid-stages', 'storyboard_review.receipt.json'), r => { const a = JSON.parse(r.raw.output_text), k = Object.keys(a.frames[4])[0];
                      a.frames[4][k].observation += ' (reworded)'; r.raw.output_text = JSON.stringify(a); });
                    return { grant: g, expect: /fresh_book_storyboard_calibration_extension_revalidation|fresh_book_ledger/ }; },
                  'its terminal record changed': async s => { const g = await s.calibrationGrant(); edit(xr(s, 'recovery-final.json'), r => { r.remaining = 1; });
                    return { grant: g, expect: /fresh_book_storyboard_calibration_extension_revalidation/ }; },
                  'an extension revalidation successor appeared': async s => { const g = await s.calibrationGrant(); writeFileSync(path.join(s.authority, XRV.successorName), '{}');
                    return { grant: g, expect: /fresh_book_storyboard_calibration_extension_revalidation/ }; },
                  'consumed extension revalidation grant bytes changed': async s => { const g = await s.calibrationGrant();
                    writeFileSync(s.xreval.grantFile, readFileSync(s.xreval.grantFile, 'utf8') + ' ');
                    return { grant: g, expect: /fresh_book_storyboard_calibration_extension_revalidation/ }; },
                  'consumed extension grant bytes changed': async s => { const g = await s.calibrationGrant();
                    writeFileSync(s.extension.grantFile, readFileSync(s.extension.grantFile, 'utf8') + ' ');
                    return { grant: g, expect: /fresh_book_storyboard_(extension_revalidation_extension|calibration_extension_revalidation)/ }; },
                  'unknown cost in its review record': async s => { const g = await s.calibrationGrant();
                    edit(xr(s, 'paid-stages', 'storyboard_review.result.json'), r => { r.estimatedMicroUsd = null; });
                    return { grant: g, expect: /fresh_book_storyboard_calibration_(unknown_cost|extension_revalidation)|fresh_book_ledger|audition_meter_cost/ }; },
                  'grant raises the ceiling': async s => { const g = await s.calibrationGrant(); edit(g.grantFile, x => { x.recovery.maxAttempts = 6; });
                    return { grant: regrant(g), expect: /fresh_book_storyboard_calibration_grant/ }; },
                  'grant drops the calibration': async s => { const g = await s.calibrationGrant(); edit(g.grantFile, x => { x.addedContracts = []; });
                    return { grant: regrant(g), expect: /fresh_book_storyboard_calibration_grant/ }; },
                  'grant without the compaction': async s => { const g = await s.calibrationGrant(); edit(g.grantFile, x => { delete x.plannerSchema; });
                    return { grant: regrant(g), expect: /fresh_book_storyboard_calibration_grant/ }; },
                  'head moved after the grant': async s => { const g = await s.calibrationGrant(); s.setHead('9'.repeat(40));
                    return { grant: g, expect: /fresh_book_storyboard_calibration_grant|fresh_book_source_changed/ }; },
                  'dirty tree': async s => { const g = await s.calibrationGrant(); s.setClean(false); return { grant: g, expect: /fresh_book_source_changed/ }; },
                };
                for (const [name, mutate] of Object.entries(cases)) {
                  const s = await heldExtensionRevalidationBook(), t = calTransports(calReview());
                  let c: Awaited<ReturnType<typeof mutate>>;
                  try { c = await mutate(s); } catch (e) { throw new Error(`${name}: ${e}`); }
                  await expect(runFreshBookStoryboardCalibration({ ...c.grant, transports: t }), name).rejects.toThrow(c.expect);
                  expect([name, existsSync(path.join(s.authority, CALL.claimName)), existsSync(calDir(s)),
                    ...[t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)]).toEqual([name, false, false, 0, 0, 0, 0]);
                }
                // The plan needs the owner's second record by absolute path, with its verbatim line (the first record's line is not this approval).
                const s = await heldExtensionRevalidationBook();
                await expect(planFreshBookStoryboardCalibration(s.config, s.env, s.xreval.grantFile, s.approvalFile)).rejects.toThrow('fresh_book_storyboard_calibration_approval');
                await expect(planFreshBookStoryboardCalibration(s.config, s.env, s.xreval.grantFile, 'OWNER-APPROVAL-5.txt')).rejects.toThrow('fresh_book_storyboard_calibration_approval');
                expect(() => assertReviewFloorFits({ bookKnownMicroUsd: 6_400_001, nextCapMicroUsd: 7_000_000 }, 'fresh_book_storyboard_calibration_budget'))
                  .toThrow('fresh_book_storyboard_calibration_budget');
              }, 2_700_000);  // thirteen whole held chains (text, recovery, repair, continuation, revalidation, extension, extension revalidation), each built from scratch

              it('a changed calibration successor (its draft, its terminal record, its planner output) refuses the child BEFORE its folder, key or render', async () => {
                for (const kind of ['draft', 'recovery_final', 'planner_output']) {
                  const s = await heldExtensionRevalidationBook(), g = await s.calibrationGrant();
                  expect((await runFreshBookStoryboardCalibration({ ...g, transports: calTransports(calReview()) })).status).toBe('review_supported');
                  if (kind === 'draft') edit(path.join(calDir(s), 'owned_storyboard_draft.json'), d => { d.plan.pages[2].composition += ' changed'; });
                  else if (kind === 'recovery_final') edit(path.join(calDir(s), 'recovery-final.json'), r => { r.terminal = 'stop_allowance_exhausted'; });
                  else edit(path.join(calDir(s), 'claude-max-stages', 'storyboard.receipt.json'), r => { r.output.plan.pages[2].composition += ' changed'; });
                  providers();
                  await expect(runFreshBookChild({ ...g, storyboardCalibration: true }), kind).rejects.toThrow(/fresh_book_storyboard_calibration_(successor|grant)/);
                  expect([kind, vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length, existsSync(path.join(s.config.bookDir, 'child'))])
                    .toEqual([kind, 0, 0, false]);
                  vi.restoreAllMocks();
                }
              }, 900_000);

              describe('the ONE owner-directed presence attempt (historically attempt 6 under storyboard-presence/v1, after the calibration\'s own review held it)', () => {
                const PRL = FRESH_BOOK_STORYBOARD_PRESENCE;
                const prsDir = (s: { config: FreshBookConfig }) => path.join(s.config.bookDir, PRL.folder);
                /** The calibration's own review holds attempt 5 on the same page-4 action for the same impact as attempt 4's: a repeated reference. */
                const heldCal = calReview(r => { r.frames[4].checks[0] = { ...r.frames[4].checks[0], verdict: 'contradiction',
                  observation: 'the causal action is still omitted', issues: [{ impact: 'story', ref: 'p4', note: 'the causal action is still omitted', whyNotMaterial: '',
                    basis: 'contradiction' }] }; });
                /**
                 * The presence planner: as the calibration's, on the presence contract's frames (every depicted lists presence), re-planning the diagnosed
                 * pages with a changed strategy (never the cause evidence_binding for the repeated reference).
                 */
                const prsPlanner = () => vi.fn(async (_w: any, call: any) => {
                  const input = JSON.parse(call.input), prior = input.priorReviewedStoryboard, diagnosis = prior.diagnosis;
                  const draft = structuredClone(prior.storyboard);
                  for (const fr of draft.moments.frames) if (fr.depicted) fr.depicted.presence ??= [];
                  const bookPage = [1, 2, 3, 4, 5, 6, 7, 8].find(n => !diagnosis.protectedPages.includes(n))!;
                  for (const n of new Set<number>(diagnosis.findings.map((x: any) => x.key.startsWith('page:') ? Number(x.key.split(':')[1]) : bookPage)))
                    draft.plan.pages[n].composition += ' (re-planned under presence)';
                  const texts = [input.story.title, ...input.story.pages.map((p: any) => p.text)];
                  const selfCheck = { ...fullSelfCheck(claimBasisSectionsView(draft), texts, { diagnosis, parentDraft: claimBasisSectionsView(prior.storyboard) },
                    sc => { sc.resolutions.forEach((r: any) => { r.cause = 'state_design'; }); }), visualStates: [] };
                  const strip = ({ pageNumber: _n, ...row }: any) => row;
                  const wire = { plan: { ...draft.plan, pages: draft.plan.pages.map(strip), continuity: { ...draft.plan.continuity, pages: draft.plan.continuity.pages.map(strip) } },
                    sequence: { ...draft.sequence, pages: draft.sequence.pages.map(strip) }, moments: draft.moments, selfCheck };
                  return cliReply(decodePersonalBookProviderOutput(call, wire), .45, wire);
                });
                /** The extension revalidation held at 4, the calibration attempt 5 held by its own review, then a NEW reviewed head and the owner's continuation record. */
                async function heldCalibrationBook() {
                  const s = await heldExtensionRevalidationBook(), cal = await s.calibrationGrant();
                  expect((await runFreshBookStoryboardCalibration({ ...cal, transports: calTransports(heldCal) })).status).toBe('held_contradiction');
                  expect(json(path.join(s.authority, CALL.outcomeName))).toMatchObject({ status: 'held_storyboard_calibration', recovery: 'stop_allowance_exhausted' });
                  s.setHead('7'.repeat(40));
                  const approval6 = path.join(s.root, 'OWNER-CONTINUATION-6.txt');
                  writeFileSync(approval6, `Synthetic owner continuation record (test only).\n${PRL.approvalLine}\n`);
                  const presenceGrant = async (name = 'presence-grant.json') => {
                    const gr = (await planFreshBookStoryboardPresence(s.config, s.env, cal.grantFile, approval6)).grantDraft, file = path.join(s.root, name);
                    writeFileSync(file, JSON.stringify(gr)); return { ...s.original, grantFile: file, grantSha: sha(readFileSync(file)) }; };
                  const frozenCalHeld = () => ({ ...s.frozenXHeld(), cal: tree(calDir(s)), calGrant: sha(readFileSync(cal.grantFile)),
                    calClaim: sha(readFileSync(path.join(s.authority, CALL.claimName))), calOutcome: sha(readFileSync(path.join(s.authority, CALL.outcomeName))),
                    approval6: sha(readFileSync(approval6)) });
                  return { ...s, cal, approval6, presenceGrant, frozenCalHeld };
                }
                type HeldC = Awaited<ReturnType<typeof heldCalibrationBook>>;
                const prsTransports = (review: (r: any) => any) => ({ ...textTransports({ review }), planner: prsPlanner() });

                it('positive: ONE presence planner (compacted wire) and ONE floored review (a setting note) admit attempt 6; the repeated reference listed; successor; child and book on its line', async () => {
                  const s = await heldCalibrationBook(), before = s.frozenCalHeld(), g = await s.presenceGrant(), t = prsTransports(calReview(settingNote));
                  const planned = await planFreshBookStoryboardPresence(s.config, s.env, s.cal.grantFile, s.approval6);
                  expect(planned.grantDraft.ownerApproval).toEqual({ file: path.resolve(s.approval6), sha256: sha(readFileSync(s.approval6)) });
                  expect(planned.grantDraft.recovery).toMatchObject({ attempts: 5, maxAttempts: 6, consecutiveFailures: 5, mode: 'diagnose_and_change_strategy' });
                  expect([planned.grantDraft.allowance, planned.grantDraft.addedContracts, planned.grantDraft.compile, planned.grantDraft.plannerSchema,
                    planned.grantDraft.held.findings, planned.grantDraft.held.findingGroups, planned.grantDraft.held.repeatedReferences]).toEqual([
                    { plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 }, ['presenceContract'],
                    ['storyboard-self-check-names/v1', 'storyboard-claim-basis-staging-fields/v1'], 'definition-names/v1', 1, 1, 1]);
                  expect(planned.recoveryRecord.attempts.map(a => [a.line, a.disposition])).toEqual([['text-recovery', 'held_uncertain'], ['storyboard-repair', 'held_uncertain'],
                    [REVAL.folder, 'held_contradiction'], [XRV.folder, 'held_contradiction'], [CALL.folder, 'held_contradiction']]);
                  expect(planned.diagnosisRecord.diagnosis.allowance).toEqual({ nextAttempt: 6, maxAttempts: 6, remainingAfterNext: 0 });
                  expect(planned.input).toMatchObject({ addedContracts: ['presenceContract'], parentCompile: { selfCheckNames: true, stagingFields: true },
                    extension: { version: 'storyboard-attempt-extension/v2', maxAttempts: 6, approvalSha256: sha(readFileSync(s.approval6)),
                      previous: { version: 'storyboard-attempt-extension/v2', maxAttempts: 5, approvalSha256: sha(readFileSync(s.approval5)),
                        previous: { version: 'storyboard-attempt-extension/v1', maxAttempts: 4, approvalSha256: sha(readFileSync(s.approvalFile)) } } } });
                  expect([planned.plan.providerCalls, planned.plan.keyRead, planned.state.claimExists, planned.state.folderExists]).toEqual([0, false, false, false]);
                  expect((await planFreshBookStoryboardPresence(s.config, s.env, s.cal.grantFile, s.approval6)).grantDraft).toEqual(planned.grantDraft);
                  const out = await runFreshBookStoryboardPresence({ ...g, transports: t });
                  expect(out.status).toBe('review_supported_with_notes');
                  // Replay only for the text and the correction: exactly one planner session and one review.
                  expect([t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0, 1, 1]);
                  const dir = prsDir(s);
                  expect([claims(path.join(dir, 'paid-stages')), claims(path.join(dir, 'claude-max-stages'))]).toEqual([['storyboard_review'], ['storyboard']]);
                  expect(json(path.join(dir, 'paid-stages', 'storyboard_review.claim.json')).maximumMicroUsd).toBeGreaterThanOrEqual(600000);
                  expect(json(path.join(dir, 'claude-max-stages', 'storyboard.wire.json')).payload.schemaCompaction).toBe('definition-names/v1');
                  // The planner's request: presence's instruction, the repeated reference and the diagnosis under the owner's ceiling 6.
                  const plannerCall = vi.mocked(t.planner).mock.calls[0][1] as any, input = JSON.parse(plannerCall.input);
                  expect(plannerCall.instructions).toContain(`${CALIBRATION_STORYBOARD_ADDENDUM}\n${PRESENCE_STORYBOARD_ADDENDUM}`);
                  expect(plannerCall.context).toMatchObject({ presenceContract: true, calibrationContract: true, claimBasisContract: true });
                  expect([input.priorReviewedStoryboard.repeatedReferences, input.priorReviewedStoryboard.diagnosis.allowance]).toEqual([
                    [{ ref: 'p4', impact: 'story', checks: ['page:4:moment'], previousChecks: ['page:4:moment'] }], { nextAttempt: 6, maxAttempts: 6, remainingAfterNext: 0 }]);
                  // The review's instruction under presence.
                  expect((vi.mocked(t.responses).mock.calls[0][0] as any).instructions).toContain(PRESENCE_REVIEW_ADDENDUM);
                  // The durable records.
                  expect(json(path.join(dir, 'storyboard_repair_input.json'))).toEqual(plainJson(planned.input));
                  expect(json(path.join(dir, 'recovery-state.json'))).toEqual(plainJson(planned.recoveryRecord));
                  expect(json(path.join(dir, 'diagnosis.json'))).toEqual(plainJson(planned.diagnosisRecord));
                  expect(json(path.join(dir, 'recovery-final.json'))).toMatchObject({ terminal: 'admitted', attempt: { attempt: 6, line: PRL.folder, outcome: 'admitted',
                    disposition: 'review_supported_with_notes', notes: [{ pageNumber: 5 }] } });
                  const admission = json(path.join(dir, PRESENCE_ADMISSION_FILE));
                  expect(admission.preview).toEqual(await previewFreshBookStoryboardPresence(s.config, json(path.join(dir, 'storyboard_repair_input.json'))));
                  expect([admission.preview.wireDigest, admission.preview.schemaCompaction, admission.preview.repeatedReferences])
                    .toEqual([json(path.join(dir, 'claude-max-stages', 'storyboard.claim.json')).wireDigest, 'definition-names/v1', 1]);
                  expect(json(path.join(dir, 'sealed.json'))).toEqual({ status: 'review_supported_with_notes', presence: { parentStoryboardDigest: planned.grantDraft.held.storyboardDigest,
                    addedContracts: ['presenceContract'], attempt: 6, components: ['storyboard-unplaced-presence/v1', 'storyboard-repeated-reference/v1'],
                    plannerSchema: 'definition-names/v1' }, replayed: REPLAYED, runtimeEligible: false });
                  expect(json(path.join(dir, 'simple-book-result.json')).storyboard.storyboard).toMatchObject({ presence: { version: STORYBOARD_PRESENCE_VERSION },
                    calibration: { version: STORYBOARD_CALIBRATION_VERSION }, repair: { parentStoryboardDigest: planned.grantDraft.held.storyboardDigest } });
                  expect(json(path.join(s.authority, PRL.successorName))).toMatchObject({ grantSha256: g.grantSha, ownerApprovalSha256: sha(readFileSync(s.approval6)),
                    disposition: 'review_supported_with_notes', notes: 1, parentStoryboardDigest: planned.grantDraft.held.storyboardDigest,
                    calibrationClaimSha256: sha(readFileSync(path.join(s.authority, CALL.claimName))) });
                  expect(out.ledger.stages.map(x => [x.name, x.calls])).toEqual([['text', 2], ['text-recovery', 2], ['storyboard-repair', 1], ['storyboard-continuation', 0],
                    ['storyboard-revalidation', 1], [EXTL.folder, 0], [XRV.folder, 1], [CALL.folder, 1], [PRL.folder, 1], ['child', 0], ['audition', 0]]);
                  expect(s.frozenCalHeld()).toEqual(before);
                  // Once only; the held calibration's line stays closed; downstream runs only on this line.
                  await expect(runFreshBookStoryboardPresence({ ...g, transports: prsTransports(calReview()) })).rejects.toThrow(/fresh_book_storyboard_presence_(used|grant)|fresh_book_roots_changed/);
                  await expect(runFreshBookStoryboardPresence({ ...(await s.presenceGrant('relabelled.json')), transports: prsTransports(calReview()) }))
                    .rejects.toThrow('fresh_book_storyboard_presence_used');
                  providers();
                  await expect(runFreshBookChild({ ...s.cal, storyboardCalibration: true })).rejects.toThrow(/fresh_book_stage_not_passed|fresh_book_storyboard_calibration_grant|fresh_book_source_changed/);
                  await expect(runFreshBookChild({ ...g, storyboardCalibration: true })).rejects.toThrow('fresh_book_storyboard_calibration_grant');
                  expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
                  expect(await runFreshBookChild({ ...g, storyboardPresence: true })).toMatchObject({ status: 'child_reference_passed' });
                  expect(json(path.join(s.config.bookDir, 'book-layout.json')).storyboardDir).toBe(PRL.folder);
                  const book = await runFreshBookBook({ ...g, storyboardPresence: true });
                  expect(book.status).toBe('complete');
                  expect(book.ledger.stages.map(x => x.name)).toEqual(['text', 'text-recovery', 'storyboard-repair', 'storyboard-continuation', 'storyboard-revalidation',
                    EXTL.folder, XRV.folder, CALL.folder, PRL.folder, 'child', 'audition']);
                  const auditionGrant = json(path.join(s.config.bookDir, 'audition.grant.json'));
                  expect([auditionGrant.scope.recovery, auditionGrant.experiment.claimSha256]).toEqual(['stage-recovery/v1', sha(readFileSync(path.join(s.authority, PRL.claimName)))]);
                  expect(json(path.join(s.authority, PRL.outcomeName)).status).toBe('complete');
                  expect(s.frozenCalHeld()).toEqual(before);
                }, 1_200_000);

                it('held by its review: attempt 6 ends the line (stop_allowance_exhausted); no attempt 7; no child', async () => {
                  const s = await heldCalibrationBook(), before = s.frozenCalHeld(), g = await s.presenceGrant(), t = prsTransports(heldCal);
                  expect((await runFreshBookStoryboardPresence({ ...g, transports: t })).status).toBe('held_contradiction');
                  expect([t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([1, 1]);
                  expect(json(path.join(s.authority, PRL.outcomeName))).toMatchObject({ status: 'held_storyboard_presence', textStatus: 'held_contradiction',
                    recovery: 'stop_allowance_exhausted' });
                  expect(json(path.join(prsDir(s), 'recovery-final.json'))).toMatchObject({ terminal: 'stop_allowance_exhausted', remaining: 0, consecutiveFailures: 6,
                    attempt: { attempt: 6, outcome: 'held' } });
                  expect(existsSync(path.join(s.authority, PRL.successorName))).toBe(false);
                  const t2 = prsTransports(calReview());
                  await expect(runFreshBookStoryboardPresence({ ...(await s.presenceGrant('again.json')), transports: t2 })).rejects.toThrow('fresh_book_storyboard_presence_used');
                  expect([t2.planner, t2.responses].map(m => vi.mocked(m).mock.calls.length)).toEqual([0, 0]);
                  providers();
                  await expect(runFreshBookChild({ ...g, storyboardPresence: true })).rejects.toThrow('fresh_book_stage_not_passed');
                  expect(existsSync(path.join(s.config.bookDir, 'child'))).toBe(false);
                  expect(s.frozenCalHeld()).toEqual(before);
                }, 1_200_000);

                it('immutable inputs: the owner\'s continuation record, the held calibration and its lineage, the grant\'s ceiling, contract, compaction or approval, the head or the tree refuse BEFORE the claim or any call', async () => {
                  const cd = (s: HeldC, ...p: string[]) => path.join(calDir(s), ...p);
                  const regrant = <G extends { grantFile: string }>(gr: G) => ({ ...gr, grantSha: sha(readFileSync(gr.grantFile)) });
                  const cases: Record<string, (s: HeldC) => Promise<{ grant: Awaited<ReturnType<HeldC['presenceGrant']>>; expect: RegExp }>> = {
                    'owner record changed': async s => { const gr = await s.presenceGrant(); writeFileSync(s.approval6, readFileSync(s.approval6, 'utf8') + ' ');
                      return { grant: gr, expect: /fresh_book_storyboard_presence_approval/ }; },
                    'calibration outcome no longer at the ceiling': async s => { const gr = await s.presenceGrant();
                      edit(path.join(s.authority, CALL.outcomeName), o => { o.recovery = 'diagnose_and_change_strategy'; });
                      return { grant: gr, expect: /fresh_book_storyboard_presence_calibration/ }; },
                    'its review answer changed': async s => { const gr = await s.presenceGrant();
                      edit(cd(s, 'paid-stages', 'storyboard_review.receipt.json'), r => { const a = JSON.parse(r.raw.output_text), k = Object.keys(a.frames[4])[0];
                        a.frames[4][k].observation += ' (reworded)'; r.raw.output_text = JSON.stringify(a); });
                      return { grant: gr, expect: /fresh_book_storyboard_presence_calibration|fresh_book_ledger/ }; },
                    'its planner answer changed': async s => { const gr = await s.presenceGrant();
                      edit(cd(s, 'claude-max-stages', 'storyboard.receipt.json'), r => { r.output.plan.pages[2].composition += ' changed'; });
                      return { grant: gr, expect: /fresh_book_storyboard_presence_calibration/ }; },
                    'its terminal record changed': async s => { const gr = await s.presenceGrant(); edit(cd(s, 'recovery-final.json'), r => { r.remaining = 1; });
                      return { grant: gr, expect: /fresh_book_storyboard_presence_calibration/ }; },
                    'a calibration successor appeared': async s => { const gr = await s.presenceGrant(); writeFileSync(path.join(s.authority, CALL.successorName), '{}');
                      return { grant: gr, expect: /fresh_book_storyboard_presence_calibration/ }; },
                    'consumed calibration grant bytes changed': async s => { const gr = await s.presenceGrant();
                      writeFileSync(s.cal.grantFile, readFileSync(s.cal.grantFile, 'utf8') + ' ');
                      return { grant: gr, expect: /fresh_book_storyboard_presence_calibration/ }; },
                    'consumed extension revalidation grant bytes changed': async s => { const gr = await s.presenceGrant();
                      writeFileSync(s.xreval.grantFile, readFileSync(s.xreval.grantFile, 'utf8') + ' ');
                      return { grant: gr, expect: /fresh_book_storyboard_(presence_calibration|calibration_extension_revalidation)/ }; },
                    'unknown cost in its review record': async s => { const gr = await s.presenceGrant();
                      edit(cd(s, 'paid-stages', 'storyboard_review.result.json'), r => { r.estimatedMicroUsd = null; });
                      return { grant: gr, expect: /fresh_book_storyboard_presence_(unknown_cost|calibration|recovery)|fresh_book_ledger|audition_meter_cost/ }; },
                    'grant raises the ceiling': async s => { const gr = await s.presenceGrant(); edit(gr.grantFile, x => { x.recovery.maxAttempts = 7; });
                      return { grant: regrant(gr), expect: /fresh_book_storyboard_presence_grant/ }; },
                    'grant drops presence': async s => { const gr = await s.presenceGrant(); edit(gr.grantFile, x => { x.addedContracts = []; });
                      return { grant: regrant(gr), expect: /fresh_book_storyboard_presence_grant/ }; },
                    'grant without the compaction': async s => { const gr = await s.presenceGrant(); edit(gr.grantFile, x => { delete x.plannerSchema; });
                      return { grant: regrant(gr), expect: /fresh_book_storyboard_presence_grant/ }; },
                    'head moved after the grant': async s => { const gr = await s.presenceGrant(); s.setHead('6'.repeat(40));
                      return { grant: gr, expect: /fresh_book_storyboard_presence_grant|fresh_book_source_changed/ }; },
                    'dirty tree': async s => { const gr = await s.presenceGrant(); s.setClean(false); return { grant: gr, expect: /fresh_book_source_changed/ }; },
                  };
                  for (const [name, mutate] of Object.entries(cases)) {
                    const s = await heldCalibrationBook(), t = prsTransports(calReview());
                    let c: Awaited<ReturnType<typeof mutate>>;
                    try { c = await mutate(s); } catch (e) { throw new Error(`${name}: ${e}`); }
                    await expect(runFreshBookStoryboardPresence({ ...c.grant, transports: t }), name).rejects.toThrow(c.expect);
                    expect([name, existsSync(path.join(s.authority, PRL.claimName)), existsSync(prsDir(s)),
                      ...[t.opus, t.reader, t.planner, t.responses].map(m => vi.mocked(m).mock.calls.length)]).toEqual([name, false, false, 0, 0, 0, 0]);
                  }
                  // The plan needs the owner's continuation record by absolute path, with its verbatim line (the calibration's record is not this one).
                  const s = await heldCalibrationBook();
                  await expect(planFreshBookStoryboardPresence(s.config, s.env, s.cal.grantFile, s.approval5)).rejects.toThrow('fresh_book_storyboard_presence_approval');
                  await expect(planFreshBookStoryboardPresence(s.config, s.env, s.cal.grantFile, 'OWNER-CONTINUATION-6.txt')).rejects.toThrow('fresh_book_storyboard_presence_approval');
                  expect(() => assertReviewFloorFits({ bookKnownMicroUsd: 6_400_001, nextCapMicroUsd: 7_000_000 }, 'fresh_book_storyboard_presence_budget'))
                    .toThrow('fresh_book_storyboard_presence_budget');
                }, 3_600_000);  // fifteen whole held chains (text through the calibration), each built from scratch

                it('a changed presence successor (its draft, its terminal record, its planner output) refuses the child BEFORE its folder, key or render', async () => {
                  for (const kind of ['draft', 'recovery_final', 'planner_output']) {
                    const s = await heldCalibrationBook(), g = await s.presenceGrant();
                    expect((await runFreshBookStoryboardPresence({ ...g, transports: prsTransports(calReview()) })).status).toBe('review_supported');
                    if (kind === 'draft') edit(path.join(prsDir(s), 'owned_storyboard_draft.json'), d => { d.plan.pages[2].composition += ' changed'; });
                    else if (kind === 'recovery_final') edit(path.join(prsDir(s), 'recovery-final.json'), r => { r.terminal = 'stop_allowance_exhausted'; });
                    else edit(path.join(prsDir(s), 'claude-max-stages', 'storyboard.receipt.json'), r => { r.output.plan.pages[2].composition += ' changed'; });
                    providers();
                    await expect(runFreshBookChild({ ...g, storyboardPresence: true }), kind).rejects.toThrow(/fresh_book_storyboard_presence_(successor|grant)/);
                    expect([kind, vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length, existsSync(path.join(s.config.bookDir, 'child'))])
                      .toEqual([kind, 0, 0, false]);
                    vi.restoreAllMocks();
                  }
                }, 1_200_000);

                // -------------------------------------------------------------------------------------------------------------------------------
                // The ONE owner-approved child recovery (2026-10-21): the presence attempt admitted, its own child stage held the anchor with only the
                // hands unreadable; ONE correction under child-anchor-visible-pose/v1 and its two reviews, then the book. The held chain is built ONCE
                // (under materiality, as the actual book) and restored byte-exact before every case.
                // -------------------------------------------------------------------------------------------------------------------------------
                describe('the ONE owner-approved child recovery (after the presence line held its child anchor on the hidden hands)', () => {
                  const CRL = FRESH_BOOK_CHILD_RECOVERY;
                  const crDir = (s: { config: FreshBookConfig }) => path.join(s.config.bookDir, CRL.folder);
                  const JUDGE_TEXT = 'JUDGE TEXT: take both hands out of the pockets';
                  const STYLE_TAIL = 'Refined semi-naturalistic Style 01 watercolor, natural eye scale, no mascot, chibi, flat-cartoon or photographic treatment.';
                  /**
                   * providers() with the child-anchor judges under materiality: style answers from a queue (then passed); the design answer of a request whose
                   * view binds the pose clause (the recovery's) as `corrected`, otherwise (the presence child stage's) a hold whose only unresolved evidence is
                   * the hidden hands (or, `held: 'face'`, an unreadable face), beside a slight-smile scene defect and a cosmetic hair difference. The held
                   * child's stage (`held` given) draws its fake images from shade 40, every recovery-time run from 150 (an unchanged edit is refused by the
                   * engine, as it should be).
                   */
                  const judges = (mode: { style?: ('defect' | 'unassessable')[]; held?: 'hands' | 'face'; corrected?: 'pass' | 'hidden'; shade?: number } = {}) => {
                    providers(mode.shade ?? (mode.held ? 40 : 150));
                    const base = sdk.create.getMockImplementation()!, styles = [...(mode.style ?? [])];
                    sdk.create.mockImplementation(async (payload: any) => {
                      const name: string = payload.text.format.name, text = JSON.parse(payload.input[0].content[0].text);
                      const reply = (value: unknown) => ({ model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', usage: { input_tokens: 5000, output_tokens: 800 },
                        output_text: JSON.stringify(value) });
                      if (name === 'child_anchor_style_materiality_v1') { const kind = styles.shift();
                        return reply({ candidateSha: text.candidateSha, contextSha: text.contextSha, recipeSha: text.recipeSha, assessable: kind !== 'unassessable',
                          style01Match: kind === undefined, looksPhotoreal: false, looksPortrait: false, notes: kind === 'defect' ? 'oversized eyes.' : 'watercolor' }); }
                      if (name !== 'child_anchor_design_materiality_v1') return base(payload);
                      const posed = text.context.view.poseContract !== undefined;
                      const unreadable = posed ? (mode.corrected === 'hidden' ? ['hands'] : []) : [mode.held === 'face' ? 'face' : 'hands'];
                      return reply({ candidateSha: text.candidateSha, contextSha: text.contextSha, recipeSha: text.recipeSha, acceptanceVersion: CHILD_ANCHOR_MATERIALITY_VERSION,
                        checks: passChecks().map(c => c.category === 'identity' && unreadable.length ? { ...c, verdict: 'uncertain', correction: JUDGE_TEXT }
                          : c.category === 'scene' && !posed ? { ...c, verdict: 'defect', correction: 'relax the mouth corners into a neutral rest' } : c),
                        apparentAge: { requestedAge: text.apparentAge.requestedAge, verdict: 'compatible', observation: 'reads the age', correction: '' },
                        visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => unreadable.includes(aspect)
                          ? { aspect, verdict: 'unreadable', observation: `${aspect} not shown`, materiality: 'not_applicable', deviation: '' }
                          : aspect === 'hair' ? { aspect, verdict: 'mismatch', observation: 'a tousled fringe', materiality: 'cosmetic', deviation: 'tousled rather than smooth' }
                          : { aspect, verdict: 'matched', observation: `${aspect} seen`, materiality: 'not_applicable', deviation: '' }),
                        unobservedConditional: [], recognizableCharacter: { verdict: 'same_character', observation: 'the same written child' } });
                    });
                  };
                  /** The presence attempt admitted, its own child stage held (hands hidden), then a NEW reviewed head and the owner's recovery record. */
                  async function heldChildBook(held: 'hands' | 'face' = 'hands') {
                    MATERIALITY = true;
                    try {
                      const s = await heldCalibrationBook(), g = await s.presenceGrant();
                      expect((await runFreshBookStoryboardPresence({ ...g, transports: prsTransports(calReview(settingNote)) })).status).toBe('review_supported_with_notes');
                      judges({ style: ['defect'], held });
                      expect(await runFreshBookChild({ ...g, storyboardPresence: true })).toEqual({ status: 'child_reference_held', disposition: 'held_uncertain' });
                      expect(json(path.join(s.authority, PRL.outcomeName))).toMatchObject({ status: 'held_child', disposition: 'held_uncertain' });
                      vi.restoreAllMocks(); vi.unstubAllGlobals();
                      s.setHead('5'.repeat(40));
                      const approval = path.join(s.root, 'OWNER-CHILD-RECOVERY.txt');
                      writeFileSync(approval, `Synthetic owner record (test only).\n${CRL.approvalLine}\n`);
                      const recoveryGrant = async (name = 'child-recovery-grant.json') => {
                        const gr = (await planFreshBookChildRecovery(s.config, s.env, g.grantFile, approval)).grantDraft, file = path.join(s.root, name);
                        writeFileSync(file, JSON.stringify(gr)); return { ...s.original, grantFile: file, grantSha: sha(readFileSync(file)) }; };
                      const frozenHeldChild = () => ({ ...s.frozenCalHeld(), presence: tree(prsDir(s)), child: tree(path.join(s.config.bookDir, 'child')),
                        presenceGrant: sha(readFileSync(g.grantFile)), approval: sha(readFileSync(approval)),
                        ...Object.fromEntries([PRL.claimName, PRL.outcomeName, PRL.successorName].map(n => [n, sha(readFileSync(path.join(s.authority, n)))])) });
                      return { ...s, g, approval, recoveryGrant, frozenHeldChild };
                    } finally { MATERIALITY = false; }
                  }
                  let base: Awaited<ReturnType<typeof heldChildBook>>, pristine = '';
                  beforeAll(async () => {
                    f = await personalStoryboardFixture();
                    sdk.create.mockReset(); vi.stubGlobal('fetch', vi.fn(() => { throw Error('no network in the recovery rehearsal'); }));
                    base = await heldChildBook();
                    roots.splice(roots.indexOf(base.root), 1);
                    pristine = `${base.root}-pristine`; cpSync(base.root, pristine, { recursive: true });
                  }, 1_200_000);
                  afterAll(() => { for (const d of [base?.root, pristine]) if (d) rmSync(d, { recursive: true, force: true }); });
                  /** The held chain exactly as built (every byte), at the recovery's reviewed head, clean. */
                  // A test that timed out keeps running in the background; it must never restore or mutate the shared chain under a later test.
                  let epoch = 0, current = 0;
                  beforeEach(() => { current = ++epoch; });
                  const owned = () => { const mine = current; return () => { if (mine !== epoch) throw new Error('a timed-out test touched the shared chain'); }; };
                  const fresh = (still = owned()) => { still(); rmSync(base.root, { recursive: true, force: true }); cpSync(pristine, base.root, { recursive: true });
                    base.setHead('5'.repeat(40)); base.setClean(true); return base; };
                  const heldChildDir = (s: typeof base, ...p: string[]) => path.join(s.config.bookDir, 'child', ...p);

                  it('positive: the held answers recover typed (hands only); ONE LOW edit of the held candidate under the pose clause and TWO reviews bound to the pose context pass; successor; the book on its own line', async () => {
                    const s = fresh(), before = s.frozenHeldChild(), cr = await s.recoveryGrant();
                    const planned = await planFreshBookChildRecovery(s.config, s.env, s.g.grantFile, s.approval), g = planned.grantDraft;
                    const candidate = json(heldChildDir(s, 'paid-stages', 'reference_child.receipt.json')).candidate.imageSha;
                    expect(g.held).toEqual({ folderSha256: sha(canonicalJson(folderBaseline(heldChildDir(s)))), sealSha256: sha(readFileSync(heldChildDir(s, 'sealed.json'))),
                      candidateSha256: candidate, recipeSha256: json(heldChildDir(s, 'reference_child_design_review.json')).recipeSha,
                      contextSha256: childAnchorInspectionContextSha(json(heldChildDir(s, 'context.json'))), style: 'defect', design: 'held_uncertain', disposition: 'held_uncertain' });
                    expect(g.recovery).toMatchObject({ version: CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION, pose: CHILD_ANCHOR_POSE_VERSION, aspects: ['hands'],
                      corrections: ['scene: relax the mouth corners into a neutral rest', `style: oversized eyes. ${STYLE_TAIL}`, childAnchorVisibilityCorrection('hands')] });
                    expect(g.recovery.corrections.join('\n')).not.toContain(JUDGE_TEXT);
                    expect([g.presence.grantSha256, g.presence.storyboardDigest]).toEqual([s.g.grantSha, json(path.join(s.authority, PRL.successorName)).storyboardDigest]);
                    expect([g.allowance, g.ledger.calls, planned.plan.providerCalls, planned.plan.keyRead, planned.state.claimExists, planned.state.folderExists,
                      planned.state.layoutExists]).toEqual([{ apiCalls: 3, editCalls: 1, reviewCalls: 2, reviewReserveMicroUsd: 600000 }, 12, 0, false, false, false, false]);
                    expect((await planFreshBookChildRecovery(s.config, s.env, s.g.grantFile, s.approval)).grantDraft).toEqual(g);
                    judges({ corrected: 'pass' });
                    expect(await runFreshBookChildRecovery(cr)).toMatchObject({ status: 'child_reference_passed' });
                    // Exactly ONE edit (the held candidate's bytes, the rejected edit target only) and TWO reviews bound to the pose context and the frozen recipe.
                    const edits = vi.mocked(images.generateGPTImage).mock.calls, dir = crDir(s);
                    expect([edits.length, sdk.create.mock.calls.length, claims(path.join(dir, 'paid-stages'))]).toEqual([1, 2, [...CRL.steps].sort()]);
                    expect(edits[0][0]).toMatchObject({ referenceMode: 'book_design', referenceRoles: ['rejected_edit_target'], quality: 'low', size: '1024x1024', modelOverride: 'gpt-image-2' });
                    expect([edits[0][0].exactReferenceBytes!.map(b => sha(b)), sha(edits[0][0].finalPrompt)]).toEqual([[candidate], g.recovery.correctionPromptSha256]);
                    const texts = sdk.create.mock.calls.map(c => JSON.parse((c[0] as any).input[0].content[0].text));
                    expect(texts.map(t => [t.contextSha, t.recipeSha])).toEqual([[g.recovery.contextSha256, g.recovery.recipeSha256], [g.recovery.contextSha256, g.recovery.recipeSha256]]);
                    expect(texts[1].context.view.poseContract.clauseSha256).toBe(CHILD_ANCHOR_POSE_CLAUSE_SHA256);
                    // The durable records.
                    expect(sha(readFileSync(path.join(dir, 'illustrations', 'reference_child.png')))).toBe(candidate);
                    expect(json(path.join(dir, 'reference_child_correction_input.json'))).toEqual({ candidate: { imageName: 'reference_child.png', imageSha: candidate },
                      corrections: g.recovery.corrections, recovery: { version: CHILD_ANCHOR_VISIBILITY_RECOVERY_VERSION, pose: CHILD_ANCHOR_POSE_VERSION, aspects: ['hands'] },
                      authority: 'rejected_edit_input_only_not_canonical' });
                    expect(json(path.join(dir, CHILD_RECOVERY_ADMISSION_FILE))).toMatchObject({ version: CRL.version, grantSha256: cr.grantSha, held: g.held, recovery: g.recovery });
                    expect(json(path.join(dir, 'sealed.json'))).toMatchObject({ status: 'child_reference_passed', contextSha: g.recovery.contextSha256,
                      childAnchor: CHILD_ANCHOR_MATERIALITY_VERSION, childAnchorPose: CHILD_ANCHOR_POSE_VERSION, acceptedDeviations: [expect.objectContaining({ aspect: 'hair' })],
                      runtimeEligible: false });
                    expect(json(path.join(s.config.bookDir, 'book-layout.json'))).toMatchObject({ storyboardDir: PRL.folder, childDir: CRL.folder, childImage: 'reference_child_repair.png',
                      childAnchor: CHILD_ANCHOR_MATERIALITY_VERSION, childAnchorPose: CHILD_ANCHOR_POSE_VERSION });
                    expect(json(path.join(s.authority, CRL.successorName))).toMatchObject({ grantSha256: cr.grantSha, presenceGrantSha256: s.g.grantSha, heldCandidateSha256: candidate,
                      recovery: { aspects: ['hands'] }, contextSha256: g.recovery.contextSha256, recipeSha256: g.recovery.recipeSha256 });
                    expect(s.frozenHeldChild()).toEqual(before);
                    // Once only (no fresh render, no second edit); the presence line's own downstream stays closed.
                    await expect(runFreshBookChildRecovery(cr)).rejects.toThrow(/fresh_book_child_recovery_(used|grant)|fresh_book_roots_changed/);
                    await expect(runFreshBookChildRecovery(await s.recoveryGrant('relabelled.json'))).rejects.toThrow(/fresh_book_child_recovery_(used|grant)/);
                    expect(vi.mocked(images.generateGPTImage).mock.calls.length).toBe(1);
                    await expect(runFreshBookBook({ ...s.g, storyboardPresence: true })).rejects.toThrow(/fresh_book_(stage_not_passed|storyboard_presence_grant|source_changed)/);
                    // The book on the recovery line: its own ledger, layout, claim and outcome.
                    const book = await runFreshBookBook({ ...cr, childRecovery: true });
                    expect(book.status).toBe('complete');
                    expect(book.ledger.stages.map(x => [x.name, x.calls]).slice(-3)).toEqual([['child', 3], [CRL.folder, 3], ['audition', expect.any(Number)]]);
                    expect(json(path.join(s.config.bookDir, 'audition.grant.json'))).toMatchObject({ scope: { recovery: 'stage-recovery/v1' },
                      experiment: { claimSha256: sha(readFileSync(path.join(s.authority, CRL.claimName))) } });
                    expect(json(path.join(s.authority, CRL.outcomeName)).status).toBe('complete');
                    expect(s.frozenHeldChild()).toEqual(before);
                  }, 1_200_000);

                  it('held: a corrected candidate that still hides the hands, or an unassessable style, ends the line with its own record; no layout, successor, second edit or book', async () => {
                    const still = owned();
                    for (const kind of ['hidden', 'unassessable'] as const) {
                      const s = fresh(still), before = s.frozenHeldChild(), cr = await s.recoveryGrant();
                      still();
                      judges(kind === 'hidden' ? { corrected: 'hidden' } : { style: ['unassessable'] });
                      expect(await runFreshBookChildRecovery(cr), kind).toMatchObject({ status: 'child_reference_held', disposition: 'held_uncertain' });
                      expect([kind, vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length]).toEqual([kind, 1, kind === 'hidden' ? 2 : 1]);
                      expect(json(path.join(s.authority, CRL.outcomeName))).toMatchObject({ status: 'held_child_recovery', disposition: 'held_uncertain' });
                      expect(json(path.join(crDir(s), 'sealed.json'))).toMatchObject({ status: 'child_reference_held', childAnchorPose: CHILD_ANCHOR_POSE_VERSION, runtimeEligible: false });
                      expect([path.join(s.config.bookDir, 'book-layout.json'), path.join(s.authority, CRL.successorName), path.join(crDir(s), 'reference_child_adoption.json')]
                        .map(p => existsSync(p))).toEqual([false, false, false]);
                      await expect(runFreshBookChildRecovery(cr)).rejects.toThrow('fresh_book_child_recovery_used');
                      await expect(runFreshBookBook({ ...cr, childRecovery: true })).rejects.toThrow('fresh_book_stage_not_passed');
                      expect([vi.mocked(images.generateGPTImage).mock.calls.length, existsSync(path.join(s.config.bookDir, 'audition'))]).toEqual([1, false]);
                      expect(s.frozenHeldChild()).toEqual(before);
                      vi.restoreAllMocks();
                    }
                    // An edit that returns the held bytes unchanged is refused before any review: the line ends failed, nothing adopted.
                    const s = fresh(still), cr = await s.recoveryGrant();
                    still();
                    judges({ corrected: 'pass', shade: 40 });
                    await expect(runFreshBookChildRecovery(cr)).rejects.toThrow('fresh_book_child_repair_unchanged');
                    expect([vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length, json(path.join(s.authority, CRL.outcomeName)).status,
                      json(path.join(crDir(s), 'sealed.json')).status, existsSync(path.join(s.config.bookDir, 'book-layout.json'))])
                      .toEqual([1, 0, 'failed_child_recovery', 'failed', false]);
                  }, 600_000);

                  it('immutable inputs: the owner record, the presence chain, its admitted storyboard and terminal record, the held child, the grant, the head or the tree refuse BEFORE the claim or any call', async () => {
                    const regrant = <G extends { grantFile: string }>(gr: G) => ({ ...gr, grantSha: sha(readFileSync(gr.grantFile)) });
                    type Case = (s: typeof base) => Promise<{ grant: Awaited<ReturnType<typeof base.recoveryGrant>>; expect: RegExp }>;
                    const cases: Record<string, Case> = {
                      'owner record changed': async s => { const gr = await s.recoveryGrant(); writeFileSync(s.approval, readFileSync(s.approval, 'utf8') + ' ');
                        return { grant: gr, expect: /fresh_book_child_recovery_approval/ }; },
                      'held child saved review changed': async s => { const gr = await s.recoveryGrant();
                        edit(heldChildDir(s, 'reference_child_design_review.json'), r => { r.visibleEvidence[5].observation += ' (reworded)'; });
                        return { grant: gr, expect: /fresh_book_child_recovery_presence/ }; },
                      'held child paid answer changed': async s => { const gr = await s.recoveryGrant();
                        edit(heldChildDir(s, 'paid-stages', 'reference_child_qa.receipt.json'), r => { const a = JSON.parse(r.raw.output_text);
                          a.visibleEvidence.find((e: any) => e.aspect === 'hands').observation = 'the hands partly seen'; r.raw.output_text = JSON.stringify(a); });
                        return { grant: gr, expect: /fresh_book_child_recovery_presence/ }; },
                      'held child image changed': async s => { const gr = await s.recoveryGrant();
                        writeFileSync(heldChildDir(s, 'illustrations', 'reference_child.png'), await png(200, 1024));
                        return { grant: gr, expect: /child_anchor_render_binding|fresh_book_child_recovery_presence/ }; },
                      'held child seal changed': async s => { const gr = await s.recoveryGrant(); edit(heldChildDir(s, 'sealed.json'), x => { x.disposition = 'repair'; });
                        return { grant: gr, expect: /fresh_book_child_recovery_presence/ }; },
                      'presence terminal record changed': async s => { const gr = await s.recoveryGrant();
                        edit(path.join(s.authority, PRL.outcomeName), o => { o.disposition = 'repair'; });
                        return { grant: gr, expect: /fresh_book_child_recovery_presence/ }; },
                      'presence successor record changed': async s => { const gr = await s.recoveryGrant();
                        edit(path.join(s.authority, PRL.successorName), x => { x.notes = 0; });
                        return { grant: gr, expect: /fresh_book_storyboard_presence_successor/ }; },
                      'presence storyboard changed': async s => { const gr = await s.recoveryGrant();
                        edit(path.join(prsDir(s), 'owned_storyboard_draft.json'), d => { d.plan.pages[2].composition += ' changed'; });
                        return { grant: gr, expect: /fresh_book_storyboard_presence_successor/ }; },
                      'consumed presence grant bytes changed': async s => { const gr = await s.recoveryGrant();
                        writeFileSync(s.g.grantFile, readFileSync(s.g.grantFile, 'utf8') + ' ');
                        return { grant: gr, expect: /fresh_book_child_recovery_presence/ }; },
                      'a presence audition start appeared': async s => { const gr = await s.recoveryGrant(); writeFileSync(path.join(s.authority, PRL.auditionStartName), '{}');
                        return { grant: gr, expect: /fresh_book_child_recovery_presence/ }; },
                      'grant widens the corrections': async s => { const gr = await s.recoveryGrant();
                        edit(gr.grantFile, x => { x.recovery.corrections.push('identity: redraw the child'); });
                        return { grant: regrant(gr), expect: /fresh_book_child_recovery_grant/ }; },
                      'grant adds an aspect': async s => { const gr = await s.recoveryGrant(); edit(gr.grantFile, x => { x.recovery.aspects.push('wardrobe'); });
                        return { grant: regrant(gr), expect: /fresh_book_child_recovery_grant/ }; },
                      'grant rebinds the context': async s => { const gr = await s.recoveryGrant(); edit(gr.grantFile, x => { x.recovery.contextSha256 = 'c'.repeat(64); });
                        return { grant: regrant(gr), expect: /fresh_book_child_recovery_grant/ }; },
                      'grant lowers the ledger': async s => { const gr = await s.recoveryGrant(); edit(gr.grantFile, x => { x.ledger.bookKnownMicroUsd -= 1; });
                        return { grant: regrant(gr), expect: /fresh_book_child_recovery_grant/ }; },
                      'a recovery folder already present': async s => { const gr = await s.recoveryGrant(); mkdirSync(crDir(s));
                        return { grant: gr, expect: /fresh_book_child_recovery_used/ }; },
                      'head moved after the grant': async s => { const gr = await s.recoveryGrant(); s.setHead('4'.repeat(40));
                        return { grant: gr, expect: /fresh_book_child_recovery_grant|fresh_book_source_changed/ }; },
                      'dirty tree': async s => { const gr = await s.recoveryGrant(); s.setClean(false); return { grant: gr, expect: /fresh_book_source_changed/ }; },
                    };
                    const still = owned();
                    for (const [name, mutate] of Object.entries(cases)) {
                      const s = fresh(still); judges({ corrected: 'pass' });
                      let c: Awaited<ReturnType<Case>>;
                      try { c = await mutate(s); } catch (e) { throw new Error(`${name}: ${e}`); }
                      still();
                      await expect(runFreshBookChildRecovery(c.grant), name).rejects.toThrow(c.expect);
                      expect([name, existsSync(path.join(s.authority, CRL.claimName)), existsSync(path.join(crDir(s), 'paid-stages')),
                        vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length]).toEqual([name, false, false, 0, 0]);
                      vi.restoreAllMocks();
                    }
                    // The plan needs the owner's recovery record by absolute path, with its verbatim line (the presence line's record is not this one).
                    const s = fresh(still);
                    await expect(planFreshBookChildRecovery(s.config, s.env, s.g.grantFile, s.approval6)).rejects.toThrow('fresh_book_child_recovery_approval');
                    await expect(planFreshBookChildRecovery(s.config, s.env, s.g.grantFile, 'OWNER-CHILD-RECOVERY.txt')).rejects.toThrow('fresh_book_child_recovery_approval');
                    await expect(planFreshBookChildRecovery(s.config, s.env, s.cal.grantFile, s.approval)).rejects.toThrow('fresh_book_child_recovery_presence');
                  }, 1_200_000);

                  it('a changed recovered child (its adoption, correction record, edit input, review record, spend or the layout) refuses the book BEFORE the audition', async () => {
                    const kinds: Record<string, (s: typeof base) => void | Promise<void>> = {
                      adoption: s => edit(path.join(crDir(s), 'reference_child_adoption.json'), a => { a.authority = 'owner_override'; }),
                      correction_input: s => edit(path.join(crDir(s), 'reference_child_correction_input.json'), c => { c.corrections.push('identity: redraw the child'); }),
                      edit_input: async s => writeFileSync(path.join(crDir(s), 'illustrations', 'reference_child.png'), await png(201, 1024)),
                      review_record: s => edit(path.join(crDir(s), 'reference_child_repair_design_review.json'), r => { r.visibleEvidence[0].observation += ' (reworded)'; }),
                      spend: s => edit(path.join(crDir(s), 'spend.json'), x => { x.newKnownApiMicroUsd -= 1; }),
                      layout: s => edit(path.join(s.config.bookDir, 'book-layout.json'), l => { delete l.childAnchorPose; }),
                    };
                    const still = owned();
                    for (const [kind, tamper] of Object.entries(kinds)) {
                      const s = fresh(still), cr = await s.recoveryGrant(); judges({ corrected: 'pass' });
                      still();
                      expect((await runFreshBookChildRecovery(cr)).status, kind).toBe('child_reference_passed');
                      still();
                      await tamper(s);
                      const renders = vi.mocked(images.generateGPTImage).mock.calls.length;
                      await expect(runFreshBookBook({ ...cr, childRecovery: true }), kind).rejects.toThrow('fresh_book_child_recovery_successor');
                      expect([kind, vi.mocked(images.generateGPTImage).mock.calls.length - renders, existsSync(path.join(s.config.bookDir, 'audition')),
                        existsSync(path.join(s.config.bookDir, 'audition.grant.json'))]).toEqual([kind, 0, false, false]);
                      vi.restoreAllMocks();
                    }
                  }, 1_200_000);

                  it('a hold that is not visibility-only (an unreadable face) is never planned as a recovery: no grant, claim, folder or call', async () => {
                    const s = await heldChildBook('face');
                    await expect(planFreshBookChildRecovery(s.config, s.env, s.g.grantFile, s.approval)).rejects.toThrow('fresh_book_child_recovery_not_visibility');
                    expect([existsSync(path.join(s.authority, CRL.claimName)), existsSync(crDir(s))]).toEqual([false, false]);
                  }, 1_200_000);
                });
              });
            });
          });

          it('a changed extension successor (its planner output, its recovery records) or the owner\'s record refuses the child BEFORE its folder, key or render', async () => {
            for (const kind of ['planner_output', 'recovery_state', 'recovery_final', 'approval']) {
              const s = await heldRevalidationBook(), g = await s.extensionGrant();
              expect((await runFreshBookStoryboardExtension({ ...g, transports: extTransports(basisReview()) })).status).toBe('review_supported');
              const dir = extDir(s);
              if (kind === 'planner_output') edit(path.join(dir, 'claude-max-stages', 'storyboard.receipt.json'), r => { r.output.plan.pages[2].composition += ' changed'; });
              else if (kind === 'recovery_state') edit(path.join(dir, 'recovery-state.json'), r => { r.maxAttempts = 5; });
              else if (kind === 'recovery_final') edit(path.join(dir, 'recovery-final.json'), r => { r.terminal = 'stop_allowance_exhausted'; });
              else writeFileSync(s.approvalFile, readFileSync(s.approvalFile, 'utf8') + ' ');
              providers();
              await expect(runFreshBookChild({ ...g, storyboardExtension: true }), kind).rejects.toThrow(/fresh_book_storyboard_extension_(successor|approval)/);
              expect([kind, vi.mocked(images.generateGPTImage).mock.calls.length, sdk.create.mock.calls.length, existsSync(path.join(s.config.bookDir, 'child'))])
                .toEqual([kind, 0, 0, false]);
              vi.restoreAllMocks();
            }
          }, 900_000);
        });
      });
    });
  });
});

describe.skipIf(!existsSync(REAL_CONFIG) || !existsSync(REAL_GRANT))('the actual saved failed book: recovery dry plan (read only, no key, no provider, no write)', () => {
  it('binds the consumed original grant/claim/outcome/seal and the known ledger; the ONE recovery is consumed (held), its records intact', () => {
    const config = freshBookConfig(REAL_CONFIG), env = realFreshBookEnv(), book = tree(config.bookDir);
    const { plan, grantDraft, state } = planFreshBookRecovery(config, env, REAL_GRANT);
    expect(grantDraft.original.grantSha256).toBe('fc6db297bfa344f7bcbc97dda1c6e1b39e0d23226557960be02bdfc52c9a41d3');
    expect(grantDraft.original.engineHead).toBe('96dedda4b958535c79a90f1627936dfa560ae5d4');
    expect(grantDraft.ledger).toEqual({ diagnosticSettledMicroUsd: 128930, originalTextKnownMicroUsd: 36450, originalTextCalls: 2 });
    // Ran once on 2026-10-18 under its grant (199c512c...): claimed, held by its storyboard review, no successor; both stages re-derive as recorded.
    expect([plan.providerCalls, plan.keyRead, state.recoveryClaimExists, state.recoveryOutcomeExists, state.recoveryFolderExists, state.successorExists])
      .toEqual([0, false, true, true, true, false]);
    expect((state.ledger as any).stages.slice(0, 2)).toEqual([{ name: 'text', knownMicroUsd: 36450, calls: 2 }, { name: 'text-recovery', knownMicroUsd: 65138, calls: 2 }]);
    expect(tree(config.bookDir)).toEqual(book);
  });
});

const REAL_RECOVERY_GRANT = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/f4-text-recovery/fresh-book-recovery-grant-STAGED-da2b5841.json';
describe.skipIf(!existsSync(REAL_CONFIG) || !existsSync(REAL_RECOVERY_GRANT))('the actual held recovery: storyboard-repair dry plan and preview (read only, no key, no provider, no write)', () => {
  const authority = () => Object.fromEntries(readdirSync(FRESH_BOOK_CYCLE.authorityRoot).filter(n => n.includes('fresh-book-usd7'))
    .map(n => [n, sha(readFileSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, n)))]));
  it('re-derives the held storyboard from its paid answers; all 6 findings reach the planner request, which fits every limit', async () => {
    const config = freshBookConfig(REAL_CONFIG), env = realFreshBookEnv(), book = tree(config.bookDir), records = authority();
    const { plan, grantDraft, repair } = planFreshBookStoryboardRepair(config, env, REAL_RECOVERY_GRANT);
    expect(grantDraft.recovery).toMatchObject({ grantSha256: '199c512cb49368bdd2d5bb2707b901c7bac35c42377cdeaecca48ddf9264500e',
      originalClaimSha256: '96ef1b42631c32f9c5158f7b2a771f09a3080b2371e2c2bf030dd6d07d1a245b' });
    expect(grantDraft.held).toEqual({ sourceDigest: '2471486f4f680f7675e7ddf430bc1553ded9324a812b271409c1afe546b51474',
      storyboardDigest: 'ffd560995dd831e138a223c90eedc344c7b4fae330aed5c88c76c76774f28624', reviewDigest: '3769368a95eab4a3ae8ee5113b56b66878fa6ef71340d47a6ef9b7be667a47d7',
      disposition: 'held_uncertain', draftSha256: '37a35d16368010189de3204bd2cecf241947d8e8f6ee2cd71c4b29eab374b3e9', findings: 6 });
    expect(grantDraft.ledger).toEqual({ diagnosticSettledMicroUsd: 128930, bookKnownMicroUsd: 101588, calls: 4 });
    expect([plan.providerCalls, plan.keyRead, grantDraft.allowance]).toEqual([0, false, { plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 }]);
    const preview = await previewFreshBookStoryboardRepair(config, repair);
    expect(preview).toMatchObject({ findings: 6, contentByteLimit: 104000, wireByteLimit: 104000, sessionGuardMicroUsd: 2000000 });
    expect([preview.contentBytes <= preview.contentByteLimit, preview.wireBytes <= preview.wireByteLimit, preview.reservedMicroUsd <= preview.sessionGuardMicroUsd])
      .toEqual([true, true, true]);
    expect([tree(config.bookDir), authority()]).toEqual([book, records]);
  });
  it.skipIf(existsSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, FRESH_BOOK_STORYBOARD_REPAIR.claimName)))('before its one run: nothing claimed, and the balance covers the review floor', () => {
    const config = freshBookConfig(REAL_CONFIG), env = realFreshBookEnv(), { state } = planFreshBookStoryboardRepair(config, env, REAL_RECOVERY_GRANT);
    expect([state.claimExists, state.outcomeExists, state.successorExists, state.folderExists]).toEqual([false, false, false, false]);
    expect(state.reviewFloor).toEqual({ remainingMicroUsd: 6898412, reviewFloorMicroUsd: 600000 });
  });
});

const REAL_REPAIR_GRANT = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/f7-original-lineage/fresh-book-storyboard-repair-grant-STAGED-9cda8e37.json';
describe.skipIf(!existsSync(REAL_CONFIG) || !existsSync(REAL_REPAIR_GRANT))('the actual held repair: diagnosed continuation dry plan and preview (read only, no key, no provider, no write)', () => {
  const authority = () => Object.fromEntries(readdirSync(FRESH_BOOK_CYCLE.authorityRoot).filter(n => n.includes('fresh-book-usd7'))
    .map(n => [n, sha(readFileSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, n)))]));
  it('imports the two historical held candidates, derives the diagnosis from the saved evidence, and the ONE planner request fits every limit', async () => {
    const config = freshBookConfig(REAL_CONFIG), env = realFreshBookEnv(), book = tree(config.bookDir), records = authority();
    const { plan, grantDraft, continuation, recoveryRecord, diagnosisRecord } = planFreshBookStoryboardContinuation(config, env, REAL_REPAIR_GRANT);
    // The consumed repair authority and its held candidate, exactly as the owner amendment records them.
    expect(grantDraft.repair).toMatchObject({ grantSha256: '999accd51d1057215c890df402577ae501f04614e0e730bd6fafcc2a4ed564ef',
      reviewReceiptSha256: 'c5a62c0fa38b753592d8f7fffbdc3310d892eadcb835f8b4beea6e15ff009046',
      originalClaimSha256: '96ef1b42631c32f9c5158f7b2a771f09a3080b2371e2c2bf030dd6d07d1a245b' });
    expect(grantDraft.held).toMatchObject({ sourceDigest: '455259ad42ffd0ce8c7a8bbb7009d254dddc195832243f2e45223109aa2aa6ce',
      storyboardDigest: '4f3d55d9bc700940dd6dadefd21e55480745a5ea843948794707998483526a1c', disposition: 'held_uncertain', findings: 6 });
    expect(grantDraft.ledger).toEqual({ diagnosticSettledMicroUsd: 128930, bookKnownMicroUsd: 155406, calls: 5 });
    expect([plan.providerCalls, plan.keyRead, grantDraft.allowance]).toEqual([0, false, { plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 }]);
    // The engine's recovery state: two consecutive held candidates (their own contexts and costs), diagnosis required, one attempt left.
    expect(recoveryRecord).toMatchObject({ mode: 'diagnose_and_change_strategy', consecutiveFailures: 2, remaining: 1, maxAttempts: 3 });
    expect(recoveryRecord.attempts.map(a => [a.line, a.storyboardDigest.slice(0, 8), a.findings.length, a.costs])).toEqual([
      ['text-recovery', 'ffd56099', 6, { plannerClaudeMaxMicroUsd: 623664, reviewApiMicroUsd: 60226 }],
      ['storyboard-repair', '4f3d55d9', 6, { plannerClaudeMaxMicroUsd: 501261, reviewApiMicroUsd: 53818 }]]);
    expect(recoveryRecord.attempts[0].contextDigest).not.toBe(recoveryRecord.attempts[1].contextDigest);
    const d = diagnosisRecord.diagnosis;
    expect(d.findings.map(f => [f.key, f.trajectory])).toEqual([['book:manuscript_fidelity', 'repeated_check_new_detail'], ['book:continuity', 'repeated_check_new_detail'],
      ['page:4:physical_state', 'repeated_check_new_detail'], ['page:6:physical_state', 'new'], ['page:8:moment', 'new'], ['page:8:identity_and_set', 'new']]);
    expect(d.resolved.map(f => f.key)).toEqual(['page:3:physical_state', 'page:7:moment', 'page:7:physical_state']);
    expect([d.protectedPages, d.allowance]).toEqual([[3, 7], { nextAttempt: 3, maxAttempts: 3, remainingAfterNext: 0 }]);
    // A finding on a section the repair did not change is visible as such (never assumed to be reviewer randomness).
    expect(d.findings.find(f => f.key === 'page:6:physical_state')!.changedInLatestAttempt).toEqual([]);
    const preview = await previewFreshBookStoryboardContinuation(config, continuation);
    expect(preview).toMatchObject({ findings: 6, resolutionsRequired: 6, protectedPages: [3, 7], outputCap: 50000, diagnosisDigest: grantDraft.recovery.diagnosisDigest });
    expect([preview.contentBytes <= preview.contentByteLimit, preview.wireBytes <= preview.wireByteLimit, preview.argvChars <= preview.argvLimit,
      preview.reservedMicroUsd <= preview.sessionGuardMicroUsd]).toEqual([true, true, true, true]);
    // Legacy on real data: the consumed repair's own planner request, rebuilt by this code, is byte-identical to the one it was admitted with.
    const repairDir = path.join(config.bookDir, FRESH_BOOK_STORYBOARD_REPAIR.folder);
    expect(await previewFreshBookStoryboardRepair(config, JSON.parse(readFileSync(path.join(repairDir, 'storyboard_repair_input.json'), 'utf8'))))
      .toEqual(JSON.parse(readFileSync(path.join(repairDir, 'repair-admission.json'), 'utf8')).preview);
    expect([tree(config.bookDir), authority()]).toEqual([book, records]);
  });
});

const REAL_CONTINUATION_GRANT = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/engine-recovery-20261019/fresh-book-storyboard-continuation-grant-STAGED-86e5c37f.json';
describe.skipIf(!existsSync(REAL_CONFIG) || !existsSync(REAL_CONTINUATION_GRANT) ||
  !existsSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, FRESH_BOOK_STORYBOARD_CONTINUATION.outcomeName)))('the actual refused continuation: revalidation dry plan and review preview (read only, no key, no provider, no write)', () => {
  const authority = () => Object.fromEntries(readdirSync(FRESH_BOOK_CYCLE.authorityRoot).filter(n => n.includes('fresh-book-usd7'))
    .map(n => [n, sha(readFileSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, n)))]));
  it('binds the consumed continuation and its compile refusal, reproduces it on the paid answer, and the corrected candidate\'s ONE review request fits every limit', async () => {
    const config = freshBookConfig(REAL_CONFIG), env = realFreshBookEnv(), book = tree(config.bookDir), records = authority();
    const { plan, grantDraft, input } = await planFreshBookStoryboardRevalidation(config, env, REAL_CONTINUATION_GRANT);
    // The consumed continuation (its grant, claim, refusal and ONE paid planner session), exactly as it ran on 2026-10-19.
    expect(grantDraft.continuation).toMatchObject({ grantSha256: 'f14ab4b960490f6b9a876a3135256436300d1a3f0d9c8c40e43f47da5ee2d176',
      plannerWireDigest: '40d0ce1513f9b9908226bb6765bbfb90bb2a5b481128c4cfc14583ce69055a81', plannerMaxMicroUsd: 1002229,
      repairClaimSha256: '127cab961bbaa076cc9e298ba1be8a8d74ef760b3c0ea18550e70200d150b4a6', originalClaimSha256: '96ef1b42631c32f9c5158f7b2a771f09a3080b2371e2c2bf030dd6d07d1a245b' });
    // The paid answer: the strict check refused exactly three book-level names; the correction resolves each to the ONE engine section it changed.
    expect(grantDraft.candidate).toMatchObject({ claims: 66, resolutions: 6, resolvedNames: [{ from: 'book:recurringProps', to: ['book:plan.recurringProps'] },
      { from: 'book:continuity', to: ['book:continuity.entities'] }, { from: 'book:locations', to: ['book:plan.locations'] }] });
    expect(grantDraft.recovery).toMatchObject({ attempt: 3, maxAttempts: 3, diagnosisDigest: JSON.parse(readFileSync(REAL_CONTINUATION_GRANT, 'utf8')).recovery.diagnosisDigest });
    // The API ledger is unchanged by the refusal (no review was claimed); the planner session is Claude Max, reported separately.
    expect(grantDraft.ledger).toEqual({ diagnosticSettledMicroUsd: 128930, bookKnownMicroUsd: 155406, calls: 5 });
    expect([plan.providerCalls, plan.keyRead, grantDraft.allowance]).toEqual([0, false, { plannerCalls: 0, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 }]);
    const preview = await previewFreshBookStoryboardRevalidation(config, input);
    expect(preview).toMatchObject({ sourceDigest: grantDraft.candidate.sourceDigest, storyboardDigest: grantDraft.candidate.storyboardDigest, contentByteLimit: 104000,
      reviewFloorMicroUsd: 600000, maxOutputTokens: 39000, model: 'gpt-6.1-sol' });
    expect([preview.contentBytes <= preview.contentByteLimit, preview.reviewReserveMicroUsd >= 600000,
      preview.reviewReserveMicroUsd <= 7_000_000 - grantDraft.ledger.bookKnownMicroUsd]).toEqual([true, true, true]);
    expect([tree(config.bookDir), authority()]).toEqual([book, records]);
  });
});

const REAL_REVALIDATION_GRANT = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/engine-revalidation-20261019/fresh-book-storyboard-revalidation-grant-STAGED-a4aaeb0e.json';
const REAL_OWNER_APPROVAL = 'C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/OWNER-APPROVAL-REFINED-B-ATTEMPT4-20261019.txt';
describe.skipIf(!existsSync(REAL_CONFIG) || !existsSync(REAL_REVALIDATION_GRANT) || !existsSync(REAL_OWNER_APPROVAL) ||
  !existsSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, FRESH_BOOK_STORYBOARD_REVALIDATION.outcomeName)))('the actual held revalidation: the owner-approved extension dry plan and planner preview (read only, no key, no provider, no write)', () => {
  const authority = () => Object.fromEntries(readdirSync(FRESH_BOOK_CYCLE.authorityRoot).filter(n => n.includes('fresh-book-usd7'))
    .map(n => [n, sha(readFileSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, n)))]));
  it('binds the held revalidation (its 10 findings) and the owner\'s record, derives attempt 4 of 4, and the ONE planner request fits every limit', async () => {
    const config = freshBookConfig(REAL_CONFIG), env = realFreshBookEnv(), book = tree(config.bookDir), records = authority();
    const { plan, grantDraft, input, recoveryRecord, diagnosisRecord } = await planFreshBookStoryboardExtension(config, env, REAL_REVALIDATION_GRANT, REAL_OWNER_APPROVAL);
    // The consumed revalidation (its unused-then-consumed grant 059c6686..., its review held it at the base ceiling), exactly as it ran on 2026-10-19.
    expect(grantDraft.revalidation.grantSha256).toBe(sha(readFileSync(REAL_REVALIDATION_GRANT)));
    expect(grantDraft.revalidation.grantSha256.slice(0, 8)).toBe('059c6686');
    expect(grantDraft.revalidation).toMatchObject({ originalClaimSha256: '96ef1b42631c32f9c5158f7b2a771f09a3080b2371e2c2bf030dd6d07d1a245b',
      repairClaimSha256: '127cab961bbaa076cc9e298ba1be8a8d74ef760b3c0ea18550e70200d150b4a6' });
    expect(grantDraft.ownerApproval).toEqual({ file: path.resolve(REAL_OWNER_APPROVAL), sha256: sha(readFileSync(REAL_OWNER_APPROVAL)) });
    expect(grantDraft.held).toEqual({ sourceDigest: 'a508438ee9c0d3a4aba99d6197745c2bebb8fd57221f9b01319828d2876feb72',
      storyboardDigest: 'db61a2dd99875171557410b2faacad068715cd7ca8f666b66944718bee35d1db', reviewDigest: '4f8f60272fad680e7dea3ff316dae3678ac123943953bc3bbfa3c502d329dc8f',
      disposition: 'held_uncertain', draftSha256: '7dee3b5efa4bdc92a4e46fa51ec07a000d0aedba5591d972946c04a4d5ed750a', findings: 10 });
    // The API ledger through the revalidation; the planner sessions are Claude Max, reported separately.
    expect(grantDraft.ledger).toEqual({ diagnosticSettledMicroUsd: 128930, bookKnownMicroUsd: 247596, calls: 6 });
    expect([plan.providerCalls, plan.keyRead, grantDraft.allowance, grantDraft.addedContracts]).toEqual([0, false,
      { plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 }, ['claimBasisContract']]);
    // The engine's recovery state under the owner's ceiling: three consecutive held candidates (their own contexts and costs), one attempt left.
    expect(grantDraft.recovery).toMatchObject({ attempts: 3, maxAttempts: 4, consecutiveFailures: 3, mode: 'diagnose_and_change_strategy' });
    expect(recoveryRecord.attempts.map(a => [a.line, a.storyboardDigest.slice(0, 8), a.findings.length, a.costs])).toEqual([
      ['text-recovery', 'ffd56099', 6, { plannerClaudeMaxMicroUsd: 623664, reviewApiMicroUsd: 60226 }],
      ['storyboard-repair', '4f3d55d9', 6, { plannerClaudeMaxMicroUsd: 501261, reviewApiMicroUsd: 53818 }],
      ['storyboard-revalidation', 'db61a2dd', 10, { plannerClaudeMaxMicroUsd: 1002229, reviewApiMicroUsd: 92190 }]]);
    expect(diagnosisRecord.diagnosis.allowance).toEqual({ nextAttempt: 4, maxAttempts: 4, remainingAfterNext: 0 });
    expect(input).toMatchObject({ addedContracts: ['claimBasisContract'], parentCompile: { selfCheckNames: true },
      extension: { version: 'storyboard-attempt-extension/v1', maxAttempts: 4, approvalSha256: grantDraft.ownerApproval.sha256 } });
    const preview = await previewFreshBookStoryboardExtension(config, input);
    expect(preview).toMatchObject({ findings: 10, resolutionsRequired: 10, protectedPages: [4], outputCap: 50000, diagnosisDigest: grantDraft.recovery.diagnosisDigest });
    expect([preview.contentBytes <= preview.contentByteLimit, preview.wireBytes <= preview.wireByteLimit, preview.argvChars <= preview.argvLimit,
      preview.reservedMicroUsd <= preview.sessionGuardMicroUsd]).toEqual([true, true, true, true]);
    expect([tree(config.bookDir), authority()]).toEqual([book, records]);
  }, 240_000);  // re-derives the whole saved lineage (text, recovery, repair, continuation, revalidation) from its paid records
});

const REAL_EXTENSION_GRANT = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/engine-claim-basis-20261019/fresh-book-storyboard-extension-grant-STAGED-42fafd71.json';
describe.skipIf(!existsSync(REAL_CONFIG) || !existsSync(REAL_EXTENSION_GRANT) ||
  !existsSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, FRESH_BOOK_STORYBOARD_EXTENSION.outcomeName)))('the actual refused extension: extension revalidation dry plan and review preview (read only, no key, no provider, no write)', () => {
  const authority = () => Object.fromEntries(readdirSync(FRESH_BOOK_CYCLE.authorityRoot).filter(n => n.includes('fresh-book-usd7'))
    .map(n => [n, sha(readFileSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, n)))]));
  it('binds the consumed extension and its compile refusal, reproduces it on the paid answer, and the corrected candidate\'s ONE review request fits every limit', async () => {
    const config = freshBookConfig(REAL_CONFIG), env = realFreshBookEnv(), book = tree(config.bookDir), records = authority();
    const { plan, grantDraft, input } = await planFreshBookStoryboardExtensionRevalidation(config, env, REAL_EXTENSION_GRANT);
    // The consumed extension (its grant, claim, refusal and ONE paid planner session), exactly as it ran on 2026-10-19 (22:08..22:13Z).
    expect(grantDraft.extension).toMatchObject({ grantSha256: '8e700b5c90373268145ad927a35dd38f214a86703943585631769112ad2d7dbe',
      plannerWireDigest: 'f1d29fd1d3ce574153867fc6bea3c1a1197a0ccb57484e5a49b3f52f3c49292e', plannerMaxMicroUsd: 1053404,
      repairClaimSha256: '127cab961bbaa076cc9e298ba1be8a8d74ef760b3c0ea18550e70200d150b4a6', originalClaimSha256: '96ef1b42631c32f9c5158f7b2a771f09a3080b2371e2c2bf030dd6d07d1a245b' });
    expect(grantDraft.ownerApproval.sha256).toBe('b2b3a33eb439aee95a7f4960507307ae4652c7e138acf758e6637bca07a0c5ac');
    // The paid answer: the strict check refused exactly two staged plan direction fields; the correction admits them and nothing else changed.
    expect(grantDraft.candidate).toMatchObject({ claims: 61, resolutions: 10, stagedFields: [{ page: 2, ref: 'p2:composition' }, { page: 3, ref: 'p3:childAction' }] });
    expect(grantDraft.recovery).toEqual({ attempt: 4, maxAttempts: 4, stateSha256: '3cd403461c403a7c4d443b1023d26e67bdc42b1a0e1ba61f2bf3569cc3760d99',
      diagnosisDigest: 'e9d613c11f65a60f41cc00d80d934061703361077f679dccf90353a2acaa2771' });
    // The API ledger is unchanged by the refusal (no review was claimed); the planner session is Claude Max, reported separately.
    expect(grantDraft.ledger).toEqual({ diagnosticSettledMicroUsd: 128930, bookKnownMicroUsd: 247596, calls: 6 });
    expect([plan.providerCalls, plan.keyRead, grantDraft.allowance, grantDraft.compile]).toEqual([0, false, { plannerCalls: 0, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 },
      ['storyboard-self-check-names/v1', 'storyboard-claim-basis-staging-fields/v1']]);
    const preview = await previewFreshBookStoryboardExtensionRevalidation(config, input);
    expect(preview).toMatchObject({ sourceDigest: grantDraft.candidate.sourceDigest, storyboardDigest: grantDraft.candidate.storyboardDigest, contentByteLimit: 104000,
      reviewFloorMicroUsd: 600000, maxOutputTokens: 39000, model: 'gpt-6.1-sol' });
    expect([preview.contentBytes <= preview.contentByteLimit, preview.reviewReserveMicroUsd >= 600000,
      preview.reviewReserveMicroUsd <= 7_000_000 - grantDraft.ledger.bookKnownMicroUsd]).toEqual([true, true, true]);
    expect([tree(config.bookDir), authority()]).toEqual([book, records]);
  }, 240_000);
});

const REAL_EXTENSION_REVALIDATION_GRANT = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/engine-staging-fields-20261020/fresh-book-storyboard-extension-revalidation-grant-STAGED-99f97904.json';
const REAL_OWNER_APPROVAL_5 = 'C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/OWNER-APPROVAL-CORRECTED-B-ATTEMPT5-20261020.txt';
describe.skipIf(!existsSync(REAL_CONFIG) || !existsSync(REAL_EXTENSION_REVALIDATION_GRANT) || !existsSync(REAL_OWNER_APPROVAL_5) ||
  !existsSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, FRESH_BOOK_STORYBOARD_EXTENSION_REVALIDATION.outcomeName)))('the actual held extension revalidation: the owner-approved calibration dry plan and planner preview (read only, no key, no provider, no write)', () => {
  const authority = () => Object.fromEntries(readdirSync(FRESH_BOOK_CYCLE.authorityRoot).filter(n => n.includes('fresh-book-usd7'))
    .map(n => [n, sha(readFileSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, n)))]));
  it('binds the held attempt 4 (9 findings, 7 groups) and the owner\'s second record, derives attempt 5 of 5, and the ONE compacted planner request fits every limit', async () => {
    const config = freshBookConfig(REAL_CONFIG), env = realFreshBookEnv(), book = tree(config.bookDir), records = authority();
    const { plan, grantDraft, input, recoveryRecord, diagnosisRecord } = await planFreshBookStoryboardCalibration(config, env, REAL_EXTENSION_REVALIDATION_GRANT,
      REAL_OWNER_APPROVAL_5);
    // The consumed extension revalidation (its grant d9ed6fcc..., its review held attempt 4 at the owner's ceiling), exactly as it ran on 2026-10-20.
    expect(grantDraft.extensionRevalidation).toMatchObject({ grantSha256: 'd9ed6fcca806e6dec804729a202b1a761ff3316c458827b9e37c224e204539aa',
      repairClaimSha256: '127cab961bbaa076cc9e298ba1be8a8d74ef760b3c0ea18550e70200d150b4a6', originalClaimSha256: '96ef1b42631c32f9c5158f7b2a771f09a3080b2371e2c2bf030dd6d07d1a245b' });
    expect(grantDraft.ownerApproval).toEqual({ file: path.resolve(REAL_OWNER_APPROVAL_5), sha256: sha(readFileSync(REAL_OWNER_APPROVAL_5)) });
    expect(grantDraft.held).toEqual({ sourceDigest: 'f675115fa0954d2937f7f6e6b7bfe042281d70c4262c36575adb749dd6ce0d0d',
      storyboardDigest: 'ce4c50256f23ad47daaac87087e498c52f015e20808944af003c4bff41b4247c', reviewDigest: 'e44871ee7bfdcf6be057373a717547ae4e797dcbed78e6a8302ac71fa359be19',
      disposition: 'held_uncertain', draftSha256: '046a8b5eb99c03d8ce65a8c40139939481f33fc56795641ff5ad6faaa1800c8c', findings: 9, findingGroups: 7 });
    // The API ledger through the extension revalidation; the planner sessions are Claude Max, reported separately.
    expect(grantDraft.ledger).toEqual({ diagnosticSettledMicroUsd: 128930, bookKnownMicroUsd: 336948, calls: 7 });
    expect([plan.providerCalls, plan.keyRead, grantDraft.allowance, grantDraft.addedContracts, grantDraft.compile, grantDraft.plannerSchema]).toEqual([0, false,
      { plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 }, ['calibrationContract'],
      ['storyboard-self-check-names/v1', 'storyboard-claim-basis-staging-fields/v1'], 'definition-names/v1']);
    // The engine's recovery state under the owner's ceiling 5: four consecutive held candidates (their own contexts and costs), one attempt left.
    expect(grantDraft.recovery).toMatchObject({ attempts: 4, maxAttempts: 5, consecutiveFailures: 4, mode: 'diagnose_and_change_strategy' });
    expect(recoveryRecord.attempts.map(a => [a.line, a.storyboardDigest.slice(0, 8), a.findings.length, a.costs])).toEqual([
      ['text-recovery', 'ffd56099', 6, { plannerClaudeMaxMicroUsd: 623664, reviewApiMicroUsd: 60226 }],
      ['storyboard-repair', '4f3d55d9', 6, { plannerClaudeMaxMicroUsd: 501261, reviewApiMicroUsd: 53818 }],
      ['storyboard-revalidation', 'db61a2dd', 10, { plannerClaudeMaxMicroUsd: 1002229, reviewApiMicroUsd: 92190 }],
      ['storyboard-extension-revalidation', 'ce4c5025', 9, { plannerClaudeMaxMicroUsd: 1053404, reviewApiMicroUsd: 89352 }]]);
    expect(diagnosisRecord.diagnosis.allowance).toEqual({ nextAttempt: 5, maxAttempts: 5, remainingAfterNext: 0 });
    expect(input).toMatchObject({ addedContracts: ['calibrationContract'], parentCompile: { selfCheckNames: true, stagingFields: true },
      extension: { version: 'storyboard-attempt-extension/v2', maxAttempts: 5, approvalSha256: grantDraft.ownerApproval.sha256,
        previous: { version: 'storyboard-attempt-extension/v1', maxAttempts: 4, approvalSha256: 'b2b3a33eb439aee95a7f4960507307ae4652c7e138acf758e6637bca07a0c5ac' } } });
    const preview = await previewFreshBookStoryboardCalibration(config, input);
    expect(preview).toMatchObject({ findings: 9, findingGroups: 7, resolutionsRequired: 9, outputCap: 50000, schemaCompaction: 'definition-names/v1',
      diagnosisDigest: grantDraft.recovery.diagnosisDigest });
    expect([preview.contentBytes <= preview.contentByteLimit, preview.wireBytes <= preview.wireByteLimit, preview.argvChars <= preview.argvLimit,
      preview.reservedMicroUsd <= preview.sessionGuardMicroUsd]).toEqual([true, true, true, true]);
    expect([tree(config.bookDir), authority()]).toEqual([book, records]);
  }, 300_000);  // re-derives the whole saved lineage (text, recovery, repair, continuation, revalidation, extension, extension revalidation)
});

const REAL_CALIBRATION_GRANT = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/engine-calibration-20261020/fresh-book-storyboard-calibration-grant-STAGED-40927765.json';
const REAL_OWNER_CONTINUATION = 'C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/OWNER-SAME-BOOK-CONTINUATION-AFTER-ATTEMPT5-20261020.txt';
describe.skipIf(!existsSync(REAL_CONFIG) || !existsSync(REAL_CALIBRATION_GRANT) || !existsSync(REAL_OWNER_CONTINUATION) ||
  !existsSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, FRESH_BOOK_STORYBOARD_CALIBRATION.outcomeName)))('the actual held calibration: the owner-directed presence dry plan and planner preview (read only, no key, no provider, no write)', () => {
  const authority = () => Object.fromEntries(readdirSync(FRESH_BOOK_CYCLE.authorityRoot).filter(n => n.includes('fresh-book-usd7'))
    .map(n => [n, sha(readFileSync(path.join(FRESH_BOOK_CYCLE.authorityRoot, n)))]));
  it('binds the held attempt 5 (2 findings, 1 group, the repeated p8:relation:child) and the owner\'s continuation record, derives attempt 6 of 6, and the ONE compacted planner request fits every limit', async () => {
    const config = freshBookConfig(REAL_CONFIG), env = realFreshBookEnv(), book = tree(config.bookDir), records = authority();
    const { plan, grantDraft, input, recoveryRecord, diagnosisRecord, state } = await planFreshBookStoryboardPresence(config, env, REAL_CALIBRATION_GRANT,
      REAL_OWNER_CONTINUATION);
    // The consumed calibration (its grant 7af5fa76..., its review held attempt 5 at the owner's ceiling 5), exactly as it ran on 2026-10-20.
    expect(grantDraft.calibration).toMatchObject({ grantSha256: '7af5fa76bfdd2d642182bb37b3d8b78602d3291b27dbae4c67c1ca88f23360a3',
      claimSha256: '717263f76108655e8d4431708dc6a9f6930d41278a9960b42b77357ae0f47794', outcomeSha256: '08b8a779bae7e8bb38b78f92f48b17bbe105f440dd543cc77c08a83fa91de8e3',
      extensionRevalidationClaimSha256: '66d3283e98240c237b3d89fa4d269a825d980cade0e050a17c8d4ed69484c093',
      repairClaimSha256: '127cab961bbaa076cc9e298ba1be8a8d74ef760b3c0ea18550e70200d150b4a6', originalClaimSha256: '96ef1b42631c32f9c5158f7b2a771f09a3080b2371e2c2bf030dd6d07d1a245b' });
    expect(grantDraft.ownerApproval).toEqual({ file: path.resolve(REAL_OWNER_CONTINUATION), sha256: '1c6df39d1343fef95ab9b43fcca85eae706d352bed3d25cffba97f5289cf6f1e' });
    expect(grantDraft.held).toEqual({ sourceDigest: '37d453afcb93b7b7c99bc9daa2fc4d3e5dd6d0e346e6770f303e8bfc803d51fc',
      storyboardDigest: '1e27782dc841aa77b2ddcf6cc59eb3cbc932b20fd8bcb07268db2786a045750b', reviewDigest: '6459a5f8cbbab7bef5039e4dd2602945f35a0f906d841ddd36e104d3bf873af5',
      disposition: 'held_uncertain', draftSha256: '256608664f68a53597cb25bde2d56e6680d7c236b7364d2d595c813737940bea', findings: 2, findingGroups: 1, repeatedReferences: 1 });
    // The API ledger through the calibration; the planner sessions are Claude Max, reported separately.
    expect(grantDraft.ledger).toEqual({ diagnosticSettledMicroUsd: 128930, bookKnownMicroUsd: 428234, calls: 8 });
    expect([plan.providerCalls, plan.keyRead, grantDraft.allowance, grantDraft.addedContracts, grantDraft.compile, grantDraft.plannerSchema]).toEqual([0, false,
      { plannerCalls: 1, apiCalls: 1, reviewReserveFloorMicroUsd: 600000 }, ['presenceContract'],
      ['storyboard-self-check-names/v1', 'storyboard-claim-basis-staging-fields/v1'], 'definition-names/v1']);
    // The engine's recovery state under the owner's ceiling 6: five consecutive held candidates (their own contexts and costs), one attempt left.
    expect(grantDraft.recovery).toEqual({ version: 'stage-recovery/v1', attempts: 5, maxAttempts: 6, consecutiveFailures: 5, mode: 'diagnose_and_change_strategy',
      stateSha256: 'ebc966957a4d66e8c83cc7def12f6d3dd14ea8593d29d6e2e64c3a39edc54488', diagnosisDigest: '68d27a78d111e4773f51de04e3ff1b280eeb7619105d9722c3e786a36189e79b',
      contextDigest: '466e54a60ed56a37b1cd80f0e6e7560775ffaf784f6d3c7fe96d00217e3ea015' });
    expect(recoveryRecord.attempts.map(a => [a.line, a.storyboardDigest.slice(0, 8), a.findings.length, a.costs])).toEqual([
      ['text-recovery', 'ffd56099', 6, { plannerClaudeMaxMicroUsd: 623664, reviewApiMicroUsd: 60226 }],
      ['storyboard-repair', '4f3d55d9', 6, { plannerClaudeMaxMicroUsd: 501261, reviewApiMicroUsd: 53818 }],
      ['storyboard-revalidation', 'db61a2dd', 10, { plannerClaudeMaxMicroUsd: 1002229, reviewApiMicroUsd: 92190 }],
      ['storyboard-extension-revalidation', 'ce4c5025', 9, { plannerClaudeMaxMicroUsd: 1053404, reviewApiMicroUsd: 89352 }],
      ['storyboard-calibration', '1e27782d', 2, { plannerClaudeMaxMicroUsd: 1104180, reviewApiMicroUsd: 91286 }]]);
    // The one reference both last reviews held for the same impact: the child's page-8 relation slot, with the values the two held drafts gave
    // it (attempt 5 beside the ball, attempt 4 on the spiral trail).
    expect(recoveryRecord.next.repeatedReferences).toEqual([{ ref: 'p8:relation:child', impact: 'evidence', checks: ['book:continuity', 'page:8:physical_state'],
      previousChecks: ['page:8:physical_state'], heldValues: [{ relation: 'beside', targetId: 'gray_ball' }, { relation: 'at', targetId: 'spiral_trail' }] }]);
    expect(diagnosisRecord.diagnosis.allowance).toEqual({ nextAttempt: 6, maxAttempts: 6, remainingAfterNext: 0 });
    expect(input).toMatchObject({ addedContracts: ['presenceContract'], parentCompile: { selfCheckNames: true, stagingFields: true },
      extension: { version: 'storyboard-attempt-extension/v2', maxAttempts: 6, approvalSha256: grantDraft.ownerApproval.sha256,
        previous: { version: 'storyboard-attempt-extension/v2', maxAttempts: 5, approvalSha256: '9e584f7aa9117173a1cffa2aa95ea5ee6216b95df319d0319eaac0f0359baf13',
          previous: { version: 'storyboard-attempt-extension/v1', maxAttempts: 4, approvalSha256: 'b2b3a33eb439aee95a7f4960507307ae4652c7e138acf758e6637bca07a0c5ac' } } } });
    // Before its one run: nothing claimed, and the balance covers the review's floor.
    expect([state.claimExists, state.outcomeExists, state.successorExists, state.folderExists, (state.reviewFloor as { refused?: unknown } | undefined)?.refused])
      .toEqual([false, false, false, false, undefined]);
    const preview = await previewFreshBookStoryboardPresence(config, input);
    expect(preview).toMatchObject({ findings: 2, findingGroups: 1, repeatedReferences: 1, resolutionsRequired: 2, outputCap: 50000, schemaCompaction: 'definition-names/v1',
      diagnosisDigest: grantDraft.recovery.diagnosisDigest, protectedPages: [2, 3, 4, 5, 6, 7] });
    expect([preview.contentBytes <= preview.contentByteLimit, preview.wireBytes <= preview.wireByteLimit, preview.argvChars <= preview.argvLimit,
      preview.reservedMicroUsd <= preview.sessionGuardMicroUsd]).toEqual([true, true, true, true]);
    expect([tree(config.bookDir), authority()]).toEqual([book, records]);
  }, 300_000);  // re-derives the whole saved lineage (text, recovery, repair, continuation, revalidation, extension, extension revalidation, calibration)
});
