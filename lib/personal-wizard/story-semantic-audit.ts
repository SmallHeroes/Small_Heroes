import { z } from 'zod';

// These are model claims with source-bound citations, not proof of entailment.
export const SEMANTIC_EDIT_CATEGORIES = ['world_rules', 'setup_payoff', 'threat_tone', 'child_agency', 'companion_contribution'] as const;
const citation = z.object({ pageNumber: z.number().int().min(1).max(16), quote: z.string().trim().min(4).max(220) }).strict();
const auditRow = z.object({
  outcome: z.enum(['preserved', 'intentional_revision', 'unresolved', 'not_applicable']),
  original: z.array(citation).max(2), revised: z.array(citation).max(2),
  explanation: z.string().trim().min(10).max(600),
}).strict();
export const semanticEditAuditSchema = z.object({
  version: z.literal('personal-semantic-edit-audit/v1'),
  world_rules: auditRow, setup_payoff: auditRow, threat_tone: auditRow,
  child_agency: auditRow, companion_contribution: auditRow,
}).strict();
export type SemanticEditAudit = z.infer<typeof semanticEditAuditSchema>;

export function semanticEditAuditSchemaForSpreads(count: number) {
  if (![8, 12, 16].includes(count)) throw Error('semantic_audit_spread_count');
  const bounded = citation.extend({ pageNumber: z.number().int().min(1).max(count) });
  const row = auditRow.extend({ original: z.array(bounded).max(2), revised: z.array(bounded).max(2) });
  return semanticEditAuditSchema.extend({ world_rules: row, setup_payoff: row, threat_tone: row,
    child_agency: row, companion_contribution: row });
}
type Prose = { title: string; pages: { pageNumber: number; text: string }[] };

/** Validates provenance/coverage only. A real quote can still support a false inference. */
export function assertSemanticEditEvidence(raw: unknown, original: Prose, revised: Prose): asserts raw is SemanticEditAudit {
  const audit = semanticEditAuditSchema.parse(raw);
  for (const category of SEMANTIC_EDIT_CATEGORIES) {
    const row = audit[category];
    if (row.outcome === 'not_applicable') {
      if (category !== 'world_rules' && category !== 'threat_tone') throw Error('semantic_audit_applicability');
      if (row.original.length || row.revised.length) throw Error('semantic_audit_applicability');
      continue;
    }
    if (!row.original.length || !row.revised.length) throw Error('semantic_audit_evidence_missing');
    for (const [refs, text] of [[row.original, original], [row.revised, revised]] as const) {
      if (new Set(refs.map(ref => `${ref.pageNumber}:${ref.quote}`)).size !== refs.length) throw Error('semantic_audit_duplicate');
      for (const ref of refs) {
        if (!text.pages.find(page => page.pageNumber === ref.pageNumber)?.text.includes(ref.quote)) throw Error('semantic_audit_quote_mismatch');
      }
    }
  }
}

export function semanticEditNeedsWork(audit: SemanticEditAudit): boolean {
  return SEMANTIC_EDIT_CATEGORIES.some(category => audit[category].outcome === 'unresolved');
}

export const SEMANTIC_EDIT_INSTRUCTIONS = `Protect meaning as well as fluency. Report semanticAudit for world_rules, setup_payoff, threat_tone, child_agency and companion_contribution against ORIGINAL and REVISED prose, not the outline alone. Cite short exact passages with spread numbers. Distinguish a pre-existing weakness from damage introduced by editing. For an intentional revision, explain the problem solved and update every dependent condition, consequence, discovery and payoff. A fictional rule may change coherently; it is not immutable authority. New tension is not automatically wrong: assess age, tone and exclusions, without casually introducing eating, injury or a larger threat during sentence polishing. Preserve strong lines and humour; brevity alone is not improvement. Do not transfer the decisive discovery from child to companion or reduce the companion to repeated mistakes. Mark unresolved when a meaningful risk remains. not_applicable is allowed only for genuinely absent world rules or threat/tone; use empty citations then. All other categories require both original and revised evidence. A quotation is evidence to examine, not proof of correctness.`;
