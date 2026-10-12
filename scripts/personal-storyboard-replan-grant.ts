/**
 * The typed re-plan grant and the typed ledger snapshot it extends. Shared by the runner (which validates a grant before any folder, key or
 * call) and the audition loader (which re-reads the SAME producer grant saved in a re-plan folder: the compared-page scope comes from it).
 */
import path from 'node:path';
import { z } from 'zod';
import { LANDMARK_KIND_CONTRACT_VERSION } from '../lib/personal-wizard/storyboard-landmark-kind';
import { STORYBOARD_PRESERVATION_VERSION } from '../lib/personal-wizard/storyboard-preservation';
import { CACHE_AWARE_PRICING_VERSION, CACHE_POLICY, RESERVATION_BUFFER_PERCENT } from './personal-cache-aware-pricing';

export const PARENT_STORYBOARD_DIR = 'controlled-visual-continuation-20261008';
export const REPLAN_GRANT_VERSION = 'storyboard-replan-grant/v1' as const;
export const REPLAN_PLANNER_MODEL = 'gpt-6-astra' as const;
export const REPLAN_REVIEW_MODEL = 'gpt-6.1-sol' as const;
export const REPLAN_CLAUDE_MAX = 'Claude Max usage is separate: not an API invoice, not $0 and not included in this ledger' as const;

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const absolute = z.string().min(3).max(500).refine(p => path.isAbsolute(p), 'absolute path');
const count = z.number().int().positive();
const amount = z.number().int().nonnegative();
const callPins = { model: z.string(), instructionSha256: hash, schemaName: z.string(), schemaSha256: hash, maxOutputTokens: count, timeoutMs: count };
const rates = z.object({ ordinary: count, cacheRead: count, cacheWrite: count, output: count }).strict();
/** Compared pages: the grant's own approved scope (unique, ascending); checked against the book's length when the grant is read. */
const pages = z.array(z.number().int().min(0).max(24)).min(1).max(4).refine(list => list.every((p, i) => i === 0 || p > list[i - 1]), 'unique ascending pages');

/** A settled cumulative meter snapshot (the existing meter's own `spend.json` shape): the authoritative floor a new grant extends. */
export const ledgerSnapshotSchema = z.object({
  priorKnownApiMicroUsd: amount, newKnownApiMicroUsd: amount, reservedUnsettledMicroUsd: amount, cumulativeAccountedMicroUsd: amount,
  capMicroUsd: count, calls: amount, maxCalls: count, failed: amount, unknownCost: amount, unknownOutcome: amount, repeatedFailure: z.boolean(),
  claudeMax: z.literal('separate: not an API invoice, not $0 and not included'),
}).strict();

export const replanGrantSchema = z.object({
  version: z.literal(REPLAN_GRANT_VERSION),
  approvalReference: z.string().trim().min(30).max(2000),
  parent: z.object({ bookDir: absolute, storyboardDir: z.literal(PARENT_STORYBOARD_DIR), requestId: hash, sourceDigest: hash, storyboardDigest: hash,
    reviewDigest: hash, resultSha256: hash, draftSha256: hash, savedSourceSha256: hash }).strict(),
  replan: z.object({ sourceDigest: hash, actorOwnedAppearance: z.literal(true), landmarkKindContract: z.literal(LANDMARK_KIND_CONTRACT_VERSION),
    preservation: z.literal(STORYBOARD_PRESERVATION_VERSION), moments: z.literal('not_enabled'), pairPages: pages }).strict(),
  payloads: z.object({
    storyboard: z.object({ ...callPins, inputSha256: hash, payloadBytes: count, contentBytes: count }).strict(),
    review: z.object({ ...callPins, maxPayloadBytes: count }).strict() }).strict(),
  executable: z.object({ files: z.array(z.object({ path: z.string(), sha256: hash }).strict()).min(1).max(32) }).strict(),
  pricing: z.object({ version: z.literal(CACHE_AWARE_PRICING_VERSION), policy: z.literal(CACHE_POLICY),
    ratesTenthMicroUsdPerToken: z.object({ [REPLAN_PLANNER_MODEL]: rates, [REPLAN_REVIEW_MODEL]: rates }).strict(),
    bufferPercent: z.literal(RESERVATION_BUFFER_PERCENT), reservations: z.object({ storyboard: count, review: count }).strict() }).strict(),
  ledger: z.object({
    /** Must equal the snapshot's settled cumulative total plus the explicit adjustments: never an unexplained lower (or higher) number. */
    priorKnownApiMicroUsd: amount,
    snapshot: z.object({ file: absolute, sha256: hash }).strict(),
    /** Owner-approved accounting increases only (e.g. adopting a cache-aware re-estimate); a lower floor needs a corrected snapshot. */
    adjustments: z.array(z.object({ microUsd: count, reason: z.string().trim().min(10).max(500), approvalReference: z.string().trim().min(10).max(1000) })
      .strict()).max(8).optional(),
    evidence: z.array(z.object({ file: absolute, sha256: hash }).strict()).min(1).max(16), note: z.string().min(10).max(1500) }).strict(),
  capMicroUsd: count, maxCalls: z.literal(2),
  scope: z.object({ stages: z.tuple([z.literal('storyboard'), z.literal('review')]), retries: z.literal(0), downstream: z.literal('none') }).strict(),
  out: absolute,
  deadlineMs: z.number().int().min(60000).max(3300000),
  claudeMax: z.literal(REPLAN_CLAUDE_MAX),
}).strict();
export type ReplanGrant = z.infer<typeof replanGrantSchema>;
