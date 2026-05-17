/**
 * Director Layer — produces cinematic BLOCKING for a single page of a Hebrew children's book.
 *
 * Why this exists: gpt-image-1 receives a long prompt with style + character + scene + composition
 * instructions. Without explicit spatial blocking, the model defaults to a safe centered portrait
 * with a sad expression. Adding a per-page BLOCKING JSON gives the model concrete cinematic
 * choreography (positions, eyeline, interaction verbs, emotion) that overrides the safe default.
 *
 * This runs ONCE per page, in parallel with other Director calls, between the storyboard plan
 * and the image generation. Output is rendered into the GPT-Image prompt by buildGPTImagePrompt.
 *
 * Feature flag: USE_DIRECTOR_LAYER (default ON). Set to 'false' to disable and fall back to the
 * legacy mechanical Scene Extractor output.
 */

import type { ShotVisualDirection } from './pipeline';

/**
 * Minimal structural type for the storyboard row fields the Director cares about.
 * We avoid importing PageVisualStoryboard from image.ts to prevent a circular
 * dependency (image.ts → director.ts → image.ts).
 */
export interface DirectorStoryboardRow {
  shotType: string;
  compositionMode: string;
  mainCharacterVisibility: string;
  protagonistDominance: string;
}

/** Cinematic blocking plan for a single page. */
export interface SceneBlocking {
  /** 1-2 sentences with spatial positions: foreground-left, midground-right, center, etc. */
  blocking: string;
  /** What characters are DOING together — active verbs only. */
  interaction: string;
  /** Where gazes are directed — creates the focal point. */
  eyeline: string;
  /** Precise emotion (cautious wonder, quiet hope, surprised delight, etc.), not default sadness. */
  emotion: string;
}

export interface DirectorInput {
  pageNumber: number;
  pageText: string;                 // Hebrew page text
  imageDirection: string;           // imagePrompt / rawScenePrompt from story file
  visualDirection?: ShotVisualDirection | null;
  storyboard?: DirectorStoryboardRow | null;
  companion?: { name: string; species?: string; feature?: string } | null;
  child?: { name?: string | null; age?: number | null; gender?: string | null };
  /** Previous page's blocking — used for visual continuity. */
  previousPageContext?: {
    pageNumber: number;
    blocking?: string;
    emotion?: string;
    pageTextSnippet?: string;
  } | null;
  /** Next page's text (1-2 sentences) — helps the Director set up what comes after. */
  nextPageContext?: {
    pageNumber: number;
    pageTextSnippet?: string;
  } | null;
  /** Total pages in the book — gives the Director a sense of narrative position. */
  totalPages?: number;
}

/** True when the Director Layer is enabled. Default ON. Set USE_DIRECTOR_LAYER=false to disable. */
export function isDirectorLayerEnabled(): boolean {
  return process.env.USE_DIRECTOR_LAYER !== 'false';
}

const DIRECTOR_SYSTEM_PROMPT = `You are a CINEMATIC art director for a Hebrew children's picture book. You think like a film director laying out shots — each page is a single shot in a sequence, and your job is to BLOCK that shot precisely AND keep visual continuity with the page before and after.

OUTPUT — strict JSON, exactly these four keys:
{
  "blocking":   "1-2 sentences. Use frame language: 'tiny figure foreground-left', 'small character midground-right', 'behind', 'between'. The child is SMALL inside a vast scene — typically 20-30% of the frame, NEVER more than 35%. Name what each character does physically. Specify WHERE in the frame and WHAT SIZE the character is.",
  "interaction":"1 sentence — what the characters are DOING together. Active verbs: kneeling, reaching, pointing, listening, climbing, looking together, sharing, leaning. NEVER 'observing' or 'positioned naturally'.",
  "eyeline":    "Where each character's gaze goes — creates the focal point.",
  "emotion":    "Precise emotion word: cautious wonder, gentle curiosity, quiet hope, surprised delight, focused effort, soft worry, tender trust, brave calm, tired comfort. NEVER default to 'sad'."
}

DIRECTING PRINCIPLES:
1. THE CHILD IS SMALL — every page, every shot. Typical size 20-30% of frame. The WORLD is the protagonist, the child is a small figure inside it. Lots of breathing space.
2. CINEMATIC SHOT GRAMMAR. Mix shot distances across pages:
   - OPENING (page 1-2): wide establishing — child tiny in a vast scene.
   - INTRODUCING_COMPANION (companion's first appearance): over-the-shoulder OR medium two-shot. Child sees companion across the frame.
   - DISCOVERY / ACTION: wide with diagonal motion. Child moving through space.
   - QUIET PAGES: medium, both characters seated/still, breathing room around them.
   - HEART_LINE (the emotional climax — usually a page near 60-75% through): the only close-up of the book. Earned intimacy.
   - RESOLUTION (last 2 pages): pull back to a wide. Exit the world the same way you entered.
3. CONTINUITY across pages (this is critical):
   - If the previous page ended with the child kneeling on the shore, this page should NOT also be the child kneeling on the shore — change pose, angle, OR distance.
   - But preserve EMOTIONAL FLOW: a worried page → a softer page, not a sudden joyful page.
   - Preserve LOCATION FLOW: if the previous page was at the shore and this page is also at the shore, the camera should move (closer, further, different angle) — never identical framing back-to-back.
   - The Director receives the PREVIOUS PAGE's blocking and emotion. USE THEM.
4. EYELINE creates the focal point. Without an eyeline, the scene becomes a portrait.
5. EVERY page needs a verb of motion OR focused attention. Never just 'standing'.
6. When a companion is present, the interaction must CONNECT them — shared eyeline, shared touch, shared action.
7. Emotion is read from the page text. Sadness only when the text explicitly describes fear/loss/crying.
8. When the page text is static ("the forest is dark"), turn it into a SCENE: the child is doing something — looking up, listening, holding her breath.

Return JSON only. No preamble. No explanation.`;

/** Format a compact JSON payload describing the page for the Director to plan. */
function buildDirectorUserMessage(input: DirectorInput): string {
  const companion = input.companion
    ? `${input.companion.name}${input.companion.species ? ` (${input.companion.species})` : ''}${input.companion.feature ? ` — ${input.companion.feature}` : ''}`
    : 'none on this page';

  const sb = input.storyboard;
  const shotInfo = sb
    ? `${sb.shotType} | ${sb.compositionMode} | visibility=${sb.mainCharacterVisibility} | dominance=${sb.protagonistDominance}`
    : 'unspecified';

  const location = input.visualDirection?.locationZone ?? 'unspecified';
  const objects = input.visualDirection?.visibleObjects?.slice(0, 5).join(', ') ?? 'none';

  const childInfo = [
    input.child?.name ?? 'child',
    input.child?.age ? `${input.child.age}yo` : null,
    input.child?.gender ?? null,
  ].filter(Boolean).join(', ');

  const total = input.totalPages ?? 0;
  let narrativeBeat = 'RISING_ACTION';
  if (input.pageNumber === 1) narrativeBeat = 'OPENING (wide establishing)';
  else if (input.pageNumber === 2) narrativeBeat = 'OPENING_OR_INTRODUCING_COMPANION (medium duo or OTS)';
  else if (total > 0 && input.pageNumber >= total - 1) narrativeBeat = 'RESOLUTION (medium/wide — never close-up)';
  else if (total > 0 && input.pageNumber >= Math.floor(total * 0.55) && input.pageNumber <= Math.floor(total * 0.75)) narrativeBeat = 'HEART_LINE_CANDIDATE (the one close-up of the book)';

  const prev = input.previousPageContext;
  const next = input.nextPageContext;
  const continuityLines: string[] = [];
  if (prev) {
    continuityLines.push(`PREVIOUS PAGE (${prev.pageNumber}) blocking: ${(prev.blocking ?? '(unknown)').slice(0, 200)}`);
    if (prev.emotion) continuityLines.push(`PREVIOUS PAGE emotion: ${prev.emotion}`);
    if (prev.pageTextSnippet) continuityLines.push(`PREVIOUS PAGE text: ${prev.pageTextSnippet.slice(0, 150)}`);
    continuityLines.push('→ DO NOT repeat the same framing as the previous page. Move the camera (closer/further/different angle/different side).');
  }
  if (next) {
    continuityLines.push(`NEXT PAGE (${next.pageNumber}) text: ${(next.pageTextSnippet ?? '').slice(0, 150)}`);
    continuityLines.push('→ Set up the next page visually — your blocking should make sense as a step toward what comes next.');
  }

  return [
    `PAGE ${input.pageNumber}${total ? ` of ${total}` : ''} — beat: ${narrativeBeat}`,
    '',
    `Hebrew page text:`,
    input.pageText.trim() || '(empty)',
    '',
    `Scene location: ${location}`,
    `Visible objects: ${objects}`,
    `Image direction note: ${input.imageDirection.trim().slice(0, 300) || '(none)'}`,
    `Storyboard decisions: ${shotInfo}`,
    `Child: ${childInfo}`,
    `Companion: ${companion}`,
    ...(continuityLines.length > 0 ? ['', '─── CONTINUITY ───', ...continuityLines] : []),
    '',
    'Produce the BLOCKING JSON now. Remember: SMALL character, breathing space, continuity with the previous page, cinematic shot grammar.',
  ].join('\n');
}

function safeParseJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip code fences if present
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) {
      try { return JSON.parse(fenced[1]); } catch { /* fall through */ }
    }
    // Find first {...} block
    const obj = trimmed.match(/\{[\s\S]*\}/);
    if (obj) {
      try { return JSON.parse(obj[0]); } catch { /* give up */ }
    }
    return null;
  }
}

function validateBlocking(raw: unknown): SceneBlocking | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const str = (k: string): string | null =>
    typeof o[k] === 'string' && (o[k] as string).trim().length > 5 ? (o[k] as string).trim() : null;
  const blocking = str('blocking');
  const interaction = str('interaction');
  const eyeline = str('eyeline');
  const emotion = str('emotion');
  if (!blocking || !interaction || !eyeline || !emotion) return null;
  return { blocking, interaction, eyeline, emotion };
}

/**
 * Run the Director LLM for a single page. Returns null on any failure
 * (the caller will fall back to the legacy mechanical scene block).
 */
export async function generateSceneBlocking(
  input: DirectorInput
): Promise<SceneBlocking | null> {
  if (!isDirectorLayerEnabled()) return null;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[Director] OPENAI_API_KEY missing — skipping blocking, falling back to legacy');
    return null;
  }

  const model = process.env.DIRECTOR_MODEL || 'gpt-4o-mini';
  const userMessage = buildDirectorUserMessage(input);
  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY_MS = 1200;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 500,
      };
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      const text: string = data.choices?.[0]?.message?.content ?? '';
      const parsed = safeParseJson(text);
      const blocking = validateBlocking(parsed);
      if (!blocking) {
        throw new Error(`Director returned invalid blocking JSON: ${text.slice(0, 200)}`);
      }
      console.log(
        `[Director] page=${input.pageNumber} attempt=${attempt} ok — ` +
        `emotion="${blocking.emotion}" eyeline="${blocking.eyeline.slice(0, 60)}..."`,
      );
      return blocking;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[Director] page=${input.pageNumber} attempt=${attempt} failed (${msg}); retrying...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        console.warn(`[Director] page=${input.pageNumber} FAILED after ${MAX_ATTEMPTS} attempts: ${msg} — falling back to legacy scene block`);
      }
    }
  }
  return null;
}

/**
 * Render a SceneBlocking object as a labeled text block for inclusion in the GPT-Image prompt.
 * This REPLACES the legacy "Location/Action/Pose/Expression" mechanical lines.
 */
export function renderSceneBlockingForPrompt(
  blocking: SceneBlocking,
  visualDirection?: ShotVisualDirection | null,
): string {
  const lines = [
    'SCENE DIRECTION (cinematic blocking — render exactly this stage):',
    `- Blocking: ${blocking.blocking}`,
    `- Interaction: ${blocking.interaction}`,
    `- Eyeline: ${blocking.eyeline}`,
    `- Emotion: ${blocking.emotion}`,
  ];
  if (visualDirection?.locationZone) {
    lines.push(`- Location: ${visualDirection.locationZone}`);
  }
  const objects = visualDirection?.visibleObjects?.slice(0, 5).filter(Boolean) ?? [];
  if (objects.length > 0) {
    lines.push(`- Visible objects: ${objects.join(', ')}`);
  }
  if (visualDirection?.lightingSource) {
    lines.push(`- Lighting: ${visualDirection.lightingSource}`);
  }
  return lines.join('\n');
}
