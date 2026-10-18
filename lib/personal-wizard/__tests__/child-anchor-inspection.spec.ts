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
  childAnchorInspectedAdoptionRecord, assertChildAnchorInspectedAccepted, childAnchorInspectionView, CHILD_ANCHOR_MATERIALITY_VERSION,
  CHILD_ANCHOR_INSPECTION_INSTRUCTION, CHILD_ANCHOR_MATERIALITY_INSTRUCTION } from '../child-anchor-style';
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
// child-anchor-materiality/v1 (owner amendment 2026-10-18): typed cosmetic vs material identity difference.
// ---------------------------------------------------------------------------------------------------------------
const materialContext = childAnchorInspectionContext(child, request.prompt, CHILD_ANCHOR_MATERIALITY_VERSION), MCTX = childAnchorInspectionContextSha(materialContext);
type Diff = { aspect: string; verdict?: string; materiality: string; deviation?: string };
const material = (over: { identity?: 'pass' | 'defect' | 'uncertain'; diffs?: Diff[]; character?: string; age?: string; defect?: string; contextSha?: string } = {}) => ({
  candidateSha: A, contextSha: over.contextSha ?? MCTX, recipeSha: childAnchorRecipeSha(recipe), acceptanceVersion: CHILD_ANCHOR_MATERIALITY_VERSION,
  checks: checks(over.identity ?? 'pass').map(c => c.category === over.defect ? { ...c, verdict: 'defect', correction: 'fix it' } : c),
  apparentAge: { requestedAge: 6, verdict: over.age ?? 'compatible', observation: 'reads six', correction: over.age === 'defect' ? 'older build' : '' },
  visibleEvidence: CHILD_ANCHOR_REQUIRED_VISIBLE.map(aspect => { const d = over.diffs?.find(x => x.aspect === aspect);
    return { aspect, verdict: d ? d.verdict ?? 'mismatch' : 'matched', observation: `${aspect} seen`, materiality: d?.materiality ?? 'not_applicable',
      deviation: d?.deviation ?? (d && d.materiality !== 'not_applicable' ? 'drawn differently from the written design' : '') }; }),
  unobservedConditional: [{ trait: TOOTH, condition: 'open_mouth_or_smile', observation: 'lips closed per the anchor clause' }],
  recognizableCharacter: { verdict: over.character ?? 'same_character', observation: 'the same written child' } });
const cosmetic = { aspect: 'face', materiality: 'cosmetic' };

describe('child-anchor-materiality/v1: versioned opt-in, legacy parity', () => {
  it('absent acceptance: the inspection/v1 context, digest and requests are unchanged; the opt-in binds rule + amendment into a new digest', () => {
    expect(childAnchorInspectionContext(child, request.prompt, CHILD_ANCHOR_INSPECTION_VERSION)).toEqual(context);
    expect('materiality' in context).toBe(false);
    expect(materialContext).toMatchObject({ version: CHILD_ANCHOR_MATERIALITY_VERSION, materiality: { amendment: 'OWNER-AUTONOMOUS-BOOK-MATERIALITY-AMENDMENT-20261018' } });
    expect(MCTX).not.toBe(CTX);
    const legacy = childAnchorInspectedDesignPayload({ candidateSha: A, context, recipe, imageURLs: Array(5).fill('data:image/png;base64,AA==') });
    expect([(legacy.text.format as { name: string }).name, textOf(legacy).version]).toEqual(['child_anchor_design_inspection_v1', CHILD_ANCHOR_INSPECTION_VERSION]);
    expect(legacy.instructions).toContain(CHILD_ANCHOR_INSPECTION_INSTRUCTION);
    const p = childAnchorInspectedDesignPayload({ candidateSha: A, context: materialContext, recipe, imageURLs: Array(5).fill('data:image/png;base64,AA==') });
    expect([(p.text.format as { name: string }).name, textOf(p).version, textOf(p).contextSha]).toEqual(['child_anchor_design_materiality_v1', CHILD_ANCHOR_MATERIALITY_VERSION, MCTX]);
    expect(p.instructions).toContain(CHILD_ANCHOR_MATERIALITY_INSTRUCTION);
    expect(p.instructions).not.toContain(CHILD_ANCHOR_INSPECTION_INSTRUCTION);
    const s = childAnchorStylePayload({ candidateSha: A, contextSha: MCTX, recipeSha: childAnchorRecipeSha(recipe), candidateURL: 'data:image/png;base64,AA==', inspection: CHILD_ANCHOR_MATERIALITY_VERSION });
    expect([(s.text.format as { name: string }).name, textOf(s).version]).toEqual(['child_anchor_style_materiality_v1', CHILD_ANCHOR_MATERIALITY_VERSION]);
    // A context claiming one version with the other's fields refuses.
    expect(() => childAnchorInspectedDesignDisposition(material(), A, { ...context, version: CHILD_ANCHOR_MATERIALITY_VERSION } as never, recipe)).toThrow();
  });
  it('old and new answers never cross: a v1 answer under materiality and a materiality answer under v1 both refuse', () => {
    expect(() => childAnchorInspectedDesignDisposition(inspected({ contextSha: MCTX }), A, materialContext, recipe)).toThrow();
    expect(() => childAnchorInspectedDesignDisposition(material({ contextSha: CTX }), A, context, recipe)).toThrow();
  });
});

describe('child-anchor-materiality/v1: disposition', () => {
  const run = (v: unknown) => childAnchorInspectedDesignDisposition(v, A, materialContext, recipe);
  const styled = childAnchorStyleDisposition(style({ contextSha: MCTX }), A, MCTX, childAnchorRecipeSha(recipe));
  it('exact match passes with no accepted deviation', () => {
    const d = run(material());
    expect([d.design, (d as { acceptedDeviations: unknown[] }).acceptedDeviations]).toEqual(['passed', []]);
  });
  it('a cosmetic difference of a recognizable character passes WITH notes; the evidence stays a mismatch, never matched', () => {
    const d = run(material({ diffs: [{ ...cosmetic, deviation: 'arched instead of short straight' }] })) as ReturnType<typeof run> & { acceptedDeviations: unknown[] };
    expect(d.design).toBe('passed');
    expect(d.acceptedDeviations).toEqual([{ aspect: 'face', deviation: 'arched instead of short straight', observation: 'face seen' }]);
    expect(d.visibleEvidence.find(e => e.aspect === 'face')!.verdict).toBe('mismatch');
    expect(childAnchorDisposition(styled, d).disposition).toBe('passed');
  });
  it('material identity drift or a different character is a repair; calling it identity pass refuses', () => {
    const d = run(material({ identity: 'defect', diffs: [{ aspect: 'hair', materiality: 'material' }] }));
    expect(childAnchorDisposition(styled, d)).toMatchObject({ disposition: 'repair', corrections: [expect.stringContaining('identity:')] });
    expect(run(material({ identity: 'defect', diffs: [cosmetic], character: 'different_character' })).design).toBe('repair');
    expect(() => run(material({ diffs: [{ aspect: 'hair', materiality: 'material' }] }))).toThrow('child_anchor_materiality_incoherent');
    expect(() => run(material({ character: 'different_character' }))).toThrow('child_anchor_materiality_incoherent');
  });
  it('uncertain, missing or contradictory materiality never passes', () => {
    expect(run(material({ identity: 'uncertain', diffs: [{ aspect: 'face', materiality: 'uncertain' }] })).design).toBe('held_uncertain');
    expect(run(material({ identity: 'uncertain', character: 'uncertain' })).design).toBe('held_uncertain');
    for (const v of [material({ diffs: [{ aspect: 'face', materiality: 'uncertain' }] }), material({ character: 'uncertain' }),
      material({ diffs: [{ aspect: 'face', materiality: 'not_applicable' }] }), material({ diffs: [{ aspect: 'face', verdict: 'matched', materiality: 'cosmetic' }] }),
      material({ diffs: [{ ...cosmetic, deviation: ' ' }] }), material({ identity: 'defect', diffs: [cosmetic] })])
      expect(() => run(v)).toThrow('child_anchor_materiality_incoherent');
    const { recognizableCharacter: _c, ...missing } = material();
    expect(() => run(missing)).toThrow();
  });
  it('unreadable required face evidence holds; identity pass over it refuses', () => {
    expect(run(material({ identity: 'uncertain', diffs: [{ aspect: 'face', verdict: 'unreadable', materiality: 'not_applicable' }] })).design).toBe('held_uncertain');
    expect(() => run(material({ diffs: [{ aspect: 'face', verdict: 'unreadable', materiality: 'not_applicable' }] }))).toThrow('child_anchor_materiality_incoherent');
  });
  it('age, style, anatomy and safety keep their own gates beside an accepted cosmetic difference', () => {
    expect(childAnchorDisposition(styled, run(material({ diffs: [cosmetic], age: 'defect' }))).disposition).toBe('repair');
    expect(childAnchorDisposition(styled, run(material({ diffs: [cosmetic], age: 'uncertain' }))).disposition).toBe('held_uncertain');
    expect(run(material({ diffs: [cosmetic], defect: 'anatomy' })).design).toBe('repair');
    expect(run(material({ diffs: [cosmetic], defect: 'safety' })).design).toBe('repair');
    const badStyle = childAnchorStyleDisposition(style({ contextSha: MCTX, style01Match: false }), A, MCTX, childAnchorRecipeSha(recipe));
    expect(childAnchorDisposition(badStyle, run(material({ diffs: [cosmetic] }))).disposition).toBe('repair');
  });
  it('adoption: same candidate, THIS materiality context and version; old-context style, a relabelled record or a v1 authority refuse', () => {
    const ok = childAnchorInspectedAdoptionRecord(materialContext, recipe, style({ contextSha: MCTX }), material({ diffs: [cosmetic] }));
    expect(ok.version).toBe(CHILD_ANCHOR_MATERIALITY_VERSION);
    expect(assertChildAnchorInspectedAccepted(ok, A, materialContext).acceptedDeviations).toHaveLength(1);
    expect(() => assertChildAnchorInspectedAccepted(childAnchorInspectedAdoptionRecord(materialContext, recipe, style(), material({ diffs: [cosmetic] })), A, materialContext))
      .toThrow('child_anchor_evidence_binding');
    expect(() => assertChildAnchorInspectedAccepted({ ...ok, version: CHILD_ANCHOR_INSPECTION_VERSION }, A, materialContext)).toThrow('child_anchor_evidence_binding');
    expect(() => assertChildAnchorInspectedAccepted(ok, A, context)).toThrow('child_anchor_evidence_binding');
    // The v1 adoption record is byte-identical in shape and still has no accepted-deviation channel.
    const v1 = childAnchorInspectedAdoptionRecord(context, recipe, style(), inspected());
    expect([v1.version, 'acceptedDeviations' in assertChildAnchorInspectedAccepted(v1, A, context)]).toEqual([CHILD_ANCHOR_INSPECTION_VERSION, false]);
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
  const fakeAdapters = (answers: { style: unknown; design: (ctx: string, context: typeof materialContext) => unknown }, hook?: () => void) => (directory: string, meter: AuditionMeter, guard: () => void) => {
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
        return meter.run(step, wire, 600000, async () => reply(wire, { ...(answers.design(childAnchorInspectionContextSha(ctx), ctx) as object), candidateSha: candidate.imageSha, recipeSha: childAnchorRecipeSha(r) }));
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
  // F1 (Codex QA 48c84e6f): a change scheduled by admission's own final head read lands before the writer resumes. The round must be refused
  // against the CAPTURED admission baseline before the one-use claim, the folder or any paid claim exists; the honest control still completes.
  it.each(['honest', 'head', 'dirty', 'original', 'grant', 'branch-at-admission'])('admission baseline re-checked before the one-use claim: %s', async scenario => {
    const s = setup(scenario === 'original'), g = await grantFor(s);
    let reads = 0, moved = false, judged = 0;
    const env: RereviewEnv = { ...s.env, head: () => {
      reads++;
      const branch = scenario === 'branch-at-admission' && reads === 2 ? 'other' : 'claude/book-render-20261009';
      const now = { head: moved && scenario === 'head' ? '0'.repeat(40) : 'f'.repeat(40), branch, clean: !(moved && scenario === 'dirty') };
      if (reads === 2 && scenario !== 'honest' && scenario !== 'branch-at-admission') queueMicrotask(() => {
        moved = true;
        if (scenario === 'original') appendFileSync(path.join(s.config.diagnosticOutput, 'probe.html'), '\n');
        if (scenario === 'grant') appendFileSync(g.file, '\n');
      });
      return now;
    } };
    const run = runRereview({ config: s.config, env, grantFile: g.file, grantSha: g.digest, signal: new AbortController().signal, log: () => {},
      adapters: fakeAdapters(honest, () => { judged++; }) });
    const out = rereviewOutput(s.config), claim = path.join(s.authority, REREVIEW_AMENDMENT.claimName(1));
    if (scenario === 'honest') {
      await expect(run).resolves.toMatchObject({ status: 'complete', disposition: 'passed' });
      expect([existsSync(claim), judged, existsSync(path.join(out, 'paid-stages', 'reference_child_style_qa.claim.json'))]).toEqual([true, 2, true]);
      return;
    }
    const code = { head: 'rereview_source_changed', dirty: 'rereview_source_changed', 'branch-at-admission': 'rereview_source_changed',
      original: 'rereview_original_changed', grant: 'rereview_grant' }[scenario]!;
    await expect(run).rejects.toThrow(code);
    expect({ claimWritten: existsSync(claim), outputCreated: existsSync(out), outcomeWritten: existsSync(path.join(s.authority, REREVIEW_AMENDMENT.outcomeName(1))), judged })
      .toEqual({ claimWritten: false, outputCreated: false, outcomeWritten: false, judged: 0 });
  });
  it('materiality round 2: after the actual-shaped v1 round 1 (visible face difference -> repair), the changed contract sends exactly two fresh reviews; history stays v1', async () => {
    const s = setup(), g = await grantFor(s);
    // Parity: the legacy plan's context is the one the actual round 1 used.
    expect((await planRereview(s.config, s.env)).plan.contextSha).toBe('41ed25faf289d3126a2bf22e5eff35af0b2b207b00550e00bc473feb366c7f26');
    const v1Repair = { style: style(), design: (ctx: string) => inspected({ contextSha: ctx, identity: 'defect', evidence: { face: 'mismatch' } }) };
    expect(await runRereview({ config: s.config, env: s.env, grantFile: g.file, grantSha: g.digest, signal: new AbortController().signal, log: () => {},
      adapters: fakeAdapters(v1Repair) })).toMatchObject({ disposition: 'repair' });
    const round2 = { ...s.config, round: 2 };
    await expect(planRereview(round2, s.env)).rejects.toThrow('rereview_unchanged_criteria');
    const m = { ...round2, acceptance: CHILD_ANCHOR_MATERIALITY_VERSION };
    const { plan, grantDraft } = await planRereview(m, s.env);
    expect(plan).toMatchObject({ round: 2, reviewsBefore: 2, acceptance: CHILD_ANCHOR_MATERIALITY_VERSION, policyAmendment: 'OWNER-AUTONOMOUS-BOOK-MATERIALITY-AMENDMENT-20261018' });
    expect(plan.steps.map(x => x.step)).toEqual(['reference_child_style_qa', 'reference_child_qa']);
    expect(plan.contextSha).not.toBe('41ed25faf289d3126a2bf22e5eff35af0b2b207b00550e00bc473feb366c7f26');
    expect(plan.priorSettledMicroUsd).toBeGreaterThan(59910);
    expect(grantDraft).toMatchObject({ round: 2, acceptance: CHILD_ANCHOR_MATERIALITY_VERSION });
    const file = path.join(s.root, 'grant-2m.json'); writeFileSync(file, JSON.stringify(grantDraft));
    const answer = { style: style(), design: (ctx: string, c: typeof materialContext) => ({ ...material({ contextSha: ctx, diffs: [{ ...cosmetic, deviation: 'arched brows' }] }),
      ...(c.version === CHILD_ANCHOR_MATERIALITY_VERSION ? {} : { never: true }) }) };
    expect(await runRereview({ config: m, env: s.env, grantFile: file, grantSha: sha(readFileSync(file)), signal: new AbortController().signal, log: () => {},
      adapters: fakeAdapters(answer) })).toMatchObject({ status: 'complete', disposition: 'passed' });
    const outcome = await settledRereviewOutcome(m, { rounds: 2 });
    expect(outcome).toMatchObject({ disposition: 'passed', acceptance: CHILD_ANCHOR_MATERIALITY_VERSION, style: { round: 2 },
      design: { round: 2, acceptedDeviations: [expect.objectContaining({ aspect: 'face', deviation: 'arched brows' })], recognizableCharacter: 'same_character' } });
    expect(outcome.design!.visibleEvidence.find(e => e.aspect === 'face')).toMatchObject({ verdict: 'mismatch', materiality: 'cosmetic' });
    // History under its own contract: round 1's answers stay a v1 repair; they never become a materiality pass, and round 2's never a v1 one.
    expect(await settledRereviewOutcome(round2, { rounds: 2 })).toMatchObject({ disposition: 'repair', style: { round: 1 }, design: { round: 1 } });
    expect((await settledRereviewOutcome(m, { rounds: 1 })).disposition).toBe('held_uncertain');
    // The four new reviews are spent: nothing further can be planned.
    await expect(planRereview({ ...m, round: 3 } as never, s.env)).rejects.toThrow();
  });
  it('materiality round 2 with a material difference is a repair, not a pass (no second chance under the amendment)', async () => {
    const s = setup(), g = await grantFor(s);
    await runRereview({ config: s.config, env: s.env, grantFile: g.file, grantSha: g.digest, signal: new AbortController().signal, log: () => {},
      adapters: fakeAdapters({ style: style(), design: (ctx: string) => inspected({ contextSha: ctx, identity: 'defect', evidence: { face: 'mismatch' } }) }) });
    const m = { ...s.config, round: 2, acceptance: CHILD_ANCHOR_MATERIALITY_VERSION };
    const { grantDraft } = await planRereview(m, s.env), file = path.join(s.root, 'grant-2x.json'); writeFileSync(file, JSON.stringify(grantDraft));
    expect(await runRereview({ config: m, env: s.env, grantFile: file, grantSha: sha(readFileSync(file)), signal: new AbortController().signal, log: () => {},
      adapters: fakeAdapters({ style: style(), design: (ctx: string) => material({ contextSha: ctx, identity: 'defect', diffs: [{ aspect: 'hair', materiality: 'material' }] }) }) }))
      .toMatchObject({ disposition: 'repair' });
    await expect(planRereview({ ...m, round: 2 }, s.env)).rejects.toThrow('rereview_round_used');
  });
});
