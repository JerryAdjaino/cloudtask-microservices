param(
  [ValidatePattern("^[a-z0-9][a-z0-9_-]{2,}$")][string]$DockerHubUsername = "adjaino",
  [ValidatePattern("^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$")][string]$Tag = "1.0.0"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

docker build -t "${DockerHubUsername}/cloudtask:task-service-$Tag" (Join-Path $Root "task-service")
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
docker build -t "${DockerHubUsername}/cloudtask:analytics-service-$Tag" (Join-Path $Root "analytics-service")
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
docker build -t "${DockerHubUsername}/cloudtask:frontend-$Tag" (Join-Path $Root "frontend-service")
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }

docker push "${DockerHubUsername}/cloudtask:task-service-$Tag"
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
docker push "${DockerHubUsername}/cloudtask:analytics-service-$Tag"
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
docker push "${DockerHubUsername}/cloudtask:frontend-$Tag"
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }

Write-Host "Images pushed successfully."
