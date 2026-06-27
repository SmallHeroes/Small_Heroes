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
  type CompanionScaleContract,
} from './types';
import {
  assertValidBookVisualContract,
  InvalidVisualContractError,
} from './validateBookVisualContract';
import { normalizeRawBookVisualContract } from './normalizeRawContract';

/** Minimal LLM seam: system+user prompt in, raw model text (expected JSON) out. */
export type ContractLlmCaller = (system: string, user: string) => Promise<string>;

export interface CompileBookVisualContractInput {
  storyKey?: string;
  /** The full story text (all pages concatenated) — the contract is derived from ALL of it. */
  fullStoryText: string;
  pageCount: number;
  childName?: string;
  childGender?: string;
  companion?: { id: string; name?: string } | null;
  /** Canonical companion size-vs-child lock — stamped onto cast.companion (NOT LLM-generated). */
  companionScaleContract?: CompanionScaleContract | null;
}

/** Default caller — lazily pulls the shared pipeline LLM so the VCC module graph stays light. */
const defaultContractLlmCaller: ContractLlmCaller = async (system, user) => {
  const { callLLM } = await import('@/backend/providers/pipeline');
  const res = await callLLM(system, user, 4000, 0.4, 'VisualContract', true);
  return res.text;
};

export function buildCompileSystemPrompt(): string {
  return [
    'You are a visual continuity compiler for a children\'s picture book.',
    'Read the FULL story and output ONE structured JSON BookVisualContract — the single source of truth for the book\'s visuals.',
    '',
    'Hard rules:',
    '- LOCATIONS are real places (e.g. "playground_main", "home_living_room"). A sub-area like a gate or a corner is a ZONE INSIDE a location, NEVER a new location.',
    '- Every zone has a locationId pointing at its parent location.',
    '- The LOCATION stays the same across pages unless the story explicitly moves the scene; same place from a new camera angle is correct.',
    '- cast.child is mandatory with a locked wardrobe; add cast.companion only if the story has one.',
    '- forbiddenGlobalElements lists things that must NEVER appear in ANY page (e.g. animals/creatures not in the cast).',
    '- Every page in pageContracts must set locationId to a declared location id; zoneId (optional) must be a zone of that same location.',
    '- camera describes the shot/action only; it must not change location, cast, or wardrobe.',
    '',
    'Output ONLY the JSON object, no prose, no markdown fences.',
  ].join('\n');
}

export function buildCompileUserPrompt(input: CompileBookVisualContractInput): string {
  const companion = input.companion
    ? `Companion: ${input.companion.name ?? input.companion.id} (id=${input.companion.id}).`
    : 'No companion in this story.';
  return [
    `storyKey: ${input.storyKey ?? '(unknown)'}`,
    `pageCount: ${input.pageCount}`,
    `child: ${input.childName ?? '(child)'}${input.childGender ? ` (${input.childGender})` : ''}`,
    companion,
    '',
    'Produce a JSON object with exactly these keys:',
    'version (number = 1), storyKey, worldType, locations[], zones[], cast{child,companion?}, recurringProps[], forbiddenGlobalElements[], coverContract{worldType,locationId,timeOfDay?,mustShow[],mustNotShow[]}, pageContracts[].',
    'Each pageContract: pageNumber, locationId, zoneId?, sameLocationAs?, mustShow[], mustNotShow[], characterPresence{child,companion}, propState[{propId,state}], camera.',
    '',
    'EXACT SHAPE (match these key names precisely):',
    '- cast.child and cast.companion: {"id","role","name","wardrobe":{"description":"...","forbidden":["..."]}} — wardrobe is an OBJECT with a "description" string, NOT a bare string.',
    '- recurringProps: [{"id":"snake_case_id","name":"...","description":"..."}] — every prop MUST have an "id".',
    '- propState[].propId MUST equal one of recurringProps[].id (use the id, not the name).',
    '- forbiddenGlobalElements is a JSON array of strings.',
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
 * Compile + validate. Throws InvalidVisualContractError on bad JSON or an invalid contract (fail
 * closed — the caller must not proceed to render without a valid contract).
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

  // Force the current contract version (override any LLM value) so persisted contracts carry it and
  // a version bump invalidates the cache.
  parsed.version = BOOK_VISUAL_CONTRACT_VERSION;
  if (input.storyKey && parsed.storyKey === undefined) parsed.storyKey = input.storyKey;
  // Stamp the CANONICAL companion scale contract onto cast.companion — deterministic, never trust the
  // LLM for scale (the size-vs-child lever).
  if (input.companionScaleContract && parsed.cast && typeof parsed.cast === 'object') {
    const cast = parsed.cast as { companion?: Record<string, unknown> };
    if (cast.companion && typeof cast.companion === 'object') {
      cast.companion.scaleContract = input.companionScaleContract;
    }
  }
  parsed.provenance = {
    source: 'llm',
    compiledFromPages: input.pageCount,
    ...(typeof parsed.provenance === 'object' && parsed.provenance ? parsed.provenance : {}),
  };

  assertValidBookVisualContract(parsed);
  return parsed;
}
