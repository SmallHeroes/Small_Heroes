/**
 * Story Provider — AI Story Generation
 * Abstraction layer for story generation.
 * Swap provider (OpenAI, Anthropic, etc.) via env var.
 */

import { STORY_LENGTHS } from '../config/wizard';

// ─── Types ────────────────────────────────────────────
export interface StoryInput {
  childName: string;
  childAge?: number | null;
  childGender?: string | null;
  childTraits: string[];
  topic: string;
  topicLabel: string;
  challengeItems: string[];
  challengeFree?: string;
  outcomeItems: string[];
  outcomeFree?: string;
  helperItems: string[];
  helperFree?: string;
  avoidItems: string[];
  avoidFree?: string;
  storyLength: 'short' | 'medium' | 'long';
  illustrationStyle: string;
}

export interface StoryPage {
  pageNumber: number;
  text: string;           // display text
  narrationText: string;  // read-aloud text (may have pauses, softer pacing)
  imagePrompt: string;    // prompt for image generation
}

export interface GeneratedStory {
  title: string;
  coverText: string;
  pages: StoryPage[];
  meta: {
    provider: string;
    model: string;
    tokens?: number;
  };
}

// ─── Prompt Builder ───────────────────────────────────
export function buildStoryPrompt(input: StoryInput): string {
  const len = STORY_LENGTHS.find(l => l.id === input.storyLength) ?? STORY_LENGTHS[1];
  const genderWord = input.childGender === 'girl' ? 'ילדה' : input.childGender === 'boy' ? 'ילד' : 'ילד';
  const heroRef = input.childGender === 'girl' ? 'היא' : 'הוא';
  const traitsText = input.childTraits.length > 0 ? `הילד/ה ${input.childTraits.join(', ')}.` : '';
  const challengeText = [...input.challengeItems, input.challengeFree].filter(Boolean).join(', ');
  const outcomeText = [...input.outcomeItems, input.outcomeFree].filter(Boolean).join(', ');
  const helperText = [...input.helperItems, input.helperFree].filter(Boolean).join(', ');
  const avoidText = [...input.avoidItems, input.avoidFree].filter(Boolean).join(', ');

  return `
אתה כותב ספר ילדים אישי, קסום ורגשי בעברית.

**מידע על הגיבור:**
- שם: ${input.childName}
- גיל: ${input.childAge || 'לא ידוע'}
- ${genderWord}
- תכונות: ${traitsText || 'לא צוינו'}

**נושא הסיפור:** ${input.topicLabel}

**מה קשה לו/ה כרגע:** ${challengeText || 'לא צוין'}

**מה ההורים מקווים שישתנה:** ${outcomeText || 'לא צוין'}

**מה עוזר לו/ה להרגיש טוב:** ${helperText || 'לא צוין'}

**מה לא להכניס לסיפור:** ${avoidText || 'לא צוין'}

**אורך הסיפור:** ${len.pages} עמודים

---

**הנחיות יצירה:**
1. כתוב ספר ילדים קסום ורגשי בעברית תקנית ופשוטה.
2. ${input.childName} הוא/היא הגיבור/ת הראשי/ת — הסיפור עוסק בו/ה.
3. הטון: חם, מרגיע, בטוח, קסום, אוהב.
4. כלול בעדינות: האתגר, ההתמודדות, הצמיחה — אבל בצורה עקיפה ומרגיעה.
5. אל תכניס ישירות את הפריטים מהרשימה — שלב אותם בצורה טבעית ועלילתית.
6. כל עמוד: 2-4 משפטים בלבד.
7. סיום: חיובי, מחזק, אופטימי.

**פורמט פלט — JSON בלבד:**
\`\`\`json
{
  "title": "כותרת הספר",
  "coverText": "טקסט קצר לעטיפה",
  "pages": [
    {
      "pageNumber": 1,
      "text": "טקסט עמוד לתצוגה",
      "narrationText": "טקסט קריינות (יכול לכלול ...... להפסקות)",
      "imagePrompt": "Detailed English prompt for image AI: soft children book illustration, [specific scene], warm colors, [character description], [style]"
    }
  ]
}
\`\`\`
`;
}

// ─── Provider: OpenAI ─────────────────────────────────
async function generateWithOpenAI(input: StoryInput): Promise<GeneratedStory> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const model = process.env.STORY_MODEL || 'gpt-4o';
  const prompt = buildStoryPrompt(input);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'אתה כותב ספרי ילדים מקצועי ורגיש. אתה כותב אך ורק בעברית. אתה מחזיר JSON תקני בלבד.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI story error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  const story = JSON.parse(content) as GeneratedStory;

  story.meta = {
    provider: 'openai',
    model,
    tokens: data.usage?.total_tokens,
  };

  return story;
}

// ─── Provider: Anthropic Claude ───────────────────────
async function generateWithClaude(input: StoryInput): Promise<GeneratedStory> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = process.env.STORY_MODEL || 'claude-opus-4-5';
  const prompt = buildStoryPrompt(input);

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
      system: 'אתה כותב ספרי ילדים מקצועי ורגיש. אתה כותב אך ורק בעברית. אתה מחזיר JSON תקני בלבד.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude story error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.content[0].text;
  // Extract JSON from possible markdown code block
  const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const story = JSON.parse(jsonStr) as GeneratedStory;

  story.meta = { provider: 'anthropic', model, tokens: data.usage?.output_tokens };
  return story;
}

// ─── Main Entry Point ─────────────────────────────────
export async function generateStory(input: StoryInput): Promise<GeneratedStory> {
  const provider = process.env.STORY_PROVIDER || 'openai'; // 'openai' | 'anthropic'

  switch (provider) {
    case 'anthropic': return generateWithClaude(input);
    case 'openai':
    default:          return generateWithOpenAI(input);
  }
}
