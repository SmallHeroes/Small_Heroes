import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  allMvpCategories,
  MVP_STORY_MATRIX,
  type MvpCategory,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';
import { V3_APPROVED_DIR_NAME } from '@/backend/providers/story-bank-index';
import { canonicalHash, canonicalize } from '@/lib/canonical-json';
import {
  COMPANION_SHEET_VIEW_FILENAME,
  COMPANION_SHEET_VIEW_KINDS,
  type CompanionSheetViewKind,
} from '@/lib/generation-pipeline/companion-character-sheet';
import { parseStoryMarkdown } from '@/lib/story-validators/parser';
import { migrateLegacyBookVisualContractTemplateV1 } from '@/lib/visual-contract-compiler/contractTemplateMigration';
import type { BookVisualContractTemplate } from '@/lib/visual-contract-compiler/contractTemplateTypes';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import { validateBookVisualContractTemplate } from '@/lib/visual-contract-compiler/validateTemplateContract';
import { buildStorySourceIdentity, repoRelativePath } from '@/lib/visual-package/integrity';
import type { StorySourceIdentity } from '@/lib/visual-package/types';
import { isDevEnvironment } from '@/lib/dev-only-guard';

export const WIZARD_QA_CATALOG_VERSION = 'wizard-qa-render-catalog/v1' as const;
export const WIZARD_QA_CANDIDATE_VERSION = 'wizard-qa-visual-contract-candidate/v1' as const;
export const WIZARD_QA_AUTHORITY_ROOT = 'qa-authorities/wizard' as const;
export const WIZARD_QA_RESEMBLANCE_THRESHOLD = 0.7;

const DIRECTIONS: readonly StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

export type WizardQaReadinessReasonCode =
  | 'story_source_missing'
  | 'story_frontmatter_mismatch'
  | 'story_page_count_mismatch'
  | 'import_sidecar_missing'
  | 'import_sidecar_mismatch'
  | 'companion_manifest_missing'
  | 'companion_manifest_invalid'
  | 'companion_view_missing'
  | 'companion_view_qa_rejected'
  | 'companion_view_resemblance_below_threshold'
  | 'historical_candidate_missing'
  | 'historical_candidate_invalid'
  | 'candidate_story_mismatch'
  | 'candidate_page_coverage_mismatch'
  | 'qa_candidate_missing'
  | 'qa_candidate_digest_mismatch'
  | 'catalog_invalid';

export interface WizardQaReadinessIssue {
  code: WizardQaReadinessReasonCode;
  field?: string;
}

export interface WizardQaCompanionViewAuthority {
  kind: CompanionSheetViewKind;
  path: string;
  sha256: string;
  qaStatus: 'passed';
  resemblanceToIdentity: number;
}

export interface WizardQaCompanionAuthority {
  manifestPath: string;
  manifestDigest: string;
  resemblanceThreshold: number;
  minimumResemblance: number;
  views: WizardQaCompanionViewAuthority[];
}

export interface WizardQaVisualContractCandidate {
  version: typeof WIZARD_QA_CANDIDATE_VERSION;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
  state: 'ready_for_blueprint_authoring';
  productionEligible: false;
  category: MvpCategory;
  direction: StoryDirection;
  storyKey: string;
  companionId: string;
  source: StorySourceIdentity;
  importSidecarDigest: string;
  companionAuthority: WizardQaCompanionAuthority;
  historicalInput: {
    fileName: string;
    rawSha256: string;
    schemaVersion: 'vc-schema/v1';
  };
  templateDigest: string;
  template: BookVisualContractTemplate;
}

export interface WizardQaCatalogRecord {
  category: MvpCategory;
  direction: StoryDirection;
  storyKey: string;
  companionId: string;
  storySourcePath: string;
  storySourceDigest: string;
  companionManifestDigest: string;
  candidatePath: string;
  candidateDigest: string;
  state: 'ready_for_blueprint_authoring';
  storyReady: true;
  qaAuthoringReady: true;
  productionRenderQualified: false;
}

export interface WizardQaRenderCatalog {
  version: typeof WIZARD_QA_CATALOG_VERSION;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
  slotCount: 18;
  companionCount: 6;
  records: WizardQaCatalogRecord[];
}

interface ManifestView {
  filename?: unknown;
  qaStatus?: unknown;
  resemblanceToIdentity?: unknown;
}

interface CompanionManifest {
  companionId?: unknown;
  views?: Partial<Record<CompanionSheetViewKind, ManifestView>>;
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalBytes(value: unknown): string {
  return `${JSON.stringify(canonicalize(value))}\n`;
}

function payloadDigest<T extends { digest: string }>(value: T): string {
  const { digest: _digest, ...payload } = value;
  return canonicalHash(payload);
}

function addIssue(
  issues: WizardQaReadinessIssue[],
  code: WizardQaReadinessReasonCode,
  field?: string,
): void {
  issues.push({ code, ...(field ? { field } : {}) });
}

function parseStoryAuthority(raw: string): {
  companionId: string;
  direction: string;
  category: string;
  declaredPages: number;
  pageNumbers: number[];
} {
  const normalized = parseStorySourceContent(raw).frontmatterMarkdown;
  const parsed = parseStoryMarkdown(normalized);
  return {
    companionId: String(parsed.frontmatter.companionId ?? '').trim(),
    direction: String(parsed.frontmatter.direction ?? '').trim(),
    category: String(parsed.frontmatter.category ?? '').trim(),
    declaredPages: Number(parsed.frontmatter.pages),
    pageNumbers: parsed.pages.map((page) => page.pageNumber),
  };
}

function validateCompanionAuthority(args: {
  repoRoot: string;
  companionId: string;
  issues: WizardQaReadinessIssue[];
}): WizardQaCompanionAuthority | null {
  const sheetRoot = path.join(
    args.repoRoot,
    'public',
    'companions',
    args.companionId,
    'style01-sheets',
  );
  const manifestPath = path.join(sheetRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    addIssue(args.issues, 'companion_manifest_missing');
    return null;
  }
  let manifest: CompanionManifest;
  let manifestDigest: string;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CompanionManifest;
    manifestDigest = canonicalHash(manifest);
  } catch {
    addIssue(args.issues, 'companion_manifest_invalid');
    return null;
  }
  if (manifest.companionId !== args.companionId || !manifest.views) {
    addIssue(args.issues, 'companion_manifest_invalid');
    return null;
  }
  const views: WizardQaCompanionViewAuthority[] = [];
  for (const kind of COMPANION_SHEET_VIEW_KINDS) {
    const entry = manifest.views[kind];
    const expectedFilename = COMPANION_SHEET_VIEW_FILENAME[kind];
    const viewPath = path.join(sheetRoot, expectedFilename);
    if (!entry || entry.filename !== expectedFilename || !fs.existsSync(viewPath)) {
      addIssue(args.issues, 'companion_view_missing', kind);
      continue;
    }
    if (entry.qaStatus !== 'passed') {
      addIssue(args.issues, 'companion_view_qa_rejected', kind);
      continue;
    }
    const resemblance = Number(entry.resemblanceToIdentity);
    if (!Number.isFinite(resemblance) || resemblance < WIZARD_QA_RESEMBLANCE_THRESHOLD) {
      addIssue(args.issues, 'companion_view_resemblance_below_threshold', kind);
      continue;
    }
    views.push({
      kind,
      path: repoRelativePath(args.repoRoot, viewPath),
      sha256: sha256(fs.readFileSync(viewPath)),
      qaStatus: 'passed',
      resemblanceToIdentity: resemblance,
    });
  }
  if (views.length !== COMPANION_SHEET_VIEW_KINDS.length) return null;
  return {
    manifestPath: repoRelativePath(args.repoRoot, manifestPath),
    manifestDigest,
    resemblanceThreshold: WIZARD_QA_RESEMBLANCE_THRESHOLD,
    minimumResemblance: Math.min(...views.map((view) => view.resemblanceToIdentity)),
    views,
  };
}

export interface WizardQaCandidateBuildResult {
  candidate: WizardQaVisualContractCandidate | null;
  issues: WizardQaReadinessIssue[];
}

/**
 * Explicit, zero-cost migration boundary. Historical bytes are read-only inputs;
 * the result is a new QA-only source/companion-bound authority and can never be
 * interpreted as a Production approval.
 */
export function buildWizardQaCandidate(args: {
  repoRoot: string;
  historicalCandidateDir: string;
  category: MvpCategory;
  direction: StoryDirection;
}): WizardQaCandidateBuildResult {
  const issues: WizardQaReadinessIssue[] = [];
  const companionId = MVP_STORY_MATRIX[args.category].companionId;
  const storyKey = `${companionId}_${args.direction}`;
  const storyPath = path.join(
    args.repoRoot,
    'story-bank',
    V3_APPROVED_DIR_NAME,
    `${storyKey}.md`,
  );
  const sidecarPath = path.join(
    args.repoRoot,
    'story-bank',
    V3_APPROVED_DIR_NAME,
    `${storyKey}.import.json`,
  );
  if (!fs.existsSync(storyPath)) addIssue(issues, 'story_source_missing');
  if (!fs.existsSync(sidecarPath)) addIssue(issues, 'import_sidecar_missing');
  if (issues.length > 0) return { candidate: null, issues };

  const rawStory = fs.readFileSync(storyPath, 'utf8');
  const story = parseStoryAuthority(rawStory);
  if (
    story.companionId !== companionId ||
    story.direction !== args.direction ||
    story.category !== args.category
  ) {
    addIssue(issues, 'story_frontmatter_mismatch');
  }
  if (
    story.declaredPages !== story.pageNumbers.length ||
    story.pageNumbers.some((pageNumber, index) => pageNumber !== index + 1)
  ) {
    addIssue(issues, 'story_page_count_mismatch');
  }

  let sidecar: Record<string, unknown> = {};
  try {
    sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8')) as Record<string, unknown>;
  } catch {
    addIssue(issues, 'import_sidecar_mismatch');
  }
  if (
    sidecar.companionId !== companionId ||
    sidecar.direction !== args.direction ||
    Number(sidecar.pageCount) !== story.declaredPages ||
    typeof sidecar.approvedBy !== 'string' ||
    typeof sidecar.approvedAt !== 'string'
  ) {
    addIssue(issues, 'import_sidecar_mismatch');
  }

  const companionAuthority = validateCompanionAuthority({
    repoRoot: args.repoRoot,
    companionId,
    issues,
  });

  const historicalPath = path.join(
    args.historicalCandidateDir,
    `${storyKey}.visual-contract-template.json`,
  );
  let historicalBytes: Buffer | null = null;
  let template: BookVisualContractTemplate | null = null;
  if (!fs.existsSync(historicalPath)) {
    addIssue(issues, 'historical_candidate_missing');
  } else {
    try {
      historicalBytes = fs.readFileSync(historicalPath);
      template = migrateLegacyBookVisualContractTemplateV1(
        JSON.parse(historicalBytes.toString('utf8')) as unknown,
      );
      const validation = validateBookVisualContractTemplate(template);
      if (!validation.ok) addIssue(issues, 'historical_candidate_invalid');
    } catch {
      addIssue(issues, 'historical_candidate_invalid');
    }
  }
  if (template && template.storyKey !== storyKey) {
    addIssue(issues, 'candidate_story_mismatch');
  }
  if (
    template &&
    (template.pageContracts.length !== story.pageNumbers.length ||
      template.pageContracts.some(
        (page, index) => page.pageNumber !== story.pageNumbers[index],
      ))
  ) {
    addIssue(issues, 'candidate_page_coverage_mismatch');
  }

  if (issues.length > 0 || !companionAuthority || !historicalBytes || !template) {
    return { candidate: null, issues };
  }
  const source = buildStorySourceIdentity({ repoRoot: args.repoRoot, storyPath });
  const payload = {
    version: WIZARD_QA_CANDIDATE_VERSION,
    digestAlgorithm: 'canonical-json-sha256' as const,
    state: 'ready_for_blueprint_authoring' as const,
    productionEligible: false as const,
    category: args.category,
    direction: args.direction,
    storyKey,
    companionId,
    source,
    importSidecarDigest: canonicalHash(sidecar),
    companionAuthority,
    historicalInput: {
      fileName: path.basename(historicalPath),
      rawSha256: sha256(historicalBytes),
      schemaVersion: 'vc-schema/v1' as const,
    },
    templateDigest: canonicalHash(template),
    template,
  };
  return {
    candidate: { ...payload, digest: canonicalHash(payload) },
    issues: [],
  };
}

function writeCanonicalFile(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, canonicalBytes(value), 'utf8');
}

export function materializeWizardQaCatalog(args: {
  repoRoot: string;
  historicalCandidateDir: string;
  outputRoot?: string;
}): WizardQaRenderCatalog {
  const outputRoot = path.resolve(
    args.repoRoot,
    args.outputRoot ?? WIZARD_QA_AUTHORITY_ROOT,
  );
  const records: WizardQaCatalogRecord[] = [];
  const failures: Array<{ storyKey: string; issues: WizardQaReadinessIssue[] }> = [];
  for (const category of allMvpCategories()) {
    for (const direction of DIRECTIONS) {
      const result = buildWizardQaCandidate({
        repoRoot: args.repoRoot,
        historicalCandidateDir: args.historicalCandidateDir,
        category,
        direction,
      });
      const storyKey = `${MVP_STORY_MATRIX[category].companionId}_${direction}`;
      if (!result.candidate) {
        failures.push({ storyKey, issues: result.issues });
        continue;
      }
      const candidatePath = path.join(
        outputRoot,
        'visual-contract-candidates',
        `${storyKey}.json`,
      );
      writeCanonicalFile(candidatePath, result.candidate);
      records.push({
        category,
        direction,
        storyKey,
        companionId: result.candidate.companionId,
        storySourcePath: result.candidate.source.path,
        storySourceDigest: result.candidate.source.digest,
        companionManifestDigest: result.candidate.companionAuthority.manifestDigest,
        candidatePath: repoRelativePath(args.repoRoot, candidatePath),
        candidateDigest: result.candidate.digest,
        state: 'ready_for_blueprint_authoring',
        storyReady: true,
        qaAuthoringReady: true,
        productionRenderQualified: false,
      });
    }
  }
  if (failures.length > 0 || records.length !== 18) {
    throw new Error(`wizard QA catalog rejected: ${JSON.stringify(failures)}`);
  }
  const payload = {
    version: WIZARD_QA_CATALOG_VERSION,
    digestAlgorithm: 'canonical-json-sha256' as const,
    slotCount: 18 as const,
    companionCount: 6 as const,
    records,
  };
  const catalog: WizardQaRenderCatalog = {
    ...payload,
    digest: canonicalHash(payload),
  };
  writeCanonicalFile(path.join(outputRoot, 'catalog.json'), catalog);
  return catalog;
}

function candidateIsValid(args: {
  repoRoot: string;
  record: WizardQaCatalogRecord;
}): boolean {
  try {
    const candidatePath = path.resolve(args.repoRoot, args.record.candidatePath);
    repoRelativePath(args.repoRoot, candidatePath);
    const candidate = JSON.parse(
      fs.readFileSync(candidatePath, 'utf8'),
    ) as WizardQaVisualContractCandidate;
    return (
      candidate.version === WIZARD_QA_CANDIDATE_VERSION &&
      candidate.productionEligible === false &&
      candidate.storyKey === args.record.storyKey &&
      candidate.companionId === args.record.companionId &&
      candidate.source.path === args.record.storySourcePath &&
      candidate.source.digest === args.record.storySourceDigest &&
      candidate.companionAuthority.manifestDigest ===
        args.record.companionManifestDigest &&
      candidate.digest === args.record.candidateDigest &&
      payloadDigest(candidate) === candidate.digest &&
      validateBookVisualContractTemplate(candidate.template).ok
    );
  } catch {
    return false;
  }
}

export function loadWizardQaCatalog(args: {
  repoRoot: string;
  catalogPath?: string;
}): WizardQaRenderCatalog | null {
  const catalogPath = path.resolve(
    args.repoRoot,
    args.catalogPath ?? path.join(WIZARD_QA_AUTHORITY_ROOT, 'catalog.json'),
  );
  try {
    repoRelativePath(args.repoRoot, catalogPath);
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as WizardQaRenderCatalog;
    const identities = new Set(
      catalog.records.map((record) => `${record.category}:${record.direction}`),
    );
    if (
      catalog.version !== WIZARD_QA_CATALOG_VERSION ||
      catalog.slotCount !== 18 ||
      catalog.companionCount !== 6 ||
      catalog.records.length !== 18 ||
      identities.size !== 18 ||
      payloadDigest(catalog) !== catalog.digest ||
      !catalog.records.every((record) => candidateIsValid({ repoRoot: args.repoRoot, record }))
    ) {
      return null;
    }
    return catalog;
  } catch {
    return null;
  }
}

export function isWizardQaCatalogEnabled(): boolean {
  return isDevEnvironment() && process.env.ENABLE_WIZARD_QA_RENDER_CATALOG === 'true';
}

export function wizardQaSlotReadiness(args: {
  repoRoot: string;
  category: MvpCategory;
  direction: StoryDirection;
}): WizardQaCatalogRecord | null {
  if (!isWizardQaCatalogEnabled()) return null;
  const catalog = loadWizardQaCatalog({ repoRoot: args.repoRoot });
  return (
    catalog?.records.find(
      (record) =>
        record.category === args.category && record.direction === args.direction,
    ) ?? null
  );
}
