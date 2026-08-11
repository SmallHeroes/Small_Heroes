import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { parse as parseEnv } from 'dotenv';

import { generateGPTImage } from '@/lib/generate-image';
import {
  buildStage0MethodBPrompt,
  buildStage0MethodBReferences,
} from '@/lib/generation-pipeline/stage0-method-b';
import { estimateGptImage2CostUsd } from '@/lib/pricing';
import {
  STYLE_01_AVOIDANCE_NEGATIVE,
  resolveStyle01GptModel,
} from '@/lib/style01-gptimage';

function requiredArg(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`Missing required ${prefix}<value>`);
  return value;
}

function integerArg(name: string): number {
  const raw = requiredArg(name);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 17) {
    throw new Error(`Invalid --${name}: ${raw}`);
  }
  return parsed;
}

function loadOnlyOpenAiKey(envFile: string): void {
  const parsed = parseEnv(fs.readFileSync(envFile, 'utf8'));
  const value = parsed.OPENAI_API_KEY?.trim();
  if (!value) throw new Error('OPENAI_API_KEY is missing or empty in the approved env file');
  process.env.OPENAI_API_KEY = value;
}

async function main(): Promise<void> {
  const childPhoto = path.resolve(requiredArg('child-photo'));
  const outputRoot = path.resolve(requiredArg('output-root'));
  const childAge = integerArg('child-age');
  const childGender = requiredArg('child-gender');
  if (childGender !== 'boy' && childGender !== 'girl') {
    throw new Error(`Invalid --child-gender: ${childGender}`);
  }
  const identityLock = requiredArg('identity-lock');
  const wardrobeLock = requiredArg('wardrobe-lock');
  const envFile = path.resolve(
    process.argv.find((entry) => entry.startsWith('--env-file='))?.slice(11) ??
      'C:\\GNart\\Work\\Small_Heroes\\.env.local',
  );

  const photoStat = fs.lstatSync(childPhoto);
  if (!photoStat.isFile() || photoStat.isSymbolicLink()) {
    throw new Error('Child photo must be a regular non-symlink file');
  }
  if (fs.existsSync(outputRoot) && fs.readdirSync(outputRoot).length > 0) {
    throw new Error(`Output root already exists and is non-empty: ${outputRoot}`);
  }
  fs.mkdirSync(outputRoot, { recursive: true });

  const refs = buildStage0MethodBReferences({
    childPhotoUrl: childPhoto,
    childGender,
  });
  const prompt = buildStage0MethodBPrompt({
    order: { childGender, childAge },
    lockedChildDescription: identityLock,
    wardrobeLock,
  });

  process.env.GPT_IMAGE_MODEL = 'gpt-image-2';
  process.env.STYLE_01_GPT_MODEL = 'gpt-image-2';
  process.env.GPT_IMAGE_QUALITY = 'low';
  loadOnlyOpenAiKey(envFile);
  try {
    const result = await generateGPTImage({
      finalPrompt: prompt,
      negativePrompt: STYLE_01_AVOIDANCE_NEGATIVE,
      referenceImages: refs.paths,
      referenceMode: refs.referenceMode,
      requireReferenceEdit: true,
      size: '1024x1536',
      quality: 'low',
      modelOverride: resolveStyle01GptModel(),
      requestTimeoutMs: 10 * 60 * 1000,
    });
    if (result.fallbackUsed || result.model !== 'gpt-image-2') {
      throw new Error(`Unexpected image provider result: model=${result.model} fallback=${result.fallbackUsed}`);
    }

    const anchorDir = path.join(outputRoot, 'character-anchors');
    fs.mkdirSync(anchorDir, { recursive: true });
    const anchorPath = path.join(anchorDir, 'child-canonical-style01-low.png');
    fs.writeFileSync(anchorPath, result.buffer);
    const promptPath = path.join(outputRoot, 'anchor-prompt.txt');
    fs.writeFileSync(promptPath, `${prompt}\n`, 'utf8');
    const cost = estimateGptImage2CostUsd(result.usage);
    const evidence = {
      version: 'local-style01-child-anchor-audition/v1',
      status: 'candidate_for_local_visual_review',
      anchorPath: path.relative(process.cwd(), anchorPath).replace(/\\/g, '/'),
      anchorSha256: createHash('sha256').update(result.buffer).digest('hex'),
      promptSha256: createHash('sha256').update(prompt, 'utf8').digest('hex'),
      childPhotoSha256: createHash('sha256').update(fs.readFileSync(childPhoto)).digest('hex'),
      referenceOrderLabels: refs.labels,
      model: result.model,
      quality: 'low',
      providerCalls: 1,
      transportRetries: 0,
      fallbackUsed: false,
      usage: result.usage ?? null,
      estimatedCostUsd: cost.estimatedCostUsd,
      costRateSource: cost.costRateSource,
      credentialAccess: 'process_child_only',
      rawCredentialPersisted: false,
      productionAuthority: 'none',
      productionBlocked: true,
    };
    fs.writeFileSync(
      path.join(outputRoot, 'anchor-evidence.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    );
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    delete process.env.OPENAI_API_KEY;
  }
}

main().catch((error) => {
  delete process.env.OPENAI_API_KEY;
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
