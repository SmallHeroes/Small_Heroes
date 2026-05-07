# Small Heroes — Project Cleanup Script
# Run from project root: .\cleanup.ps1
# Review each section before running!

Write-Host "=== Small Heroes Cleanup ===" -ForegroundColor Cyan

# 1. Delete dead backend/api/ files (duplicates of app/api/)
Write-Host "`n[1] Removing dead backend/api/ files..." -ForegroundColor Yellow
Remove-Item backend\api\checkout.ts -Force -ErrorAction SilentlyContinue
Remove-Item backend\api\events.ts -Force -ErrorAction SilentlyContinue
Remove-Item backend\api\generate-status.ts -Force -ErrorAction SilentlyContinue
Remove-Item backend\api\generate.ts -Force -ErrorAction SilentlyContinue
Remove-Item backend\api\orders.ts -Force -ErrorAction SilentlyContinue
Remove-Item backend\api\webhook.ts -Force -ErrorAction SilentlyContinue
# Remove directory if empty
if ((Get-ChildItem backend\api -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0) {
  Remove-Item backend\api -Force -ErrorAction SilentlyContinue
}

# 2. Delete dead root scripts
Write-Host "[2] Removing dead root scripts..." -ForegroundColor Yellow
Remove-Item build-spec.js -Force -ErrorAction SilentlyContinue
Remove-Item test-fewshot-story.mjs -Force -ErrorAction SilentlyContinue
Remove-Item test-pipeline-story.mjs -Force -ErrorAction SilentlyContinue
Remove-Item gen-landing-images.mjs -Force -ErrorAction SilentlyContinue

# 3. Delete experiments directory
Write-Host "[3] Removing experiments/ directory..." -ForegroundColor Yellow
Remove-Item experiments -Recurse -Force -ErrorAction SilentlyContinue

# 4. Delete unused hero image variants
Write-Host "[4] Removing unused hero images..." -ForegroundColor Yellow
Remove-Item public\Images\HeroIllustrated1.png -Force -ErrorAction SilentlyContinue
Remove-Item public\Images\HeroIllustrated2.png -Force -ErrorAction SilentlyContinue
Remove-Item public\Images\HeroIllustrated3.png -Force -ErrorAction SilentlyContinue
Remove-Item public\Images\HeroIllustrated4.png -Force -ErrorAction SilentlyContinue

# 5. Delete unused art-styles/realistic.jpg
Write-Host "[5] Removing unused realistic.jpg..." -ForegroundColor Yellow
Remove-Item public\art-styles\realistic.jpg -Force -ErrorAction SilentlyContinue

# 6. Delete unused paper textures
Write-Host "[6] Removing unused paper textures..." -ForegroundColor Yellow
Remove-Item public\assets\paper -Recurse -Force -ErrorAction SilentlyContinue

# 7. Delete qa-capture dev files
Write-Host "[7] Removing qa-capture files..." -ForegroundColor Yellow
Remove-Item public\qa-capture -Recurse -Force -ErrorAction SilentlyContinue

# 8. Remove docx from devDependencies (only used by deleted build-spec.js)
Write-Host "[8] Removing docx dependency..." -ForegroundColor Yellow
npm uninstall docx 2>$null

# 9. Remove stale git lock if present
Write-Host "[9] Cleaning git lock..." -ForegroundColor Yellow
Remove-Item .git\HEAD.lock -Force -ErrorAction SilentlyContinue

# 10. Stage and commit
Write-Host "`n[10] Staging and committing..." -ForegroundColor Yellow
git add -A
git commit -m "cleanup: remove dead code, orphan files, unused assets

- Delete 6 dead backend/api/*.ts files (duplicates of app/api/)
- Delete dead root scripts: build-spec.js, test-*.mjs, gen-*.mjs
- Delete experiments/ directory
- Delete 4 unused HeroIllustrated variants
- Delete unused realistic.jpg, paper textures, qa-capture
- Remove docx devDependency (only user was deleted build-spec.js)"

Write-Host "`n=== Cleanup complete ===" -ForegroundColor Green
Write-Host "Run 'npm install' to sync node_modules, then test locally before pushing." -ForegroundColor Gray
