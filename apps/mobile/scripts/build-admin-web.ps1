$ErrorActionPreference = "Stop"

$requiredVariables = @(
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY"
)

foreach ($name in $requiredVariables) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($value) -or $value.StartsWith("your-")) {
    throw "Required production web configuration is missing: $name"
  }
}

if ($env:EXPO_PUBLIC_ALLOW_LOCAL_APP_CHECK_BYPASS -eq "true") {
  throw "The local App Check bypass must not be enabled for an admin web export."
}

$npmCommand = if ($IsWindows) { "npm.cmd" } else { "npm" }
& $npmCommand run build:web
if ($LASTEXITCODE -ne 0) {
  throw "Expo web export failed."
}

$distPath = Join-Path $PSScriptRoot "..\dist"
$requiredArtifacts = @(
  "index.html",
  "admin-login.html",
  "access-denied.html",
  "(admin)/index.html",
  "staticwebapp.config.json"
)

foreach ($artifact in $requiredArtifacts) {
  if (-not (Test-Path -LiteralPath (Join-Path $distPath $artifact))) {
    throw "Expected admin web artifact is missing: $artifact"
  }
}

$sourceMaps = Get-ChildItem -LiteralPath $distPath -Recurse -File -Filter "*.map"
if ($sourceMaps.Count -gt 0) {
  throw "Production admin export unexpectedly contains source maps."
}

$sitemapPath = Join-Path $distPath "sitemap.xml"
if (Test-Path -LiteralPath $sitemapPath) {
  Remove-Item -LiteralPath $sitemapPath
}

@(
  "User-agent: *",
  "Disallow: /"
) | Set-Content -LiteralPath (Join-Path $distPath "robots.txt") -Encoding utf8

$configPath = Join-Path $distPath "staticwebapp.config.json"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$config.globalHeaders | Add-Member -NotePropertyName "X-Robots-Tag" -NotePropertyValue "noindex, nofollow, noarchive" -Force
$config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding utf8

Write-Output "Admin web export prepared and validated at $distPath"
