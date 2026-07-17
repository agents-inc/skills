# Kubernetes -- Core Manifest Examples

> Deployments, Services, Ingress, ConfigMaps, Secrets, Namespaces, and Kustomize overlays. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [helm.md](helm.md) - Helm chart structure, values, templates, helpers
- [operations.md](operations.md) - HPA, RBAC, health checks, resource limits, PDB, NetworkPolicy

---

## Example 1: Complete Application Stack

A production Deployment with matching Service, Ingress, ConfigMap, and Namespace.

### Namespace with Pod Security

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

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: app
  labels:
    app.kubernetes.io/name: api-server
    app.kubernetes.io/component: backend
    app.kubernetes.io/part-of: my-platform
spec:
  replicas: 3
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: api-server
  template:
    metadata:
      labels:
        app.kubernetes.io/name: api-server
        app.kubernetes.io/component: backend
      annotations:
        # Force rollout when ConfigMap changes
        checksum/config: '{{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}'
    spec:
      serviceAccountName: api-server
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 30
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 2000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: api-server
          image: registry.example.com/api-server:v1.2.3
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: api-config
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: DATABASE_URL
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            runAsNonRoot: true
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
              port: http
            initialDelaySeconds: 15
            periodSeconds: 20
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /healthz
              port: http
            failureThreshold: 30
            periodSeconds: 10
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
```

**Why good:** Restricted pod security context, dedicated service account with token disabled, three probe types, `emptyDir` for `/tmp` (needed because `readOnlyRootFilesystem: true`), named port for probe references, ConfigMap checksum annotation triggers rollout on config changes, rolling update strategy with explicit bounds

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-server
  namespace: app
  labels:
    app.kubernetes.io/name: api-server
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: api-server
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP
```

### ConfigMap and Secret

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
  namespace: app
data:
  LOG_LEVEL: "info"
  NODE_ENV: "production"
  MAX_CONNECTIONS: "100"
---
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
  namespace: app
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@db-svc:5432/app"
  API_KEY: "sk-live-abc123"
```

### Ingress with TLS

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: app
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
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
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-server
                port:
                  number: 80
          - path: /health
            pathType: Exact
            backend:
              service:
                name: api-server
                port:
                  number: 80
```

**Why good:** `ingressClassName` field (not deprecated `kubernetes.io/ingress.class` annotation), TLS with secret reference, mixed `pathType` (Prefix for API routes, Exact for health)

---

## Example 2: Service Types

### NodePort (Development / Testing)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-nodeport
  namespace: dev
spec:
  type: NodePort
  selector:
    app.kubernetes.io/name: api-server
  ports:
    - port: 80
      targetPort: 3000
      nodePort: 30080
```

### LoadBalancer (External Traffic)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-lb
  namespace: app
  annotations:
    # Cloud-provider-specific annotations go here
    service.beta.kubernetes.io/aws-load-balancer-scheme: internet-facing
spec:
  type: LoadBalancer
  selector:
    app.kubernetes.io/name: api-server
  ports:
    - port: 443
      targetPort: 3000
      protocol: TCP
```

### Headless Service (StatefulSet Discovery)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: db-headless
  namespace: app
spec:
  type: ClusterIP
  clusterIP: None
  selector:
    app.kubernetes.io/name: database
  ports:
    - port: 5432
      targetPort: 5432
```

**Why headless:** Each pod gets a DNS record like `db-0.db-headless.app.svc.cluster.local`, enabling direct pod addressing for StatefulSets.

---

## Example 3: ConfigMap Injection Patterns

### envFrom (All Keys)

```yaml
containers:
  - name: app
    envFrom:
      - configMapRef:
          name: api-config
      - secretRef:
          name: api-secrets
```

### Selective env (Specific Keys)

```yaml
containers:
  - name: app
    env:
      - name: DB_HOST
        valueFrom:
          configMapKeyRef:
            name: api-config
            key: DB_HOST
      - name: DB_PASSWORD
        valueFrom:
          secretKeyRef:
            name: api-secrets
            key: DB_PASSWORD
```

### Volume Mount (Config Files)

```yaml
containers:
  - name: app
    volumeMounts:
      - name: config-volume
        mountPath: /etc/app/config
        readOnly: true
volumes:
  - name: config-volume
    configMap:
      name: app-file-config
      items:
        - key: app.conf
          path: app.conf
        - key: logging.conf
          path: logging.conf
```

---

## Example 4: Kustomize Base/Overlay

### Base

```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml
commonLabels:
  app.kubernetes.io/name: api-server
```

### Staging Overlay

```yaml
# k8s/overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
namespace: staging
patches:
  - path: replica-patch.yaml
configMapGenerator:
  - name: api-config
    behavior: merge
    literals:
      - LOG_LEVEL=debug
      - NODE_ENV=staging
```

```yaml
# k8s/overlays/staging/replica-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 1
```

### Production Overlay

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
  - hpa.yaml
  - pdb.yaml
namespace: production
patches:
  - path: resource-patch.yaml
configMapGenerator:
  - name: api-config
    behavior: merge
    literals:
      - LOG_LEVEL=warn
      - NODE_ENV=production
secretGenerator:
  - name: api-secrets
    envs:
      - secrets.env
```

```yaml
# k8s/overlays/production/resource-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: api-server
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: "2"
              memory: 1Gi
```

**Why good:** Base manifests are valid YAML (no template syntax), overlays contain only diffs, `configMapGenerator` appends content hash to name (auto-triggers rollouts), `secretGenerator` keeps secrets out of base manifests

**Apply:** `kubectl apply -k k8s/overlays/production/`

---

## Anti-Patterns

### Bad: Missing Security Context

```yaml
# BAD: No security context -- runs as root by default
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  template:
    spec:
      containers:
        - name: api-server
          image: api-server:latest
          ports:
            - containerPort: 3000
```

**Why bad:** Runs as root (default), no resource limits (can consume all node resources), `:latest` tag (non-deterministic), no probes (unmonitored health), no service account (uses default with API access)

### Bad: Overly Permissive RBAC

```yaml
# BAD: Wildcard permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: app-role
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
```

**Why bad:** Grants cluster-admin equivalent access, violates least privilege, any compromised pod has full cluster control

### Bad: Deprecated API Version

```yaml
# BAD: extensions/v1beta1 removed in Kubernetes 1.22
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
```

**Why bad:** `extensions/v1beta1` removed since v1.22, `kubernetes.io/ingress.class` annotation deprecated in favor of `ingressClassName` field, missing `pathType` (required in v1)
