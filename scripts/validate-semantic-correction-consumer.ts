import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { validateSemanticCorrectionForCurrentConsumer } from '../lib/visual-package/semanticCorrectionConsumerValidation';

async function main() {
  const { values, tokens } = parseArgs({ options: { request: { type: 'string' } },
    strict: true, allowPositionals: false, tokens: true });
  if (!values.request || tokens.length !== 1) throw new Error('request_required_once');
  const stat = fs.lstatSync(values.request);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32_000) throw new Error('request_invalid');
  const result = await validateSemanticCorrectionForCurrentConsumer(JSON.parse(fs.readFileSync(values.request, 'utf8')));
  process.stdout.write(JSON.stringify({ status: 'validated', proof: result.proof }) + '\n');
}
main().catch(() => {
  process.stdout.write(JSON.stringify({ status: 'rejected', providerCalls: 0, zeroWrite: true }) + '\n');
  process.exitCode = 1;
});
