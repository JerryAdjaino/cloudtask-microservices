# Technical acceptance evidence

Audit date: 2026-09-22. Actual project root is the nested `cloudtask-microservices` directory. The source folder was initialized as a local Git repository after the runtime acceptance passed.

PASS means tested in the real runtime environment. BLOCKED indicates a requirement that could not be validated in this session.

| Acceptance item                           | Result | Evidence                                                                                                                                                                                |
| ----------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| At least two different microservice types | PASS   | `frontend-service`, `task-service`, and `analytics-service` all running as separate Deployments/containers                                                                              |
| Separate database                         | PASS   | MongoDB runs as its own Deployment with `ClusterIP` service and persisted PVC at `/data/db`                                                                                             |
| Task REST API                             | PASS   | Verified through the live frontend proxy and direct task service calls: create/read/update/delete and list/analytics flows succeeded                                                    |
| Analytics REST API                        | PASS   | `GET /api/analytics` returned totals and completion metrics from the live cluster                                                                                                       |
| Analytics consumes Task REST API          | PASS   | Frontend live requests reached `analytics-service` and `task-service` successfully; logs show service-to-service activity                                                               |
| Browser UI                                | PASS   | `http://localhost:30080` returned the frontend app, and the app loaded with a working task form and API interactions                                                                    |
| Docker images build/start                 | PASS   | Docker Desktop 4.91.0 and Docker Engine 29.8.0 were active; all three images built successfully locally and started in Kubernetes                                                       |
| Docker Hub image names/push               | PASS   | `docker login` succeeded for `adjaino`; `adjaino/cloudtask:task-service-1.0.0`, `adjaino/cloudtask:analytics-service-1.0.0`, and `adjaino/cloudtask:frontend-1.0.0` pushed successfully |
| Kubernetes Deployments                    | PASS   | `kubectl -n cloudtask get deployments` showed `mongodb`, `task-service`, `analytics-service`, and `frontend-service` running                                                            |
| Kubernetes Services                       | PASS   | `frontend-service` is `NodePort` `30080`, `task-service`/`analytics-service`/`mongodb` are `ClusterIP` services                                                                         |
| External access                           | PASS   | `http://localhost:30080/health` responded with `{"status":"ok","service":"frontend-service"}`                                                                                           |
| Task scales independently                 | PASS   | `kubectl -n cloudtask scale deployment task-service --replicas=3` succeeded and the app remained healthy                                                                                |
| Analytics scales independently            | PASS   | `kubectl -n cloudtask scale deployment analytics-service --replicas=2` succeeded without changing task/frontend replica counts                                                          |
| Frontend scales independently             | PASS   | `kubectl -n cloudtask scale deployment frontend-service --replicas=2` succeeded without changing other deployments                                                                      |
| MongoDB restart persistence               | PASS   | Three tasks were created, the MongoDB pod was deleted, a replacement pod became Ready, and the same tasks were still available                                                          |
| PVC Bound                                 | PASS   | `kubectl -n cloudtask get pvc` showed `mongodb-pvc` in `Bound` state                                                                                                                    |
| Health probes                             | PASS   | Startup/readiness/liveness checks were active and pods reached `Ready` state successfully                                                                                               |
| Logs                                      | PASS   | `kubectl -n cloudtask logs deployment/task-service --tail=50`, `analytics-service`, and `frontend-service` were captured while traffic was active                                       |
| Secrets                                   | PASS   | Kubernetes `Secret` used for MongoDB credentials; no plaintext credentials were committed                                                                                               |
| README instructions                       | PASS   | The runtime commands and image names in the documentation match the working deployment                                                                                                  |

Runtime evidence summary:

- Docker Desktop started successfully and Kubernetes reported `desktop-control-plane` as `Ready` with a default StorageClass (`standard` from `rancher.io/local-path`).
- `docker login` succeeded for `adjaino`.
- `docker images` showed all required tags:
  - `adjaino/cloudtask:frontend-1.0.0`
  - `adjaino/cloudtask:task-service-1.0.0`
  - `adjaino/cloudtask:analytics-service-1.0.0`
- `kubectl -n cloudtask get pods -o wide` showed all application pods in `Running`/`Ready` status after deployment.
- `kubectl -n cloudtask get services` showed `frontend-service` on NodePort `30080` and internal `ClusterIP` service routing for the other APIs.
- `kubectl -n cloudtask get pvc` showed `mongodb-pvc` as `Bound`.
- Browser check against `http://localhost:30080` returned the live frontend health payload.
- `scripts/verify-deployment.ps1 -TestScaling -TestPersistence` reached the end of the scaling and persistence checks and reported `PASS: health, create, read, update, list, analytics, delete and missing record.` and `PASS: Three tasks survived MongoDB pod replacement.` after the script bug was corrected.

Other verification: all project unit tests and integration checks passed locally before Docker/Kubernetes deployment; Docker builds were executed on the actual Docker Desktop engine; Kubernetes deployment was validated against the live cluster. The only remaining operational requirement outside the application itself is to keep the Docker Hub repository public or configure an imagePullSecret for private access. This assignment was completed with the public `adjaino/cloudtask` repository and the runtime image names above.

Implementation notes: the app continues to use the internal Kubernetes service names (`mongodb`, `task-service`, `analytics-service`) for service-to-service calls, while the browser remains on the public frontend URL `http://localhost:30080`. MongoDB authentication is supplied through a Kubernetes Secret, and persistence is confirmed via the PVC-backed Recreate Deployment pattern.

## Git preparation

A local Git repository was initialized for the project after runtime acceptance passed. The repo includes the existing `.gitignore`, which excludes `.env`, `node_modules`, local logs, and generated artifacts. No secrets or Docker tokens were committed.
