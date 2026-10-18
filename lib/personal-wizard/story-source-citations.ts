import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from './request-acceptance';

/** Source units are exact spans, not linguistic assertions or evidence of entailment. */
export const SOURCE_CITATION_VERSION = 'story-source-citations/v1';
export const SOURCE_UNIT_CHARS = 160;
export const SOURCE_RANGE_UNITS = 4;
type Text = { title: string; pages: { pageNumber: number; text: string }[] };
type Packet = { version: string; instructions: string; manuscript?: Text; original?: Text; revised?: Text };
type Unit = { id: string; text: string; start: number; end: number; pageNumber: number; side: 'original' | 'revised' };
const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const note = z.string().trim().min(10).max(600);
const reference = z.object({ startId: z.string().regex(/^[or]-p\d+-u\d+$/),
  endId: z.string().regex(/^[or]-p\d+-u\d+$/), anchor: z.string().min(1).max(100) }).strict();
export const sourceCriticSchema = z.object({ packetDigest: z.string().regex(/^[a-f0-9]{64}$/), summary: note,
  findings: z.array(z.object({ severity: z.enum(['blocking', 'meaningful', 'polish']), criterion: note,
    kind: z.enum(['issue', 'preference', 'improvement', 'remaining_problem', 'new_regression']),
    original: z.array(reference).max(2), revised: z.array(reference).max(2), explanation: note }).strict()).max(20) }).strict();
export class SourceCitationError extends Error {
  constructor(readonly code: 'critic_binding' | 'critic_evidence') { super(code); }
}
const fail = (code: SourceCitationError['code']): never => { throw new SourceCitationError(code); };

/** Includes every code unit exactly once, preserving whitespace and surrogate pairs. */
export function sourceUnits(text: string, pageNumber: number, side: Unit['side']): Unit[] {
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > 16 || !text ||
    !['original', 'revised'].includes(side)) fail('critic_evidence');
  const units: Unit[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + SOURCE_UNIT_CHARS, text.length);
    if (end < text.length) {
      // A deterministic word boundary, not a Hebrew parser; dialogue/ellipsis stay literal.
      const chunk = text.slice(start, end), spaces = [...chunk.matchAll(/\s+/gu)];
      const candidates = spaces.filter(m => m.index! >= SOURCE_UNIT_CHARS / 2);
      const boundary = candidates[candidates.length - 1];
      if (boundary) end = start + boundary.index! + boundary[0].length;
      if (/[\uD800-\uDBFF]/u.test(text[end - 1]) && /[\uDC00-\uDFFF]/u.test(text[end])) end--;
    }
    units.push({ id: `${side === 'original' ? 'o' : 'r'}-p${pageNumber}-u${units.length + 1}`,
      text: text.slice(start, end), start, end, pageNumber, side });
    start = end;
  }
  return units;
}
/** Normalize this secondary check only. Never normalize the quotation itself. */
export function citationTokens(text: string): string[] {
  return text.normalize('NFC').replace(/\p{Cf}/gu, '')
    .replace(/[\u0591-\u05BD\u05BF-\u05C2\u05C4-\u05C5\u05C7]/gu, '')
    .replace(/(\p{L})['’"׳״](?=\p{L})/gu, '$1')
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function prepareSourceCitationReview(packet: Packet, languageInstructions = '') {
  const original = packet.original ?? (packet.version.includes('/original-') ? packet.manuscript : undefined);
  const revised = packet.revised ?? (packet.version.includes('/final-') ? packet.manuscript : undefined);
  if (!original && !revised) fail('critic_binding');
  const catalogue: Unit[] = [];
  const numbered = (text: Text, side: Unit['side']) => ({ title: text.title, sourceDigest: digest(text),
    pages: text.pages.map(page => {
      const units = sourceUnits(page.text, page.pageNumber, side); catalogue.push(...units);
      return { pageNumber: page.pageNumber, units: units.map(({ id, text }) => ({ id, text })) };
    }) });
  const oldQuote = 'Every finding quote must be a contiguous verbatim substring copied from the cited version\'s actual page text at that pageNumber, not a paraphrase or a quote from the brief/title/plan. A literal quote proves provenance, not the truth of your interpretation.';
  if (packet.instructions.split(oldQuote).length !== 2) fail('critic_binding');
  const instructions = packet.instructions.replace(oldQuote,
    'For every citation return startId and endId from the supplied source units, on the same page and version, in order, spanning at most four units. Do not return a quotation or calculate character offsets. Include a contiguous 2 to 4 word anchor copied from that range (one word only if the range has only one word). Ignore Hebrew nikud, invisible formatting marks and in-word geresh/apostrophe marks in this anchor check only; other punctuation separates words. Preserve letters, word order and negation. IDs and anchors establish location, not support for your interpretation. Do not cite brief, title, plan or the unavailable version.') + languageInstructions;
  const { instructions: _instructions, manuscript: _manuscript, original: _original, revised: _revised, ...metadata } = packet;
  const body = { ...metadata, citationVersion: SOURCE_CITATION_VERSION, sourcePacketDigest: digest(packet),
    instructionsDigest: digest(instructions),
    ...(packet.manuscript ? { manuscript: numbered((original ?? revised)!, original ? 'original' : 'revised') } :
      { original: numbered(original!, 'original'), revised: numbered(revised!, 'revised') }) };
  return { packet: body, packetDigest: digest(body), instructions, catalogue, schema: sourceCriticSchema };
}
export type PreparedSourceCitationReview = ReturnType<typeof prepareSourceCitationReview>;
export type SourceCriticOutput = z.infer<typeof sourceCriticSchema>;

function assertPreparedReview(review: PreparedSourceCitationReview) {
  if (digest(review.packet) !== review.packetDigest || digest(review.instructions) !== review.packet.instructionsDigest) fail('critic_binding');
  const expected: Unit[] = [];
  const check = (text: { title: string; sourceDigest: string; pages: { pageNumber: number; units: { id: string; text: string }[] }[] }, side: Unit['side']) => {
    const pages = text.pages.map(page => {
      const value = page.units.map(u => u.text).join(''), units = sourceUnits(value, page.pageNumber, side);
      if (digest(page.units) !== digest(units.map(({ id, text }) => ({ id, text })))) fail('critic_binding');
      expected.push(...units); return { pageNumber: page.pageNumber, text: value };
    });
    if (digest({ title: text.title, pages }) !== text.sourceDigest) fail('critic_binding');
  };
  if ('manuscript' in review.packet) check(review.packet.manuscript, review.packet.version.includes('/original-') ? 'original' : 'revised');
  else { check(review.packet.original, 'original'); check(review.packet.revised, 'revised'); }
  if (digest(expected) !== digest(review.catalogue)) fail('critic_binding');
}

export function resolveSourceCitation(review: PreparedSourceCitationReview, ref: z.infer<typeof reference>, side: Unit['side']) {
  const first = review.catalogue.findIndex(u => u.id === ref.startId), last = review.catalogue.findIndex(u => u.id === ref.endId);
  if (first < 0 || last < first || last - first >= SOURCE_RANGE_UNITS) fail('critic_evidence');
  const units = review.catalogue.slice(first, last + 1);
  if (units.some(u => u.side !== side || u.pageNumber !== units[0].pageNumber)) fail('critic_evidence');
  const quote = units.map(u => u.text).join(''), tokens = citationTokens(quote), anchor = citationTokens(ref.anchor);
  if (!anchor.length || anchor.length > 4 || (anchor.length < 2 && tokens.length !== 1) ||
    !tokens.some((_, index) => anchor.every((token, offset) => tokens[index + offset] === token))) fail('critic_evidence');
  return { pageNumber: units[0].pageNumber, quote };
}
export function compileSourceCitationReview(review: PreparedSourceCitationReview, raw: unknown) {
  assertPreparedReview(review);
  const parsed = sourceCriticSchema.safeParse(raw);
  if (!parsed.success) return fail('critic_binding');
  if (parsed.data.packetDigest !== review.packetDigest) return fail('critic_binding');
  return { raw: parsed.data, summary: parsed.data.summary, findings: parsed.data.findings.map(row => ({ ...row,
    original: row.original.map(ref => resolveSourceCitation(review, ref, 'original')),
    revised: row.revised.map(ref => resolveSourceCitation(review, ref, 'revised')) })) };
}

/**
 * Opt-in constrained citation correction (owner same-book recovery amendment 2026-10-18), additive to v1: the v1 validator above is
 * unchanged and still decides. For ONE settled answer that failed only its source evidence, the correction wire names every reference the
 * exact check refused (its path, the returned ids/anchor, the finding's own criterion/explanation read-only, and the units of that page and
 * version), never an expected anchor. Its answer may only re-supply startId/endId/anchor of exactly those paths, on the same page and version;
 * every finding, summary, severity, kind, criterion, explanation and valid reference stays byte-identical to the failed answer.
 */
export const SOURCE_CITATION_CORRECTION_VERSION = 'story-source-citations-correction/v1';
const CORRECTION_INSTRUCTIONS = 'Your earlier review of this story was recorded, but some of its citations failed the exact anchor check. For each listed reference only, return corrected startId, endId and anchor locating the SAME passage your finding meant, using only the listed units of that page and version, in order, spanning at most four units. The anchor is a contiguous 2 to 4 word span copied exactly from that range (one word only if the range has only one word): copy every word whole, with every letter attached to it, including any one-letter prefix joined to a Hebrew word; preserve letters, word order and negation. Nikud, invisible formatting marks and in-word geresh/apostrophe marks are ignored by the check; other punctuation separates words. You cannot change, add or drop any finding, its summary, severity, criterion, kind or explanation; they are not part of this answer. Return every listed path exactly once and nothing else.';
const correctionSchema = z.object({ correctionDigest: z.string().regex(/^[a-f0-9]{64}$/),
  corrections: z.array(z.object({ path: z.string().regex(/^\d{1,2}\/(original|revised)\/[01]$/), startId: reference.shape.startId,
    endId: reference.shape.endId, anchor: reference.shape.anchor }).strict()).min(1).max(40) }).strict();

/** Every reference of a bound answer that the exact v1 check refuses, by path (`finding/side/index`). The answer must bind this packet. */
export function invalidSourceCitations(review: PreparedSourceCitationReview, raw: unknown) {
  assertPreparedReview(review);
  const parsed = sourceCriticSchema.safeParse(raw);
  if (!parsed.success || parsed.data.packetDigest !== review.packetDigest) return fail('critic_binding');
  const invalid: { path: string; finding: number; side: Unit['side']; index: number; ref: z.infer<typeof reference> }[] = [];
  parsed.data.findings.forEach((row, finding) => (['original', 'revised'] as const).forEach(side => row[side].forEach((ref, index) => {
    try { resolveSourceCitation(review, ref, side); }
    catch (error) { if (!(error instanceof SourceCitationError)) throw error; invalid.push({ path: `${finding}/${side}/${index}`, finding, side, index, ref }); }
  })));
  return { output: parsed.data, invalid };
}

/** The one correction request for a failed answer. Refuses (critic_evidence) when nothing is invalid or a refused reference names no unit of its version. */
export function prepareSourceCitationCorrection(review: PreparedSourceCitationReview, raw: unknown) {
  const { output, invalid } = invalidSourceCitations(review, raw);
  if (!invalid.length) return fail('critic_evidence');
  const rows = invalid.map(item => {
    const unit = review.catalogue.find(u => u.side === item.side && (u.id === item.ref.startId)) ?? review.catalogue.find(u => u.side === item.side && u.id === item.ref.endId);
    if (!unit) return fail('critic_evidence');
    const units = review.catalogue.filter(u => u.side === unit.side && u.pageNumber === unit.pageNumber).map(({ id, text }) => ({ id, text }));
    const row = output.findings[item.finding];
    return { path: item.path, side: item.side, pageNumber: unit.pageNumber, returned: item.ref, finding: { criterion: row.criterion, explanation: row.explanation }, units };
  });
  const body = { version: SOURCE_CITATION_CORRECTION_VERSION, citationVersion: SOURCE_CITATION_VERSION, packetDigest: review.packetDigest,
    failedAnswerDigest: digest(output), invalid: rows };
  const correctionDigest = digest(body);
  return { body, correctionDigest, instructions: CORRECTION_INSTRUCTIONS, input: canonicalJson({ correctionDigest, correction: body }), schema: correctionSchema };
}
export type PreparedSourceCitationCorrection = ReturnType<typeof prepareSourceCitationCorrection>;

/**
 * The corrected answer: the failed answer with ONLY the correction's references replaced, then the strict v1 compile of the whole answer.
 * The correction must bind this request (rebuilt from the same packet and failed answer) and name every refused path exactly once, each on
 * its own page and version; anything else refuses. The failed answer is never modified (a copy is corrected).
 */
export function applySourceCitationCorrection(review: PreparedSourceCitationReview, raw: unknown, correction: PreparedSourceCitationCorrection, answer: unknown) {
  const again = prepareSourceCitationCorrection(review, raw);
  if (canonicalJson(again.body) !== canonicalJson(correction.body) || again.correctionDigest !== correction.correctionDigest) return fail('critic_binding');
  const parsed = correctionSchema.safeParse(answer);
  if (!parsed.success || parsed.data.correctionDigest !== correction.correctionDigest) return fail('critic_binding');
  const paths = parsed.data.corrections.map(c => c.path);
  if (new Set(paths).size !== paths.length || canonicalJson([...paths].sort()) !== canonicalJson(correction.body.invalid.map(r => r.path).sort())) return fail('critic_evidence');
  const corrected: SourceCriticOutput = structuredClone(sourceCriticSchema.parse(raw));
  for (const c of parsed.data.corrections) {
    const row = correction.body.invalid.find(r => r.path === c.path)!, allowed = new Set(row.units.map(u => u.id));
    if (!allowed.has(c.startId) || !allowed.has(c.endId)) fail('critic_evidence');
    const [finding, side, index] = c.path.split('/') as [string, Unit['side'], string];
    corrected.findings[Number(finding)][side][Number(index)] = { startId: c.startId, endId: c.endId, anchor: c.anchor };
  }
  const compiled = compileSourceCitationReview(review, corrected);
  return { corrected, compiled, provenance: { version: SOURCE_CITATION_CORRECTION_VERSION, failedAnswerDigest: correction.body.failedAnswerDigest,
    correctionDigest: correction.correctionDigest, answerDigest: digest(parsed.data), correctedAnswerDigest: digest(corrected), paths: [...paths].sort() } };
}

/** Offline archival mapping only: retains exact old quotes and rejects a fabricated quote. */
export function locateLegacyCitation(review: PreparedSourceCitationReview, side: Unit['side'], pageNumber: number, quote: string) {
  const units = review.catalogue.filter(u => u.side === side && u.pageNumber === pageNumber);
  const text = units.map(u => u.text).join(''), start = text.indexOf(quote);
  if (!quote || start < 0) fail('critic_evidence');
  const selected = units.filter(u => u.end > start && u.start < start + quote.length);
  if (!selected.length || selected.length > SOURCE_RANGE_UNITS) fail('critic_evidence');
  return { startId: selected[0].id, endId: selected[selected.length - 1].id, exactQuote: quote, start, end: start + quote.length };
}
