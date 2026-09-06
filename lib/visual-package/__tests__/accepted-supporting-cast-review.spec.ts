import { describe, expect, it, vi } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import { prepareAcceptedSupportingCastReview, loadAcceptedSupportingCastReview } from '../acceptedSupportingCastReview';
import { buildStorySourceAuthoritySnapshot } from '../storySourceAuthority';
import { compileBookVisualContractTemplate, assertCastIsFactAuthoritative } from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';
import { buildVisualContractCandidateArtifact, persistVisualContractCandidate } from '../visualContractAuthoringLifecycle';
import type { SupportingCastEntry } from '@/lib/visual-contract-compiler/supportingCastReview';
import { materialize } from '@/lib/visual-contract-compiler/materializeContract';
import { validateBookVisualContractTemplate } from '@/lib/visual-contract-compiler/validateTemplateContract';
import { validateResolvedBookVisualContract } from '@/lib/visual-contract-compiler/validateResolvedContract';
import { buildVisualContractPromptBlock } from '@/lib/visual-contract-compiler/buildVisualContractPromptBlock';
import { derivePageVisualContracts } from '@/lib/visual-contract-compiler/derivePageVisualContracts';
import { withCurrentActionSemanticCoverage } from '@/lib/__tests__/visual-contract-authoring-draft-fixtures';

const STORY_KEY = 'dragon_dini_adventure';
const STORY_PATH = 'story-pipeline/04_approved_story_sources/accepted/dragon_dini_adventure/revisions/64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc/integrated.md';
const request = () => ({ repoRoot: process.cwd(), storyKey: STORY_KEY, storyPath: STORY_PATH });
function baker(): SupportingCastEntry {
  const snapshot = buildStorySourceAuthoritySnapshot(request());
  const cite = (pageNumber: number) => ({ source: 'story' as const, pageNumber, quote: snapshot.content.pages.find((p) => p.pageNumber === pageNumber)!.text });
  return { kind: 'human_individual', id: 'human:baker', role: 'baker', aliases: ['האופה'], gender: 'female',
    appearanceClass: 'reviewed_non_relative', relationshipEvidence: [], identityEvidence: [cite(1)], genderEvidence: [cite(1)],
    presence: [{ pageNumber: 1, evidence: [cite(1)] }, { pageNumber: 12, evidence: [cite(12)] }] };
}
function prepared() { return prepareAcceptedSupportingCastReview({ ...request(), entries: [baker()] }); }
function draftFor(input: ReturnType<typeof prepared>['input']) {
  return withCurrentActionSemanticCoverage({ pages: input.pages, sourceEvidenceCatalog: input.sourceEvidenceCatalog,
    draft: {
      version: 1, storyKey: input.storyKey, worldType: 'grounded',
      locations: [{ id: 'scene', name: 'Scene', description: 'A simple outdoor scene', timeOfDay: 'day', environmentClass: 'outdoor' }],
      zones: [{ id: 'stage', locationId: 'scene', name: 'Stage', description: 'The open scene area' }],
      cast: { child: { id: 'child:hero', role: 'child', wardrobe: { description: 'blue shirt and trousers' } } },
      humanCast: [{ id: 'human:baker', role: 'baker', garments: [{ id: 'apron', colour: { mode: 'explicit', value: 'cream', origin: { kind: 'policy_default', policyId: 'test-only-apron', version: 'v1' } } }], forbiddenAppearance: [] }],
      recurringProps: [], forbiddenGlobalElements: [],
      coverContract: { worldType: 'grounded', locationId: 'scene', zoneId: 'stage', timeOfDay: 'day', castIds: ['child:hero', 'companion:dragon_dini'], mustShow: ['The child and companion in the open scene.'], mustNotShow: [] },
      pageContracts: input.pages.map((page) => ({ pageNumber: page.pageNumber, locationId: 'scene', zoneId: 'stage',
        transition: { kind: 'steady' }, sameLocationAs: page.pageNumber === 1 ? null : 1,
        castIds: ['child:hero', 'companion:dragon_dini'], mustShow: ['The child and companion in the open scene.'], mustNotShow: [],
        characterPresence: { child: true, companion: true }, propState: [], camera: 'wide view',
      })),
    },
  });
}
describe('accepted supporting cast preparation and real compiler boundary', () => {
  it('binds the actual immutable accepted revision and reloads serialized review input', () => {
    const value = prepared();
    expect(value.review.binding.sourceSnapshotDigest).toBe('8de91442f084a45af642bdaa49bd73f31ba37cf03c00ccd0aafad2995e605f16');
    expect(value.review.binding.visualDirectionsSha256).toBe(value.snapshot.content.acceptedRevisionAuthority!.fileSha256['visual-directions.json']);
    expect(loadAcceptedSupportingCastReview({ ...request(), review: JSON.parse(JSON.stringify(value.review)) }).review).toEqual(value.review);
  });
  it.each(['sourceSnapshotDigest', 'acceptedRevisionDigest', 'acceptedAuthorityDigest', 'sourceDigest', 'visualDirectionsSha256'] as const)('rejects a recomputed but substituted %s binding', (field) => {
    const value = prepared().review;
    value.binding[field] = 'a'.repeat(64);
    const { digest: _digest, digestAlgorithm: _algorithm, ...payload } = value;
    value.digest = canonicalHash(payload);
    expect(() => loadAcceptedSupportingCastReview({ ...request(), review: value })).toThrow('accepted_binding_mismatch');
  });
  it('rejects unaccepted source preparation', () => {
    expect(() => prepareAcceptedSupportingCastReview({ ...request(), storyKey: 'bunny_ometz_adventure', storyPath: 'story-bank/v3-approved/bunny_ometz_adventure.md', entries: [] })).toThrow('accepted_revision_required');
  });
  it('rejects an unsupported group before the injected caller, with no fallback', async () => {
    const initial = prepared();
    const quote = initial.input.pages.find((p) => p.pageNumber === 9)!.text;
    const citation = { pageNumber: 9, source: 'story', quote };
    const value = prepareAcceptedSupportingCastReview({ ...request(), entries: [{
      kind: 'human_group', id: 'human-group:band', role: 'band', aliases: ['הלהקה'],
      identityEvidence: [citation], presence: [{ pageNumber: 9, evidence: [citation] }],
      appearanceClass: 'reviewed_human_ensemble', membership: 'same_ensemble_when_recurring', cardinality: 'multiple_unspecified',
    }] });
    const caller = vi.fn();
    await expect(compileBookVisualContractTemplate(value.input, { callLLM: caller, supportingCastReview: { ...request(), review: value.review } })).rejects.toThrow('classification_not_yet_supported');
    expect(caller).not.toHaveBeenCalled();
  });
  it('rejects source-input substitution before the caller', async () => {
    const value = prepared();
    value.input.pages[0].text += ' Changed source text.';
    const caller = vi.fn();
    await expect(compileBookVisualContractTemplate(value.input, { callLLM: caller, supportingCastReview: { ...request(), review: value.review } })).rejects.toThrow();
    expect(caller).not.toHaveBeenCalled();
  });
  it('matches descriptive draft fields by exact identity before a shared role', async () => {
    const initial = prepared();
    const direction = initial.input.pageImageDirections!.find((p) => p.pageNumber === 5)!.imageDirection;
    const cite = { pageNumber: 5, source: 'visual_direction' as const, quote: direction };
    const first = { ...baker(), role: 'townsperson' };
    const second: SupportingCastEntry = {
      kind: 'human_individual', id: 'human:broom_holder', role: 'townsperson', aliases: ['broom man'], gender: 'male',
      appearanceClass: 'reviewed_non_relative', relationshipEvidence: [], identityEvidence: [cite],
      genderEvidence: [{ pageNumber: 5, source: 'story', quote: initial.input.pages[4].text }],
      presence: [{ pageNumber: 5, evidence: [cite] }],
    };
    const value = prepareAcceptedSupportingCastReview({ ...request(), entries: [first, second] });
    const draft = draftFor(value.input);
    const bakerDraft = { ...draft.humanCast[0], role: 'townsperson' };
    const broomDraft = structuredClone(bakerDraft);
    broomDraft.id = 'human:broom_holder'; broomDraft.garments[0].colour.value = 'brown';
    draft.humanCast = [broomDraft, bakerDraft];
    const result = await compileBookVisualContractTemplate(value.input, { callLLM: async () => JSON.stringify(draft), supportingCastReview: { ...request(), review: value.review } });
    expect(result.template.humanCast.find((h) => h.id === 'human:baker')!.garments[0].colour.value).toBe('cream');
    expect(result.template.humanCast.find((h) => h.id === 'human:broom_holder')!.garments[0].colour.value).toBe('brown');
    draft.humanCast = [bakerDraft];
    const absent = await compileBookVisualContractTemplate(value.input, { callLLM: async () => JSON.stringify(draft), supportingCastReview: { ...request(), review: value.review } });
    expect(absent.template.humanCast.find((h) => h.id === 'human:broom_holder')!.garments).toEqual([]);
  });
  it('projects a source-backed arbitrary individual through compiler, materializer, validators and prompt', async () => {
    const value = prepared();
    const draft = draftFor(value.input);
    const caller = vi.fn(async () => {
      // A caller cannot mutate the source after its review binding was verified.
      value.input.pages[0].text = 'Mutated outside the compile invocation';
      return JSON.stringify(draft);
    });
    const result = await compileBookVisualContractTemplate(value.input, { callLLM: caller, supportingCastReview: { ...request(), review: value.review } });
    expect(caller).toHaveBeenCalledTimes(1);
    expect(result.supportingCastReviewDigest).toBe(value.review.digest);
    expect(result.provenance.policyVersion).toBe('reviewed-cast-appearance/v1');
    const human = result.template.humanCast.find((h) => h.id === 'human:baker')!;
    expect(human).toMatchObject({ role: 'baker', gender: 'female', pagesPresent: [1, 12] });
    expect(result.template.pageContracts[11].castIds).toContain('human:baker');
    expect(result.template.pageContracts[1].castIds).not.toContain('human:baker');
    expect(validateBookVisualContractTemplate(result.template).ok).toBe(true);
    const resolved = materialize(result.template, { skinTone: 'warm tan', hairColour: 'brown', hairTexture: 'wavy' });
    expect(validateResolvedBookVisualContract(resolved).ok).toBe(true);
    expect(buildVisualContractPromptBlock(derivePageVisualContracts(resolved).find((p) => p.pageNumber === 12)!, resolved)).toContain('baker');
    const broken = structuredClone(result.template);
    broken.humanCast = []; broken.pageContracts.forEach((p) => { p.castIds = p.castIds?.filter((id) => id !== 'human:baker'); });
    expect(() => assertCastIsFactAuthoritative(broken, result.facts, value.input)).toThrow('humanCast ids');
    expect(() => buildVisualContractCandidateArtifact({ compileResult: result } as unknown as Parameters<typeof buildVisualContractCandidateArtifact>[0])).toThrow('preview_is_not_paid_candidate_authority');
    const subset = { template: result.template, actionSemanticCoverage: result.actionSemanticCoverage };
    // These assertions deliberately fail typechecking if either API becomes optional again.
    // @ts-expect-error Every compiler-to-candidate input must explicitly carry the discriminator.
    const factoryInput: Parameters<typeof buildVisualContractCandidateArtifact>[0]['compileResult'] = subset;
    // @ts-expect-error Persistence must preserve the same required boundary as its factory.
    const persistInput: Parameters<typeof persistVisualContractCandidate>[0]['compileResult'] = subset;
    expect(factoryInput).toBe(persistInput);
    expect(() => buildVisualContractCandidateArtifact({ compileResult: subset } as unknown as Parameters<typeof buildVisualContractCandidateArtifact>[0])).toThrow('preview_is_not_paid_candidate_authority');
    expect(() => persistVisualContractCandidate({ compileResult: subset, write: true } as unknown as Parameters<typeof persistVisualContractCandidate>[0])).toThrow('preview_is_not_paid_candidate_authority');
  });
  it.each([undefined, '', 'a'.repeat(64), false, 0, {}])('rejects a non-null discriminator %j before receipt access or persistence', (marker) => {
    const receipt = vi.fn(() => { throw new Error('receipt access before preview guard'); });
    const args = { compileResult: { supportingCastReviewDigest: marker }, get receipt() { return receipt(); }, write: true };
    expect(() => buildVisualContractCandidateArtifact(args as unknown as Parameters<typeof buildVisualContractCandidateArtifact>[0])).toThrow('preview_is_not_paid_candidate_authority');
    expect(() => persistVisualContractCandidate(args as unknown as Parameters<typeof persistVisualContractCandidate>[0])).toThrow('preview_is_not_paid_candidate_authority');
    expect(receipt).not.toHaveBeenCalled();
  });
  it('rejects inherited null instead of treating it as explicit legacy authority', () => {
    const args = { compileResult: Object.create({ supportingCastReviewDigest: null }) };
    expect(() => buildVisualContractCandidateArtifact(args as unknown as Parameters<typeof buildVisualContractCandidateArtifact>[0])).toThrow('preview_is_not_paid_candidate_authority');
  });
});
