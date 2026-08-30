import { canonicalJsonDigest } from './integrity';

/**
 * Replacement-execution authority for one human-approved successor Blueprint
 * authoring run when an earlier single-use paid claim is a durable but
 * unresolved orphan (a published claim with no recoverable terminal result and
 * no incident, i.e. an unknown provider outcome).
 *
 * This module is a pure algebra: it builds and validates the versioned
 * proposal -> review -> authorization lifecycle and derives the distinct
 * successor execution identity. It performs no filesystem, provider, network
 * or database access. All orphan detection, artifact IO and paid execution
 * live in `qaWizardBlueprintAuthoringLifecycle`, which imports this module.
 *
 * The predecessor claim is never mutated. The successor carries the unchanged
 * canonical content `authoringAuthorityDigest`; only its compiler-owned
 * execution ledger identity differs so it can never collide with or
 * impersonate the predecessor.
 */

export const QA_WIZARD_BLUEPRINT_REPLACEMENT_PROPOSAL_VERSION =
  'qa-wizard-blueprint-replacement-proposal/v1' as const;
export const QA_WIZARD_BLUEPRINT_REPLACEMENT_REVIEW_VERSION =
  'qa-wizard-blueprint-replacement-review/v1' as const;
export const QA_WIZARD_BLUEPRINT_REPLACEMENT_AUTHORIZATION_VERSION =
  'qa-wizard-blueprint-replacement-authorization/v1' as const;
export const QA_WIZARD_BLUEPRINT_REPLACEMENT_EXECUTION_CLAIM_VERSION =
  'qa-wizard-blueprint-replacement-execution-claim/v1' as const;

const SUCCESSOR_EXECUTION_IDENTITY_MARKER =
  'qa-wizard-blueprint-successor-execution-identity/v1' as const;

/** Exact approver for a replacement authorization. Only Guy can approve. */
export const QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER = 'Guy' as const;

const DIGEST_ALGORITHM = 'canonical-json-sha256' as const;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const CANONICAL_UTC_MILLISECONDS =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * A replacement reason is a bounded, sanitized operator code — never free text.
 * This keeps raw provider output, error strings, credentials or content out of
 * the compiler ledger while still recording why the successor is authorized.
 */
export const REPLACEMENT_REASON_PATTERN = /^[a-z0-9_]{3,120}$/;

export const REPLACEMENT_SINGLE_SUCCESSOR = 1 as const;

export interface QaWizardBlueprintReplacementPredecessorBinding {
  claimVersion: string;
  claimDigest: string;
  claimPath: string;
  claimByteLength: number;
  claimSha256: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  preflightManifestPath: string;
  requestedAt: string;
}

export interface QaWizardBlueprintReplacementCurrentBinding {
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  preflightManifestPath: string;
  outputDir: string;
  requestId: string;
  requestedAt: string;
}

export interface QaWizardBlueprintReplacementProposal {
  version: typeof QA_WIZARD_BLUEPRINT_REPLACEMENT_PROPOSAL_VERSION;
  reason: string;
  predecessor: QaWizardBlueprintReplacementPredecessorBinding;
  current: QaWizardBlueprintReplacementCurrentBinding;
  maxSuccessorExecutions: typeof REPLACEMENT_SINGLE_SUCCESSOR;
  preparedBy: string;
  preparedAt: string;
  scope: 'single_use_paid_blueprint_replacement_proposal';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface QaWizardBlueprintReplacementReview {
  version: typeof QA_WIZARD_BLUEPRINT_REPLACEMENT_REVIEW_VERSION;
  proposalDigest: string;
  proposalPath: string;
  disposition: 'recommend_replacement';
  reviewedBy: string;
  reviewedAt: string;
  note: string | null;
  scope: 'single_use_paid_blueprint_replacement_review';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface QaWizardBlueprintReplacementAuthorization {
  version: typeof QA_WIZARD_BLUEPRINT_REPLACEMENT_AUTHORIZATION_VERSION;
  proposalDigest: string;
  proposalPath: string;
  reviewDigest: string;
  reviewPath: string;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  predecessorClaimDigest: string;
  predecessorClaimPath: string;
  successorExecutionDigest: string;
  maxSuccessorExecutions: typeof REPLACEMENT_SINGLE_SUCCESSOR;
  approvedBy: typeof QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER;
  approvedAt: string;
  note: string | null;
  scope: 'single_use_paid_blueprint_replacement_authorization';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface QaWizardBlueprintReplacementExecutionClaim {
  version: typeof QA_WIZARD_BLUEPRINT_REPLACEMENT_EXECUTION_CLAIM_VERSION;
  authoringAuthorityDigest: string;
  requestDigest: string;
  preflightManifestDigest: string;
  preflightManifestPath: string;
  requestedAt: string;
  executionIdentityDigest: string;
  replacement: {
    authorizationDigest: string;
    authorizationPath: string;
    proposalDigest: string;
    reviewDigest: string;
    predecessorClaimDigest: string;
    predecessorClaimPath: string;
  };
  scope: 'single_use_paid_replacement_blueprint_authoring';
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

const PREDECESSOR_KEYS = [
  'authoringAuthorityDigest',
  'claimByteLength',
  'claimDigest',
  'claimPath',
  'claimSha256',
  'claimVersion',
  'preflightManifestDigest',
  'preflightManifestPath',
  'requestDigest',
  'requestedAt',
] as const;
const CURRENT_KEYS = [
  'authoringAuthorityDigest',
  'outputDir',
  'preflightManifestDigest',
  'preflightManifestPath',
  'requestDigest',
  'requestId',
  'requestedAt',
] as const;
const PROPOSAL_KEYS = [
  'current',
  'digest',
  'digestAlgorithm',
  'maxSuccessorExecutions',
  'predecessor',
  'preparedAt',
  'preparedBy',
  'reason',
  'scope',
  'version',
] as const;
const REVIEW_KEYS = [
  'digest',
  'digestAlgorithm',
  'disposition',
  'note',
  'proposalDigest',
  'proposalPath',
  'reviewedAt',
  'reviewedBy',
  'scope',
  'version',
] as const;
const AUTHORIZATION_KEYS = [
  'approvedAt',
  'approvedBy',
  'authoringAuthorityDigest',
  'digest',
  'digestAlgorithm',
  'maxSuccessorExecutions',
  'note',
  'predecessorClaimDigest',
  'predecessorClaimPath',
  'preflightManifestDigest',
  'proposalDigest',
  'proposalPath',
  'requestDigest',
  'reviewDigest',
  'reviewPath',
  'scope',
  'successorExecutionDigest',
  'version',
] as const;
const REPLACEMENT_CLAIM_KEYS = [
  'authoringAuthorityDigest',
  'digest',
  'digestAlgorithm',
  'executionIdentityDigest',
  'preflightManifestDigest',
  'preflightManifestPath',
  'replacement',
  'requestDigest',
  'requestedAt',
  'scope',
  'version',
] as const;
const REPLACEMENT_CLAIM_REPLACEMENT_KEYS = [
  'authorizationDigest',
  'authorizationPath',
  'predecessorClaimDigest',
  'predecessorClaimPath',
  'proposalDigest',
  'reviewDigest',
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(
  value: unknown,
  expected: readonly string[],
): value is Record<string, unknown> {
  return (
    record(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort())
  );
}

function canonicalUtcTimestampIsValid(value: unknown): value is string {
  if (typeof value !== 'string' || !CANONICAL_UTC_MILLISECONDS.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function hex(value: unknown): value is string {
  return typeof value === 'string' && HEX_SHA256.test(value);
}

function nonEmptyPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function digestPayload<T extends object>(payload: T): T & {
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
} {
  return {
    ...payload,
    digestAlgorithm: DIGEST_ALGORITHM,
    digest: canonicalJsonDigest(payload),
  };
}

function payloadWithoutDigest(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = value;
  return payload;
}

export function blueprintReplacementReasonIsValid(
  value: unknown,
): value is string {
  return typeof value === 'string' && REPLACEMENT_REASON_PATTERN.test(value);
}

export function blueprintReplacementReviewNoteIsValid(
  value: unknown,
): value is string {
  // Optional review/authorization notes remain bounded sanitized operator text.
  return typeof value === 'string' && REPLACEMENT_REASON_PATTERN.test(value);
}

function predecessorBindingIsValid(
  value: unknown,
): value is QaWizardBlueprintReplacementPredecessorBinding {
  return (
    exactKeys(value, PREDECESSOR_KEYS) &&
    typeof value.claimVersion === 'string' &&
    value.claimVersion.length > 0 &&
    value.claimVersion !==
      QA_WIZARD_BLUEPRINT_REPLACEMENT_EXECUTION_CLAIM_VERSION &&
    hex(value.claimDigest) &&
    nonEmptyPath(value.claimPath) &&
    typeof value.claimByteLength === 'number' &&
    Number.isSafeInteger(value.claimByteLength) &&
    value.claimByteLength > 0 &&
    hex(value.claimSha256) &&
    hex(value.authoringAuthorityDigest) &&
    hex(value.requestDigest) &&
    hex(value.preflightManifestDigest) &&
    nonEmptyPath(value.preflightManifestPath) &&
    canonicalUtcTimestampIsValid(value.requestedAt)
  );
}

function currentBindingIsValid(
  value: unknown,
): value is QaWizardBlueprintReplacementCurrentBinding {
  return (
    exactKeys(value, CURRENT_KEYS) &&
    hex(value.authoringAuthorityDigest) &&
    hex(value.requestDigest) &&
    hex(value.preflightManifestDigest) &&
    nonEmptyPath(value.preflightManifestPath) &&
    nonEmptyPath(value.outputDir) &&
    typeof value.requestId === 'string' &&
    value.requestId.length > 0 &&
    canonicalUtcTimestampIsValid(value.requestedAt)
  );
}

export function buildBlueprintReplacementProposal(args: {
  reason: string;
  predecessor: QaWizardBlueprintReplacementPredecessorBinding;
  current: QaWizardBlueprintReplacementCurrentBinding;
  preparedBy: string;
  preparedAt: string;
}): QaWizardBlueprintReplacementProposal {
  if (!blueprintReplacementReasonIsValid(args.reason)) {
    throw new Error('replacement reason must be a bounded sanitized code');
  }
  if (!canonicalUtcTimestampIsValid(args.preparedAt)) {
    throw new Error('preparedAt must be canonical UTC with millisecond precision');
  }
  if (typeof args.preparedBy !== 'string' || args.preparedBy.length === 0) {
    throw new Error('replacement proposal requires a preparedBy');
  }
  if (!predecessorBindingIsValid(args.predecessor)) {
    throw new Error('replacement proposal predecessor binding is invalid');
  }
  if (!currentBindingIsValid(args.current)) {
    throw new Error('replacement proposal current binding is invalid');
  }
  // The successor must inherit the predecessor's exact content authoring
  // authority and request; a new ledger address may not be obtained by
  // changing story/prompt/model/style/content or the request identity.
  if (
    args.current.authoringAuthorityDigest !==
      args.predecessor.authoringAuthorityDigest ||
    args.current.requestDigest !== args.predecessor.requestDigest
  ) {
    throw new Error(
      'replacement current authority/request must equal the predecessor',
    );
  }
  const proposal = digestPayload({
    version: QA_WIZARD_BLUEPRINT_REPLACEMENT_PROPOSAL_VERSION,
    reason: args.reason,
    predecessor: args.predecessor,
    current: args.current,
    maxSuccessorExecutions: REPLACEMENT_SINGLE_SUCCESSOR,
    preparedBy: args.preparedBy,
    preparedAt: args.preparedAt,
    scope: 'single_use_paid_blueprint_replacement_proposal' as const,
  });
  if (!blueprintReplacementProposalIsValid(proposal)) {
    throw new Error('replacement proposal construction is invalid');
  }
  return proposal;
}

export function blueprintReplacementProposalIsValid(
  value: unknown,
): value is QaWizardBlueprintReplacementProposal {
  return (
    exactKeys(value, PROPOSAL_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_REPLACEMENT_PROPOSAL_VERSION &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    blueprintReplacementReasonIsValid(value.reason) &&
    predecessorBindingIsValid(value.predecessor) &&
    currentBindingIsValid(value.current) &&
    value.current.authoringAuthorityDigest ===
      value.predecessor.authoringAuthorityDigest &&
    value.current.requestDigest === value.predecessor.requestDigest &&
    value.maxSuccessorExecutions === REPLACEMENT_SINGLE_SUCCESSOR &&
    typeof value.preparedBy === 'string' &&
    value.preparedBy.length > 0 &&
    canonicalUtcTimestampIsValid(value.preparedAt) &&
    value.scope === 'single_use_paid_blueprint_replacement_proposal' &&
    hex(value.digest) &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}

export function buildBlueprintReplacementReview(args: {
  proposal: QaWizardBlueprintReplacementProposal;
  proposalPath: string;
  reviewedBy: string;
  reviewedAt: string;
  note?: string;
}): QaWizardBlueprintReplacementReview {
  if (!blueprintReplacementProposalIsValid(args.proposal)) {
    throw new Error('replacement review requires a valid proposal');
  }
  if (!nonEmptyPath(args.proposalPath)) {
    throw new Error('replacement review requires the proposal path');
  }
  if (typeof args.reviewedBy !== 'string' || args.reviewedBy.length === 0) {
    throw new Error('replacement review requires a reviewedBy');
  }
  if (!canonicalUtcTimestampIsValid(args.reviewedAt)) {
    throw new Error('reviewedAt must be canonical UTC with millisecond precision');
  }
  if (args.note !== undefined && !blueprintReplacementReviewNoteIsValid(args.note)) {
    throw new Error('replacement review note must be a bounded sanitized code');
  }
  // Canonical UTC millisecond timestamps compare lexically as chronologically;
  // a review may not predate the proposal it reviews.
  if (args.reviewedAt < args.proposal.preparedAt) {
    throw new Error('replacement review must not precede proposal preparation');
  }
  const review = digestPayload({
    version: QA_WIZARD_BLUEPRINT_REPLACEMENT_REVIEW_VERSION,
    proposalDigest: args.proposal.digest,
    proposalPath: args.proposalPath,
    disposition: 'recommend_replacement' as const,
    reviewedBy: args.reviewedBy,
    reviewedAt: args.reviewedAt,
    note: args.note ?? null,
    scope: 'single_use_paid_blueprint_replacement_review' as const,
  });
  if (!blueprintReplacementReviewIsValid(review)) {
    throw new Error('replacement review construction is invalid');
  }
  return review;
}

export function blueprintReplacementReviewIsValid(
  value: unknown,
): value is QaWizardBlueprintReplacementReview {
  return (
    exactKeys(value, REVIEW_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_REPLACEMENT_REVIEW_VERSION &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    hex(value.proposalDigest) &&
    nonEmptyPath(value.proposalPath) &&
    value.disposition === 'recommend_replacement' &&
    typeof value.reviewedBy === 'string' &&
    value.reviewedBy.length > 0 &&
    canonicalUtcTimestampIsValid(value.reviewedAt) &&
    (value.note === null || blueprintReplacementReviewNoteIsValid(value.note)) &&
    value.scope === 'single_use_paid_blueprint_replacement_review' &&
    hex(value.digest) &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}

/**
 * Deterministic, content-addressed successor execution identity. It is derived
 * from the approved lineage (proposal + review + exact Guy approval + the
 * predecessor claim + content authority) so that any second execute — under a
 * different output root or request identity — recomputes the same digest and
 * collides on the single immutable successor claim. The payload differs from
 * the content authoring-authority computation, so it can never equal the
 * predecessor's ledger key.
 */
export function blueprintReplacementSuccessorExecutionDigest(args: {
  proposalDigest: string;
  reviewDigest: string;
  approvedBy: typeof QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER;
  approvedAt: string;
  predecessorClaimDigest: string;
  authoringAuthorityDigest: string;
}): string {
  if (
    !hex(args.proposalDigest) ||
    !hex(args.reviewDigest) ||
    !hex(args.predecessorClaimDigest) ||
    !hex(args.authoringAuthorityDigest) ||
    args.approvedBy !== QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER ||
    !canonicalUtcTimestampIsValid(args.approvedAt)
  ) {
    throw new Error('successor execution identity inputs are invalid');
  }
  return canonicalJsonDigest({
    marker: SUCCESSOR_EXECUTION_IDENTITY_MARKER,
    proposalDigest: args.proposalDigest,
    reviewDigest: args.reviewDigest,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    predecessorClaimDigest: args.predecessorClaimDigest,
    authoringAuthorityDigest: args.authoringAuthorityDigest,
  });
}

export function buildBlueprintReplacementAuthorization(args: {
  proposal: QaWizardBlueprintReplacementProposal;
  proposalPath: string;
  review: QaWizardBlueprintReplacementReview;
  reviewPath: string;
  approvedBy: typeof QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER;
  approvedAt: string;
  note?: string;
}): QaWizardBlueprintReplacementAuthorization {
  if (args.approvedBy !== QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER) {
    throw new Error('replacement authorization is restricted to exact approver "Guy"');
  }
  if (!canonicalUtcTimestampIsValid(args.approvedAt)) {
    throw new Error('approvedAt must be canonical UTC with millisecond precision');
  }
  if (!blueprintReplacementProposalIsValid(args.proposal)) {
    throw new Error('replacement authorization requires a valid proposal');
  }
  if (!blueprintReplacementReviewIsValid(args.review)) {
    throw new Error('replacement authorization requires a valid review');
  }
  if (!nonEmptyPath(args.proposalPath) || !nonEmptyPath(args.reviewPath)) {
    throw new Error('replacement authorization requires proposal and review paths');
  }
  if (args.review.proposalDigest !== args.proposal.digest) {
    throw new Error('replacement authorization review is not bound to this proposal');
  }
  if (args.note !== undefined && !blueprintReplacementReviewNoteIsValid(args.note)) {
    throw new Error('replacement authorization note must be a bounded sanitized code');
  }
  // Approval may not predate the review, and by transitivity the proposal.
  if (args.approvedAt < args.review.reviewedAt) {
    throw new Error('replacement approval must not precede the review');
  }
  const successorExecutionDigest = blueprintReplacementSuccessorExecutionDigest({
    proposalDigest: args.proposal.digest,
    reviewDigest: args.review.digest,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    predecessorClaimDigest: args.proposal.predecessor.claimDigest,
    authoringAuthorityDigest: args.proposal.current.authoringAuthorityDigest,
  });
  if (
    successorExecutionDigest ===
    args.proposal.current.authoringAuthorityDigest
  ) {
    throw new Error('successor execution identity collides with content authority');
  }
  const authorization = digestPayload({
    version: QA_WIZARD_BLUEPRINT_REPLACEMENT_AUTHORIZATION_VERSION,
    proposalDigest: args.proposal.digest,
    proposalPath: args.proposalPath,
    reviewDigest: args.review.digest,
    reviewPath: args.reviewPath,
    authoringAuthorityDigest: args.proposal.current.authoringAuthorityDigest,
    requestDigest: args.proposal.current.requestDigest,
    preflightManifestDigest: args.proposal.current.preflightManifestDigest,
    predecessorClaimDigest: args.proposal.predecessor.claimDigest,
    predecessorClaimPath: args.proposal.predecessor.claimPath,
    successorExecutionDigest,
    maxSuccessorExecutions: REPLACEMENT_SINGLE_SUCCESSOR,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    note: args.note ?? null,
    scope: 'single_use_paid_blueprint_replacement_authorization' as const,
  });
  if (!blueprintReplacementAuthorizationIsValid(authorization)) {
    throw new Error('replacement authorization construction is invalid');
  }
  return authorization;
}

export function blueprintReplacementAuthorizationIsValid(
  value: unknown,
): value is QaWizardBlueprintReplacementAuthorization {
  return (
    exactKeys(value, AUTHORIZATION_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_REPLACEMENT_AUTHORIZATION_VERSION &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    hex(value.proposalDigest) &&
    nonEmptyPath(value.proposalPath) &&
    hex(value.reviewDigest) &&
    nonEmptyPath(value.reviewPath) &&
    hex(value.authoringAuthorityDigest) &&
    hex(value.requestDigest) &&
    hex(value.preflightManifestDigest) &&
    hex(value.predecessorClaimDigest) &&
    nonEmptyPath(value.predecessorClaimPath) &&
    hex(value.successorExecutionDigest) &&
    value.successorExecutionDigest !== value.authoringAuthorityDigest &&
    value.maxSuccessorExecutions === REPLACEMENT_SINGLE_SUCCESSOR &&
    value.approvedBy === QA_WIZARD_BLUEPRINT_REPLACEMENT_APPROVER &&
    canonicalUtcTimestampIsValid(value.approvedAt) &&
    (value.note === null || blueprintReplacementReviewNoteIsValid(value.note)) &&
    value.scope === 'single_use_paid_blueprint_replacement_authorization' &&
    hex(value.digest) &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}

export function buildBlueprintReplacementExecutionClaim(args: {
  authorization: QaWizardBlueprintReplacementAuthorization;
  authorizationPath: string;
  requestedAt: string;
  preflightManifestPath: string;
}): QaWizardBlueprintReplacementExecutionClaim {
  if (!blueprintReplacementAuthorizationIsValid(args.authorization)) {
    throw new Error('replacement execution claim requires a valid authorization');
  }
  if (!nonEmptyPath(args.authorizationPath)) {
    throw new Error('replacement execution claim requires the authorization path');
  }
  if (!canonicalUtcTimestampIsValid(args.requestedAt)) {
    throw new Error('requestedAt must be canonical UTC with millisecond precision');
  }
  if (!nonEmptyPath(args.preflightManifestPath)) {
    throw new Error('replacement execution claim requires the preflight manifest path');
  }
  const claim = digestPayload({
    version: QA_WIZARD_BLUEPRINT_REPLACEMENT_EXECUTION_CLAIM_VERSION,
    authoringAuthorityDigest: args.authorization.authoringAuthorityDigest,
    requestDigest: args.authorization.requestDigest,
    preflightManifestDigest: args.authorization.preflightManifestDigest,
    preflightManifestPath: args.preflightManifestPath,
    requestedAt: args.requestedAt,
    executionIdentityDigest: args.authorization.successorExecutionDigest,
    replacement: {
      authorizationDigest: args.authorization.digest,
      authorizationPath: args.authorizationPath,
      proposalDigest: args.authorization.proposalDigest,
      reviewDigest: args.authorization.reviewDigest,
      predecessorClaimDigest: args.authorization.predecessorClaimDigest,
      predecessorClaimPath: args.authorization.predecessorClaimPath,
    },
    scope: 'single_use_paid_replacement_blueprint_authoring' as const,
  });
  if (!blueprintReplacementExecutionClaimIsValid(claim)) {
    throw new Error('replacement execution claim construction is invalid');
  }
  return claim;
}

function replacementClaimBlockIsValid(value: unknown): boolean {
  return (
    exactKeys(value, REPLACEMENT_CLAIM_REPLACEMENT_KEYS) &&
    hex(value.authorizationDigest) &&
    nonEmptyPath(value.authorizationPath) &&
    hex(value.proposalDigest) &&
    hex(value.reviewDigest) &&
    hex(value.predecessorClaimDigest) &&
    nonEmptyPath(value.predecessorClaimPath)
  );
}

export function blueprintReplacementExecutionClaimIsValid(
  value: unknown,
): value is QaWizardBlueprintReplacementExecutionClaim {
  return (
    exactKeys(value, REPLACEMENT_CLAIM_KEYS) &&
    value.version === QA_WIZARD_BLUEPRINT_REPLACEMENT_EXECUTION_CLAIM_VERSION &&
    value.digestAlgorithm === DIGEST_ALGORITHM &&
    hex(value.authoringAuthorityDigest) &&
    hex(value.requestDigest) &&
    hex(value.preflightManifestDigest) &&
    nonEmptyPath(value.preflightManifestPath) &&
    canonicalUtcTimestampIsValid(value.requestedAt) &&
    hex(value.executionIdentityDigest) &&
    value.executionIdentityDigest !== value.authoringAuthorityDigest &&
    replacementClaimBlockIsValid(value.replacement) &&
    value.scope === 'single_use_paid_replacement_blueprint_authoring' &&
    hex(value.digest) &&
    value.digest === canonicalJsonDigest(payloadWithoutDigest(value))
  );
}
