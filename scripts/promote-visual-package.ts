#!/usr/bin/env tsx
/**
 * Explicit visual-package lifecycle tool. Default mode prepares a candidate manifest for human review/approval.
 * Supplying --approval validates it as a dry-run. Only --approval plus --promote writes approved artifacts.
 * No compiler, LLM, network, image provider, database, or deployment path is imported or reachable here.
 */
import path from 'path';

import {
  prepareVisualPackageCandidate,
  promoteVisualPackage,
  writePreparedCandidateManifest,
} from '@/lib/visual-package/promotion';
import { VisualPackageValidationError } from '@/lib/visual-package/types';

function value(argv: string[], name: string): string | undefined {
  const inline = argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function required(argv: string[], name: string): string {
  const result = value(argv, name);
  if (!result) throw new Error(`${name} is required`);
  return result;
}

function main(): void {
  const argv = process.argv.slice(2);
  const repoRoot = path.resolve(value(argv, '--repo-root') ?? process.cwd());
  const approval = value(argv, '--approval');
  const promote = argv.includes('--promote');
  if (promote && !approval) {
    throw new VisualPackageValidationError([
      { code: 'approval_missing', message: '--promote requires --approval <exact candidate manifest>' },
    ]);
  }

  if (!approval) {
    const prepared = prepareVisualPackageCandidate({
      repoRoot,
      storyKey: required(argv, '--story-key'),
      storyPath: required(argv, '--story-file'),
      candidateDir: required(argv, '--candidate-dir'),
      styleId: required(argv, '--style-id'),
      boardRegistryRoot: value(argv, '--board-registry'),
    });
    writePreparedCandidateManifest(prepared);
    console.log(`[visual-package] candidate manifest prepared: ${prepared.manifestPath}`);
    console.log('[visual-package] no approval and no promotion were performed; Guy must fill review + approval exactly.');
    return;
  }

  const result = promoteVisualPackage({
    repoRoot,
    approvalManifestPath: approval,
    approvedPackagesDir: value(argv, '--approved-packages-dir'),
    boardRegistryRoot: value(argv, '--board-registry'),
    write: promote,
  });
  console.log(`[visual-package] ${promote ? 'PROMOTED' : 'DRY-RUN PASS'}: ${result.approvedManifest.storyKey}`);
  console.log(`[visual-package] template: ${result.templateDestination}`);
  console.log(`[visual-package] reconciliation: ${result.reconciliationDestination}`);
  console.log(`[visual-package] manifest: ${result.manifestDestination}`);
}

try {
  main();
} catch (error) {
  if (error instanceof VisualPackageValidationError) {
    console.error(JSON.stringify({ pass: false, reasons: error.issues }, null, 2));
  } else {
    console.error(error);
  }
  process.exit(1);
}
