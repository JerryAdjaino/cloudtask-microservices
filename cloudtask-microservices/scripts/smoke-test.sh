#!/usr/bin/env sh
set -eu
BASE_URL="${1:-http://localhost:30080}"

echo "Checking frontend health..."
curl -fsS "$BASE_URL/health"
echo

echo "Creating a demo task..."
TASK_JSON=$(curl -fsS -X POST "$BASE_URL/api/tasks" \
  -H 'content-type: application/json' \
  -d '{"title":"Kubernetes smoke test","description":"Created by smoke-test.sh","priority":"high"}')
echo "$TASK_JSON"

echo "Listing tasks..."
curl -fsS "$BASE_URL/api/tasks"
echo

echo "Checking analytics (Analytics Service calls Task Service REST API)..."
curl -fsS "$BASE_URL/api/analytics"
echo

echo "Smoke test completed successfully."
