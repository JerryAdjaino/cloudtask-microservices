param([string]$BaseUrl = "http://localhost:30080")
$ErrorActionPreference = "Stop"
$health = Invoke-RestMethod "$BaseUrl/health"
if ($health.status -ne "ok") { throw "Unhealthy frontend" }
$task = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/tasks" -ContentType application/json -Body '{"title":"Smoke test","priority":"high"}'
try {
  $found = Invoke-RestMethod "$BaseUrl/api/tasks/$($task._id)"
  if ($found.title -ne "Smoke test") { throw "GET failed" }
  $updated = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/api/tasks/$($task._id)" -ContentType application/json -Body '{"title":"Updated smoke test","status":"completed"}'
  if ($updated.status -ne "completed" -or $updated.title -ne "Updated smoke test") { throw "PATCH failed" }
  $list = Invoke-RestMethod "$BaseUrl/api/tasks?status=completed"
  if ($list.tasks._id -notcontains $task._id) { throw "Task absent from list" }
  $stats = Invoke-RestMethod "$BaseUrl/api/analytics"
  if ($stats.byStatus.completed -lt 1 -or $stats.total -lt 1) { throw "Analytics failed" }
} finally { Invoke-RestMethod -Method Delete -Uri "$BaseUrl/api/tasks/$($task._id)" }
try { Invoke-RestMethod "$BaseUrl/api/tasks/$($task._id)"; throw "Deleted task still exists" } catch { if ([int]$_.Exception.Response.StatusCode -ne 404) { throw } }
Write-Host "PASS: health, create, read, update, list, analytics, delete and missing record."
