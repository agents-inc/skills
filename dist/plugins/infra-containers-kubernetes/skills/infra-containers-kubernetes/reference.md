# Kubernetes Quick Reference

> Stable API versions, kubectl commands, label conventions, and decision tables. Reference from [SKILL.md](SKILL.md).

---

## Stable API Versions (Kubernetes 1.30+)

| Resource                         | apiVersion                     | Stable Since |
| -------------------------------- | ------------------------------ | ------------ |
| Deployment                       | `apps/v1`                      | v1.9         |
| StatefulSet                      | `apps/v1`                      | v1.9         |
| DaemonSet                        | `apps/v1`                      | v1.9         |
| ReplicaSet                       | `apps/v1`                      | v1.9         |
| Service                          | `v1`                           | v1.0         |
| ConfigMap                        | `v1`                           | v1.0         |
| Secret                           | `v1`                           | v1.0         |
| Namespace                        | `v1`                           | v1.0         |
| ServiceAccount                   | `v1`                           | v1.0         |
| PersistentVolumeClaim            | `v1`                           | v1.0         |
| Ingress                          | `networking.k8s.io/v1`         | v1.19        |
| IngressClass                     | `networking.k8s.io/v1`         | v1.19        |
| NetworkPolicy                    | `networking.k8s.io/v1`         | v1.7         |
| HorizontalPodAutoscaler          | `autoscaling/v2`               | v1.23        |
| PodDisruptionBudget              | `policy/v1`                    | v1.21        |
| Job                              | `batch/v1`                     | v1.0         |
| CronJob                          | `batch/v1`                     | v1.21        |
| Role / ClusterRole               | `rbac.authorization.k8s.io/v1` | v1.8         |
| RoleBinding / ClusterRoleBinding | `rbac.authorization.k8s.io/v1` | v1.8         |

---

## Removed API Versions (Do NOT Use)

| Resource            | Removed apiVersion          | Removed In | Use Instead            |
| ------------------- | --------------------------- | ---------- | ---------------------- |
| Ingress             | `extensions/v1beta1`        | v1.22      | `networking.k8s.io/v1` |
| Ingress             | `networking.k8s.io/v1beta1` | v1.22      | `networking.k8s.io/v1` |
| CronJob             | `batch/v1beta1`             | v1.25      | `batch/v1`             |
| HPA                 | `autoscaling/v2beta1`       | v1.25      | `autoscaling/v2`       |
| HPA                 | `autoscaling/v2beta2`       | v1.26      | `autoscaling/v2`       |
| PodDisruptionBudget | `policy/v1beta1`            | v1.25      | `policy/v1`            |
| PodSecurityPolicy   | `policy/v1beta1`            | v1.25      | Pod Security Admission |

---

## Standard Labels (app.kubernetes.io)

| Label                          | Purpose                       | Example           |
| ------------------------------ | ----------------------------- | ----------------- |
| `app.kubernetes.io/name`       | Application name              | `api-server`      |
| `app.kubernetes.io/instance`   | Unique instance of the app    | `api-server-prod` |
| `app.kubernetes.io/version`    | Application version           | `1.2.3`           |
| `app.kubernetes.io/component`  | Component within architecture | `backend`         |
| `app.kubernetes.io/part-of`    | Higher-level application      | `my-platform`     |
| `app.kubernetes.io/managed-by` | Tool managing this resource   | `helm`            |

---

## kubectl Essential Commands

```bash
# Apply manifests (declarative, idempotent)
kubectl apply -f manifest.yaml
kubectl apply -k overlays/production/     # Kustomize

# Inspect resources
kubectl get pods -n app -o wide
kubectl describe deployment api-server -n app
kubectl logs -f deployment/api-server -n app --tail=100

# Debug
kubectl exec -it pod/api-server-abc123 -n app -- sh
kubectl port-forward svc/api-server 3000:80 -n app
kubectl top pods -n app                   # Requires metrics-server

# Rollout management
kubectl rollout status deployment/api-server -n app
kubectl rollout history deployment/api-server -n app
kubectl rollout undo deployment/api-server -n app
kubectl rollout restart deployment/api-server -n app  # Force rolling restart

# Dry run and diff
kubectl apply -f manifest.yaml --dry-run=server  # Server-side validation
kubectl diff -f manifest.yaml                     # Show what would change

# Resource cleanup
kubectl delete -f manifest.yaml
kubectl delete pod api-server-abc123 -n app --grace-period=30
```

---

## Probe Types

| Probe Type       | Purpose                        | Failure Action                         |
| ---------------- | ------------------------------ | -------------------------------------- |
| `livenessProbe`  | Is the process healthy?        | Restart the container                  |
| `readinessProbe` | Can the pod serve traffic?     | Remove from Service endpoints          |
| `startupProbe`   | Has the app finished starting? | Block liveness/readiness until success |

**Probe mechanisms:** `httpGet`, `tcpSocket`, `exec`, `grpc`

**Timing fields:** `initialDelaySeconds`, `periodSeconds`, `timeoutSeconds`, `failureThreshold`, `successThreshold`

---

## Resource Units

| Resource | Unit        | Examples                         |
| -------- | ----------- | -------------------------------- |
| CPU      | Millicores  | `100m` = 0.1 CPU, `"1"` = 1 CPU  |
| Memory   | Bytes (IEC) | `128Mi` = 128 MiB, `1Gi` = 1 GiB |

**QoS classes:**

- **Guaranteed:** requests == limits (highest priority, no eviction under pressure)
- **Burstable:** requests < limits (typical, evicted after BestEffort)
- **BestEffort:** no requests/limits (first to be evicted)

---

## Pod Security Standards

| Level      | Enforcement               | Key Controls                                                                |
| ---------- | ------------------------- | --------------------------------------------------------------------------- |
| Privileged | No restrictions           | System workloads only                                                       |
| Baseline   | Prevents known escalation | No privileged, no hostNetwork/PID/IPC, no hostPath                          |
| Restricted | Full hardening            | runAsNonRoot, drop ALL caps, readOnlyRootFilesystem, seccomp RuntimeDefault |

**Enforce via namespace labels:**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: app
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

---

## Helm Commands

```bash
# Create / Install / Upgrade
helm create my-app                              # Scaffold new chart
helm install my-release ./my-app                # Install from local chart
helm upgrade my-release ./my-app -f values-prod.yaml  # Upgrade with values
helm upgrade --install my-release ./my-app      # Install or upgrade

# Inspect
helm list -n app                                # List releases
helm status my-release -n app                   # Release status
helm get values my-release -n app               # Current values
helm template my-release ./my-app               # Render templates locally

# Rollback
helm rollback my-release 1 -n app               # Rollback to revision 1
helm history my-release -n app                   # Release history

# Diff (requires helm-diff plugin)
helm diff upgrade my-release ./my-app -f values-prod.yaml
```
