import { getCompanionBible } from '../data/companion-rules';
import type { StoryValidator } from '../types';
import { finding, normalizeCompanionId } from '../utils';

/**
 * v1.4 — BLOCKING: frontmatter must match the order context.
 *
 * Caught in batch v0.2.4 review: Draft was writing `direction: bedtime` and
 * `companionId: 001` for fantasy stories. This is a deterministic bug — no
 * LLM editorial needed to flag it. Catching it at technical validator level
 * stops it before editorial wastes a call.
 */
export const frontmatterConsistencyValidator: StoryValidator = {
  id: 'frontmatterConsistency',
  run({ parsed, input }) {
    const findings = [];
    const fm = parsed.frontmatter;

    // direction must match
    const fmDirection = String(fm.direction ?? '').toLowerCase();
    if (fmDirection && fmDirection !== input.context.direction) {
      findings.push(
        finding(
          'frontmatterConsistency',
          'BLOCKING',
          `frontmatter direction "${fmDirection}" לא תואם להזמנה "${input.context.direction}"`,
          {
            suggestion: `קבע direction: ${input.context.direction} ב-frontmatter`,
          }
        )
      );
    }

    // companionId must match (normalized) OR match the bible canonical name
    const fmCompanionId = String(fm.companionId ?? '').trim();
    if (fmCompanionId) {
      const normalizedFm = normalizeCompanionId(fmCompanionId);
      const normalizedInput = normalizeCompanionId(input.context.companionId);
      const bible = getCompanionBible(normalizedInput);
      const validAliases = bible
        ? new Set([normalizedInput, bible.nameClean, bible.canonicalName])
        : new Set([normalizedInput]);
      if (!validAliases.has(normalizedFm) && !validAliases.has(fmCompanionId)) {
        findings.push(
          finding(
            'frontmatterConsistency',
            'BLOCKING',
            `frontmatter companionId "${fmCompanionId}" לא תואם להזמנה "${input.context.companionId}"`,
            {
              suggestion: `קבע companionId: ${input.context.companionId} ב-frontmatter`,
            }
          )
        );
      }
    }

    // pages must match
    const fmPages = typeof fm.pages === 'number' ? fm.pages : Number(fm.pages);
    if (Number.isFinite(fmPages) && fmPages !== input.context.pageCount) {
      findings.push(
        finding(
          'frontmatterConsistency',
          'BLOCKING',
          `frontmatter pages=${fmPages} לא תואם להזמנה pageCount=${input.context.pageCount}`,
          {
            suggestion: `קבע pages: ${input.context.pageCount} ב-frontmatter`,
          }
        )
      );
    }

    return findings;
  },
};
