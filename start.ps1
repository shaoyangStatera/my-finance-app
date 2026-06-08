# Nestworth - start API + web app
# Usage:  .\start.ps1
#         npm run start:all

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed or not on PATH."
    exit 1
}

if (-not (Test-Path "$Root\.env")) {
    Write-Warning ".env not found - copy .env.example to .env and fill in your values."
}

if (-not (Test-Path "$Root\node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

Write-Host ""
Write-Host "Starting Nestworth..." -ForegroundColor Cyan
Write-Host "  API  -> http://localhost:3000"
Write-Host "  Web  -> Expo (opens in browser)"
Write-Host ""

$apiCmd = "Set-Location '$Root'; `$Host.UI.RawUI.WindowTitle = 'Nestworth API'; Write-Host 'Nestworth API (vercel dev)' -ForegroundColor Green; npm run dev:api"
$webCmd = "Set-Location '$Root'; `$Host.UI.RawUI.WindowTitle = 'Nestworth Web'; Write-Host 'Nestworth Web (Expo)' -ForegroundColor Green; npm run web"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCmd
Start-Sleep -Seconds 5
Start-Process powershell -ArgumentList "-NoExit", "-Command", $webCmd

Write-Host "Launched in two windows (API + Web)." -ForegroundColor Green
Write-Host "Close those windows to stop the servers."
