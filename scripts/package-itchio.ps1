# Build browser bundle and zip for itch.io HTML embed.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$version = (Get-Content package.json | ConvertFrom-Json).version
$releaseDir = Join-Path $Root "release"
$distDir = Join-Path $Root "dist"
$outZip = Join-Path $releaseDir "men-eat-pb-browser-v$version.zip"

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
npm run build

if (-not (Test-Path $distDir)) {
  throw "dist/ missing after build"
}

if (Test-Path $outZip) { Remove-Item $outZip -Force }
Compress-Archive -Path (Join-Path $distDir "*") -DestinationPath $outZip -Force

Write-Host "Wrote $outZip ($((Get-Item $outZip).Length) bytes)"
Write-Host "itch.io: Kind=HTML, Main file=index.html, Embed 800x600, Min price `$5 (see docs/ITCH_PASTE_READY.md)"
