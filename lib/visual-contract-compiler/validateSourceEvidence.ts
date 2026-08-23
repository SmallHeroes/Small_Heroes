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
import {
  type DraftValidationIssue,
} from './draftValidationDiagnostics';
import type { BookVisualContract } from './types';

export interface SourceEvidencePage {
  pageNumber: number;
  text: string;
}

export interface SourceEvidenceValidation {
  errors: string[];
  diagnosticIssues: readonly DraftValidationIssue[];
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
export function sourceEvidenceValidation(
  contract: BookVisualContract,
  pages: SourceEvidencePage[]
): SourceEvidenceValidation {
  const errors: string[] = [];
  const diagnosticIssues: DraftValidationIssue[] = [];
  const textByPage = new Map<number, string>(
    (Array.isArray(pages) ? pages : []).map((p) => [p?.pageNumber, normalize(p?.text ?? '')])
  );

  const validateOrigin = (args: {
    origin: Extract<
      NonNullable<
        NonNullable<BookVisualContract['pageContracts'][number]['companionStateOverride']>
      >['origin'],
      { kind: 'story_evidence' }
    >;
    label: string;
    locator: DraftValidationIssue['locator'];
    purpose: string;
  }): void => {
    const sourceText = textByPage.get(args.origin.page);
    if (sourceText === undefined) {
      errors.push(
        `${args.label} cites page ${String(args.origin.page)}, which is not one of the story's source pages`,
      );
      diagnosticIssues.push({
        family: 'draft_contract',
        code: 'source_evidence_phrase_invalid',
        locator: args.locator,
      });
      return;
    }
    const needle = normalize(args.origin.phrase);
    if (!needle) {
      errors.push(
        `${args.label} has an empty phrase — cite the exact story words the ${args.purpose} rests on`,
      );
      diagnosticIssues.push({
        family: 'draft_contract',
        code: 'source_evidence_phrase_invalid',
        locator: args.locator,
      });
      return;
    }
    if (!sourceText.includes(needle)) {
      errors.push(
        `${args.label} quote ${JSON.stringify(args.origin.phrase)} does not occur on page ${args.origin.page} — ${args.purpose} source citation must be verifiable in the story text (never invent evidence)`,
      );
      diagnosticIssues.push({
        family: 'draft_contract',
        code: 'source_evidence_phrase_invalid',
        locator: args.locator,
      });
    }
  };

  for (const page of contract.pageContracts ?? []) {
    const companionOrigin = page?.companionStateOverride?.origin;
    if (companionOrigin?.kind === 'story_evidence') {
      validateOrigin({
        origin: companionOrigin,
        label: `page ${page.pageNumber}.companionStateOverride.origin(story_evidence)`,
        locator: {
          kind: 'page',
          fieldRole: 'source_evidence',
          pageNumber: page.pageNumber,
        },
        purpose: 'companion appearance-state transition',
      });
    }
    const constraints = page?.safetyConstraints;
    if (!Array.isArray(constraints)) continue;
    constraints.forEach((safety, i) => {
      const origin = safety?.origin;
      if (!origin || origin.kind !== 'story_evidence') return;
      const label = `page ${page.pageNumber}.safetyConstraints[${i}].origin(story_evidence)`;
      const locator: DraftValidationIssue['locator'] =
        Number.isSafeInteger(page.pageNumber) && page.pageNumber > 0
          ? {
              kind: 'page_item',
              collectionRole: 'page_safety_constraints',
              fieldRole: 'source_evidence',
              pageNumber: page.pageNumber,
              itemIndex: i,
            }
          : {
              kind: 'collection_item',
              collectionRole: 'page_safety_constraints',
              fieldRole: 'source_evidence',
              itemIndex: i,
            };

      validateOrigin({
        origin,
        label,
        locator,
        purpose: 'hazard',
      });
    });
  }

  return {
    errors,
    diagnosticIssues,
  };
}

export function sourceEvidenceErrors(
  contract: BookVisualContract,
  pages: SourceEvidencePage[],
): string[] {
  return sourceEvidenceValidation(contract, pages).errors;
}
