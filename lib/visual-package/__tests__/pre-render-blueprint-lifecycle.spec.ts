import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PRE_RENDER_BLUEPRINT_APPROVER,
  buildPreRenderBlueprintReviewBundle,
  finalizePreRenderBookVisualBlueprint,
  persistPreRenderBlueprintLifecycle,
  serializePreRenderBookVisualBlueprint,
  validatePreRenderBlueprintApprovalAttestation,
  writeImmutableLocalArtifact,
  writePreRenderBlueprintApprovalAttestation,
  type PreRenderBlueprintAuthoringProvenance,
  type PreRenderBookVisualBlueprint,
} from '@/lib/visual-package';

import { buildBlueprintFixture } from './pre-render-book-visual-blueprint.fixtures';

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(
    path.join(tmpdir(), 'small-heroes-pvb-lifecycle-'),
  );
  temporaryRoots.push(root);
  return root;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function provenanceFor(
  blueprint: PreRenderBookVisualBlueprint,
): PreRenderBlueprintAuthoringProvenance {
  return {
    version: 'pre-render-blueprint-authoring-provenance/v3',
    blueprintDigest: blueprint.digest,
    authoringAuthorityDigest:
      blueprint.identity.authoringAuthority.digest,
    model: 'synthetic-offline-fixture',
    reasoningEffort: 'medium',
    maxOutputTokens: 48_000,
    noFallback: true,
    draftSchemaVersion: 'pre-render-blueprint-draft-schema/v5',
    promptVersion: 'pre-render-blueprint-authoring-prompt/v4',
    passingAttempt: 1,
    callCount: 1,
    systemPromptDigest: 'a'.repeat(64),
    userPromptDigest: 'b'.repeat(64),
  };
}

function revisedBlueprint(
  blueprint: PreRenderBookVisualBlueprint,
): PreRenderBookVisualBlueprint {
  const {
    digest: _digest,
    digestAlgorithm: _digestAlgorithm,
    ...draft
  } = clone(blueprint);
  draft.frames[1].narrative.summary =
    'A deliberately revised synthetic planning summary';
  return finalizePreRenderBookVisualBlueprint(draft);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('R1D-PVB-B - immutable Blueprint review and approval lifecycle', () => {
  it('persists separate content-addressed artifacts and deterministic review surfaces', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const root = temporaryRoot();
    const provenance = provenanceFor(fixture.blueprint);

    const first = persistPreRenderBlueprintLifecycle({
      root,
      blueprint: fixture.blueprint,
      context: fixture.context,
      provenance,
    });
    const second = persistPreRenderBlueprintLifecycle({
      root,
      blueprint: fixture.blueprint,
      context: fixture.context,
      provenance,
    });

    expect(first.candidate.path).toContain(
      path.join(
        'authorities',
        fixture.blueprint.identity.authoringAuthority.digest,
        'candidates',
        fixture.blueprint.digest,
      ),
    );
    expect(readFileSync(first.candidate.path, 'utf8')).toBe(
      serializePreRenderBookVisualBlueprint(fixture.blueprint),
    );
    expect([
      first.candidate.path,
      first.provenance.path,
      first.validationEvidence.path,
      first.reviewPacket.path,
      first.reviewMarkdown.path,
      first.contactSheet.path,
    ]).toHaveLength(6);
    expect(
      new Set([
        first.candidate.path,
        first.provenance.path,
        first.validationEvidence.path,
        first.reviewPacket.path,
        first.reviewMarkdown.path,
        first.contactSheet.path,
      ]).size,
    ).toBe(6);
    expect(
      [
        second.candidate,
        second.provenance,
        second.validationEvidence,
        second.reviewPacket,
        second.reviewMarkdown,
        second.contactSheet,
      ].every((artifact) => artifact.created === false),
    ).toBe(true);
    expect(second.review).toEqual(first.review);
    expect(first.review.packet.authoringProvenance).toMatchObject({
      model: 'synthetic-offline-fixture',
      reasoningEffort: 'medium',
      maxOutputTokens: 48_000,
      noFallback: true,
      passingAttempt: 1,
      callCount: 1,
    });
    expect(first.review.packet.validationEvidenceDigest).toBe(
      first.evidence.digest,
    );

    const markdown = readFileSync(first.reviewMarkdown.path, 'utf8');
    expect(markdown).toContain('## World connections');
    expect(markdown).toContain(
      '## Reveal timeline and supporting geometry',
    );
    expect(markdown).toContain('## Source coverage');
    expect(markdown).toContain('## Prior-approved Blueprint diff');
    expect(markdown).toContain('Transition:');
    expect(markdown).toContain('Text-safe region:');
    expect(markdown).toContain('Placements:');
    expect(markdown).toContain('synthetic-offline-fixture');

    const contactSheet = readFileSync(first.contactSheet.path, 'utf8');
    expect(contactSheet).toContain('aspect-ratio:2/3');
    expect(contactSheet).toContain('TEXT SAFE');
    expect(contactSheet).toContain('placement action');
    expect(contactSheet).toContain('placement prop');
    expect(contactSheet).toContain('placement supporting_geometry');
    expect(contactSheet).toContain('World connections');
    expect(contactSheet).toContain('Source coverage');
    expect(contactSheet).toContain('Prior-approved diff');
    expect(contactSheet).toContain('synthetic-offline-fixture');
  });

  it('never overwrites a content-address collision', () => {
    const destinationPath = path.join(
      temporaryRoot(),
      'immutable',
      'artifact.json',
    );
    expect(
      writeImmutableLocalArtifact({
        destinationPath,
        bytes: '{"value":"first"}',
      }),
    ).toEqual({ created: true });

    expect(() =>
      writeImmutableLocalArtifact({
        destinationPath,
        bytes: '{"value":"second"}',
      }),
    ).toThrow('immutable artifact collision');
    expect(readFileSync(destinationPath, 'utf8')).toBe(
      '{"value":"first"}',
    );
  });

  it('leaves no destination or temp file when publication fails', () => {
    const root = temporaryRoot();
    const destinationPath = path.join(root, 'artifact.json');

    expect(() =>
      writeImmutableLocalArtifact({
        destinationPath,
        bytes: '{"synthetic":true}',
        hooks: {
          beforePublish: () => {
            throw new Error('synthetic publish failure');
          },
        },
      }),
    ).toThrow('synthetic publish failure');
    expect(existsSync(destinationPath)).toBe(false);
    expect(readdirSync(root)).toEqual([]);
  });

  it('recovers safely from a mid-bundle write failure without replacing completed artifacts', () => {
    const fixture = buildBlueprintFixture('single_location');
    const root = temporaryRoot();
    let publications = 0;

    expect(() =>
      persistPreRenderBlueprintLifecycle({
        root,
        blueprint: fixture.blueprint,
        context: fixture.context,
        provenance: provenanceFor(fixture.blueprint),
        hooks: {
          beforePublish: () => {
            publications += 1;
            if (publications === 3) {
              throw new Error('synthetic third-artifact failure');
            }
          },
        },
      }),
    ).toThrow('synthetic third-artifact failure');
    const afterFailure = readdirSync(root, { recursive: true });
    expect(
      afterFailure.some((entry) => String(entry).includes('.tmp-')),
    ).toBe(false);
    expect(
      afterFailure.some((entry) => String(entry).endsWith('blueprint.json')),
    ).toBe(true);

    const recovered = persistPreRenderBlueprintLifecycle({
      root,
      blueprint: fixture.blueprint,
      context: fixture.context,
      provenance: provenanceFor(fixture.blueprint),
    });
    expect(recovered.candidate.created).toBe(false);
    expect(recovered.provenance.created).toBe(false);
    expect(recovered.validationEvidence.created).toBe(true);
    expect(existsSync(recovered.contactSheet.path)).toBe(true);
  });

  it('validates the full candidate and review readiness before writing', () => {
    const fixture = buildBlueprintFixture('single_location');
    const stale = clone(fixture.blueprint);
    stale.frames[1].narrative.summary = 'changed without a new digest';
    const root = temporaryRoot();

    expect(() =>
      persistPreRenderBlueprintLifecycle({
        root,
        blueprint: stale,
        context: fixture.context,
        provenance: provenanceFor(stale),
      }),
    ).toThrow('refusing to persist invalid Blueprint');
    expect(readdirSync(root)).toEqual([]);
  });

  it('rejects impossible or fallback-enabled authoring provenance before writing', () => {
    const fixture = buildBlueprintFixture('single_location');
    const root = temporaryRoot();
    const provenance = provenanceFor(fixture.blueprint);
    (
      provenance as unknown as {
        noFallback: boolean;
        maxOutputTokens: number;
        passingAttempt: number;
        callCount: number;
      }
    ).noFallback = false;
    provenance.maxOutputTokens = 0;
    provenance.passingAttempt = 2;
    provenance.callCount = 7;

    const review = buildPreRenderBlueprintReviewBundle({
      blueprint: fixture.blueprint,
      context: fixture.context,
      provenance,
    });
    expect(review.packet.readyForApproval).toBe(false);
    expect(review.packet.blockers.join('\n')).toContain(
      'noFallback=true',
    );
    expect(review.packet.blockers.join('\n')).toContain(
      'token budget',
    );
    expect(review.packet.blockers.join('\n')).toContain(
      'attempt/call count',
    );
    expect(() =>
      persistPreRenderBlueprintLifecycle({
        root,
        blueprint: fixture.blueprint,
        context: fixture.context,
        provenance,
      }),
    ).toThrow('invalid authoring provenance');
    expect(readdirSync(root)).toEqual([]);
  });

  it('blocks unresolved historical-direction/source coverage before persistence or approval', () => {
    const fixture = buildBlueprintFixture('no_companion');
    const context = clone(fixture.context);
    context.reconciliation.frames[0].sourceRequirements[0].visualBeats[0]
      .disposition = 'unresolved';
    const root = temporaryRoot();
    const review = buildPreRenderBlueprintReviewBundle({
      blueprint: fixture.blueprint,
      context,
      provenance: provenanceFor(fixture.blueprint),
    });

    expect(review.packet.readyForApproval).toBe(false);
    expect(review.packet.blockers.join('\n')).toContain(
      'unresolved source coverage',
    );
    expect(() =>
      persistPreRenderBlueprintLifecycle({
        root,
        blueprint: fixture.blueprint,
        context,
        provenance: provenanceFor(fixture.blueprint),
      }),
    ).toThrow('refusing to persist invalid Blueprint');
    expect(readdirSync(root)).toEqual([]);
  });

  it('writes only an exact-Guy, exact-digest synthetic approval attestation', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');
    const root = temporaryRoot();
    const persisted = persistPreRenderBlueprintLifecycle({
      root,
      blueprint: fixture.blueprint,
      context: fixture.context,
      provenance: provenanceFor(fixture.blueprint),
    });

    expect(() =>
      writePreRenderBlueprintApprovalAttestation({
        root,
        blueprint: fixture.blueprint,
        context: fixture.context,
        reviewPacket: persisted.review.packet,
        approvedBy: 'guy',
        approvedAt: '2026-07-26T12:00:00.000Z',
      }),
    ).toThrow('exact approver "Guy"');

    const approval = writePreRenderBlueprintApprovalAttestation({
      root,
      blueprint: fixture.blueprint,
      context: fixture.context,
      reviewPacket: persisted.review.packet,
      approvedBy: PRE_RENDER_BLUEPRINT_APPROVER,
      approvedAt: '2026-07-26T12:00:00.000Z',
      note: 'Synthetic lifecycle semantics test only',
    });
    const approvalBytes = readFileSync(approval.artifact.path, 'utf8');

    expect(
      validatePreRenderBlueprintApprovalAttestation({
        blueprint: fixture.blueprint,
        context: fixture.context,
        reviewPacket: persisted.review.packet,
        attestation: approval.attestation,
      }),
    ).toEqual([]);
    expect(approvalBytes).not.toContain('"visualContract"');
    expect(approvalBytes).not.toContain('"worldPlan"');
    expect(approvalBytes).not.toContain('"frames"');
    expect(approvalBytes).not.toContain(
      fixture.blueprint.frames[1].narrative.summary,
    );
    expect(approval.attestation.doesNotAuthorize).toEqual([
      'board_mint',
      'image_render',
      'visual_package_promotion',
      'runtime_cutover',
      'deployment',
      'release',
    ]);
  });

  it('cannot attach an old review or approval to a changed revision', () => {
    const fixture = buildBlueprintFixture('journey_fantastical');
    const root = temporaryRoot();
    const original = persistPreRenderBlueprintLifecycle({
      root,
      blueprint: fixture.blueprint,
      context: fixture.context,
      provenance: provenanceFor(fixture.blueprint),
    });
    const approval = writePreRenderBlueprintApprovalAttestation({
      root,
      blueprint: fixture.blueprint,
      context: fixture.context,
      reviewPacket: original.review.packet,
      approvedBy: PRE_RENDER_BLUEPRINT_APPROVER,
      approvedAt: '2026-07-26T12:00:00.000Z',
    });
    const revised = revisedBlueprint(fixture.blueprint);
    const revisedPersisted = persistPreRenderBlueprintLifecycle({
      root,
      blueprint: revised,
      context: fixture.context,
      provenance: provenanceFor(revised),
      previousApproved: {
        blueprint: fixture.blueprint,
        attestation: approval.attestation,
      },
    });

    expect(revised.digest).not.toBe(fixture.blueprint.digest);
    expect(
      readFileSync(original.candidate.path, 'utf8'),
    ).toBe(serializePreRenderBookVisualBlueprint(fixture.blueprint));
    expect(
      revisedPersisted.review.packet.priorApprovedDiff.changedFrameIds,
    ).toContain('frame:page:1');
    expect(
      validatePreRenderBlueprintApprovalAttestation({
        blueprint: revised,
        context: fixture.context,
        reviewPacket: revisedPersisted.review.packet,
        attestation: approval.attestation,
      }).join('\n'),
    ).toContain('approval does not bind the exact');
    expect(() =>
      writePreRenderBlueprintApprovalAttestation({
        root,
        blueprint: revised,
        context: fixture.context,
        reviewPacket: original.review.packet,
        approvedBy: PRE_RENDER_BLUEPRINT_APPROVER,
        approvedAt: '2026-07-26T13:00:00.000Z',
      }),
    ).toThrow('Blueprint approval rejected');
  });
});
