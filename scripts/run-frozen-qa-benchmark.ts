import fs from 'node:fs';
import path from 'node:path';
import { parse as parseEnv } from 'dotenv';
import { loadFrozenBenchmark, runFrozenBenchmark } from './lib/frozen-qa-benchmark';

async function main() {
  if (process.argv.length !== 4) throw Error('benchmark_arguments');
  const raw = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const roots = {local:path.resolve(__dirname,'../outputs'),archive:'C:/GNart/Work/Small_Heroes/outputs'};
  // All image/schema/prompt checks run before reading any credential file.
  loadFrozenBenchmark(raw,roots);
  const key = process.env.REPLICATE_API_TOKEN || parseEnv(fs.readFileSync(process.argv[3])).REPLICATE_API_TOKEN;
  if (!key?.trim()) throw Error('benchmark_key_missing');
  await runFrozenBenchmark({raw,roots,outputParent:roots.local,key});
}
main().catch(()=>{console.error('frozen_qa_benchmark_held');process.exitCode=1;});
