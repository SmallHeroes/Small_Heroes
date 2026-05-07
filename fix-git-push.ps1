# Fix git index corruption + push to GitHub
# Run this in PowerShell from the Small_Heroes folder

Set-Location "C:\GNart\Work\Small_Heroes"

# Step 1: Remove stale lock file
if (Test-Path ".git\index.lock") {
    Remove-Item ".git\index.lock" -Force
    Write-Host "[OK] Removed index.lock" -ForegroundColor Green
}

# Step 2: Rebuild git index from HEAD
git read-tree HEAD
Write-Host "[OK] Rebuilt git index" -ForegroundColor Green

# Step 3: Make sure .env is in .gitignore
$gitignore = Get-Content .gitignore -Raw
if ($gitignore -notmatch '(?m)^\.env$') {
    Add-Content .gitignore "`n.env"
    Write-Host "[OK] Added .env to .gitignore" -ForegroundColor Green
} else {
    Write-Host "[OK] .env already in .gitignore" -ForegroundColor Green
}

# Step 4: Remove .env from git tracking (keep file on disk)
git rm --cached .env 2>$null
git rm --cached .env.local 2>$null
Write-Host "[OK] Removed .env from git tracking" -ForegroundColor Green

# Step 5: Stage .gitignore update
git add .gitignore

# Step 6: Amend the commit (no secrets in it now)
git commit --amend --no-edit
Write-Host "[OK] Amended commit without .env" -ForegroundColor Green

# Step 7: Force push to GitHub
git push -u origin main --force
Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Cyan
