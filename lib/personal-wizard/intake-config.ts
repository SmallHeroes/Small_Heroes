import 'server-only';

import { LIMITS } from './contract';

/**
 * Live intake (P2) configuration. Every switch is explicit server env; nothing here is chosen by
 * the browser. Live intake stays OFF unless ALL of these are valid:
 *
 *   PERSONAL_WIZARD_PREVIEW=true            (the prototype route itself)
 *   PERSONAL_WIZARD_LIVE_INTAKE=true        (explicit live switch, default off)
 *   PERSONAL_WIZARD_INTAKE_OPERATORS        (comma-separated emails of signed-in operators)
 *   PERSONAL_WIZARD_TRANSCRIBE_MODEL        (must have a price below)
 *   PERSONAL_WIZARD_EXTRACT_MODEL           (must have a price below)
 *   PERSONAL_WIZARD_INTAKE_BUDGET_USD       (per server process, > 0 and <= hard ceiling)
 *   PERSONAL_WIZARD_INTAKE_MAX_JOBS         (per server process, 1..hard ceiling)
 *   OPENAI_API_KEY                          (read only after an operator session is confirmed)
 *
 * Model ids are configuration, not code defaults: the operator chooses from the priced models.
 */

/**
 * Published Standard prices checked on 2026-09-29 against the provider pricing and model pages.
 * `gpt-transcribe` is billed per audio minute; the text models per 1M tokens (short context).
 * The safety multiplier covers the published 10% regional-processing uplift.
 */
export const PERSONAL_INTAKE_PRICE_ASSUMPTIONS = {
  version: 'openai-standard-pricing/2026-09-29-personal-intake-v1',
  currency: 'USD',
  checkedAt: '2026-09-29',
  source: 'https://developers.openai.com/api/docs/pricing',
  transcription: {
    'gpt-transcribe': { usdPerMinute: 0.0045 },
  },
  extraction: {
    'gpt-6-luna': { inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5 },
    'gpt-6-sol': { inputUsdPerMTok: 2, outputUsdPerMTok: 10 },
  },
  safetyMultiplier: 1.1,
} as const;

export type TranscribeModel = keyof typeof PERSONAL_INTAKE_PRICE_ASSUMPTIONS.transcription;
export type ExtractModel = keyof typeof PERSONAL_INTAKE_PRICE_ASSUMPTIONS.extraction;

export const INTAKE_HARD_LIMITS = {
  maxBudgetUsd: 5,
  maxJobs: 20,
  /** Includes reasoning tokens; the reservation assumes all of them are billed. */
  extractMaxOutputTokens: 3000,
  providerTimeoutMs: 60_000,
} as const;

/** Non-secret switches: resolving them never touches the provider credential. */
export type LiveIntakeSettings = {
  transcribeModel: TranscribeModel;
  extractModel: ExtractModel;
  budgetUsd: number;
  maxJobs: number;
  operators: ReadonlySet<string>;
};

export type LiveIntakeConfig = LiveIntakeSettings & { apiKey: string };

export type LiveIntakeDisabledReason =
  | 'preview_off'
  | 'live_flag_off'
  | 'no_operators'
  | 'transcribe_model_unpriced'
  | 'extract_model_unpriced'
  | 'budget_invalid'
  | 'max_jobs_invalid'
  | 'api_key_missing';

export type LiveIntakeSettingsResolution =
  | { enabled: true; settings: LiveIntakeSettings }
  | { enabled: false; reason: Exclude<LiveIntakeDisabledReason, 'api_key_missing'> };

const hasPrice = (table: object, model: string) => model.length > 0 && Object.prototype.hasOwnProperty.call(table, model);

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function resolveLiveIntakeSettings(
  env: Readonly<Record<string, string | undefined>> = process.env,
): LiveIntakeSettingsResolution {
  if (env.PERSONAL_WIZARD_PREVIEW !== 'true') return { enabled: false, reason: 'preview_off' };
  if (env.PERSONAL_WIZARD_LIVE_INTAKE !== 'true') return { enabled: false, reason: 'live_flag_off' };
  const operators = new Set(
    (env.PERSONAL_WIZARD_INTAKE_OPERATORS ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => EMAIL.test(entry)),
  );
  if (operators.size === 0) return { enabled: false, reason: 'no_operators' };
  const transcribeModel = (env.PERSONAL_WIZARD_TRANSCRIBE_MODEL ?? '').trim();
  if (!hasPrice(PERSONAL_INTAKE_PRICE_ASSUMPTIONS.transcription, transcribeModel)) {
    return { enabled: false, reason: 'transcribe_model_unpriced' };
  }
  const extractModel = (env.PERSONAL_WIZARD_EXTRACT_MODEL ?? '').trim();
  if (!hasPrice(PERSONAL_INTAKE_PRICE_ASSUMPTIONS.extraction, extractModel)) {
    return { enabled: false, reason: 'extract_model_unpriced' };
  }
  const budgetUsd = Number(env.PERSONAL_WIZARD_INTAKE_BUDGET_USD);
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > INTAKE_HARD_LIMITS.maxBudgetUsd) {
    return { enabled: false, reason: 'budget_invalid' };
  }
  const maxJobs = Number(env.PERSONAL_WIZARD_INTAKE_MAX_JOBS);
  if (!Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > INTAKE_HARD_LIMITS.maxJobs) {
    return { enabled: false, reason: 'max_jobs_invalid' };
  }
  return {
    enabled: true,
    settings: {
      transcribeModel: transcribeModel as TranscribeModel,
      extractModel: extractModel as ExtractModel,
      budgetUsd,
      maxJobs,
      operators,
    },
  };
}

/** The provider credential. Call only after the caller is an authorised operator. */
export function readIntakeApiKey(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const apiKey = (env.OPENAI_API_KEY ?? '').trim();
  return apiKey || null;
}

/** Upper bound for transcribing `durationMs` of audio, rounded up to the whole second. */
export function transcriptionUpperBoundUsd(model: TranscribeModel, durationMs: number): number {
  const minutes = Math.ceil(Math.max(0, durationMs) / 1000) / 60;
  const { usdPerMinute } = PERSONAL_INTAKE_PRICE_ASSUMPTIONS.transcription[model];
  return minutes * usdPerMinute * PERSONAL_INTAKE_PRICE_ASSUMPTIONS.safetyMultiplier;
}

/**
 * Upper bound for one extraction call. Input tokens are bounded by the UTF-8 byte length of
 * everything sent (a token is never smaller than one byte); output assumes the full ceiling.
 */
export function extractionUpperBoundUsd(model: ExtractModel, inputBytes: number): number {
  const { inputUsdPerMTok, outputUsdPerMTok } = PERSONAL_INTAKE_PRICE_ASSUMPTIONS.extraction[model];
  const usd = (inputBytes * inputUsdPerMTok + INTAKE_HARD_LIMITS.extractMaxOutputTokens * outputUsdPerMTok) / 1_000_000;
  return usd * PERSONAL_INTAKE_PRICE_ASSUMPTIONS.safetyMultiplier;
}

/** Worst-case transcript bytes sent to extraction (4 bytes per character is the UTF-8 maximum). */
export const MAX_TRANSCRIPT_BYTES = LIMITS.transcriptMax * 4;
