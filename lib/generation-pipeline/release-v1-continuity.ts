import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import fs from 'fs';

import { styleIdFromDatabaseValue } from '@/lib/styles';
import {
  evaluateVisualPackageV4Qualification,
  type FrozenVisualPackageAuthority,
} from '@/lib/visual-package/visualPackageV4';
import {
  canonicalJsonDigest,
  resolveRepoPath,
} from '@/lib/visual-package/integrity';

import {
  OrderVisualPackageAuthorityError,
  requireOrderVisualPackageAuthority,
  type OrderVisualPackageAuthorityInput,
} from './order-visual-package-authority';

export const WIZARD_PRODUCT_BINDING_VERSION =
  'wizard-product-binding/v1' as const;
export const RELEASE_V1_PROTOCOL = 'release/v1' as const;

const SHA256_RE = /^[a-f0-9]{64}$/u;
const PRODUCT_BINDING_KEYS = [
  'packageAuthorityDigest',
  'packagePath',
  'packageRevisionDigest',
  'sourcePath',
  'sourceRawDigest',
  'storyKey',
  'styleId',
  'version',
] as const;

export interface WizardProductBindingV1 {
  version: typeof WIZARD_PRODUCT_BINDING_VERSION;
  storyKey: string;
  styleId: string;
  sourcePath: string;
  sourceRawDigest: string;
  packagePath: string;
  packageRevisionDigest: string;
  packageAuthorityDigest: string;
}

export interface GenerationReleaseContinuityV1 extends Prisma.JsonObject {
  version: 'generation-release-continuity/v1';
  protocol: typeof RELEASE_V1_PROTOCOL;
  workerBaseUrl: string;
  workerPath: '/api/release/v1/generate/worker';
}

export const RELEASE_V1_ORDER_AUTHORITY_SELECT = {
  id: true,
  selectionFilename: true,
  storySourceHash: true,
  illustrationStyle: true,
  visualPackageAuthority: true,
} satisfies Prisma.OrderSelect;

export type ReleaseV1OrderAuthoritySnapshot = Prisma.OrderGetPayload<{
  select: typeof RELEASE_V1_ORDER_AUTHORITY_SELECT;
}>;

export class ReleaseV1ContinuityError extends Error {
  readonly code = 'release_v1_authority_mismatch' as const;

  constructor(readonly reasons: readonly string[]) {
    const stable = [...new Set(reasons)].sort((left, right) =>
      left.localeCompare(right),
    );
    super(`[release_v1_continuity] ${stable.join('; ')}`);
    this.name = 'ReleaseV1ContinuityError';
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0;
}

export function parseWizardProductBindingV1(
  value: unknown,
): WizardProductBindingV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReleaseV1ContinuityError(['wizard product binding is missing or invalid']);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  if (
    JSON.stringify(keys) !==
    JSON.stringify([...PRODUCT_BINDING_KEYS].sort((left, right) => left.localeCompare(right)))
  ) {
    throw new ReleaseV1ContinuityError(['wizard product binding keys are invalid']);
  }
  const reasons: string[] = [];
  if (record.version !== WIZARD_PRODUCT_BINDING_VERSION) {
    reasons.push('wizard product binding version is invalid');
  }
  for (const key of [
    'storyKey',
    'styleId',
    'sourcePath',
    'packagePath',
  ] as const) {
    if (!nonEmptyString(record[key])) reasons.push(`${key} is invalid`);
  }
  for (const key of [
    'sourceRawDigest',
    'packageRevisionDigest',
    'packageAuthorityDigest',
  ] as const) {
    if (!nonEmptyString(record[key]) || !SHA256_RE.test(record[key])) {
      reasons.push(`${key} is invalid`);
    }
  }
  if (reasons.length > 0) throw new ReleaseV1ContinuityError(reasons);
  return record as unknown as WizardProductBindingV1;
}

export function buildWizardProductBindingV1(
  authority: FrozenVisualPackageAuthority,
): WizardProductBindingV1 {
  return {
    version: WIZARD_PRODUCT_BINDING_VERSION,
    storyKey: authority.storyKey,
    styleId: authority.styleId,
    sourcePath: authority.sourcePath,
    sourceRawDigest: authority.sourceRawDigest,
    packagePath: authority.packagePath,
    packageRevisionDigest: authority.packageRevisionDigest,
    packageAuthorityDigest: canonicalJsonDigest(authority),
  };
}

/**
 * Fresh release admission loads only the immutable package frozen on the Order.
 * It never consults the mutable current locator, so an exact historical Order
 * remains valid after a later package promotion while missing or changed
 * immutable bytes fail closed.
 */
export function requireReleaseV1OrderPackage(
  order: OrderVisualPackageAuthorityInput,
  options: { repoRoot?: string } = {},
): {
  authority: FrozenVisualPackageAuthority;
  binding: WizardProductBindingV1;
} {
  let authority: FrozenVisualPackageAuthority | null;
  try {
    authority = requireOrderVisualPackageAuthority(order);
  } catch (error) {
    throw new ReleaseV1ContinuityError([
      error instanceof OrderVisualPackageAuthorityError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error),
    ]);
  }
  if (!authority) {
    throw new ReleaseV1ContinuityError([
      'release/v1 requires a package-backed Order',
    ]);
  }
  const qualification = evaluateVisualPackageV4Qualification({
    repoRoot: options.repoRoot ?? process.cwd(),
    storyKey: authority.storyKey,
    styleId: styleIdFromDatabaseValue(order.illustrationStyle),
    frozenAuthority: authority,
    expectedOrderSourceRawDigest: order.storySourceHash,
  });
  if (
    !qualification.renderQualified ||
    !qualification.frozenAuthority ||
    !qualification.packageValue
  ) {
    throw new ReleaseV1ContinuityError(qualification.reasons);
  }
  const repoRoot = options.repoRoot ?? process.cwd();
  let sourcePath: string;
  try {
    sourcePath = resolveRepoPath(
      repoRoot,
      qualification.packageValue.sourceSnapshot.identity.path,
    );
  } catch (error) {
    throw new ReleaseV1ContinuityError([
      error instanceof Error ? error.message : String(error),
    ]);
  }
  if (!fs.existsSync(sourcePath)) {
    throw new ReleaseV1ContinuityError([
      'frozen package Story Source is missing from this deployment',
    ]);
  }
  const sourceBytes = fs.readFileSync(sourcePath, 'utf8');
  const sourceRawDigest = createHash('sha256')
    .update(sourceBytes, 'utf8')
    .digest('hex');
  if (
    sourceBytes !== qualification.packageValue.sourceSnapshot.content ||
    sourceRawDigest !== qualification.packageValue.sourceSnapshot.rawDigest
  ) {
    throw new ReleaseV1ContinuityError([
      'frozen package Story Source bytes differ in this deployment',
    ]);
  }
  return {
    authority: qualification.frozenAuthority,
    binding: buildWizardProductBindingV1(qualification.frozenAuthority),
  };
}

export function requireExpectedWizardProductBinding(args: {
  order: OrderVisualPackageAuthorityInput;
  expected: unknown;
  repoRoot?: string;
}): WizardProductBindingV1 {
  const expected = parseWizardProductBindingV1(args.expected);
  const actual = requireReleaseV1OrderPackage(args.order, {
    ...(args.repoRoot ? { repoRoot: args.repoRoot } : {}),
  }).binding;
  if (canonicalJsonDigest(actual) !== canonicalJsonDigest(expected)) {
    throw new ReleaseV1ContinuityError([
      'wizard product binding differs from the exact frozen Order package',
    ]);
  }
  return actual;
}

/** Exact authority fields for a CAS after validating the same snapshot. */
export function releaseV1AuthorityCasWhere(
  order: ReleaseV1OrderAuthoritySnapshot,
): Prisma.OrderWhereInput {
  return {
    selectionFilename: order.selectionFilename,
    storySourceHash: order.storySourceHash,
    illustrationStyle: order.illustrationStyle,
    visualPackageAuthority: {
      equals: order.visualPackageAuthority as Prisma.InputJsonValue,
    },
  };
}

export function releaseV1DeploymentDiagnostics(
  source: NodeJS.ProcessEnv = process.env,
): { gitCommitSha: string | null; deploymentId: string | null } {
  const sha = source.VERCEL_GIT_COMMIT_SHA?.trim() ?? '';
  const deploymentId = source.VERCEL_DEPLOYMENT_ID?.trim() ?? '';
  return {
    gitCommitSha: /^[a-f0-9]{40}$/u.test(sha) ? sha : null,
    deploymentId: /^dpl_[A-Za-z0-9]+$/u.test(deploymentId)
      ? deploymentId
      : null,
  };
}

export function buildGenerationReleaseContinuityV1(
  source: NodeJS.ProcessEnv = process.env,
): GenerationReleaseContinuityV1 {
  const raw = source.VERCEL_URL?.trim() ?? '';
  if (!raw) {
    throw new ReleaseV1ContinuityError([
      'VERCEL_URL is required before release/v1 generation can start',
    ]);
  }
  const candidate = /^https?:\/\//iu.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new ReleaseV1ContinuityError(['VERCEL_URL is invalid']);
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new ReleaseV1ContinuityError([
      'VERCEL_URL must identify one HTTPS deployment origin',
    ]);
  }
  return {
    version: 'generation-release-continuity/v1',
    protocol: RELEASE_V1_PROTOCOL,
    workerBaseUrl: url.origin,
    workerPath: '/api/release/v1/generate/worker',
  };
}

/** Prove this deployment can dispatch before fresh Order/payment mutation. */
export function assertReleaseV1OperationalAdmission(
  source: NodeJS.ProcessEnv = process.env,
): GenerationReleaseContinuityV1 {
  const continuity = buildGenerationReleaseContinuityV1(source);
  if (!source.GENERATION_SECRET?.trim()) {
    throw new ReleaseV1ContinuityError([
      'GENERATION_SECRET is required before release/v1 can accept an Order',
    ]);
  }
  return continuity;
}

export function parseGenerationReleaseContinuityV1(
  value: unknown,
): GenerationReleaseContinuityV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReleaseV1ContinuityError([
      'release/v1 generation continuity is missing',
    ]);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  const expected = ['protocol', 'version', 'workerBaseUrl', 'workerPath'];
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    throw new ReleaseV1ContinuityError([
      'release/v1 generation continuity keys are invalid',
    ]);
  }
  if (
    record.version !== 'generation-release-continuity/v1' ||
    record.protocol !== RELEASE_V1_PROTOCOL ||
    record.workerPath !== '/api/release/v1/generate/worker' ||
    !nonEmptyString(record.workerBaseUrl)
  ) {
    throw new ReleaseV1ContinuityError([
      'release/v1 generation continuity is invalid',
    ]);
  }
  let parsed: URL;
  try {
    parsed = new URL(record.workerBaseUrl);
  } catch {
    throw new ReleaseV1ContinuityError([
      'release/v1 worker base URL is invalid',
    ]);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.origin !== record.workerBaseUrl ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new ReleaseV1ContinuityError([
      'release/v1 worker base URL is not an exact HTTPS origin',
    ]);
  }
  return record as unknown as GenerationReleaseContinuityV1;
}
