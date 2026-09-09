import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { recordSemanticCorrectionApproval, prepareSemanticCorrectionBridge, loadSemanticCorrectionBridge } from '../lib/visual-package/semanticCorrectionApprovalBridge';

async function main() {
  const { values, tokens } = parseArgs({ options: { request: { type: 'string' } }, strict: true, allowPositionals: false, tokens: true });
  if (!values.request || tokens.length !== 1) throw new Error('request_required_once');
  const stat = fs.lstatSync(values.request);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32_000) throw new Error('request_invalid');
  const input = JSON.parse(fs.readFileSync(values.request, 'utf8'));
  if (!input || Object.keys(input).sort().join('|') !== 'arguments|operation') throw new Error('request_invalid');
  if (input.operation === 'approve') {
    const result = await recordSemanticCorrectionApproval(input.arguments);
    process.stdout.write(JSON.stringify({ status: 'semantic_approval_only', approval: result.approval, artifact: result.artifact, providerCalls: 0 }) + '\n');
  } else if (input.operation === 'prepare-bridge') {
    const result = await prepareSemanticCorrectionBridge(input.arguments);
    process.stdout.write(JSON.stringify({ status: 'reconciliation_pending', digest: result.manifest.digest, artifact: result.artifact, providerCalls: 0 }) + '\n');
  } else if (input.operation === 'read-bridge') {
    const result = await loadSemanticCorrectionBridge(input.arguments);
    process.stdout.write(JSON.stringify({ status: 'reconciliation_pending', digest: result.manifest.digest, providerCalls: 0 }) + '\n');
  } else throw new Error('operation_invalid');
}
main().catch(() => { process.stdout.write(JSON.stringify({ status: 'rejected', providerCalls: 0 }) + '\n'); process.exitCode = 1; });
