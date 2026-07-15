/**
 * Fail-closed SOURCE-EVIDENCE guard (Stage 4): a hazard that cites a story quote must actually be quoting that page.
 *
 * A `SafetyConstraint.origin { kind:'story_evidence', page, phrase }` asserts the hazard is grounded in the story
 * text. That assertion is worth exactly nothing unless it is CHECKED — an unchecked citation is the same
 * hallucination surface `assertSourceProse` exists to close (the authoring model will invent a fully-consistent,
 * internally-valid contract from nothing, and every downstream validator passes it because it is self-consistent).
 * The whole reason `SafetyEvidenceOrigin` has no `derived` kind is that a hazard's provenance must be checkable;
 * this is the check.
 *
 * It lives apart from the validators because it needs the SOURCE PAGES, which only the compiler holds — the contract
 * alone cannot answer the question. PURE: no I/O, no clock, no randomness.
 *
 * Matching is NIQQUD-INSENSITIVE and whitespace-normalized: the source is vowelized Hebrew and an authored phrase
 * rarely reproduces the exact marks, so both sides are stripped first — the same normalization the deterministic
 * fact extractor uses to match needles against vowelized source.
 */
import { stripNiqqud } from './extractDeterministicFacts';
import type { BookVisualContract } from './types';

export interface SourceEvidencePage {
  pageNumber: number;
  text: string;
}

function normalize(value: string): string {
  return stripNiqqud(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Every problem with the contract's story-evidence citations, given the source pages the contract was authored from.
 * Returns `[]` when nothing cites the source (a v1 contract authors no safetyConstraints at all).
 */
export function sourceEvidenceErrors(
  contract: BookVisualContract,
  pages: SourceEvidencePage[]
): string[] {
  const errors: string[] = [];
  const textByPage = new Map<number, string>(
    (Array.isArray(pages) ? pages : []).map((p) => [p?.pageNumber, normalize(p?.text ?? '')])
  );

  for (const page of contract.pageContracts ?? []) {
    const constraints = page?.safetyConstraints;
    if (!Array.isArray(constraints)) continue;
    constraints.forEach((safety, i) => {
      const origin = safety?.origin;
      if (!origin || origin.kind !== 'story_evidence') return;
      const label = `page ${page.pageNumber}.safetyConstraints[${i}].origin(story_evidence)`;

      const sourceText = textByPage.get(origin.page);
      if (sourceText === undefined) {
        errors.push(`${label} cites page ${String(origin.page)}, which is not one of the story's source pages`);
        return;
      }
      const needle = normalize(origin.phrase);
      if (!needle) {
        errors.push(`${label} has an empty phrase — cite the exact story words the hazard rests on`);
        return;
      }
      if (!sourceText.includes(needle)) {
        errors.push(
          `${label} quote ${JSON.stringify(origin.phrase)} does not occur on page ${origin.page} — a hazard's source citation must be verifiable in the story text (never invent evidence)`
        );
      }
    });
  }

  return errors;
}
