import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../request-acceptance';
import { fixtureEditorOutput, personalStoryboardFixture } from './personal-storyboard-fixture';
import { preparePersonalStory } from '../story-writer';
import { resolvePersonalWizardOptions } from '../options';
import { prepareStoryEdit, compileStoryEdit, editorNeedsWork, assertStoryEditBinding } from '../story-editor';
import { editedStoryResultSchema } from '../story-editor-contract';
import { assertSemanticEditEvidence, SEMANTIC_EDIT_CATEGORIES } from '../story-semantic-audit';
import { prepareStoryTextReview } from '../story-text-review';
import { readTextBookPreview } from '../book-preview';
const options = resolvePersonalWizardOptions();
async function setup(length = 'short') {
  const f = await personalStoryboardFixture(length); const p = preparePersonalStory(f.request, options);
  return { f, p, output: fixtureEditorOutput(prepareStoryEdit(p, f.draftResult)) };
}
describe('semantic edit accountability, not semantic truth', () => {
  it.each(['short', 'medium', 'long'])('binds a current %s audit and separate private-free QA packets', async length => {
    const { f, p, output } = await setup(length); const result = compileStoryEdit(p, f.draftResult, output, null);
    expect(result.editing.version).toBe('personal-story-editor/diagnostic-v3'); assertStoryEditBinding(result);
    const packets = prepareStoryTextReview(p, result.editing.original, { plan: result.plan, manuscript: result.manuscript, characterDigest: result.characterDigest });
    expect(packets.final.manuscript.pages).toHaveLength(p.brief.beats);
    expect(JSON.stringify(packets.final)).not.toContain('semanticAudit');
    expect(JSON.stringify(packets.final)).not.toContain('synthetic editor fixture');
    expect(packets.final).not.toHaveProperty('original'); expect(packets.comparison.original).toEqual(packets.final.manuscript);
  });
  it.each(['missing', 'category', 'version', 'spread', 'quote', 'duplicate', 'empty', 'applicability'])('rejects %s audit evidence in real compilation', async kind => {
    const { f, p, output } = await setup(); const raw: any = structuredClone(output);
    if (kind === 'missing') delete raw.semanticAudit;
    if (kind === 'category') delete raw.semanticAudit.world_rules;
    if (kind === 'version') raw.semanticAudit.version = 'foreign';
    if (kind === 'spread') raw.semanticAudit.child_agency.revised[0].pageNumber = 16;
    if (kind === 'quote') raw.semanticAudit.child_agency.revised[0].quote = 'INVENTED_QUOTATION';
    if (kind === 'duplicate') raw.semanticAudit.child_agency.revised.push(raw.semanticAudit.child_agency.revised[0]);
    if (kind === 'empty') raw.semanticAudit.child_agency.original = [];
    if (kind === 'applicability') raw.semanticAudit.child_agency.outcome = 'not_applicable';
    expect(() => compileStoryEdit(p, f.draftResult, raw, null)).toThrow();
  });
  it.each(SEMANTIC_EDIT_CATEGORIES)('preserves %s unresolved HOLD through preview', async category => {
    const { f, p, output } = await setup(); output.semanticAudit[category].outcome = 'unresolved';
    const result = compileStoryEdit(p, f.draftResult, output, null); expect(editorNeedsWork(result)).toBe(true);
    expect(readTextBookPreview({ version: 'personal-book-text/diagnostic-v1', status: 'story_ready_for_reading', writerResult: result, runtimeEligible: false,
      accounting: { model: 'gpt-6.1-sol', reservedUsd: 1, estimatedUsd: null, knownUsageEstimateUsd: 0, providerAttempts: 3, stages: [], kind: 'usage_estimate_not_invoice' } }, p.brief.requestId)).toBeNull();
  });
  it('retains archived v2 without inventing an audit', async () => {
    const { f } = await setup(); const archived = structuredClone(f.result);
    archived.editing.version = 'personal-story-editor/diagnostic-v2'; delete archived.editing.semanticAudit; delete archived.editing.auditDigest;
    expect(editedStoryResultSchema.safeParse(archived).success).toBe(true); expect(() => assertStoryEditBinding(archived)).not.toThrow();
  });
  it('allows an accountable intentional revision without claiming its quotes prove improvement', async () => {
    const { f, p, output } = await setup(); output.semanticAudit.world_rules.outcome = 'intentional_revision';
    output.semanticAudit.world_rules.explanation = 'The exact quotation exists but could still be unrelated to this claimed rule.';
    assertSemanticEditEvidence(output.semanticAudit, f.draftResult.manuscript, output.manuscript);
    expect(() => compileStoryEdit(p, f.draftResult, output, null)).not.toThrow();
  });
  it('detects persisted audit tampering without exposing it to final-only reviewer', async () => {
    const { f, p, output } = await setup(); const result = compileStoryEdit(p, f.draftResult, output, null);
    const final = { plan: result.plan, manuscript: result.manuscript, characterDigest: result.characterDigest };
    const before = prepareStoryTextReview(p, result.editing.original, final);
    result.editing.semanticAudit!.world_rules.explanation = 'PRIVATE_EDITOR_SENTINEL';
    expect(() => assertStoryEditBinding(result)).toThrow('revision_binding');
    expect(prepareStoryTextReview(p, result.editing.original, final)).toEqual(before);
    expect(JSON.stringify(before)).not.toContain('PRIVATE_EDITOR_SENTINEL');
    const altered = structuredClone(final); altered.manuscript.pages[0].text += ' fabricated change';
    // Prose changes require a new packet identity even when plan is unchanged.
    expect(prepareStoryTextReview(p, result.editing.original, altered).final.sourceDigest).not.toBe(before.final.sourceDigest);
    const foreign = structuredClone(final); foreign.plan.requestId = 'other';
    expect(() => prepareStoryTextReview(p, result.editing.original, foreign)).toThrow('source_binding');
    const stale = structuredClone(final); stale.manuscript.planDigest = 'a'.repeat(64);
    expect(() => prepareStoryTextReview(p, result.editing.original, stale)).toThrow('source_binding');
    expect(createHash('sha256').update(canonicalJson(output.semanticAudit)).digest('hex')).toBe(result.editing.auditDigest);
  });
});
