import Replicate from 'replicate';

export type ReplicateModelSlug = `${string}/${string}` | `${string}/${string}:${string}`;

export const REPLICATE_IMAGE_MODELS = {
  'flux-2-pro': 'black-forest-labs/flux-2-pro',
  'flux-dev': 'black-forest-labs/flux-dev',
  'flux-schnell': 'black-forest-labs/flux-schnell',
} as const;

type ReplicateImageModelKey = keyof typeof REPLICATE_IMAGE_MODELS;

let replicateClient: Replicate | null = null;

const DEFAULT_TEST_MODEL: ReplicateModelSlug = REPLICATE_IMAGE_MODELS['flux-schnell'];
const DEFAULT_PRODUCTION_MODEL: ReplicateModelSlug = REPLICATE_IMAGE_MODELS['flux-2-pro'];

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

export function resolveImageModelMode(): 'test' | 'production' {
  return (process.env.IMAGE_MODEL_MODE ?? 'production').toLowerCase() === 'test' ? 'test' : 'production';
}

export function resolveReplicateTestModel(): ReplicateModelSlug {
  const configured = process.env.REPLICATE_IMAGE_MODEL_TEST ?? DEFAULT_TEST_MODEL;
  const resolved = REPLICATE_IMAGE_MODELS[configured as ReplicateImageModelKey] ?? configured;
  return resolved as ReplicateModelSlug;
}

export function resolveReplicateImageModel(modelOverride?: string): ReplicateModelSlug {
  const modelMode = resolveImageModelMode();
  if (modelMode === 'test') {
    // In test mode we always force the cheap model, ignoring overrides and fallbacks.
    return resolveReplicateTestModel();
  }

  const modeDefaultModel =
    process.env.REPLICATE_IMAGE_MODEL_PRODUCTION ?? process.env.REPLICATE_IMAGE_MODEL ?? DEFAULT_PRODUCTION_MODEL;
  const requested = modelOverride ?? modeDefaultModel;
  const resolved = REPLICATE_IMAGE_MODELS[requested as ReplicateImageModelKey] ?? requested;
  return resolved as ReplicateModelSlug;
}
