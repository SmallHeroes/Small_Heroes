import Replicate from 'replicate';
import { STYLE_IDS, STYLE_REGISTRY } from './styles';
import type { StyleId } from './styles';

/** Read LoRA slug at call time — STYLE_REGISTRY captures env only at module load. */
export function resolveLoraModelSlugForStyle(styleId: StyleId): string | null {
  if (styleId === STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK) {
    return process.env.LORA_MODEL_STYLE_01?.trim() || STYLE_REGISTRY[styleId].pipeline.loraModel;
  }
  if (styleId === STYLE_IDS.EXPRESSIVE_PAINTERLY_STORYBOOK) {
    return process.env.LORA_MODEL_STYLE_02?.trim() || STYLE_REGISTRY[styleId].pipeline.loraModel;
  }
  return STYLE_REGISTRY[styleId]?.pipeline.loraModel ?? null;
}

export type ReplicateModelSlug = `${string}/${string}` | `${string}/${string}:${string}`;

/** Base `owner/model` slug — strips `:version` suffix from version-pinned Replicate models. */
export function replicateModelBaseSlug(model: string): string {
  const trimmed = model.trim();
  const colon = trimmed.indexOf(':');
  return colon === -1 ? trimmed : trimmed.slice(0, colon);
}

export const REPLICATE_IMAGE_MODELS = {
  'flux-dev': 'black-forest-labs/flux-dev',
  'flux-2-pro': 'black-forest-labs/flux-2-pro',
  flux_pro: 'black-forest-labs/flux-2-pro',
} as const;

type ReplicateImageModelKey = keyof typeof REPLICATE_IMAGE_MODELS;

let replicateClient: Replicate | null = null;

function readReplicateToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error(
      'Missing REPLICATE_API_TOKEN. Add it to your environment before generating images.'
    );
  }
  return token;
}

export function getReplicateClient(): Replicate {
  if (!replicateClient) {
    replicateClient = new Replicate({ auth: readReplicateToken() });
  }
  return replicateClient;
}

export type ImageModelMode = 'development' | 'production';

/** Used by the image provider guard; must match the model that `generateReplicateImage` resolves when no override is passed. */
export function resolveImageModelMode(): ImageModelMode {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function resolveReplicateDevelopmentModel(): ReplicateModelSlug {
  const requested = process.env.REPLICATE_IMAGE_MODEL_DEVELOPMENT ?? 'flux-dev';
  const resolved = REPLICATE_IMAGE_MODELS[requested as ReplicateImageModelKey] ?? requested;
  return resolved as ReplicateModelSlug;
}

export function resolveReplicateProductionModel(): ReplicateModelSlug {
  const requested = process.env.REPLICATE_IMAGE_MODEL_PRODUCTION ?? 'flux-2-pro';
  const resolved = REPLICATE_IMAGE_MODELS[requested as ReplicateImageModelKey] ?? requested;
  return resolved as ReplicateModelSlug;
}

export function resolveReplicateImageModel(modelOverride?: string): ReplicateModelSlug {
  const envOverride = process.env.IMAGE_MODEL_OVERRIDE?.trim();
  if (envOverride) {
    const resolvedOverride = REPLICATE_IMAGE_MODELS[envOverride as ReplicateImageModelKey] ?? envOverride;
    return resolvedOverride as ReplicateModelSlug;
  }
  if (modelOverride) {
    // removed invalid or deprecated model override path
    console.warn('[image_model]', `Ignoring deprecated modelOverride argument: ${modelOverride}`);
  }
  if (resolveImageModelMode() === 'development') {
    return resolveReplicateDevelopmentModel();
  }
  return resolveReplicateProductionModel();
}

/**
 * Resolve Replicate model for a given style. Uses LoRA model when:
 * 1. ENABLE_LORA env is 'true'
 * 2. The style has a loraModel configured
 * Otherwise falls back to resolveReplicateImageModel().
 */
export function resolveReplicateImageModelForStyle(styleId?: string): ReplicateModelSlug {
  if (process.env.ENABLE_LORA !== 'true' || !styleId) {
    return r