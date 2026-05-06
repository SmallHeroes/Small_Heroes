const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

const argv = new Set(process.argv.slice(2));
const isLive = argv.has('--live');
const hasLiveConfirmation = argv.has('--confirm-live');
const MAX_PAGES = 5;
const MAX_ATTEMPTS_PER_PAGE = 3;

if (isLive && !hasLiveConfirmation) {
  throw new Error('Live generation requires --confirm-live flag');
}

const MODEL_OWNER = 'black-forest-labs';
const MODEL_NAME = 'flux-2-pro';

const STYLE_CONTRACT = [
  'STYLE_ID: soft_hand_drawn_storybook',
  'Pencil linework and watercolor on paper; soft warm hand-illustrated children book look.',
  'Transparent watercolor washes; natural pigment bleed; medium detail.',
  'Airy composition; not digital-painting glossy; hand-painted not a filter.',
].join(' ');

const CHARACTER_BIBLE = [
  'MAIN CHARACTER: Child, boy around 6 years old, short brown hair, big curious eyes, wearing a yellow t-shirt and blue shorts.',
  'RECURRING CHARACTER: Father, tall, warm, slightly rugged look, short dark hair, casual t-shirt and jeans.',
  'SECONDARY CHARACTER: Cat, small orange cat with white paws and green eyes.',
].join(' ');

const pages = [
  {
    pageNumber: 1,
    scene:
      'A curious young boy sits on the floor of his room, building a small cardboard spaceship. His father stands in the doorway smiling, watching him.',
    presentCharacters: ['child', 'father'],
    anchorAssignments: ['child', 'father'],
  },
  {
    pageNumber: 2,
    scene:
      'The boy and his father are outside at night, looking up at the stars. The father points at the sky while the boy holds his small cardboard spaceship.',
    presentCharacters: ['child', 'father'],
    anchorAssignments: [],
  },
  {
    pageNumber: 3,
    scene:
      'The boy imagines flying through space inside his spaceship. He floats among colorful planets and glowing stars, full of excitement and wonder.',
    presentCharacters: ['child'],
    anchorAssignments: [],
  },
  {
    pageNumber: 4,
    scene:
      'Back at home, the boy sits on the couch with his father and their orange cat curled beside him. They look at a book about space together.',
    presentCharacters: ['child', 'father', 'cat'],
    anchorAssignments: ['cat'],
  },
  {
    pageNumber: 5,
    scene:
      'The boy is asleep in bed, holding the small spaceship. The cat sleeps near his feet, and soft moonlight fills the room.',
    presentCharacters: ['child', 'cat'],
    anchorAssignments: [],
  },
];

if (pages.length > MAX_PAGES) {
  throw new Error(`Refusing to run more than ${MAX_PAGES} pages`);
}

const token = process.env.REPLICATE_API_TOKEN;
if (isLive && !token) {
  throw new Error('REPLICATE_API_TOKEN is not set');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildConsistencyBlock(presentCharacters, anchors) {
  const lines = presentCharacters
    .filter((characterId) => Boolean(anchors[characterId]))
    .map((characterId) => `- ${characterId}: ${anchors[characterId]}`);
  if (lines.length === 0) {
    return 'No reference anchors available yet. Keep exact visual continuity from character bible.';
  }
  return [
    'Use the following anchor references to preserve exact identity:',
    ...lines,
    'All recurring characters must match their anchor references exactly in face structure, hair, proportions, identity, and clothing.',
    'Do not redesign any recurring character.',
  ].join('\n');
}

function buildPrompt(page, anchors) {
  const consistencyBlock = buildConsistencyBlock(page.presentCharacters, anchors);
  const characterFocus = `Characters present on this page: ${page.presentCharacters.join(', ')}.`;
  return [
    STYLE_CONTRACT,
    CHARACTER_BIBLE,
    'CHARACTER CONSISTENCY RULES: All pages must maintain exact same character appearance. No proportion drift. No face drift. No clothing drift unless explicitly required.',
    consistencyBlock,
    characterFocus,
    `SCENE: ${page.scene}`,
    'Frame as a clean simple 2D cartoon storybook shot with strong composition and clear readable subject silhouettes.',
    'No text, no letters, no watermarks.',
  ].join('\n\n');
}

async function createPrediction(finalPrompt, referenceImages) {
  const body = {
    input: {
      prompt: finalPrompt,
      aspect_ratio: '1:1',
      output_format: 'jpg',
      num_outputs: 1,
      num_images: 1,
      ...(referenceImages.length > 0 ? { input_images: referenceImages } : {}),
    },
  };

  const res = await fetch(`https://api.replicate.com/v1/models/${MODEL_OWNER}/${MODEL_NAME}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=1',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate create prediction failed: ${res.status} ${text}`);
  }
  return res.json();
}

function extractOutputUrl(output) {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === 'string' && /^https?:\/\//.test(item)) return item;
      if (item && typeof item === 'object' && typeof item.url === 'string') return item.url;
    }
  }
  if (output && typeof output === 'object' && typeof output.url === 'string') return output.url;
  return null;
}

async function waitForPrediction(prediction) {
  let current = prediction;
  for (let i = 0; i < 60; i++) {
    if (current.status === 'succeeded') return current;
    if (current.status === 'failed' || current.status === 'canceled') {
      const errText = current.error ? ` error=${current.error}` : '';
      throw new Error(`Prediction ${current.id} ended with status=${current.status}${errText}`);
    }
    await sleep(2500);
    const getRes = await fetch(current.urls.get, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!getRes.ok) {
      const text = await getRes.text();
      throw new Error(`Replicate get prediction failed: ${getRes.status} ${text}`);
    }
    current = await getRes.json();
  }
  throw new Error(`Prediction timeout for ${current.id}`);
}

async function run() {
  if (!isLive) {
    const dryRun = pages.map((page) => ({
      pageNumber: page.pageNumber,
      finalPrompt: buildPrompt(page, { child: null, father: null, cat: null }),
      referenceImages: [],
      generatedImageUrl: null,
      mode: 'dry-run',
      note: 'No provider call made. Use --live --confirm-live for real generation.',
    }));
    console.log(JSON.stringify(dryRun, null, 2));
    return;
  }

  if (process.env.DISABLE_IMAGE_GENERATION === 'true') {
    throw new Error('Live generation blocked: DISABLE_IMAGE_GENERATION=true');
  }
  console.log('LIVE IMAGE GENERATION ENABLED');
  console.log(`Safety limits: maxPages=${MAX_PAGES}, maxAttemptsPerPage=${MAX_ATTEMPTS_PER_PAGE}`);

  const anchors = {
    child: null,
    father: null,
    cat: null,
  };
  const output = [];

  for (const page of pages) {
    const baseReferences = page.presentCharacters
      .map((characterId) => anchors[characterId])
      .filter(Boolean);
    const basePrompt = buildPrompt(page, anchors);
    const attempts = [
      { prompt: basePrompt, refs: baseReferences },
      { prompt: basePrompt, refs: [] },
      {
        prompt: [
          STYLE_CONTRACT,
          CHARACTER_BIBLE,
          `SCENE: ${page.scene}`,
          'Keep exact same character appearance across pages. No redesign.',
          'No text, no letters, no watermarks.',
        ].join('\n\n'),
        refs: baseReferences,
      },
    ].slice(0, MAX_ATTEMPTS_PER_PAGE);

    let finalPrompt = '';
    let referenceImages = [];
    let generatedImageUrl = '';
    let lastError = null;

    for (const attempt of attempts) {
      try {
        const created = await createPrediction(attempt.prompt, attempt.refs);
        const completed = await waitForPrediction(created);
        const out = extractOutputUrl(completed.output);
        if (!out) throw new Error(`No output image URL for page ${page.pageNumber}`);
        finalPrompt = attempt.prompt;
        referenceImages = attempt.refs;
        generatedImageUrl = out;
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) throw lastError;

    for (const characterId of page.anchorAssignments) {
      if (!anchors[characterId]) anchors[characterId] = generatedImageUrl;
    }

    output.push({
      pageNumber: page.pageNumber,
      finalPrompt,
      referenceImages,
      generatedImageUrl,
    });
  }

  console.log(JSON.stringify(output, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
