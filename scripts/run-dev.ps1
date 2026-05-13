# Starts FastAPI (port 8000) and Next.js (port 3000).
# Run from repo root:  .\scripts\run-dev.ps1
# If execution policy blocks scripts:  powershell -ExecutionPolicy Bypass -File .\scripts\run-dev.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

# Pick up Node after a fresh install (PATH is often stale until terminal restart)
$env:Path =
  [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [Environment]::GetEnvironmentVariable("Path", "User")

$Python311 = Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"
if (-not (Test-Path $Python311)) {
  $Python311 = "python"
}

$NpmCmd = $null
if (Test-Path "C:\Program Files\nodejs\npm.cmd") {
  $NpmCmd = "C:\Program Files\nodejs\npm.cmd"
} else {
  $npmWhich = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmWhich) { $NpmCmd = $npmWhich.Source }
}

if (-not $NpmCmd) {
  throw "npm not found. Install Node.js LTS (includes npm), then close/reopen this terminal, or run: winget install OpenJS.NodeJS.LTS"
}

$Backend = Join-Path $RepoRoot "backend"
$Frontend = Join-Path $RepoRoot "frontend"
$VenvPython = Join-Path $Backend ".venv\Scripts\python.exe"
$VenvPip = Join-Path $Backend ".venv\Scripts\pip.exe"

if (-not (Test-Path $VenvPython)) {
  Write-Host "Creating Python venv..."
  & $Python311 -m venv (Join-Path $Backend ".venv")
  & $VenvPip install -r (Join-Path $Backend "requirements.txt")
}

if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
  Write-Host "Installing frontend dependencies (first run)..."
  Push-Location $Frontend
  try {
    & $NpmCmd install
  } finally {
    Pop-Location
  }
}

Write-Host "Starting backend in a new window..."
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "Set-Location -LiteralPath '$Backend'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
)

Start-Sleep -Seconds 2

Write-Host "Starting frontend (this window)..."
Push-Location $Frontend
try {
  & $NpmCmd run dev
} finally {
  Pop-Location
}
