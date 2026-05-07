import 'server-only';

type StoryProvider = 'openai' | 'claude';
type ImageProvider = 'replicate' | 'dall-e-3' | 'gpt-image';
type PaymentProvider = 'payme' | 'stripe' | 'fake';

export type AppEnv = {
  DATABASE_URL: string;
  PAYMENT_PROVIDER: PaymentProvider;
  ENABLE_FAKE_PAYMENT: boolean;
  ALLOW_FAKE_PAYMENTS: boolean;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  PAYME_API_BASE_URL?: string;
  PAYME_API_KEY?: string;
  PAYME_WEBHOOK_SECRET?: string;
  PAYME_WEBHOOK_ALLOWED_IPS?: string;
  PAYME_VERIFY_PATH?: string;
  PAYME_REDIRECT_TRUST_MODE: boolean;
  APP_URL: string;
  GENERATION_SECRET: string;
  NEXT_PUBLIC_APP_URL: string;
  STORY_PROVIDER: StoryProvider;
  IMAGE_PROVIDER: ImageProvider;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  REPLICATE_API_TOKEN?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_STORAGE_BUCKET: string;
  ELEVENLABS_API_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_PROVIDER?: string;
};

let cachedEnv: AppEnv | null = null;

function readRequired(key: string, errors: string[]): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    errors.push(`${key} is required`);
    return '';
  }
  return value.trim();
}

function normalizeStoryProvider(value: string | undefined): StoryProvider {
  const raw = (value ?? 'openai').trim().toLowerCase();
  return raw === 'claude' ? 'claude' : 'openai';
}

function normalizeImageProvider(value: string | undefined): ImageProvider {
  const raw = (value ?? 'replicate').trim().toLowerCase();
  if (raw === 'dall-e-3') return 'dall-e-3';
  if (raw === 'gpt-image') return 'gpt-image';
  return 'replicate';
}

function normalizePaymentProvider(value: string | undefined): PaymentProvider {
  const raw = (value ?? '').trim().toLowerCase();
  if (raw === 'payme') return 'payme';
  if (raw === 'fake') return 'fake';
  return 'stripe';
}

export function validateEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  // Skip strict validation during build (next build collects page data but doesn't serve)
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

  const errors: string[] = [];

  const DATABASE_URL = readRequired('DATABASE_URL', errors);
  const PAYMENT_PROVIDER = normalizePaymentProvider(process.env.PAYMENT_PROVIDER);
  const ENABLE_FAKE_PAYMENT = process.env.ENABLE_FAKE_PAYMENT === 'true';
  const ALLOW_FAKE_PAYMENTS = process.env.ALLOW_FAKE_PAYMENTS === 'true';
  const GENERATION_SECRET = readRequired('GENERATION_SECRET', errors);
  const APP_URL = (process.env.APP_URL || '').trim();
  const NEXT_PUBLIC_APP_URL = (process.env.NEXT_PUBLIC_APP_URL || APP_URL).trim();
  if (!NEXT_PUBLIC_APP_URL) {
    errors.push('NEXT_PUBLIC_APP_URL or APP_URL is required');
  }
  const SUPABASE_URL = readRequired('SUPABASE_URL', errors);
  const SUPABASE_SERVICE_ROLE_KEY = readRequired('SUPABASE_SERVICE_ROLE_KEY', errors);
  const SUPABASE_STORAGE_BUCKET = (process.env.SUPABASE_STORAGE_BUCKET || 'book-images').trim();

  const STORY_PROVIDER = normalizeStoryProvider(process.env.STORY_PROVIDER);
  const IMAGE_PROVIDER = normalizeImageProvider(process.env.IMAGE_PROVIDER);
  const imageGenerationDisabled = process.env.DISABLE_IMAGE_GENERATION === 'true';

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY?.trim();
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN?.trim();
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY?.trim();
  const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
  const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER?.trim();
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const PAYME_API_BASE_URL = process.env.PAYME_API_BASE_URL?.trim().replace(/\/$/, '');
  const PAYME_API_KEY = process.env.PAYME_API_KEY?.trim();
  const PAYME_WEBHOOK_SECRET = process.env.PAYME_WEBHOOK_SECRET?.trim();
  const PAYME_WEBHOOK_ALLOWED_IPS = process.env.PAYME_WEBHOOK_ALLOWED_IPS?.trim();
  const PAYME_VERIFY_PATH = process.env.PAYME_VERIFY_PATH?.trim();
  const PAYME_REDIRECT_TRUST_MODE = process.env.PAYME_REDIRECT_TRUST_MODE === 'true';

  if (STORY_PROVIDER === 'openai' && !OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required when STORY_PROVIDER=openai');
  }
  if (STORY_PROVIDER === 'claude' && !ANTHROPIC_API_KEY) {
    errors.push('ANTHROPIC_API_KEY is required when STORY_PROVIDER=claude');
  }
  if (!imageGenerationDisabled && IMAGE_PROVIDER === 'replicate' && !REPLICATE_API_TOKEN) {
    errors.push('REPLICATE_API_TOKEN is required when IMAGE_PROVIDER=replicate');
  }
  if (!imageGenerationDisabled && IMAGE_PROVIDER === 'dall-e-3' && !OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required when IMAGE_PROVIDER=dall-e-3');
  }
  if (!imageGenerationDisabled && IMAGE_PROVIDER === 'gpt-image' && !OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required when IMAGE_PROVIDER=gpt-image');
  }
  if (PAYMENT_PROVIDER === 'stripe') {
    if (!STRIPE_SECRET_KEY) errors.push('STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe');
    if (!STRIPE_WEBHOOK_SECRET) errors.push('STRIPE_WEBHOOK_SECRET is required when PAYMENT_PROVIDER=stripe');
  }
  if (PAYMENT_PROVIDER === 'payme') {
    if (!PAYME_API_BASE_URL) errors.push('PAYME_API_BASE_URL is required when PAYMENT_PROVIDER=payme');
    if (!PAYME_API_KEY) errors.push('PAYME_API_KEY is required when PAYMENT_PROVIDER=payme');
    if (!PAYME_WEBHOOK_SECRET && !PAYME_WEBHOOK_ALLOWED_IPS) {
      errors.push('Set PAYME_WEBHOOK_SECRET or PAYME_WEBHOOK_ALLOWED_IPS for PayMe webhook verification');
    }
  }
  if (PAYMENT_PROVIDER === 'fake') {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !ALLOW_FAKE_PAYMENTS) {
      errors.push('PAYMENT_PROVIDER=fake is forbidden in production');
    }
    if (!ENABLE_FAKE_PAYMENT) {
      errors.push('ENABLE_FAKE_PAYMENT=true is required when PAYMENT_PROVIDER=fake');
    }
  }
  if (PAYME_REDIRECT_TRUST_MODE && process.env.NODE_ENV === 'production') {
    errors.push('PAYME_REDIRECT_TRUST_MODE=true is forbidden in production');
  }

  try {
    // Validate URL shape early so origin/security checks behave predictably.
    // eslint-disable-next-line no-new
    new URL(NEXT_PUBLIC_APP_URL);
  } catch {
    errors.push('NEXT_PUBLIC_APP_URL must be a valid absolute URL');
  }

  if (errors.length > 0 && !isBuild) {
    throw new Error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
  }
  if (errors.length > 0 && isBuild) {
    console.warn(`[build] Skipping env validation (${errors.length} issues)`);
  }

  cachedEnv = {
    DATABASE_URL,
    PAYMENT_PROVIDER,
    ENABLE_FAKE_PAYMENT,
    ALLOW_FAKE_PAYMENTS,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    PAYME_API_BASE_URL,
    PAYME_API_KEY,
    PAYME_WEBHOOK_SECRET,
    PAYME_WEBHOOK_ALLOWED_IPS,
    PAYME_VERIFY_PATH,
    PAYME_REDIRECT_TRUST_MODE,
    APP_URL: APP_URL || NEXT_PUBLIC_APP_URL,
    GENERATION_SECRET,
    NEXT_PUBLIC_APP_URL,
    STORY_PROVIDER,
    IMAGE_PROVIDER,
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    REPLICATE_API_TOKEN,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET,
    ELEVENLABS_API_KEY,
    RESEND_API_KEY,
    EMAIL_PROVIDER,
  };

  return cachedEnv;
}

export function isFakePaymentEnabled(): boolean {
  return (
    env.PAYMENT_PROVIDER === 'fake' &&
    env.ENABLE_FAKE_PAYMENT &&
    process.env.NODE_ENV !== 'production'
  );
}

export const env = validateEnv();
