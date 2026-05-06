#!/usr/bin/env node
/**
 * test-lora.mjs — Generate test images with trained LoRA models.
 *
 * Usage:
 *   node scripts/test-lora.mjs --style 01
 *   node scripts/test-lora.mjs --style 02
 *   node scripts/test-lora.mjs --style both
 *   node scripts/test-lora.mjs --style 01 --prompt "a child reading in bed"
 */

import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const TEST_PROMPTS = [
  'A 5-year-old boy with curly brown hair sitting on a bed in a cozy bedroom at night, moonlight through the window, a small friendly creature sitting next to him',
  'A little girl with red hair walking through a magical forest path, tall trees with glowing leaves, a tiny fox companion walking beside her',
  'A child hiding under a blanket fort made of pillows and sheets, peeking out with a flashlight, warm golden light, stuffed animals around',
];

const STYLES = {
  '01': {
    triggerWord: 'REALISTART01',
    modelName: 'sh-realistic-artistic',
  },
  '02': {
    triggerWord: 'PENCILSTYLE02',
    modelName: 'sh-pencil-storybook',
  },
};

function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
      }
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { style: null, prompt: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--style' && args[i + 1]) result.style = args[++i];
    if (args[i] === '--prompt' && args[i + 1]) result.prompt = args[++i];
  }
  return result;
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(filepath); });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

async function generateImage(replicate, styleKey, prompt, outputDir) {
  const config = STYLES[styleKey];
  const owner = process.env.REPLICATE_USERNAME;
  const modelName = config.modelName;

  // Fetch latest version for private model
  const modelInfo = await replicate.models.get(owner, modelName);
  const version = modelInfo.latest_version?.id;
  if (!version) {
    throw new Error(`No version found for ${owner}/${modelName} — is training complete?`);
  }
  const modelWithVersion = `${owner}/${modelName}:${version}`;

  const fullPrompt = `${config.triggerWord} style, ${prompt}`;
  console.log(`  Prompt: ${fullPrompt.substring(0, 100)}...`);
  console.log(`  Model: ${modelWithVersion.substring(0, 60)}...`);

  const output = await replicate.run(modelWithVersion, {
    input: {
      prompt: fullPrompt,
      aspect_ratio: '2:3',
      output_format: 'jpg',
      num_outputs: 1,
    },
  });

  // Extract URL — newer Replicate SDK returns FileOutput objects
  let imageUrl;
  if (typeof output === 'string') {
    imageUrl = output;
  } else if (Array.isArray(output) && output.length > 0) {
    const item = output[0];
    // FileOutput objects: try .url(), toString(), or String()
    if (typeof item === 'string') imageUrl = item;
    else if (typeof item?.url === 'function') imageUrl = await item.url();
    else if (item?.url) imageUrl = item.url;
    else imageUrl = String(item); // FileOutput.toString() returns the URL
  } else if (output?.url) {
    imageUrl = typeof output.url === 'function' ? await output.url() : output.url;
  } else {
    imageUrl = String(output);
  }

  // Ensure imageUrl is a plain string
  if (imageUrl && typeof imageUrl !== 'string') imageUrl = String(imageUrl);

  if (!imageUrl || !imageUrl.startsWith('http')) {
    console.error(`  Failed to extract URL. Raw output type: ${typeof output}, value:`, String(output).slice(0, 200));
    if (Array.isArray(output) && output[0]) {
      const item = output[0];
      console.error(`  Item type: ${typeof item}, constructor: ${item?.constructor?.name}`);
      console.error(`  Item keys:`, Object.getOwnPropertyNames(item).slice(0, 10));
      console.error(`  String(item):`, String(item).slice(0, 200));
    }
    return null;
  }

  const filename = `test_style${styleKey}_${Date.now()}.jpg`;
  const filepath = path.join(outputDir, filename);
  await downloadImage(imageUrl, filepath);
  console.log(`  Saved: ${filepath}`);
  return filepath;
}

async function main() {
  loadEnv();
  const args = parseArgs();

  if (!args.style) {
    console.log('Usage: node scripts/test-lora.mjs --style 01|02|both [--prompt "..."]');
    process.exit(0);
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const outputDir = path.join(PROJECT_ROOT, 'lora-training-data', 'test-outputs');
  fs.mkdirSync(outputDir, { recursive: true });

  const stylesToTest = args.style === 'both' ? ['01', '02'] : [args.style];
  const prompts = args.prompt ? [args.prompt] : TEST_PROMPTS;

  for (const styleKey of stylesToTest) {
    console.log(`\n=== Testing Style ${styleKey} (${STYLES[styleKey].triggerWord}) ===`);
    for (let i = 0; i < prompts.length; i++) {
      console.log(`\nPrompt ${i + 1}/${prompts.length}:`);
      try {
        await generateImage(replicate, styleKey, prompts[i], outputDir);
      } catch (e) {
        console.error(`  Error: ${e.message}`);
      }
    }
  }

  console.log(`\nDone. Test images saved to: ${outputDir}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
