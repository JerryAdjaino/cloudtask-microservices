# CloudTask

Three independent Node/Express services demonstrate task CRUD, REST consumption and a browser frontend. MongoDB owns persistent data. See [tested acceptance results](docs/ACCEPTANCE.md): local APIs and browser passed; Docker/Kubernetes execution and Docker Hub publication are pending environment setup.

```text
Browser -> Frontend :3000 -> Task Service :4000 -> MongoDB :27017 -> PVC /data/db
                      -> Analytics :5000 -> Task Service REST API
```

Only frontend is exposed (NodePort 30080). The browser uses same-origin `/api` URLs; the frontend proxies to internal services. Analytics never accesses MongoDB.

## Local Windows development

This Windows account blocks PowerShell scripts by default. In the terminal used for the commands below, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`; this only affects that terminal session.

Prerequisites: Node.js 22+ and local MongoDB at `mongodb://localhost:27017/`. Run from the directory containing this README:

```powershell
.\scripts\start-local.ps1
```

Open http://localhost:3000. Ctrl+C stops the processes. The script installs locked dependencies and sets `MONGO_URI=mongodb://localhost:27017/cloudtask`. For service-specific configuration see ports/URLs in `docker-compose.yml` and `kubernetes/10-configmap.yaml`. Do not use the local URI inside Kubernetes.

## Fresh Windows machine: Docker and Kubernetes

Install Docker Desktop, use Linux containers, and create a single-node kubeadm cluster in the Kubernetes view. Wait for the engine and cluster to start. Ensure `docker` and `kubectl` are on PATH and the cluster has a default StorageClass. Run `docker version`, `kubectl config current-context`, `kubectl get nodes`, and `kubectl get storageclass`. Deployment uses the current kubectl context.

From this project root:

```powershell
$DockerHubUsername = 'adjaino'
$Tag = '1.0.0'
docker login
.\scripts\build-and-push.ps1 -DockerHubUsername $DockerHubUsername -Tag $Tag
.\scripts\deploy-kubernetes.ps1 -DockerHubUsername $DockerHubUsername -Tag $Tag
.\scripts\verify-deployment.ps1 -TestScaling -TestPersistence
```

Build script builds all three images, then pushes them, stopping on errors. Ensure the Docker Hub repository `adjaino/cloudtask` is public (or configure an imagePullSecret for private pulls). Deployment renders image overrides in temporary manifests before applying. It creates a random MongoDB Secret if neither Secret nor PVC exists and preserves existing credentials. If PVC exists without its Secret, restore original credentials. Changing a Secret does not change a MongoDB password already stored on disk.

Keep Docker Hub tokens and MongoDB credentials private. Do not paste tokens in chat or commit `.env`/Secret exports. Back up the Kubernetes Secret privately together with database backups. Source manifests use the three `adjaino/cloudtask` role tags shown below. Scripts default to `adjaino` and `1.0.0`, with optional username/version overrides.

Expected image names:

```text
adjaino/cloudtask:frontend-1.0.0
adjaino/cloudtask:task-service-1.0.0
adjaino/cloudtask:analytics-service-1.0.0
```

Expected Docker Desktop URL: http://localhost:30080. This URL is not yet verified on a cluster. For diagnosis: `kubectl -n cloudtask port-forward service/frontend-service 3000:3000`, then http://localhost:3000. Optional ingress needs an ingress controller and DNS/hosts mapping for `cloudtask.local`. Optional network policies require a supporting CNI; neither optional manifest is applied by default.

## Demo commands

```powershell
kubectl -n cloudtask get pods -o wide
kubectl -n cloudtask get deployments
kubectl -n cloudtask get services
kubectl -n cloudtask get pvc
kubectl -n cloudtask logs deployment/task-service --tail=50
kubectl -n cloudtask logs deployment/analytics-service --tail=50
kubectl -n cloudtask logs deployment/frontend-service --tail=50
kubectl -n cloudtask scale deployment task-service --replicas=3
kubectl -n cloudtask rollout status deployment/task-service --timeout=240s
kubectl -n cloudtask scale deployment analytics-service --replicas=2
kubectl -n cloudtask scale deployment frontend-service --replicas=2
.\scripts\verify-deployment.ps1 -TestScaling
.\scripts\verify-deployment.ps1 -TestPersistence
```

Scaling verification temporarily increases each app deployment separately, checks other replica counts and REST behavior, then restores counts. Persistence verification creates three tasks, deletes the MongoDB pod, checks that its UID changed, and retrieves the same tasks before cleaning up those test records. Run during a demonstration window because MongoDB restarts briefly interrupt writes.

```powershell
.\scripts\cleanup.ps1
```

Cleanup removes application deployments/services while retaining MongoDB, its Secret, and PVC. Namespace/PVC deletion is deliberately excluded because it risks stored data.

## Docker Compose

Copy `.env.example` to `.env`, set a private `MONGO_PASSWORD`, then `docker compose up --build`. Open http://localhost:3000. MongoDB has no public port; its named volume persists across `docker compose down`. Avoid `down -v` when retaining data.

## Tests

```powershell
node --test task-service/test/*.test.js analytics-service/test/*.test.js
node scripts/integration-test.mjs
.\scripts\smoke-test.ps1 -BaseUrl http://localhost:3000
```

Run `npm.cmd ci` in each service before tests. Integration tests require installed Google Chrome and local MongoDB, use ports 13000/14000/15000 and isolated database `cloudtask_audit`, exercise API errors, pagination, analytics beyond 1000 tasks, actual browser editing, and downstream failure. They stop their service processes afterward. Smoke test expects an already running app. Production Docker installs omit frontend test dependencies.

REST details: [docs/API.md](docs/API.md). All custom services expose `/health`; Task additionally exposes `/ready` for its database connection. Health logs go to stdout. Application pods use UID 1000, restricted capabilities and startup/readiness/liveness probes. MongoDB is one Recreate Deployment with a 1Gi ReadWriteOnce PVC at `/data/db`.

Exact source file inventory: [docs/FOLDER_STRUCTURE.txt](docs/FOLDER_STRUCTURE.txt).

## Submission work

After cluster acceptance passes, capture report screenshots and record the architecture, REST calls/logs, independent replica changes, Bound PVC, and surviving records after MongoDB pod replacement. Create a Git repository and push source/manifests to your assignment repository if required; this supplied folder currently has no Git metadata. Never submit node_modules, `.env`, Secret exports or local test logs as source.

Installation references: [Docker Desktop Windows installation](https://docs.docker.com/desktop/setup/install/windows-install/) and [Docker Desktop Kubernetes](https://docs.docker.com/desktop/use-desktop/kubernetes/).
