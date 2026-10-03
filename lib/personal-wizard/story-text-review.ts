import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from './request-acceptance';
import { personalStoryPlanSchema, personalManuscriptSchema } from './story-contract';
import type { PreparedStory } from './story-writer';

const document = z.object({ plan: personalStoryPlanSchema, manuscript: personalManuscriptSchema,
  characterDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type StoryReviewDocument = z.infer<typeof document>;
const digest = (v: unknown) => createHash('sha256').update(canonicalJson(v)).digest('hex');
const prose = (v: StoryReviewDocument) => ({ title: v.manuscript.title, pages: v.manuscript.pages.map(({ pageNumber, text }) => ({ pageNumber, text })) });

/** Source-bound text QA packets, no SDK/dispatch/billing and no editor self-assessments. */
export function prepareStoryTextReview(prepared: PreparedStory, rawOriginal: unknown, rawRevised: unknown) {
  const original = document.parse(rawOriginal), revised = document.parse(rawRevised);
  const ids = new Set(prepared.brief.facts.map(f => f.id));
  for (const doc of [original, revised]) {
    if (canonicalJson(doc) !== canonicalJson(doc === original ? rawOriginal : rawRevised) ||
      doc.characterDigest !== prepared.brief.companion.characterDigest || doc.plan.requestId !== prepared.brief.requestId ||
      doc.manuscript.requestId !== prepared.brief.requestId || digest(doc.plan) !== doc.manuscript.planDigest ||
      doc.plan.beats.length !== prepared.brief.beats || doc.manuscript.pages.length !== prepared.brief.beats ||
      doc.plan.beats.some((b, i) => b.pageNumber !== i + 1 || b.factIds.some(id => !ids.has(id))) ||
      doc.manuscript.pages.some((p, i) => p.pageNumber !== i + 1) || doc.plan.resilience.mode !== prepared.brief.resilienceMode) {
      throw Error('story_text_review_source_binding');
    }
  }
  // Deliberate allowlist. No planning/model/accounting/editor checks or semantic audit.
  const brief = { child: prepared.brief.child, facts: prepared.brief.facts, startingPlace: prepared.brief.startingPlace,
    companion: prepared.brief.companion, topic: prepared.brief.topic, resilienceMode: prepared.brief.resilienceMode,
    excludedSubjects: prepared.brief.excludedSubjects, narrativeSpreads: prepared.brief.beats };
  const finalText = prose(revised), originalText = prose(original);
  const final = { version: 'personal-story-text-review/final-v1', kind: 'model_literary_advisory_not_product_acceptance',
    sourceDigest: digest({ brief, finalText }), brief, manuscript: finalText,
    instructions: 'Read the FINAL complete story against this brief without author/editor ratings. Assess age/read-aloud voice, felt child agency, useful distinctive companion, consequential humour, dynamic development without a location quota, causal world conditions/consequences and setup/payoff. Distinguish contradiction, ambiguity and literary preference. Cite spread and exact prose for findings, with severity blocking, meaningful or polish. No rewrites, therapeutic promises or quality guarantees. Judge the actual prose, not the presence of a quote or the outline.' };
  const comparison = { version: 'personal-story-text-review/editing-v1', kind: final.kind,
    sourceDigest: digest({ brief, originalText, finalText }), brief, original: originalText, revised: finalText,
    instructions: 'Review ORIGINAL versus REVISED after final-only judgment is recorded. Identify improvements and damage separately. Check changes to threat/tone, rule conditions/deadlines/consequences, lost necessary setup, unsupported clues and transferred child/companion agency. Distinguish pre-existing flaw from new regression and justified coherent revision. Each meaningful finding cites original and revised spread/passages, criterion and severity. A fictional rule may change coherently; new age-appropriate tension is not automatically a defect. Do not rubber-stamp the editor or rewrite the story.' };
  return { final: structuredClone(final), comparison: structuredClone(comparison),
    bindings: { originalDigest: digest(original), revisedDigest: digest(revised), providerCalls: 0, costUsd: 0,
      runtimeEligible: false as const, noQualityVerdict: true } };
}
