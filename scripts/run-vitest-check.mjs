import { runRepositoryVitestCheck } from '../test-infrastructure/vitest-check-supervisor.mjs';

const args = process.argv.slice(2);
if (
  args.some((argument) => argument !== '--diagnostics') ||
  args.filter((argument) => argument === '--diagnostics').length > 1
) {
  process.stderr.write(
    '[small-heroes-vitest] {"schemaVersion":"small-heroes-vitest-cli-failure/v1","gateStatus":"failed","class":"invalid_argument"}\n',
  );
  process.exitCode = 1;
} else {
  const result = await runRepositoryVitestCheck({
    diagnostics: args.includes('--diagnostics'),
  });
  process.exitCode = result.exitCode;
}
