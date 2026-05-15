#!/usr/bin/env node
/**
 * probe-openai-models.mjs — Test which GPT-5 variants your account can access
 *
 * Tries each model name with a minimal prompt and reports:
 *   ✅ — works and returns text
 *   🟠 — works but returns empty (silent failure)
 *   ❌ — returns API error (model not found / no access)
 *
 * Usage: OPENAI_API_KEY=... node scripts/probe-openai-models.mjs
 */

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('❌ Set OPENAI_API_KEY'); process.exit(1); }

// Candidate model names — order roughly from most to least likely
const CANDIDATES = [
  // Main gpt-5 family
  'gpt-5',
  'gpt-5-pro',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-chat-latest',
  'gpt-5.3-chat-latest',  // known working from prior runs
  'gpt-5.5',
  'gpt-5.5-pro',
  'gpt-5.5-chat-latest',
  // Variants with date stamps (these are guesses — OpenAI uses YYYY-MM-DD)
  'gpt-5-pro-latest',
  'gpt-5-pro-2025-01-01',
  // Reasoning families
  'o1',
  'o1-pro',
  'o3',
  'o3-pro',
  'o3-mini',
];

const TEST_PROMPT = 'Return only this JSON, nothing else: {"ok":true,"model_says":"hello"}';

async function listModels() {
  console.log('📋 Fetching available models list from /v1/models...\n');
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) {
      console.log(`   ⚠️  /v1/models returned ${res.status} — skipping listing\n`);
      return null;
    }
    const data = await res.json();
    const ids = (data.data || []).map(m => m.id).sort();
    const gpt5 = ids.filter(id => /^(gpt-5|o[1-9])/.test(id));
    console.log(`   Found ${ids.length} models total; ${gpt5.length} match gpt-5* or o*:\n`);
    gpt5.forEach(id => console.log(`     • ${id}`));
    console.log('');
    return gpt5;
  } catch (err) {
    console.log(`   ⚠️  Listing failed: ${err.message}\n`);
    return null;
  }
}

async function tryResponsesAPI(model) {
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: [{ role: 'user', content: TEST_PROMPT }],
        max_output_tokens: 200,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { status: 'error', http: res.status, message: err.slice(0, 200) };
    }

    const data = await res.json();
    const output = data.output || [];
    const text = output
      .filter(i => i.type === 'message')
      .flatMap(m => m.content || [])
      .filter(c => c.type === 'output_text')
      .map(c => c.text)
      .join('')
      .trim();

    const outputTypes = output.map(o => o.type).join(',') || 'none';
    const inTok = data.usage?.input_tokens || 0;
    const outTok = data.usage?.output_tokens || 0;
    const status = data.status || 'no status';

    if (!text) {
      return { status: 'empty', http: 200, outputTypes, inTok, outTok, modelStatus: status };
    }
    return { status: 'ok', http: 200, text: text.slice(0, 120), outputTypes, inTok, outTok };
  } catch (err) {
    return { status: 'error', http: 0, message: err.message };
  }
}

async function tryChatCompletionsAPI(model) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: TEST_PROMPT }],
        max_completion_tokens: 200,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { status: 'error', http: res.status, message: err.slice(0, 200) };
    }

    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || '').trim();
    if (!text) return { status: 'empty', http: 200 };
    return { status: 'ok', http: 200, text: text.slice(0, 120) };
  } catch (err) {
    return { status: 'error', http: 0, message: err.message };
  }
}

function emoji(status) {
  return status === 'ok' ? '✅' : status === 'empty' ? '🟠' : '❌';
}

async function main() {
  console.log(`🔎 OpenAI Model Probe`);
  console.log(`   Testing ${CANDIDATES.length} candidate model names`);
  console.log(`   Two endpoints: /v1/responses + /v1/chat/completions\n`);

  // Step 1: list models (if endpoint allowed)
  const listed = await listModels();

  // Step 2: probe each candidate via both APIs
  console.log('─'.repeat(80));
  console.log('Model name'.padEnd(35) + '  ' + 'Responses API'.padEnd(20) + '  ' + 'Chat Completions');
  console.log('─'.repeat(80));

  const results = [];
  for (const model of CANDIDATES) {
    const respResult = await tryResponsesAPI(model);
    const chatResult = await tryChatCompletionsAPI(model);

    const respCell = `${emoji(respResult.status)} ${respResult.status === 'error' ? `${respResult.http}` : respResult.status}`;
    const chatCell = `${emoji(chatResult.status)} ${chatResult.status === 'error' ? `${chatResult.http}` : chatResult.status}`;

    console.log(model.padEnd(35) + '  ' + respCell.padEnd(20) + '  ' + chatCell);
    results.push({ model, responses: respResult, chat: chatResult });
  }

  console.log('─'.repeat(80));
  console.log('\n📊 Working models (✅ on at least one API):');
  for (const r of results) {
    if (r.responses.status === 'ok' || r.chat.status === 'ok') {
      const apis = [];
      if (r.responses.status === 'ok') apis.push(`Responses (${r.responses.outTok}tok out)`);
      if (r.chat.status === 'ok') apis.push('Chat Completions');
      console.log(`   ✅ ${r.model}  →  ${apis.join(', ')}`);
    }
  }

  console.log('\n🟠 Silent-failure models (empty response, look like work but don\'t):');
  for (const r of results) {
    if ((r.responses.status === 'empty' || r.chat.status === 'empty') &&
        !(r.responses.status === 'ok' || r.chat.status === 'ok')) {
      console.log(`   🟠 ${r.model}  →  empty text but HTTP 200 (check usage: input=${r.responses.inTok}, output=${r.responses.outTok})`);
    }
  }

  console.log('\n❌ Inaccessible models (auth/not found errors):');
  for (const r of results) {
    if (r.responses.status === 'error' && r.chat.status === 'error') {
      const msg = (r.responses.message || r.chat.message || '').slice(0, 80);
      console.log(`   ❌ ${r.model}  →  ${msg}`);
    }
  }

  // Recommendation
  console.log('\n💡 Recommendation:');
  const workingResponses = results.find(r => r.responses.status === 'ok' && /gpt-5|gpt-5\.5|o\d/i.test(r.model));
  if (workingResponses) {
    console.log(`   Use SKELETON_MODEL=${workingResponses.model} (Responses API)`);
  } else {
    const workingChat = results.find(r => r.chat.status === 'ok' && /gpt-5|gpt-5\.5|o\d/i.test(r.model));
    if (workingChat) {
      console.log(`   Use SKELETON_MODEL=${workingChat.model} BUT switch v5 script to Chat Completions API`);
    } else {
      console.log(`   No gpt-5/o-series models work. Fallback to gpt-4o or gpt-4.1.`);
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
