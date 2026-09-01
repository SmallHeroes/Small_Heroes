import {
  chmodSync,
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
    version: 'pre-render-blueprint-authoring-provenance/v4',
    blueprintDigest: blueprint.digest,
    authoringAuthorityDigest:
      blueprint.identity.authoringAuthority.digest,
    model: 'synthetic-offline-fixture',
    reasoningEffort: 'medium',
    maxOutputTokens: 48_000,
    noFallback: true,
    draftSchemaVersion: 'pre-render-blueprint-draft-schema/v6',
    promptVersion: 'pre-render-blueprint-authoring-prompt/v5',
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

  it('reuses identical immutable bytes even when the existing file is read-only', () => {
    const destinationPath = path.join(
      temporaryRoot(),
      'immutable',
      'read-only.json',
    );
    const bytes = '{"value":"stable"}';
    expect(
      writeImmutableLocalArtifact({ destinationPath, bytes }),
    ).toEqual({ created: true });
    chmodSync(destinationPath, 0o444);
    try {
      expect(
        writeImmutableLocalArtifact({ destinationPath, bytes }),
      ).toEqual({ created: false });
      expect(readFileSync(destinationPath, 'utf8')).toBe(bytes);
    } finally {
      chmodSync(destinationPath, 0o666);
    }
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

  it('rejects cross-generation schema, initial-prompt, and repair-prompt provenance while preserving exact legacy pairs', () => {
    const fixture = buildBlueprintFixture('single_location');
    const repairAttempts = [{ attempt: 1, errors: ['fixture error'], draft: {} }];
    const current = {
      ...provenanceFor(fixture.blueprint),
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v8' as const,
      promptVersion: 'pre-render-blueprint-authoring-prompt/v9' as const,
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v10' as const,
      passingAttempt: 2,
      callCount: 2,
    };
    const cameraAuthorityLegacy = {
      ...current,
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v7' as const,
      promptVersion: 'pre-render-blueprint-authoring-prompt/v8' as const,
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v9' as const,
    };
    const legacyPromptV7RepairV8 = {
      ...current,
      draftSchemaVersion: 'pre-render-blueprint-draft-schema/v6' as const,
      promptVersion: 'pre-render-blueprint-authoring-prompt/v7' as const,
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v8' as const,
    };
    const legacyPromptV7RepairV7 = {
      ...legacyPromptV7RepairV8,
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v7' as const,
    };
    const legacyPromptV6 = {
      ...legacyPromptV7RepairV8,
      promptVersion: 'pre-render-blueprint-authoring-prompt/v6' as const,
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v6' as const,
    };
    const legacyPromptV5 = {
      ...legacyPromptV7RepairV8,
      promptVersion: 'pre-render-blueprint-authoring-prompt/v5' as const,
      repairPromptVersion: 'pre-render-blueprint-repair-prompt/v5' as const,
    };

    for (const [label, provenance] of [
      ['current', current],
      ['camera_authority', cameraAuthorityLegacy],
      ['prompt_v7_repair_v8', legacyPromptV7RepairV8],
      ['prompt_v7_repair_v7', legacyPromptV7RepairV7],
      ['prompt_v6', legacyPromptV6],
      ['prompt_v5', legacyPromptV5],
    ] as const) {
      const review = buildPreRenderBlueprintReviewBundle({
        blueprint: fixture.blueprint,
        context: fixture.context,
        provenance,
        repairAttempts,
      });
      expect(review.packet.blockers, label).not.toContain(
        'authoring provenance schema or prompt version is unsupported',
      );
      expect(review.packet.blockers, label).not.toContain(
        'authoring provenance repair prompt version is inconsistent',
      );
    }

    const incompatibleSchemaPromptRows = [
      [
        'current_schema_with_camera_prompt',
        { ...current, promptVersion: cameraAuthorityLegacy.promptVersion },
      ],
      [
        'camera_schema_with_current_prompt',
        { ...cameraAuthorityLegacy, promptVersion: current.promptVersion },
      ],
      [
        'camera_schema_with_prompt_v7',
        {
          ...cameraAuthorityLegacy,
          promptVersion: legacyPromptV7RepairV8.promptVersion,
        },
      ],
      [
        'legacy_schema_with_camera_prompt',
        {
          ...legacyPromptV7RepairV8,
          promptVersion: cameraAuthorityLegacy.promptVersion,
        },
      ],
    ] as const satisfies ReadonlyArray<
      readonly [string, PreRenderBlueprintAuthoringProvenance]
    >;
    for (const [label, provenance] of incompatibleSchemaPromptRows) {
      const review = buildPreRenderBlueprintReviewBundle({
        blueprint: fixture.blueprint,
        context: fixture.context,
        provenance,
        repairAttempts,
      });
      expect(review.packet.readyForApproval, label).toBe(false);
      expect(review.packet.blockers, label).toContain(
        'authoring provenance schema or prompt version is unsupported',
      );
    }

    const incompatibleRepairRows = [
      [
        'current_with_camera_repair',
        {
          ...current,
          repairPromptVersion: cameraAuthorityLegacy.repairPromptVersion,
        },
      ],
      [
        'camera_with_current_repair',
        {
          ...cameraAuthorityLegacy,
          repairPromptVersion: current.repairPromptVersion,
        },
      ],
      [
        'camera_with_prompt_v7_repair',
        {
          ...cameraAuthorityLegacy,
          repairPromptVersion: legacyPromptV7RepairV8.repairPromptVersion,
        },
      ],
      [
        'prompt_v7_with_camera_repair',
        {
          ...legacyPromptV7RepairV8,
          repairPromptVersion: cameraAuthorityLegacy.repairPromptVersion,
        },
      ],
      [
        'prompt_v7_with_prompt_v6_repair',
        {
          ...legacyPromptV7RepairV8,
          repairPromptVersion: legacyPromptV6.repairPromptVersion,
        },
      ],
      [
        'prompt_v6_with_prompt_v7_repair',
        {
          ...legacyPromptV6,
          repairPromptVersion: legacyPromptV7RepairV7.repairPromptVersion,
        },
      ],
      [
        'prompt_v6_with_prompt_v5_repair',
        {
          ...legacyPromptV6,
          repairPromptVersion: legacyPromptV5.repairPromptVersion,
        },
      ],
      [
        'prompt_v5_with_prompt_v6_repair',
        {
          ...legacyPromptV5,
          repairPromptVersion: legacyPromptV6.repairPromptVersion,
        },
      ],
    ] as const satisfies ReadonlyArray<
      readonly [string, PreRenderBlueprintAuthoringProvenance]
    >;
    for (const [label, provenance] of incompatibleRepairRows) {
      const review = buildPreRenderBlueprintReviewBundle({
        blueprint: fixture.blueprint,
        context: fixture.context,
        provenance,
        repairAttempts,
      });
      expect(review.packet.readyForApproval, label).toBe(false);
      expect(review.packet.blockers, label).toContain(
        'authoring provenance repair prompt version is inconsistent',
      );
    }
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
