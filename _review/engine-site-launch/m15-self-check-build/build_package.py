"""Freeze the explicitly reviewed M15 scope; never write an index, commit, key or service."""
from pathlib import Path
import hashlib
import importlib.util
import json
import subprocess

ROOT = Path(__file__).resolve().parents[3]
FOLDER = '_review/engine-site-launch/m15-self-check-build'
BASE = '36bd62daf98cc73c1b3e49a2f3c3b23548d4bddd'
BRANCH = 'codex/engine-site-launch-20261104'
PROOF_FOLDER = '_review/engine-site-launch/m14-qa-r2-fixes'


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def recovery(paths, tests, root=ROOT, folder=FOLDER):
    values = {'ROOT': quote(root), 'FOLDER': quote(folder), 'BASE': quote(BASE), 'BRANCH': quote(BRANCH), 'PROOF_FOLDER': quote(PROOF_FOLDER),
              'PATHS': ', '.join(quote(p) for p in paths), 'TESTS': ', '.join(quote(t) for t in tests)}
    script = r'''# M15: explicit source paths, local gates and one commit only. No push/deploy/SQL/hotfix application.
param([switch]$InspectOnly, [switch]$ResumeStaged)
$ErrorActionPreference = 'Stop'
$taskRoot = __ROOT__
$taskPackage = __FOLDER__
$taskBase = __BASE__
$taskBranch = __BRANCH__
$taskProofPackage = __PROOF_FOLDER__
$taskPaths = @(__PATHS__)
$taskTests = @(__TESTS__)
if ([System.IO.Path]::GetFullPath((Get-Location).Path).TrimEnd('\') -ne $taskRoot.TrimEnd('\')) { throw 'Run from the exact assigned worktree root.' }
function Invoke-NativeChecked {
  param([string]$Executable, [string[]]$Arguments, [string]$Log, [switch]$ReportOnly)
  $taskOldPreference = $ErrorActionPreference; $taskOutput = @()
  $ErrorActionPreference = 'Continue'
  try {
    if ($Log) { & $Executable @Arguments *> $Log } else { $taskOutput = @(& $Executable @Arguments) }
    $taskCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $taskOldPreference }
  $script:taskLastNativeExit = $taskCode
  if ($Log) { Add-Content -LiteralPath $Log -Value "NATIVE_EXIT_CODE=$taskCode" }
  if ($taskCode -ne 0 -and -not $ReportOnly) { throw "$Executable failed with exit=$taskCode" }
  if ($ReportOnly) { Write-Output "Informational contract exit=$taskCode" }
  if (-not $Log) { return $taskOutput }
}
function File-Hash([string]$Path) {
  $taskHasher = [System.Security.Cryptography.SHA256]::Create()
  try { return [System.BitConverter]::ToString($taskHasher.ComputeHash([System.IO.File]::ReadAllBytes($Path))).Replace('-', '').ToLowerInvariant() }
  finally { $taskHasher.Dispose() }
}
function Same-Paths($Left, $Right) {
  return ((@($Left | Sort-Object) -join "`n") -ceq (@($Right | Sort-Object) -join "`n"))
}
$taskPins = [System.IO.File]::ReadAllText((Join-Path $taskRoot "$taskPackage/PINS.json")) | ConvertFrom-Json
if ($taskPins.head -ne $taskBase -or $taskPins.branch -ne $taskBranch) { throw 'Wrong package authority.' }
if (((Invoke-NativeChecked 'git' @('rev-parse', 'HEAD')) | Out-String).Trim() -ne $taskBase) { throw 'Unexpected HEAD; preserve the tree and obtain a new package.' }
if (((Invoke-NativeChecked 'git' @('branch', '--show-current')) | Out-String).Trim() -ne $taskBranch) { throw 'Wrong branch.' }
if (-not (Same-Paths @($taskPins.files | ForEach-Object { $_.path }) $taskPaths)) { throw 'Pin membership changed.' }
if (-not (Same-Paths @($taskPins.externalProofFiles | ForEach-Object { $_.path }) @("$taskProofPackage/PROD-PAYME-HOTFIX.patch", "$taskProofPackage/PROD-PAYME-HOTFIX.json", "$taskProofPackage/verify-production-hotfix.cjs"))) { throw 'Offline proof membership changed.' }
function Assert-WorkingPins {
  foreach ($pin in $taskPins.files) {
    $taskFullPath = [System.IO.Path]::GetFullPath((Join-Path $taskRoot $pin.path))
    if (-not $taskFullPath.StartsWith($taskRoot.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase) -or $pin.path -match '(^|/)\.env|(^|/)\.git(/|$)') { throw 'Unsafe pin path.' }
    if (([System.IO.FileInfo]$taskFullPath).Length -ne $pin.bytes -or (File-Hash $taskFullPath) -ne $pin.sha256) { throw "Source changed: $($pin.path)" }
  }
  foreach ($proof in $taskPins.externalProofFiles) {
    if ($proof.path -notin @("$taskProofPackage/PROD-PAYME-HOTFIX.patch", "$taskProofPackage/PROD-PAYME-HOTFIX.json", "$taskProofPackage/verify-production-hotfix.cjs") -or (File-Hash (Join-Path $taskRoot $proof.path)) -ne $proof.sha256) { throw 'Prepared offline proof changed.' }
  }
  if ((File-Hash (Join-Path $taskRoot "$taskPackage/CHANGES.patch")) -ne $taskPins.patchSha256) { throw 'Patch hash changed.' }
  if ((File-Hash (Join-Path $taskRoot "$taskPackage/RECOVER.ps1")) -ne $taskPins.recoverySha256) { throw 'Recovery script changed.' }
  if ((File-Hash (Join-Path $taskRoot "$taskPackage/COMMIT-MESSAGE.txt")) -ne $taskPins.commitMessageSha256) { throw 'Commit message changed.' }
  if ((File-Hash (Join-Path $taskRoot "$taskProofPackage/PROD-PAYME-HOTFIX.patch")) -ne $taskPins.preparedProductionPatchSha256) { throw 'Separate production patch changed.' }
}
Assert-WorkingPins
$taskStaged = @(Invoke-NativeChecked 'git' @('diff', '--cached', '--name-only'))
if ($ResumeStaged) {
  if (-not (Same-Paths $taskStaged $taskPaths)) { throw 'Resume requires exactly this package staged, without any other path.' }
  $taskIndexDrift = @(Invoke-NativeChecked 'git' (@('diff', '--name-only', '--') + $taskPaths))
  if ($taskIndexDrift.Count -ne 0) { throw 'Staged bytes differ from pinned working bytes.' }
} elseif ($taskStaged.Count -ne 0) { throw 'Existing index must be preserved; inspect it before any recovery.' }
$taskChanges = @(Invoke-NativeChecked 'git' @('diff', '--name-only', $taskBase))
if (@($taskChanges | Where-Object { $_ -notin $taskPaths }).Count -ne 0) { throw 'Unlisted tracked changes exist.' }
$taskExtra = @(Invoke-NativeChecked 'git' @('ls-files', '--others', '--exclude-standard', '--', 'app', 'lib', 'backend', 'scripts'))
if (@($taskExtra | Where-Object { $_ -notin $taskPaths }).Count -ne 0) { throw 'Unlisted untracked source exists.' }
Invoke-NativeChecked 'git' @('diff', '--check')
Invoke-NativeChecked 'git' @('diff', '--cached', '--check')
Invoke-NativeChecked 'git' @('apply', '--reverse', '--check', "$taskPackage/CHANGES.patch")
if ($InspectOnly) { Write-Output "M15 verified $($taskPaths.Count) paths; no tests, index mutation, commit or service action."; return }
$taskTemp = [System.IO.Path]::GetFullPath((Join-Path $taskRoot "$taskPackage/synthetic-tmp"))
if (-not $taskTemp.StartsWith($taskRoot.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test directory.' }
[System.IO.Directory]::CreateDirectory($taskTemp) > $null
[System.IO.File]::WriteAllText((Join-Path $taskTemp '.gitignore'), "*`n")
$taskOldTemp = $env:TEMP; $taskOldTmp = $env:TMP
try {
  $env:TEMP = $taskTemp; $env:TMP = $taskTemp
  Invoke-NativeChecked 'node' @('node_modules/typescript/bin/tsc', '--noEmit') -Log "$taskPackage/owner-typescript.log"
  Invoke-NativeChecked 'node' (@('node_modules/vitest/vitest.mjs', 'run') + $taskTests) -Log "$taskPackage/owner-focused.log"
  Invoke-NativeChecked 'node' @("$taskProofPackage/verify-production-hotfix.cjs") -Log "$taskPackage/owner-hotfix-proof.log"
  Invoke-NativeChecked 'npm.cmd' @('run', 'check') -ReportOnly -Log "$taskPackage/owner-npm-check.log"
  $taskNpmExit = $script:taskLastNativeExit
} finally { $env:TEMP = $taskOldTemp; $env:TMP = $taskOldTmp }
Assert-WorkingPins
if (-not $ResumeStaged) {
  if (@(Invoke-NativeChecked 'git' @('diff', '--cached', '--name-only')).Count -ne 0) { throw 'Index changed during gates; preserve it.' }
  Invoke-NativeChecked 'git' (@('--literal-pathspecs', 'add', '--') + $taskPaths)
}
$taskStaged = @(Invoke-NativeChecked 'git' @('diff', '--cached', '--name-only'))
if (-not (Same-Paths $taskStaged $taskPaths)) { throw 'Staged paths do not exactly match this package.' }
Invoke-NativeChecked 'git' @('diff', '--cached', '--check')
Invoke-NativeChecked 'git' @('commit', '--file', "$taskPackage/COMMIT-MESSAGE.txt")
$taskNewHead = ((Invoke-NativeChecked 'git' @('rev-parse', 'HEAD')) | Out-String).Trim()
$taskCommit = [ordered]@{ baseHead = $taskBase; head = $taskNewHead; branch = $taskBranch; patchSha256 = $taskPins.patchSha256;
  paths = $taskPaths; typescriptExit = 0; focusedExit = 0; hotfixProofExit = 0; npmReportOnlyExit = $taskNpmExit; recordedAt = [DateTime]::UtcNow.ToString('o') }
[System.IO.File]::WriteAllText((Join-Path $taskRoot "$taskPackage/OWNER-COMMIT.json"), ($taskCommit | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
Invoke-NativeChecked 'git' @('status', '--short', '--branch', '--untracked-files=no')
Write-Output "M15 local commit=$taskNewHead. No push/merge/deploy/SQL/hotfix application occurred."
'''
    for key, value in values.items():
        script = script.replace('__' + key + '__', value)
    return script


def main():
    folder = ROOT / FOLDER
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if head != BASE:
        raise RuntimeError('Base HEAD changed; do not refreeze a different scope silently')
    paths = json.loads((folder / 'SCOPE.json').read_text('utf-8-sig'))
    tests = json.loads((folder / 'FOCUSED-TESTS.json').read_text('utf-8-sig'))
    tracked = set(subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf-8').split('\0'))
    for name in paths:
        file = ROOT / name
        data = file.read_bytes().replace(b'\r\n', b'\n')
        if name not in tracked and (data.endswith(b'\n\n') or any(line.rstrip(b' \t') != line for line in data.splitlines())):
            raise RuntimeError('EOF/trailing whitespace must be corrected before freezing: ' + name)
    spec = importlib.util.spec_from_file_location('recovery_package', ROOT / '_review/engine-site-launch/recovery_package.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    message = ('fix(launch): preserve delivered books on late infrastructure faults\n\n'
               'Fence free recovery under the existing Order lock after confirmed delivery.\n'
               'Retain explicit refund/revocation authority and all acceptance/accounting gates.\n'
               'Add adversarial exception and infrastructure-action controls.\n'
               'Record guarded Windows build failures and partial NFT evidence, and prepare\n'
               'one-book paid-test and production PayMe owner runbooks.\n'
               'USD 0, default-off; independent whole-surface re-gate remains pending.')
    metadata = module.freeze(FOLDER, paths, tests, message)
    script_path = folder / 'RECOVER.ps1'
    script_path.write_text(recovery(paths, tests), 'utf-8')
    metadata['recoverySha256'] = hashlib.sha256(script_path.read_bytes()).hexdigest()
    metadata['commitMessageSha256'] = hashlib.sha256((folder / 'COMMIT-MESSAGE.txt').read_bytes()).hexdigest()
    metadata['qaR2ReportSha256'] = hashlib.sha256((ROOT / '_review/engine-site-launch/claude-qa-r2/CLAUDE-QA-R2-REPORT.md').read_bytes()).hexdigest()
    metadata['singleMilestone'] = 'M15'
    metadata['productionHotfixPrepareOnly'] = True
    metadata['preparedProductionPatchSha256'] = hashlib.sha256((ROOT / PROOF_FOLDER / 'PROD-PAYME-HOTFIX.patch').read_bytes()).hexdigest()
    metadata['preparedProductionPatchStaged'] = False
    metadata['externalProofFiles'] = [{'path': PROOF_FOLDER + '/' + name, 'sha256': hashlib.sha256((ROOT / PROOF_FOLDER / name).read_bytes()).hexdigest()} for name in ['PROD-PAYME-HOTFIX.patch', 'PROD-PAYME-HOTFIX.json', 'verify-production-hotfix.cjs']]
    (folder / 'PINS.json').write_text(json.dumps(metadata, indent=2) + '\n', 'utf-8')
    print(json.dumps({'package': FOLDER, 'baseHead': BASE, 'pins': len(paths), 'patchSha256': metadata['patchSha256']}))


if __name__ == '__main__':
    main()
