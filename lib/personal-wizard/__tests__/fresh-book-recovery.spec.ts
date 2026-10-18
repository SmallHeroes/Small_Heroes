import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
import { CHILD_ANCHOR_REQUIRED_VISIBLE, CHILD_ANCHOR_INSPECTION_VERSION, childAnchorInspectionContextSha } from '../child-anchor-style';
import { auditionReviewRule, AuditionMeter, verifyMeterRecords } from '../../../scripts/personal-simple-book-reviewed-audition';
import { inspectedDesignWire, inspectedStyleWire } from '../../../scripts/personal-child-anchor-judges';
import { planRereview, runRereview, REREVIEW_AMENDMENT, type RereviewConfig, type RereviewEnv } from '../../../scripts/personal-child-anchor-rereview';
import { FRESH_BOOK_CYCLE, FRESH_BOOK_RECOVERY, FRESH_BOOK_STORYBOARD_REPAIR, freshBookProfileSchema } from '../../../scripts/personal-fresh-book-authority';
import { planFreshBook, planFreshBookRecovery, runFreshBookText, runFreshBookTextRecovery, runFreshBookChild, runFreshBookBook, freshBookConfig, realFreshBookEnv,
  planFreshBookStoryboardRepair, previewFreshBookStoryboardRepair, runFreshBookStoryboardRepair, flooredReviewRule, assertReviewFloorFits,
  STORYBOARD_REPAIR_RULES, REVIEW_RESERVE_FLOOR_MICRO_USD, type FreshBookConfig, type FreshTextTransports } from '../../../scripts/personal-fresh-book-driver';
import { stageRules } from '../../../scripts/personal-new-book-experiment';
import { VISIBLE_MOMENT_STORYBOARD_ADDENDUM } from '../storyboard-visible-moment';
import { REPAIR_STORYBOARD_ADDENDUM } from '../storyboard-repair';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const ORIGINAL = 'C:/GNart/Work/book-renders/child-anchor-probe-r1-anchor-diag-20261018';
const ORIGINAL_CONFIG = 'C:/GNart/Work/Small_Heroes/_review/new-book-anchor-diagnostic-20261018/probe-config.json';
const REAL_CONFIG = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/fresh-book-config-materiality.json';
const REAL_GRANT = 'C:/GNart/Work/Small_Heroes/_review/new-book-autonomous-closure-20261018/fresh-book-grant-materiality-STAGED-96dedda4.json';
const real = existsSync(path.join(ORIGINAL, 'sealed.json')) && existsSync(ORIGINAL_CONFIG);
const roots: string[] = [];
let f: Awaited<ReturnType<typeof personalStoryboardFixture>>;
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
/** Downstream providers at the SDK boundary (the real child/audition adapters, meters and settlement run). */
function providers() {
  let shade = 40;
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
      outputParent: parent, keyEnvFile: path.join(root, 'no-key.env') };
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
            return meter.run(step, wire, 600000, async () => reply(wire, { candidateSha: c.imageSha, contextSha: childAnchorInspectionContextSha(ctx),
              recipeSha: (JSON.parse((wire as any).input[0].content[0].text)).recipeSha, inspectionVersion: CHILD_ANCHOR_INSPECTION_VERSION,
              checks: passChecks(), apparentAge: { requestedAge: 6, verdict: 'compatible', observation: 'six', correction: '' },
              visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => ({ aspect, verdict: 'matched', observation: 'seen' })),
              unobservedConditional: [{ trait: 'One front baby tooth missing, visible when she smiles', condition: 'open_mouth_or_smile', observation: 'lips closed' }] })); } } as any;
      } });
    const rereviewFile = path.join(root, 'rereview-config.json'); writeFileSync(rereviewFile, JSON.stringify(rereview));
    const profile = freshBookProfileSchema.parse({ version: 'fresh-book-profile/v1', cycle: FRESH_BOOK_CYCLE.id,
      child: { name: 'נועה', age: 5, gender: 'girl', design: 'A fictional five-year-old girl with short dark-brown hair, dark brown eyes and light olive skin; natural child proportions.',
        wardrobe: 'a red shirt, blue shorts and teal shoes', fictional: true },
      companion: { id: 'fox_uri', design: 'the registry fox Uri, copper fur and lantern eyes' },
      parentInputs: { about: 'She loves drawing in the garden and inventing games.', wish: 'to enjoy a silly adventure' },
      seed: 'fresh-book-driver-test-seed', request: { ...structuredClone(f.request), companion: { id: 'fox_uri' } }, routes: FRESH_BOOK_CYCLE.routes,
      childAnchor: CHILD_ANCHOR_INSPECTION_VERSION });
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
