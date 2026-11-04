"""Build the owner's final split-commit recovery. Reads Git only; never stages/commits/executes RECOVER."""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = '_review/engine-site-launch/m12-phase1-final'
FOLDER = ROOT / PACKAGE
MILESTONES = [
    ('M07', 'm07-personal-orders', 'feat(launch): introduce personal order boundaries and evidence'),
    ('M08', 'm08-private-assets', 'feat(launch): add private asset intake and ownership boundaries'),
    ('M09', 'm09-personal-worker', 'feat(launch): add durable personal engine and resume boundaries'),
    ('M10', 'm10-reader-materialization', 'feat(launch): connect private reader and materialization boundaries'),
    ('M11', 'm11-acceptance-delivery', 'feat(launch): finish acceptance operator delivery and refund authority'),
]
BASE = '348c85dc213f85597eb484d05e68e9048edb5603'


def sha(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ownership():
    versions = {}
    snapshots = {}
    for name, directory, _ in MILESTONES:
        pin = json.loads((ROOT / '_review/engine-site-launch' / directory / 'PINS.json').read_text('utf-8'))
        if pin['head'] != BASE:
            raise ValueError('milestone_base_changed:' + name)
        snapshots[name] = pin
        for record in pin['files']:
            entries = versions.setdefault(record['path'], [])
            if not entries or entries[-1]['sha256'] != record['sha256']:
                entries.append({'milestone': name, 'sha256': record['sha256']})
    final_paths = {f['path'] for f in snapshots['M11']['files']}
    extras = [f'{PACKAGE}/{name}' for name in ['REPORT.md', 'DECISION-GATE.md', 'build_final_package.py', 'COMMIT-ALLOCATION.json']]
    for name, _, title in MILESTONES:
        message = f'{title} ({name})\n\nFinal-path allocation from base348c85dc. Later shared-path edits are committed with the later milestone.\n'
        message += 'Gates use the complete unchanged pinned worktree, not an isolated intermediate commit tree.\n'
        message += 'USD0 synthetic implementation evidence only. LOW/59ILS/0.70 fixed; no activation, provider, service, push, merge or deployment approval.\n'
        file = f'{PACKAGE}/COMMIT-MESSAGE-{name}.txt'
        (ROOT / file).write_text(message, encoding='utf-8')
        extras.append(file)
    final_paths.update(extras)
    groups = {name: [] for name, _, _ in MILESTONES}
    history = []
    for path in sorted(final_paths):
        entries = versions.get(path, [])
        if entries and sha(ROOT / path) != entries[-1]['sha256']:
            raise ValueError('final_bytes_drifted_after_M11:' + path)
        owner = entries[-1]['milestone'] if entries else 'M11'
        groups[owner].append(path)
        history.append({'path': path, 'owner': owner, 'changedIn': [entry['milestone'] for entry in entries] or ['M12_final_handoff_to_M11'],
                        'overlapAssignedLater': len(entries) > 1})
    allocated = [p for paths in groups.values() for p in paths]
    if len(allocated) != len(set(allocated)) or set(allocated) != final_paths or any(not v for v in groups.values()):
        raise ValueError('allocation_not_disjoint_complete_nonempty')
    stage_tests = {
        'M07': ['lib/engine-site/__tests__/personal-orders.spec.ts', 'lib/engine-site/__tests__/checkout-boundary.spec.ts', 'lib/engine-site/__tests__/offer.spec.ts'],
        'M08': ['lib/engine-site/__tests__/private-assets.spec.ts', 'lib/engine-site/__tests__/personal-orders.spec.ts'],
        'M09': ['lib/engine-site/__tests__/durable-worker.spec.ts', 'lib/engine-site/__tests__/provider-plans.spec.ts', 'lib/engine-site/__tests__/worker-entry.spec.ts',
                'lib/personal-wizard/__tests__/simple-story-source.spec.ts', 'lib/personal-wizard/__tests__/story-momentum-roles.spec.ts', 'lib/personal-wizard/__tests__/simple-book-reviewed-audition.spec.ts'],
        'M10': ['lib/engine-site/__tests__/materialization.spec.ts', 'lib/engine-site/__tests__/reader-bindings.spec.ts', 'lib/__tests__/reader-narration-src.spec.ts', 'lib/__tests__/reader-artwork-fit.spec.ts'],
        'M11': snapshots['M11']['tests'],
    }
    allocation = {'baseHead': BASE, 'branch': 'codex/engine-site-launch-20261104',
                  'semantics': 'final bytes; last changed milestone owns overlap; intermediate commits require complete pinned worktree',
                  'fullContract': 'one shared npm run check against unchanged final source, report only; per-commit tsc and focused tests',
                  'groups': [{'milestone': name, 'paths': groups[name], 'tests': stage_tests[name], 'commitMessage': f'{PACKAGE}/COMMIT-MESSAGE-{name}.txt'} for name, _, _ in MILESTONES],
                  'ownership': history}
    (FOLDER / 'COMMIT-ALLOCATION.json').write_text(json.dumps(allocation, indent=2) + '\n', encoding='utf-8')
    return final_paths, allocation, snapshots


SCRIPT = r'''param([switch]$InspectOnly, [switch]$Resume)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
if ($taskRoot.TrimEnd('\') -ne 'C:\GNart\Work\sh-engine-site-launch') { throw 'Wrong worktree: this recovery is scoped to sh-engine-site-launch.' }
Set-Location -LiteralPath $taskRoot
$taskPackage = '_review/engine-site-launch/m12-phase1-final'
$taskPins = Get-Content -LiteralPath "$taskPackage/PINS.json" -Raw | ConvertFrom-Json
function Invoke-NativeChecked {
  param([string]$Executable, [string[]]$Arguments, [switch]$ReportOnly, [string]$Log)
  $taskPreviousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $taskNativeOutput = & $Executable @Arguments 2>&1
    $taskNativeCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $taskPreviousPreference }
  if ($Log) { $taskNativeOutput | Out-File -LiteralPath $Log -Encoding utf8; Add-Content -LiteralPath $Log -Value "NATIVE_EXIT=$taskNativeCode" }
  else { $taskNativeOutput | ForEach-Object { Write-Output "$_" } }
  if ($taskNativeCode -ne 0 -and -not $ReportOnly) { throw "Native command failed ($taskNativeCode): $Executable $($Arguments -join ' ')" }
  if ($ReportOnly) { Write-Output "Report-only $Executable exit=$taskNativeCode (see $Log)" }
}
function Read-Git {
  param([string[]]$Arguments)
  $taskOldPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $taskLines = & git --no-optional-locks @Arguments 2>&1
    $taskGitCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $taskOldPreference }
  if ($taskGitCode -ne 0) { throw "Git inspection failed ($taskGitCode): $($Arguments -join ' ')" }
  # Permission warnings from an unrelated user-level ignore file are not object/path output.
  return @($taskLines | ForEach-Object { "$_" } | Where-Object { $_ -notmatch '^warning:' })
}
function Assert-FinalPins {
  foreach ($taskFile in $taskPins.files) {
    $taskAbsolute = [IO.Path]::GetFullPath((Join-Path $taskRoot $taskFile.path))
    if (-not $taskAbsolute.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe pin path: $($taskFile.path)" }
    if (-not (Test-Path -LiteralPath $taskAbsolute -PathType Leaf)) { throw "Missing final source: $($taskFile.path)" }
    $taskInfo = Get-Item -LiteralPath $taskAbsolute
    if ($taskInfo.Length -ne $taskFile.bytes -or (Get-FileHash -Algorithm SHA256 -LiteralPath $taskAbsolute).Hash.ToLowerInvariant() -ne $taskFile.sha256) { throw "Final source drift: $($taskFile.path)" }
  }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath "$taskPackage/CHANGES.patch").Hash.ToLowerInvariant() -ne $taskPins.patchSha256) { throw 'Cumulative patch hash mismatch.' }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath "$taskPackage/RECOVER.ps1").Hash.ToLowerInvariant() -ne $taskPins.recoverySha256) { throw 'Recovery script hash mismatch.' }
}
function Assert-EmptyIndex {
  $taskStaged = @(Read-Git @('diff','--cached','--name-only'))
  if ($taskStaged.Count -ne 0) { throw 'Index is not empty; preserve/reconcile existing staged changes before recovery.' }
}
if (@(Read-Git @('branch','--show-current'))[0] -ne $taskPins.branch) { throw 'Wrong branch.' }
Assert-FinalPins
$taskAllocation = Get-Content -LiteralPath "$taskPackage/COMMIT-ALLOCATION.json" -Raw | ConvertFrom-Json
$taskSeen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
$taskExpectedMilestones = @('M07','M08','M09','M10','M11')
for ($taskGroupIndex=0; $taskGroupIndex -lt $taskAllocation.groups.Count; $taskGroupIndex++) {
  $taskGroup = $taskAllocation.groups[$taskGroupIndex]
  if ($taskGroup.milestone -ne $taskExpectedMilestones[$taskGroupIndex]) { throw 'Milestone order drift.' }
  foreach ($taskPath in $taskGroup.paths) { if (-not $taskSeen.Add([string]$taskPath)) { throw "Overlapping commit path: $taskPath" } }
}
if ($taskSeen.Count -ne $taskPins.files.Count -or @($taskPins.files | Where-Object { -not $taskSeen.Contains([string]$_.path) }).Count -ne 0) { throw 'Commit allocation does not exactly cover final source pins.' }
$taskCurrentHead = @(Read-Git @('rev-parse','HEAD'))[0]
$taskCompleted = @()
if ($Resume -and (Test-Path -LiteralPath "$taskPackage/OWNER-COMMITS.json")) {
  foreach ($taskRecord in (Get-Content -LiteralPath "$taskPackage/OWNER-COMMITS.json" -Raw | ConvertFrom-Json)) { $taskCompleted += $taskRecord }
  $taskPreviousHead = [string]$taskPins.head
  for ($taskIndex=0; $taskIndex -lt $taskCompleted.Count; $taskIndex++) {
    $taskDone = $taskCompleted[$taskIndex]; $taskExpected = $taskAllocation.groups[$taskIndex]
    if ($taskDone.milestone -ne $taskExpected.milestone -or @(Read-Git @('rev-parse',"$($taskDone.head)~1"))[0] -ne $taskPreviousHead) { throw 'Recovery commit transcript does not match this branch chain.' }
    $taskDonePaths = @(Read-Git @('diff-tree','--no-commit-id','--name-only','-r',[string]$taskDone.head))
    if (@(Compare-Object @($taskExpected.paths | Sort-Object) @($taskDonePaths | Sort-Object)).Count -ne 0) { throw 'A completed commit has different paths from its allocation.' }
    foreach ($taskPath in $taskDonePaths) {
      $taskCommittedBlob = @(Read-Git @('rev-parse',"$($taskDone.head):$taskPath"))[0]
      $taskFinalBlob = @(Read-Git @('hash-object','--path',[string]$taskPath,[string]$taskPath))[0]
      if ($taskCommittedBlob -ne $taskFinalBlob) { throw "A completed commit has stale source bytes: $taskPath" }
    }
    $taskPreviousHead = [string]$taskDone.head
  }
  if ($taskCurrentHead -ne $taskPreviousHead) { throw 'HEAD is not the last verified recovery commit.' }
} elseif ($taskCurrentHead -ne $taskPins.head) { throw 'HEAD differs from final base. Use -Resume only for an exact verified OWNER-COMMITS transcript.' }
function Assert-CurrentIndex {
  param($Group)
  $taskStaged = @(Read-Git @('diff','--cached','--name-only'))
  if ($taskStaged.Count -eq 0) { return }
  if (-not $Resume -or -not $Group -or @(Compare-Object @($Group.paths | Sort-Object) @($taskStaged | Sort-Object)).Count -ne 0) { throw 'Unrelated or unexpected staged changes: preserve/reconcile before recovery.' }
  foreach ($taskPath in $taskStaged) {
    $taskIndexBlob = @(Read-Git @('rev-parse',":$taskPath"))[0]
    $taskFinalBlob = @(Read-Git @('hash-object','--path',[string]$taskPath,[string]$taskPath))[0]
    if ($taskIndexBlob -ne $taskFinalBlob) { throw "Staged content differs from final pins: $taskPath" }
  }
}
$taskNextGroup = if ($taskCompleted.Count -lt $taskAllocation.groups.Count) { $taskAllocation.groups[$taskCompleted.Count] } else { $null }
Assert-CurrentIndex $taskNextGroup
Invoke-NativeChecked 'git' @('diff','--check')
Invoke-NativeChecked 'git' @('apply','--reverse','--check',"$taskPackage/CHANGES.patch")
Write-Output 'Final pins verified. Overlapping paths belong to their last changed milestone. Gates use the FULL final worktree; intermediate commits are not isolated build snapshots.'
foreach ($taskGroup in $taskAllocation.groups) { Write-Output "$($taskGroup.milestone): $($taskGroup.paths.Count) explicit nonoverlapping paths" }
if ($InspectOnly) { Write-Output 'InspectOnly completed: no tests, index write, commit, push or service action.'; exit 0 }
Invoke-NativeChecked 'git' @('worktree','list','--porcelain')
Invoke-NativeChecked 'git' @('branch','-vv')
$taskTestTemp = [IO.Path]::GetFullPath((Join-Path $taskRoot "$taskPackage/synthetic-tmp"))
if (-not $taskTestTemp.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test TEMP.' }
[IO.Directory]::CreateDirectory($taskTestTemp) > $null
[IO.File]::WriteAllText((Join-Path $taskTestTemp '.gitignore'), "*`n")
$taskPreviousTemp = $env:TEMP; $taskPreviousTmp = $env:TMP
$taskTranscript = @($taskCompleted)
try {
  $env:TEMP=$taskTestTemp; $env:TMP=$taskTestTemp
  # Shared report-only stability run for exactly the same pinned source used by every commit below.
  Invoke-NativeChecked 'npm.cmd' @('run','check') -ReportOnly -Log "$taskPackage/owner-npm-check.log"
  foreach ($taskGroup in @($taskAllocation.groups | Select-Object -Skip $taskCompleted.Count)) {
    Assert-CurrentIndex $taskGroup
    Assert-FinalPins
    Invoke-NativeChecked 'node' @('node_modules/typescript/bin/tsc','--noEmit') -Log "$taskPackage/owner-$($taskGroup.milestone)-typescript.log"
    $taskFocusedArgs = @('node_modules/vitest/vitest.mjs','run') + @($taskGroup.tests)
    Invoke-NativeChecked 'node' $taskFocusedArgs -Log "$taskPackage/owner-$($taskGroup.milestone)-focused.log"
    Assert-FinalPins
    Invoke-NativeChecked 'git' @('diff','--check')
    $taskPaths = @($taskGroup.paths | ForEach-Object { [string]$_ })
    Invoke-NativeChecked 'git' (@('--literal-pathspecs','add','--') + $taskPaths)
    $taskStaged = @(Read-Git @('diff','--cached','--name-only'))
    if (@(Compare-Object -ReferenceObject ($taskPaths | Sort-Object) -DifferenceObject ($taskStaged | Sort-Object)).Count -ne 0) { throw "Staged path mismatch in $($taskGroup.milestone). No commit was made for this group." }
    Invoke-NativeChecked 'git' @('diff','--cached','--check')
    Invoke-NativeChecked 'git' @('commit','--file',[string]$taskGroup.commitMessage)
    $taskCommit = @(Read-Git @('rev-parse','HEAD'))[0]
    $taskTranscript += [PSCustomObject]@{ milestone=$taskGroup.milestone; head=$taskCommit; paths=$taskPaths }
    $taskTranscript | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$taskPackage/OWNER-COMMITS.json" -Encoding utf8
    Write-Output "Committed $($taskGroup.milestone): $taskCommit"
  }
  Assert-FinalPins
  Assert-EmptyIndex
  $taskAllPaths = @($taskPins.files | ForEach-Object { [string]$_.path })
  $taskTrackedPaths = @(Read-Git (@('--literal-pathspecs','ls-files','--error-unmatch','--') + $taskAllPaths))
  if (@(Compare-Object ($taskAllPaths | Sort-Object) ($taskTrackedPaths | Sort-Object)).Count -ne 0) { throw 'A pinned path was not committed.' }
  $taskUncommitted = @(Read-Git (@('--literal-pathspecs','diff','--name-only','HEAD','--') + $taskAllPaths))
  if ($taskUncommitted.Count -ne 0) { throw 'Pinned source has remaining uncommitted changes.' }
  Invoke-NativeChecked 'git' @('status','--short','--branch')
  Write-Output 'Five local commits completed. OWNER-COMMITS.json records the exact independent-QA range. No push, merge, deploy or provider call was run.'
} finally { $env:TEMP=$taskPreviousTemp; $env:TMP=$taskPreviousTmp }
'''


def build(plan_only=False):
    FOLDER.mkdir(parents=True, exist_ok=True)
    paths, allocation, snapshots = ownership()
    if plan_only:
        print(json.dumps({'files': len(paths), 'groups': {g['milestone']: len(g['paths']) for g in allocation['groups']},
                          'overlaps': sum(x['overlapAssignedLater'] for x in allocation['ownership'])}))
        return
    spec = importlib.util.spec_from_file_location('recovery_package', ROOT / '_review/engine-site-launch/recovery_package.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    pins = module.freeze(PACKAGE, sorted(paths), snapshots['M11']['tests'],
                         'Final phase1 recovery: M07 -> M11, final-path allocation\n\nRun only RECOVER.ps1 from this final package. Individual commit messages are pinned separately.\n')
    if pins['head'] != BASE:
        raise ValueError('base_changed')
    (FOLDER / 'RECOVER.ps1').write_text(SCRIPT, encoding='utf-8')
    pins['recoverySha256'] = sha(FOLDER / 'RECOVER.ps1')
    pins['commitAllocationSha256'] = sha(FOLDER / 'COMMIT-ALLOCATION.json')
    pins['commitOrder'] = [g['milestone'] for g in allocation['groups']]
    pins['allocationCounts'] = {g['milestone']: len(g['paths']) for g in allocation['groups']}
    pins['intermediateCommitsAreStandalone'] = False
    pins['sharedFullContractReportOnly'] = True
    for filename, field in [('VALIDATION.json', 'validationSha256'), ('recovery-simulation.json', 'recoverySimulationSha256')]:
        if (FOLDER / filename).is_file():
            pins[field] = sha(FOLDER / filename)
    (FOLDER / 'PINS.json').write_text(json.dumps(pins, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'package': PACKAGE, 'head': BASE, 'files': len(pins['files']), 'patchSha256': pins['patchSha256'],
                      'recoverySha256': pins['recoverySha256'], 'groups': pins['allocationCounts']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--plan', action='store_true')
    build(parser.parse_args().plan)
