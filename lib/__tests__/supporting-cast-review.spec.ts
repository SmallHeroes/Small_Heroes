import { describe, expect, it } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import {
  buildSupportingCastReview, assertSupportingCastReview, supportingCastFacts,
  supportingCastCompilerInputDigest, assertSupportingCastIndividualCompilerSupported,
  type SupportingCastCompilerInput, type SupportingCastEntry, type SupportingCastReview,
} from '@/lib/visual-contract-compiler/supportingCastReview';
import { injectAppearance } from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';

function input(storyKey = 'workshop'): SupportingCastCompilerInput {
  return {
    storyKey, pageCount: 2, companion: null,
    fullStoryText: 'two source pages', sourceIdentity: { digest: 'a'.repeat(64) }, sourceEvidenceCatalog: {},
    pages: [
      { pageNumber: 1, text: 'The potter Ada greets the child. Ada shapes clay. A band plays while a bird watches.' },
      { pageNumber: 2, text: 'The potter Ben greets Ada. Ada waves goodbye.' },
    ],
    pageImageDirections: [{ pageNumber: 1, imageDirection: 'Ada is a woman with an apron. A band of musicians plays.' }],
  };
}
const cite = (pageNumber: number, quote: string, source: 'story' | 'visual_direction' = 'story') => ({ pageNumber, quote, source });
function ada(): SupportingCastEntry & { kind: 'human_individual' } {
  return {
    kind: 'human_individual', id: 'human:ada', role: 'potter', aliases: ['Ada'], gender: 'female',
    identityEvidence: [cite(1, 'The potter Ada greets the child.')],
    genderEvidence: [cite(1, 'Ada is a woman with an apron.', 'visual_direction')],
    appearanceClass: 'reviewed_non_relative', relationshipEvidence: [],
    presence: [{ pageNumber: 1, evidence: [cite(1, 'Ada shapes clay.')] }, { pageNumber: 2, evidence: [cite(2, 'Ada waves goodbye.')] }],
  };
}
function review(entries: unknown = [ada()], source = input()) {
  return buildSupportingCastReview({ input: source, entries, binding: {
    storyKey: source.storyKey, sourceSnapshotDigest: '1'.repeat(64), acceptedRevisionDigest: '2'.repeat(64),
    acceptedAuthorityDigest: '3'.repeat(64), sourceDigest: '4'.repeat(64), visualDirectionsSha256: '5'.repeat(64),
    compilerInputDigest: supportingCastCompilerInputDigest(source),
  } });
}
function rehash(value: SupportingCastReview): SupportingCastReview {
  const { digest: _digest, digestAlgorithm: _algorithm, ...payload } = value;
  return { ...value, digest: canonicalHash(payload) };
}

describe('source-bound supporting cast review input', () => {
  it.each(['workshop', 'harbor'])('binds arbitrary roles on %s, preserves explicit source identity and repeat presence', (key) => {
    const source = input(key);
    const prepared = review([ada()], source);
    const facts = supportingCastFacts(source, prepared);
    expect(prepared.status).toBe('source_bound_review_required');
    expect(facts.humans).toMatchObject([{ id: 'human:ada', role: 'potter', gender: 'female', pagesPresent: [1, 2], reviewedAppearanceClass: 'reviewed_non_relative' }]);
    expect(review([ada()], source).digest).toBe(prepared.digest);
    expect(source.pages[0].text).toContain('Ada');
  });
  it('retains two distinct people with the same role', () => {
    const ben = { ...ada(), id: 'human:ben', aliases: ['Ben'], gender: 'unspecified' as const,
      genderEvidence: [], identityEvidence: [cite(2, 'The potter Ben greets Ada.')],
      presence: [{ pageNumber: 2, evidence: [cite(2, 'The potter Ben greets Ada.')] }] };
    expect(supportingCastFacts(input(), review([ada(), ben])).humans.map((h) => h.id)).toEqual(['human:ada', 'human:ben']);
  });
  it('keeps groups and non-humans explicitly classified, without invented members or gender', () => {
    const band = { kind: 'human_group', id: 'human-group:band', role: 'band', aliases: ['band'],
      identityEvidence: [cite(1, 'A band plays')], presence: [{ pageNumber: 1, evidence: [cite(1, 'A band plays')] }],
      appearanceClass: 'reviewed_human_ensemble', membership: 'same_ensemble_when_recurring', cardinality: 'multiple_unspecified' };
    const bird = { kind: 'non_human', id: 'non-human:bird', role: 'bird', species: 'bird', aliases: ['bird'],
      identityEvidence: [cite(1, 'a bird watches.')], presence: [{ pageNumber: 1, evidence: [cite(1, 'a bird watches.')] }] };
    const bound = review([band, bird]);
    expect(bound.entries.map((e) => e.kind)).toEqual(['human_group', 'non_human']);
    expect(() => supportingCastFacts(input(), bound)).toThrow('classification_not_yet_supported');
    expect(() => assertSupportingCastIndividualCompilerSupported(bound)).toThrow('classification_not_yet_supported');
    expect(() => review([{ ...band, memberCount: 3 }])).toThrow();
    expect(() => review([{ ...band, gender: 'male' }])).toThrow();
    expect(() => review([{ ...bird, appearanceClass: 'reviewed_non_relative' }])).toThrow();
  });
  it.each([
    ['missing identity evidence', (e: ReturnType<typeof ada>) => { e.identityEvidence = []; }],
    ['missing gender evidence', (e: ReturnType<typeof ada>) => { e.genderEvidence = []; }],
    ['invented quote', (e: ReturnType<typeof ada>) => { e.presence[0].evidence[0].quote = 'Invented actor'; }],
    ['wrong page', (e: ReturnType<typeof ada>) => { e.presence[0].evidence[0].pageNumber = 2; }],
    ['unknown page', (e: ReturnType<typeof ada>) => { e.presence[0].pageNumber = 9; }],
    ['duplicate presence', (e: ReturnType<typeof ada>) => { e.presence.push(e.presence[0]); }],
    ['invented alias', (e: ReturnType<typeof ada>) => { e.aliases = ['Astronaut']; }],
    ['substring alias', (e: ReturnType<typeof ada>) => { e.aliases = ['Ad']; }],
    ['duplicate alias', (e: ReturnType<typeof ada>) => { e.aliases = ['Ada', 'ADA']; }],
    ['family leakage', (e: ReturnType<typeof ada>) => { e.appearanceClass = 'family_profile'; }],
    ['non-human namespace', (e: ReturnType<typeof ada>) => { e.id = 'non-human:ada'; }],
    ['hero injection', (e: ReturnType<typeof ada>) => { e.id = 'human:child'; }],
    ['reserved relative ID', (e: ReturnType<typeof ada>) => { e.id = 'human:mother'; }],
  ] as const)('rejects %s', (_name, mutate) => {
    const entry = ada(); mutate(entry); expect(() => review([entry])).toThrow();
  });
  it('rejects duplicate IDs and cross-character alias collisions', () => {
    expect(() => review([ada(), ada()])).toThrow('identity_duplicate');
    expect(() => review([ada(), { ...ada(), id: 'human:other' }])).toThrow('alias_collision');
  });
  it('rejects known hero and companion alias collisions', () => {
    expect(() => review([ada()], { ...input(), childName: 'Ada' })).toThrow('reserved_alias');
    expect(() => review([ada()], { ...input(), companion: { id: 'test_companion', name: 'Ada' } })).toThrow('reserved_alias');
  });
  it.each(['pages', 'pageImageDirections', 'sourceIdentity', 'companion', 'fullStoryText'] as const)('rejects stale compiler %s', (field) => {
    const source = input(); const bound = review([ada()], source);
    const changed = { ...source, [field]: field === 'fullStoryText' ? 'changed' : [] } as unknown as SupportingCastCompilerInput;
    expect(() => assertSupportingCastReview(bound, changed)).toThrow('source_binding_mismatch');
  });
  it('rejects digest tampering and unknown root/entry fields even with a recomputed hash', () => {
    const bound = review(); bound.entries[0].role = 'changed';
    expect(() => assertSupportingCastReview(bound, input())).toThrow('review_digest_mismatch');
    expect(() => assertSupportingCastReview({ ...review(), approval: true }, input())).toThrow();
    expect(() => review([{ ...ada(), approved: true }])).toThrow();
    const changed = review(); changed.entries[0].presence[0].evidence[0].quote = 'not in source';
    expect(() => assertSupportingCastReview(rehash(changed), input())).toThrow('evidence_quote_mismatch');
  });
  it('merges known relatives without weakening extractor gender or presence', () => {
    const source = input(); source.pages[0].text = 'mother holds the clay. She sits with the child.';
    source.pages[1].text = 'mother waves goodbye.';
    const mother = { ...ada(), id: 'human:mother', role: 'mother', aliases: ['mother'],
      identityEvidence: [cite(1, 'mother holds the clay.')], genderEvidence: [cite(1, 'mother holds the clay.')],
      appearanceClass: 'family_profile' as const, relationshipEvidence: [cite(1, 'mother holds the clay.')],
      presence: [{ pageNumber: 1, evidence: [cite(1, 'mother holds the clay.')] }, { pageNumber: 2, evidence: [cite(2, 'mother waves goodbye.')] }] };
    expect(supportingCastFacts(source, review([mother], source)).humans).toHaveLength(1);
    expect(() => supportingCastFacts(source, review([{ ...mother, gender: 'male' }], source))).toThrow('extractor_conflict');
    expect(() => supportingCastFacts(source, review([{ ...mother, presence: mother.presence.slice(0, 1) }], source))).toThrow('extractor_conflict');
    expect(() => review([{ ...mother, relationshipEvidence: [] }], source)).toThrow('relationship_evidence_missing');
  });
  it('does not relax unknown-role injection without explicit class, nor allow prototype roles', () => {
    expect(() => injectAppearance('potter', 'human:ada')).toThrow();
    expect(() => injectAppearance('constructor', 'human:ada')).toThrow();
    expect(injectAppearance('potter', 'human:ada', 'reviewed_non_relative').skinTone).toMatchObject({ mode: 'deterministic_palette', origin: { paletteId: 'human:ada' } });
    expect(() => injectAppearance('mother', 'human:mother', 'reviewed_non_relative')).toThrow('appearance_class_conflict');
  });
});
