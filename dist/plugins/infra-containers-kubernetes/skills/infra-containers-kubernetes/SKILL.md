---
name: infra-containers-kubernetes
description: Kubernetes manifests, Helm charts, Kustomize overlays, and resource patterns
---

# Kubernetes Patterns

> **Quick Guide:** Declarative YAML manifests for Kubernetes workloads. Use `apps/v1` Deployments with resource requests/limits, health probes, and Pod Security Standards (restricted profile). Helm for templated multi-environment releases. Kustomize for patch-based overlays without templating. Always set `securityContext` (runAsNonRoot, drop ALL capabilities, readOnlyRootFilesystem), resource requests/limits on every container, and liveness/readiness probes on every pod.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST set resource requests AND limits on every container -- pods without requests are unschedulable under resource pressure and pods without limits can OOM-kill neighbors)**

**(You MUST set securityContext with runAsNonRoot: true, allowPrivilegeEscalation: false, drop ALL capabilities, and readOnlyRootFilesystem: true on every container)**

**(You MUST define both liveness and readiness probes -- without readiness probes, traffic reaches unready pods; without liveness probes, hung processes are never restarted)**

**(You MUST use the current stable apiVersion for each resource -- apps/v1 for Deployments, networking.k8s.io/v1 for Ingress, autoscaling/v2 for HPA, policy/v1 for PDB)**

</critical_requirements>

---

## Examples

- [Core Manifests](examples/core.md) - Deployments, Services, Ingress, ConfigMaps, Secrets, Namespaces
- [Helm Charts](examples/helm.md) - Chart structure, values.yaml, templates, helpers, dependencies
- [Operations](examples/operations.md) - HPA scaling, RBAC, health checks, resource limits, PDB, NetworkPolicy
- [Quick Reference](reference.md) - API versions, kubectl commands, label conventions, decision frameworks

---

**Auto-detection:** Kubernetes, kubectl, k8s, Deployment, Service, Ingress, ConfigMap, Secret, HPA, HorizontalPodAutoscaler, Helm, helm chart, Kustomize, kustomization, RBAC, Role, ClusterRole, PodDisruptionBudget, NetworkPolicy, Pod, StatefulSet, DaemonSet, CronJob, Job, PersistentVolumeClaim, apiVersion, kind, metadata, spec

**When to use:**

- Writing Kubernetes Deployment, Service, Ingress, or other resource manifests
- Creating Helm charts for templated multi-environment releases
- Building Kustomize overlays for environment-specific patches
- Configuring RBAC roles and bindings for least-privilege access
- Setting up HPA autoscaling, PDB, or resource limits
- Defining health checks (liveness, readiness, startup probes)
- Managing ConfigMaps, Secrets, and environment configuration
- Writing NetworkPolicy for pod-to-pod traffic control

**When NOT to use:**

- Container image building (use a containerization skill)
- CI/CD pipeline definitions (use a CI/CD skill)
- Infrastructure provisioning (use an IaC tool)
- Service mesh configuration beyond basic Kubernetes resources
- Managed Kubernetes cluster setup (cloud provider control plane configuration)

**Key patterns covered:**

- Deployment with security context, resource limits, and probes
- Service types (ClusterIP, NodePort, LoadBalancer, Headless)
- Ingress with TLS and path routing (networking.k8s.io/v1)
- ConfigMap and Secret management (envFrom, volume mounts)
- HPA autoscaling (autoscaling/v2 metrics array)
- RBAC (Role, ClusterRole, RoleBinding, ServiceAccount)
- Pod Security Standards (restricted profile)
- Helm chart structure, values, templates, and helpers
- Kustomize base/overlay pattern with strategic merge patches
- PodDisruptionBudget for safe rollouts
- NetworkPolicy for pod traffic isolation

---

<philosophy>

## Philosophy

Kubernetes is a declarative container orchestration platform. You describe the **desired state** in YAML manifests and Kubernetes continuously reconciles actual state to match. Every resource should be version-controlled, reproducible, and deployable via `kubectl apply` or a GitOps pipeline.

**Core principles:**

1. **Declarative over imperative** -- Use `kubectl apply -f` with manifests, not `kubectl run` or `kubectl create`
2. **Security by default** -- Every pod runs as non-root, drops all capabilities, uses read-only root filesystem
3. **Resource-aware** -- Every container declares requests (scheduling guarantee) and limits (ceiling)
4. **Observable** -- Every pod has health probes so the platform can detect and recover from failures
5. **Least privilege** -- RBAC grants only the permissions each workload needs, scoped to namespace when possible

**Helm vs Kustomize:**

- **Helm** -- Templating engine with package management. Use when you need parameterized releases, dependency management, or you distribute charts to others
- **Kustomize** -- Patch-based overlays built into kubectl. Use when you want to keep base manifests as valid YAML and apply environment-specific patches without templating

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Production Deployment

A production-ready Deployment includes security context, resource limits, health probes, and standard labels.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  labels:
    app.kubernetes.io/name: api-server
    app.kubernetes.io/component: backend
spec:
  replicas: 3
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app.kubernetes.io/name: api-server
  template:
    metadata:
      labels:
        app.kubernetes.io/name: api-server
        app.kubernetes.io/component: backend
    spec:
      serviceAccountName: api-server
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: api-server
          image: registry.example.com/api-server:v1.2.3
          ports:
            - containerPort: 3000
              protocol: TCP
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
```

**Why good:** Restricted security context (non-root, drop ALL, read-only FS, seccomp), resource requests AND limits, both liveness and readiness probes, standard `app.kubernetes.io` labels, pinned image tag (not `:latest`), dedicated service account with token auto-mount disabled

See [examples/core.md](examples/core.md) for the full Deployment with matching Service, Ingress, and ConfigMap.

---

### Pattern 2: Service Types

Services expose pods to network traffic. Choose the type based on who needs access.

```yaml
# ClusterIP (default) -- internal traffic only
apiVersion: v1
kind: Service
metadata:
  name: api-server
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: api-server
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
```

**When to use each type:**

- **ClusterIP** (default) -- Internal services, microservice-to-microservice communication
- **NodePort** -- Development/testing, direct node access (ports 30000-32767)
- **LoadBalancer** -- External traffic via cloud provider load balancer
- **Headless** (`clusterIP: None`) -- StatefulSet DNS discovery, direct pod addressing

See [examples/core.md](examples/core.md) for all service type examples.

---

### Pattern 3: Ingress with TLS

Ingress routes external HTTP/HTTPS traffic to Services. Uses `networking.k8s.io/v1` (stable since 1.19).

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-server
                port:
                  number: 80
```

**Why good:** Uses stable `networking.k8s.io/v1`, `ingressClassName` field (not deprecated annotation), TLS termination with Secret reference, explicit `pathType`

See [examples/core.md](examples/core.md) for multi-path Ingress and path type comparison.

---

### Pattern 4: ConfigMap and Secret Management

ConfigMaps hold non-sensitive configuration; Secrets hold sensitive data (base64-encoded, not encrypted at rest by default).

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"
---
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@db:5432/app"
```

**Injection patterns:**

- `envFrom` -- Load all keys as environment variables (simple, flat config)
- `env.valueFrom` -- Select individual keys (when you need only specific values)
- Volume mount -- Mount as files (when apps read config from filesystem)

See [examples/core.md](examples/core.md) for envFrom, selective env, and volume mount examples.

---

### Pattern 5: Helm Chart Structure

Helm charts package Kubernetes manifests as reusable, parameterized releases.

```
my-app/
  Chart.yaml          # apiVersion: v2, name, version, appVersion
  values.yaml         # Default configuration values
  templates/
    deployment.yaml   # Templated Deployment
    service.yaml      # Templated Service
    ingress.yaml      # Templated Ingress (conditional)
    _helpers.tpl      # Named template definitions
    NOTES.txt         # Post-install message
```

```yaml
# Chart.yaml
apiVersion: v2
name: my-app
description: A Helm chart for my application
type: application
version: 0.1.0
appVersion: "1.0.0"
```

**Key principles:** Values that change between environments go in `values.yaml`, not in templates. Keep template logic minimal -- complex conditionals belong in `_helpers.tpl` as named templates.

See [examples/helm.md](examples/helm.md) for complete chart with templates, helpers, values, and multi-environment overrides.

---

### Pattern 6: Kustomize Base/Overlay

Kustomize patches valid YAML manifests without templating. Base manifests stay deployable as-is.

```
k8s/
  base/
    kustomization.yaml
    deployment.yaml
    service.yaml
  overlays/
    staging/
      kustomization.yaml
      replica-patch.yaml
    production/
      kustomization.yaml
      replica-patch.yaml
      resource-patch.yaml
```

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml

# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
patches:
  - path: replica-patch.yaml
  - path: resource-patch.yaml
namespace: production
commonLabels:
  env: production
```

**Why good:** Base manifests are valid `kubectl apply` targets, overlays only contain diffs, no template syntax to learn, built into `kubectl apply -k`

See [examples/helm.md](examples/helm.md) for Kustomize patches and secretGenerator.

---

### Pattern 7: RBAC Least Privilege

Grant only the permissions each workload needs. Prefer namespaced Role over cluster-wide ClusterRole.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-server
  namespace: app
automountServiceAccountToken: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: api-server-role
  namespace: app
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-server-binding
  namespace: app
subjects:
  - kind: ServiceAccount
    name: api-server
    namespace: app
roleRef:
  kind: Role
  name: api-server-role
  apiGroup: rbac.authorization.k8s.io
```

**Why good:** Dedicated service account (not default), auto-mount disabled, namespaced Role (not ClusterRole), specific resources and verbs (not wildcard `*`)

See [examples/operations.md](examples/operations.md) for ClusterRole patterns and when to use them.

---

### Pattern 8: HPA Autoscaling

Use `autoscaling/v2` (stable since 1.23). The `metrics` array replaces the old `targetCPUUtilizationPercentage` field.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

**Why good:** Uses stable `autoscaling/v2` with `metrics` array (not deprecated `targetCPUUtilizationPercentage`), both CPU and memory metrics, scale-down stabilization prevents flapping

See [examples/operations.md](examples/operations.md) for custom metrics and scaling behavior configuration.

</patterns>

---

<decision_framework>

## Decision Framework

### Helm vs Kustomize

```
Do you distribute charts to external teams?
  +-- YES --> Helm (package management, versioned releases)
  +-- NO  --> Do you need Go templating / conditionals?
      +-- YES --> Helm (parameterized templates)
      +-- NO  --> Do you prefer plain YAML with patches?
          +-- YES --> Kustomize (built into kubectl, no templating)
          +-- NO  --> Either works. Choose team familiarity.
```

### Workload Type Selection

```
What is the workload?
  +-- Stateless HTTP/API server? --> Deployment
  +-- Needs stable network identity / ordered startup? --> StatefulSet
  +-- Must run on every node (logging, monitoring)? --> DaemonSet
  +-- One-time batch job? --> Job
  +-- Scheduled recurring job? --> CronJob
```

### Service Type Selection

```
Who needs to reach this service?
  +-- Other pods in the cluster? --> ClusterIP (default)
  +-- External traffic via HTTP/HTTPS? --> ClusterIP + Ingress
  +-- External TCP/UDP without Ingress? --> LoadBalancer
  +-- Direct node access (dev/test)? --> NodePort
  +-- StatefulSet pod discovery? --> Headless (clusterIP: None)
```

### Resource Requests vs Limits

```
What QoS class do you need?
  +-- Guaranteed (critical workloads) --> requests == limits
  +-- Burstable (typical workloads) --> requests < limits
  +-- BestEffort (batch, non-critical) --> no requests/limits (NOT recommended for production)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing `resources.requests` and `resources.limits` on containers -- unschedulable under pressure, can OOM-kill neighbors
- Running as root (no `securityContext.runAsNonRoot: true`) -- container escape gives host root access
- Using `:latest` image tag -- non-deterministic deployments, impossible to roll back to known version
- Missing liveness/readiness probes -- hung processes never restart, traffic hits unready pods
- Using deprecated apiVersions (`extensions/v1beta1`, `autoscaling/v2beta2`) -- will fail on modern clusters
- Wildcard RBAC rules (`verbs: ["*"]`, `resources: ["*"]`) -- violates least privilege, security risk
- Storing actual secrets in manifests committed to Git -- use sealed secrets or external secret operators

**Medium Priority Issues:**

- `automountServiceAccountToken` not set to false -- every pod gets a token that can access the API server
- No `PodDisruptionBudget` -- cluster upgrades or node drains can terminate all replicas simultaneously
- No `NetworkPolicy` -- all pods can communicate with all other pods by default
- Using `spec.targetCPUUtilizationPercentage` in HPA -- deprecated in `autoscaling/v2`, use `metrics` array
- Missing `revisionHistoryLimit` on Deployments -- unlimited old ReplicaSets consume etcd storage
- ConfigMap/Secret changes not triggering rollout -- pods keep stale config until manually restarted

**Gotchas & Edge Cases:**

- `readOnlyRootFilesystem: true` breaks apps that write to `/tmp` -- add an `emptyDir` volume mount for `/tmp`
- `requests.memory` too low causes OOMKill; `limits.cpu` too low causes CPU throttling (latency spikes, not kills)
- Ingress `pathType: Prefix` matches `/api` AND `/api-docs` -- use `pathType: Exact` for precise matching or add trailing `/`
- Secrets are base64-encoded, NOT encrypted -- anyone with RBAC read access to secrets can decode them
- HPA and manual `replicas` in Deployment conflict -- remove `spec.replicas` from manifests when HPA is active
- `kubectl apply` vs `kubectl create` -- apply is declarative and idempotent; create fails if resource exists
- Kustomize `commonLabels` adds labels to selectors too -- changing them on existing Deployments breaks selector immutability
- Helm `lookup` function doesn't work during `helm template` (no cluster access) -- only works during `helm install/upgrade`
- Pod Security Admission enforces at namespace level via labels -- pods in unlabeled namespaces get the default (usually privileged)

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST set resource requests AND limits on every container -- pods without requests are unschedulable under resource pressure and pods without limits can OOM-kill neighbors)**

**(You MUST set securityContext with runAsNonRoot: true, allowPrivilegeEscalation: false, drop ALL capabilities, and readOnlyRootFilesystem: true on every container)**

**(You MUST define both liveness and readiness probes -- without readiness probes, traffic reaches unready pods; without liveness probes, hung processes are never restarted)**

**(You MUST use the current stable apiVersion for each resource -- apps/v1 for Deployments, networking.k8s.io/v1 for Ingress, autoscaling/v2 for HPA, policy/v1 for PDB)**

**Failure to follow these rules will produce insecure pods with root access, unschedulable workloads, unmonitored health, and manifests that fail on modern clusters.**

</critical_reminders>
