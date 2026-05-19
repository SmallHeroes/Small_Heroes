# Small Heroes — Safe Cleanup Script
# Run from project root: powershell -ExecutionPolicy Bypass -File cleanup.ps1
#
# Behavior:
#   1. Creates _archive_2026-05-19\ at project root
#   2. MOVES stale files there (does NOT delete)
#   3. Lists exactly what was moved
#   4. Asks for confirmation before each bucket
#
# To recover anything: Move-Item -Path "_archive_2026-05-19\<thing>" -Destination "<original>"
# To permanently delete after a week: Remove-Item _archive_2026-05-19 -Recurse -Force

$ErrorActionPreference = "Stop"
$ARCHIVE_ROOT = "_archive_2026-05-19"

# --- Sanity check: must run from project root --------------------------------
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found. Run from project root." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "lib\story-generator")) {
    Write-Host "ERROR: lib\story-generator not found. Wrong directory?" -ForegroundColor Red
    exit 1
}

# --- Create archive root -----------------------------------------------------
if (-not (Test-Path $ARCHIVE_ROOT)) {
    New-Item -ItemType Directory -Path $ARCHIVE_ROOT | Out-Null
    Write-Host "Created $ARCHIVE_ROOT\" -ForegroundColor Green
}

function Confirm-Bucket($name, $count) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Bucket: $name" -ForegroundColor Cyan
    Write-Host "Items: $count" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    $answer = Read-Host "Move to archive? (y/N)"
    return $answer -eq "y" -or $answer -eq "Y"
}

function Move-ToArchive($src, $bucket) {
    $dest = Join-Path $ARCHIVE_ROOT $bucket
    if (-not (Test-Path $dest)) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
    }
    Move-Item -Path $src -Destination $dest -Force
}

# === Bucket 1: Old story-qa-logs (excluding TODAY) ==========================
Write-Host ""
Write-Host "Scanning story-qa-logs..." -ForegroundColor Yellow
$oldLogs = Get-ChildItem -Path "story-qa-logs" -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike "2026-05-19_*" }
$oldLogsCount = $oldLogs.Count

if ($oldLogsCount -gt 0) {
    Write-Host "Found $oldLogsCount old log directories (all from 2026-05-18 or earlier)" -ForegroundColor Yellow
    if (Confirm-Bucket "Old story-qa-logs" $oldLogsCount) {
        foreach ($dir in $oldLogs) {
            Move-ToArchive -src $dir.FullName -bucket "story-qa-logs"
            Write-Host "  archived: $($dir.Name)"
        }
        Write-Host "Bucket 1 done." -ForegroundColor Green
    } else {
        Write-Host "Bucket 1 skipped." -ForegroundColor Yellow
    }
} else {
    Write-Host "No old logs found — nothing to do." -ForegroundColor Green
}

# === Bucket 2: docs/archive/ =================================================
if (Test-Path "docs\archive") {
    $archiveDocs = Get-ChildItem -Path "docs\archive" -File
    $archiveDocsCount = $archiveDocs.Count
    if ($archiveDocsCount -gt 0) {
        if (Confirm-Bucket "docs\archive\* (already-archived briefs)" $archiveDocsCount) {
            Move-ToArchive -src "docs\archive" -bucket "docs"
            Write-Host "Bucket 2 done." -ForegroundColor Green
        } else {
            Write-Host "Bucket 2 skipped." -ForegroundColor Yellow
        }
    }
}

# === Bucket 3: Old one-off scripts ==========================================
$scriptsToArchive = @(
    "add-companion-letter.mjs",
    "apply-audit-suggestions.mjs",
    "audit-hebrew-quality.mjs",
    "audit-prose-quality.mjs",
    "audit-stories-content.mjs",
    "cleanup-hebrew.mjs",
    "compare-styles.mjs",
    "detect-artifacts.mjs",
    "detect-repetitions.mjs",
    "fingerprint-analyzer.mjs",
    "fix-stories.mjs",
    "fix-wordcount-metadata.mjs",
    "generate-companions.mjs",
    "generate-gallery.mjs",
    "generate-gallery.ts",
    "generate-hero.mjs",
    "generate-hero.ts",
    "generate-style-previews.ts",
    "generate-v5-stories.mjs",
    "probe-openai-models.mjs",
    "rename-companions.mjs",
    "score-stories.mjs",
    "test-layout-pipeline.mjs",
    "validate-stories.mjs",
    "layout-preview.html"
)
$existingScripts = $scriptsToArchive | Where-Object { Test-Path "scripts\$_" }
$existingScriptsCount = $existingScripts.Count
if ($existingScriptsCount -gt 0) {
    Write-Host ""
    Write-Host "These scripts will be archived (not referenced by package.json or production code):" -ForegroundColor Yellow
    foreach ($s in $existingScripts) { Write-Host "  - scripts\$s" }
    Write-Host ""
    Write-Host "KEEPING (active):" -ForegroundColor Green
    Write-Host "  - scripts\dev-safe.js (npm run dev)"
    Write-Host "  - scripts\ignore-server-only.cjs (build)"
    Write-Host "  - scripts\generate-test-batch.mjs (current test runner)"
    Write-Host "  - scripts\generate-test-batch-runner.ts (current test runner)"
    if (Confirm-Bucket "Old one-off scripts" $existingScriptsCount) {
        foreach ($s in $existingScripts) {
            Move-ToArchive -src "scripts\$s" -bucket "scripts"
            Write-Host "  archived: scripts\$s"
        }
        Write-Host "Bucket 3 done." -ForegroundColor Green
    } else {
        Write-Host "Bucket 3 skipped." -ForegroundColor Yellow
    }
}

# === Bucket 4: backend/debug/ ================================================
if (Test-Path "backend\debug\test-audio.ts") {
    if (Confirm-Bucket "backend\debug\test-audio.ts (debug file)" 1) {
        Move-ToArchive -src "backend\debug\test-audio.ts" -bucket "backend-debug"
        Write-Host "Bucket 4 done." -ForegroundColor Green
    }
}

# === Summary =================================================================
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Cleanup summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
if (Test-Path $ARCHIVE_ROOT) {
    $archived = Get-ChildItem -Path $ARCHIVE_ROOT -Recurse -File
    Write-Host "Total files in archive: $($archived.Count)" -ForegroundColor Green
    Write-Host "Archive location: $ARCHIVE_ROOT\" -ForegroundColor Green
    Write-Host ""
    Write-Host "To recover anything:" -ForegroundColor Yellow
    Write-Host "  Move-Item -Path '$ARCHIVE_ROOT\<bucket>\<file>' -Destination '<original_path>'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After 1+ week of confidence, permanent delete:" -ForegroundColor Yellow
    Write-Host "  Remove-Item -Path '$ARCHIVE_ROOT' -Recurse -Force" -ForegroundColor Yellow
}
