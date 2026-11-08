import 'server-only';

import { z } from 'zod';
import { canonicalHash } from '@/lib/canonical-json';
import { ENGINE_SITE_LAUNCH_OFFER } from './offer-definition';
import { ENGINE_RESPONSE_SCHEMA_POLICY } from './response-schema';
import { ENGINE_STORYBOARD_BINDING } from './storyboard-binding-policy';

export const ENGINE_SITE_PROTOCOL = 'engine-site/v1' as const;
export const ENGINE_SITE_FRAMES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]);
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const identifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/);
export const utcSchema = z.string().datetime({ precision: 3 });
export const microUsdSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
/** MEDIUM is a future typed value; the launch policy below never selects it. */
export const engineImageQualitySchema = z.enum(['low', 'medium']);

/** Server-owned policy, NOT a browser order payload or spend permission by itself. No default cap. */
export const engineOrderAuthoritySchema = z.object({
  version: z.literal(ENGINE_SITE_PROTOCOL),
  orderId: identifierSchema,
  requestSha256: digestSchema,
  optionsSha256: digestSchema,
  offer: z.object({ id: identifierSchema, revisionSha256: digestSchema }).strict(),
  engine: z.literal('native-cde-book/v1'),
  /** New explicitly bound local-test wires only; absent preserves historical authorities and receipts. */
  responseSchemaPolicy: z.literal(ENGINE_RESPONSE_SCHEMA_POLICY).optional(),
  /** Explicit mechanical accepted-world child binding; absent retains historical producer/wire semantics. */
  storyboardBindingPolicy: z.literal(ENGINE_STORYBOARD_BINDING).optional(),
  sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
  policySha256: digestSchema,
  purpose: z.enum(['customer', 'test']),
  imageQuality: engineImageQualitySchema,
  narrativePages: z.literal(8),
  entitlements: z.object({ narration: z.boolean(), pdf: z.boolean() }).strict(),
  budget: z.object({
    maximumMicroUsd: microUsdSchema.refine(value => value > 0),
    maximumCalls: z.number().int().min(1).max(1000),
    approvalReference: identifierSchema,
    approvedBy: identifierSchema,
    approvedAt: utcSchema,
    /** Stable logical slots from the server's versioned stage plan, including permitted corrections. */
    steps: z.array(z.object({
      id: identifierSchema,
      maximumMicroUsd: microUsdSchema.refine(value => value > 0),
    }).strict()).min(1).max(1000),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  if (value.responseSchemaPolicy !== undefined && value.purpose !== 'test') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['responseSchemaPolicy'], message: 'schema_policy_test_only' });
  }
  if(value.storyboardBindingPolicy!==undefined&&value.purpose!=='test'){
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['storyboardBindingPolicy'],message:'storyboard_binding_test_only'});
  }
  if (value.imageQuality !== ENGINE_SITE_LAUNCH_OFFER.imageQuality) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['imageQuality'], message: 'launch_quality_mismatch' });
  }
  if (new Set(value.budget.steps.map(step => step.id)).size !== value.budget.steps.length ||
      value.budget.steps.some(step => step.maximumMicroUsd > value.budget.maximumMicroUsd)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['budget', 'steps'], message: 'invalid_step_allowance' });
  }
});
export type EngineOrderAuthority = z.infer<typeof engineOrderAuthoritySchema>;

const pageSchema = z.object({
  pageNumber: z.number().int().min(0).max(8),
  textSha256: digestSchema,
  imageSha256: digestSchema,
  audioSha256: digestSchema.nullable(),
}).strict();

/** Hashes of the actual ordered, final reader assets. No URLs, names, secrets or approval flags. */
export const engineBookManifestSchema = z.object({
  version: z.literal('engine-site-book/v1'),
  orderId: identifierSchema,
  authoritySha256: digestSchema,
  sourceSha256: digestSchema,
  storyboardSha256: digestSchema,
  imageQuality: engineImageQualitySchema,
  pages: z.array(pageSchema).length(9),
  pdfSha256: digestSchema.nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.pages.some((page, index) => page.pageNumber !== index)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pages'], message: 'ordered_frame_coverage' });
  }
});
export type EngineBookManifest = z.infer<typeof engineBookManifestSchema>;

export class EngineSiteError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'EngineSiteError'; }
}
export function engineSiteFail(code: string): never { throw new EngineSiteError(code); }
export const authorityDigest = (authority: EngineOrderAuthority) => canonicalHash(engineOrderAuthoritySchema.parse(authority));

/** Recheck on load. A paid offer may not lose its narration/PDF or borrow another order's assets. */
export function boundBookManifest(authority: EngineOrderAuthority, input: unknown): EngineBookManifest {
  const admitted = engineOrderAuthoritySchema.parse(authority);
  const book = engineBookManifestSchema.parse(input);
  if (book.orderId !== admitted.orderId || book.authoritySha256 !== authorityDigest(admitted) ||
      book.imageQuality !== admitted.imageQuality) engineSiteFail('book_authority_mismatch');
  if (admitted.entitlements.narration && book.pages.some(page => page.audioSha256 === null)) {
    engineSiteFail('book_narration_incomplete');
  }
  if (admitted.entitlements.pdf && book.pdfSha256 === null) engineSiteFail('book_pdf_incomplete');
  return book;
}
export const bookDigest = (manifest: EngineBookManifest) => canonicalHash(engineBookManifestSchema.parse(manifest));
