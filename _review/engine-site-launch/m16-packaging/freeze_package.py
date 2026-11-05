"""Create a bounded cumulative M15+M16 owner package, without touching the Git index."""
from pathlib import Path
import hashlib, importlib.util, json, subprocess, sys
sys.dont_write_bytecode = True
W = Path('C:/GNart/Work/sh-engine-site-launch')
Q = Path('C:/Users/guyna/.codex/visualizations/2026/10/28/01a1819d-8113-7d80-9ce1-2557130edd9e/engine-packaging-m16-20261105')
FOLDER = '_review/engine-site-launch/m16-packaging'
BASE = '36bd62daf98cc73c1b3e49a2f3c3b23548d4bddd'
BRANCH = 'codex/engine-site-launch-20261104'
P = W / FOLDER
def sha(file): return hashlib.sha256(Path(file).read_bytes()).hexdigest()
def read(file): return json.loads(Path(file).read_text('utf-8-sig'))
def ps(value): return "'" + str(value).replace("'", "''") + "'"
def recovery(paths):
    template = r'''# M16 cumulative local owner commit only. No provider, environment, server, push or deploy.
param([switch]$InspectOnly, [switch]$CommitPinned, [switch]$ResumeStaged)
$ErrorActionPreference = 'Stop'
$taskRoot = __ROOT__
$taskPackage = __FOLDER__
$taskBase = __BASE__
$taskBranch = __BRANCH__
$taskPaths = @(__PATHS__)
if ($InspectOnly -and $CommitPinned) { throw 'Choose inspection or commit.' }
if ([IO.Path]::GetFullPath((Get-Location).Path).TrimEnd('\') -ne $taskRoot.TrimEnd('\')) { throw 'Wrong worktree.' }
function Native([string[]]$Arguments) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $result = @(& git @Arguments); $code = $LASTEXITCODE } finally { $ErrorActionPreference = $old }
  if ($code -ne 0) { throw "Git read/check/action failed: $($Arguments -join ' ')" }; return $result
}
function Hash([string]$File) {
 $hasher=[Security.Cryptography.SHA256]::Create()
 try { return [BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($File))).Replace('-','').ToLowerInvariant() } finally { $hasher.Dispose() }
}
function Same($Left, $Right) { return ((@($Left | Sort-Object) -join "`n") -ceq (@($Right | Sort-Object) -join "`n")) }
$pins = [IO.File]::ReadAllText((Join-Path $taskRoot "$taskPackage/PINS.json")) | ConvertFrom-Json
if ($pins.head -ne $taskBase -or $pins.branch -ne $taskBranch -or -not (Same @($pins.files.path) $taskPaths)) { throw 'Wrong frozen authority or membership.' }
if (((Native @('rev-parse','HEAD')) | Out-String).Trim() -ne $taskBase -or ((Native @('branch','--show-current')) | Out-String).Trim() -ne $taskBranch) { throw 'HEAD/branch changed.' }
function Assert-Pins {
 foreach ($pin in $pins.files) {
  $file = [IO.Path]::GetFullPath((Join-Path $taskRoot $pin.path))
  if (-not $file.StartsWith($taskRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or $pin.path -match '(^|/)\.env|(^|/)\.git(/|$)') { throw 'Unsafe path.' }
  if (([IO.FileInfo]$file).Length -ne $pin.bytes -or (Hash $file) -cne $pin.sha256) { throw "Working pin drift: $($pin.path)" }
 }
 foreach ($entry in @(@('CHANGES.patch',$pins.patchSha256),@('RECOVER.ps1',$pins.recoverySha256),@('COMMIT-MESSAGE.txt',$pins.commitMessageSha256))) {
  if ((Hash (Join-Path $taskRoot "$taskPackage/$($entry[0])")) -cne $entry[1]) { throw 'Package changed.' }
 }
 foreach ($entry in $pins.externalProofFiles) { if ((Hash (Join-Path $taskRoot $entry.path)) -cne $entry.sha256) { throw 'Prepared offline proof changed.' } }
}
Assert-Pins
$staged = @(Native @('diff','--cached','--name-only'))
if ($ResumeStaged) {
 if (-not (Same $staged $taskPaths) -or @(Native (@('diff','--name-only','--') + $taskPaths)).Count -ne 0) { throw 'Staged paths or bytes differ.' }
} elseif ($staged.Count) { throw 'Preserve the existing index.' }
if (@(Native @('diff','--name-only',$taskBase) | Where-Object { $_ -notin $taskPaths }).Count) { throw 'Unlisted tracked change.' }
if (@(Native @('ls-files','--others','--exclude-standard','--','app','lib','backend','scripts','config') | Where-Object { $_ -notin $taskPaths }).Count) { throw 'Unlisted source file.' }
Native @('diff','--check'); Native @('diff','--cached','--check'); Native @('apply','--reverse','--check',"$taskPackage/CHANGES.patch")
$validation = [IO.File]::ReadAllText((Join-Path $taskRoot "$taskPackage/VALIDATION.json")) | ConvertFrom-Json
if (-not $validation.localRequiredGatesSatisfied -or $validation.independentQA -ne 'PENDING_MANUAL_CLAUDE' -or $validation.newExpenseMicroUsd -ne 0) { throw 'Required local evidence is not green.' }
if (-not $CommitPinned) { Write-Output "M16 verified $($taskPaths.Count) pinned paths; no index/commit/provider action. Use -CommitPinned only for the local commit."; return }
Assert-Pins
if (-not $ResumeStaged) { Native (@('--literal-pathspecs','add','--') + $taskPaths) }
if (-not (Same @(Native @('diff','--cached','--name-only')) $taskPaths) -or @(Native (@('diff','--name-only','--') + $taskPaths)).Count) { throw 'Index differs from exact frozen working bytes.' }
Native @('diff','--cached','--check'); Native @('commit','--file',"$taskPackage/COMMIT-MESSAGE.txt")
$newHead = ((Native @('rev-parse','HEAD')) | Out-String).Trim()
$record = @{ baseHead=$taskBase; head=$newHead; branch=$taskBranch; patchSha256=$pins.patchSha256; paths=$taskPaths; recordedAt=[DateTime]::UtcNow.ToString('o'); independentQA='PENDING_MANUAL_CLAUDE'; gates='Previously completed and hash-bound, not rerun by this commit helper'; pushed=$false }
[IO.File]::WriteAllText((Join-Path $taskRoot "$taskPackage/OWNER-COMMIT.json"),($record|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
Write-Output "Local commit=$newHead. No push, deploy, service or paid action. Independent Claude QA still required."
'''
    for key, value in {'ROOT':ps(W),'FOLDER':ps(FOLDER),'BASE':ps(BASE),'BRANCH':ps(BRANCH),'PATHS':', '.join(ps(x) for x in sorted(paths))}.items():
        template = template.replace('__'+key+'__',value)
    return template

def main():
    assert not (P/'READY.json').exists(), 'Final package already sealed; do not overwrite it'
    win=read(Q/'WINDOWS-BUILD-RESULT.json'); linux=read(Q/'LINUX-BUILD-RESULT-R2.json'); final=read(Q/'LINUX-FINAL-VERIFIED.json')
    assert win['buildExit']==0 and win['packageExit']==0 and not win['sourceChanged']
    assert linux['buildExit']==0 and linux['packageExit']==0
    assert all(r['code']==0 for r in read(Q/'TYPESCRIPT-RESULT-final.json'))
    gate=read(Q/'focused-m16-r2.exit.json'); targeted=read(Q/'native-policy-final.exit.json')
    assert gate['code']==0 and gate['result']['passed']==1189 and not gate['result']['failed']
    assert targeted['code']==0 and targeted['result']['passed']==41 and not targeted['result']['failed']
    P.mkdir(parents=True,exist_ok=True)
    (P/'DECISION-GATE.md').write_text((Q/'DECISION-GATE.md').read_text('utf-8')+'\n'+(Q/'NATIVE-ARCHIVE-DECISION.md').read_text('utf-8'),'utf-8')
    artifacts=['INPUT-FREEZE.json','TRACING-ROOT-CAUSE.json','REPLAY-AFTER.json','NATIVE-REPLAY.json','WINDOWS-BUILD-RESULT.json','WINDOWS-NEW-BUILD-TRACE-REPORT.json','LINUX-BUILD-RESULT-R2.json','LINUX-FINAL-VERIFIED.json','LINUX-NATIVE-RESULT.json','TYPESCRIPT-RESULT-final.json','focused-m16-r2.exit.json','native-policy-final.exit.json']
    validation={'localRequiredGatesSatisfied':True,'independentQA':'PENDING_MANUAL_CLAUDE','newExpenseMicroUsd':0,'providerCalls':0,'focused':gate['result'],'finalPackagingControls':targeted['result'],'sourceTypesExit':0,'autonomousTypesExit':0,'windowsBuild':win,'linuxBuild':linux,'linuxFinal':final,'nativeLinux':read(Q/'LINUX-NATIVE-RESULT.json'),'npmCheck':'M15 recorded exit1 remains report-only; full stability is NOT declared green. M16 did not repeat the blind broad suite.','evidenceRoot':str(Q),'artifacts':[{'path':str(Q/name),'sha256':sha(Q/name)} for name in artifacts]}
    (P/'VALIDATION.json').write_text(json.dumps(validation,indent=2)+'\n','utf-8')
    m15=read(W/'_review/engine-site-launch/m15-self-check-build/SCOPE.json')
    paths=sorted(set(m15+['next.config.js','package.json','backend/providers/video.ts','scripts/personal-book-narration.ts','config/engine-runtime-assets.json','scripts/engine-package.cjs','scripts/lib/engine-package.cjs','scripts/lib/narration-media.cjs','scripts/lib/native-media.cjs','scripts/lib/native-media-build.cjs','lib/engine-site/__tests__/package-contract.spec.ts']+[FOLDER+'/'+n for n in ['DECISION-GATE.md','PACKAGING-DESIGN.md','VALIDATION.json','CLAUDE-REGATE.md','REPORT.md','SCOPE.json','freeze_package.py']]))
    (P/'SCOPE.json').write_text(json.dumps(paths,indent=2)+'\n','utf-8')
    (P/'freeze_package.py').write_text(Path(__file__).read_text('utf-8'),'utf-8')
    spec=importlib.util.spec_from_file_location('recovery_package',W/'_review/engine-site-launch/recovery_package.py'); helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    tests=read(W/'_review/engine-site-launch/m15-self-check-build/FOCUSED-TESTS.json')+['lib/__tests__/narration-tts-seams.spec.ts']
    pins=helper.freeze(FOLDER,paths,tests,'fix(packaging): bound engine traces and preserve exact native media\n\nPreserve the uncommitted M15 recovery and owner guides.\nApply declared engine exclusions on both path styles and refuse credential paths.\nLosslessly package exact native executables and retain lazy legacy video/narration.\nRecord Windows/Linux local proof, remaining legacy size blockers and pending independent QA.\nUSD0; no push, deploy, service or book execution.')
    (P/'RECOVER.ps1').write_text(recovery(paths),'utf-8')
    pins.update(recoverySha256=sha(P/'RECOVER.ps1'),commitMessageSha256=sha(P/'COMMIT-MESSAGE.txt'),singleMilestone='M15_PLUS_M16_CUMULATIVE',independentQA='PENDING_MANUAL_CLAUDE',evidenceRoot=str(Q),externalProofFiles=[{'path':x['path'],'sha256':x['sha256']} for x in read(W/'_review/engine-site-launch/m15-self-check-build/PINS.json')['externalProofFiles']])
    (P/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n','utf-8')
    print(json.dumps({'files':len(paths),'patchSha256':pins['patchSha256'],'pinsSha256':sha(P/'PINS.json')}))
if __name__=='__main__': main()
