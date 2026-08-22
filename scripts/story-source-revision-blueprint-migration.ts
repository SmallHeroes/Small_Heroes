/**
 * Offline-only Story Source revision reconciliation/Blueprint lifecycle.
 *
 * No provider, image, storage, database or deployment implementation is
 * imported or reachable. The final command can atomically advance the exact
 * reviewed local Visual Package locator after immutable publication preflight.
 */
import {
  publishStorySourceRevisionPackage,
  prepareStorySourceRevisionPackageAssembly,
  prepareStorySourceRevisionBlueprintMigration,
  recordStorySourceRevisionPackageApproval,
  recordStorySourceRevisionBlueprintApproval,
  recordStorySourceRevisionReconciliationApproval,
} from '@/lib/visual-package/storySourceRevisionBlueprintMigrationLifecycle';

const APPROVAL_FLAGS = new Set([
  '--repo-root',
  '--manifest',
  '--reconciliation-digest',
  '--review-digest',
  '--approved-by',
  '--approved-at',
  '--write',
]);
const BLUEPRINT_FLAGS = new Set([
  '--repo-root',
  '--approval',
  '--write',
]);
const BLUEPRINT_APPROVAL_FLAGS = new Set([
  '--repo-root',
  '--manifest',
  '--blueprint-digest',
  '--review-digest',
  '--approved-by',
  '--approved-at',
  '--write',
]);
const PACKAGE_ASSEMBLY_FLAGS = new Set([
  '--repo-root',
  '--manifest',
  '--blueprint-approval',
  '--write',
]);
const PACKAGE_APPROVAL_FLAGS = new Set([
  '--repo-root',
  '--manifest',
  '--candidate-digest',
  '--review-digest',
  '--approved-by',
  '--approved-at',
  '--write',
]);
const PACKAGE_PUBLICATION_FLAGS = new Set([
  '--repo-root',
  '--manifest',
  '--package-approval',
  '--published-at',
  '--write',
]);

function parseFlags(tokens: string[], allowed: ReadonlySet<string>): Map<string, string> {
  if (tokens.length % 2 !== 0) throw new Error('every flag requires one value');
  const values = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag || !value || !allowed.has(flag) || flag.includes('=') || value.startsWith('--')) {
      throw new Error(`unknown or malformed flag: ${flag ?? '<missing>'}`);
    }
    if (values.has(flag)) throw new Error(`duplicate flag: ${flag}`);
    values.set(flag, value);
  }
  return values;
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) throw new Error(`missing required flag: ${key}`);
  return value;
}

function writeValue(values: ReadonlyMap<string, string>): boolean {
  const value = required(values, '--write');
  if (value !== 'true' && value !== 'false') {
    throw new Error('--write must be exact true or false');
  }
  return value === 'true';
}

async function main(): Promise<void> {
  const [command, ...tokens] = process.argv.slice(2);
  if (command === 'approve-reconciliation') {
    const values = parseFlags(tokens, APPROVAL_FLAGS);
    const approvedBy = required(values, '--approved-by');
    if (approvedBy !== 'Guy') {
      throw new Error('--approved-by must be exact value Guy');
    }
    const result = recordStorySourceRevisionReconciliationApproval({
      repoRoot: required(values, '--repo-root'),
      pendingManifestPath: required(values, '--manifest'),
      pendingReconciliationDigest: required(values, '--reconciliation-digest'),
      pendingReviewBundleDigest: required(values, '--review-digest'),
      approvedBy,
      approvedAt: required(values, '--approved-at'),
      write: writeValue(values),
    });
    process.stdout.write(`${JSON.stringify({
      mode: 'story_source_revision_reconciliation_approval',
      approvalDigest: result.approval.digest,
      approvalPath: result.approvalPath,
      approvedReconciliationDigest:
        result.approval.approvedReview.reconciliationDigest,
      approvedReviewBundleDigest: result.approval.approvedReview.reviewBundleDigest,
      created: result.artifacts.approvalCreated,
      boundaryEvidence: {
        credentialAccess: 'none',
        providerCalls: 0,
        imageCalls: 0,
        networkCalls: 0,
        databaseWrites: 0,
        storageWrites: 0,
        locatorWrites: 0,
      },
    }, null, 2)}\n`);
    return;
  }
  if (command === 'prepare-blueprint') {
    const values = parseFlags(tokens, BLUEPRINT_FLAGS);
    const result = await prepareStorySourceRevisionBlueprintMigration({
      repoRoot: required(values, '--repo-root'),
      approvalPath: required(values, '--approval'),
      write: writeValue(values),
    });
    process.stdout.write(`${JSON.stringify({
      mode: 'story_source_revision_offline_blueprint_prepare',
      manifestDigest: result.manifest.digest,
      manifestPath: result.manifestPath,
      productionContextDigest: result.context.digest,
      blueprintDigest: result.authored.blueprint.digest,
      authoringAuthorityDigest:
        result.authored.blueprint.identity.authoringAuthority.digest,
      reviewPacketDigest: result.manifest.blueprint.reviewPacketDigest,
      changedFrameIds: result.manifest.blueprint.changedFrameIds,
      created: result.persisted?.candidate.created ?? false,
      boundaryEvidence: {
        credentialAccess: 'none',
        providerCalls: 0,
        imageCalls: 0,
        networkCalls: 0,
        databaseWrites: 0,
        storageWrites: 0,
        locatorWrites: 0,
      },
    }, null, 2)}\n`);
    return;
  }
  if (command === 'approve-blueprint') {
    const values = parseFlags(tokens, BLUEPRINT_APPROVAL_FLAGS);
    const approvedBy = required(values, '--approved-by');
    if (approvedBy !== 'Guy') {
      throw new Error('--approved-by must be exact value Guy');
    }
    const result = recordStorySourceRevisionBlueprintApproval({
      repoRoot: required(values, '--repo-root'),
      blueprintMigrationManifestPath: required(values, '--manifest'),
      blueprintDigest: required(values, '--blueprint-digest'),
      reviewPacketDigest: required(values, '--review-digest'),
      approvedBy,
      approvedAt: required(values, '--approved-at'),
      write: writeValue(values),
    });
    process.stdout.write(`${JSON.stringify({
      mode: 'story_source_revision_blueprint_approval',
      blueprintMigrationManifestDigest: result.manifest.digest,
      blueprintDigest: result.approval.blueprintDigest,
      reviewPacketDigest: result.approval.reviewPacketDigest,
      approvalDigest: result.approval.digest,
      approvalPath: result.approvalPath,
      created: result.created,
      boundaryEvidence: {
        credentialAccess: 'none',
        providerCalls: 0,
        imageCalls: 0,
        networkCalls: 0,
        databaseWrites: 0,
        storageWrites: 0,
        locatorWrites: 0,
      },
    }, null, 2)}\n`);
    return;
  }
  if (command === 'assemble-package') {
    const values = parseFlags(tokens, PACKAGE_ASSEMBLY_FLAGS);
    const result = prepareStorySourceRevisionPackageAssembly({
      repoRoot: required(values, '--repo-root'),
      blueprintMigrationManifestPath: required(values, '--manifest'),
      blueprintApprovalPath: required(values, '--blueprint-approval'),
      write: writeValue(values),
    });
    process.stdout.write(`${JSON.stringify({
      mode: 'story_source_revision_package_assembly',
      manifestDigest: result.manifest.digest,
      manifestPath: result.manifestPath,
      candidateDigest: result.candidate.digest,
      candidatePath: result.manifest.package.candidatePath,
      reviewDigest: result.packageReview.digest,
      reviewPath: result.manifest.package.reviewPath,
      qualificationDigest: result.qualification.digest,
      qualificationReasonCodes: result.manifest.package.qualificationReasonCodes,
      readyForApproval: result.manifest.package.readyForApproval,
      boardCount: result.manifest.authorityReuse.boardCount,
      propReferenceCount: result.manifest.authorityReuse.propReferenceCount,
      wrote: result.persisted?.wrote ?? false,
      boundaryEvidence: {
        credentialAccess: 'none',
        providerCalls: 0,
        imageCalls: 0,
        networkCalls: 0,
        databaseWrites: 0,
        storageWrites: 0,
        locatorWrites: 0,
      },
    }, null, 2)}\n`);
    return;
  }
  if (command === 'approve-package') {
    const values = parseFlags(tokens, PACKAGE_APPROVAL_FLAGS);
    const approvedBy = required(values, '--approved-by');
    if (approvedBy !== 'Guy') {
      throw new Error('--approved-by must be exact value Guy');
    }
    const result = recordStorySourceRevisionPackageApproval({
      repoRoot: required(values, '--repo-root'),
      packageAssemblyManifestPath: required(values, '--manifest'),
      packageCandidateDigest: required(values, '--candidate-digest'),
      packageReviewDigest: required(values, '--review-digest'),
      approvedBy,
      approvedAt: required(values, '--approved-at'),
      write: writeValue(values),
    });
    process.stdout.write(`${JSON.stringify({
      mode: 'story_source_revision_package_approval',
      packageAssemblyManifestDigest: result.assemblyManifest.digest,
      candidateDigest: result.approval.packageCandidateDigest,
      reviewDigest: result.approval.packageReviewDigest,
      approvalDigest: result.approval.digest,
      approvalPath: result.approvalPath,
      created: result.created,
      boundaryEvidence: {
        credentialAccess: 'none',
        providerCalls: 0,
        imageCalls: 0,
        networkCalls: 0,
        databaseWrites: 0,
        storageWrites: 0,
        locatorWrites: 0,
      },
    }, null, 2)}\n`);
    return;
  }
  if (command === 'publish-package') {
    const values = parseFlags(tokens, PACKAGE_PUBLICATION_FLAGS);
    const result = publishStorySourceRevisionPackage({
      repoRoot: required(values, '--repo-root'),
      packageAssemblyManifestPath: required(values, '--manifest'),
      packageApprovalPath: required(values, '--package-approval'),
      publishedAt: required(values, '--published-at'),
      write: writeValue(values),
    });
    process.stdout.write(`${JSON.stringify({
      mode: 'story_source_revision_package_publication',
      manifestDigest: result.manifest.digest,
      manifestPath: result.manifestPath,
      approvalDigest: result.approval.digest,
      revisionDigest: result.packageValue.revisionDigest,
      packagePath: result.packagePath,
      locatorPath: result.locatorPath,
      locatorChanged: result.locatorChanged,
      manifestCreated: result.manifestCreated,
      boundaryEvidence: {
        credentialAccess: 'none',
        providerCalls: 0,
        imageCalls: 0,
        networkCalls: 0,
        databaseWrites: 0,
        storageWrites: 0,
        locatorWrites: result.locatorChanged ? 1 : 0,
      },
    }, null, 2)}\n`);
    return;
  }
  throw new Error(
    'usage: approve-reconciliation|prepare-blueprint|approve-blueprint|assemble-package|approve-package|publish-package with exact key/value flags',
  );
}

main().catch((error) => {
  const attempts =
    typeof error === 'object' &&
    error !== null &&
    'attempts' in error &&
    Array.isArray((error as { attempts?: unknown }).attempts)
      ? (error as { attempts: Array<{ attempt?: unknown; errors?: unknown }> }).attempts
      : null;
  process.stderr.write(`${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    ...(attempts
      ? {
          attempts: attempts.map((attempt) => ({
            attempt: attempt.attempt,
            errors: Array.isArray(attempt.errors) ? attempt.errors : [],
          })),
        }
      : {}),
  }, null, 2)}\n`);
  process.exitCode = 1;
});
