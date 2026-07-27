/**
 * compileBookVisualContract — derive a BookVisualContract from the FULL story text via one LLM pass,
 * then validate it FAIL-CLOSED. The contract is built from the whole story (never "learned from page
 * 1") so a single bad page can't poison the book.
 *
 * Phase 1A: produces the typed contract only. No set-ref generation, no vision QA, no render. The LLM
 * caller is injectable so the compiler is verifiable without a live model.
 */
import {
  BOOK_VISUAL_CONTRACT_VERSION,
  type BookVisualContract,
} from './types';
import { InvalidVisualContractError } from './validateBookVisualContract';
import { assertValidVNextVisualContract } from './validateVNextVisualContract';
import { normalizeRawBookVisualContract } from './normalizeRawContract';

/** Per-call authoring overrides (all optional — omit for the prior support-default behavior). */
export interface ContractLlmCallOptions {
  /** Output token budget for this call (the template compiler scales it by page count). */
  maxOutputTokens?: number;
  /** Force a dedicated authoring model (bypasses the stage default). */
  model?: string;
  /** Reasoning effort ('low' | 'medium' | 'high'). */
  reasoningEffort?: string;
  /** Strict structured-output JSON Schema for the response. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /** Never silently fall back to another model if the requested one is unavailable — throw instead. */
  noFallback?: boolean;
  /** Lock the provider independently of global story routing. */
  provider?: 'openai';
  /** Lock the OpenAI endpoint independently of model-name heuristics. */
  endpoint?: 'responses';
  /** Standard/default processing tier; never priority/flex/batch. */
  serviceTier?: 'default';
  /** Disable provider tools explicitly. */
  toolsDisabled?: true;
  /** Per-application-call transport retry count. */
  transportRetries?: number;
  /** Per-provider-request timeout. */
  timeoutMs?: number;
  /** Deterministic preflight input-token hard ceiling. */
  maxInputTokens?: number;
}

/** Minimal LLM seam: system+user prompt (+ optional per-call overrides) in, raw model text (expected JSON) out. */
export type ContractLlmCaller = (
  system: string,
  user: string,
  opts?: ContractLlmCallOptions,
) => Promise<string>;

/** One page's authored image direction (camera/action/staging), fed alongside the text (vNext). */
export interface PageImageDirection {
  pageNumber: number;
  imageDirection: string;
}

export interface CompileBookVisualContractInput {
  storyKey?: string;
  /** The full story text (all pages concatenated) — the contract is derived from ALL of it. */
  fullStoryText: string;
  pageCount: number;
  childName?: string;
  childGender?: string;
  companion?: { id: string; name?: string } | null;
  /**
   * vNext: per-page image directions. When present, the contract derives zones/transitions/cast from BOTH
   * the text's spatial cues AND these directions (a page's imageDirection may influence camera/action —
   * never location identity, cast, wardrobe, or forbidden elements). Optional + additive: when omitted the
   * compiler prompt is byte-identical to the text-only (1A) behavior.
   */
  pageImageDirections?: PageImageDirection[];
}

/** Default caller — lazily pulls the shared pipeline LLM so the VCC module graph stays light. */
const defaultContractLlmCaller: ContractLlmCaller = async (system, user, opts) => {
  const { callLLM } = await import('@/backend/providers/pipeline');
  const res = await callLLM(system, user, opts?.maxOutputTokens ?? 4000, 0.4, 'VisualContract', true, {
    modelOverride: opts?.model,
    reasoningEffort: opts?.reasoningEffort,
    jsonSchema: opts?.jsonSchema,
    noFallback: opts?.noFallback,
    providerOverride: opts?.provider,
    endpointOverride: opts?.endpoint,
    serviceTier: opts?.serviceTier,
    toolsDisabled: opts?.toolsDisabled,
    transportRetries: opts?.transportRetries,
    timeoutMs: opts?.timeoutMs,
    maxInputTokens: opts?.maxInputTokens,
  });
  return res.text;
};

export function buildCompileSystemPrompt(): string {
  return [
    'You are a visual continuity compiler for a children\'s picture book.',
    'Read the FULL story (and the per-page image directions when provided) and output ONE structured JSON BookVisualContract — the single source of truth for the book\'s visuals.',
    '',
    'Hard rules:',
    '- LOCATIONS are real places (e.g. "playground_main", "home_living_room"). A sub-area like a gate, a corner, a waiting room or an exam room is a ZONE INSIDE a location, NEVER a new location.',
    '- Every location declares environmentClass ("indoor" | "outdoor" | "neutral"), lighting, anchors[] (stable set anchors), and topology (how its zones connect).',
    '- Every zone has a locationId pointing at its parent location.',
    '- The LOCATION/zone stays the same across pages unless the story explicitly moves the scene; same place from a new camera angle is correct.',
    '- cast.child is mandatory with a locked wardrobe; add cast.companion only if the story has one.',
    '- humanCast[] lists recurring HUMAN characters (doctor/mother/teacher/…) with a stable namespaced id (e.g. "human:doctor"), role, aliases, a gender bound to a story phrase via textEvidence, coarseAppearance, wardrobe, forbiddenAppearance, and pagesPresent.',
    '- Every page sets locationId + zoneId (both required), castIds[] (the stable cast ids present on that page), and a transition.',
    '- transition.kind is "steady" | "before_transition" | "threshold" | "after_transition"; a non-steady transition names fromZoneId + toZoneId (+ an optional cue). A before_transition page is still in the ORIGIN (the destination zone and its unique cast are NOT shown yet); the "door opens" page is the threshold; after_transition is in the destination. A page may only be in a zone once the story has transitioned into it.',
    '- forbiddenGlobalElements lists things that must NEVER appear in ANY page (e.g. animals/creatures not in the cast).',
    '',
    'AUTHORITY (important): the per-page image directions are INPUTS you use NOW, at COMPILE time, to DERIVE the zones, cast presence, and transitions. Once compiled, the FROZEN contract is authoritative at RENDER time and OUTRANKS the image direction — at render a direction may inform camera/action only and must NEVER change location identity, cast, wardrobe, or forbidden elements. So: derive from directions here; do not let camera phrasing dictate location/cast identity.',
    '',
    'Output ONLY the JSON object, no prose, no markdown fences.',
  ].join('\n');
}

export function buildCompileUserPrompt(input: CompileBookVisualContractInput): string {
  const companion = input.companion
    ? `Companion: ${input.companion.name ?? input.companion.id} (id=${input.companion.id}).`
    : 'No companion in this story.';
  // vNext: only append the image-direction section when directions are supplied, so text-only (1A) callers
  // get a byte-identical prompt (no behavior change for the existing compile path).
  const directions = (input.pageImageDirections ?? []).filter(
    (d) => d && typeof d.pageNumber === 'number' && typeof d.imageDirection === 'string' && d.imageDirection.trim().length > 0,
  );
  const imageDirectionSection =
    directions.length > 0
      ? [
          '',
          'PER-PAGE IMAGE DIRECTIONS (derive zones/transitions/cast from BOTH the story text AND these;',
          'a direction may inform camera/action/staging only — NEVER location identity, cast, wardrobe, or forbidden elements):',
          ...directions
            .slice()
            .sort((a, b) => a.pageNumber - b.pageNumber)
            .map((d) => `- page ${d.pageNumber}: ${d.imageDirection.trim()}`),
        ]
      : [];
  return [
    `storyKey: ${input.storyKey ?? '(unknown)'}`,
    `pageCount: ${input.pageCount}`,
    `child: ${input.childName ?? '(child)'}${input.childGender ? ` (${input.childGender})` : ''}`,
    companion,
    '',
    'Produce a JSON object with exactly these keys:',
    'version (number = 1), storyKey, worldType, locations[], zones[], cast{child,companion?}, humanCast[], recurringProps[], forbiddenGlobalElements[], coverContract{worldType,locationId,timeOfDay?,mustShow[],mustNotShow[]}, pageContracts[].',
    'Each pageContract: pageNumber, locationId, zoneId, castIds[], transition{kind,fromZoneId?,toZoneId?,cue?}, sameLocationAs?, mustShow[], mustNotShow[], characterPresence{child,companion}, propState[{propId,state}], camera.',
    '',
    'EXACT SHAPE (match these key names precisely):',
    '- locations[]: {"id","name","description","environmentClass":"indoor|outdoor|neutral","lighting":"...","anchors":[{"id","description"}],"topology":"..."}.',
    '- zones[]: {"id","locationId","name","description"} — id is namespaced by its location (e.g. "clinic.exam_room").',
    '- cast.child and cast.companion: {"id","role","name","wardrobe":{"description":"...","forbidden":["..."]}} — wardrobe is an OBJECT with a "description" string, NOT a bare string.',
    '- humanCast[]: {"id":"human:role","role":"...","aliases":["..."],"gender":"male|female|unspecified","coarseAppearance":"...","wardrobe":{"description":"...","forbidden":["..."]},"forbiddenAppearance":["..."],"pagesPresent":[1,2],"textEvidence":"the exact story phrase the gender/identity is bound to"}.',
    '- pageContracts[].castIds: the stable ids present on the page (cast.child.id, cast.companion.id, humanCast ids). Must agree with characterPresence and with each humanCast member\'s pagesPresent.',
    '- pageContracts[].transition: {"kind":"steady|before_transition|threshold|after_transition","fromZoneId":"...","toZoneId":"...","cue":"..."} — omit fromZoneId/toZoneId for "steady".',
    '- recurringProps: [{"id":"snake_case_id","name":"...","description":"..."}] — every prop MUST have an "id".',
    '- propState[].propId MUST equal one of recurringProps[].id (use the id, not the name).',
    '- forbiddenGlobalElements is a JSON array of strings.',
    ...imageDirectionSection,
    '',
    'FULL STORY TEXT:',
    input.fullStoryText,
  ].join('\n');
}

/** Strip markdown fences / surrounding prose and parse the first JSON object. Throws on failure. */
export function parseContractJson(raw: string): unknown {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new InvalidVisualContractError(['compiler returned empty output']);
  }
  let text = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` fences.
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) text = fence[1].trim();
  // Fall back to the outermost { … } if there is leading/trailing prose.
  if (!text.startsWith('{')) {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
      throw new InvalidVisualContractError(['compiler output is not JSON']);
    }
    text = text.slice(first, last + 1);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new InvalidVisualContractError([`compiler output failed to parse as JSON: ${(err as Error).message}`]);
  }
}

/**
 * Compile + validate. Throws InvalidVisualContractError on bad/unparseable JSON, or
 * InvalidVNextVisualContractError on a contract that fails the vNext structural rules (fail closed — the
 * caller must not proceed to render without a valid contract).
 */
export async function compileBookVisualContract(
  input: CompileBookVisualContractInput,
  deps?: { callLLM?: ContractLlmCaller }
): Promise<BookVisualContract> {
  const call = deps?.callLLM ?? defaultContractLlmCaller;
  const raw = await call(buildCompileSystemPrompt(), buildCompileUserPrompt(input));
  // Coerce common LLM shape variations into the canonical schema BEFORE validating (general; genuinely
  // missing content still fails closed).
  const parsed = normalizeRawBookVisualContract(parseContractJson(raw)) as Record<string, unknown>;

  // Always forbid stray creatures (gpt-image's default-pet habit — the recurring uninvited armadillo;
  // first seen 2026-06, confirmed by the ענת calibration). General, not per-story: if the LLM didn't
  // already forbid other animals, add the guard so BOTH the render prompt steers away from them AND
  // the vision gate flags them. Without this the forbidden-entity check is inert when the list is empty.
  {
    const forbidden = Array.isArray(parsed.forbiddenGlobalElements)
      ? (parsed.forbiddenGlobalElements as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    if (!forbidden.some((f) => /\b(creature|animal|pet)\b/i.test(f))) {
      forbidden.push('any animal, creature, or pet that is not the story\'s declared companion');
    }
    parsed.forbiddenGlobalElements = forbidden;
  }

  // Default the version + stamp provenance/storyKey before validating. TRUSTED provenance is applied LAST so a
  // model-supplied `provenance` block can never overwrite our `source`/`compiledFromPages` (the authoritative
  // page count the coverage check validates against).
  if (parsed.version === undefined) parsed.version = BOOK_VISUAL_CONTRACT_VERSION;
  if (input.storyKey && parsed.storyKey === undefined) parsed.storyKey = input.storyKey;
  parsed.provenance = {
    ...(typeof parsed.provenance === 'object' && parsed.provenance ? parsed.provenance : {}),
    source: 'llm',
    compiledFromPages: input.pageCount,
  };

  // Fail-closed on the FULL vNext shape (coverage / transitions / cast resolution / human cast / env class),
  // not just the base structure — the compiler must not emit a contract the runtime loader would later reject.
  assertValidVNextVisualContract(parsed);
  return parsed;
}
