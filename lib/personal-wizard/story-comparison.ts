import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { anyPersonalStoryResultSchema, STORY_EDITOR_CRITERIA } from './story-editor-contract';
import { assertStoryEditBinding } from './story-editor';
import { preparePersonalStory } from './story-writer';
import { canonicalJson } from './request-acceptance';
import { adventureSelectionIssue } from './story-planning-contract';
import { measureStoryText } from './story-text-metrics';
import type { PersonalWizardOptions } from './options';
import { personalStoryEvaluationProfiles } from './story-evaluation-profiles';

const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const commit = z.string().regex(/^[a-f0-9]{40}$/);
const artifact = z.object({ sourceCommit: commit, reasoning: z.literal('medium'), request: z.unknown(), result: z.unknown() }).strict();
export const storyComparisonManifestSchema = z.object({
  version: z.literal('personal-story-comparison/offline-v1'), seed: z.string().min(16).max(128),
  baselineCommit: commit, improvedCommit: commit,
  cases: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]{1,48}$/), split: z.enum(['development', 'held_out']),
    registeredRequest: z.unknown(), baselineDraft: artifact.nullable(), baselineEdited: artifact.nullable(),
    improvedDraft: artifact.nullable(), improvedEdited: artifact.nullable(),
  }).strict()).min(1).max(24),
}).strict();
const fail = (code: string): never => { throw Error(`story_comparison_${code}`); };
type Result = z.infer<typeof anyPersonalStoryResultSchema>;

/** Offline evidence packaging only: no SDK, secret, network, retry or generation. */
export function buildStoryComparison(raw: unknown, options: PersonalWizardOptions) {
  const manifest = storyComparisonManifestSchema.parse(raw);
  const profiles = personalStoryEvaluationProfiles();
  const registry = new Map(profiles.map(profile => [profile.id, profile]));
  if (manifest.baselineCommit === manifest.improvedCommit || new Set(manifest.cases.map(row => row.id)).size !== manifest.cases.length) fail('identity');
  const blind = { kind: 'blind_human_review_not_literary_acceptance' as const,
    criteria: STORY_EDITOR_CRITERIA,
    instructions: 'Read both complete texts against the brief. Choose A, B, tie or neither; cite actual passages, remaining substantial problems and strong elements to preserve. Seal judgments before revealing private labels.',
    finalInstructions: 'Read each complete story against its brief. Cite actual passages supporting strengths and substantial remaining problems; assess whether the text resolves them, never an editor assertion. Seal judgments before revealing private labels. Do not infer quality from word counts.',
    firstDraftPairs: [] as unknown[], editingPairs: [] as unknown[], finalTexts: [] as unknown[], premisePairs: [] as unknown[] };
  const privateRows: unknown[] = [], privateLabels: unknown[] = [];
  const reviewText = (result: Result) => ({ title: result.manuscript.title,
    pages: result.manuscript.pages.map(({ pageNumber, text }) => ({ pageNumber, text })) });
  // Opaque identifiers: no ordinal, allocation order or public source digest.
  const label = (caseId: string, phase: string) => `r${hash({ seed: manifest.seed, caseId, phase, namespace: 'packet-id' }).slice(0, 24)}`;
  const wordReport = (result: Result, age: number) => {
    const metrics = measureStoryText(result.manuscript, age);
    return { metrics, editorReadyDespiteLengthDeviation: 'editing' in result &&
      result.editing.checks.hebrew_and_age.outcome === 'ready_for_reading' &&
      metrics.aboveTarget.length + metrics.belowTarget.length > 0 };
  };
  const pair = (collection: unknown[], caseId: string, phase: string, brief: unknown, a: unknown, b: unknown, identities: string[]) => {
    const packet = label(caseId, phase);
    // Private reproducible assignment; no condition names/seed/key in reviewer packets.
    const swapped = Number.parseInt(hash({ seed: manifest.seed, caseId, phase }).slice(0, 2), 16) % 2 === 1;
    collection.push({ packet, brief, A: swapped ? b : a, B: swapped ? a : b });
    privateLabels.push({ packet, caseId, phase, A: identities[swapped ? 1 : 0], B: identities[swapped ? 0 : 1] });
  };
  for (const row of manifest.cases) {
    // Whole-request admission, including unlabelled avoid text. No caller trust flag/override.
    const profile = registry.get(row.id);
    if (!profile) return fail('unregistered_profile');
    if (row.split !== profile.split || canonicalJson(row.registeredRequest) !== canonicalJson(profile.request)) return fail('unregistered_profile');
    const prepared = preparePersonalStory(profile.request, options);
    const request = prepared.accepted.canonical;
    const brief = { child: prepared.brief.child, facts: prepared.brief.facts.map(({ kind, value }) => ({ kind, value })),
      // Historical artifacts may predate current profiles. Never retrofit today's
      // character beside blind baseline prose as its authoring authority.
      startingPlace: prepared.brief.startingPlace,
      companion: { id: prepared.brief.companion.id, name: prepared.brief.companion.name }, topic: prepared.brief.topic,
      excludedSubjects: prepared.brief.excludedSubjects, narrativeSpreads: prepared.brief.beats };
    const results: Partial<Record<'baselineDraft' | 'baselineEdited' | 'improvedDraft' | 'improvedEdited', Result>> = {};
    for (const slot of ['baselineDraft', 'baselineEdited', 'improvedDraft', 'improvedEdited'] as const) {
      const supplied = row[slot]; if (!supplied) continue;
      const expectedCommit = slot.startsWith('baseline') ? manifest.baselineCommit : manifest.improvedCommit;
      if (supplied.sourceCommit !== expectedCommit || canonicalJson(supplied.request) !== canonicalJson(row.registeredRequest)) fail('request_or_commit');
      const result = anyPersonalStoryResultSchema.parse(supplied.result);
      if (canonicalJson(result) !== canonicalJson(supplied.result) || result.requestId !== prepared.accepted.requestId ||
        result.displayPages !== prepared.brief.displayPages || !result.containsFixtureData || hash(result.plan) !== result.planDigest) fail('source_binding');
      if (slot.endsWith('Edited') !== ('editing' in result)) fail('phase');
      if ('editing' in result) assertStoryEditBinding(result);
      const plans = 'editing' in result ? [result.plan, result.editing.original.plan] : [result.plan];
      const ids = new Set(prepared.brief.facts.map(fact => fact.id));
      if (plans.some(plan => plan.beats.some(beat => beat.factIds.some(id => !ids.has(id))) || plan.resilience.mode !== prepared.brief.resilienceMode)) fail('fact_binding');
      if (slot.startsWith('improved') && !result.planning) fail('missing_selection');
      if (result.planning) {
        const originalPlan = 'editing' in result ? result.editing.original.plan : result.plan;
        if (hash(originalPlan) !== result.planning.sourcePlanDigest || adventureSelectionIssue(result.planning.selection,
          prepared.brief.facts, prepared.brief.beats, originalPlan.beats.flatMap(beat => beat.factIds))) fail('planning_binding');
      }
      results[slot] = result;
    }
    const models = new Set(Object.values(results).map(result => result.accounting.model));
    if (models.size > 1) fail('model_mismatch');
    const artifacts: Record<string, unknown> = {};
    for (const [slot, result] of Object.entries(results)) artifacts[slot] = {
      canonicalArtifactSha: hash(row[slot as keyof typeof results]), model: result.accounting.model,
      ...wordReport(result, request.child.age!),
      planning: result.planning ?? null, editorObservations: 'editing' in result ? result.editing.checks : null,
    };
    if (results.baselineDraft && results.improvedDraft) pair(blind.firstDraftPairs, row.id, 'planning_first_drafts', brief,
      reviewText(results.baselineDraft), reviewText(results.improvedDraft), ['baselineDraft', 'improvedDraft']);
    for (const arm of ['baseline', 'improved'] as const) {
      const draft = results[`${arm}Draft`], edit = results[`${arm}Edited`];
      if (edit && 'editing' in edit && draft) {
        if (canonicalJson(edit.editing.original) !== canonicalJson({ plan: draft.plan, manuscript: draft.manuscript,
          ...(draft.characterDigest ? { characterDigest: draft.characterDigest } : {}) }) ||
          canonicalJson(edit.planning ?? null) !== canonicalJson(draft.planning ?? null)) fail('unrelated_edit');
        pair(blind.editingPairs, row.id, `${arm}_editing`, brief, reviewText(draft), reviewText(edit), [`${arm}Draft`, `${arm}Edited`]);
      }
      // A missing revision remains missing: a first draft is never relabelled final.
      if (edit) {
        const packet = label(row.id, `${arm}_final`); blind.finalTexts.push({ packet, brief, manuscript: reviewText(edit) });
        privateLabels.push({ packet, caseId: row.id, phase: 'final_text_only', source: `${arm}Edited` });
      }
    }
    if (results.improvedDraft?.planning) {
      const candidates = results.improvedDraft.planning.selection.candidates.map(({ id: _id, ...candidate }) => ({
        ...candidate, personalFactUses: candidate.personalFactUses.map(use => ({
          fact: prepared.brief.facts.find(fact => fact.id === use.factId)!.value, contribution: use.contribution,
        })),
      }));
      pair(blind.premisePairs, row.id, 'premise_preference_before_selection_reveal', brief, candidates[0], candidates[1], ['candidateA', 'candidateB']);
    }
    privateRows.push({ caseId: row.id, split: row.split, artifacts,
      missingSlots: ['baselineDraft', 'baselineEdited', 'improvedDraft', 'improvedEdited'].filter(slot => !(slot in results)),
      planningComparisonAvailable: Boolean(results.baselineDraft && results.improvedDraft),
      editingComparisonsAvailable: ['baseline', 'improved'].filter(arm => results[`${arm}Draft` as keyof typeof results] && results[`${arm}Edited` as keyof typeof results]),
    });
  }
  // Shuffle every phase independently; fixed arm order can reveal labels by prose matching.
  for (const collection of [blind.firstDraftPairs, blind.editingPairs, blind.finalTexts, blind.premisePairs]) {
    collection.sort((a, b) => hash({ seed: manifest.seed, packet: (a as { packet: string }).packet }).localeCompare(hash({ seed: manifest.seed, packet: (b as { packet: string }).packet })));
  }
  return { blind, privateEvidence: { kind: 'private_label_key_and_measurements_not_distribution' as const,
    manifestSha: hash(manifest), registrySha: hash(profiles), originalManifest: manifest,
    baselineCommit: manifest.baselineCommit, improvedCommit: manifest.improvedCommit,
    cases: privateRows, labels: privateLabels, declaredProvenanceNotAuthenticated: true,
    providerCalls: 0, keyReads: 0, costUsd: 0, noQualityVerdict: true } };
}

export const STORY_REVIEW_PHASES = ['first-drafts', 'editing', 'premises', 'final'] as const;
export type StoryReviewPhase = typeof STORY_REVIEW_PHASES[number];
export function storyReviewPacket(blind: ReturnType<typeof buildStoryComparison>['blind'], phase: StoryReviewPhase) {
  // Distribute one phase per reviewer. Combining phases allows matching identical prose.
  const shared = { kind: blind.kind, criteria: blind.criteria };
  if (phase === 'final') return { ...shared, instructions: blind.finalInstructions, finalTexts: blind.finalTexts };
  const rows = phase === 'first-drafts' ? blind.firstDraftPairs : phase === 'editing' ? blind.editingPairs : blind.premisePairs;
  return { ...shared, instructions: blind.instructions, pairs: rows };
}

export function renderBlindStoryComparison(blind: ReturnType<typeof buildStoryComparison>['blind'], phase: StoryReviewPhase = 'first-drafts') {
  const escape = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
  // Allowlisted review packet only, never interpolated privateEvidence or manifest.
  const text = (value: unknown) => {
    const manuscript = value as { title?: string; pages?: { text: string }[] };
    return manuscript.pages ? `<h3>${escape(manuscript.title ?? '')}</h3>${manuscript.pages.map(page => `<p>${escape(page.text)}</p>`).join('')}`
      : `<pre>${escape(JSON.stringify(value, null, 2))}</pre>`;
  };
  const pairs = (rows: unknown[]) => rows.map(raw => {
    const row = raw as { packet: string; brief: unknown; A: unknown; B: unknown };
    return `<section><h2>${escape(row.packet)}</h2><pre>${escape(JSON.stringify(row.brief, null, 2))}</pre><div class="pair"><article><h3>A</h3>${text(row.A)}</article><article><h3>B</h3>${text(row.B)}</article></div></section>`;
  }).join('');
  const packet = storyReviewPacket(blind, phase);
  const content = 'finalTexts' in packet ? packet.finalTexts!.map(raw => {
    const row = raw as { packet: string; brief: unknown; manuscript: unknown };
    return `<section><h2>${escape(row.packet)}</h2><pre>${escape(JSON.stringify(row.brief, null, 2))}</pre>${text(row.manuscript)}</section>`;
  }).join('') : pairs(packet.pairs!);
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>השוואת סיפורים</title><style>body{background:#faf6ed;color:#26372e;font:19px/1.8 Arial,sans-serif}main{max-width:1150px;margin:auto;padding:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:32px}section{border-top:1px solid #ccc;padding:24px 0}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{font:inherit}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><main><h1>קריאה והשוואה</h1><p>${escape(packet.instructions)}</p>${content}</main></html>`;
}
