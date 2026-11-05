"""Exercise recovery with in-process fake executables; never write a real Git index."""
from pathlib import Path
import hashlib
import importlib.util
import json
import subprocess


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('m14_builder', HERE / 'build_package.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
CASES = {
    'normal': (0, 1, 1),
    'inspect_only': (0, 0, 0),
    'typescript_failure': (1, 0, 0),
    'foreign_index': (1, 0, 0),
    'pin_drift': (1, 0, 0),
    'wrong_head': (1, 0, 0),
    'resume_staged': (0, 0, 1),
    'resume_index_drift': (1, 0, 0),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    results = []
    for name, expected in CASES.items():
        root = HERE / 'synthetic-tmp' / 'recovery-transport' / name
        package = root / builder.FOLDER
        package.mkdir(parents=True, exist_ok=True)
        paths = ['lib/[synthetic]/sample.ts', 'REPORT.md']
        records = []
        for relative in paths:
            file = root / relative
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('// synthetic pinned content\n', encoding='utf-8')
            records.append({'path': relative, 'bytes': file.stat().st_size, 'sha256': sha(file)})
        (package / 'CHANGES.patch').write_text('synthetic patch checked only by fake transport\n', encoding='utf-8')
        (package / 'COMMIT-MESSAGE.txt').write_text('synthetic commit\n', encoding='utf-8')
        (package / 'PROD-PAYME-HOTFIX.patch').write_text('synthetic separate artifact\n', encoding='utf-8')
        recovery = package / 'RECOVER.ps1'
        recovery.write_text(builder.recovery(paths, ['synthetic.spec.ts'], root), encoding='utf-8')
        metadata = {'head': builder.BASE, 'branch': builder.BRANCH, 'files': records,
                    'patchSha256': sha(package / 'CHANGES.patch'), 'recoverySha256': sha(recovery),
                    'commitMessageSha256': sha(package / 'COMMIT-MESSAGE.txt'),
                    'preparedProductionPatchSha256': sha(package / 'PROD-PAYME-HOTFIX.patch')}
        (package / 'PINS.json').write_text(json.dumps(metadata), encoding='utf-8')
        if name == 'pin_drift':
            (root / paths[0]).write_text('changed\n', encoding='utf-8')
        harness = r'''
$ErrorActionPreference = 'Stop'
$global:syntheticCase = __CASE__
$global:syntheticPaths = @('lib/[synthetic]/sample.ts', 'REPORT.md')
$global:syntheticStaged = @()
if ($global:syntheticCase -eq 'foreign_index') { $global:syntheticStaged = @('foreign.ts') }
if ($global:syntheticCase -in @('resume_staged', 'resume_index_drift')) { $global:syntheticStaged = $global:syntheticPaths }
$global:syntheticCalls = [System.Collections.Generic.List[string]]::new()
$global:syntheticAdds = 0; $global:syntheticCommits = 0; $global:syntheticNpm = 0
function git {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$GitArguments)
  $global:LASTEXITCODE = 0
  $query = $GitArguments -join ' '
  $global:syntheticCalls.Add('git ' + $query)
  switch ($query) {
    'rev-parse HEAD' {
      if ($global:syntheticCommits -gt 0) { return ('a' * 40) }
      if ($global:syntheticCase -eq 'wrong_head') { return ('b' * 40) }
      return __BASE__
    }
    'branch --show-current' { return __BRANCH__ }
    'diff --cached --name-only' { return $global:syntheticStaged }
    'diff --name-only __BASE_RAW__' { return $global:syntheticPaths }
    'diff --check' { return }
    'diff --cached --check' { return }
    default {
      if ($query.StartsWith('diff --name-only -- ')) {
        if ($global:syntheticCase -eq 'resume_index_drift') { return 'REPORT.md' }; return
      }
      if ($query.StartsWith('ls-files --others --exclude-standard -- ')) { return $global:syntheticPaths }
      if ($query.StartsWith('apply --reverse --check ')) { return }
      if ($query.StartsWith('--literal-pathspecs add -- ')) {
        if ($GitArguments.Count -ne 5 -or $GitArguments[3] -cne $global:syntheticPaths[0] -or $GitArguments[4] -cne $global:syntheticPaths[1]) { throw 'Stage lost explicit literal paths.' }
        $global:syntheticAdds++; $global:syntheticStaged = $global:syntheticPaths; return
      }
      if ($query.StartsWith('commit --file ')) { $global:syntheticCommits++; return 'synthetic local commit' }
      if ($query.StartsWith('status --short --branch ')) { return 'synthetic clean branch' }
      throw ('Unexpected fake git request: ' + $query)
    }
  }
}
function node {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$NodeArguments)
  $global:syntheticCalls.Add('node ' + ($NodeArguments -join ' '))
  $global:LASTEXITCODE = 0
  if ($global:syntheticCase -eq 'typescript_failure' -and $NodeArguments[0] -eq 'node_modules/typescript/bin/tsc') { $global:LASTEXITCODE = 23 }
  Write-Output 'Synthetic tool output; no process or provider launched.'
}
function npm.cmd {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$NpmArguments)
  $global:syntheticNpm++; $global:syntheticCalls.Add('npm.cmd ' + ($NpmArguments -join ' '))
  $global:LASTEXITCODE = 1
  Write-Error 'Synthetic report-only stderr; must not terminate recovery.'
}
foreach ($name in @('git', 'node', 'npm.cmd')) { if ((Get-Command $name).CommandType -ne 'Function') { throw 'A real executable could be called.' } }
$outcome = 0; $errorText = $null
try {
  if ($global:syntheticCase -eq 'inspect_only') { & __SCRIPT__ -InspectOnly }
  elseif ($global:syntheticCase -in @('resume_staged', 'resume_index_drift')) { & __SCRIPT__ -ResumeStaged }
  else { & __SCRIPT__ }
} catch { $outcome = 1; $errorText = $_.Exception.Message }
$record = [ordered]@{ case = $global:syntheticCase; outcome = $outcome; adds = $global:syntheticAdds;
  commits = $global:syntheticCommits; npmCalls = $global:syntheticNpm; error = $errorText;
  calls = @($global:syntheticCalls); ownerRecord = (Test-Path -LiteralPath __OWNER__) }
[System.IO.File]::WriteAllText(__RESULT__, ($record | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
exit 0
'''
        replacements = {'CASE': builder.quote(name), 'BASE': builder.quote(builder.BASE),
                        'BASE_RAW': builder.BASE, 'BRANCH': builder.quote(builder.BRANCH),
                        'SCRIPT': builder.quote(recovery), 'OWNER': builder.quote(package / 'OWNER-COMMIT.json'),
                        'RESULT': builder.quote(root / 'transport-result.json')}
        for key, value in replacements.items():
            harness = harness.replace('__' + key + '__', value)
        runner = root / 'runner.ps1'
        runner.write_text(harness, encoding='utf-8')
        process = subprocess.run(['powershell.exe', '-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(runner)],
                                 cwd=root, capture_output=True)
        (root / 'transport.log').write_bytes(process.stdout + process.stderr)
        if process.returncode:
            raise RuntimeError(f'{name}: harness process failed; inspect transport.log')
        record = json.loads((root / 'transport-result.json').read_text('utf-8-sig'))
        actual = (record['outcome'], record['adds'], record['commits'])
        if actual != expected:
            raise AssertionError(f'{name}: {actual} != {expected}; {record}')
        if record['commits']:
            owner = json.loads((package / 'OWNER-COMMIT.json').read_text('utf-8-sig'))
            assert owner['npmReportOnlyExit'] == 1 and owner['head'] == 'a' * 40
            assert record['npmCalls'] == 1 and record['ownerRecord'] is True
        elif record['npmCalls']:
            raise AssertionError('Failed/inspect-only recovery reached npm')
        results.append(record)
    output = {'status': 'PASS', 'cases': len(results), 'realGitIndexWrites': 0,
              'realCommits': 0, 'realNativeTestTools': 0, 'externalCalls': 0,
              'limitation': 'Fake command transport validates recovery control flow; actual owner commit is still required.',
              'results': results}
    (HERE / 'RECOVERY-SIMULATION.json').write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'PASS', 'cases': len(results), 'realGitIndexWrites': 0, 'realCommits': 0}))


if __name__ == '__main__':
    main()
