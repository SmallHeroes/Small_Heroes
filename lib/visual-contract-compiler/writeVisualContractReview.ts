/**
 * Brief 1, Component 4 — review-report renderer (`{storyKey}.visual-contract-review.md`).
 *
 * The HUMAN SIGN-OFF surface. It surfaces, in plain language: which facts the extractor DERIVED from the text
 * (gender + evidence + presence), what it DEFERRED (laterality / continuity — for the human to author), any
 * low-confidence calls to eyeball, and — when a previously approved template is supplied — exactly how the
 * candidate DIFFERS from it. Pure string builder; no I/O.
 */
import type { BookVisualContractTemplate, TemplateHumanCastMember } from './contractTemplateTypes';
import type { DeterministicFacts } from './extractDeterministicFacts';

export interface ReviewReportArgs {
  storyKey: string;
  facts: DeterministicFacts;
  template: BookVisualContractTemplate;
  /** Non-fatal compile notes (dropped phantom humans, missing draft appearance, …). */
  notes?: string[];
  /** Whether the candidate passed validateBookVisualContractTemplate. */
  valid: boolean;
  validationErrors?: string[];
  /** A previously approved template (e.g. the hand-authored one) to diff against. */
  previous?: BookVisualContractTemplate;
}

function humanById(t: BookVisualContractTemplate | undefined, id: string): TemplateHumanCastMember | undefined {
  return t?.humanCast?.find((h) => h.id === id);
}

function castIdsByPage(t: BookVisualContractTemplate): Map<number, Set<string>> {
  const m = new Map<number, Set<string>>();
  for (const pc of t.pageContracts) m.set(pc.pageNumber, new Set(pc.castIds ?? []));
  return m;
}

function lateralityPages(t: BookVisualContractTemplate): number[] {
  return t.pageContracts
    .filter((pc) => (pc.castStates ?? []).some((cs) => cs.injectionArm || cs.bandageArm || cs.freeHand))
    .map((pc) => pc.pageNumber);
}

function eq(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function renderVisualContractReview(args: ReviewReportArgs): string {
  const { storyKey, facts, template, previous } = args;
  const L: string[] = [];
  const push = (s = '') => L.push(s);

  push(`# Visual-contract review — ${storyKey}`);
  push();
  push('> Auto-drafted by the text-first compiler (offline, no live LLM on the paid path). This is a CANDIDATE');
  push('> for human sign-off — only an approved template is ever materialized / frozen / rendered.');
  push();
  push(`- **Validation:** ${args.valid ? '✅ passes `validateBookVisualContractTemplate`' : '❌ FAILED (candidate rejected — fail-closed)'}`);
  push(`- **Pages:** ${facts.pageCount}`);
  push(`- **Recurring humans:** ${facts.humans.length ? facts.humans.map((h) => `${h.role} (${h.gender})`).join(', ') : 'none detected'}`);
  if (!args.valid && args.validationErrors?.length) {
    push();
    push('## ❌ Validation errors');
    for (const e of args.validationErrors) push(`- ${e}`);
  }

  push();
  push('## Derived from the text (deterministic — the compiler is confident)');
  for (const h of facts.humans) {
    push();
    push(`### ${h.role} \`${h.id}\` — gender **${h.gender}** (${h.genderConfidence} confidence)`);
    if (h.genderEvidence) push(`- Evidence: p${h.genderEvidence.page} — "${h.genderEvidence.phrase}"`);
    push(`- Present on pages: [${h.pagesPresent.join(', ')}]${h.lowConfidencePages.length ? ` — low-confidence (image-direction only): [${h.lowConfidencePages.join(', ')}]` : ''}`);
    push(`- Aliases found: ${h.aliasesFound.join(', ') || '(none)'}`);
  }
  push();
  push(`- Companion present on: [${facts.companionPresentPages.join(', ')}]; absent on: [${facts.companionAbsentPages.join(', ')}]`);
  push(`- Child named on: [${facts.childNamedPages.join(', ')}] (the child is the protagonist — present on every page by default).`);

  push();
  push('## ⚠️ Deferred to the human (the text does NOT determine these — NOT invented)');
  if (facts.deferrals.length === 0) {
    push('- none.');
  } else {
    for (const d of facts.deferrals) {
      push(`- **${d.field}**${d.pages?.length ? ` — pages [${d.pages.join(', ')}]` : ''}`);
      push(`  - ${d.reason}`);
    }
  }

  if (facts.warnings.length || (args.notes && args.notes.length)) {
    push();
    push('## Notes');
    for (const w of facts.warnings) push(`- ⚠️ ${w}`);
    for (const n of args.notes ?? []) push(`- ${n}`);
  }

  if (previous) {
    push();
    push('## Differences from the previously approved template');
    const diffs: string[] = [];
    // humanCast gender + presence.
    for (const h of facts.humans) {
      const prev = humanById(previous, h.id);
      if (!prev) {
        diffs.push(`- ${h.id}: NEW in candidate (not in previous).`);
        continue;
      }
      if (prev.gender !== h.gender) diffs.push(`- ${h.id}: gender candidate=${h.gender} vs previous=${prev.gender}.`);
      if (!eq(prev.pagesPresent ?? [], h.pagesPresent)) {
        const prevSet = new Set(prev.pagesPresent ?? []);
        const missing = (prev.pagesPresent ?? []).filter((p) => !h.pagesPresent.includes(p));
        const extra = h.pagesPresent.filter((p) => !prevSet.has(p));
        diffs.push(
          `- ${h.id}.pagesPresent: candidate=[${h.pagesPresent.join(', ')}] vs previous=[${(prev.pagesPresent ?? []).join(', ')}]` +
            `${missing.length ? ` — previous had extra [${missing.join(', ')}] (likely human-authored continuity)` : ''}` +
            `${extra.length ? ` — candidate adds [${extra.join(', ')}]` : ''}.`,
        );
      }
    }
    // Laterality castStates.
    const candLat = lateralityPages(template);
    const prevLat = lateralityPages(previous);
    if (!eq(candLat, prevLat)) {
      diffs.push(`- castStates laterality on pages: candidate=[${candLat.join(', ') || '—'}] vs previous=[${prevLat.join(', ') || '—'}] (previous is human-authored; the text is silent on side).`);
    }
    // Per-page castIds.
    const cand = castIdsByPage(template);
    const prev = castIdsByPage(previous);
    for (const [page, prevIds] of prev) {
      const candIds = cand.get(page) ?? new Set<string>();
      const dropped = [...prevIds].filter((x) => !candIds.has(x));
      const added = [...candIds].filter((x) => !prevIds.has(x));
      if (dropped.length || added.length) {
        diffs.push(`- p${page} castIds: ${dropped.length ? `previous-only [${dropped.join(', ')}] ` : ''}${added.length ? `candidate-only [${added.join(', ')}]` : ''}`.trim() + '.');
      }
    }
    if (diffs.length === 0) push('- none — candidate matches the previously approved template.');
    else for (const d of diffs) push(d);
  }

  push();
  push('## Suggested pages to eyeball first');
  const review = new Set<number>();
  for (const h of facts.humans) for (const p of h.lowConfidencePages) review.add(p);
  for (const d of facts.deferrals) for (const p of d.pages ?? []) review.add(p);
  const sorted = [...review].sort((a, b) => a - b);
  push(sorted.length ? `- pages [${sorted.join(', ')}] (low-confidence presence or a deferred field).` : '- none flagged.');
  push();

  return L.join('\n');
}
