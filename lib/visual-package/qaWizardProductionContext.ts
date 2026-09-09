import fs from 'node:fs';
import path from 'node:path';
import { loadQaWizardApprovedProductionContext, resolveExistingContainedArtifact } from './qaWizardCandidateBridge';
import { loadSemanticProductionBridge, SEMANTIC_PRODUCTION_BRIDGE_VERSION } from './semanticCorrectionApprovalBridge';

/** Version dispatch only; each branch must independently reconstruct its authority.
 * No fallback after a semantic bridge rejects, and no caller-supplied context/proof. */
export async function loadQaWizardProductionContext(args: { repoRoot: string; bridgeManifestPath: string }) {
  const pinned = { ...args };
  const file = resolveExistingContainedArtifact({ repoRoot: pinned.repoRoot,
    relativePath: pinned.bridgeManifestPath, label: 'production bridge' });
  if (fs.statSync(file).size > 4_000_000) throw new Error('production_bridge_too_large');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (raw?.version === SEMANTIC_PRODUCTION_BRIDGE_VERSION) {
    const loaded = await loadSemanticProductionBridge({ consumerRepoRoot: pinned.repoRoot,
      manifestPath: pinned.bridgeManifestPath, expectedManifestDigest: path.posix.basename(pinned.bridgeManifestPath, '.json') });
    return { manifest: loaded.manifest, context: loaded.context };
  }
  return loadQaWizardApprovedProductionContext(pinned);
}
export type QaWizardProductionBridgeAuthority = Awaited<ReturnType<typeof loadQaWizardProductionContext>>['manifest'];
