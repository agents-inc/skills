# Kubernetes -- Operations Examples

> HPA autoscaling, RBAC, health checks, resource limits, PodDisruptionBudget, NetworkPolicy, and Pod Security. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) - Deployments, Services, Ingress, ConfigMaps, Secrets
- [helm.md](helm.md) - Helm chart structure, values, templates, helpers

---

## Example 1: HPA with Multiple Metrics and Scaling Behavior

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server
  namespace: app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 2
  maxReplicas: 20
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
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 4
          periodSeconds: 60
        - type: Percent
          value: 100
          periodSeconds: 60
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
      selectPolicy: Min
```

**Why good:** Uses stable `autoscaling/v2` with `metrics` array, both CPU and memory targets, scale-up allows aggressive burst (max of 4 pods or 100% increase per minute), scale-down is conservative (1 pod every 2 minutes, 5-minute stabilization) to prevent flapping

**Gotcha:** Remove `spec.replicas` from the Deployment when HPA is active -- otherwise `helm upgrade` or `kubectl apply` resets the replica count on every deployment.

---

## Example 2: RBAC Patterns

### Namespaced Role (Preferred)

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
    resources: ["configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
    resourceNames: ["api-secrets"] # Restrict to specific secret
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

**Why good:** Namespaced Role (not ClusterRole), specific resources and verbs (not wildcards), `resourceNames` further restricts secret access to named resources, `automountServiceAccountToken: false` prevents unnecessary API access

### ClusterRole (When Required)

Use ClusterRole only when a workload genuinely needs cluster-wide access (e.g., operators, controllers, monitoring agents).

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: namespace-reader
rules:
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-namespace-reader
subjects:
  - kind: ServiceAccount
    name: monitoring
    namespace: monitoring
roleRef:
  kind: ClusterRole
  name: namespace-reader
  apiGroup: rbac.authorization.k8s.io
```

**When to use ClusterRole:**

- Reading namespaces or nodes (cluster-scoped resources)
- Custom operators that watch resources across namespaces
- Monitoring/logging agents that collect from all namespaces

---

## Example 3: Health Check Patterns

### HTTP Probes (Most Common)

```yaml
containers:
  - name: api-server
    livenessProbe:
      httpGet:
        path: /healthz
        port: 3000
      initialDelaySeconds: 15
      periodSeconds: 20
      timeoutSeconds: 5
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /ready
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 3
    startupProbe:
      httpGet:
        path: /healthz
        port: 3000
      failureThreshold: 30
      periodSeconds: 10
```

**Probe design:**

- `/healthz` (liveness) -- Is the process alive? Check basic responsiveness only. Do NOT check external dependencies (database, Redis). A false-negative restarts a healthy pod.
- `/ready` (readiness) -- Can this pod serve traffic? Check that connections to required dependencies are established.
- Startup probe -- Gives slow-starting apps time to initialize. Blocks liveness/readiness until successful. `failureThreshold * periodSeconds` = max startup time (300s here).

### TCP Probe (Non-HTTP Services)

```yaml
containers:
  - name: database
    livenessProbe:
      tcpSocket:
        port: 5432
      periodSeconds: 20
    readinessProbe:
      tcpSocket:
        port: 5432
      periodSeconds: 10
```

### Exec Probe (Custom Check)

```yaml
containers:
  - name: worker
    livenessProbe:
      exec:
        command:
          - /bin/sh
          - -c
          - "test -f /tmp/healthy"
      periodSeconds: 30
```

### gRPC Probe (gRPC Services)

```yaml
containers:
  - name: grpc-service
    livenessProbe:
      grpc:
        port: 50051
      periodSeconds: 20
    readinessProbe:
      grpc:
        port: 50051
      periodSeconds: 10
```

---

## Example 4: Resource Limits and QoS

### Guaranteed QoS (Critical Services)

```yaml
# requests == limits = Guaranteed QoS class
# Highest priority, never evicted under memory pressure
containers:
  - name: payment-service
    resources:
      requests:
        cpu: 500m
        memory: 512Mi
      limits:
        cpu: 500m
        memory: 512Mi
```

### Burstable QoS (Typical Workloads)

```yaml
# requests < limits = Burstable QoS class
# Can burst above requests when resources available
containers:
  - name: api-server
    resources:
      requests:
        cpu: 250m
        memory: 256Mi
      limits:
        cpu: "1"
        memory: 512Mi
```

**Sizing guidance:**

- Set memory requests at 90th percentile of observed usage
- Set memory limits at 150-200% of requests to allow spikes without OOMKill
- Set CPU requests based on sustained usage, limits based on peak
- CPU throttling (hitting limit) causes latency spikes but NOT kills
- Memory exceeding limits causes OOMKill -- the container is terminated and restarted

---

## Example 5: PodDisruptionBudget

Ensures minimum availability during voluntary disruptions (node drain, cluster upgrade, rolling update).

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-server
  namespace: app
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: api-server
```

**Alternative: maxUnavailable**

```yaml
spec:
  maxUnavailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: api-server
```

**When to use which:**

- `minAvailable: N` -- Use when you know the minimum pod count for service health
- `maxUnavailable: N` -- Use when you want to limit disruption rate (better for larger deployments)
- Cannot set both `minAvailable` and `maxUnavailable`
- PDB only protects against **voluntary** disruptions (drain, upgrade) -- not OOMKill or node failure

---

## Example 6: NetworkPolicy

Restrict pod-to-pod traffic. By default, all pods can communicate with all other pods.

### Allow Only Specific Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-server-policy
  namespace: app
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: api-server
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow traffic from ingress controller
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - port: 3000
          protocol: TCP
    # Allow traffic from frontend pods
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: frontend
      ports:
        - port: 3000
          protocol: TCP
  egress:
    # Allow DNS
    - to:
        - namespaceSelector: {}
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
    # Allow database
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: database
      ports:
        - port: 5432
          protocol: TCP
```

**Why good:** Explicit ingress sources (ingress controller and frontend only), explicit egress (DNS and database only), all other traffic implicitly denied once a NetworkPolicy selects a pod

**Gotcha:** NetworkPolicy requires a CNI plugin that supports it (Calico, Cilium, Weave). The default kubenet CNI ignores NetworkPolicy.

### Default Deny All (Namespace-Level)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: app
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

**Why useful:** Apply as baseline, then add allow policies for specific communication paths. Empty `podSelector` selects all pods in the namespace.

---

## Example 7: Pod Security Context (Restricted Profile)

The complete restricted security context that satisfies the Pod Security Standards restricted level.

### Pod Level

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
```

### Container Level

```yaml
containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      runAsNonRoot: true
      capabilities:
        drop: ["ALL"]
```

### Handling readOnlyRootFilesystem

Apps that write to `/tmp`, `/var/cache`, or similar directories need `emptyDir` volume mounts:

```yaml
containers:
  - name: app
    securityContext:
      readOnlyRootFilesystem: true
    volumeMounts:
      - name: tmp
        mountPath: /tmp
      - name: cache
        mountPath: /var/cache
volumes:
  - name: tmp
    emptyDir: {}
  - name: cache
    emptyDir:
      sizeLimit: 100Mi
```

---

## Anti-Patterns

### Bad: Liveness Probe Checks External Dependencies

```yaml
# BAD: Liveness probe checks database connectivity
livenessProbe:
  httpGet:
    path: /health # Returns 500 if database is down
    port: 3000
```

**Why bad:** If the database goes down, ALL pods fail their liveness probe and get restarted simultaneously. The pods are healthy -- they just can't reach the database. This turns a dependency outage into a cascading failure. Check external dependencies in readiness probe only.

### Bad: No PDB with Multiple Replicas

```yaml
# BAD: 3 replicas but no PDB -- node drain can take all 3 down
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 3
  # No PodDisruptionBudget defined
```

**Why bad:** During a cluster upgrade or node drain, all 3 pods could be evicted simultaneously if they happen to be on the same node or on nodes being drained in sequence. Always pair multi-replica Deployments with a PDB.
