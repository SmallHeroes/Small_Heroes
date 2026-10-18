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
import { auditionReviewRule, type AuditionMeter } from '../../../scripts/personal-simple-book-reviewed-audition';
import { inspectedDesignWire, inspectedStyleWire } from '../../../scripts/personal-child-anchor-judges';
import { planRereview, runRereview, REREVIEW_AMENDMENT, type RereviewConfig, type RereviewEnv } from '../../../scripts/personal-child-anchor-rereview';
import { FRESH_BOOK_CYCLE, FRESH_BOOK_RECOVERY, freshBookProfileSchema } from '../../../scripts/personal-fresh-book-authority';
import { planFreshBook, planFreshBookRecovery, runFreshBookText, runFreshBookTextRecovery, runFreshBookChild, runFreshBookBook, freshBookConfig, realFreshBookEnv,
  type FreshBookConfig, type FreshTextTransports } from '../../../scripts/personal-fresh-book-driver';

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

function textTransports(opts: { correction?: (input: string) => unknown } = {}): Required<FreshTextTransports> {
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
      usage: { input_tokens: 10000, output_tokens: 5000 }, output_text: JSON.stringify(providerReview(structuredClone(review))) }) as any),
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
});

describe.skipIf(!existsSync(REAL_CONFIG) || !existsSync(REAL_GRANT))('the actual saved failed book: recovery dry plan (read only, no key, no provider, no write)', () => {
  it('binds the consumed original grant/claim/outcome/seal and the known ledger; nothing claimed', () => {
    const config = freshBookConfig(REAL_CONFIG), env = realFreshBookEnv(), book = tree(config.bookDir);
    const { plan, grantDraft, state } = planFreshBookRecovery(config, env, REAL_GRANT);
    expect(grantDraft.original.grantSha256).toBe('fc6db297bfa344f7bcbc97dda1c6e1b39e0d23226557960be02bdfc52c9a41d3');
    expect(grantDraft.original.engineHead).toBe('96dedda4b958535c79a90f1627936dfa560ae5d4');
    expect(grantDraft.ledger).toEqual({ diagnosticSettledMicroUsd: 128930, originalTextKnownMicroUsd: 36450, originalTextCalls: 2 });
    expect([plan.providerCalls, plan.keyRead, state.recoveryClaimExists, state.recoveryOutcomeExists, state.recoveryFolderExists]).toEqual([0, false, false, false, false]);
    expect(state.ledger).toMatchObject({ bookKnownMicroUsd: 36450, cycleAccountedMicroUsd: 165380 });
    expect(tree(config.bookDir)).toEqual(book);
  });
});
