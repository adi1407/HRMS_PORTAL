# Run this whenever you want to use the app on your phone.
# Keep this window open; then open the HealthDoc app on your iPhone.

$appDir = $PSScriptRoot
Set-Location $appDir

Write-Host "Starting Expo dev server (dev client)..." -ForegroundColor Cyan
Write-Host "Open the HealthDoc app on your phone to connect." -ForegroundColor Yellow
npx expo start --dev-client
