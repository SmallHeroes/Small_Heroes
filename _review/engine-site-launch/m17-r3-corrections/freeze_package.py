"""Create a bounded cumulative M15+M16+M17 owner package, without touching the Git index."""
from pathlib import Path
import hashlib, importlib.util, json, subprocess, sys
sys.dont_write_bytecode = True
W = Path('C:/GNart/Work/sh-engine-site-launch')
Q = Path('C:/Users/guyna/.codex/visualizations/2026/10/28/01a1819d-8113-7d80-9ce1-2557130edd9e/engine-site-launch-m17-20261105')
FOLDER = '_review/engine-site-launch/m17-r3-corrections'
BASE = '36bd62daf98cc73c1b3e49a2f3c3b23548d4bddd'
BRANCH = 'codex/engine-site-launch-20261104'
P = W / FOLDER
def sha(file): return hashlib.sha256(Path(file).read_bytes()).hexdigest()
def read(file): return json.loads(Path(file).read_text('utf-8-sig'))
def ps(value): return "'" + str(value).replace("'", "''") + "'"
def recovery(paths):
    template = r'''# M17 cumulative local owner commit only. No provider, environment, server, push or deploy.
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
if (-not $CommitPinned) { Write-Output "M17 verified $($taskPaths.Count) pinned paths; no index/commit/provider action. Use -CommitPinned only for the local commit."; return }
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
    assert not (P/'READY.json').exists(), 'Final package already sealed'
    gate=read(Q/'focused-m17-r3.exit.json')
    types=read(Q/'TYPESCRIPT-RESULT-final-r4.json')
    win=read(Q/'WINDOWS-BUILD-RESULT-r3.json'); linux=read(Q/'LINUX-BUILD-RESULT-r4.json')
    assert gate['code']==0 and gate['result']['failed']==0
    assert len(types)==2 and all(r['code']==0 for r in types)
    for result in [win,linux]:
        assert all(step['code']==0 for step in result['steps'])
        assert not result.get('sourceChanged')
    reports=[read(Q/'WINDOWS-PACKAGE-REPORT-r3.json'),read(Q/'LINUX-PACKAGE-REPORT-r4.json')]
    for report in reports:
        assert not report['errors'] and report['allMeasuredRoutesBelowLimit']
        assert report['requiredStaticAssets']==76 and len(report['options'])==23
        assert all(r['sourceFingerprintMatched'] for r in report['options'])
    native=[read(Q/'LINUX-NATIVE-RESULT.json'),read(Q/'WIN32-NATIVE-RESULT.json')]
    assert all(r['defaultIntakePaths'] and r['videoFullDecode'] and r['measuredIntake']['ok'] for r in native)
    preserve=read(Q/'PRESERVATION-FINAL.json'); assert not preserve['unexpectedMismatches']
    P.mkdir(parents=True,exist_ok=True)
    (P/'DECISION-GATE.md').write_text((Q/'DECISION-GATE.md').read_text('utf-8'),'utf-8')
    artifacts=['INTAKE-VERIFIED.json','SOURCE-SNAPSHOT-r4.json','WINDOWS-BUILD-RESULT-r3.json','WINDOWS-PACKAGE-REPORT-r3.json','LINUX-BUILD-RESULT-r4.json','LINUX-PACKAGE-REPORT-r4.json','LINUX-NATIVE-RESULT.json','WIN32-NATIVE-RESULT.json','TYPESCRIPT-RESULT-final-r4.json','focused-m17-r3.exit.json','PRESERVATION-FINAL.json','HOTFIX-EOL-PROOF.json','HOTFIX-POWERSHELL-PARSE.json']
    validation={'localRequiredGatesSatisfied':True,'independentQA':'PENDING_MANUAL_CLAUDE','newExpenseMicroUsd':0,'providerCalls':0,
      'focused':gate['result'],'sourceTypesExit':0,'autonomousTypesExit':0,'windowsBuild':win,'linuxBuild':linux,
      'routeSummary':[{'platform':r['platform'],'measured':len(r['routes']),'engine':len(r['options']),'largestBytes':max(x['bytes'] for x in r['routes']),'largestEngineBytes':max(x['bytes'] for x in r['routes'] if x['engine']),'allBelowLimit':r['allMeasuredRoutesBelowLimit'],'requiredStaticAssets':r['requiredStaticAssets']} for r in reports],
      'native':native,'npmCheck':'Not declared green. Preserved M15 exit1/history remains report-only; M17 uses the full relevant 70-file gate, not blind historical loops.',
      'limitations':['Local Windows and Alpine/musl proof only; real Vercel glibc/adapter/private target remains unqualified.','Option A infrastructure and SQL/runbook are PREPARE ONLY; no account/service/SQL application.','No real payment/book/provider or product acceptance.'],
      'evidenceRoot':str(Q),'artifacts':[{'path':str(Q/n),'sha256':sha(Q/n)} for n in artifacts]}
    (P/'VALIDATION.json').write_text(json.dumps(validation,indent=2)+'\n','utf-8')
    old=read(W/'_review/engine-site-launch/m16-packaging/SCOPE.json')
    git=lambda *args:subprocess.check_output(['git','-C',str(W),*args],text=True).splitlines()
    tracked=git('diff','--name-only')
    untracked=git('ls-files','--others','--exclude-standard','--','app','lib','backend','scripts','config')
    metadata=['DECISION-GATE.md','PACKAGING-DESIGN.md','VALIDATION.json','CLAUDE-REGATE.md','REPORT.md','SCOPE.json','freeze_package.py','PRIVATE-DATABASE-SETUP.sql','PROD-HOTFIX-GUY.md']
    paths=sorted(set(old+tracked+untracked+[FOLDER+'/'+n for n in metadata]))
    (P/'SCOPE.json').write_text(json.dumps(paths,indent=2)+'\n','utf-8')
    (P/'freeze_package.py').write_text(Path(__file__).read_text('utf-8'),'utf-8')
    spec=importlib.util.spec_from_file_location('recovery_package',W/'_review/engine-site-launch/recovery_package.py'); helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    tests=read(W/'_review/engine-site-launch/m16-packaging/PINS.json')['tests']+['lib/generation-chunked/__tests__/env-separation-guard.spec.ts']
    pins=helper.freeze(FOLDER,paths,tests,'fix(engine-site): close R3 packaging and operational safety findings\n\nPreserve cumulative uncommitted M15/M16 and historical books/evidence.\nBind the actual build, all function closures and exact options/assets.\nPrepare isolated staging, private-target SQL and operator inbox/resume safety.\nUSD0, provider-free; no deployment or independent PASS.')
    (P/'RECOVER.ps1').write_text(recovery(paths),'utf-8')
    pins.update(recoverySha256=sha(P/'RECOVER.ps1'),commitMessageSha256=sha(P/'COMMIT-MESSAGE.txt'),singleMilestone='M15_PLUS_M16_PLUS_M17_CUMULATIVE',independentQA='PENDING_MANUAL_CLAUDE',evidenceRoot=str(Q),externalProofFiles=read(W/'_review/engine-site-launch/m16-packaging/PINS.json')['externalProofFiles'])
    (P/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n','utf-8')
    print(json.dumps({'files':len(paths),'patchSha256':pins['patchSha256'],'pinsSha256':sha(P/'PINS.json')}))
if __name__=='__main__':main()

