# Kubernetes -- Helm Chart Examples

> Helm chart structure, values.yaml, templates, helpers, dependencies, and multi-environment releases. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) - Deployments, Services, Ingress, ConfigMaps, Secrets
- [operations.md](operations.md) - HPA, RBAC, health checks, resource limits, PDB

---

## Example 1: Complete Helm Chart

### Chart.yaml

```yaml
apiVersion: v2
name: my-app
description: A Helm chart for my application
type: application
version: 0.1.0
appVersion: "1.0.0"
maintainers:
  - name: team-platform
dependencies:
  - name: postgresql
    version: "~15.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
```

**Why good:** `apiVersion: v2` (Helm 3), dependencies inline (not separate `requirements.yaml`), `condition` enables toggling sub-charts, SemVer for both chart version and appVersion

### values.yaml

```yaml
# -- Number of replicas (ignored when HPA enabled)
replicaCount: 3

image:
  repository: registry.example.com/my-app
  tag: "" # Defaults to chart appVersion
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: nginx
  hosts:
    - host: app.example.com
      paths:
        - path: /
          pathType: Prefix
  tls: []

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: "1"
    memory: 512Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilization: 70

securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]

podSecurityContext:
  fsGroup: 2000
  seccompProfile:
    type: RuntimeDefault

probes:
  liveness:
    path: /healthz
    initialDelaySeconds: 15
    periodSeconds: 20
  readiness:
    path: /ready
    initialDelaySeconds: 5
    periodSeconds: 10

serviceAccount:
  create: true
  automountServiceAccountToken: false
  annotations: {}

postgresql:
  enabled: true
```

**Why good:** Grouped by concern, comments explain non-obvious defaults, security values mirror restricted Pod Security Standards, HPA and Ingress conditionally enabled, image tag defaults to appVersion

### templates/\_helpers.tpl

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "my-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a fully qualified app name.
*/}}
{{- define "my-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "my-app.labels" -}}
helm.sh/chart: {{ include "my-app.chart" . }}
{{ include "my-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels -- immutable after first deployment
*/}}
{{- define "my-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "my-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Chart label
*/}}
{{- define "my-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Service account name
*/}}
{{- define "my-app.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "my-app.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
```

**Why good:** Selector labels separated from common labels (selectors are immutable), names truncated to 63 chars (Kubernetes limit), `fullname` avoids redundant chart name in release name

### templates/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      {{- include "my-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "my-app.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "my-app.serviceAccountName" . }}
      automountServiceAccountToken: {{ .Values.serviceAccount.automountServiceAccountToken }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          livenessProbe:
            httpGet:
              path: {{ .Values.probes.liveness.path }}
              port: http
            initialDelaySeconds: {{ .Values.probes.liveness.initialDelaySeconds }}
            periodSeconds: {{ .Values.probes.liveness.periodSeconds }}
          readinessProbe:
            httpGet:
              path: {{ .Values.probes.readiness.path }}
              port: http
            initialDelaySeconds: {{ .Values.probes.readiness.initialDelaySeconds }}
            periodSeconds: {{ .Values.probes.readiness.periodSeconds }}
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
```

**Why good:** Replicas conditionally omitted when HPA enabled, image tag falls back to `appVersion`, security contexts injected from values via `toYaml`, `emptyDir` for tmp (readOnlyRootFilesystem), `nindent` handles YAML indentation correctly

### templates/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: { { include "my-app.fullname" . } }
  labels: { { - include "my-app.labels" . | nindent 4 } }
spec:
  type: { { .Values.service.type } }
  selector: { { - include "my-app.selectorLabels" . | nindent 4 } }
  ports:
    - name: http
      port: { { .Values.service.port } }
      targetPort: http
      protocol: TCP
```

### templates/ingress.yaml (Conditional)

```yaml
{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "my-app.fullname" $ }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}
{{- end }}
```

**Why good:** Entire resource conditional on `ingress.enabled`, `ingressClassName` field (not deprecated annotation), `$` used for root context inside range loops, hosts quoted for safety

### templates/hpa.yaml (Conditional)

```yaml
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "my-app.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilization }}
{{- end }}
```

---

## Example 2: Multi-Environment Values

### values-staging.yaml

```yaml
replicaCount: 1

image:
  tag: "staging-latest"

ingress:
  enabled: true
  hosts:
    - host: staging.example.com
      paths:
        - path: /
          pathType: Prefix

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

postgresql:
  enabled: true
```

### values-production.yaml

```yaml
replicaCount: 3

ingress:
  enabled: true
  hosts:
    - host: app.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - hosts:
        - app.example.com
      secretName: app-tls

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilization: 60

resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: "2"
    memory: 1Gi
```

**Deploy:** `helm upgrade --install my-app ./my-app -f values-production.yaml -n production`

---

## Anti-Patterns

### Bad: Complex Logic in Templates

```yaml
# BAD: Business logic in template
{{- if and .Values.autoscaling.enabled (gt (int .Values.autoscaling.maxReplicas) 5) (not .Values.maintenance.enabled) }}
{{- if or (eq .Values.environment "production") (eq .Values.environment "staging") }}
replicas: {{ mul .Values.replicaCount 2 | add 1 }}
{{- end }}
{{- end }}
```

**Why bad:** Complex conditionals belong in `_helpers.tpl` as named templates or in application logic, not inlined in resource templates

### Bad: Hardcoded Values in Templates

```yaml
# BAD: Values that change between environments hardcoded
containers:
  - name: app
    image: "myregistry.io/app:v1.0.0"
    resources:
      requests:
        cpu: 500m
        memory: 512Mi
```

**Why bad:** Image and resource values hardcoded in template instead of parameterized through `values.yaml` -- every environment gets the same config

### Bad: Missing Conditional for HPA + Replicas

```yaml
# BAD: replicas always set even when HPA manages scaling
spec:
  replicas: { { .Values.replicaCount } }
```

**Why bad:** When HPA is active, Helm resets replicas to the manifest value on every upgrade, overriding HPA's scaling decisions. Wrap in `{{- if not .Values.autoscaling.enabled }}`
