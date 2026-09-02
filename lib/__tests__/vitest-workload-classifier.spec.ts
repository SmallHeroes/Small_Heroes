import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  assertVitestPartition,
  classifyVitestWorkloads,
  discoverCanonicalVitestSpecs,
  loadVitestWorkloadPolicy,
  matchesVitestInclude,
  VitestWorkloadClassificationError,
} from '../../test-infrastructure/vitest-workload-classifier.mjs';

function expectClassificationCode(
  action: () => unknown,
  code: string,
) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(VitestWorkloadClassificationError);
    expect((error as { code?: string }).code).toBe(code);
    return;
  }
  throw new Error(`expected workload classification failure ${code}`);
}

describe('Vitest workload classifier', () => {
  it('matches the canonical include surface without duplicate execution', () => {
    expect(
      matchesVitestInclude(
        'lib/example.spec.ts',
        'lib/**/*.spec.ts',
      ),
    ).toBe(true);
    expect(
      matchesVitestInclude(
        'lib/example/__tests__/nested.spec.ts',
        'lib/**/__tests__/**/*.spec.ts',
      ),
    ).toBe(true);
    expect(
      matchesVitestInclude(
        'scripts/example.spec.ts',
        'lib/**/*.spec.ts',
      ),
    ).toBe(false);
  });

  it('creates one total disjoint partition and defaults new specs to ordinary', () => {
    const policy = loadVitestWorkloadPolicy(process.cwd());
    const inventory = discoverCanonicalVitestSpecs(
      process.cwd(),
      policy.canonicalIncludes,
    );
    const partition = classifyVitestWorkloads(inventory, policy);

    expect(partition.inventory).toHaveLength(376);
    expect(partition.resourceIntensive).toHaveLength(20);
    expect(partition.ordinary).toHaveLength(356);
    expect(new Set(partition.inventory).size).toBe(
      partition.inventory.length,
    );
    expect(
      partition.ordinary.filter((candidate: string) =>
        partition.resourceIntensive.includes(candidate),
      ),
    ).toEqual([]);
    expect(partition.ordinary).toContain(
      'lib/__tests__/vitest-diagnostics.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/vitest-workload-classifier.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/narration-pronunciation-audition.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/narration-pronunciation-audition-runner.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/release-v1-worker-reachability.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/resemblance-threshold-alias.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/initial-full-draft-disposition-binding.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/draft-action-cast-reference-projection.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/vitest-check-supervisor.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/chameleon-action-representability.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/set-identity-board/__tests__/reserved-page-placement-authority.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/visual-contract-page-wardrobe-override.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/pre-render-blueprint-composition-policy.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/openai-responses-blueprint-authoring-adapter.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/blueprint-authoring-runner-count-authority.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/qa-wizard-blueprint-authoring-lifecycle.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/blueprint-authoring-execution-program.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/pre-render-blueprint-affordance-consumer-choices.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/qa-wizard-package-lifecycle.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/offline-repair-harness.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/represented-elsewhere-repair.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/accepted-story-source-authoring-authority.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/visual-contract-authoring-replay-evidence.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/visual-contract-candidate-cover-correction.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/style01-child-expression-style-fidelity.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/story-pipeline-next-generation-foundations.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/story-pipeline-next-generation-creative-briefs.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/story-commission-materializer.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/story-source-revision-lifecycle.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/action-binding-component-normalization.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/time-authority-migration-lifecycle.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/time-authority-set-board-rebind-lifecycle.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/set-identity-board/__tests__/board-safe-identity.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/set-identity-board/__tests__/set-board-admission-census.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/accepted-landing-wizard-presentation.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/story-source-visual-direction-enrichment-lifecycle.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/story-source-visual-direction-acceptance-lifecycle.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/order-visual-package-authority-route.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/generation-pipeline/__tests__/order-visual-package-authority.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-contract-compiler/__tests__/lantern-transition-frontier.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/generation-pipeline/__tests__/pipeline-cache-store.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/generation-pipeline/__tests__/pipeline-cache-store.pg.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/replicate-image-route-boundary.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/package-delivery-origin-matrix.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/qa-wizard-blueprint-replacement-lifecycle.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/visual-package/__tests__/qa-wizard-blueprint-replacement-cli.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/release-v1-continuity.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/release-v1-entrypoint-fences.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/release-v1-start-idempotency.spec.ts',
    );
    expect(partition.ordinary).toContain(
      'lib/__tests__/release-v1-worker-boundary.spec.ts',
    );
  });

  it('wires the policy into config and changes only the npm check launcher', () => {
    const configSource = readFileSync('vitest.config.ts', 'utf8');
    const packageManifest = JSON.parse(
      readFileSync('package.json', 'utf8'),
    );

    expect(configSource).toContain(
      "from './test-infrastructure/vitest-workload-policy.json'",
    );
    expect(configSource).toContain(
      'include: vitestWorkloadPolicy.canonicalIncludes',
    );
    expect(packageManifest.scripts.check).toBe(
      'tsc --noEmit && npm run story:autonomous-typecheck && node scripts/run-vitest-check.mjs --diagnostics',
    );
    expect(packageManifest.scripts.test).toBe('vitest run');
    expect(packageManifest.scripts['test:watch']).toBe('vitest');
  });

  it('fails when a manifest target is absent from canonical inventory', () => {
    const policy = structuredClone(
      loadVitestWorkloadPolicy(process.cwd()),
    );
    policy.resourceIntensiveSpecs.push({
      path: 'lib/zzzz-missing-resource.spec.ts',
      evidence: ['direct_child_process_load'],
    });
    const inventory = discoverCanonicalVitestSpecs(
      process.cwd(),
      policy.canonicalIncludes,
    );

    expectClassificationCode(
      () => classifyVitestWorkloads(inventory, policy),
      'missing_manifest_target',
    );
  });

  it('fails on duplicate canonical paths and case aliases', () => {
    expectClassificationCode(
      () =>
        assertVitestPartition({
          inventory: ['lib/a.spec.ts', 'lib/a.spec.ts'],
          ordinary: ['lib/a.spec.ts'],
          resourceIntensive: [],
        }),
      'duplicate_canonical_path',
    );
    expectClassificationCode(
      () =>
        assertVitestPartition({
          inventory: ['lib/a.spec.ts', 'lib/A.spec.ts'],
          ordinary: ['lib/a.spec.ts', 'lib/A.spec.ts'],
          resourceIntensive: [],
        }),
      'alias_ambiguity',
    );
  });

  it('fails on overlap and inventory omission before launch', () => {
    expectClassificationCode(
      () =>
        assertVitestPartition({
          inventory: ['lib/a.spec.ts'],
          ordinary: ['lib/a.spec.ts'],
          resourceIntensive: ['lib/a.spec.ts'],
        }),
      'overlapping_phase_target',
    );
    expectClassificationCode(
      () =>
        assertVitestPartition({
          inventory: ['lib/a.spec.ts', 'lib/b.spec.ts'],
          ordinary: ['lib/a.spec.ts'],
          resourceIntensive: [],
        }),
      'inventory_omission',
    );
  });

  it('fails on noncanonical paths, duplicate manifest entries, and unsupported evidence', () => {
    const basePolicy = loadVitestWorkloadPolicy(process.cwd());

    const pathPolicy = structuredClone(basePolicy);
    pathPolicy.resourceIntensiveSpecs[0].path =
      'lib\\__tests__\\bad.spec.ts';
    expectClassificationCode(
      () => classifyVitestWorkloads([], pathPolicy),
      'manifest_path_invalid',
    );

    const duplicatePolicy = structuredClone(basePolicy);
    duplicatePolicy.resourceIntensiveSpecs.splice(
      1,
      0,
      structuredClone(duplicatePolicy.resourceIntensiveSpecs[0]),
    );
    expectClassificationCode(
      () => classifyVitestWorkloads([], duplicatePolicy),
      'duplicate_manifest_target',
    );

    const evidencePolicy = structuredClone(basePolicy);
    evidencePolicy.resourceIntensiveSpecs[0].evidence = [
      'unsupported_guess',
    ];
    expectClassificationCode(
      () => classifyVitestWorkloads([], evidencePolicy),
      'manifest_evidence_invalid',
    );
  });
});
