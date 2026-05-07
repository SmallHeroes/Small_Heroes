# Phase 7a — GPT-5.3 Pro for Story Generation

## Goal
Switch story generation from `gpt-5.3-chat-latest` (Chat Completions API) to `gpt-5.3-pro` (Responses API) for dramatically better prompt adherence on our strict story format.

## Why
GPT-5.3 Pro produces significantly better adherence to long, strict story prompts:
- 15 pages exactly
- Hebrew native children's literature tone
- 35–55 words per page, hard floor 30 words
- Pages 11–13 minimum 40 words (climax density)
- Physical climax, child failure, cost, causal chain
- Page 13 direct trigger

The Chat model sometimes drifts on these constraints. Pro with `reasoning.effort: "xhigh"` nails them.

## Important Notes
- `gpt-5.3-pro` may NOT be listed in public OpenAI model docs for all accounts
- Availability depends on project/API key access level
- This is why we use env-based model selection — private/early-access model IDs can be supplied without code changes
- The publicly documented Pro model is `gpt-5.2-pro`, but we want `gpt-5.3-pro` if the account has access

---

## Changes Required

### 1. New env variables

Add to `.env` and `.env.example`:

```env
# Story generation model — highest quality for story writing
# gpt-5.3-pro requires explicit project access. If unavailable, system fails loudly.
STORY_MODEL=gpt-5.3-pro
STORY_REASONING_EFFORT=xhigh
STORY_VERBOSITY=high

# Optional explicit fallback. Leave empty to fail loudly instead of silently downgrading.
FALLBACK_STORY_MODEL=
```

### 2. Rewrite `callLLMOnce()` in `backend/providers/pipeline.ts`

Current code uses Chat Completions API (`/v1/chat/completions`) for all OpenAI calls.

**For Pro/reasoning models** → switch to OpenAI Responses API.
**For non-reasoning models** (chat-latest, gpt-4o) → keep Chat Completions as-is.

Detection: if the model name contains `-pro` or if `STORY_REASONING_EFFORT` is set, use Responses API.

Replace the OpenAI section of `callLLMOnce()` (lines ~575-598) with:

```typescript
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY not set');
const model = process.env.STORY_MODEL || 'gpt-5.3-pro';
const reasoningEffort = process.env.STORY_REASONING_EFFORT || '';
const verbosity = process.env.STORY_VERBOSITY || '';

console.log(`[Pipeline][${stage}] model=${model}, provider=${provider}, jsonMode=${jsonMode}, reasoning=${reasoningEffort}, verbosity=${verbosity}`);

// Use Responses API for reasoning/pro models
const useResponsesAPI = model.includes('-pro') || !!reasoningEffort;

if (useResponsesAPI) {
  const body: Record<string, unknown> = {
    model,
    max_output_tokens: maxTokens,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  if (reasoningEffort) {
    body.reasoning = { effort: reasoningEffort };
  }
  if (verbosity) {
    body.text = { verbosity };
  }
  if (jsonMode) {
    body.text = { ...(body.text as object || {}), format: { type: 'json_object' } };
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Check if model is unavailable
    if (res.status === 404 || errText.includes('does not exist') || errText.includes('not found')) {
      const fallback = process.env.FALLBACK_STORY_MODEL;
      if (!fallback) {
        throw new Error(
          `[${stage}] STORY_MODEL=${model} is not available for this API key/project. ` +
          `Do not fallback silently. Either request access to ${model} or set FALLBACK_STORY_MODEL. ` +
          `Original error: ${res.status} ${errText.slice(0, 200)}`
        );
      }
      console.warn(`[Pipeline][${stage}] ${model} unavailable, falling back to FALLBACK_STORY_MODEL=${fallback}`);
      // Recursive call with fallback — override env temporarily
      const origModel = process.env.STORY_MODEL;
      process.env.STORY_MODEL = fallback;
      process.env.STORY_REASONING_EFFORT = ''; // fallback likely doesn't support reasoning
      try {
        return await callLLMOnce(systemPrompt, userPrompt, maxTokens, temperature, stage, jsonMode);
      } finally {
        process.env.STORY_MODEL = origModel;
        process.env.STORY_REASONING_EFFORT = reasoningEffort;
      }
    }
    throw new Error(`[${stage}] OpenAI Responses ${res.status}: ${errText}`);
  }

  const data = await res.json();
  // Responses API returns output array with text content
  const outputText = data.output?.find((o: any) => o.type === 'message')?.content
    ?.find((c: any) => c.type === 'output_text')?.text ?? '';
  const tokens = data.usage?.total_tokens ?? 0;
  return { text: outputText, tokens };

} else {
  // Existing Chat Completions path for non-reasoning models
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
  };
  if (model.startsWith('gpt-5.')) {
    body.max_completion_tokens = maxTokens;
  } else {
    body.max_tokens = maxTokens;
    body.temperature = temperature;
  }
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`[${stage}] OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: data.choices[0].message.content, tokens: data.usage?.total_tokens ?? 0 };
}
```

### 3. Do NOT use Pro for every pipeline step

This is critical for cost control:

| Pipeline Stage | Model | Why |
|---|---|---|
| Brain (concept) | STORY_MODEL (Pro) | Needs deep reasoning for story architecture |
| Outline | STORY_MODEL (Pro) | Page-by-page structure needs precision |
| Prose 3A–3D | STORY_MODEL (Pro) | Core story writing — must be highest quality |
| Visual Bible | Keep `gpt-5.3-chat-latest` | Character description, doesn't need reasoning |
| Composition/Shots | Keep `gpt-5.3-chat-latest` | Image prompts, cheaper model is fine |
| QA | Keep `gpt-5.3-chat-latest` | Validation, not generation |

**Implementation**: Add a separate env var for non-critical stages:
```env
# Cheaper model for non-story stages (visual bible, image prompts, QA)
PIPELINE_SUPPORT_MODEL=gpt-5.3-chat-latest
```

Add to `callLLMOnce` a parameter or use a stage-based model selector:
```typescript
function getModelForStage(stage: string): string {
  const storyStages = ['Brain', 'Outline', 'Prose-3A', 'Prose-3B', 'Prose-3C', 'Prose-3D'];
  if (storyStages.includes(stage)) {
    return process.env.STORY_MODEL || 'gpt-5.3-pro';
  }
  return process.env.PIPELINE_SUPPORT_MODEL || process.env.STORY_MODEL || 'gpt-5.3-chat-latest';
}
```

### 4. Update story-bank-loader.ts

Line 242 currently hardcodes `gpt-5.3-chat-latest` for Visual Bible DNA generation.
This is correct — keep it on the cheaper model. But make it read from env:
```typescript
const model = process.env.PIPELINE_SUPPORT_MODEL || 
  (provider === 'anthropic' ? 'claude-opus-4-5' : 'gpt-5.3-chat-latest');
```

### 5. Update `.env`

```env
STORY_MODEL=gpt-5.3-pro
STORY_REASONING_EFFORT=xhigh
STORY_VERBOSITY=high
FALLBACK_STORY_MODEL=
PIPELINE_SUPPORT_MODEL=gpt-5.3-chat-latest
```

### 6. Update `.env.example`

Add after the existing `STORY_PROVIDER` line:
```env
# Story generation model — Pro models use Responses API with reasoning
# gpt-5.3-pro may not be publicly listed; availability depends on project access.
STORY_MODEL=gpt-5.3-pro
STORY_REASONING_EFFORT=xhigh      # "medium" | "high" | "xhigh"
STORY_VERBOSITY=high               # "low" | "medium" | "high"

# Optional fallback. Leave empty to fail loudly if STORY_MODEL is unavailable.
FALLBACK_STORY_MODEL=

# Cheaper model for non-story pipeline stages (visual bible, image prompts, QA)
PIPELINE_SUPPORT_MODEL=gpt-5.3-chat-latest
```

### 7. Startup validation (optional but recommended)

Add a utility function that runs on first story generation:
```typescript
let modelValidated = false;

async function validateStoryModel(): Promise<void> {
  if (modelValidated) return;
  const model = process.env.STORY_MODEL || 'gpt-5.3-pro';
  console.log(`[Pipeline] Validating story model: ${model}`);
  
  try {
    const res = await fetch('https://api.openai.com/v1/models/' + encodeURIComponent(model), {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    if (!res.ok) {
      console.warn(`[Pipeline] WARNING: STORY_MODEL=${model} may not be available (${res.status}). Will attempt anyway — some models aren't listed but still work.`);
    } else {
      console.log(`[Pipeline] Story model ${model} confirmed available.`);
    }
  } catch (err) {
    console.warn(`[Pipeline] Could not validate model ${model}: ${err}`);
  }
  modelValidated = true;
}
```

Call this at the top of `runStoryPipeline()`.

### 8. Logging

Every `callLLMOnce` call already logs the model. Enhance the log to include reasoning effort:
```
[Pipeline][Brain] model=gpt-5.3-pro, reasoning=xhigh, verbosity=high
[Pipeline][VisualBible] model=gpt-5.3-chat-latest, reasoning=none
```

---

## Files to modify

1. `backend/providers/pipeline.ts` — `callLLMOnce()` rewrite + stage-based model selector
2. `backend/providers/story-bank-loader.ts` — read `PIPELINE_SUPPORT_MODEL` from env
3. `.env` — add new vars
4. `.env.example` — add new vars with docs

## Files NOT to modify
- Image generation code — stays on its own provider
- Frontend — no changes needed
- Database — no schema changes

## Acceptance Criteria

1. Story generation requests use `gpt-5.3-pro` via Responses API
2. No hardcoded `gpt-5.2-pro` or `gpt-5.3-chat-latest` remains in story generation path
3. Visual bible / image prompts / QA use cheaper `PIPELINE_SUPPORT_MODEL`
4. No silent fallback — if `gpt-5.3-pro` is unavailable and `FALLBACK_STORY_MODEL` is empty, error is loud and actionable
5. Logs clearly show which model + reasoning effort was used per stage
6. Generated stories still pass validator (15 pages, word counts, climax rules)
7. Responses API response parsing handles the different output format correctly
