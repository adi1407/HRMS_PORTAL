# Run this script in PowerShell or Terminal to do the one-time EAS setup and iOS build.
# You will be prompted to: (1) log in to Expo, (2) choose iOS if asked, (3) sign in with Apple ID.

$appDir = $PSScriptRoot
Set-Location $appDir

Write-Host "=== Step 1: Log in to EAS (Expo) ===" -ForegroundColor Cyan
Write-Host "Enter your Expo account email/username when prompted." -ForegroundColor Yellow
eas login
if ($LASTEXITCODE -ne 0) {
    Write-Host "Login failed or was cancelled. Run this script again when ready." -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Step 2: Configure EAS Build (choose iOS if asked) ===" -ForegroundColor Cyan
eas build:configure
if ($LASTEXITCODE -ne 0) {
    Write-Host "Configure failed. You can skip this if eas.json already exists." -ForegroundColor Yellow
}

Write-Host "`n=== Step 3: Start iOS development build ===" -ForegroundColor Cyan
Write-Host "You may be asked to sign in with your Apple ID. Allow EAS to manage certificates (Yes)." -ForegroundColor Yellow
eas build -p ios --profile development
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Check the output above." -ForegroundColor Red
    exit 1
}

Write-Host "`nBuild started or completed. Check the link/QR code above to install on your iPhone." -ForegroundColor Green
