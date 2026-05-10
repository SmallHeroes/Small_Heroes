import fs from 'fs/promises';
import type { GeneratedStory, ShotVisualDirection, StoryPage } from './pipeline';

/**
 * Parse a story-bank markdown file into a GeneratedStory object.
 * Skips all LLM stages — uses imageDirection fields as rawScenePrompt.
 * If childGender doesn't match the story's written gender, runs LLM gender swap.
 */
export async function loadStoryFromBank(
  filePath: string,
  childName: string,
  companionName: string,
  childGender?: string
): Promise<GeneratedStory> {
  const raw = await fs.readFile(filePath, 'utf-8');

  const titleMatch = raw.match(/===\s*STORY\s*\d+:\s*(.+?)\s*===/);
  const title = (titleMatch?.[1]?.trim() ?? 'סיפור מהבנק')
    .replace(/\{\{childName\}\}/g, childName)
    .replace(/\{\{companionName\}\}/g, companionName);

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

  // ── Gender adaptation ──────────────────────────────────────────────
  // If the child's gender doesn't match the story's written gender,
  // run an LLM call to swap all gendered Hebrew forms.
  if (childGender) {
    const allText = pages.map(p => p.text).join('\n');
    const storyGender = detectStoryGender(allText);
    const targetGender = childGender === 'girl' ? 'female' : 'male';

    if (storyGender && storyGender !== targetGender) {
      console.log(`[StoryBank] Gender mismatch: story=${storyGender}, target=${targetGender}. Running LLM swap...`);
      const swappedPages = await swapGender(pages, storyGender, targetGender, childName);
      // Replace text + narrationText with swapped versions
      for (let i = 0; i < pages.length; i++) {
        if (swappedPages[i]) {
          pages[i].text = swappedPages[i];
          pages[i].narrationText = swappedPages[i];
        }
      }
      console.log(`[StoryBank] Gender swap complete (${pages.length} pages).`);
    } else {
      console.log(`[StoryBank] Gender match or undetectable (story=${storyGender}, target=${targetGender}). No swap needed.`);
    }
  }

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

// ─── Gender Detection & Swap ─────────────────────────────────────────────────

/**
 * Detect the written gender of a Hebrew story by counting gendered verb/pronoun markers.
 * Returns 'female', 'male', or null if unclear.
 */
function detectStoryGender(text: string): 'female' | 'male' | null {
  // Common feminine markers in Hebrew text (verbs, pronouns)
  const femininePatterns = [
    /\bהיא\b/g,        // she
    /\bאותה\b/g,       // her (object)
    /\bשלה\b/g,        // hers
    /\bלה\b/g,         // to her
    /ָה\s/g,           // qamatz-he suffix (past tense feminine: הלכָה, ישבָה)
    /תָה\b/g,          // past feminine suffix variant
    /הִרְגִּישָׁה/g,   // she felt
    /הִסְתַּכְּלָה/g,  // she looked
    /אָמְרָה/g,        // she said
    /רָצְתָה/g,        // she wanted/ran
    /יָדְעָה/g,        // she knew
  ];

  // Common masculine markers
  const masculinePatterns = [
    /\bהוא\b/g,        // he
    /\bאותו\b/g,       // him (object)
    /\bשלו\b/g,        // his
    /\bלו\b/g,         // to him
    /הִרְגִּישׁ\b/g,   // he felt
    /הִסְתַּכֵּל\b/g,  // he looked
    /אָמַר\b/g,        // he said
    /רָצָה\b/g,        // he wanted
    /יָדַע\b/g,        // he knew
  ];

  let femScore = 0;
  let mascScore = 0;

  for (const pat of femininePatterns) {
    const matches = text.match(pat);
    femScore += matches?.length ?? 0;
  }
  for (const pat of masculinePatterns) {
    const matches = text.match(pat);
    mascScore += matches?.length ?? 0;
  }

  // Need a clear signal — at least 3 total markers and 2:1 ratio
  const total = femScore + mascScore;
  if (total < 3) return null;

  if (femScore > mascScore * 1.5) return 'female';
  if (mascScore > femScore * 1.5) return 'male';
  return null;
}

/**
 * Use LLM to swap gendered Hebrew forms in story pages.
 * Returns array of swapped text strings (one per page).
 */
async function swapGender(
  pages: StoryPage[],
  fromGender: 'female' | 'male',
  toGender: 'female' | 'male',
  childName: string
): Promise<string[]> {
  const provider = process.env.STORY_PROVIDER || 'openai';
  const model = process.env.PIPELINE_SUPPORT_MODEL ||
    (provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini');

  const fromLabel = fromGender === 'female' ? 'נקבה' : 'זכר';
  const toLabel = toGender === 'female' ? 'נקבה' : 'זכר';

  // Prepare pages text as numbered blocks
  const pagesBlock = pages
    .map(p => `=== עמוד ${p.pageNumber} ===\n${p.text}`)
    .join('\n\n');

  const systemPrompt = `אתה מתרגם מגדרי מקצועי לעברית ספרותית לילדים. תפקידך להמיר את כל הצורות הלשוניות מ${fromLabel} ל${toLabel}, תוך שמירה מוחלטת על סגנון הכתיבה, הקצב, הדמיון והאווירה.`;

  const userPrompt = `המר את הטקסט הבא מ${fromLabel} ל${toLabel}.

שם הילד/ה: ${childName}

כללים:
1. המר כל פועל, שם תואר, כינוי גוף וסיומת ל${toLabel}
2. אל תשנה שום תוכן, עלילה, דימוי או מטאפורה
3. שמור על הניקוד (אם יש)
4. שמור על שורות ריקות ומבנה פסקאות בדיוק כמו במקור
5. אל תוסיף ואל תמחק מילים — רק המר מגדר
6. שמות דמויות (כולל {{companionName}}) נשארים כמו שהם
7. החזר JSON בפורמט: {"pages": ["טקסט עמוד 1", "טקסט עמוד 2", ...]}

הטקסט:
${pagesBlock}`;

  try {
    let responseText = '';

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
          max_tokens: 4000,
          temperature: 0.1,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const data = await res.json();
      responseText = data.content?.[0]?.text ?? '';
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not set');
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      };
      if (model.startsWith('gpt-5.')) {
        body.max_completion_tokens = 4000;
      } else {
        body.max_tokens = 4000;
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
      responseText = data.choices?.[0]?.message?.content ?? '';
    }

    // Parse JSON response
    const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned) as { pages?: string[] };

    if (!Array.isArray(parsed.pages) || parsed.pages.length !== pages.length) {
      console.warn(`[StoryBank] Gender swap returned ${parsed.pages?.length ?? 0} pages, expected ${pages.length}. Skipping swap.`);
      return pages.map(p => p.text);
    }

    return parsed.pages;
  } catch (error) {
    console.error('[StoryBank] Gender swap LLM call failed, keeping original text:', error);
    return pages.map(p => p.text);
  }
}

/** Structured character identity lock — each field injected as a labeled constraint. */
export type StructuredChildDNA = {
  face: string;      // face shape, skin tone, eye color/shape (15-25 words)
  hair: string;      // color, length, style, accessory (10-20 words)
  body: string;      // build, height relative to age (10-15 words)
  clothing: string;  // EXACT outfit — locked for entire book (15-25 words)
  signature: string; // one unique visual anchor detail (5-10 words)
};

/** Structured companion identity lock. */
export type StructuredCompanionDNA = {
  species: string;   // exact animal/creature type (3-8 words)
  size: string;      // relative to child (5-10 words)
  coloring: string;  // exact color description (10-15 words)
  feature: string;   // one distinctive visual feature (5-10 words)
};

/** Locked visual bible for recurring human family / supporting roles (beyond companion). */
export type AdditionalCharacterDNA = {
  name: string;
  relationship: string;
  physicalDescription: string;
  clothingDefault: string;
  signatureDetail: string;
  ageRange: string;
};

export type StoryBankCharacterDNA = {
  /** Structured child identity — preferred over flat childDNA */
  childStructured: StructuredChildDNA;
  /** Structured companion identity — preferred over flat companionDNA */
  companionStructured: StructuredCompanionDNA;
  /** Flat fallback for backward compat */
  childDNA: string;
  companionDNA: string;
  worldDNA: string;
  negativeRules: string[];
  /** Locked visual descriptions for recurring objects (tree, swing, etc.) */
  propDNA: Record<string, string>;
  /** Locked visual descriptions for wizard additional family/supporting humans */
  additionalCharactersDNA: AdditionalCharacterDNA[];
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

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function fallbackAdditionalRow(
  row: { name: string; relationship: string; description?: string },
  illustrationStyle: string
): AdditionalCharacterDNA {
  const rel = row.relationship || 'family';
  const hint = row.description?.trim();
  const physicalDefault =
    rel === 'sibling'
      ? 'Child family member near the protagonist age band, approachable proportions, soft age-appropriate features'
      : 'Adult family figure, approachable proportions, gentle grounded presence';
  return {
    name: row.name,
    relationship: rel,
    physicalDescription: hint || physicalDefault,
    clothingDefault:
      `Modest everyday layered clothing locked for the entire book (${illustrationStyle}): ` +
      `calm muted colors, soft fabrics, zero logos or readable text.`,
    signatureDetail: hint
      ? 'Keep visual details aligned with the wizard note in every appearance'
      : 'One consistent hairstyle and proportion anchor',
    ageRange: rel === 'sibling' ? 'within a few years of the protagonist' : 'adult caregiver age',
  };
}

async function fetchAdditionalCharactersDNA(params: {
  storyText: string;
  illustrationStyle: string;
  childName: string;
  companionName: string;
  additionalCharacters: Array<{ name: string; relationship: string; description?: string }>;
}): Promise<AdditionalCharacterDNA[]> {
  const { additionalCharacters } = params;
  if (additionalCharacters.length === 0) return [];

  const provider = process.env.STORY_PROVIDER || 'openai';
  const model =
    process.env.PIPELINE_SUPPORT_MODEL ||
    (provider === 'anthropic' ? 'claude-opus-4-5' : 'gpt-5.3-chat-latest');

  const listBlock = additionalCharacters
    .map(
      (c, i) =>
        `${i + 1}. Name (exact): ${c.name}\n   Relationship: ${c.relationship}\n   Wizard note (may be empty): ${c.description?.trim() || '(none)'}`
    )
    .join('\n');

  const systemPrompt =
    "You lock recurring human supporting characters for children's books. Output ONLY valid JSON.";

  const userPrompt = `
Read the STORY for context about who each person is. Create LOCKED English visual DNA for EVERY character listed below.
These fields are pasted into image prompts verbatim — illustrators must draw the SAME person each time.

STORY TEXT:
${params.storyText}

PROTAGONIST (for scale reference only, do NOT redesign): ${params.childName}
COMPANION (non-human sidekick reference only): ${params.companionName || 'none'}

ADDITIONAL CHARACTERS — output one JSON object per line item, SAME "name" string as given:
${listBlock}

STYLE: ${params.illustrationStyle}

RULES:
- Physical: face shape + skin tone + eyes + hair (no personality adjectives beyond neutral appearance)
- Clothing: ONE locked outfit for the whole book — every garment named, muted kid-book palette, ZERO text/logos
- Signature: one small recurring visual cue (jewelry, freckles, haircut quirk — not action)
- ageRange: short phrase ("early 30s", "grade-school sibling", ...)
- MUST be English. Do NOT repeat character names inside physical/clothing sentences.
- Honor wizard notes heavily when provided.

Return JSON:
{
  "additionalCharactersDNA": [
    {
      "name": "exact same as input list",
      "relationship": "same as input or refined",
      "physicalDescription": "15-35 words",
      "clothingDefault": "15-35 words — locked wardrobe",
      "signatureDetail": "5-14 words",
      "ageRange": "short phrase"
    }
  ]
}
`.trim();

  const mergeWithFallback = (parsed: Partial<AdditionalCharacterDNA>[]): AdditionalCharacterDNA[] => {
    return additionalCharacters.map((src) => {
      const fb = fallbackAdditionalRow(src, params.illustrationStyle);
      const match = parsed.find((p) => p.name && normalizeNameKey(p.name) === normalizeNameKey(src.name));
      if (
        match &&
        typeof match.physicalDescription === 'string' &&
        match.physicalDescription.trim().length > 8 &&
        typeof match.clothingDefault === 'string' &&
        match.clothingDefault.trim().length > 8 &&
        typeof match.signatureDetail === 'string' &&
        match.signatureDetail.trim().length > 3 &&
        typeof match.ageRange === 'string' &&
        match.ageRange.trim().length > 2
      ) {
        return {
          name: src.name,
          relationship: typeof match.relationship === 'string' && match.relationship.trim()
            ? match.relationship.trim()
            : src.relationship,
          physicalDescription: match.physicalDescription.trim(),
          clothingDefault: match.clothingDefault.trim(),
          signatureDetail: match.signatureDetail.trim(),
          ageRange: match.ageRange.trim(),
        };
      }
      return fb;
    });
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
          max_tokens: 2000,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = data.content?.[0]?.text ?? '';
      const parsedObj = parseJsonResponse<{ additionalCharactersDNA?: Partial<AdditionalCharacterDNA>[] }>(text);
      const rows = Array.isArray(parsedObj.additionalCharactersDNA)
        ? parsedObj.additionalCharactersDNA
        : [];
      const merged = mergeWithFallback(rows);
      console.log(`[StoryBankDNA] Additional characters DNA rows=${merged.length}`);
      return merged;
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
      body.max_completion_tokens = 2000;
    } else {
      body.max_tokens = 2000;
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
    const parsedObj = parseJsonResponse<{ additionalCharactersDNA?: Partial<AdditionalCharacterDNA>[] }>(text);
    const rows = Array.isArray(parsedObj.additionalCharactersDNA)
      ? parsedObj.additionalCharactersDNA
      : [];
    const merged = mergeWithFallback(rows);
    console.log(`[StoryBankDNA] Additional characters DNA rows=${merged.length}`);
    return merged;
  } catch (error) {
    console.warn('[StoryBankDNA] Additional characters DNA failed, using per-character fallbacks:', error);
    return additionalCharacters.map((c) => fallbackAdditionalRow(c, params.illustrationStyle));
  }
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
  additionalCharacters?: Array<{ name: string; relationship: string; description?: string }>;
}): Promise<StoryBankCharacterDNA> {
  const provider = process.env.STORY_PROVIDER || 'openai';
  const model =
    process.env.PIPELINE_SUPPORT_MODEL ||
    (provider === 'anthropic' ? 'claude-opus-4-5' : 'gpt-5.3-chat-latest');

  const systemPrompt =
    "You are a children's book character designer. Create structured, locked visual DNA for consistent illustrations across every page of a book.";

  const userPrompt = `
You are a children's book character designer. Read the story below and create LOCKED STRUCTURED visual descriptions.

Each field below will be copy-pasted VERBATIM as a LABELED CONSTRAINT into every illustration prompt.
They MUST be in English. They MUST be specific enough that 15 different illustrators would draw the SAME character.

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

RULES FOR CHILD:
- Describe PHYSICAL appearance only — no personality, no emotions, no actions
- Each field must be self-contained and specific
- "face": face shape + skin tone + eye color/shape + any distinctive facial feature (15-25 words)
- "hair": exact color + length + style + any hair accessory (10-20 words)
- "body": build + approximate height for age (10-15 words)
- "clothing": EXACT outfit description — this outfit is LOCKED for the ENTIRE book. Include every garment, color, and any pattern. (15-25 words)
- "signature": ONE unique visual detail that anchors this character's identity across pages (5-10 words). Example: "small red hair clip on left side" or "missing front tooth"
- DO NOT include the character's name anywhere in visual descriptions
- DO NOT put any text, letters, numbers, or words on clothing

RULES FOR COMPANION:
- "species": exact animal/creature type (3-8 words)
- "size": size relative to the child (5-10 words)
- "coloring": exact color description including any patterns or markings (10-15 words)
- "feature": ONE distinctive visual feature that makes this companion recognizable (5-10 words)

WEATHER/ENVIRONMENT from the story:
- Read the story and identify the dominant weather and setting
- Describe in 20 words: weather, time of day, dominant colors, ground condition
- Include a color palette constraint — consistent muted soft palette across all pages

RECURRING OBJECTS (CRITICAL):
- Identify ALL objects that appear on MORE THAN ONE page
- For EACH: write a locked 15-25 word visual description (exact shape, size, color, material)
- These will be copy-pasted into every page where the object appears — must look IDENTICAL every time

Return JSON:
{
  "childStructured": {
    "face": "15-25 words: face shape, skin tone, eye color/shape, distinctive facial feature",
    "hair": "10-20 words: exact color, length, style, any hair accessory",
    "body": "10-15 words: build and height relative to age",
    "clothing": "15-25 words: every garment, exact colors, patterns — LOCKED for entire book",
    "signature": "5-10 words: one unique anchoring visual detail"
  },
  "companionStructured": {
    "species": "3-8 words: exact animal/creature type",
    "size": "5-10 words: size relative to child",
    "coloring": "10-15 words: exact colors and ma