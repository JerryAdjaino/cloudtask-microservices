$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$env:MONGO_URI = "mongodb://localhost:27017/cloudtask"
$processes = @()
try {
  foreach ($service in @("task-service", "analytics-service", "frontend-service")) {
    $dir = Join-Path $root $service
    Push-Location $dir
    try { npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw "npm ci failed" } } finally { Pop-Location }
    $entry = if ($service -eq "frontend-service") { "src.js" } else { "src/server.js" }
    $processes += Start-Process node -ArgumentList $entry -WorkingDirectory $dir -WindowStyle Hidden -PassThru
  }
  Write-Host "Open http://localhost:3000. Press Ctrl+C to stop."
  while ($true) { foreach ($p in $processes) { if ($p.HasExited) { throw "A service exited" } }; Start-Sleep 1 }
} finally { foreach ($p in $processes) { if (!$p.HasExited) { Stop-Process -Id $p.Id } } }
