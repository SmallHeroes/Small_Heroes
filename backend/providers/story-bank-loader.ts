import fs from 'fs/promises';
import type { GeneratedStory, ShotVisualDirection, StoryPage } from './pipeline';
import {
  applyPersonalizationPatches,
  type LetterContext,
  type PatchContext,
  generateCompanionLetter,
} from './personalization';

export type LoadStoryFromBankOptions = {
  patchContext?: PatchContext | null;
  /** When set with companionLetter frontmatter, generates and splices the letter page. */
  letterContext?: LetterContext | null;
};

/**
 * Parse `companionLetter` from story markdown (YAML anywhere in header region).
 */
export function parseCompanionLetterMeta(
  raw: string
): { insertAfterPage: number; imageDirection: string } | null {
  if (!/companionLetter\s*:/.test(raw)) return null;
  const insert = raw.match(/insertAfterPage\s*:\s*(\d+)/);
  const img =
    raw.match(/imageDirection\s*:\s*"((?:\\.|[^"\\])*)"/) ??
    raw.match(/imageDirection\s*:\s*'((?:\\.|[^'\\])*)'/);
  if (!insert?.[1] || !img?.[1]) return null;
  const insertAfterPage = parseInt(insert[1], 10);
  if (!Number.isFinite(insertAfterPage) || insertAfterPage < 0) return null;
  return { insertAfterPage, imageDirection: img[1].trim() };
}

/**
 * Parse a story-bank markdown file into a GeneratedStory object.
 * Skips all LLM stages — uses imageDirection fields as rawScenePrompt.
 * If childGender doesn't match the story's written gender, runs LLM gender swap.
 */
export async function loadStoryFromBank(
  filePath: string,
  childName: string,
  companionName: string,
  childGender?: string,
  options?: LoadStoryFromBankOptions | null
): Promise<GeneratedStory> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const letterMeta = parseCompanionLetterMeta(raw);

  // Try YAML frontmatter first (v5-fixed-v2 format), fall back to legacy "=== STORY N: title ===".
  // No longer falls back to "סיפור מהבנק" — that placeholder leaked into the production UI.
  const yamlTitleMatch = raw.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
  const legacyTitleMatch = raw.match(/===\s*STORY\s*\d+:\s*(.+?)\s*===/);
  const rawTitle = yamlTitleMatch?.[1]?.trim() || legacyTitleMatch?.[1]?.trim() || '';
  const title = (rawTitle || `הסיפור של ${childName}`)
    .replace(/\{\{childName\}\}/g, childName)
    .replace(/\{\{companionName\}\}/g, companionName);

  // Extract story metadata for cover generation
  const coverSceneMatch = raw.match(/coverScene:\s*(.+)/);
  const coverSceneRaw = coverSceneMatch?.[1]?.trim() ?? '';

  // Extract explicit gender metadata (if present in story file header)
  const genderMatch = raw.match(/^gender:\s*(female|male|girl|boy)\b/mi);
  const explicitGender = genderMatch?.[1]?.trim().toLowerCase() ?? null;
  const normalizedExplicitGender =
    explicitGender === 'girl' || explicitGender === 'female' ? 'female' :
    explicitGender === 'boy' || explicitGender === 'male' ? 'male' : null;

  const pageParts = raw.split(/---\s*Page\s*(\d+)\s*---/).slice(1);
  const pages: StoryPage[] = [];

  for (let i = 0; i < pageParts.length; i += 2) {
    const pageNumber = parseInt(pageParts[i], 10);
    if (!Number.isFinite(pageNumber)) continue;
    const block = pageParts[i + 1] ?? '';

    const imageDirectionMatch = block.match(/imageDirection:\s*(.+)/);
    const imageDirection = imageDirectionMatch?.[1]?.trim() ?? '';

    const textPart = block
      .replace(/imageDirection:.*/g, '')
      .replace(/WORD_COUNT:.*/g, '')
      .trim();
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
    // Prefer explicit metadata; fall back to regex detection
    const storyGender = normalizedExplicitGender ?? detectStoryGender(allText);
    const targetGender = childGender === 'girl' ? 'female' : 'male';
    console.log(`[StoryBank] Gender: explicit=${normalizedExplicitGender}, detected=${normalizedExplicitGender ? 'skipped' : detectStoryGender(allText)}, target=${targetGender}`);

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

  // ── Child name personalization ─────────────────────────────────────
  // v5-fixed-v2 stories use generic "הילד"/"הילדה" instead of {{childName}}.
  // Run an LLM pass that naturally weaves the child's actual name in 2-4
  // key moments so the book feels personal without overusing the name.
  if (childName && childName.trim().length > 0) {
    const targetGenderForName: 'female' | 'male' =
      childGender && /female|girl|f|בת|ילדה|נקבה|she|her/i.test(String(childGender)) ? 'female' : 'male';
    try {
      const personalizedPages = await personalizeChildName(pages, childName, targetGenderForName);
      for (let i = 0; i < pages.length; i++) {
        if (personalizedPages[i]) {
          pages[i].text = personalizedPages[i];
          pages[i].narrationText = personalizedPages[i];
        }
      }
      // Count how many times the child's name actually appears in the rewritten pages —
    // surfaces it in logs so we know whether the LLM was conservative or generous.
    const totalNameCount = personalizedPages.reduce(
      (acc, p) => acc + ((p ?? '').match(new RegExp(childName, 'g')) || []).length,
      0
    );
    console.log(`[StoryBank] Name personalization complete — '${childName}' appears ${totalNameCount} times across ${pages.length} pages.`);
    if (totalNameCount < 4) {
      console.warn(`[StoryBank] WARNING: name appears only ${totalNameCount}x — model was too conservative.`);
    }
    } catch (err) {
      console.error('[StoryBank] Name personalization failed — keeping generic text:', err);
    }
  }

  const opts = options ?? undefined;

  if (opts?.patchContext) {
    for (let i = 0; i < pages.length; i++) {
      const patchedText = await applyPersonalizationPatches(pages[i].text, opts.patchContext);
      pages[i].text = patchedText;
      pages[i].narrationText = patchedText;
    }
    console.log(`[StoryBank] Personalization patches applied (${pages.length} pages).`);
  }

  if (letterMeta && opts?.letterContext) {
    const letter = await generateCompanionLetter(opts.letterContext);
    const insertIdx = pages.findIndex((p) => p.pageNumber === letterMeta.insertAfterPage);
    const pos = insertIdx >= 0 ? insertIdx + 1 : pages.length;
    const resolvedLetterImg = letterMeta.imageDirection
      .replace(/\{\{childName\}\}/g, childName)
      .replace(/\{\{companionName\}\}/g, companionName);
    const letterVisual = parseImageDirection(resolvedLetterImg);
    const letterPage: StoryPage = {
      pageNumber: 0,
      text: letter.text,
      narrationText: letter.text,
      imageSubject: 'child',
      imagePrompt: resolvedLetterImg,
      rawScenePrompt: resolvedLetterImg,
      visualDirection: letterVisual,
      isLetter: true,
    };
    pages.splice(pos, 0, letterPage);
    pages.forEach((p, idx) => {
      p.pageNumber = idx + 1;
    });
    console.log(
      `[StoryBank] Companion letter inserted after logical page ${letterMeta.insertAfterPage} (total pages=${pages.length}).`
    );
  } else if (letterMeta && !opts?.letterContext) {
    console.warn(
      '[StoryBank] companionLetter frontmatter found but letterContext missing — letter page skipped.'
    );
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
export function parseImageDirection(dir: string): ShotVisualDirection | undefined {
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

  // Extract creature/companion mentions from plain prose ("starfish with open notebook")
  // so the companion gets injected as a required visual element. Without this, the
  // image gen would only render the child and drop the companion entirely.
  const creatureRegex = /\b(starfish|seahorse|octopus|dolphin|whale|fish|jellyfish|crab|turtle|otter|seal|shark|coral|anemone|bat|owl|fox|deer|fawn|squirrel|rabbit|bunny|chameleon|panda|bear|cub|hedgehog|hawk|eagle|pelican|dragon|bee|lion|butterfly|ant|firefly|mongoose|wolf|gecko|salamander|kitten|cat|snail|puppy|dog|parrot|bird|mole|giant)\b/gi;
  const creatures = dir.match(creatureRegex);
  if (creatures) {
    for (const c of creatures) {
      const lc = c.toLowerCase();
      if (!mustInclude.some((m) => m.toLowerCase().includes(lc))) {
        mustInclude.push(lc);
      }
    }
  }

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
  if (/\b(beach|sand|shore|dune|coast)\b/.test(d)) return 'beach';
  if (/\b(underwater|coral|reef|kelp|sea ?floor|seabed|sea bottom|ocean floor|undersea|deep sea|mermaid|aquatic|submerged)\b/.test(d)) return 'underwater';
  if (/\b(ocean|sea|wave|water|tide|lagoon|pool of water|river|lake|stream|pond|brook|creek)\b/.test(d)) return 'water';
  if (/\b(mountain|cliff|peak|valley|hill|ridge)\b/.test(d)) return 'mountain';
  if (/\b(desert|dune|cactus|sand dune|wasteland)\b/.test(d)) return 'desert';
  if (/\b(meadow|field|prairie|grassland|pasture)\b/.test(d)) return 'meadow';
  if (/\b(cave|cavern|underground|tunnel|grotto)\b/.test(d)) return 'cave';
  if (/\b(sky|cloud|stars|moon|night sky|starlit|celestial|cosmic|galaxy|space)\b/.test(d)) return 'sky';
  if (/\b(snow|ice|frost|glacier|icicle|snowflake)\b/.test(d)) return 'snow';
  if (/\b(street|road|sidewalk|crosswalk|car)\b/.test(d)) return 'street';
  if (/\b(village|town|farm|barn|stable|cottage)\b/.test(d)) return 'village';
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
/**
 * Hebrew word boundary helper.
 * JS \b doesn't work with Hebrew chars — they aren't \w.
 * Use lookbehind/lookahead for non-Hebrew-letter boundaries instead.
 */
function heWord(word: string): RegExp {
  // Match word surrounded by non-Hebrew-letter chars (or start/end of string)
  return new RegExp(`(?<=[^א-ת]|^)${word}(?=[^א-ת]|$)`, 'g');
}

function detectStoryGender(text: string): 'female' | 'male' | null {
  // Strip niqqud + cantillation — they break regex and aren't needed for gender detection
  const clean = text.replace(/\p{M}/gu, '');

  // Feminine markers (pronouns + common past-tense verbs)
  const feminineWords = [
    'היא', 'אותה', 'שלה',
    'הרגישה', 'הסתכלה', 'אמרה', 'רצתה', 'ידעה',
    'ראתה', 'הלכה', 'ישבה', 'עמדה', 'נתנה', 'לקחה', 'שמעה',
    'רצה', 'עשתה', 'חשבה', 'הביטה', 'נשמה', 'לחשה',
  ];
  // Masculine markers
  const masculineWords = [
    'הוא', 'אותו', 'שלו',
    'הרגיש', 'הסתכל', 'אמר', 'רצה', 'ידע',
    'ראה', 'הלך', 'ישב', 'עמד', 'נתן', 'לקח', 'שמע',
    'עשה', 'חשב', 'הביט', 'נשם', 'לחש',
  ];

  let femScore = 0;
  let mascScore = 0;

  for (const w of feminineWords) {
    femScore += (clean.match(heWord(w)) || []).length;
  }
  for (const w of masculineWords) {
    mascScore += (clean.match(heWord(w)) || []).length;
  }

  console.log(`[StoryBank] Gender detection: fem=${femScore}, masc=${mascScore}`);

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
7. שמור על תבניות {{patch:...|...|...}} בדיוק כמו שהן — אל תתרגם ואל תשנה את התוכן בתוך הסוגריים
8. החזר JSON בפורמט: {"pages": ["טקסט עמוד 1", "טקסט עמוד 2", ...]}

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
      // gpt-5.x models are served via /v1/responses, not /v1/chat/completions.
      // Auto-route to avoid silent 400s that previously made gender swap a no-op.
      const useResponsesAPI = model.startsWith('gpt-5.') || model.includes('-pro');

      if (useResponsesAPI) {
        const body: Record<string, unknown> = {
          model,
          max_output_tokens: 4000,
          input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          text: { format: { type: 'json_object' } },
        };
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`OpenAI Responses ${res.status}: ${await res.text()}`);
        const data = await res.json();
        responseText =
          data.output_text ??
          data.output?.find((item: { type?: string; content?: Array<{ type?: string; text?: string }> }) => item.type === 'message')
            ?.content?.find((c: { type?: string; text?: string }) => c.type === 'output_text')?.text ??
          '';
      } else {
        const body: Record<string, unknown> = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 4000,
        };
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
        const data = await res.json();
        responseText = data.choices?.[0]?.message?.content ?? '';
      }
    }

    // Parse JSON response
    const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    if (!cleaned) {
      console.warn('[StoryBank] Gender swap returned empty response. Skipping swap.');
      return pages.map(p => p.text);
    }
    const parsed = JSON.parse(cleaned) as { pages?: string[] };

    if (!Array.isArray(parsed.pages) || parsed.pages.length !== pages.length) {
      console.warn(`[StoryBank] Gender swap returned ${parsed.pages?.length ?? 0} pages, expected ${pages.length}. Skipping swap.`);
      return pages.map(p => p.text);
    }

    console.log(`[StoryBank] Gender swap SUCCESS — ${parsed.pages.length} pages swapped from ${fromGender} to ${toGender}.`);
    return parsed.pages;
  } catch (error) {
    console.error(`[StoryBank] Gender swap LLM call FAILED, keeping original ${fromGender} text. Model=${model}. Error:`, error);
    return pages.map(p => p.text);
  }
}

/**
 * Naturally weave the child's real name into the story.
 *
 * The story-bank templates use generic "הילד"/"הילדה" because they're written
 * before we know who's reading. This pass takes the whole story + the child's
 * actual name and rewrites the text so the name appears 2-4 times in natural
 * spots (opening, emotional turning points, ending) — replacing some, NOT all,
 * generic "הילד"/"הילדה" mentions. Over-using the name feels robotic.
 *
 * Single LLM call for the full story so the model can pick GOOD spots.
 */
async function personalizeChildName(
  pages: StoryPage[],
  childName: string,
  childGender: 'female' | 'male'
): Promise<string[]> {
  const provider = process.env.STORY_PROVIDER || 'openai';
  const model = process.env.PIPELINE_SUPPORT_MODEL ||
    (provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini');

  const childWord = childGender === 'female' ? 'הילדה' : 'הילד';
  const pagesBlock = pages.map(p => `=== עמוד ${p.pageNumber} ===\n${p.text}`).join('\n\n');

  const systemPrompt = `אתה עורך לשוני מקצועי לעברית ספרותית לילדים. תפקידך לשלב את שם הילד/ה בתוך הסיפור באופן שירגיש כמו ספר שנכתב במיוחד עבור הילד/ה הזה/הזו. השם חייב להופיע כמה פעמים — לא בכל שורה, אבל מספיק כדי שהקוראים ירגישו שהסיפור הוא עליה/עליו ספציפית.`;

  const userPrompt = `שם הילד/ה: ${childName}
מספר עמודים בסיפור: ${pages.length}

כללים מחייבים:

1. החלף לפחות 5-7 הופעות של "${childWord}" / "ילד/ה" בשם "${childName}".
   - לסיפור של 10-15 עמודים: 5-6 החלפות.
   - לסיפור של 20 עמודים: 6-8 החלפות.
   - **השם חייב להופיע ב-עמוד הראשון** (פתיחה).
   - **השם חייב להופיע ב-עמוד האחרון** (סיום).
   - שלוש-ארבע הופעות נוספות במקומות החזקים: רגע רגשי, רגע של קונפליקט, רגע של פתרון.

2. אל תחליף את כל ההופעות — אם יש 12 פעמים "${childWord}" בסיפור, תחליף 5-7 בלבד. השאר נשארות "${childWord}".

3. אל תחליף "הוא"/"היא"/"אני"/"אותה"/"אותו" או כינויי גוף — רק את המילים "${childWord}" / "ילד/ה" (במקרים שמחליפים מפורשות שם דמות).

4. אל תוסיף ואל תמחק שום מילה אחרת. שמור על מבנה פסקאות, ניקוד, וסימני פיסוק בדיוק.

5. אל תיגע בתבניות {{patch:...}} או בשמות דמויות אחרות (companion וכו').

6. השם "${childName}" צריך להיכנס כ-SUBJECT (נושא) של משפט פעולה, לא כ-OBJECT (מושא). לדוגמה: "${childName} הולכת..." טוב יותר מ-"הענק רואה את ${childName}".

7. החזר JSON בפורמט: {"pages": ["טקסט עמוד 1", "טקסט עמוד 2", ...]} — אורך המערך זהה למקור (${pages.length} עמודים).

הטקסט:
${pagesBlock}`;

  try {
    let responseText = '';

    if (provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 4000, temperature: 0.3,
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
      const useResponsesAPI = model.startsWith('gpt-5.') || model.includes('-pro');

      if (useResponsesAPI) {
        const body: Record<string, unknown> = {
          model, max_output_tokens: 4000,
          input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          text: { format: { type: 'json_object' } },
        };
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`OpenAI Responses ${res.status}: ${await res.text()}`);
        const data = await res.json();
        responseText = data.output_text ??
          data.output?.find((item: { type?: string; content?: Array<{ type?: string; text?: string }> }) => item.type === 'message')
            ?.content?.find((c: { type?: string; text?: string }) => c.type === 'output_text')?.text ??
          '';
      } else {
        const body: Record<string, unknown> = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.45,
          max_tokens: 4000,
        };
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
        const data = await res.json();
        responseText = data.choices?.[0]?.message?.content ?? '';
      }
    }

    const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    if (!cleaned) {
      console.warn('[StoryBank] Name personalization returned empty — keeping generic text.');
      return pages.map(p => p.text);
    }
    const parsed = JSON.parse(cleaned) as { pages?: string[] };
    if (!Array.isArray(parsed.pages) || parsed.pages.length !== pages.length) {
      console.warn(`[StoryBank] Name personalization returned ${parsed.pages?.length ?? 0} pages, expected ${pages.length}. Skipping.`);
      return pages.map(p => p.text);
    }
    return parsed.pages;
  } catch (error) {
    console.error('[StoryBank] Name personalization LLM call failed — keeping generic text:', error);
    return pages.map(p => p.text);
  }
}




/**
 * Use Claude Vision to extract a child's facial features from an uploaded photo.
 * Returns a tight 30-50 word physical description used to anchor the generated
 * character to the real child. Returns null if the photo is unavailable or the
 * call fails — caller MUST handle null gracefully (falls back to story-derived DNA).
 *
 * The output is INJECTED into the image-generation prompt as a HARD constraint
 * so every page renders a child who actually resembles the user's real child.
 */
export async function describeChildFromPhoto(photoUrl: string): Promise<string | null> {
  if (!photoUrl || photoUrl.trim().length === 0) return null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[StoryBank/PhotoVision] ANTHROPIC_API_KEY missing — photo description skipped.');
    return null;
  }

  const systemPrompt = "You are a children's book illustrator describing a real child's appearance so that another illustrator can draw a cartoon version that clearly resembles them. Be specific about facial features that are recognizable. Never describe emotions, expressions, or clothing — only stable physical features.";

  const userPrompt = `Look at this photo of a child and describe their PHYSICAL APPEARANCE for a children's-book illustrator who needs to draw a cartoon version that clearly looks like THIS specific child.

Describe in 40-60 words, covering ONLY:
- Face shape (round, oval, heart-shaped)
- Skin tone (warm pale, light olive, medium tan, deep brown, etc — be specific)
- Hair: exact color, length, texture (straight/wavy/curly), and how it falls
- Eyes: shape (round/almond/upturned) and color
- Distinctive features: freckles, dimples, gap teeth, glasses, eyebrow shape, prominent cheeks, etc.

DO NOT describe:
- Clothing, accessories, jewelry
- Emotion, expression, mood
- Background, lighting, photo quality
- Age or gender (the illustrator already has those)

Return ONLY the description as plain text — no preamble, no JSON, no quotes. Just the description.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: photoUrl } },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`[StoryBank/PhotoVision] Claude Vision ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const description: string = data.content?.[0]?.text?.trim() ?? '';
    if (description.length < 20) {
      console.warn(`[StoryBank/PhotoVision] Description too short (${description.length} chars), discarding.`);
      return null;
    }
    console.log(`[StoryBank/PhotoVision] Got description (${description.length} chars): "${description.slice(0, 120)}..."`);
    return description;
  } catch (err) {
    console.error('[StoryBank/PhotoVision] Failed to call Claude Vision:', err);
    return null;
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
  /** Optional Claude-Vision-derived description of the real child's face,
   *  produced by describeChildFromPhoto(). When present, the LLM is told
   *  the generated child MUST closely match these physical features. */
  childPhotoDescription?: string | null;
}): Promise<StoryBankCharacterDNA> {
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

${params.childPhotoDescription ? `\n⚠️  REAL CHILD PHOTO REFERENCE (HIGHEST PRIORITY — OVERRIDES STORY DEFAULTS):\nThe person reading this book has uploaded a photo of the REAL child. Here is the description of their face:\n\n"${params.childPhotoDescription}"\n\nThe character you describe MUST clearly resemble this real child. Their face, skin tone, hair color/length/texture, eye shape/color, and any distinctive features above MUST be reflected in your "face", "hair", and "signature" fields below. Do NOT invent different features. This is the most important constraint.\n` : ''}

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
    "coloring": "10-15 words: exact colors and markings",
    "feature": "5-10 words: one distinctive visual feature"
  },
  "childDNA": "40-60 words: flat paragraph combining all child fields above (backward compat)",
  "companionDNA": "20-30 words: flat paragraph combining all companion fields above",
  "worldDNA": "20-30 words: weather, time, palette, ground condition",
  "propDNA": {
    "object_name": "15-25 word locked visual description",
    "another_object": "15-25 word locked visual description"
  },
  "negativeRules": [
    "NEVER put text, letters, numbers, or words on clothing, walls, signs, or any surface",
    "NEVER change the child's outfit, hair, or accessories between pages",
    "Rule 3",
    "Rule 4"
  ]
}
`.trim();

  const genderWord = params.childGender === 'girl' ? 'girl' : 'boy';


  const fallbackChildStructured: StructuredChildDNA = {
    face: `Round soft face, warm light olive skin, large dark brown almond-shaped eyes, small upturned nose`,
    hair: `Medium-length straight brown hair, tucked behind ears, thin red fabric headband`,
    body: `Average build for a ${params.childAge}-year-old ${genderWord}, about ${params.childAge >= 5 ? '3.5' : '3'} feet tall`,
    clothing: `Yellow rain jacket with two front pockets, blue denim shorts, white canvas sneakers`,
    signature: `Always carries a worn stuffed bunny in left hand`,
  };
  const fallbackCompanionStructured: StructuredCompanionDNA = {
    species: 'cat',
    size: `Small, fits comfortably in the child's arms`,
    coloring: `${'Orange tabby with white chest patch'}`,
    feature: `Big round curious eyes that always look directly at the child`,
  };
  const fallback: StoryBankCharacterDNA = {
    childStructured: fallbackChildStructured,
    companionStructured: fallbackCompanionStructured,
    childDNA: `${fallbackChildStructured.face}. ${fallbackChildStructured.hair}. ${fallbackChildStructured.body}. ${fallbackChildStructured.clothing}. ${fallbackChildStructured.signature}.`,
    companionDNA: `${fallbackCompanionStructured.species}, ${fallbackCompanionStructured.size}. ${fallbackCompanionStructured.coloring}. ${fallbackCompanionStructured.feature}.`,
    worldDNA: 'Warm soft natural lighting, gentle depth-of-field, environment described per page imageDirection (do NOT default to bedroom/indoor — honor whatever setting each page specifies, including underwater/forest/sky/etc).',
    propDNA: {},
    negativeRules: [
      "NEVER put text, letters, numbers, or words on clothing, walls, signs, or any surface",
      "NEVER change the child's outfit, hair, or accessories between pages",
    ],
  };

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY missing');
    const model = process.env.STORY_GENERATION_MODEL || 'gpt-4o';
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

    return assembleDNA(parsed, fallback);
  } catch (error) {
    console.warn('[StoryBankDNA] failed, using fallback DNA:', error);
    return fallback;
  }

  /** Merge LLM output with fallback, validating structured fields. */
  function assembleDNA(
    parsed: Partial<StoryBankCharacterDNA>,
    fb: StoryBankCharacterDNA
  ): StoryBankCharacterDNA {
    // Validate structured child fields — each must be a non-empty string
    const cs = parsed.childStructured;
    const childStructured: StructuredChildDNA =
      cs &&
      typeof cs.face === 'string' && cs.face.trim().length > 5 &&
      typeof cs.hair === 'string' && cs.hair.trim().length > 5 &&
      typeof cs.body === 'string' && cs.body.trim().length > 5 &&
      typeof cs.clothing === 'string' && cs.clothing.trim().length > 5 &&
      typeof cs.signature === 'string' && cs.signature.trim().length > 3
        ? {
            face: cs.face.trim(),
            hair: cs.hair.trim(),
            body: cs.body.trim(),
            clothing: cs.clothing.trim(),
            signature: cs.signature.trim(),
          }
        : fb.childStructured;

    // Validate structured companion fields
    const cps = parsed.companionStructured;
    const companionStructured: StructuredCompanionDNA =
      cps &&
      typeof cps.species === 'string' && cps.species.trim().length > 2 &&
      typeof cps.size === 'string' && cps.size.trim().length > 3 &&
      typeof cps.coloring === 'string' && cps.coloring.trim().length > 5 &&
      typeof cps.feature === 'string' && cps.feature.trim().length > 3
        ? {
            species: cps.species.trim(),
            size: cps.size.trim(),
            coloring: cps.coloring.trim(),
            feature: cps.feature.trim(),
          }
        : fb.companionStructured;

    // Build flat DNA from structured if LLM didn't provide it
    const childDNA =
      parsed.childDNA?.trim() ||
      `${childStructured.face}. ${childStructured.hair}. ${childStructured.body}. ${childStructured.clothing}. ${childStructured.signature}.`;
    const companionDNA =
      parsed.companionDNA?.trim() ||
      `${companionStructured.species}, ${companionStructured.size}. ${companionStructured.coloring}. ${companionStructured.feature}.`;

    const result: StoryBankCharacterDNA = {
      childStructured,
      companionStructured,
      childDNA,
      companionDNA,
      worldDNA: parsed.worldDNA?.trim() || fb.worldDNA,
      propDNA: parsePropDNA(parsed.propDNA, fb.propDNA),
      negativeRules:
        parsed.negativeRules?.filter(
          (rule): rule is string => typeof rule === 'string' && !!rule.trim()
        ) ?? fb.negativeRules,
    };

    console.log(
      `[StoryBankDNA] Structured child: face=${childStructured.face.length}ch hair=${childStructured.hair.length}ch clothing=${childStructured.clothing.length}ch signature="${childStructured.signature}"`
    );
    console.log(
      `[StoryBankDNA] Structured companion: species="${companionStructured.species}" coloring=${companionStructured.coloring.length}ch feature="${companionStructured.feature}"`
    );

    return result;
  }
}
