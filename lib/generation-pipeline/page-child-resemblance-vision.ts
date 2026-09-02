import 'server-only';

import {
  inspectAssetWithBytes,
  type AssetInspectionWithBytes,
} from './asset-integrity';

export const PAGE_CHILD_RESEMBLANCE_VISION_VERSION =
  'page-child-resemblance-vision/v1' as const;
export const PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD = 0.7;
export const PAGE_CHILD_RESEMBLANCE_MAX_RETRIES = 2;
export const PAGE_CHILD_RESEMBLANCE_MAX_TIMEOUT_MS = 60_000;

export type PageChildResemblanceStatus =
  | 'passed'
  | 'failed'
  | 'evidence_unknown';

export interface PageChildResemblanceVisionResult {
  evaluatorVersion: typeof PAGE_CHILD_RESEMBLANCE_VISION_VERSION;
  status: PageChildResemblanceStatus;
  resemblanceScore: number | null;
  threshold: number;
  subjectVisible: boolean | null;
  sameChild: boolean | null;
  reasonCode:
    | 'same_child'
    | 'different_child'
    | 'below_threshold'
    | 'subject_not_assessable'
    | 'reference_not_assessable'
    | 'candidate_missing'
    | 'multiple_children'
    | 'uncertain'
    | 'malformed'
    | 'transport_error'
    | 'batch_cancelled'
    | 'exact_bytes_unavailable'
    | 'credential_missing';
  attempts: number;
  model: string;
  featureAssessments: Record<IdentityFeature, IdentityFeatureAssessment> | null;
}

type VisionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type ExactAssetInspector = (
  url: string | null | undefined,
) => Promise<AssetInspectionWithBytes>;

export interface StoredPageChildResemblanceVisionResult {
  result: PageChildResemblanceVisionResult;
  referenceBytesSha256: string | null;
  candidateBytesSha256: string | null;
}

const RESPONSE_KEYS = [
  'referenceChildVisible',
  'candidateChildVisible',
  'candidateChildCount',
  'comparisonUsable',
  'sameChildDecision',
  'faceStructure',
  'eyesBrows',
  'noseMouth',
  'hairIdentity',
  'distinctiveFeatures',
] as const;

export type IdentityFeature =
  | 'faceStructure'
  | 'eyesBrows'
  | 'noseMouth'
  | 'hairIdentity'
  | 'distinctiveFeatures';
export type IdentityFeatureAssessment = 'match' | 'mismatch' | 'unclear';

const FEATURE_WEIGHTS: Record<IdentityFeature, number> = {
  faceStructure: 0.3,
  eyesBrows: 0.2,
  noseMouth: 0.2,
  hairIdentity: 0.2,
  distinctiveFeatures: 0.1,
};

const PROMPT = `You are a strict child-identity verifier for a personalized illustrated book.

Image 1 is the approved canonical portrait of the child. Image 2 is a stylized storybook page that should depict the same child.

Judge the CHILD'S IDENTITY only. Ignore art medium, background, lighting, camera distance, pose, expression, and wardrobe. Use stable identity cues: face shape and proportions, eyes, eyebrows, nose, mouth/smile, ears, age, hair color/cut/texture, and distinctive facial features. Do not reward a shared color palette or composition. Do not compare the companion or other people.

Return ONLY this exact JSON object, with no extra keys. Use match, mismatch, or unclear for each feature:
{
  "referenceChildVisible": boolean,
  "candidateChildVisible": boolean,
  "candidateChildCount": integer,
  "comparisonUsable": boolean,
  "sameChildDecision": "same" | "different" | "uncertain",
  "faceStructure": "match" | "mismatch" | "unclear",
  "eyesBrows": "match" | "mismatch" | "unclear",
  "noseMouth": "match" | "mismatch" | "unclear",
  "hairIdentity": "match" | "mismatch" | "unclear",
  "distinctiveFeatures": "match" | "mismatch" | "unclear"
}

Set comparisonUsable=false when either child's face and key identity features are too small, hidden, or ambiguous to judge. Count only child protagonists, not adults, babies, toys, portraits on a wall, or the companion. A stylized but recognizably faithful depiction may match; visual style similarity by itself must not produce feature matches.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parsePageChildResemblanceVisionResponse(
  value: unknown,
): {
  referenceChildVisible: boolean;
  candidateChildVisible: boolean;
  candidateChildCount: number;
  comparisonUsable: boolean;
  sameChildDecision: 'same' | 'different' | 'uncertain';
  featureAssessments: Record<IdentityFeature, IdentityFeatureAssessment>;
} | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== RESPONSE_KEYS.length ||
    !RESPONSE_KEYS.every((key) => keys.includes(key))
  ) return null;
  const featureKeys = Object.keys(FEATURE_WEIGHTS) as IdentityFeature[];
  const validAssessment = (candidate: unknown): candidate is IdentityFeatureAssessment =>
    candidate === 'match' || candidate === 'mismatch' || candidate === 'unclear';
  if (
    typeof value.referenceChildVisible !== 'boolean' ||
    typeof value.candidateChildVisible !== 'boolean' ||
    typeof value.candidateChildCount !== 'number' ||
    !Number.isInteger(value.candidateChildCount) ||
    value.candidateChildCount < 0 ||
    value.candidateChildCount > 10 ||
    typeof value.comparisonUsable !== 'boolean' ||
    !['same', 'different', 'uncertain'].includes(String(value.sameChildDecision)) ||
    !featureKeys.every((key) => validAssessment(value[key]))
  ) return null;
  const sameChildDecision = value.sameChildDecision as 'same' | 'different' | 'uncertain';
  const featureAssessments = Object.fromEntries(
    featureKeys.map((key) => [key, value[key] as IdentityFeatureAssessment]),
  ) as Record<IdentityFeature, IdentityFeatureAssessment>;
  return {
    referenceChildVisible: value.referenceChildVisible,
    candidateChildVisible: value.candidateChildVisible,
    candidateChildCount: value.candidateChildCount,
    comparisonUsable: value.comparisonUsable,
    sameChildDecision,
    featureAssessments,
  };
}

export function scoreIdentityFeatures(
  features: Record<IdentityFeature, IdentityFeatureAssessment>,
): number {
  const value = (assessment: IdentityFeatureAssessment): number =>
    assessment === 'match' ? 1 : assessment === 'unclear' ? 0.5 : 0;
  return (Object.keys(FEATURE_WEIGHTS) as IdentityFeature[]).reduce(
    (sum, key) => sum + FEATURE_WEIGHTS[key] * value(features[key]),
    0,
  );
}

export function resolvePageChildResemblanceTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.PAGE_CHILD_RESEMBLANCE_TIMEOUT_MS?.trim() ?? '',
    10,
  );
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, PAGE_CHILD_RESEMBLANCE_MAX_TIMEOUT_MS)
    : 30_000;
}

function resolveModel(model: string | undefined): string {
  return model ?? (process.env.CHILD_PHOTO_VISION_MODEL?.trim() || 'gpt-4o');
}

function assertThreshold(threshold: number): void {
  if (
    !Number.isFinite(threshold) ||
    threshold < PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD ||
    threshold > 1
  ) {
    throw new Error(
      `[page-child-resemblance] threshold must be within ${PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD}..1`,
    );
  }
}

function exactDataUrl(inspection: AssetInspectionWithBytes): string | null {
  if (
    inspection.ok !== true ||
    !inspection.sha256 ||
    !inspection.mime ||
    !inspection.data
  ) return null;
  return `data:${inspection.mime};base64,${inspection.data.toString('base64')}`;
}

/**
 * Inspect both stored images once, then send those exact buffers to Vision as data URLs. The returned SHA values
 * describe the provider-seen bytes, eliminating mutable/expired URL double-fetch races.
 */
export async function evaluateStoredPageChildResemblanceVision(args: {
  referenceImageUrl: string;
  candidateImageUrl: string;
  threshold: number;
  inspectWithBytes?: ExactAssetInspector;
  fetchImpl?: VisionFetch;
  apiKey?: string | null;
  model?: string;
  maxRetries?: number;
}): Promise<StoredPageChildResemblanceVisionResult> {
  assertThreshold(args.threshold);
  const inspect = args.inspectWithBytes ?? inspectAssetWithBytes;
  const [reference, candidate] = await Promise.all([
    inspect(args.referenceImageUrl),
    inspect(args.candidateImageUrl),
  ]);
  const referenceDataUrl = exactDataUrl(reference);
  const candidateDataUrl = exactDataUrl(candidate);
  if (!referenceDataUrl || !candidateDataUrl) {
    return {
      result: {
        evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
        status: 'evidence_unknown',
        resemblanceScore: null,
        threshold: args.threshold,
        subjectVisible: null,
        sameChild: null,
        reasonCode: 'exact_bytes_unavailable',
        attempts: 0,
        model: resolveModel(args.model),
        featureAssessments: null,
      },
      referenceBytesSha256: reference.sha256,
      candidateBytesSha256: candidate.sha256,
    };
  }
  return {
    result: await evaluatePageChildResemblanceVision({
      referenceImageUrl: referenceDataUrl,
      candidateImageUrl: candidateDataUrl,
      threshold: args.threshold,
      fetchImpl: args.fetchImpl,
      apiKey: args.apiKey,
      model: args.model,
      maxRetries: args.maxRetries,
    }),
    referenceBytesSha256: reference.sha256,
    candidateBytesSha256: candidate.sha256,
  };
}

export async function evaluatePageChildResemblanceVision(args: {
  referenceImageUrl: string;
  candidateImageUrl: string;
  threshold: number;
  fetchImpl?: VisionFetch;
  apiKey?: string | null;
  model?: string;
  maxRetries?: number;
  /** Optional batch fence checked immediately before every provider attempt. */
  shouldStartAttempt?: (attempt: number) => boolean;
}): Promise<PageChildResemblanceVisionResult> {
  const threshold = args.threshold;
  assertThreshold(threshold);
  const apiKey = args.apiKey ?? process.env.OPENAI_API_KEY?.trim() ?? null;
  const model = resolveModel(args.model);
  if (!apiKey) {
    return {
      evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
      status: 'evidence_unknown',
      resemblanceScore: null,
      threshold,
      subjectVisible: null,
      sameChild: null,
      reasonCode: 'credential_missing',
      attempts: 0,
      model,
      featureAssessments: null,
    };
  }
  const fetchImpl = args.fetchImpl ?? fetch;
  const requestedRetries = args.maxRetries ?? PAGE_CHILD_RESEMBLANCE_MAX_RETRIES;
  const boundedRetries = Number.isFinite(requestedRetries)
    ? Math.min(
        PAGE_CHILD_RESEMBLANCE_MAX_RETRIES,
        Math.max(0, Math.trunc(requestedRetries)),
      )
    : PAGE_CHILD_RESEMBLANCE_MAX_RETRIES;
  const maxAttempts = 1 + boundedRetries;
  let lastReason: 'malformed' | 'transport_error' = 'transport_error';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (args.shouldStartAttempt && !args.shouldStartAttempt(attempt)) {
      return {
        evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
        status: 'evidence_unknown',
        resemblanceScore: null,
        threshold,
        subjectVisible: null,
        sameChild: null,
        reasonCode: 'batch_cancelled',
        attempts: attempt - 1,
        model,
        featureAssessments: null,
      };
    }
    try {
      const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(resolvePageChildResemblanceTimeoutMs()),
        body: JSON.stringify({
          model,
          max_tokens: 180,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: args.referenceImageUrl, detail: 'high' } },
              { type: 'image_url', image_url: { url: args.candidateImageUrl, detail: 'high' } },
              { type: 'text', text: PROMPT },
            ],
          }],
        }),
      });
      if (!response.ok) {
        lastReason = 'transport_error';
        continue;
      }
      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      let decoded: unknown = null;
      try {
        decoded = JSON.parse(payload.choices?.[0]?.message?.content ?? 'null');
      } catch {
        decoded = null;
      }
      const parsed = parsePageChildResemblanceVisionResponse(decoded);
      if (!parsed) {
        lastReason = 'malformed';
        continue;
      }
      if (!parsed.referenceChildVisible) {
        return {
          evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
          status: 'evidence_unknown',
          resemblanceScore: null,
          threshold,
          subjectVisible: null,
          sameChild: null,
          reasonCode: 'reference_not_assessable',
          attempts: attempt,
          model,
          featureAssessments: parsed.featureAssessments,
        };
      }
      if (!parsed.candidateChildVisible || parsed.candidateChildCount === 0) {
        return {
          evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
          status: 'failed',
          resemblanceScore: 0,
          threshold,
          subjectVisible: false,
          sameChild: false,
          reasonCode: 'candidate_missing',
          attempts: attempt,
          model,
          featureAssessments: parsed.featureAssessments,
        };
      }
      if (parsed.candidateChildCount !== 1) {
        return {
          evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
          status: 'failed',
          resemblanceScore: 0,
          threshold,
          subjectVisible: true,
          sameChild: false,
          reasonCode: 'multiple_children',
          attempts: attempt,
          model,
          featureAssessments: parsed.featureAssessments,
        };
      }
      const score = scoreIdentityFeatures(parsed.featureAssessments);
      if (!parsed.comparisonUsable || parsed.sameChildDecision === 'uncertain') {
        return {
          evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
          status: 'evidence_unknown',
          resemblanceScore: score,
          threshold,
          subjectVisible: true,
          sameChild: null,
          reasonCode: parsed.comparisonUsable ? 'uncertain' : 'subject_not_assessable',
          attempts: attempt,
          model,
          featureAssessments: parsed.featureAssessments,
        };
      }
      const sameChild = parsed.sameChildDecision === 'same';
      const passed = sameChild && score >= threshold;
      return {
        evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
        status: passed ? 'passed' : 'failed',
        resemblanceScore: score,
        threshold,
        subjectVisible: true,
        sameChild,
        reasonCode: passed
          ? 'same_child'
          : sameChild
            ? 'below_threshold'
            : 'different_child',
        attempts: attempt,
        model,
        featureAssessments: parsed.featureAssessments,
      };
    } catch {
      lastReason = 'transport_error';
    }
  }
  return {
    evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
    status: 'evidence_unknown',
    resemblanceScore: null,
    threshold,
    subjectVisible: null,
    sameChild: null,
    reasonCode: lastReason,
    attempts: maxAttempts,
    model,
    featureAssessments: null,
  };
}
