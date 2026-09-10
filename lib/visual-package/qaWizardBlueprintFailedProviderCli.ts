/** Strict request-file CLI. No credential loading here; execute delegates only
 * to the claimed lifecycle. Input owns neither repoRoot nor the write switch. */
import fs from 'node:fs';
import { resolveExistingContainedArtifact } from './qaWizardCandidateBridge';
import { advanceHistoricalSemanticProductionBridge } from './semanticCorrectionApprovalBridge';
import { prepareFailedProviderBlueprintSuccessor, authorizeFailedProviderBlueprintSuccessor,
  executeFailedProviderBlueprintSuccessor } from './qaWizardBlueprintAuthoringLifecycle';

export async function runFailedProviderBlueprintCli(args: {
  argv: readonly string[]; repoRoot: string; stdout: (line: string) => void; stderr: (line: string) => void;
}): Promise<number> {
  try {
    const [command, flag, requestPath, writeFlag, ...extra] = args.argv;
    if (!['advance', 'prepare', 'authorize', 'execute'].includes(command ?? '') || flag !== '--request' ||
        !requestPath || requestPath.startsWith('--') || extra.length ||
        (writeFlag !== undefined && writeFlag !== '--write') || (command === 'execute' && writeFlag !== '--write')) {
      throw new Error('usage');
    }
    const file = resolveExistingContainedArtifact({ repoRoot: args.repoRoot, relativePath: requestPath, label: 'failed provider operator request' });
    if (fs.statSync(file).size > 100_000) throw new Error('request_size');
    const request: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!request || typeof request !== 'object' || Array.isArray(request) ||
        ['repoRoot', 'consumerRepoRoot', 'write'].some(key => Object.prototype.hasOwnProperty.call(request, key))) throw new Error('request_authority');
    const write = writeFlag === '--write';
    if (command === 'advance') {
      const result = await advanceHistoricalSemanticProductionBridge({ ...request, consumerRepoRoot: args.repoRoot, write } as Parameters<typeof advanceHistoricalSemanticProductionBridge>[0]);
      args.stdout(JSON.stringify({ command, manifestPath: result.artifact.path, manifestDigest: result.manifest.digest, providerCalls: 0 }));
    } else if (command === 'prepare') {
      const result = await prepareFailedProviderBlueprintSuccessor({ ...request, repoRoot: args.repoRoot, write } as Parameters<typeof prepareFailedProviderBlueprintSuccessor>[0]);
      args.stdout(JSON.stringify({ command, candidatePath: result.candidatePath, candidateDigest: result.candidate.digest, providerCalls: 0 }));
    } else if (command === 'authorize') {
      const result = await authorizeFailedProviderBlueprintSuccessor({ ...request, repoRoot: args.repoRoot, write } as Parameters<typeof authorizeFailedProviderBlueprintSuccessor>[0]);
      args.stdout(JSON.stringify({ command, authorizationPath: result.authorizationPath, authorizationDigest: result.authorization.digest, providerCalls: 0 }));
    } else {
      const result = await executeFailedProviderBlueprintSuccessor({ ...request, repoRoot: args.repoRoot, write: true } as Parameters<typeof executeFailedProviderBlueprintSuccessor>[0]);
      args.stdout(JSON.stringify({ command, manifestPath: result.manifestPath, manifestDigest: result.manifest.digest,
        stage: result.manifest.stage, receiptDigest: result.receipt.digest, replayed: result.replayed }));
    }
    return 0;
  } catch {
    // Never serialize provider errors, malformed request contents or credentials.
    args.stderr('failed_provider_successor_command_rejected');
    return 1;
  }
}
