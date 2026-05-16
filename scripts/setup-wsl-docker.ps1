$ErrorActionPreference = "Stop"

$logPath = Join-Path $PSScriptRoot "setup-wsl-docker.log"
Start-Transcript -Path $logPath -Append | Out-Null

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

try {
  Write-Step "Enabling WSL2 Windows features"
  Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -All -NoRestart
  Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart

  Write-Step "Setting WSL2 as default"
  wsl.exe --set-default-version 2

  Write-Step "Installing Ubuntu if missing"
  $distros = (wsl.exe -l -q 2>$null) -join "`n"
  if ($distros -notmatch "Ubuntu") {
    wsl.exe --install -d Ubuntu --no-launch
  } else {
    Write-Host "Ubuntu already exists."
  }

  Write-Step "Checking Docker CLI"
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    Write-Step "Installing Docker Desktop with winget"
    winget install --id Docker.DockerDesktop --exact --accept-source-agreements --accept-package-agreements
  } else {
    Write-Host "Docker CLI already exists at $($docker.Source)."
  }

  Write-Step "Done"
  Write-Host "If Windows asks for a restart, restart now, then reopen Codex." -ForegroundColor Yellow
} finally {
  Stop-Transcript | Out-Null
}
