#!/usr/bin/env sh
set -eu

USER_NAME="${1:-adjaino}"
TAG="${2:-1.0.0}"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
KUBE_DIR="$ROOT_DIR/kubernetes"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if ! kubectl get namespace cloudtask >/dev/null 2>&1; then
  kubectl apply -f "$KUBE_DIR/00-namespace.yaml"
fi

if ! kubectl -n cloudtask get secret mongodb-secret >/dev/null 2>&1; then
  echo "ERROR: Secret 'mongodb-secret' does not exist in namespace 'cloudtask'."
  echo "Create mongodb-secret with MONGO_USERNAME and MONGO_PASSWORD, or use deploy-kubernetes.ps1 for secure automatic initialization."
  exit 1
fi

for file in 10-configmap.yaml 11-mongodb-pvc.yaml 12-mongodb.yaml; do
  kubectl apply -f "$KUBE_DIR/$file"
done

for file in 20-task-service.yaml 30-analytics-service.yaml 40-frontend-service.yaml; do
  sed "s#adjaino/cloudtask:#${USER_NAME}/cloudtask:#g; s#-1.0.0#-${TAG}#g" "$KUBE_DIR/$file" > "$TMP_DIR/$file"
  kubectl apply -f "$TMP_DIR/$file"
done

kubectl -n cloudtask rollout status deployment/mongodb --timeout=180s
kubectl -n cloudtask rollout status deployment/task-service --timeout=180s
kubectl -n cloudtask rollout status deployment/analytics-service --timeout=180s
kubectl -n cloudtask rollout status deployment/frontend-service --timeout=180s
kubectl -n cloudtask get pods
kubectl -n cloudtask get svc
