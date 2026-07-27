import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

const REPO = process.cwd();
const TSX = path.join(
  REPO,
  'node_modules',
  'tsx',
  'dist',
  'cli.mjs',
);
const SHIM = path.join(
  REPO,
  'scripts',
  'shims',
  'register-server-only.cjs',
);

function source(relativePath: string): string {
  return fs.readFileSync(path.join(REPO, relativePath), 'utf8');
}

function productionTypeScriptFiles(
  relativeRoot: string,
): string[] {
  const absoluteRoot = path.join(REPO, relativeRoot);
  const out: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, {
      withFileTypes: true,
    })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') visit(absolute);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.spec.ts')
      ) {
        out.push(
          path
            .relative(REPO, absolute)
            .split(path.sep)
            .join('/'),
        );
      }
    }
  };
  visit(absoluteRoot);
  return out;
}

function callersOf(token: string): string[] {
  return [
    ...productionTypeScriptFiles('lib'),
    ...productionTypeScriptFiles('scripts'),
  ]
    .filter((file) => source(file).includes(token))
    .sort();
}

function runLegacyScript(
  script: string,
  args: string[] = [],
) {
  return spawnSync(
    process.execPath,
    [
      TSX,
      '--require',
      SHIM,
      path.join(REPO, script),
      ...args,
    ],
    {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        OPENAI_API_KEY: 'must-not-be-read',
        STORY_PROVIDER: 'anthropic',
      },
    },
  );
}

describe('legacy Visual Contract authoring boundary', () => {
  it('enumerates the only surviving compiler call sites and keeps provider ownership out of them', () => {
    expect(callersOf('compileBookVisualContract(')).toEqual([
      'lib/visual-contract-compiler/compileBookVisualContract.ts',
    ]);
    expect(
      callersOf('compileBookVisualContractTemplate('),
    ).toEqual([
      'lib/visual-contract-compiler/compileBookVisualContractTemplate.ts',
      'lib/visual-package/visualContractAuthoringLifecycle.ts',
      'scripts/compile-visual-contract-templates.ts',
    ]);

    const legacyCompiler = source(
      'lib/visual-contract-compiler/compileBookVisualContract.ts',
    );
    expect(legacyCompiler).not.toContain(
      'backend/providers/pipeline',
    );
    expect(legacyCompiler).not.toContain(
      'defaultContractLlmCaller',
    );

    const runtimeFreeze = source(
      'lib/generation-pipeline/ensure-frozen-visual-contract.ts',
    );
    expect(runtimeFreeze).not.toContain(
      'compileBookVisualContract',
    );
    expect(runtimeFreeze).not.toContain(
      'ENABLE_DYNAMIC_CONTRACT_COMPILE',
    );

    for (const script of [
      'scripts/compile-visual-contract-artifacts.ts',
      'scripts/calibrate-anat-visual-contract.ts',
      'scripts/compile-visual-contract-templates.ts',
    ]) {
      const body = source(script);
      for (const forbidden of [
        "from 'openai'",
        'OPENAI_API_KEY',
        'backend/providers/pipeline',
        'api.openai.com',
        'fetch(',
      ]) {
        expect(body, `${script} contains ${forbidden}`).not.toContain(
          forbidden,
        );
      }
    }
    expect(
      source('scripts/compile-visual-contract-templates.ts'),
    ).toContain('--fixture-draft');
  });

  it.each([
    {
      script:
        'scripts/compile-visual-contract-artifacts.ts',
      args: ['--sources', 'unused', '--out', 'unused'],
      blocker: 'legacy_visual_contract_authoring_disabled',
    },
    {
      script: 'scripts/calibrate-anat-visual-contract.ts',
      args: [],
      blocker:
        'legacy_visual_contract_calibration_disabled',
    },
    {
      script:
        'scripts/compile-visual-contract-templates.ts',
      args: [
        '--live',
        '--sources',
        'unused',
        '--out',
        'unused',
      ],
      blocker: 'legacy_live_authoring_disabled',
    },
  ])(
    '$script fails closed in a real subprocess before provider reachability',
    ({ script, args, blocker }) => {
      const result = runLegacyScript(script, args);
      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        blocker,
      );
      expect(result.signal).toBeNull();
    },
  );
});
