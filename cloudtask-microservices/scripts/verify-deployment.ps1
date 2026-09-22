param([string]$BaseUrl = "http://localhost:30080", [switch]$TestScaling, [switch]$TestPersistence)
$ErrorActionPreference = "Stop"
function Kube { & kubectl @args; if ($LASTEXITCODE -ne 0) { throw "kubectl failed" } }
foreach ($name in @("mongodb", "task-service", "analytics-service", "frontend-service")) { Kube -n cloudtask rollout status "deployment/$name" --timeout=240s }
$pvc = Kube -n cloudtask get pvc mongodb-pvc -o json | ConvertFrom-Json
if ($pvc.status.phase -ne "Bound") { throw "MongoDB PVC is not Bound" }
& "$PSScriptRoot/smoke-test.ps1" -BaseUrl $BaseUrl
if ($TestScaling) {
  foreach ($name in @("task-service", "analytics-service", "frontend-service")) {
    $before = (Kube -n cloudtask get deployments -o json | ConvertFrom-Json).items
    $original = ($before | Where-Object { $_.metadata.name -eq $name }).spec.replicas
    try {
      Kube -n cloudtask scale "deployment/$name" "--replicas=$($original + 1)"
      Kube -n cloudtask rollout status "deployment/$name" --timeout=240s
      $after = (Kube -n cloudtask get deployments -o json | ConvertFrom-Json).items
      foreach ($dep in $before) {
        $actual = $after | Where-Object { $_.metadata.name -eq $dep.metadata.name }
        $expected = $dep.spec.replicas
        if ($dep.metadata.name -eq $name) { $expected++ }
        if ($actual.spec.replicas -ne $expected -or $actual.status.readyReplicas -ne $expected) { throw "Independent scaling verification failed" }
      }
      & "$PSScriptRoot/smoke-test.ps1" -BaseUrl $BaseUrl
    } finally { Kube -n cloudtask scale "deployment/$name" "--replicas=$original"; Kube -n cloudtask rollout status "deployment/$name" --timeout=240s }
  }
}
if ($TestPersistence) {
  $tasks = @()
  try {
    1..3 | ForEach-Object { $tasks += Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/tasks" -ContentType application/json -Body (@{title="Persistence probe $([guid]::NewGuid())"} | ConvertTo-Json) }
    $old = (Kube -n cloudtask get pods -l app=mongodb -o json | ConvertFrom-Json).items.metadata.uid
    Kube -n cloudtask delete pod -l app=mongodb --wait=true
    Kube -n cloudtask rollout status deployment/mongodb --timeout=240s
    Kube -n cloudtask rollout status deployment/task-service --timeout=240s
    $new = (Kube -n cloudtask get pods -l app=mongodb -o json | ConvertFrom-Json).items.metadata.uid
    if (@($new | Where-Object { $old -contains $_ }).Count) { throw "MongoDB pod was not replaced" }
    foreach ($task in $tasks) {
      $found = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/$($task._id)"
      if ($found.title -ne $task.title) { throw "Persistence verification failed" }
    }
    Write-Host "PASS: Three tasks survived MongoDB pod replacement."
  } finally { foreach ($task in $tasks) { Invoke-RestMethod -Method Delete -Uri "$BaseUrl/api/tasks/$($task._id)" } }
}
Kube -n cloudtask get "pods,deployments,services,pvc" -o wide
Write-Host "PASS: requested deployment checks. URL: $BaseUrl"
