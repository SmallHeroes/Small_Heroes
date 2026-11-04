"""Freeze explicit workspace paths, never touch Git's index, keys or services.

Packages are cumulative against the actual HEAD at creation. Older patches remain
immutable; if their working pins drift, use the latest package or review the old
patch in an isolated owner-controlled checkout. Never reset a working tree here.
"""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def git(*args):
    result = subprocess.run(['git', *args], cwd=ROOT, capture_output=True)
    if result.returncode:
        raise RuntimeError('Git read/check failed: ' + ' '.join(args))
    return result.stdout


def ps(value):
    return "'" + value.replace("'", "''") + "'"


def freeze(directory, paths, tests, message):
    folder = ROOT / directory
    folder.mkdir(parents=True, exist_ok=True)
    head = git('rev-parse', 'HEAD').decode().strip()
    branch = git('branch', '--show-current').decode().strip()
    if git('diff', '--cached', '--name-only').strip():
        raise RuntimeError('Existing staged changes must be preserved/reconciled')
    explicit = sorted(set(paths))
    records, patch = [], b''
    for name in explicit:
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT) or '.git' in path.parts or path.name.startswith('.env'):
            raise RuntimeError('Unsafe source pin: ' + name)
        data = path.read_bytes()
        records.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        tracked = subprocess.run(['git', 'cat-file', '-e', head + ':' + name], cwd=ROOT, capture_output=True).returncode == 0
        if tracked:
            patch += git('--literal-pathspecs', 'diff', '--binary', '--', name)
        else:
            # Git stores text with LF here; keep raw-working-byte hashes separately.
            normalized = data.replace(b'\r\n', b'\n')
            lines = normalized.splitlines(keepends=True)
            patch += (f'diff --git a/{name} b/{name}\nnew file mode 100644\n--- /dev/null\n+++ b/{name}\n@@ -0,0 +1,{len(lines)} @@\n').encode()
            patch += b''.join(b'+' + line for line in lines)
            if normalized and not normalized.endswith(b'\n'):
                patch += b'\n\\ No newline at end of file\n'
    patch_path = folder / 'CHANGES.patch'
    patch_path.write_bytes(patch)
    metadata = {'status': 'FROZEN_UNCOMMITTED', 'head': head, 'branch': branch,
                'cumulativeAgainstHead': True, 'files': records,
                'patchSha256': hashlib.sha256(patch).hexdigest(), 'tests': tests}
    (folder / 'PINS.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    (folder / 'COMMIT-MESSAGE.txt').write_text(message + '\n', encoding='utf-8')
    quoted_paths = ', '.join(ps(name) for name in explicit)
    quoted_tests = ', '.join(ps(name) for name in tests)
    script = f'''# Explicit paths only. No push/merge/deploy, service call, key read or cleanup.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath {ps(str(ROOT))}
$taskPackage = {ps(directory)}
function Invoke-NativeChecked {{
  param([string]$Executable, [string[]]$Arguments, [switch]$ReportOnly, [string]$Log)
  $taskOldPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {{
    if ($Log) {{ & $Executable @Arguments *> $Log }} else {{ & $Executable @Arguments }}
    $taskNativeExit = $LASTEXITCODE
  }} finally {{ $ErrorActionPreference = $taskOldPreference }}
  if ($Log) {{ Add-Content -LiteralPath $Log -Value "NATIVE_EXIT_CODE=$taskNativeExit" }}
  if ($taskNativeExit -ne 0 -and -not $ReportOnly) {{ throw "$Executable failed with exit $taskNativeExit" }}
  if ($ReportOnly) {{ Write-Output "$Executable reported exit=$taskNativeExit (nonblocking)" }}
}}
if ((git rev-parse HEAD).Trim() -ne {ps(head)}) {{ throw 'HEAD changed; use a fresh recovery package.' }}
if ((git branch --show-current).Trim() -ne {ps(branch)}) {{ throw 'Wrong branch.' }}
if ((git diff --cached --name-only)) {{ throw 'Staged changes exist; preserve/reconcile them first.' }}
$taskPins = [System.IO.File]::ReadAllText((Join-Path (Get-Location).Path "$taskPackage/PINS.json")) | ConvertFrom-Json
foreach ($pin in $taskPins.files) {{
  $taskPath = Join-Path (Get-Location).Path $pin.path
  $taskHash = [System.Security.Cryptography.SHA256]::Create()
  try {{ $taskActual = [System.BitConverter]::ToString($taskHash.ComputeHash([System.IO.File]::ReadAllBytes($taskPath))).Replace('-', '').ToLowerInvariant() }}
  finally {{ $taskHash.Dispose() }}
  if ($taskActual -ne $pin.sha256) {{ throw "Working source changed: $($pin.path). Use the latest cumulative package." }}
}}
$taskHash = [System.Security.Cryptography.SHA256]::Create()
try {{ $taskActual = [System.BitConverter]::ToString($taskHash.ComputeHash([System.IO.File]::ReadAllBytes((Join-Path (Get-Location).Path "$taskPackage/CHANGES.patch")))).Replace('-', '').ToLowerInvariant() }}
finally {{ $taskHash.Dispose() }}
if ($taskActual -ne $taskPins.patchSha256) {{ throw 'Patch changed.' }}
Invoke-NativeChecked 'git' @('diff', '--check')
Invoke-NativeChecked 'node' @('node_modules/typescript/bin/tsc', '--noEmit')
$taskTestTemp = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path "$taskPackage/synthetic-tmp"))
if (-not $taskTestTemp.StartsWith((Get-Location).Path + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {{ throw 'Unsafe synthetic test directory.' }}
[System.IO.Directory]::CreateDirectory($taskTestTemp) > $null
[System.IO.File]::WriteAllText((Join-Path $taskTestTemp '.gitignore'), "*`n")
$taskPreviousTemp = $env:TEMP; $taskPreviousTmp = $env:TMP
try {{
  $env:TEMP = $taskTestTemp; $env:TMP = $taskTestTemp
  Invoke-NativeChecked 'node' @('node_modules/vitest/vitest.mjs', 'run', {quoted_tests})
  Invoke-NativeChecked 'npm.cmd' @('run', 'check') -ReportOnly -Log "$taskPackage/owner-npm-check.log"
}} finally {{ $env:TEMP = $taskPreviousTemp; $env:TMP = $taskPreviousTmp }}
$taskPaths = @({quoted_paths})
Invoke-NativeChecked 'git' (@('--literal-pathspecs', 'add', '--') + $taskPaths)
Invoke-NativeChecked 'git' @('diff', '--cached', '--check')
Invoke-NativeChecked 'git' @('commit', '--file', "$taskPackage/COMMIT-MESSAGE.txt")
Invoke-NativeChecked 'git' @('status', '--short', '--branch')
Write-Output 'No push was run. After explicit push authorization only: git push -u origin {branch}'
'''
    (folder / 'RECOVER.ps1').write_text(script, encoding='utf-8')
    # Read-only reverse applicability check against this exact working tree.
    git('apply', '--reverse', '--check', str(patch_path.relative_to(ROOT)))
    print(json.dumps({'package': directory, 'head': head, 'files': len(records), 'patchSha256': metadata['patchSha256']}))
    return metadata
