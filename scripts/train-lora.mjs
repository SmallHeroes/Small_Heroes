#!/usr/bin/env node
/**
 * train-lora.mjs — Kick off LoRA training on Replicate for Small Heroes illustration styles.
 *
 * Prerequisites:
 *   1. REPLICATE_API_TOKEN in env (or .env.local)
 *   2. Training zips uploaded to a public URL (or use Replicate file upload)
 *   3. A Replicate account with model creation permissions
 *
 * Usage:
 *   node scripts/train-lora.mjs --style 01          # Train Style_01
 *   node scripts/train-lora.mjs --style 02          # Train Style_02
 *   node scripts/train-lora.mjs --style both        # Train both
 *   node scripts/train-lora.mjs --status <training_id>  # Check training status
 *
 * The script uploads the zip from lora-training-data/ directly via Replicate's
 * file upload API, then starts the training.
 */

import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Config ────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const TRAINER_MODEL = 'ostris/flux-dev-lora-trainer';
// Use latest version — Replicate resolves automatically when version is omitted

const STYLES = {
  '01': {
    name: 'Style 01 — Realistic Artistic Portrait (17 images)',
    zipFile: path.join(PROJECT_ROOT, 'lora-training-data', 'Style_01_training.zip'),
    destination: null, // Set after creating model
    modelName: 'sh-realistic-artistic',
    triggerWord: 'REALISTART01',
    description: 'Realistic portrait with artistic watercolor treatment on warm cream background — children look like themselves but painted.',
    steps: 1500,
    loraRank: 32,
    learningRate: 0.0004,
  },
  '02': {
    name: 'Style 02 — Cream Storybook (v2, 41 images)',
    zipFile: path.join(PROJECT_ROOT, 'lora-training-data', 'Style_02_training_v2.zip'),
    destination: null,
    modelName: 'sh-pencil-storybook',
    triggerWord: 'PENCILSTYLE02',
    description: 'Hand-drawn pencil outline + watercolor on cream paper — minimal children\'s book illustration style.',
    steps: 1500,
    loraRank: 32,
    learningRate: 0.0004,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────

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
  const result = { style: null, status: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--style' && args[i + 1]) {
      result.style = args[++i];
    } else if (args[i] === '--status' && args[i + 1]) {
      result.status = args[++i];
    }
  }
  return result;
}

async function getOrCreateModel(replicate, modelName, description) {
  const owner = await getReplicateUsername(replicate);
  const fullName = `${owner}/${modelName}`;

  try {
    const existing = await replicate.models.get(owner, modelName);
    console.log(`  Model exists: ${fullName}`);
    return fullName;
  } catch (e) {
    if (e.response?.status === 404 || e.message?.includes('404')) {
      console.log(`  Creating model: ${fullName}`);
      await replicate.models.create(owner, modelName, {
        visibility: 'private',
        hardware: 'gpu-t4',
        description,
      });
      console.log(`  Model created: ${fullName}`);
      return fullName;
    }
    throw e;
  }
}

async function getReplicateUsername(replicate) {
  // The Replicate SDK doesn't have a direct "whoami" — we'll parse from the token
  // Or use the models.list approach. For now, let the user set it or use a default.
  const username = process.env.REPLICATE_USERNAME;
  if (!username) {
    console.error('ERROR: Set REPLICATE_USERNAME in .env.local (your Replicate account name)');
    process.exit(1);
  }
  return username;
}

async function uploadFile(replicate, filePath) {
  console.log(`  Uploading ${path.basename(filePath)} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)} MB)...`);
  const fileBuffer = fs.readFileSync(filePath);
  const file = await replicate.files.create(
    fileBuffer,
    { filename: path.basename(filePath), content_type: 'application/zip' }
  );
  console.log(`  Uploaded: ${file.urls.get}`);
  return file.urls.get;
}

// ── Training ──────────────────────────────────────────────────────────

async function trainStyle(replicate, styleKey) {
  const config = STYLES[styleKey];
  if (!config) {
    console.error(`Unknown style: ${styleKey}. Use 01 or 02.`);
    process.exit(1);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Training: ${config.name}`);
  console.log(`${'='.repeat(60)}`);

  // Check zip exists
  if (!fs.existsSync(config.zipFile)) {
    console.error(`  ZIP not found: ${config.zipFile}`);
    console.error(`  Run: python3 scripts/prepare_lora_datasets.py first`);
    process.exit(1);
  }

  // Create or find model
  const destination = await getOrCreateModel(replicate, config.modelName, config.description);

  // Upload training data
  const inputImagesUrl = await uploadFile(replicate, config.zipFile);

  // Get latest version of the trainer model
  const trainerModel = await replicate.models.get('ostris', 'flux-dev-lora-trainer');
  const latestVersion = trainerModel.latest_version?.id;
  if (!latestVersion) {
    console.error('  Could not find latest version of ostris/flux-dev-lora-trainer');
    process.exit(1);
  }
  console.log(`  Trainer version: ${latestVersion.substring(0, 12)}...`);

  // Start training
  console.log(`  Starting training...`);
  console.log(`    Trigger word: ${config.triggerWord}`);
  console.log(`    Steps: ${config.steps}`);
  console.log(`    LoRA rank: ${config.loraRank}`);
  console.log(`    Learning rate: ${config.learningRate}`);
  console.log(`    Destination: ${destination}`);

  const training = await replicate.trainings.create(
    'ostris',
    'flux-dev-lora-trainer',
    latestVersion,
    {
      destination,
      input: {
        input_images: inputImagesUrl,
        trigger_word: config.triggerWord,
        steps: config.steps,
        lora_rank: config.loraRank,
        learning_rate: config.learningRate,
        autocaption: true,              // Auto-generate captions for images
        autocaption_prefix: `${config.triggerWord} style,`, // Prefix for auto-captions
      },
    }
  );

  console.log(`\n  Training started!`);
  console.log(`    ID: ${training.id}`);
  console.log(`    Status: ${training.status}`);
  console.log(`    URL: https://replicate.com/p/${training.id}`);
  console.log(`\n  Check status: node scripts/train-lora.mjs --status ${training.id}`);

  return training;
}

async function checkStatus(replicate, trainingId) {
  console.log(`\nChecking training: ${trainingId}`);
  const training = await replicate.trainings.get(trainingId);

  console.log(`  Status: ${training.status}`);
  console.log(`  Created: ${training.created_at}`);

  if (training.completed_at) {
    console.log(`  Completed: ${training.completed_at}`);
  }
  if (training.error) {
    console.log(`  Error: ${training.error}`);
  }
  if (training.output) {
    console.log(`  Output:`);
    console.log(`    Version: ${training.output.version}`);
    if (training.output.weights) {
      console.log(`    Weights: ${training.output.weights}`);
    }
  }
  if (training.logs) {
    const lastLines = training.logs.split('\n').slice(-10).join('\n');
    console.log(`  Last logs:\n${lastLines}`);
  }

  return training;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  loadEnv();
  const args = parseArgs();

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error('ERROR: REPLICATE_API_TOKEN not set. Add to .env.local');
    process.exit(1);
  }

  const replicate = new Replicate({ auth: token });

  // Check status mode
  if (args.status) {
    await checkStatus(replicate, args.status);
    return;
  }

  // Training mode
  if (!args.style) {
    console.log('Usage:');
    console.log('  node scripts/train-lora.mjs --style 01     # Train Style_01');
    console.log('  node scripts/train-lora.mjs --style 02     # Train Style_02');
    console.log('  node scripts/train-lora.mjs --style both   # Train both');
    console.log('  node scripts/train-lora.mjs --status <id>  # Check training status');
    process.exit(0);
  }

  const trainings = [];

  if (args.style === 'both' || args.style === '01') {
    trainings.push(await trainStyle(replicate, '01'));
  }
  if (args.style === 'both' || args.style === '02') {
    trainings.push(await trainStyle(replicate, '02'));
  }

  if (trainings.length > 0) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Summary: ${trainings.length} training(s) started`);
    console.log(`${'='.repeat(60)}`);
    trainings.forEach(t => {
      console.log(`  ${t.id} — https://replicate.com/p/${t.id}`);
    });
    console.log(`\nTraining typically takes 20-30 minutes.`);
    console.log(`Estimated cost: ~$4-8 per style.`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
