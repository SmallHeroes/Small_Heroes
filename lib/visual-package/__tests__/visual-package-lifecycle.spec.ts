import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canonicalHash } from '@/lib/canonical-json';
import { STYLE_IDS } from '@/lib/styles';
import {
  computeVisualContractHash,
  materialize,
  migrateLegacyBookVisualContractTemplateV1,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';
import {
  SET_IDENTITY_BOARD_VERSION,
  SET_IDENTITY_REGISTRY_VERSION,
  computeSetBoardContentPolicyDigest,
  computeSetDefinitionHash,
  listRequiredSetIdentityIds,
  projectSetDefinition,
  setIdentityBoardRegistryPath,
} from '@/lib/set-identity-board';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import {
  applyAuthoredCoverAuthority,
  authoredCoverAuthorityFromLocationBible,
} from '@/lib/visual-contract-compiler/coverSourceAuthority';
import {
  requireStyle01RenderQualification,
  RenderQualificationPreflightError,
  runWithStyle01RenderQualification,
} from '@/lib/generation-pipeline/render-qualification-preflight';
import type { PipelineCache } from '@/lib/generation-pipeline/types';
import { auditMvpRenderQualification } from '@/lib/visual-package/audit';
import { renderCandidateEvidenceHeader, type CandidateEvidenceBinding } from '@/lib/visual-package/candidateEvidence';
import { buildStorySourceIdentity } from '@/lib/visual-package/integrity';
import {
  prepareVisualPackageCandidate,
  promoteVisualPackage,
  writePreparedCandidateManifest,
} from '@/lib/visual-package/promotion';
import { evaluateRenderQualification } from '@/lib/visual-package/qualification';
import { bindApprovedRuntimeAuthority } from '@/lib/visual-package/runtimeAuthority';
import {
  buildSourcePromptReconciliationDraft,
  type SourcePromptReconciliation,
} from '@/lib/visual-package/sourcePromptReconciliation';
import { evaluateRenderQualificationReleaseGate } from '@/lib/visual-package/releaseGate';
import {
  CANDIDATE_EVIDENCE_VERSION,
  SOURCE_PROMPT_RECONCILIATION_SUFFIX,
  VisualPackageValidationError,
  type VisualPackageIssueCode,
  type VisualPackageManifest,
} from '@/lib/visual-package/types';

const REPO = process.cwd();
const STORY_KEY = 'fox_uri_adventure';
const STORY_REL = `story-bank/v3-approved/${STORY_KEY}.md`;
const TEMPLATE_NAME = `${STORY_KEY}.visual-contract-template.json`;
const REVIEW_NAME = `${STORY_KEY}.visual-contract-review.md`;
const PROVENANCE_NAME = `${STORY_KEY}.visual-contract-provenance.json`;
const RECONCILIATION_NAME = `${STORY_KEY}${SOURCE_PROMPT_RECONCILIATION_SUFFIX}`;

interface Fixture {
  root: string;
  candidateDir: string;
  manifestPath: string;
  storyPath: string;
  templatePath: string;
  reviewPath: string;
  provenancePath: string;
  reconciliationPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function makeFixture(): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smallheroes-r1b-'));
  const storyPath = path.join(root, STORY_REL);
  const candidateDir = path.join(root, 'candidates');
  const templatePath = path.join(candidateDir, TEMPLATE_NAME);
  const reviewPath = path.join(candidateDir, REVIEW_NAME);
  const provenancePath = path.join(candidateDir, PROVENANCE_NAME);
  const reconciliationPath = path.join(candidateDir, RECONCILIATION_NAME);
  fs.mkdirSync(path.dirname(storyPath), { recursive: true });
  fs.mkdirSync(candidateDir, { recursive: true });
  fs.copyFileSync(path.join(REPO, STORY_REL), storyPath);
  const locationBibleName = `${STORY_KEY}.location-bible.json`;
  const locationBiblePath = path.join(path.dirname(storyPath), locationBibleName);
  fs.copyFileSync(
    path.join(REPO, 'story-bank', 'v3-approved', locationBibleName),
    locationBiblePath,
  );
  fs.copyFileSync(
    path.join(REPO, 'story-bank', 'v3-approved', TEMPLATE_NAME),
    templatePath,
  );
  const propCatalogName = `${STORY_KEY}.prop-references.json`;
  fs.copyFileSync(
    path.join(REPO, 'story-bank', 'v3-approved', propCatalogName),
    path.join(path.dirname(storyPath), propCatalogName),
  );
  const propAssetRel = path.join(
    'story-bank',
    'v3-approved',
    `${STORY_KEY}.zone-sheets`,
    'balcony_drip_area',
    'bucket-object.png',
  );
  const propAssetDestination = path.join(root, propAssetRel);
  fs.mkdirSync(path.dirname(propAssetDestination), { recursive: true });
  fs.copyFileSync(path.join(REPO, propAssetRel), propAssetDestination);
  // R1C render qualification is stricter than the historical checked-in Fox candidate. Upgrade only this temporary
  // mock package; the real 0/18 package inventory remains untouched and unpromoted.
  const runtimeTemplate = migrateLegacyBookVisualContractTemplateV1(
    readJson<unknown>(templatePath),
  );
  const authority = authoredCoverAuthorityFromLocationBible(
    readJson<unknown>(locationBiblePath),
    runtimeTemplate.cast.companion
      ? {
          id: runtimeTemplate.cast.companion.id.replace(/^companion:/, ''),
          name: runtimeTemplate.cast.companion.name,
        }
      : null,
  );
  if (!authority) throw new Error('Fox lifecycle fixture must author page 0');
  runtimeTemplate.coverContract = {
    ...runtimeTemplate.coverContract,
    ...applyAuthoredCoverAuthority({
      cover: runtimeTemplate.coverContract as unknown as Record<string, unknown>,
      zones: runtimeTemplate.zones,
      authority,
    }).cover,
  } as BookVisualContractTemplate['coverContract'];
  writeJson(templatePath, runtimeTemplate);
  const setContract = runtimeTemplate as unknown as BookVisualContract;
  for (const setIdentityId of listRequiredSetIdentityIds(setContract)) {
    const definition = projectSetDefinition(
      setContract,
      setIdentityId,
      STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    );
    const setDefinitionHash = computeSetDefinitionHash(
      setContract,
      setIdentityId,
      STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    );
    const registryPath = setIdentityBoardRegistryPath({
      registryVersion: SET_IDENTITY_REGISTRY_VERSION,
      boardVersion: SET_IDENTITY_BOARD_VERSION,
      storyKey: STORY_KEY,
      setIdentityId,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      setDefinitionHash,
      contentPolicyDigest: computeSetBoardContentPolicyDigest(definition),
      declaredPropIds: definition.contentPolicy.includedPropIds,
    }, path.join(root, 'set-identity-boards'));
    writeJson(registryPath, {
      registryVersion: SET_IDENTITY_REGISTRY_VERSION,
      boardVersion: SET_IDENTITY_BOARD_VERSION,
      storyKey: STORY_KEY,
      setIdentityId,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      setDefinitionHash,
      contentPolicyDigest: computeSetBoardContentPolicyDigest(definition),
      declaredPropIds: definition.contentPolicy.includedPropIds,
      storageKey: `set-identity-boards/${STORY_KEY}/${setIdentityId}/board.png`,
      assetSha256: 'fixture-board-bytes-sha',
      promptHash: 'fixture-board-prompt-hash',
      model: 'fixture-model',
      quality: 'low',
      qaStatus: 'passed',
      qaCheckedAt: '2026-07-22T11:00:00.000Z',
      approvedBy: 'Guy',
      approvedAt: '2026-07-22T11:05:00.000Z',
    });
  }

  const source = buildStorySourceIdentity({ repoRoot: root, storyPath });
  const template = readJson<unknown>(templatePath);
  const sourceContent = parseStorySourceContent(fs.readFileSync(storyPath, 'utf8'));
  const reconciliation = buildSourcePromptReconciliationDraft(
    {
      storyKey: STORY_KEY,
      sourceIdentity: source,
      pages: sourceContent.pages,
      pageImageDirections: sourceContent.pageImageDirections,
      authoredCoverAuthority: authority,
    },
    runtimeTemplate,
  );
  for (const frame of reconciliation.frames) {
    const pageIndex = runtimeTemplate.pageContracts.findIndex(
      (candidate) => candidate.pageNumber === frame.pageNumber,
    );
    for (const requirement of frame.sourceRequirements) {
      const pointer = frame.frameKind === 'cover'
        ? '/coverContract'
        : requirement.sourceKind === 'historical_image_direction'
          ? `/pageContracts/${pageIndex}/camera`
          : `/pageContracts/${pageIndex}`;
      const value = frame.frameKind === 'cover'
        ? runtimeTemplate.coverContract
        : requirement.sourceKind === 'historical_image_direction'
          ? runtimeTemplate.pageContracts[pageIndex].camera
          : runtimeTemplate.pageContracts[pageIndex];
      requirement.visualBeats = [{
        id: `${requirement.sourceKind}:${frame.pageNumber}`,
        description: `reviewed ${requirement.sourceKind} evidence`,
        aspects: requirement.sourceKind === 'historical_image_direction'
          ? ['camera']
          : ['narrative_meaning'],
        disposition: 'preserved',
        contractEvidence: [{ path: pointer, value }],
        justification: null,
        supersessionReview: null,
      }];
    }
  }
  reconciliation.review = {
    status: 'approved',
    reviewedBy: 'fixture reviewer',
    reviewedAt: '2026-07-22T11:55:00.000Z',
  };
  writeJson(reconciliationPath, reconciliation);
  const binding: CandidateEvidenceBinding = {
    version: CANDIDATE_EVIDENCE_VERSION,
    storyKey: STORY_KEY,
    storySource: source,
    sourceInputDigest: 'fixture-source-input-digest',
    templateDigest: canonicalHash(template),
  };
  fs.writeFileSync(
    reviewPath,
    `${renderCandidateEvidenceHeader(binding)}# Human review fixture\n`,
    'utf8',
  );
  writeJson(provenancePath, {
    authoringModel: 'offline-fixture',
    candidateEvidence: binding,
  });

  const prepared = prepareVisualPackageCandidate({
    repoRoot: root,
    storyKey: STORY_KEY,
    storyPath,
    candidateDir,
    styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
  });
  prepared.manifest.review = {
    authoredBy: 'Visual package author',
    reviewedBy: 'Visual package reviewer',
    reviewedAt: '2026-07-22T12:00:00.000Z',
    worldMode: 'grounded_with_visual_metaphor',
  };
  prepared.manifest.approval = {
    approvedBy: 'Guy',
    approvedAt: '2026-07-22T12:05:00.000Z',
  };
  writePreparedCandidateManifest(prepared);
  return {
    root,
    candidateDir,
    manifestPath: prepared.manifestPath,
    storyPath,
    templatePath,
    reviewPath,
    provenancePath,
    reconciliationPath,
  };
}

function expectPromotionCode(fixture: Fixture, code: VisualPackageIssueCode): void {
  try {
    promoteVisualPackage({
      repoRoot: fixture.root,
      approvalManifestPath: fixture.manifestPath,
      now: () => new Date('2026-07-22T12:10:00.000Z'),
    });
    throw new Error('expected promotion to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(VisualPackageValidationError);
    expect((error as VisualPackageValidationError).issues.map((candidate) => candidate.code)).toContain(code);
  }
}

describe('visual-package candidate -> review -> Guy approval -> promotion', () => {
  const roots: string[] = [];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('network must be unreachable');
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  function fixture(): Fixture {
    const result = makeFixture();
    roots.push(result.root);
    return result;
  }

  it('promotes a complete approved fixture only on explicit write, then qualifies it offline', async () => {
    const f = fixture();
    const dryRun = promoteVisualPackage({
      repoRoot: f.root,
      approvalManifestPath: f.manifestPath,
      now: () => new Date('2026-07-22T12:10:00.000Z'),
    });
    expect(dryRun.wrote).toBe(false);
    expect(fs.existsSync(path.join(f.root, dryRun.manifestDestination))).toBe(false);

    const promoted = promoteVisualPackage({
      repoRoot: f.root,
      approvalManifestPath: f.manifestPath,
      write: true,
      now: () => new Date('2026-07-22T12:10:00.000Z'),
    });
    expect(promoted.wrote).toBe(true);
    expect(promoted.approvedManifest.state).toBe('approved');
    expect(promoted.approvedManifest.review.worldMode).toBe('grounded_with_visual_metaphor');
    expect(promoted.approvedManifest.requiredBoards).toHaveLength(1);
    expect(promoted.approvedManifest.requiredBoards[0]).toMatchObject({
      storyKey: STORY_KEY,
      setIdentityId: 'set_room_balcony_night',
      approvedBy: 'Guy',
    });
    expect(promoted.approvedManifest.requiredPropReferences).toEqual([
      expect.objectContaining({
        propId: 'prop_tin_bucket',
        assetSha256: '60ee317551759e42e08dba592b52d206ec4ed22e47d85a43789acfd977b869bc',
        approvedBy: 'Guy',
      }),
    ]);

    const qualification = evaluateRenderQualification({
      repoRoot: f.root,
      storyKey: STORY_KEY,
      storyPath: f.storyPath,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    });
    expect(qualification).toMatchObject({ renderQualified: true, reasons: [] });
    expect(fetch).not.toHaveBeenCalled();

    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    const runtimeCache = {
      storyFilePath: f.storyPath,
      storyDir: 'v3-approved',
      selectionFilename: `${STORY_KEY}.md`,
    };
    expect(() => requireStyle01RenderQualification({
      illustrationStyle: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      cache: runtimeCache,
      repoRoot: f.root,
    })).toThrow(RenderQualificationPreflightError);
    const provider = vi.fn(async () => 'paid-image');
    await expect(runWithStyle01RenderQualification({
      illustrationStyle: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      cache: runtimeCache,
      repoRoot: f.root,
      pageNumbers: [1],
    }, provider)).rejects.toBeInstanceOf(RenderQualificationPreflightError);
    expect(provider).not.toHaveBeenCalled();
  });

  it('qualification rejects changed prop-reference bytes without online storage access', () => {
    const f = fixture();
    promoteVisualPackage({
      repoRoot: f.root,
      approvalManifestPath: f.manifestPath,
      write: true,
      now: () => new Date('2026-07-22T12:10:00.000Z'),
    });
    fs.writeFileSync(
      path.join(
        f.root,
        'story-bank',
        'v3-approved',
        `${STORY_KEY}.zone-sheets`,
        'balcony_drip_area',
        'bucket-object.png',
      ),
      Buffer.from('changed-prop-bytes'),
    );
    const qualification = evaluateRenderQualification({
      repoRoot: f.root,
      storyKey: STORY_KEY,
      storyPath: f.storyPath,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    });
    expect(qualification.renderQualified).toBe(false);
    expect(qualification.reasons.map((reason) => reason.code)).toContain(
      'prop_reference_artifact_mismatch',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a legacy v1 candidate as a validation error instead of reading it as v2 authority', () => {
    const f = fixture();
    const legacy = readJson<Record<string, any>>(f.manifestPath);
    legacy.manifestVersion = 'visual-package/v1';
    delete legacy.requiredPropReferences;
    for (const board of legacy.requiredBoards ?? []) {
      delete board.contentPolicyDigest;
      delete board.declaredPropIds;
    }
    writeJson(f.manifestPath, legacy);

    expect(() => promoteVisualPackage({
      repoRoot: f.root,
      approvalManifestPath: f.manifestPath,
      write: false,
    })).toThrow(VisualPackageValidationError);
  });

  it('qualification fails closed on a legacy v1 approved package without online storage access', () => {
    const f = fixture();
    const promoted = promoteVisualPackage({
      repoRoot: f.root,
      approvalManifestPath: f.manifestPath,
      write: true,
    });
    const approvedPath = path.join(f.root, promoted.manifestDestination);
    const legacy = readJson<Record<string, any>>(approvedPath);
    legacy.manifestVersion = 'visual-package/v1';
    delete legacy.requiredPropReferences;
    for (const board of legacy.requiredBoards ?? []) {
      delete board.contentPolicyDigest;
      delete board.declaredPropIds;
    }
    writeJson(approvedPath, legacy);

    const qualification = evaluateRenderQualification({
      repoRoot: f.root,
      storyKey: STORY_KEY,
      storyPath: f.storyPath,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    });
    expect(qualification.renderQualified).toBe(false);
    expect(qualification.reasons.map((reason) => reason.code)).toContain('manifest_invalid');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed on the formerly current v2 package because it has no reconciliation authority', () => {
    const f = fixture();
    const promoted = promoteVisualPackage({
      repoRoot: f.root,
      approvalManifestPath: f.manifestPath,
      write: true,
    });
    const approvedPath = path.join(f.root, promoted.manifestDestination);
    const legacy = readJson<Record<string, any>>(approvedPath);
    legacy.manifestVersion = 'visual-package/v2';
    delete legacy.reconciliation;
    if (legacy.promotion) {
      legacy.promotion.toolVersion = 'visual-package-promotion/v2';
      delete legacy.promotion.reconciliationDestination;
    }
    writeJson(approvedPath, legacy);
    const qualification = evaluateRenderQualification({
      repoRoot: f.root,
      storyKey: STORY_KEY,
      storyPath: f.storyPath,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    });
    expect(qualification.renderQualified).toBe(false);
    expect(qualification.reasons.map((reason) => reason.code)).toContain('manifest_invalid');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects missing exact approval', () => {
    const f = fixture();
    const manifest = readJson<VisualPackageManifest>(f.manifestPath);
    manifest.approval = null;
    writeJson(f.manifestPath, manifest);
    expectPromotionCode(f, 'approval_missing');
  });

  it('rejects approval by anyone other than Guy', () => {
    const f = fixture();
    const manifest = readJson<VisualPackageManifest>(f.manifestPath);
    manifest.approval = { approvedBy: 'Someone Else', approvedAt: '2026-07-22T12:05:00.000Z' };
    writeJson(f.manifestPath, manifest);
    expectPromotionCode(f, 'approval_not_guy');
  });

  it('rejects missing author/reviewer-owned world reality metadata', () => {
    const f = fixture();
    const manifest = readJson<VisualPackageManifest>(f.manifestPath);
    manifest.review.worldMode = null;
    writeJson(f.manifestPath, manifest);
    expectPromotionCode(f, 'review_metadata_missing');
  });

  it('rejects the wrong storyKey', () => {
    const f = fixture();
    const manifest = readJson<VisualPackageManifest>(f.manifestPath);
    manifest.storyKey = 'another_story';
    writeJson(f.manifestPath, manifest);
    expectPromotionCode(f, 'story_key_mismatch');
  });

  it('rejects a stale story source', () => {
    const f = fixture();
    fs.appendFileSync(f.storyPath, '\n<!-- source changed after approval -->\n', 'utf8');
    expectPromotionCode(f, 'story_source_mismatch');
  });

  it('rejects a stale template digest', () => {
    const f = fixture();
    const template = readJson<Record<string, unknown>>(f.templatePath);
    template.worldType = `${String(template.worldType)} changed`;
    writeJson(f.templatePath, template);
    expectPromotionCode(f, 'template_digest_mismatch');
  });

  it('rejects a missing, incomplete, or digest-tampered source-prompt reconciliation', () => {
    const missing = fixture();
    fs.unlinkSync(missing.reconciliationPath);
    expectPromotionCode(missing, 'reconciliation_missing');

    const incomplete = fixture();
    const incompleteArtifact = readJson<SourcePromptReconciliation>(incomplete.reconciliationPath);
    incompleteArtifact.frames[1].sourceRequirements[0].visualBeats = [];
    writeJson(incomplete.reconciliationPath, incompleteArtifact);
    expectPromotionCode(incomplete, 'reconciliation_incomplete');

    const tampered = fixture();
    const tamperedArtifact = readJson<SourcePromptReconciliation>(tampered.reconciliationPath);
    tamperedArtifact.frames[1].sourceRequirements[0].visualBeats[0].description += ' changed';
    writeJson(tampered.reconciliationPath, tamperedArtifact);
    expectPromotionCode(tampered, 'reconciliation_identity_mismatch');
  });

  it('rejects a structurally valid candidate whose cover location contradicts authored page 0', () => {
    const f = fixture();
    const template = readJson<BookVisualContractTemplate>(f.templatePath);
    template.coverContract.locationId = 'loc_balcony';
    template.coverContract.zoneId = 'z_balcony_railing';
    writeJson(f.templatePath, template);
    expectPromotionCode(f, 'cover_source_location_mismatch');
  });

  it('rejects a candidate that puts an authored hidden object back into cover mustShow', () => {
    const f = fixture();
    const template = readJson<BookVisualContractTemplate>(f.templatePath);
    template.coverContract.mustShow = [...template.coverContract.mustShow, 'small metal bucket'];
    writeJson(f.templatePath, template);
    expectPromotionCode(f, 'cover_source_spoiler_contradiction');
  });

  it('rejects an unsupported template schema', () => {
    const f = fixture();
    const template = readJson<Record<string, unknown>>(f.templatePath);
    template.schemaVersion = 'vc-schema/future';
    writeJson(f.templatePath, template);
    expectPromotionCode(f, 'template_schema_unsupported');
  });

  it('rejects an invalid template', () => {
    const f = fixture();
    const template = readJson<Record<string, unknown>>(f.templatePath);
    template.worldType = '';
    writeJson(f.templatePath, template);
    expectPromotionCode(f, 'template_invalid');
  });

  it('rejects a missing cover contract', () => {
    const f = fixture();
    const template = readJson<Record<string, unknown>>(f.templatePath);
    delete template.coverContract;
    writeJson(f.templatePath, template);
    expectPromotionCode(f, 'cover_contract_missing');
  });

  it('rejects incomplete page coverage', () => {
    const f = fixture();
    const template = readJson<{ pageContracts: unknown[] }>(f.templatePath);
    template.pageContracts.pop();
    writeJson(f.templatePath, template);
    expectPromotionCode(f, 'page_coverage_incomplete');
  });

  it('rejects duplicate page coverage', () => {
    const f = fixture();
    const template = readJson<{ pageContracts: Array<{ pageNumber: number }> }>(f.templatePath);
    template.pageContracts[1].pageNumber = template.pageContracts[0].pageNumber;
    writeJson(f.templatePath, template);
    expectPromotionCode(f, 'page_coverage_duplicate');
  });

  it('rejects out-of-range page coverage', () => {
    const f = fixture();
    const template = readJson<{ pageContracts: Array<{ pageNumber: number }> }>(f.templatePath);
    template.pageContracts[template.pageContracts.length - 1].pageNumber = 999;
    writeJson(f.templatePath, template);
    expectPromotionCode(f, 'page_coverage_out_of_range');
  });

  it('rejects an unresolved required board', () => {
    const f = fixture();
    fs.rmSync(path.join(f.root, 'set-identity-boards'), { recursive: true, force: true });
    expectPromotionCode(f, 'board_unresolved');
  });

  it('rejects candidate/review disagreement', () => {
    const f = fixture();
    const source = buildStorySourceIdentity({ repoRoot: f.root, storyPath: f.storyPath });
    const wrong: CandidateEvidenceBinding = {
      version: CANDIDATE_EVIDENCE_VERSION,
      storyKey: 'another_story',
      storySource: source,
      sourceInputDigest: 'fixture-source-input-digest',
      templateDigest: canonicalHash(readJson<unknown>(f.templatePath)),
    };
    fs.writeFileSync(f.reviewPath, `${renderCandidateEvidenceHeader(wrong)}# changed\n`, 'utf8');
    expectPromotionCode(f, 'candidate_review_disagreement');
  });

  it('rejects candidate/review disagreement in non-digest source identity fields', () => {
    const f = fixture();
    const source = buildStorySourceIdentity({ repoRoot: f.root, storyPath: f.storyPath });
    const wrong: CandidateEvidenceBinding = {
      version: CANDIDATE_EVIDENCE_VERSION,
      storyKey: STORY_KEY,
      storySource: { ...source, path: 'story-bank/wrong/source.md' },
      sourceInputDigest: 'fixture-source-input-digest',
      templateDigest: canonicalHash(readJson<unknown>(f.templatePath)),
    };
    fs.writeFileSync(f.reviewPath, `${renderCandidateEvidenceHeader(wrong)}# changed\n`, 'utf8');
    expectPromotionCode(f, 'candidate_review_disagreement');
  });

  it('rejects candidate/provenance disagreement', () => {
    const f = fixture();
    const provenance = readJson<{ candidateEvidence: CandidateEvidenceBinding }>(f.provenancePath);
    provenance.candidateEvidence.templateDigest = 'wrong-template-digest';
    writeJson(f.provenancePath, provenance);
    expectPromotionCode(f, 'candidate_provenance_disagreement');
  });

  it('the qualification checker deliberately fails after a representative approved package is broken', () => {
    const f = fixture();
    promoteVisualPackage({ repoRoot: f.root, approvalManifestPath: f.manifestPath, write: true });
    fs.appendFileSync(f.storyPath, '\n<!-- stale -->\n', 'utf8');
    const qualification = evaluateRenderQualification({
      repoRoot: f.root,
      storyKey: STORY_KEY,
      storyPath: f.storyPath,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    });
    expect(qualification.renderQualified).toBe(false);
    expect(qualification.reasons.map((reason) => reason.code)).toContain('story_source_mismatch');
  });

  it('render qualification fails closed when an approved cover contradicts authored page 0', () => {
    const f = fixture();
    const promoted = promoteVisualPackage({
      repoRoot: f.root,
      approvalManifestPath: f.manifestPath,
      write: true,
    });
    const approvedTemplatePath = path.join(f.root, promoted.templateDestination);
    const template = readJson<BookVisualContractTemplate>(approvedTemplatePath);
    template.coverContract.locationId = 'loc_balcony';
    template.coverContract.zoneId = 'z_balcony_railing';
    writeJson(approvedTemplatePath, template);

    const qualification = evaluateRenderQualification({
      repoRoot: f.root,
      storyKey: STORY_KEY,
      storyPath: f.storyPath,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    });
    expect(qualification.renderQualified).toBe(false);
    expect(qualification.reasons.map((reason) => reason.code)).toContain('cover_source_location_mismatch');
  });

  it('returns a structured failure for a malformed approved board identity instead of throwing', () => {
    const f = fixture();
    const promoted = promoteVisualPackage({
      repoRoot: f.root,
      approvalManifestPath: f.manifestPath,
      write: true,
    });
    const approvedPath = path.join(f.root, promoted.manifestDestination);
    const approved = readJson<VisualPackageManifest>(approvedPath);
    approved.requiredBoards[0].artifactDigest = '';
    writeJson(approvedPath, approved);

    const qualification = evaluateRenderQualification({
      repoRoot: f.root,
      storyKey: STORY_KEY,
      storyPath: f.storyPath,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    });
    expect(qualification.renderQualified).toBe(false);
    expect(qualification.reasons.map((reason) => reason.code)).toContain('manifest_invalid');
  });
});

describe('all-slot zero-cost audit and explicit strict release mode', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports one structured record per nominally sellable slot without calling them render-qualified', () => {
    vi.stubEnv('ENABLE_V3_APPROVED_BANK', 'true');
    const audit = auditMvpRenderQualification({
      repoRoot: REPO,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
      now: () => new Date('2026-07-22T12:00:00.000Z'),
    });
    expect(audit.nominalSlotCount).toBe(18);
    expect(audit.records).toHaveLength(18);
    expect(audit.productSellableCount).toBe(18);
    expect(audit.renderQualifiedCount).toBe(0);
    for (const record of audit.records) {
      expect(record.nominallySellable).toBe(true);
      expect(record.productSellable).toBe(true);
      expect(record.renderQualified).toBe(false);
      expect(record.reasons.length).toBeGreaterThan(0);
      expect(record.reasons.every((reason) => typeof reason.code === 'string')).toBe(true);
    }
  });

  it('strict release qualification fails deliberately while report-only mode remains compatible', () => {
    vi.stubEnv('ENABLE_V3_APPROVED_BANK', 'true');
    const audit = auditMvpRenderQualification({
      repoRoot: REPO,
      styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
    });
    expect(evaluateRenderQualificationReleaseGate(audit, false)).toMatchObject({ strict: false, pass: true });
    const strict = evaluateRenderQualificationReleaseGate(audit, true);
    expect(strict.pass).toBe(false);
    expect(strict.failures).toHaveLength(18);
  });
});

describe('offline dependency boundary', () => {
  it('promotion, qualification, audit, release gate, and preflight import no live compiler/provider/network seam', () => {
    const files = [
      'lib/visual-package/promotion.ts',
      'lib/visual-package/qualification.ts',
      'lib/visual-package/audit.ts',
      'lib/visual-package/releaseGate.ts',
      'lib/generation-pipeline/render-qualification-preflight.ts',
    ];
    const forbidden = [
      'backend/providers/pipeline',
      "from 'openai'",
      'generate-image',
      'createLiveBoardResolverDeps',
      'compileBookVisualContract(',
      'compileBookVisualContractTemplate(',
      'fetch(',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(REPO, file), 'utf8');
      for (const token of forbidden) expect(source, `${file} contains ${token}`).not.toContain(token);
    }
  });

  it('runtime authority resolution does not import authoring, promotion, provider, network, storage, or database seams', () => {
    const files = [
      'lib/visual-package/qualification.ts',
      'lib/visual-package/runtimeAuthority.ts',
      'lib/generation-pipeline/render-qualification-preflight.ts',
      'lib/generation-pipeline/runtime-visual-authority.ts',
    ];
    const forbidden = [
      "from './promotion'",
      'compileBookVisualContract',
      'compileBookVisualContractTemplate',
      'generate-image',
      'image-storage',
      "from 'openai'",
      "@/lib/prisma",
      'readiness-manifest',
      'createLiveBoardResolverDeps',
      'fetch(',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(REPO, file), 'utf8');
      for (const token of forbidden) expect(source, `${file} contains ${token}`).not.toContain(token);
    }
  });
});
