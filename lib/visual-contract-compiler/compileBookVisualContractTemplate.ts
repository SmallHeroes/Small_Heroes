/**
 * Brief 1, Component 3 — text-first TEMPLATE compiler (offline, human-in-the-loop).
 *
 * Flow (deterministic facts BEFORE the LLM; facts overlaid LAST so a draft can never overwrite them):
 *   1. extractDeterministicFacts(input)         — gender / evidence / presence / laterality (pure, no LLM)
 *   2. LLM drafts ONLY descriptive fields        — locations/zones/cast/props/cover + humanCast appearance
 *   3. assemble: draft scaffold + facts overlaid — identity + presence + laterality come from (1), never (2)
 *   4. assertValidBookVisualContractTemplate     — FAIL-CLOSED; an invalid candidate is never returned
 *
 * This NEVER runs on the paid/frozen path: it emits a `.visual-contract-template.json` CANDIDATE for human
 * review. Only a human-approved template is ever materialized/frozen/hashed. The LLM caller is injected, so the
 * compiler is verifiable with a stub (no live model, no cost) — the deterministic overlay is what's under test.
 *
 * Kept in a SEPARATE module from the dormant vNext `compileBookVisualContract` so that path stays untouched.
 */
import type {
  BookVisualContractTemplate,
  TemplateHumanCastMember,
} from './contractTemplateTypes';
import { VISUAL_CONTRACT_SCHEMA_VERSION } from './contractTemplateTypes';
import { assertValidBookVisualContractTemplate, InvalidTemplateContractError } from './validateTemplateContract';
import { parseContractJson } from './compileBookVisualContract';
import type { ContractLlmCaller } from './compileBookVisualContract';
import {
  extractDeterministicFacts,
  type DeterministicFacts,
  type DeterministicFactsInput,
  type HumanFact,
} from './extractDeterministicFacts';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_NAME,
  TEMPLATE_DRAFT_SCHEMA_VERSION,
} from './templateDraftSchema';

/** The child's cast id is a fixed constant — the hero anchor. NEVER taken from the LLM draft. */
const CHILD_ID = 'child:hero';

// ── Dedicated authoring call (Stage 1 of the live-authoring fix) ─────────────
// The template draft is a large relational doc; it needs a real reasoning model + budget + strict structured
// output, not the support default. These are REQUESTED by the compiler; the injected caller executes them.
const AUTHORING_MODEL = 'gpt-5.3-pro';
const AUTHORING_REASONING_EFFORT = 'medium';
const TEMPLATE_PROMPT_VERSION = 'vc-template-prompt/v1';

/** Output token budget: ~1000 tokens/page for the relational doc; floored at 12000, capped at 20000 (12 pages → 12000). */
export function authoringMaxOutputTokens(pageCount: number): number {
  const pages = Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 12;
  return Math.min(20000, Math.max(12000, Math.round(pages * 1000)));
}

/** Provenance for the authoring call (recorded beside the candidate; NOT part of the frozen hash). */
export interface TemplateAuthoringProvenance {
  authoringModel: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  schemaVersion: string;
  promptVersion: string;
  attempt: number;
}

/**
 * The AUTHORITATIVE companion CAST id, derived from the order's companion (input.companion) — namespaced the same
 * way as child:hero / human:role. Never from the draft. Returns null when the order has no companion.
 */
function authoritativeCompanionCastId(input: { companion?: { id: string; name?: string } | null }): string | null {
  return input.companion ? `companion:${input.companion.id}` : null;
}

export interface TemplateCompileInput extends DeterministicFactsInput {
  /** Full story text (page-marked) — the LLM's descriptive input. */
  fullStoryText: string;
  childName?: string;
  /** Optional hint; the LLM may set worldType from the text when omitted. */
  worldType?: string;
}

export interface TemplateCompileResult {
  template: BookVisualContractTemplate;
  facts: DeterministicFacts;
  /** Non-fatal notes: e.g. a draft human the extractor did not detect (dropped as non-text-verified). */
  notes: string[];
  /** The authoring call's provenance (model / reasoning / budget / schema+prompt version / attempt). */
  provenance: TemplateAuthoringProvenance;
}

// ── LLM prompt (real path; the pilot injects a stub) ─────────────────────────

export function buildTemplateCompileSystemPrompt(): string {
  return [
    "You are a visual-continuity compiler for a children's picture book, producing a DRAFT for human review.",
    'You are given DETERMINISTIC FACTS already extracted from the story text (recurring humans, their gender, the',
    'pages they appear on, and any laterality). Those facts are AUTHORITATIVE and will be overlaid onto your output —',
    'you MUST NOT restate or contradict them.',
    '',
    'Draft ONLY the DESCRIPTIVE fields:',
    '- worldType, locations[], zones[] (with stableGeometry), cast.child + cast.companion wardrobe,',
    '  recurringProps[] (material/scale/persistence), forbiddenGlobalElements[], coverContract, and per-page',
    '  mustShow/mustNotShow/propState/camera/transition/zoneId/locationId.',
    '- For each given human, draft ONLY appearance (skinTone/hairColour/hairTexture/hairStyle bindings), garments,',
    '  and forbiddenAppearance. Relatives (mother/father/sibling/grandparent) use family_profile for skin/hair;',
    '  a non-relative (doctor/nurse/teacher) uses deterministic_palette; every garment colour is an explicit value.',
    '',
    'You MUST NOT output: a human\'s gender, pagesPresent, textEvidence, or aliases; page castIds or characterPresence;',
    'or any laterality (injectionArm/bandageArm/freeHand). Those are supplied by the deterministic extractor. Do not',
    'invent a human who is not in the given facts.',
    '',
    'Output ONLY the JSON object, no prose, no markdown fences.',
  ].join('\n');
}

export function buildTemplateCompileUserPrompt(input: TemplateCompileInput, facts: DeterministicFacts): string {
  const humanLines = facts.humans.map(
    (h) =>
      `- ${h.id} (role=${h.role}, gender=${h.gender}); present on pages [${h.pagesPresent.join(', ')}]; draft ONLY appearance/garments/forbiddenAppearance for this person.`,
  );
  return [
    `storyKey: ${input.storyKey}`,
    `pageCount: ${input.pageCount}`,
    `child: ${input.childName ?? '(child)'}${input.childGender ? ` (${input.childGender})` : ''}`,
    input.companion ? `Companion: ${input.companion.name ?? input.companion.id} (id=${input.companion.id}).` : 'No companion.',
    '',
    'DETERMINISTIC FACTS (authoritative — do NOT restate gender/presence/laterality; draft descriptive fields only):',
    ...humanLines,
    facts.laterality.length
      ? `Laterality (from the text): ${facts.laterality.map((l) => `p${l.page}:${l.side}`).join(', ')}`
      : 'Laterality: none stated in the text (do NOT invent left/right).',
    '',
    'Produce a JSON BookVisualContractTemplate DRAFT (descriptive fields only) with keys: worldType, locations[],',
    'zones[], cast{child,companion?}, humanCast[{id, appearance, garments, forbiddenAppearance}], recurringProps[],',
    'forbiddenGlobalElements[], coverContract, pageContracts[{pageNumber, locationId, zoneId, sameLocationAs?,',
    'mustShow[], mustNotShow[], propState[], camera, transition}].',
    '',
    'FULL STORY TEXT:',
    input.fullStoryText,
  ].join('\n');
}

// ── Assembly ─────────────────────────────────────────────────────────────────

function asObj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Format a real evidence phrase into the textEvidence string (never fabricated — a real page + phrase). */
function formatEvidence(h: HumanFact): string {
  if (!h.genderEvidence) return `role ${h.role} (gender ${h.gender}; evidence not localized)`;
  return `עמוד ${h.genderEvidence.page}: "${h.genderEvidence.phrase}"`;
}

/** Merge the deterministic identity facts (win) with the draft's descriptive appearance for one human. */
function mergeHuman(fact: HumanFact, draftHuman: Record<string, unknown>): TemplateHumanCastMember {
  return {
    id: fact.id,
    role: fact.role,
    gender: fact.gender,
    // Identity is DETERMINISTIC: aliases come from the extractor, NEVER the draft (the LLM is told not to
    // output aliases; a draft can neither overwrite nor drop a text-found alias). Only appearance/garments/
    // forbiddenAppearance below are descriptive draft fields.
    aliases: fact.aliasesFound,
    textEvidence: formatEvidence(fact),
    pagesPresent: fact.pagesPresent,
    appearance: draftHuman.appearance as TemplateHumanCastMember['appearance'],
    garments: (draftHuman.garments as TemplateHumanCastMember['garments']) ?? [],
    forbiddenAppearance: asArr(draftHuman.forbiddenAppearance).filter((a): a is string => typeof a === 'string'),
  };
}

/** Recompute one page's castIds + characterPresence + laterality castStates from the deterministic facts. */
function overlayPage(
  pc: Record<string, unknown>,
  facts: DeterministicFacts,
  childId: string,
  companionId: string | null,
): Record<string, unknown> {
  const page = typeof pc.pageNumber === 'number' ? pc.pageNumber : -1;
  const companionPresent = companionId != null && facts.companionPresentPages.includes(page);

  // castIds: child (always — the protagonist), companion (from companionPresence), each human by pagesPresent.
  const castIds: string[] = [childId];
  if (companionPresent && companionId) castIds.push(companionId);
  for (const h of facts.humans) if (h.pagesPresent.includes(page)) castIds.push(h.id);
  const castIdSet = new Set(castIds);

  // castStates: keep ONLY the draft's descriptive bodyState, and ONLY for a cast member PRESENT on this page
  // (castId ∈ the recomputed castIds). This is the presence overlay: a draft cannot smuggle a bodyState for an
  // ABSENT character (facts overlaid LAST). ALL laterality (injectionArm/bandageArm/freeHand) is DISCARDED and
  // NEVER re-injected — attributing a side to the child's injection/bandage arm is a human authoring choice the
  // tool defers. Drop no-op / absent entries; omit castStates entirely if empty (Slice B fail-closed rule).
  const rebuilt: Array<Record<string, unknown>> = [];
  for (const raw of asArr(pc.castStates)) {
    const cs = asObj(raw);
    const entry: Record<string, unknown> = {};
    if (typeof cs.castId === 'string') entry.castId = cs.castId;
    if (typeof cs.bodyState === 'string') entry.bodyState = cs.bodyState; // descriptive — kept
    if (typeof entry.castId === 'string' && castIdSet.has(entry.castId) && 'bodyState' in entry) {
      rebuilt.push(entry);
    }
  }

  const out: Record<string, unknown> = {
    ...pc,
    castIds,
    characterPresence: { child: true, companion: companionPresent },
  };
  if (rebuilt.length > 0) out.castStates = rebuilt;
  else delete out.castStates; // omit rather than emit [] (Slice B fail-closed rule)
  return out;
}

/**
 * Compile a template CANDIDATE from a story source. Deterministic facts are extracted first and overlaid last;
 * the LLM (injected) drafts descriptive fields only. Fail-closed: throws if the assembled candidate is invalid.
 */
export async function compileBookVisualContractTemplate(
  input: TemplateCompileInput,
  deps: { callLLM: ContractLlmCaller },
): Promise<TemplateCompileResult> {
  const facts = extractDeterministicFacts(input);
  const notes: string[] = [];

  // Dedicated authoring call: real reasoning model + strict structured output + a budget scaled to the page count,
  // with NO silent model fallback. The injected caller executes what the compiler requests.
  const maxOutputTokens = authoringMaxOutputTokens(input.pageCount);
  const provenance: TemplateAuthoringProvenance = {
    authoringModel: AUTHORING_MODEL,
    reasoningEffort: AUTHORING_REASONING_EFFORT,
    maxOutputTokens,
    schemaVersion: TEMPLATE_DRAFT_SCHEMA_VERSION,
    promptVersion: TEMPLATE_PROMPT_VERSION,
    attempt: 1,
  };
  const raw = await deps.callLLM(buildTemplateCompileSystemPrompt(), buildTemplateCompileUserPrompt(input, facts), {
    maxOutputTokens,
    model: AUTHORING_MODEL,
    reasoningEffort: AUTHORING_REASONING_EFFORT,
    jsonSchema: { name: TEMPLATE_DRAFT_SCHEMA_NAME, schema: TEMPLATE_DRAFT_JSON_SCHEMA },
    noFallback: true,
  });
  const draft = asObj(parseContractJson(raw));

  // Cast IDENTITY + PRESENCE are AUTHORITATIVE from the input/facts — NEVER the draft. The child id is a fixed
  // constant; the companion id comes from input.companion (the order); humans come from the extractor. The draft
  // contributes ONLY descriptive fields (wardrobe / appearance prose). This is the class fix: draft.cast can
  // neither inject nor suppress a cast member's identity or presence.
  const draftCast = asObj(draft.cast);
  const draftChild = asObj(draftCast.child);
  const draftCompanion = asObj(draftCast.companion);
  const childId = CHILD_ID;
  const companionId = authoritativeCompanionCastId(input);

  // Surface (don't silently swallow) a draft that tried to mis-id or inject a companion — identity is input-authoritative.
  const draftCompanionId = typeof draftCompanion.id === 'string' ? (draftCompanion.id as string) : undefined;
  if (input.companion && draftCompanionId && draftCompanionId !== companionId) {
    notes.push(`draft cast.companion.id "${draftCompanionId}" != authoritative companion id "${companionId}" (from input.companion) — draft identity ignored`);
  }
  if (!input.companion && draftCompanionId) {
    notes.push(`draft cast.companion "${draftCompanionId}" dropped — the order has no companion (identity is input-authoritative)`);
  }

  // Build cast from authoritative id/role (+ authoritative companion name), keeping ONLY the draft's descriptive
  // subfields (wardrobe). Spread-then-override so a draft id/role/name can never win.
  const authoritativeCast: Record<string, unknown> = {
    child: { ...draftChild, id: childId, role: 'child' },
  };
  if (input.companion) {
    authoritativeCast.companion = {
      ...draftCompanion,
      id: companionId,
      role: 'companion',
      ...(input.companion.name ? { name: input.companion.name } : {}),
    };
  }

  // humanCast is AUTHORITATIVE from the extractor: every detected human, merged with its drafted appearance.
  const draftHumans = asArr(draft.humanCast).map(asObj);
  const humanCast: TemplateHumanCastMember[] = facts.humans.map((h) => {
    const match = draftHumans.find((d) => d.id === h.id || d.role === h.role) ?? {};
    if (!match.appearance) {
      notes.push(`draft did not provide appearance for ${h.id} — candidate will fail validation (needs human authoring)`);
    }
    return mergeHuman(h, match);
  });
  // Flag any drafted human the extractor did NOT detect (dropped — the LLM cannot add cast the text doesn't support).
  for (const d of draftHumans) {
    const id = typeof d.id === 'string' ? d.id : '';
    if (id && !facts.humans.some((h) => h.id === id)) {
      notes.push(`draft human "${id}" not detected in the text — dropped (extractor is authoritative for cast)`);
    }
  }

  const pageContracts = asArr(draft.pageContracts).map((pc) => overlayPage(asObj(pc), facts, childId, companionId));

  const template: BookVisualContractTemplate = {
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    version: 1,
    storyKey: input.storyKey,
    worldType: (typeof draft.worldType === 'string' ? draft.worldType : input.worldType) ?? 'unspecified',
    locations: draft.locations as BookVisualContractTemplate['locations'],
    zones: draft.zones as BookVisualContractTemplate['zones'],
    cast: authoritativeCast as unknown as BookVisualContractTemplate['cast'],
    humanCast,
    recurringProps: (draft.recurringProps as BookVisualContractTemplate['recurringProps']) ?? [],
    forbiddenGlobalElements: asArr(draft.forbiddenGlobalElements).filter((x): x is string => typeof x === 'string'),
    coverContract: draft.coverContract as BookVisualContractTemplate['coverContract'],
    pageContracts: pageContracts as unknown as BookVisualContractTemplate['pageContracts'],
    provenance: { source: 'llm', model: AUTHORING_MODEL, compiledFromPages: input.pageCount },
  };

  // STRUCTURAL INVARIANT (fail-closed): every cast identity + presence must match the input/facts EXACTLY, so a
  // future refactor that lets draft.cast leak into identity/presence throws here instead of shipping — a 4th
  // instance of the "draft governs a fact" class is structurally impossible, not merely patched.
  assertCastIsFactAuthoritative(template, facts, input);

  // FAIL-CLOSED — never return an invalid candidate.
  assertValidBookVisualContractTemplate(template);
  return { template, facts, notes, provenance };
}

/**
 * Assert that NO cast identity or presence came from the LLM draft: the child id is the fixed constant, the
 * companion id ⟺ input.companion, the humanCast set == the extractor's, and every page's castIds +
 * characterPresence.companion equal EXACTLY the fact-derived present set (no injected or suppressed member).
 * Exported so the guarantee is directly testable. Throws InvalidTemplateContractError on any divergence.
 */
export function assertCastIsFactAuthoritative(
  template: BookVisualContractTemplate,
  facts: DeterministicFacts,
  input: { companion?: { id: string; name?: string } | null },
): void {
  const errs: string[] = [];
  const cast = asObj(template.cast);
  const childId = typeof asObj(cast.child).id === 'string' ? (asObj(cast.child).id as string) : '';
  if (childId !== CHILD_ID) errs.push(`cast.child.id "${childId}" != authoritative "${CHILD_ID}"`);

  const companionId = authoritativeCompanionCastId(input);
  const companion = cast.companion;
  if (companionId) {
    const cid = typeof asObj(companion).id === 'string' ? (asObj(companion).id as string) : undefined;
    if (!companion || cid !== companionId) errs.push(`cast.companion.id "${cid ?? '(none)'}" != authoritative "${companionId}"`);
  } else if (companion) {
    errs.push('cast.companion present but the order has no companion');
  }

  const factHumanIds = new Set(facts.humans.map((h) => h.id));
  const tmplHumanIds = new Set(template.humanCast.map((h) => h.id));
  if (factHumanIds.size !== tmplHumanIds.size || [...factHumanIds].some((id) => !tmplHumanIds.has(id))) {
    errs.push(`humanCast ids [${[...tmplHumanIds].join(', ')}] != facts [${[...factHumanIds].join(', ')}]`);
  }

  for (const pc of template.pageContracts) {
    const expected = new Set<string>([CHILD_ID]);
    if (companionId && facts.companionPresentPages.includes(pc.pageNumber)) expected.add(companionId);
    for (const h of facts.humans) if (h.pagesPresent.includes(pc.pageNumber)) expected.add(h.id);
    const actual = new Set(pc.castIds ?? []);
    const missing = [...expected].filter((id) => !actual.has(id));
    const extra = [...actual].filter((id) => !expected.has(id));
    if (missing.length || extra.length) {
      errs.push(`p${pc.pageNumber} castIds not fact-authoritative — missing [${missing.join(', ')}], extra [${extra.join(', ')}]`);
    }
    const shouldCompanion = !!companionId && facts.companionPresentPages.includes(pc.pageNumber);
    if (asObj(pc.characterPresence).companion !== shouldCompanion) {
      errs.push(`p${pc.pageNumber} characterPresence.companion ${String(asObj(pc.characterPresence).companion)} != facts ${shouldCompanion}`);
    }
  }

  if (errs.length) {
    throw new InvalidTemplateContractError([`cast/presence not fact-authoritative (draft leak): ${errs.join('; ')}`]);
  }
}
