#!/usr/bin/env sh
set -eu

USER_NAME="${1:-adjaino}"
TAG="${2:-1.0.0}"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

docker build -t "${USER_NAME}/cloudtask:task-service-$TAG" "$ROOT_DIR/task-service"
docker build -t "${USER_NAME}/cloudtask:analytics-service-$TAG" "$ROOT_DIR/analytics-service"
docker build -t "${USER_NAME}/cloudtask:frontend-$TAG" "$ROOT_DIR/frontend-service"

docker push "${USER_NAME}/cloudtask:task-service-$TAG"
docker push "${USER_NAME}/cloudtask:analytics-service-$TAG"
docker push "${USER_NAME}/cloudtask:frontend-$TAG"

echo "Images pushed successfully."
