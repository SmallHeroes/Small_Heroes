param(
  [string]$EnvelopeFile,
  [ValidateSet('start','continue')][string]$Phase='start',
  [string]$ChoiceFile,
  [switch]$Worker,
  [switch]$Probe,
  [string]$TraceDirectory
)
$ErrorActionPreference='Stop'
function Quote-Literal([string]$Value){return "'"+$Value.Replace("'","''")+"'"}
function Write-Exclusive([string]$File,[object]$Value){
  $bytes=[Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
  $stream=[IO.File]::Open($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
  try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function Read-OperatorJson([string]$File){
  if(-not [IO.Path]::IsPathRooted($File) -or $File -match '(^|[\\/])(\.env([.\\/]|$)|auth\.json$|credentials|[^\\/]*api[_-]?keys?[^\\/]*$)'){throw 'operator_json_path'}
  $item=Get-Item -LiteralPath $File
  if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -gt 32000000){throw 'operator_json_path'}
  try{return Get-Content -Raw -LiteralPath $File|ConvertFrom-Json -ErrorAction Stop}catch{throw 'operator_json_invalid'}
}
$node=(Get-Command node -ErrorAction Stop).Source
$workspace=Split-Path -Parent $PSScriptRoot
if($Probe){
  if(-not [IO.Path]::IsPathRooted($TraceDirectory)){throw 'probe_trace_absolute_required'}
  $trace=[IO.Path]::GetFullPath($TraceDirectory)
  foreach($protected in @('C:\GNart\Work','C:\Users\guyna\.codex\visualizations\2026\09\04')){
    if($trace.StartsWith($protected,[StringComparison]::OrdinalIgnoreCase)){throw 'probe_trace_protected'}
  }
  $label='probe'
}else{
  $envelope=Read-OperatorJson $EnvelopeFile
  $selfHash=(Get-FileHash -Algorithm SHA256 -LiteralPath $PSCommandPath).Hash.ToLowerInvariant()
  if($envelope.supervisor.sha256 -ne $selfHash -or [IO.Path]::GetFullPath($envelope.supervisor.file) -ne [IO.Path]::GetFullPath($PSCommandPath)){throw 'supervisor_pin_changed'}
  $grant=Read-OperatorJson $envelope.grant.file
  if([IO.Path]::GetFullPath($grant.workspace) -ne [IO.Path]::GetFullPath($workspace)){throw 'supervisor_workspace'}
  $trace=$envelope.traceRoot;$label=$Phase
  # Direct worker invocation must also validate authority before creating trace files.
  & {
    $checkArgs=@("$workspace\node_modules\tsx\dist\cli.mjs",'--require',"$workspace\scripts\shims\register-server-only.cjs","$workspace\scripts\personal-source-preparation-operator.ts",'--envelope',$EnvelopeFile,'--phase',"check-$Phase")
    Push-Location -LiteralPath $workspace
    try{& $node @checkArgs | Out-Null;if($LASTEXITCODE -ne 0){throw 'execution_authority_not_ready'}}finally{Pop-Location}
  }
}
if(-not [IO.Path]::IsPathRooted($trace)){throw 'trace_absolute_required'}
if(-not (Test-Path -LiteralPath $trace)){[IO.Directory]::CreateDirectory($trace)|Out-Null}
if((Get-Item -LiteralPath $trace).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'trace_reparse'}
if(-not $Worker){
  Write-Exclusive (Join-Path $trace "$label.supervisor-launch.json") ([ordered]@{scope=$(if($Probe){'PROVIDER_FREE_SUPERVISOR_PROBE'}else{'SOURCE_PREPARATION'});phase=$label;bootstrapPid=$PID;at=[DateTime]::UtcNow.ToString('o');bootstrapGrantsAuthority=$false})
  $command="& "+(Quote-Literal $PSCommandPath)+" -Worker -Phase "+(Quote-Literal $Phase)
  if($Probe){$command+=" -Probe -TraceDirectory "+(Quote-Literal $trace)}
  else{$command+=" -EnvelopeFile "+(Quote-Literal $EnvelopeFile);if($ChoiceFile){$command+=" -ChoiceFile "+(Quote-Literal $ChoiceFile)}}
  $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
  $workerProcess=Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',$encoded) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $trace "$label.supervisor.stdout.log") -RedirectStandardError (Join-Path $trace "$label.supervisor.stderr.log")
  Write-Exclusive (Join-Path $trace "$label.bootstrap-exit.json") ([ordered]@{supervisorPid=$workerProcess.Id;at=[DateTime]::UtcNow.ToString('o');detached=$true;probe=[bool]$Probe})
  [ordered]@{supervisorPid=$workerProcess.Id;trace=$trace;probe=[bool]$Probe}|ConvertTo-Json -Compress
  exit 0
}
if($Probe){
  $done=Join-Path $trace 'probe-child-completed.json'
  $probeCode="setTimeout(()=>require('node:fs').writeFileSync("+($done|ConvertTo-Json -Compress)+",JSON.stringify({scope:'PROVIDER_FREE_SUPERVISOR_PROBE',providerCalls:0,pid:process.pid})),6000)"
  $nodeArgs=@('-e',$probeCode);$cap=15000
}else{
  $nodeArgs=@("$workspace\node_modules\tsx\dist\cli.mjs",'--require',"$workspace\scripts\shims\register-server-only.cjs","$workspace\scripts\personal-source-preparation-operator.ts",'--envelope',$EnvelopeFile,'--phase',$Phase)
  if($ChoiceFile){$nodeArgs+=@('--choice',$ChoiceFile)}
  $cap=5400000
}
# Quote arguments for CommandLineToArgvW; the child is Node, not another command shell.
$quotedArgs=($nodeArgs|ForEach-Object { '"'+($_ -replace '(\\*)"', '$1$1\"' -replace '(\\+)$','$1$1')+'"' }) -join ' '
$child=Start-Process -FilePath $node -ArgumentList $quotedArgs -WorkingDirectory $workspace -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $trace "$label.operator.stdout.log") -RedirectStandardError (Join-Path $trace "$label.operator.stderr.log")
Write-Exclusive (Join-Path $trace "$label.supervisor-start.json") ([ordered]@{supervisorPid=$PID;childPid=$child.Id;phase=$label;startedAt=[DateTime]::UtcNow.ToString('o');capMs=$cap;probe=[bool]$Probe})
# Cache the native handle before waiting; Start-Process can otherwise expose a null ExitCode.
$nativeHandle=$child.Handle
$finished=$child.WaitForExit($cap)
if(-not $finished){& taskkill.exe /PID $child.Id /T /F | Out-Null;$child.WaitForExit(10000)|Out-Null}
$status=if(-not $finished){'INTERRUPTED_UNKNOWN_NO_RESTART'}elseif($child.ExitCode -ne 0){'HELD'}elseif($Probe){'PROBE_COMPLETED'}else{'NATIVE_EXIT0_REQUIRES_OUTCOME_QA'}
Write-Exclusive (Join-Path $trace "$label.supervisor-exit.json") ([ordered]@{supervisorPid=$PID;childPid=$child.Id;phase=$label;finishedAt=[DateTime]::UtcNow.ToString('o');childExitCode=$child.ExitCode;timedOut=(-not $finished);status=$status;probe=[bool]$Probe;paidRetryAllowed=$false})
exit $(if($finished -and $child.ExitCode -eq 0){0}else{2})
