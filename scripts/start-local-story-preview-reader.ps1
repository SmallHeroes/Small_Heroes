param(
  [Parameter(Mandatory = $true)][string]$ReviewDirectory,
  [int]$Port = 3117
)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$resolvedReview = (Resolve-Path -LiteralPath $ReviewDirectory).Path
if (-not (Test-Path -LiteralPath (Join-Path $resolvedReview 'manifest.json'))) { throw 'Reader manifest missing' }
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Invalid local port' }
$env:LOCAL_BOOK_REVIEW_DIR = $resolvedReview
# Inert boot configuration only. The reader never receives the render credential.
$env:DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused'
$env:SUPABASE_URL = 'http://127.0.0.1:1'
$env:SUPABASE_SERVICE_ROLE_KEY = 'local-reader-not-a-credential'
$env:OPENAI_API_KEY = 'local-reader-not-a-credential'
$env:GENERATION_SECRET = 'local-reader-disabled'
$env:DISABLE_IMAGE_GENERATION = 'true'
$env:IMAGE_PROVIDER = 'gpt-image'
$env:PAYMENT_PROVIDER = 'none'
$env:NEXT_PUBLIC_BUY_MODE = 'waitlist'
$env:ENABLE_FAKE_PAYMENT = 'false'
$env:ALLOW_FAKE_PAYMENTS = 'false'
$env:NEXT_PUBLIC_APP_URL = "http://127.0.0.1:$Port"
$env:APP_URL = "http://127.0.0.1:$Port"
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port $Port
exit $LASTEXITCODE
