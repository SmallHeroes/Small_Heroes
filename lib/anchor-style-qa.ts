/**
 * Anchor style HARD check — reject photoreal / portrait before resemblance ranking.
 */

export type AnchorStyleQaResult = {
  ok: boolean;
  style01Match: boolean;
  looksPhotoreal: boolean;
  looksPortrait: boolean;
  notes: string;
};

export type AnchorStyle02QaResult = {
  ok: boolean;
  style02Match: boolean;
  looksPhotorealCutout: boolean;
  looksPortrait: boolean;
  notes: string;
};

const STYLE_QA_PROMPT = `You are QA for a children's book anchor portrait.

Look at this generated image and answer ONLY with JSON:
{
  "style01Match": true if clearly a cute simplified hand-drawn watercolor storybook illustration (NOT photoreal),
  "looksPhotoreal": true if it looks like a photograph or semi-realistic digital portrait,
  "looksPortrait": true if tight photographic portrait framing / realistic skin / camera-like lighting,
  "notes": "one short sentence"
}

STYLE FIRST: if photoreal or portrait-like → style01Match must be false.`;

export async function evaluateAnchorStyleFromVision(imageUrl: string): Promise<AnchorStyleQaResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: true,
      style01Match: true,
      looksPhotoreal: false,
      looksPortrait: false,
      notes: 'OPENAI_API_KEY missing — style vision QA skipped',
    };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o',
        max_tokens: 200,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
              { type: 'text', text: STYLE_QA_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return {
        ok: true,
        style01Match: true,
        looksPhotoreal: false,
        looksPortrait: false,
        notes: `style QA HTTP ${res.status} — skipped`,
      };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as {
      style01Match?: boolean;
      looksPhotoreal?: boolean;
      looksPortrait?: boolean;
      notes?: string;
    };
    const style01Match = parsed.style01Match === true;
    const looksPhotoreal = parsed.looksPhotoreal === true;
    const looksPortrait = parsed.looksPortrait === true;
    const ok = style01Match && !looksPhotoreal && !looksPortrait;
    return {
      ok,
      style01Match,
      looksPhotoreal,
      looksPortrait,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };
  } catch (err) {
    return {
      ok: true,
      style01Match: true,
      looksPhotoreal: false,
      looksPortrait: false,
      notes: `style QA error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

const STYLE02_QA_PROMPT = `You are QA for a Style 02 children's book anchor portrait.

Look at this generated image and answer ONLY with JSON:
{
  "style02Match": true if clearly a semi-realistic hand-illustrated cinematic fantasy storybook character (NOT photoreal pasted cutout, NOT soft watercolor Style 01),
  "looksPhotorealCutout": true if it looks like a photograph or photoreal pasted cutout,
  "looksPortrait": true if tight photographic portrait framing / camera-like lighting,
  "notes": "one short sentence"
}

STYLE FIRST: if photoreal cutout or portrait-like → style02Match must be false.`;

export async function evaluateAnchorStyle02FromVision(
  imageUrl: string
): Promise<AnchorStyle02QaResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: true,
      style02Match: true,
      looksPhotorealCutout: false,
      looksPortrait: false,
      notes: 'OPENAI_API_KEY missing — Style 02 style vision QA skipped',
    };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o',
        max_tokens: 200,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
              { type: 'text', text: STYLE02_QA_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return {
        ok: true,
        style02Match: true,
        looksPhotorealCutout: false,
        looksPortrait: false,
        notes: `Style 02 style QA HTTP ${res.status} — skipped`,
      };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as {
      style02Match?: boolean;
      looksPhotorealCutout?: boolean;
      looksPortrait?: boolean;
      notes?: string;
    };
    const style02Match = parsed.style02Match === true;
    const looksPhotorealCutout = parsed.looksPhotorealCutout === true;
    const looksPortrait = parsed.looksPortrait === true;
    const ok = style02Match && !looksPhotorealCutout && !looksPortrait;
    return {
      ok,
      style02Match,
      looksPhotorealCutout,
      looksPortrait,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };
  } catch (err) {
    return {
      ok: true,
      style02Match: true,
      looksPhotorealCutout: false,
      looksPortrait: false,
      notes: `Style 02 style QA error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
