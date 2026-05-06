import fs from 'fs/promises';
import type { GeneratedStory, ShotVisualDirection, StoryPage } from './pipeline';

/**
 * Parse a story-bank markdown file into a GeneratedStory object.
 * Skips all LLM stages — uses imageDirection fields as rawScenePrompt.
 */
export async function loadStoryFromBank(
  filePath: string,
  childName: string,
  companionName: string
): Promise<GeneratedStory> {
  const raw = await fs.readFile(filePath, 'utf-8');

  const titleMatch = raw.match(/===\s*STORY\s*\d+:\s*(.+?)\s*===/);
  const title = titleMatch?.[1]?.trim() ?? 'סיפור מהבנק';

  // Extract story metadata for cover generation
  const coverSceneMatch = raw.match(/coverScene:\s*(.+)/);
  const coverSceneRaw = coverSceneMatch?.[1]?.trim() ?? '';

  const pageParts = raw.split(/---\s*Page\s*(\d+)\s*---/).slice(1);
  const pages: StoryPage[] = [];

  for (let i = 0; i < pageParts.length; i += 2) {
    const pageNumber = parseInt(pageParts[i], 10);
    if (!Number.isFinite(pageNumber)) continue;
    const block = pageParts[i + 1] ?? '';

    const imageDirectionMatch = block.match(/imageDirection:\s*(.+)/);
    const imageDirection = imageDirectionMatch?.[1]?.trim() ?? '';

    const textPart = block.replace(/imageDirection:.*/, '').trim();
    const text = textPart
      .replace(/\{\{childName\}\}/g, childName)
      .replace(/\{\{companionName\}\}/g, companionName);

    const resolvedImageDirection = imageDirection
      .replace(/\{\{childName\}\}/g, childName)
      .replace(/\{\{companionName\}\}/g, companionName);

    const visualDirection = parseImageDirection(resolvedImageDirection);

    pages.push({
      pageNumber,
      text,
      narrationText: text,
      imageSubject: visualDirection?.mainAction ? 'action' : 'child',
      imagePrompt: resolvedImageDirection,
      rawScenePrompt: resolvedImageDirection,
      visualDirection,
    });
  }

  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  // Use explicit English coverScene from story file when available
  const coverSceneHint = coverSceneRaw || undefined;

  return {
    title,
    coverText: title,
    coverSceneHint,
    characterSheet: {
      mainCharacter: { name: childName, visualDescription: '' },
      supportingCharacters: [
        { name: companionName, relationship: 'companion', visualDescription: '' },
      ],
      worldDescription: '',
    },
    concept: {
      centralEntity: {
        name: companionName,
        type: 'external_helper',
        visualDescription: '',
        behaviorRules: ['', '', ''],
        strangeDetail: '',
      },
      narrativePurpose: { represents: '', whyItAppears: '', whatItNeedsOrWants: '' },
      resilienceLayer: {
        identificationAnchor: '',
        projectionLogic: '',
        regulationAction: '',
        transformationMarker: '',
      },
      surpriseOrShift: '',
      emotionalPeak: '',
      resolution: { action: '', transformation: '' },
    },
    pages,
    meta: {
      provider: 'story-bank',
      model: 'pre-written',
      tokens: 0,
      totalTokens: 0,
    },
  };
}

/**
 * Parse an imageDirection string into a ShotVisualDirection.
 * Format: "Description, camera type, focal point: X, lighting"
 */
function parseImageDirection(dir: string): ShotVisualDirection | undefined {
  if (!dir) return undefined;

  const focalMatch = dir.match(/focal point:\s*([^,]+)/i);
  const focal = focalMatch?.[1]?.trim() ?? '';

  const cameraMatch = dir.match(
    /(wide shot|medium shot|close shot|low angle|bird-eye view|bird.?s eye)/i
  );
  const camera = cameraMatch?.[1]?.trim() ?? 'medium shot';

  const lightMatch = dir.match(/([\w\s]+lighting|[\w\s]+light|[\w\s]+mood)$/i);
  const lighting = lightMatch?.[1]?.trim() ?? '';
  const weatherMatch = dir.match(/(rain|rainy|storm|flood|flooding|overcast|gray|grey|dark|wet|mud|muddy|snow|sunny|bright)/gi);
  const weather = weatherMatch ? [...new Set(weatherMatch.map((w) => w.toLowerCase()))].join(', ') : '';
  const emotionMatch = dir.match(/(dramatic|calm|gentle|tense|struggle|peaceful|sad|worried|determined|scared)/gi);
  const emotion = emotionMatch?.[0]?.toLowerCase() ?? '';

  // FIXED: Use the FULL imageDirection as mainAction, stripping only metadata suffixes
  // (camera type, focal point, lighting). Previously only took first comma chunk,
  // which destroyed critical scene details like specific objects, water levels, etc.
  const metadataPattern = /,?\s*(?:wide shot|medium shot|close shot|low angle|bird-eye view|bird.?s eye)\b.*$/i;
  const mainAction = dir.replace(metadataPattern, '').trim() || dir.split(',')[0]?.trim() || dir;

  // Extract ALL named objects from the full description for mustInclude
  const mustInclude: string[] = [];
  if (focal) mustInclude.push(focal);

  // Extract location from imageDirection text instead of hardcoding
  const locationZone = extractLocationZone(dir);

  return {
    locationZone,
    mainAction,
    visibleObjects: mustInclude.length ? mustInclude : [],
    characterPose: '',
    emotionVisual: emotion,
    lightingSource: lighting,
    environmentDetail: weather,
    textTranslation: '',
    mustInclude,
    mustNotInclude: [],
    camera,
    composition: '',
  };
}

/** Extract location/setting from imageDirection text. */
function extractLocationZone(dir: string): string {
  const d = dir.toLowerCase();
  // Indoor locations
  if (/\b(bedroom|bed|pillow|blanket|dresser|drawer|nightstand|lamp|mattress)\b/.test(d)) return 'bedroom';
  if (/\b(kitchen|stove|fridge|counter|oven|sink)\b/.test(d)) return 'kitchen';
  if (/\b(bathroom|bath|shower|toilet)\b/.test(d)) return 'bathroom';
  if (/\b(living room|couch|sofa|armchair|tv|television)\b/.test(d)) return 'living room';
  if (/\b(classroom|school|desk|blackboard|whiteboard)\b/.test(d)) return 'classroom';
  if (/\b(room|indoor|inside|wall|floor|ceiling|door|window|hallway|corridor)\b/.test(d)) return 'room';
  // Outdoor locations
  if (/\b(garden|yard|fence|hedge|gate|flower.?pot|swing|tree.*branch)\b/.test(d)) return 'garden';
  if (/\b(forest|woods|clearing|trail|path.*tree)\b/.test(d)) return 'forest';
  if (/\b(park|playground|bench|slide)\b/.test(d)) return 'park';
  if (/\b(beach|sand|ocean|sea|wave|shore)\b/.test(d)) return 'beach';
  if (/\b(street|road|sidewalk|crosswalk|car)\b/.test(d)) return 'street';
  // Abstract/transitional
  if (/\b(open space|bright space|threshold|doorway.*light)\b/.test(d)) return 'threshold';
  // Default — generic scene
  return 'scene';
}

type StoryBankCharacterDNA = {
  childDNA: string;
  companionDNA: string;
  worldDNA: string;
  negativeRules: string[];
  /** Locked visual descriptions for recurring objects (tree, swing, etc.) */
  propDNA: Record<string, string>;
};

function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Safely parse propDNA from LLM output, falling back to defaults.
 */
function parsePropDNA(
  raw: Record<string, string> | undefined,
  fallback: Record<string, string>
): Record<string, string> {
  if (!raw || typeof raw !== 'object') return fallback;
  const result: Record<string, string> = {};
  let validCount = 0;
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === 'string' && val.trim().length > 5) {
      result[key.toLowerCase().replace(/\s+/g, '_')] = val.trim();
      validCount++;
    }
  }
  // If LLM returned fewer than 2 props, use fallback entirely
  return validCount >= 2 ? result : fallback;
}

/**
 * Generate compact locked "visual bible" DNA for story-bank image generation.
 */
export async function generateStoryBankCharacterDNA(params: {
  childName: string;
  childGender: string;
  childAge: number;
  companionName: string;
  storyText: string;
  illustrationStyle: string;
}): Promise<StoryBankCharacterDNA> {
  const provider = process.env.STORY_PROVIDER || 'openai';
  const model =
    process.env.STORY_MODEL || (provider === 'anthropic' ? 'claude-opus-4-5' : 'gpt-5.3-chat-latest');

  const systemPrompt =
    "You are a children's book character designer. Create locked visual DNA for consistent illustrations.";

  const userPrompt = `
You are a children's book character designer. Read the story below and create LOCKED visual descriptions.

These descriptions will be copy-pasted VERBATIM into every illustration prompt for the book.
They MUST be in English. They MUST be specific enough that 15 different illustrators would draw the same character.

STORY TEXT:
${params.storyText}

CHARACTER:
- Name: ${params.childName}
- Gender: ${params.childGender}
- Age: ${params.childAge}

COMPANION:
- Name: ${params.companionName} (appears as the child's friend/sidekick throughout the story)

STYLE:
- Illustration style: ${params.illustrationStyle}

RULES:
- Describe PHYSICAL appearance only — no personality, no emotions, no actions
- Include: hair (color, length, style), skin tone, eye shape/color, body build, EXACT outfit (one outfit for the whole book), one accessory
- The outfit MUST stay the same on every single page
- DO NOT include the character's name anywhere in the visual description
- DO NOT write any text, letters, or words on clothing
- For companion: exact species, size relative to child, color, distinguishing feature

WEATHER/ENVIRONMENT from the story:
- Read the story and identify the dominant weather and setting
- Describe in 20 words: weather, time of day, dominant colors, ground condition
- IMPORTANT: Include a color palette constraint — all pages must use the SAME muted, soft watercolor palette. No bright saturated cartoon colors. Consistent saturation across every page.

RECURRING OBJECTS (CRITICAL):
- Read the story and identify ALL objects that appear on MORE THAN ONE page (e.g. a tree, a swing, a toy box, a door, a specific item)
- For EACH recurring object, write a locked 15-25 word visual description: exact shape, size, color, material, distinguishing features
- These descriptions will be copy-pasted VERBATIM into every page prompt where the object appears
- The object MUST look IDENTICAL on every page — same proportions, same colors, same details
- Use English only. Be extremely specific (e.g. "A narrow brown wooden swing with a flat plank seat, hung by two thin brown cords from a thick branch" NOT just "a swing")

Return JSON:
{
  "childDNA": "40-60 words",
  "companionDNA": "20-30 words",
  "worldDNA": "20-30 words",
  "propDNA": {
    "object_name": "15-25 word locked visual description",
    "another_object": "15-25 word locked visual description"
  },
  "negativeRules": [
    "Rule 1",
    "Rule 2",
    "Rule 3",
    "Rule 4"
  ]
}
`.trim();

  const fallback: StoryBankCharacterDNA = {
    childDNA: `A ${params.childAge}-year-old ${params.childGender === 'girl' ? 'girl' : 'boy'} with medium brown hair, light olive skin, rounded dark eyes, average child build, wearing a yellow rain jacket, denim shorts, dark blue rain boots, and a small red hair clip.`,
    companionDNA:
      'A small bright green tree frog, about hand-sized, smooth shiny skin with darker green spots, round golden eyes, and compact body proportions.',
    worldDNA:
      'Rainy garden under gray daylight, muddy wet ground with puddles and rising water, green hedges and overcast sky with visible rainfall.',
    propDNA: {
      tree: 'A small thin deciduous tree about 2 meters tall with a narrow brown trunk, sparse asymmetric branches, small green leaves, slightly tilting to the right, roots partially visible at the base.',
      swing: 'A simple flat wooden plank swing hung by two thin brown cords from a thick horizontal branch of a separate large tree, the plank is weathered light brown with rounded edges.',
      cloth_cord: 'A single knotted beige cloth cord about 50cm long, tied to the low branch of the small tree, the knot is thick and hand-tied, the fabric hangs straight down when dry, sways when wet.',
      garden_door: 'A tall narrow wooden garden door made of vertical brown planks with a small black iron latch, set into a low green hedge, opens outward.',
      toy_box: 'A small rectangular wooden chest with brass hinges, light brown with slightly darker lid, about knee-height to the child.',
      flowerpot: 'A small round terracotta pot with a single orange flower, classic clay pot shape with a slight rim at the top.',
    },
    negativeRules: [
      'NEVER put text, letters, words, or names on clothing or surfaces',
      "NEVER change the child's outfit, hair color, or accessory between pages",
      'NEVER omit visible rain in outdoor rainy scenes',
      'NEVER give the child extra arms, extra fingers, or any duplicated body parts — exactly 2 arms, 2 legs, 5 fingers per hand',
      'NEVER use bright saturated cartoon colors — maintain a soft muted watercolor palette throughout',
      "NEVER make the frog larger than the child's hand-span",
      'NEVER change the appearance of recurring objects (tree, swing, cloth cord, door) between pages — they must look identical every time they appear',
    ],
  };

  try {
    if (provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = data.content?.[0]?.text ?? '';
      const parsed = parseJsonResponse<Partial<StoryBankCharacterDNA>>(text);
      return {
        childDNA: parsed.childDNA?.trim() || fallback.childDNA,
        companionDNA: parsed.companionDNA?.trim() || fallback.companionDNA,
        worldDNA: parsed.worldDNA?.trim() || fallback.worldDNA,
        propDNA: parsePropDNA(parsed.propDNA, fallback.propDNA),
        negativeRules:
          parsed.negativeRules?.filter((rule): rule is string => typeof rule === 'string' && !!rule.trim()) ??
          fallback.negativeRules,
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    };
    if (model.startsWith('gpt-5.')) {
      body.max_completion_tokens = 1500;
    } else {
      body.max_tokens = 1500;
      body.temperature = 0.2;
    }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const parsed = parseJsonResponse<Partial<StoryBankCharacterDNA>>(text);
    return {
      childDNA: parsed.childDNA?.trim() || fallback.childDNA,
      companionDNA: parsed.companionDNA?.trim() || fallback.companionDNA,
      worldDNA: parsed.worldDNA?.trim() || fallback.worldDNA,
      propDNA: parsePropDNA(parsed.propDNA, fallback.propDNA),
      negativeRules:
        parsed.negativeRules?.filter((rule): rule is string => typeof rule === 'string' && !!rule.trim()) ??
        fallback.negativeRules,
    };
  } catch (error) {
    console.warn('[StoryBankDNA] failed, using fallback DNA:', error);
    return fallback;
  }
}
