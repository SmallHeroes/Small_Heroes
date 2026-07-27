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
  HumanAppearanceTraits,
  TemplateHumanCastMember,
  TemplateTraitBinding,
} from './contractTemplateTypes';
import { PALETTE_VERSION, VISUAL_CONTRACT_SCHEMA_VERSION } from './contractTemplateTypes';
import type { BookVisualContract } from './types';
import { assertValidBookVisualContractTemplate, InvalidTemplateContractError } from './validateTemplateContract';
import { sourceEvidenceErrors } from './validateSourceEvidence';
import { parseContractJson } from './compileBookVisualContract';
import type {
  ContractLlmCaller,
  ContractLlmCallOptions,
} from './compileBookVisualContract';
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
import { assertSourceHasRealProse } from './assertSourceProse';
import {
  applyAuthoredCoverAuthority,
  AuthoredCoverAuthorityError,
  coverSourceFidelityIssues,
  type AuthoredCoverAuthority,
} from './coverSourceAuthority';
import { projectCoverMustNotShow } from './projectContractProse';
import { stripNiqqud } from './extractDeterministicFacts';
import {
  VISUAL_CONTRACT_AUTHORING_ENDPOINT,
  VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  VISUAL_CONTRACT_AUTHORING_MODEL,
  VISUAL_CONTRACT_AUTHORING_NO_FALLBACK,
  VISUAL_CONTRACT_AUTHORING_PROVIDER,
  VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT,
  VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
  VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
  VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED,
  VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
} from './authoringPolicy';

/** The child's cast id is a fixed constant — the hero anchor. NEVER taken from the LLM draft. */
const CHILD_ID = 'child:hero';

// ── Dedicated authoring call (Stage 1 of the live-authoring fix) ─────────────
// The template draft is a large relational doc; it needs a real reasoning model + budget + strict structured
// output, not the support default. These are REQUESTED by the compiler; the injected caller executes them.
const AUTHORING_REASONING_EFFORT =
  VISUAL_CONTRACT_AUTHORING_REASONING_EFFORT;
const TEMPLATE_PROMPT_VERSION = 'vc-template-prompt/v3';
/** Stage 3 — at most this many SEMANTIC repair attempts AFTER the initial authoring call (bounded safety net). */
const MAX_REPAIR_ATTEMPTS = 2;
const REPAIR_PROMPT_VERSION = 'vc-repair-prompt/v3';

/** The production authoring model is exact and never environment-overridable. */
export function resolveAuthoringModel(): string {
  return VISUAL_CONTRACT_AUTHORING_MODEL;
}

/**
 * Output token budget for the authoring call. On the Responses API `max_output_tokens` INCLUDES reasoning tokens —
 * reasoning='medium' can burn ~10k — so the budget must cover reasoning headroom AND the full JSON (a valid
 * template ≈ 6.3k). The candidate output budget is ~3000 tokens/page, floored at 32000, capped at 64000
 * (12 pages → 36000); the separate source-authoring
 * request preflight combines it with exact call and dollar ceilings before
 * any future provider adapter can be reached.
 */
export function authoringMaxOutputTokens(pageCount: number): number {
  const pages = Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 12;
  return Math.min(64000, Math.max(32000, Math.round(pages * 3000)));
}

/** Provenance for the authoring call (recorded beside the candidate; NOT part of the frozen hash). */
export interface TemplateAuthoringProvenance {
  authoringModel: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  schemaVersion: string;
  promptVersion: string;
  /** The compiler-owned appearance role-policy version (S2a). */
  policyVersion: string;
  /** The attempt the candidate passed on: 1 = initial authoring call, 2 = after repair #1, 3 = after repair #2. */
  attempt: number;
  /** The repair-prompt version — set only when the candidate needed ≥1 repair (attempt > 1). */
  repairPromptVersion?: string;
}

/** A recorded repair attempt — persisted beside the review for human reviewability (Stage 3). */
export interface TemplateRepairAttempt {
  /** 1 = the initial authoring call; 2 = repair #1; 3 = repair #2. */
  attempt: number;
  /** The exact validator/assembly errors this attempt failed with. */
  errors: string[];
  /** The descriptive draft object this attempt failed with (nested in the reviewability sidecar). */
  draft: unknown;
}

/**
 * Thrown when the bounded repair loop is exhausted (the initial call + MAX_REPAIR_ATTEMPTS repairs were ALL invalid).
 * Extends the fail-closed error so existing `instanceof InvalidTemplateContractError` handlers still catch it, and
 * carries the attempt trail so the driver can persist it beside the review even though NO template was produced
 * (the Stage-3 contract: write nothing unless an attempt fully passes).
 */
export class TemplateRepairExhaustedError extends InvalidTemplateContractError {
  constructor(
    readonly attempts: TemplateRepairAttempt[],
    lastErrors: string[],
  ) {
    super([
      `template repair loop exhausted after ${attempts.length} attempt(s) — wrote nothing; last errors: ${lastErrors.join('; ')}`,
    ]);
    this.name = 'TemplateRepairExhaustedError';
  }
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
  /** Explicit author-owned page-0 cover authority extracted from the adjacent location-bible. */
  authoredCoverAuthority?: AuthoredCoverAuthority;
}

export interface TemplateCompileResult {
  template: BookVisualContractTemplate;
  facts: DeterministicFacts;
  /** Non-fatal notes: e.g. a draft human the extractor did not detect (dropped as non-text-verified). */
  notes: string[];
  /** The authoring call's provenance (model / reasoning / budget / schema+prompt version / attempt). */
  provenance: TemplateAuthoringProvenance;
  /** The FAILED repair attempts before the passing one (empty when the initial draft was valid). Persist beside
   *  the review for reviewability (Stage 3). */
  repairAttempts: TemplateRepairAttempt[];
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
    '- worldType, locations[] (including authored setIdentityId/setReference bindings), zones[] (with stableGeometry),',
    '- setBoardAuthorities[]: for every pending/ready set identity, author a SEPARATE stable, character-free physical',
    '  projection. Use only environmental light, fixed architecture, and props safe on every consuming page. Never',
    '  copy page action, cast/name/appearance, portable light, reveal language, or transient props into this field.',
    '  cast.child + cast.companion wardrobe,',
    '  recurringProps[] (material/scale/persistence/firstRevealPage), forbiddenGlobalElements[], coverContract, and per-page',
    '  mustShow/mustNotShow/propState/propConstraints/actionRequirements/camera/transition/zoneId/locationId.',
    '- Every actionRequirements[] entry uses ONLY the closed predicate vocabulary in the schema and includes',
    '  sourcePhrase containing exact words from that SAME page of Story Source prose. Historical imageDirection is',
    '  never action authority and cannot supply sourcePhrase. If a required source beat cannot be represented',
    '  faithfully, do not force-fit it: add it to unsupportedActionSemantics[] with reason',
    '  "closed_action_vocabulary_gap". Empty unsupportedActionSemantics[] means no vocabulary gap was found.',
    '- For each given human, draft ONLY garments (each colour an explicit value) and forbiddenAppearance. Do NOT',
    '  output appearance (skinTone/hairColour/hairTexture/hairStyle) — the compiler injects those from a role policy.',
    '',
    'Topology: describe ONE location/zone graph in zones[] (each zone has a parent locationId). Every per-page',
    'zoneId and every transition fromZoneId/toZoneId MUST be an EXACT id from that zones[] list. A zone change',
    'between consecutive pages must be carried by a transition; before_transition renders in the ORIGIN zone,',
    'after_transition in the DESTINATION, threshold at either endpoint. Do not restate zones with new ids.',
    '',
    'You MUST NOT output: a human\'s gender, pagesPresent, textEvidence, or aliases; page castIds or characterPresence;',
    'or any laterality (injectionArm/bandageArm/freeHand). Those are supplied by the deterministic extractor. Do not',
    'invent a human who is not in the given facts.',
    '',
    'Historical imageDirection is ADVISORY evidence only. It may help preserve visual action, interaction, expression,',
    'camera, composition, or staging. It MUST NOT select or change worldType, location, zone, set topology, cast,',
    'wardrobe, props, reveal timing, action authority, or forbidden content. Story prose and authored page-0 authority win every',
    'conflict. A later source-prompt reconciliation review records preserved or intentionally superseded direction.',
    '',
    'Output ONLY the JSON object, no prose, no markdown fences.',
  ].join('\n');
}

export function buildTemplateCompileUserPrompt(input: TemplateCompileInput, facts: DeterministicFacts): string {
  const humanLines = facts.humans.map(
    (h) =>
      `- ${h.id} (role=${h.role}, gender=${h.gender}); present on pages [${h.pagesPresent.join(', ')}]; draft ONLY garments/forbiddenAppearance for this person.`,
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
    ...(input.authoredCoverAuthority
      ? [
          '',
          'AUTHORED PAGE-0 COVER AUTHORITY (compiler-owned; the draft cannot override it):',
          JSON.stringify(input.authoredCoverAuthority),
        ]
      : []),
    '',
    'Produce a JSON BookVisualContractTemplate DRAFT (descriptive fields only) with keys: worldType, locations[],',
    'zones[], setBoardAuthorities[{setIdentityId,locations[],areas[],fixedObjects[]}],',
    'cast{child,companion?}, humanCast[{id, garments, forbiddenAppearance}],',
    'recurringProps[{id,name,description,material?,scale?,persistence?,firstRevealPage?}],',
    'forbiddenGlobalElements[], coverContract{worldType,locationId,zoneId,castIds,timeOfDay,mustShow,mustNotShow},',
    'pageContracts[{pageNumber, locationId, zoneId, sameLocationAs?,',
    'mustShow[], mustNotShow[], propState[], propConstraints[{propId,visibility,stateId?,anchorId?}], camera, transition}].',
    'Each page also requires actionRequirements[{checkId,actorId,predicate,object?,polarity,laterality?,sourcePhrase}]',
    'and unsupportedActionSemantics[{sourcePhrase,reason}] arrays. sourcePhrase must quote exact same-page Story',
    'Source prose; never quote or derive action authority from imageDirection.',
    '',
    'FULL STORY TEXT:',
    // Build the page-marked story text from input.pages — the SAME field assertSourceHasRealProse validated — so
    // the LLM reads exactly the guarded prose. A source whose independent fullStoryText was empty/markers-only can
    // therefore never smuggle emptiness past the pages guard into the authoring call.
    input.pages
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
      .join('\n\n'),
    '',
    'HISTORICAL IMAGE DIRECTIONS (OPTIONAL, ADVISORY PRESENTATION EVIDENCE ONLY):',
    ...(input.pageImageDirections ?? [])
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((candidate) => `--- Page ${candidate.pageNumber} ---\n${candidate.imageDirection}`),
  ].join('\n');
}

// ── Repair prompt (Stage 3 — bounded semantic repair of the DESCRIPTIVE draft) ─

export function buildTemplateRepairSystemPrompt(): string {
  return [
    "You are REPAIRING an INVALID descriptive draft for a children's-book visual-continuity contract.",
    'You will be given the previous draft, the EXACT validator errors it failed, and the authoritative facts.',
    'Return the COMPLETE corrected JSON draft (SAME schema as before) — fix ONLY what the errors require; keep',
    'everything else identical.',
    '',
    'You MAY edit ONLY these DESCRIPTIVE fields:',
    '- worldType (the semantic world type)',
    '- locations[] (name/description/lighting/timeOfDay/environmentClass/anchors/topology/setIdentityId/setReference)',
    '- setBoardAuthorities[] stable location light, fixed physical nodes/relations, and fixed objects only; never',
    '  cast, page action/staging, portable light, reveal language, or props unsafe on any consuming page',
    '- zones[] (name/description/stableGeometry — a present stableGeometry must be a NON-EMPTY string[])',
    '- cast.child/cast.companion wardrobe; each human\'s garments (each colour an explicit value) + forbiddenAppearance',
    '- recurringProps[] (name/description, material/scale/persistence, and firstRevealPage — NO empty string in a field you include)',
    '- forbiddenGlobalElements[]; coverContract mustShow/mustNotShow/locationId/zoneId/castIds/timeOfDay',
    '- pageContracts[] mustShow/mustNotShow/propState/propConstraints/actionRequirements/',
    '  unsupportedActionSemantics/camera and the transition kind/cue',
    '',
    'You MUST NOT change these (they are COMPILER-owned or FACT-derived; your edits to them are IGNORED and',
    'overwritten, so changing them only wastes the repair):',
    '- any human appearance (skinTone/hairColour/hairTexture/hairStyle) — injected from a role policy',
    '- any human gender/pagesPresent/textEvidence/aliases; page castIds/characterPresence; any laterality',
    '- cast identity/ids; location + zone IDs and their references (the compiler canonicalizes them)',
    '- coverContract.worldType (the compiler copies it from the top-level worldType)',
    '',
    'Output ONLY the corrected JSON object, no prose, no markdown fences.',
  ].join('\n');
}

export function buildTemplateRepairUserPrompt(
  previousDraft: Record<string, unknown>,
  errors: string[],
  facts: DeterministicFacts,
  input: TemplateCompileInput,
): string {
  return [
    `storyKey: ${input.storyKey}  pageCount: ${input.pageCount}`,
    '',
    'The previous draft FAILED validation with these EXACT errors — fix EACH one (and change nothing else):',
    ...errors.map((e, i) => `${i + 1}. ${e}`),
    '',
    'AUTHORITATIVE FACTS (do NOT restate gender/presence/laterality — they are overlaid after you):',
    ...facts.humans.map((h) => `- ${h.id} (role=${h.role}, gender=${h.gender}); present on pages [${h.pagesPresent.join(', ')}]`),
    ...(input.authoredCoverAuthority
      ? [
          '',
          'AUTHORED PAGE-0 COVER AUTHORITY (compiler-owned; keep the zone vocabulary mappable):',
          JSON.stringify(input.authoredCoverAuthority),
        ]
      : []),
    '',
    'PREVIOUS (INVALID) DRAFT — return a corrected COMPLETE version of this exact JSON object:',
    'Historical imageDirection remains ADVISORY only for action, interaction, expression, camera, composition, and',
    'staging. It cannot alter world/location/zone/cast/wardrobe/props/reveal timing/forbidden content; story prose and',
    'authored page-0 authority win conflicts. It is not action authority and cannot be used as sourcePhrase.',
    '',
    JSON.stringify(previousDraft),
  ].join('\n');
}

// ── Assembly ─────────────────────────────────────────────────────────────────

function asObj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

/** Format a real evidence phrase into the textEvidence string (never fabricated — a real page + phrase). */
function formatEvidence(h: HumanFact): string {
  if (!h.genderEvidence) return `role ${h.role} (gender ${h.gender}; evidence not localized)`;
  return `עמוד ${h.genderEvidence.page}: "${h.genderEvidence.phrase}"`;
}

// ── S2a: compiler-owned appearance injection (closed, versioned role policy) ──
// The LLM no longer authors appearance modes/origins/values. The compiler injects the binding SKELETON by role:
// relatives → family_profile (UNRESOLVED, no value); known non-relatives → deterministic_palette (UNRESOLVED,
// canonical paletteId = the cast id, which is also the palette selection key — never a fabricated string);
// hairStyle → an explicit policy value + policy_default origin. An UNKNOWN role FAILS (never auto-classified).
const FAMILY_PROFILE_ROLES = new Set(['mother', 'father', 'parent', 'sibling', 'grandparent']);
const APPEARANCE_POLICY_VERSION = 'role-policy/v1';
const HAIR_STYLE_POLICY: Record<string, { value: string; policyId: string }> = {
  mother: { value: 'medium-length, worn loose in a simple everyday style', policyId: 'mother-hair-style' },
  father: { value: 'short, tidy everyday cut', policyId: 'father-hair-style' },
  parent: { value: 'medium-length, worn in a simple everyday style', policyId: 'parent-hair-style' },
  sibling: { value: 'a simple age-appropriate everyday style', policyId: 'sibling-hair-style' },
  grandparent: { value: 'short, neatly kept', policyId: 'grandparent-hair-style' },
  doctor: { value: 'short, neatly combed, side part', policyId: 'doctor-hair-style' },
  nurse: { value: 'neat, tied back for work', policyId: 'nurse-hair-style' },
  teacher: { value: 'neat, simple everyday style', policyId: 'teacher-hair-style' },
};

/** Inject the appearance binding skeleton for a human's role. Throws (fail-closed) for an unknown role. */
export function injectAppearance(role: string, humanId: string): HumanAppearanceTraits<TemplateTraitBinding> {
  const hair = HAIR_STYLE_POLICY[role];
  if (!hair) {
    throw new InvalidTemplateContractError([
      `humanCast "${humanId}" role "${role}" has no appearance policy — a role that is neither a known relative nor a known non-relative must be authored by a human (never auto-classified).`,
    ]);
  }
  const skinHair = (): TemplateTraitBinding =>
    FAMILY_PROFILE_ROLES.has(role)
      ? { mode: 'family_profile', origin: { kind: 'family_profile' } }
      : { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: humanId, version: PALETTE_VERSION } };
  return {
    skinTone: skinHair(),
    hairColour: skinHair(),
    hairTexture: skinHair(),
    hairStyle: { mode: 'explicit', value: hair.value, origin: { kind: 'policy_default', policyId: hair.policyId, version: 'v1' } },
  };
}

/** Merge the deterministic identity facts (win) with the compiler-injected appearance + the draft's garments. */
function mergeHuman(fact: HumanFact, draftHuman: Record<string, unknown>): TemplateHumanCastMember {
  return {
    id: fact.id,
    role: fact.role,
    gender: fact.gender,
    // Identity is DETERMINISTIC: aliases come from the extractor, NEVER the draft. Appearance modes/origins are
    // COMPILER-owned (injected by role from the closed policy — the LLM does not author them). Only garments and
    // forbiddenAppearance are descriptive draft fields.
    aliases: fact.aliasesFound,
    textEvidence: formatEvidence(fact),
    pagesPresent: fact.pagesPresent,
    appearance: injectAppearance(fact.role, fact.id),
    garments: (draftHuman.garments as TemplateHumanCastMember['garments']) ?? [],
    forbiddenAppearance: asArr(draftHuman.forbiddenAppearance).filter((a): a is string => typeof a === 'string'),
  };
}

function normalizeActionEvidence(value: string): string {
  return stripNiqqud(value)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Action authority is descriptive but must remain source-grounded. The
 * evidence-only `sourcePhrase` and unsupported-semantics records belong to the
 * authoring draft/repair surface, not the candidate contract.
 */
function sourceGroundPageActions(
  pageDraft: Record<string, unknown>,
  sourcePages: TemplateCompileInput['pages'],
): Record<string, unknown> {
  const pageNumber =
    typeof pageDraft.pageNumber === 'number'
      ? pageDraft.pageNumber
      : -1;
  const sourcePage = sourcePages.find(
    (candidate) => candidate.pageNumber === pageNumber,
  );
  const sourceText = normalizeActionEvidence(sourcePage?.text ?? '');
  const evidenceIssues: string[] = [];
  const assertPhrase = (
    rawPhrase: unknown,
    label: string,
  ): string | null => {
    if (typeof rawPhrase !== 'string') {
      evidenceIssues.push(
        `action_source_evidence_missing: ${label}.sourcePhrase must quote exact same-page Story Source prose`,
      );
      return null;
    }
    const phrase = normalizeActionEvidence(rawPhrase);
    if (!phrase || !sourceText.includes(phrase)) {
      evidenceIssues.push(
        `action_source_evidence_missing: ${label}.sourcePhrase does not occur in Story Source page ${pageNumber}`,
      );
      return null;
    }
    return rawPhrase;
  };

  const unsupported = asArr(
    pageDraft.unsupportedActionSemantics,
  );
  for (let index = 0; index < unsupported.length; index += 1) {
    const record = asObj(unsupported[index]);
    assertPhrase(
      record.sourcePhrase,
      `page ${pageNumber}.unsupportedActionSemantics[${index}]`,
    );
    if (
      record.reason !== 'closed_action_vocabulary_gap'
    ) {
      evidenceIssues.push(
        `unsupported_action_semantic: page ${pageNumber}.unsupportedActionSemantics[${index}].reason must be closed_action_vocabulary_gap`,
      );
    }
  }
  if (evidenceIssues.length > 0) {
    throw new InvalidTemplateContractError(evidenceIssues);
  }
  if (unsupported.length > 0) {
    throw new InvalidTemplateContractError([
      `unsupported_action_semantic: page ${pageNumber} contains ${unsupported.length} Story Source beat(s) that the closed action vocabulary cannot faithfully represent`,
    ]);
  }

  const out = { ...pageDraft };
  if (pageDraft.actionRequirements !== undefined) {
    out.actionRequirements = asArr(
      pageDraft.actionRequirements,
    ).map((raw, index) => {
      const action = { ...asObj(raw) };
      assertPhrase(
        action.sourcePhrase,
        `page ${pageNumber}.actionRequirements[${index}]`,
      );
      delete action.sourcePhrase;
      if (action.object === null) delete action.object;
      if (action.laterality === null) delete action.laterality;
      return action;
    });
  }
  delete out.unsupportedActionSemantics;
  if (evidenceIssues.length > 0) {
    throw new InvalidTemplateContractError(evidenceIssues);
  }
  return out;
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
  const propConstraints = asArr(pc.propConstraints).map((raw) => {
    const constraint = { ...asObj(raw) };
    if (constraint.stateId === null) delete constraint.stateId;
    if (constraint.anchorId === null) delete constraint.anchorId;
    return constraint;
  });
  if (propConstraints.length > 0) out.propConstraints = propConstraints;
  else delete out.propConstraints;
  if (rebuilt.length > 0) out.castStates = rebuilt;
  else delete out.castStates; // omit rather than emit [] (Slice B fail-closed rule)
  return out;
}

// ── Topology canonicalization (S2b) ───────────────────────────────────────────
// The compiler OWNS location/zone IDs + all page/transition references. The LLM describes ONE semantic
// location/zone graph (zones[] each with a parent locationId); the compiler then rewrites every page's
// zoneId + locationId + each transition's from/to against THAT graph. A reference resolves to EXACTLY one
// canonical zone (exact id, else a single normalized match) or the compile FAILS CLOSED (→ Stage-3 repair) —
// it NEVER guesses a page's location. Deriving each page's locationId from its resolved zone makes zone-
// membership hold by construction (kills the "per-page zoneId ∉ its location's zones" fox failure). The
// transition KIND/cue stays LLM-authored (narrative); a genuine continuity violation is left for the
// fail-closed validator to reject → repair (canonicalization fixes IDENTIFIERS, never invents intent).

interface CanonicalZone {
  id: string;
  locationId: string;
}

/** Casefold + collapse non-alphanumeric runs, so separator/case drift ("Clinic.ExamRoom" ~ "clinic_exam_room")
 *  still resolves — WITHOUT guessing across genuinely-distinct ids (two ids sharing a normalized form resolve to
 *  >1 candidate → ambiguous → repair, never a coin-flip). */
function normalizeTopoId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

interface ZoneGraph {
  exact: Map<string, CanonicalZone>;
  byNorm: Map<string, CanonicalZone[]>;
}

/** Build the canonical zone graph from the drafted locations[] + zones[]. The graph is the SINGLE source of
 *  truth for where a page sits; a malformed graph (zone with no/unknown parent location, duplicate zone id)
 *  FAILS CLOSED here (→ repair) so downstream derivation can never produce an invalid location. */
function buildZoneGraph(draft: Record<string, unknown>): ZoneGraph {
  const locationIds = new Set(
    asArr(draft.locations)
      .map((l) => asObj(l).id)
      .filter(isStr),
  );
  const exact = new Map<string, CanonicalZone>();
  const byNorm = new Map<string, CanonicalZone[]>();
  for (const raw of asArr(draft.zones)) {
    const z = asObj(raw);
    if (!isStr(z.id) || !isStr(z.locationId)) {
      throw new InvalidTemplateContractError(['a zone is missing id/locationId — the semantic zone graph is malformed (repair).']);
    }
    if (!locationIds.has(z.locationId)) {
      throw new InvalidTemplateContractError([`zone "${z.id}" references unknown locationId "${z.locationId}" — the semantic zone graph is malformed (repair).`]);
    }
    if (exact.has(z.id)) {
      throw new InvalidTemplateContractError([`duplicate zone id "${z.id}" in the graph (repair).`]);
    }
    const cz: CanonicalZone = { id: z.id, locationId: z.locationId };
    exact.set(cz.id, cz);
    const norm = normalizeTopoId(cz.id);
    const bucket = byNorm.get(norm);
    if (bucket) bucket.push(cz);
    else byNorm.set(norm, [cz]);
  }
  if (exact.size === 0) {
    throw new InvalidTemplateContractError(['the zone graph is empty — the LLM must describe at least one zone (repair).']);
  }
  return { exact, byNorm };
}

/** Resolve a page/transition zone REFERENCE to exactly one canonical zone, or throw (→ repair). Exact id wins;
 *  otherwise a single normalized match; 0 or >1 candidates is unresolved/ambiguous — never guessed. */
function resolveZoneRef(ref: string, graph: ZoneGraph, label: string): CanonicalZone {
  const exact = graph.exact.get(ref);
  if (exact) return exact;
  const candidates = graph.byNorm.get(normalizeTopoId(ref)) ?? [];
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    throw new InvalidTemplateContractError([`${label} references zone "${ref}" which is not a declared zone — canonicalize the id or repair (no guess).`]);
  }
  throw new InvalidTemplateContractError([
    `${label} reference "${ref}" is ambiguous — it matches ${candidates.length} declared zones (${candidates.map((c) => c.id).join(', ')}); repair (no guess).`,
  ]);
}

/**
 * Canonicalize the draft's page topology against the zone graph. For each page: resolve zoneId → canonical zone,
 * DERIVE locationId from that zone (membership holds by construction), and rewrite any present transition
 * from/to reference. Absent transition refs are left for the validator (its message is precise). Returns the
 * rewritten page objects + review notes for every id the compiler had to canonicalize/override.
 */
function canonicalizeTopology(
  draft: Record<string, unknown>,
  authoredCoverAuthority?: AuthoredCoverAuthority,
): {
  pages: Record<string, unknown>[];
  cover: Record<string, unknown>;
  notes: string[];
} {
  const graph = buildZoneGraph(draft);
  const notes: string[] = [];
  const pages = asArr(draft.pageContracts).map((raw) => {
    const pc: Record<string, unknown> = { ...asObj(raw) };
    const label = typeof pc.pageNumber === 'number' ? `page ${pc.pageNumber}` : 'a page';
    if (!isStr(pc.zoneId) || !pc.zoneId.trim()) {
      throw new InvalidTemplateContractError([`${label} has no zoneId — it cannot be placed in the zone graph (repair).`]);
    }
    const zone = resolveZoneRef(pc.zoneId, graph, label);
    if (pc.zoneId !== zone.id) notes.push(`${label} zoneId "${pc.zoneId}" canonicalized to "${zone.id}"`);
    if (isStr(pc.locationId) && pc.locationId !== zone.locationId) {
      notes.push(`${label} locationId "${pc.locationId}" overridden to "${zone.locationId}" (derived from zone "${zone.id}")`);
    }
    pc.zoneId = zone.id;
    pc.locationId = zone.locationId; // location is DERIVED from the zone graph — never guessed.

    const t = asObj(pc.transition);
    if (Object.keys(t).length > 0) {
      const t2: Record<string, unknown> = { ...t };
      if (isStr(t.fromZoneId)) t2.fromZoneId = resolveZoneRef(t.fromZoneId, graph, `${label}.transition.fromZoneId`).id;
      if (isStr(t.toZoneId)) t2.toZoneId = resolveZoneRef(t.toZoneId, graph, `${label}.transition.toZoneId`).id;
      pc.transition = t2;
    }
    return pc;
  });
  let cover: Record<string, unknown> = { ...asObj(draft.coverContract) };
  if (authoredCoverAuthority) {
    try {
      const applied = applyAuthoredCoverAuthority({
        cover,
        zones: [...graph.exact.values()],
        authority: authoredCoverAuthority,
      });
      cover = applied.cover;
      notes.push(...applied.notes);
      if (cover.timeOfDay === null) delete cover.timeOfDay;
      return { pages, cover, notes };
    } catch (error) {
      if (error instanceof AuthoredCoverAuthorityError) {
        throw new InvalidTemplateContractError(
          error.issues.map((candidate) => `${candidate.code}: ${candidate.message}`),
        );
      }
      throw error;
    }
  }
  let authoredCoverZoneId = isStr(cover.zoneId) && cover.zoneId.trim() ? cover.zoneId : null;
  if (!authoredCoverZoneId) {
    // Offline candidate-upgrade compatibility: old reviewed drafts predate explicit cover zones. Propose the first
    // authored page's zone only when it is inside the already-authored cover location; otherwise a sole zone in that
    // location is unambiguous. This is compiler-time authoring (still subject to human review), never runtime inference.
    const coverLocationId = isStr(cover.locationId) ? cover.locationId : null;
    const firstPageInCoverLocation = [...pages]
      .filter((page) => page.locationId === coverLocationId && isStr(page.zoneId))
      .sort((a, b) => Number(a.pageNumber ?? 0) - Number(b.pageNumber ?? 0))[0];
    const locationZones = [...graph.exact.values()].filter((zone) => zone.locationId === coverLocationId);
    authoredCoverZoneId = isStr(firstPageInCoverLocation?.zoneId)
      ? firstPageInCoverLocation.zoneId
      : locationZones.length === 1
        ? locationZones[0].id
        : null;
    if (!authoredCoverZoneId) {
      throw new InvalidTemplateContractError([
        'coverContract has no zoneId and no unambiguous compiler-time proposal exists (repair).',
      ]);
    }
    notes.push(`coverContract zoneId proposed as "${authoredCoverZoneId}" from its authored location/page graph`);
  }
  const coverZone = resolveZoneRef(authoredCoverZoneId, graph, 'coverContract');
  if (isStr(cover.zoneId) && cover.zoneId !== coverZone.id) {
    notes.push(`coverContract zoneId "${cover.zoneId}" canonicalized to "${coverZone.id}"`);
  }
  if (isStr(cover.locationId) && cover.locationId !== coverZone.locationId) {
    notes.push(
      `coverContract locationId "${cover.locationId}" overridden to "${coverZone.locationId}" ` +
        `(derived from zone "${coverZone.id}")`,
    );
  }
  cover.zoneId = coverZone.id;
  cover.locationId = coverZone.locationId;
  if (cover.timeOfDay === null) delete cover.timeOfDay;
  return { pages, cover, notes };
}

/** Strict structured output uses null for optional fields; contracts use omission so validation stays exact. */
function normalizeDraftLocations(raw: unknown): BookVisualContractTemplate['locations'] {
  return asArr(raw).map((value) => {
    const location = { ...asObj(value) };
    if (location.timeOfDay === null) delete location.timeOfDay;
    if (location.topology === null) delete location.topology;
    if (location.setIdentityId === null) delete location.setIdentityId;
    if (location.setReference === null) {
      delete location.setReference;
    } else if (location.setReference !== undefined) {
      const setReference = { ...asObj(location.setReference) };
      for (const field of ['url', 'storageKey', 'prompt']) {
        if (setReference[field] === null) delete setReference[field];
      }
      location.setReference = setReference;
    }
    return location;
  }) as unknown as BookVisualContractTemplate['locations'];
}

function normalizeDraftProps(raw: unknown): BookVisualContractTemplate['recurringProps'] {
  return asArr(raw).map((value) => {
    const prop = { ...asObj(value) };
    for (const field of ['material', 'scale', 'persistence', 'firstRevealPage']) {
      if (prop[field] === null) delete prop[field];
    }
    return prop;
  }) as unknown as BookVisualContractTemplate['recurringProps'];
}

function normalizeDraftSetBoardAuthorities(
  raw: unknown,
): BookVisualContractTemplate['setBoardAuthorities'] {
  const authorities = asArr(raw).map((rawAuthority) => {
    const authority = { ...asObj(rawAuthority) };
    authority.areas = asArr(authority.areas).map((rawArea) => {
      const area = { ...asObj(rawArea) };
      area.spatialNodes = asArr(area.spatialNodes).map((rawNode) => {
        const node = { ...asObj(rawNode) };
        if (node.propId === null) delete node.propId;
        return node;
      });
      const relations = asArr(area.spatialRelations).map((rawRelation) => {
        const relation = { ...asObj(rawRelation) };
        if (relation.objectId === null) delete relation.objectId;
        return relation;
      });
      if (relations.length > 0) area.spatialRelations = relations;
      else delete area.spatialRelations;
      return area;
    });
    authority.fixedObjects = asArr(authority.fixedObjects).map((rawObject) => {
      const fixedObject = { ...asObj(rawObject) };
      for (const field of ['material', 'scale']) {
        if (fixedObject[field] === null) delete fixedObject[field];
      }
      return fixedObject;
    });
    return authority;
  });
  return authorities.length > 0
    ? authorities as unknown as BookVisualContractTemplate['setBoardAuthorities']
    : undefined;
}

/**
 * Assemble ONE template CANDIDATE from a single descriptive draft: authoritative cast + compiler-owned
 * appearance/topology/worldType, the fact overlay LAST, then the structural cast invariant + the full fail-closed
 * validator. PURE (no LLM). Throws InvalidTemplateContractError on ANY problem — the caller's bounded repair loop
 * catches that and re-drafts. Returns the valid template + review notes.
 */
function assembleTemplateFromDraft(
  draft: Record<string, unknown>,
  facts: DeterministicFacts,
  input: TemplateCompileInput,
  authoringModel: string,
): { template: BookVisualContractTemplate; notes: string[] } {
  const notes: string[] = [];

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
    return mergeHuman(h, match);
  });
  // Flag any drafted human the extractor did NOT detect (dropped — the LLM cannot add cast the text doesn't support).
  for (const d of draftHumans) {
    const id = typeof d.id === 'string' ? d.id : '';
    if (id && !facts.humans.some((h) => h.id === id)) {
      notes.push(`draft human "${id}" not detected in the text — dropped (extractor is authoritative for cast)`);
    }
  }

  // Topology: canonicalize IDs + rewrite page/transition refs against the ONE zone graph (compiler-owned),
  // then overlay the fact-derived cast/presence LAST. Ambiguity/unresolved refs throw → repair.
  const { pages: canonicalPages, cover: canonicalCover, notes: topoNotes } = canonicalizeTopology(
    draft,
    input.authoredCoverAuthority,
  );
  notes.push(...topoNotes);
  const pageContracts = canonicalPages.map((pc) =>
    overlayPage(
      sourceGroundPageActions(pc, input.pages),
      facts,
      childId,
      companionId,
    ),
  );
  if (!Array.isArray(canonicalCover.castIds) || canonicalCover.castIds.length === 0) {
    const firstPage = [...pageContracts].sort(
      (a, b) => Number(a.pageNumber ?? 0) - Number(b.pageNumber ?? 0),
    )[0];
    const proposedCastIds = asArr(firstPage?.castIds).filter(isStr);
    canonicalCover.castIds = proposedCastIds.length > 0 ? proposedCastIds : [childId];
    notes.push('coverContract castIds proposed from the fact-authoritative first page for human review');
  }

  // worldType is LLM+human (semantic) — NO silent 'unspecified' default; a missing value fails (fail-closed →
  // repair). coverContract.worldType is COMPILER-owned: copied from the finalized top-level worldType.
  const worldType =
    (typeof draft.worldType === 'string' && draft.worldType.trim() ? draft.worldType.trim() : input.worldType?.trim()) ?? '';
  if (!worldType) {
    throw new InvalidTemplateContractError(['worldType is missing — the semantic world type must be set (no silent default); author or repair it.']);
  }

  const setBoardAuthorities = normalizeDraftSetBoardAuthorities(draft.setBoardAuthorities);
  const template: BookVisualContractTemplate = {
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    version: 1,
    storyKey: input.storyKey,
    worldType,
    locations: normalizeDraftLocations(draft.locations),
    zones: draft.zones as BookVisualContractTemplate['zones'],
    ...(setBoardAuthorities ? { setBoardAuthorities } : {}),
    cast: authoritativeCast as unknown as BookVisualContractTemplate['cast'],
    humanCast,
    recurringProps: normalizeDraftProps(draft.recurringProps),
    forbiddenGlobalElements: asArr(draft.forbiddenGlobalElements).filter((x): x is string => typeof x === 'string'),
    coverContract: { ...canonicalCover, worldType } as unknown as BookVisualContractTemplate['coverContract'],
    pageContracts: pageContracts as unknown as BookVisualContractTemplate['pageContracts'],
    provenance: { source: 'llm', model: authoringModel, compiledFromPages: input.pageCount },
  };

  // Prop lifecycle is compiler-owned authority, just like cover worldType. An authored page-0 source can replace
  // stale draft prohibitions, so append the exact structured lifecycle projection after topology/source overlay.
  // This keeps cover containment complete without asking prose to duplicate structured data.
  template.coverContract.mustNotShow = [
    ...new Set([
      ...template.coverContract.mustNotShow,
      ...projectCoverMustNotShow(template as unknown as BookVisualContract),
    ]),
  ];

  // coverContract.worldType is a COMPILER-owned copy of the top-level worldType — enforce the equality invariant.
  if ((template.coverContract as { worldType?: unknown }).worldType !== template.worldType) {
    throw new InvalidTemplateContractError([
      `coverContract.worldType "${String((template.coverContract as { worldType?: unknown }).worldType)}" != top-level worldType "${template.worldType}"`,
    ]);
  }

  if (input.authoredCoverAuthority) {
    const sourceIssues = coverSourceFidelityIssues(template, input.authoredCoverAuthority);
    if (sourceIssues.length > 0) {
      throw new InvalidTemplateContractError(
        sourceIssues.map((candidate) => `${candidate.code}: ${candidate.message}`),
      );
    }
  }

  // STRUCTURAL INVARIANT (fail-closed): every cast identity + presence must match the input/facts EXACTLY, so a
  // future refactor that lets draft.cast leak into identity/presence throws here instead of shipping.
  assertCastIsFactAuthoritative(template, facts, input);

  // (Stage 4) FAIL-CLOSED source-evidence check: a hazard that CITES a story quote must actually be quoting that
  // page. Only the compiler holds the source pages, so this cannot live in the validators. An unchecked citation is
  // the same hallucination surface assertSourceHasRealProse closes — an invented-but-consistent claim passes every
  // structural check. Errors are thrown as InvalidTemplateContractError so the bounded repair loop consumes them
  // exactly like validator errors.
  const evidenceErrors = sourceEvidenceErrors(template as unknown as BookVisualContract, input.pages);
  if (evidenceErrors.length > 0) throw new InvalidTemplateContractError(evidenceErrors);

  // FAIL-CLOSED — never return an invalid candidate.
  assertValidBookVisualContractTemplate(template);
  return { template, notes };
}

/**
 * Compile a template CANDIDATE from a story source. Deterministic facts are extracted first and overlaid last; the
 * LLM (injected) drafts descriptive fields only.
 *
 * Stage 3 — BOUNDED REPAIR LOOP: at most MAX_REPAIR_ATTEMPTS semantic repairs AFTER the initial authoring call.
 * Each attempt (re)assembles from the current draft → reapplies compiler policy → overlays facts LAST →
 * assertCastIsFactAuthoritative → the full validator; on any failure it hands the LLM the invalid DESCRIPTIVE
 * draft + the EXACT errors + the authoritative facts and asks for a corrected draft (compiler-owned + fact fields
 * are re-derived, so LLM edits to them are ignored). Fail-closed: returns NOTHING unless an attempt fully passes;
 * on exhaustion it throws TemplateRepairExhaustedError carrying the whole attempt trail (write nothing).
 */
export async function compileBookVisualContractTemplate(
  input: TemplateCompileInput,
  deps: { callLLM: ContractLlmCaller },
): Promise<TemplateCompileResult> {
  // FAIL-CLOSED belt-and-suspenders: NEVER author a contract from empty/thin source. Even if a bad source somehow
  // reaches the compiler (the extractor guard is the first line), refuse before the LLM call so it cannot hallucinate
  // a fully-valid contract out of nothing.
  assertSourceHasRealProse(input.storyKey, input.pages, 'compile-vc-template');

  const facts = extractDeterministicFacts(input);

  // Dedicated authoring call: real reasoning model + strict structured output + a budget scaled to the page count,
  // with NO silent model fallback. The SAME options are reused for every repair call.
  const authoringModel = resolveAuthoringModel();
  const maxOutputTokens = authoringMaxOutputTokens(input.pageCount);
  const llmOpts = {
    maxOutputTokens,
    model: authoringModel,
    reasoningEffort: AUTHORING_REASONING_EFFORT,
    jsonSchema: { name: TEMPLATE_DRAFT_SCHEMA_NAME, schema: TEMPLATE_DRAFT_JSON_SCHEMA },
    noFallback: VISUAL_CONTRACT_AUTHORING_NO_FALLBACK,
    provider: VISUAL_CONTRACT_AUTHORING_PROVIDER,
    endpoint: VISUAL_CONTRACT_AUTHORING_ENDPOINT,
    serviceTier: VISUAL_CONTRACT_AUTHORING_SERVICE_TIER,
    toolsDisabled: VISUAL_CONTRACT_AUTHORING_TOOLS_DISABLED,
    transportRetries:
      VISUAL_CONTRACT_AUTHORING_TRANSPORT_RETRIES,
    timeoutMs: VISUAL_CONTRACT_AUTHORING_TIMEOUT_MS,
    maxInputTokens:
      VISUAL_CONTRACT_AUTHORING_MAX_INPUT_TOKENS,
  } satisfies ContractLlmCallOptions;

  let draft = asObj(
    parseContractJson(await deps.callLLM(buildTemplateCompileSystemPrompt(), buildTemplateCompileUserPrompt(input, facts), llmOpts)),
  );

  const repairAttempts: TemplateRepairAttempt[] = [];
  for (let attempt = 1; ; attempt++) {
    let assembled: { template: BookVisualContractTemplate; notes: string[] } | null = null;
    let attemptErrors: string[] = [];
    try {
      assembled = assembleTemplateFromDraft(draft, facts, input, authoringModel);
    } catch (err) {
      if (!(err instanceof InvalidTemplateContractError)) throw err; // a non-validation failure is not repairable
      attemptErrors = err.errors;
    }

    if (assembled) {
      const provenance: TemplateAuthoringProvenance = {
        authoringModel,
        reasoningEffort: AUTHORING_REASONING_EFFORT,
        maxOutputTokens,
        schemaVersion: TEMPLATE_DRAFT_SCHEMA_VERSION,
        promptVersion: TEMPLATE_PROMPT_VERSION,
        policyVersion: APPEARANCE_POLICY_VERSION,
        attempt,
        ...(attempt > 1 ? { repairPromptVersion: REPAIR_PROMPT_VERSION } : {}),
      };
      return { template: assembled.template, facts, notes: assembled.notes, provenance, repairAttempts };
    }

    // This attempt's draft was invalid — record it (raw draft + exact errors) for reviewability.
    repairAttempts.push({ attempt, errors: attemptErrors, draft });

    if (attempt > MAX_REPAIR_ATTEMPTS) {
      // Initial + MAX_REPAIR_ATTEMPTS repairs all failed — fail closed, write nothing, carry the trail.
      throw new TemplateRepairExhaustedError(repairAttempts, attemptErrors);
    }

    // Request a bounded SEMANTIC repair: fix ONLY the descriptive draft against the exact errors (same model, no
    // fallback). Compiler-owned + fact fields are re-derived on the next assemble, so LLM edits to them are ignored.
    // If the repair call itself can't be turned into a usable draft (model error, or truncated/unparseable JSON),
    // we cannot continue — surface it as an exhaustion so the accumulated attempt trail is STILL persisted (never
    // silently lost), rather than letting the raw parse/model error escape and drop the trail.
    try {
      draft = asObj(
        parseContractJson(
          await deps.callLLM(buildTemplateRepairSystemPrompt(), buildTemplateRepairUserPrompt(draft, attemptErrors, facts, input), llmOpts),
        ),
      );
    } catch (err) {
      throw new TemplateRepairExhaustedError(repairAttempts, [
        `repair #${attempt} could not be produced (model error or unparseable/truncated JSON): ${(err as Error).message}`,
      ]);
    }
  }
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
