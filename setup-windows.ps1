$ErrorActionPreference = 'Stop'
$Model = 'qwen3:1.7b'
$OllamaUrl = 'http://127.0.0.1:11434/api/tags'

Set-Location $PSScriptRoot

function Refresh-ToolPath {
  $candidatePaths = @(
    'C:\Program Files\nodejs',
    (Join-Path $env:LOCALAPPDATA 'Programs\Ollama'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\bin')
  )
  foreach ($candidatePath in $candidatePaths) {
    if ((Test-Path $candidatePath) -and ($env:Path -notlike "*$candidatePath*")) {
      $env:Path = "$candidatePath;$env:Path"
    }
  }
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw 'Windows Package Manager (winget) is required. Install or update App Installer from the Microsoft Store, then rerun this script.'
}

Refresh-ToolPath
$node = Get-Command node -ErrorAction SilentlyContinue
$nodeVersion = [version]'0.0'
if ($node) {
  $nodeVersion = [version]((& node -p 'process.versions.node').Trim())
}
if (-not $node -or $nodeVersion -lt [version]'22.13') {
  Write-Host 'Installing Node.js 22 LTS...'
  winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
  Refresh-ToolPath
}

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $nodeVersion = [version]((& node -p 'process.versions.node').Trim())
}
if (-not $node -or $nodeVersion -lt [version]'22.13') {
  throw 'Node.js 22.13+ is required. Install a current LTS release from https://nodejs.org/, then rerun this script.'
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Node.js/npm was installed but is not available in this terminal. Open a new PowerShell window and rerun this script.'
}

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Host 'Installing Ollama...'
  winget install --id Ollama.Ollama --exact --accept-package-agreements --accept-source-agreements
  Refresh-ToolPath
}

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
  throw 'Ollama was installed but is not available in this terminal. Open a new PowerShell window and rerun this script.'
}

Write-Host "`nInstalling project dependencies..."
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

try {
  Invoke-RestMethod -Uri $OllamaUrl -TimeoutSec 2 | Out-Null
} catch {
  Write-Host "`nStarting Ollama in the background..."
  Start-Process -FilePath $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden
  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Seconds 1
    try {
      Invoke-RestMethod -Uri $OllamaUrl -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch { }
  }
  if (-not $ready) { throw 'Ollama did not become ready. Start it with `ollama serve`, then rerun this script.' }
}

Write-Host "`nDownloading Ollama model $Model (about 1.4 GB)..."
ollama pull $Model
if ($LASTEXITCODE -ne 0) { throw 'Downloading the Ollama model failed.' }

Write-Host "`nBuilding ChessChat..."
npm run build
if ($LASTEXITCODE -ne 0) { throw 'The production build failed.' }

Write-Host "`nSetup complete. Starting ChessChat at http://localhost:5173"
npm run dev -- --host 127.0.0.1