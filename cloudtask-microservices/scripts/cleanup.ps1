# Preserves MongoDB, its Secret and PVC. Resume with deploy-kubernetes.ps1.
$ErrorActionPreference = "Stop"
foreach ($name in @("frontend-service", "analytics-service", "task-service")) {
  kubectl -n cloudtask delete deployment,service $name --ignore-not-found
  if ($LASTEXITCODE -ne 0) { throw "Cleanup failed" }
}
Write-Host "Application workloads removed. MongoDB data retained."
