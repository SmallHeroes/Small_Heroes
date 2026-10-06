import { describe, expect, it } from 'vitest';
import { causalDigest, causalSourceReviewPacket, compileCausalSourceReading, compileCausalReading,
  causalDraftCritiqueContext, causalEditorCall, causalOriginalReviewPacket, causalReviewPackets } from '../story-causal-experiment';
import { sourceUnits, citationTokens, locateLegacyCitation, compileSourceCitationReview, SOURCE_UNIT_CHARS } from '../story-source-citations';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { preparePersonalStory } from '../story-writer';
import { resolvePersonalWizardOptions } from '../options';
import { prepareCausalWire } from '../../../scripts/personal-causal-trial-adapters';
import { causalOutputCap } from '../../../scripts/personal-causal-trial-host';
import type { CausalReviewPacket } from '../story-causal-experiment';

async function fixture() {
  const f = await personalStoryboardFixture(), prepared = preparePersonalStory(f.request, resolvePersonalWizardOptions());
  const doc = { plan: f.result.plan, manuscript: f.result.manuscript, characterDigest: prepared.brief.companion.characterDigest };
  const packet = causalOriginalReviewPacket(prepared, doc);
  return { prepared, doc, packet, review: causalSourceReviewPacket(packet) };
}
function ref(review: ReturnType<typeof causalSourceReviewPacket>, index = 0) {
  const unit = review.catalogue[index];
  return { startId: unit.id, endId: unit.id, anchor: citationTokens(unit.text).slice(0, 2).join(' ') };
}
function reading(review: ReturnType<typeof causalSourceReviewPacket>) {
  return { packetDigest: review.packetDigest, summary: 'Synthetic source mapping, not a literary quality assessment.', findings: [{
    severity: 'meaningful' as const, criterion: 'Synthetic clarity criterion', kind: 'issue' as const,
    original: [ref(review)], revised: [], explanation: 'Synthetic reader allegation; exact provenance is not entailment.' }] };
}

describe('code-derived source citations, no providers', () => {
  it.each(['כן', '"רגע... מה?!"\nהיא שאלה.\r\n"אני פה."', 'אחת, שתיים, שלוש! '.repeat(35), 'מילה'.repeat(100), '🌈'.repeat(170)])('covers exact UTF16/Unicode source deterministically: %s', text => {
    const units = sourceUnits(text, 1, 'original');
    expect(units.map(u => u.text).join('')).toBe(text);
    expect(units).toEqual(sourceUnits(text, 1, 'original'));
    units.forEach((u, i) => {
      expect(u.text).toBe(text.slice(u.start, u.end)); expect(u.end - u.start).toBeLessThanOrEqual(SOURCE_UNIT_CHARS);
      expect(u.start).toBe(i ? units[i - 1].end : 0);
      expect(u.text).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u);
    });
  });
  it('normalizes nikud and punctuation only for contiguous ordered anchor tokens', () => {
    expect(citationTokens('נֶטַע־אומרת: "לא, עכשיו!"')).toEqual(['נטע', 'אומרת', 'לא', 'עכשיו']);
    expect(citationTokens('נטע לא אומרת')).not.toEqual(citationTokens('נטע אומרת'));
  });
  it('instructions appear once, are digest-bound, and source text is not duplicated', async () => {
    const f = await fixture(), body = f.review.packet;
    expect(body).not.toHaveProperty('instructions');
    expect(body.instructionsDigest).toBe(causalDigest(f.review.instructions));
    expect(body.sourcePacketDigest).toBe(causalDigest(f.packet));
    if (!('manuscript' in body)) throw Error('original-only fixture');
    expect(body.manuscript.pages[0].units.map(u => u.text).join('')).toBe(f.doc.manuscript.pages[0].text);
    expect(body.manuscript.pages[0]).not.toHaveProperty('text');
  });
  it('extracts exact source quotes and authenticates compiled editorial-context readback', async () => {
    const f = await fixture(), raw = reading(f.review), checked = compileCausalSourceReading(f.packet, raw);
    expect(checked.findings[0].original[0].quote).toBe(f.review.catalogue[0].text);
    expect(checked.sourceEvidence.output).toEqual(raw);
    const context = causalDraftCritiqueContext(f.prepared, f.doc, checked);
    expect(causalEditorCall(f.prepared, f.doc, context).input).toContain(f.review.catalogue[0].text.replace(/"/g, '\\"'));
    const tampered = structuredClone(context); tampered.reading.findings[0].original[0].quote += ' אלה';
    expect(() => causalEditorCall(f.prepared, f.doc, tampered)).toThrow('draft_critique_binding');
  });
  it.each(['unknown', 'wrong-page', 'wrong-version', 'anchor', 'reversed', 'range', 'cross-page', 'extra-quote', 'digest', 'empty', 'kind'])('rejects %s without silently dropping a finding', async mode => {
    const f = await fixture(), raw: any = reading(f.review), citation = raw.findings[0].original[0];
    if (mode === 'unknown') citation.startId = citation.endId = 'o-p1-u999';
    if (mode === 'wrong-page') citation.startId = citation.endId = 'o-p16-u1';
    if (mode === 'wrong-version') citation.startId = citation.endId = 'r-p1-u1';
    if (mode === 'anchor') citation.anchor = 'מילים שלא נמצאות';
    if (mode === 'reversed') { citation.startId = 'o-p2-u1'; citation.endId = 'o-p1-u1'; }
    if (mode === 'range') citation.endId = 'o-p1-u999';
    if (mode === 'cross-page') citation.endId = 'o-p2-u1';
    if (mode === 'extra-quote') citation.quote = 'אלה';
    if (mode === 'digest') raw.packetDigest = 'f'.repeat(64);
    if (mode === 'empty') raw.findings[0].original = [];
    if (mode === 'kind') raw.findings[0].kind = 'new_regression';
    const before = structuredClone(raw);
    expect(() => compileCausalSourceReading(f.packet, raw)).toThrow(); expect(raw).toEqual(before);
  });
  it('valid wrong ID is caught by a mismatching anchor; repeated anchors still do not prove meaning', async () => {
    const f = await fixture(), packet = structuredClone(f.packet);
    packet.manuscript.pages[0].text = 'הילדה מצאה כדור.';
    packet.manuscript.pages[1].text = 'החבר איבד סרט.';
    const r = causalSourceReviewPacket(packet), raw = reading(r);
    raw.findings[0].original[0].startId = raw.findings[0].original[0].endId = 'o-p2-u1';
    expect(() => compileCausalSourceReading(packet, raw)).toThrow('critic_evidence');
    packet.manuscript.pages[1].text = 'הילדה מצאה סרט.';
    const repeated = causalSourceReviewPacket(packet); raw.packetDigest = repeated.packetDigest;
    // A deliberate negative control of the semantic guarantee, not a pretend guard.
    expect(compileCausalSourceReading(packet, raw).findings[0].original[0].quote).toBe('הילדה מצאה סרט.');
  });
  it('stale source, changed instructions and copied quote fields cannot reuse a reading', async () => {
    const f = await fixture(), raw = reading(f.review), changed = structuredClone(f.packet);
    changed.manuscript.pages[0].text += ' מקור אחר';
    expect(() => compileCausalSourceReading(changed, raw)).toThrow('critic_binding');
    changed.manuscript = f.packet.manuscript; changed.instructions += ' Changed instruction.';
    expect(() => compileCausalSourceReading(changed, raw)).toThrow('critic_binding');
  });
  it('detached or tampered catalogue and unbound instructions cannot supply quotations', async () => {
    const f = await fixture(), raw = reading(f.review);
    const catalogue = { ...f.review, catalogue: structuredClone(f.review.catalogue) }; catalogue.catalogue[0].text += ' אלה';
    expect(() => compileSourceCitationReview(catalogue, raw)).toThrow('critic_binding');
    const instructions = { ...f.review }; instructions.instructions += ' Other instructions.';
    expect(() => compileSourceCitationReview(instructions, raw)).toThrow('critic_binding');
    const body = { ...f.review, packet: structuredClone(f.review.packet) }; body.packet.sourcePacketDigest = 'f'.repeat(64);
    expect(() => compileSourceCitationReview(body, raw)).toThrow('critic_binding');
  });
  it('final is isolated and comparisons require both source versions', async () => {
    const f = await fixture(), packets = causalReviewPackets(f.prepared, f.doc, f.doc), final = causalSourceReviewPacket(packets.final);
    expect(final.catalogue.every(u => u.side === 'revised')).toBe(true);
    const raw = reading(final); expect(() => compileCausalSourceReading(packets.final, raw)).toThrow('critic_evidence');
    const comparison = causalSourceReviewPacket(packets.comparison), pair: any = reading(comparison);
    pair.findings[0].kind = 'remaining_problem';
    pair.findings[0].revised = [ref(comparison, comparison.catalogue.findIndex(u => u.side === 'revised'))];
    expect(compileCausalSourceReading(packets.comparison, pair).findings).toHaveLength(1);
    const wrongSide = structuredClone(pair); wrongSide.findings[0].original = wrongSide.findings[0].revised;
    expect(() => compileCausalSourceReading(packets.comparison, wrongSide)).toThrow('critic_evidence');
    pair.findings[0].revised = []; expect(() => compileCausalSourceReading(packets.comparison, pair)).toThrow('critic_evidence');
  });
  it('legacy compiler remains strict; offline mapping never heals fabricated words', async () => {
    const f = await fixture(), quote = f.doc.manuscript.pages[0].text.slice(0, 45);
    const legacy = { packetDigest: causalDigest(f.packet), summary: 'Historical quotation compatibility check.', findings: [{
      severity: 'polish', criterion: 'Historical exact quote check', kind: 'issue', original: [{ pageNumber: 1, quote }], revised: [], explanation: 'A saved old-format reader allegation.' }] };
    expect(compileCausalReading(f.packet, legacy).findings).toHaveLength(1);
    expect(locateLegacyCitation(f.review, 'original', 1, quote).exactQuote).toBe(quote);
    legacy.findings[0].original[0].quote += ' אלה';
    expect(() => compileCausalReading(f.packet, legacy)).toThrow('critic_evidence');
    expect(() => locateLegacyCitation(f.review, 'original', 1, legacy.findings[0].original[0].quote)).toThrow('critic_evidence');
  });
  it('bounded contiguous multi-unit ranges and one-word dialogue remain exact', async () => {
    const f = await fixture(), packet = structuredClone(f.packet); packet.manuscript.pages[0].text = 'כן';
    const r = causalSourceReviewPacket(packet), raw = reading(r);
    expect(compileSourceCitationReview(r, raw).findings[0].original[0].quote).toBe('כן');
    packet.manuscript.pages[0].text = 'נטע לא מוותרת. '.repeat(40);
    const long = causalSourceReviewPacket(packet), range = reading(long);
    range.findings[0].original[0].endId = long.catalogue[2].id;
    expect(compileCausalSourceReading(packet, range).findings[0].original[0].quote).toBe(long.catalogue.slice(0, 3).map(u => u.text).join(''));
    range.findings[0].original[0].endId = long.catalogue[4].id;
    expect(() => compileCausalSourceReading(packet, range)).toThrow('critic_evidence');
  });
  it.each([8, 12, 16])('measures complete %s-spread Hebrew wires under existing stage ceilings', async count => {
    const f = await fixture();
    for (const kind of ['original', 'final', 'comparison'] as const) {
      const base = causalReviewPackets(f.prepared, f.doc, f.doc)[kind];
      const text = { title: 'בדיקה', pages: Array.from({ length: count }, (_, i) => ({ pageNumber: i + 1,
        text: 'הילדה והחבר יוצאים להרפתקה. הם צוחקים ומנסים דרך חדשה. '.repeat(7) })) };
      const packet = { ...base, ...('manuscript' in base ? { manuscript: text } : { original: text, revised: text }) } as CausalReviewPacket;
      const source = causalSourceReviewPacket(packet), stage = kind === 'original' ? 'original_review' : kind === 'final' ? 'final_review' : 'comparison';
      const cap = 8000 + count * 500, ceiling = causalOutputCap(count, stage);
      const wire = prepareCausalWire({ role: 'astra', stage, conversationKey: 'offline', instructions: source.instructions,
        input: JSON.stringify({ packet: source.packet, packetDigest: source.packetDigest }), schema: source.schema, maxOutputTokens: cap },
        { executable: '', executableSha256: '', workspace: '', maxWireBytes: 104000,
          rates: { opus: { inputMicroUsdPerToken: 12.5, outputMicroUsdPerToken: 50 }, astra: { inputMicroUsdPerToken: 12.5, outputMicroUsdPerToken: 50 } } },
        Math.ceil((104000 * 12.5 + cap * 50) * 1.1));
      expect(wire.bytes).toBeLessThanOrEqual(104000); expect(wire.outputCap).toBe(ceiling);
    }
  });
});
