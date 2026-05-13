# If you see "running scripts is disabled", use ONE of:
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#
$ErrorActionPreference = "Stop"

Write-Host "Installing prerequisites via winget (Python 3.11 + Node.js LTS)..."

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw "winget not found. Install App Installer from Microsoft Store, then re-run."
}

# Python 3.11
winget install --id Python.Python.3.11 --exact --silent --accept-package-agreements --accept-source-agreements

# Node.js LTS (includes npm/npx)
winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements

Write-Host ""
Write-Host "Done. Close and re-open your terminal so PATH updates take effect."
