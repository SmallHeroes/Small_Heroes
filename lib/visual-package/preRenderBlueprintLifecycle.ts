import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import path from 'path';

import { canonicalize } from '@/lib/canonical-json';

import {
  canonicalJsonDigest,
  isoTimestampIsValid,
  nonEmpty,
} from './integrity';
import {
  serializePreRenderBookVisualBlueprint,
  validatePreRenderBookVisualBlueprint,
} from './preRenderBlueprint';
import type {
  BlueprintFramePlacement,
  BlueprintRegion,
  PortraitBlueprintFrame,
  PreRenderBlueprintIssue,
  PreRenderBlueprintValidationContext,
  PreRenderBookVisualBlueprint,
} from './preRenderBlueprintTypes';
import type {
  PreRenderBlueprintAuthoringAttempt,
  PreRenderBlueprintAuthoringProvenance,
} from './preRenderBlueprintAuthoring';
import type {
  ReconciliationDisposition,
  ReconciliationSourceKind,
} from './sourcePromptReconciliation';

export const PRE_RENDER_BLUEPRINT_VALIDATION_EVIDENCE_VERSION =
  'pre-render-blueprint-validation-evidence/v1' as const;
export const PRE_RENDER_BLUEPRINT_REVIEW_PACKET_VERSION =
  'pre-render-blueprint-review-packet/v1' as const;
export const PRE_RENDER_BLUEPRINT_REVIEW_RENDERER_VERSION =
  'pre-render-blueprint-review-renderer/v1' as const;
export const PRE_RENDER_BLUEPRINT_APPROVAL_VERSION =
  'pre-render-blueprint-approval-attestation/v1' as const;
export const PRE_RENDER_BLUEPRINT_APPROVER = 'Guy' as const;

const DIGEST_ALGORITHM = 'canonical-json-sha256' as const;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const APPROVAL_EXCLUSIONS = [
  'board_mint',
  'image_render',
  'visual_package_promotion',
  'runtime_cutover',
  'deployment',
  'release',
] as const;

export interface PreRenderBlueprintValidationEvidence {
  version: typeof PRE_RENDER_BLUEPRINT_VALIDATION_EVIDENCE_VERSION;
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  validatorVersion: PreRenderBookVisualBlueprint['version'];
  valid: boolean;
  issues: PreRenderBlueprintIssue[];
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface PreRenderBlueprintSourceCoverageRecord {
  frameId: string;
  sourceKind: ReconciliationSourceKind;
  sourceDigest: string;
  beatIds: string[];
  dispositions: ReconciliationDisposition[];
}

export interface PreRenderBlueprintReviewFrame {
  id: string;
  kind: PortraitBlueprintFrame['kind'];
  pageNumber: number;
  narrative: PortraitBlueprintFrame['narrative'];
  locationId: string;
  zoneId: string;
  castIds: string[];
  requiredPropIds: string[];
  forbiddenPropIds: string[];
  placements: BlueprintFramePlacement[];
  camera: PortraitBlueprintFrame['camera'];
  textSafeRegion: BlueprintRegion;
  affordanceIds: string[];
  continuity: PortraitBlueprintFrame['continuity'];
}

export interface PreRenderBlueprintPriorApprovedDiff {
  status: 'none' | 'compared';
  previousBlueprintDigest: string | null;
  previousApprovalDigest: string | null;
  changedFrameIds: string[];
  addedConnectionIds: string[];
  removedConnectionIds: string[];
  addedAffordanceIds: string[];
  removedAffordanceIds: string[];
  authorityChanged: boolean;
}

export interface PreRenderBlueprintReviewPacket {
  version: typeof PRE_RENDER_BLUEPRINT_REVIEW_PACKET_VERSION;
  rendererVersion: typeof PRE_RENDER_BLUEPRINT_REVIEW_RENDERER_VERSION;
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  storyKey: string;
  styleId: string;
  readyForApproval: boolean;
  blockers: string[];
  warnings: string[];
  sourceCoverage: PreRenderBlueprintSourceCoverageRecord[];
  worldConnections: PreRenderBookVisualBlueprint['worldPlan']['connections'];
  supportingGeometry: PreRenderBookVisualBlueprint['worldPlan']['revealSafeSupportingGeometry'];
  revealTimeline: Array<{
    propId: string;
    propName: string;
    firstRevealPage: number | null;
  }>;
  frames: PreRenderBlueprintReviewFrame[];
  repairAttemptCount: number;
  priorApprovedDiff: PreRenderBlueprintPriorApprovedDiff;
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface PreRenderBlueprintApprovalAttestation {
  version: typeof PRE_RENDER_BLUEPRINT_APPROVAL_VERSION;
  blueprintDigest: string;
  authoringAuthorityDigest: string;
  reviewPacketDigest: string;
  approvedBy: typeof PRE_RENDER_BLUEPRINT_APPROVER;
  approvedAt: string;
  note?: string;
  scope: 'blueprint_planning_approval_only';
  doesNotAuthorize: typeof APPROVAL_EXCLUSIONS;
  digestAlgorithm: typeof DIGEST_ALGORITHM;
  digest: string;
}

export interface PreRenderBlueprintReviewBundle {
  packet: PreRenderBlueprintReviewPacket;
  markdown: string;
  contactSheetHtml: string;
}

export interface PreRenderBlueprintArtifactWrite {
  path: string;
  digest: string;
  created: boolean;
}

export interface PersistedPreRenderBlueprintLifecycle {
  candidate: PreRenderBlueprintArtifactWrite;
  provenance: PreRenderBlueprintArtifactWrite;
  validationEvidence: PreRenderBlueprintArtifactWrite;
  reviewPacket: PreRenderBlueprintArtifactWrite;
  reviewMarkdown: PreRenderBlueprintArtifactWrite;
  contactSheet: PreRenderBlueprintArtifactWrite;
  review: PreRenderBlueprintReviewBundle;
  evidence: PreRenderBlueprintValidationEvidence;
}

export interface ImmutableWriteHooks {
  /** Test-only fault seam after durable temp fsync and before atomic publish. */
  beforePublish?: (temporaryPath: string, destinationPath: string) => void;
}

function lexicalCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalBytes(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function payloadWithoutDigest<T extends { digestAlgorithm: string; digest: string }>(
  value: T,
): Omit<T, 'digestAlgorithm' | 'digest'> {
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = value;
  return payload;
}

function finalizeDigest<T extends object>(
  payload: T,
): T & { digestAlgorithm: typeof DIGEST_ALGORITHM; digest: string } {
  return {
    ...payload,
    digestAlgorithm: DIGEST_ALGORITHM,
    digest: canonicalJsonDigest(payload),
  };
}

function stableIdSet(values: readonly string[]): string[] {
  return [...new Set(values)].sort(lexicalCompare);
}

function issueText(issue: PreRenderBlueprintIssue): string {
  return `${issue.code}${issue.field ? ` (${issue.field})` : ''}: ${issue.message}`;
}

export function createPreRenderBlueprintValidationEvidence(args: {
  blueprint: PreRenderBookVisualBlueprint;
  context: PreRenderBlueprintValidationContext;
}): PreRenderBlueprintValidationEvidence {
  const validation = validatePreRenderBookVisualBlueprint(
    args.blueprint,
    args.context,
  );
  const issues = validation.ok ? [] : validation.issues;
  return finalizeDigest({
    version: PRE_RENDER_BLUEPRINT_VALIDATION_EVIDENCE_VERSION,
    blueprintDigest: args.blueprint.digest,
    authoringAuthorityDigest:
      args.blueprint.identity.authoringAuthority.digest,
    validatorVersion: args.blueprint.version,
    valid: validation.ok,
    issues,
  });
}

export function computePreRenderBlueprintApprovalDigest(
  attestation:
    | PreRenderBlueprintApprovalAttestation
    | Omit<PreRenderBlueprintApprovalAttestation, 'digestAlgorithm' | 'digest'>,
): string {
  return canonicalJsonDigest(
    'digest' in attestation
      ? payloadWithoutDigest(attestation)
      : attestation,
  );
}

function approvalShapeIssues(
  attestation: PreRenderBlueprintApprovalAttestation,
): string[] {
  const issues: string[] = [];
  if (attestation.version !== PRE_RENDER_BLUEPRINT_APPROVAL_VERSION) {
    issues.push('unsupported approval-attestation version');
  }
  if (attestation.approvedBy !== PRE_RENDER_BLUEPRINT_APPROVER) {
    issues.push('Blueprint approval is restricted to exact approver "Guy"');
  }
  if (!isoTimestampIsValid(attestation.approvedAt)) {
    issues.push('approval timestamp must be an ISO timestamp');
  }
  if (
    attestation.scope !== 'blueprint_planning_approval_only' ||
    canonicalBytes(attestation.doesNotAuthorize) !==
      canonicalBytes(APPROVAL_EXCLUSIONS)
  ) {
    issues.push('approval scope or explicit exclusions changed');
  }
  if (
    ![
      attestation.blueprintDigest,
      attestation.authoringAuthorityDigest,
      attestation.reviewPacketDigest,
      attestation.digest,
    ].every((digest) => HEX_SHA256.test(digest))
  ) {
    issues.push('approval digests must be lowercase SHA-256 hex');
  }
  if (
    attestation.digestAlgorithm !== DIGEST_ALGORITHM ||
    attestation.digest !== computePreRenderBlueprintApprovalDigest(attestation)
  ) {
    issues.push('approval attestation digest mismatch');
  }
  return issues;
}

function validatePreviousApproved(args: {
  blueprint: PreRenderBookVisualBlueprint;
  attestation: PreRenderBlueprintApprovalAttestation;
  current: PreRenderBookVisualBlueprint;
}): string[] {
  const issues = approvalShapeIssues(args.attestation);
  if (
    args.attestation.blueprintDigest !== args.blueprint.digest ||
    args.attestation.authoringAuthorityDigest !==
      args.blueprint.identity.authoringAuthority.digest
  ) {
    issues.push('prior approval does not bind the supplied prior Blueprint');
  }
  if (
    args.blueprint.identity.storyKey !== args.current.identity.storyKey ||
    args.blueprint.identity.styleId !== args.current.identity.styleId
  ) {
    issues.push('prior approved Blueprint is for a different Story Source identity or style');
  }
  return issues;
}

function buildPriorApprovedDiff(args: {
  current: PreRenderBookVisualBlueprint;
  previousApproved?: {
    blueprint: PreRenderBookVisualBlueprint;
    attestation: PreRenderBlueprintApprovalAttestation;
  };
}): PreRenderBlueprintPriorApprovedDiff {
  if (!args.previousApproved) {
    return {
      status: 'none',
      previousBlueprintDigest: null,
      previousApprovalDigest: null,
      changedFrameIds: [],
      addedConnectionIds: [],
      removedConnectionIds: [],
      addedAffordanceIds: [],
      removedAffordanceIds: [],
      authorityChanged: false,
    };
  }
  const priorIssues = validatePreviousApproved({
    ...args.previousApproved,
    current: args.current,
  });
  if (priorIssues.length > 0) {
    throw new Error(`Invalid prior-approved Blueprint: ${priorIssues.join('; ')}`);
  }
  const previous = args.previousApproved.blueprint;
  const previousFrames = new Map(
    previous.frames.map((frame) => [frame.id, canonicalBytes(frame)]),
  );
  const currentFrames = new Map(
    args.current.frames.map((frame) => [frame.id, canonicalBytes(frame)]),
  );
  const changedFrameIds = stableIdSet([
    ...[...previousFrames].filter(
      ([id, bytes]) => currentFrames.get(id) !== bytes,
    ).map(([id]) => id),
    ...[...currentFrames].filter(
      ([id, bytes]) => previousFrames.get(id) !== bytes,
    ).map(([id]) => id),
  ]);
  const previousConnections = new Set(
    previous.worldPlan.connections.map((entry) => entry.id),
  );
  const currentConnections = new Set(
    args.current.worldPlan.connections.map((entry) => entry.id),
  );
  const previousAffordances = new Set(
    previous.worldPlan.affordances.map((entry) => entry.id),
  );
  const currentAffordances = new Set(
    args.current.worldPlan.affordances.map((entry) => entry.id),
  );
  return {
    status: 'compared',
    previousBlueprintDigest: previous.digest,
    previousApprovalDigest: args.previousApproved.attestation.digest,
    changedFrameIds,
    addedConnectionIds: [...currentConnections]
      .filter((id) => !previousConnections.has(id))
      .sort(lexicalCompare),
    removedConnectionIds: [...previousConnections]
      .filter((id) => !currentConnections.has(id))
      .sort(lexicalCompare),
    addedAffordanceIds: [...currentAffordances]
      .filter((id) => !previousAffordances.has(id))
      .sort(lexicalCompare),
    removedAffordanceIds: [...previousAffordances]
      .filter((id) => !currentAffordances.has(id))
      .sort(lexicalCompare),
    authorityChanged:
      previous.identity.authoringAuthority.digest !==
      args.current.identity.authoringAuthority.digest,
  };
}

function buildSourceCoverage(
  context: PreRenderBlueprintValidationContext,
): PreRenderBlueprintSourceCoverageRecord[] {
  return context.reconciliation.frames
    .flatMap((frame) =>
      frame.sourceRequirements.map((requirement) => ({
        frameId:
          frame.frameKind === 'cover'
            ? 'frame:cover'
            : `frame:page:${frame.pageNumber}`,
        sourceKind: requirement.sourceKind,
        sourceDigest: canonicalJsonDigest(requirement.sourceText),
        beatIds: requirement.visualBeats
          .map((beat) => beat.id)
          .sort(lexicalCompare),
        dispositions: requirement.visualBeats
          .map((beat) => beat.disposition)
          .sort(lexicalCompare),
      })),
    )
    .sort((left, right) =>
      lexicalCompare(
        `${left.frameId}\u0000${left.sourceKind}`,
        `${right.frameId}\u0000${right.sourceKind}`,
      ),
    );
}

function reviewPacketPayload(
  packet: PreRenderBlueprintReviewPacket,
): Omit<PreRenderBlueprintReviewPacket, 'digestAlgorithm' | 'digest'> {
  return payloadWithoutDigest(packet);
}

export function computePreRenderBlueprintReviewPacketDigest(
  packet:
    | PreRenderBlueprintReviewPacket
    | Omit<PreRenderBlueprintReviewPacket, 'digestAlgorithm' | 'digest'>,
): string {
  return canonicalJsonDigest(
    'digest' in packet ? reviewPacketPayload(packet) : packet,
  );
}

function createReviewPacket(args: {
  blueprint: PreRenderBookVisualBlueprint;
  context: PreRenderBlueprintValidationContext;
  provenance: PreRenderBlueprintAuthoringProvenance;
  repairAttempts?: readonly PreRenderBlueprintAuthoringAttempt[];
  previousApproved?: {
    blueprint: PreRenderBookVisualBlueprint;
    attestation: PreRenderBlueprintApprovalAttestation;
  };
}): PreRenderBlueprintReviewPacket {
  const evidence = createPreRenderBlueprintValidationEvidence(args);
  const sourceCoverage = buildSourceCoverage(args.context);
  const blockers = [
    ...evidence.issues.map(issueText),
    ...sourceCoverage
      .filter(
        (record) =>
          record.beatIds.length === 0 ||
          record.dispositions.includes('unresolved'),
      )
      .map(
        (record) =>
          `unresolved source coverage: ${record.frameId} ${record.sourceKind}`,
      ),
  ];
  if (args.provenance.blueprintDigest !== args.blueprint.digest) {
    blockers.push('authoring provenance binds a different Blueprint digest');
  }
  if (
    args.provenance.authoringAuthorityDigest !==
    args.blueprint.identity.authoringAuthority.digest
  ) {
    blockers.push('authoring provenance binds a different authoring authority');
  }
  const warnings = (args.repairAttempts ?? []).flatMap((attempt) =>
    attempt.errors.map(
      (error) => `authoring attempt ${attempt.attempt}: ${error}`,
    ),
  );
  const payload = {
    version: PRE_RENDER_BLUEPRINT_REVIEW_PACKET_VERSION,
    rendererVersion: PRE_RENDER_BLUEPRINT_REVIEW_RENDERER_VERSION,
    blueprintDigest: args.blueprint.digest,
    authoringAuthorityDigest:
      args.blueprint.identity.authoringAuthority.digest,
    storyKey: args.blueprint.identity.storyKey,
    styleId: args.blueprint.identity.styleId,
    readyForApproval: blockers.length === 0,
    blockers,
    warnings,
    sourceCoverage,
    worldConnections: args.blueprint.worldPlan.connections,
    supportingGeometry:
      args.blueprint.worldPlan.revealSafeSupportingGeometry,
    revealTimeline: args.blueprint.visualContract.recurringProps
      .map((prop) => ({
        propId: prop.id,
        propName: prop.name,
        firstRevealPage: prop.firstRevealPage ?? null,
      }))
      .sort((left, right) => lexicalCompare(left.propId, right.propId)),
    frames: args.blueprint.frames.map((frame) => ({
      id: frame.id,
      kind: frame.kind,
      pageNumber: frame.kind === 'cover' ? 0 : frame.pageNumber,
      narrative: frame.narrative,
      locationId: frame.locationId,
      zoneId: frame.zoneId,
      castIds: frame.castIds,
      requiredPropIds: frame.propLifecycle.requiredPropIds,
      forbiddenPropIds: frame.propLifecycle.forbiddenPropIds,
      placements: frame.placements,
      camera: frame.camera,
      textSafeRegion: frame.textSafeRegion,
      affordanceIds: frame.affordanceIds,
      continuity: frame.continuity,
    })),
    repairAttemptCount: (args.repairAttempts ?? []).length,
    priorApprovedDiff: buildPriorApprovedDiff({
      current: args.blueprint,
      previousApproved: args.previousApproved,
    }),
  } satisfies Omit<
    PreRenderBlueprintReviewPacket,
    'digestAlgorithm' | 'digest'
  >;
  return {
    ...payload,
    digestAlgorithm: DIGEST_ALGORITHM,
    digest: computePreRenderBlueprintReviewPacketDigest(payload),
  };
}

function placementLabel(placement: BlueprintFramePlacement): string {
  switch (placement.subject.kind) {
    case 'cast':
      return `cast ${placement.subject.castId}`;
    case 'prop':
      return `prop ${placement.subject.propId}`;
    case 'action':
      return `action ${placement.subject.checkId}`;
    case 'supporting_geometry':
      return `geometry ${placement.subject.geometryId}`;
  }
}

function regionText(region: BlueprintRegion): string {
  return `${region.x},${region.y} ${region.width}×${region.height}`;
}

function renderReviewMarkdown(packet: PreRenderBlueprintReviewPacket): string {
  const lines: string[] = [
    `# Blueprint planning review — ${packet.storyKey} / ${packet.styleId}`,
    '',
    '> Planning/feasibility review only. This is not image, style, render, release, or deployment acceptance.',
    '',
    `- Blueprint digest: \`${packet.blueprintDigest}\``,
    `- Authoring authority: \`${packet.authoringAuthorityDigest}\``,
    `- Review packet: \`${packet.digest}\``,
    `- Ready for Blueprint approval: **${packet.readyForApproval ? 'YES' : 'NO'}**`,
    '',
    '## Blockers and warnings',
    '',
    ...(packet.blockers.length
      ? packet.blockers.map((entry) => `- BLOCKER: ${entry}`)
      : ['- Blockers: none.']),
    ...(packet.warnings.length
      ? packet.warnings.map((entry) => `- WARNING: ${entry}`)
      : ['- Warnings: none.']),
    '',
    '## World connections',
    '',
    ...(packet.worldConnections.length
      ? packet.worldConnections.map(
          (connection) =>
            `- \`${connection.id}\` ${connection.kind}: \`${connection.from.zoneId}\` → \`${connection.to.zoneId}\`; traversal=[${connection.traversalAffordanceIds.join(', ')}], openings=[${connection.openingClearanceAffordanceIds.join(', ')}], safety=[${connection.safeBoundaryAffordanceIds.join(', ')}].`,
        )
      : ['- No cross-zone connection is required.']),
    '',
    '## Reveal timeline and supporting geometry',
    '',
    ...(packet.revealTimeline.length
      ? packet.revealTimeline.map(
          (entry) =>
            `- \`${entry.propId}\` (${entry.propName}): first reveal ${entry.firstRevealPage ?? 'not lifecycle-gated'}.`,
        )
      : ['- No recurring prop reveal timeline.']),
    ...packet.supportingGeometry.map(
      (entry) =>
        `- Supporting geometry \`${entry.id}\` in \`${entry.zoneId}/${entry.spatialNodeId}\` supports [${entry.supportsPropIds.join(', ')}] and is spoiler-neutral.`,
    ),
    '',
    '## Source coverage',
    '',
    ...packet.sourceCoverage.map(
      (entry) =>
        `- \`${entry.frameId}\` / ${entry.sourceKind}: beats [${entry.beatIds.join(', ')}], dispositions [${entry.dispositions.join(', ')}], source \`${entry.sourceDigest}\`.`,
    ),
    '',
    '## Cover and page frames',
    '',
  ];
  for (const frame of packet.frames) {
    lines.push(
      `### ${frame.id}`,
      '',
      `- Narrative: **${frame.narrative.purpose}** — ${frame.narrative.summary}`,
      `- World: \`${frame.locationId} / ${frame.zoneId}\`; cast [${frame.castIds.join(', ')}].`,
      `- Reveal state: required [${frame.requiredPropIds.join(', ')}], forbidden [${frame.forbiddenPropIds.join(', ')}].`,
      `- Text-safe region: ${regionText(frame.textSafeRegion)}.`,
      `- Camera: ${frame.camera.shot}/${frame.camera.angle} via \`${frame.camera.affordanceId}\`.`,
      `- Transition: ${frame.continuity.transitionKind}${frame.continuity.connectionId ? ` via \`${frame.continuity.connectionId}\`` : ''}; previous=${frame.continuity.previousFrameId ?? 'none'}; carryover=[${frame.continuity.carryoverRefs.map((ref) => `${ref.kind}:${ref.id}`).join(', ')}].`,
      '- Placements:',
      ...frame.placements.map(
        (placement) =>
          `  - \`${placement.id}\`: ${placementLabel(placement)}; ${placement.depth}/${placement.importance}; region ${regionText(placement.region)}.`,
      ),
      `- Affordances: [${frame.affordanceIds.join(', ')}].`,
      '',
    );
  }
  lines.push(
    '## Prior-approved Blueprint diff',
    '',
    packet.priorApprovedDiff.status === 'none'
      ? '- No prior approved Blueprint was supplied.'
      : `- Previous \`${packet.priorApprovedDiff.previousBlueprintDigest}\` / approval \`${packet.priorApprovedDiff.previousApprovalDigest}\`; changed frames [${packet.priorApprovedDiff.changedFrameIds.join(', ')}]; connections +[${packet.priorApprovedDiff.addedConnectionIds.join(', ')}] -[${packet.priorApprovedDiff.removedConnectionIds.join(', ')}]; affordances +[${packet.priorApprovedDiff.addedAffordanceIds.join(', ')}] -[${packet.priorApprovedDiff.removedAffordanceIds.join(', ')}]; authority changed=${packet.priorApprovedDiff.authorityChanged}.`,
    '',
    '## Scope',
    '',
    '- Blueprint approval attests only to this exact planning digest and stable authoring authority.',
    '- It does not authorize a Board mint, render, Visual Package promotion, runtime cutover, deployment, or release.',
    '',
  );
  return lines.join('\n');
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function placementClass(placement: BlueprintFramePlacement): string {
  return `placement ${placement.subject.kind} ${placement.importance}`;
}

function regionStyle(region: BlueprintRegion): string {
  return `left:${region.x / 10}%;top:${region.y / 10}%;width:${region.width / 10}%;height:${region.height / 10}%`;
}

function renderContactSheetHtml(packet: PreRenderBlueprintReviewPacket): string {
  const frameCards = packet.frames
    .map(
      (frame) => `
      <article class="frame-card">
        <header><strong>${escapeHtml(frame.id)}</strong><span>${escapeHtml(frame.narrative.purpose)}</span></header>
        <div class="portrait">
          <div class="text-safe" style="${regionStyle(frame.textSafeRegion)}">TEXT SAFE</div>
          ${frame.placements
            .map(
              (placement) =>
                `<div class="${placementClass(placement)}" style="${regionStyle(placement.region)}">${escapeHtml(placementLabel(placement))}</div>`,
            )
            .join('')}
        </div>
        <div class="details">
          <p>${escapeHtml(frame.locationId)} / ${escapeHtml(frame.zoneId)} · ${escapeHtml(frame.camera.shot)} / ${escapeHtml(frame.camera.angle)}</p>
          <p>${escapeHtml(frame.narrative.summary)}</p>
          <p>transition: ${escapeHtml(frame.continuity.transitionKind)}${frame.continuity.connectionId ? ` · ${escapeHtml(frame.continuity.connectionId)}` : ''}</p>
          <p>required props: ${escapeHtml(frame.requiredPropIds.join(', ') || 'none')}</p>
          <p>forbidden props: ${escapeHtml(frame.forbiddenPropIds.join(', ') || 'none')}</p>
          <p>affordances: ${escapeHtml(frame.affordanceIds.join(', '))}</p>
        </div>
      </article>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Blueprint contact sheet — ${escapeHtml(packet.storyKey)}</title>
<style>
:root{font-family:ui-sans-serif,system-ui;color:#172033;background:#f3f5f8}body{margin:0;padding:24px}h1,h2{margin:.2em 0}.meta,.summary{background:white;border:1px solid #cbd3df;border-radius:12px;padding:16px;margin:14px 0}.status{font-weight:800;color:${packet.readyForApproval ? '#16734b' : '#a32929'}}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}.frame-card{background:white;border:1px solid #aeb9c8;border-radius:12px;padding:10px;box-shadow:0 2px 8px #17203315}.frame-card header{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:8px}.portrait{position:relative;width:100%;aspect-ratio:2/3;background:linear-gradient(160deg,#eef2f7,#dce3ec);overflow:hidden;border:1px solid #8e9aac}.text-safe,.placement{position:absolute;box-sizing:border-box;border:2px solid;padding:2px;font-size:9px;overflow:hidden}.text-safe{border-color:#1877c9;background:#74b9ff38;color:#064a82}.placement.cast{border-color:#7847b8;background:#bd93f938}.placement.prop{border-color:#c77514;background:#ffb84d48}.placement.action{border-color:#bb3154;background:#ff6f9140}.placement.supporting_geometry{border-color:#377a4a;background:#6fd08c3d}.placement.key{border-width:3px}.details{font-size:11px;line-height:1.3}.details p{margin:5px 0}code{word-break:break-all}ul{margin:.4em 0}
</style>
</head>
<body>
<h1>Blueprint planning contact sheet</h1>
<section class="meta">
<p><strong>${escapeHtml(packet.storyKey)} / ${escapeHtml(packet.styleId)}</strong></p>
<p class="status">Ready for Blueprint approval: ${packet.readyForApproval ? 'YES' : 'NO'}</p>
<p>Blueprint <code>${packet.blueprintDigest}</code><br>Authority <code>${packet.authoringAuthorityDigest}</code><br>Review <code>${packet.digest}</code></p>
<p>Planning review only — no image/style acceptance, Board mint, render, promotion, runtime cutover, deployment, or release authority.</p>
</section>
<section class="summary">
<h2>World connections</h2>
<ul>${packet.worldConnections.map((entry) => `<li>${escapeHtml(entry.id)}: ${escapeHtml(entry.from.zoneId)} → ${escapeHtml(entry.to.zoneId)} (${escapeHtml(entry.kind)})</li>`).join('') || '<li>none</li>'}</ul>
<h2>Reveal timeline and supporting geometry</h2>
<ul>${packet.revealTimeline.map((entry) => `<li>${escapeHtml(entry.propId)}: ${escapeHtml(entry.firstRevealPage ?? 'not gated')}</li>`).join('') || '<li>none</li>'}${packet.supportingGeometry.map((entry) => `<li>${escapeHtml(entry.id)}: ${escapeHtml(entry.zoneId)} / ${escapeHtml(entry.spatialNodeId)} supports ${escapeHtml(entry.supportsPropIds.join(', '))}</li>`).join('')}</ul>
<h2>Warnings and blockers</h2>
<ul>${[...packet.blockers.map((entry) => `BLOCKER: ${entry}`), ...packet.warnings.map((entry) => `WARNING: ${entry}`)].map((entry) => `<li>${escapeHtml(entry)}</li>`).join('') || '<li>none</li>'}</ul>
<h2>Source coverage</h2>
<ul>${packet.sourceCoverage.map((entry) => `<li>${escapeHtml(entry.frameId)} / ${escapeHtml(entry.sourceKind)}: ${escapeHtml(entry.dispositions.join(', '))} · beats ${escapeHtml(entry.beatIds.join(', '))}</li>`).join('')}</ul>
<h2>Prior-approved diff</h2>
<p>${packet.priorApprovedDiff.status === 'none' ? 'No prior approved Blueprint supplied.' : `Changed frames: ${escapeHtml(packet.priorApprovedDiff.changedFrameIds.join(', ') || 'none')}; authority changed: ${packet.priorApprovedDiff.authorityChanged}`}</p>
</section>
<main class="grid">${frameCards}</main>
</body>
</html>`;
}

export function buildPreRenderBlueprintReviewBundle(args: {
  blueprint: PreRenderBookVisualBlueprint;
  context: PreRenderBlueprintValidationContext;
  provenance: PreRenderBlueprintAuthoringProvenance;
  repairAttempts?: readonly PreRenderBlueprintAuthoringAttempt[];
  previousApproved?: {
    blueprint: PreRenderBookVisualBlueprint;
    attestation: PreRenderBlueprintApprovalAttestation;
  };
}): PreRenderBlueprintReviewBundle {
  const packet = createReviewPacket(args);
  return {
    packet,
    markdown: renderReviewMarkdown(packet),
    contactSheetHtml: renderContactSheetHtml(packet),
  };
}

let temporaryWriteCounter = 0;

/**
 * Atomic content-addressed no-overwrite publication.
 *
 * Bytes are fully written and fsynced to a private temp file, then hard-linked into the immutable destination.
 * `link` is atomic and fails if the destination exists. Identical existing bytes are idempotent; differing bytes
 * at the same content address fail closed and are never replaced.
 */
export function writeImmutableLocalArtifact(args: {
  destinationPath: string;
  bytes: string;
  hooks?: ImmutableWriteHooks;
}): { created: boolean } {
  const destination = path.resolve(args.destinationPath);
  mkdirSync(path.dirname(destination), { recursive: true });
  if (existsSync(destination)) {
    if (readFileSync(destination, 'utf8') !== args.bytes) {
      throw new Error(`immutable artifact collision at ${destination}`);
    }
    return { created: false };
  }
  temporaryWriteCounter += 1;
  const temporary = `${destination}.tmp-${process.pid}-${temporaryWriteCounter}`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporary, 'wx');
    writeFileSync(descriptor, args.bytes, 'utf8');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    args.hooks?.beforePublish?.(temporary, destination);
    try {
      linkSync(temporary, destination);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'EEXIST' &&
        readFileSync(destination, 'utf8') === args.bytes
      ) {
        return { created: false };
      }
      throw error;
    }
    return { created: true };
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function authorityRoot(
  root: string,
  blueprint: PreRenderBookVisualBlueprint,
): string {
  return path.join(
    path.resolve(root),
    'authorities',
    blueprint.identity.authoringAuthority.digest,
  );
}

function immutableWrite(args: {
  path: string;
  bytes: string;
  digest: string;
  hooks?: ImmutableWriteHooks;
}): PreRenderBlueprintArtifactWrite {
  const result = writeImmutableLocalArtifact({
    destinationPath: args.path,
    bytes: args.bytes,
    hooks: args.hooks,
  });
  return {
    path: args.path,
    digest: args.digest,
    created: result.created,
  };
}

export function persistPreRenderBlueprintLifecycle(args: {
  root: string;
  blueprint: PreRenderBookVisualBlueprint;
  context: PreRenderBlueprintValidationContext;
  provenance: PreRenderBlueprintAuthoringProvenance;
  repairAttempts?: readonly PreRenderBlueprintAuthoringAttempt[];
  previousApproved?: {
    blueprint: PreRenderBookVisualBlueprint;
    attestation: PreRenderBlueprintApprovalAttestation;
  };
  hooks?: ImmutableWriteHooks;
}): PersistedPreRenderBlueprintLifecycle {
  const evidence = createPreRenderBlueprintValidationEvidence(args);
  if (!evidence.valid) {
    throw new Error(
      `refusing to persist invalid Blueprint: ${evidence.issues.map(issueText).join('; ')}`,
    );
  }
  if (
    args.provenance.blueprintDigest !== args.blueprint.digest ||
    args.provenance.authoringAuthorityDigest !==
      args.blueprint.identity.authoringAuthority.digest
  ) {
    throw new Error('refusing to persist stale authoring provenance');
  }
  const review = buildPreRenderBlueprintReviewBundle(args);
  if (!review.packet.readyForApproval) {
    throw new Error(
      `refusing to persist review-unready Blueprint: ${review.packet.blockers.join('; ')}`,
    );
  }

  const root = authorityRoot(args.root, args.blueprint);
  const candidateBytes = serializePreRenderBookVisualBlueprint(args.blueprint);
  const provenanceBytes = canonicalBytes(args.provenance);
  const evidenceBytes = canonicalBytes(evidence);
  const reviewBytes = canonicalBytes(review.packet);
  const provenanceDigest = canonicalJsonDigest(args.provenance);
  const markdownDigest = canonicalJsonDigest(review.markdown);
  const contactSheetDigest = canonicalJsonDigest(review.contactSheetHtml);
  const candidate = immutableWrite({
    path: path.join(
      root,
      'candidates',
      args.blueprint.digest,
      'blueprint.json',
    ),
    bytes: candidateBytes,
    digest: args.blueprint.digest,
    hooks: args.hooks,
  });
  const provenance = immutableWrite({
    path: path.join(root, 'provenance', `${provenanceDigest}.json`),
    bytes: provenanceBytes,
    digest: provenanceDigest,
    hooks: args.hooks,
  });
  const validationEvidence = immutableWrite({
    path: path.join(root, 'validation', `${evidence.digest}.json`),
    bytes: evidenceBytes,
    digest: evidence.digest,
    hooks: args.hooks,
  });
  const reviewRoot = path.join(root, 'reviews', review.packet.digest);
  const reviewPacket = immutableWrite({
    path: path.join(reviewRoot, 'review.json'),
    bytes: reviewBytes,
    digest: review.packet.digest,
    hooks: args.hooks,
  });
  const reviewMarkdown = immutableWrite({
    path: path.join(reviewRoot, `review.${markdownDigest}.md`),
    bytes: review.markdown,
    digest: markdownDigest,
    hooks: args.hooks,
  });
  const contactSheet = immutableWrite({
    path: path.join(
      reviewRoot,
      `contact-sheet.${contactSheetDigest}.html`,
    ),
    bytes: review.contactSheetHtml,
    digest: contactSheetDigest,
    hooks: args.hooks,
  });
  return {
    candidate,
    provenance,
    validationEvidence,
    reviewPacket,
    reviewMarkdown,
    contactSheet,
    review,
    evidence,
  };
}

function reviewPacketIssues(args: {
  packet: PreRenderBlueprintReviewPacket;
  blueprint: PreRenderBookVisualBlueprint;
}): string[] {
  const issues: string[] = [];
  if (
    args.packet.version !== PRE_RENDER_BLUEPRINT_REVIEW_PACKET_VERSION ||
    args.packet.rendererVersion !==
      PRE_RENDER_BLUEPRINT_REVIEW_RENDERER_VERSION
  ) {
    issues.push('review packet version is unsupported');
  }
  if (
    args.packet.digestAlgorithm !== DIGEST_ALGORITHM ||
    args.packet.digest !==
      computePreRenderBlueprintReviewPacketDigest(args.packet)
  ) {
    issues.push('review packet digest mismatch');
  }
  if (
    args.packet.blueprintDigest !== args.blueprint.digest ||
    args.packet.authoringAuthorityDigest !==
      args.blueprint.identity.authoringAuthority.digest ||
    args.packet.storyKey !== args.blueprint.identity.storyKey ||
    args.packet.styleId !== args.blueprint.identity.styleId
  ) {
    issues.push('review packet does not bind the exact Blueprint authority');
  }
  if (!args.packet.readyForApproval || args.packet.blockers.length > 0) {
    issues.push('review packet is not ready for approval');
  }
  if (
    args.packet.sourceCoverage.some(
      (record) =>
        record.beatIds.length === 0 ||
        record.dispositions.includes('unresolved'),
    )
  ) {
    issues.push('review packet contains unresolved source coverage');
  }
  return issues;
}

export function validatePreRenderBlueprintApprovalAttestation(args: {
  blueprint: PreRenderBookVisualBlueprint;
  context: PreRenderBlueprintValidationContext;
  reviewPacket: PreRenderBlueprintReviewPacket;
  attestation: PreRenderBlueprintApprovalAttestation;
}): string[] {
  const issues = approvalShapeIssues(args.attestation);
  const validation = validatePreRenderBookVisualBlueprint(
    args.blueprint,
    args.context,
  );
  if (!validation.ok) {
    issues.push(
      ...validation.issues.map(
        (entry) => `Blueprint is stale or invalid: ${issueText(entry)}`,
      ),
    );
  }
  issues.push(
    ...reviewPacketIssues({
      packet: args.reviewPacket,
      blueprint: args.blueprint,
    }),
  );
  if (
    args.attestation.blueprintDigest !== args.blueprint.digest ||
    args.attestation.authoringAuthorityDigest !==
      args.blueprint.identity.authoringAuthority.digest ||
    args.attestation.reviewPacketDigest !== args.reviewPacket.digest
  ) {
    issues.push('approval does not bind the exact Blueprint/review/authority digests');
  }
  return stableIdSet(issues);
}

export function writePreRenderBlueprintApprovalAttestation(args: {
  root: string;
  blueprint: PreRenderBookVisualBlueprint;
  context: PreRenderBlueprintValidationContext;
  reviewPacket: PreRenderBlueprintReviewPacket;
  approvedBy: string;
  approvedAt: string;
  note?: string;
  hooks?: ImmutableWriteHooks;
}): {
  attestation: PreRenderBlueprintApprovalAttestation;
  artifact: PreRenderBlueprintArtifactWrite;
} {
  if (args.approvedBy !== PRE_RENDER_BLUEPRINT_APPROVER) {
    throw new Error('Blueprint approval is restricted to exact approver "Guy"');
  }
  if (!isoTimestampIsValid(args.approvedAt)) {
    throw new Error('approvedAt must be a valid ISO timestamp');
  }
  const candidatePath = path.join(
    authorityRoot(args.root, args.blueprint),
    'candidates',
    args.blueprint.digest,
    'blueprint.json',
  );
  if (
    !existsSync(candidatePath) ||
    readFileSync(candidatePath, 'utf8') !==
      serializePreRenderBookVisualBlueprint(args.blueprint)
  ) {
    throw new Error('exact persisted Blueprint candidate is missing or changed');
  }
  const reviewPath = path.join(
    authorityRoot(args.root, args.blueprint),
    'reviews',
    args.reviewPacket.digest,
    'review.json',
  );
  if (
    !existsSync(reviewPath) ||
    readFileSync(reviewPath, 'utf8') !== canonicalBytes(args.reviewPacket)
  ) {
    throw new Error('exact persisted review packet is missing or changed');
  }
  const payload = {
    version: PRE_RENDER_BLUEPRINT_APPROVAL_VERSION,
    blueprintDigest: args.blueprint.digest,
    authoringAuthorityDigest:
      args.blueprint.identity.authoringAuthority.digest,
    reviewPacketDigest: args.reviewPacket.digest,
    approvedBy: PRE_RENDER_BLUEPRINT_APPROVER,
    approvedAt: args.approvedAt,
    ...(nonEmpty(args.note) ? { note: args.note.trim() } : {}),
    scope: 'blueprint_planning_approval_only' as const,
    doesNotAuthorize: APPROVAL_EXCLUSIONS,
  };
  const attestation: PreRenderBlueprintApprovalAttestation = {
    ...payload,
    digestAlgorithm: DIGEST_ALGORITHM,
    digest: computePreRenderBlueprintApprovalDigest(payload),
  };
  const issues = validatePreRenderBlueprintApprovalAttestation({
    blueprint: args.blueprint,
    context: args.context,
    reviewPacket: args.reviewPacket,
    attestation,
  });
  if (issues.length > 0) {
    throw new Error(`Blueprint approval rejected: ${issues.join('; ')}`);
  }
  const approvalPath = path.join(
    authorityRoot(args.root, args.blueprint),
    'approvals',
    args.blueprint.digest,
    `${attestation.digest}.json`,
  );
  return {
    attestation,
    artifact: immutableWrite({
      path: approvalPath,
      bytes: canonicalBytes(attestation),
      digest: attestation.digest,
      hooks: args.hooks,
    }),
  };
}
