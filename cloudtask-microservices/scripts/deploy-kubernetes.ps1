param(
  [ValidatePattern("^[a-z0-9][a-z0-9_-]{2,}$")][string]$DockerHubUsername = "adjaino",
  [ValidatePattern("^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$")][string]$Tag = "1.0.0"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Kube = Join-Path $Root "kubernetes"
$Temp = Join-Path ([System.IO.Path]::GetTempPath()) ("cloudtask-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $Temp | Out-Null

try {
  kubectl apply -f (Join-Path $Kube "00-namespace.yaml")
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
  $existing = kubectl -n cloudtask get secret mongodb-secret --ignore-not-found -o name
  if ($LASTEXITCODE -ne 0) { throw "Cannot inspect MongoDB Secret" }
  if (!$existing) {
    $existingPvc = kubectl -n cloudtask get pvc mongodb-pvc --ignore-not-found -o name
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect PVC" }
    if ($existingPvc) { throw "PVC exists without its Secret. Restore the original credentials; do not generate new ones." }
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $secret = @{ apiVersion="v1"; kind="Secret"; metadata=@{name="mongodb-secret";namespace="cloudtask"}; type="Opaque"; stringData=@{MONGO_USERNAME="cloudtask";MONGO_PASSWORD=[Convert]::ToBase64String($bytes)} }
    $secret | ConvertTo-Json -Depth 5 | kubectl apply -f -
    if ($LASTEXITCODE -ne 0) { throw "Secret creation failed" }
  }

  foreach ($file in @("10-configmap.yaml", "11-mongodb-pvc.yaml", "12-mongodb.yaml")) {
    kubectl apply -f (Join-Path $Kube $file)
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
  }

  foreach ($file in @("20-task-service.yaml", "30-analytics-service.yaml", "40-frontend-service.yaml")) {
    $content = Get-Content (Join-Path $Kube $file) -Raw
    $content = $content.Replace("adjaino/cloudtask:", "${DockerHubUsername}/cloudtask:").Replace("-1.0.0", "-$Tag")
    $target = Join-Path $Temp $file
    Set-Content -Path $target -Value $content
    kubectl apply -f $target
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
  }

  kubectl -n cloudtask rollout status deployment/mongodb --timeout=180s
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
  kubectl -n cloudtask rollout status deployment/task-service --timeout=180s
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
  kubectl -n cloudtask rollout status deployment/analytics-service --timeout=180s
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
  kubectl -n cloudtask rollout status deployment/frontend-service --timeout=180s
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
  kubectl -n cloudtask get pods
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
  kubectl -n cloudtask get svc
  if ($LASTEXITCODE -ne 0) { throw "External command failed (exit $LASTEXITCODE)." }
}
finally {
  $resolvedTemp = [IO.Path]::GetFullPath($Temp)
  if ($resolvedTemp.StartsWith([IO.Path]::GetTempPath()) -and (Split-Path $resolvedTemp -Leaf) -like "cloudtask-*") { Remove-Item -LiteralPath $resolvedTemp -Recurse -Force }
}
