import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import {
  approveTimeAuthoritySetBoardRebind,
  assembleVisualPackageV4Candidate,
  canonicalJsonDigest,
  loadApprovedTimeAuthorityMigration,
  prepareTimeAuthoritySetBoardRebind,
  qualifyVisualPackageV4Candidate,
  timeAuthoritySetBoardRebindApprovalIsValid,
  timeAuthoritySetBoardRebindCandidateIsValid,
  timeAuthoritySetBoardRebindReviewIsValid,
  type TimeAuthoritySetBoardRebindApproval,
  type TimeAuthoritySetBoardRebindCandidate,
  type TimeAuthoritySetBoardRebindReview,
} from '@/lib/visual-package';

const REPO_ROOT = process.cwd();
const OUTPUTS_ROOT = path.join(REPO_ROOT, 'outputs');
const STORY_KEY = 'chameleon_koko_bedtime';
const STYLE_ID = 'soft_hand_drawn_storybook';
const TOWN_SET_ID = 'set_town_night';
const HOME_SET_ID = 'set_child_home_night';
const SOURCE_TOWN_HASH =
  '5b1917ceec616cd9c8613f8075f2a7b3426c96e9549eaeef40f2381eb550b9dc';
const TARGET_TOWN_HASH =
  'fd15ad19983952607f118282aa05d9e8f6931697453994ee4d8516ece78f7651';
const TOWN_ASSET_SHA =
  '41580dfa9ea11a8dd5c6027ffd5cc5a46f5afe0bfc6eae62c047d00cd05a751e';
const HOME_HASH =
  '803dea01a0346579b0e38160cd683acfa09966daecf90d945389da4a3a67d172';
const MIGRATION_ROOT =
  'outputs/r1d-chameleon-time-authority-migration-pending-20260821T125112868Z';
const APPROVED_MANIFEST_PATH =
  `${MIGRATION_ROOT}/time-authority-migration-manifests/a57c3cffd9cd7e2ee43c3a62380f890025c050830ecc8fde378fe21e7936184a.json`;
const BLUEPRINT_AUTHORITY_ROOT =
  `${MIGRATION_ROOT}/blueprint-lifecycle/authorities/dd2cdeb52124402f18c62ed0a216e0d7b35903ca446d3701245b173428baa62b`;
const APPROVED_BLUEPRINT_PATHS = {
  blueprintPath:
    `${BLUEPRINT_AUTHORITY_ROOT}/candidates/c6f753eabdb278842c3d8e686bd844752c849a930d15970f06ddf3f918e91208/blueprint.json`,
  authoringProvenancePath:
    `${BLUEPRINT_AUTHORITY_ROOT}/provenance/1d194d6edd7237901527599089081ae741536e87e1313ae84b8cacc503caa22e.json`,
  validationEvidencePath:
    `${BLUEPRINT_AUTHORITY_ROOT}/validation/1291ed585d0caaff57c58e23e4247dbee34c71f8c1b95ee0711521dff778be1f.json`,
  reviewPacketPath:
    `${BLUEPRINT_AUTHORITY_ROOT}/reviews/137be727f154a03ee97f43afb2c2a46ed41b59f81bb18c196c7c11c30605da57/review.json`,
  planningApprovalPath:
    `${BLUEPRINT_AUTHORITY_ROOT}/approvals/c6f753eabdb278842c3d8e686bd844752c849a930d15970f06ddf3f918e91208/aeff01b6f77599b59fc4ed5e462b78192129bc61ec753dd6c8622d59e9e2c7ed.json`,
} as const;
const SOURCE_HOME_REGISTRY_PATH =
  `set-identity-boards/${STORY_KEY}/${STYLE_ID}/${HOME_SET_ID}/${HOME_HASH}.json`;
const SOURCE_TOWN_REGISTRY_PATH =
  `set-identity-boards/${STORY_KEY}/${STYLE_ID}/${TOWN_SET_ID}/${SOURCE_TOWN_HASH}.json`;

const REAL_ARTIFACTS_AVAILABLE = [
  APPROVED_MANIFEST_PATH,
  ...Object.values(APPROVED_BLUEPRINT_PATHS),
  SOURCE_HOME_REGISTRY_PATH,
  SOURCE_TOWN_REGISTRY_PATH,
].every((artifactPath) => fs.existsSync(path.join(REPO_ROOT, artifactPath)));

const roots: string[] = [];

function repoRelative(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

function tempAuthority(): {
  root: string;
  outputDir: string;
  boardRegistryDir: string;
} {
  fs.mkdirSync(OUTPUTS_ROOT, { recursive: true });
  const root = fs.mkdtempSync(
    path.join(OUTPUTS_ROOT, '.time-authority-set-board-rebind-test-'),
  );
  roots.push(root);
  return {
    root,
    outputDir: repoRelative(root),
    boardRegistryDir: `${repoRelative(root)}/boards`,
  };
}

function redigestCandidate(
  value: TimeAuthoritySetBoardRebindCandidate,
): TimeAuthoritySetBoardRebindCandidate {
  const clone = structuredClone(value);
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = clone;
  clone.digest = canonicalJsonDigest(payload);
  return clone;
}

function redigestReview(
  value: TimeAuthoritySetBoardRebindReview,
): TimeAuthoritySetBoardRebindReview {
  const clone = structuredClone(value);
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = clone;
  clone.digest = canonicalJsonDigest(payload);
  return clone;
}

function redigestApproval(
  value: TimeAuthoritySetBoardRebindApproval,
): TimeAuthoritySetBoardRebindApproval {
  const clone = structuredClone(value);
  const {
    digestAlgorithm: _digestAlgorithm,
    digest: _digest,
    ...payload
  } = clone;
  clone.digest = canonicalJsonDigest(payload);
  return clone;
}

function copyHomeBoard(boardRegistryDir: string): void {
  const destination = path.join(
    REPO_ROOT,
    boardRegistryDir,
    STORY_KEY,
    STYLE_ID,
    HOME_SET_ID,
    `${HOME_HASH}.json`,
  );
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, SOURCE_HOME_REGISTRY_PATH),
    destination,
  );
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    expect(path.dirname(root)).toBe(OUTPUTS_ROOT);
    expect(path.basename(root)).toMatch(
      /^\.time-authority-set-board-rebind-test-/,
    );
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe.skipIf(!REAL_ARTIFACTS_AVAILABLE)(
  'time-authority Set Board identity rebind lifecycle',
  () => {
    it('builds a closed time-only rebind and rejects redigested semantic drift', () => {
      const fixture = tempAuthority();
      const prepared = prepareTimeAuthoritySetBoardRebind({
        repoRoot: REPO_ROOT,
        approvedManifestPath: APPROVED_MANIFEST_PATH,
        outputRoot: fixture.outputDir,
        setIdentityId: TOWN_SET_ID,
        targetBoardRegistryDir: fixture.boardRegistryDir,
        write: false,
      });

      expect(timeAuthoritySetBoardRebindCandidateIsValid(prepared.candidate))
        .toBe(true);
      expect(
        timeAuthoritySetBoardRebindReviewIsValid(
          prepared.review,
          prepared.candidate,
        ),
      ).toBe(true);
      expect(prepared.candidate.sourceSetDefinitionHash).toBe(
        SOURCE_TOWN_HASH,
      );
      expect(prepared.candidate.targetSetDefinitionHash).toBe(
        TARGET_TOWN_HASH,
      );
      expect(prepared.review.preservedAssetSha256).toBe(TOWN_ASSET_SHA);
      expect(prepared.candidate.proposedRegistryEntry).toMatchObject({
        setDefinitionHash: TARGET_TOWN_HASH,
        assetSha256: TOWN_ASSET_SHA,
        qaStatus: 'passed',
        approvedBy: null,
        approvedAt: null,
      });
      expect(fs.existsSync(path.join(REPO_ROOT, prepared.targetRegistryPath)))
        .toBe(false);

      const extraKey = {
        ...structuredClone(prepared.candidate),
        unauthorized: true,
      };
      expect(timeAuthoritySetBoardRebindCandidateIsValid(extraKey)).toBe(false);

      const assetDrift = structuredClone(prepared.candidate);
      assetDrift.proposedRegistryEntry.assetSha256 = 'f'.repeat(64);
      expect(
        timeAuthoritySetBoardRebindCandidateIsValid(
          redigestCandidate(assetDrift),
        ),
      ).toBe(false);

      const hashDrift = structuredClone(prepared.review);
      hashDrift.targetSetDefinitionHash = 'e'.repeat(64);
      expect(
        timeAuthoritySetBoardRebindReviewIsValid(
          redigestReview(hashDrift),
          prepared.candidate,
        ),
      ).toBe(false);
    });

    it('exposes a write-free CLI preview with every external boundary at zero', () => {
      const fixture = tempAuthority();
      const requestPath = path.join(fixture.root, 'prepare-request.json');
      fs.writeFileSync(requestPath, `${JSON.stringify({
        repoRoot: REPO_ROOT,
        approvedManifestPath: APPROVED_MANIFEST_PATH,
        setIdentityId: TOWN_SET_ID,
        targetBoardRegistryDir: fixture.boardRegistryDir,
      }, null, 2)}\n`, 'utf8');
      const childEnv = { ...process.env };
      delete childEnv.OPENAI_API_KEY;
      const child = spawnSync(process.execPath, [
        '--require',
        './node_modules/tsx/dist/cjs/index.cjs',
        '--require',
        './scripts/shims/register-server-only.cjs',
        'scripts/time-authority-set-board-rebind.ts',
        'prepare',
        '--request',
        requestPath,
        '--out',
        fixture.outputDir,
        '--write',
        'false',
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: childEnv,
      });

      expect(child.status, child.stderr).toBe(0);
      const output = JSON.parse(child.stdout) as Record<string, unknown>;
      expect(output).toMatchObject({
        status: 'time_authority_set_board_rebind_preview_ready',
        localImmutableWriteRequested: false,
        sourceSetDefinitionHash: SOURCE_TOWN_HASH,
        targetSetDefinitionHash: TARGET_TOWN_HASH,
        preservedAssetSha256: TOWN_ASSET_SHA,
        boundaryEvidence: {
          credentialAccess: 'none',
          providerCalls: 0,
          imageCalls: 0,
          visionCalls: 0,
          networkCalls: 0,
          databaseWrites: 0,
          productionWrites: 0,
        },
      });
      expect(fs.readdirSync(fixture.root)).toEqual(['prepare-request.json']);
    });

    it('writes no target authority until exact Guy approval, then replays idempotently', () => {
      const fixture = tempAuthority();
      const prepared = prepareTimeAuthoritySetBoardRebind({
        repoRoot: REPO_ROOT,
        approvedManifestPath: APPROVED_MANIFEST_PATH,
        outputRoot: fixture.outputDir,
        setIdentityId: TOWN_SET_ID,
        targetBoardRegistryDir: fixture.boardRegistryDir,
        write: true,
      });
      const targetAbsolute = path.join(
        REPO_ROOT,
        prepared.targetRegistryPath,
      );

      expect(() => approveTimeAuthoritySetBoardRebind({
        repoRoot: REPO_ROOT,
        approvedManifestPath: APPROVED_MANIFEST_PATH,
        outputRoot: fixture.outputDir,
        setIdentityId: TOWN_SET_ID,
        targetBoardRegistryDir: fixture.boardRegistryDir,
        candidatePath: prepared.candidateArtifact.path,
        reviewPath: prepared.reviewArtifact.path,
        approvedBy: 'Codex' as unknown as 'Guy',
        approvedAt: '2026-08-21T15:00:00.000Z',
        write: true,
      })).toThrow('approvedBy must be exact value Guy');
      expect(() => approveTimeAuthoritySetBoardRebind({
        repoRoot: REPO_ROOT,
        approvedManifestPath: APPROVED_MANIFEST_PATH,
        outputRoot: fixture.outputDir,
        setIdentityId: TOWN_SET_ID,
        targetBoardRegistryDir: fixture.boardRegistryDir,
        candidatePath: prepared.candidateArtifact.path,
        reviewPath: prepared.reviewArtifact.path,
        approvedBy: 'Guy',
        approvedAt: '2026-02-30T15:00:00.000Z',
        write: true,
      })).toThrow('approvedAt must be a canonical UTC ISO timestamp');
      expect(fs.existsSync(targetAbsolute)).toBe(false);

      const approved = approveTimeAuthoritySetBoardRebind({
        repoRoot: REPO_ROOT,
        approvedManifestPath: APPROVED_MANIFEST_PATH,
        outputRoot: fixture.outputDir,
        setIdentityId: TOWN_SET_ID,
        targetBoardRegistryDir: fixture.boardRegistryDir,
        candidatePath: prepared.candidateArtifact.path,
        reviewPath: prepared.reviewArtifact.path,
        approvedBy: 'Guy',
        approvedAt: '2026-08-21T15:00:00.000Z',
        note: 'test-only exact time-authority Board identity rebind',
        write: true,
      });
      expect(approved.registryArtifact.created).toBe(true);
      expect(approved.approvalArtifact.created).toBe(true);
      expect(timeAuthoritySetBoardRebindApprovalIsValid({
        value: approved.approval,
        candidate: approved.candidate,
        review: approved.review,
        targetRegistryEntry: approved.targetRegistryEntry,
      })).toBe(true);
      const driftedTarget = structuredClone(approved.targetRegistryEntry);
      driftedTarget.assetSha256 = 'd'.repeat(64);
      const reboundApproval = structuredClone(approved.approval);
      reboundApproval.targetRegistryEntryDigest = canonicalJsonDigest(
        driftedTarget,
      );
      expect(timeAuthoritySetBoardRebindApprovalIsValid({
        value: redigestApproval(reboundApproval),
        candidate: approved.candidate,
        review: approved.review,
        targetRegistryEntry: driftedTarget,
      })).toBe(false);
      expect(JSON.parse(fs.readFileSync(targetAbsolute, 'utf8'))).toEqual(
        approved.targetRegistryEntry,
      );

      const replay = approveTimeAuthoritySetBoardRebind({
        repoRoot: REPO_ROOT,
        approvedManifestPath: APPROVED_MANIFEST_PATH,
        outputRoot: fixture.outputDir,
        setIdentityId: TOWN_SET_ID,
        targetBoardRegistryDir: fixture.boardRegistryDir,
        candidatePath: prepared.candidateArtifact.path,
        reviewPath: prepared.reviewArtifact.path,
        approvedBy: 'Guy',
        approvedAt: '2026-08-21T15:00:00.000Z',
        note: 'test-only exact time-authority Board identity rebind',
        write: true,
      });
      expect(replay.approval.digest).toBe(approved.approval.digest);
      expect(replay.approvalArtifact.created).toBe(false);
      expect(replay.registryArtifact.created).toBe(false);
    });

    it('assembles the migrated package offline with the preserved Board image', () => {
      const fixture = tempAuthority();
      const sourceTownBytes = fs.readFileSync(
        path.join(REPO_ROOT, SOURCE_TOWN_REGISTRY_PATH),
      );
      copyHomeBoard(fixture.boardRegistryDir);
      const prepared = prepareTimeAuthoritySetBoardRebind({
        repoRoot: REPO_ROOT,
        approvedManifestPath: APPROVED_MANIFEST_PATH,
        outputRoot: fixture.outputDir,
        setIdentityId: TOWN_SET_ID,
        targetBoardRegistryDir: fixture.boardRegistryDir,
        write: true,
      });
      const approved = approveTimeAuthoritySetBoardRebind({
        repoRoot: REPO_ROOT,
        approvedManifestPath: APPROVED_MANIFEST_PATH,
        outputRoot: fixture.outputDir,
        setIdentityId: TOWN_SET_ID,
        targetBoardRegistryDir: fixture.boardRegistryDir,
        candidatePath: prepared.candidateArtifact.path,
        reviewPath: prepared.reviewArtifact.path,
        approvedBy: 'Guy',
        approvedAt: '2026-08-21T15:00:00.000Z',
        write: true,
      });
      const migration = loadApprovedTimeAuthorityMigration({
        repoRoot: REPO_ROOT,
        approvedManifestPath: APPROVED_MANIFEST_PATH,
      });
      const assembled = assembleVisualPackageV4Candidate({
        repoRoot: REPO_ROOT,
        context: migration.context,
        approvedBlueprintPaths: APPROVED_BLUEPRINT_PATHS,
        review: migration.sourcePackage.candidate.content.review,
        boardRegistryDir: fixture.boardRegistryDir,
      });
      const qualification = qualifyVisualPackageV4Candidate({
        repoRoot: REPO_ROOT,
        candidate: assembled.candidate,
        packageReview: assembled.packageReview,
        boardRegistryDir: fixture.boardRegistryDir,
      });

      expect(qualification).toMatchObject({
        zeroWrite: true,
        candidateValid: true,
        reviewReady: true,
        approvalValid: false,
        readyForPublication: false,
      });
      expect(qualification.reasons.map((reason) => reason.code)).toEqual([
        'package_approval_missing',
      ]);
      expect(
        assembled.candidate.content.requiredBoards.map((board) => ({
          setIdentityId: board.setIdentityId,
          setDefinitionHash: board.setDefinitionHash,
          assetSha256: board.assetSha256,
        })),
      ).toEqual([
        {
          setIdentityId: HOME_SET_ID,
          setDefinitionHash: HOME_HASH,
          assetSha256:
            '7a782c72b86ceb07ba631def11d40b520b4753d97a63e8430a2fcb32180d7189',
        },
        {
          setIdentityId: TOWN_SET_ID,
          setDefinitionHash: TARGET_TOWN_HASH,
          assetSha256: TOWN_ASSET_SHA,
        },
      ]);
      expect(approved.targetRegistryEntry.storageKey).toBe(
        prepared.candidate.sourceRegistryEntry.storageKey,
      );
      expect(approved.targetRegistryEntry.promptHash).toBe(
        prepared.candidate.sourceRegistryEntry.promptHash,
      );
      expect(approved.targetRegistryEntry.assetSha256).toBe(TOWN_ASSET_SHA);
      expect(
        fs.readFileSync(path.join(REPO_ROOT, SOURCE_TOWN_REGISTRY_PATH)),
      ).toEqual(sourceTownBytes);
    });
  },
);
