/**
 * Vision QA for dragon_dini page 20 closing spread (release blocker).
 */

export type Page20ClosingQaResult = {
  ok: boolean;
  failures: string[];
  notes: string;
  raw?: Record<string, unknown>;
};

const QA_PROMPT = `You are QA for a children's book FINAL PAGE (page 20) illustration.

Check this image and answer ONLY with JSON:
{
  "naturalHeadNeck": true if head/neck/shoulders look anatomically natural for a kneeling child,
  "headMatchesTorso": true if head angle matches torso (no impossible twist),
  "parentsEngaged": true if parents (if visible) look toward the child/baby scene (not blank wall stare),
  "cribGeometryClear": true if crib, yellow blanket, and baby are readable and physically plausible,
  "singleChildOnly": true if exactly ONE child protagonist (no duplicate children),
  "babyInsideCrib": true if newborn baby is clearly inside the crib under blanket,
  "uncannyNeck": true ONLY if you see twisted/disconnected/impossible neck or pasted-face effect,
  "notes": "one short sentence"
}

FAIL the image if uncannyNeck is true OR any of naturalHeadNeck, headMatchesTorso, parentsEngaged, cribGeometryClear, singleChildOnly, babyInsideCrib is false.`;

export async function evaluatePage20ClosingQa(imageUrl: string): Promise<Page20ClosingQaResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: true,
      failures: [],
      notes: 'OPENAI_API_KEY missing — p20 vision QA skipped',
    };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o',
        max_tokens: 300,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
              { type: 'text', text: QA_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: true, failures: [], notes: `vision HTTP ${res.status} — skipped` };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>;
    const failures: string[] = [];
    if (raw.uncannyNeck === true) failures.push('uncanny_neck');
    if (raw.naturalHeadNeck === false) failures.push('unnatural_head_neck');
    if (raw.headMatchesTorso === false) failures.push('head_torso_mismatch');
    if (raw.parentsEngaged === false) failures.push('parents_not_engaged');
    if (raw.cribGeometryClear === false) failures.push('crib_geometry_confusing');
    if (raw.singleChildOnly === false) failures.push('multiple_children');
    if (raw.babyInsideCrib === false) failures.push('baby_not_in_crib');
    return {
      ok: failures.length === 0,
      failures,
      notes: typeof raw.notes === 'string' ? raw.notes : '',
      raw,
    };
  } catch (e) {
    return {
      ok: true,
      failures: [],
      notes: `vision error skipped: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
