import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { QUALITY_CATEGORIES } from '../../local-preview-quality';
import { STAGE0_ANCHOR_NEUTRAL_EXPRESSION } from '../../generation-pipeline/stage0-method-b';
import { CHILD_ANCHOR_TECHNIQUE_MANIFEST, CHILD_ANCHOR_MANIFEST_SHA256, CHILD_ANCHOR_STYLE_VERSION, CHILD_ANCHOR_INSPECTION_VERSION, CHILD_ANCHOR_REQUIRED_VISIBLE,
  childAnchorRecipeSchema, childAnchorRecipeSha, childAnchorDescriptionRequest, childAnchorDesignDisposition, childAnchorDisposition, childAnchorStyleDisposition,
  childAnchorStylePayload, childAnchorInspectionContext, childAnchorInspectionContextSha, childAnchorInspectedDesignDisposition, childAnchorInspectedDesignPayload,
  childAnchorInspectedAdoptionRecord, assertChildAnchorInspectedAccepted, childAnchorInspectionView } from '../child-anchor-style';
import { auditionReviewRule, type AuditionMeter } from '../../../scripts/personal-simple-book-reviewed-audition';
import { inspectedDesignWire, inspectedStyleWire } from '../../../scripts/personal-child-anchor-judges';
import { planRereview, runRereview, settledRereviewOutcome, rereviewOutput, REREVIEW_AMENDMENT, type RereviewConfig, type RereviewEnv }
  from '../../../scripts/personal-child-anchor-rereview';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
/** The diagnostic's own configured child (fictional), verbatim. */
const DESIGN = 'A fictional 6-year-old girl invented for this diagnostic, not a real child. Warm medium-brown skin, a round face with full cheeks, large dark-brown eyes, short straight black eyebrows and a small rounded nose. Thick black curly hair worn in two high puffs tied with yellow hair ties, a few loose curls at the forehead. One front baby tooth missing, visible when she smiles. Proportions of a 6-year-old: head large relative to the body, short limbs, small hands.';
const child = { age: 6, gender: 'girl' as const, design: DESIGN, wardrobe: 'a mustard-yellow hooded raincoat worn open over a navy-and-white striped long-sleeve shirt, olive-green leggings and red rubber boots' };
const request = childAnchorDescriptionRequest(child);
const recipe = childAnchorRecipeSchema.parse({ version: CHILD_ANCHOR_STYLE_VERSION, identitySource: 'description', manifestSha256: CHILD_ANCHOR_MANIFEST_SHA256,
  step: 'reference_child', referenceMode: 'style', references: CHILD_ANCHOR_TECHNIQUE_MANIFEST.map(e => ({ role: e.label, sha256: e.sha256 })),
  promptSha256: sha(request.prompt), requestedAge: 6 });
const context = childAnchorInspectionContext(child, request.prompt), CTX = childAnchorInspectionContextSha(context);
const A = 'a'.repeat(64);
const TOOTH = 'One front baby tooth missing, visible when she smiles';
const checks = (identity: 'pass' | 'defect' | 'uncertain') => QUALITY_CATEGORIES.map(category => category === 'identity'
  ? { category, verdict: identity, observation: 'identity seen', correction: identity === 'defect' ? 'restore the two high puffs' : '' }
  : { category, verdict: 'pass', observation: 'ok', correction: '' });
const inspected = (over: { identity?: 'pass' | 'defect' | 'uncertain'; evidence?: Record<string, string>; unobserved?: unknown[]; age?: string;
  contextSha?: string; candidateSha?: string } = {}) => ({ candidateSha: over.candidateSha ?? A, contextSha: over.contextSha ?? CTX, checks: checks(over.identity ?? 'pass'),
  recipeSha: childAnchorRecipeSha(recipe), inspectionVersion: CHILD_ANCHOR_INSPECTION_VERSION,
  apparentAge: { requestedAge: 6, verdict: over.age ?? 'compatible', observation: 'reads six', correction: over.age === 'defect' ? 'older build' : '' },
  visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => ({ aspect, verdict: over.evidence?.[aspect] ?? 'matched', observation: `${aspect} seen` })),
  unobservedConditional: over.unobserved ?? [{ trait: TOOTH, condition: 'open_mouth_or_smile', observation: 'lips closed per the anchor clause' }] });
const style = (over: Record<string, unknown> = {}) => ({ candidateSha: A, contextSha: CTX, recipeSha: childAnchorRecipeSha(recipe), assessable: true,
  style01Match: true, looksPhotoreal: false, looksPortrait: false, notes: 'watercolor', ...over });
const textOf = (p: { input: { content: unknown[] }[] }) => JSON.parse((p.input[0].content[0] as { text: string }).text);
const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

describe('the real-case contract gap (v1, unchanged) and the inspection view', () => {
  it('v1 still holds the actual diagnostic shape: identity uncertain because the conditional trait is hidden (no rewrite, no pass)', () => {
    const v1 = { candidateSha: A, contextSha: CTX, checks: checks('uncertain'), recipeSha: childAnchorRecipeSha(recipe),
      apparentAge: { requestedAge: 6, verdict: 'compatible', observation: 'reads six', correction: '' } };
    const d = childAnchorDesignDisposition(v1, A, CTX, recipe);
    expect(d.design).toBe('held_uncertain');
    expect(childAnchorDisposition(childAnchorStyleDisposition(style(), A, CTX, childAnchorRecipeSha(recipe)), d).disposition).toBe('held_uncertain');
  });
  it('the view is derived from the planned prompt (production clause, pinned), not from the design text', () => {
    expect(request.prompt).toContain(STAGE0_ANCHOR_NEUTRAL_EXPRESSION);
    expect(context.view).toMatchObject({ expressionSha256: sha(STAGE0_ANCHOR_NEUTRAL_EXPRESSION), excludedConditions: ['open_mouth_or_smile'] });
    expect(context.design.fictionalDesign).toBe(DESIGN);
    expect(() => childAnchorInspectionView(request.prompt.replace(STAGE0_ANCHOR_NEUTRAL_EXPRESSION, 'smiling'))).toThrow('child_anchor_inspection_view');
    expect(() => childAnchorInspectionView(`${request.prompt}\n${STAGE0_ANCHOR_NEUTRAL_EXPRESSION}`)).toThrow('child_anchor_inspection_view');
  });
  it('v1 request bytes are unchanged when the inspection is absent; the opt-in binds its own version', () => {
    const v1 = childAnchorStylePayload({ candidateSha: A, contextSha: CTX, recipeSha: childAnchorRecipeSha(recipe), candidateURL: 'data:image/png;base64,AA==' });
    expect(textOf(v1).version).toBe(CHILD_ANCHOR_STYLE_VERSION);
    expect((v1.text.format as { name: string }).name).toBe('child_anchor_style_v1');
    const v2 = childAnchorStylePayload({ candidateSha: A, contextSha: CTX, recipeSha: childAnchorRecipeSha(recipe), candidateURL: 'data:image/png;base64,AA==', inspection: CHILD_ANCHOR_INSPECTION_VERSION });
    expect(textOf(v2).version).toBe(CHILD_ANCHOR_INSPECTION_VERSION);
    const d = childAnchorInspectedDesignPayload({ candidateSha: A, context, recipe, imageURLs: Array(5).fill('data:image/png;base64,AA==') });
    expect(textOf(d)).toMatchObject({ contextSha: CTX, context: { view: { excludedConditions: ['open_mouth_or_smile'] } } });
  });
});

describe('inspected design disposition: hidden conditional vs visible mismatch vs unreadable', () => {
  const run = (v: unknown) => childAnchorInspectedDesignDisposition(v, A, context, recipe);
  it('honest neutral anchor: required aspects matched, the smile-only trait RECORDED unobserved (not matched) -> passes', () => {
    const d = run(inspected());
    expect(d.design).toBe('passed');
    expect(d.unobservedConditional).toEqual([expect.objectContaining({ trait: TOOTH, condition: 'open_mouth_or_smile' })]);
    expect(d.visibleEvidence.every(e => e.verdict === 'matched')).toBe(true);
  });
  it('identity uncertain stays held even with the conditional recorded (no uncertainty skip)', () => {
    expect(run(inspected({ identity: 'uncertain' })).design).toBe('held_uncertain');
  });
  it('an unreadable required aspect holds; claiming identity pass over it refuses as incoherent', () => {
    expect(run(inspected({ identity: 'uncertain', evidence: { face: 'unreadable' } })).design).toBe('held_uncertain');
    expect(run(inspected({ identity: 'defect', evidence: { face: 'unreadable', hair: 'mismatch' } })).design).toBe('held_uncertain');
    expect(() => run(inspected({ evidence: { face: 'unreadable' } }))).toThrow('child_anchor_inspection_incoherent');
  });
  it('a visible mismatch is an identity defect (repair); a mismatch with identity pass/uncertain refuses', () => {
    const d = run(inspected({ identity: 'defect', evidence: { hair: 'mismatch' } }));
    expect(d.design).toBe('repair');
    expect(() => run(inspected({ evidence: { hair: 'mismatch' } }))).toThrow('child_anchor_inspection_incoherent');
    expect(() => run(inspected({ identity: 'uncertain', evidence: { wardrobe: 'mismatch' } }))).toThrow('child_anchor_inspection_incoherent');
  });
  it('the unobserved list cannot launder required design: invented, multi-sentence or non-excluded entries refuse', () => {
    const entry = (trait: string, condition = 'open_mouth_or_smile') => [{ trait, condition, observation: 'x' }];
    expect(() => run(inspected({ unobserved: entry('a gap-toothed grin with braces') }))).toThrow('child_anchor_inspection_unobserved');
    expect(() => run(inspected({ unobserved: entry('Thick black curly hair worn in two high puffs tied with yellow hair ties, a few loose curls at the forehead. One front baby tooth missing') })))
      .toThrow('child_anchor_inspection_unobserved');
    expect(() => run(inspected({ unobserved: entry(TOOTH, 'back_view') }))).toThrow();
    expect(() => run(inspected({ unobserved: [...entry(TOOTH), ...entry(TOOTH)] }))).toThrow('child_anchor_inspection_unobserved');
  });
  it('coverage: a missing or duplicated required aspect refuses', () => {
    const v = inspected(); v.visibleEvidence[1] = { ...v.visibleEvidence[0] };
    expect(() => run(v)).toThrow('child_anchor_inspection_coverage');
  });
  it('age and binding gates unchanged: age defect repairs, age uncertain holds, another context/recipe/age refuses', () => {
    const styled = childAnchorStyleDisposition(style(), A, CTX, childAnchorRecipeSha(recipe));
    expect(childAnchorDisposition(styled, run(inspected({ age: 'defect' }))).disposition).toBe('repair');
    expect(childAnchorDisposition(styled, run(inspected({ age: 'uncertain' }))).disposition).toBe('held_uncertain');
    expect(() => run(inspected({ contextSha: 'e'.repeat(64) }))).toThrow('quality_evidence_binding');
    expect(() => childAnchorInspectedDesignDisposition(inspected(), A, childAnchorInspectionContext({ ...child, age: 7 }, request.prompt), recipe)).toThrow('child_anchor_evidence_binding');
    expect(childAnchorDisposition(childAnchorStyleDisposition(style({ assessable: false }), A, CTX, childAnchorRecipeSha(recipe)), run(inspected())).disposition).toBe('held_uncertain');
  });
});

describe('inspected adoption: same candidate, THIS context, both answers', () => {
  it('admits honest; an old-context (v1) style answer never pairs with the inspected design; another candidate refuses', () => {
    const ok = childAnchorInspectedAdoptionRecord(context, recipe, style(), inspected());
    expect(assertChildAnchorInspectedAccepted(ok, A, context).unobservedConditional).toHaveLength(1);
    const oldStyle = childAnchorInspectedAdoptionRecord(context, recipe, style({ contextSha: 'd'.repeat(64) }), inspected());
    expect(() => assertChildAnchorInspectedAccepted(oldStyle, A, context)).toThrow('child_anchor_evidence_binding');
    expect(() => assertChildAnchorInspectedAccepted(ok, 'b'.repeat(64), context)).toThrow();
    const otherAuthority = childAnchorInspectionContext({ ...child, wardrobe: 'a green dress and white shoes' }, request.prompt);
    expect(() => assertChildAnchorInspectedAccepted(ok, A, otherAuthority)).toThrow('child_anchor_evidence_binding');
    const held = childAnchorInspectedAdoptionRecord(context, recipe, style(), inspected({ identity: 'uncertain' }));
    expect(() => assertChildAnchorInspectedAccepted(held, A, context)).toThrow('child_anchor_not_accepted');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The amendment runner against the REAL consumed diagnostic (read only; a temporary copy is the only thing ever mutated), with fake judges.
// ---------------------------------------------------------------------------------------------------------------
const ORIGINAL = 'C:/GNart/Work/book-renders/child-anchor-probe-r1-anchor-diag-20261018';
const ORIGINAL_CONFIG = 'C:/GNart/Work/Small_Heroes/_review/new-book-anchor-diagnostic-20261018/probe-config.json';
const real = existsSync(path.join(ORIGINAL, 'sealed.json')) && existsSync(ORIGINAL_CONFIG);
describe.skipIf(!real)('amendment re-review runner (real saved lineage, fake judges, no provider)', () => {
  const setup = (copyOriginal = false) => {
    const root = mkdtempSync(path.join(tmpdir(), 'rereview-')); roots.push(root);
    const authority = path.join(root, 'book-authority'), parent = path.join(root, 'renders'); mkdirSync(authority); mkdirSync(parent);
    for (const n of [REREVIEW_AMENDMENT.originalClaimName, REREVIEW_AMENDMENT.originalOutcomeName]) writeFileSync(path.join(authority, n), '{}');
    let output = ORIGINAL;
    if (copyOriginal) { output = path.join(root, 'original-copy'); cpSync(ORIGINAL, output, { recursive: true }); }
    const config: RereviewConfig = { version: 'child-anchor-rereview-config/v1', round: 1, diagnosticOutput: output, diagnosticConfig: ORIGINAL_CONFIG,
      diagnosticConfigSha256: sha(readFileSync(ORIGINAL_CONFIG)), candidateSha256: '6375db61419767bd120293396cac50b0c20ccc76fc27a333a65c34f2c9419c4f',
      outputParent: parent, keyEnvFile: path.join(root, 'no-key.env') };
    const env: RereviewEnv = { authorityRoot: authority, head: () => ({ head: 'f'.repeat(40), branch: 'claude/book-render-20261009', clean: true }) };
    return { root, authority, parent, config, env };
  };
  const grantFor = async (s: ReturnType<typeof setup>, round = 1) => {
    const { grantDraft } = await planRereview({ ...s.config, round }, s.env);
    const file = path.join(s.root, `grant-${round}.json`); writeFileSync(file, JSON.stringify(grantDraft));
    return { file, digest: sha(readFileSync(file)) };
  };
  /** Fake judges through the REAL meter and rule: the request the real judge would send, an answer we choose, priced like a Sol reply. */
  const fakeAdapters = (answers: { style: unknown; design: (ctx: string) => unknown }, hook?: () => void) => (directory: string, meter: AuditionMeter, guard: () => void) => {
    const reply = (wire: unknown, value: unknown) => {
      const raw = { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', output_text: JSON.stringify(value), usage: { input_tokens: 2000, output_tokens: 300 } };
      const settled = auditionReviewRule.settle(wire, { raw }, true);
      return { value, estimatedMicroUsd: settled.estimatedMicroUsd, receipt: { raw, estimatedMicroUsd: settled.estimatedMicroUsd } };
    };
    return {
      writeImage: async (name: string, bytes: Buffer) => { writeFileSync(path.join(directory, name), bytes, { flag: 'wx' }); return { imageName: name, imageSha: sha(bytes) }; },
      bytesOf: (img: { imageName: string }) => readFileSync(path.join(directory, img.imageName)),
      inspectedStyle: async (step: string, candidate: { imageName: string; imageSha: string }, ctx: typeof context, recipeSha: string) => {
        hook?.(); guard(); const wire = inspectedStyleWire(candidate, readFileSync(path.join(directory, candidate.imageName)), ctx, recipeSha);
        return meter.run(step, wire, 600000, async () => reply(wire, { ...(answers.style as object), candidateSha: candidate.imageSha, contextSha: childAnchorInspectionContextSha(ctx), recipeSha }));
      },
      inspectedDesign: async (step: string, candidate: { imageName: string; imageSha: string }, ctx: typeof context, r: typeof recipe) => {
        hook?.(); guard(); const wire = await inspectedDesignWire(candidate, readFileSync(path.join(directory, candidate.imageName)), ctx, r);
        return meter.run(step, wire, 600000, async () => reply(wire, { ...(answers.design(childAnchorInspectionContextSha(ctx)) as object), candidateSha: candidate.imageSha, recipeSha: childAnchorRecipeSha(r) }));
      },
    };
  };
  const honest = { style: style(), design: (ctx: string) => inspected({ contextSha: ctx }) };
  const heldAnswers = { style: style(), design: (ctx: string) => inspected({ contextSha: ctx, identity: 'uncertain' }) };

  it('plans offline from the producer: candidate/recipe rebuilt, original 59910 re-derived, two fresh reviews that fit USD 1', async () => {
    const s = setup(), { plan } = await planRereview(s.config, s.env);
    expect(plan).toMatchObject({ round: 1, priorSettledMicroUsd: 59910, capMicroUsd: 1000000, reviewsBefore: 0, reused: [], providerCalls: 0, keyRead: false,
      candidateSha256: s.config.candidateSha256, recipeSha: '1314373517fffa7b38a5c7ec985e95ec65cfa85e352cda3d02f7aab298f297f0' });
    expect(plan.steps.map(x => x.step)).toEqual(['reference_child_style_qa', 'reference_child_qa']);
    expect(plan.admissionAtAssumedActuals.every(x => x.fits)).toBe(true);
    // A fresh context: never the original v1 contextSha.
    expect(plan.contextSha).not.toBe('cc29e78e314e10701924fdc1e9febc2b40fee4548a10f0da9fb3a50f97f4dcca');
  });
  it('honest round 1 passes from its settled records; a second round is then refused; the claim is single-use', async () => {
    const s = setup(), g = await grantFor(s);
    const r = await runRereview({ config: s.config, env: s.env, grantFile: g.file, grantSha: g.digest, signal: new AbortController().signal, log: () => {}, adapters: fakeAdapters(honest) });
    expect(r).toMatchObject({ status: 'complete', disposition: 'passed' });
    const outcome = await settledRereviewOutcome(s.config, { rounds: 1 });
    expect(outcome).toMatchObject({ disposition: 'passed', design: { unobservedConditional: [expect.objectContaining({ trait: TOOTH })] } });
    await expect(planRereview({ ...s.config, round: 2 }, s.env)).rejects.toThrow('rereview_already_passed');
    await expect(runRereview({ config: s.config, env: s.env, grantFile: g.file, grantSha: g.digest, signal: new AbortController().signal, log: () => {},
      adapters: fakeAdapters(honest) })).rejects.toThrow('rereview_round_used');
  });
  it('a held round 1 (identity uncertain) stays held; round 2 with the unchanged criterion is refused (no stochastic retry)', async () => {
    const s = setup(), g = await grantFor(s);
    const r = await runRereview({ config: s.config, env: s.env, grantFile: g.file, grantSha: g.digest, signal: new AbortController().signal, log: () => {}, adapters: fakeAdapters(heldAnswers) });
    expect(r).toMatchObject({ disposition: 'held_uncertain' });
    await expect(planRereview({ ...s.config, round: 2 }, s.env)).rejects.toThrow('rereview_unchanged_criteria');
  });
  it('a grant that is not the exact rebuilt draft, or a changed config, refuses before any claim or folder', async () => {
    const s = setup(), g = await grantFor(s);
    const forged = path.join(s.root, 'forged.json'); writeFileSync(forged, JSON.stringify({ ...JSON.parse(readFileSync(g.file, 'utf8')), round: 2 }));
    await expect(runRereview({ config: s.config, env: s.env, grantFile: forged, grantSha: sha(readFileSync(forged)), signal: new AbortController().signal, log: () => {},
      adapters: fakeAdapters(honest) })).rejects.toThrow('rereview_grant');
    await expect(runRereview({ config: { ...s.config, outputParent: s.root }, env: s.env, grantFile: g.file, grantSha: g.digest, signal: new AbortController().signal,
      log: () => {}, adapters: fakeAdapters(honest) })).rejects.toThrow('rereview_grant');
    expect(existsSync(path.join(s.authority, REREVIEW_AMENDMENT.claimName(1)))).toBe(false);
    expect(existsSync(rereviewOutput(s.config))).toBe(false);
  });
  it('the original diagnostic changing after admission stops before the paid call (guard at every claim)', async () => {
    const s = setup(true), g = await grantFor(s);
    const hook = () => appendFileSync(path.join(s.config.diagnosticOutput, 'probe.html'), ' ');
    await expect(runRereview({ config: s.config, env: s.env, grantFile: g.file, grantSha: g.digest, signal: new AbortController().signal, log: () => {},
      adapters: fakeAdapters(honest, hook) })).rejects.toThrow('rereview_original_changed');
    expect(existsSync(path.join(rereviewOutput(s.config), 'paid-stages', 'reference_child_style_qa.claim.json'))).toBe(false);
  });
  it('the source moving after admission stops before the paid call', async () => {
    const s = setup(), g = await grantFor(s); let moved = false;
    const env: RereviewEnv = { ...s.env, head: () => ({ head: moved ? '0'.repeat(40) : 'f'.repeat(40), branch: 'claude/book-render-20261009', clean: true }) };
    await expect(runRereview({ config: s.config, env, grantFile: g.file, grantSha: g.digest, signal: new AbortController().signal, log: () => {},
      adapters: fakeAdapters(honest, () => { moved = true; }) })).rejects.toThrow('rereview_source_changed');
  });
});
