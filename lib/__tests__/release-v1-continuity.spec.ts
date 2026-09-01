import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildFrozenVisualPackageAuthority,
  loadCurrentVisualPackageV4,
} from '@/lib/visual-package/visualPackageV4';
import {
  assertReleaseV1OperationalAdmission,
  buildWizardProductBindingV1,
  parseWizardProductBindingV1,
  ReleaseV1ContinuityError,
  requireExpectedWizardProductBinding,
  requireReleaseV1OrderPackage,
} from '@/lib/generation-pipeline/release-v1-continuity';

const REPO_ROOT = process.cwd();
const STORY_KEY = 'chameleon_koko_bedtime';
const STYLE_ID = 'soft_hand_drawn_storybook';
const LOCATOR_PATH =
  'visual-packages/approved/chameleon_koko_bedtime.soft_hand_drawn_storybook.visual-package-current.json';
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function currentFixture() {
  const { locator, packageValue } = loadCurrentVisualPackageV4({
    repoRoot: REPO_ROOT,
    locatorPath: LOCATOR_PATH,
    storyKey: STORY_KEY,
    styleId: STYLE_ID,
  });
  const authority = buildFrozenVisualPackageAuthority({
    packageValue,
    packagePath: locator.packagePath,
  });
  return {
    locator,
    packageValue,
    authority,
    order: {
      id: 'release-v1-offline-order',
      selectionFilename: authority.sourcePath,
      storySourceHash: authority.sourceRawDigest,
      illustrationStyle: 'pencil_watercolor' as const,
      visualPackageAuthority: authority,
    },
  };
}

function copyInto(root: string, relativePath: string) {
  const target = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, ...relativePath.split('/')), target);
}

describe('release/v1 immutable package and deployment admission', () => {
  it('loads an exact frozen package and external accepted Story Source without consulting a locator', () => {
    const fixture = currentFixture();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-release-v1-'));
    temporaryRoots.push(root);
    copyInto(root, fixture.authority.packagePath);
    copyInto(root, fixture.authority.sourcePath);

    const admitted = requireReleaseV1OrderPackage(fixture.order, { repoRoot: root });
    expect(admitted.authority).toEqual(fixture.authority);
    expect(admitted.binding).toEqual(buildWizardProductBindingV1(fixture.authority));
    expect(fs.existsSync(path.join(root, ...LOCATOR_PATH.split('/')))).toBe(false);
  });

  it('fails closed when the immutable package exists but its external accepted source is absent', () => {
    const fixture = currentFixture();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-release-v1-'));
    temporaryRoots.push(root);
    copyInto(root, fixture.authority.packagePath);

    expect(() => requireReleaseV1OrderPackage(fixture.order, { repoRoot: root }))
      .toThrow(/Story Source is missing/u);
  });

  it('rejects an extra binding key and a stale package digest', () => {
    const fixture = currentFixture();
    const binding = buildWizardProductBindingV1(fixture.authority);
    expect(() => parseWizardProductBindingV1({ ...binding, extra: true }))
      .toThrow(ReleaseV1ContinuityError);
    expect(() => requireExpectedWizardProductBinding({
      order: fixture.order,
      expected: { ...binding, packageRevisionDigest: '0'.repeat(64) },
    })).toThrow(/differs from the exact frozen Order package/u);
  });

  it('requires one HTTPS VERCEL_URL and a generation secret before Order/payment mutation', () => {
    expect(() => assertReleaseV1OperationalAdmission({} as NodeJS.ProcessEnv))
      .toThrow(/VERCEL_URL is required/u);
    expect(() => assertReleaseV1OperationalAdmission({
      VERCEL_URL: 'qa-branch.vercel.app',
    } as unknown as NodeJS.ProcessEnv)).toThrow(/GENERATION_SECRET is required/u);
    expect(assertReleaseV1OperationalAdmission({
      VERCEL_URL: 'qa-branch.vercel.app',
      GENERATION_SECRET: 'worker-secret',
      INTERNAL_WORKER_BASE_URL: 'https://stable.example.com',
    } as unknown as NodeJS.ProcessEnv)).toEqual({
      version: 'generation-release-continuity/v1',
      protocol: 'release/v1',
      workerBaseUrl: 'https://qa-branch.vercel.app',
      workerPath: '/api/release/v1/generate/worker',
    });
  });
});

describe('release/v1 public and trace wiring', () => {
  it('Wizard uses only release/v1 preorder, Order and checkout endpoints', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'public/JS/wizard.js'), 'utf8');
    expect(source).toContain("'/api/release/v1/preorder'");
    expect(source).toContain("'/api/release/v1/orders'");
    expect(source).toContain("'/api/release/v1/checkout'");
    expect(source).not.toMatch(/(?:fetch|requestJson)\(\s*['"]\/api\/orders['"]/u);
    expect(source).not.toMatch(/(?:fetch|requestJson)\(\s*['"]\/api\/checkout['"]/u);
    expect(source).not.toMatch(/fetch\(\s*`\/api\/wizard\/product-truth/u);
    expect(source).toContain('state.productTruth = null');
    expect(source).toContain('wizardProductBindingsEqual');
    expect(source).toContain("configured: 'matrix_unavailable'");
    expect(source).toContain('state.mvpMatrix = null');
  });

  it('traces every fs-backed release/v1 function under its own route key', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'next.config.js'), 'utf8');
    for (const route of [
      '/api/release/v1/preorder',
      '/api/release/v1/orders',
      '/api/release/v1/checkout',
      '/api/release/v1/fake-payment/confirm',
      '/api/release/v1/generate/status',
      '/api/release/v1/generate/worker',
      '/release/v1/fake-payment',
    ]) {
      expect(source).toContain(`'${route}'`);
    }
  });
});
