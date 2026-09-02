import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  allMvpCategories,
  MVP_STORY_MATRIX,
  type MvpCategory,
  type StoryDirection,
} from '@/backend/config/mvp-story-matrix';
import { WIZARD_QA_STORY_DIR_NAME } from '@/backend/providers/story-bank-index';
import { canonicalHash, canonicalize } from '@/lib/canonical-json';
import {
  COMPANION_SHEET_VIEW_FILENAME,
  COMPANION_SHEET_VIEW_KINDS,
  type CompanionSheetViewKind,
} from '@/lib/generation-pipeline/companion-character-sheet-contract';
import { parseStoryMarkdown } from '@/lib/story-validators/parser';
import { parseStorySourceContent } from '@/lib/visual-contract-compiler/storySourceContent';
import { buildStorySourceIdentity, repoRelativePath } from '@/lib/visual-package/integrity';
import type { StorySourceIdentity } from '@/lib/visual-package/types';
import { isDevEnvironment } from '@/lib/dev-only-guard';

export const WIZARD_QA_CATALOG_VERSION = 'wizard-qa-render-catalog/v2' as const;
export const WIZARD_QA_CANDIDATE_VERSION = 'wizard-qa-storyboard-candidate/v2' as const;
export const WIZARD_QA_AUTHORITY_ROOT = 'qa-authorities/wizard' as const;
export const WIZARD_QA_RESEMBLANCE_THRESHOLD = 0.7;
const STORYBOARD_RECORD_VERSION = 'small-heroes-story-visual-direction-record/v1' as const;
const IMPORT_VERSION = 'story-bank-import/v4' as const;
const DIRECTIONS: readonly StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];
const PRESENCE = new Set(['present', 'partial', 'absent']);
const SHOTS = new Set(['extreme_wide', 'wide', 'medium_wide', 'medium', 'medium_close', 'close', 'detail']);
const ANGLES = new Set(['eye_level', 'high_angle', 'low_angle', 'overhead', 'ground_level', 'three_quarter']);

export type WizardQaReadinessReasonCode =
  | 'story_source_missing'
  | 'story_frontmatter_mismatch'
  | 'story_page_count_mismatch'
  | 'import_sidecar_missing'
  | 'import_sidecar_mismatch'
  | 'storyboard_missing'
  | 'storyboard_invalid'
  | 'storyboard_digest_mismatch'
  | 'companion_manifest_missing'
  | 'companion_manifest_invalid'
  | 'companion_view_missing'
  | 'companion_view_qa_rejected'
  | 'companion_view_resemblance_below_threshold'
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

export interface WizardQaStoryboardCandidate {
  version: typeof WIZARD_QA_CANDIDATE_VERSION;
  digestAlgorithm: 'canonical-json-sha256';
  digest: string;
  state: 'qa_ready_for_low_story_generation';
  productionEligible: false;
  category: MvpCategory;
  direction: StoryDirection;
  storyKey: string;
  companionId: string;
  source: StorySourceIdentity;
  importSidecarDigest: string;
  companionAuthority: WizardQaCompanionAuthority;
  visualDirections: {
    version: typeof STORYBOARD_RECORD_VERSION;
    path: string;
    digest: string;
    pageCount: number;
  };
}

export interface WizardQaCatalogRecord {
  category: MvpCategory;
  direction: StoryDirection;
  storyKey: string;
  companionId: string;
  storySourcePath: string;
  storySourceDigest: string;
  visualDirectionDigest: string;
  companionManifestDigest: string;
  candidatePath: string;
  candidateDigest: string;
  state: 'qa_ready_for_low_story_generation';
  storyReady: true;
  qaAuthoringReady: true;
  qaLowStoryGenerationReady: true;
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

const fileDigestCache = new Map<string, { identity: string; digest: string }>();

function sha256File(filePath: string): string {
  const resolved = path.resolve(filePath);
  const stat = fs.statSync(resolved);
  const identity = `${stat.size}:${stat.mtimeMs}`;
  const cached = fileDigestCache.get(resolved);
  if (cached?.identity === identity) return cached.digest;
  const digest = sha256(fs.readFileSync(resolved));
  fileDigestCache.set(resolved, { identity, digest });
  return digest;
}

function canonicalBytes(value: unknown): string {
  return `${JSON.stringify(canonicalize(value))}\n`;
}

function payloadDigest<T extends { digest: string }>(value: T): string {
  const { digest: _digest, ...payload } = value;
  return canonicalHash(payload);
}

function exactKeys(value: unknown, keys: readonly string[]): boolean {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).sort().join('\0') === [...keys].sort().join('\0');
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
  const sheetRoot = path.join(args.repoRoot, 'public', 'companions', args.companionId, 'style01-sheets');
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
      sha256: sha256File(viewPath),
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

function storyboardIsValid(value: unknown, storyKey: string, pageCount: number): boolean {
  const pageKeys = [
    'pageNumber', 'settingKey', 'setting', 'childPresence', 'companionPresence',
    'supportingCharacters', 'mainAction', 'heroObject', 'shotType', 'cameraAngle',
    'lighting', 'continuityAnchors',
  ];
  if (
    !exactKeys(value, ['version', 'storyKey', 'pages']) ||
    (value as { version?: unknown }).version !== STORYBOARD_RECORD_VERSION ||
    (value as { storyKey?: unknown }).storyKey !== storyKey ||
    !Array.isArray((value as { pages?: unknown }).pages) ||
    (value as { pages: unknown[] }).pages.length !== pageCount
  ) return false;
  return (value as { pages: Array<Record<string, unknown>> }).pages.every((page, index) =>
    exactKeys(page, pageKeys) && page.pageNumber === index + 1 &&
    typeof page.settingKey === 'string' && /^[a-z][a-z0-9_]{2,95}$/.test(page.settingKey) &&
    typeof page.setting === 'string' && !/[\u0590-\u05ff{}]/u.test(page.setting) &&
    PRESENCE.has(String(page.childPresence)) && PRESENCE.has(String(page.companionPresence)) &&
    Array.isArray(page.supportingCharacters) && typeof page.mainAction === 'string' &&
    (page.heroObject === null || typeof page.heroObject === 'string') &&
    SHOTS.has(String(page.shotType)) && ANGLES.has(String(page.cameraAngle)) &&
    typeof page.lighting === 'string' && Array.isArray(page.continuityAnchors),
  );
}

interface QaImportSidecar {
  version?: unknown;
  status?: unknown;
  authorityScope?: unknown;
  productionEligible?: unknown;
  storyKey?: unknown;
  companionId?: unknown;
  direction?: unknown;
  category?: unknown;
  pageCount?: unknown;
  physicalPageCount?: unknown;
  approvedBy?: unknown;
  approvedAt?: unknown;
  source?: { storySha256?: unknown };
  integratedStory?: { path?: unknown; sha256?: unknown; sourceProjectionSha256?: unknown };
  visualDirections?: {
    version?: unknown;
    path?: unknown;
    sha256?: unknown;
    receiptPath?: unknown;
    receiptSha256?: unknown;
  };
  providerAccounting?: {
    model?: unknown;
    serviceTier?: unknown;
    store?: unknown;
    transportRetries?: unknown;
    fallbackUsed?: unknown;
  };
  servedOnlyWhen?: unknown;
}

export interface WizardQaCandidateBuildResult {
  candidate: WizardQaStoryboardCandidate | null;
  issues: WizardQaReadinessIssue[];
}

export function buildWizardQaCandidate(args: {
  repoRoot: string;
  category: MvpCategory;
  direction: StoryDirection;
}): WizardQaCandidateBuildResult {
  const issues: WizardQaReadinessIssue[] = [];
  const companionId = MVP_STORY_MATRIX[args.category].companionId;
  const storyKey = `${companionId}_${args.direction}`;
  const storyPath = path.join(args.repoRoot, 'story-bank', WIZARD_QA_STORY_DIR_NAME, `${storyKey}.md`);
  const sidecarPath = path.join(args.repoRoot, 'story-bank', WIZARD_QA_STORY_DIR_NAME, `${storyKey}.import.json`);
  if (!fs.existsSync(storyPath)) addIssue(issues, 'story_source_missing');
  if (!fs.existsSync(sidecarPath)) addIssue(issues, 'import_sidecar_missing');
  if (issues.length > 0) return { candidate: null, issues };

  const rawStory = fs.readFileSync(storyPath, 'utf8');
  const story = parseStoryAuthority(rawStory);
  if (
    story.companionId !== companionId || story.direction !== args.direction ||
    story.category !== args.category
  ) addIssue(issues, 'story_frontmatter_mismatch');
  if (
    story.declaredPages !== story.pageNumbers.length ||
    story.pageNumbers.some((pageNumber, index) => pageNumber !== index + 1)
  ) addIssue(issues, 'story_page_count_mismatch');

  let sidecar: QaImportSidecar = {};
  let sidecarDigest = '';
  try {
    sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8')) as QaImportSidecar;
    sidecarDigest = canonicalHash(sidecar);
  } catch {
    addIssue(issues, 'import_sidecar_mismatch');
  }
  if (
    sidecar.version !== IMPORT_VERSION || sidecar.status !== 'qa_ready_for_low_story_generation' ||
    sidecar.authorityScope !== 'qa_only' || sidecar.productionEligible !== false ||
    sidecar.storyKey !== storyKey || sidecar.companionId !== companionId ||
    sidecar.direction !== args.direction || sidecar.category !== args.category ||
    sidecar.pageCount !== story.declaredPages ||
    sidecar.physicalPageCount !== story.declaredPages * 2 ||
    typeof sidecar.approvedBy !== 'string' ||
    typeof sidecar.approvedAt !== 'string' ||
    sidecar.source?.storySha256 !== sidecar.integratedStory?.sourceProjectionSha256 ||
    sidecar.integratedStory?.path !== repoRelativePath(args.repoRoot, storyPath) ||
    typeof sidecar.integratedStory.sha256 !== 'string' ||
    sidecar.visualDirections?.version !== STORYBOARD_RECORD_VERSION ||
    typeof sidecar.visualDirections.path !== 'string' ||
    typeof sidecar.visualDirections.sha256 !== 'string' ||
    typeof sidecar.visualDirections.receiptPath !== 'string' ||
    typeof sidecar.visualDirections.receiptSha256 !== 'string' ||
    sidecar.providerAccounting?.model !== 'gpt-5.6-sol' ||
    sidecar.providerAccounting.serviceTier !== 'default' ||
    sidecar.providerAccounting.store !== false ||
    sidecar.providerAccounting.transportRetries !== 0 ||
    sidecar.providerAccounting.fallbackUsed !== false ||
    sidecar.servedOnlyWhen !== 'non-production and ENABLE_WIZARD_QA_RENDER_CATALOG=true'
  ) addIssue(issues, 'import_sidecar_mismatch');

  const storyBytes = fs.readFileSync(storyPath);
  const sourceProjection = storyBytes.toString('utf8').replace(/^imageDirection:.*\r?\n/gm, '');
  if (
    sha256(storyBytes) !== sidecar.integratedStory?.sha256 ||
    sha256(sourceProjection) !== sidecar.integratedStory?.sourceProjectionSha256
  ) addIssue(issues, 'import_sidecar_mismatch');

  let directionPath = '';
  let directionDigest = '';
  try {
    directionPath = path.resolve(args.repoRoot, String(sidecar.visualDirections?.path ?? ''));
    repoRelativePath(args.repoRoot, directionPath);
    if (!fs.existsSync(directionPath)) addIssue(issues, 'storyboard_missing');
    else {
      const bytes = fs.readFileSync(directionPath);
      directionDigest = sha256(bytes);
      if (directionDigest !== sidecar.visualDirections?.sha256) {
        addIssue(issues, 'storyboard_digest_mismatch');
      } else if (!storyboardIsValid(JSON.parse(bytes.toString('utf8')), storyKey, story.declaredPages)) {
        addIssue(issues, 'storyboard_invalid');
      }
    }
    const receiptPath = path.resolve(args.repoRoot, String(sidecar.visualDirections?.receiptPath ?? ''));
    repoRelativePath(args.repoRoot, receiptPath);
    if (
      !fs.existsSync(receiptPath) ||
      sha256File(receiptPath) !== sidecar.visualDirections?.receiptSha256
    ) addIssue(issues, 'storyboard_digest_mismatch');
  } catch {
    addIssue(issues, 'storyboard_invalid');
  }

  const companionAuthority = validateCompanionAuthority({ repoRoot: args.repoRoot, companionId, issues });
  if (issues.length > 0 || !companionAuthority) return { candidate: null, issues };
  const source = buildStorySourceIdentity({ repoRoot: args.repoRoot, storyPath });
  const payload = {
    version: WIZARD_QA_CANDIDATE_VERSION,
    digestAlgorithm: 'canonical-json-sha256' as const,
    state: 'qa_ready_for_low_story_generation' as const,
    productionEligible: false as const,
    category: args.category,
    direction: args.direction,
    storyKey,
    companionId,
    source,
    importSidecarDigest: sidecarDigest,
    companionAuthority,
    visualDirections: {
      version: STORYBOARD_RECORD_VERSION,
      path: repoRelativePath(args.repoRoot, directionPath),
      digest: directionDigest,
      pageCount: story.declaredPages,
    },
  };
  return { candidate: { ...payload, digest: canonicalHash(payload) }, issues: [] };
}

function writeCanonicalFile(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, canonicalBytes(value), 'utf8');
}

export function materializeWizardQaCatalog(args: {
  repoRoot: string;
  outputRoot?: string;
}): WizardQaRenderCatalog {
  const outputRoot = path.resolve(args.repoRoot, args.outputRoot ?? WIZARD_QA_AUTHORITY_ROOT);
  const records: WizardQaCatalogRecord[] = [];
  const failures: Array<{ storyKey: string; issues: WizardQaReadinessIssue[] }> = [];
  const candidateRoot = path.join(outputRoot, 'storyboard-candidates');
  fs.rmSync(path.join(outputRoot, 'visual-contract-candidates'), { recursive: true, force: true });
  fs.rmSync(candidateRoot, { recursive: true, force: true });
  for (const category of allMvpCategories()) {
    for (const direction of DIRECTIONS) {
      const result = buildWizardQaCandidate({ repoRoot: args.repoRoot, category, direction });
      const storyKey = `${MVP_STORY_MATRIX[category].companionId}_${direction}`;
      if (!result.candidate) {
        failures.push({ storyKey, issues: result.issues });
        continue;
      }
      const candidatePath = path.join(candidateRoot, `${storyKey}.json`);
      writeCanonicalFile(candidatePath, result.candidate);
      records.push({
        category,
        direction,
        storyKey,
        companionId: result.candidate.companionId,
        storySourcePath: result.candidate.source.path,
        storySourceDigest: result.candidate.source.digest,
        visualDirectionDigest: result.candidate.visualDirections.digest,
        companionManifestDigest: result.candidate.companionAuthority.manifestDigest,
        candidatePath: repoRelativePath(args.repoRoot, candidatePath),
        candidateDigest: result.candidate.digest,
        state: 'qa_ready_for_low_story_generation',
        storyReady: true,
        qaAuthoringReady: true,
        qaLowStoryGenerationReady: true,
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
  const catalog: WizardQaRenderCatalog = { ...payload, digest: canonicalHash(payload) };
  writeCanonicalFile(path.join(outputRoot, 'catalog.json'), catalog);
  return catalog;
}

function candidateIsValid(args: { repoRoot: string; record: WizardQaCatalogRecord }): boolean {
  try {
    const candidatePath = path.resolve(args.repoRoot, args.record.candidatePath);
    repoRelativePath(args.repoRoot, candidatePath);
    const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8')) as WizardQaStoryboardCandidate;
    const rebuilt = buildWizardQaCandidate({
      repoRoot: args.repoRoot,
      category: args.record.category,
      direction: args.record.direction,
    }).candidate;
    return Boolean(
      rebuilt && candidate.version === WIZARD_QA_CANDIDATE_VERSION &&
      candidate.productionEligible === false && candidate.state === 'qa_ready_for_low_story_generation' &&
      candidate.storyKey === args.record.storyKey && candidate.companionId === args.record.companionId &&
      candidate.source.path === args.record.storySourcePath &&
      candidate.source.digest === args.record.storySourceDigest &&
      candidate.visualDirections.digest === args.record.visualDirectionDigest &&
      candidate.companionAuthority.manifestDigest === args.record.companionManifestDigest &&
      candidate.digest === args.record.candidateDigest && payloadDigest(candidate) === candidate.digest &&
      canonicalHash(candidate) === canonicalHash(rebuilt)
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
    const identities = new Set(catalog.records.map((record) => `${record.category}:${record.direction}`));
    if (
      catalog.version !== WIZARD_QA_CATALOG_VERSION || catalog.slotCount !== 18 ||
      catalog.companionCount !== 6 || catalog.records.length !== 18 || identities.size !== 18 ||
      payloadDigest(catalog) !== catalog.digest ||
      !catalog.records.every((record) =>
        record.state === 'qa_ready_for_low_story_generation' &&
        record.qaLowStoryGenerationReady === true && record.productionRenderQualified === false &&
        candidateIsValid({ repoRoot: args.repoRoot, record }),
      )
    ) return null;
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
  return catalog?.records.find(
    (record) => record.category === args.category && record.direction === args.direction,
  ) ?? null;
}
